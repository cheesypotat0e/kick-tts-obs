export class WsClient {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectInterval: number;
  private onMessageCallback: ((message: string) => void) | null = null;
  private onCloseCallback: (() => void) | null = null;
  private onErrorCallback: ((error: Error) => void) | null = null;
  private onOpenCallback: (() => void) | null = null;

  constructor(url: string, reconnectInterval: number = 3000) {
    this.url = url;
    this.reconnectInterval = reconnectInterval;
  }

  private connect() {
    this.ws = new WebSocket(this.url);

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

  public start() {
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
