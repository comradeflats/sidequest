import { NextResponse } from 'next/server';

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

export async function POST(request: Request) {
  if (!GOOGLE_MAPS_API_KEY) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { latitude, longitude, radius, includedTypes } = body;

    if (!latitude || !longitude || !radius) {
      return NextResponse.json(
        { error: 'Latitude, longitude, and radius are required' },
        { status: 400 }
      );
    }

    // Google Places API (New) - Nearby Search
    const url = 'https://places.googleapis.com/v1/places:searchNearby';

    const requestBody = {
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

    // Log for debugging
    console.log('[SideQuest] Places API response status:', response.status);

    // Log error details if request failed
    if (!response.ok) {
      console.error('[SideQuest] Places API error response:', JSON.stringify(data, null, 2));
    } else {
      console.log('[SideQuest] Places found:', data.places?.length || 0);
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('[SideQuest] Places API error:', error);
    return NextResponse.json({ error: 'Failed to fetch places' }, { status: 500 });
  }
}
