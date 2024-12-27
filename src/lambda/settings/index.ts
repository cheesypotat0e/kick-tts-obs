import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Handler,
} from "aws-lambda";
import {
  BatchGetItemCommand,
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { Settings } from "../../settings";
import joi from "joi";
import { v4 } from "uuid";
import { GCloudVoice } from "../../gcloud-voices";
import { NeetsVoice } from "../../neets-voices";
import { FishVoice } from "../../fish-voices";
import { Bit } from "../bits";
import { Voice } from "../voices";

const settingsTableName = process.env.SETTINGS_TABLE_NAME;
const bitsTableName = process.env.BITS_TABLE_NAME;
const voicesTableName = process.env.VOICES_TABLE_NAME;

if (!settingsTableName || !bitsTableName || !voicesTableName) {
  throw new Error("Table names are missing from environment variables.");
}

// Define the Joi schema for Settings
export type ApiSettings = {
  roomId: string;
  admins: string[];
  superadmins: string[];
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
  bits: Record<string, string>;
  videoVolume: number;
  voices: Record<string, string>;
  voiceVolumes: Record<string, number>;
  bans: Record<string, { expiration?: number }>;
  rateLimits: Record<string, { period: number; requests: number }>;
};

export type GetSettingApi = {
  id: string;
  roomId: string;
  admins: string[];
  superadmins: string[];
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
  bits: Record<string, { url: string; vol: number }>;
  videoVolume: number;
  voices: Record<string, GCloudVoice | NeetsVoice | FishVoice>;
  voiceVolumes: Record<string, number>;
  bans: Record<string, { expiration?: number }>;
  rateLimits: Record<string, { period: number; requests: number }>;
};

export type SettingsApiError = {
  message: string;
};

const settingsSchema = joi
  .object({
    roomId: joi.string().required(),
    admins: joi.array().items(joi.string()).required(),
    superadmins: joi.array().items(joi.string()).required(),
    ttsVolume: joi.number().min(0).max(1).required(),
    ttsSpeed: joi.number().min(0).max(1).required(),
    ttsVoice: joi.string().required(),
    bitsVolume: joi.number().min(0).max(1).required(),
    bitsRate: joi.number().min(0).max(1).required(),
    timeout: joi.number().integer().min(0).required(),
    clusterID: joi.string().required(),
    version: joi.string().required(),
    journeyFunctionName: joi.string().required(),
    journeyProjectName: joi.string().required(),
    bits: joi.object().required().pattern(/.*/, joi.string()),
    videoVolume: joi.number().min(0).max(1).required(),
    voices: joi.object().required().pattern(/.*/, joi.string()),
    voiceVolumes: joi
      .object()
      .required()
      .pattern(/.*/, joi.number().min(0).max(1).required()),
    bans: joi
      .object()
      .required()
      .pattern(/.*/, joi.object({ expiration: joi.number() })),
    rateLimits: joi
      .object()
      .required()
      .pattern(
        /.*/,
        joi.object({
          period: joi.number().integer().min(0).required(),
          requests: joi.number().integer().min(0).required(),
        })
      ),
  })
  .unknown(false); //This will reject any unknown keys

export const handler: Handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.debug("EVENT: ", event);

  const httpMethod = event.httpMethod;
  const client = new DynamoDBClient();

  if (httpMethod === "GET") {
    let id;
    const params = event.pathParameters;

    if (params?.id) {
      id = params.id;
    } else {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "missing id parameter" }),
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
      };
    }

    const cmd = new GetItemCommand({
      TableName: settingsTableName,
      Key: marshall({ id }),
    });

    try {
      const res = await client.send(cmd);
      const item = res.Item;
      if (!item) {
        return {
          statusCode: 404,
          body: JSON.stringify({ message: "settings not found" }),
          headers: {
            "Access-Control-Allow-Origin": "*",
          },
        };
      }

      const settings = unmarshall(item) as ApiSettings;

      const bits: GetSettingApi["bits"] = {};

      const bitResults = await getItems<Bit>(
        Object.values(settings.bits).map((id) => ({ id })),
        bitsTableName,
        client
      );

      for (const bit of bitResults) {
        bits[bit.name] = { url: bit.url, vol: bit.vol };
      }

      const voices: GetSettingApi["voices"] = {};

      console.time("Voices");

      const voiceResults = await getItems<Voice>(
        Object.values(settings.voices).map((id) => ({ id })),
        voicesTableName,
        client
      );

      console.timeEnd("Voices");

      for (const voice of voiceResults) {
        if (voice) {
          const item = voice;
          if (item.platform === "gcloud") {
            const { code, voiceId, platform } = item;
            voices[item.voiceName] = { code, voiceName: voiceId, platform };
          } else if (item.platform === "neets") {
            const { voiceId, model, platform } = item;
            voices[item.voiceName] = { voiceName: voiceId, model, platform };
          } else if (item.platform === "fish") {
            const { voiceName, code, platform } = item;
            voices[item.voiceName] = { voiceName, code, platform };
          }
        }
      }

      const settingsRes: GetSettingApi = {
        id,
        ...settings,
        voices,
        bits,
      };

      return {
        statusCode: 200,
        body: JSON.stringify({ settings: settingsRes }),
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
      };
    } catch (error) {
      console.error("Error getting settings:", error);
      return {
        statusCode: 500,
        body: JSON.stringify({ message: "Internal Server Error" }),
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
      };
    }
  } else if (httpMethod === "POST") {
    if (!event.body) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "missing body" }),
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
      };
    }

    try {
      const settings: Settings = JSON.parse(event.body);

      const { error } = settingsSchema.validate(settings);

      if (error) {
        return {
          statusCode: 400,
          body: JSON.stringify({
            message: `Invalid settings: ${error.message}`,
          }),
          headers: {
            "Access-Control-Allow-Origin": "*",
          },
        };
      }

      const id = v4();

      const params = {
        TableName: settingsTableName,
        Item: marshall({ id, ...settings }),
      };

      await client.send(new PutItemCommand(params));
      return {
        statusCode: 201,
        body: JSON.stringify({ id }),
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
      };
    } catch (error) {
      console.error("Error creating settings:", error);
      return {
        statusCode: 500,
        body: JSON.stringify({ message: "Internal Server Error" }),
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
      };
    }
  } else {
    return {
      statusCode: 405,
      body: JSON.stringify({ message: "Method Not Allowed" }),
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
    };
  }
};

const getItems = async <T>(
  keys: Record<string, any>[],
  tableName: string,
  client: DynamoDBClient
): Promise<T[]> => {
  const commands = [];
  for (let i = 0; i < keys.length; i += 100) {
    commands.push(
      new BatchGetItemCommand({
        RequestItems: {
          [tableName]: {
            Keys: keys.slice(i, i + 100).map((key) => marshall(key)),
          },
        },
      })
    );
  }
  const results = (
    await Promise.all(commands.map((cmd) => client.send(cmd)))
  ).flatMap((res) => res.Responses?.[tableName] || []);
  return results.map((res) => unmarshall(res)) as T[];
};
