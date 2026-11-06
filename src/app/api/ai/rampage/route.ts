import { NextRequest, NextResponse } from 'next/server';
import { generateRampageWithGemini } from '@/lib/gemini';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const centralTheme = typeof body.centralTheme === 'string' ? body.centralTheme.trim().slice(0, 120) : '';
    const additionalDetails =
      typeof body.additionalDetails === 'string' ? body.additionalDetails.trim().slice(0, 1000) : '';
    const userScope = body.userScope;
    const userAffirmations = Array.isArray(body.userAffirmations)
      ? body.userAffirmations
          .filter((item: unknown): item is string => typeof item === 'string')
          .map((item: string) => item.trim().slice(0, 300))
          .filter(Boolean)
          .slice(0, 20)
      : [];
    const batchSize = Number(body.batchSize);

    if (!centralTheme) {
      return NextResponse.json({ success: false, error: 'El título del Rampage es requerido' }, { status: 400 });
    }

    if (userScope !== 'facu' && userScope !== 'maia' && userScope !== 'shared') {
      return NextResponse.json({ success: false, error: 'Perfil de Rampage inválido' }, { status: 400 });
    }

    const result = await generateRampageWithGemini(
      centralTheme || 'Abundancia y Certeza',
      userScope,
      userAffirmations,
      Number.isFinite(batchSize) ? batchSize : 3,
      additionalDetails
    );

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[API /api/ai/rampage] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Error en generación de rampage' },
      { status: 500 }
    );
  }
}
