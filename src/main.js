import fs from "fs";
import { getNextReadyIdea, markAsPosted } from "./notionClient.js";
import { generatePost } from "./generatePost.js";
import { generateImage } from "./generateImage.js";
import { publishPost } from "./linkedinPost.js";

const TONE_FILE = "tone.md";

async function main() {
  const idea = await getNextReadyIdea();

  if (!idea) {
    console.log("No ideas ready in Notion. Add entries with Status = Ready.");
    process.exit(0);
  }

  console.log(`Processing: "${idea.title}"`);

  const tone = fs.readFileSync(TONE_FILE, "utf-8");

  console.log("Generating post and image...");
  const [post, imageBuffer] = await Promise.all([
    generatePost(idea.content, tone),
    generateImage(idea.content),
  ]);

  console.log("\n--- Generated post ---");
  console.log(post);
  console.log("----------------------\n");

  console.log("Publishing to LinkedIn...");
  const postId = await publishPost(post, imageBuffer);
  console.log(`Published successfully. Post ID: ${postId}`);

  await markAsPosted(idea.id);
  console.log(`Notion updated: "${idea.title}" → Posted`);
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
