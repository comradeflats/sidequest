import { NextResponse } from 'next/server';

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

export async function POST(request: Request) {
  if (!GOOGLE_MAPS_API_KEY) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { origin, destinations, mode } = body;

    if (!origin || !destinations || !mode) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origin}&destinations=${destinations}&mode=${mode}&key=${GOOGLE_MAPS_API_KEY}`;
    
    const response = await fetch(url);
    const data = await response.json();

    return NextResponse.json(data);
  } catch (error) {
    console.error('Distance matrix proxy error:', error);
    return NextResponse.json({ error: 'Failed to fetch distance' }, { status: 500 });
  }
}
