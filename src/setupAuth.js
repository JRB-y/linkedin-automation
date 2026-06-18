/**
 * One-time OAuth 2.0 setup script for LinkedIn.
 * Run locally: node src/setupAuth.js
 *
 * Prerequisites:
 * - Create a LinkedIn Developer App at https://www.linkedin.com/developers/
 * - Add the "Share on LinkedIn" product (grants w_member_social scope)
 * - Add http://localhost:8000/callback as a redirect URI
 * - Set LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET in your environment
 *   or create a .env file (not committed to git)
 */

import http from "http";
import { readFileSync, existsSync } from "fs";

// Load .env if present
if (existsSync(".env")) {
  const env = readFileSync(".env", "utf-8");
  for (const line of env.split("\n")) {
    const [key, ...rest] = line.split("=");
    if (key && rest.length) {
      process.env[key.trim()] = rest.join("=").trim();
    }
  }
}

const CLIENT_ID = process.env.LINKEDIN_CLIENT_ID;
const CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET;
const REDIRECT_URI = "http://localhost:8000/callback";
const PORT = 8000;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error(
    "Error: LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET must be set."
  );
  console.error("Create a .env file or export them in your shell.");
  process.exit(1);
}

const authUrl =
  `https://www.linkedin.com/oauth/v2/authorization` +
  `?response_type=code` +
  `&client_id=${CLIENT_ID}` +
  `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
  `&scope=openid%20profile%20email%20w_member_social` +
  `&state=random_state_string`;

console.log("\nOpen this URL in your browser to authorize the app:\n");
console.log(authUrl);
console.log("\nWaiting for callback on http://localhost:8000/callback ...\n");

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname !== "/callback") {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error || !code) {
    res.writeHead(400, { "Content-Type": "text/plain" });
    res.end(`Authorization failed: ${error || "no code received"}`);
    server.close();
    return;
  }

  try {
    const params = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    });

    const tokenRes = await fetch(
      "https://www.linkedin.com/oauth/v2/accessToken",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      }
    );

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok) {
      throw new Error(JSON.stringify(tokenData));
    }

    const { access_token, expires_in } = tokenData;

    const expiresInDays = Math.round(expires_in / 86400);
    const expiryDate = new Date(Date.now() + expires_in * 1000).toLocaleDateString("fr-FR");

    const output = `
Authorization successful!

Add these secrets to your GitHub repository:
  Settings → Secrets and variables → Actions → New repository secret

ANTHROPIC_API_KEY      = (your Anthropic key)
LINKEDIN_CLIENT_ID     = ${CLIENT_ID}
LINKEDIN_CLIENT_SECRET = ${CLIENT_SECRET}
LINKEDIN_ACCESS_TOKEN  = ${access_token}

Note: access_token expires in ${expiresInDays} days (around ${expiryDate}).
Run this script again before that date to get a new one.
`;

    console.log(output);

    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("Authorization successful! Check your terminal for the tokens.");
  } catch (err) {
    console.error("Token exchange failed:", err.message);
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end("Token exchange failed. Check your terminal.");
  } finally {
    server.close();
  }
});

server.listen(PORT);
