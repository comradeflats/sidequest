import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import { Quest } from "../types";
import { costEstimator } from "./cost-estimator";

const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(API_KEY);

// Model config type
interface ModelConfig {
  safetySettings: Array<{ category: HarmCategory; threshold: HarmBlockThreshold }>;
  generationConfig?: {
    responseMimeType: string;
  };
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
      // Using Pro for campaign generation - showcase Gemini 3's powerful reasoning
      modelName = "gemini-3-pro-preview";
      config.generationConfig = { responseMimeType: "application/json" };
      break;
    case 'verification':
      // Using Pro for verification - best multimodal understanding for photo/video/audio
      // Extended thinking activated through detailed step-by-step prompts
      modelName = "gemini-3-pro-preview";
      config.generationConfig = {
        responseMimeType: "application/json"
      };
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

// Track first image generation time for adaptive timeout
let firstImageGenerationTime: number | null = null;

export type ImageGenerationError = 'timeout' | 'quota' | 'unknown' | null;

export interface ImageGenerationResult {
  url: string | null;
  error: ImageGenerationError;
  duration?: number;
}

export async function generateQuestImage(
  quest: Quest,
  timeout: number = 20000,
  retries: number = 1,
  adaptiveTimeout: boolean = true
): Promise<string | null> {
  let lastError: Error | null = null;

  // Adaptive timeout based on first successful generation
  let effectiveTimeout = timeout;
  if (adaptiveTimeout && firstImageGenerationTime !== null) {
    if (firstImageGenerationTime < 10000) {
      // First image was fast, reduce timeout for subsequent images
      effectiveTimeout = 15000;
    }
    // If first image took 15-20s, keep 20s timeout (default behavior)
  }

  // Try with retry logic
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const model = getModel('image');

      const prompt = `
        Create a 16-bit pixel art scene for this quest.

        Quest: ${quest.narrative}
        Location: ${quest.locationHint}

        Style: 16-bit SNES/Genesis pixel art, landscape 16:9 ratio
        Atmosphere: Evocative scene like a classic adventure game

        Colors:
        - Emerald green (#10b981) for nature
        - Warm gold (#fbbf24) for highlights/sunlight
        - Rich saturated colors with deep shadows

        Composition: Clear focal point, parallax layering (foreground/midground/background)

        CRITICAL: NO text, letters, numbers, or words anywhere in the image.
      `;

      // Track Image Generation Cost
      costEstimator.trackGeminiImageGen();

      // Track generation time for adaptive timeout
      const startTime = Date.now();

      // Use Promise.race to enforce timeout
      const result = await Promise.race([
        model.generateContent(prompt),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), effectiveTimeout)
        )
      ]);

      const response = await result.response;

      // Extract image data from response
      const imagePart = response.candidates?.[0]?.content?.parts?.[0];

      if (imagePart?.inlineData) {
        const mimeType = imagePart.inlineData.mimeType || 'image/png';
        const base64Data = imagePart.inlineData.data;

        // Track first successful generation time for adaptive timeout
        if (firstImageGenerationTime === null && adaptiveTimeout) {
          firstImageGenerationTime = Date.now() - startTime;
        }

        return `data:${mimeType};base64,${base64Data}`;
      }

      return null;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');

      // If it's not a timeout or this is the last attempt, give up
      if (!lastError.message.includes('Timeout') || attempt === retries) {
        break;
      }

      // Wait before retry (exponential backoff starting at 2s)
      await new Promise(resolve => setTimeout(resolve, 2000 * (attempt + 1)));
    }
  }

  // All attempts failed - return null for backward compatibility
  // Error type is tracked in lastError for future enhancement
  return null;
}

/**
 * Generate quest image with detailed error information
 * Used for enhanced error handling and retry UI
 */
export async function generateQuestImageWithDetails(
  quest: Quest,
  timeout: number = 20000,
  retries: number = 1,
  adaptiveTimeout: boolean = true
): Promise<ImageGenerationResult> {
  let lastError: Error | null = null;

  // Adaptive timeout based on first successful generation
  let effectiveTimeout = timeout;
  if (adaptiveTimeout && firstImageGenerationTime !== null) {
    if (firstImageGenerationTime < 10000) {
      effectiveTimeout = 15000;
    }
  }

  const overallStartTime = Date.now();

  // Try with retry logic
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const model = getModel('image');

      const prompt = `
        Create a 16-bit pixel art scene for this quest.

        Quest: ${quest.narrative}
        Location: ${quest.locationHint}

        Style: 16-bit SNES/Genesis pixel art, landscape 16:9 ratio
        Atmosphere: Evocative scene like a classic adventure game

        Colors:
        - Emerald green (#10b981) for nature
        - Warm gold (#fbbf24) for highlights/sunlight
        - Rich saturated colors with deep shadows

        Composition: Clear focal point, parallax layering (foreground/midground/background)

        CRITICAL: NO text, letters, numbers, or words anywhere in the image.
      `;

      costEstimator.trackGeminiImageGen();

      const startTime = Date.now();

      const result = await Promise.race([
        model.generateContent(prompt),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), effectiveTimeout)
        )
      ]);

      const response = await result.response;
      const imagePart = response.candidates?.[0]?.content?.parts?.[0];

      if (imagePart?.inlineData) {
        const mimeType = imagePart.inlineData.mimeType || 'image/png';
        const base64Data = imagePart.inlineData.data;

        if (firstImageGenerationTime === null && adaptiveTimeout) {
          firstImageGenerationTime = Date.now() - startTime;
        }

        return {
          url: `data:${mimeType};base64,${base64Data}`,
          error: null,
          duration: Date.now() - overallStartTime
        };
      }

      return { url: null, error: 'unknown' };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');

      if (!lastError.message.includes('Timeout') || attempt === retries) {
        break;
      }

      await new Promise(resolve => setTimeout(resolve, 2000 * (attempt + 1)));
    }
  }

  // Determine error type from lastError
  let errorType: ImageGenerationError = 'unknown';
  if (lastError) {
    if (lastError.message.includes('Timeout')) {
      errorType = 'timeout';
    } else if (lastError.message.includes('quota') || lastError.message.includes('limit')) {
      errorType = 'quota';
    }
  }

  return {
    url: null,
    error: errorType,
    duration: Date.now() - overallStartTime
  };
}