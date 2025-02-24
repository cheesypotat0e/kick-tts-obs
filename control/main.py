import os
from functools import wraps

import functions_framework
import jwt
import requests
from flask import Flask, Response, request

from controllers.admins import add_admins, delete_admins
from controllers.bans import add_ban, delete_ban, get_bans, update_ban
from controllers.bits import add_bit, delete_bit, get_bit, get_bits, update_bit
from controllers.ratelimits import (
    add_ratelimit,
    delete_ratelimit,
    get_ratelimits,
    update_ratelimit,
)
from controllers.settings import (
    add_bit_to_settings,
    add_voice_to_settings,
    delete_bit_from_settings,
    delete_settings_field,
    delete_voice_from_settings,
    get_settings,
    update_settings,
)
from controllers.status_check import status_check
from controllers.voices import add_voice, delete_voice, get_voice, update_voice

AUTH_SERVICE_URL = os.getenv("AUTH_SERVICE_URL", "https://api.cheesybot.xyz/api/auth")
JWT_PUBLIC_KEY = os.getenv("JWT_PUBLIC_KEY")

app = Flask(__name__)


@app.before_request
def before_request():
    if request.method == "OPTIONS":
        return (
            "",
            204,
            {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "*",
                "Access-Control-Allow-Headers": "*",
            },
        )


@app.after_request
def after_request(response: Response):
    response.headers.add("Access-Control-Allow-Origin", "*")
    return response


def require_auth(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if request.method == "OPTIONS":
            return f(*args, **kwargs)

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

        res = requests.post(f"{AUTH_SERVICE_URL}/validate", json={"code": code})

        if res.status_code == 400:
            return (
                {"error": "Missing or invalid authorization header"},
                401,
            )
        if res.status_code == 401:
            return (
                {"error": "Unauthorized"},
                401,
            )

        user_id = res.json().get("user_id")
        request.user_id = user_id

        return f(*args, **kwargs)

    return decorated_function


def require_super_admin(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if request.method == "OPTIONS":
            return f(*args, **kwargs)

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
            jwt.decode(token, JWT_PUBLIC_KEY, algorithms=["RS256"])
        except jwt.InvalidTokenError:
            return (
                {"error": "Invalid token"},
                401,
            )
        except Exception:
            return (
                {"error": "Invalid token"},
                401,
            )

        return f(*args, **kwargs)

    return decorated_function


@app.get("/")
async def status_check_handler():
    return await status_check()


@require_auth
@app.get("/settings")
async def get_settings_handler():
    return await get_settings()


@require_auth
@app.post("/settings")
async def update_settings_handler():
    return await update_settings()


@require_auth
@app.delete("/settings")
async def delete_settings_field_handler():
    return await delete_settings_field()


@require_auth
@app.post("/settings/voices")
async def add_voice_to_settings_handler():
    return await add_voice_to_settings()


@require_auth
@app.delete("/settings/voices")
async def delete_voice_from_settings_handler():
    return await delete_voice_from_settings()


@require_auth
@app.post("/settings/bits")
async def add_bit_to_settings_handler():
    return await add_bit_to_settings()


@require_auth
@app.delete("/settings/bits")
async def delete_bit_from_settings_handler():
    return await delete_bit_from_settings()


@require_auth
@app.post("/admins")
async def add_admins_handler():
    return await add_admins()


@require_auth
@app.delete("/admins")
async def delete_admins_handler():
    return await delete_admins()


@require_auth
@app.get("/voice")
async def get_voice_handler():
    return await get_voice()


@require_auth
@app.get("/voice/<voice_id>")
async def get_voice_by_id_handler(voice_id: str):
    return await get_voice(voice_id)


@require_auth
@app.post("/voice")
async def add_voice_handler():
    return await add_voice()


@require_auth
@app.put("/voice/<voice_id>")
async def update_voice_handler(voice_id: str):
    return await update_voice(voice_id)


@require_auth
@app.delete("/voice/<voice_id>")
async def delete_voice_handler(voice_id: str):
    return await delete_voice(voice_id)


@require_auth
@app.get("/bits")
async def get_bits_handler():
    return await get_bits()


@require_auth
@app.get("/bits/<bit_id>")
async def get_bit_handler(bit_id: str):
    return await get_bit(bit_id)


@require_auth
@app.post("/bits")
async def add_bit_handler():
    return await add_bit()


@require_auth
@app.delete("/bits/<bit_id>")
async def delete_bit_handler(bit_id: str):
    return await delete_bit(bit_id)


@require_auth
@app.put("/bits/<bit_id>")
async def update_bit_handler(bit_id: str):
    return await update_bit(bit_id)


@require_auth
@app.get("/bans")
async def get_bans_handler():
    return await get_bans()


@require_auth
@app.post("/bans")
async def add_ban_handler():
    return await add_ban()


@require_auth
@app.delete("/bans")
async def delete_ban_handler():
    return await delete_ban()


@require_auth
@app.put("/bans")
async def update_ban_handler():
    return await update_ban()


@require_auth
@app.get("/ratelimits")
async def get_ratelimits_handler():
    return await get_ratelimits()


@require_auth
@app.post("/ratelimits")
async def add_ratelimit_handler():
    return await add_ratelimit()


@require_auth
@app.delete("/ratelimits")
async def delete_ratelimit_handler():
    return await delete_ratelimit()


@require_auth
@app.put("/ratelimits")
async def update_ratelimit_handler():
    return await update_ratelimit()


@functions_framework.http
def main():
    with app.request_context(request.environ):
        try:
            rv = app.preprocess_request()
            if rv is None:
                rv = app.dispatch_request()
        except Exception as e:
            rv = app.handle_user_exception(e)
        response = app.make_response(rv)
        return app.process_response(response)
