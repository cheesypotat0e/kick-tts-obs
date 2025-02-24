import logging
import sys
import time
from functools import wraps

from flask import g, request

logger = logging.getLogger("CheesyBot")
handler = logging.StreamHandler(sys.stdout)
handler.setFormatter(
    logging.Formatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s")
)

logger.addHandler(handler)

logger.setLevel(logging.INFO)


def log_request(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        start_time = time.time()

        g.start_time = start_time

        logger.info(f"Request started: {request.method} {request.path}")

        if logger.level <= logging.DEBUG:
            logger.info(f"Request headers: {dict(request.headers)}")
            if request.get_data():
                logger.info(f"Request body: {request.get_data()}")

        return f(*args, **kwargs)

    return decorated_function


def log_response(response):
    duration = time.time() - g.start_time

    logger.info(f"Response status: {response.status}")
    logger.info(f"Response headers: {dict(response.headers)}")
    logger.info(f"Request completed in {duration:.2f}s")

    return response
