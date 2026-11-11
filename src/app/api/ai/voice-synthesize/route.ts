import { NextRequest, NextResponse } from 'next/server';
import { getDailyAiUsage, synthesizeSpeechWithGemini38FlashTTS } from '@/lib/gemini';
import { turso } from '@/lib/turso';
import { VoiceProfileMeta } from '@/types';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { text, profileId, sandbox: bodySandbox } = body;

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Texto requerido para síntesis' },
        { status: 400 }
      );
    }
    const targetProfile =
      profileId === 'maia' ? 'maia' : profileId === 'facu' ? 'facu' : 'facu';

    const sandbox =
      Boolean(bodySandbox) ||
      req.headers.get('x-ai-sandbox') === 'true' ||
      process.env.AI_SANDBOX === 'true';

    let voiceProfile: VoiceProfileMeta | null = null;
    try {
      const profile = await turso.execute({
        sql: 'SELECT voice_tone_profile FROM profiles WHERE id = ?;',
        args: [targetProfile],
      });
      const storedProfile = profile.rows[0]?.voice_tone_profile;
      if (typeof storedProfile === 'string') {
        voiceProfile = JSON.parse(storedProfile) as VoiceProfileMeta;
      }
    } catch {
      voiceProfile = null;
    }

    const { wavBuffer, voiceUsed, source, hash } =
      await synthesizeSpeechWithGemini38FlashTTS({
        text,
        geminiVoiceId: voiceProfile?.geminiVoiceId,
        matchedVoice: voiceProfile?.matchedVoice,
        detectedTone: voiceProfile?.detectedTone,
        userScope: targetProfile,
        sandbox,
      });

    const quotaUsed = await getDailyAiUsage();

    return new Response(new Uint8Array(wavBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'audio/wav',
        'Content-Length': wavBuffer.length.toString(),
        'X-Voice-Used': voiceUsed,
        'X-AI-Source': source,
        'X-Audio-Hash': hash,
        'X-AI-Quota-Used': String(quotaUsed),
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error('[API /api/ai/voice-synthesize] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error en síntesis vocal',
      },
      { status: 500 }
    );
  }
}
