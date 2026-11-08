import { NextRequest, NextResponse } from 'next/server';
import {
  parseSpotifyTrackUrl,
  resolveSpotifyTrackUrl,
  searchMusicTracks,
} from '@/lib/musicProviders';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 40;
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const bucket = rateBuckets.get(ip);
  if (!bucket || bucket.resetAt <= now) {
    rateBuckets.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  bucket.count += 1;
  return bucket.count > RATE_LIMIT_MAX;
}

function cacheHeaders(): Record<string, string> {
  return {
    'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=3600',
  };
}

export async function GET(req: NextRequest) {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'local';

  if (isRateLimited(ip)) {
    return NextResponse.json(
      { success: false, error: 'Demasiadas búsquedas seguidas. Probá en un minuto.' },
      { status: 429 },
    );
  }

  const { searchParams } = new URL(req.url);
  const rawUrl = searchParams.get('url');
  const rawQuery = searchParams.get('q');

  try {
    if (rawUrl) {
      if (!parseSpotifyTrackUrl(rawUrl)) {
        return NextResponse.json(
          { success: false, error: 'El link no parece ser una canción de Spotify.' },
          { status: 400 },
        );
      }

      const resolved = await resolveSpotifyTrackUrl(rawUrl);
      if (!resolved) {
        return NextResponse.json(
          { success: false, error: 'No pudimos resolver ese link de Spotify.' },
          { status: 400 },
        );
      }

      return NextResponse.json(
        {
          success: true,
          data: {
            query: rawUrl,
            source: 'spotify',
            ...resolved,
          },
        },
        { headers: cacheHeaders() },
      );
    }

    const query = (rawQuery || '').trim();
    if (!query) {
      return NextResponse.json(
        { success: false, error: 'Escribí el nombre de una canción o pegá un link de Spotify.' },
        { status: 400 },
      );
    }
    if (query.length > 160) {
      return NextResponse.json(
        { success: false, error: 'La búsqueda es demasiado larga.' },
        { status: 400 },
      );
    }

    const result = await searchMusicTracks(query);
    return NextResponse.json(
      {
        success: true,
        data: {
          query,
          source: 'search',
          ...result,
        },
      },
      { headers: cacheHeaders() },
    );
  } catch (error) {
    console.error('[API /api/music/search] Error:', error);
    return NextResponse.json(
      {
        success: true,
        data: {
          query: rawQuery || rawUrl || '',
          source: rawUrl ? 'spotify' : 'search',
          tracks: [],
          warning: 'No pudimos buscar canciones ahora. Podés seguir escribiendo tu manifestación.',
        },
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
