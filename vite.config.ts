import type { UserConfig } from "vite";

export default {
  server: { host: true },
  build: { target: "esnext" },
  base: "/kick-tts-obs/",
} satisfies UserConfig;
