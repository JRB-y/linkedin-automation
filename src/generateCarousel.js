import Anthropic from "@anthropic-ai/sdk";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Slide dimensions (4:5 portrait — optimal for LinkedIn carousel)
const W = 540;
const H = 675;
const PAD = 50;

const BG = rgb(0.06, 0.09, 0.17);
const WHITE = rgb(1, 1, 1);
const MUTED = rgb(0.7, 0.75, 0.85);
const ACCENTS = [
  rgb(0.25, 0.47, 0.95),
  rgb(0.08, 0.72, 0.52),
  rgb(0.85, 0.35, 0.2),
  rgb(0.6, 0.25, 0.9),
  rgb(0.95, 0.65, 0.1),
];

function sanitize(text) {
  // Replace chars outside WinAnsi encoding with safe equivalents
  return text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\u2026/g, "...")
    .replace(/\u2014/g, "-")
    .replace(/\u2013/g, "-")
    .replace(/[^\x00-\xff]/g, "");
}

function wrapText(text, font, size, maxWidth) {
  const words = sanitize(text).split(" ");
  const lines = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(test, size) > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawSlide(page, slide, index, total, fontBold, fontRegular) {
  const accent = ACCENTS[index % ACCENTS.length];
  const isFirst = index === 0;
  const isLast = index === total - 1;
  const contentWidth = W - PAD * 2 - 20;

  // Background
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: BG });

  // Left accent bar
  page.drawRectangle({ x: 0, y: 0, width: 6, height: H, color: accent });

  // Slide counter (not on first or last)
  if (!isFirst && !isLast) {
    page.drawText(`${index} / ${total - 1}`, {
      x: W - PAD - 28,
      y: PAD - 15,
      size: 10,
      font: fontRegular,
      color: MUTED,
    });
  }

  // Title
  const titleSize = isFirst ? 30 : 22;
  const titleY = isFirst ? H / 2 + 60 : H - PAD - 50;
  const titleLines = wrapText(slide.title, fontBold, titleSize, contentWidth);
  titleLines.forEach((l, i) => {
    page.drawText(l, {
      x: PAD + 20,
      y: titleY - i * (titleSize + 6),
      size: titleSize,
      font: fontBold,
      color: WHITE,
    });
  });

  // Accent underline under title
  page.drawRectangle({
    x: PAD + 20,
    y: titleY - titleLines.length * (titleSize + 6) - 8,
    width: 40,
    height: 3,
    color: accent,
  });

  // Body
  if (slide.body) {
    const bodySize = 15;
    const bodyY =
      titleY - titleLines.length * (titleSize + 6) - 35;
    const bodyLines = wrapText(slide.body, fontRegular, bodySize, contentWidth);
    bodyLines.forEach((l, i) => {
      page.drawText(l, {
        x: PAD + 20,
        y: bodyY - i * (bodySize + 8),
        size: bodySize,
        font: fontRegular,
        color: MUTED,
      });
    });
  }

  // Swipe hint on first slide
  if (isFirst) {
    page.drawText("Swipe →", {
      x: W - PAD - 50,
      y: PAD - 15,
      size: 11,
      font: fontRegular,
      color: accent,
    });
  }
}

async function buildPDF(slides) {
  const doc = await PDFDocument.create();
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);

  for (let i = 0; i < slides.length; i++) {
    const page = doc.addPage([W, H]);
    drawSlide(page, slides[i], i, slides.length, fontBold, fontRegular);
  }

  return Buffer.from(await doc.save());
}

export async function generateCarousel(idea, tone) {
  const response = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 2048,
    temperature: 0.8,
    messages: [
      {
        role: "user",
        content: `Tu crées le contenu d'un carousel LinkedIn.

TON PERSONNEL
${tone}

IDÉE
${idea}

INSTRUCTIONS
- 5 à 7 slides maximum.
- Slide 1 : titre accrocheur (question ou affirmation forte, max 8 mots). Pas de body.
- Slides intermédiaires : un seul point par slide. Titre court (max 6 mots) + corps de 1 à 2 phrases percutantes.
- Dernière slide : conclusion + call-to-action (invite à commenter ou partager). Pas de body.
- Caption : texte LinkedIn qui introduit le carousel (max 800 caractères, même ton que d'habitude, pas de "Voici mon carousel").

Réponds UNIQUEMENT avec un JSON valide, sans markdown :
{
  "caption": "...",
  "slides": [
    { "title": "...", "body": "..." },
    { "title": "...", "body": null }
  ]
}`,
      },
    ],
  });

  let data;
  try {
    const raw = response.content[0].text.trim().replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "");
    console.log("--- Claude raw response ---");
    console.log(raw);
    console.log("---------------------------");
    data = JSON.parse(raw);
  } catch (e) {
    throw new Error(`Claude returned invalid JSON for carousel: ${e.message}`);
  }

  const pdfBuffer = await buildPDF(data.slides);
  return { caption: data.caption, pdfBuffer, slides: data.slides };
}
