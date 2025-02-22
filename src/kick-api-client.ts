import { SettingsStore } from "./settings";

type UsersResponse = {
  message: string;
  data: [
    {
      email: string;
      name: string;
      profile_picture: string;
      user_id: number;
    }
  ];
};

type RefreshTokenResponse = {
  access_token: string;
  token_type: string;
  expiry: number;
  scope: string;
};

export class KickApiClient {
  settings: SettingsStore;

  public constructor(settings: SettingsStore) {
    this.settings = settings;
  }

  private get accessToken() {
    return this.settings.get("authToken");
  }

  public async getUser(username: string): Promise<UsersResponse["data"][0]> {
    const data = await this.fetch<UsersResponse>(
      `/public/v1/users/${username}`
    );
    return data.data[0];
  }

  private async refreshAccessToken() {
    const oauthUrl = this.settings.get("oauthServiceUrl");

    if (!oauthUrl) {
      throw new Error("OAuth URL not set");
    }

    const response = await fetch(`${oauthUrl}/refresh`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.settings.get("code")}`,
        "Content-Type": "application/json",
      },
    });

    const data = (await response.json()) as RefreshTokenResponse;

    this.settings.set("authToken", data.access_token);
    this.settings.saveToLocalStorage();
  }

  public async sendMessage(message: string) {
    return this.fetch<any>("/public/v1/chat", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.settings.get("code")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content: message,
        type: "bot",
      }),
    });
  }

  private async fetch<T>(
    path: string,
    options: RequestInit = {},
    retryCount = 0
  ): Promise<T> {
    const url = `https://api.kick.com${
      path.startsWith("/") ? path : "/" + path
    }`;

    if (!this.accessToken) {
      await this.refreshAccessToken();
    }

    const response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      if (response.status === 401 && retryCount === 0) {
        await this.refreshAccessToken();
        return this.fetch(path, options, retryCount + 1);
      }

      throw new Error(`API request failed: ${response.statusText}`, {
        cause: response.statusText,
      });
    }

    return response.json();
  }
}
