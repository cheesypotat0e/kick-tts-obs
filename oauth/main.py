import base64
import hashlib
import os
import secrets
from urllib.parse import urlencode

import requests
from dotenv import load_dotenv
from flask import Flask, redirect, request

load_dotenv()

app = Flask(__name__)

client_id = os.getenv("KICK_CLIENT_ID")
redirect_uri = os.getenv("KICK_REDIRECT_URI")
client_secret = os.getenv("KICK_CLIENT_SECRET")

code_verifier = None


def generate_code_verifier():
    global code_verifier
    code_verifier = secrets.token_urlsafe(64)
    return code_verifier


def generate_code_challenge(code_verifier):
    code_challenge_bytes = hashlib.sha256(code_verifier.encode("utf-8")).digest()
    code_challenge = (
        base64.urlsafe_b64encode(code_challenge_bytes).decode("utf-8").rstrip("=")
    )
    return code_challenge


@app.route("/callback", methods=["GET"])
def oauth_callback(request):
    global code_verifier
    code = request.args.get("code")
    state = request.args.get("state")

    print(f"Received code: {code}")
    print(f"Received state: {state}")

    if code and state:
        response = requests.post(
            "https://id.kick.com/oauth/token",
            data={
                "grant_type": "authorization_code",
                "client_id": client_id,
                "client_secret": client_secret,
                "redirect_uri": redirect_uri,
                "code_verifier": code_verifier,
                "code": code,
            },
        )

        res = response.json()

        access_token = res.get("access_token")
        refresh_token = res.get("refresh_token")
        expiry = res.get("expires_in")
        scope = res.get("scope")

        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "expiry": expiry,
            "scope": scope,
        }, 200
    else:
        return {"error": "No code received"}, 400


@app.route("/", methods=["GET"])
def root():
    token = request.args.get("token")

    if token:
        response = requests.post(
            "https://id.kick.com/oauth/token",
            data={
                "grant_type": "refresh_token",
                "client_id": client_id,
                "client_secret": client_secret,
                "refresh_token": token,
            },
        )

        res = response.json()

        access_token = res.get("access_token")
        token_type = res.get("token_type")
        refresh_token = res.get("refresh_token")
        expiry = res.get("expires_in")
        scope = res.get("scope")

        return {
            "access_token": access_token,
            "token_type": token_type,
            "refresh_token": refresh_token,
            "expiry": expiry,
            "scope": scope,
        }, 200
    else:
        code_verifier = generate_code_verifier()
        code_challenge = generate_code_challenge(code_verifier)

        auth_url = "https://id.kick.com/oauth/authorize"
        params = {
            "response_type": "code",
            "client_id": client_id,
            "redirect_uri": redirect_uri,
            "scope": "user:read channel:read channel:write chat:write event:subscribe",
            "code_challenge": code_challenge,
            "code_challenge_method": "S256",
            "state": secrets.token_urlsafe(32),
        }
        return redirect(auth_url + "?" + urlencode(params)), 302


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)
