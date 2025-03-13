import { Command, OutputMessage, OutputType } from "../message-parser";

export class RefreshCommand implements Command {
  triggers = ["!refresh"];

  output(_: string[]): OutputMessage[] {
    return [{ type: OutputType.REFRESH, output: {} }];
  }
}
