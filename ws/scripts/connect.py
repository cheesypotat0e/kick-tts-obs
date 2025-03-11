import asyncio
import json
import sys

import websockets
from gen_token import create_token


async def connect(uri, token=""):
    try:
        async with websockets.connect(
            uri,
            additional_headers={"Authorization": f"Bearer {token}"},
        ) as websocket:

            async def send_messages():
                while True:
                    message = await asyncio.get_event_loop().run_in_executor(
                        None, sys.stdin.readline
                    )
                    if not message:
                        break
                    await websocket.send(message.strip())
                    print(f">>> {message.strip()}")

            async def receive_messages():
                while True:
                    try:
                        response = await websocket.recv()
                        print(f"<<< {response}")
                    except websockets.exceptions.ConnectionClosed:
                        print("Connection closed by server")
                        break
                    except Exception as e:
                        print(f"Error receiving message: {e}")
                        break

            await asyncio.gather(send_messages(), receive_messages())
    except Exception as e:
        try:
            print(f"Error connecting to server: {e.response.body.decode()}")
        except AttributeError:
            print(f"Error connecting to server: {e}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python connect.py <websocket_uri>")
        sys.exit(1)

    uri = sys.argv[1]
    token = create_token({})

    asyncio.get_event_loop().run_until_complete(connect(uri, token))
