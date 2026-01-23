import { Coordinates, PlaceData, DistanceRange, DISTANCE_RANGES } from '@/types';
import { costEstimator } from './cost-estimator';
import { getVisitedPlaceIds } from './storage';

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
 */
export function selectQuestPlaces(
  places: PlaceData[],
  count: number,
  distanceRange: DistanceRange,
  startCoordinates: Coordinates,
  visitedPlaceIds?: Set<string>
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

      // Penalty for previously visited places (soft exclusion - 0.5x score)
      const visitedPenalty = visitedPlaceIds?.has(place.placeId) ? 0.5 : 1.0;

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
  // Get visited place IDs for exclusion/deprioritization
  const visitedPlaceIds = getVisitedPlaceIds();

  try {
    // Try to get real places from Places API with variety mode
    const places = await findNearbyPlaces(center, distanceRange, true);

    if (places && places.length >= count) {
      const selected = selectQuestPlaces(places, count, distanceRange, center, visitedPlaceIds);
      if (selected.length >= count) {
        return selected;
      }
    }
  } catch {
    // Places API failed, using fallback
  }

  // Fallback to random coordinates
  return generateRandomQuestPoints(center, count, distanceRange);
}
