import base64
import json
import os

import functions_framework
import requests
from flask import Flask, make_response, request

app = Flask(__name__)

api_key = os.getenv("GCLOUD_KEY")
neet_api_key = os.getenv("NEETS_KEY")
fish_api_key = os.getenv("FISH_KEY")
authFeatureFlag = os.getenv("AUTH_FEATURE_FLAG")
authServiceUrl = os.getenv("AUTH_SERVICE_URL")


@functions_framework.http
def main(request):
    with app.request_context(request.environ):
        try:
            rv = app.preprocess_request()
            if rv is None:
                rv = app.dispatch_request()
        except Exception as e:
            print(f"Error in tts_handler: {e.with_traceback()}")
            rv = app.handle_user_exception(e)
        response = app.make_response(rv)
        return app.process_response(response)


@app.before_request
def before_request_func():
    if request.method == "OPTIONS":
        response = app.make_default_response()
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Methods"] = "GET"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
        response.headers["Access-Control-Max-Age"] = "3600"
        response.status_code = 204
        return response


@app.after_request
def after_request_func(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    return response


@app.route("/", methods=["GET"])
def tts_req():

    if authFeatureFlag == "true":
        token = request.headers.get("Authorization")

        if not token:
            return make_response("Missing token", 401)

        code = token.split(" ")[1]

        verify(code)

    request_json = request.get_json(silent=True)
    request_args = request.args

    text = request_json.get("text") if request_json else request_args.get("text")

    if not text:
        return make_response("Missing text", 400)

    language = request_json.get("lang") if request_json else request_args.get("lang")
    code = (
        request_json.get("lang_code") if request_json else request_args.get("lang_code")
    )
    platform = (
        request_json.get("platform") if request_json else request_args.get("platform")
    )

    try:
        headers = {}

        headers["Content-Type"] = "audio/ogg"

        audio_content = text_to_speech_api_key(
            text,
            api_key=api_key,
            neet_api_key=neet_api_key,
            fish_api_key=fish_api_key,
            language=language.lower(),
            code=(code.lower() if code else None),
            platform=(platform.lower() if platform else None),
        )
        return make_response(audio_content, 200, headers)
    except ValueError as err:
        return make_response(str(err), 400)
    except Exception as err:
        return make_response(f"Internal Server Error: {str(err)}", 500)


def text_to_speech_api_key(
    text,
    api_key,
    neet_api_key,
    fish_api_key,
    language="french",
    code=None,
    platform=None,
):
    url = f"https://texttospeech.googleapis.com/v1/text:synthesize?key={api_key}"
    neet_url = "https://api.neets.ai/v1/tts"
    fish_url = "https://api.fish.audio/v1/tts"

    if platform == "gcloud":
        voice = {"languageCode": code, "name": language}

        payload = {
            "input": {"text": text},
            "voice": voice,
            "audioConfig": {"audioEncoding": "OGG_OPUS"},
        }

        response = requests.post(
            url, headers={"Content-Type": "application/json"}, data=json.dumps(payload)
        )

        response.raise_for_status()

        return base64.b64decode(response.json().get("audioContent", ""))

    elif platform == "fish":
        payload = {"text": text, "reference_id": code, "format": "mp3"}

        response = requests.post(
            fish_url,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {fish_api_key}",
            },
            json=payload,
        )

        response.raise_for_status()

        return response.content

    elif platform == "neets":
        data = {
            "text": text,
            "voice_id": language,
            "params": {"model": "ar-diff-50k"},
        }
        response = requests.post(
            neet_url,
            headers={"Content-Type": "application/json", "X-API-Key": neet_api_key},
            data=json.dumps(data),
        )
        response.raise_for_status()
        return response.content


def verify(token):
    response = requests.post(f"{authServiceUrl}/validate", json={"code": token})

    response.raise_for_status()

    user_id = response.json().get("user_id")

    print(f"Channel ID: {user_id} - Token: {token}")

    return response.json()
