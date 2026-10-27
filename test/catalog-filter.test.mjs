// Фильтры каталога на настоящем контенте: отбор по сюжету и технике, счётчики чипов, параметры адреса.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { buildRecord } from '../scripts/lib/record.mjs';
import { readState, stateParams, emptyState, isFiltered, filterStyles, facetCounts, matches } from '../js/catalog-filter.js';
import { DOMAIN, KIND_FAMILY, SUBJECT, MEDIUM } from '../js/format.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const styles = fs.readdirSync(path.join(ROOT, 'content/styles')).filter((f) => f.endsWith('.yaml')).sort()
  .flatMap((f) => yaml.load(fs.readFileSync(path.join(ROOT, 'content/styles', f), 'utf8')))
  .map((s) => buildRecord(s));
const ids = (list) => list.map((s) => s.id);
const state = (over = {}) => ({ ...emptyState(), ...over });

test('subject filter finds landscape styles and nothing without the subject', () => {
  const list = filterStyles(styles, state({ subject: 'landscape' }));
  for (const id of ['shan-shui', 'impressionism', 'barbizon-school', 'hokusai-landscape-prints']) assert.ok(ids(list).includes(id), id);
  assert.ok(list.every((s) => s.subjects.includes('landscape')));
  assert.ok(list.length < styles.length);
});

test('technique filter finds all sculpture and all reliefs', () => {
  const sculpture = filterStyles(styles, state({ medium: 'sculpture' }));
  for (const id of ['venus-figurines', 'classical-greece', 'hellenistic-art', 'chola-bronzes', 'minimalism']) assert.ok(ids(sculpture).includes(id), id);
  const relief = filterStyles(styles, state({ medium: 'relief' }));
  for (const id of ['ancient-egypt', 'mesopotamian-art', 'achaemenid-art', 'romanesque', 'khmer-temple-art', 'maori-whakairo']) assert.ok(ids(relief).includes(id), id);
  assert.ok(relief.every((s) => s.medium.includes('relief')));
});

test('filters combine: subject, technique, domain, type and eras all have to match', () => {
  const st = state({ subject: 'portrait', medium: 'painting', domain: 'art', family: 'history', eras: new Set(['renaissance', 'xix']) });
  const list = filterStyles(styles, st);
  assert.ok(list.length > 0);
  for (const s of list) {
    assert.ok(s.subjects.includes('portrait') && s.medium.includes('painting') && s.domain.includes('art'), s.id);
    assert.ok(KIND_FAMILY.history.kinds.includes(s.kind[0]) && st.eras.has(s.era), s.id);
  }
  assert.deepEqual(filterStyles(styles, emptyState()).length, styles.length);
});

// Число на чипе обещает, сколько стилей покажет каталог после нажатия, — проверяем это для каждого чипа.
test('every chip count equals the list the catalog shows after choosing that chip', () => {
  const dicts = { domain: DOMAIN, family: KIND_FAMILY, subject: SUBJECT, medium: MEDIUM };
  for (const st of [emptyState(), state({ subject: 'landscape' }), state({ medium: 'sculpture', eras: new Set(['antiquity']) }), state({ domain: 'design', subject: 'ornament' })]) {
    for (const [key, dict] of Object.entries(dicts)) {
      const counts = facetCounts(styles, st, key);
      assert.deepEqual([...counts.keys()], Object.keys(dict));
      for (const [v, n] of counts) assert.equal(n, filterStyles(styles, { ...st, [key]: v }).length, `${key}=${v} при ${JSON.stringify(stateParams(st))}`);
    }
  }
});

test('without other filters the chip counts are plain totals', () => {
  const subjects = facetCounts(styles, emptyState(), 'subject');
  for (const [v, n] of subjects) assert.equal(n, styles.filter((s) => s.subjects.includes(v)).length, v);
  assert.ok(subjects.get('landscape') > 0 && subjects.get('portrait') > 0);
  // Ряд не сужает сам себя: выбранный сюжет не обнуляет соседние сюжеты.
  assert.deepEqual(facetCounts(styles, state({ subject: 'landscape' }), 'subject'), subjects);
});

test('URL parameters: t — subject, m — technique; unknown values are ignored; state round-trips', () => {
  const st = readState(new URLSearchParams('t=landscape&m=relief&d=art&k=history&e=ancient,medieval&sort=az'));
  assert.deepEqual({ ...st, eras: [...st.eras] }, { domain: 'art', family: 'history', subject: 'landscape', medium: 'relief', eras: ['ancient', 'medieval'], sort: 'az' });
  assert.deepEqual(stateParams(st), { d: 'art', k: 'history', t: 'landscape', m: 'relief', e: 'ancient,medieval', sort: 'az' });
  const again = readState(new URLSearchParams(stateParams(st)));
  assert.deepEqual({ ...again, eras: [...again.eras] }, { ...st, eras: [...st.eras] });
  assert.deepEqual(readState(new URLSearchParams('t=unicorns&m=lasers&d=nope&k=toString')), emptyState());
});

test('reset state shows everything and nothing counts as filtered', () => {
  assert.equal(isFiltered(emptyState()), false);
  for (const over of [{ subject: 'animals' }, { medium: 'textile' }, { domain: 'art' }, { family: 'online' }, { eras: new Set(['xix']) }]) {
    assert.equal(isFiltered(state(over)), true, JSON.stringify(over));
  }
  assert.equal(isFiltered(state({ sort: 'az' })), false);
  assert.ok(styles.every((s) => matches(s, emptyState())));
});
