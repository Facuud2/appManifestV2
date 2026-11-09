import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateCleanTitle,
  cleanUrlTrackingParams,
  cleanDisplayUrl,
  extractUrlMetadataHints,
  splitTextAndUrls,
} from '../src/utils/urlParser.ts';

test('Title derivation does NOT cut at www. and removes URL from title', () => {
  const input = 'un vinculo ASI https://www.instagram.com/reel/DeVLieIM6hJ/?rpxt=MTZq';
  const cleanTitle = generateCleanTitle(input);
  assert.equal(cleanTitle, 'un vinculo ASI');
});

test('Pasting sole Instagram Reel URL produces semantic fallback title', () => {
  const input = 'https://www.instagram.com/reel/DeVLieIM6hJ/?igsh=MWFqZ2kydm...';
  const cleanTitle = generateCleanTitle(input);
  assert.equal(cleanTitle, 'Inspiración de Instagram Reel');
});

test('Pasting YouTube URL produces semantic YouTube fallback title', () => {
  const input = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
  const cleanTitle = generateCleanTitle(input);
  assert.equal(cleanTitle, 'Inspiración de YouTube');
});

test('Tracking parameters are stripped from cleanUrl', () => {
  const raw = 'https://www.instagram.com/reel/DeVLieIM6hJ/?rpxt=MTZq&igsh=1234&utm_source=copy';
  const cleaned = cleanUrlTrackingParams(raw);
  assert.equal(cleaned, 'https://www.instagram.com/reel/DeVLieIM6hJ/');
});

test('cleanDisplayUrl generates clean short string', () => {
  const raw = 'https://www.instagram.com/reel/DeVLieIM6hJ/?rpxt=MTZq';
  const display = cleanDisplayUrl(raw);
  assert.equal(display, 'instagram.com/reel/DeVLieIM6hJ');
});

test('splitTextAndUrls separates text and extracted URLs', () => {
  const input = 'Mira este video inspirador para nuestra casa:\nhttps://www.instagram.com/reel/DeVLieIM6hJ/\nNos encantó la cocina!';
  const { cleanText, urls } = splitTextAndUrls(input);
  assert.equal(urls.length, 1);
  assert.equal(urls[0].provider, 'instagram');
  assert.equal(urls[0].isVideoOrReel, true);
  assert.equal(cleanText, 'Mira este video inspirador para nuestra casa:\n\nNos encantó la cocina!');
});
