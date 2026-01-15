// Difficulty levels for quests
export type Difficulty = 'easy' | 'medium' | 'hard';

// Distance ranges for quests
export type DistanceRange = 'nearby' | 'medium' | 'far';

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
  nearby: {
    range: 'nearby',
    minDistance: 0.5,
    maxDistance: 3,
    avgDistance: 1.5,
    label: 'NEARBY',
    description: '0.5-3km walks',
    radiusMeters: 3000
  },
  medium: {
    range: 'medium',
    minDistance: 3,
    maxDistance: 10,
    avgDistance: 6,
    label: 'MEDIUM',
    description: '3-10km journey',
    radiusMeters: 10000
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
}

// Media types for verification (photo only)
export type MediaType = 'photo';

// Media capture data
export interface MediaCaptureData {
  type: MediaType;
  data: string; // base64 data URL
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
