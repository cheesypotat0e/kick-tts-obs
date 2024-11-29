import { Howl } from "howler";
import { AsyncQueue, QueueEntry } from "./async-queue";

export type HollerOptions = {
  volume: number;

  // for cases where CORS is disabled
  html5?: boolean;

  format?: string;

  rate: number;
};

export type HollerEntry = {
  data: Promise<string>;
  options: HollerOptions;
} & QueueEntry;

export type MessageMap = Map<number, { size: number; entries: HollerEntry[] }>;

export class Holler {
  holler?: Howl;

  queue: AsyncQueue<HollerEntry>;

  messageGroups: MessageMap = new Map();

  constructor(messageGroups: MessageMap) {
    this.queue = new AsyncQueue();
    this.messageGroups = messageGroups;
  }

  public async start() {
    for await (const entry of this.queue) {
      const {
        data,
        options: { html5, rate, volume, format },
      } = entry;

      console.log({ volume });

      const audioData = await data;

      this.holler = new Howl({
        src: [audioData],
        html5,
        rate,
        volume,
        format,
      });

      try {
        await this.play();
      } catch (error) {
        console.error("Error playing howl: ", error);
      }
    }
  }

  public enqueue(entry: HollerEntry) {
    const group = this.messageGroups.get(entry.messageIndex);

    if (group) {
      group.entries.push(entry);

      if (group.entries.length === group.size) {
        group.entries.sort((a, b) => a.segmentIndex - b.segmentIndex);

        for (entry of group.entries) {
          this.queue.enqueue(entry);
        }

        this.messageGroups.delete(entry.messageIndex);
      }
    } else {
      this.queue.enqueue(entry);
    }
  }

  public async play() {
    return new Promise<void>((res, rej) => {
      if (!this.holler) {
        res();
        return;
      }

      this.holler.on("end", () => {
        res();
      });

      this.holler.on("loaderror", (id, error) => {
        console.error("Error with loading sound: ", error);
        rej();
      });

      this.holler.on("playerror", (id, error) => {
        console.error("Error with playing sound: ", error);
        rej();
      });

      this.holler.play();
    });
  }

  public skip() {
    if (this.holler) {
      this.holler.seek(this.holler.duration());
    }
  }
}
