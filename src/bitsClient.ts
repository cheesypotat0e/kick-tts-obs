import { AsyncQueue, QueueEntry } from "./async-queue";
import { Holler } from "./holler";
import { SettingsStore } from "./settings";

type BitsEntry = {
  url: string;
  options: {
    volume: number;
    rate: number;
  };
} & QueueEntry;

type BitsState = {
  bitsQueue: AsyncQueue<BitsEntry>;
  processingBitsQueue: boolean;
};

export class BitsClient {
  state: BitsState = {
    bitsQueue: new AsyncQueue(),
    processingBitsQueue: false,
  };

  constructor(private settings: SettingsStore, private holler: Holler) {}

  public async enqueue(
    bitID: string,
    { messageIndex, segmentIndex }: QueueEntry
  ) {
    const bits = this.settings.get("bits");

    if (bits.has(bitID)) {
      const { url, vol } = bits.get(bitID)!;

      const rate = this.settings.get("bitsRate");
      const volume = Math.min(vol, 1.0) ?? this.settings.get("bitsVolume");

      this.state.bitsQueue.enqueue({
        url,
        options: { rate, volume },
        messageIndex,
        segmentIndex,
      });
    }
  }

  public async startBitsQueue() {
    console.debug("Starting bits queue...");

    for await (const message of this.state.bitsQueue) {
      let {
        url,
        options: { volume, rate },
        messageIndex,
        segmentIndex,
      } = message;

      const data = Promise.resolve(url);

      // html5 is required due to CORS
      this.holler.enqueue({
        data,
        options: { rate, volume, html5: true },
        messageIndex,
        segmentIndex,
      });
    }
  }
}
