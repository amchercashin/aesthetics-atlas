// test/nebulae.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { closestPart, validateNebulae, resolveNebulae } from '../scripts/lib/nebulae.mjs';

const S = (id, parents = [], extra = {}) => ({ id, parents: parents.map(([p, type]) => ({ id: p, type })), tier: 2, start: 0, ...extra });
const styles = [S('a'), S('b', [['a', 'evolved']]), S('c', [['a', 'influence']]), S('d', [['b', 'evolved']])];
const doc = (over = {}) => ({
  nebulae: [{ id: 'n1', name: 'Первая', color: '#aa3300', parts: [{ id: 'p1', name: 'Часть', styles: ['a', 'b'] }, { id: 'p2', name: 'Вторая', styles: ['d'] }] }],
  free: ['c'], ...over,
});

test('a complete document passes', () => {
  assert.deepEqual(validateNebulae(doc(), styles).errors, []);
});

test('a style outside nebulae and free is an error with the closest part', () => {
  const r = validateNebulae(doc({ free: [] }), styles);
  assert.ok(r.errors.some((e) => e.includes('"c"') && e.includes('closest by links: part "p1"')), r.errors.join('\n'));
});

test('duplicate ids, unknown styles, double listing and empty parts are errors', () => {
  const d = doc();
  d.nebulae.push({ id: 'n1', name: 'Дубль', parts: [{ id: 'p1', name: 'Дубль', styles: [] }] });
  d.nebulae[0].parts[1].styles.push('zzz', 'a');
  const e = validateNebulae(d, styles).errors.join('\n');
  assert.match(e, /duplicate nebula id "n1"/);
  assert.match(e, /duplicate part id "p1"/);
  assert.match(e, /part "p1" has no styles/);
  assert.match(e, /unknown style "zzz"/);
  assert.match(e, /style "a" is listed twice/);
});

test('a bad color is an error', () => {
  const d = doc(); d.nebulae[0].color = 'red';
  assert.match(validateNebulae(d, styles).errors.join('\n'), /color must be #rrggbb/);
});

test('closestPart weighs links by type, in both directions', () => {
  const partOf = new Map([['a', 'p1'], ['d', 'p2']]);
  assert.equal(closestPart('b', styles, partOf), 'p1');   // родитель a (развитие 1) и потомок d (развитие 1): ничья → по id
  assert.equal(closestPart('c', styles, partOf), 'p1');
  assert.equal(closestPart('zzz', styles, partOf), null);
});

test('resolveNebulae keeps an explicit color, falls back to the lead style accent, then to grey', () => {
  const withPal = [S('a', [], { tier: 1, start: 5, palette: { accent: '#112233' } }), S('b', [], { tier: 2, start: 1, palette: { accent: '#445566' } }), S('c')];
  const d = { nebulae: [
    { id: 'x', name: 'X', color: '#abcdef', parts: [{ id: 'px', name: 'PX', styles: ['a'] }] },
    { id: 'y', name: 'Y', parts: [{ id: 'py', name: 'PY', styles: ['a', 'b'] }] },
    { id: 'z', name: 'Z', parts: [{ id: 'pz', name: 'PZ', styles: ['c'] }] },
  ], free: [] };
  const r = resolveNebulae(d, withPal);
  assert.deepEqual(r.nebulae.map((n) => n.color), ['#abcdef', '#112233', '#888780']);
  assert.deepEqual(r.byStyle.get('b'), { nebula: 'y', part: 'py' });
});

test('the real content/nebulae.yaml covers every style in content/styles', () => {
  const root = path.resolve(import.meta.dirname, '..');
  const all = fs.readdirSync(path.join(root, 'content/styles')).filter((f) => f.endsWith('.yaml'))
    .flatMap((f) => yaml.load(fs.readFileSync(path.join(root, 'content/styles', f), 'utf8')) ?? []);
  const real = yaml.load(fs.readFileSync(path.join(root, 'content/nebulae.yaml'), 'utf8'));
  assert.deepEqual(validateNebulae(real, all).errors, []);
});
