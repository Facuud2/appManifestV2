import { NextRequest, NextResponse } from 'next/server';
import { synthesizeSpeechWithGemini38FlashTTS } from '@/lib/gemini';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, matchedVoice, detectedTone, userScope } = body;

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Texto requerido para síntesis' },
        { status: 400 }
      );
    }

    const { wavBuffer, voiceUsed, source } = await synthesizeSpeechWithGemini38FlashTTS({
      text,
      matchedVoice,
      detectedTone,
      userScope,
    });

    return new Response(new Uint8Array(wavBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'audio/wav',
        'Content-Length': wavBuffer.length.toString(),
        'X-Voice-Used': voiceUsed,
        'X-AI-Source': source,
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
      },
    });
  } catch (error: any) {
    console.error('[API /api/ai/voice-synthesize] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error en síntesis vocal' },
      { status: 500 }
    );
  }
}
