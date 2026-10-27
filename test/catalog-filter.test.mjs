// Фильтры каталога на настоящем контенте: отбор по сюжету и технике, счётчики чипов, параметры адреса.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { buildRecord } from '../scripts/lib/record.mjs';
import { readState, stateParams, emptyState, isFiltered, filterStyles, facetCounts, matches, facetHits, FACET_STEMS, universalExtras } from '../js/catalog-filter.js';
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

// Поиск предлагает фильтр каталога, когда запрос — слово из словаря сюжетов или техник.
const hits = (q) => facetHits(q).map((h) => `${h.key}:${h.v}`);

test('search suggests the catalog filter for the words people actually type', () => {
  for (const [q, want] of [
    ['барельеф', 'medium:relief'], ['все барельефы', 'medium:relief'], ['горельеф', 'medium:relief'], ['bas-relief', 'medium:relief'],
    ['скульптуры', 'medium:sculpture'], ['стили скульптуры', 'medium:sculpture'], ['скульп', 'medium:sculpture'], ['sculpture', 'medium:sculpture'],
    ['пейзаж', 'subject:landscape'], ['пейзажи', 'subject:landscape'], ['landscapes', 'subject:landscape'],
    ['портреты', 'subject:portrait'], ['portrait', 'subject:portrait'], ['натюрморт', 'subject:still-life'], ['still life', 'subject:still-life'],
    ['гравюра', 'medium:print'], ['животные', 'subject:animals'], ['мифы', 'subject:religion-myth'],
  ]) assert.ok(hits(q).includes(want), `${q} → ${want}, получено ${hits(q)}`);
  assert.equal(facetHits('барельеф')[0].href, '#/catalog?m=relief');
  assert.equal(facetHits('пейзажи')[0].href, '#/catalog?t=landscape');
});

test('every subject and technique is reachable from search by its own label, and every value has stems', () => {
  for (const [key, dict] of [['subject', SUBJECT], ['medium', MEDIUM]]) {
    assert.deepEqual(Object.keys(FACET_STEMS[key]).sort(), Object.keys(dict).sort(), key);
    for (const [v, label] of Object.entries(dict)) assert.ok(hits(label).includes(`${key}:${v}`), `«${label}»`);
  }
});

test('style names and ordinary queries do not trigger a filter by accident', () => {
  for (const q of ['Городецкая роспись', 'Модерн', 'Ар-деко', 'Готика', 'Кубизм', 'Малевич', 'импрессионизм', '1920', 'нюанс', 'Супрематизм', 'Барокко']) {
    assert.deepEqual(hits(q), [], q);
  }
  // Каждый результат — по порядку словарей и без повторов.
  assert.deepEqual(hits('наскальная живопись'), ['medium:painting', 'medium:rock-art']);
});

// Под выбранным сюжетом сначала стили, которым он главный, ниже — универсальные (any).
test('universal styles form a separate section under every subject, without repeating the main list', () => {
  for (const subject of Object.keys(SUBJECT).filter((v) => v !== 'any')) {
    const st = state({ subject });
    const main = filterStyles(styles, st);
    const extra = universalExtras(styles, st);
    assert.ok(extra.length > 0, subject);
    for (const s of extra) assert.ok(s.subjects.includes('any') && !s.subjects.includes(subject), `${subject}: ${s.id}`);
    assert.ok(!main.some((s) => extra.includes(s)), subject);
    // Вне обоих списков остаются только стили, привязанные к другим сюжетам.
    for (const s of styles) if (!main.includes(s) && !extra.includes(s)) assert.ok(!s.subjects.includes('any'), `${subject}: ${s.id}`);
  }
  assert.deepEqual(universalExtras(styles, emptyState()), []);
  assert.deepEqual(universalExtras(styles, state({ subject: 'any' })), []);
});

test('universal section obeys the other filters, so an empty main list still offers something', () => {
  const st = state({ subject: 'portrait', domain: 'internet' });
  assert.deepEqual(filterStyles(styles, st), []);
  const extra = ids(universalExtras(styles, st));
  for (const id of ['glitch-art', 'ai-aesthetic', 'pixel-art', 'vaporwave']) assert.ok(extra.includes(id), id);
  assert.ok(universalExtras(styles, st).every((s) => s.domain.includes('internet')));
});

test('styles known for a subject are in its main list; styles tied to one subject stay out of the others', () => {
  const main = (subject) => ids(filterStyles(styles, state({ subject })));
  const extra = (subject) => ids(universalExtras(styles, state({ subject })));
  for (const id of ['fayum-portraits', 'mannerism', 'baroque', 'zverev-portrait-graphics', 'ife-sculpture']) assert.ok(main('portrait').includes(id), id);
  for (const id of ['fauvism', 'nabis', 'expressionism', 'shan-shui', 'hokusai-landscape-prints']) assert.ok(main('landscape').includes(id), id);
  assert.ok(main('still-life').includes('post-impressionism'));
  // Шань-шуй и фаюмский портрет — только своим сюжетом; пиксель-арт — универсальный, без главного сюжета.
  assert.ok(!main('portrait').includes('shan-shui') && !extra('portrait').includes('shan-shui'));
  assert.ok(!main('landscape').includes('fayum-portraits') && !extra('landscape').includes('fayum-portraits'));
  assert.ok(extra('portrait').includes('pixel-art') && extra('landscape').includes('pixel-art'));
  assert.ok(main('any').includes('pixel-art') && !main('any').includes('gothic'));
});
