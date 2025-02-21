# WebSocket PubSub Server

A WebSocket-based publish-subscribe server with JWT authentication and room-based messaging.

## Features

- WebSocket-based real-time communication
- Room-based publish/subscribe functionality
- JWT authentication for message publishing
- Public key verification for JWT tokens

## Setup

1. Install dependencies:

```bash
pip install -r requirements.txt
```

2. Set up environment variables:
   Create a `.env` file with:

```
JWT_PUBLIC_KEY="your-public-key-here"
```

The public key should be in PEM format and correspond to the private key used to sign JWT tokens.

## Running the Server

```bash
python ws/main.py
```

The server will start on `http://localhost:8000`.

## Usage

### Connecting to a Room

Connect to a room using the WebSocket endpoint:

```
ws://localhost:8000/ws/{room_id}
```

### Publishing Messages

To publish a message, send a JWT-signed payload to the WebSocket connection. The JWT should be signed with the corresponding private key to the public key configured in the environment.

The JWT payload should include a "message" field:

```json
{
  "message": "Your message here"
}
```

### Receiving Messages

Once connected to a room, you will automatically receive all messages published to that room.

## Error Handling

- If a JWT is invalid, you will receive an "Unauthorized: Invalid token" message
- Connection errors and other issues will be logged server-side
