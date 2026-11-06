import { NextRequest, NextResponse } from 'next/server';
import { generateRampageWithGemini } from '@/lib/gemini';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { centralTheme, userScope, userAffirmations, batchSize } = body;

    const result = await generateRampageWithGemini(
      centralTheme || 'Abundancia y Certeza',
      userScope || 'shared',
      userAffirmations || [],
      batchSize || 3
    );

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('[API /api/ai/rampage] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error en generación de rampage' },
      { status: 500 }
    );
  }
}
