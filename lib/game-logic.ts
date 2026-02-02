import { getModel, generateQuestImage } from './gemini';
import { geocodeLocation, calculateDistance } from './location';
import { getQuestLocations } from './places';
import { costEstimator } from './cost-estimator';
import { generateBatchLocationResearch } from './location-research';
import { generationTracker } from './generation-tracker';
import { Campaign, Quest, DistanceRange, DISTANCE_RANGES, PlaceData, Coordinates, AppealData, AppealResult, VerificationResult, CampaignOptions, MediaCaptureData, QuestType, MediaRequirements, LocationResearch, CampaignReasoning, GPS_DISTANCE_THRESHOLDS } from '../types';

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

    CRITICAL - QUEST SPECIFICITY REQUIREMENTS:
    All objectives MUST be specific and AI-verifiable. Vague objectives are NOT acceptable.

    VIDEO QUESTS - REQUIRE SPECIFIC VISIBLE ACTIONS:
    GOOD examples (specific, verifiable):
    - "Record surfers catching a wave at the beach"
    - "Capture a train arriving at the platform"
    - "Film the fountain's water jets cycling through their pattern"
    - "Record pigeons taking off from the plaza"
    - "Capture pedestrians crossing at the busy intersection"
    BAD examples (too vague, easy to fake):
    - "Record the area" ❌
    - "Film the scenery" ❌
    - "Capture the location" ❌

    AUDIO QUESTS - REQUIRE SPECIFIC IDENTIFIABLE SOUNDS:
    GOOD examples (specific, verifiable):
    - "Record the church bells ringing"
    - "Capture the sound of seagulls at the harbor"
    - "Record the espresso machine hissing and café chatter"
    - "Capture the train announcement over the PA system"
    - "Record street musicians performing"
    BAD examples (too vague, easy to fake):
    - "Record ambient sounds" ❌
    - "Capture the atmosphere" ❌
    - "Record background noise" ❌

    PHOTO QUESTS - REQUIRE SPECIFIC VISUAL ELEMENTS:
    - Must reference identifiable landmarks, signs, architectural features
    - Should be clearly verifiable by AI vision analysis

    IMPORTANT GUIDELINES:
    - Objectives should showcase Gemini's multimodal understanding capabilities
    - Quests must be non-intrusive (NO photographing strangers' faces, NO entering private spaces)
    - The AI must be able to definitively verify the submission matches the objective

    The order of quests should follow the natural route, not be grouped by type.
    `;
  }

  if (!enableVideo && !enableAudio) {
    return `
    QUEST TYPES:
    - All quests should be PHOTO quests (questType: "PHOTO")
    - mediaRequirements should be null for PHOTO quests
    - Objectives should describe specific visual elements to photograph (not vague like "capture the area")
    `;
  }

  const availableTypes = ['PHOTO'];
  if (enableVideo) availableTypes.push('VIDEO');
  if (enableAudio) availableTypes.push('AUDIO');

  let instructions = `
    QUEST TYPES ENABLED: ${availableTypes.join(', ')}

    CRITICAL - ALL OBJECTIVES MUST BE SPECIFIC AND AI-VERIFIABLE:
    Avoid vague objectives like "record the area" or "capture ambient sounds" - these are too easy to fake!

    You should assign quest types strategically based on what makes sense for each location:
    `;

  if (enableVideo) {
    instructions += `
    VIDEO QUESTS (questType: "VIDEO"):
    - Best for: Fountains, waterfalls, street performers, busy intersections, moving sculptures
    - Objective MUST describe specific visible motion/action to capture
    - GOOD: "Record surfers catching a wave", "Capture the fountain jets cycling", "Film a train arriving"
    - BAD: "Record the area", "Film the scenery" (too vague!)
    - mediaRequirements: { minDuration: 5, maxDuration: 30, description: "5-30 second video" }
    `;
  }

  if (enableAudio) {
    instructions += `
    AUDIO QUESTS (questType: "AUDIO"):
    - Best for: Markets, train stations, busy streets, nature areas, unique soundscapes
    - Objective MUST describe specific identifiable sounds to capture
    - GOOD: "Record church bells ringing", "Capture seagulls at the harbor", "Record the espresso machine"
    - BAD: "Record ambient sounds", "Capture the atmosphere" (too vague!)
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

    REMEMBER: All quests must be non-intrusive (no photographing strangers, no entering private spaces)
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

  const startTime = Date.now();
  console.log('⏱️ Campaign generation started');

  // Start generation tracking
  generationTracker.startGeneration();

  try {
    // STEP 1: Geocode the starting location
    generationTracker.startStep(1, { apiCalls: 1 });
    const step1Start = Date.now();
    const locationData = await geocodeLocation(location);
    const step1Duration = Date.now() - step1Start;
    generationTracker.completeStep(1, { apiCalls: 1, cost: 0.005 });
    console.log(`✅ Step 1 (Geocode): ${step1Duration}ms`);

    // STEP 2: Get quest locations using Places API (with fallback to random coordinates)
    generationTracker.startStep(2, { apiCalls: 1 });
    const step2Start = Date.now();
    const questLocations = await getQuestLocations(
      locationData.coordinates,
      distanceRange,
      questCount
    );
    const step2Duration = Date.now() - step2Start;
    generationTracker.completeStep(2, { apiCalls: 1, cost: 0.017 });
    console.log(`✅ Step 2 (Places API): ${step2Duration}ms`);

  // Extract coordinates from quest locations (whether PlaceData or Coordinates)
  const questCoords: Coordinates[] = questLocations.map((loc) =>
    'placeId' in loc ? loc.coordinates : loc
  );

  // STEP 3: Calculate walking distances between consecutive points (in parallel for speed)
  const startPoint = locationData.coordinates;
  const allPoints = [startPoint, ...questCoords];

    // STEP 3: Parallel distance calculations for faster campaign generation
    generationTracker.startStep(3, { apiCalls: questCoords.length });
    const step3Start = Date.now();
    const distancePromises = questCoords.map((_, i) =>
      calculateDistance(allPoints[i], allPoints[i + 1])
    );
    const distanceResults = await Promise.all(distancePromises);
    const step3Duration = Date.now() - step3Start;
    generationTracker.completeStep(3, { apiCalls: questCoords.length, cost: questCoords.length * 0.005 });
    console.log(`✅ Step 3 (Distance calculations): ${step3Duration}ms`);

  const distances: number[] = distanceResults.map(r => r.distanceKm);
  const durations: number[] = distanceResults.map(r => r.durationMinutes);

  const totalDistance = distances.reduce((sum, d) => sum + d, 0);
  const totalTime = durations.reduce((sum, d) => sum + d, 0);

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

    GEMINI 3 CONTEXT WINDOW FEATURE - INCLUDE YOUR REASONING:
    To demonstrate Gemini 3's extended thinking capability, also provide your design reasoning:
    1. Why did you select each specific location for its quest?
    2. How did you determine the difficulty progression across quests?
    3. Why did you choose specific media types (photo/video/audio) for each quest?
    4. What makes each criterion verifiable and why did you choose those specific criteria?

    The output MUST be a JSON object matching this structure:
    {
      "id": "unique-id",
      "location": "${location}",
      "type": "${type}",
      "reasoning": {
        "locationSelection": ["Reason for quest 1 location", "Reason for quest 2 location", ...],
        "difficultyProgression": "Overall reasoning for how difficulty progresses",
        "mediaTypeChoices": ["Why quest 1 uses its media type", "Why quest 2 uses its media type", ...],
        "criteriaDesign": ["Why quest 1's criteria were chosen", "Why quest 2's criteria were chosen", ...]
      },
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

  // OPTIMIZATION: Prepare location research in parallel with campaign generation
  // Only generate research for real places (not random coordinates)
  const placesToResearch = questLocations
    .filter((loc): loc is PlaceData => 'placeId' in loc)
    .map(place => ({
      name: place.name,
      types: place.types,
      formattedAddress: place.formattedAddress
    }));

    // STEP 4 & 5: Run campaign generation and location research in parallel for 5-10s speedup
    generationTracker.startStep(4, { apiCalls: 1 });
    generationTracker.startStep(5, { apiCalls: placesToResearch.length });
    const step4Start = Date.now();
    const [campaignResult, locationResearchData] = await Promise.all([
      // Campaign generation
      (async () => {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
      })(),
      // Location research (parallel)
      (async () => {
        if (placesToResearch.length > 0) {
          try {
            return await generateBatchLocationResearch(placesToResearch);
          } catch (error) {
            console.error('Failed to generate location research:', error);
            return [];
          }
        }
        return [];
      })()
    ]);
    const step4Duration = Date.now() - step4Start;

    // Track campaign generation completion (Step 4)
    const campaignTokens = Math.ceil((prompt.length + campaignResult.length) / 4);
    const campaignCost = (prompt.length / 4 / 1_000_000) * 0.075 + (campaignResult.length / 4 / 1_000_000) * 0.30;
    generationTracker.completeStep(4, { apiCalls: 1, tokenCount: campaignTokens, cost: campaignCost });

    // Track location research completion (Step 5)
    const researchTokens = placesToResearch.length > 0 ? Math.ceil(placesToResearch.length * 500) : 0;
    const researchCost = placesToResearch.length > 0 ? placesToResearch.length * 0.001 : 0;
    generationTracker.completeStep(5, { apiCalls: placesToResearch.length, tokenCount: researchTokens, cost: researchCost });

    console.log(`✅ Step 4 (Campaign + Research parallel): ${step4Duration}ms`);

    const text = campaignResult;

    // Track Output Tokens
    costEstimator.trackGeminiOutput(text.length);

    // STEP 6: Metadata Enrichment (implicit - happens during JSON parsing and processing)
    generationTracker.startStep(6);
    const step6Start = Date.now();

    // STEP 7: JSON Parsing
    generationTracker.startStep(7);
    const campaignData = JSON.parse(text);
    generationTracker.completeStep(7, { cost: 0 });

    // STEP 6: Extract and process campaign generation reasoning
    // GEMINI 3 FEATURE: Adds 5-6K tokens of design rationale
    let campaignReasoning: CampaignReasoning | undefined;
    if (campaignData.reasoning) {
      const reasoning = campaignData.reasoning;

      // Calculate token estimate for reasoning
      const reasoningText = JSON.stringify(reasoning);
      const estimatedTokens = Math.ceil(reasoningText.length / 4);

      campaignReasoning = {
        locationSelection: reasoning.locationSelection || [],
        difficultyProgression: reasoning.difficultyProgression || '',
        mediaTypeChoices: reasoning.mediaTypeChoices || [],
        criteriaDesign: reasoning.criteriaDesign || [],
        estimatedTokens
      };
    }

    // Continue STEP 6: Enrich quest data with coordinates, distance, and place metadata
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
        placeId: isPlace ? (location as PlaceData).placeId : undefined,
      };
    });

    const step6Duration = Date.now() - step6Start;
    generationTracker.completeStep(6, { cost: 0 });

    // STEP 8: Generate images in parallel with progress tracking
    generationTracker.startStep(8, { imageCount: questsWithMetadata.length });
    const step8Start = Date.now();
    let completedCount = 0;
    const imagePromises = questsWithMetadata.map(async (quest: Quest) => {
      const imageUrl = await generateQuestImage(quest); // Uses optimized 30s default timeout

      completedCount++;
      if (options?.onProgress) {
        options.onProgress(completedCount, questsWithMetadata.length);
      }

      return {
        ...quest,
        imageUrl,
        imageGenerationFailed: !imageUrl,
      };
    });

    const questsWithImages = await Promise.all(imagePromises);
    const step8Duration = Date.now() - step8Start;
    const imageCost = questsWithMetadata.length * 0.040; // ~$0.04 per image
    generationTracker.completeStep(8, { imageCount: questsWithMetadata.length, apiCalls: questsWithMetadata.length, cost: imageCost });
    console.log(`✅ Step 8 (Image generation parallel): ${step8Duration}ms`);
    console.log(`🎉 Total campaign generation time: ${Date.now() - startTime}ms`);

    // End generation tracking
    generationTracker.endGeneration();

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
      locationResearch: locationResearchData.length > 0 ? locationResearchData : undefined,
      generationReasoning: campaignReasoning,
    };
  } catch (error) {
    // Track generation failure
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    generationTracker.failStep(7, errorMessage); // JSON parsing is usually where it fails
    generationTracker.endGeneration();
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

// Helper function to check if user is within acceptable distance threshold
function checkDistanceThreshold(
  userGps: Coordinates | null | undefined,
  targetGps: Coordinates | null | undefined,
  maxDistanceMeters?: number | null
): {
  withinThreshold: boolean;
  distanceMeters?: number;
  rejectionMessage?: string;
} {
  // If distance checking is disabled (null threshold), always pass
  if (maxDistanceMeters === null) {
    return { withinThreshold: true };
  }

  // If no GPS data available, allow (graceful degradation per user preference)
  if (!userGps || !targetGps) {
    return {
      withinThreshold: true,
      rejectionMessage: undefined
    };
  }

  // Calculate actual distance
  const { distanceMeters } = calculateStraightLineDistance(userGps, targetGps);

  // Use provided threshold or default (200m)
  const threshold = maxDistanceMeters ?? GPS_DISTANCE_THRESHOLDS.DEFAULT;

  if (distanceMeters > threshold) {
    const distanceKm = (distanceMeters / 1000).toFixed(1);
    const thresholdKm = (threshold / 1000).toFixed(1);

    return {
      withinThreshold: false,
      distanceMeters,
      rejectionMessage: `You're ${distanceKm}km away from the target location. You need to be within ${thresholdKm}km to complete this quest. Head to the quest marker and try again!`
    };
  }

  return {
    withinThreshold: true,
    distanceMeters
  };
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
  gpsAccuracy?: number,
  sessionContextHint?: string,
  maxDistanceMeters?: number | null
): Promise<VerificationResult> {
  // EARLY DISTANCE CHECK - Before model initialization
  const distanceCheck = checkDistanceThreshold(userGps, targetGps, maxDistanceMeters);

  if (!distanceCheck.withinThreshold) {
    return {
      success: false,
      feedback: distanceCheck.rejectionMessage!,
      appealable: false,
      distanceFromTarget: distanceCheck.distanceMeters,
      mediaType: 'photo',
      rejectionReason: 'too_far'
    };
  }

  const model = getModel('verification'); // Gemini 3 Flash is great for vision speed

  // Calculate distance if GPS available
  let distanceFromTarget: number | undefined;
  let gpsConfidence: number | undefined;
  if (userGps && targetGps) {
    const distanceData = calculateStraightLineDistance(userGps, targetGps);
    distanceFromTarget = distanceData.distanceMeters;
    gpsConfidence = calculateGpsConfidence(distanceFromTarget, gpsAccuracy);
  }

  // Build GPS context for prompt if user is close to target
  const gpsBoostContext = gpsConfidence && gpsConfidence >= 0.5
    ? `\n\nGPS CONTEXT: User is ${distanceFromTarget?.toFixed(0)}m from target location. GPS confidence: ${(gpsConfidence * 100).toFixed(0)}%. If the photo appears to be at a similar location type, be more lenient.`
    : '';

  // Build session context injection
  const contextInjection = sessionContextHint || '';
  const hasSessionContext = contextInjection.length > 0;

  const prompt = `
    Analyze this image against the objective: "${objective}".

    EXTENDED REASONING MODE - THINK STEP-BY-STEP:
    Use Gemini 3's extended thinking capability to carefully reason through each criterion.
    For each criterion below:
    1. First, describe in detail what you observe in the image
    2. Compare your observation against the criterion requirement
    3. Consider any ambiguities or edge cases
    4. Assign a confidence score (0-100) based on your reasoning
    5. Determine if the criterion passes (true) or fails (false)

    Criteria to verify:
    ${secretCriteria.map((c, i) => `${i + 1}. ${c}`).join('\n    ')}
    ${gpsBoostContext}${contextInjection}

    Think carefully through each step before making your final determination.

    Respond in JSON format:
    {
      "success": boolean,
      "feedback": "A witty, personality-driven comment on the photo. If it failed, give a hint.",
      "appealable": boolean (true if close but not quite right, false if completely wrong),
      "thinking": [
        {
          "criterion": "what you're checking (brief)",
          "observation": "what you actually see in the image",
          "passed": boolean,
          "confidence": 0-100
        }
      ],
      "overallConfidence": 0-100
    }
  `;

  // Note: base64Image should be the data part only, e.g. "data:image/jpeg;base64,..."
  const imagePart = {
    inlineData: {
      data: base64Image.split(',')[1],
      mimeType: 'image/jpeg',
    },
  };

  // Track Input Tokens with prompt caching optimization
  // Session context is cacheable (reused across verifications in same campaign)
  // Image + objective are variable (not cached)
  const sessionContextLength = contextInjection.length;
  const variablePromptLength = prompt.length - sessionContextLength + 1000; // +1000 for image tokens

  // Track cacheable context (if present, mark as cached after first use)
  if (hasSessionContext) {
    costEstimator.trackGeminiInput(sessionContextLength, true); // Cached context (90% savings)
  }

  // Track variable (non-cached) portion
  costEstimator.trackGeminiInput(variablePromptLength, false);

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
  } catch {
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

    STEP-BY-STEP RE-ANALYSIS REQUIRED:
    For each criterion, re-evaluate considering the user's context.

    Criteria to verify:
    ${secretCriteria.map((c, i) => `${i + 1}. ${c}`).join('\n    ')}

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
      "gpsWasHelpful": boolean (did GPS proximity influence your decision?),
      "thinking": [
        {
          "criterion": "what you're re-checking (brief)",
          "observation": "what you see, considering user's context",
          "passed": boolean,
          "confidence": 0-100
        }
      ],
      "overallConfidence": 0-100
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
  } catch {
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
  gpsAccuracy?: number,
  sessionContextHint?: string
): Promise<VerificationResult> {
  const model = getModel('verification');

  // Calculate distance if GPS available
  let distanceFromTarget: number | undefined;
  let gpsConfidence: number | undefined;
  if (userGps && targetGps) {
    const distanceData = calculateStraightLineDistance(userGps, targetGps);
    distanceFromTarget = distanceData.distanceMeters;
    gpsConfidence = calculateGpsConfidence(distanceFromTarget, gpsAccuracy);
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
      mediaType: 'video',
      rejectionReason: 'duration'
    };
  }

  if (duration > maxDuration) {
    return {
      success: false,
      feedback: `Your video is too long! Keep it under ${maxDuration} seconds for better analysis. Sometimes less is more!`,
      appealable: false,
      distanceFromTarget,
      mediaType: 'video',
      rejectionReason: 'duration'
    };
  }

  // EARLY DISTANCE CHECK - After duration checks
  const distanceCheckVideo = checkDistanceThreshold(
    userGps,
    targetGps,
    mediaRequirements?.maxDistanceMeters
  );

  if (!distanceCheckVideo.withinThreshold) {
    return {
      success: false,
      feedback: distanceCheckVideo.rejectionMessage!,
      appealable: false,
      distanceFromTarget: distanceCheckVideo.distanceMeters,
      mediaType: 'video',
      rejectionReason: 'too_far'
    };
  }

  // Build session context injection
  const contextInjection = sessionContextHint || '';
  const hasSessionContext = contextInjection.length > 0;

  const prompt = `
    Analyze this video against the objective: "${objective}".

    EXTENDED REASONING MODE - THINK STEP-BY-STEP:
    Use Gemini 3's extended thinking capability to carefully analyze the video.
    For each criterion below:
    1. First, describe in detail what you observe across the video frames
    2. Compare your observation against the criterion requirement
    3. Consider temporal aspects (motion, changes over time, sequences)
    4. Assess any ambiguities or edge cases in the footage
    5. Assign a confidence score (0-100) based on your reasoning
    6. Determine if the criterion passes (true) or fails (false)

    Criteria to verify:
    ${secretCriteria.map((c, i) => `${i + 1}. ${c}`).join('\n    ')}

    Additional video requirements:
    - Verify the video shows the requested subject/location
    - Check for actual motion/activity (not a static image recorded as video)
    ${gpsBoostContext}${contextInjection}

    Duration of video: ${duration} seconds

    Think carefully through each step before making your final determination.

    Respond in JSON format:
    {
      "success": boolean,
      "feedback": "A witty, personality-driven comment on the video. If it failed, give a hint.",
      "appealable": boolean (true if close but not quite right, false if completely wrong),
      "hasMotion": boolean (did the video contain actual motion/activity?),
      "thinking": [
        {
          "criterion": "what you're checking (brief)",
          "observation": "what you see in the video frames",
          "passed": boolean,
          "confidence": 0-100
        }
      ],
      "overallConfidence": 0-100
    }
  `;

  const videoPart = {
    inlineData: {
      data: base64Video.split(',')[1],
      mimeType: mimeType || 'video/webm',
    },
  };

  // Track video input cost with prompt caching
  const sessionContextLength = contextInjection.length;
  const variablePromptLength = prompt.length - sessionContextLength;

  // Track cacheable context
  if (hasSessionContext) {
    costEstimator.trackGeminiInput(sessionContextLength, true); // Cached
  }

  // Track variable portion
  costEstimator.trackGeminiInput(variablePromptLength, false);

  // Track video tokens
  const videoTokens = Math.ceil(duration * 300);
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
  } catch {
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
  gpsAccuracy?: number,
  sessionContextHint?: string
): Promise<VerificationResult> {
  const model = getModel('verification');

  // Calculate distance if GPS available
  let distanceFromTarget: number | undefined;
  let gpsConfidence: number | undefined;
  if (userGps && targetGps) {
    const distanceData = calculateStraightLineDistance(userGps, targetGps);
    distanceFromTarget = distanceData.distanceMeters;
    gpsConfidence = calculateGpsConfidence(distanceFromTarget, gpsAccuracy);
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
      mediaType: 'audio',
      rejectionReason: 'duration'
    };
  }

  if (duration > maxDuration) {
    return {
      success: false,
      feedback: `Your audio is too long! Keep it under ${maxDuration} seconds. We just need a snapshot of the sound.`,
      appealable: false,
      distanceFromTarget,
      mediaType: 'audio',
      rejectionReason: 'duration'
    };
  }

  // EARLY DISTANCE CHECK - After duration checks
  const distanceCheckAudio = checkDistanceThreshold(
    userGps,
    targetGps,
    mediaRequirements?.maxDistanceMeters
  );

  if (!distanceCheckAudio.withinThreshold) {
    return {
      success: false,
      feedback: distanceCheckAudio.rejectionMessage!,
      appealable: false,
      distanceFromTarget: distanceCheckAudio.distanceMeters,
      mediaType: 'audio',
      rejectionReason: 'too_far'
    };
  }

  // Build session context injection
  const contextInjection = sessionContextHint || '';
  const hasSessionContext = contextInjection.length > 0;

  const prompt = `
    Analyze this audio recording against the objective: "${objective}".

    EXTENDED REASONING MODE - THINK STEP-BY-STEP:
    Use Gemini 3's extended thinking capability to carefully analyze the audio.
    For each criterion below:
    1. First, describe in detail what you hear in the recording
    2. Compare your auditory observation against the criterion requirement
    3. Consider sound characteristics (volume, clarity, frequency, timing)
    4. Assess any background noise or interfering sounds
    5. Assign a confidence score (0-100) based on your reasoning
    6. Determine if the criterion passes (true) or fails (false)

    Criteria to verify:
    ${secretCriteria.map((c, i) => `${i + 1}. ${c}`).join('\n    ')}

    Additional audio analysis:
    - If this is a verbal description, assess if the description matches the location/scene
    - If this is ambient sound, verify characteristic sounds are present
    ${gpsBoostContext}${contextInjection}

    Duration of audio: ${duration} seconds

    Think carefully through each step before making your final determination.

    Respond in JSON format:
    {
      "success": boolean,
      "feedback": "A witty, personality-driven comment on the audio. If it failed, give a hint.",
      "appealable": boolean (true if close but not quite right, false if completely wrong),
      "transcription": "Brief summary of what was heard (speech or ambient sounds)",
      "thinking": [
        {
          "criterion": "what you're checking (brief)",
          "observation": "what you hear in the audio",
          "passed": boolean,
          "confidence": 0-100
        }
      ],
      "overallConfidence": 0-100
    }
  `;

  const audioPart = {
    inlineData: {
      data: base64Audio.split(',')[1],
      mimeType: mimeType || 'audio/webm',
    },
  };

  // Track audio input cost with prompt caching
  const sessionContextLength = contextInjection.length;
  const variablePromptLength = prompt.length - sessionContextLength;

  // Track cacheable context
  if (hasSessionContext) {
    costEstimator.trackGeminiInput(sessionContextLength, true); // Cached
  }

  // Track variable portion
  costEstimator.trackGeminiInput(variablePromptLength, false);

  // Track audio tokens
  const audioTokens = Math.ceil(duration * 32);
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
  } catch {
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
  gpsAccuracy?: number,
  sessionContextHint?: string
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
        gpsAccuracy,
        sessionContextHint
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
        gpsAccuracy,
        sessionContextHint
      );

    case 'photo':
    default:
      return verifyPhoto(
        captureData.data,
        objective,
        secretCriteria,
        userGps,
        targetGps,
        gpsAccuracy,
        sessionContextHint,
        mediaRequirements?.maxDistanceMeters
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

    STEP-BY-STEP RE-ANALYSIS REQUIRED:
    For each criterion, re-evaluate considering the user's context.

    Criteria to verify:
    ${secretCriteria.map((c, i) => `${i + 1}. ${c}`).join('\n    ')}

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
      "gpsWasHelpful": boolean (did GPS proximity influence your decision?),
      "thinking": [
        {
          "criterion": "what you're re-checking (brief)",
          "observation": "what you ${captureData.type === 'audio' ? 'hear' : 'see'}, considering user's context",
          "passed": boolean,
          "confidence": 0-100
        }
      ],
      "overallConfidence": 0-100
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
  } catch {
    throw new Error('Failed to verify appeal - invalid JSON response');
  }
}
