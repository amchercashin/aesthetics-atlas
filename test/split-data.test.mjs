// Разделённая загрузка данных: data/index.json + data/styles/<id>.json и importmap.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStore } from '../js/store.js';
import { buildIndex, search } from '../js/search.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

test('data/index.json stays lightweight and every style has its split JSON file', () => {
  const indexPath = path.join(ROOT, 'data/index.json');
  assert.ok(fs.existsSync(indexPath), 'data/index.json exists');
  const bytes = fs.statSync(indexPath).size;
  const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  const perCard = bytes / index.styles.length;
  assert.ok(perCard < 4.5 * 1024, `index.json should stay compact per card (got ${(perCard / 1024).toFixed(2)} KB/card, total ${(bytes / 1024).toFixed(0)} KB)`);
  assert.ok(index.version && /^[0-9a-f]{8}$/.test(index.version), 'index carries 8-char version hash');
  assert.ok(index.stats && index.stats.styles === index.styles.length);
  assert.ok(index.stats.embedded > 500 && index.stats.sources > 500);

  for (const s of index.styles) {
    assert.equal(s.description, undefined, `${s.id} omits heavy description from index`);
    assert.equal(s.evidence, undefined, `${s.id} omits heavy evidence from index`);
    assert.ok(Array.isArray(s.regions) && s.regions.length > 0, `${s.id} carries macro-regions`);
    const sp = path.join(ROOT, 'data/styles', `${s.id}.json`);
    assert.ok(fs.existsSync(sp), `split file exists for ${s.id}`);
  }
});

test('createStore.loadStyle lazily merges card detail and sources and deduplicates requests', async () => {
  const index = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/index.json'), 'utf8'));
  let calls = 0;
  const fetcher = async (url) => {
    calls++;
    const m = /\/([^/?]+)\.json/.exec(url);
    const body = fs.readFileSync(path.join(ROOT, 'data/styles', `${m[1]}.json`), 'utf8');
    return { ok: true, status: 200, json: async () => JSON.parse(body) };
  };
  const store = createStore(index, { fetcher });
  const target = index.styles.find((s) => s.id === 'impressionism') ?? index.styles[0];
  assert.equal(store.get(target.id).description, undefined);

  const [a, b] = await Promise.all([store.loadStyle(target.id), store.loadStyle(target.id)]);
  assert.equal(calls, 1, 'concurrent loadStyle calls share one fetch');
  assert.equal(a, b);
  assert.ok(Array.isArray(a.description) && a.description.length > 0);
  assert.ok(Array.isArray(a.evidence));
  assert.ok(a.links.length >= 2);
  if (a.evidence[0]?.source) assert.ok(store.source(a.evidence[0].source), 'card sources merged into store');

  await store.loadStyle(target.id);
  assert.equal(calls, 1, 'subsequent loadStyle hits in-memory cache');
});

test('search on lightweight index.json finds corpus work titles and creators', () => {
  const index = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/index.json'), 'utf8'));
  const idx = buildIndex(index.styles);
  const res = search(idx, 'Билибин');
  assert.ok(res.some((r) => r.style.id === 'bilibin-illustration'));
  assert.ok(index.styles.every((s) => s.example?.img || s.gallery?.length || s.example?.external?.reference));
});

test('index.html has generated importmap and zero manual ?v= in js/ imports', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert.match(html, /<script type="importmap">/);
  assert.match(html, /<meta name="atlas-version" content="[0-9a-f]{8}">/);
  assert.match(html, /"\.\/js\/store\.js": "\.\/js\/store\.js\?v=[0-9a-f]{8}"/);

  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : e.name.endsWith('.js') ? [p] : [];
  });
  for (const file of walk(path.join(ROOT, 'js'))) {
    const src = fs.readFileSync(file, 'utf8');
    assert.doesNotMatch(src, /\?v=\d+/, `${path.relative(ROOT, file)} has manual ?v= suffix`);
  }
});
