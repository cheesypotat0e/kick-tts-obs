import logging
import os
from typing import Dict, Optional, Set

import boto3
import uvicorn
import watchtower
from dotenv import load_dotenv
from fastapi import (
    Depends,
    FastAPI,
    HTTPException,
    Request,
    Security,
    WebSocket,
    WebSocketDisconnect,
)
from fastapi.responses import JSONResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

load_dotenv()

cloudwatch_handler = watchtower.CloudWatchLogHandler(
    boto3_client=boto3.client("logs", "us-west-2"),
    log_group="CheesyBotWSServer",
    use_queues=False,
)

console_handler = logging.StreamHandler()
console_handler.setFormatter(
    logging.Formatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s")
)

root_logger = logging.getLogger()
root_logger.setLevel(logging.INFO)

for handler in root_logger.handlers[:]:
    root_logger.removeHandler(handler)

root_logger.addHandler(cloudwatch_handler)
root_logger.addHandler(console_handler)

logger = logging.getLogger(__name__)

uvicorn_access_logger = logging.getLogger("uvicorn.access")
uvicorn_access_logger.propagate = False
for handler in uvicorn_access_logger.handlers[:]:
    uvicorn_access_logger.removeHandler(handler)
uvicorn_access_logger.addHandler(console_handler)

app = FastAPI()
security = HTTPBearer()


PUBLIC_KEY = os.getenv("JWT_PUBLIC_KEY")
if not PUBLIC_KEY:
    raise ValueError("JWT_PUBLIC_KEY environment variable is required")


class ConnectionManager:
    def __init__(self):
        self.active_rooms: Dict[str, Set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, room_id: str, sub: str):

        await websocket.accept()
        if room_id not in self.active_rooms:
            self.active_rooms[room_id] = set()
        self.active_rooms[room_id].add(websocket)
        logger.info(
            "Client connected to room room_id: %s, client_host: %s, sub: %s",
            room_id,
            websocket.client.host,
            sub,
        )

    def disconnect(self, websocket: WebSocket, room_id: str):
        if room_id in self.active_rooms:
            self.active_rooms[room_id].discard(websocket)
            if not self.active_rooms[room_id]:
                del self.active_rooms[room_id]
        logger.info(
            "Client disconnected from room room_id: %s, client_host: %s",
            room_id,
            websocket.client.host,
        )

    async def broadcast_to_room(
        self, message: str, room_id: str, exclude_websocket: Optional[WebSocket] = None
    ):
        if room_id in self.active_rooms:
            for connection in self.active_rooms[room_id]:
                if connection != exclude_websocket:
                    try:
                        await connection.send_text(message)
                    except Exception as e:
                        logger.error(
                            "Error broadcasting to client room_id: %s, client_host: %s",
                            room_id,
                            connection.client.host,
                            extra={"error": e},
                        )


manager = ConnectionManager()


def verify_token(token: str) -> dict:
    try:
        body = jwt.decode(token, PUBLIC_KEY, algorithms=["RS256"])

        sub = body.get("sub")
        if not sub:
            raise HTTPException(status_code=401, detail="Invalid token")

        admin = body.get("admin", False)

        return {"sub": sub, "admin": admin}

    except JWTError as e:
        logger.error(f"JWT verification failed: {e}")
        return False


def authorize(token: str):
    try:
        return verify_token(token)
    except JWTError as e:
        logger.error(f"JWT verification failed: {e}")
        raise HTTPException(status_code=401, detail="Invalid token")


def authorize_websocket(websocket: WebSocket):
    token = websocket.headers.get("Authorization")
    if not token:
        raise HTTPException(status_code=401, detail="No token provided")

    if not token.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid token format")

    token = token.split(" ")[1]

    body = verify_token(token)

    if not body:
        raise HTTPException(status_code=401, detail="Invalid token")

    return body


@app.get("/")
async def root():
    return {"status": "ok"}


@app.post("/broadcast")
async def broadcast_message(
    request: Request, credentials: HTTPAuthorizationCredentials = Depends(authorize)
):
    try:

        body = await request.json()

        room_id = body.get("room_id")
        message = body.get("message")

        if not room_id or not message:
            raise HTTPException(
                status_code=400, detail="room_id and message are required"
            )

        if room_id not in manager.active_rooms:
            raise HTTPException(status_code=404, detail="Room not found")

        await manager.broadcast_to_room(message=message, room_id=room_id)

        return JSONResponse(
            status_code=200,
            content={
                "status": "success",
                "message": "Message broadcasted successfully",
            },
        )

    except Exception as e:
        logger.error(
            "Error in broadcast endpoint",
            extra={"error": e},
        )
        raise HTTPException(status_code=500, detail="Internal server error")


@app.websocket("/ws/{room_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    room_id: str,
):
    token = websocket.query_params.get("token")

    if not token:
        await websocket.close(
            code=status.WS_1008_POLICY_VIOLATION,
            reason="Authentication token is required",
        )
        return

    credentials = authorize(token)
    await manager.connect(websocket, room_id, credentials.get("sub"))
    try:
        while True:
            text = await websocket.receive_text()
            logger.info(
                "Received message from client room_id: %s, client_host: %s, sub: %s, message: %s",
                room_id,
                websocket.client.host,
                credentials.get("sub"),
                text,
            )
    except WebSocketDisconnect:
        manager.disconnect(websocket, room_id)


@app.get("/admin/rooms")
async def get_rooms():
    return {"rooms": list(manager.active_rooms.keys())}


@app.get("/admin/rooms/{room_id}/connections")
async def get_room_connections(room_id: str):
    if room_id not in manager.active_rooms:
        raise HTTPException(status_code=404, detail="Room not found")

    return {
        "room_id": room_id,
        "connections": [conn.client.host for conn in manager.active_rooms[room_id]],
    }


if __name__ == "__main__":
    cert = os.getenv("CERT")
    key = os.getenv("KEY")
    if cert and key:
        uvicorn.run(
            "main:app",
            host="0.0.0.0",
            port=443,
            ssl_keyfile=key,
            ssl_certfile=cert,
            log_config=None,
        )

    else:
        uvicorn.run(
            "main:app",
            host="0.0.0.0",
            port=8000,
            reload=True,
            log_config=None,
        )
