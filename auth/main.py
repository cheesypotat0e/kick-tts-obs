import os
import secrets
from datetime import datetime

import functions_framework
from clerk_backend_api import Clerk
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
    # Add CORS headers
    if request.method == "OPTIONS":
        headers = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
        }
        return ("", 204, headers)

    path = request.path

    if path == "/code":
        return generate_code(request)
    elif path == "/token":
        if request.method != "POST":
            return (
                {"error": "Method not allowed"},
                405,
                {"Access-Control-Allow-Origin": "*"},
            )
        return verify_code(request)
    return ("Not Found", 404)


def generate_code(request):

    auth_token = request.headers.get("Authorization")

    if not auth_token or not auth_token.startswith("Bearer "):
        return (
            {"error": "Missing or invalid authorization header"},
            401,
            {"Access-Control-Allow-Origin": "*"},
        )

    print(auth_token)
    res = clerk.clients.verify(request={"token": auth_token})

    assert res is not None

    user_id = request.query_params.get("user_id")

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

    doc_ref = db.collection("users").document(user_id)
    doc = doc_ref.get()

    if not doc.exists:
        return ({"error": "User not found"}, 400, {"Access-Control-Allow-Origin": "*"})

    access_token = doc.get("access_token")
    refresh_token = doc.get("refresh_token")
    expiry = doc.get("expiry")
    scope = doc.get("scope")

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
