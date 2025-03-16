import logging
import os
from functools import wraps

import functions_framework
import httpx
import jwt
from dotenv import load_dotenv
from flask import Flask, Request, Response, g, request
from werkzeug.middleware.proxy_fix import ProxyFix

from .controllers import (
    add_admins,
    add_ban,
    add_bit,
    add_bit_to_settings,
    add_ratelimit,
    add_voice,
    add_voice_to_settings,
    delete_admins,
    delete_ban,
    delete_bit,
    delete_bit_from_settings,
    delete_ratelimit,
    delete_settings_field,
    delete_voice,
    delete_voice_from_settings,
    get_admins,
    get_ban,
    get_bans,
    get_bit,
    get_bits,
    get_ratelimits,
    get_settings,
    get_voice,
    get_voices,
    status_check,
    update_admins,
    update_ban,
    update_bit,
    update_ratelimit,
    update_settings,
    update_voice,
)

load_dotenv()

AUTH_SERVICE_URL = os.getenv("AUTH_SERVICE_URL")

JWT_PUBLIC_KEY = os.getenv("JWT_PUBLIC_KEY")

WS_SERVICE_URL = os.getenv("WS_SERVICE_URL")

JWT_PRIVATE_KEY = os.getenv("JWT_PRIVATE_KEY")


app = Flask(__name__)
# app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1, x_prefix=1)


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
    response.headers["Access-Control-Allow-Origin"] = "*"
    return response


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

        async with httpx.AsyncClient() as client:
            res = await client.post(
                f"{AUTH_SERVICE_URL}/validate",
                headers={"Authorization": f"Bearer {code}"},
            )

            if res.status_code != 200:
                logging.error(
                    f"Request to {AUTH_SERVICE_URL}/validate failed with status code {res.status_code} and response {res.text}"
                )

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
            g.user_id = user_id
            g.name = res.json().get("name")

        return await f(*args, **kwargs)

    return decorated_function


def require_super_admin(f):
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

        return await f(*args, **kwargs)

    return decorated_function


@app.get("/healthz")
async def healthz_req():
    return await status_check()


@app.get("/")
async def status_check_handler():
    return await status_check()


@app.get("/settings")
@require_auth
async def get_settings_handler():
    return await get_settings()


@app.post("/settings")
@require_auth
async def update_settings_handler():
    return await update_settings()


@app.delete("/settings")
@require_auth
async def delete_settings_field_handler():
    return await delete_settings_field()


@app.post("/settings/voices")
@require_auth
async def add_voice_to_settings_handler():
    return await add_voice_to_settings()


@app.delete("/settings/voices")
@require_auth
async def delete_voice_from_settings_handler():
    return await delete_voice_from_settings()


@app.post("/settings/bits")
@require_auth
async def add_bit_to_settings_handler():
    return await add_bit_to_settings()


@app.delete("/settings/bits")
@require_auth
async def delete_bit_from_settings_handler():
    return await delete_bit_from_settings()


@app.get("/settings/admins")
@require_auth
async def get_admins_handler():
    return await get_admins()


@app.post("/settings/admins")
@require_auth
async def add_admins_handler():
    return await add_admins()


@app.put("/settings/admins")
@require_auth
async def update_admins_handler():
    return await update_admins()


@app.delete("/settings/admins")
@require_auth
async def delete_admins_handler():
    return await delete_admins()


@app.get("/voices")
async def get_voices_handler():
    return await get_voices()


@app.get("/voices/<voice_id>")
@require_auth
async def get_voice_by_id_handler(voice_id: str):
    return await get_voice(voice_id)


@app.post("/voices")
@require_auth
async def add_voice_handler():
    return await add_voice()


@app.put("/voices/<voice_id>")
@require_auth
async def update_voice_handler(voice_id: str):
    return await update_voice(voice_id)


@app.delete("/voices/<voice_id>")
@require_auth
async def delete_voice_handler(voice_id: str):
    return await delete_voice(voice_id)


@app.get("/bits")
async def get_bits_handler():
    return await get_bits()


@app.get("/bits/<bit_id>")
@require_auth
async def get_bit_handler(bit_id: str):
    return await get_bit(bit_id)


@app.post("/bits")
@require_auth
async def add_bit_handler():
    return await add_bit()


@app.delete("/bits/<bit_id>")
@require_auth
async def delete_bit_handler(bit_id: str):
    return await delete_bit(bit_id)


@app.put("/bits/<bit_id>")
@require_auth
async def update_bit_handler(bit_id: str):
    return await update_bit(bit_id)


@app.get("/settings/bans")
@require_auth
async def get_bans_handler():
    return await get_bans()


@app.get("/settings/bans/<target_user_id>")
@require_auth
async def get_ban_handler(target_user_id: str):
    return await get_ban(target_user_id)


@app.post("/settings/bans")
@require_auth
async def add_ban_handler():
    return await add_ban()


@app.delete("/settings/bans")
@require_auth
async def delete_ban_handler():
    return await delete_ban()


@app.put("/settings/bans")
@require_auth
async def update_ban_handler():
    return await update_ban()


@app.get("/settings/ratelimits")
@require_auth
async def get_ratelimits_handler():
    return await get_ratelimits()


@app.post("/settings/ratelimits")
@require_auth
async def add_ratelimit_handler():
    return await add_ratelimit()


@app.delete("/settings/ratelimits")
@require_auth
async def delete_ratelimit_handler():
    return await delete_ratelimit()


@app.put("/settings/ratelimits")
@require_auth
async def update_ratelimit_handler():
    return await update_ratelimit()


@functions_framework.http
def main(request: Request):
    with app.request_context(request.environ):
        try:
            rv = app.preprocess_request()
            if rv is None:
                rv = app.dispatch_request()
            response = app.make_response(rv)
            return app.process_response(response)
        except Exception as e:
            rv = app.handle_user_exception(e)
            response = app.make_response(rv)
            return app.process_response(response)
