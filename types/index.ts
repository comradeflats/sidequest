// Difficulty levels for quests
export type Difficulty = 'easy' | 'medium' | 'hard';

// Distance ranges for quests
export type DistanceRange = 'local' | 'nearby' | 'far';

// Coordinates interface
export interface Coordinates {
  lat: number;
  lng: number;
}

// Location data from geocoding
export interface LocationData {
  name: string;
  coordinates: Coordinates;
  formattedAddress: string;
  city?: string;         // e.g., "Da Nang"
  country?: string;      // e.g., "Vietnam"
}

// Distance data from Distance Matrix API
export interface DistanceData {
  distanceMeters: number;
  distanceKm: number;
  durationSeconds: number;
  durationMinutes: number;
}

// Place data from Google Places API
export interface PlaceData {
  name: string;
  formattedAddress: string;
  coordinates: Coordinates;
  types: string[];
  placeId: string;
}

// Distance range configuration
export interface DistanceRangeConfig {
  range: DistanceRange;
  minDistance: number;    // km
  maxDistance: number;    // km
  avgDistance: number;    // km (target per quest)
  label: string;
  description: string;
  radiusMeters: number;   // For Places API search
}

// Distance range configurations
export const DISTANCE_RANGES: Record<DistanceRange, DistanceRangeConfig> = {
  local: {
    range: 'local',
    minDistance: 0.2,
    maxDistance: 1,
    avgDistance: 0.5,
    label: 'LOCAL',
    description: '200m-1km',
    radiusMeters: 1000
  },
  nearby: {
    range: 'nearby',
    minDistance: 1,
    maxDistance: 5,
    avgDistance: 3,
    label: 'NEARBY',
    description: '1-5km',
    radiusMeters: 5000
  },
  far: {
    range: 'far',
    minDistance: 5,
    maxDistance: 20,
    avgDistance: 12,
    label: 'FAR',
    description: '5-20km',
    radiusMeters: 20000
  }
};

export interface Quest {
  id: string;
  title: string;
  narrative: string;
  objective: string;
  secretCriteria: string[]; // For the Verifier AI
  locationHint: string;
  difficulty: Difficulty;
  imageUrl?: string;                // Base64 data URL for generated image
  imageGenerationFailed?: boolean;  // Fallback flag if generation fails

  // Quest type for media capture
  questType?: QuestType;            // 'PHOTO' | 'VIDEO' | 'AUDIO' (defaults to 'PHOTO')
  mediaRequirements?: MediaRequirements;  // Duration constraints for video/audio

  // Location data
  coordinates?: Coordinates;
  distanceFromPrevious?: number;  // km from previous quest (or start)
  estimatedDuration?: number;     // minutes to reach this quest (walking)
  placeName?: string;             // Name of the place from Places API
  placeTypes?: string[];          // Place types from Places API
  placeId?: string;               // Google Places API ID for tracking visited places
}

// Location research data for context window
export interface LocationResearch {
  placeName: string;
  historicalSignificance: string;
  visitorTips: string;          // 75-100 tokens
  culturalContext: string;
  mediaTips: string;
  estimatedTokens: number;
}

// Campaign generation reasoning for context window
export interface CampaignReasoning {
  locationSelection: string[];        // Why each location was chosen
  difficultyProgression: string;     // Overall difficulty strategy
  mediaTypeChoices: string[];        // Why each quest uses its media type
  criteriaDesign: string[];          // Reasoning for each quest's criteria
  estimatedTokens: number;           // Track contribution to context window
}

export interface Campaign {
  id: string;
  location: string;
  type: 'short' | 'long';
  quests: Quest[];
  currentQuestIndex: number;

  // Location data
  distanceRange?: DistanceRange;  // Selected distance range
  startCoordinates?: Coordinates;
  totalDistance?: number;         // Total campaign distance in km
  estimatedTotalTime?: number;    // Total time estimate in minutes (walking)

  // Quest type settings
  enableVideoQuests?: boolean;    // Whether video quests were enabled at creation
  enableAudioQuests?: boolean;    // Whether audio quests were enabled at creation
  guaranteedMix?: boolean;        // Whether guaranteed mix (1 photo, 1 video, 1 audio) was enabled

  // Gemini 3 Context Window Features
  locationResearch?: LocationResearch[];  // Rich location background for context
  generationReasoning?: CampaignReasoning;  // AI's reasoning for campaign design
}

// Campaign generation options
export interface CampaignOptions {
  enableVideoQuests?: boolean;
  enableAudioQuests?: boolean;
  guaranteedMix?: boolean;        // Guarantee exactly 1 photo, 1 video, 1 audio quest
  onProgress?: (current: number, total: number) => void; // Progress callback for image generation
  onImageStart?: (questId: string) => void;    // Callback when image generation starts
  onImageComplete?: (questId: string) => void; // Callback when image generation completes
}

// Media types for verification
export type MediaType = 'photo' | 'video' | 'audio';

// Quest types for different capture modes
export type QuestType = 'PHOTO' | 'VIDEO' | 'AUDIO';

// Media requirements for video/audio quests
export interface MediaRequirements {
  minDuration?: number;  // seconds
  maxDuration?: number;  // seconds
  description?: string;  // e.g., "10-30 second video"
  maxDistanceMeters?: number | null;  // Override default distance threshold (null = disabled)
}

// GPS distance threshold configuration
export const GPS_DISTANCE_THRESHOLDS = {
  DEFAULT: 200,        // 200m default (2-3 city blocks)
  STRICT: 100,         // 100m for precise locations (landmarks)
  LENIENT: 500,        // 500m for larger areas (parks)
  DISABLED: null       // Disable distance checking for specific quests
};

// Media capture data
export interface MediaCaptureData {
  type: MediaType;
  data: string; // base64 data URL
  duration?: number;  // seconds (for video/audio)
  mimeType?: string;  // e.g., 'video/webm', 'audio/webm'
}

// Thinking step for transparent AI reasoning (Gemini 3 feature)
export interface ThinkingStep {
  criterion: string;      // What's being checked
  observation: string;    // What the AI sees/hears
  passed: boolean;        // Did it pass this criterion?
  confidence: number;     // 0-100 confidence level
}

export interface VerificationResult {
  success: boolean;
  feedback: string;
  reasoning?: string;
  appealable?: boolean;          // Can this be appealed?
  distanceFromTarget?: number;   // GPS distance in meters
  mediaType?: MediaType;         // Type of media that was verified
  // Thinking Levels - Transparent AI reasoning
  thinking?: ThinkingStep[];     // Step-by-step analysis
  overallConfidence?: number;    // 0-100 overall confidence
  rejectionReason?: 'too_far' | 'duration' | 'content' | 'appeal_rejected';  // Reason for rejection
}

export interface AppealData {
  userExplanation: string;
  userGpsCoordinates: Coordinates | null;
  distanceFromTarget: number | null; // meters
  timestamp: Date;
}

export interface AppealResult {
  success: boolean;
  feedback: string;
  reasoning: string;
  acceptedContext: boolean;      // Did AI accept user's explanation?
  gpsWasHelpful: boolean;        // Did GPS proximity influence decision?
}

export interface JourneyPoint {
  coordinates: Coordinates;
  timestamp: Date;
  accuracy: number; // meters
  questIndex: number; // Which quest was active
}

export interface JourneyStats {
  totalDistanceTraveled: number; // km (actual GPS path)
  startTime: Date;
  endTime?: Date;
  durationMinutes: number;
  pathPoints: JourneyPoint[];
  questCompletionTimes: Date[]; // When each quest completed
}

// Visited place tracking for location variety
export interface VisitedPlace {
  placeId: string;
  placeName: string;
  visitedAt: Date;
  campaignId: string;
  coordinates: Coordinates;
}

export interface VisitedPlacesData {
  places: VisitedPlace[];
  lastUpdated: Date;
}

// Stored campaign data for persistence
export interface StoredCampaign {
  campaign: Campaign;
  completedAt: Date | null;
  lastPlayedAt: Date;
  progress: {
    currentQuestIndex: number;
    completedQuests: string[]; // quest IDs
    verificationResults: Record<string, VerificationResult>;
  };
  journeyStats?: JourneyStats;
}

// Player progress for XP system
export interface PlayerProgress {
  totalXP: number;
  level: number;
  questsCompleted: number;
}

// XP rewards by difficulty
export const XP_REWARDS: Record<Difficulty, number> = {
  easy: 50,
  medium: 100,
  hard: 150
};

// XP bonus for distance traveled (per km)
export const XP_DISTANCE_BONUS_PER_KM = 10;

// Streak bonus thresholds
export const STREAK_BONUSES = {
  2: 10,   // 2 consecutive days: +10 XP
  3: 20,   // 3-6 consecutive days: +20 XP
  7: 50,   // 7+ consecutive days: +50 XP
};

/**
 * Get streak bonus based on consecutive days
 */
export function getStreakBonus(consecutiveDays: number): number {
  if (consecutiveDays >= 7) return STREAK_BONUSES[7];
  if (consecutiveDays >= 3) return STREAK_BONUSES[3];
  if (consecutiveDays >= 2) return STREAK_BONUSES[2];
  return 0;
}

// Level thresholds (XP needed for each level)
export const LEVEL_THRESHOLDS = [
  0,      // Level 1
  100,    // Level 2
  250,    // Level 3
  500,    // Level 4
  1000,   // Level 5
  2000,   // Level 6
  4000,   // Level 7
  8000,   // Level 8
  16000,  // Level 9
  32000   // Level 10
];
