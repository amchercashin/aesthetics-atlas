import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolveLocalAssets } from '../scripts/lib/local-images.mjs';
import { credit, imgTag } from '../js/ui/image.js';

const root = fileURLToPath(new URL('../', import.meta.url));

test('every committed illustration decodes and has the dimensions needed by the layout', async () => {
  const refs = fs.readdirSync(new URL('../assets/illustrations/', import.meta.url)).filter(f => f.endsWith('.svg')).map(f => `assets/illustrations/${f}`);
  const assets = await resolveLocalAssets([...refs, refs[0]], root);
  assert.equal(assets.size, refs.length);
  for (const [ref, im] of assets) {
    assert.ok(im.width > 0 && im.height > 0, ref);
    assert.ok(im.buffer.length > 0, ref);
    assert.equal(im.thumbs[1280], ref);
  }
  await assert.rejects(resolveLocalAssets(['assets/illustrations/missing.svg'], root), /ENOENT/);
  await assert.rejects(resolveLocalAssets(['../outside.svg'], root), /Unsupported/);
});

test('SVG images and source credits stay relative for deployment in a subdirectory', () => {
  const ref = 'assets/illustrations/web-1-0.svg';
  const im = { local: true, w: 1200, h: 900, src: { 500: ref }, page: ref, artist: 'Редакция' };
  assert.match(String(imgTag(im)), /src="assets\/illustrations\/web-1-0.svg"/);
  assert.match(String(imgTag(im)), /srcset=""/);
  assert.match(String(credit(im)), /href="assets\/illustrations\/web-1-0.svg"/);
  assert.doesNotMatch(String(credit({ ...im, page: 'javascript:alert(1)' })), /javascript:/);
});
