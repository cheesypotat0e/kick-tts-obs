import type { UserConfig } from "vite";

export default {
  server: { host: true },
  build: {
    target: "esnext",
    rollupOptions: {
      input: {
        main: "index.html",
        login: "login.html",
      },
    },
  },
  base: "/kick-tts-obs/",
} satisfies UserConfig;
