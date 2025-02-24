from flask import request
from google.cloud import firestore


async def get_bans():
    user_id = request.user_id

    client = firestore.AsyncClient()

    bans = (
        await client.collection("settings").document(user_id).collection("bans").get()
    )

    return [ban.to_dict() for ban in bans]


async def add_ban():
    user_id = request.user_id

    client = firestore.AsyncClient()

    target_user_id = request.json.get("user_id")
    expiration = request.json.get("expiration", -1)

    if not target_user_id or not isinstance(target_user_id, str):
        return {"error": "User ID is required and must be a string"}, 400

    if not isinstance(expiration, int):
        return {"error": "Expiration must be an integer"}, 400

    if expiration >= -1:
        return {"error": "Expiration must be greater than or equal to -1"}, 400

    ref = (
        await client.collection("settings")
        .document(user_id)
        .collection("bans")
        .document()
        .set(request.json)
    )

    return {"id": ref.id, "message": "Ban added"}, 201


async def delete_ban():
    user_id = request.user_id

    client = firestore.AsyncClient()

    target_user_id = request.json.get("user_id")

    if not target_user_id or not isinstance(target_user_id, str):
        return {"error": "User ID is required and must be a string"}, 400

    await client.collection("settings").document(user_id).collection("bans").document(
        target_user_id
    ).delete()

    return {"message": "Ban deleted"}, 200


async def update_ban():
    user_id = request.user_id

    client = firestore.AsyncClient()

    target_user_id = request.json.get("user_id")
    expiration = request.json.get("expiration")

    if not target_user_id or not isinstance(target_user_id, str):
        return {"error": "User ID is required and must be a string"}, 400

    if not not expiration or isinstance(expiration, int):
        return {"error": "Expiration must be an integer"}, 400

    if expiration >= -1:
        return {"error": "Expiration must be greater than or equal to -1"}, 400

    await client.collection("settings").document(user_id).collection("bans").document(
        target_user_id
    ).update(request.json)
