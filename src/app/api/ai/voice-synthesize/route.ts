import { NextRequest, NextResponse } from 'next/server';
import { synthesizeSpeechWithGemini38FlashTTS } from '@/lib/gemini';
import { turso } from '@/lib/turso';
import { VoiceProfileMeta } from '@/types';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, profileId } = body;

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Texto requerido para síntesis' },
        { status: 400 }
      );
    }
    if (profileId !== 'facu' && profileId !== 'maia') {
      return NextResponse.json({ success: false, error: 'Perfil de voz inválido' }, { status: 400 });
    }

    const profile = await turso.execute({
      sql: 'SELECT voice_tone_profile FROM profiles WHERE id = ?;',
      args: [profileId],
    });
    let voiceProfile: VoiceProfileMeta | null = null;
    const storedProfile = profile.rows[0]?.voice_tone_profile;
    if (typeof storedProfile === 'string') {
      try {
        voiceProfile = JSON.parse(storedProfile) as VoiceProfileMeta;
      } catch {
        throw new Error(`El perfil de voz de ${profileId} tiene datos inválidos`);
      }
    }

    const { wavBuffer, voiceUsed, source } = await synthesizeSpeechWithGemini38FlashTTS({
      text,
      geminiVoiceId: voiceProfile?.geminiVoiceId,
      matchedVoice: voiceProfile?.matchedVoice,
      detectedTone: voiceProfile?.detectedTone,
      userScope: profileId,
    });

    return new Response(new Uint8Array(wavBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'audio/wav',
        'Content-Length': wavBuffer.length.toString(),
        'X-Voice-Used': voiceUsed,
        'X-AI-Source': source,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[API /api/ai/voice-synthesize] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Error en síntesis vocal' },
      { status: 500 }
    );
  }
}
