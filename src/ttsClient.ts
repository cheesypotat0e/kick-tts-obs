import { gcloudVoices } from "./gcloud-voices.js";
import { neetsVoices } from "./neets-voices.js";
import { Holler } from "./holler.js";
import { Messenger } from "./messenger.js";
import { AsyncQueue } from "./async-queue.js";
import { KickMessenger } from "./kick-messenger.js";

type TTSSettings = {
  roomID?: string;

  clusterID: string;

  version: string;

  refreshToken: string;

  ttsVoice: string;

  ttsSpeed: number; // between 0.0 and 4.0

  ttsVolume: number; // between 0.0 and 1.0

  journeyProjectName?: string;

  journeyFunctionName?: string;

  admins: string[];

  bits: Record<string, string>;

  voices: Record<string, TTSVoice>;
};

type TTSVoice = {
  voiceName: string;
  code?: string;
  model?: string;
  platform: string;
};

type TTSState = {
  ms?: Messenger;
  ttsQueue: AsyncQueue<TTSEntry>;
  audio?: Holler;
  sendQueue: AsyncQueue<string>;
  processingSendQueue: boolean;
  processingTTSQueue: boolean;
  gcloudFetch?: GCloudFetch;
};

export type TTSEntry = {
  text: string;
  options: {
    voice: string;
    volume: number;
    rate: number;
    format?: string;
  };
};

const kickObsTTSSettings = "kick-obs-tts-settings";

export class TTSClient {
  static defaultTTSSettings: TTSSettings = {
    roomID: undefined,

    clusterID: "32cbd69e4b950bf97679",

    version: "8.4.0-rc2",

    refreshToken: "refreshTTS",

    ttsVoice: "Brian",

    ttsSpeed: 1.0,

    ttsVolume: 1.0,

    journeyFunctionName: "",

    journeyProjectName: "",

    admins: [],

    bits: {
      follow: "https://www.myinstants.com/media/sounds/short_sms_wcluqam.mp3",
      fart: "https://www.myinstants.com/media/sounds/dry-fart.mp3",
      pluh: "https://www.myinstants.com/media/sounds/pluh.mp3",
      boom: "https://www.myinstants.com/media/sounds/vine-boom.mp3",
      discord:
        "https://www.myinstants.com/media/sounds/discord-notification.mp3",
    },

    voices: { ...gcloudVoices, ...neetsVoices },
  };

  settings: TTSSettings;
  state: TTSState = {
    ms: undefined,
    ttsQueue: new AsyncQueue(),
    audio: undefined,
    sendQueue: new AsyncQueue(),
    processingSendQueue: false,
    processingTTSQueue: false,
    gcloudFetch: undefined,
  };

  constructor(
    settings: Partial<TTSSettings> & Required<Pick<TTSSettings, "roomID">>
  ) {
    this.settings = {
      ...TTSClient.defaultTTSSettings,
      ...settings,
    };

    if (this.settings.journeyFunctionName && this.settings.journeyProjectName) {
      this.state.gcloudFetch = new GCloudFetch(
        this.settings.journeyProjectName,
        this.settings.journeyFunctionName
      );
    }
  }

  public async start() {
    this.startProcessQueue();
    this.startTTSQueue();
    // await this.connectToChat();

    // if (this.state.ms) {
    //   for await (const message of this.state.ms) {
    //     for (const [cmd, ...args] of message.commands) {
    //       if (cmd === "s") {
    //         this.enqueTTSQueue({
    //           text: args.slice(1).join(" "),
    //           options: {
    //             rate: this.settings.ttsSpeed,
    //             voice: this.settings.ttsVoice,
    //             volume: this.settings.ttsVolume,
    //           },
    //         });
    //       } else if (cmd === "bit") {
    //       }
    //     }
    //   }
    // }
  }

  public destroy() {
    this.stopProcessQueue();
  }

  private async connectToChat() {
    const { roomID, clusterID, version } = this.settings;

    if (!roomID) {
      console.error("missing roomID");
      return;
    }

    if (this.state.ms) {
      await this.state.ms.close();
    }

    this.state.ms = new KickMessenger({ clusterID, version, roomID });

    await this.state.ms.connect(this.settings.clusterID, this.settings.version);

    const subscribeMessage = {
      event: "pusher:subscribe",
      data: {
        channel: `chatrooms.${roomID}.v2`,
        auth: "",
      },
    };

    this.send(JSON.stringify(subscribeMessage));
  }

  private enqueTTSQueue(message: TTSEntry) {
    this.state.ttsQueue.enqueue(message);
  }

  private async startTTSQueue() {
    for await (const message of this.state.ttsQueue) {
      const {
        options: { rate, voice, volume, format },
        text,
      } = message;

      let ttsMessage: TTSMessage;

      if (
        this.state.gcloudFetch &&
        (voice in neetsVoices || voice in gcloudVoices)
      ) {
        ttsMessage = new GCloudTTSMessage(text, voice, this.state.gcloudFetch);
      } else {
        ttsMessage = new StreamElementsTTSMessage(text, voice);
      }

      const data = await ttsMessage.generate();

      const holler = new Holler(data, { volume, rate, format });

      try {
        await holler.play();
      } catch (error) {
        console.error("Error processing tts message: ", error);
      }
    }
  }

  private skip() {
    this.state.audio?.skip();
  }

  private send(message: string) {
    console.debug(`Queueing message to the send queue: ${message}`);
    this.state.sendQueue.enqueue(message);
  }

  private async startProcessQueue() {
    for await (const message of this.state.sendQueue) {
      await this.state.ms?.send(message);
    }
  }

  private stopProcessQueue() {
    this.state.sendQueue.close();
  }
}

interface TTSMessage {
  generate(): Promise<string>;
  getText(): string;
  getVoice(): string;
}

class StreamElementsTTSMessage implements TTSMessage {
  static STREAMELEMENTS_URL: string =
    "https://api.streamelements.com/kappa/v2/speech";

  constructor(private text: string, private voice: string) {}

  public getText() {
    return this.text;
  }

  public getVoice(): string {
    return this.voice;
  }

  public async generate() {
    const response = await fetch(this.getURL());

    const audioBuffer = await response.arrayBuffer();

    return convertToBase64(audioBuffer, getAudioFormat(audioBuffer));
  }

  private getURL() {
    return (
      StreamElementsTTSMessage.STREAMELEMENTS_URL +
      `?voice=${this.voice}&text=${encodeURIComponent(this.text)}`
    );
  }
}

class GCloudTTSMessage implements TTSMessage {
  constructor(
    private text: string,
    private voice: string,
    private fetch: GCloudFetch
  ) {}

  public async generate(): Promise<string> {
    const response = await this.fetch.get(
      `?lang=${this.voice}&text=${encodeURIComponent(this.text)}`
    );

    const audioBuffer = await response.arrayBuffer();

    return convertToBase64(audioBuffer, getAudioFormat(audioBuffer));
  }

  getText(): string {
    return this.text;
  }

  getVoice(): string {
    return this.voice;
  }
}

class GCloudFetch {
  constructor(private projectName: string, private functionName: string) {}

  public setFunctionName(functionName: string) {
    this.functionName = functionName;
  }

  public setFunctionProj(projectName: string) {
    this.projectName = projectName;
  }

  public async get(params: string) {
    if (!params.startsWith("?")) {
      params = "?" + params;
    }

    return fetch(
      `https://${this.projectName}.cloudfunctions.net/${this.functionName}?${params}`
    );
  }
}

function convertToBase64(arrayBuffer: ArrayBuffer, format: string) {
  let binary = "";
  const bytes = new Uint8Array(arrayBuffer);

  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }

  const base64 = btoa(binary);

  return `data:audio/${format};base64,${base64}`;
}

function getAudioFormat(arrayBuffer: ArrayBuffer) {
  const dataView = new DataView(arrayBuffer);

  // MP3 files usually start with the sequence "ID3" or have frame headers with sync bits.
  if (
    dataView.getUint8(0) === 0x49 &&
    dataView.getUint8(1) === 0x44 &&
    dataView.getUint8(2) === 0x33
  ) {
    return "mp3";
  }

  // WAV files start with the "RIFF" identifier and "WAVE" format identifier.
  if (
    dataView.getUint32(0, false) === 0x52494646 &&
    dataView.getUint32(8, false) === 0x57415645
  ) {
    return "wav";
  }

  // OGG files start with "OggS".
  if (
    dataView.getUint8(0) === 0x4f &&
    dataView.getUint8(1) === 0x67 &&
    dataView.getUint8(2) === 0x67 &&
    dataView.getUint8(3) === 0x53
  ) {
    return "ogg";
  }

  // FLAC files start with "fLaC".
  if (dataView.getUint32(0) === 0x664c6143) {
    return "flac";
  }

  return "unknown format";
}
