import { AsyncQueue, QueueEntry } from "./async-queue";
import { SettingsStore } from "./settings";
import { StreamablePlayer } from "./streamable";
import { YoutubeVideoPlayer } from "./youtube";

export interface VideoPlayer {
  play(
    id: string,
    options?: {
      volume: number;
    }
  ): void;
  done(): Promise<void>;
  end(): Promise<void>;
}

type VideoEntry = {
  url: string;
  type: "youtube" | "streamable";
  volume?: number;
} & QueueEntry;

export class VideoClient {
  queue: AsyncQueue<VideoEntry> = new AsyncQueue();
  player?: VideoPlayer;

  constructor(private settings: SettingsStore) {}

  public enqueue({ url, type, volume }: VideoEntry) {
    this.queue.enqueue({ url, type, volume, messageIndex: 0, segmentIndex: 0 });
  }

  public async skip() {}

  public async start() {
    for await (const message of this.queue) {
      try {
        let { type, url, volume } = message;

        if (type === "youtube") {
          const player = new YoutubeVideoPlayer();

          this.player = player;

          volume ??= this.settings.get("videoVolume");

          player.play(url, { volume });

          await player.done();

          this.player = undefined;
        } else if (type === "streamable") {
          const player = new StreamablePlayer();

          this.player = player;
          volume ??= this.settings.get("videoVolume");

          await player.play(url, { volume });

          await player.done();
        }
      } catch (error) {
        console.error(error);
      }
    }
  }
}
