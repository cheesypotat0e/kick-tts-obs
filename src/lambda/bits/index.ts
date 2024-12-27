import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Handler,
} from "aws-lambda";
import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { v4 } from "uuid";
import joi from "joi";

const tableName = process.env.BITS_TABLE_NAME;

export type Bit = {
  name: string;
  url: string;
  vol: number;
};

export type GetBitResponse = {
  bit: Bit;
};

export type PostBitRequest = {
  name: string;
  url: string;
  vol: number;
};

export type PostBitResponse = {
  message: string;
  id: string;
};

const bitSchema = joi
  .object({
    name: joi.string().required(),
    url: joi.string().uri().required(),
    vol: joi.number().min(0).max(1).required(),
  })
  .unknown(false);

const makeResponse = (
  statusCode: number,
  body: object
): APIGatewayProxyResult => ({
  statusCode,
  body: JSON.stringify(body),
  headers: {
    "Access-Control-Allow-Origin": "*",
  },
});

export const handler: Handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.debug("EVENT: ", event);

  const httpMethod = event.httpMethod;
  const client = new DynamoDBClient();

  if (httpMethod === "GET") {
    const params = event.pathParameters;
    if (!params?.id) {
      return makeResponse(400, { message: "missing id parameter" });
    }

    const cmd = new GetItemCommand({
      TableName: tableName,
      Key: marshall({ id: params.id }),
    });

    try {
      const res = await client.send(cmd);
      const item = res.Item;
      if (!item) {
        return makeResponse(404, { message: "bit not found" });
      }
      return makeResponse(200, { bit: unmarshall(item) as Bit });
    } catch (error) {
      console.error("Error getting bit:", error);
      return makeResponse(500, { message: "Internal Server Error" });
    }
  } else if (httpMethod === "POST") {
    if (!event.body) {
      return makeResponse(400, { message: "missing body" });
    }

    try {
      const bit: PostBitRequest = JSON.parse(event.body);
      const { error } = bitSchema.validate(bit);

      if (error) {
        return makeResponse(400, { message: `Invalid bit: ${error.message}` });
      }

      const id = v4();
      const params = {
        TableName: tableName,
        Item: marshall({ id, ...bit }),
      };

      await client.send(new PutItemCommand(params));

      return makeResponse(201, {
        message: "bit created",
        id,
      } as PostBitResponse);
    } catch (error) {
      console.error("Error creating bit:", error);
      return makeResponse(500, { message: "Internal Server Error" });
    }
  } else {
    return makeResponse(405, { message: "Method Not Allowed" });
  }
};
