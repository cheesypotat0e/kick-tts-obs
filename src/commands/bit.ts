import { Command, OutputMessage, OutputType } from "../message-parser";

export class BitCommand implements Command {
  triggers: string[] = ["!b", "!bit"];

  output(tokens: string[]): OutputMessage[] {
    return tokens.map((token) => this.processBit(token));
  }

  processBit(token: string): OutputMessage {
    return {
      type: OutputType.BIT,
      output: token,
    };
  }
}
