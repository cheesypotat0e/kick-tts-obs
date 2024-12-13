import functions_framework
from flask import make_response
import base64
import json
import requests
import os


@functions_framework.http
def main(request):
    """HTTP Cloud Function.
    Args:
        request (flask.Request): The request object.
        <https://flask.palletsprojects.com/en/1.1.x/api/#incoming-request-data>
    Returns:
        The response text, or any set of values that can be turned into a
        Response object using `make_response`
        <https://flask.palletsprojects.com/en/1.1.x/api/#flask.make_response>.
    """
    request_json = request.get_json(silent=True)
    request_args = request.args

    # CORS preflight
    if request.method == "OPTIONS":
        headers = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET",
            "Access-Control-Allow-Headers": "Content-Type",
            "Access-Control-Max-Age": "3600",
        }
        return "", 204, headers

    headers = {"Access-Control-Allow-Origin": "*"}

    if request.method != "GET":
        return make_response("Method not allowed", 405, headers)

    text = None
    if request_json and "text" in request_json:
        text = request_json["text"]
    elif request_args and "text" in request_args:
        text = request_args.get("text")
    if not text:
        return make_response("Missing text", 400)

    language = (
        request_json.get("lang") if request_json else request_args.get("lang")
    ) or "french"
    code = (
        request_json.get("lang_code") if request_json else request_args.get("lang_code")
    )
    platform = (
        request_json.get("platform") if request_json else request_args.get("platform")
    )
    v2 = (
        request_json.get("v2") if request_json else request_args.get("v2", "false")
    ).lower()

    try:
        headers["Content-Type"] = "audio/ogg"
        audio_content = text_to_speech_api_key(
            text,
            api_key=os.getenv("GCLOUD_KEY"),
            neet_api_key=os.getenv("NEETS_KEY"),
            fish_api_key=os.getenv("FISH_KEY"),
            language=language.lower(),
            code=(code.lower() if code else None),
            platform=(platform.lower() if platform else None),
            v2=v2,
        )
        return make_response(audio_content, 200, headers)
    except ValueError as err:
        return make_response(str(err), 400)
    except Exception as err:
        return make_response(f"Internal Server Error: {str(err)}", 500)


def text_to_speech_api_key(
    text, api_key, neet_api_key, fish_api_key, language="french", code=None, platform=None, v2="false"
):
    url = f"https://texttospeech.googleapis.com/v1/text:synthesize?key={api_key}"
    neet_url = "https://api.neets.ai/v1/tts"
    fish_url = "https://api.fish.audio/v1/tts"

    if v2 == "true":
        if platform == "gcloud":
            voice = {"languageCode": code, "name": language}
            payload = {
                "input": {"text": text},
                "voice": voice,
                "audioConfig": {"audioEncoding": "OGG_OPUS"},
            }
            headers = {"Content-Type": "application/json"}
            response = requests.post(url, headers=headers, data=json.dumps(payload))
            response.raise_for_status()
            return base64.b64decode(response.json().get("audioContent", ""))
        elif platform == "fish":
            headers = {
                "Authorization": f"Bearer {fish_api_key}",
                "Content-Type": "application/json"
            }
            payload = {
                "text": text,
                "reference_id": code,
                "format": "mp3"
            }
            response = requests.post(fish_url, headers=headers, json=payload)
            response.raise_for_status()
            return response.content
        elif platform == "neets":
            headers = {"Content-Type": "application/json", "X-API-Key": neet_api_key}
            data = {
                "text": text,
                "voice_id": language,
                "params": {"model": "ar-diff-50k"},
            }
            response = requests.post(neet_url, headers=headers, data=json.dumps(data))
            response.raise_for_status()
            return response.content
    else:
        if language in {"trump", "kamala"}:
            headers = {"Content-Type": "application/json", "X-API-Key": neet_api_key}
            data = {
                "text": text,
                "voice_id": "donald-trump" if language == "trump" else "kamala-harris",
                "params": {"model": "ar-diff-50k"},
            }
            response = requests.post(neet_url, headers=headers, data=json.dumps(data))
            response.raise_for_status()
            return response.content

        voice = {
            "languageCode": "es-US" if language == "spanish" else "fr-CA",
            "name": "es-US-Journey-D" if language == "spanish" else "fr-CA-Journey-D",
        }
        payload = {
            "input": {"text": text},
            "voice": voice,
            "audioConfig": {"audioEncoding": "OGG_OPUS"},
        }
        headers = {"Content-Type": "application/json"}
        response = requests.post(url, headers=headers, data=json.dumps(payload))
        response.raise_for_status()
        return base64.b64decode(response.json().get("audioContent", ""))
