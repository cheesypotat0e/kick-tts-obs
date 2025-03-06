import json
from typing import Any, Dict

import jwt
import requests


class WSClient:
    def __init__(self, ws_service_url: str, jwt_private_key: str):

        if not ws_service_url:
            raise ValueError("ws_service_url cannot be empty")

        if not jwt_private_key:
            raise ValueError("jwt_private_key cannot be empty")

        self.ws_service_url = ws_service_url
        self.jwt_private_key = jwt_private_key

        self.broadcast_url = f"{self.ws_service_url.rstrip('/')}/broadcast"

    def _generate_jwt_token(self) -> str:
        return jwt.encode({}, self.jwt_private_key, algorithm="HS256")

    def send_message(
        self, room_id: str, message_type: str, payload: Any
    ) -> Dict[str, Any]:

        message = {"type": message_type, "payload": payload}

        data = {"room_id": room_id, "message": json.dumps(message)}

        headers = {
            "Authorization": f"Bearer {self._generate_jwt_token()}",
            "Content-Type": "application/json",
        }

        response = requests.post(self.broadcast_url, json=data, headers=headers)

        response.raise_for_status()

        return response.json()
