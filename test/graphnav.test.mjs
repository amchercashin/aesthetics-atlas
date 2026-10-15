// test/graphnav.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stepTarget } from '../js/graphnav.js';

const styles = [
  { id: 'root', start: 0, parents: [], children: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] },
  { id: 'a', start: 10, parents: [{ id: 'root' }], children: [{ id: 'd' }, { id: 'c' }] },
  { id: 'b', start: 11, parents: [{ id: 'root' }], children: [] },
  { id: 'c', start: 12, parents: [{ id: 'root' }, { id: 'a' }], children: [] },
  { id: 'd', start: 20, parents: [{ id: 'a' }], children: [] },
];
const byId = new Map(styles.map((s) => [s.id, s]));
const store = { styles, get: (id) => byId.get(id) };
const rows = { root: 5, a: 4, b: 6, c: 8, d: 3 };
const row = (id) => rows[id];
const go = (id, key) => stepTarget(store, row, id, key);

test('keyboard traversal skips roots hidden by the author layer', () => {
  const roots = ['visible', 'author', 'next'].map((id, i) => ({ id, start: i, parents: [], children: [] }));
  const map = new Map(roots.map((s) => [s.id, s]));
  const st = { styles: roots, get: (id) => map.get(id) };
  const row = (id) => roots.findIndex((s) => s.id === id);
  assert.equal(stepTarget(st, row, 'visible', 'ArrowDown'), 'author');
  assert.equal(stepTarget(st, row, 'visible', 'ArrowDown', (s) => s.id !== 'author'), 'next');
});

test('left goes to the primary parent, never a secondary one', () => {
  assert.equal(go('a', 'ArrowLeft'), 'root');
  assert.equal(go('c', 'ArrowLeft'), 'root');
  assert.equal(go('root', 'ArrowLeft'), null);
});

test('right goes to the child nearest by row; a tie goes to the earlier one', () => {
  assert.equal(go('root', 'ArrowRight'), 'a');
  assert.equal(go('a', 'ArrowRight'), 'd');
  assert.equal(go('b', 'ArrowRight'), null);
});

test('up and down walk the siblings of the primary parent by row', () => {
  assert.equal(go('a', 'ArrowDown'), 'b');
  assert.equal(go('c', 'ArrowUp'), 'b');
  assert.equal(go('a', 'ArrowUp'), null);
  assert.equal(go('c', 'ArrowDown'), null);
});

test('roots are each other\'s siblings; a lone root has none', () => {
  assert.equal(go('root', 'ArrowUp'), null);
  assert.equal(go('root', 'ArrowDown'), null);
});

test('unknown style or key gives null', () => {
  assert.equal(go('nope', 'ArrowLeft'), null);
  assert.equal(go('a', 'Enter'), null);
});

test('right ignores children that have this style only as a secondary parent', () => {
  const st = [
    { id: 'x', start: 0, parents: [], children: [{ id: 'y' }, { id: 'w' }] },
    { id: 'z', start: 0, parents: [], children: [{ id: 'y' }] },
    { id: 'y', start: 10, parents: [{ id: 'z' }, { id: 'x' }], children: [] },   // главный предок z
    { id: 'w', start: 11, parents: [{ id: 'x' }], children: [] },
  ];
  const m = new Map(st.map((s) => [s.id, s]));
  const store2 = { styles: st, get: (id) => m.get(id) };
  const r = { x: 5, y: 5, z: 9, w: 9 };
  assert.equal(stepTarget(store2, (id) => r[id], 'x', 'ArrowRight'), 'w');
  assert.equal(stepTarget(store2, (id) => r[id], 'z', 'ArrowRight'), 'y');
});
