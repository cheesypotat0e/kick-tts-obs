import { Howl } from "howler";

export type HollerOptions = {
  volume: number;

  // for cases where CORS is disabled
  html5?: boolean;

  format?: string;

  rate: number;
};

export class Holler {
  holler: Howl;

  constructor(
    data: string,
    { volume, format, html5 = false, rate }: HollerOptions
  ) {
    this.holler = new Howl({
      src: [data],
      html5,
      format,
      volume,
      rate,
    });
  }

  public async play() {
    return new Promise<void>((res, rej) => {
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
    this.holler.seek(this.holler.duration());
  }
}
