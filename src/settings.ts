import { FishVoice } from "./fish-voices";
import { GCloudVoice } from "./gcloud-voices";
import { NeetsVoice } from "./neets-voices";

declare global {
  interface Map<K, V> {
    toJSON(): Record<K & string, V>;
  }

  interface Set<T> {
    toJSON(): T[];
  }
}

Map.prototype.toJSON = function () {
  return Object.fromEntries(this);
};

Set.prototype.toJSON = function () {
  return Array.from(this);
};

export type Settings = {
  roomId: string;
  admins: Set<string>;
  superadmins: Set<string>;
  ttsVolume: number;
  ttsSpeed: number;
  ttsVoice: string;
  bitsVolume: number;
  bitsRate: number;
  timeout: number;
  clusterID: string;
  version: string;
  journeyFunctionName: string;
  journeyProjectName: string;
  bits: Map<string, { url: string; vol: number }>;
  videoVolume: number;

  voices: Map<string, GCloudVoice | NeetsVoice | FishVoice>;
  voiceVolumes: Map<string, number>;
};

export class SettingsStore {
  private static baseKey = "twitch-kick-tts-obs-settings";

  private settings: Settings = {
    roomId: "",
    admins: new Set<string>(),
    superadmins: new Set<string>(["cheesypotatoe"]),
    ttsVolume: 1.0,
    ttsSpeed: 1.0,
    ttsVoice: "Brian",
    bitsVolume: 1.0,
    bitsRate: 1.0,
    timeout: 2000,
    clusterID: "32cbd69e4b950bf97679",
    version: "8.4.0-rc2",
    journeyFunctionName: "",
    journeyProjectName: "",
    videoVolume: 1.0,
    voices: new Map<string, GCloudVoice | NeetsVoice>([]),
    voiceVolumes: new Map<string, number>(),
    bits: new Map([
      [
        "follow",
        {
          url: "https://www.myinstants.com/media/sounds/short_sms_wcluqam.mp3",
          vol: 1.0,
        },
      ],
      [
        "fart",
        {
          url: "https://www.myinstants.com/media/sounds/dry-fart.mp3",
          vol: 1.0,
        },
      ],
      [
        "pluh",
        {
          url: "https://www.myinstants.com/media/sounds/pluh.mp3",
          vol: 1.0,
        },
      ],

      [
        "boom",
        {
          url: "https://www.myinstants.com/media/sounds/vine-boom.mp3",
          vol: 1.0,
        },
      ],
      [
        "discord",
        {
          url: "https://www.myinstants.com/media/sounds/discord-notification.mp3",
          vol: 1.0,
        },
      ],
    ]),
  };

  private conversionMap: Record<
    "string" | "number" | "set" | "map",
    (val: string) => Settings[keyof Settings]
  > = {
    string: (val: string) => val,
    number: this.convertToNumber,
    map: (val: string) => new Map<string, any>(Object.entries(JSON.parse(val))),
    set: this.convertToSet,
  };

  private static instance: SettingsStore;

  private constructor() {}

  public static getInstance(): SettingsStore {
    if (!SettingsStore.instance) {
      SettingsStore.instance = new SettingsStore();
    }

    return SettingsStore.instance;
  }

  public set<Key extends keyof Settings>(key: Key, value: Settings[Key]): void {
    this.settings[key] = value;
  }

  public get<Key extends keyof Settings>(key: Key): Settings[Key] {
    return this.settings[key];
  }

  public has<Key extends keyof Settings>(key: Key): boolean {
    return !!this.settings[key];
  }

  public isValidKey(key: string): key is keyof Settings {
    return key in this.settings;
  }

  private convertToNumber(val: string): number {
    const num = Number(val);

    if (Number.isNaN(num)) {
      console.error("val is not a number: ", val);
      return 0.0;
    }

    return num;
  }

  private convertToSet(val: string) {
    return new Set<string>(val.split(","));
  }

  public print() {
    console.log(this.settings);
  }

  private getValueType(key: keyof Settings) {
    const value = this.settings[key];

    return this.getType(value);
  }

  private getType(value: Settings[keyof Settings]) {
    if (value instanceof Set) {
      return "set";
    }

    if (value instanceof Map) {
      return "map";
    }

    if (typeof value === "number") {
      return "number";
    }

    return "string";
  }

  private assertType<Key extends keyof Settings>(
    key: Key,
    converted: Settings[keyof Settings]
  ): converted is Settings[Key] {
    const type = this.getType(converted);
    const valueType = this.getValueType(key);

    return type === valueType;
  }

  public setFromString<Key extends keyof Settings>(key: Key, value: string) {
    if (this.isValidKey(key)) {
      const valueType = this.getValueType(key);

      const convert = this.conversionMap[valueType];

      const converted = convert(value);

      if (this.assertType(key, converted)) {
        this.set(key, converted);
      }
    }
  }

  public upsertWithParams(params: Iterable<[string, string]>) {
    for (const [key, value] of params) {
      if (this.isValidKey(key)) {
        this.setFromString(key, value);
      }
    }
  }

  public upsertFromLocalStorage() {
    const localStorageSettings = localStorage.getItem(
      this.getLocalStorageKey()
    );

    if (!localStorageSettings) {
      return;
    }

    const settings = JSON.parse(localStorageSettings);

    // migrate legacy bits
    if (settings.bits) {
      for (const [key, value] of Object.entries(settings.bits)) {
        if (typeof value === "string") {
          settings.bits[key] = { url: value, vol: 1.0 };
        }
      }
    }

    for (const [key, value] of Object.entries<Settings[keyof Settings]>(
      settings
    )) {
      if (this.isValidKey(key)) {
        if (this.assertType(key, value)) {
          this.set(key, value);
        }
      }
    }
  }

  public saveToLocalStorage() {
    const json = JSON.stringify(this.settings);

    localStorage.setItem(this.getLocalStorageKey(), json);
  }

  public clearFromLocalStorage() {
    localStorage.removeItem(this.getLocalStorageKey());
  }

  private getLocalStorageKey() {
    return `${SettingsStore.baseKey}-${this.settings.roomId}`;
  }
}
