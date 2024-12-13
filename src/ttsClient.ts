import { gcloudVoices } from "./gcloud-voices.js";
import { neetsVoices } from "./neets-voices.js";
import { Holler } from "./holler.js";
import { Messenger } from "./messenger.js";
import { AsyncQueue, QueueEntry } from "./async-queue.js";
import { SettingsStore } from "./settings.js";
import { fishVoices } from "./fish-voices.js";

// type TTSVoice = {
//   voiceName: string;
//   code?: string;
//   model?: string;
//   platform: string;
// };

type TTSState = {
  ms?: Messenger;
  ttsQueue: AsyncQueue<TTSEntry>;
  audio?: Holler;
  // sendQueue: AsyncQueue<string>;
  processingTTSQueue: boolean;
};

export type TTSEntry = {
  text: string;
  options: {
    voice: {
      id?: string;
      volume?: number;
      rate?: number;
    };
    format?: string;
  };
} & QueueEntry;

// const kickObsTTSSettings = "kick-obs-tts-settings";

export class TTSClient {
  state: TTSState = {
    ms: undefined,
    ttsQueue: new AsyncQueue<TTSEntry>(),
    audio: undefined,
    // sendQueue: new AsyncQueue(),
    processingTTSQueue: false,
  };

  constructor(private settings: SettingsStore, private holler: Holler) {}

  public enqueTTSQueue(message: TTSEntry) {
    this.state.ttsQueue.enqueue(message);
  }

  public async startTTSQueue() {
    console.debug("starting tts queue...");
    for await (const message of this.state.ttsQueue) {
      let {
        options: { voice },
        text,
        messageIndex,
        segmentIndex,
      } = message;

      voice.id ??= this.settings.get("ttsVoice");
      voice.rate ??= this.settings.get("ttsSpeed");
      voice.volume ??= this.settings.get("ttsVolume");

      let ttsMessage: TTSMessage | undefined = undefined;

      if (this.isGoogleVoice(voice.id)) {
        if (this.isGoogleEnabled()) {
          const id = voice.id.toLowerCase();

          const gcloudVoice =
            gcloudVoices[id] || neetsVoices[id] || fishVoices[id];

          ttsMessage = new GCloudTTSMessage(
            text,
            gcloudVoice.voiceName,
            gcloudVoice.code,
            gcloudVoice.platform,
            new GCloudFetch(
              this.settings.get("journeyProjectName"),
              this.settings.get("journeyFunctionName")
            )
          );
        }
      } else {
        ttsMessage = new StreamElementsTTSMessage(text, voice.id);
      }

      if (ttsMessage) {
        const data = Promise.resolve(ttsMessage.generate());

        const { rate, volume } = voice;

        this.holler.enqueue({
          data,
          options: { rate, volume },
          messageIndex,
          segmentIndex,
        });
      }
    }
  }

  private isGoogleEnabled() {
    return (
      this.settings.get("journeyFunctionName") &&
      this.settings.get("journeyProjectName")
    );
  }

  private isGoogleVoice(voice: string) {
    return this.settings.get("voices").has(voice);
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
    if (!this.voice) {
      return "";
    }

    return this.voice.charAt(0).toUpperCase() + this.voice.slice(1);
  }

  public async generate() {
    const response = await fetch(this.getURL());

    if (!response.ok) {
      const errorBody = await response.json();
      const errorMessage = errorBody["message"];

      throw new Error("Error requesting TTS voice " + errorMessage);
    }

    const audioBuffer = await response.arrayBuffer();

    return convertToBase64(audioBuffer, getAudioFormat(audioBuffer));
  }

  private getURL() {
    const url = new URL(StreamElementsTTSMessage.STREAMELEMENTS_URL);

    url.searchParams.set("voice", this.getVoice());
    url.searchParams.set("text", this.getText());

    return url.toString();
  }
}

class GCloudTTSMessage implements TTSMessage {
  constructor(
    private text: string,
    private voice: string,
    private code: string,
    private platform: "gcloud" | "neets",
    private fetch: GCloudFetch
  ) {}

  public async generate(): Promise<string> {
    const params = new URLSearchParams({
      lang: this.voice,
      lang_code: this.code,
      platform: this.platform,
      text: this.text,
      v2: "true",
    });

    const response = await this.fetch.get(params.toString());

    if (!response.ok) {
      const json = await response.json();

      throw new Error(
        `Error requesting Google cloud TTS: ${JSON.stringify(json)}`
      );
    }

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

  public async get(params: string) {
    if (!params.startsWith("?")) {
      params = "?" + params;
    }

    return fetch(
      `https://${this.projectName}.cloudfunctions.net/${this.functionName}${params}`
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

  // Check for ID3 header first
  if (
    dataView.getUint8(0) === 0x49 &&
    dataView.getUint8(1) === 0x44 &&
    dataView.getUint8(2) === 0x33
  ) {
    return "mp3";
  }

  for (let i = 0; i < Math.min(dataView.byteLength - 1, 2048); i++) {
    const firstByte = dataView.getUint8(i);
    const secondByte = dataView.getUint8(i + 1);

    if (firstByte === 0xff && (secondByte & 0xe0) === 0xe0) {
      return "mp3";
    }
  }

  // WAV files start with the "RIFF" identifier and "WAVE" format identifier.
  if (
    dataView.getUint32(0, false) === 0x52494646 &&
    dataView.getUint32(8, false) === 0x57415645
  ) {
    return "wav";
  }

  // OGG/OGA files start with "OggS".
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
