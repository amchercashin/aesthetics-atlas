import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRecord, childrenOf, comparisonsOf, imageRecord } from '../scripts/lib/record.mjs';
import { roleLabel, fmtDates } from '../js/format.js';

const img = (file) => (file ? { w: 100, h: 80, src: { 250: 'u' }, page: `https://commons.wikimedia.org/wiki/File:${file}`, nonfree: false } : null);
const card = (over = {}) => ({
  id: 'x', name: 'Икс', orig: 'X', start: 1900, end: null, era: 'e', domain: ['art'], tier: 2,
  summary: 's', description: 'a\n\nb', traits: ['1', '2', '3'], parents: [{ id: 'p', type: 'evolved' }],
  example: { file: 'X.jpg', title: 't' },
  ...over,
});

test('corpus dates survive into display without turning unknown work dates into an ongoing practice', () => {
  const sample = card({
    dateKind: 'corpus', endKind: 'unknown', dates: 'корпус: около 1900 и недатированная работа',
    dateNote: 'Координата относится к выбранным работам; начало традиции не установлено.',
    corpus: [
      { workId: 'dated', title: 'Датированная работа', author: 'Автор не указан', year: 'около 1900', reference: 'https://museum.example/dated', sources: ['src'], whyRepresentative: 'Ритм линий.' },
      { workId: 'undated', title: 'Работа', author: 'Автор не указан', year: 'Дата не указана', reference: 'https://museum.example/work', sources: ['src'], whyRepresentative: 'Ритм линий.' },
    ],
  });
  const r = buildRecord(sample, { img });
  assert.equal(r.dateKind, 'corpus');
  assert.equal(r.dateNote, sample.dateNote);
  assert.equal(fmtDates(r), sample.dates);
  assert.equal(r.corpus[1].year, 'Дата не указана');
});

test('new model fields survive into the output record', () => {
  const r = buildRecord(card({
    kind: ['internet-aesthetic', 'movement'], kindNote: 'kn', scopeNote: 'scope', searchKeywords: ['k'], medium: 'ui',
    dateKind: 'practice', approx: true, dateNote: 'dn', termAttested: { year: 2008, source: 'src', note: 'tn' },
    revivals: [{ start: 2020, note: 'rv' }], formerIds: ['old'],
    evidence: [{ claim: 'c', field: 'dates', source: 'src' }],
    review: { status: 'partial', date: new Date('2026-10-13'), note: 'rn' },
    parents: [{ id: 'p', type: 'revival', status: 'verified', sources: ['src'], note: 'why' }],
    example: { file: 'X.jpg', title: 't', role: 'illustration', whyRepresentative: 'видно', rights: { note: 'фото ≠ работа' } },
    paletteNote: 'pn',
  }), { img, palette: { colors: ['#000000'] } });
  assert.deepEqual(r.kind, ['internet-aesthetic', 'movement']);
  assert.equal(r.kindNote, 'kn');
  assert.equal(r.scopeNote, 'scope');
  assert.deepEqual(r.searchKeywords, ['k']);
  assert.deepEqual(r.medium, ['ui']);
  assert.deepEqual(r.formerIds, ['old']);
  assert.equal(r.dateKind, 'practice');
  assert.equal(r.approx, true);
  assert.equal(r.dateNote, 'dn');
  assert.deepEqual(r.termAttested, { year: 2008, source: 'src', note: 'tn' });
  assert.deepEqual(r.revivals, [{ start: 2020, end: null, note: 'rv' }]);
  assert.equal(r.endKind, 'ongoing');
  assert.deepEqual(r.evidence, [{ claim: 'c', field: 'dates', source: 'src', note: null }]);
  assert.deepEqual(r.review, { status: 'partial', date: '2026-10-13', note: 'rn' });
  assert.deepEqual(r.parents, [{ id: 'p', type: 'revival', status: 'verified', note: 'why', sources: ['src'] }]);
  assert.equal(r.example.role, 'illustration');
  assert.equal(r.example.why, 'видно');
  assert.equal(r.example.img.rights.note, 'фото ≠ работа');
  assert.equal(r.example.img.rights.status, 'free');
  assert.equal(r.palette.source, 'image');
  assert.equal(r.palette.from, 'https://commons.wikimedia.org/wiki/File:X.jpg');
  assert.deepEqual(r.description, ['a', 'b']);
});

test('legacy cards get explicit "unverified" and "legacy" defaults, not "verified"', () => {
  const r = buildRecord(card(), { img });
  assert.equal(r.parents[0].status, 'unverified');
  assert.equal(r.review.status, 'legacy');
  assert.deepEqual(r.kind, []);
  assert.equal(r.example.role, 'work');
});

test('editorial palette is labelled as editorial, with its basis', () => {
  const r = buildRecord(card({ example: { title: 't' }, palette: ['#111111', '#222222', '#333333'], paletteNote: 'по признакам' }), { img, palette: { colors: ['#111111'] } });
  assert.equal(r.palette.source, 'editorial');
  assert.equal(r.palette.note, 'по признакам');
  assert.equal(r.palette.from, null);
});

test('precursors and reconstructions are not masked as ordinary works', () => {
  for (const role of ['precursor', 'reconstruction', 'illustration', 'portrait', 'revival']) {
    const rec = imageRecord({ title: 't', role }, img('A.jpg'));
    assert.equal(rec.role, role);
    assert.ok(roleLabel(rec.role), `no visible label for ${role}`);
  }
  assert.equal(roleLabel('work'), null);
});

test('non-embeddable images become a link, not an embedded picture', () => {
  const rec = imageRecord({ title: 't', rights: { embed: false } }, { ...img('A.jpg'), nonfree: true });
  assert.equal(rec.img, null);
  assert.equal(rec.external.nonfree, true);
  assert.equal(rec.external.rights.status, 'nonfree');
});

test('local assets resolve for both main and gallery images without losing caption sources', () => {
  const ref = 'assets/illustrations/flat-design.svg';
  const example = { asset: ref, title: 'Схема', role: 'illustration', year: 2026, sources: ['source-a'], note: 'Дата схемы' };
  const resolved = { local: true, w: 1200, h: 900, src: { 500: ref }, page: ref, nonfree: false };
  const r = buildRecord(card({ example, gallery: [example] }), { img: (key) => key === ref ? resolved : null });
  for (const im of [r.example, ...r.gallery]) {
    assert.equal(im.img.local, true);
    assert.equal(im.img.page, ref);
    assert.equal(im.role, 'illustration');
    assert.equal(im.year, 2026);
    assert.equal(im.note, 'Дата схемы');
    assert.deepEqual(im.sources, ['source-a']);
  }
});

test('children carry relation status; comparisons are symmetric', () => {
  const styles = [card({ id: 'p', parents: [] }), card({ id: 'x', compare: [{ id: 'p', note: 'похожи' }] })];
  assert.equal(childrenOf(styles).get('p')[0].status, 'unverified');
  const cmp = comparisonsOf(styles);
  assert.deepEqual(cmp.get('x').map((c) => c.id), ['p']);
  assert.deepEqual(cmp.get('p').map((c) => c.id), ['x']);
});
