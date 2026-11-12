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

    const runQuery = async () => {
      try {
        return await Promise.all([
          turso.execute({
            sql: 'SELECT id, title, repeat_count FROM manifestations WHERE user_id = ?;',
            args: [profileId],
          }),
          turso.execute({
            sql: 'SELECT id, text, repeat_count FROM affirmations WHERE user_id = ?;',
            args: [profileId],
          }),
          turso.execute({
            sql: 'SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM affirmations WHERE user_id = ? AND pinned = 0;',
            args: [profileId],
          }),
          turso.execute({
            sql: 'SELECT id, title, theme, affirmations_json, ambient_sound FROM rampage_sets WHERE user_id = ?;',
            args: [profileId],
          }).catch(() => ({ rows: [] })),
          turso.execute({
            sql: 'SELECT id, title, story, manifested_date, manifestation_id FROM success_stories WHERE user_id = ?;',
            args: [profileId],
          }).catch(() => ({ rows: [] })),
        ]);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('no such column: repeat_count')) {
          await Promise.allSettled([
            turso.execute('ALTER TABLE manifestations ADD COLUMN repeat_count INTEGER DEFAULT 0;'),
            turso.execute('ALTER TABLE affirmations ADD COLUMN repeat_count INTEGER DEFAULT 0;'),
          ]);
          return Promise.all([
            turso.execute({
              sql: 'SELECT id, title, repeat_count FROM manifestations WHERE user_id = ?;',
              args: [profileId],
            }),
            turso.execute({
              sql: 'SELECT id, text, repeat_count FROM affirmations WHERE user_id = ?;',
              args: [profileId],
            }),
            turso.execute({
              sql: 'SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM affirmations WHERE user_id = ? AND pinned = 0;',
              args: [profileId],
            }),
            turso.execute({
              sql: 'SELECT id, title, theme, affirmations_json, ambient_sound FROM rampage_sets WHERE user_id = ?;',
              args: [profileId],
            }).catch(() => ({ rows: [] })),
            turso.execute({
              sql: 'SELECT id, title, story, manifested_date, manifestation_id FROM success_stories WHERE user_id = ?;',
              args: [profileId],
            }).catch(() => ({ rows: [] })),
          ]);
        }
        throw err;
      }
    };

    const [manifestationsRes, affirmationsRes, maxOrderRes, rampagesRes, successStoriesRes] = await runQuery();

    const validExistingIds = manifestationsRes.rows
      .map((row) => row.id)
      .filter((id): id is string => typeof id === 'string');
    const existingManifestations = manifestationsRes.rows.map((row) => ({
      id: String(row.id),
      title: String(row.title || ''),
      repeatCount: Number(row.repeat_count || 0),
    }));
    const existingAffirmations = affirmationsRes.rows.map((row) => ({
      id: String(row.id),
      text: String(row.text || ''),
      repeatCount: Number(row.repeat_count || 0),
    }));
    const existingAffirmationTexts = existingAffirmations.map((a) => a.text);
    const baseSortOrder = Number(maxOrderRes.rows[0]?.max_order ?? -1) + 1;

    const existingRampages = (rampagesRes?.rows || []).map((row) => {
      let affirmations: string[] = [];
      try {
        const parsed = JSON.parse(String(row.affirmations_json || '[]'));
        affirmations = Array.isArray(parsed)
          ? parsed.map((item) => (typeof item === 'string' ? item : item?.text || '')).filter(Boolean)
          : [];
      } catch {
        // ignore
      }
      return {
        id: String(row.id),
        title: String(row.title || ''),
        category: typeof row.theme === 'string' ? row.theme : undefined,
        affirmations,
        ambientSound: typeof row.ambient_sound === 'string' ? row.ambient_sound : undefined,
      };
    });

    const existingSuccessStories = (successStoriesRes?.rows || []).map((row) => ({
      id: String(row.id),
      title: String(row.title || ''),
      story: String(row.story || ''),
      manifestedDate: typeof row.manifested_date === 'string' ? row.manifested_date : undefined,
      manifestationId: typeof row.manifestation_id === 'string' ? row.manifestation_id : null,
    }));

    // Re-normalize server-side: never trust the client payload.
    const { draft } = normalizeNarrativeDraft(body.currentDraft as NarrativeDraft, {
      draftId,
      existingManifestationIds: validExistingIds,
      existingContext: existingManifestations.map((m) => ({
        id: m.id,
        title: m.title,
        personNames: [],
        summary: '',
        repeatCount: m.repeatCount,
      })),
      existingAffirmations,
      existingRampages,
      existingSuccessStories,
      allowLegacy: true,
    });

    const { statements, result } = buildNarrativeCommit({
      draft,
      profileId,
      validExistingIds,
      existingAffirmationTexts,
      existingAffirmations,
      existingManifestations,
      baseSortOrder,
    });

    if (statements.length > 0) {
      try {
        await turso.batch(statements, 'write');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('no such column: repeat_count')) {
          await Promise.allSettled([
            turso.execute('ALTER TABLE manifestations ADD COLUMN repeat_count INTEGER DEFAULT 0;'),
            turso.execute('ALTER TABLE affirmations ADD COLUMN repeat_count INTEGER DEFAULT 0;'),
          ]);
          await turso.batch(statements, 'write');
        } else {
          throw err;
        }
      }
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error processing narrative commit';
    console.error('[API /api/ai/narrative-organizer/commit] Error:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
