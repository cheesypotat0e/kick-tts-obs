import { Command, OutputMessage, OutputType } from "../message-parser";

export type SkipMessage = {
  type: "all" | "tts" | "bit" | "video" | "image";
};

export class SkipCommand implements Command {
  triggers = ["!skip"];

  output(tokens: string[]): OutputMessage[] {
    if (tokens.length == 0) {
      return [
        {
          type: OutputType.SKIP,
          output: "all",
        },
      ];
    }

    return tokens.map((token) => {
      return {
        type: OutputType.SKIP,
        output: token,
      };
    });
  }
}
