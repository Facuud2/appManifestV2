import test from 'node:test';
import assert from 'node:assert/strict';

const BASE_URL = 'http://localhost:3088';

test('Live: link-preview returns 400 when url is missing', async () => {
  const res = await fetch(`${BASE_URL}/api/link-preview`);
  assert.equal(res.status, 400);
  const data = await res.json();
  assert.equal(data.success, false);
});

test('Live: link-preview blocks local/private IP addresses (SSRF protection)', async () => {
  const res = await fetch(`${BASE_URL}/api/link-preview?url=http://127.0.0.1:3088/secret`);
  assert.equal(res.status, 403);
  const data = await res.json();
  assert.equal(data.success, false);
});

test('Live: link-preview handles YouTube URLs with fast-path and oEmbed fallback', async () => {
  const res = await fetch(`${BASE_URL}/api/link-preview?url=${encodeURIComponent('https://www.youtube.com/watch?v=dQw4w9WgXcQ')}`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.equal(data.data.provider, 'youtube');
  assert.equal(data.data.isVideoOrReel, true);
  assert.ok(data.data.thumbnailUrl.includes('/api/link-preview/image?url='));
  assert.ok(data.data.title.length > 0);
});

test('Live: link-preview/image returns fallback SVG for empty url', async () => {
  const res = await fetch(`${BASE_URL}/api/link-preview/image`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'image/svg+xml');
});

test('Live: link-preview/image proxies YouTube thumbnail correctly', async () => {
  const imageUrl = 'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg';
  const res = await fetch(`${BASE_URL}/api/link-preview/image?url=${encodeURIComponent(imageUrl)}`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'image/jpeg');
  assert.ok(res.headers.get('cache-control')?.includes('max-age=86400'));
});
