#!/usr/bin/env node
/**
 * Local libSQL test database, no external services.
 *
 * Usage:
 *   node scripts/setup-local-db.mjs           # create/ensure schema
 *   node scripts/setup-local-db.mjs --fresh   # delete the file first
 *
 * The Next.js dev server must use the same URL:
 *   TURSO_DATABASE_URL=file:/tmp/manifest-narrative-test.db TURSO_AUTH_TOKEN=
 */
import { rmSync } from 'node:fs';

const DB_PATH = process.env.LOCAL_DB_PATH || '/tmp/manifest-narrative-test.db';
const DB_URL = process.env.TURSO_DATABASE_URL || `file:${DB_PATH}`;

if (process.argv.includes('--fresh')) {
  const filePath = DB_URL.replace(/^file:/, '');
  rmSync(filePath, { force: true });
  rmSync(`${filePath}-wal`, { force: true });
  rmSync(`${filePath}-shm`, { force: true });
  console.log(`🧹 Removed ${filePath}`);
}

process.env.TURSO_DATABASE_URL = DB_URL;
// Empty token is intentional: it must not fall back to the remote credential.
if (process.env.TURSO_AUTH_TOKEN === undefined) {
  process.env.TURSO_AUTH_TOKEN = '';
}

console.log(`🗄️  Local libSQL database: ${DB_URL}`);

const { pathToFileURL } = await import('node:url');
const { run } = await import(
  pathToFileURL(new URL('./migrate.js', import.meta.url).pathname).href
);
await run();

console.log('✅ Local database ready.');
console.log(
  `   Run the app with:\n   TURSO_DATABASE_URL=${DB_URL} TURSO_AUTH_TOKEN= npm run dev`
);
