import { NextRequest, NextResponse } from 'next/server';
import { generateRampageWithGemini, getDailyAiUsage, TIER_1_DAILY_LIMIT } from '@/lib/gemini';
import { UserScope } from '@/types';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const centralTheme =
      typeof body.centralTheme === 'string' ? body.centralTheme.trim().slice(0, 120) : '';
    const rawNuances =
      typeof body.nuances === 'string'
        ? body.nuances
        : typeof body.additionalDetails === 'string'
          ? body.additionalDetails
          : '';
    const additionalDetails = rawNuances.trim().slice(0, 1000);

    const rawScope = body.profileId || body.userScope || 'shared';
    const userScope: UserScope =
      rawScope === 'facu' || rawScope === 'maia' || rawScope === 'shared'
        ? rawScope
        : 'shared';

    const requestedCount = Number(body.count ?? body.batchSize ?? 11);
    const count = [5, 11, 15].includes(requestedCount)
      ? requestedCount
      : Number.isFinite(requestedCount) && requestedCount > 0
        ? Math.min(20, Math.floor(requestedCount))
        : 11;

    const sandbox =
      Boolean(body.sandbox) ||
      req.headers.get('x-ai-sandbox') === 'true' ||
      process.env.AI_SANDBOX === 'true';

    const userAffirmations = Array.isArray(body.userAffirmations)
      ? body.userAffirmations
          .filter((item: unknown): item is string => typeof item === 'string')
          .map((item: string) => item.trim().slice(0, 300))
          .filter(Boolean)
          .slice(0, 20)
      : [];

    const rawManifestations: unknown[] = Array.isArray(body.userManifestations)
      ? body.userManifestations
      : [];
    const userManifestations = rawManifestations
      .filter(
        (item): item is Record<string, unknown> =>
          typeof item === 'object' && item !== null
      )
      .map((item) => ({
        title: typeof item.title === 'string' ? item.title.trim().slice(0, 160) : '',
        description:
          typeof item.description === 'string'
            ? item.description.trim().slice(0, 500)
            : '',
        status: typeof item.status === 'string' ? item.status.trim().slice(0, 40) : '',
        category:
          typeof item.category === 'string' ? item.category.trim().slice(0, 60) : '',
      }))
      .filter((item) => item.title)
      .slice(0, 15);

    const rawRampages: unknown[] = Array.isArray(body.userRampages)
      ? body.userRampages
      : [];
    const userRampages = rawRampages
      .filter(
        (item): item is Record<string, unknown> =>
          typeof item === 'object' && item !== null
      )
      .map((item) => ({
        title: typeof item.title === 'string' ? item.title.trim().slice(0, 120) : '',
        affirmations: Array.isArray(item.affirmations)
          ? item.affirmations
              .filter(
                (affirmation: unknown): affirmation is string =>
                  typeof affirmation === 'string'
              )
              .map((affirmation) => affirmation.trim().slice(0, 300))
              .filter(Boolean)
              .slice(0, 15)
          : [],
      }))
      .filter((item) => item.title && item.affirmations.length > 0)
      .slice(0, 5);

    if (!centralTheme) {
      return NextResponse.json(
        { success: false, error: 'El título del Rampage es requerido' },
        { status: 400 }
      );
    }

    if (!sandbox) {
      const dailyUsage = await getDailyAiUsage();
      if (dailyUsage >= TIER_1_DAILY_LIMIT) {
        return NextResponse.json(
          {
            success: false,
            error: `Has alcanzado el límite diario de solicitudes IA (${TIER_1_DAILY_LIMIT} RPD). El límite se renueva a la medianoche UTC.`,
            code: 'DAILY_QUOTA_EXCEEDED',
            meta: { aiUsageToday: dailyUsage, aiDailyLimit: TIER_1_DAILY_LIMIT },
          },
          { status: 429 }
        );
      }
    }

    const result = await generateRampageWithGemini(
      centralTheme || 'Mi identidad',
      userScope,
      userAffirmations,
      count,
      additionalDetails,
      userManifestations,
      userRampages,
      sandbox
    );

    return NextResponse.json({
      success: true,
      affirmations: result.affirmations,
      data: result,
    });
  } catch (error) {
    console.error('[API /api/ai/rampage] Error:', error);
    const msg =
      error instanceof Error ? error.message : 'Error en generación de rampage';
    const isQuota =
      msg.includes('límite') ||
      msg.includes('cuota') ||
      msg.includes('429') ||
      msg.includes('RESOURCE_EXHAUSTED');
    return NextResponse.json(
      {
        success: false,
        error: msg,
      },
      { status: isQuota ? 429 : 500 }
    );
  }
}
