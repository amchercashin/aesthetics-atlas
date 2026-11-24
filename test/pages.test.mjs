// Статические SEO/OG-страницы s/<id>/index.html, sitemap.xml и robots.txt.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadBuiltAtlas } from '../scripts/lib/load-atlas.mjs';
import { SITE_URL } from '../scripts/generate-pages.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const atlas = loadBuiltAtlas(ROOT);

test('every style has a static s/<id>/index.html with valid local og:image and redirect', () => {
  for (const s of atlas.styles) {
    const p = path.join(ROOT, 's', s.id, 'index.html');
    assert.ok(fs.existsSync(p), `missing static page s/${s.id}/index.html`);
    const html = fs.readFileSync(p, 'utf8');
    assert.match(html, /<meta property="og:title"/);
    assert.match(html, new RegExp(`location\\.replace\\("\\.\\./\\.\\./#/s/${s.id}"`));
    const m = /<meta property="og:image" content="([^"]+)">/.exec(html);
    assert.ok(m, `og:image present for ${s.id}`);
    assert.ok(m[1].startsWith(SITE_URL), `og:image is hosted locally under SITE_URL for ${s.id}: ${m[1]}`);
    const rel = m[1].slice(SITE_URL.length);
    assert.ok(fs.existsSync(path.join(ROOT, rel)), `og:image asset exists on disk for ${s.id}: ${rel}`);
  }
});

test('sitemap.xml and robots.txt list all styles and point to SITE_URL', () => {
  const sitemap = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
  assert.match(sitemap, /<urlset /);
  for (const s of atlas.styles) {
    assert.ok(sitemap.includes(`<loc>${SITE_URL}s/${s.id}/</loc>`), `sitemap includes ${s.id}`);
  }
  const robots = fs.readFileSync(path.join(ROOT, 'robots.txt'), 'utf8');
  assert.match(robots, new RegExp(`Sitemap: ${SITE_URL.replace(/\./g, '\\.')}sitemap\\.xml`));
});
