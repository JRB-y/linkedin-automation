import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });

export async function generateImage(postText) {
  const prompt =
    `Minimalist illustration for a tech professional's LinkedIn post. ` +
    `Clean, modern aesthetic. Dark or neutral background. No text, no words, no letters. ` +
    `Abstract or conceptual visual only. Style: flat design, professional. ` +
    `Topic: ${postText.slice(0, 300)}`;

  let imageBytes;

  try {
    // Try Imagen 3 first
    const response = await ai.models.generateImages({
      model: "imagen-3.0-generate-001",
      prompt,
      config: { numberOfImages: 1, aspectRatio: "1:1" },
    });
    imageBytes = response.generatedImages[0].image.imageBytes;
  } catch {
    // Fall back to Gemini Flash image generation
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-preview-image-generation",
      contents: prompt,
      config: { responseModalities: ["IMAGE"] },
    });
    const parts = response.candidates[0].content.parts;
    const imagePart = parts.find((p) => p.inlineData);
    if (!imagePart) throw new Error("No image returned by Gemini");
    imageBytes = imagePart.inlineData.data;
  }

  return Buffer.from(imageBytes, "base64");
}
