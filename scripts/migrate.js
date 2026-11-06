import { createClient } from '@libsql/client';

const client = createClient({
  url: process.env.TURSO_DATABASE_URL || 'libsql://manifestapp-facuud2.aws-us-east-1.turso.io',
  authToken: process.env.TURSO_AUTH_TOKEN || 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3OTM0MDcwNTQsImlkIjoiMDFhMThmNjMtNTUwMS03ZjgzLWI4ZTEtMWFkYTMxMDcwNWFhIiwia2lkIjoiNDd0YTBUX09Jczkza0lJeTdrSTZhbmV6QUl4djNvWXZJMkdTNUhDaW5GdyIsInJpZCI6ImFmMzJkMTdiLTI5YTAtNDEwNi1hMGViLThlZmNhZmE0YmZjZCJ9.R3waIxPpxINhoJnvn9KG4XpxcPXxKp7Ufk6Qku_FYEKfCWaquTjo41IPDKPERVcVk_5NV9XYDy_13J8oJgitDQ'
});

async function run() {
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
      created_at TEXT NOT NULL
    );
  `);

  await ensureColumn('profiles', 'avatar', 'TEXT');
  await ensureColumn('profiles', 'voice_sample_phrases', 'TEXT');
  await ensureColumn('profiles', 'voice_tone_profile', 'TEXT');
  await ensureColumn('profiles', 'has_calibrated_voice', 'INTEGER DEFAULT 0');
  await ensureColumn('manifestations', 'sensory_anchor', 'TEXT');
  await ensureColumn('manifestations', 'target_date', 'TEXT');
  await ensureColumn('success_stories', 'author', "TEXT NOT NULL DEFAULT ''");
  await ensureColumn('success_stories', 'gratitude_note', 'TEXT');
  await ensureColumn('rampage_sets', 'theme', "TEXT NOT NULL DEFAULT ''");
  await ensureColumn('rampage_sets', 'affirmations_json', "TEXT NOT NULL DEFAULT '[]'");
  await ensureColumn('rampage_sets', 'ambient_sound', "TEXT DEFAULT 'astral_rain'");
  await ensureColumn('rampage_sets', 'is_favorite', 'INTEGER DEFAULT 0');
  await ensureColumn('affirmations', 'category', 'TEXT');
  await ensureColumn('affirmations', 'repeat_count', 'INTEGER DEFAULT 0');
  await ensureColumn('affirmations', 'pinned', 'INTEGER DEFAULT 0');

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

  const res = await client.execute("SELECT name FROM sqlite_master WHERE type='table';");
  console.log('✅ Tables created successfully:', res.rows.map(r => r.name));
}

run().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
