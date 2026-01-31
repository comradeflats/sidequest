import { getModel } from './gemini';
import { costEstimator } from './cost-estimator';
import { Coordinates } from '@/types';

/**
 * Location Research - Rich context for Gemini 3's 1M context window
 * Generates detailed background information about quest locations
 */

export interface LocationResearch {
  placeName: string;
  historicalSignificance: string;  // 100-150 tokens
  architecturalDetails: string;    // 75-100 tokens
  culturalContext: string;         // 75-100 tokens
  mediaTips: string;               // 50-75 tokens
  estimatedTokens: number;         // Track contribution to context window
}

/**
 * Generate rich background research for a quest location
 * GEMINI 3 SHOWCASE: Adds 300-425 tokens per location to context window
 */
export async function generateLocationResearch(
  placeName: string,
  placeTypes: string[],
  formattedAddress: string
): Promise<LocationResearch> {
  const model = getModel('research');

  const prompt = `
    Generate concise background research for this location for a scavenger hunt game.

    Location: ${placeName}
    Types: ${placeTypes.join(', ')}
    Address: ${formattedAddress}

    Provide BRIEF, informative content in the following sections. Keep each section SHORT and punchy:

    1. HISTORICAL SIGNIFICANCE (2-3 sentences):
       - What is the historical importance of this location?
       - When was it built/established and why?
       - Any notable events or people associated with it?

    2. ARCHITECTURAL/DESIGN DETAILS (2-3 sentences):
       - Describe the architectural style or design features
       - Notable visual elements or unique characteristics

    3. CULTURAL CONTEXT (2-3 sentences):
       - Cultural or social significance to the local community
       - How locals interact with this space

    4. PHOTOGRAPHY/MEDIA TIPS (1-2 sentences):
       - Best angles or vantage points for photography/video
       - Lighting or timing tips

    Keep responses CONCISE and SCANNABLE. Avoid long paragraphs.

    Respond in JSON format:
    {
      "historicalSignificance": "string",
      "architecturalDetails": "string",
      "culturalContext": "string",
      "mediaTips": "string"
    }
  `;

  // Track input tokens
  costEstimator.trackGeminiInput(prompt.length);

  const result = await model.generateContent(prompt);
  const response = await result.response;
  const text = response.text();

  // Track output tokens
  costEstimator.trackGeminiOutput(text.length);

  try {
    const parsed = JSON.parse(text);

    // Estimate token contribution (rough: 4 chars per token)
    const estimatedTokens = Math.ceil(
      (parsed.historicalSignificance.length +
       parsed.architecturalDetails.length +
       parsed.culturalContext.length +
       parsed.mediaTips.length) / 4
    );

    return {
      placeName,
      historicalSignificance: parsed.historicalSignificance,
      architecturalDetails: parsed.architecturalDetails,
      culturalContext: parsed.culturalContext,
      mediaTips: parsed.mediaTips,
      estimatedTokens
    };
  } catch (error) {
    // Fallback with minimal content if generation fails
    console.error('Failed to parse location research:', error);
    return {
      placeName,
      historicalSignificance: `${placeName} is a notable location in the area.`,
      architecturalDetails: `This location features distinctive characteristics typical of ${placeTypes[0] || 'the area'}.`,
      culturalContext: `${placeName} is an important part of the local community.`,
      mediaTips: 'Look for interesting angles and good lighting when capturing this location.',
      estimatedTokens: 100
    };
  }
}

/**
 * Generate research for multiple locations in parallel
 * GEMINI 3 OPTIMIZATION: Batch generation for faster campaign creation
 */
export async function generateBatchLocationResearch(
  locations: Array<{
    name: string;
    types: string[];
    formattedAddress: string;
  }>
): Promise<LocationResearch[]> {
  // Generate all research in parallel for speed
  const researchPromises = locations.map(loc =>
    generateLocationResearch(loc.name, loc.types, loc.formattedAddress)
  );

  return Promise.all(researchPromises);
}
