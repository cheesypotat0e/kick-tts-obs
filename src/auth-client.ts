export class AuthClient {
  constructor(private readonly authApiUrl: string) {}

  async getHealthz(): Promise<boolean> {
    const response = await fetch(`${this.authApiUrl}/healthz`);
    return response.ok;
  }

  async getCode(kickAuthToken: string): Promise<string | null> {
    const response = await fetch(`${this.authApiUrl}/code`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${kickAuthToken}`,
      },
    });

    if (!response.ok) {
      return null;
    }

    const { code } = await response.json();

    return code;
  }

  async validateCode(code: string): Promise<boolean> {
    const response = await fetch(`${this.authApiUrl}/validate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${code}`,
      },
    });

    return response.ok;
  }

  async getAuthCode(code: string): Promise<string | null> {
    const response = await fetch(`${this.authApiUrl}/auth`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${code}`,
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    return data.token;
  }
}
