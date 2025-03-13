import { Command, OutputMessage, OutputType } from "../message-parser";

export type VideoMessage = {
  type: OutputType.VIDEO;
  output: {
    url: string;
  };
};

export class VideoCommand implements Command {
  triggers = ["!st", "!yt", "!vid"];

  output(tokens: string[]): OutputMessage[] {
    return tokens.map((token) => {
      return {
        type: OutputType.VIDEO,
        output: {
          url: token,
        },
      };
    });
  }
}
