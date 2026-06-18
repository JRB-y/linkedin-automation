import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });

export async function generateImage(postText) {
  const prompt =
    `Minimalist illustration for a tech professional's LinkedIn post. ` +
    `Clean, modern aesthetic. Dark or neutral background. No text, no words, no letters. ` +
    `Abstract or conceptual visual only. Style: flat design, professional. ` +
    `Topic: ${postText.slice(0, 300)}`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-image",
    contents: prompt,
    config: { responseModalities: ["IMAGE"] },
  });

  const parts = response.candidates[0].content.parts;
  const imagePart = parts.find((p) => p.inlineData);
  if (!imagePart) throw new Error("No image returned by Gemini");

  return Buffer.from(imagePart.inlineData.data, "base64");
}
