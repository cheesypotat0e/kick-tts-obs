import os

from dotenv import load_dotenv
from jose import jwt

load_dotenv()

PRIVATE_KEY = os.getenv("JWT_PRIVATE_KEY")


def create_token(_: dict):
    encoded_jwt = jwt.encode(
        {"sub": "test", "admin": True}, PRIVATE_KEY, algorithm="RS256"
    )
    return encoded_jwt


if __name__ == "__main__":
    print(create_token({}))
