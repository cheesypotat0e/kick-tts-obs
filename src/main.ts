import { TTSClient } from "./ttsClient.js";

const client = new TTSClient({ roomID: "88774" });

console.log(client);

client.start();
