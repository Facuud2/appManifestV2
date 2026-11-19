import { NextRequest, NextResponse } from 'next/server';
import { getDailyAiUsage, getGeminiApiKey, TIER_1_DAILY_LIMIT } from '@/lib/gemini';
import { inferVideoMimeType } from '@/lib/videoProcessing';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

const MAX_UPLOAD_BYTES = 200 * 1024 * 1024; // 200 MB

function normalizeMediaMimeType(mimeType: string, fileName?: string): string {
  const base = (mimeType || '').split(';')[0].trim().toLowerCase();
  if (base.startsWith('image/') || base.startsWith('video/')) {
    return base;
  }
  const inferred = inferVideoMimeType({ name: fileName, type: mimeType });
  if (inferred) return inferred;
  return '';
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Solicitud de carga inválida.' },
        { status: 400 },
      );
    }

    const rawMime = typeof body.mimeType === 'string' ? body.mimeType : '';
    const fileName = typeof body.fileName === 'string' ? body.fileName.slice(0, 120) : 'media.mp4';
    const byteSize = typeof body.byteSize === 'number' ? Math.floor(body.byteSize) : 0;

    const cleanMime = normalizeMediaMimeType(rawMime, fileName);
    if (!cleanMime) {
      return NextResponse.json(
        { success: false, error: 'Solo se permiten archivos de imagen o video.' },
        { status: 400 },
      );
    }

    if (byteSize <= 0 || byteSize > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        {
          success: false,
          error:
            byteSize > MAX_UPLOAD_BYTES
              ? 'El video supera el tamaño máximo permitido (200 MB).'
              : 'El archivo adjunto está vacío.',
        },
        { status: 400 },
      );
    }

    const dailyUsage = await getDailyAiUsage();
    if (dailyUsage >= TIER_1_DAILY_LIMIT) {
      return NextResponse.json(
        {
          success: false,
          error: `Has alcanzado el límite diario de solicitudes IA (${TIER_1_DAILY_LIMIT} RPD).`,
          quotaUsedToday: dailyUsage,
        },
        { status: 429 },
      );
    }

    const apiKey = getGeminiApiKey();
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'El servicio de IA no tiene clave configurada.' },
        { status: 502 },
      );
    }

    const origin =
      req.headers.get('origin') ||
      (req.headers.get('host') ? `${req.nextUrl.protocol}//${req.headers.get('host')}` : '');

    const headers: Record<string, string> = {
      'x-goog-api-key': apiKey,
      'X-Goog-Upload-Protocol': 'resumable',
      'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': String(byteSize),
      'X-Goog-Upload-Header-Content-Type': cleanMime,
      'Content-Type': 'application/json',
    };
    if (origin) {
      headers.Origin = origin;
    }

    const startRes = await fetch(
      'https://generativelanguage.googleapis.com/upload/v1beta/files',
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          file: { display_name: fileName || 'chat_media' },
        }),
      },
    );

    const uploadUrl = startRes.headers.get('x-goog-upload-url');
    if (!startRes.ok || !uploadUrl) {
      return NextResponse.json(
        { success: false, error: 'No se pudo iniciar la carga del video.' },
        { status: 502 },
      );
    }

    return NextResponse.json({
      success: true,
      uploadUrl,
      mimeType: cleanMime,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error iniciando carga de archivo';
    console.error('[API /api/ai/narrative-organizer/upload-url] Error:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
