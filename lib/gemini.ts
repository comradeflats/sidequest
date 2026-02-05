import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import { Quest } from "../types";
import { costEstimator } from "./cost-estimator";

const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(API_KEY);

// Image generation model configuration
// NOTE: For Gemini 3 hackathon, only gemini-3-pro-image-preview is available
// There is no Gemini 3 Flash image model (Flash image is Gemini 2.5)
// Using Pro with optimized timeouts (30s) and retries (2)

// Model config type
interface ModelConfig {
  safetySettings: Array<{ category: HarmCategory; threshold: HarmBlockThreshold }>;
  generationConfig?: {
    responseMimeType: string;
  };
}

export const getModel = (type: 'campaign' | 'verification' | 'image' | 'research' = 'verification') => {
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
      // GEMINI 3 SHOWCASE: Flash for fast campaign generation with Pro-level intelligence
      modelName = "gemini-3-flash-preview";
      config.generationConfig = { responseMimeType: "application/json" };
      break;
    case 'verification':
      // GEMINI 3 SHOWCASE: Pro for advanced multimodal reasoning (photo/video/audio)
      // Superior reasoning capabilities for complex verification decisions
      modelName = "gemini-3-pro-preview";
      config.generationConfig = {
        responseMimeType: "application/json"
      };
      break;
    case 'research':
      // OPTIMIZATION: Flash for simple text generation (location research)
      modelName = "gemini-3-flash-preview";
      config.generationConfig = { responseMimeType: "application/json" };
      break;
    case 'image':
      // GEMINI 3 SHOWCASE: Pro Image for high-quality pixel art generation
      // Only Gemini 3 image model available (no Flash variant in v3)
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

export type ImageGenerationError = 'timeout' | 'quota' | 'overload' | 'unknown' | null;

export interface ImageGenerationResult {
  url: string | null;
  error: ImageGenerationError;
  duration?: number;
}

/**
 * Timeout wrapper that properly cancels the promise race
 * Ensures response is fully awaited before returning
 */
async function generateWithTimeout(
  model: ReturnType<typeof getModel>,
  prompt: string,
  timeout: number
): Promise<string | null> {
  let timeoutId: NodeJS.Timeout;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error('Image generation timeout'));
    }, timeout);
  });

  try {
    const result = await Promise.race([
      model.generateContent(prompt),
      timeoutPromise
    ]);

    clearTimeout(timeoutId!);

    // Ensure response is ready before processing
    const response = await result.response;

    // Try multiple response formats
    const imagePart = response.candidates?.[0]?.content?.parts?.[0];

    // Format 1: inlineData (expected)
    if (imagePart?.inlineData?.data) {
      const mimeType = imagePart.inlineData.mimeType || 'image/png';
      const base64Data = imagePart.inlineData.data;
      return `data:${mimeType};base64,${base64Data}`;
    }

    // Format 2: fileData (possible alternative)
    if (imagePart?.fileData?.fileUri) {
      console.warn('Image returned as fileUri (not base64):', imagePart.fileData.fileUri);
      return imagePart.fileData.fileUri;
    }

    // Format 3: Check text response for debugging
    if (imagePart?.text) {
      console.warn('Image generation returned text instead of image:', imagePart.text);
    }

    // Log the actual response structure for debugging
    console.error('Unexpected image response structure:', JSON.stringify({
      candidates: response.candidates?.length || 0,
      parts: response.candidates?.[0]?.content?.parts?.length || 0,
      partKeys: imagePart ? Object.keys(imagePart) : []
    }, null, 2));

    // Return null with explicit error
    throw new Error('Image response missing expected data format');
  } catch (error) {
    clearTimeout(timeoutId!);
    throw error;
  }
}

export async function generateQuestImage(
  quest: Quest,
  timeout: number = 30000, // 30s timeout for Gemini 3 Pro Image
  retries: number = 2, // 2 retries for reliability
  adaptiveTimeout: boolean = true
): Promise<string | null> {
  let lastError: Error | null = null;

  // Adaptive timeout based on first successful generation
  let effectiveTimeout = timeout;
  if (adaptiveTimeout && firstImageGenerationTime !== null) {
    if (firstImageGenerationTime < 8000) {
      // First image was very fast (Flash model), reduce timeout slightly
      effectiveTimeout = 20000;
    } else if (firstImageGenerationTime < 15000) {
      // First image was reasonably fast, use moderate timeout
      effectiveTimeout = 25000;
    }
    // If first image took 15-30s, keep 30s timeout (Pro model)
  }

  // Try with retry logic on all failures
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

      // Use proper timeout wrapper
      const imageUrl = await generateWithTimeout(model, prompt, effectiveTimeout);

      if (imageUrl) {
        // Track first successful generation time for adaptive timeout
        if (firstImageGenerationTime === null && adaptiveTimeout) {
          firstImageGenerationTime = Date.now() - startTime;
        }
        return imageUrl;
      }

      // Null result - retry
      lastError = new Error('Image generation returned null');

    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      console.log(`Image generation attempt ${attempt + 1}/${retries + 1} failed:`, lastError.message);
    }

    // Retry on any error with adaptive backoff
    if (attempt < retries) {
      // Check if error is 503 overload - use longer backoff
      const isOverload = lastError?.message.includes('503') || lastError?.message.includes('overloaded');
      const baseWaitTime = isOverload ? 5000 : 2000; // 5s for overload, 2s for other errors
      const waitTime = baseWaitTime * (attempt + 1);

      console.log(`Retrying image generation in ${waitTime/1000}s...${isOverload ? ' (service overloaded)' : ''}`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }

  // All attempts failed
  console.error(`Image generation failed after ${retries + 1} attempts:`, lastError?.message);
  return null;
}

/**
 * Generate quest image with detailed error information
 * Used for enhanced error handling and retry UI
 */
export async function generateQuestImageWithDetails(
  quest: Quest,
  timeout: number = 30000, // 30s timeout for Gemini 3 Pro Image
  retries: number = 2, // 2 retries for reliability
  adaptiveTimeout: boolean = true
): Promise<ImageGenerationResult> {
  let lastError: Error | null = null;

  // Adaptive timeout based on first successful generation
  let effectiveTimeout = timeout;
  if (adaptiveTimeout && firstImageGenerationTime !== null) {
    if (firstImageGenerationTime < 8000) {
      // First image was very fast (Flash model), reduce timeout slightly
      effectiveTimeout = 20000;
    } else if (firstImageGenerationTime < 15000) {
      // First image was reasonably fast, use moderate timeout
      effectiveTimeout = 25000;
    }
    // If first image took 15-30s, keep 30s timeout (Pro model)
  }

  const overallStartTime = Date.now();

  // Try with retry logic on all failures
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

      // Use proper timeout wrapper
      const imageUrl = await generateWithTimeout(model, prompt, effectiveTimeout);

      if (imageUrl) {
        if (firstImageGenerationTime === null && adaptiveTimeout) {
          firstImageGenerationTime = Date.now() - startTime;
        }

        return {
          url: imageUrl,
          error: null,
          duration: Date.now() - overallStartTime
        };
      }

      // Null result - retry
      lastError = new Error('Image generation returned null');

    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      console.log(`Image generation attempt ${attempt + 1}/${retries + 1} failed:`, lastError.message);
    }

    // Retry on any error with adaptive backoff
    if (attempt < retries) {
      // Check if error is 503 overload - use longer backoff
      const isOverload = lastError?.message.includes('503') || lastError?.message.includes('overloaded');
      const baseWaitTime = isOverload ? 5000 : 2000; // 5s for overload, 2s for other errors
      const waitTime = baseWaitTime * (attempt + 1);

      console.log(`Retrying in ${waitTime/1000}s...${isOverload ? ' (service overloaded)' : ''}`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }

  // Determine error type from lastError
  let errorType: ImageGenerationError = 'unknown';
  if (lastError) {
    const msg = lastError.message.toLowerCase();
    if (msg.includes('timeout')) {
      errorType = 'timeout';
    } else if (msg.includes('503') || msg.includes('overload')) {
      errorType = 'overload';
    } else if (msg.includes('quota') || msg.includes('limit') || msg.includes('429')) {
      errorType = 'quota';
    }
  }

  return {
    url: null,
    error: errorType,
    duration: Date.now() - overallStartTime
  };
}