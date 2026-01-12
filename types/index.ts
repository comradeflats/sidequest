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

export interface VerificationResult {
  success: boolean;
  feedback: string;
  reasoning?: string;
}
