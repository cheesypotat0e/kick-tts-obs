import pytest
from _pytest.monkeypatch import MonkeyPatch
from flask.testing import FlaskClient
from main import app


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


def test_bits_endpoint(client: FlaskClient, monkeypatch: MonkeyPatch):
    """Test the /bits endpoint."""

    response = client.get("/bits")

    assert response.status_code == 200

    mock_post = create_mock_response({"user_id": "user_id"}, 200)

    monkeypatch.setattr("httpx.AsyncClient.post", mock_post)

    response = client.post(
        "/bits",
        json={
            "url": "https://www.myinstants.com/en/instant/vine-boom-sound-70972/",
            "name": "boom",
        },
        headers={"Authorization": "Bearer fake_token"},
    )

    assert response.status_code == 201

    bit_id = response.json.get("bit_id")

    response = client.get(
        f"/bits/{bit_id}", headers={"Authorization": "Bearer fake_token"}
    )

    assert response.status_code == 200

    data = response.json

    assert data["url"] == "https://www.myinstants.com/en/instant/vine-boom-sound-70972/"
    assert data["name"] == "boom"
    response = client.delete(
        f"/bits/{bit_id}", headers={"Authorization": "Bearer fake_token"}
    )

    assert response.status_code == 200

    response = client.get(
        f"/bits/{bit_id}", headers={"Authorization": "Bearer fake_token"}
    )

    assert response.status_code == 404
