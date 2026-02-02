/**
 * Location Trivia Generation
 * Generates engaging location-based trivia facts using Gemini API
 * Runs in parallel with campaign generation to provide contextual loading messages
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { LocationData } from '@/types';

/**
 * Generate location-based trivia facts using Gemini API
 * Pre-generates during geocoding for instant display
 *
 * @param locationData - Location data with city/country
 * @returns Array of 4 short trivia facts
 */
export async function generateLocationTrivia(
  locationData: LocationData
): Promise<string[]> {
  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;

  if (!apiKey) {
    console.warn('Gemini API key not found, skipping trivia generation');
    return [];
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });

  const city = locationData.city || locationData.name;
  const country = locationData.country || '';
  const location = country ? `${city}, ${country}` : city;

  const prompt = `Generate 4 short, interesting trivia facts about ${location}.

Requirements:
- Each fact: 1 sentence, max 12 words
- Focus on culture, history, food, or unique features
- Make them surprising and fun
- Return ONLY facts, one per line, no numbering

Example:
The city is famous for its floating markets
Local dish combines French and Vietnamese flavors
Over 300 sunny days each year`;

  try {
    console.log('[Trivia] Generating trivia for:', location);
    const result = await model.generateContent(prompt);
    const response = result.response.text();

    // Parse response into array of facts
    const facts = response
      .split('\n')
      .map(f => f.trim())
      .filter(f => f.length > 0 && f.length < 150); // Filter valid facts

    const triviaFacts = facts.slice(0, 4); // Return max 4 facts (faster generation)
    console.log('[Trivia] Generated', triviaFacts.length, 'facts:', triviaFacts);
    return triviaFacts;
  } catch (error) {
    console.warn('[Trivia] Failed to generate location trivia:', error);
    return []; // Graceful degradation
  }
}
