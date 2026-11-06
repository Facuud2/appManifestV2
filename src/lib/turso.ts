import { createClient } from '@libsql/client';

const url = process.env.TURSO_DATABASE_URL || 'libsql://manifestapp-facuud2.aws-us-east-1.turso.io';
const authToken = process.env.TURSO_AUTH_TOKEN || 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3OTM0MDcwNTQsImlkIjoiMDFhMThmNjMtNTUwMS03ZjgzLWI4ZTEtMWFkYTMxMDcwNWFhIiwia2lkIjoiNDd0YTBUX09Jczkza0lJeTdrSTZhbmV6QUl4djNvWXZJMkdTNUhDaW5GdyIsInJpZCI6ImFmMzJkMTdiLTI5YTAtNDEwNi1hMGViLThlZmNhZmE0YmZjZCJ9.R3waIxPpxINhoJnvn9KG4XpxcPXxKp7Ufk6Qku_FYEKfCWaquTjo41IPDKPERVcVk_5NV9XYDy_13J8oJgitDQ';

export const turso = createClient({
  url,
  authToken,
});
