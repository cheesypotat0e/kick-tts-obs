from flask import request
from google.cloud import firestore

super_admin = "super_admin"
admin = "admin"


async def add_admins():
    user_id = request.user_id

    client = firestore.AsyncClient()

    admins = request.json.get("admins")

    if not admins:
        return {"error": "Admins are required"}, 400

    for admin in admins:
        username = admin.get("username", "")
        user_id = admin.get("user_id", "")
        admin_type = admin.get("admin_type", admin)

        if (
            not username
            or not user_id
            or not isinstance(username, str)
            or not isinstance(user_id, str)
            or not isinstance(admin_type, str)
        ):
            return {"error": "Username and user_id must be strings"}, 400

        await client.collection("settings").document(user_id).collection(
            "admins"
        ).document(username).set({"username": username, "user_id": user_id})

    return {"message": "Admins added"}, 200


async def delete_admins():
    user_id = request.user_id

    client = firestore.AsyncClient()

    admins = request.json.get("admins")

    if not admins:
        return {"error": "Admins are required"}, 400

    for admin in admins:
        if not isinstance(admin, str):
            return {"error": "Admin must be a string"}, 400

    for admin in admins:
        await client.collection("settings").document(user_id).collection(
            "admins"
        ).document(admin).delete()

    return {"message": "Admins deleted"}, 200


async def update_admin():
    user_id = request.user_id

    client = firestore.AsyncClient()

    admins = request.json.get("admins")
    if not admins:
        return {"error": "Admins are required"}, 400

    user_id_value = admins.get("user_id")
    admin_type = admins.get("admin_type")

    for admin in admins:

        if not user_id_value or not isinstance(user_id_value, str):
            return {"error": "User ID is required and must be a string"}, 400

        if not admin_type or not isinstance(admin_type, str):
            return {"error": "Admin type is required and must be a string"}, 400

    for admin in admins:
        admin_ref = (
            client.collection("settings")
            .document(user_id)
            .collection("admins")
            .document(user_id_value)
            .update({"admin_type": admin_type})
        )

    return {"message": "Admins updated"}, 200
