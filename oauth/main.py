import base64
import hashlib
import os
import secrets
from functools import wraps
from urllib.parse import urlencode

import functions_framework
import requests
from flask import Flask, Request, Response, redirect, wraps
from google.cloud import firestore

# Load environment variables
CLIENT_ID = os.environ.get("KICK_CLIENT_ID")
REDIRECT_URI = os.environ.get("KICK_REDIRECT_URI")
CLIENT_SECRET = os.environ.get("KICK_CLIENT_SECRET")
AUTH_SERVICE_URL = os.environ.get("AUTH_SERVICE_URL")
CLIENT_URL = os.environ.get("CLIENT_URL")


def generate_code_verifier():
    code_verifier = secrets.token_urlsafe(64)
    return code_verifier


def generate_code_challenge(code_verifier):
    code_challenge_bytes = hashlib.sha256(code_verifier.encode("utf-8")).digest()
    code_challenge = (
        base64.urlsafe_b64encode(code_challenge_bytes).decode("utf-8").rstrip("=")
    )
    return code_challenge


app = Flask(__name__)


def require_auth(f):
    @wraps(f)
    def decorated_function(request: Request, *args, **kwargs):
        if request.method == "OPTIONS":
            return f(request, *args, **kwargs)

        token = request.headers.get("Authorization")
        if not token:
            return (
                {"error": "Missing or invalid authorization header"},
                401,
                {"Access-Control-Allow-Origin": "*"},
            )

        try:
            code = token.split(" ")[1]
        except IndexError:
            return (
                {"error": "Missing or invalid authorization header"},
                401,
                {"Access-Control-Allow-Origin": "*"},
            )

        res = requests.post(f"{AUTH_SERVICE_URL}/validate", json={"code": code})

        if res.status_code == 400:
            return (
                {"error": "Missing or invalid authorization header"},
                401,
                {"Access-Control-Allow-Origin": "*"},
            )
        if res.status_code == 401:
            return (
                {"error": "Unauthorized"},
                401,
                {"Access-Control-Allow-Origin": "*"},
            )

        user_id = res.json().get("user_id")
        request.user_id = user_id

        return f(request, *args, **kwargs)

    return decorated_function


@app.route("/callback", methods=["GET"])
def oauth_callback_req(request):
    return oauth_callback(request)


@app.route("/", methods=["GET"])
def root_req(request):
    return root(request)


@require_auth
@app.route("/refresh", methods=["POST"])
def refresh_req(request: Request):
    return refresh_token(request)


@functions_framework.http
def oauth_handler(request):
    return app(request.environ, lambda _, y: y)


@app.after_request
def after_request(response: Response):
    response.headers.add("Access-Control-Allow-Origin", "*")
    return response


@app.before_request
def before_request(request: Request):
    if request.method == "OPTIONS":
        return (
            "",
            200,
            {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization",
                "Access-Control-Max-Age": "3600",
            },
        )


@app.after_request
def after_request(response: Response):
    response.headers.add("Access-Control-Allow-Origin", "*")
    return response


def refresh_token(request: Request):
    user_id = request.user_id

    db = firestore.Client()
    doc = db.collection("users").document(str(user_id)).get()
    if not doc.exists:
        return {"error": "User not found"}, 404, {"Access-Control-Allow-Origin": "*"}

    refresh_token = doc.get("refresh_token")

    response = requests.post(
        "https://id.kick.com/oauth/token",
        data={
            "grant_type": "refresh_token",
            "client_id": CLIENT_ID,
            "client_secret": CLIENT_SECRET,
            "refresh_token": refresh_token,
        },
    )
    response = response.json()
    if response.status_code != 200:
        return (
            {"error": "Failed to refresh token"},
            400,
            {"Access-Control-Allow-Origin": "*"},
        )

    access_token = response.get("access_token")
    token_type = response.get("token_type")
    refresh_token = response.get("refresh_token")
    expiry = response.get("expiry")
    scope = response.get("scope")

    db.collection("users").document(str(user_id)).set(
        {
            "access_token": access_token,
            "token_type": token_type,
            "refresh_token": refresh_token,
            "expiry": expiry,
            "scope": scope,
        }
    )

    return (
        {
            "access_token": access_token,
            "token_type": token_type,
            "expiry": expiry,
            "scope": scope,
        },
        200,
        {"Access-Control-Allow-Origin": "*"},
    )


def oauth_callback(request):
    code = request.args.get("code")
    state = request.args.get("state")

    if not code or not state:
        return {"error": "No code received"}, 400, {"Access-Control-Allow-Origin": "*"}

    db = firestore.Client()
    doc = db.collection("code_verifiers").document(state).get()
    if not doc.exists:
        return (
            {"error": "Invalid state or expired session"},
            400,
            {"Access-Control-Allow-Origin": "*"},
        )

    code_verifier = doc.get("code_verifier")
    db.collection("code_verifiers").document(state).delete()

    response = requests.post(
        "https://id.kick.com/oauth/token",
        data={
            "grant_type": "authorization_code",
            "client_id": CLIENT_ID,
            "client_secret": CLIENT_SECRET,
            "redirect_uri": REDIRECT_URI,
            "code_verifier": code_verifier,
            "code": code,
        },
    )
    res = response.json()

    response = requests.get(
        "https://api.kick.com/public/v1/users",
        headers={"Authorization": "Bearer " + res.get("access_token")},
    )

    data = response.json()

    user_id = data.get("data")[0].get("user_id")

    access_token = res.get("access_token")
    refresh_token = res.get("refresh_token")
    expiry = res.get("expires_in")
    scope = res.get("scope")

    # Store tokens in Firestore
    db = firestore.Client()
    doc_ref = db.collection("users").document(str(user_id))
    doc_ref.set(
        {
            "user_id": user_id,
            "access_token": access_token,
            "refresh_token": refresh_token,
            "expiry": expiry,
            "scope": scope,
        }
    )

    res = requests.get(
        f"{AUTH_SERVICE_URL}/code",
        headers={"Authorization": "Bearer " + access_token},
    )

    if res.status_code != 200:
        return (
            {"error": "Failed to generate code"},
            400,
            {"Access-Control-Allow-Origin": "*"},
        )

    data = res.json()

    response = redirect(request.headers.get("Origin", CLIENT_URL) + "/login", code=302)

    response.set_cookie(
        "auth_code",
        data.get("code"),
        max_age=None,
        path="/",
    )

    response.set_cookie(
        "user_id",
        data.get("user_id"),
        max_age=None,
        path="/",
    )

    response.set_cookie(
        "name",
        data.get("name"),
        max_age=None,
        path="/",
    )

    return response


def root(_: Request):
    code_verifier = generate_code_verifier()
    code_challenge = generate_code_challenge(code_verifier)
    state = secrets.token_urlsafe(32)

    db = firestore.Client()

    db.collection("code_verifiers").document(state).set(
        {"code_verifier": code_verifier, "state": state}
    )

    auth_url = "https://id.kick.com/oauth/authorize"
    params = {
        "response_type": "code",
        "client_id": CLIENT_ID,
        "redirect_uri": REDIRECT_URI,
        "scope": "user:read channel:read channel:write chat:write event:subscribe",
        "code_challenge": code_challenge,
        "code_challenge_method": "S256",
        "state": state,
    }

    return redirect(
        auth_url + "?" + urlencode(params),
        code=302,
    )
