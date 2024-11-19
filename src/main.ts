import { BitsClient } from "./bitsClient.js";
import { GCloudVoice, gcloudVoices } from "./gcloud-voices.js";
import { Holler, MessageMap } from "./holler.js";
import { KickMessenger } from "./kick-messenger.js";
import { MessageParse, MessageType } from "./message-parser.js";
import { NeetsVoice, neetsVoices } from "./neets-voices.js";
import { SettingsStore } from "./settings.js";
import { TTSClient } from "./ttsClient.js";

const url = new URL(window.location.href);

const params = url.searchParams;

const settings = SettingsStore.getInstance();

settings.upsertWithParams(params);
settings.upsertFromLocalStorage();

settings.set(
  "voices",
  new Map<string, GCloudVoice | NeetsVoice>([
    ...Object.entries(gcloudVoices),
    ...Object.entries(neetsVoices),
  ])
);

settings.saveToLocalStorage();

const roomsID = settings.get("roomID");

if (!settings.has("roomID")) {
  throw new Error("Room ID is missing");
}

const kickMs = new KickMessenger(settings);

const messageMap: MessageMap = new Map();

const holler = new Holler(messageMap);

holler.start();

const ttsClient = new TTSClient(settings, holler);

ttsClient.startTTSQueue();

const bitsClient = new BitsClient(settings, holler);

bitsClient.startBitsQueue();

await kickMs.start(roomsID);

let messageIndex = 0;

for await (const message of kickMs.queue) {
  messageIndex = (messageIndex + 1) % (1e9 + 7);
  let segmentIndex = 0;

  const parser = new MessageParse();

  const output = parser.parse(message.tokens);

  messageMap.set(messageIndex, {
    size: output.reduce(
      (acc, e) =>
        acc + Number(e.type === MessageType.TTS || e.type === MessageType.bit),
      0
    ),
    entries: [],
  });

  for (const segment of output) {
    switch (segment.type) {
      case MessageType.TTS:
        ttsClient.enqueTTSQueue({
          text: segment.message,
          options: {
            voice: {
              id: segment.voice,
            },
          },
          messageIndex,
          segmentIndex,
        });

        break;

      case MessageType.bit:
        bitsClient.enqueue(segment.message, { segmentIndex, messageIndex });
        break;

      case MessageType.skip:
        holler.skip();
        break;
      case MessageType.config:
        const { name, args } = segment;

        if (settings.isValidKey(name)) {
          settings.set(name, args);
        }

        break;

      case MessageType.clearConfig:
        settings.clearFromLocalStorage();
        break;

      default:
        break;
    }

    segmentIndex++;
  }
}
