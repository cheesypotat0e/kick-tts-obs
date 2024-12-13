export type FishVoice = {
  voiceName: string;
  code: string;
  platform: "fish";
};

export const fishVoices: Record<string, FishVoice> = {
  dobbin: {
    voiceName: "dobbin",
    code: "c834a3a0a91044249ace1e220a52a2dc",
    platform: "fish",
  },
  baba: {
    voiceName: "baba",
    code: "fab595cc9bce4ca4938b5c6aa0693f99",
    platform: "fish",
  },
  wyanot: {
    voiceName: "wyanot",
    code: "3677f5d2d80240fa97e5237c3a19a06f",
    platform: "fish",
  },
};
