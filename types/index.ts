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
    description: '200m-1km stroll',
    radiusMeters: 1000
  },
  nearby: {
    range: 'nearby',
    minDistance: 1,
    maxDistance: 8,
    avgDistance: 4,
    label: 'NEARBY',
    description: '1-8km walk',
    radiusMeters: 8000
  },
  far: {
    range: 'far',
    minDistance: 10,
    maxDistance: 30,
    avgDistance: 18,
    label: 'FAR',
    description: '10-30km expedition',
    radiusMeters: 30000
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
}

// Campaign generation options
export interface CampaignOptions {
  enableVideoQuests?: boolean;
  enableAudioQuests?: boolean;
  guaranteedMix?: boolean;        // Guarantee exactly 1 photo, 1 video, 1 audio quest
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
}

// Media capture data
export interface MediaCaptureData {
  type: MediaType;
  data: string; // base64 data URL
  duration?: number;  // seconds (for video/audio)
  mimeType?: string;  // e.g., 'video/webm', 'audio/webm'
}

export interface VerificationResult {
  success: boolean;
  feedback: string;
  reasoning?: string;
  appealable?: boolean;          // Can this be appealed?
  distanceFromTarget?: number;   // GPS distance in meters
  mediaType?: MediaType;         // Type of media that was verified
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
