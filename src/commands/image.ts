import { OutputType } from "../message-parser";
import { OutputMessage } from "../message-parser";
import { Command } from "../message-parser";

export type ImageMessage = {
  type: OutputType.IMAGE;
  output: {
    url: string;
  };
};

export class ImageCommand implements Command {
  triggers = ["!img", "!image"];

  output(tokens: string[]): OutputMessage[] {
    return tokens.map((token) => ({
      type: OutputType.IMAGE,
      output: { url: token },
    }));
  }
}
