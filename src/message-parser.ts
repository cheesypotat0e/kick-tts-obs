export enum MessageType {
  unknown,
  TTS,
  bit,
  config,
  skip,
  clearConfig,
  video,
  vol,
  bitVol,
  addBit,
  removeBit,
  addAdmin,
  removeAdmin,
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

type MessageParseVideoOutput = {
  type: MessageType.video;
  url: string;
};

type MessageParseVolumeOutput = {
  type: MessageType.vol | MessageType.bitVol;
  value: number;
};

type MessageParseAddBitOutput = {
  type: MessageType.addBit;
  value: {
    key: string;
    value: string;
  };
};

type MessageParseRemoveBitOutput = {
  type: MessageType.removeBit;
  value: string;
};

type MessageParseAdminOutput = {
  type: MessageType.addAdmin | MessageType.removeAdmin;
  value: string;
};

type MessageParseState =
  | "idle"
  | "TTS"
  | "bit"
  | "config"
  | "video"
  | "volume"
  | "addbit"
  | "removebit"
  | "addadmin"
  | "removeadmin";

type MessageParseHandler = (token: string) => void;
type MessageParseTransitionHandler = (newState: MessageParseState) => void;

type MessageParseBufferState = {
  voice?: string;
};

export class MessageParse {
  private state: MessageParseState;
  private cmdState: Record<string, any>;
  private buffer: string[] = [];
  private output: (
    | MessageParseOutput
    | MessageParseConfigOutput
    | MessageParseVideoOutput
    | MessageParseVolumeOutput
    | MessageParseAddBitOutput
    | MessageParseRemoveBitOutput
    | MessageParseAdminOutput
  )[] = [];

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
    "!yt": "video",
    "!st": "video",
    "!v": "volume",
    "!vb": "volume",
    "!addbit": "addbit",
    "!removebit": "removebit",
    "!addadmin": "addadmin",
    "!removeadmin": "removeadmin",
  };

  private events: Record<string, MessageParseHandler>;

  private transitions: Record<MessageParseState, MessageParseTransitionHandler>;

  private handlers: Record<MessageParseState, MessageParseHandler>;

  constructor() {
    this.state = "idle";
    this.cmdState = {};

    this.handleTTS = this.handleTTS.bind(this);
    this.flushTTS = this.flushTTS.bind(this);
    this.handleBits = this.handleBits.bind(this);
    this.skip = this.skip.bind(this);
    this.handleConfig = this.handleConfig.bind(this);
    this.refresh = this.refresh.bind(this);
    this.cfgClear = this.cfgClear.bind(this);
    this.handleVideo = this.handleVideo.bind(this);
    this.handleVol = this.handleVol.bind(this);
    this.handleAddBit = this.handleAddBit.bind(this);
    this.handleRemoveBit = this.handleRemoveBit.bind(this);
    this.handleRemoveAdmin = this.handleRemoveAdmin.bind(this);
    this.handleAddAdmin = this.handleAddAdmin.bind(this);

    this.handlers = {
      TTS: this.handleTTS,
      bit: this.handleBits,
      config: this.handleConfig,
      video: this.handleVideo,
      volume: this.handleVol,
      addbit: this.handleAddBit,
      removebit: this.handleRemoveBit,
      addadmin: this.handleAddAdmin,
      removeadmin: this.handleRemoveAdmin,
      idle: () => {},
    };

    this.transitions = {
      idle: (state: MessageParseState) => {},
      TTS: (state: MessageParseState) => {
        this.flushTTS();
      },
      bit: (state: MessageParseState) => {
        this.flushBits();
      },
      config: (state: MessageParseState) => {
        this.flushConfig();
      },
      video: (state: MessageParseState) => {
        this.flushVideo();
      },
      volume: (state: MessageParseState) => {
        this.flushVolume();
      },
      addbit: (state: MessageParseState) => {
        this.flushAddBit();
      },
      removebit: (state: MessageParseState) => {
        this.flushRemoveBit();
      },
      addadmin: (state: MessageParseState) => {
        this.flushAdmin();
      },
      removeadmin: (state: MessageParseState) => {
        this.flushAdmin();
      },
    };

    this.events = {
      "!skip": this.skip,
      "!refresh": this.refresh,
      "!cfgclear": this.cfgClear,
    };
  }

  private transition(state: MessageParseState) {
    if (this.state !== state) {
      this.transitions[this.state](state);

      this.state = state;

      this.cmdState = {};
    }
  }

  public parse(
    tokens: string[]
  ): (
    | MessageParseOutput
    | MessageParseConfigOutput
    | MessageParseVideoOutput
    | MessageParseVolumeOutput
    | MessageParseAddBitOutput
    | MessageParseRemoveBitOutput
    | MessageParseAdminOutput
  )[] {
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

      this.transition(newState);

      this.cmdState = { cmd: token };
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

  private handleVideo(token: string) {
    this.collectToken(token);
  }

  private handleVol(token: string) {
    this.collectToken(token);
    if (this.buffer.length == 1) {
      this.transition("idle");
    }
  }

  private handleAddBit(token: string) {
    this.collectToken(token);
    if (this.buffer.length === 2) {
      this.transition("idle");
    }
  }

  private handleRemoveBit(token: string) {
    this.collectToken(token);
    if (this.buffer.length === 1) {
      this.transition("idle");
    }
  }

  private handleAddAdmin(token: string) {
    this.collectToken(token);
    this.transition("idle");
  }

  private handleRemoveAdmin(token: string) {
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

    this.emptyBuffer();
  }

  private flushVideo() {
    if (this.buffer.length) {
      for (const url of this.buffer) {
        this.output.push({
          type: MessageType.video,
          url,
        });
      }
    }

    this.emptyBuffer();
  }

  private flushVolume() {
    if (this.buffer.length) {
      const value = Number(this.buffer[0]);

      if (!Number.isNaN(value)) {
        this.output.push({
          type:
            this.cmdState.cmd === "!v" ? MessageType.vol : MessageType.bitVol,
          value,
        });
      }
    }

    this.emptyBuffer();
  }

  private flushAddBit() {
    if (this.buffer.length == 2) {
      const key = this.buffer[0];
      const value = this.buffer[1];

      this.output.push({
        type: MessageType.addBit,
        value: {
          key,
          value,
        },
      });
    }

    this.emptyBuffer();
  }

  private flushRemoveBit() {
    if (this.buffer.length === 1) {
      const key = this.buffer[0];

      this.output.push({
        type: MessageType.removeBit,
        value: key,
      });
    }

    this.emptyBuffer();
  }

  private flushAdmin() {
    if (this.buffer.length) {
      const type =
        this.state === "addadmin"
          ? MessageType.addAdmin
          : MessageType.removeAdmin;

      for (const value of this.buffer) {
        this.output.push({
          type,
          value,
        });
      }
    }

    this.emptyBuffer();
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

      case "video":
        this.flushVideo();
        break;

      case "volume":
        this.flushVolume();
        break;

      default:
        break;
    }

    this.emptyBuffer();

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
