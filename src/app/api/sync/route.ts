import { NextRequest, NextResponse } from 'next/server';
import { turso } from '@/lib/turso';
import { ensureDefaultAffirmations } from '@/lib/affirmationSeed';
import { getDailyAiUsage, TIER_1_DAILY_LIMIT } from '@/lib/gemini';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    try {
      await ensureDefaultAffirmations();
    } catch (seedError) {
      console.error('[API /api/sync GET] No se pudieron precargar las afirmaciones:', seedError);
    }

    const { searchParams } = new URL(req.url);
    const rawScope = searchParams.get('scope');

    if (rawScope && !['facu', 'maia', 'shared'].includes(rawScope)) {
      return NextResponse.json({ success: false, error: 'Invalid profile scope' }, { status: 400 });
    }

    const scope = (rawScope as 'facu' | 'maia' | 'shared' | null) || 'facu';
    const whereClause = 'WHERE user_id = ?';
    const args: string[] = [scope];
    const linkedWhereClause =
      'WHERE user_id = ? AND (manifestation_id IS NULL OR manifestation_id IN (SELECT id FROM manifestations WHERE user_id = ?))';
    const linkedArgs: string[] = [scope, scope];

    const [
      manifestationsRes,
      progressRes,
      storiesRes,
      affirmationsRes,
      rampageSetsRes,
      profilesRes,
    ] = await Promise.all([
      turso.execute({ sql: `SELECT * FROM manifestations ${whereClause} ORDER BY created_at DESC;`, args }),
      turso.execute({ sql: `SELECT * FROM manifestation_progress ${linkedWhereClause} ORDER BY created_at DESC;`, args: linkedArgs }),
      turso.execute({ sql: `SELECT * FROM success_stories ${linkedWhereClause} ORDER BY manifested_date DESC;`, args: linkedArgs }),
      turso.execute({
        sql: `SELECT * FROM affirmations ${whereClause}
              ORDER BY pinned DESC,
                       CASE WHEN sort_order IS NULL THEN 1 ELSE 0 END ASC,
                       sort_order ASC,
                       repeat_count DESC,
                       created_at DESC;`,
        args,
      }),
      turso.execute({ sql: `SELECT * FROM rampage_sets ${whereClause} ORDER BY created_at DESC;`, args }),
      turso.execute({ sql: `SELECT * FROM profiles ORDER BY id ASC;`, args: [] }),
    ]);

    const manifestations = manifestationsRes.rows.map((r) => ({
      id: r.id as string,
      userId: r.user_id as string,
      author: r.author as string,
      title: r.title as string,
      description: (r.description as string) || '',
      sensoryAnchor: (r.sensory_anchor as string) || '',
      category: r.category as string,
      status: r.status as string,
      targetDate: (r.target_date as string) || undefined,
      createdAt: r.created_at as string,
      updatedAt: r.updated_at as string,
    }));

    const progressLogs = progressRes.rows.map((r) => ({
      id: r.id as string,
      manifestationId: (r.manifestation_id as string) || undefined,
      userId: r.user_id as string,
      note: r.note as string,
      signType: (r.sign_type as string) || undefined,
      voiceTranscript: (r.voice_transcript as string) || undefined,
      createdAt: r.created_at as string,
    }));

    const successStories = storiesRes.rows.map((r) => ({
      id: r.id as string,
      manifestationId: (r.manifestation_id as string) || undefined,
      userId: r.user_id as string,
      author: r.author as string,
      title: r.title as string,
      story: r.story as string,
      gratitudeNote: (r.gratitude_note as string) || '',
      manifestedDate: r.manifested_date as string,
      createdAt: r.created_at as string,
    }));

    const affirmations = affirmationsRes.rows.map((r, index) => ({
      id: r.id as string,
      userId: r.user_id as string,
      author: r.user_id === 'maia' ? 'Maia' : r.user_id === 'facu' ? 'Facu' : 'Juntos',
      text: r.text as string,
      category: (r.category as string) || undefined,
      repeatCount: Number(r.repeat_count || 0),
      pinned: Boolean(r.pinned),
      order:
        r.sort_order !== null && r.sort_order !== undefined
          ? Number(r.sort_order)
          : index,
      createdAt: r.created_at as string,
    }));

    const rampageSets = rampageSetsRes.rows.map((r) => ({
      id: r.id as string,
      userId: r.user_id as string,
      author: r.user_id === 'maia' ? 'Maia' : r.user_id === 'facu' ? 'Facu' : 'Juntos',
      title: r.title as string,
      theme: r.theme as string,
      affirmations: r.affirmations_json ? JSON.parse(r.affirmations_json as string) : [],
      ambientSound: (r.ambient_sound as string) || 'astral_rain',
      isFavorite: Boolean(r.is_favorite),
      createdAt: r.created_at as string,
    }));

    const profiles = profilesRes.rows.map((r) => ({
      id: r.id as string,
      name: r.name as string,
      avatar: r.avatar as string,
      hasCalibratedVoice: Boolean(r.has_calibrated_voice),
      voiceToneProfile: r.voice_tone_profile ? JSON.parse(r.voice_tone_profile as string) : null,
      createdAt: r.created_at as string,
      updatedAt: r.updated_at as string,
    }));

    const aiUsageToday = await getDailyAiUsage();

    return NextResponse.json({
      success: true,
      data: {
        manifestations,
        progressLogs,
        successStories,
        affirmations,
        rampageSets,
        profiles,
        aiUsageToday,
        aiDailyLimit: TIER_1_DAILY_LIMIT,
      },
    });
  } catch (error: any) {
    console.error('[API /api/sync GET] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error syncing data from Turso' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    try {
      await ensureDefaultAffirmations();
    } catch (seedError) {
      console.error('[API /api/sync POST] No se pudo verificar el esquema de afirmaciones:', seedError);
    }

    const body = await req.json();
    const { entity, action, data, id } = body;

    if (!entity || !action) {
      return NextResponse.json({ success: false, error: 'Entity and action required' }, { status: 400 });
    }

    const tableMap: Record<string, string> = {
      manifestation: 'manifestations',
      progress: 'manifestation_progress',
      story: 'success_stories',
      affirmation: 'affirmations',
      rampageSet: 'rampage_sets',
      profile: 'profiles',
    };

    const tableName = tableMap[entity];
    if (!tableName) {
      return NextResponse.json({ success: false, error: `Invalid entity: ${entity}` }, { status: 400 });
    }

    if (action === 'reorder' && entity === 'affirmation') {
      const items = Array.isArray(body.items) ? body.items : [];
      const reorderScope =
        typeof body.scope === 'string' && ['facu', 'maia', 'shared'].includes(body.scope)
          ? body.scope
          : null;
      if (items.length > 0) {
        await turso.batch(
          items.map((item: { id: string; order: number; pinned?: boolean; userId?: string }) => {
            const targetUserId = item.userId || reorderScope;
            if (targetUserId) {
              return {
                sql:
                  typeof item.pinned === 'boolean'
                    ? `UPDATE affirmations SET sort_order = ?, pinned = ? WHERE id = ? AND user_id = ?;`
                    : `UPDATE affirmations SET sort_order = ? WHERE id = ? AND user_id = ?;`,
                args:
                  typeof item.pinned === 'boolean'
                    ? [item.order, item.pinned ? 1 : 0, item.id, targetUserId]
                    : [item.order, item.id, targetUserId],
              };
            }
            return {
              sql:
                typeof item.pinned === 'boolean'
                  ? `UPDATE affirmations SET sort_order = ?, pinned = ? WHERE id = ?;`
                  : `UPDATE affirmations SET sort_order = ? WHERE id = ?;`,
              args:
                typeof item.pinned === 'boolean'
                  ? [item.order, item.pinned ? 1 : 0, item.id]
                  : [item.order, item.id],
            };
          }),
          'write'
        );
      }
      return NextResponse.json({ success: true, action: 'reordered', count: items.length });
    }

    if (action === 'delete') {
      const deleteId = id || data?.id;
      if (!deleteId) {
        return NextResponse.json({ success: false, error: 'Missing id for deletion' }, { status: 400 });
      }
      const deleteScope =
        typeof body.scope === 'string' && ['facu', 'maia', 'shared'].includes(body.scope)
          ? body.scope
          : null;
      if (entity === 'manifestation') {
        await turso.execute({
          sql: deleteScope
            ? `DELETE FROM manifestation_progress WHERE manifestation_id = ? AND user_id = ?;`
            : `DELETE FROM manifestation_progress WHERE manifestation_id = ?;`,
          args: deleteScope ? [deleteId, deleteScope] : [deleteId],
        });
      }
      await turso.execute({
        sql: deleteScope
          ? `DELETE FROM ${tableName} WHERE id = ? AND user_id = ?;`
          : `DELETE FROM ${tableName} WHERE id = ?;`,
        args: deleteScope ? [deleteId, deleteScope] : [deleteId],
      });
      return NextResponse.json({ success: true, action: 'deleted', id: deleteId });
    }

    if (action === 'save') {
      if (!data || !data.id) {
        return NextResponse.json({ success: false, error: 'Missing data or data.id' }, { status: 400 });
      }

      const now = new Date().toISOString();

      if (entity === 'manifestation') {
        await turso.execute({
          sql: `INSERT INTO manifestations (id, user_id, author, title, description, sensory_anchor, category, status, target_date, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                  user_id = excluded.user_id,
                  author = excluded.author,
                  title = excluded.title,
                  description = excluded.description,
                  sensory_anchor = excluded.sensory_anchor,
                  category = excluded.category,
                  status = excluded.status,
                  target_date = excluded.target_date,
                  updated_at = excluded.updated_at;`,
          args: [
            data.id,
            data.userId || 'facu',
            data.author || 'Facu',
            data.title || '',
            data.description || '',
            data.sensoryAnchor || '',
            data.category || 'crecimiento',
            data.status || 'semilla',
            data.targetDate || null,
            data.createdAt || now,
            data.updatedAt || now,
          ],
        });
      } else if (entity === 'progress') {
        await turso.execute({
          sql: `INSERT OR REPLACE INTO manifestation_progress (id, manifestation_id, user_id, note, sign_type, voice_transcript, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?);`,
          args: [
            data.id,
            data.manifestationId || null,
            data.userId || 'facu',
            data.note || '',
            data.signType || null,
            data.voiceTranscript || null,
            data.createdAt || now,
          ],
        });
      } else if (entity === 'story') {
        await turso.execute({
          sql: `INSERT OR REPLACE INTO success_stories (id, manifestation_id, user_id, author, title, story, gratitude_note, manifested_date, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          args: [
            data.id,
            data.manifestationId || null,
            data.userId || 'facu',
            data.author || 'Facu',
            data.title || '',
            data.story || '',
            data.gratitudeNote || '',
            data.manifestedDate || now.split('T')[0],
            data.createdAt || now,
          ],
        });
      } else if (entity === 'affirmation') {
        await turso.execute({
          sql: `INSERT OR REPLACE INTO affirmations (id, user_id, text, category, repeat_count, pinned, sort_order, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
          args: [
            data.id,
            data.userId || 'facu',
            data.text || '',
            data.category || null,
            data.repeatCount || 0,
            data.pinned ? 1 : 0,
            typeof data.order === 'number' ? data.order : null,
            data.createdAt || now,
          ],
        });
      } else if (entity === 'rampageSet') {
        await turso.execute({
          sql: `INSERT OR REPLACE INTO rampage_sets (id, user_id, title, theme, affirmations_json, ambient_sound, is_favorite, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
          args: [
            data.id,
            data.userId || 'shared',
            data.title || 'Rampage de Afirmaciones',
            data.theme || 'Abundancia y Alineación',
            JSON.stringify(data.affirmations || []),
            data.ambientSound || 'astral_rain',
            data.isFavorite ? 1 : 0,
            data.createdAt || now,
          ],
        });
      } else if (entity === 'profile') {
        await turso.execute({
          sql: `INSERT OR REPLACE INTO profiles (id, name, avatar, voice_sample_phrases, voice_tone_profile, has_calibrated_voice, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
          args: [
            data.id,
            data.name,
            data.avatar || 'shared',
            data.voiceSamplePhrases ? JSON.stringify(data.voiceSamplePhrases) : null,
            data.voiceToneProfile ? JSON.stringify(data.voiceToneProfile) : null,
            data.hasCalibratedVoice ? 1 : 0,
            data.createdAt || now,
            data.updatedAt || now,
          ],
        });
      }

      return NextResponse.json({ success: true, action: 'saved', id: data.id });
    }

    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    console.error('[API /api/sync POST] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error processing sync mutation' },
      { status: 500 }
    );
  }
}
