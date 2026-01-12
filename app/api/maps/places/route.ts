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
      includedTypes: includedTypes || [
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
        'cafe',
        'restaurant',
        'stadium'
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
    console.log('[GeoSeeker] Places API response status:', response.status);
    console.log('[GeoSeeker] Places found:', data.places?.length || 0);

    return NextResponse.json(data);
  } catch (error) {
    console.error('[GeoSeeker] Places API error:', error);
    return NextResponse.json({ error: 'Failed to fetch places' }, { status: 500 });
  }
}
