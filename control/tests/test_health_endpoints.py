import pytest
from _pytest.monkeypatch import MonkeyPatch
from flask.testing import FlaskClient

from control import app

# Mock the auth service response for authenticated endpoints


def create_mock_response(json_data, status_code):

    async def mock_post(*args, **kwargs):
        class MockResponse:
            def __init__(self, json_data, status_code):
                self.json_data = json_data
                self.status_code = status_code

            def json(self):
                return self.json_data

        return MockResponse(json_data, status_code)

    return mock_post


@pytest.fixture()
def client():
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client


def test_root_endpoint(client: FlaskClient):
    """Test the root endpoint (/)."""
    response = client.get("/")
    assert response.status_code == 200
    data = response.get_json()
    assert data == {"status": "ok"}


def test_healthz_endpoint(client: FlaskClient):
    """Test the /healthz endpoint."""
    response = client.get("/healthz")
    assert response.status_code == 200
    data = response.get_json()
    assert data == {"status": "ok"}


def test_cors_headers(client: FlaskClient):
    """Test that CORS headers are properly set."""
    # Test OPTIONS request
    response = client.options("/")
    assert response.status_code == 204
    assert response.headers.get("Access-Control-Allow-Origin") == "*"
    assert response.headers.get("Access-Control-Allow-Methods") == "*"
    assert response.headers.get("Access-Control-Allow-Headers") == "*"

    # Test GET request
    response = client.get("/")
    assert response.headers.get("Access-Control-Allow-Origin") == "*"
