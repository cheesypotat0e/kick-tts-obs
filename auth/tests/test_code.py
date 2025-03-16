import pytest
from flask.testing import FlaskClient
from main import app


@pytest.fixture()
def client():
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client


@pytest.mark.usefixtures("client")
class TestCode:
    def setup_method(self):
        # setup kick auth

        # we have to mock kick oauth api
        pass

    def test_code(self, client: FlaskClient):
        response = client.get("/code")
        assert response.status_code == 200

        data = response.json
        assert data["code"] is not None
