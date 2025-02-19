import os
import secrets
from datetime import datetime

import functions_framework
import jwt
from google.cloud import firestore
from jwt.exceptions import InvalidSignatureError, InvalidTokenError

# Initialize Firestore client
db = firestore.Client()

# Load environment variables
PRIVATE_KEY = os.environ.get("PRIVATE_KEY")
PUBLIC_KEY = os.environ.get("PUBLIC_KEY")


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
    # Verify auth token from headers
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return (
            {"error": "Missing or invalid authorization header"},
            401,
            {"Access-Control-Allow-Origin": "*"},
        )

    token = auth_header.split(" ")[1]

    try:
        decoded_token = jwt.decode(token, PUBLIC_KEY, algorithms=["RS256"])
        user_id = decoded_token.get("sub")
    except InvalidSignatureError:
        return (
            {"error": "Invalid signature"},
            401,
            {"Access-Control-Allow-Origin": "*"},
        )
    except InvalidTokenError:
        return ({"error": "Invalid token"}, 401, {"Access-Control-Allow-Origin": "*"})

    code = secrets.token_hex(32)

    codes_ref = db.collection("auth-codes")
    codes_ref.add(
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
    query = codes_ref.where("code", "==", code).where("used", "==", False).limit(1)
    docs = query.get()

    if not docs:
        return (
            {"error": "Invalid or already used code"},
            400,
            {"Access-Control-Allow-Origin": "*"},
        )

    doc = next(iter(docs))
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
