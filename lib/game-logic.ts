import { getModel, generateQuestImage } from './gemini';
import { geocodeLocation, calculateDistance } from './location';
import { getQuestLocations } from './places';
import { Campaign, Quest, DistanceRange, DISTANCE_RANGES, PlaceData, Coordinates, AppealData, AppealResult, VerificationResult } from '../types';

export async function generateCampaign(
  location: string,
  type: 'short' | 'long',
  distanceRange: DistanceRange
): Promise<Campaign> {
  const questCount = type === 'short' ? 3 : 5;

  // STEP 1: Geocode the starting location
  console.log('[GeoSeeker] Geocoding location:', location);
  const locationData = await geocodeLocation(location);
  console.log('[GeoSeeker] Coordinates:', locationData.coordinates);

  // STEP 2: Get quest locations using Places API (with fallback to random coordinates)
  const questLocations = await getQuestLocations(
    locationData.coordinates,
    distanceRange,
    questCount
  );
  console.log('[GeoSeeker] Retrieved quest locations for', distanceRange, 'range');

  // Extract coordinates from quest locations (whether PlaceData or Coordinates)
  const questCoords: Coordinates[] = questLocations.map((loc) =>
    'placeId' in loc ? loc.coordinates : loc
  );

  // STEP 3: Calculate walking distances between consecutive points
  const startPoint = locationData.coordinates;
  const allPoints = [startPoint, ...questCoords];
  const distances: number[] = [];
  const durations: number[] = [];

  for (let i = 0; i < questCoords.length; i++) {
    const distanceData = await calculateDistance(allPoints[i], allPoints[i + 1]);
    distances.push(distanceData.distanceKm);
    durations.push(distanceData.durationMinutes);
  }

  const totalDistance = distances.reduce((sum, d) => sum + d, 0);
  const totalTime = durations.reduce((sum, d) => sum + d, 0);

  console.log(
    `[GeoSeeker] Total campaign: ${totalDistance.toFixed(1)}km, ~${totalTime} minutes walking`
  );

  // STEP 4: Generate campaign with Gemini AI using real places
  const model = getModel('campaign');
  const rangeConfig = DISTANCE_RANGES[distanceRange];

  // Build quest location information for AI prompt
  const questLocationInfo = questLocations.map((loc, i) => {
    const isPlace = 'placeId' in loc;
    if (isPlace) {
      const place = loc as PlaceData;
      return `Quest ${i + 1}: ${place.name}
        - Address: ${place.formattedAddress}
        - Coordinates: ${place.coordinates.lat.toFixed(4)}, ${place.coordinates.lng.toFixed(4)}
        - Types: ${place.types.join(', ')}
        - Distance from previous: ${distances[i].toFixed(1)}km, ~${durations[i]} min walking`;
    } else {
      const coords = loc as Coordinates;
      return `Quest ${i + 1}: Random location
        - Coordinates: ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}
        - Distance from previous: ${distances[i].toFixed(1)}km, ~${durations[i]} min walking`;
    }
  }).join('\n\n');

  const prompt = `
    You are an expert travel guide and game designer.
    Create a ${type} walking scavenger hunt campaign for a player in ${locationData.formattedAddress}.

    DISTANCE RANGE: ${rangeConfig.label}
    - Quest spacing: ${rangeConfig.minDistance}-${rangeConfig.maxDistance}km
    - Total quests: ${questCount}
    - Player will be exploring on foot

    QUEST LOCATIONS (Real places from Google Places API):
    ${questLocationInfo}

    For each quest location:
    - If a real place name is provided, create a quest specifically for that location
    - Make the objective relevant to the place type (museum, park, temple, etc.)
    - Create culturally relevant objectives that make sense for ${locationData.formattedAddress}
    - Make sure the photo objective is something actually visible and photographable at that location
    - Provide specific hints that help players find the exact spot
    - Ensure quests are appropriate for walking exploration

    The output MUST be a JSON object matching this structure:
    {
      "id": "unique-id",
      "location": "${location}",
      "type": "${type}",
      "quests": [
        {
          "id": "q1",
          "title": "string (exciting quest name referencing the place)",
          "narrative": "A flavor-text description of why the player is doing this quest",
          "objective": "A clear, 1-sentence instruction of what to photograph at this specific location",
          "secretCriteria": ["List of visual elements the photo MUST contain"],
          "locationHint": "Specific hint about the location (use the place name if available)",
          "difficulty": "easy | medium | hard"
        }
      ]
    }

    Make the quests feel like an exciting walking adventure through real places!
  `;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  const text = response.text();

  try {
    const campaignData = JSON.parse(text);

    // STEP 5: Enrich quest data with coordinates, distance, and place metadata
    const questsWithMetadata = campaignData.quests.map((quest: Quest, i: number) => {
      const location = questLocations[i];
      const isPlace = 'placeId' in location;

      return {
        ...quest,
        coordinates: questCoords[i],
        distanceFromPrevious: distances[i],
        estimatedDuration: durations[i],
        placeName: isPlace ? (location as PlaceData).name : undefined,
        placeTypes: isPlace ? (location as PlaceData).types : undefined,
      };
    });

    // STEP 6: Generate images for all quests in parallel
    console.log('[GeoSeeker] Generating quest images...');
    const questsWithImages = await Promise.all(
      questsWithMetadata.map(async (quest: Quest) => {
        const imageUrl = await generateQuestImage(quest);
        return {
          ...quest,
          imageUrl,
          imageGenerationFailed: !imageUrl,
        };
      })
    );

    return {
      ...campaignData,
      quests: questsWithImages,
      currentQuestIndex: 0,
      distanceRange: distanceRange,
      startCoordinates: locationData.coordinates,
      totalDistance: totalDistance,
      estimatedTotalTime: totalTime,
    };
  } catch (error) {
    console.error('[GeoSeeker] Failed to parse campaign JSON:', text);
    throw new Error('Failed to generate valid campaign JSON');
  }
}

// Helper function to calculate straight-line distance between two coordinates
function calculateStraightLineDistance(
  origin: Coordinates,
  destination: Coordinates
): { distanceMeters: number } {
  const R = 6371; // Earth's radius in km
  const dLat = ((destination.lat - origin.lat) * Math.PI) / 180;
  const dLng = ((destination.lng - origin.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((origin.lat * Math.PI) / 180) *
      Math.cos((destination.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distanceKm = R * c;
  return { distanceMeters: distanceKm * 1000 };
}

// Helper function to calculate GPS confidence factor
function calculateGpsConfidence(distanceMeters: number | null): number {
  if (!distanceMeters) return 0;

  // Confidence scoring:
  // 0-15m: 1.0 (perfect)
  // 15-30m: 0.8-1.0 (very high)
  // 30-50m: 0.5-0.8 (medium)
  // 50-100m: 0.2-0.5 (low)
  // >100m: 0-0.2 (very low)

  if (distanceMeters <= 15) return 1.0;
  if (distanceMeters <= 30) return 0.8 + (0.2 * (30 - distanceMeters) / 15);
  if (distanceMeters <= 50) return 0.5 + (0.3 * (50 - distanceMeters) / 20);
  if (distanceMeters <= 100) return 0.2 + (0.3 * (100 - distanceMeters) / 50);

  return Math.max(0, 0.2 * (1 - (distanceMeters - 100) / 200));
}

// Helper function to get GPS confidence label
function getGpsConfidenceLabel(confidence: number): string {
  if (confidence >= 0.9) return '🎯 (Excellent)';
  if (confidence >= 0.7) return '✓ (Good)';
  if (confidence >= 0.5) return '~ (Fair)';
  if (confidence >= 0.3) return '? (Uncertain)';
  return '✗ (Unreliable)';
}

export async function verifyPhoto(
  base64Image: string,
  objective: string,
  secretCriteria: string[],
  userGps?: Coordinates,
  targetGps?: Coordinates
): Promise<VerificationResult> {
  const model = getModel('verification'); // Gemini 3 Flash is great for vision speed

  // Calculate distance if GPS available
  let distanceFromTarget: number | undefined;
  if (userGps && targetGps) {
    const distanceData = calculateStraightLineDistance(userGps, targetGps);
    distanceFromTarget = distanceData.distanceMeters;
  }

  const prompt = `
    Analyze this image against the objective: "${objective}".
    Specifically look for these criteria: ${secretCriteria.join(', ')}.

    Respond in JSON format:
    {
      "success": boolean,
      "feedback": "A witty, personality-driven comment on the photo. If it failed, give a hint.",
      "appealable": boolean (true if close but not quite right, false if completely wrong)
    }
  `;

  // Note: base64Image should be the data part only, e.g. "data:image/jpeg;base64,..."
  const imagePart = {
    inlineData: {
      data: base64Image.split(',')[1],
      mimeType: 'image/jpeg',
    },
  };

  const result = await model.generateContent([prompt, imagePart]);
  const response = await result.response;
  const text = response.text();

  // Since the model is configured with responseMimeType: "application/json",
  // the response is already pure JSON, no need for regex extraction
  try {
    const parsed = JSON.parse(text);
    return {
      ...parsed,
      distanceFromTarget,
      mediaType: 'photo'
    };
  } catch (error) {
    console.error('[GeoSeeker] Failed to parse photo verification JSON:', text);
    throw new Error('Failed to verify photo - invalid JSON response');
  }
}

export async function verifyPhotoWithAppeal(
  base64Image: string,
  objective: string,
  secretCriteria: string[],
  appealData: AppealData,
  questCoordinates: Coordinates
): Promise<AppealResult> {
  const model = getModel('verification');

  // Calculate GPS confidence factor
  const gpsConfidence = calculateGpsConfidence(appealData.distanceFromTarget);

  const prompt = `
    You are re-evaluating a photo after the user appealed your initial rejection.

    ORIGINAL OBJECTIVE: "${objective}"
    ORIGINAL CRITERIA: ${secretCriteria.join(', ')}

    USER'S APPEAL:
    "${appealData.userExplanation}"

    GPS CONTEXT:
    - User is ${appealData.distanceFromTarget}m from target location
    - GPS Confidence: ${gpsConfidence.toFixed(2)} ${getGpsConfidenceLabel(gpsConfidence)}
    ${gpsConfidence > 0.8 ? '- STRONG SIGNAL: User is very close to target!' : ''}

    INSTRUCTIONS:
    1. Consider if the user's explanation reveals legitimate environmental differences
       (e.g., "The station here is green/yellow, not blue/yellow")
    2. If GPS shows user is <30m from target, be more lenient with color/minor variations
    3. However, if the photo shows COMPLETELY WRONG object (e.g., tree instead of building), reject
    4. Balance: Real-world flexibility vs. preventing cheating

    Respond in JSON format:
    {
      "success": boolean,
      "feedback": "Witty response acknowledging their context or explaining continued rejection",
      "reasoning": "Internal explanation of your decision",
      "acceptedContext": boolean (did user's explanation help?),
      "gpsWasHelpful": boolean (did GPS proximity influence your decision?)
    }
  `;

  const imagePart = {
    inlineData: {
      data: base64Image.split(',')[1],
      mimeType: 'image/jpeg',
    },
  };

  const result = await model.generateContent([prompt, imagePart]);
  const response = await result.response;
  const text = response.text();

  try {
    return JSON.parse(text);
  } catch (error) {
    console.error('[GeoSeeker] Failed to parse appeal verification JSON:', text);
    throw new Error('Failed to verify appeal - invalid JSON response');
  }
}
