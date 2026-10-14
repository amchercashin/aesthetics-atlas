// Проверки настоящего контента (content/*.yaml) без сети: структура, синхронность чисел, старые адреса.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { validate } from '../scripts/lib/validate.mjs';
import { buildRecord } from '../scripts/lib/record.mjs';
import { createStore } from '../js/store.js';
import { buildIndex, search } from '../js/search.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => yaml.load(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const eras = read('content/eras.yaml');
const sources = read('content/sources.yaml');
const styles = fs.readdirSync(path.join(ROOT, 'content/styles')).filter((f) => f.endsWith('.yaml')).sort()
  .flatMap((f) => read(`content/styles/${f}`));

test('content passes structural validation', () => {
  const { errors } = validate(styles, eras, sources);
  assert.deepEqual(errors, []);
});

test('card count in README matches the data', () => {
  const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
  const m = /(\d+)\s+карточ/.exec(readme);
  assert.ok(m, 'README должен называть число карточек');
  assert.equal(Number(m[1]), styles.length);
});

test('the earliest era starts no later than the earliest card', () => {
  const earliest = Math.min(...styles.map((s) => s.start));
  assert.ok(eras[0].start <= earliest, `${eras[0].start} > ${earliest}`);
});

test('images described as precursors, reconstructions or renders carry a matching role', () => {
  const marked = /предтеч|реконструкц|визуализац|современн\w* иллюстрац/i;
  for (const s of styles) {
    for (const im of [s.example, ...(s.gallery ?? [])].filter(Boolean)) {
      const text = [im.note, im.title, im.whyRepresentative].filter(Boolean).join(' ');
      if (marked.test(text) && im.file) assert.notEqual(im.role ?? 'work', 'work', `[${s.id}] «${im.title}»`);
    }
  }
});

test('old URLs keep working: former ids resolve and split overviews keep their id', () => {
  const store = createStore({ eras, styles: styles.map((s, i) => ({ ...buildRecord(s), order: i })) });
  assert.ok(store.get('mesoamerican-art'), 'mesoamerican-art must stay addressable');
  for (const s of styles) for (const f of s.formerIds ?? []) assert.equal(store.resolve(f), s.id);
});

test('search still finds terms moved from aliases to searchKeywords', () => {
  const index = buildIndex(styles.map((s) => buildRecord(s)));
  assert.equal(search(index, 'неоморфизм')[0]?.style.id, 'glassmorphism');
  assert.equal(search(index, 'Backrooms')[0]?.style.id, 'liminal-space');
  assert.ok(search(index, 'Дюшан').some((r) => r.style.id === 'dada'));
  for (const [query, id] of [['Гэндзи-моногатари', 'yamato-e'], ['Ротко', 'color-field'], ['Alegria', 'corporate-memphis'], ['Y3K', 'alien-core'], ['плоттерная графика', 'computer-art'], ['Metro', 'flat-design']]) {
    assert.ok(search(index, query).some(r => r.style.id === id), query);
  }
});

test('macro-region rules: spread vs origin, multi-region and nothing unclassified', async () => {
  const { macroRegions } = await import('../scripts/lib/regions.mjs');
  assert.deepEqual(macroRegions('Франция, затем весь мир'), ['europe']);
  assert.deepEqual(macroRegions('США, Африка'), ['africa', 'americas']);
  assert.deepEqual(macroRegions('Филиппины; США'), ['se-asia', 'americas']);
  assert.deepEqual(macroRegions('Интернет'), ['global']);
  for (const s of styles) assert.ok(!macroRegions(s.region).includes('unknown'), `[${s.id}] ${s.region}`);
});
