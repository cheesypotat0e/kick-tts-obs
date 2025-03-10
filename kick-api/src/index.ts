import * as functions from "@google-cloud/functions-framework";
import cors from "cors";
import * as puppeteer from "puppeteer";

// Define types for request and response
interface ChatroomRequest {
  username?: string;
}

// Initialize CORS middleware
const corsMiddleware = cors();

// Define the function handler
export const kickChatroomApi = async (
  req: functions.Request,
  res: functions.Response
) => {
  // Handle CORS
  corsMiddleware(req, res, async () => {
    // Health check for GET requests
    if (req.method === "GET") {
      return res.status(200).send("Server is running");
    }

    // Only allow POST requests for the chatroom endpoint
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    // Parse request body
    const { username } = req.body as ChatroomRequest;

    // Validate username
    if (!username) {
      return res.status(400).json({ error: "Username is required" });
    }

    let browser;
    try {
      // Launch puppeteer browser
      browser = await puppeteer.launch({
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
        ],
      });

      const page = await browser.newPage();

      // Set a reasonable timeout
      page.setDefaultNavigationTimeout(3000);

      // Make the request to Kick API
      const response = await page.goto(
        `https://kick.com/api/v2/channels/${username}/chatroom`,
        { waitUntil: "networkidle0" }
      );

      if (!response) {
        throw new Error("Failed to get response from Kick API");
      }

      // Get the status code
      const statusCode = response.status();

      // Get the response body
      const responseBody = await response.text();

      // Set the same status code as the original response
      res.status(statusCode);

      // Try to parse the response as JSON
      try {
        const jsonResponse = JSON.parse(responseBody);
        return res.json(jsonResponse);
      } catch (parseError) {
        // If it's not valid JSON, send as text
        return res.send(responseBody);
      }
    } catch (error) {
      console.error("Error fetching chatroom data:", error);
      return res.status(500).json({
        error: "Failed to fetch chatroom data",
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  });
};

// Register the function with the Functions Framework
functions.http("kickChatroomApi", kickChatroomApi);
