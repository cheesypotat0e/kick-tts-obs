import pytest
from _pytest.monkeypatch import MonkeyPatch
from flask.testing import FlaskClient

from control import app


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


def test_voices_endpoint(client: FlaskClient, monkeypatch: MonkeyPatch):
    """Test the /voices endpoint."""

    response = client.get("/voices")
    assert response.status_code == 200

    mock_post = create_mock_response({"user_id": "user_id"}, 200)

    monkeypatch.setattr("httpx.AsyncClient.post", mock_post)

    response = client.post(
        "/voices",
        json={
            "voice_name": "test_voice1",
            "key": "test_voice1",
            "platform": "test_platform",
        },
        headers={"Authorization": "Bearer fake_token"},
    )
    assert response.status_code == 201

    response = client.post(
        "/voices",
        json={
            "voice_name": "test_voice2",
            "key": "test_voice2",
            "platform": "test_platform",
        },
        headers={"Authorization": "Bearer fake_token"},
    )
    assert response.status_code == 201

    response = client.get(
        "/voices/test_voice1", headers={"Authorization": "Bearer fake_token"}
    )
    assert response.status_code == 200

    data = response.get_json()
    assert data["voice_name"] == "test_voice1"
    assert data["key"] == "test_voice1"
    assert data["platform"] == "test_platform"

    response = client.delete(
        "/voices/test_voice1", headers={"Authorization": "Bearer fake_token"}
    )
    assert response.status_code == 200

    response = client.get(
        "/voices/test_voice1", headers={"Authorization": "Bearer fake_token"}
    )
    assert response.status_code == 404

    response = client.get(
        "/voices/test_voice2", headers={"Authorization": "Bearer fake_token"}
    )
    assert response.status_code == 200

    data = response.get_json()
    assert data["voice_name"] == "test_voice2"
    assert data["key"] == "test_voice2"
    assert data["platform"] == "test_platform"

    response = client.delete(
        "/voices/test_voice2", headers={"Authorization": "Bearer fake_token"}
    )
    assert response.status_code == 200

    response = client.get(
        "/voices/test_voice2", headers={"Authorization": "Bearer fake_token"}
    )
    assert response.status_code == 404
