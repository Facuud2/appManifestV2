import { NextRequest, NextResponse } from 'next/server';
import {
  getDailyAiUsage,
  processVoiceCommandWithGemini,
  TIER_1_DAILY_LIMIT,
} from '@/lib/gemini';
import type { UserScope } from '@/types';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const dailyUsage = await getDailyAiUsage();
    if (dailyUsage >= TIER_1_DAILY_LIMIT) {
      return NextResponse.json(
        {
          success: false,
          error: `Has alcanzado el límite diario de solicitudes IA (${TIER_1_DAILY_LIMIT} RPD). El límite se renueva a la medianoche UTC.`,
          quotaUsedToday: dailyUsage,
        },
        { status: 429 }
      );
    }

    const contentType = req.headers.get('content-type') || '';
    let audioBuffer = Buffer.alloc(0);
    let mimeType = 'audio/webm';
    let currentProfile: UserScope = 'facu';
    let activeManifestations: Array<{ id: string; title: string }> = [];
    let spokenText = '';
    let bodySandbox = false;

    if (contentType.includes('application/json')) {
      const json = await req.json();
      spokenText = typeof json.spokenText === 'string' ? json.spokenText : '';
      currentProfile = (['facu', 'maia', 'shared'].includes(json.currentProfile)
        ? json.currentProfile
        : 'facu') as UserScope;
      bodySandbox = Boolean(json.sandbox);

      if (Array.isArray(json.activeManifestations)) {
        activeManifestations = json.activeManifestations
          .filter((item: any) => item && typeof item.id === 'string' && typeof item.title === 'string')
          .map((item: any) => ({ id: item.id, title: item.title }));
      }

      if (typeof json.audioBase64 === 'string' && json.audioBase64) {
        audioBuffer = Buffer.from(json.audioBase64, 'base64');
      }
    } else {
      const formData = await req.formData();
      const file = formData.get('audio') as File | null;
      spokenText = (formData.get('spokenText') as string) || '';
      bodySandbox = formData.get('sandbox') === 'true';

      const rawProfile = formData.get('currentProfile') as string;
      if (['facu', 'maia', 'shared'].includes(rawProfile)) {
        currentProfile = rawProfile as UserScope;
      }

      const rawManifestations = formData.get('activeManifestations') as string;
      if (rawManifestations) {
        try {
          const parsed = JSON.parse(rawManifestations);
          if (Array.isArray(parsed)) {
            activeManifestations = parsed
              .filter((item: any) => item && typeof item.id === 'string' && typeof item.title === 'string')
              .map((item: any) => ({ id: item.id, title: item.title }));
          }
        } catch {
          // If JSON parse fails, fallback to empty list
          activeManifestations = [];
        }
      }

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

    const result = await processVoiceCommandWithGemini({
      audioBuffer,
      mimeType,
      currentProfile,
      activeManifestations,
      spokenText,
      sandbox,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('[API /api/ai/voice-command] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Error procesando el comando de voz multimodal',
      },
      { status: 500 }
    );
  }
}
