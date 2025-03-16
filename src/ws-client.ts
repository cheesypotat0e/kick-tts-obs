export class WsClient {
  private ws: WebSocket | null = null;
  private url: string;
  // private code: string;
  private reconnectInterval: number;
  private token: string | null = null;
  private onMessageCallback: ((message: string) => void) | null = null;
  private onCloseCallback: (() => void) | null = null;
  private onErrorCallback: ((error: Error) => void) | null = null;
  private onOpenCallback: (() => void) | null = null;

  constructor(url: string, token: string, reconnectInterval: number = 3000) {
    this.url = url;
    this.reconnectInterval = reconnectInterval;
    this.token = token;
  }

  private connect() {
    this.ws = new WebSocket(`${this.url}?token=${this.token}`);

    this.ws.onmessage = (event) => {
      if (this.onMessageCallback) {
        this.onMessageCallback(event.data as string);
      }
    };

    this.ws.onopen = () => {
      if (this.onOpenCallback) {
        this.onOpenCallback();
      }
    };

    this.ws.onclose = () => {
      if (this.onCloseCallback) {
        this.onCloseCallback();
      }
      console.log("WebSocket closed, reconnecting...");
      setTimeout(() => {
        this.connect();
      }, this.reconnectInterval);
    };

    this.ws.onerror = (event) => {
      if (this.onErrorCallback) {
        this.onErrorCallback(new Error(event.type));
      }
      console.error("WebSocket error: ", event);
    };
  }

  // private async getAuthToken(): Promise<string | null> {
  //   while (true) {
  //     try {
  //       const res = await fetch(`${this.url}/ws/auth`, {
  //         method: "GET",
  //         headers: {
  //           "Content-Type": "application/json",
  //           authorization: `Bearer ${this.code}`,
  //         },
  //       });

  //       if (!res.ok) {
  //         console.log(
  //           `Failed to get auth token, retrying... Status: ${res.status}`
  //         );
  //         await new Promise((resolve) =>
  //           setTimeout(resolve, this.reconnectInterval)
  //         );
  //         continue;
  //       }

  //       const { token } = await res.json();
  //       return token;
  //     } catch (error) {
  //       console.error("Error getting auth token: ", error);
  //       await new Promise((resolve) =>
  //         setTimeout(resolve, this.reconnectInterval)
  //       );
  //     }
  //   }
  // }

  public async start() {
    // this.token = await this.getAuthToken();
    this.connect();
  }

  onMessage(callback: (message: string) => void) {
    this.onMessageCallback = callback;
  }

  onClose(callback: () => void) {
    this.onCloseCallback = callback;
  }

  onError(callback: (error: Error) => void) {
    this.onErrorCallback = callback;
  }

  onOpen(callback: () => void) {
    this.onOpenCallback = callback;
  }

  close() {
    if (this.ws) {
      this.ws.close();
    }
  }
}
