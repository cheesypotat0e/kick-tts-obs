import os
import secrets
from datetime import datetime

import functions_framework
import requests
from clerk_backend_api import Clerk
from flask import Flask, Request, Response, request
from google.cloud import firestore

# Initialize Firestore client
db = firestore.Client()

# Load environment variables
PRIVATE_KEY = os.environ.get("PRIVATE_KEY")
PUBLIC_KEY = os.environ.get("PUBLIC_KEY")
TTS_SERVICE_URL = os.environ.get("TTS_SERVICE_URL")

clerk = Clerk(
    bearer_auth=os.environ.get("CLERK_SECRET_KEY"),
)

app = Flask(__name__)


@app.before_request
def before_request_func():
    if request.method == "OPTIONS":
        return (
            "",
            200,
            {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
                "Access-Control-Allow-Headers": "Authorization, Content-Type",
            },
        )


@app.after_request
def after_request_func(response: Response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    return response


@app.route("/code", methods=["GET"])
def generate_code_req():
    return generate_code()


@app.route("/validate", methods=["POST"])
def validate_code_req():
    return validate_auth_code()


@app.route("/auth", methods=["POST"])
def auth_req():
    return auth_code()


@app.route("/auth", methods=["DELETE"])
def revoke_auth_req():
    return revoke_auth()


@functions_framework.http
def auth_handler(request):
    with app.request_context(request.environ):
        try:
            rv = app.preprocess_request()
            if rv is None:
                rv = app.dispatch_request()
        except Exception as e:
            print(f"Error in auth_handler: {str(e)}")
            rv = app.handle_user_exception(e)
        response = app.make_response(rv)
        return app.process_response(response)


def generate_code():
    auth_token = request.headers.get("Authorization")

    if not auth_token or not auth_token.startswith("Bearer "):
        return (
            {"error": "Missing or invalid authorization header"},
            401,
            {"Access-Control-Allow-Origin": "*"},
        )

    try:
        res = validate_kick_access_token(auth_token)
    except (UnauthorizedError, InvalidTokenError):
        return (
            {"error": "Unauthorized by Kick"},
            401,
            {"Access-Control-Allow-Origin": "*"},
        )
    except APIError:
        return (
            {"error": "Kick API error"},
            401,
            {"Access-Control-Allow-Origin": "*"},
        )
    except Exception as e:
        print(f"Error in generate_code: {str(e)}")
        return (
            {"error": "Internal server error"},
            500,
            {"Access-Control-Allow-Origin": "*"},
        )

    if not res:
        return (
            {"error": "Invalid or expired Kick access token"},
            401,
            {"Access-Control-Allow-Origin": "*"},
        )

    if not res:
        return (
            {"error": "Invalid or expired session"},
            401,
            {"Access-Control-Allow-Origin": "*"},
        )

    try:
        data = auth_kick_token(auth_token)
    except (UnauthorizedError, InvalidTokenError):
        return (
            {"error": "Unauthorized by Kick"},
            401,
            {"Access-Control-Allow-Origin": "*"},
        )
    except APIError:
        return (
            {"error": "Kick API error"},
            401,
            {"Access-Control-Allow-Origin": "*"},
        )
    except Exception as e:
        print(f"Error in generate_code: {str(e)}")
        return (
            {"error": "Internal server error"},
            500,
            {"Access-Control-Allow-Origin": "*"},
        )

    user_id = data.get("user_id")
    name = data.get("name")

    if not user_id:
        return (
            {"error": "Missing user_id"},
            400,
            {"Access-Control-Allow-Origin": "*"},
        )

    user = db.collection("users").document(str(user_id)).get()

    if user.exists and "code" in user.to_dict():
        code = user.get("code")
    else:
        code = secrets.token_hex(32)
        codes_ref = db.collection("auth-codes")
        codes_ref.document(code).set(
            {
                "code": code,
                "created_at": datetime.now(),
                "user_id": user_id,
                "name": name,
            }
        )

    return (
        {"code": code, "user_id": str(user_id), "name": name},
        200,
        {"Access-Control-Allow-Origin": "*"},
    )


def validate_auth_code():
    """
    ```
    Request:
    {
        "code": string  # Authentication code received from previous step
    }
    ```

    ```
    Response:
    {
        "error": string  # Error message if request fails
    }
    ```
    or
    {
        "user_id": string # The user ID associated with the code
    }

    Status Codes:
    - 200: Success
    - 400: Missing code
    - 401: Invalid code
    """
    request_json = request.get_json()

    if not request_json or "code" not in request_json:
        return (
            {"error": "Missing code in request body"},
            400,
            {"Access-Control-Allow-Origin": "*"},
        )

    code = request_json.get("code")
    auth_code = db.collection("auth-codes").document(code).get()

    if not auth_code.exists:
        return (
            {"error": "Invalid code"},
            401,
            {"Access-Control-Allow-Origin": "*"},
        )

    user_id = auth_code.get("user_id")

    return (
        {"user_id": user_id},
        200,
        {"Access-Control-Allow-Origin": "*"},
    )


def auth_code():
    """
    ```
    Request:
    {
        "code": string  # Authentication code received from previous step
    }
    ```

    ```
    Response:
    {
        "error": string  # Error message if request fails
    }
    ```
    or
    ```
    {
        "access_token": string,  # User's access token
        "refresh_token": string, # User's refresh token
        "expiry": number,       # Token expiry timestamp
        "scope": string        # Token scope
    }
    ```

    Status Codes:
    - 200: Success
    - 400: Invalid/missing code or user not found
    """
    request_json = request.get_json()

    if not request_json or "code" not in request_json:
        return (
            {"error": "Missing code in request body"},
            400,
            {"Access-Control-Allow-Origin": "*"},
        )

    code = request_json["code"]
    auth_code = db.collection("auth-codes").document(code).get()

    if not auth_code.exists:
        return (
            {"error": "Invalid or already used code"},
            400,
            {"Access-Control-Allow-Origin": "*"},
        )

    user_id = auth_code.get("user_id")

    user = db.collection("users").document(str(user_id)).get()

    if not user.exists:
        return (
            {"error": "User not found"},
            400,
            {"Access-Control-Allow-Origin": "*"},
        )

    access_token = user.get("access_token")
    refresh_token = user.get("refresh_token")
    expiry = user.get("expiry")
    scope = user.get("scope")

    return (
        {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "expiry": expiry,
            "scope": scope,
            "tts_service_url": TTS_SERVICE_URL,
        },
        200,
        {"Access-Control-Allow-Origin": "*"},
    )


def revoke_auth():
    """
    ```
    Headers:
    {
        "Authorization": string  # User's kick access token
    }
    ```
    """

    auth_token = request.headers.get("Authorization")

    if not auth_token or not auth_token.startswith("Bearer "):
        return (
            {"error": "Missing or invalid authorization header"},
            401,
            {"Access-Control-Allow-Origin": "*"},
        )

    try:
        res = auth_kick_token(auth_token)
    except (UnauthorizedError, InvalidTokenError):
        return (
            {"error": "Unauthorized by Kick"},
            401,
            {"Access-Control-Allow-Origin": "*"},
        )
    except APIError:
        return (
            {"error": "Kick API error"},
            401,
            {"Access-Control-Allow-Origin": "*"},
        )
    except Exception as e:
        print(f"Error in revoke_auth: {str(e)}")
        return (
            {"error": "Internal server error"},
            500,
            {"Access-Control-Allow-Origin": "*"},
        )

    if not res:
        return (
            {"error": "Invalid or expired Kick access token"},
            401,
            {"Access-Control-Allow-Origin": "*"},
        )

    user_id = res.json().data[0].user_id

    user = db.collection("users").document(str(user_id)).get()

    if not user.exists:
        return (
            {"error": "User not found"},
            400,
            {"Access-Control-Allow-Origin": "*"},
        )

    code = user.get("code")

    db.collection("auth-codes").document(code).delete()

    return (
        {"success": "Code revoked"},
        200,
        {"Access-Control-Allow-Origin": "*"},
    )


def validate_kick_access_token(access_token: str):
    res = requests.post(
        "https://api.kick.com/public/v1/token/introspect",
        headers={"Authorization": access_token},
    )

    data = res.json()

    if res.status_code == 401:
        raise UnauthorizedError(data.get("message"))

    if res.status_code == 400:
        raise InvalidTokenError(data.get("message"))

    if res.status_code != 200:
        raise APIError(data.get("message"))

    return data.get("data").get("active")


def auth_kick_token(access_token: str):

    res = requests.get(
        "https://api.kick.com/public/v1/users",
        headers={"Authorization": access_token},
    )

    data = res.json()

    if res.status_code == 401:
        raise UnauthorizedError(data.get("message"))

    if res.status_code == 400:
        raise InvalidTokenError(data.get("message"))

    if res.status_code != 200:
        raise APIError(data.get("message"))

    return data.get("data")[0]


class UnauthorizedError(Exception):
    """Raised when a user is not authorized or their token is invalid"""

    def __init__(self, message="User is not authorized or token is invalid"):
        self.message = message
        super().__init__(self.message)


class InvalidTokenError(Exception):
    """Raised when the provided token is malformed or expired"""

    def __init__(self, message="Provided token is malformed or expired"):
        self.message = message
        super().__init__(self.message)


class APIError(Exception):
    """Raised when the Kick API returns an unexpected error"""

    def __init__(self, message="Kick API returned an unexpected error"):
        self.message = message
        super().__init__(self.message)


class ValidationError(Exception):
    """Raised when request validation fails"""

    def __init__(self, message="Request validation failed"):
        self.message = message
        super().__init__(self.message)
