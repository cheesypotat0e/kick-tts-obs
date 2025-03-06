from flask import request
from google.cloud import firestore


async def get_voices():
    client = firestore.AsyncClient()

    page_size = int(request.args.get("page_size", 10))
    cursor = request.args.get("cursor", None)

    query = client.collection("voices").limit(page_size + 1)
    if cursor:
        doc = await client.collection("voices").document(cursor).get()
        query = query.start_after(doc)

    voices = await query.get()
    voices_list = [voice.to_dict() for voice in voices]

    has_more = len(voices_list) > page_size
    if has_more:
        voices_list = voices_list[:-1]
        next_cursor = voices[-2].id
    else:
        next_cursor = None

    return {"voices": voices_list, "next_cursor": next_cursor}


async def get_voice(voice_id: str):
    client = firestore.AsyncClient()

    voice = await client.collection("voices").document(voice_id).get()

    if not voice.exists:
        return {"error": "Voice not found"}, 404

    return voice.to_dict()


async def add_voice():
    client = firestore.AsyncClient()

    key = request.json.get("key")

    is_valid, error = verify_optional_voice_input(key)

    if not is_valid:
        return error

    voice = {"key": key}

    voice_name = request.json.get("voice_name")
    if voice_name:
        voice["voice_name"] = voice_name

    platform = request.json.get("platform")
    if platform:
        voice["platform"] = platform

    model = request.json.get("model")
    if model:
        voice["model"] = model

    code = request.json.get("code")
    if code:
        voice["code"] = code

    await client.collection("voices").document(key).set(voice)

    return {"message": "Voice created"}, 201


async def update_voice(voice_id: str):
    client = firestore.AsyncClient()

    voice = request.json

    is_valid, error = verify_voice_input(voice)

    if not is_valid:
        return error

    await client.collection("voices").document(voice_id).update(voice)

    return {"message": "Voice updated"}, 200


async def delete_voice(key: str):
    client = firestore.AsyncClient()

    await client.collection("voices").document(key).delete()

    return {"message": "Voice deleted"}, 200


def verify_voice_input(key: str):
    if not key or not isinstance(key, str):
        return (False, ({"error": "Key is required and must be a string"}, 400))

    voice_name = request.json.get("voiceName")
    if not voice_name or not isinstance(voice_name, str):
        return (False, ({"error": "voiceName is required and must be a string"}, 400))

    platform = request.json.get("platform")
    if not platform or not isinstance(platform, str):
        return (False, ({"error": "platform is required and must be a string"}, 400))

    model = request.json.get("model", "")
    if not isinstance(model, str):
        return (False, ({"error": "model must be a string"}, 400))

    code = request.json.get("code", "")
    if not isinstance(code, str):
        return (False, ({"error": "code must be a string"}, 400))

    return (True, None)


def verify_optional_voice_input(key: dict):
    if not key or not isinstance(key, str):
        return (False, ({"error": "Key is required and must be a string"}, 400))

    voice_name = request.json.get("voiceName", "")
    if not isinstance(voice_name, str):
        return (False, ({"error": "voiceName must be a string"}, 400))

    platform = request.json.get("platform", "")
    if not isinstance(platform, str):
        return (False, ({"error": "platform must be a string"}, 400))

    model = request.json.get("model", "")
    if not isinstance(model, str):
        return (False, ({"error": "model must be a string"}, 400))

    code = request.json.get("code", "")
    if not isinstance(code, str):
        return (False, ({"error": "code must be a string"}, 400))

    return (True, None)
