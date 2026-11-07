import type { InStatement } from '@libsql/client';
import { turso } from '@/lib/turso';
import { DEFAULT_AFFIRMATIONS, DEFAULT_RAMPAGE_SETS } from '@/lib/affirmationEngine';

let seedPromise: Promise<void> | null = null;

/**
 * Inserta una sola vez los sets iniciales de Autoconcepto, SP y Maia.
 * Es idempotente: usa INSERT OR IGNORE y evita writes si ya están todos.
 */
export function ensureDefaultAffirmations(): Promise<void> {
  if (!seedPromise) {
    seedPromise = seedDefaults().catch((error) => {
      seedPromise = null;
      throw error;
    });
  }
  return seedPromise;
}

async function seedDefaults(): Promise<void> {
  await Promise.all([
    turso.execute({
      sql: `CREATE TABLE IF NOT EXISTS audio_cache (
              hash TEXT PRIMARY KEY,
              profile_id TEXT NOT NULL,
              affirmation_text TEXT NOT NULL,
              audio_base64 TEXT NOT NULL,
              voice_used TEXT,
              created_at TEXT NOT NULL
            );`,
      args: [],
    }),
    turso.execute({
      sql: `CREATE TABLE IF NOT EXISTS ai_usage_daily (
              date_key TEXT PRIMARY KEY,
              request_count INTEGER DEFAULT 0,
              updated_at TEXT NOT NULL
            );`,
      args: [],
    }),
  ]);

  const [affirmationsCount, rampageSetsCount] = await Promise.all([
    turso.execute({
      sql: `SELECT COUNT(*) AS count FROM affirmations WHERE id LIKE 'default%';`,
      args: [],
    }),
    turso.execute({
      sql: `SELECT COUNT(*) AS count FROM rampage_sets WHERE id LIKE 'default%';`,
      args: [],
    }),
  ]);

  const hasAffirmations =
    Number(affirmationsCount.rows[0]?.count ?? 0) >= DEFAULT_AFFIRMATIONS.length;
  const hasRampageSets =
    Number(rampageSetsCount.rows[0]?.count ?? 0) >= DEFAULT_RAMPAGE_SETS.length;

  if (hasAffirmations && hasRampageSets) return;

  const statements: InStatement[] = [];

  if (!hasAffirmations) {
    for (const affirmation of DEFAULT_AFFIRMATIONS) {
      statements.push({
        sql: `INSERT OR IGNORE INTO affirmations (id, user_id, text, category, repeat_count, pinned, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?);`,
        args: [
          affirmation.id,
          affirmation.userId,
          affirmation.text,
          affirmation.category ?? null,
          affirmation.repeatCount,
          affirmation.pinned ? 1 : 0,
          affirmation.createdAt,
        ],
      });
    }
  }

  if (!hasRampageSets) {
    for (const set of DEFAULT_RAMPAGE_SETS) {
      statements.push({
        sql: `INSERT OR IGNORE INTO rampage_sets (id, user_id, title, theme, affirmations_json, ambient_sound, is_favorite, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
        args: [
          set.id,
          set.userId,
          set.title,
          set.category ?? 'general',
          JSON.stringify(set.affirmations),
          set.ambientSound,
          set.isFavorite ? 1 : 0,
          set.createdAt,
        ],
      });
    }
  }

  if (statements.length === 0) return;
  await turso.batch(statements, 'write');
  console.info(`[Affirmations] Seeded ${statements.length} default rows.`);
}
