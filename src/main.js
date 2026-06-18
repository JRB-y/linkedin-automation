import fs from "fs";
import path from "path";
import { generatePost } from "./generatePost.js";
import { publishPost } from "./linkedinPost.js";

const IDEAS_DIR = "ideas";
const POSTED_DIR = "posted";
const TONE_FILE = "tone.md";

function getFirstIdeaFile() {
  if (!fs.existsSync(IDEAS_DIR)) {
    fs.mkdirSync(IDEAS_DIR, { recursive: true });
  }

  const files = fs
    .readdirSync(IDEAS_DIR)
    .filter((f) => f.endsWith(".md"))
    .sort();

  return files.length > 0 ? files[0] : null;
}

async function main() {
  const ideaFile = getFirstIdeaFile();

  if (!ideaFile) {
    console.log("No ideas left. Add .md files to the ideas/ folder.");
    process.exit(0);
  }

  console.log(`Processing: ${ideaFile}`);

  const ideaPath = path.join(IDEAS_DIR, ideaFile);
  const idea = fs.readFileSync(ideaPath, "utf-8");
  const tone = fs.readFileSync(TONE_FILE, "utf-8");

  console.log("Generating post with Claude...");
  const post = await generatePost(idea, tone);
  console.log("\n--- Generated post ---");
  console.log(post);
  console.log("----------------------\n");

  console.log("Publishing to LinkedIn...");
  const postId = await publishPost(post);
  console.log(`Published successfully. Post ID: ${postId}`);

  if (!fs.existsSync(POSTED_DIR)) {
    fs.mkdirSync(POSTED_DIR, { recursive: true });
  }

  const destPath = path.join(POSTED_DIR, ideaFile);
  fs.renameSync(ideaPath, destPath);
  console.log(`Archived: ${ideaFile} → ${POSTED_DIR}/`);
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
