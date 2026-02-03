import { Coordinates, PlaceData, DistanceRange, DISTANCE_RANGES, VisitedPlace } from '@/types';
import { costEstimator } from './cost-estimator';
import { getVisitedPlaceIds, getVisitedPlaces, VISITED_PLACE_CONFIG } from './storage';

// Google Places API response types
interface GooglePlace {
  displayName?: { text: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  types?: string[];
  id?: string;
}

/**
 * Find nearby places using Google Places API
 * @param varietyMode - When true, shuffles types and uses distance ranking for hidden gems
 */
export async function findNearbyPlaces(
  center: Coordinates,
  distanceRange: DistanceRange,
  varietyMode: boolean = false
): Promise<PlaceData[]> {
  const config = DISTANCE_RANGES[distanceRange];

  // Base place types
  const placeTypes = [
    'tourist_attraction',
    'park',
    'museum',
    'art_gallery',
    'church',
    'hindu_temple',
    'mosque',
    'synagogue',
    'shopping_mall',
    'stadium',
    'cultural_center',
    'historical_landmark',
    'monument',
    'visitor_center'
  ];

  // Shuffle types in variety mode to get different results each time
  const includedTypes = varietyMode
    ? [...placeTypes].sort(() => Math.random() - 0.5)
    : placeTypes;

  try {
    // Track API call cost
    costEstimator.trackMapsPlacesCall();

    const response = await fetch('/api/maps/places', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        latitude: center.lat,
        longitude: center.lng,
        radius: config.radiusMeters,
        includedTypes,
        varietyMode
      })
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();

    if (!data.places || data.places.length === 0) {
      return [];
    }

    // Transform Google Places API response to our PlaceData format
    const places: PlaceData[] = data.places.map((place: GooglePlace) => ({
      name: place.displayName?.text || 'Unknown Place',
      formattedAddress: place.formattedAddress || '',
      coordinates: {
        lat: place.location?.latitude || center.lat,
        lng: place.location?.longitude || center.lng
      },
      types: place.types || [],
      placeId: place.id || ''
    }));

    return places;
  } catch {
    return [];
  }
}

/**
 * Select diverse, well-spaced quest locations from available places
 * All places must be within maxDistance radius from startCoordinates
 * @param visitedPlaceIds - Optional set of place IDs to deprioritize (0.5x score penalty)
 * @param visitedPlacesData - Optional full visited places data for tiered penalties
 * @param currentCampaignId - Optional current campaign ID for tracking
 */
export function selectQuestPlaces(
  places: PlaceData[],
  count: number,
  distanceRange: DistanceRange,
  startCoordinates: Coordinates,
  visitedPlaceIds?: Set<string>,
  visitedPlacesData?: VisitedPlace[],
  currentCampaignId?: string
): PlaceData[] {
  if (places.length === 0) {
    return [];
  }

  const config = DISTANCE_RANGES[distanceRange];
  const selected: PlaceData[] = [];

  // Helper function to calculate distance between two coordinates (Haversine formula)
  const calculateDistance = (coord1: Coordinates, coord2: Coordinates): number => {
    const R = 6371; // Earth's radius in km
    const dLat = ((coord2.lat - coord1.lat) * Math.PI) / 180;
    const dLon = ((coord2.lng - coord1.lng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((coord1.lat * Math.PI) / 180) *
        Math.cos((coord2.lat * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Filter places to only those within maxDistance radius from start
  const placesWithinRadius = places.filter(place => {
    const distanceFromStart = calculateDistance(place.coordinates, startCoordinates);
    return distanceFromStart <= config.maxDistance;
  });

  if (placesWithinRadius.length === 0) {
    // Fall back to all places if none are within radius
    return places.slice(0, count);
  }

  if (placesWithinRadius.length <= count) {
    return placesWithinRadius;
  }

  // Helper function to calculate tiered penalty based on recency
  const getPenaltyMultiplier = (placeId: string): number => {
    if (!visitedPlacesData) {
      // Fallback to simple penalty if no enhanced data available
      return visitedPlaceIds?.has(placeId) ? 0.5 : 1.0;
    }

    const visitedPlace = visitedPlacesData.find(v => v.placeId === placeId);
    if (!visitedPlace) return 1.0;

    const now = new Date();
    const daysSinceVisit = (now.getTime() - visitedPlace.visitedAt.getTime()) / (1000 * 60 * 60 * 24);
    const recentCampaigns = visitedPlace.campaignHistory.slice(-VISITED_PLACE_CONFIG.HARD_EXCLUSION_CAMPAIGNS);

    // Hard exclusion (0x penalty)
    if (daysSinceVisit < VISITED_PLACE_CONFIG.HARD_EXCLUSION_DAYS ||
        recentCampaigns.length >= VISITED_PLACE_CONFIG.HARD_EXCLUSION_CAMPAIGNS) {
      return 0;
    }
    // Heavy penalty (0.2x score)
    if (daysSinceVisit < VISITED_PLACE_CONFIG.MEDIUM_PENALTY_DAYS) {
      return 0.2;
    }
    // Medium penalty (0.5x score)
    if (daysSinceVisit < VISITED_PLACE_CONFIG.LIGHT_PENALTY_DAYS) {
      return 0.5;
    }
    // Light penalty (0.7x score)
    return 0.7;
  };

  // Check if we have enough unvisited places
  const unvisitedCount = placesWithinRadius.filter(p => {
    const penalty = getPenaltyMultiplier(p.placeId);
    return penalty === 1.0;
  }).length;
  const unvisitedRatio = unvisitedCount / Math.max(placesWithinRadius.length, 1);

  // Return empty array to trigger fallback in getQuestLocations
  if (unvisitedRatio < VISITED_PLACE_CONFIG.MIN_UNVISITED_RATIO) {
    return [];
  }

  // Helper function to check if place types are diverse
  const isDifferentType = (place: PlaceData, selectedPlaces: PlaceData[]): boolean => {
    if (selectedPlaces.length === 0) return true;

    // Check if this place has different primary types from already selected places
    const primaryType = place.types[0];
    const selectedTypes = selectedPlaces.map(p => p.types[0]);

    return !selectedTypes.includes(primaryType);
  };

  // Start with a random unvisited place (prefer unvisited, fall back to any)
  const unvisitedPlaces = visitedPlaceIds
    ? placesWithinRadius.filter(p => !visitedPlaceIds.has(p.placeId))
    : placesWithinRadius;

  const candidatePool = unvisitedPlaces.length > 0 ? unvisitedPlaces : placesWithinRadius;
  const firstPlace = candidatePool[Math.floor(Math.random() * candidatePool.length)];
  selected.push(firstPlace);

  // Select remaining places, ensuring diversity and appropriate spacing
  while (selected.length < count && selected.length < placesWithinRadius.length) {
    let bestPlace: PlaceData | null = null;
    let bestScore = -Infinity;

    for (const place of placesWithinRadius) {
      // Skip already selected places
      if (selected.some(s => s.placeId === place.placeId)) {
        continue;
      }

      // Calculate distance from start (for radius score)
      const distanceFromStart = calculateDistance(place.coordinates, startCoordinates);

      // Calculate average distance from already selected places (for spacing)
      const avgDistanceFromSelected = selected.reduce((sum, selectedPlace) => {
        return sum + calculateDistance(place.coordinates, selectedPlace.coordinates);
      }, 0) / selected.length;

      // Score based on spacing from other quests (prefer places within the target range)
      let spacingScore = 0;
      if (avgDistanceFromSelected >= config.minDistance && avgDistanceFromSelected <= config.maxDistance) {
        spacingScore = 1.0; // Perfect spacing
      } else if (avgDistanceFromSelected < config.minDistance) {
        spacingScore = avgDistanceFromSelected / config.minDistance; // Too close
      } else {
        spacingScore = config.maxDistance / avgDistanceFromSelected; // Too far
      }

      // Score for being within radius (prefer places closer to center for easier return)
      const radiusScore = 1 - (distanceFromStart / config.maxDistance);

      // Bonus for type diversity
      const diversityBonus = isDifferentType(place, selected) ? 0.3 : 0;

      // Tiered penalty for previously visited places (ranges from 0x to 1.0x based on recency)
      const visitedPenalty = getPenaltyMultiplier(place.placeId);

      // Combined score: prioritize spacing but consider radius, diversity, and visited status
      const totalScore = ((spacingScore * 0.6) + (radiusScore * 0.1) + diversityBonus) * visitedPenalty;

      if (totalScore > bestScore) {
        bestScore = totalScore;
        bestPlace = place;
      }
    }

    if (bestPlace) {
      selected.push(bestPlace);
    } else {
      // If no good candidates, just pick a random unselected place
      const unselected = placesWithinRadius.filter(
        p => !selected.some(s => s.placeId === p.placeId)
      );
      if (unselected.length > 0) {
        selected.push(unselected[0]);
      } else {
        break;
      }
    }
  }

  return selected;
}

/**
 * Generate random quest points (fallback when Places API fails)
 */
export function generateRandomQuestPoints(
  center: Coordinates,
  count: number,
  distanceRange: DistanceRange
): Coordinates[] {
  const config = DISTANCE_RANGES[distanceRange];
  const points: Coordinates[] = [];

  for (let i = 0; i < count; i++) {
    // Random angle in radians
    const angle = Math.random() * 2 * Math.PI;

    // Random distance within range (km)
    const distance =
      config.minDistance + Math.random() * (config.maxDistance - config.minDistance);

    // Convert distance to degrees (approximate)
    // 1 degree latitude ≈ 111 km
    const latOffset = (distance * Math.cos(angle)) / 111;
    const lngOffset =
      (distance * Math.sin(angle)) / (111 * Math.cos((center.lat * Math.PI) / 180));

    points.push({
      lat: center.lat + latOffset,
      lng: center.lng + lngOffset
    });
  }

  return points;
}

/**
 * Get quest locations (tries Places API first, falls back to random if needed)
 * Automatically excludes/deprioritizes previously visited places
 */
export async function getQuestLocations(
  center: Coordinates,
  distanceRange: DistanceRange,
  count: number
): Promise<Array<PlaceData | Coordinates>> {
  // Get visited place IDs and full data for tiered exclusion
  const visitedPlaceIds = getVisitedPlaceIds();
  const visitedPlacesData = getVisitedPlaces();

  try {
    // Try to get real places from Places API with variety mode
    let places = await findNearbyPlaces(center, distanceRange, true);

    if (places && places.length >= count) {
      let selected = selectQuestPlaces(
        places,
        count,
        distanceRange,
        center,
        visitedPlaceIds,
        visitedPlacesData
      );

      // Fallback 1: Expand radius if insufficient places
      if (selected.length === 0 && distanceRange !== 'far') {
        console.warn('[Quest Generation] Insufficient unvisited places, expanding radius');

        const expandedRange = distanceRange === 'local' ? 'nearby' : 'far';
        places = await findNearbyPlaces(center, expandedRange, true);
        selected = selectQuestPlaces(
          places,
          count,
          expandedRange,
          center,
          visitedPlaceIds,
          visitedPlacesData
        );

        if (selected.length >= count) {
          (selected as any).__radiusExpanded = true;
          (selected as any).__expandedRange = expandedRange;
        }
      }

      // Fallback 2: Relax time window if still insufficient
      if (selected.length === 0) {
        console.warn('[Quest Generation] Relaxing exclusion window to 2 days');

        const relaxedData = visitedPlacesData.filter(v => {
          const daysSince = (Date.now() - v.visitedAt.getTime()) / (1000 * 60 * 60 * 24);
          return daysSince >= 2;
        });

        selected = selectQuestPlaces(
          places,
          count,
          distanceRange,
          center,
          visitedPlaceIds,
          relaxedData
        );

        if (selected.length >= count) {
          (selected as any).__timeWindowRelaxed = true;
        }
      }

      // Return selected if we have enough
      if (selected.length >= count) {
        return selected;
      }
    }
  } catch {
    // Places API failed, using fallback
  }

  // Fallback 3: Random coordinates (existing fallback)
  console.warn('[Quest Generation] Using random coordinates fallback');
  return generateRandomQuestPoints(center, count, distanceRange);
}
