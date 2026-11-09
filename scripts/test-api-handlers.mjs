import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server.js';
import { GET as linkPreviewGet } from '../src/app/api/link-preview/route.ts';
import { GET as imageProxyGet } from '../src/app/api/link-preview/image/route.ts';

test('link-preview returns 400 when url is missing', async () => {
  const req = new NextRequest('http://localhost:3000/api/link-preview');
  const res = await linkPreviewGet(req);
  assert.equal(res.status, 400);
  const data = await res.json();
  assert.equal(data.success, false);
});

test('link-preview blocks local/private IP addresses (SSRF protection)', async () => {
  const req = new NextRequest('http://localhost:3000/api/link-preview?url=http://127.0.0.1:8080/secret');
  const res = await linkPreviewGet(req);
  assert.equal(res.status, 403);
  const data = await res.json();
  assert.equal(data.success, false);
});

test('link-preview blocks localhost (SSRF protection)', async () => {
  const req = new NextRequest('http://localhost:3000/api/link-preview?url=http://localhost:3000/api/sync');
  const res = await linkPreviewGet(req);
  assert.equal(res.status, 403);
});

test('link-preview handles YouTube URLs with fast-path and oEmbed fallback', async () => {
  const req = new NextRequest('http://localhost:3000/api/link-preview?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  const res = await linkPreviewGet(req);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.equal(data.data.provider, 'youtube');
  assert.equal(data.data.isVideoOrReel, true);
  assert.ok(data.data.thumbnailUrl.includes('/api/link-preview/image'));
});

test('image proxy returns fallback SVG for empty url', async () => {
  const req = new NextRequest('http://localhost:3000/api/link-preview/image');
  const res = await imageProxyGet(req);
  assert.equal(res.headers.get('content-type'), 'image/svg+xml');
});

test('image proxy blocks private IP addresses', async () => {
  const req = new NextRequest('http://localhost:3000/api/link-preview/image?url=http://192.168.1.1/router.png');
  const res = await imageProxyGet(req);
  assert.equal(res.headers.get('content-type'), 'image/svg+xml');
});
