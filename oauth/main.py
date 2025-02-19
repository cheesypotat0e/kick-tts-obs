import base64
import hashlib
import os
import secrets
from urllib.parse import urlencode

import functions_framework
import requests
from Flask import redirect

# Load environment variables
CLIENT_ID = os.environ.get("KICK_CLIENT_ID")
REDIRECT_URI = os.environ.get("KICK_REDIRECT_URI")
CLIENT_SECRET = os.environ.get("KICK_CLIENT_SECRET")

code_verifier_store = {}


def generate_code_verifier():
    code_verifier = secrets.token_urlsafe(64)
    return code_verifier


def generate_code_challenge(code_verifier):
    code_challenge_bytes = hashlib.sha256(code_verifier.encode("utf-8")).digest()
    code_challenge = (
        base64.urlsafe_b64encode(code_challenge_bytes).decode("utf-8").rstrip("=")
    )
    return code_challenge


@functions_framework.http
def oauth_handler(request):
    # Add CORS headers
    if request.method == "OPTIONS":
        headers = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
        }
        return ("", 204, headers)

    path = request.path
    if path == "/callback":
        return oauth_callback(request)
    return root(request)


def oauth_callback(request):
    code = request.args.get("code")
    state = request.args.get("state")

    if not code or not state:
        return {"error": "No code received"}, 400, {"Access-Control-Allow-Origin": "*"}

    code_verifier = code_verifier_store.pop(state, None)
    if not code_verifier:
        return (
            {"error": "Invalid state or expired session"},
            400,
            {"Access-Control-Allow-Origin": "*"},
        )

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

    return (
        {
            "access_token": res.get("access_token"),
            "refresh_token": res.get("refresh_token"),
            "expiry": res.get("expires_in"),
            "scope": res.get("scope"),
        },
        200,
        {"Access-Control-Allow-Origin": "*"},
    )


def root(request):
    token = request.args.get("token")

    if token:
        response = requests.post(
            "https://id.kick.com/oauth/token",
            data={
                "grant_type": "refresh_token",
                "client_id": CLIENT_ID,
                "client_secret": CLIENT_SECRET,
                "refresh_token": token,
            },
        )
        res = response.json()
        return (
            {
                "access_token": res.get("access_token"),
                "token_type": res.get("token_type"),
                "refresh_token": res.get("refresh_token"),
                "expiry": res.get("expires_in"),
                "scope": res.get("scope"),
            },
            200,
            {"Access-Control-Allow-Origin": "*"},
        )
    else:
        code_verifier = generate_code_verifier()
        code_challenge = generate_code_challenge(code_verifier)
        state = secrets.token_urlsafe(32)
        code_verifier_store[state] = code_verifier  # Store verifier for later use

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
            headers={"Access-Control-Allow-Origin": "*"},
        )
