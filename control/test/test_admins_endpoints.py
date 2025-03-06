import pytest
import pytest_asyncio
from _pytest.monkeypatch import MonkeyPatch
from flask.testing import FlaskClient
from google.cloud import firestore
from main import app


@pytest_asyncio.fixture(scope="session", autouse=True)
async def setup_admins_test():
    """Setup the test environment for admins tests."""
    # Initialize Firestore client
    client = firestore.AsyncClient()
    db_doc = client.collection("settings").document("test_user_id")

    try:
        # Set up test data
        await db_doc.set({"user_id": "test_user_id"})
        await db_doc.collection("admins").document("admin_user_id").set(
            {
                "username": "test_admin",
                "user_id": "admin_user_id",
                "admin_type": "admin",
            }
        )

        yield

    finally:
        # Cleanup
        try:
            doc_ref = client.collection("settings").document("test_user_id")

            admins_collection_ref = doc_ref.collection("admins")

            async for doc in admins_collection_ref.list_documents():

                await doc.delete()

            await doc_ref.delete()

        except Exception as e:
            print(f"Error during cleanup: {e}")
        finally:
            # don't await
            client.close()


@pytest_asyncio.fixture(loop_scope="function", autouse=True)
async def setup_auth(monkeypatch: MonkeyPatch):
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


def test_get_admins(client: FlaskClient):
    """Test the /settings/admins endpoint."""
    response = client.get("/settings/admins")
    assert response.status_code == 200
    data = response.get_json()
    assert isinstance(data, list)


def test_add_admin(client: FlaskClient):
    """Test adding a new admin."""
    admin_data = {
        "admins": {
            "username": "test_admin",
            "user_id": "admin_user_id",
            "admin_type": "admin",
        }
    }

    response = client.post("/settings/admins", json=admin_data)
    if response.status_code != 200:
        print(response.get_json())
    assert response.status_code == 200

    response = client.get("/settings/admins")

    assert response.status_code == 200

    data = response.get_json()

    assert len(data) == 1
    assert data[0]["username"] == "test_admin"
    assert data[0]["user_id"] == "admin_user_id"
    assert data[0]["admin_type"] == "admin"


def test_add_multiple_admins(client: FlaskClient):
    """Test adding multiple admins at once."""
    admin_data = {
        "admins": [
            {"username": "admin1", "user_id": "admin1_id", "admin_type": "admin"},
            {"username": "admin2", "user_id": "admin2_id", "admin_type": "super_admin"},
        ]
    }

    response = client.post("/settings/admins", json=admin_data)
    assert response.status_code == 200
    data = response.get_json()
    assert data["message"] == "Admins added"

    response = client.get("/settings/admins")
    assert response.status_code == 200
    data = response.get_json()
    assert len(data) == 3
    admin_ids = [admin["user_id"] for admin in data]
    assert "admin1_id" in admin_ids
    assert "admin2_id" in admin_ids


def test_update_admin(client: FlaskClient):
    """Test updating an admin's type."""
    update_data = {"admins": {"user_id": "admin1_id", "admin_type": "super_admin"}}

    response = client.put("/settings/admins", json=update_data)
    assert response.status_code == 200

    response = client.get("/settings/admins")
    assert response.status_code == 200
    data = response.get_json()

    admin = next(admin for admin in data if admin["user_id"] == "admin1_id")

    assert admin["admin_type"] == "super_admin"


def test_delete_admin(client: FlaskClient):
    """Test deleting an admin."""
    delete_data = {"admins": {"user_id": "admin1_id"}}

    response = client.delete("/settings/admins", json=delete_data)
    assert response.status_code == 200

    # Verify admin was deleted
    response = client.get("/settings/admins")
    assert response.status_code == 200
    data = response.get_json()
    admin_ids = [admin["user_id"] for admin in data]
    assert "admin1_id" not in admin_ids


def test_delete_multiple_admins(client: FlaskClient):
    """Test deleting multiple admins at once."""
    delete_data = {"admins": [{"user_id": "admin2_id"}, {"user_id": "admin_user_id"}]}

    response = client.delete("/settings/admins", json=delete_data)
    assert response.status_code == 200

    response = client.get("/settings/admins")
    assert response.status_code == 200
    data = response.get_json()
    assert len(data) == 0


def test_invalid_admin_data(client: FlaskClient):
    """Test adding admin with invalid data."""
    invalid_data = {"admins": {"username": "test_admin"}}

    response = client.post("/settings/admins", json=invalid_data)
    assert response.status_code == 400
    data = response.get_json()

    assert "error" in data


def test_invalid_admin_type(client: FlaskClient):
    """Test updating admin with invalid admin type."""
    invalid_data = {"admins": {"user_id": "admin1_id", "admin_type": "invalid_type"}}

    response = client.put("/settings/admins", json=invalid_data)
    assert response.status_code == 400
    data = response.get_json()
    assert "error" in data
