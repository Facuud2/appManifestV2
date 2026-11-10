import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { createClient } from '@libsql/client';

const client = createClient({
  url: process.env.TURSO_DATABASE_URL ?? 'libsql://manifestapp-facuud2.aws-us-east-1.turso.io',
  // `??` (not `||`) keeps an intentionally empty token for local `file:` databases.
  authToken:
    process.env.TURSO_AUTH_TOKEN ??
    'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3OTM0MDcwNTQsImlkIjoiMDFhMThmNjMtNTUwMS03ZjgzLWI4ZTEtMWFkYTMxMDcwNWFhIiwia2lkIjoiNDd0YTBUX09Jczkza0lJeTdrSTZhbmV6QUl4djNvWXZJMkdTNUhDaW5GdyIsInJpZCI6ImFmMzJkMTdiLTI5YTAtNDEwNi1hMGViLThlZmNhZmE0YmZjZCJ9.R3waIxPpxINhoJnvn9KG4XpxcPXxKp7Ufk6Qku_FYEKfCWaquTjo41IPDKPERVcVk_5NV9XYDy_13J8oJgitDQ',
});

export async function run() {
  console.log('🔄 Initializing Turso Database Tables...');

  await client.execute(`
    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      avatar TEXT,
      voice_sample_phrases TEXT,
      voice_tone_profile TEXT,
      has_calibrated_voice INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS manifestations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      author TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      sensory_anchor TEXT,
      category TEXT NOT NULL,
      status TEXT DEFAULT 'semilla',
      target_date TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS manifestation_progress (
      id TEXT PRIMARY KEY,
      manifestation_id TEXT,
      user_id TEXT NOT NULL,
      note TEXT NOT NULL,
      sign_type TEXT,
      voice_transcript TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (manifestation_id) REFERENCES manifestations(id) ON DELETE CASCADE
    );
  `);

  const ensureColumn = async (table, column, definition) => {
    const tableInfo = await client.execute(`PRAGMA table_info(${table});`);
    if (!tableInfo.rows.some((row) => row.name === column)) {
      await client.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition};`);
      console.log(`✓ Added ${table}.${column}`);
    }
  };

  await ensureColumn('manifestation_progress', 'voice_transcript', 'TEXT');

  const progressTableInfo = await client.execute('PRAGMA table_info(manifestation_progress);');
  const manifestationIdColumn = progressTableInfo.rows.find(
    (column) => column.name === 'manifestation_id'
  );
  if (Number(manifestationIdColumn?.notnull) === 1) {
    await client.batch(
      [
        `CREATE TABLE manifestation_progress_new (
          id TEXT PRIMARY KEY,
          manifestation_id TEXT,
          user_id TEXT NOT NULL,
          note TEXT NOT NULL,
          sign_type TEXT,
          voice_transcript TEXT,
          created_at TEXT NOT NULL,
          FOREIGN KEY (manifestation_id) REFERENCES manifestations(id) ON DELETE CASCADE
        );`,
        `INSERT INTO manifestation_progress_new (
          id, manifestation_id, user_id, note, sign_type, voice_transcript, created_at
        )
        SELECT id, manifestation_id, user_id, note, sign_type, voice_transcript, created_at
        FROM manifestation_progress;`,
        'DROP TABLE manifestation_progress;',
        'ALTER TABLE manifestation_progress_new RENAME TO manifestation_progress;',
      ],
      'write'
    );
    console.log('✓ Updated manifestation_progress to allow unlinked entries');
  }

  await client.execute(`
    CREATE TABLE IF NOT EXISTS success_stories (
      id TEXT PRIMARY KEY,
      manifestation_id TEXT,
      user_id TEXT NOT NULL,
      author TEXT NOT NULL,
      title TEXT NOT NULL,
      story TEXT NOT NULL,
      gratitude_note TEXT,
      manifested_date TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS rampage_sets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      theme TEXT NOT NULL,
      affirmations_json TEXT NOT NULL,
      ambient_sound TEXT DEFAULT 'rain',
      is_favorite INTEGER DEFAULT 0,
      created_at TEXT NOT NULL
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS affirmations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      text TEXT NOT NULL,
      category TEXT,
      repeat_count INTEGER DEFAULT 0,
      pinned INTEGER DEFAULT 0,
      sort_order INTEGER,
      created_at TEXT NOT NULL
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS audio_cache (
      hash TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL,
      affirmation_text TEXT NOT NULL,
      audio_base64 TEXT NOT NULL,
      voice_used TEXT,
      created_at TEXT NOT NULL
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS ai_usage_daily (
      date_key TEXT PRIMARY KEY,
      request_count INTEGER DEFAULT 0,
      updated_at TEXT NOT NULL
    );
  `);

  await ensureColumn('profiles', 'avatar', 'TEXT');
  await ensureColumn('profiles', 'voice_sample_phrases', 'TEXT');
  await ensureColumn('profiles', 'voice_tone_profile', 'TEXT');
  await ensureColumn('profiles', 'has_calibrated_voice', 'INTEGER DEFAULT 0');
  await ensureColumn('manifestations', 'sensory_anchor', 'TEXT');
  await ensureColumn('manifestations', 'target_date', 'TEXT');
  await ensureColumn('manifestations', 'song_attachment', 'TEXT');
  await ensureColumn('manifestations', 'media_attachment', 'TEXT');
  await ensureColumn('success_stories', 'author', "TEXT NOT NULL DEFAULT ''");
  await ensureColumn('success_stories', 'gratitude_note', 'TEXT');
  await ensureColumn('rampage_sets', 'theme', "TEXT NOT NULL DEFAULT ''");
  await ensureColumn('rampage_sets', 'affirmations_json', "TEXT NOT NULL DEFAULT '[]'");
  await ensureColumn('rampage_sets', 'ambient_sound', "TEXT DEFAULT 'astral_rain'");
  await ensureColumn('rampage_sets', 'is_favorite', 'INTEGER DEFAULT 0');
  await ensureColumn('affirmations', 'category', 'TEXT');
  await ensureColumn('affirmations', 'repeat_count', 'INTEGER DEFAULT 0');
  await ensureColumn('affirmations', 'pinned', 'INTEGER DEFAULT 0');
  await ensureColumn('affirmations', 'sort_order', 'INTEGER');

  // Insert default profiles if they don't exist
  const now = new Date().toISOString();
  await client.execute({
    sql: `INSERT OR IGNORE INTO profiles (id, name, avatar, has_calibrated_voice, created_at, updated_at) VALUES 
      ('maia', 'Maia', '🌸', 0, ?, ?),
      ('facu', 'Facu', '⚡', 0, ?, ?),
      ('shared', 'Ambos Juntos', '✨', 0, ?, ?)
    `,
    args: [now, now, now, now, now, now]
  });

  // Pre-carga los sets iniciales de Autoconcepto, SP y Maia (idempotente).
  const { groups: defaultGroups } = JSON.parse(
    readFileSync(new URL('../src/lib/affirmationDefaults.json', import.meta.url), 'utf8')
  );
  const baseTimestamp = Date.parse('2026-01-01T00:00:00.000Z');
  const seedStatements = [
    {
      sql: `UPDATE affirmations SET user_id = 'facu' WHERE id LIKE 'default_%' AND user_id != 'facu';`,
      args: [],
    },
    {
      sql: `UPDATE rampage_sets SET user_id = 'facu' WHERE id LIKE 'default_set_%' AND user_id != 'facu';`,
      args: [],
    },
  ];

  defaultGroups.forEach((group, groupIndex) => {
    const createdAt = new Date(
      baseTimestamp + (defaultGroups.length - groupIndex) * 60_000
    ).toISOString();

    const setAffirmations = group.affirmations.map((text, index) => ({
      id: `default_${group.id}_${String(index + 1).padStart(2, '0')}`,
      text,
      repeatCount: 0,
    }));

    for (const affirmation of setAffirmations) {
      seedStatements.push({
        sql: `INSERT OR IGNORE INTO affirmations (id, user_id, text, category, repeat_count, pinned, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?);`,
        args: [affirmation.id, group.userId, affirmation.text, group.category, 0, 0, createdAt],
      });
    }

    seedStatements.push({
      sql: `INSERT OR IGNORE INTO rampage_sets (id, user_id, title, theme, affirmations_json, ambient_sound, is_favorite, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
      args: [
        `default_set_${group.id}`,
        group.userId,
        group.title,
        group.category,
        JSON.stringify(setAffirmations),
        'astral_rain',
        0,
        createdAt,
      ],
    });
  });

  await client.batch(seedStatements, 'write');
  console.log(`✓ Default affirmation sets seeded (${seedStatements.length} rows)`);

  const res = await client.execute("SELECT name FROM sqlite_master WHERE type='table';");
  console.log('✅ Tables created successfully:', res.rows.map(r => r.name));
}

const invokedDirectly =
  Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  run().catch((err) => {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  });
}
