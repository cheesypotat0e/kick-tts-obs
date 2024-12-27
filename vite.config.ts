import path from "path";
import { fileURLToPath } from "url";
import { UserConfig } from "vite";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export default {
  build: {
    target: "esnext",
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "src/main.ts"),
      },
      output: {
        dir: "dist/frontend",
        format: "es",
        entryFileNames: "[name].js",
      },
    },
  },
} satisfies UserConfig;
