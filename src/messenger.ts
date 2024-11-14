import { AsyncQueue } from "./async-queue";
import { wait, withTimeout } from "./utils";

export type Message = {
  text: string;
  username: string;
  commands: string[][];
};

export class Messenger {
  ws?: WebSocket;
  clusterID?: string;
  version?: string;
  queue: AsyncQueue<Message>;
  isProcessing: boolean = false;
  url: string = "";
  timeout: number = 2000;

  settings: Record<string, any>;

  constructor(settings: Record<string, any> = {}) {
    this.queue = new AsyncQueue();
    this.settings = settings;
  }

  public async connect(url: string, settings: { timeout: number }) {
    const { timeout } = settings;

    const connectTimeout = withTimeout<void>(async () => {
      this.ws = new WebSocket(url);

      while (this.ws.readyState === this.ws.CONNECTING) {
        await wait(50);
      }
    }, timeout);

    try {
      await connectTimeout();

      this.url = url;
      this.timeout = timeout;

      console.debug("Connected to WebSocket");
    } catch (error) {
      console.error("Error connecting: ", error);
    }
  }

  // public parse(message: string) {
  //   message.trim();

  //   const tokens = message.split(" ");

  //   let commands = [];

  //   let cmd: string | undefined;

  //   let args: string[] = [];

  //   for (const token of tokens) {
  //     if (token.startsWith("!")) {
  //       if (cmd) {
  //         commands.push([cmd, ...args]);
  //       }

  //       cmd = token.slice(1);
  //       args = [];
  //     } else if (cmd) {
  //       args.push(token);
  //     }
  //   }

  //   if (cmd) {
  //     commands.push([cmd, ...args]);
  //   }

  //   return commands;
  // }

  public async disconnect() {
    this.ws?.close();
  }

  async *[Symbol.asyncIterator]() {
    for await (const message of this.queue) {
      yield message;
    }
  }

  protected pushToQueue(message: Message) {
    this.queue.enqueue(message);
  }

  // public onmessage(event: any) {

  // try {
  //   const message = JSON.parse(event.data);

  //   if (message.event == "App\\Events\\ChatMessageEvent") {
  //     const chatMessage = JSON.parse(message.data);
  //     const senderUsername = chatMessage?.sender?.slug;

  //     const text = chatMessage.content;

  //     const commands = this.parse(text);

  //     this.pushToQueue({
  //       text,
  //       username: senderUsername,
  //       commands,
  //     });
  //   }
  // } catch (error) {
  //   console.error(
  //     `Error with event: ${JSON.stringify(event)} error: ${error}`
  //   );
  // }
  // }

  public async send(message: string) {
    console.debug(`sending message to WebSocket connection ${message}`);
    this.ws?.send(message);
  }

  public async close() {
    this.disconnect();
    this.queue.clear();
  }

  public async reconnect() {
    this.disconnect();

    this.connect(this.url, { timeout: this.timeout });
  }

  onmessage = (event: any) => {
    console.log(event);
  };

  onerror = (event: Event) => {
    console.error("WebSocket error: ", event);
  };

  onclose = () => {
    console.log("WebSocket connection closed");

    console.log("Reconnecting...");

    setTimeout(this.connect, 1000 * 2);
  };
}
