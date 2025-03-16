import pytest
from flask.testing import FlaskClient
from main import app


@pytest.fixture()
def client():
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client


@pytest.mark.usefixtures("client")
class TestHealth:
    def test_health(self, client: FlaskClient):
        response = client.get("/healthz")
        assert response.status_code == 200
        assert response.json == {"status": "ok"}

    def test_root(self, client: FlaskClient):
        response = client.get("/")
        assert response.status_code == 200
        assert response.json == {"status": "ok"}
