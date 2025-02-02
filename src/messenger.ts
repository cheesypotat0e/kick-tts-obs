import { AsyncQueue, QueueEntry } from "./async-queue";
import { SettingsStore } from "./settings";
import { wait, withRetry, withTimeout } from "./utils";

export type Message = {
  text: string;
  username: string;
  tokens: string[];
  isSub: boolean;
};

export class Messenger {
  ws?: WebSocket;
  queue: AsyncQueue<Message & QueueEntry> = new AsyncQueue();
  isProcessing: boolean = false;
  url: string = "";

  eventListeners: {
    onerror: ((event: any) => void)[];
    onmessage: ((event: any) => void)[];
    onclose: ((event?: any) => void)[];
  } = {
    onclose: [],
    onmessage: [],
    onerror: [],
  };

  constructor(protected settings: SettingsStore) {}

  public async connect(url: string) {
    let u = new URL(url);

    u.searchParams.set("clusterID", this.settings.get("clusterID"));
    u.searchParams.set("version", this.settings.get("version"));

    const timeout = this.settings.get("timeout");
    await this.wsConnect(url, { timeout });
  }

  public async wsConnect(url: string, settings: { timeout: number }) {
    const { timeout } = settings;

    const connectTimeout = withTimeout<void>(async (signal) => {
      this.ws = new WebSocket(url);

      this.ws.onerror = this.onerror;
      this.ws.onmessage = this.onmessage;
      this.ws.onclose = this.onclose;

      while (this.ws.readyState !== this.ws.OPEN && !signal.aborted) {
        await wait(500);
      }

      if (this.ws.readyState !== this.ws.OPEN) {
        signal.throwIfAborted();
      }
    }, timeout);

    const connectRetry = withRetry<void>(connectTimeout, 2000, -1);

    await connectRetry();

    this.url = url;
    console.debug("Connected to WebSocket");
  }

  public async disconnect() {
    this.ws?.close();
  }

  async *[Symbol.asyncIterator]() {
    for await (const message of this.queue) {
      yield message;
    }
  }

  protected pushToQueue(message: Message) {
    this.queue.enqueue({ ...message, messageIndex: 0, segmentIndex: 0 });
  }

  public async send(message: string) {
    console.debug(`sending message to WebSocket connection ${message}`);
    this.ws?.send(message);
  }

  public async close() {
    this.disconnect();
    this.queue.clear();
  }

  public async reconnect() {
    console.debug("Reconnecting to WebSocket...");
    this.disconnect();

    const timeout = this.settings.get("timeout");

    this.wsConnect(this.url, { timeout });
  }

  public addEventListener(
    event: "onerror" | "onmessage" | "onclose",
    fn: (event: any) => void
  ) {
    this.eventListeners[event].push(fn);
  }

  onmessage = (event: any) => {
    this.eventListeners.onmessage.forEach((fn) => {
      fn(event);
    });
  };

  onerror = (event: Event) => {
    this.eventListeners.onerror.forEach((fn) => {
      fn(event);
    });
    console.error("WebSocket error: ", event);
  };

  onclose = () => {
    this.eventListeners.onclose.forEach((fn) => {
      fn();
    });
  };
}
