import os
import secrets
from datetime import datetime
from functools import wraps

import functions_framework
import jwt
import requests
from flask import Flask, Response, g, request
from google.cloud import firestore

db = firestore.Client()

TTS_SERVICE_URL = os.environ.get("TTS_SERVICE_URL")
WS_SERVICE_URL = os.environ.get("WS_SERVICE_URL")
JWT_PRIVATE_KEY = os.environ.get("JWT_PRIVATE_KEY")


app = Flask(__name__)


@app.before_request
def before_request_func():
    if request.method == "OPTIONS":
        return (
            "",
            204,
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


def require_kick_auth(f):
    @wraps(f)
    async def decorated_function(*args, **kwargs):

        if request.method == "OPTIONS":
            return await f(*args, **kwargs)

        token = request.headers.get("Authorization")

        if not token:
            return (
                {"error": "Missing or invalid authorization header"},
                401,
            )

        try:
            token = token.split(" ")[1]
        except IndexError:
            return (
                {"error": "Missing or invalid authorization header"},
                401,
            )

        try:
            res = validate_kick_access_token(token)
        except (UnauthorizedError, InvalidTokenError):
            return (
                {"error": "Unauthorized by Kick"},
                401,
            )
        except APIError:
            return (
                {"error": "Kick API error"},
                401,
            )
        except Exception as e:
            print(f"Error in generate_code: {str(e)}")
            return (
                {"error": "Internal server error"},
                500,
            )

        if not res:
            return (
                {"error": "Invalid or expired Kick access token"},
                401,
            )

        try:
            data = auth_kick_token(token)
        except (UnauthorizedError, InvalidTokenError):
            return (
                {"error": "Unauthorized by Kick"},
                401,
            )
        except APIError:
            return (
                {"error": "Kick API error"},
                401,
            )
        except Exception as e:
            print(f"Error in generate_code: {str(e)}")
            return (
                {"error": "Internal server error"},
                500,
            )

        if not data:
            return (
                {"error": "Missing Kick user data"},
                500,
            )

        user_id = data.get("id")
        name = data.get("username")

        g.user_id = user_id
        g.name = name

        return await f(*args, **kwargs)

    return decorated_function


def require_auth(f):
    @wraps(f)
    async def decorated_function(*args, **kwargs):
        if request.method == "OPTIONS":
            return await f(*args, **kwargs)

        token = request.headers.get("Authorization")
        if not token:
            return (
                {"error": "Missing or invalid authorization header"},
                401,
            )

        try:
            code = token.split(" ")[1]
        except IndexError:
            return (
                {"error": "Missing or invalid authorization header"},
                401,
            )

        record = validate_code(code)

        if not record:
            return (
                {"error": "Invalid code"},
                401,
            )

        user_id = record.get("user_id")
        name = record.get("name")

        g.user_id = user_id
        g.name = name
        return await f(*args, **kwargs)

    return decorated_function


@app.get("/healthz")
def healthz_req():
    return {"status": "ok"}, 200


@app.get("/")
def root():
    return {"status": "ok"}, 200


@app.get("/code")
@require_kick_auth
def generate_code_req():
    return generate_code()


@app.post("/validate")
@require_auth
def validate_code_req():
    return validate_auth_code()


@app.post("/auth")
@require_auth
def auth_req():
    return auth_code()


@app.delete("/auth")
@require_kick_auth
def revoke_auth_req():
    return revoke_auth()


@app.get("/ws/auth")
@require_auth
def get_ws_auth_token_req():
    return get_ws_auth_token()


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
    user_id = g.user_id
    name = g.name

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
    )


def validate_auth_code():

    user_id = g.user_id

    return (
        {"user_id": str(user_id), "name": g.name},
        200,
    )


def auth_code():

    user_id = g.user_id
    name = g.name

    user = db.collection("users").document(str(user_id)).get()

    if not user.exists:
        return (
            {"error": "User not found"},
            400,
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
            "ws_service_url": WS_SERVICE_URL,
            "user_id": user_id,
            "name": name,
        },
        200,
    )


def revoke_auth():

    user_id = g.user_id

    user = db.collection("users").document(str(user_id)).get()

    if not user.exists:
        return (
            {"error": "User not found"},
            400,
        )

    code = user.get("code")

    db.collection("auth-codes").document(code).delete()

    return (
        {"success": "Code revoked"},
        200,
    )


def get_ws_auth_token():
    name = g.name

    token = jwt.encode(
        {"sub": name},
        JWT_PRIVATE_KEY,
        algorithm="HS256",
    )

    return (
        {"token": token},
        200,
    )


def validate_kick_access_token(access_token: str):

    res = requests.post(
        "https://api.kick.com/public/v1/token/introspect",
        headers={"Authorization": "Bearer " + access_token},
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
        headers={"Authorization": "Bearer " + access_token},
    )

    data = res.json()

    if res.status_code == 401:
        raise UnauthorizedError(data.get("message"))

    if res.status_code == 400:
        raise InvalidTokenError(data.get("message"))

    if res.status_code != 200:
        raise APIError(data.get("message"))

    return data.get("data")[0]


def validate_code(code: str):
    auth_code = db.collection("auth-codes").document(code).get()

    if not auth_code.exists:
        return {}

    return auth_code.to_dict()


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
