import * as functions from "@google-cloud/functions-framework";
import cors from "cors";
import admin from "firebase-admin";

const zyteApiKey = process.env.ZYTE_API_KEY;

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
});

const db = admin.firestore();

const corsMiddleware = cors();

export const kickChatroomApi = async (
  req: functions.Request,
  res: functions.Response
) => {
  corsMiddleware(req, res, async () => {
    if (req.method !== "GET") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    if (req.path === "/") {
      return res.status(200).send("Server is running");
    }

    let username = req.path.slice(1);

    if (!username) {
      return res.status(400).json({ error: "Username is required" });
    }

    if (username.endsWith("/")) {
      username = username.slice(0, -1);
    }

    const docRef = db.collection("chatrooms").doc(username);
    const doc = await docRef.get();

    if (doc.exists) {
      return res.status(200).json(doc.data());
    }

    console.log(
      `${username} data not found in database, fetching from external API`
    );

    const zyteResponse = await fetch("https://api.zyte.com/v1/extract", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(`${zyteApiKey}:`).toString(
          "base64"
        )}`,
      },
      body: JSON.stringify({
        url: `https://kick.com/api/v2/channels/${username}/chatroom`,
        httpResponseBody: true,
      }),
    });

    if (!zyteResponse.ok) {
      console.error("Failed to fetch data from Zyte");
      console.error(await zyteResponse.text());
      return res.status(500).json({ error: "Failed to fetch data from Zyte" });
    }

    const responseBody = await zyteResponse.json();

    const resp = Buffer.from(responseBody.httpResponseBody, "base64");

    await docRef.set({
      data: resp.toString("utf-8"),
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.setHeader("Content-Type", "application/json");
    return res.status(200).send(resp);
  });
};

// Register the function with the Functions Framework
functions.http("kickChatroomApi", kickChatroomApi);
