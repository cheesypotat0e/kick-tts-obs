import { VideoPlayer } from "./video-client";

export class StreamablePlayer implements VideoPlayer {
  ended: boolean = false;
  endedResolver?: () => void;
  video?: HTMLVideoElement;
  timeout?: ReturnType<typeof setTimeout>;

  public static StreamableAPIURLPrefix = "https://api.streamable.com/videos/";

  private async getURL(id: string) {
    const res = await fetch(StreamablePlayer.StreamableAPIURLPrefix + id);
    const data = await res.json();

    return data.files["mp4"].url;
  }

  async play(id: string, options?: { volume: number }): Promise<void> {
    const video = this.newVideo();

    let vol = 1.0;

    if (options) {
      vol = options.volume;
    }

    this.video = video;

    video.height = 315;
    video.width = 560;
    video.volume = vol;

    video.src = await this.getURL(id);

    this.timeout = setTimeout(async () => {
      if (!this.ended) {
        await this.end();
      }
    }, 30 * 1000);
  }

  done(): Promise<void> {
    if (!this.ended) {
      return new Promise<void>((res) => {
        this.endedResolver = res;
      });
    }

    return Promise.resolve();
  }

  end() {
    if (this.video) {
      this.video.currentTime = this.video.duration;
      this.video.pause();
    }

    this.ended = true;

    return Promise.resolve();
  }

  private newVideo() {
    const video = document.createElement("video");
    video.autoplay = true;
    document.body.appendChild(video);
    video.addEventListener("ended", () => {
      this.ended = true;
      if (this.endedResolver) {
        this.endedResolver();
      }
      clearTimeout(this.timeout);
      this.video?.remove();
    });

    return video;
  }
}
