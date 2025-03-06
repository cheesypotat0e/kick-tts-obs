from flask import g, request
from google.cloud import firestore

super_admin = "super_admin"
admin = "admin"


async def add_admins():
    user_id = g.user_id

    client = firestore.AsyncClient()

    admins = request.json.get("admins")

    if not admins:
        return {"error": "Admins are required"}, 400

    if not isinstance(admins, (dict, list)):
        return {"error": "Admins must be a list or a single object"}, 400

    if isinstance(admins, dict):
        admins = [admins]

    for admin in admins:
        username = admin.get("username", "")
        target_user_id = admin.get("user_id", "")
        admin_type = admin.get("admin_type", admin)

        if (
            not username
            or not target_user_id
            or not isinstance(username, str)
            or not isinstance(target_user_id, str)
            or not isinstance(admin_type, str)
        ):
            return {"error": "Username and user_id must be strings"}, 400

        await client.collection("settings").document(user_id).collection(
            "admins"
        ).document(target_user_id).set(
            {"username": username, "user_id": target_user_id, "admin_type": admin_type}
        )

    return {"message": "Admins added"}, 200


async def delete_admins():
    user_id = g.user_id

    client = firestore.AsyncClient()

    admins = request.json.get("admins")

    if not admins:
        return {"error": "Admins are required"}, 400

    if not isinstance(admins, (dict, list)):
        return {"error": "Admins must be a list or a single object"}, 400

    if isinstance(admins, dict):
        admins = [admins]

    for admin in admins:

        target_user_id = admin.get("user_id")

        if not target_user_id or not isinstance(target_user_id, str):
            return {"error": "User ID is required and must be a string"}, 400

        admin_doc_ref = (
            client.collection("settings")
            .document(user_id)
            .collection("admins")
            .document(target_user_id)
        )

        admin_ref = await admin_doc_ref.get()

        if not admin_ref.exists:
            return {"error": "Admin not found"}, 404

        await admin_doc_ref.delete()

    return {"message": "Admins deleted"}, 200


async def update_admins():
    user_id = g.user_id

    client = firestore.AsyncClient()

    admins = request.json.get("admins")
    if not admins:
        return {"error": "Admins are required"}, 400

    if not isinstance(admins, (dict, list)):
        return {"error": "Admins must be a list or a single object"}, 400

    if isinstance(admins, dict):
        admins = [admins]

    for admin in admins:
        target_user_id = admin.get("user_id")
        admin_type = admin.get("admin_type")

        if not target_user_id or not isinstance(target_user_id, str):
            return {"error": "User ID is required and must be a string"}, 400

        if (
            not admin_type
            or not isinstance(admin_type, str)
            or admin_type
            not in [
                super_admin,
                admin,
            ]
        ):
            return {"error": "Admin type is required and must be a string"}, 400

        admin_doc_ref = (
            client.collection("settings")
            .document(user_id)
            .collection("admins")
            .document(target_user_id)
        )

        admin_ref = await admin_doc_ref.get()

        if not admin_ref.exists:
            return {"error": "Admin not found"}, 404

        await admin_doc_ref.update({"admin_type": admin_type})

    return {"message": "Admins updated"}, 200


async def get_admins():
    user_id = g.user_id

    client = firestore.AsyncClient()

    admins = (
        await client.collection("settings").document(user_id).collection("admins").get()
    )

    return [admin.to_dict() for admin in admins], 200
