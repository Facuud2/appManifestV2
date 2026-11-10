import { NextRequest, NextResponse } from 'next/server';
import { turso } from '@/lib/turso';
import {
  isNarrativeProfileId,
  normalizeNarrativeDraft,
  resolveNarrativeProfileId,
  type NarrativeDraft,
} from '@/lib/narrativeOrganizer';
import { buildNarrativeCommit } from '@/lib/narrativeCommit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

function isAllowedOrigin(req: NextRequest): boolean {
  const origin = req.headers.get('origin');
  const host = req.headers.get('host');
  if (!origin || !host) return true;
  const originHost = origin.replace(/^https?:\/\//, '');
  return (
    originHost === host ||
    originHost.startsWith('localhost') ||
    originHost.startsWith('127.0.0.1')
  );
}

export async function POST(req: NextRequest) {
  try {
    if (!isAllowedOrigin(req)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized mutation origin' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const rawProfile = body?.profileId;
    if (!isNarrativeProfileId(rawProfile) && rawProfile !== 'juntos') {
      return NextResponse.json(
        { success: false, error: 'profileId inválido. Usá facu, maia o shared.' },
        { status: 400 }
      );
    }
    const profileId = resolveNarrativeProfileId(rawProfile);

    const draftId = typeof body?.draftId === 'string' ? body.draftId : '';
    if (!draftId) {
      return NextResponse.json(
        { success: false, error: 'Falta draftId.' },
        { status: 400 }
      );
    }

    if (!body?.currentDraft) {
      return NextResponse.json(
        { success: false, error: 'Falta el borrador a confirmar.' },
        { status: 400 }
      );
    }

    const [manifestationsRes, affirmationsRes, maxOrderRes] = await Promise.all([
      turso.execute({
        sql: 'SELECT id FROM manifestations WHERE user_id = ?;',
        args: [profileId],
      }),
      turso.execute({
        sql: 'SELECT text FROM affirmations WHERE user_id = ?;',
        args: [profileId],
      }),
      turso.execute({
        sql: 'SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM affirmations WHERE user_id = ? AND pinned = 0;',
        args: [profileId],
      }),
    ]);

    const validExistingIds = manifestationsRes.rows
      .map((row) => row.id)
      .filter((id): id is string => typeof id === 'string');
    const existingAffirmationTexts = affirmationsRes.rows
      .map((row) => row.text)
      .filter((text): text is string => typeof text === 'string');
    const baseSortOrder = Number(maxOrderRes.rows[0]?.max_order ?? -1) + 1;

    // Re-normalize server-side: never trust the client payload.
    const { draft } = normalizeNarrativeDraft(body.currentDraft as NarrativeDraft, {
      draftId,
      existingManifestationIds: validExistingIds,
      allowLegacy: true,
    });

    const { statements, result } = buildNarrativeCommit({
      draft,
      profileId,
      validExistingIds,
      existingAffirmationTexts,
      baseSortOrder,
    });

    if (statements.length > 0) {
      await turso.batch(statements, 'write');
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error processing narrative commit';
    console.error('[API /api/ai/narrative-organizer/commit] Error:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
