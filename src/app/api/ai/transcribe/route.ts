import { NextRequest, NextResponse } from 'next/server';
import { transcribeAudioWithGemini } from '@/lib/gemini';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('audio') as File | null;
    const spokenText = (formData.get('spokenText') as string) || '';
    const previousTextTail = (formData.get('previousTextTail') as string) || '';

    let audioBuffer = Buffer.alloc(0);
    let mimeType = 'audio/webm';

    if (file) {
      const arrayBuffer = await file.arrayBuffer();
      audioBuffer = Buffer.from(arrayBuffer);
      mimeType = file.type || 'audio/webm';
    }

    const result = await transcribeAudioWithGemini(
      audioBuffer,
      mimeType,
      previousTextTail,
      spokenText
    );

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('[API /api/ai/transcribe] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error en transcripción' },
      { status: 500 }
    );
  }
}
