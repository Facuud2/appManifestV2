import { NextRequest, NextResponse } from 'next/server';
import { getDailyAiUsage, transcribeAudioWithGemini } from '@/lib/gemini';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';
    let audioBuffer = Buffer.alloc(0);
    let mimeType = 'audio/webm';
    let spokenText = '';
    let previousTextTail = '';
    let bodySandbox = false;

    if (contentType.includes('application/json')) {
      const json = await req.json();
      spokenText = typeof json.spokenText === 'string' ? json.spokenText : '';
      previousTextTail = typeof json.previousTextTail === 'string' ? json.previousTextTail : '';
      bodySandbox = Boolean(json.sandbox);
      if (typeof json.audioBase64 === 'string' && json.audioBase64) {
        audioBuffer = Buffer.from(json.audioBase64, 'base64');
      }
    } else {
      const formData = await req.formData();
      const file = formData.get('audio') as File | null;
      spokenText = (formData.get('spokenText') as string) || '';
      previousTextTail = (formData.get('previousTextTail') as string) || '';
      bodySandbox = formData.get('sandbox') === 'true';

      if (file) {
        const arrayBuffer = await file.arrayBuffer();
        audioBuffer = Buffer.from(arrayBuffer);
        mimeType = file.type || 'audio/webm';
      }
    }

    const sandbox =
      bodySandbox ||
      req.headers.get('x-ai-sandbox') === 'true' ||
      process.env.AI_SANDBOX === 'true';

    const result = await transcribeAudioWithGemini(
      audioBuffer,
      mimeType,
      previousTextTail,
      spokenText,
      sandbox
    );
    const quotaUsedToday = await getDailyAiUsage();

    return NextResponse.json({
      success: true,
      data: {
        ...result,
        quotaUsedToday,
      },
    });
  } catch (error: any) {
    console.error('[API /api/ai/transcribe] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error en transcripción' },
      { status: 500 }
    );
  }
}
