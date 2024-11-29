import type { UserConfig } from "vite";

export default {
  build: { target: "esnext" },
  base: "/kick-tts-obs/",
} satisfies UserConfig;
