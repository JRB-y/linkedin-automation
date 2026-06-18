import { Client } from "@notionhq/client";

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const DATABASE_ID = process.env.NOTION_DATABASE_ID;

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
  const content = page.properties.Content.rich_text
    .map((t) => t.plain_text)
    .join("");

  return {
    id: page.id,
    title,
    content: content || title,
  };
}

export async function markAsPosted(pageId, postText) {
  await notion.pages.update({
    page_id: pageId,
    properties: {
      Status: { select: { name: "Posted" } },
      "Published At": { date: { start: new Date().toISOString() } },
      Post: { rich_text: [{ text: { content: postText } }] },
    },
  });
}

export async function markAsReview(pageId, postText) {
  await notion.pages.update({
    page_id: pageId,
    properties: {
      Status: { select: { name: "Review" } },
      Post: { rich_text: [{ text: { content: postText } }] },
    },
  });
}
