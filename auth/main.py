import os
import secrets
from datetime import datetime
from functools import wraps

import functions_framework
from clerk_backend_api import AuthenticateRequestOptions, Clerk
from flask import Flask
from google.cloud import firestore

# Initialize Firestore client
db = firestore.Client()

# Load environment variables
PRIVATE_KEY = os.environ.get("PRIVATE_KEY")
PUBLIC_KEY = os.environ.get("PUBLIC_KEY")

clerk = Clerk(
    bearer_auth=os.environ.get("CLERK_SECRET_KEY"),
)


@functions_framework.http
def auth_handler(request):
    app = Flask(__name__)

    # CORS middleware to add headers to every response
    @app.after_request
    def add_cors_headers(response):
        response.headers.update({"Access-Control-Allow-Origin": "*"})
        return response

    # Handle CORS preflight requests
    @app.before_request
    def handle_preflight():
        if request.method == "OPTIONS":
            response = app.make_response("")
            response.headers.update(
                {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type, Authorization",
                    "Access-Control-Max-Age": "3600",
                }
            )

            print(response.headers)

            return response, 200

    @app.route("/code", methods=["GET"])
    def code_route():
        return generate_code(request)

    @app.route("/token", methods=["POST"])
    def token_route():
        return verify_code(request)

    # Handle the request using the Flask app
    return app(request.environ, lambda x, y: None)


def generate_code(request):

    auth_token = request.headers.get("Authorization")

    if not auth_token or not auth_token.startswith("Bearer "):
        return (
            {"error": "Missing or invalid authorization header"},
            401,
            {"Access-Control-Allow-Origin": "*"},
        )

    res = clerk.authenticate_request(
        request,
        AuthenticateRequestOptions(),
    )

    if not res.is_signed_in:
        return (
            {"error": "Invalid or expired session"},
            401,
            {"Access-Control-Allow-Origin": "*"},
        )

    user_id = request.args.get("user_id")

    if not user_id:
        return (
            {"error": "Missing user_id"},
            400,
            {"Access-Control-Allow-Origin": "*"},
        )

    code = secrets.token_hex(32)

    codes_ref = db.collection("auth-codes")

    codes_ref.document(code).set(
        {
            "code": code,
            "created_at": datetime.now(),
            "used": False,
            "user_id": user_id,
        }
    )

    return ({"code": code}, 200, {"Access-Control-Allow-Origin": "*"})


def verify_code(request):
    request_json = request.get_json(silent=True)
    if not request_json or "code" not in request_json:
        return (
            {"error": "Missing code in request body"},
            400,
            {"Access-Control-Allow-Origin": "*"},
        )

    code = request_json["code"]

    # Query Firestore for code
    codes_ref = db.collection("auth-codes")
    doc = codes_ref.document(code).get()

    if not doc or doc.get("used"):
        return (
            {"error": "Invalid or already used code"},
            400,
            {"Access-Control-Allow-Origin": "*"},
        )

    doc.reference.update({"used": True})

    user_id = doc.get("user_id")

    user = db.collection("users").document(str(user_id)).get()

    if not user.exists:
        return ({"error": "User not found"}, 400, {"Access-Control-Allow-Origin": "*"})

    access_token = user.get("access_token")
    refresh_token = user.get("refresh_token")
    expiry = user.get("expiry")
    scope = user.get("scope")

    return (
        {
            "token": {
                "access_token": access_token,
                "refresh_token": refresh_token,
                "expiry": expiry,
                "scope": scope,
            }
        },
        200,
        {"Access-Control-Allow-Origin": "*"},
    )
