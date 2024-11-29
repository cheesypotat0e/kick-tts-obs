import { Authorizer } from "./auth.js";
import { BitsClient } from "./bitsClient.js";
import { GCloudVoice, gcloudVoices } from "./gcloud-voices.js";
import { Holler, MessageMap } from "./holler.js";
import { KickMessenger } from "./kick-messenger.js";
import { MessageParse, MessageType } from "./message-parser.js";
import { NeetsVoice, neetsVoices } from "./neets-voices.js";
import { SettingsStore } from "./settings.js";
import { TTSClient } from "./ttsClient.js";
import { VideoClient } from "./video-client.js";

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

const videoClient = new VideoClient(settings);
videoClient.start();

const authorizer = new Authorizer(settings);

let messageIndex = 0;

for await (const message of kickMs.queue) {
  messageIndex = (messageIndex + 1) % (1e9 + 7);
  let segmentIndex = 0;

  const { username, tokens } = message;

  const parser = new MessageParse();

  const output = parser
    .parse(tokens)
    .filter((output) => authorizer.isAuthorized(username, output.type));

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
              volume: settings.get("ttsVolume"),
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
        videoClient.skip();
        break;
      case MessageType.config:
        const { name, args } = segment;

        if (settings.isValidKey(name)) {
          settings.set(name, args);
        }

        settings.saveToLocalStorage();

        break;

      case MessageType.clearConfig:
        settings.clearFromLocalStorage();
        break;

      case MessageType.video:
        const ytRegex =
          /(?:https?:\/\/(?:www\.))?(?:youtube\.com.watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
        const { url } = segment;

        const matches = url.match(ytRegex);

        if (matches) {
          const id = matches[1];
          videoClient.enqueue({
            url: id,
            type: "youtube",
            messageIndex: 0,
            segmentIndex: 0,
          });
        } else {
          const streamableRegex =
            /https?:\/\/(?:www\.)?streamable\.com\/([a-zA-Z0-9]+)/;
          const { url } = segment;

          const matches = url.match(streamableRegex);

          if (matches) {
            const id = matches[1];
            videoClient.enqueue({
              url: id,
              type: "streamable",
              messageIndex: 0,
              segmentIndex: 0,
            });
          }
        }

        break;
      case MessageType.vol: {
        const { value } = segment;
        settings.set("ttsVolume", value);
        settings.saveToLocalStorage();

        break;
      }

      case MessageType.bitVol: {
        const { value } = segment;
        settings.set("bitsVolume", value);
        settings.saveToLocalStorage();

        break;
      }

      case MessageType.addBit: {
        const {
          value: { key, value },
        } = segment;
        settings.get("bits").set(key, value);
        settings.saveToLocalStorage();
        break;
      }

      case MessageType.removeBit: {
        const { value } = segment;
        settings.get("bits").delete(value);
        settings.saveToLocalStorage();
        break;
      }

      case MessageType.addAdmin: {
        const { value } = segment;
        settings.get("admins").add(value);
        settings.saveToLocalStorage();
        break;
      }

      case MessageType.removeAdmin: {
        const { value } = segment;
        settings.get("admins").delete(value);
        settings.saveToLocalStorage();
        break;
      }

      default:
        break;
    }

    segmentIndex++;
  }
}