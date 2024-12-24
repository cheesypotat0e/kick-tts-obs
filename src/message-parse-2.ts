type StateHandler = {
  onEnter?: (token: string) => void;
  onExit?: () => void;
  onToken: (token: string) => void;
  shouldTransition?: (
    buffer: (string | number | TTSSegment | ConfigSegment | AddBitSegment)[]
  ) => {
    shouldChange: boolean;
    nextState: MessageParseState;
  };
  outputTransform?: (
    buffer: (string | number | TTSSegment | ConfigSegment | AddBitSegment)[]
  ) => MessageParseOutput[];
  flushOnExit: boolean;
  shouldHandleTrigger?: boolean;
};

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
  vidVol,
  addBit,
  removeBit,
  addAdmin,
  removeAdmin,
  refresh,
  image,
  addVoice,
  removeVoice,
  ban,
  unban,
  addLimit,
  removeLimit,
}

export type BaseMessageOutput = {
  type: MessageType;
};

export type MessageParseTTSOutput = BaseMessageOutput & {
  type: MessageType.TTS;
  message: string;
  voice?: string;
};

export type MessageParseBitOutput = BaseMessageOutput & {
  type: MessageType.bit;
  message: string;
};

export type MessageParseSkipOutput = BaseMessageOutput & {
  type: MessageType.skip;
};

export type MessageParseRefreshOutput = BaseMessageOutput & {
  type: MessageType.refresh;
};

export type MessageParseClearConfigOutput = BaseMessageOutput & {
  type: MessageType.clearConfig;
};

export type MessageParseConfigOutput = BaseMessageOutput & {
  type: MessageType.config;
  key: string;
  value: string;
};

export type MessageParseVideoOutput = BaseMessageOutput & {
  type: MessageType.video;
  url: string;
};

export type MessageParseVolumeOutput = BaseMessageOutput & {
  type: MessageType.vol | MessageType.bitVol | MessageType.vidVol;
  value: number;
};

export type MessageParseAddBitOutput = BaseMessageOutput & {
  type: MessageType.addBit;
  value: {
    key: string;
    value: string;
    vol?: number;
  };
};

export type MessageParseRemoveBitOutput = BaseMessageOutput & {
  type: MessageType.removeBit;
  value: string;
};

export type MessageParseAdminOutput = BaseMessageOutput & {
  type: MessageType.addAdmin | MessageType.removeAdmin;
  value: string;
};

export type MessageParseBanOutput = BaseMessageOutput & {
  type: MessageType.ban;
  value: string;
  expiration?: number;
};

export type MessageParseUnbanOutput = BaseMessageOutput & {
  type: MessageType.unban;
  value: string;
};

export type MessageParseImageOutput = BaseMessageOutput & {
  type: MessageType.image;
  url: string;
};

export type MessageParseAddVoiceOutput = BaseMessageOutput & {
  type: MessageType.addVoice;
  key: string;
  voiceName: string;
  platform: "neets" | "gcloud" | "fish";
  codeOrModel: string;
};

export type MessageParseRemoveVoiceOutput = BaseMessageOutput & {
  type: MessageType.removeVoice;
  key: string;
};

export type MessageParseAddLimitOutput = BaseMessageOutput & {
  type: MessageType.addLimit;
  username: string;
  period: number;
  requests: number;
};

export type MessageParseRemoveLimitOutput = BaseMessageOutput & {
  type: MessageType.removeLimit;
  username: string;
};

export type MessageParseOutput =
  | MessageParseTTSOutput
  | MessageParseBitOutput
  | MessageParseSkipOutput
  | MessageParseClearConfigOutput
  | MessageParseConfigOutput
  | MessageParseVideoOutput
  | MessageParseVolumeOutput
  | MessageParseAddBitOutput
  | MessageParseRemoveBitOutput
  | MessageParseAdminOutput
  | MessageParseRefreshOutput
  | MessageParseImageOutput
  | MessageParseAddVoiceOutput
  | MessageParseRemoveVoiceOutput
  | MessageParseBanOutput
  | MessageParseUnbanOutput
  | MessageParseAddLimitOutput
  | MessageParseRemoveLimitOutput;

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
  | "removeadmin"
  | "image"
  | "addvoice"
  | "removevoice"
  | "ban"
  | "unban"
  | "addlimit"
  | "removelimit";

export type TTSSegment = {
  text: string[];
  voice?: string;
  volume?: number;
};

export type ConfigSegment = {
  key: string;
  value?: string;
};

export type AddBitSegment = {
  key: string;
  value?: string;
  vol?: number;
};

const cleanText = (text: string): string => {
  const emoteRegex = /\[emote:(\d+):([^\]]+)\]/g;
  return text.replace(emoteRegex, "").trim();
};

export class MessageParser {
  private currentState: MessageParseState = "idle";
  private buffer: (
    | string
    | number
    | TTSSegment
    | ConfigSegment
    | AddBitSegment
  )[] = [];
  private output: MessageParseOutput[] = [];

  private states: Record<MessageParseState, StateHandler> = {
    idle: {
      onToken: (token: string) => {
        if (token === "!refresh") {
          this.buffer.push(MessageType.refresh);
        }

        if (token === "!skip") {
          this.buffer.push(MessageType.skip);
        }

        if (token === "!cfgclear") {
          this.buffer.push(MessageType.clearConfig);
        }
      },
      outputTransform: (buffer: typeof this.buffer) => {
        const tokens = buffer as number[];
        return tokens.map((token) => {
          return {
            type: token,
          };
        });
      },
      flushOnExit: true,
      shouldHandleTrigger: true,
    },
    TTS: {
      onToken: (token: string) => {
        if (this.buffer.length === 0) {
          this.buffer.push({ text: [] });
        }

        const lastSegment = this.buffer[this.buffer.length - 1] as TTSSegment;

        if (token.endsWith(":")) {
          const voice = token.slice(0, -1);

          this.buffer.push({ text: [], voice });
        } else {
          lastSegment.text.push(token);
        }
      },
      outputTransform: (buffer: typeof this.buffer) => {
        const segments = buffer as TTSSegment[];

        return segments.map((segment) => ({
          type: MessageType.TTS,
          message: segment.text.map(cleanText).join(" "),
          voice: segment.voice,
        }));
      },
      flushOnExit: true,
    },
    bit: {
      onToken: (token) => {
        this.buffer.push(token);
      },
      outputTransform: (buffer: typeof this.buffer) => {
        const bits = buffer as string[];

        return bits.map((bit) => ({
          type: MessageType.bit,
          message: bit,
        }));
      },
      flushOnExit: true,
    },
    config: {
      onToken: (token: string) => {
        const buffer = this.buffer as ConfigSegment[];

        if (
          this.buffer.length === 0 ||
          (this.buffer[this.buffer.length - 1] as ConfigSegment).value
        ) {
          buffer.push({ key: token });
        } else {
          const last = buffer[buffer.length - 1];
          last.value = token;
        }
      },
      outputTransform: (buffer: typeof this.buffer) => {
        const configs = buffer as ConfigSegment[];

        return configs
          .filter((config) => config.value)
          .map((config) => ({
            type: MessageType.config,
            key: config.key,
            value: config.value!,
          }));
      },
      flushOnExit: true,
    },
    video: {
      onToken: (token: string) => {
        this.buffer.push(token);
      },
      outputTransform: (buffer: typeof this.buffer) => {
        const videos = buffer as string[];
        return videos.map((video) => ({
          type: MessageType.video,
          url: video,
        }));
      },
      flushOnExit: true,
    },
    volume: {
      onToken: (token: string) => {
        this.buffer.push(token);
      },
      shouldTransition: (buffer: typeof this.buffer) => {
        return { shouldChange: buffer.length === 1, nextState: "idle" };
      },
      outputTransform: (buffer: typeof this.buffer) => {
        const volumes = buffer as string[];
        return volumes
          .filter((volume) => !Number.isNaN(parseFloat(volume)))
          .map((volume) => ({
            type:
              this.currentTrigger === "!vb"
                ? MessageType.bitVol
                : this.currentTrigger === "!vv"
                ? MessageType.vidVol
                : MessageType.vol,
            value: parseFloat(volume),
          }));
      },
      flushOnExit: true,
    },
    addbit: {
      onToken: (token: string) => {
        const buffer = this.buffer as AddBitSegment[];
        if (buffer.length === 0 || buffer[buffer.length - 1].value) {
          if (!Number.isNaN(parseFloat(token))) {
            buffer[buffer.length - 1].vol = parseFloat(token);
          } else {
            buffer.push({ key: token });
          }
        } else {
          const last = buffer[buffer.length - 1];
          last.value = token;
        }
      },
      outputTransform: (buffer: typeof this.buffer) => {
        const addBits = buffer as AddBitSegment[];
        return addBits
          .filter((addBit) => addBit.value)
          .map((addBit) => ({
            type: MessageType.addBit,
            value: {
              key: addBit.key,
              value: addBit.value!,
              vol: addBit.vol,
            },
          }));
      },
      flushOnExit: true,
    },
    removebit: {
      onToken: (token: string) => {
        this.buffer.push(token);
      },
      outputTransform: (buffer: typeof this.buffer) => {
        const removeBits = buffer as string[];
        return removeBits.map((removeBit) => ({
          type: MessageType.removeBit,
          value: removeBit,
        }));
      },
      flushOnExit: true,
    },
    addadmin: {
      onToken: (token: string) => {
        this.buffer.push(token);
      },
      outputTransform: (buffer: typeof this.buffer) => {
        const addAdmins = buffer as string[];
        return addAdmins.map((addAdmin) => ({
          type: MessageType.addAdmin,
          value: addAdmin,
        }));
      },
      flushOnExit: true,
    },
    removeadmin: {
      onToken: (token: string) => {
        this.buffer.push(token);
      },
      outputTransform: (buffer: typeof this.buffer) => {
        const removeAdmins = buffer as string[];
        return removeAdmins.map((removeAdmin) => ({
          type: MessageType.removeAdmin,
          value: removeAdmin,
        }));
      },
      flushOnExit: true,
    },
    ban: {
      onToken: (token: string) => {
        this.buffer.push(token);
      },
      outputTransform: (buffer: typeof this.buffer) => {
        const n = buffer.length;
        const output: MessageParseBanOutput[] = [];

        for (let i = 0; i < n; i++) {
          const curr: MessageParseBanOutput = {
            type: MessageType.ban,
            value: "",
            expiration: -1,
          };

          curr.value = buffer[i] as string;

          if (i < n - 1 && !isNaN(Number(buffer[i + 1]))) {
            curr.expiration = Date.now() + parseInt(buffer[i + 1] as string);
            i++;
          }

          output.push(curr);
        }

        return output;
      },
      flushOnExit: true,
    },
    unban: {
      onToken: (token: string) => {
        this.buffer.push(token);
      },
      outputTransform: (buffer: typeof this.buffer) => {
        const unbannedUsers = buffer as string[];
        return unbannedUsers.map((user) => ({
          type: MessageType.unban,
          value: user,
        }));
      },
      flushOnExit: true,
    },
    image: {
      onToken: (token: string) => {
        if (
          token.match(/^https:\/\/i\.imgur\.com\/[a-zA-Z0-9]+\.(jpg|jpeg|png)$/)
        ) {
          this.buffer.push(token);
        }
      },
      outputTransform: (buffer: typeof this.buffer) => {
        const images = buffer as string[];
        return images.map((image) => ({
          type: MessageType.image,
          url: image,
        }));
      },
      flushOnExit: true,
    },
    addvoice: {
      onToken: (token: string) => {
        const buffer = this.buffer as any[]; //Type is not important here
        buffer.push(token);
      },
      shouldTransition: (buffer: typeof this.buffer) => {
        return { shouldChange: buffer.length === 4, nextState: "idle" };
      },
      outputTransform: (buffer: typeof this.buffer) => {
        const [key, voiceName, platform, codeOrModel] = buffer as string[];
        return [
          {
            type: MessageType.addVoice,
            key,
            voiceName,
            platform: platform as "neets" | "gcloud" | "fish",
            codeOrModel,
          },
        ];
      },
      flushOnExit: true,
    },
    removevoice: {
      onToken: (token: string) => {
        this.buffer.push(token);
      },
      shouldTransition: (buffer: typeof this.buffer) => {
        return { shouldChange: buffer.length === 1, nextState: "idle" };
      },
      outputTransform: (buffer: typeof this.buffer) => {
        const [key] = buffer as string[];
        return [
          {
            type: MessageType.removeVoice,
            key,
          },
        ];
      },
      flushOnExit: true,
    },
    addlimit: {
      onToken: (token: string) => {
        this.buffer.push(token);
      },
      shouldTransition: (buffer: typeof this.buffer) => {
        return { shouldChange: buffer.length === 3, nextState: "idle" };
      },
      outputTransform: (buffer: typeof this.buffer) => {
        if (buffer.length < 3) {
          return [];
        }

        const [username, requests, period] = buffer as string[];
        return [
          {
            type: MessageType.addLimit,
            username,
            period: parseInt(period),
            requests: parseInt(requests),
          },
        ];
      },
      flushOnExit: true,
    },
    removelimit: {
      onToken: (token: string) => {
        this.buffer.push(token);
      },
      shouldTransition: (buffer: typeof this.buffer) => {
        return { shouldChange: buffer.length === 1, nextState: "idle" };
      },
      outputTransform: (buffer: typeof this.buffer) => {
        if (buffer.length < 1) {
          return [];
        }

        const [username] = buffer as string[];
        return [
          {
            type: MessageType.removeLimit,
            username,
          },
        ];
      },
      flushOnExit: true,
    },
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
    "!vv": "volume",
    "!addbit": "addbit",
    "!removebit": "removebit",
    "!addadmin": "addadmin",
    "!removeadmin": "removeadmin",
    "!img": "image",
    "!addvoice": "addvoice",
    "!removevoice": "removevoice",
    "!ban": "ban",
    "!unban": "unban",
    "!addlimit": "addlimit",
    "!removelimit": "removelimit",
  };

  private currentTrigger: string = "";

  public parse(tokens: string[]): MessageParseOutput[] {
    tokens.forEach((token) => this.processToken(token));
    this.flushBuffer();
    return this.output;
  }

  private isTrigger(token: string): boolean {
    return token in this.triggers;
  }

  private processToken(token: string): void {
    if (this.isTrigger(token)) {
      this.currentTrigger = token;
      this.handleStateTransition(token);

      if (this.states[this.currentState].shouldHandleTrigger) {
        this.states[this.currentState].onToken(token);
      }
    } else {
      this.states[this.currentState].onToken(token);

      const shouldTransition = this.states[this.currentState].shouldTransition;

      if (shouldTransition && shouldTransition(this.buffer).shouldChange) {
        this.transition(
          token,
          this.states[this.currentState].shouldTransition!(this.buffer)
            .nextState
        );
      }
    }
  }

  private handleStateTransition(trigger: string): void {
    const newState = this.triggers[trigger];
    if (newState) {
      this.transition(trigger, newState);
    }
  }

  private transition(token: string, newState: MessageParseState): void {
    this.states[this.currentState].onExit?.();
    if (this.states[this.currentState].flushOnExit) {
      this.flushBuffer();
    }

    this.currentState = newState;
    this.states[newState].onEnter?.(token);
  }

  private flushBuffer(): void {
    if (this.buffer.length === 0) return;

    const transform = this.states[this.currentState].outputTransform;
    if (transform) {
      this.output.push(...transform(this.buffer));
    }
    this.buffer = [];
  }
}
