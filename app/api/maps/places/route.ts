import { NextResponse } from 'next/server';

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

export async function POST(request: Request) {
  if (!GOOGLE_MAPS_API_KEY) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { latitude, longitude, radius, includedTypes, varietyMode } = body;

    if (!latitude || !longitude || !radius) {
      return NextResponse.json(
        { error: 'Latitude, longitude, and radius are required' },
        { status: 400 }
      );
    }

    // Google Places API (New) - Nearby Search
    const url = 'https://places.googleapis.com/v1/places:searchNearby';

    // Build request body
    const requestBody: Record<string, unknown> = {
      locationRestriction: {
        circle: {
          center: {
            latitude: parseFloat(latitude),
            longitude: parseFloat(longitude)
          },
          radius: parseFloat(radius)
        }
      },
      // Places API (New) valid types - see: https://developers.google.com/maps/documentation/places/web-service/place-types
      // Using "Table A" primary types only
      includedTypes: includedTypes || [
        'tourist_attraction',
        'park',
        'museum',
        'art_gallery',
        'church',
        'hindu_temple',
        'mosque',
        'synagogue',
        'shopping_mall',
        'cafe',
        'restaurant',
        'stadium',
        'cultural_center',
        'historical_landmark',
        'monument',
        'performing_arts_theater',
        'visitor_center',
        'zoo'
      ],
      maxResultCount: 20,
      languageCode: 'en'
    };

    // Note: We no longer use DISTANCE ranking in variety mode.
    // The default popularity ranking gives better tourist spots,
    // while client-side type shuffling and visited tracking provide variety.

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.types'
      },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch places' }, { status: 500 });
  }
}
