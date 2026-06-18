import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });

export async function generateImage(postText) {
  const prompt =
    `Minimalist illustration for a tech professional's LinkedIn post. ` +
    `Clean, modern aesthetic. Dark or neutral background. No text, no words, no letters. ` +
    `Abstract or conceptual visual only. Style: flat design, professional. ` +
    `Topic: ${postText.slice(0, 300)}`;

  const response = await ai.models.generateImages({
    model: "imagen-3.0-generate-002",
    prompt,
    config: {
      numberOfImages: 1,
      aspectRatio: "1:1",
    },
  });

  const imageBytes = response.generatedImages[0].image.imageBytes;
  return Buffer.from(imageBytes, "base64");
}
