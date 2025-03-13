import sys

import pytest
from _pytest.monkeypatch import MonkeyPatch
from flask.testing import FlaskClient
from google.cloud import firestore

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


@pytest.fixture(scope="module", autouse=True)
def cleanup_after_test():
    """Fixture to clean up after each test."""

    yield

    firestore_client = firestore.Client()

    firestore_client.collection("settings").document("user_id").delete()


def test_settings_endpoint(client: FlaskClient, monkeypatch: MonkeyPatch):
    """Test the /settings endpoint."""
    settings = {
        "roomId": "1234",
        "ttsVolume": 0.5,
        "ttsSpeed": 1.2,
        "ttsVoice": "TestVoice",
        "bitsVolume": 0.8,
        "bitsRate": 0.9,
        "timeout": 1500,
        "clusterID": "test_cluster_id",
        "version": "9.0.0",
        "videoVolume": 0.7,
        "subOnly": True,
        "authFeatureFlag": True,
        "authServiceUrl": "http://test.auth",
        "oauthServiceUrl": "http://test.oauth",
        "ttsServiceUrl": "http://test.tts",
        "wsServiceUrl": "http://test.ws",
        "kickApiUrl": "http://test.kick",
        "userId": "test_user",
        "name": "TestUser",
    }

    mock_post = create_mock_response({"user_id": "user_id"}, 200)

    monkeypatch.setattr("httpx.AsyncClient.post", mock_post)

    response = client.post(
        "/settings", json=settings, headers={"Authorization": "Bearer fake_token"}
    )
    assert response.status_code == 200

    response = client.get("/settings", headers={"Authorization": "Bearer fake_token"})
    assert response.status_code == 200

    data = response.get_json()

    assert data["roomId"] == settings["roomId"]
    assert data["ttsVolume"] == settings["ttsVolume"]
    assert data["ttsSpeed"] == settings["ttsSpeed"]
    assert data["ttsVoice"] == settings["ttsVoice"]
    assert data["bitsVolume"] == settings["bitsVolume"]
    assert data["bitsRate"] == settings["bitsRate"]
    assert data["timeout"] == settings["timeout"]
    assert data["clusterID"] == settings["clusterID"]
    assert data["version"] == settings["version"]
    assert data["videoVolume"] == settings["videoVolume"]
    assert data["subOnly"] == settings["subOnly"]
    assert data["authFeatureFlag"] == settings["authFeatureFlag"]
    assert data["authServiceUrl"] == settings["authServiceUrl"]
    assert data["oauthServiceUrl"] == settings["oauthServiceUrl"]
    assert data["ttsServiceUrl"] == settings["ttsServiceUrl"]
    assert data["wsServiceUrl"] == settings["wsServiceUrl"]
    assert data["kickApiUrl"] == settings["kickApiUrl"]
    assert data["userId"] == settings["userId"]
    assert data["name"] == settings["name"]

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

    # Test bans endpoint
    response = client.post(
        "/settings/bans",
        json={"user_id": "test_user", "expiration": 60},
        headers={"Authorization": "Bearer fake_token"},
    )
    assert response.status_code == 201

    response = client.get(
        "/settings/bans", headers={"Authorization": "Bearer fake_token"}
    )
    assert response.status_code == 200
    bans_data = response.get_json()

    user_id = bans_data[0]["user_id"]

    assert user_id == "test_user"

    response = client.delete(
        "/settings/bans",
        json={"user_id": "test_user"},
        headers={"Authorization": "Bearer fake_token"},
    )
    assert response.status_code == 200

    response = client.get(
        "/settings/bans", headers={"Authorization": "Bearer fake_token"}
    )
    assert response.status_code == 200
    bans_data = response.get_json()

    assert len(bans_data) == 0

    # Test rate limits endpoint
    response = client.post(
        "/settings/ratelimits",
        json={"target": "test_target", "period": 30, "requests": 5},
        headers={"Authorization": "Bearer fake_token"},
    )
    assert response.status_code == 200

    response = client.get(
        "/settings/ratelimits", headers={"Authorization": "Bearer fake_token"}
    )
    assert response.status_code == 200
    rate_limits_data = response.get_json()
    assert "test_target" in rate_limits_data

    response = client.delete(
        "/settings/ratelimits",
        json={"target": "test_target"},
        headers={"Authorization": "Bearer fake_token"},
    )
    assert response.status_code == 200

    response = client.get(
        "/settings/ratelimits", headers={"Authorization": "Bearer fake_token"}
    )
    assert response.status_code == 200
    rate_limits_data = response.get_json()
    assert "test_target" not in rate_limits_data


@pytest.mark.usefixtures("client")
class TestSettingsEndpoints:

    def setup_method(self):
        pass

    def teardown_method(self):
        pass
