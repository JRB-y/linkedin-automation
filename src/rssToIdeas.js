import Anthropic from "@anthropic-ai/sdk";
import { Client } from "@notionhq/client";
import fs from "fs";

const RSS_FEEDS = [
  // Tech News
  { name: "TechCrunch", url: "https://techcrunch.com/feed/" },
  { name: "Ars Technica", url: "https://feeds.arstechnica.com/arstechnica/index" },
  { name: "The Verge", url: "https://www.theverge.com/rss/index.xml" },
  { name: "WIRED", url: "https://www.wired.com/feed/rss" },
  { name: "VentureBeat", url: "https://venturebeat.com/feed/" },
  // AI Labs
  { name: "OpenAI", url: "https://openai.com/news/rss.xml" },
  { name: "Anthropic", url: "https://www.anthropic.com/rss.xml" },
  { name: "Hugging Face", url: "https://huggingface.co/blog/feed.xml" },
  { name: "Google DeepMind", url: "https://deepmind.google/blog/rss.xml" },
  { name: "NVIDIA AI", url: "https://developer.nvidia.com/blog/feed/" },
  // Engineering
  { name: "InfoQ", url: "https://feed.infoq.com/" },
  { name: "GitHub Engineering", url: "https://github.blog/feed/" },
  { name: "Martin Fowler", url: "https://martinfowler.com/feed.atom" },
  // Frontend / Web
  { name: "CSS-Tricks", url: "https://css-tricks.com/feed/" },
  { name: "Smashing Magazine", url: "https://www.smashingmagazine.com/feed/" },
];

const SEEN_FILE = "data/seen-articles.json";
const RECENCY_DAYS = parseInt(process.env.RSS_RECENCY_DAYS || "4");
const MAX_IDEAS = parseInt(process.env.RSS_MAX_IDEAS || "5");
const MAX_ARTICLES_FOR_CLAUDE = 20;

// --- RSS/Atom XML parser (no external dependency) ---

function extractTagContent(block, tag) {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = block.match(re);
  if (!m) return null;
  return m[1]
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#\d+;/g, "")
    .trim();
}

function extractAtomLink(block) {
  const m =
    block.match(/<link[^>]+rel=["']alternate["'][^>]*href=["']([^"']+)["']/i) ||
    block.match(/<link[^>]+href=["']([^"']+)["'][^>]*rel=["']alternate["']/i) ||
    block.match(/<link[^>]+href=["']([^"']+)["']/i);
  return m ? m[1] : null;
}

function parseXML(xml) {
  const isAtom = /<feed[\s>]/i.test(xml);
  const itemTag = isAtom ? "entry" : "item";
  const itemRe = new RegExp(`<${itemTag}[\\s>][\\s\\S]*?<\\/${itemTag}>`, "gi");

  const items = [];
  let match;
  while ((match = itemRe.exec(xml)) !== null && items.length < 50) {
    const block = match[0];

    const title = extractTagContent(block, "title");
    if (!title) continue;

    const url = isAtom
      ? extractAtomLink(block) || extractTagContent(block, "link")
      : extractTagContent(block, "link");
    if (!url || !url.startsWith("http")) continue;

    const description =
      extractTagContent(block, isAtom ? "summary" : "description") ||
      extractTagContent(block, "content") ||
      "";

    const pubDate =
      extractTagContent(block, isAtom ? "published" : "pubDate") ||
      extractTagContent(block, "updated");

    items.push({
      title,
      url,
      description: description.slice(0, 400),
      pubDate: pubDate ? new Date(pubDate) : new Date(),
    });
  }

  return items;
}

// --- Feed fetching ---

async function fetchFeed(feed) {
  try {
    const res = await fetch(feed.url, {
      headers: { "User-Agent": "RSS-Reader/1.0 (linkedin-automation)" },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) {
      console.warn(`  [${feed.name}] HTTP ${res.status} — skipping`);
      return [];
    }
    const xml = await res.text();
    const items = parseXML(xml);
    console.log(`  [${feed.name}] ${items.length} items`);
    return items.map((item) => ({ ...item, source: feed.name }));
  } catch (err) {
    console.warn(`  [${feed.name}] ${err.message} — skipping`);
    return [];
  }
}

// --- Seen URL cache ---

function loadSeenUrls() {
  try {
    return new Set(JSON.parse(fs.readFileSync(SEEN_FILE, "utf-8")).urls || []);
  } catch {
    return new Set();
  }
}

function saveSeenUrls(urls) {
  if (!fs.existsSync("data")) fs.mkdirSync("data");
  // Keep last 500 to avoid unbounded growth
  const arr = [...urls].slice(-500);
  fs.writeFileSync(SEEN_FILE, JSON.stringify({ urls: arr }, null, 2) + "\n");
}

// --- Article selection ---

function selectDiverseArticles(articles, max) {
  const bySource = {};
  for (const a of articles) {
    bySource[a.source] = (bySource[a.source] || []).concat(a);
  }
  const sources = Object.keys(bySource);
  const perSource = Math.max(1, Math.ceil(max / sources.length));

  return sources
    .flatMap((s) =>
      bySource[s].sort((a, b) => b.pubDate - a.pubDate).slice(0, perSource)
    )
    .sort((a, b) => b.pubDate - a.pubDate)
    .slice(0, max);
}

// --- Claude idea generation ---

async function generateIdeas(articles) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const list = articles
    .map(
      (a, i) =>
        `${i + 1}. [${a.source}] "${a.title}"\n   URL: ${a.url}${a.description ? `\n   ${a.description}` : ""}`
    )
    .join("\n\n");

  const prompt = `Tu es un assistant qui aide un développeur senior à trouver des idées de posts LinkedIn à partir d'actualités tech.

Voici ${articles.length} articles récents :

${list}

Génère exactement ${MAX_IDEAS} idées de posts LinkedIn inspirées de ces articles.

Pour chaque idée, produis un objet JSON :
- "title" : titre court de l'idée en français (max 80 caractères)
- "body" : description de l'angle du post en français (2-3 phrases : quel angle personnel ou réflexion ce post va explorer, sans résumer l'article)
- "postType" : "Text", "Text+Image", "Quizz", ou "Carousel"
- "sourceTitle" : titre exact de l'article source (ou plusieurs titres séparés par " + " si l'idée en combine plusieurs)
- "sourceUrl" : URL exacte de l'article source telle que fournie dans la liste ci-dessus (une seule URL, la plus pertinente)

Consignes :
- Trouver un angle personnel, une réflexion, une expérience vécue inspirée par l'article — pas un résumé
- Favoriser les angles inattendus ou contre-intuitifs
- Éviter les angles génériques ("l'IA change tout...", "voici pourquoi c'est important...")
- Varier les types de posts
- Répondre UNIQUEMENT avec un tableau JSON valide. Aucun texte avant ou après.`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  });

  const text = message.content[0].text.trim();
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\[[\s\S]+\]/);
    if (match) return JSON.parse(match[0]);
    throw new Error(`Claude response is not valid JSON:\n${text.slice(0, 300)}`);
  }
}

// --- Notion draft creation ---

async function createDraft(idea) {
  const notion = new Client({ auth: process.env.NOTION_API_KEY });

  await notion.pages.create({
    parent: { database_id: process.env.NOTION_DATABASE_ID },
    properties: {
      Name: { title: [{ text: { content: idea.title } }] },
      Status: { select: { name: "Draft" } },
      "Post Type": { select: { name: idea.postType || "Text" } },
    },
    children: [
      {
        type: "paragraph",
        paragraph: {
          rich_text: [{ type: "text", text: { content: idea.body } }],
        },
      },
      {
        type: "paragraph",
        paragraph: {
          rich_text: [
            {
              type: "text",
              text: { content: "📰 Source : " },
              annotations: { bold: true },
            },
            {
              type: "text",
              text: { content: idea.sourceTitle || "" },
              annotations: { italic: true },
            },
          ],
        },
      },
      ...(idea.sourceUrl
        ? [
            {
              type: "paragraph",
              paragraph: {
                rich_text: [
                  {
                    type: "text",
                    text: {
                      content: idea.sourceUrl,
                      link: { url: idea.sourceUrl },
                    },
                    annotations: { color: "blue" },
                  },
                ],
              },
            },
          ]
        : []),
    ],
  });
}

// --- Main ---

async function main() {
  const cutoff = new Date(Date.now() - RECENCY_DAYS * 86_400_000);

  console.log(
    `Fetching ${RSS_FEEDS.length} RSS feeds (articles from last ${RECENCY_DAYS} days)...`
  );
  const results = await Promise.allSettled(RSS_FEEDS.map(fetchFeed));
  const all = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));

  const recent = all.filter((a) => a.pubDate >= cutoff);
  console.log(`\n${recent.length} recent articles across all feeds`);

  const seenUrls = loadSeenUrls();
  const unseen = recent.filter((a) => !seenUrls.has(a.url));
  console.log(`${unseen.length} not yet processed`);

  if (unseen.length === 0) {
    console.log("No new articles. Exiting.");
    return;
  }

  const selected = selectDiverseArticles(unseen, MAX_ARTICLES_FOR_CLAUDE);
  console.log(`Selected ${selected.length} articles for Claude`);

  console.log("\nGenerating ideas with Claude...");
  const ideas = await generateIdeas(selected);

  console.log(`\n${ideas.length} ideas generated:`);
  ideas.forEach((idea, i) =>
    console.log(`  ${i + 1}. [${idea.postType}] ${idea.title}`)
  );

  console.log("\nCreating Notion drafts...");
  await Promise.allSettled(
    ideas.map(async (idea) => {
      await createDraft(idea);
      console.log(`  Created: "${idea.title}"`);
    })
  );

  // Mark all unseen articles as processed
  unseen.forEach((a) => seenUrls.add(a.url));
  saveSeenUrls(seenUrls);
  console.log(`\nMarked ${unseen.length} articles as seen.`);
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
