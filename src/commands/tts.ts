import { Command, OutputType } from "../message-parser";
import { BitCommand } from "./bit";

export type TTSMessage = {
  type: OutputType.TTS;
  output: {
    voice?: string;
    message: string;
  };
};

type TTSCommandOptions = {
  extractBits?: boolean;
  bitsCommand?: BitCommand;
};

export class TTSCommand implements Command {
  triggers: string[] = ["!s"];

  options: TTSCommandOptions;

  constructor(opt: TTSCommandOptions = {}) {
    this.options = opt;
  }

  private ttsMessages: TTSMessage[] = [];

  private get currentMessage(): TTSMessage | undefined {
    const lastMessage = this.ttsMessages[this.ttsMessages.length - 1];

    if (!lastMessage) {
      return undefined;
    }

    if (lastMessage.type === OutputType.TTS) {
      return lastMessage;
    }

    return undefined;
  }

  private createNewMessage(token: string, voice?: string): TTSMessage {
    return {
      type: OutputType.TTS,
      output: {
        voice,
        message: token,
      },
    };
  }

  private addMessage(message: TTSMessage, messages: TTSMessage[]) {
    messages.push(message);
    this.ttsMessages.push(message);
  }

  private addToken(token: string, messages: TTSMessage[]) {
    if (this.currentMessage) {
      this.currentMessage.output.message += this.currentMessage.output.message
        ? ` ${token}`
        : token;
    } else {
      this.addMessage(this.createNewMessage(token), messages);
    }
  }

  private isVoiceModifier(token: string): boolean {
    return token.endsWith(":") && token.length > 1;
  }

  private isBitsCommand(token: string): boolean {
    return /\([a-zA-Z0-9]+\)/.test(token);
  }

  private extractBit(token: string): string {
    return token.match(/\(([a-zA-Z0-9]+)\)/)![1];
  }

  private getVoice(token: string): string {
    return token.slice(0, -1).toLowerCase();
  }

  output(tokens: string[]): TTSMessage[] {
    const messages: TTSMessage[] = [];

    for (const token of tokens) {
      if (this.isVoiceModifier(token)) {
        const voice = this.getVoice(token);

        const newMessage = this.createNewMessage("", voice);

        this.addMessage(newMessage, messages);
      } else if (this.isBitsCommand(token) && this.options.extractBits) {
        const bit = this.extractBit(token);

        this.addMessage(
          {
            type: OutputType.BIT,
            output: bit,
          } as unknown as TTSMessage,
          messages
        );
      } else {
        this.addToken(token, messages);
      }
    }

    this.ttsMessages = [];

    return messages;
  }
}
