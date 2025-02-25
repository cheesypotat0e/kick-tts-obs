from flask import g, request
from google.cloud import firestore


async def get_ratelimits():
    user_id = g.user_id

    client = firestore.AsyncClient()

    ratelimits = (
        await client.collection("settings")
        .document(user_id)
        .collection("rateLimits")
        .get()
    )

    return [ratelimit.to_dict() for ratelimit in ratelimits]


async def add_ratelimit():
    user_id = g.user_id

    client = firestore.AsyncClient()

    target_user_id = request.json.get("user_id")
    if not target_user_id:
        return {"error": "Target user ID is required"}, 400

    period = request.json.get("period")
    if not period or not isinstance(period, int):
        return {"error": "Period is required"}, 400

    limit = request.json.get("limit")
    if not limit or not isinstance(limit, int):
        return {"error": "Limit is required"}, 400

    ref = (
        await client.collection("settings")
        .document(user_id)
        .collection("rateLimits")
        .document(target_user_id)
    )

    await ref.set(request.json)

    return {"message": "Ratelimit added"}, 201


async def delete_ratelimit():
    user_id = g.user_id

    client = firestore.AsyncClient()

    target_user_id = request.json.get("user_id")
    if not target_user_id:
        return {"error": "Target user ID is required"}, 400

    await client.collection("settings").document(user_id).collection(
        "rateLimits"
    ).document(target_user_id).delete()

    return {"message": "Ratelimit deleted"}, 200


async def update_ratelimit():
    user_id = g.user_id

    client = firestore.AsyncClient()

    target_user_id = request.json.get("user_id")
    if not target_user_id:
        return {"error": "Target user ID is required"}, 400

    period = request.json.get("period")
    if not period or not isinstance(period, int):
        return {"error": "Period is required"}, 400

    limit = request.json.get("limit")
    if not limit or not isinstance(limit, int):
        return {"error": "Limit is required"}, 400

    await client.collection("settings").document(user_id).collection(
        "rateLimits"
    ).document(target_user_id).update(request.json)

    return {"message": "Ratelimit updated"}, 200
