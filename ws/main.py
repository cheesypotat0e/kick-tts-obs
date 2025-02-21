import logging
import os
from typing import Dict, Optional, Set

import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
from fastapi.security import HTTPBearer
from jose import JWTError, jwt

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()
security = HTTPBearer()

# Get JWT public key from environment
PUBLIC_KEY = os.getenv("JWT_PUBLIC_KEY")
if not PUBLIC_KEY:
    raise ValueError("JWT_PUBLIC_KEY environment variable is required")


class ConnectionManager:
    def __init__(self):
        # room_id -> Set[WebSocket]
        self.active_rooms: Dict[str, Set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, room_id: str):

        await websocket.accept()
        if room_id not in self.active_rooms:
            self.active_rooms[room_id] = set()
        self.active_rooms[room_id].add(websocket)
        logger.info(f"Client connected to room {room_id}")

    def disconnect(self, websocket: WebSocket, room_id: str):
        if room_id in self.active_rooms:
            self.active_rooms[room_id].discard(websocket)
            if not self.active_rooms[room_id]:
                del self.active_rooms[room_id]
        logger.info(f"Client disconnected from room {room_id}")

    async def broadcast_to_room(
        self, message: str, room_id: str, exclude_websocket: Optional[WebSocket] = None
    ):
        if room_id in self.active_rooms:
            for connection in self.active_rooms[room_id]:
                if connection != exclude_websocket:
                    try:
                        await connection.send_text(message)
                    except Exception as e:
                        logger.error(f"Error broadcasting to client: {e}")


manager = ConnectionManager()


def verify_token(token: str) -> bool:
    try:
        # Verify the JWT token using the public key
        jwt.decode(token, PUBLIC_KEY, algorithms=["RS256"])
        return True
    except JWTError as e:
        logger.error(f"JWT verification failed: {e}")
        return False


@app.post("/broadcast")
async def broadcast_message(request: Request):
    try:
        # Get the Authorization header
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            raise HTTPException(
                status_code=401, detail="Missing or invalid authorization header"
            )

        # Extract and verify the token
        token = auth_header.split(" ")[1]
        if not verify_token(token):
            raise HTTPException(status_code=401, detail="Invalid token")

        # Get and validate the request body
        body = await request.json()
        room_id = body.get("room_id")
        message = body.get("message")

        if not room_id or not message:
            raise HTTPException(
                status_code=400, detail="room_id and message are required"
            )

        # Check if room exists
        if room_id not in manager.active_rooms:
            raise HTTPException(status_code=404, detail="Room not found")

        # Broadcast the message
        await manager.broadcast_to_room(message=message, room_id=room_id)

        return JSONResponse(
            status_code=200,
            content={
                "status": "success",
                "message": "Message broadcasted successfully",
            },
        )

    except Exception as e:
        logger.error(f"Error in broadcast endpoint: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.websocket("/ws/{room_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: str):
    await manager.connect(websocket, room_id)
    try:
        while True:
            # Just keep the connection alive without processing messages
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, room_id)


if __name__ == "__main__":

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
