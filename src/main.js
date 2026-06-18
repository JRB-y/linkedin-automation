import fs from "fs";
import { getNextReadyIdea, markAsPosted, markAsReview } from "./notionClient.js";
import { generatePost } from "./generatePost.js";
import { generateImage } from "./generateImage.js";
import { publishPost } from "./linkedinPost.js";
import { uploadImageToGitHub } from "./githubStorage.js";

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

  const withImage = ["Text+Image", "Carousel"].includes(idea.postType);

  if (idea.postType === "Carousel") {
    console.log("Carousel is not yet implemented. Change Post Type and retry.");
    process.exit(0);
  }

  let post = idea.generatedPost;
  let imageUrl = idea.imageUrl;
  let imageBuffer;

  if (post && (!withImage || imageUrl)) {
    // Already generated during dry-run — reuse as-is
    console.log(`[${idea.postType}] Using previously generated content from Notion.`);
    if (imageUrl) {
      const res = await fetch(imageUrl);
      imageBuffer = Buffer.from(await res.arrayBuffer());
    }
  } else {
    // Fresh generation
    const tone = fs.readFileSync(TONE_FILE, "utf-8");
    console.log(`[${idea.postType}] Generating post${withImage ? " and image" : ""}...`);

    if (withImage) {
      [post, imageBuffer] = await Promise.all([
        generatePost(idea.content, tone, idea.postType),
        generateImage(idea.content),
      ]);
      console.log("Uploading image to GitHub...");
      imageUrl = await uploadImageToGitHub(imageBuffer, idea.title);
      console.log(`Image stored: ${imageUrl}`);
    } else {
      post = await generatePost(idea.content, tone, idea.postType);
    }
  }

  console.log("\n--- Post ---");
  console.log(post);
  console.log("------------\n");

  if (isDryRun) {
    await markAsReview(idea.id, post, withImage ? imageUrl : null);
    console.log(`Notion updated: "${idea.title}" → Review`);
    return;
  }

  console.log("Publishing to LinkedIn...");
  const postId = await publishPost(post, withImage ? imageBuffer : null);
  console.log(`Published successfully. Post ID: ${postId}`);

  await markAsPosted(idea.id, post, imageUrl);
  console.log(`Notion updated: "${idea.title}" → Posted`);
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
