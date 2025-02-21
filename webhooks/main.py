import base64
import os

import jwt
import requests
from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives.serialization import load_pem_public_key
from flask import Flask, Request, Response
from functions_framework import http

app = Flask(__name__)

kick_public_key = os.environ["KICK_PUBLIC_KEY"]
ws_private_key = os.environ["WS_PRIVATE_KEY"]
ws_url = os.environ["WS_URL"]


@app.before_request
def before_request(request: Request):
    if request.method == "OPTIONS":
        response = app.make_default_response()
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Methods"] = "POST, GET, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type"
        return response


@app.after_request
def after_request(response: Response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    return response


@app.route("/webhooks", methods=["POST"])
def webhooks(request: Request):

    headers = request.headers

    signature = headers.get("Kick-Event-Signature")
    if not signature:
        return process_admin_request(request)

    body = request.get_data()

    try:
        public_key = load_pem_public_key(kick_public_key.encode())

        decoded_signature = base64.b64decode(signature)

        public_key.verify(decoded_signature, body, padding.PKCS1v15(), hashes.SHA256())
    except (InvalidSignature, ValueError, KeyError):
        return "Invalid signature", 401

    event_type = headers.get("Kick-Event-Type")

    match event_type:
        case "chat.message.sent":
            return "", 200
        case "channel.followed":
            return "Received follow event", 200
        case "channel.subscription.renewal":
            return "Received subscription renewal event", 200
        case "channel.subscription.gifts":
            return "Received subscription gift event", 200
        case "channel.subscription.new":
            return "Received new subscription event", 200
        case _:
            return f"Unknown event type: {event_type}", 400


def process_admin_request(request: Request):
    if not request.headers.get("Authorization"):
        return "Missing authorization header", 401

    if not request.headers["Authorization"].startswith("Bearer "):
        return "Invalid authorization header", 401

    token = request.headers["Authorization"].split(" ")[1]

    try:
        jwt.decode(token, ws_private_key, algorithms=["RS256"])
    except jwt.InvalidTokenError:
        return "Invalid token", 401

    data = request.json()

    message = data.get("message")
    room_id = data.get("room_id")

    if not message or not room_id:
        return "Missing message or room_id", 400

    sendWSMessage(message, room_id)

    return "Message sent", 200


def sendWSMessage(message: str, room_id: str):

    token = jwt.encode({}, ws_private_key, algorithm="HS256")

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }

    res = requests.post(
        f"{ws_url}/broadcast",
        json={"message": message, "room_id": room_id},
        headers=headers,
    )

    if res.status_code != 200:
        return f"Failed to send message: {res.text}", 500

    return "Message sent", 200


@http
def main(request: Request):
    return app(request.environ, lambda _, y: y)
