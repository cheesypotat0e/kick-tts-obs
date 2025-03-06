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


def test_settings_endpoint(client: FlaskClient, monkeypatch: MonkeyPatch):
    """Test the /settings endpoint."""

    settings = {"roomId": "1234"}

    mock_post = create_mock_response({"user_id": "user_id"}, 200)

    monkeypatch.setattr("httpx.AsyncClient.post", mock_post)

    response = client.post(
        "/settings", json=settings, headers={"Authorization": "Bearer fake_token"}
    )
    assert response.status_code == 200

    response = client.get("/settings", headers={"Authorization": "Bearer fake_token"})
    assert response.status_code == 200

    data = response.get_json()
    assert "roomId" in data
    assert data["roomId"] == "1234"

    response = client.delete(
        "/settings",
        json={"field": "roomId"},
        headers={"Authorization": "Bearer fake_token"},
    )
    assert response.status_code == 200

    response = client.get("/settings", headers={"Authorization": "Bearer fake_token"})
    data = response.get_json()
    assert "roomId" not in data


def test_settings_endpoint_with_voices(client: FlaskClient, monkeypatch: MonkeyPatch):
    """Test the /settings endpoint with voices."""

    settings = {"roomId": "1234"}

    mock_post = create_mock_response({"user_id": "user_id"}, 200)

    monkeypatch.setattr("httpx.AsyncClient.post", mock_post)

    response = client.post(
        "/voices",
        json={"voice_name": "voice1", "key": "voice1", "platform": "test_platform"},
        headers={"Authorization": "Bearer fake_token"},
    )

    assert response.status_code == 201

    response = client.post(
        "/voices",
        json={"voice_name": "voice2", "key": "voice2", "platform": "test_platform"},
        headers={"Authorization": "Bearer fake_token"},
    )

    assert response.status_code == 201

    response = client.post(
        "/settings",
        json=settings,
        headers={"Authorization": "Bearer fake_token"},
    )

    assert response.status_code == 200

    response = client.get("/settings", headers={"Authorization": "Bearer fake_token"})

    assert response.status_code == 200

    response = client.post(
        "/settings/voices",
        json={"voice_id": "voice1"},
        headers={"Authorization": "Bearer fake_token"},
    )

    assert response.status_code == 200

    response = client.post(
        "/settings/voices",
        json={"voice_id": "voice2"},
        headers={"Authorization": "Bearer fake_token"},
    )

    assert response.status_code == 200

    response = client.get("/settings", headers={"Authorization": "Bearer fake_token"})

    data = response.get_json()

    assert "voices" in data

    assert data["voices"] == [
        {"voice_name": "voice1", "key": "voice1", "platform": "test_platform"},
        {"voice_name": "voice2", "key": "voice2", "platform": "test_platform"},
    ]

    response = client.delete(
        "/voices/voice1",
        headers={"Authorization": "Bearer fake_token"},
    )

    assert response.status_code == 200

    response = client.delete(
        "/voices/voice2",
        headers={"Authorization": "Bearer fake_token"},
    )

    assert response.status_code == 200

    response = client.delete(
        "/settings/voices",
        headers={"Authorization": "Bearer fake_token"},
        json={"voice_id": "voice1"},
    )

    assert response.status_code == 200

    response = client.delete(
        "/settings/voices",
        headers={"Authorization": "Bearer fake_token"},
        json={"voice_id": "voice2"},
    )

    assert response.status_code == 200

    response = client.get("/settings", headers={"Authorization": "Bearer fake_token"})

    data = response.get_json()

    assert "voices" in data

    assert response.status_code == 200


def test_settings_endpoint_with_bits(client: FlaskClient, monkeypatch: MonkeyPatch):
    """Test the /settings endpoint with bits."""

    settings = {"roomId": "1234"}

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

    response = client.post(
        "/settings",
        json=settings,
        headers={"Authorization": "Bearer fake_token"},
    )

    assert response.status_code == 200

    response = client.get("/settings", headers={"Authorization": "Bearer fake_token"})

    assert response.status_code == 200

    response = client.post(
        "/settings/bits",
        json={"bit_id": bit_id, "volume": 0.5},
        headers={"Authorization": "Bearer fake_token"},
    )

    assert response.status_code == 200

    response = client.get("/settings", headers={"Authorization": "Bearer fake_token"})

    data = response.get_json()

    assert "bits" in data

    assert data["bits"] == [
        {
            "url": "https://www.myinstants.com/en/instant/vine-boom-sound-70972/",
            "volume": 0.5,
        },
    ]

    response = client.delete(
        "/settings/bits",
        headers={"Authorization": "Bearer fake_token"},
        json={"bit_id": bit_id},
    )

    assert response.status_code == 200

    response = client.get("/settings", headers={"Authorization": "Bearer fake_token"})

    data = response.get_json()

    assert "bits" in data

    assert data["bits"] == []

    response = client.delete(
        f"/bits/{bit_id}",
        headers={"Authorization": "Bearer fake_token"},
    )

    assert response.status_code == 200
