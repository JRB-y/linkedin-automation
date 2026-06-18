import fs from "fs";
import { getNextReadyIdea, markAsPosted, markAsReview } from "./notionClient.js";
import { generatePost } from "./generatePost.js";
import { generateImage } from "./generateImage.js";
import { publishPost } from "./linkedinPost.js";

const TONE_FILE = "tone.md";
const isDryRun = process.env.DRY_RUN === "true";

async function main() {
  if (isDryRun) console.log("--- DRY RUN MODE (no LinkedIn publish) ---\n");

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

  if (isDryRun) {
    await markAsReview(idea.id, post);
    console.log(`Notion updated: "${idea.title}" → Review (post saved, not published)`);
    return;
  }

  console.log("Publishing to LinkedIn...");
  const postId = await publishPost(post, imageBuffer);
  console.log(`Published successfully. Post ID: ${postId}`);

  await markAsPosted(idea.id, post);
  console.log(`Notion updated: "${idea.title}" → Posted`);
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
