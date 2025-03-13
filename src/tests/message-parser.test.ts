import { describe, expect, it } from "@jest/globals";
import { MessageParser, OutputType } from "../message-parser";
import { TTSCommand } from "../commands/tts";
import { BitCommand } from "../commands/bit";
import { SkipCommand } from "../commands/skip";
import { VideoCommand } from "../commands/video";
import { ImageCommand } from "../commands/image";
import { RefreshCommand } from "../commands/refresh";

describe("MessageParser", () => {
  describe("idle", () => {
    it("should parse a simple message", () => {
      const parser = new MessageParser();
      const result = parser.parseMessage("hello world");
      expect(result).toEqual([
        {
          type: OutputType.IDLE,
          output: "hello world",
        },
      ]);
    });

    it("should handle empty messages", () => {
      const parser = new MessageParser();
      const result = parser.parseMessage("");
      expect(result).toEqual([]);
    });

    it("should handle messages with multiple spaces", () => {
      const parser = new MessageParser();
      const result = parser.parseMessage("hello   world");
      expect(result).toEqual([
        {
          type: OutputType.IDLE,
          output: "hello world",
        },
      ]);
    });
  });

  describe("tts", () => {
    it("should parse a simple message", () => {
      const parser = new MessageParser();
      parser.addCommand(new TTSCommand());
      const result = parser.parseMessage("!s hello world");
      expect(result).toEqual([
        {
          type: OutputType.TTS,
          output: {
            voice: undefined,
            message: "hello world",
          },
        },
      ]);
    });

    it("should parse with multiple triggers", () => {
      const parser = new MessageParser();
      const tts = new TTSCommand();
      tts.triggers = ["!s", "!tts"];
      parser.addCommand(tts);
      const result = parser.parseMessage("!s hello world !tts hello world");
      expect(result).toEqual([
        {
          type: OutputType.TTS,
          output: {
            voice: undefined,
            message: "hello world",
          },
        },
        {
          type: OutputType.TTS,
          output: {
            voice: undefined,
            message: "hello world",
          },
        },
      ]);
    });

    it("should parse a messages with a voice", () => {
      const parser = new MessageParser();

      parser.addCommand(new TTSCommand());

      const result = parser.parseMessage("!s Brian: hello world");

      expect(result).toEqual([
        {
          type: OutputType.TTS,
          output: {
            voice: "brian",
            message: "hello world",
          },
        },
      ]);
    });

    it("should parse a message with and without a voice", () => {
      const parser = new MessageParser();
      parser.addCommand(new TTSCommand());
      const result = parser.parseMessage("!s hello world? Brian: hello world!");
      expect(result).toEqual([
        {
          type: OutputType.TTS,
          output: {
            voice: undefined,
            message: "hello world?",
          },
        },
        {
          type: OutputType.TTS,
          output: {
            voice: "brian",
            message: "hello world!",
          },
        },
      ]);

      const rest = parser.parseMessage(
        "!s Brian: hello world! !s hello world!"
      );

      expect(rest).toEqual([
        {
          type: OutputType.TTS,
          output: {
            voice: "brian",
            message: "hello world!",
          },
        },
        {
          type: OutputType.TTS,
          output: {
            voice: undefined,
            message: "hello world!",
          },
        },
      ]);
    });

    it("should parses a message with multiple voices", () => {
      const parser = new MessageParser();
      parser.addCommand(new TTSCommand());
      const result = parser.parseMessage(
        "!s Brian: hello world! Amy: hello world! !s what is going on? Brian: I don't know"
      );
      expect(result).toEqual([
        {
          type: OutputType.TTS,
          output: {
            voice: "brian",
            message: "hello world!",
          },
        },
        {
          type: OutputType.TTS,
          output: {
            voice: "amy",
            message: "hello world!",
          },
        },
        {
          type: OutputType.TTS,
          output: {
            voice: undefined,
            message: "what is going on?",
          },
        },
        {
          type: OutputType.TTS,
          output: {
            voice: "brian",
            message: "I don't know",
          },
        },
      ]);
    });
  });

  describe("bit", () => {
    it("should parse a simple message", () => {
      const parser = new MessageParser();
      parser.addCommand(new BitCommand());
      const result = parser.parseMessage("!b hello world");

      expect(result).toEqual([
        {
          type: OutputType.BIT,
          output: "hello",
        },
        {
          type: OutputType.BIT,
          output: "world",
        },
      ]);
    });
  });

  describe("skip", () => {
    it("should parse a simple message", () => {
      const parser = new MessageParser();
      parser.addCommand(new SkipCommand());
      const result = parser.parseMessage("!skip");
      expect(result).toEqual([{ type: OutputType.SKIP, output: "all" }]);
    });

    it("should parse a message with multiple skip commands", () => {
      const parser = new MessageParser();
      parser.addCommand(new SkipCommand());
      const result = parser.parseMessage("!skip tts bits");
      expect(result).toEqual([
        { type: OutputType.SKIP, output: "tts" },
        { type: OutputType.SKIP, output: "bits" },
      ]);
    });
  });

  describe("video", () => {
    it("should parse a simple message", () => {
      const parser = new MessageParser();
      parser.addCommand(new VideoCommand());
      const result = parser.parseMessage("!vid https://example.com");
      expect(result).toEqual([
        { type: OutputType.VIDEO, output: { url: "https://example.com" } },
      ]);
    });
  });

  describe("image", () => {
    it("should parse a simple message", () => {
      const parser = new MessageParser();
      parser.addCommand(new ImageCommand());
      const result = parser.parseMessage("!img https://example.com");
      expect(result).toEqual([
        { type: OutputType.IMAGE, output: { url: "https://example.com" } },
      ]);
    });
  });

  describe("refresh", () => {
    it("should parse a simple message", () => {
      const parser = new MessageParser();
      parser.addCommand(new RefreshCommand());
      const result = parser.parseMessage("!refresh");
      expect(result).toEqual([{ type: OutputType.REFRESH, output: {} }]);
    });
  });

  describe("multiple commands", () => {
    it("should parse a message with multiple commands", () => {
      const parser = new MessageParser();
      parser.addCommand(new TTSCommand());
      parser.addCommand(new BitCommand());

      const result = parser.parseMessage("!s hello world !b follow");

      expect(result).toEqual([
        {
          type: OutputType.TTS,
          output: {
            voice: undefined,
            message: "hello world",
          },
        },
        {
          type: OutputType.BIT,
          output: "follow",
        },
      ]);

      const result2 = parser.parseMessage(
        "!s brian: hello world amy: hello world !b follow !s hello world"
      );

      expect(result2).toEqual([
        {
          type: OutputType.TTS,
          output: {
            voice: "brian",
            message: "hello world",
          },
        },
        {
          type: OutputType.TTS,
          output: {
            voice: "amy",
            message: "hello world",
          },
        },
        {
          type: OutputType.BIT,
          output: "follow",
        },
        {
          type: OutputType.TTS,
          output: {
            voice: undefined,
            message: "hello world",
          },
        },
      ]);
    });

    it("should parse bits commands with extract bits", () => {
      const parser = new MessageParser();
      parser.addCommand(new TTSCommand({ extractBits: true }));
      parser.addCommand(new BitCommand());

      const result = parser.parseMessage("!s hello world (follow) hello world");

      expect(result).toEqual([
        {
          type: OutputType.TTS,
          output: {
            voice: undefined,
            message: "hello world",
          },
        },
        {
          type: OutputType.BIT,
          output: "follow",
        },
        {
          type: OutputType.TTS,
          output: {
            voice: undefined,
            message: "hello world",
          },
        },
      ]);
    });
  });
});
