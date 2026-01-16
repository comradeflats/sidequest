/**
 * Location Service - Google Maps API Integration
 * Handles geocoding and distance calculations
 *
 * Updated to use server-side proxies to avoid CORS issues.
 * All distance calculations assume walking mode.
 */

import { Coordinates, LocationData, DistanceData } from '@/types';
import { costEstimator } from './cost-estimator';

// We still check if the key is present in env to fail fast, but the actual key usage is on the server.
const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

/**
 * Convert location string to coordinates using internal Geocoding API proxy
 * 
 * @param locationString - User input like "Da Nang, Vietnam"
 * @returns LocationData with coordinates and formatted address
 */
export async function geocodeLocation(locationString: string): Promise<LocationData> {
  // Fail fast if key is missing (though server checks too)
  if (!GOOGLE_MAPS_API_KEY) {
    throw new Error('Google Maps API key is not configured. Please add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to your .env.local file.');
  }

  try {
    // Track API call cost
    costEstimator.trackMapsGeocodeCall();

    // Call our own API route instead of Google directly to avoid CORS
    const url = `/api/maps/geocode?address=${encodeURIComponent(locationString)}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status === 'ZERO_RESULTS') {
      throw new Error(`Location "${locationString}" not found. Try using a city and country format like "Da Nang, Vietnam" or "Tokyo, Japan".`);
    }

    if (data.status === 'OVER_QUERY_LIMIT') {
      throw new Error('Google Maps API quota exceeded. Please try again later or check your billing settings.');
    }

    if (data.status === 'REQUEST_DENIED') {
      throw new Error('Google Maps API request denied. Please check your API key configuration and ensure the Geocoding API is enabled.');
    }

    if (data.status !== 'OK' || !data.results[0]) {
      throw new Error(`Geocoding failed: ${data.status}. ${data.error_message || ''}`);
    }

    const result = data.results[0];

    return {
      name: locationString,
      coordinates: {
        lat: result.geometry.location.lat,
        lng: result.geometry.location.lng,
      },
      formattedAddress: result.formatted_address,
    };
  } catch (error) {
    console.error('[SideQuest] Geocoding error:', error);
    throw error;
  }
}

/**
 * Calculate distance between two points using internal Distance Matrix API proxy
 * Always uses walking mode for consistent distance calculations
 *
 * @param origin - Starting coordinates
 * @param destination - Ending coordinates
 * @returns Distance and duration data (walking)
 */
export async function calculateDistance(
  origin: Coordinates,
  destination: Coordinates
): Promise<DistanceData> {
  if (!GOOGLE_MAPS_API_KEY) {
    throw new Error('Google Maps API key is not configured.');
  }

  // Always use walking mode
  const travelMode = 'walking';

  try {
    console.log('[SideQuest] Distance Matrix API call:', {
      origin: `${origin.lat},${origin.lng}`,
      destination: `${destination.lat},${destination.lng}`,
      mode: travelMode
    });

    // Track API call cost (1 element)
    costEstimator.trackMapsDistanceCall(1);

    const response = await fetch('/api/maps/distance', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        origin: `${origin.lat},${origin.lng}`,
        destinations: `${destination.lat},${destination.lng}`,
        mode: travelMode,
      }),
    });

    const data = await response.json();

    console.log('[SideQuest] Distance Matrix response:', {
      status: data.status,
      elementStatus: data.rows?.[0]?.elements?.[0]?.status
    });

    if (data.status !== 'OK') {
      console.warn(`[SideQuest] Distance Matrix API returned status: ${data.status}`);
      return calculateStraightLineDistance(origin, destination);
    }

    const element = data.rows[0]?.elements[0];

    if (!element || element.status !== 'OK') {
      console.warn(`[SideQuest] No route found for distance calculation. Using straight-line fallback.`);
      return calculateStraightLineDistance(origin, destination);
    }

    console.log('[SideQuest] Route found:', element.distance.text, element.duration.text);

    return {
      distanceMeters: element.distance.value,
      distanceKm: element.distance.value / 1000,
      durationSeconds: element.duration.value,
      durationMinutes: Math.round(element.duration.value / 60),
    };
  } catch (error) {
    console.error('[SideQuest] Distance calculation error:', error);
    return calculateStraightLineDistance(origin, destination);
  }
}

/**
 * Batch calculate distances for multiple destinations using internal proxy
 * Always uses walking mode
 *
 * @param origin - Starting coordinates
 * @param destinations - Array of destination coordinates
 * @returns Array of distance data (walking)
 */
export async function calculateDistances(
  origin: Coordinates,
  destinations: Coordinates[]
): Promise<DistanceData[]> {
  if (!GOOGLE_MAPS_API_KEY) {
    throw new Error('Google Maps API key is not configured.');
  }

  // Always use walking mode
  const travelMode = 'walking';

  try {
    const destString = destinations.map((d) => `${d.lat},${d.lng}`).join('|');

    // Track API call cost (N elements)
    costEstimator.trackMapsDistanceCall(destinations.length);

    const response = await fetch('/api/maps/distance', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        origin: `${origin.lat},${origin.lng}`,
        destinations: destString,
        mode: travelMode,
      }),
    });

    const data = await response.json();

    if (data.status !== 'OK') {
      console.warn(`[SideQuest] Distance Matrix API failed: ${data.status}. Using fallback.`);
      return destinations.map((dest) => calculateStraightLineDistance(origin, dest));
    }

    return data.rows[0].elements.map((element: any, index: number) => {
      if (element.status !== 'OK') {
        return calculateStraightLineDistance(origin, destinations[index]);
      }

      return {
        distanceMeters: element.distance.value,
        distanceKm: element.distance.value / 1000,
        durationSeconds: element.duration.value,
        durationMinutes: Math.round(element.duration.value / 60),
      };
    });
  } catch (error) {
    console.error('[SideQuest] Batch distance calculation error:', error);
    return destinations.map((dest) => calculateStraightLineDistance(origin, dest));
  }
}

/**
 * Calculate straight-line distance using Haversine formula
 * Used as fallback when Distance Matrix API is unavailable
 * Adds 20% buffer to account for actual walking routes vs straight-line
 *
 * @param origin - Starting coordinates
 * @param destination - Ending coordinates
 * @returns Approximate distance data (walking)
 */
function calculateStraightLineDistance(
  origin: Coordinates,
  destination: Coordinates
): DistanceData {
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
  const straightLineDistance = R * c;

  // Add 20% buffer for realistic route vs straight-line
  const adjustedDistance = straightLineDistance * 1.2;

  // Walking speed: 5 km/h (reasonable for city exploration)
  const walkingSpeedKmh = 5;
  const durationMinutes = Math.round((adjustedDistance / walkingSpeedKmh) * 60);

  console.warn(
    '[SideQuest] Using fallback distance calculation for route:',
    `${origin.lat},${origin.lng} → ${destination.lat},${destination.lng}`,
    `Distance: ${adjustedDistance.toFixed(2)}km, Duration: ${durationMinutes} min`
  );

  return {
    distanceMeters: adjustedDistance * 1000,
    distanceKm: adjustedDistance,
    durationSeconds: durationMinutes * 60,
    durationMinutes: durationMinutes,
  };
}

/**
 * Get elevation data for coordinates (optional enhancement)
 * Currently disabled to avoid additional API calls/CORS issues
 *
 * @param coords - Coordinates to get elevation for
 * @returns Elevation in meters
 */
export async function getElevation(coords: Coordinates): Promise<number> {
  // Disabled to prevent CORS issues or extra quota usage for now.
  // Can be proxied similar to geocode/distance if needed.
  return 0;
}