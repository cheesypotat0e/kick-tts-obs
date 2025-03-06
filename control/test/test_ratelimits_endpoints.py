import pytest
import pytest_asyncio
from _pytest.monkeypatch import MonkeyPatch
from flask.testing import FlaskClient
from google.cloud import firestore
from main import app


@pytest_asyncio.fixture(scope="session", autouse=True)
async def setup_ratelimits_test():
    """Setup the test environment for ratelimits tests."""
    # Initialize Firestore client
    client = firestore.AsyncClient()
    db_doc = client.collection("settings").document("test_user_id")

    try:
        await db_doc.set({"user_id": "test_user_id"})

        yield

    finally:
        # Cleanup
        try:
            doc_ref = client.collection("settings").document("test_user_id")

            ratelimits_collection_ref = doc_ref.collection("ratelimits")

            async for doc in ratelimits_collection_ref.list_documents():
                await doc.delete()

            await doc_ref.delete()

        except Exception as e:
            print(f"Error during cleanup: {e}")
        finally:
            # don't await
            client.close()


@pytest_asyncio.fixture(loop_scope="function", autouse=True)
async def setup_auth(monkeypatch: MonkeyPatch):
    """Setup the authentication for the tests."""
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


def test_get_ratelimits(client: FlaskClient):
    """Test the get_ratelimits endpoint."""
    response = client.get("/settings/ratelimits")
    assert response.status_code == 200
    print(response.json)
    assert response.json == []


def test_add_ratelimit(client: FlaskClient):
    """Test the add_ratelimit endpoint."""

    response = client.post(
        "/settings/ratelimits",
        json={"user_id": "test_user_id", "period": 60, "limit": 100},
    )

    assert response.status_code == 201

    response = client.get("/settings/ratelimits")
    assert response.status_code == 200
    assert len(response.json) == 1
    assert response.json[0]["user_id"] == "test_user_id"
    assert response.json[0]["period"] == 60
    assert response.json[0]["limit"] == 100


def test_update_ratelimit(client: FlaskClient):
    """Test the update_ratelimit endpoint."""
    response = client.put(
        "/settings/ratelimits",
        json={"user_id": "test_user_id", "period": 60, "limit": 200},
    )
    assert response.status_code == 200

    response = client.get("/settings/ratelimits")
    assert response.status_code == 200
    assert len(response.json) == 1
    assert response.json[0]["user_id"] == "test_user_id"
    assert response.json[0]["period"] == 60
    assert response.json[0]["limit"] == 200


def test_delete_ratelimit(client: FlaskClient):
    """Test the delete_ratelimit endpoint."""
    response = client.delete("/settings/ratelimits", json={"user_id": "test_user_id"})
    assert response.status_code == 200

    response = client.get("/settings/ratelimits")
    assert response.status_code == 200
    assert response.json == []
