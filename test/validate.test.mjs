import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validate, relationDateIssue, applicableScope, reviewTraceIssues, REVIEW_STANDARD_FROM } from '../scripts/lib/validate.mjs';

const eras = [{ id: 'a', name: 'A', start: -50000, end: 0 }, { id: 'b', name: 'B', start: 0, end: 2030 }];
const base = (over = {}) => ({
  id: 'x', name: 'Икс', orig: 'X', start: 100, end: 200, era: 'b', domain: ['art'], tier: 2,
  summary: 's', description: 'd', traits: ['a', 'b', 'c'], parents: [{ id: 'root', type: 'evolved' }],
  example: { file: 'X.jpg', title: 't' }, links: [{ url: 'https://a', src: 'A' }, { url: 'https://b', src: 'B' }, { url: 'https://c', src: 'C' }],
  ...over,
});
const root = base({ id: 'root', start: -40000, end: -10000, era: 'a', parents: [], root: true });

test('valid graph passes', () => {
  const r = validate([root, base()], eras);
  assert.deepEqual(r.errors, []);
});

test('corpus coordinates need dated works and an explicit explanation of their limits', () => {
  const sample = base({
    start: 1900, end: 1900,
    dateKind: 'corpus', dates: 'корпус: около 1900; остальные даты неизвестны',
    dateNote: 'Координата относится к работе, не к возникновению традиции.',
    corpus: [{ workId: 'one', file: 'X.jpg', title: 'Работа', author: 'Автор не указан', year: 'около 1900', sources: ['src'], whyRepresentative: 'Повторение линий.' }],
  });
  const sources = [{ id: 'src', sourceType: 'museum', title: 'Предметная запись', url: 'https://museum.example/work' }];
  assert.deepEqual(validate([root, sample], eras, sources).errors, []);
  for (const over of [{ dates: '' }, { dates: 1900 }, { dateNote: '' }, { corpus: [] }]) {
    assert.ok(validate([root, { ...sample, ...over }], eras, sources).errors.some(e => e.includes('corpus dates need')), JSON.stringify(over));
  }
});

test('duplicate ids and unknown parent are errors', () => {
  const r = validate([root, base(), base({ parents: [{ id: 'nope', type: 'evolved' }] })], eras);
  assert.ok(r.errors.some((e) => e.includes('duplicate id')));
  assert.ok(r.errors.some((e) => e.includes('unknown parent "nope"')));
});

test('cycles are detected', () => {
  const a = base({ id: 'a1', parents: [{ id: 'b1', type: 'evolved' }] });
  const b = base({ id: 'b1', parents: [{ id: 'a1', type: 'evolved' }] });
  const r = validate([root, a, b], eras);
  assert.ok(r.errors.some((e) => e.includes('cycle')));
});

test('non-root without parents breaks connectivity', () => {
  const r = validate([root, base({ parents: [] })], eras);
  assert.ok(r.errors.some((e) => e.includes('no parents')));
});

test('an image, palette or sourced external work is required', () => {
  const r1 = validate([root, base({ example: { title: 't' } })], eras);
  assert.ok(r1.errors.some((e) => e.includes('image, palette or sourced external reference')));
  const r2 = validate([root, base({ example: { title: 't' }, palette: ['#ff0000', '#00ff00', '#0000ff'] })], eras);
  assert.deepEqual(r2.errors, []);
});

test('local illustrations need a safe path and an honest dated caption', () => {
  const example = { asset: 'assets/illustrations/web-1-0.svg', title: 'Макет', author: 'Редакция', year: 2026, role: 'reconstruction', whyRepresentative: 'Таблицы и ссылки' };
  assert.deepEqual(validate([root, base({ example })], eras).errors, []);
  for (const over of [
    { asset: '../outside.svg' }, { asset: 'https://example.com/a.svg' },
    { file: 'X.jpg' }, { role: 'work' }, { author: null }, { year: null }, { whyRepresentative: null },
  ]) assert.ok(validate([root, base({ example: { ...example, ...over } })], eras).errors.length, JSON.stringify(over));
});

test('bad relation type, unknown era, bad dates', () => {
  const r = validate([root, base({ parents: [{ id: 'root', type: 'magic' }], era: 'zz', start: 300, end: 100 })], eras);
  assert.ok(r.errors.some((e) => e.includes('relation type')));
  assert.ok(r.errors.some((e) => e.includes('unknown era')));
  assert.ok(r.errors.some((e) => e.includes('start > end')));
});

test('relation dates: warnings depend on relation type and approximate dates', () => {
  const late = base({ id: 'late', start: 500, end: 600 });
  // Развитие из более позднего стиля — предупреждение, не ошибка.
  const r1 = validate([root, late, base({ parents: [{ id: 'late', type: 'evolved' }] })], eras);
  assert.deepEqual(r1.errors, []);
  assert.ok(r1.warnings.some((w) => w.includes('развитие из "late"')));
  // Влияние современника допустимо; влияние стиля, начавшегося после конца потомка, — нет.
  const peer = base({ id: 'peer', start: 150, end: 300 });
  const r2 = validate([root, peer, base({ parents: [{ id: 'root', type: 'evolved' }, { id: 'peer', type: 'influence' }] })], eras);
  assert.ok(!r2.warnings.some((w) => w.includes('peer')));
  const r3 = validate([root, late, base({ parents: [{ id: 'root', type: 'evolved' }, { id: 'late', type: 'influence' }] })], eras);
  assert.ok(r3.warnings.some((w) => w.includes('влияние "late"')));
  // Приблизительные даты дают запас: расхождение в 10 лет не шумит.
  const near = base({ id: 'near', start: 110, end: 300, approx: true });
  const r4 = validate([root, near, base({ start: 100, approx: true, parents: [{ id: 'near', type: 'evolved' }] })], eras);
  assert.deepEqual(r4.warnings.filter((w) => w.includes('near')), []);
});

test('relationDateIssue: revival of a later style is flagged', () => {
  assert.match(relationDateIssue({ id: 'p', start: 1900 }, { id: 'c', start: 1800 }, 'revival'), /возрождение/);
  assert.equal(relationDateIssue({ id: 'p', start: 1700 }, { id: 'c', start: 1800 }, 'revival'), null);
});

const sources = [{ id: 'src-a', title: 'A', url: 'https://a.example', sourceType: 'museum', checked: '2026-10-13' }];

test('unknown source id is detected everywhere it can be referenced', () => {
  const r = validate([root, base({
    evidence: [{ claim: 'c', source: 'nope-1' }],
    termAttested: { year: 1900, source: 'nope-2' },
    parents: [{ id: 'root', type: 'evolved', status: 'verified', sources: ['nope-3'] }],
  })], eras, sources);
  for (const id of ['nope-1', 'nope-2', 'nope-3']) assert.ok(r.errors.some((e) => e.includes(`unknown source "${id}"`)), id);
});

test('verified relation needs a source; known source passes', () => {
  const r1 = validate([root, base({ parents: [{ id: 'root', type: 'evolved', status: 'verified' }] })], eras, sources);
  assert.ok(r1.errors.some((e) => e.includes('needs sources')));
  const r2 = validate([root, base({ parents: [{ id: 'root', type: 'evolved', status: 'verified', sources: ['src-a'] }] })], eras, sources);
  assert.deepEqual(r2.errors, []);
});

test('unknown origin is allowed without an invented parent', () => {
  const r = validate([root, base({ parents: [], origin: 'unknown' })], eras);
  assert.deepEqual(r.errors, []);
  const r2 = validate([root, base({ parents: [], origin: 'unknown', root: true })], eras);
  assert.ok(r2.errors.some((e) => e.includes('mutually exclusive')));
});

test('comparisons are a separate layer: not cycles, but checked for shape', () => {
  const a = base({ id: 'a1', compare: [{ id: 'b1', note: 'похожи' }] });
  const b = base({ id: 'b1', compare: [] });
  assert.deepEqual(validate([root, a, b], eras).errors, []);
  // Пара объявлена с обеих сторон — ошибка; сопоставление без пояснения — ошибка.
  const b2 = base({ id: 'b1', compare: [{ id: 'a1', note: 'x' }] });
  assert.ok(validate([root, a, b2], eras).errors.some((e) => e.includes('both sides')));
  const a3 = base({ id: 'a1', compare: [{ id: 'b1' }] });
  assert.ok(validate([root, a3, b], eras).errors.some((e) => e.includes('needs a note')));
});

test('bad kind, image role and dateKind are rejected', () => {
  const r = validate([root, base({ kind: 'genre', dateKind: 'vibes', example: { file: 'X.jpg', title: 't', role: 'fake' } })], eras);
  assert.ok(r.errors.some((e) => e.includes('bad kind')));
  assert.ok(r.errors.some((e) => e.includes('bad dateKind')));
  assert.ok(r.errors.some((e) => e.includes('bad image role')));
});

test('formerIds may not shadow an active id', () => {
  const r = validate([root, base({ formerIds: ['root'] })], eras);
  assert.ok(r.errors.some((e) => e.includes('still an active id')));
});

test('promptCues are optional, but when present they are 3–4 non-empty phrases', () => {
  const ok = base({ promptCues: ['Плоский цвет', 'Чёткий контур', 'Смелое кадрирование'] });
  assert.deepEqual(validate([root, ok], eras).errors, []);
  for (const promptCues of [['один', 'два'], ['1', '2', '3', '4', '5'], ['a', '', 'c'], 'строка']) {
    assert.ok(validate([root, base({ promptCues })], eras).errors.some((e) => e.includes('promptCues')), JSON.stringify(promptCues));
  }
});

test('review must say what was checked', () => {
  const review = (scope) => base({ review: { status: 'partial', date: '2026-10-16', scope } });
  assert.deepEqual(validate([root, review(['relations', 'dates'])], eras).errors, []);
  for (const [scope, msg] of [[undefined, 'must list'], [[], 'must list'], [['images', 'photos'], 'bad review.scope'], [['text', 'text'], 'duplicate review.scope']]) {
    assert.ok(validate([root, review(scope)], eras).errors.some((e) => e.includes(msg)), JSON.stringify(scope));
  }
});

test('subjects come only from the fixed vocabulary; any marks a universal style; an empty list is an error', () => {
  assert.deepEqual(validate([root, base({ subjects: ['landscape', 'portrait'] })], eras).errors, []);
  assert.deepEqual(validate([root, base({ subjects: ['landscape', 'any'] })], eras).errors, []);
  assert.deepEqual(validate([root, base({ subjects: ['any'] })], eras).errors, []);
  for (const [subjects, msg] of [[[], 'list the style\'s subjects or any'], [['пейзаж'], 'bad subject'], [['seascape'], 'bad subject'], [['animals', 'animals'], 'duplicate subject'], ['landscape', 'must be a list']]) {
    assert.ok(validate([root, base({ subjects })], eras).errors.some((e) => e.includes(msg)), JSON.stringify(subjects));
  }
  assert.ok(validate([root, base({ medium: ['relief', 'relief'] })], eras).errors.some((e) => e.includes('duplicate medium')));
  assert.deepEqual(validate([root, base({ medium: ['sculpture', 'relief'] })], eras).errors, []);
});

// Сверка: reviewed — только полная; с REVIEW_STANDARD_FROM каждая заявленная часть оставляет следы в данных.
const reviewSources = [{ id: 'src', title: 'Музей', url: 'https://museum.example/', sourceType: 'museum' }];
const g = (over = {}) => ({ file: 'G.jpg', title: 'Ваза', author: 'мастер неизвестен', year: 'ок. 500 до н. э.', whyRepresentative: 'Чернофигурная роспись по оранжевой глине.', ...over });
const traced = (scope, over = {}) => base({
  parents: [{ id: 'root', type: 'evolved', status: 'verified', sources: ['src'] }],
  dateKind: 'period',
  evidence: [{ claim: 'Даты', field: 'dates', source: 'src' }, { claim: 'Описание', field: 'description', source: 'src' }],
  example: { file: 'X.jpg', title: 't', whyRepresentative: 'Видны признаки.', sources: ['src'] },
  gallery: [g()],
  review: { status: 'partial', date: REVIEW_STANDARD_FROM, scope },
  ...over,
});
const reviewErrors = (s) => validate([root, s], eras, reviewSources).errors.filter((e) => e.includes('review'));

test('applicable review scope includes corpus and gallery only when the card has them', () => {
  assert.deepEqual(applicableScope({}), ['relations', 'dates', 'text', 'images']);
  assert.deepEqual(applicableScope({ corpus: [{}], gallery: [{}] }), ['relations', 'dates', 'text', 'corpus', 'images', 'gallery']);
  assert.deepEqual(applicableScope({ corpus: [], gallery: [] }), ['relations', 'dates', 'text', 'images']);
});

test('status reviewed requires every applicable part of the scope', () => {
  const full = ['relations', 'dates', 'text', 'images', 'gallery'];
  assert.deepEqual(reviewErrors(traced(full, { review: { status: 'reviewed', date: REVIEW_STANDARD_FROM, scope: full } })), []);
  const short = reviewErrors(traced(['relations', 'text'], { review: { status: 'reviewed', date: '2026-10-14', scope: ['relations', 'text'] } }));
  assert.ok(short.some((e) => e.includes('not checked: dates, images, gallery')), short.join('\n'));
  // partial с неполной сверкой — нормальное состояние.
  assert.deepEqual(reviewErrors(traced(['relations'])), []);
});

test('review traces are enforced from the standard date, not for older reviews', () => {
  const bare = { parents: [{ id: 'root', type: 'evolved' }], dateKind: undefined, evidence: [], example: { file: 'X.jpg', title: 't' }, gallery: [g({ author: 'Unknown authorUnknown author', year: null, whyRepresentative: 'Ваза' })] };
  const scope = ['relations', 'dates', 'text', 'images', 'gallery'];
  const old = traced(scope, { ...bare, review: { status: 'partial', date: '2026-10-16', scope } });
  assert.deepEqual(reviewErrors(old), []);
  const fresh = reviewErrors(traced(scope, bare));
  for (const part of ['explicit status', 'dateKind', 'field "dates"', 'evidence for the text', 'whyRepresentative', 'caption sources', 'author of the work', 'needs a year', 'not the title']) {
    assert.ok(fresh.some((e) => e.includes(part)), `${part}\n${fresh.join('\n')}`);
  }
});

test('review traces accept corpus dates, termAttested and honest unknowns', () => {
  const corpus = [{ workId: 'w', file: 'C.jpg', title: 'Работа', author: 'мастер неизвестен', year: 1900, sources: ['src'], whyRepresentative: 'Узор.' }];
  assert.deepEqual(reviewTraceIssues({ review: { scope: ['dates'] }, dateKind: 'corpus', corpus }), []);
  assert.deepEqual(reviewTraceIssues({ review: { scope: ['dates'] }, dateKind: 'popularity', termAttested: { year: 2014, source: 'src' } }), []);
  assert.deepEqual(reviewTraceIssues({ review: { scope: ['gallery'] }, gallery: [g({ author: 'автор неизвестен', year: 'дата неизвестна' })] }), []);
  // Локальная копия или ссылка на работу без источника подписи не проходит.
  const local = g({ file: undefined, asset: 'assets/works/a.jpg' });
  assert.ok(reviewTraceIssues({ review: { scope: ['gallery'] }, gallery: [local] }).some((e) => e.includes('caption sources')));
  assert.deepEqual(reviewTraceIssues({ review: { scope: ['gallery'] }, gallery: [{ ...local, sources: ['src'] }] }), []);
});
