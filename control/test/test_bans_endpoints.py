import pytest
from _pytest.monkeypatch import MonkeyPatch
from flask.testing import FlaskClient
from google.cloud import firestore
from main import app


@pytest.fixture(scope="module", autouse=True)
async def setup_bans_test():
    """Setup the test environment for bans tests."""
    # Initialize Firestore client
    client = firestore.AsyncClient()

    await client.collection("settings").document("test_user_id").set(
        {
            "user_id": "test_user_id",
        }
    )

    yield

    await client.collection("settings").document("test_user_id").delete()
    client.close()


@pytest.fixture(scope="function", autouse=True)
def setup_auth(monkeypatch: MonkeyPatch):
    """Setup auth mocking for each test."""
    mock_auth = create_mock_auth_response({"user_id": "test_user_id"}, 200)
    monkeypatch.setattr("httpx.AsyncClient.post", mock_auth)


def create_mock_auth_response(json_data, status_code):
    """Create a mock response for the auth server."""

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
    """Client fixture with mocked auth."""
    app.config["TESTING"] = True
    with app.test_client() as client:
        client.environ_base["HTTP_AUTHORIZATION"] = "Bearer fake_token"
        yield client


def test_get_bans(client: FlaskClient):
    """Test the /settings/bans endpoint."""
    # Mock the auth server response

    response = client.get("/settings/bans")

    assert response.status_code == 200

    data = response.get_json()

    assert isinstance(data, list)


def test_add_ban(client: FlaskClient):
    """Test adding a new ban."""

    response = client.post("/settings/bans", json={"user_id": "banned_user_id"})

    assert response.status_code == 201

    data = response.get_json()


def test_get_ban(client: FlaskClient):
    """Test getting a ban."""

    response = client.get("/settings/bans/banned_user_id")

    assert response.status_code == 200

    data = response.get_json()

    assert "expiration" in data
    assert isinstance(data["expiration"], int)


def test_update_ban(client: FlaskClient):
    """Test updating a ban."""

    update_data = {"user_id": "banned_user_id", "expiration": 1000}

    response = client.put("/settings/bans", json=update_data)

    assert response.status_code == 200

    response = client.get("/settings/bans/banned_user_id")

    assert response.status_code == 200

    data = response.get_json()

    assert data["expiration"] == 1000


def test_delete_ban(client: FlaskClient):
    """Test deleting a ban."""

    response = client.delete("/settings/bans", json={"user_id": "banned_user_id"})

    assert response.status_code == 200
