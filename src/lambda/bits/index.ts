import express, { Router } from "express";
import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { v4 } from "uuid";
import joi from "joi";
import cors from "cors";
import { json, urlencoded } from "body-parser";
import createServerless from "@codegenie/serverless-express";

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

const router = Router();

const app = express();
router.use(cors());
router.use(json());
router.use(urlencoded({ extended: true }));

router.get("/:id", async (req, res) => {
  const client = new DynamoDBClient();
  const id = req.params.id;

  const cmd = new GetItemCommand({
    TableName: tableName,
    Key: marshall({ id }),
  });

  try {
    const resDb = await client.send(cmd);
    const item = resDb.Item;
    if (!item) {
      res.status(404).json({ message: "bit not found" });
      return;
    }
    res.json({ bit: unmarshall(item) as Bit });
    return;
  } catch (error) {
    console.error("Error getting bit:", error);
    res.status(500).json({ message: "Internal Server Error" });
    return;
  }
});

router.post("/", async (req, res) => {
  const client = new DynamoDBClient();
  const bit: PostBitRequest = req.body;
  const { error } = bitSchema.validate(bit);

  if (error) {
    res.status(400).json({ message: `Invalid bit: ${error.message}` });
    return;
  }

  const id = v4();
  const params = {
    TableName: tableName,
    Item: marshall({ id, ...bit }),
  };

  try {
    await client.send(new PutItemCommand(params));
    res.status(201).json({ message: "bit created", id });
    return;
  } catch (error) {
    console.error("Error creating bit:", error);
    res.status(500).json({ message: "Internal Server Error" });
    return;
  }
});

app.use("/bits", router);

export const handler = createServerless({ app });
