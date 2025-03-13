import { IdleCommand } from "./commands/idle";

export interface Command {
  triggers: string[];
  output(tokens: string[]): OutputMessage[];
}

export enum OutputType {
  IDLE = "idle",
  COMMAND = "command",
  TTS = "tts",
  BIT = "bit",
  SKIP = "skip",
  REFRESH = "refresh",
  VIDEO = "video",
  IMAGE = "image",
}

export interface OutputMessage {
  type: OutputType;
  output: any;
}

export class MessageParser {
  private commands: Command[] = [];

  addCommand(command: Command) {
    this.commands.push(command);
  }

  private findCommandByTrigger(token: string): Command | null {
    return this.commands.find((cmd) => cmd.triggers.includes(token)) || null;
  }

  private processCurrentCommand(
    currentCommand: Command,
    currentTokens: string[]
  ) {
    return currentCommand.output(currentTokens);
  }

  parseMessage(input: string): OutputMessage[] {
    const tokens = input.split(" ").filter((token) => token.trim() !== "");
    const outputs: OutputMessage[] = [];

    let currentCommand: Command = new IdleCommand();
    let currentTokens: string[] = [];

    for (const token of tokens) {
      const command = this.findCommandByTrigger(token);
      if (command) {
        outputs.push(
          ...this.processCurrentCommand(currentCommand, currentTokens)
        );

        currentCommand = command;
        currentTokens = [];
      } else {
        currentTokens.push(token);
      }
    }

    if (currentCommand) {
      outputs.push(
        ...this.processCurrentCommand(currentCommand, currentTokens)
      );
    }

    return outputs;
  }
}
