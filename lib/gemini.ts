import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import { Quest } from "../types";
import { costEstimator } from "./cost-estimator";

const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(API_KEY);

// Model config type
interface ModelConfig {
  safetySettings: Array<{ category: HarmCategory; threshold: HarmBlockThreshold }>;
  generationConfig?: { responseMimeType: string };
}

export const getModel = (type: 'campaign' | 'verification' | 'image' = 'verification') => {
  let modelName: string;
  const config: ModelConfig = {
    safetySettings: [
      { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    ]
  };

  switch(type) {
    case 'campaign':
      // Using Flash for campaign generation - Pro not available on free tier
      modelName = "gemini-3-flash-preview";
      config.generationConfig = { responseMimeType: "application/json" };
      break;
    case 'verification':
      modelName = "gemini-3-flash-preview";
      config.generationConfig = { responseMimeType: "application/json" };
      break;
    case 'image':
      modelName = "gemini-3-pro-image-preview";
      // No JSON config - returns binary image data
      break;
  }

  return genAI.getGenerativeModel({
    model: modelName,
    ...config
  });
};

export async function generateQuestImage(
  quest: Quest,
  timeout: number = 30000,
  retries: number = 1
): Promise<string | null> {
  let lastError: Error | null = null;

  // Try with retry logic
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const model = getModel('image');

      const prompt = `
        Create a 16-bit pixel art scene for this location-based quest.

        Quest Context: ${quest.narrative}
        Location Type: ${quest.locationHint}

        CRITICAL REQUIREMENTS:
        - NO TEXT OR WORDS anywhere in the image
        - Purely visual atmospheric scene depicting the location
        - 16-bit SNES/Genesis era pixel art style
        - Vibrant retro game colors
        - Landscape orientation (16:9 ratio)
        - Atmospheric and evocative
        - Should feel like a scene from a classic adventure game

        Color Palette Guidelines:
        - Use emerald green (#10b981) for natural elements (foliage, grass)
        - Use warm golds (#fbbf24) and ambers for highlights and sunlight
        - Rich, saturated colors typical of 16-bit era games
        - Deep shadows for dramatic contrast

        Composition:
        - Clear focal point representing the quest location or objective
        - Depth through parallax-style layering (foreground, midground, background)
        - Frame-worthy composition suitable for a hero image
        - Evocative atmosphere that hints at the adventure

        The image must be entirely visual - NO letters, numbers, signs, or text of any kind.
        Focus on creating a beautiful, atmospheric pixel art scene.
      `;

      // Track Image Generation Cost
      costEstimator.trackGeminiImageGen();

      // Use Promise.race to enforce timeout
      const result = await Promise.race([
        model.generateContent(prompt),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), timeout)
        )
      ]);

      const response = await result.response;

      // Extract image data from response
      const imagePart = response.candidates?.[0]?.content?.parts?.[0];

      if (imagePart?.inlineData) {
        const mimeType = imagePart.inlineData.mimeType || 'image/png';
        const base64Data = imagePart.inlineData.data;
        return `data:${mimeType};base64,${base64Data}`;
      }

      return null;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');

      // If it's not a timeout or this is the last attempt, give up
      if (!lastError.message.includes('Timeout') || attempt === retries) {
        break;
      }

      // Wait before retry (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }

  // All attempts failed
  return null;
}