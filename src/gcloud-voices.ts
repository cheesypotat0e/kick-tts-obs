export type GCloudVoice = {
  voiceName: string;
  code: string;
  platform: "gcloud";
};

// TODO: create a job that automates populating this
export const gcloudVoices: Record<string, GCloudVoice> = {
  arabic: {
    voiceName: "ar-XA-Wavenet-B",
    code: "ar-XA",
    platform: "gcloud",
  },
  "arabic-female": {
    voiceName: "ar-XA-Wavenet-A",
    code: "ar-XA",
    platform: "gcloud",
  },
  bengali: {
    voiceName: "bn-IN-Wavenet-A",
    code: "bn-IN",
    platform: "gcloud",
  },
  "bengali-female": {
    voiceName: "bn-IN-Wavenet-B",
    code: "bn-IN",
    platform: "gcloud",
  },
  czech: {
    voiceName: "cs-CZ-Wavenet-A",
    code: "cs-CZ",
    platform: "gcloud",
  },
  "czech-female": {
    voiceName: "cs-CZ-Wavenet-B",
    code: "cs-CZ",
    platform: "gcloud",
  },
  danish: {
    voiceName: "da-DK-Wavenet-A",
    code: "da-DK",
    platform: "gcloud",
  },
  "danish-female": {
    voiceName: "da-DK-Wavenet-C",
    code: "da-DK",
    platform: "gcloud",
  },
  dutch: {
    voiceName: "nl-NL-Wavenet-A",
    code: "nl-NL",
    platform: "gcloud",
  },
  "dutch-female": {
    voiceName: "nl-NL-Wavenet-C",
    code: "nl-NL",
    platform: "gcloud",
  },
  english: {
    voiceName: "en-US-Journey-D",
    code: "en-US",
    platform: "gcloud",
  },
  "english-female": {
    voiceName: "en-US-Journey-F",
    code: "en-US",
    platform: "gcloud",
  },
  "english-australia": {
    voiceName: "en-AU-Journey-D",
    code: "en-AU",
    platform: "gcloud",
  },
  "english-australia-female": {
    voiceName: "en-AU-Journey-F",
    code: "en-AU",
    platform: "gcloud",
  },
  indian: {
    voiceName: "en-IN-Journey-D",
    code: "en-IN",
    platform: "gcloud",
  },
  "indian-female": {
    voiceName: "en-IN-Journey-F",
    code: "en-IN",
    platform: "gcloud",
  },
  british: {
    voiceName: "en-GB-Journey-D",
    code: "en-GB",
    platform: "gcloud",
  },
  "british-female": {
    voiceName: "en-GB-Journey-F",
    code: "en-GB",
    platform: "gcloud",
  },
  filipino: {
    voiceName: "fil-PH-Wavenet-A",
    code: "fil-PH",
    platform: "gcloud",
  },
  "filipino-female": {
    voiceName: "fil-PH-Wavenet-C",
    code: "fil-PH",
    platform: "gcloud",
  },
  finnish: {
    voiceName: "fi-FI-Wavenet-A",
    code: "fi-FI",
    platform: "gcloud",
  },
  "finnish-female": {
    voiceName: "fi-FI-Wavenet-C",
    code: "fi-FI",
    platform: "gcloud",
  },
  "french-fr": {
    voiceName: "fr-FR-Journey-D",
    code: "fr-FR",
    platform: "gcloud",
  },
  "french-fr-female": {
    voiceName: "fr-FR-Journey-F",
    code: "fr-FR",
    platform: "gcloud",
  },
  french: {
    voiceName: "fr-CA-Journey-D",
    code: "fr-CA",
    platform: "gcloud",
  },
  "french-female": {
    voiceName: "fr-CA-Wavenet-A",
    code: "fr-CA",
    platform: "gcloud",
  },
  german: {
    voiceName: "de-DE-Journey-D",
    code: "de-DE",
    platform: "gcloud",
  },
  "german-female": {
    voiceName: "de-DE-Journey-F",
    code: "de-DE",
    platform: "gcloud",
  },
  greek: {
    voiceName: "el-GR-Wavenet-A",
    code: "el-GR",
    platform: "gcloud",
  },
  "greek-female": {
    voiceName: "el-GR-Wavenet-C",
    code: "el-GR",
    platform: "gcloud",
  },
  gujarati: {
    voiceName: "gu-IN-Wavenet-A",
    code: "gu-IN",
    platform: "gcloud",
  },
  "gujarati-female": {
    voiceName: "gu-IN-Wavenet-B",
    code: "gu-IN",
    platform: "gcloud",
  },
  hindi: {
    voiceName: "hi-IN-Wavenet-A",
    code: "hi-IN",
    platform: "gcloud",
  },
  "hindi-female": {
    voiceName: "hi-IN-Wavenet-B",
    code: "hi-IN",
    platform: "gcloud",
  },
  hungarian: {
    voiceName: "hu-HU-Wavenet-A",
    code: "hu-HU",
    platform: "gcloud",
  },
  "hungarian-female": {
    voiceName: "hu-HU-Wavenet-C",
    code: "hu-HU",
    platform: "gcloud",
  },
  indonesian: {
    voiceName: "id-ID-Wavenet-B",
    code: "id-ID",
    platform: "gcloud",
  },
  "indonesian-female": {
    voiceName: "id-ID-Wavenet-A",
    code: "id-ID",
    platform: "gcloud",
  },
  italian: {
    voiceName: "it-IT-Journey-D",
    code: "it-IT",
    platform: "gcloud",
  },
  "italian-female": {
    voiceName: "it-IT-Journey-F",
    code: "it-IT",
    platform: "gcloud",
  },
  japanese: {
    voiceName: "ja-JP-Neural2-B",
    code: "ja-JP",
    platform: "gcloud",
  },
  "japanese-female": {
    voiceName: "ja-JP-Neural2-A",
    code: "ja-JP",
    platform: "gcloud",
  },
  kannada: {
    voiceName: "kn-IN-Wavenet-A",
    code: "kn-IN",
    platform: "gcloud",
  },
  "kannada-female": {
    voiceName: "kn-IN-Wavenet-B",
    code: "kn-IN",
    platform: "gcloud",
  },
  korean: {
    voiceName: "ko-KR-Neural2-C",
    code: "ko-KR",
    platform: "gcloud",
  },
  "korean-female": {
    voiceName: "ko-KR-Neural2-A",
    code: "ko-KR",
    platform: "gcloud",
  },
  malayalam: {
    voiceName: "ml-IN-Wavenet-A",
    code: "ml-IN",
    platform: "gcloud",
  },
  "malayalam-female": {
    voiceName: "ml-IN-Wavenet-B",
    code: "ml-IN",
    platform: "gcloud",
  },
  chinese: {
    voiceName: "cmn-CN-Wavenet-A",
    code: "cmn-CN",
    platform: "gcloud",
  },
  "chinese-female": {
    voiceName: "cmn-CN-Wavenet-B",
    code: "cmn-CN",
    platform: "gcloud",
  },
  marathi: {
    voiceName: "mr-IN-Wavenet-A",
    code: "mr-IN",
    platform: "gcloud",
  },
  "marathi-female": {
    voiceName: "mr-IN-Wavenet-B",
    code: "mr-IN",
    platform: "gcloud",
  },
  norwegian: {
    voiceName: "nb-NO-Wavenet-A",
    code: "nb-NO",
    platform: "gcloud",
  },
  "norwegian-female": {
    voiceName: "nb-NO-Wavenet-C",
    code: "nb-NO",
    platform: "gcloud",
  },
  polish: {
    voiceName: "pl-PL-Wavenet-B",
    code: "pl-PL",
    platform: "gcloud",
  },
  "polish-female": {
    voiceName: "pl-PL-Wavenet-A",
    code: "pl-PL",
    platform: "gcloud",
  },
  portuguese: {
    voiceName: "pt-BR-Neural2-B",
    code: "pt-BR",
    platform: "gcloud",
  },
  "portuguese-female": {
    voiceName: "pt-BR-Neural2-A",
    code: "pt-BR",
    platform: "gcloud",
  },
  "portuguese-portugal": {
    voiceName: "pt-PT-Wavenet-A",
    code: "pt-PT",
    platform: "gcloud",
  },
  "portuguese-portugal-female": {
    voiceName: "pt-PT-Wavenet-C",
    code: "pt-PT",
    platform: "gcloud",
  },
  romanian: {
    voiceName: "ro-RO-Wavenet-A",
    code: "ro-RO",
    platform: "gcloud",
  },
  "romanian-female": {
    voiceName: "ro-RO-Wavenet-B",
    code: "ro-RO",
    platform: "gcloud",
  },
  russian: {
    voiceName: "ru-RU-Wavenet-D",
    code: "ru-RU",
    platform: "gcloud",
  },
  "russian-female": {
    voiceName: "ru-RU-Wavenet-A",
    code: "ru-RU",
    platform: "gcloud",
  },
  slovak: {
    voiceName: "sk-SK-Wavenet-A",
    code: "sk-SK",
    platform: "gcloud",
  },
  "slovak-female": {
    voiceName: "sk-SK-Wavenet-B",
    code: "sk-SK",
    platform: "gcloud",
  },
  "spanish-spain": {
    voiceName: "es-ES-Journey-D",
    code: "es-ES",
    platform: "gcloud",
  },
  "spanish-spain-female": {
    voiceName: "es-ES-Journey-F",
    code: "es-ES",
    platform: "gcloud",
  },
  spanish: {
    voiceName: "es-US-Journey-D",
    code: "es-US",
    platform: "gcloud",
  },
  "spanish-female": {
    voiceName: "es-US-Journey-F",
    code: "es-US",
    platform: "gcloud",
  },
  swedish: {
    voiceName: "sv-SE-Wavenet-A",
    code: "sv-SE",
    platform: "gcloud",
  },
  "swedish-female": {
    voiceName: "sv-SE-Wavenet-C",
    code: "sv-SE",
    platform: "gcloud",
  },
  tamil: {
    voiceName: "ta-IN-Wavenet-A",
    code: "ta-IN",
    platform: "gcloud",
  },
  "tamil-female": {
    voiceName: "ta-IN-Wavenet-B",
    code: "ta-IN",
    platform: "gcloud",
  },
  telugu: {
    voiceName: "te-IN-Wavenet-A",
    code: "te-IN",
    platform: "gcloud",
  },
  "telugu-female": {
    voiceName: "te-IN-Wavenet-B",
    code: "te-IN",
    platform: "gcloud",
  },
  thai: {
    voiceName: "th-TH-Wavenet-A",
    code: "th-TH",
    platform: "gcloud",
  },
  "thai-female": {
    voiceName: "th-TH-Wavenet-B",
    code: "th-TH",
    platform: "gcloud",
  },
  turkish: {
    voiceName: "tr-TR-Wavenet-A",
    code: "tr-TR",
    platform: "gcloud",
  },
  "turkish-female": {
    voiceName: "tr-TR-Wavenet-C",
    code: "tr-TR",
    platform: "gcloud",
  },
  ukrainian: {
    voiceName: "uk-UA-Wavenet-A",
    code: "uk-UA",
    platform: "gcloud",
  },
  "ukrainian-female": {
    voiceName: "uk-UA-Wavenet-B",
    code: "uk-UA",
    platform: "gcloud",
  },
  vietnamese: {
    voiceName: "vi-VN-Wavenet-A",
    code: "vi-VN",
    platform: "gcloud",
  },
  "vietnamese-female": {
    voiceName: "vi-VN-Wavenet-C",
    code: "vi-VN",
    platform: "gcloud",
  },
};
