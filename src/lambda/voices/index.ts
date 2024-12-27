import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Handler,
} from "aws-lambda";
import {
  DynamoDBClient,
  GetItemCommand,
  QueryCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";

const tableName = process.env.VOICES_TABLE_NAME;

export type Voice = {
  id: string;
  code: string;
  model: string;
  platform: string;
  voiceName: string;
  voiceId: string;
};

export const handler: Handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.log("event", event);
  const httpMethod = event.httpMethod;
  const client = new DynamoDBClient({});

  if (httpMethod === "GET") {
    const id = event.pathParameters?.id;
    if (!id) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "missing id parameter" }),
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
      };
    }

    try {
      const result = await getByName(client, id);

      if (result.Items?.length) {
        const item = result.Items[0];

        return {
          statusCode: 200,
          body: JSON.stringify(unmarshall(item)),
          headers: {
            "Access-Control-Allow-Origin": "*",
          },
        };
      } else {
        const result = await getById(client, id);

        if (result.Item) {
          return {
            statusCode: 200,
            body: JSON.stringify(unmarshall(result.Item)),
            headers: {
              "Access-Control-Allow-Origin": "*",
            },
          };
        }

        return {
          statusCode: 404,
          body: JSON.stringify({ message: "Voice not found" }),
          headers: {
            "Access-Control-Allow-Origin": "*",
          },
        };
      }
    } catch (error) {
      console.error("Error getting voice:", error);
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

const getByName = async (client: DynamoDBClient, name: string) =>
  client.send(
    new QueryCommand({
      TableName: tableName,
      IndexName: "voices-by-name",
      KeyConditionExpression: "#name = :name",
      ExpressionAttributeNames: {
        "#name": "voiceName",
      },
      ExpressionAttributeValues: marshall({
        ":name": name,
      }),
    })
  );

const getById = async (client: DynamoDBClient, id: string) =>
  client.send(
    new GetItemCommand({
      TableName: tableName,
      Key: marshall({ id }),
    })
  );
