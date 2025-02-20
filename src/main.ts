import { Authorizer, Roles } from "./auth.js";
import { BitsClient } from "./bitsClient.js";
import { GCloudVoice, gcloudVoices } from "./gcloud-voices.js";
import { Holler, MessageMap } from "./holler.js";
import { KickMessenger } from "./kick-messenger.js";
import { imageRegex, MessageParser, MessageType } from "./message-parse-2.js";
import { NeetsVoice, neetsVoices } from "./neets-voices.js";
import { SettingsStore } from "./settings.js";
import { TTSClient } from "./ttsClient.js";
import { VideoClient } from "./video-client.js";
import { ImageClient } from "./image-client.js";
import { FishVoice, fishVoices } from "./fish-voices.js";
import { RateLimiter } from "./rate-limit.js";

const url = new URL(window.location.href);

const params = url.searchParams;

const settings = SettingsStore.getInstance();

const imgurClientID = import.meta.env.VITE_API_IMGUR_CLIENT_ID;
const authUrl = import.meta.env.VITE_AUTH_URL;

if (!imgurClientID) {
  throw new Error(
    "missing imgur client ID get it here: https://api.imgur.com/oauth2/addclient"
  );
}

if (params.has("roomID")) {
  params.set("roomId", params.get("roomID")!);
  params.delete("roomID");
}

if (!params.has("roomId")) {
  // recovery mode
  params.set("roomId", "88774");
}

settings.upsertWithParams(params);
settings.upsertFromLocalStorage();

const existingVoices = settings.get("voices");

settings.set(
  "voices",
  new Map<string, GCloudVoice | NeetsVoice | FishVoice>([
    ...existingVoices.entries(),
    ...Object.entries(gcloudVoices),
    ...Object.entries(neetsVoices),
    ...Object.entries(fishVoices),
  ])
);

settings.saveToLocalStorage();

const roomsID = settings.get("roomId");

if (!settings.has("roomId")) {
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

const imageClient = new ImageClient(imgurClientID);
imageClient.start();

const authorizer = new Authorizer(settings);

const rateLimiter = new RateLimiter(settings.get("rateLimits").entries());

let messageIndex = 0;

const isBanned = (username: string) =>
  (settings.get("bans").has(username) &&
    settings.get("bans").get(username)?.expiration) ??
  -1 <= Date.now();

for await (const message of kickMs.queue) {
  try {
    messageIndex = (messageIndex + 1) % (1e9 + 7);
    let segmentIndex = 0;

    const { username, tokens, isSub } = message;

    if (isBanned(username)) {
      continue;
    }

    const parser = new MessageParser();

    const output = parser
      .parse(tokens)
      .filter((output) => authorizer.isAuthorized(username, output.type));

    messageMap.set(messageIndex, {
      size: output.reduce((acc, e) => {
        return (
          acc +
          Number(
            (e.type === MessageType.TTS || e.type === MessageType.bit) &&
              !!e.message
          )
        );
      }, 0),
      entries: [],
    });

    for (const segment of output) {
      if (!rateLimiter.canRequest(username)) {
        continue;
      }

      if (settings.get("subOnly") && !isSub) {
        continue;
      }

      rateLimiter.addRequest(username);

      switch (segment.type) {
        case MessageType.TTS:
          if (segment.message) {
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
          }
          break;

        case MessageType.bit:
          if (segment.message) {
            bitsClient.enqueue(segment.message, { segmentIndex, messageIndex });
          }
          break;

        case MessageType.skip:
          holler.skip();
          videoClient.skip();
          imageClient.skip();
          break;

        case MessageType.refresh:
          window.location.reload();
          break;
        case MessageType.config:
          const { key, value } = segment;

          if (settings.isValidKey(key)) {
            settings.setFromString(key, value);
          }

          settings.saveToLocalStorage();

          break;

        case MessageType.clearConfig:
          // full clear from cfg
          localStorage.clear();

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
                volume: settings.get("videoVolume"),
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

        case MessageType.vidVol: {
          const { value } = segment;
          settings.set("videoVolume", value);
          settings.saveToLocalStorage();

          break;
        }

        case MessageType.addBit: {
          const {
            value: { key, value, vol },
          } = segment;
          settings.get("bits").set(key, { url: value, vol: vol ?? 1.0 });
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
          settings.get("admins").add(value.toLowerCase());
          settings.saveToLocalStorage();
          break;
        }

        case MessageType.removeAdmin: {
          const { value } = segment;
          settings.get("admins").delete(value.toLowerCase());
          settings.saveToLocalStorage();
          break;
        }

        case MessageType.addSuperAdmin: {
          const { value } = segment;
          settings.get("superadmins").add(value.toLowerCase());
          settings.saveToLocalStorage();
          break;
        }

        case MessageType.removeSuperAdmin: {
          const { value } = segment;
          settings.get("superadmins").delete(value.toLowerCase());
          settings.saveToLocalStorage();
          break;
        }

        case MessageType.ban: {
          let { value, expiration } = segment;

          const user = authorizer.whoami(username);
          const target = authorizer.whoami(value);

          // prevent admins from banning each other
          if (target === Roles.Admin && user !== Roles.SuperAdmin) {
            continue;
          }

          expiration ??= -1;

          if (expiration !== -1) {
            expiration += Date.now();
          }

          settings.get("bans").set(value.toLowerCase(), { expiration });
          settings.saveToLocalStorage();
          break;
        }
        case MessageType.unban: {
          const { value } = segment;
          settings.get("bans").delete(value);
          settings.saveToLocalStorage();
          break;
        }

        case MessageType.image: {
          const { url } = segment;

          const matches = url.match(imageRegex);

          if (matches) {
            imageClient.enqueue({
              matches,
              duration: 5000,
              messageIndex: 0,
              segmentIndex: 0,
            });
          }

          break;
        }

        case MessageType.addVoice: {
          const { key, voiceName, platform, codeOrModel } = segment;
          let newVoice: GCloudVoice | NeetsVoice | FishVoice;

          if (platform === "gcloud" || platform === "fish") {
            newVoice = { voiceName, code: codeOrModel, platform };
          } else {
            newVoice = { voiceName, model: codeOrModel, platform };
          }

          settings.get("voices").set(key, newVoice);
          settings.saveToLocalStorage();
          break;
        }

        case MessageType.removeVoice: {
          const { key } = segment;
          settings.get("voices").delete(key);
          settings.saveToLocalStorage();
          break;
        }
        case MessageType.addLimit: {
          const { username, requests, period } = segment;
          rateLimiter.setRecord(username.toLowerCase(), { requests, period });
          settings.get("rateLimits").set(username, { requests, period });
          settings.saveToLocalStorage();
          break;
        }
        case MessageType.removeLimit: {
          const { username } = segment;
          rateLimiter.removeRecord(username.toLowerCase());
          settings.get("rateLimits").delete(username);
          settings.saveToLocalStorage();
          break;
        }
        case MessageType.subonly: {
          const currentSubOnly = settings.get("subOnly") ?? false;
          settings.set("subOnly", !currentSubOnly);
          settings.saveToLocalStorage();
          break;
        }
        case MessageType.code: {
          const { content } = segment;

          const res = await fetch(`${authUrl}/token`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ code: content }),
          });

          if (res.ok) {
            const data = await res.json();
            const accessToken = data.token.access_token;
            const refreshToken = data.token.refresh_token;

            settings.set("authToken", accessToken);
            settings.set("refreshToken", refreshToken);
            settings.saveToLocalStorage();
          }

          break;
        }
        default:
          break;
      }

      segmentIndex++;
    }
  } catch (error) {
    console.error("Error processing message: ", error);
  }
}
