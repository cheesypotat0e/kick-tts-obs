export enum MessageType {
  unknown,
  TTS,
  bit,
  config,
  skip,
  clearConfig,
}

type MessageParseOutput = {
  type:
    | MessageType.TTS
    | MessageType.bit
    | MessageType.skip
    | MessageType.clearConfig;
  message: string;
  voice?: string;
};

type MessageParseConfigOutput = {
  type: MessageType.config;
  name: string;
  args: string;
};

type MessageParseState = "idle" | "TTS" | "bit" | "config";

type MessageParseHandler = (token: string) => void;
type MessageParseTransitionHandler = (newState: MessageParseState) => void;

type MessageParseBufferState = {
  voice?: string;
};

export class MessageParse {
  private state: MessageParseState;
  private buffer: string[] = [];
  private output: (MessageParseOutput | MessageParseConfigOutput)[] = [];

  private bufferState: MessageParseBufferState = {
    voice: undefined,
  };

  private triggers: Record<string, MessageParseState> = {
    "!s": "TTS",
    "!bit": "bit",
    "!skip": "idle",
    "!cfg": "config",
    "!refresh": "idle",
    "!cfgclear": "idle",
  };

  private events: Record<string, MessageParseHandler>;

  private transitions: Record<MessageParseState, MessageParseTransitionHandler>;

  private handlers: Record<MessageParseState, MessageParseHandler>;

  constructor() {
    this.state = "idle";

    this.handleTTS = this.handleTTS.bind(this);
    this.flushTTS = this.flushTTS.bind(this);
    this.handleBits = this.handleBits.bind(this);
    this.skip = this.skip.bind(this);
    this.handleConfig = this.handleConfig.bind(this);
    this.refresh = this.refresh.bind(this);
    this.cfgClear = this.cfgClear.bind(this);

    this.handlers = {
      TTS: this.handleTTS,
      bit: this.handleBits,
      config: this.handleConfig,
      idle: () => {},
    };

    this.transitions = {
      idle: (_: MessageParseState) => {},
      TTS: (_: MessageParseState) => {
        this.flushTTS();
      },
      bit: (_: MessageParseState) => {
        this.flushBits();
      },
      config: (_: MessageParseState) => {
        this.flushConfig();
      },
    };

    this.events = {
      "!skip": this.skip,
      "!refresh": this.refresh,
      "!cfgclear": this.cfgClear,
    };
  }

  public parse(
    tokens: string[]
  ): (MessageParseOutput | MessageParseConfigOutput)[] {
    // const tokens = input.split(/\s+/);

    for (const token of tokens) {
      this.processToken(token);
    }

    return this.flushOutput();
  }

  private handleCommand(token: string) {
    if (token.startsWith("!")) {
      // trigger event
      this.events[token]?.(token);

      const newState = this.triggers[token] ?? this.state;

      if (newState !== this.state) {
        this.transitions[this.state](newState);
        this.state = newState;
      }
    }
  }

  private handleTTS(token: string) {
    if (token.endsWith(":")) {
      this.flushTTS();
      this.bufferState.voice = token.slice(0, -1);
    } else {
      this.collectToken(token);
    }
  }

  private handleBits(token: string) {
    this.collectToken(token);
  }

  private handleConfig(token: string) {
    this.collectToken(token);
  }

  private flushTTS() {
    if (this.buffer.length) {
      this.output.push({
        type: MessageType.TTS,
        message: this.buffer.join(" "),
        voice: this.bufferState.voice,
      });
    }

    this.emptyBuffer();
  }

  private flushBits() {
    if (this.buffer.length) {
      this.output.push(
        ...this.buffer.map<MessageParseOutput>((value) => ({
          type: MessageType.bit,
          message: value,
        }))
      );
    }

    this.emptyBuffer();
  }

  private flushConfig() {
    if (this.buffer.length > 1) {
      for (const [name, arg] of this.pair(this.buffer)) {
        this.output.push({
          type: MessageType.config,
          name,
          args: arg,
        });
      }
    }
  }

  private skip(_: string) {
    this.output.push({ type: MessageType.skip, message: "" });
  }

  private refresh(_: string) {
    window.location.reload();
  }

  private cfgClear(_: string) {
    this.output.push({ type: MessageType.clearConfig, message: "" });
  }

  private emptyBuffer() {
    this.buffer.length = 0;
  }

  private flushOutput() {
    switch (this.state) {
      case "TTS":
        this.flushTTS();
        break;

      case "bit":
        this.flushBits();
        break;

      case "config":
        this.flushConfig();
        break;

      default:
        break;
    }

    return this.output;
  }

  private *pair(strings: string[]) {
    for (let i = 0; i < strings.length - 1; i += 2) {
      yield [strings[i], strings[i + 1]];
    }
  }

  private processToken(token: string): void {
    if (token.startsWith("!")) {
      this.handleCommand(token);
    } else {
      const handler = this.handlers[this.state];

      handler(token);
    }
  }

  private collectToken(token: string): void {
    this.buffer.push(token);
  }
}
