import { Command, OutputMessage, OutputType } from "../message-parser";

export class IdleCommand implements Command {
  triggers: string[] = [];

  output(tokens: string[]): OutputMessage[] {
    if (tokens.length === 0) {
      return [];
    }

    return [
      {
        type: OutputType.IDLE,
        output: tokens.join(" "),
      },
    ];
  }
}
