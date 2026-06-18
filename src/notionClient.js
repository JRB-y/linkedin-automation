import { Client } from "@notionhq/client";

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const DATABASE_ID = process.env.NOTION_DATABASE_ID;
const GENERATED_POST_TOGGLE_TITLE = "📝 Generated Post";

function extractTextFromBlocks(blocks) {
  return blocks
    .filter((b) => ["paragraph", "heading_1", "heading_2", "heading_3", "bulleted_list_item", "numbered_list_item", "quote"].includes(b.type))
    .map((b) => {
      const richText = b[b.type]?.rich_text ?? [];
      return richText.map((t) => t.plain_text).join("");
    })
    .filter(Boolean)
    .join("\n");
}

export async function getNextReadyIdea() {
  const response = await notion.databases.query({
    database_id: DATABASE_ID,
    filter: {
      property: "Status",
      select: { equals: "Ready" },
    },
    sorts: [{ timestamp: "created_time", direction: "ascending" }],
    page_size: 1,
  });

  if (response.results.length === 0) return null;

  const page = response.results[0];
  const title = page.properties.Name.title.map((t) => t.plain_text).join("");

  // Read page body blocks
  const blocks = await notion.blocks.children.list({ block_id: page.id });

  // Look for our generated post toggle
  const toggleBlock = blocks.results.find(
    (b) =>
      b.type === "toggle" &&
      b.toggle.rich_text.map((t) => t.plain_text).join("") === GENERATED_POST_TOGGLE_TITLE
  );

  let generatedPost = null;
  let imageUrl = null;

  if (toggleBlock) {
    const toggleChildren = await notion.blocks.children.list({
      block_id: toggleBlock.id,
    });
    const paragraphBlock = toggleChildren.results.find(
      (b) => b.type === "paragraph" && b.paragraph.rich_text.length > 0
    );
    const imageBlock = toggleChildren.results.find(
      (b) => b.type === "image" && b.image.type === "external"
    );
    generatedPost = paragraphBlock
      ? paragraphBlock.paragraph.rich_text.map((t) => t.plain_text).join("")
      : null;
    imageUrl = imageBlock ? imageBlock.image.external.url : null;
  }

  // Read body (excluding the toggle) as the idea content
  const ideaBlocks = blocks.results.filter(
    (b) => !toggleBlock || b.id !== toggleBlock.id
  );
  const bodyContent = extractTextFromBlocks(ideaBlocks);

  const postType = page.properties["Post Type"]?.select?.name ?? "Text+Image";

  return {
    id: page.id,
    title,
    content: bodyContent || title,
    postType,
    generatedPost,
    imageUrl,
  };
}

async function writePostToggle(pageId, postText, imageUrl) {
  const toggleChildren = [
    {
      type: "paragraph",
      paragraph: {
        rich_text: [{ type: "text", text: { content: postText } }],
      },
    },
  ];

  if (imageUrl) {
    toggleChildren.push({
      type: "image",
      image: { type: "external", external: { url: imageUrl } },
    });
  }

  await notion.blocks.children.append({
    block_id: pageId,
    children: [
      {
        type: "toggle",
        toggle: {
          rich_text: [{ type: "text", text: { content: GENERATED_POST_TOGGLE_TITLE } }],
          children: toggleChildren,
        },
      },
    ],
  });
}

export async function markAsPosted(pageId, postText, imageUrl) {
  await Promise.all([
    notion.pages.update({
      page_id: pageId,
      properties: {
        Status: { select: { name: "Posted" } },
        "Published At": { date: { start: new Date().toISOString() } },
      },
    }),
    writePostToggle(pageId, postText, imageUrl),
  ]);
}

export async function markAsReview(pageId, postText, imageUrl) {
  await Promise.all([
    notion.pages.update({
      page_id: pageId,
      properties: {
        Status: { select: { name: "Review" } },
      },
    }),
    writePostToggle(pageId, postText, imageUrl),
  ]);
}
