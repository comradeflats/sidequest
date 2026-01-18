import { getModel, generateQuestImage } from './gemini';
import { geocodeLocation, calculateDistance } from './location';
import { getQuestLocations } from './places';
import { costEstimator } from './cost-estimator';
import { Campaign, Quest, DistanceRange, DISTANCE_RANGES, PlaceData, Coordinates, AppealData, AppealResult, VerificationResult, CampaignOptions, MediaCaptureData, QuestType, MediaRequirements } from '../types';

/**
 * Build quest type instructions for campaign generation prompt
 */
function buildQuestTypeInstructions(enableVideo: boolean, enableAudio: boolean, guaranteedMix: boolean = false): string {
  // Guaranteed Mix mode: exactly 1 photo, 1 video, 1 audio quest
  if (guaranteedMix) {
    return `
    GUARANTEED MIX MODE - STRICT REQUIREMENT:
    You MUST create exactly:
    - 1 PHOTO quest (questType: "PHOTO", mediaRequirements: null)
    - 1 VIDEO quest (questType: "VIDEO", mediaRequirements: { minDuration: 5, maxDuration: 30, description: "5-30 second video" })
    - 1 AUDIO quest (questType: "AUDIO", mediaRequirements: { minDuration: 10, maxDuration: 60, description: "10-60 second recording" })

    Assign quest types strategically based on which location best fits each type:
    - PHOTO: Best for landmarks, signs, statues, building facades, specific visual details
    - VIDEO: Best for fountains, waterfalls, street performers, busy intersections, moving sculptures
    - AUDIO: Best for markets, train stations, busy streets, nature areas, unique soundscapes

    The order of quests should follow the natural route, not be grouped by type.
    `;
  }

  if (!enableVideo && !enableAudio) {
    return `
    QUEST TYPES:
    - All quests should be PHOTO quests (questType: "PHOTO")
    - mediaRequirements should be null for PHOTO quests
    - Objectives should describe what to photograph
    `;
  }

  const availableTypes = ['PHOTO'];
  if (enableVideo) availableTypes.push('VIDEO');
  if (enableAudio) availableTypes.push('AUDIO');

  let instructions = `
    QUEST TYPES ENABLED: ${availableTypes.join(', ')}

    You should assign quest types strategically based on what makes sense for each location:
    `;

  if (enableVideo) {
    instructions += `
    VIDEO QUESTS (questType: "VIDEO"):
    - Best for: Fountains, waterfalls, street performers, busy intersections, moving sculptures
    - Objective should describe what to record (motion, activity, panning shot)
    - Example objectives: "Record 10 seconds of the fountain in motion", "Pan across the plaza architecture"
    - mediaRequirements: { minDuration: 5, maxDuration: 30, description: "5-30 second video" }
    `;
  }

  if (enableAudio) {
    instructions += `
    AUDIO QUESTS (questType: "AUDIO"):
    - Best for: Markets, train stations, busy streets, nature areas, unique soundscapes
    - Objective should describe what sounds to capture or ask for a verbal description
    - Example objectives: "Record 30 seconds of ambient market sounds", "Describe what you see in 30 seconds"
    - mediaRequirements: { minDuration: 10, maxDuration: 60, description: "10-60 second recording" }
    `;
  }

  instructions += `
    PHOTO QUESTS (questType: "PHOTO"):
    - Good for: Landmarks, signs, statues, building facades, specific visual details
    - mediaRequirements should be null for PHOTO quests

    DISTRIBUTION:
    - Mix quest types naturally based on location suitability
    - Ensure at least one PHOTO quest for accessibility
    - Don't force a quest type if it doesn't fit the location
    `;

  return instructions;
}

export async function generateCampaign(
  location: string,
  type: 'short' | 'long',
  distanceRange: DistanceRange,
  options?: CampaignOptions
): Promise<Campaign> {
  const enableVideoQuests = options?.enableVideoQuests || false;
  const enableAudioQuests = options?.enableAudioQuests || false;
  const guaranteedMix = options?.guaranteedMix || false;
  const questCount = type === 'short' ? 3 : 5;

  // STEP 1: Geocode the starting location
  console.log('[SideQuest] Geocoding location:', location);
  const locationData = await geocodeLocation(location);
  console.log('[SideQuest] Coordinates:', locationData.coordinates);

  // STEP 2: Get quest locations using Places API (with fallback to random coordinates)
  const questLocations = await getQuestLocations(
    locationData.coordinates,
    distanceRange,
    questCount
  );
  console.log('[SideQuest] Retrieved quest locations for', distanceRange, 'range');

  // Extract coordinates from quest locations (whether PlaceData or Coordinates)
  const questCoords: Coordinates[] = questLocations.map((loc) =>
    'placeId' in loc ? loc.coordinates : loc
  );

  // STEP 3: Calculate walking distances between consecutive points (in parallel for speed)
  const startPoint = locationData.coordinates;
  const allPoints = [startPoint, ...questCoords];

  // Parallel distance calculations for faster campaign generation
  const distancePromises = questCoords.map((_, i) =>
    calculateDistance(allPoints[i], allPoints[i + 1])
  );
  const distanceResults = await Promise.all(distancePromises);

  const distances: number[] = distanceResults.map(r => r.distanceKm);
  const durations: number[] = distanceResults.map(r => r.durationMinutes);

  const totalDistance = distances.reduce((sum, d) => sum + d, 0);
  const totalTime = durations.reduce((sum, d) => sum + d, 0);

  console.log(
    `[SideQuest] Total campaign: ${totalDistance.toFixed(1)}km, ~${totalTime} minutes walking`
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

  // Build quest type instructions based on enabled options
  const questTypeInstructions = buildQuestTypeInstructions(enableVideoQuests, enableAudioQuests, guaranteedMix);

  const prompt = `
    You are an expert travel guide and game designer.
    Create a ${type} walking scavenger hunt campaign for a player in ${locationData.formattedAddress}.

    DISTANCE RANGE: ${rangeConfig.label}
    - Quest spacing: ${rangeConfig.minDistance}-${rangeConfig.maxDistance}km
    - Total quests: ${questCount}
    - Player will be exploring on foot

    QUEST LOCATIONS (Real places from Google Places API):
    ${questLocationInfo}

    ${questTypeInstructions}

    For each quest location:
    - If a real place name is provided, create a quest specifically for that location
    - Make the objective relevant to the place type (museum, park, temple, etc.)
    - Create culturally relevant objectives that make sense for ${locationData.formattedAddress}
    - The objective should match the questType (photo, video, or audio)
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
          "objective": "A clear, 1-sentence instruction of what to capture (photo/video/audio) at this specific location",
          "secretCriteria": ["List of elements the submission MUST contain - visual for photo/video, audible for audio"],
          "locationHint": "Specific hint about the location (use the place name if available)",
          "difficulty": "easy | medium | hard",
          "questType": "PHOTO | VIDEO | AUDIO",
          "mediaRequirements": {
            "minDuration": number (seconds, only for VIDEO/AUDIO),
            "maxDuration": number (seconds, only for VIDEO/AUDIO),
            "description": "string describing the requirement"
          }
        }
      ]
    }

    Make the quests feel like an exciting walking adventure through real places!
  `;

  // Track Input Tokens
  costEstimator.trackGeminiInput(prompt.length);

  const result = await model.generateContent(prompt);
  const response = await result.response;
  const text = response.text();

  // Track Output Tokens
  costEstimator.trackGeminiOutput(text.length);

  try {
    const campaignData = JSON.parse(text);

    // STEP 5: Enrich quest data with coordinates, distance, and place metadata
    const questsWithMetadata = campaignData.quests.map((quest: Quest, i: number) => {
      const location = questLocations[i];
      const isPlace = 'placeId' in location;

      return {
        ...quest,
        questType: quest.questType || 'PHOTO',  // Default to PHOTO if not specified
        mediaRequirements: quest.questType === 'PHOTO' ? undefined : quest.mediaRequirements,
        coordinates: questCoords[i],
        distanceFromPrevious: distances[i],
        estimatedDuration: durations[i],
        placeName: isPlace ? (location as PlaceData).name : undefined,
        placeTypes: isPlace ? (location as PlaceData).types : undefined,
      };
    });

    // STEP 6: Generate images for all quests in parallel
    console.log('[SideQuest] Generating quest images...');
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
      enableVideoQuests,
      enableAudioQuests,
      guaranteedMix,
    };
  } catch (error) {
    console.error('[SideQuest] Failed to parse campaign JSON:', text);
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
// Now factors in GPS accuracy - poor accuracy increases effective distance
function calculateGpsConfidence(distanceMeters: number | null, accuracyMeters: number = 0): number {
  if (!distanceMeters) return 0;

  // If GPS accuracy is poor, we need to account for uncertainty
  // Effective distance is the worst case: reported distance + half the accuracy radius
  // This penalizes poor GPS readings while still giving credit for proximity
  const effectiveDistance = accuracyMeters > 0
    ? Math.max(distanceMeters, distanceMeters + accuracyMeters * 0.3)
    : distanceMeters;

  // Confidence scoring (using effective distance):
  // 0-15m: 1.0 (perfect)
  // 15-30m: 0.8-1.0 (very high)
  // 30-50m: 0.5-0.8 (medium)
  // 50-100m: 0.2-0.5 (low)
  // >100m: 0-0.2 (very low)

  if (effectiveDistance <= 15) return 1.0;
  if (effectiveDistance <= 30) return 0.8 + (0.2 * (30 - effectiveDistance) / 15);
  if (effectiveDistance <= 50) return 0.5 + (0.3 * (50 - effectiveDistance) / 20);
  if (effectiveDistance <= 100) return 0.2 + (0.3 * (100 - effectiveDistance) / 50);

  return Math.max(0, 0.2 * (1 - (effectiveDistance - 100) / 200));
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
  targetGps?: Coordinates,
  gpsAccuracy?: number
): Promise<VerificationResult> {
  const model = getModel('verification'); // Gemini 3 Flash is great for vision speed

  // Calculate distance if GPS available
  let distanceFromTarget: number | undefined;
  let gpsConfidence: number | undefined;
  if (userGps && targetGps) {
    const distanceData = calculateStraightLineDistance(userGps, targetGps);
    distanceFromTarget = distanceData.distanceMeters;
    gpsConfidence = calculateGpsConfidence(distanceFromTarget, gpsAccuracy);
    console.log('[Verification] GPS boost check:', {
      distance: `${distanceFromTarget.toFixed(0)}m`,
      accuracy: gpsAccuracy ? `±${gpsAccuracy.toFixed(0)}m` : 'unknown',
      confidence: gpsConfidence.toFixed(2)
    });
  }

  // Build GPS context for prompt if user is close to target
  const gpsBoostContext = gpsConfidence && gpsConfidence >= 0.5
    ? `\n\nGPS CONTEXT: User is ${distanceFromTarget?.toFixed(0)}m from target location. GPS confidence: ${(gpsConfidence * 100).toFixed(0)}%. If the photo appears to be at a similar location type, be more lenient.`
    : '';

  const prompt = `
    Analyze this image against the objective: "${objective}".
    Specifically look for these criteria: ${secretCriteria.join(', ')}.${gpsBoostContext}

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

  // Track Input Tokens (approx for text) + Image Input?
  // Gemini 1.5 Flash vision input is token based.
  // 1 image = 258 tokens (approx)
  costEstimator.trackGeminiInput(prompt.length + 1000); // Adding ~1000 chars buffer for image token equivalent

  const result = await model.generateContent([prompt, imagePart]);
  const response = await result.response;
  const text = response.text();

  // Track Output Tokens
  costEstimator.trackGeminiOutput(text.length);

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
    console.error('[SideQuest] Failed to parse photo verification JSON:', text);
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

  // Track Input Tokens (approx text + image)
  costEstimator.trackGeminiInput(prompt.length + 1000);

  const result = await model.generateContent([prompt, imagePart]);
  const response = await result.response;
  const text = response.text();

  // Track Output Tokens
  costEstimator.trackGeminiOutput(text.length);

  try {
    return JSON.parse(text);
  } catch (error) {
    console.error('[SideQuest] Failed to parse appeal verification JSON:', text);
    throw new Error('Failed to verify appeal - invalid JSON response');
  }
}

/**
 * Verify a video submission against quest objectives
 * Uses Gemini's native video understanding capabilities
 */
export async function verifyVideo(
  base64Video: string,
  mimeType: string,
  duration: number,
  objective: string,
  secretCriteria: string[],
  mediaRequirements?: MediaRequirements,
  userGps?: Coordinates,
  targetGps?: Coordinates,
  gpsAccuracy?: number
): Promise<VerificationResult> {
  const model = getModel('verification');

  // Calculate distance if GPS available
  let distanceFromTarget: number | undefined;
  let gpsConfidence: number | undefined;
  if (userGps && targetGps) {
    const distanceData = calculateStraightLineDistance(userGps, targetGps);
    distanceFromTarget = distanceData.distanceMeters;
    gpsConfidence = calculateGpsConfidence(distanceFromTarget, gpsAccuracy);
    console.log('[Verification] GPS boost check (video):', {
      distance: `${distanceFromTarget.toFixed(0)}m`,
      accuracy: gpsAccuracy ? `±${gpsAccuracy.toFixed(0)}m` : 'unknown',
      confidence: gpsConfidence.toFixed(2)
    });
  }

  // Build GPS context for prompt if user is close to target
  const gpsBoostContext = gpsConfidence && gpsConfidence >= 0.5
    ? `\n\nGPS CONTEXT: User is ${distanceFromTarget?.toFixed(0)}m from target location. GPS confidence: ${(gpsConfidence * 100).toFixed(0)}%. If the video appears to be at a similar location type, be more lenient.`
    : '';

  // Check duration requirements
  const minDuration = mediaRequirements?.minDuration || 5;
  const maxDuration = mediaRequirements?.maxDuration || 30;

  if (duration < minDuration) {
    return {
      success: false,
      feedback: `Your video is too short! We need at least ${minDuration} seconds to properly analyze the scene. Try recording a bit longer.`,
      appealable: false,
      distanceFromTarget,
      mediaType: 'video'
    };
  }

  if (duration > maxDuration) {
    return {
      success: false,
      feedback: `Your video is too long! Keep it under ${maxDuration} seconds for better analysis. Sometimes less is more!`,
      appealable: false,
      distanceFromTarget,
      mediaType: 'video'
    };
  }

  const prompt = `
    Analyze this video against the objective: "${objective}".
    Specifically look for these criteria: ${secretCriteria.join(', ')}.${gpsBoostContext}

    VIDEO ANALYSIS REQUIREMENTS:
    1. Verify the video shows the requested subject/location
    2. Check for actual motion/activity (not a static image recorded as video)
    3. Assess if the video captures what was requested

    Duration of video: ${duration} seconds

    Respond in JSON format:
    {
      "success": boolean,
      "feedback": "A witty, personality-driven comment on the video. If it failed, give a hint.",
      "appealable": boolean (true if close but not quite right, false if completely wrong),
      "hasMotion": boolean (did the video contain actual motion/activity?)
    }
  `;

  const videoPart = {
    inlineData: {
      data: base64Video.split(',')[1],
      mimeType: mimeType || 'video/webm',
    },
  };

  // Track video input cost (~300 tokens/second)
  const videoTokens = Math.ceil(duration * 300);
  costEstimator.trackGeminiInput(prompt.length);
  costEstimator.trackGeminiVideoInput(videoTokens);

  const result = await model.generateContent([prompt, videoPart]);
  const response = await result.response;
  const text = response.text();

  costEstimator.trackGeminiOutput(text.length);

  try {
    const parsed = JSON.parse(text);
    return {
      ...parsed,
      distanceFromTarget,
      mediaType: 'video'
    };
  } catch (error) {
    console.error('[SideQuest] Failed to parse video verification JSON:', text);
    throw new Error('Failed to verify video - invalid JSON response');
  }
}

/**
 * Verify an audio submission against quest objectives
 * Uses Gemini's native audio understanding capabilities
 */
export async function verifyAudio(
  base64Audio: string,
  mimeType: string,
  duration: number,
  objective: string,
  secretCriteria: string[],
  mediaRequirements?: MediaRequirements,
  userGps?: Coordinates,
  targetGps?: Coordinates,
  gpsAccuracy?: number
): Promise<VerificationResult> {
  const model = getModel('verification');

  // Calculate distance if GPS available
  let distanceFromTarget: number | undefined;
  let gpsConfidence: number | undefined;
  if (userGps && targetGps) {
    const distanceData = calculateStraightLineDistance(userGps, targetGps);
    distanceFromTarget = distanceData.distanceMeters;
    gpsConfidence = calculateGpsConfidence(distanceFromTarget, gpsAccuracy);
    console.log('[Verification] GPS boost check (audio):', {
      distance: `${distanceFromTarget.toFixed(0)}m`,
      accuracy: gpsAccuracy ? `±${gpsAccuracy.toFixed(0)}m` : 'unknown',
      confidence: gpsConfidence.toFixed(2)
    });
  }

  // Build GPS context for prompt if user is close to target
  const gpsBoostContext = gpsConfidence && gpsConfidence >= 0.5
    ? `\n\nGPS CONTEXT: User is ${distanceFromTarget?.toFixed(0)}m from target location. GPS confidence: ${(gpsConfidence * 100).toFixed(0)}%. If the audio appears to be from a similar location type, be more lenient.`
    : '';

  // Check duration requirements
  const minDuration = mediaRequirements?.minDuration || 10;
  const maxDuration = mediaRequirements?.maxDuration || 60;

  if (duration < minDuration) {
    return {
      success: false,
      feedback: `Your audio recording is too short! We need at least ${minDuration} seconds to capture the soundscape. Let it roll a bit longer.`,
      appealable: false,
      distanceFromTarget,
      mediaType: 'audio'
    };
  }

  if (duration > maxDuration) {
    return {
      success: false,
      feedback: `Your audio is too long! Keep it under ${maxDuration} seconds. We just need a snapshot of the sound.`,
      appealable: false,
      distanceFromTarget,
      mediaType: 'audio'
    };
  }

  const prompt = `
    Analyze this audio recording against the objective: "${objective}".
    Specifically listen for these criteria: ${secretCriteria.join(', ')}.${gpsBoostContext}

    AUDIO ANALYSIS REQUIREMENTS:
    1. If this is a verbal description, assess if the description matches the location/scene
    2. If this is ambient sound, verify characteristic sounds are present
    3. Check for relevant audio content that matches the quest objective

    Duration of audio: ${duration} seconds

    Respond in JSON format:
    {
      "success": boolean,
      "feedback": "A witty, personality-driven comment on the audio. If it failed, give a hint.",
      "appealable": boolean (true if close but not quite right, false if completely wrong),
      "transcription": "Brief summary of what was heard (speech or ambient sounds)"
    }
  `;

  const audioPart = {
    inlineData: {
      data: base64Audio.split(',')[1],
      mimeType: mimeType || 'audio/webm',
    },
  };

  // Track audio input cost (~32 tokens/second)
  const audioTokens = Math.ceil(duration * 32);
  costEstimator.trackGeminiInput(prompt.length);
  costEstimator.trackGeminiAudioInput(audioTokens);

  const result = await model.generateContent([prompt, audioPart]);
  const response = await result.response;
  const text = response.text();

  costEstimator.trackGeminiOutput(text.length);

  try {
    const parsed = JSON.parse(text);
    return {
      ...parsed,
      distanceFromTarget,
      mediaType: 'audio'
    };
  } catch (error) {
    console.error('[SideQuest] Failed to parse audio verification JSON:', text);
    throw new Error('Failed to verify audio - invalid JSON response');
  }
}

/**
 * Unified media verification router
 * Routes to the appropriate verification function based on media type
 */
export async function verifyMedia(
  captureData: MediaCaptureData,
  objective: string,
  secretCriteria: string[],
  mediaRequirements?: MediaRequirements,
  userGps?: Coordinates,
  targetGps?: Coordinates,
  gpsAccuracy?: number
): Promise<VerificationResult> {
  switch (captureData.type) {
    case 'video':
      return verifyVideo(
        captureData.data,
        captureData.mimeType || 'video/webm',
        captureData.duration || 0,
        objective,
        secretCriteria,
        mediaRequirements,
        userGps,
        targetGps,
        gpsAccuracy
      );

    case 'audio':
      return verifyAudio(
        captureData.data,
        captureData.mimeType || 'audio/webm',
        captureData.duration || 0,
        objective,
        secretCriteria,
        mediaRequirements,
        userGps,
        targetGps,
        gpsAccuracy
      );

    case 'photo':
    default:
      return verifyPhoto(
        captureData.data,
        objective,
        secretCriteria,
        userGps,
        targetGps,
        gpsAccuracy
      );
  }
}

/**
 * Verify video/audio with appeal (re-evaluation)
 */
export async function verifyMediaWithAppeal(
  captureData: MediaCaptureData,
  objective: string,
  secretCriteria: string[],
  appealData: AppealData,
  questCoordinates: Coordinates,
  mediaRequirements?: MediaRequirements
): Promise<AppealResult> {
  // For video/audio appeals, we use a similar approach to photo appeals
  const model = getModel('verification');

  const gpsConfidence = calculateGpsConfidence(appealData.distanceFromTarget);

  const mediaTypeLabel = captureData.type === 'video' ? 'video' :
                         captureData.type === 'audio' ? 'audio recording' : 'photo';

  const prompt = `
    You are re-evaluating a ${mediaTypeLabel} after the user appealed your initial rejection.

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
    2. If GPS shows user is <30m from target, be more lenient with variations
    3. However, if the ${mediaTypeLabel} shows COMPLETELY WRONG content, reject
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

  let mediaPart;
  if (captureData.type === 'video') {
    mediaPart = {
      inlineData: {
        data: captureData.data.split(',')[1],
        mimeType: captureData.mimeType || 'video/webm',
      },
    };
    // Track video input for appeal
    const videoTokens = Math.ceil((captureData.duration || 10) * 300);
    costEstimator.trackGeminiVideoInput(videoTokens);
  } else if (captureData.type === 'audio') {
    mediaPart = {
      inlineData: {
        data: captureData.data.split(',')[1],
        mimeType: captureData.mimeType || 'audio/webm',
      },
    };
    // Track audio input for appeal
    const audioTokens = Math.ceil((captureData.duration || 10) * 32);
    costEstimator.trackGeminiAudioInput(audioTokens);
  } else {
    mediaPart = {
      inlineData: {
        data: captureData.data.split(',')[1],
        mimeType: 'image/jpeg',
      },
    };
  }

  costEstimator.trackGeminiInput(prompt.length + 1000);

  const result = await model.generateContent([prompt, mediaPart]);
  const response = await result.response;
  const text = response.text();

  costEstimator.trackGeminiOutput(text.length);

  try {
    return JSON.parse(text);
  } catch (error) {
    console.error('[SideQuest] Failed to parse media appeal verification JSON:', text);
    throw new Error('Failed to verify appeal - invalid JSON response');
  }
}
