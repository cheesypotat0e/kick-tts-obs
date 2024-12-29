import YT from "youtube-player";
import PlayerStates from "youtube-player/dist/constants/PlayerStates";
import { YouTubePlayer } from "youtube-player/dist/types";
import { VideoPlayer } from "./video-client";

export type YoutubePlayerState = {
  player?: YouTubePlayer;
};

export class YoutubeVideoPlayer implements VideoPlayer {
  state: YoutubePlayerState = {};
  doneResolver?: () => void;
  timeout?: ReturnType<typeof setTimeout>;

  play(id: string, options?: { volume: number }) {
    this.timeout = setTimeout(async () => {
      await this.clear();
    }, 30 * 1000);

    let started = false;

    this.state.player = YT("player", {
      height: "315",
      width: "560",
      videoId: id,
      playerVars: {
        autoplay: 1,
        fs: 1,
      },
    });

    let vol = 100;

    if (options) {
      vol = options.volume * 100;
    }

    this.state.player.on("ready", (event) => {
      if (event.target) {
        const player = event.target as unknown as YouTubePlayer;
        player.setVolume(vol);
        player.playVideo();
      }
    });

    this.state.player.on("stateChange", async (event) => {
      if (event.target) {
        const player = event.target as unknown as YouTubePlayer;
        const state = await player.getPlayerState();

        if (state === PlayerStates.PLAYING && !started) {
          started = true;
        }

        if (state === PlayerStates.ENDED) {
          await this.clear();
        }
      }
    });

    this.state.player.on("error", (event) => {
      console.error(event);
    });
  }

  public async skip() {
    await this.clear();
  }

  public async done() {
    const state = await this.state.player?.getPlayerState();

    if (this.state.player && state !== PlayerStates.ENDED) {
      await new Promise<void>((res) => {
        this.doneResolver = res;
      });
    }

    await this.clear();
  }

  public async end() {
    const player = this.state.player;

    if (player) {
      const dur = await player.getDuration();
      await player.seekTo(dur, true);
      await player.playVideo();
    }
  }

  public async clear() {
    if (this.doneResolver) {
      this.doneResolver();
    }

    clearTimeout(this.timeout);

    await this.state.player?.destroy();

    this.state.player = undefined;
  }
}
