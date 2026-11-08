import { NextRequest, NextResponse } from 'next/server';
import { refreshPreviewUrl } from '@/lib/musicProviders';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const provider = (searchParams.get('provider') || '').toLowerCase();
  const trackId = searchParams.get('id') || '';

  if (!['itunes', 'deezer', 'spotify'].includes(provider) || !trackId) {
    return NextResponse.json(
      { success: false, error: 'Proveedor o id inválido.' },
      { status: 400 },
    );
  }

  try {
    const previewAudioUrl = await refreshPreviewUrl(provider, trackId);
    return NextResponse.json(
      { success: true, data: { previewAudioUrl } },
      { headers: { 'Cache-Control': 'private, max-age=300' } },
    );
  } catch (error) {
    console.error('[API /api/music/preview] Error:', error);
    return NextResponse.json(
      { success: true, data: { previewAudioUrl: null } },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
