from flask import g, request
from google.cloud import firestore
import time
import asyncio


async def get_settings():
    start_time = time.time()
    user_id = g.user_id

    client = firestore.AsyncClient()

    settings = await client.collection("settings").document(user_id).get()

    if not settings.exists:
        return {"error": "Settings not found"}, 404

    res = settings.to_dict()

    voices_ref = client.collection("settings").document(user_id).collection("voices")
    bits_ref = client.collection("settings").document(user_id).collection("bits")
    bans_ref = client.collection("settings").document(user_id).collection("bans")
    rate_limits_ref = (
        client.collection("settings").document(user_id).collection("rateLimits")
    )

    voices_task = voices_ref.get()
    bits_task = bits_ref.get()
    bans_task = bans_ref.get()
    rate_limits_task = rate_limits_ref.get()

    voices, bits, bans, rate_limits = await asyncio.gather(
        voices_task, bits_task, bans_task, rate_limits_task
    )

    res["voices"] = [voice.to_dict() for voice in voices]
    res["bits"] = [bit.to_dict() for bit in bits]
    res["bans"] = [ban.to_dict() for ban in bans]
    res["rateLimits"] = [rate_limit.to_dict() for rate_limit in rate_limits]

    end_time = time.time()
    elapsed_time = end_time - start_time
    print(f"get_settings execution time: {elapsed_time:.4f} seconds")

    return res


async def update_settings():
    user_id = g.user_id

    settings = request.json

    client = firestore.AsyncClient()
    await client.collection("settings").document(user_id).set(settings, merge=True)

    return {"message": "Settings updated"}, 200


async def delete_settings_field():
    user_id = g.user_id

    field = request.json.get("field")

    if not field:
        return {"error": "Field is required"}, 400

    client = firestore.AsyncClient()
    await client.collection("settings").document(user_id).update(
        {field: firestore.DELETE_FIELD}
    )

    return {"message": "Field deleted"}, 200


async def add_voice_to_settings():
    user_id = g.user_id

    voice_id = request.json.get("voice_id")

    if not voice_id:
        return {"error": "Voice ID is required"}, 400

    client = firestore.AsyncClient()

    voice = await client.collection("voices").document(voice_id).get()

    if not voice.exists:
        return {"error": "Voice not found"}, 404

    await client.collection("settings").document(user_id).collection("voices").document(
        voice_id
    ).set(voice.to_dict())

    return {"message": "Voice added to settings"}, 200


async def delete_voice_from_settings():
    user_id = g.user_id

    voice_id = request.json.get("voice_id")

    if not voice_id:
        return {"error": "Voice ID is required"}, 400

    client = firestore.AsyncClient()

    await client.collection("settings").document(user_id).collection("voices").document(
        voice_id
    ).delete()

    return {"message": "Voice deleted from settings"}, 200


async def add_bit_to_settings():
    user_id = g.user_id

    bit_id = request.json.get("bit_id")
    volume = request.json.get("volume") or 1.0

    if not bit_id:
        return {"error": "Bit ID is required"}, 400

    client = firestore.AsyncClient()

    bit = await client.collection("bits").document(bit_id).get()

    if not bit.exists:
        return {"error": "Bit not found"}, 404

    await client.collection("settings").document(user_id).collection("bits").document(
        bit_id
    ).set({"url": bit.get("url"), "volume": volume})

    return {"message": "Bit added to settings"}, 200


async def delete_bit_from_settings():
    user_id = g.user_id

    bit_id = request.json.get("bit_id")

    if not bit_id:
        return {"error": "Bit ID is required"}, 400

    client = firestore.AsyncClient()

    await client.collection("settings").document(user_id).collection("bits").document(
        bit_id
    ).delete()

    return {"message": "Bit deleted from settings"}, 200
