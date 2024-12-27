import * as esbuild from "esbuild";
import { globSync } from "glob";
import path from "path";

globSync("src/lambda/**/index.ts").forEach(async (file) => {
  const input = path.relative(
    "src",
    file.slice(0, file.length - path.extname(file).length - 5)
  );

  const output = "dist/" + input + ".js";

  await esbuild.build({
    platform: "node",
    entryPoints: [file],
    bundle: true,
    outfile: output,
  });
});
