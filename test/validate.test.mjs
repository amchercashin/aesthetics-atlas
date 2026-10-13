import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validate } from '../scripts/lib/validate.mjs';

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

test('either example.file or palette is required', () => {
  const r1 = validate([root, base({ example: { title: 't' } })], eras);
  assert.ok(r1.errors.some((e) => e.includes('image or palette')));
  const r2 = validate([root, base({ example: { title: 't' }, palette: ['#ff0000', '#00ff00', '#0000ff'] })], eras);
  assert.deepEqual(r2.errors, []);
});

test('bad relation type, unknown era, bad dates', () => {
  const r = validate([root, base({ parents: [{ id: 'root', type: 'magic' }], era: 'zz', start: 300, end: 100 })], eras);
  assert.ok(r.errors.some((e) => e.includes('relation type')));
  assert.ok(r.errors.some((e) => e.includes('unknown era')));
  assert.ok(r.errors.some((e) => e.includes('start > end')));
});

test('parent starting after child is a warning, not an error', () => {
  const late = base({ id: 'late', start: 500, end: 600 });
  const r = validate([root, late, base({ parents: [{ id: 'late', type: 'influence' }] })], eras);
  assert.deepEqual(r.errors, []);
  assert.ok(r.warnings.some((w) => w.includes('starts after child')));
});
