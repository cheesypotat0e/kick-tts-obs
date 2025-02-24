from flask import request


async def status_check():
    return {"status": "ok"}
