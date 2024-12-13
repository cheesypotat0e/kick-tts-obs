export type FishVoice = {
  voiceName: string;
  code: string;
  platform: "fish";
};

export const fishVoices: Record<string, FishVoice> = {
  dobbin: {
    voiceName: "dobbin",
    code: "a141b907243a45caaab4103915e4ea81",
    platform: "fish",
  },
};
