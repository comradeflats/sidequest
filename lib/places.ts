import { Coordinates, PlaceData, DistanceRange, DISTANCE_RANGES } from '@/types';

/**
 * Find nearby places using Google Places API
 */
export async function findNearbyPlaces(
  center: Coordinates,
  distanceRange: DistanceRange
): Promise<PlaceData[]> {
  const config = DISTANCE_RANGES[distanceRange];

  try {
    const response = await fetch('/api/maps/places', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        latitude: center.lat,
        longitude: center.lng,
        radius: config.radiusMeters,
        includedTypes: [
          'tourist_attraction',
          'landmark',
          'park',
          'museum',
          'point_of_interest',
          'art_gallery',
          'church',
          'hindu_temple',
          'mosque',
          'synagogue',
          'shopping_mall',
          'stadium'
        ]
      })
    });

    if (!response.ok) {
      console.warn('[SideQuest] Places API request failed:', response.status);
      return [];
    }

    const data = await response.json();

    if (!data.places || data.places.length === 0) {
      console.warn('[SideQuest] No places found near location');
      return [];
    }

    // Transform Google Places API response to our PlaceData format
    const places: PlaceData[] = data.places.map((place: any) => ({
      name: place.displayName?.text || 'Unknown Place',
      formattedAddress: place.formattedAddress || '',
      coordinates: {
        lat: place.location?.latitude || center.lat,
        lng: place.location?.longitude || center.lng
      },
      types: place.types || [],
      placeId: place.id || ''
    }));

    console.log(`[SideQuest] Found ${places.length} places via Places API`);
    return places;
  } catch (error) {
    console.error('[SideQuest] Places API error:', error);
    return [];
  }
}

/**
 * Select diverse, well-spaced quest locations from available places
 */
export function selectQuestPlaces(
  places: PlaceData[],
  count: number,
  distanceRange: DistanceRange
): PlaceData[] {
  if (places.length === 0) {
    return [];
  }

  if (places.length <= count) {
    return places;
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

  // Helper function to check if place types are diverse
  const isDifferentType = (place: PlaceData, selectedPlaces: PlaceData[]): boolean => {
    if (selectedPlaces.length === 0) return true;

    // Check if this place has different primary types from already selected places
    const primaryType = place.types[0];
    const selectedTypes = selectedPlaces.map(p => p.types[0]);

    return !selectedTypes.includes(primaryType);
  };

  // Start with a random place
  const firstPlace = places[Math.floor(Math.random() * places.length)];
  selected.push(firstPlace);

  // Select remaining places, ensuring diversity and appropriate spacing
  while (selected.length < count && selected.length < places.length) {
    let bestPlace: PlaceData | null = null;
    let bestScore = -Infinity;

    for (const place of places) {
      // Skip already selected places
      if (selected.some(s => s.placeId === place.placeId)) {
        continue;
      }

      // Calculate average distance from already selected places
      const avgDistance = selected.reduce((sum, selectedPlace) => {
        return sum + calculateDistance(place.coordinates, selectedPlace.coordinates);
      }, 0) / selected.length;

      // Score based on distance (prefer places within the target range)
      let distanceScore = 0;
      if (avgDistance >= config.minDistance && avgDistance <= config.maxDistance) {
        distanceScore = 1.0; // Perfect distance
      } else if (avgDistance < config.minDistance) {
        distanceScore = avgDistance / config.minDistance; // Too close
      } else {
        distanceScore = config.maxDistance / avgDistance; // Too far
      }

      // Bonus for type diversity
      const diversityBonus = isDifferentType(place, selected) ? 0.3 : 0;

      const totalScore = distanceScore + diversityBonus;

      if (totalScore > bestScore) {
        bestScore = totalScore;
        bestPlace = place;
      }
    }

    if (bestPlace) {
      selected.push(bestPlace);
    } else {
      // If no good candidates, just pick a random unselected place
      const unselected = places.filter(
        p => !selected.some(s => s.placeId === p.placeId)
      );
      if (unselected.length > 0) {
        selected.push(unselected[0]);
      } else {
        break;
      }
    }
  }

  console.log(`[SideQuest] Selected ${selected.length} diverse places for quests`);
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

  console.warn('[SideQuest] Using random coordinate generation (Places API fallback)');

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
 */
export async function getQuestLocations(
  center: Coordinates,
  distanceRange: DistanceRange,
  count: number
): Promise<Array<PlaceData | Coordinates>> {
  try {
    // Try to get real places from Places API
    const places = await findNearbyPlaces(center, distanceRange);

    if (places && places.length >= count) {
      const selected = selectQuestPlaces(places, count, distanceRange);
      if (selected.length >= count) {
        console.log('[SideQuest] Using Places API for quest locations');
        return selected;
      }
    }

    console.warn('[SideQuest] Insufficient places found, using fallback');
  } catch (error) {
    console.error('[SideQuest] Places API failed, using fallback:', error);
  }

  // Fallback to random coordinates
  return generateRandomQuestPoints(center, count, distanceRange);
}
