import { test } from 'node:test';
import assert from 'node:assert/strict';
import { layoutRows } from '../js/layout.js';

const x = (y) => y; // 1 год = 1 px
const nodes = [
  { id: 'a', start: 0, end: 100, tier: 1, width: 80, parents: [] },
  { id: 'b', start: 50, end: 150, tier: 1, width: 80, parents: ['a'] },
  { id: 'c', start: 60, end: 90, tier: 2, width: 40, parents: ['a'] },
  { id: 'd', start: 400, end: 500, tier: 1, width: 60, parents: ['b'] },
];

test('nodes in the same row never overlap', () => {
  const { rows, intervals } = layoutRows(nodes, x, { now: 600 });
  const byRow = new Map();
  for (const n of nodes) {
    const r = rows.get(n.id);
    for (const other of byRow.get(r) ?? []) {
      const [a, b] = intervals.get(n.id), [c, d] = intervals.get(other);
      assert.ok(!(a < d && c < b), `${n.id} overlaps ${other} in row ${r}`);
    }
    byRow.set(r, [...(byRow.get(r) ?? []), n.id]);
  }
});

test('a child far in time reuses its parent row', () => {
  const { rows } = layoutRows(nodes, x, { now: 600 });
  assert.equal(rows.get('d'), rows.get('b'));
});

test('manual row overrides are respected and rows are compacted', () => {
  const { rows, count } = layoutRows([{ ...nodes[0], row: 5 }], x, { now: 600 });
  assert.equal(rows.get('a'), 0);
  assert.equal(count, 1);
});
