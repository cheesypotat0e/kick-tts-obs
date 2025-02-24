from flask import request
from google.cloud import firestore


async def get_bits():

    client = firestore.AsyncClient()

    bits = await client.collection("bits").get()

    page_size = int(request.args.get("page_size", 10))
    cursor = request.args.get("cursor", None)

    query = client.collection("bits").limit(page_size + 1)
    if cursor:
        doc = await client.collection("bits").document(cursor).get()
        query = query.start_after(doc)

    bits = await query.get()

    bits_list = [bit.to_dict() for bit in bits]

    has_more = len(bits_list) > page_size
    if has_more:
        bits_list = bits_list[:-1]
        next_cursor = bits[-2].id
    else:
        next_cursor = None

    return {"bits": bits_list, "next_cursor": next_cursor}


async def get_bit(bit_id: str):
    client = firestore.AsyncClient()

    bit = await client.collection("bits").document(bit_id).get()

    if not bit.exists:
        return {"error": "Bit not found"}, 404

    return bit.to_dict()


async def add_bit():
    client = firestore.AsyncClient()

    url = request.json.get("url")
    vol = request.json.get("volume", 1.0)

    if not url or not isinstance(url, str):
        return {"error": "URL is required and must be a string"}, 400

    if not isinstance(vol, (int, float)):
        return {"error": "Volume must be a number"}, 400

    bit = {}

    bit["url"] = url
    bit["volume"] = vol

    res = await client.collection("bits").add(bit)

    return {"bit_id": res[1].id}, 201


async def update_bit(bit_id: str):
    client = firestore.AsyncClient()

    bit = request.json

    is_valid, error = verify_bit_input(bit)

    if not is_valid:
        return error

    await client.collection("bits").document(bit_id).update(bit)

    return {"message": "Bit updated"}, 200


async def delete_bit(key: str):
    client = firestore.AsyncClient()

    await client.collection("bits").document(key).delete()

    return {"message": "Bit deleted"}, 200


def verify_bit_input(key: str):
    if not key or not isinstance(key, str):
        return (False, ({"error": "Key is required and must be a string"}, 400))

    url = request.json.get("url")
    if not url or not isinstance(url, str):
        return (False, ({"error": "URL is required and must be a string"}, 400))

    volume = request.json.get("volume")
    if not isinstance(volume, (int, float)):
        return (False, ({"error": "Volume must be a number"}, 400))

    return (True, None)


def verify_optional_bit_input(key: dict):
    if not key or not isinstance(key, str):
        return (False, ({"error": "Key is required and must be a string"}, 400))

    url = request.json.get("url", "")
    if not isinstance(url, str):
        return (False, ({"error": "URL must be a string"}, 400))

    volume = request.json.get("volume", 1.0)
    if not isinstance(volume, (int, float)):
        return (False, ({"error": "Volume must be a number"}, 400))

    return (True, None)
