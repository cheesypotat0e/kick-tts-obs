import requests


class KickAuth:
    def __init__(self, auth_api_url: str):
        self.auth_api_url = auth_api_url
        pass

    def introspect_token(self, token: str):
        res = requests.post(
            "https://api.kick.com/public/v1/token/introspect",
            headers={"Authorization": f"Bearer {token}"},
        )

        res.raise_for_status()

        return res.json()

    def validate_auth_code(self, token: str):
        res = requests.get(
            "https://api.kick.com/public/v1/oauth/token",
            headers={"Authorization": f"Bearer {token}"},
        )

        res.raise_for_status()

        return res.json()

    def get_auth_token(self, code: str):
        res = requests.post(
            f"{self.auth_api_url}/oauth/token",
            data={"grant_type": "authorization_code", "code": code},
        )

        res.raise_for_status()
        return res.json()
