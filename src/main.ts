import { Authorizer, Roles } from "./auth.js";
import { BitsClient } from "./bitsClient.js";
import { GCloudVoice } from "./gcloud-voices.js";
import { Holler, MessageMap } from "./holler.js";
import { KickMessenger } from "./kick-messenger.js";
import { imageRegex, MessageParser, MessageType } from "./message-parse-2.js";
import { NeetsVoice } from "./neets-voices.js";
import { Settings, SettingsAPIClient, SettingsStore } from "./settings.js";
import { TTSClient } from "./ttsClient.js";
import { VideoClient } from "./video-client.js";
import { ImageClient } from "./image-client.js";
import { FishVoice } from "./fish-voices.js";
import { RateLimiter } from "./rate-limit.js";
import { KickApiClient } from "./kick-api-client.js";
import { WsClient } from "./ws-client.js";

const url = new URL(window.location.href);

const params = url.searchParams;

const settings = SettingsStore.getInstance();

const imgurClientID = import.meta.env.VITE_API_IMGUR_CLIENT_ID;
const authUrl = import.meta.env.VITE_AUTH_URL;
const oauthUrl = import.meta.env.VITE_OAUTH_URL;
const kickApiUrl = import.meta.env.VITE_KICK_API_URL;
const apiServiceURL = import.meta.env.VITE_API_URL;

try {
  const audio = new Audio(
    "https://www.myinstants.com/media/sounds/playstation-2-startup-noise.mp3"
  );
  audio.play();

  const code = params.get("code");

  if (!code) {
    throw new Error("No code provided");
  }

  const settingsClient = new SettingsAPIClient<Settings>(apiServiceURL, code);

  await settingsClient.getSettings();

  const r = await fetch(`${authUrl}/auth`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${code}`,
    },
  });

  const { user_id, name, ws_service_url } = await r.json();

  const rr = await fetch(`${authUrl}/ws/auth`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${code}`,
    },
  });

  const rrr = await fetch(`${kickApiUrl}/${name}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  const { id: roomId } = await rrr.json();

  const { token } = await rr.json();

  settings.set("wsAuthToken", token);

  settings.set("wsServiceUrl", ws_service_url);

  await settingsClient.setSettings({
    roomId: roomId,
    clusterID: settings.get("clusterID"),
    version: settings.get("version"),
    subOnly: settings.get("subOnly"),
    userId: user_id,
    name: name,
  });

  const newSettings = await settingsClient.getSettings();

  if (!newSettings) {
    throw new Error("Failed to get settings");
  }

  settings.set("roomId", newSettings.roomId);
  settings.set("clusterID", newSettings.clusterID);
  settings.set("version", newSettings.version);
  settings.set("subOnly", newSettings.subOnly);
  settings.set("userId", newSettings.userId);
  settings.set("name", newSettings.name);

  settings.set("authServiceUrl", authUrl);
  settings.set("oauthServiceUrl", oauthUrl);
  settings.set("kickApiUrl", kickApiUrl);
  settings.set("apiServiceUrl", apiServiceURL);

  if (!imgurClientID) {
    throw new Error(
      "missing imgur client ID get it here: https://api.imgur.com/oauth2/addclient"
    );
  }

  const allVoices: any[] = [];
  let cursor: string | null = null;
  let hasMore = true;

  while (hasMore) {
    const url: string = cursor
      ? `${apiServiceURL}/voices?cursor=${cursor}`
      : `${apiServiceURL}/voices`;

    const voicesRes = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
      },
    });

    const voicesData = await voicesRes.json();

    if (!voicesData.voices || !Array.isArray(voicesData.voices)) {
      console.warn("Unexpected voices data:", voicesData);
      hasMore = false;
      break;
    }

    allVoices.push(...voicesData.voices);

    cursor = voicesData.next_cursor || null;
    hasMore = cursor !== null;
  }

  const voices = settings.get("voices");
  for (const voice of allVoices) {
    voices.set(voice.name.toLowerCase(), voice);
  }

  const roomsID = settings.get("roomId");

  if (!settings.has("roomId")) {
    // recovery mode
    settings.set("roomId", "88774");
    throw new Error("Room ID is missing");
  }

  settings.saveToLocalStorage();

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

  const kickApiClient = new KickApiClient(settings);

  const wsServiceUrl = settings.get("wsServiceUrl");
  const wsAuthToken = settings.get("wsAuthToken");

  const ws = new WsClient(`${wsServiceUrl}/ws/${roomsID}`, wsAuthToken);

  ws.onOpen(async () => {
    holler.enqueue({
      data: Promise.resolve("https://www.myinstants.com/media/sounds/bep.mp3"),
      options: {
        volume: 0.5,
        html5: true,
        rate: 1,
      },
      messageIndex: 0,
      segmentIndex: 0,
    });
  });

  ws.onMessage(async (message) => {
    try {
      const data = JSON.parse(message);

      if (data.type === "bot-message") {
        await kickApiClient.sendMessage(data.message);
      }
    } catch (error) {
      console.error("Error processing message: ", error);
    }
  });

  ws.start();

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
              bitsClient.enqueue(segment.message, {
                segmentIndex,
                messageIndex,
              });
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
          case MessageType.send: {
            const { content } = segment;
            await kickApiClient.sendMessage(content);
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
} catch (error) {
  console.error("Error: ", error);

  const audio = new Audio(
    "https://www.myinstants.com/media/sounds/error-notification.mp3"
  );
  audio.play();
}
