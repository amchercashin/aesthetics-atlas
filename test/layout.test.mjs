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

import { layoutLanes } from '../js/layout.js';

test('lanes keep nodes in their own lane and never overlap within a row', () => {
  const ns = [
    { id: 'a', start: 0, end: 100, tier: 1, width: 60, parents: [], lane: 'art' },
    { id: 'b', start: 20, end: 120, tier: 1, width: 60, parents: ['a'], lane: 'art' },
    { id: 'c', start: 30, end: 90, tier: 2, width: 40, parents: ['a'], lane: 'design' },
    { id: 'd', start: 40, end: 80, tier: 2, width: 40, parents: ['c'], lane: 'design' },
  ];
  const { pos, counts, intervals } = layoutLanes(ns, (y) => y, { lanes: ['art', 'design'], laneOf: (n) => n.lane, now: 200 });
  assert.equal(pos.get('a').lane, 0);
  assert.equal(pos.get('c').lane, 1);
  assert.equal(counts.length, 2);
  for (const n of ns) for (const m of ns) {
    if (n.id >= m.id) continue;
    const p = pos.get(n.id), q = pos.get(m.id);
    if (p.lane !== q.lane || p.row !== q.row) continue;
    const [a, b] = intervals.get(n.id), [c, d] = intervals.get(m.id);
    assert.ok(!(a < d && c < b), `${n.id} overlaps ${m.id}`);
  }
});

test('comparison links do not change the genealogy layout', () => {
  const lanes = ['l1', 'l2'];
  const opts = { lanes, laneOf: (n) => n.lane, now: 600 };
  const plain = nodes.map((n, i) => ({ ...n, lane: lanes[i % 2] }));
  const withCompare = plain.map((n) => ({ ...n, compare: [{ id: 'a', note: 'похоже' }] }));
  const a = layoutLanes(plain, x, opts), b = layoutLanes(withCompare, x, opts);
  assert.deepEqual([...a.pos], [...b.pos]);
});

// ---- родословное древо (карта v3) ----
import { layoutGenealogy, routeBranches } from '../js/layout.js';
import fs from 'node:fs';
import { createTimeScale, segmentWidths } from '../js/timescale.js';

const atlas = JSON.parse(fs.readFileSync(new URL('../data/atlas.json', import.meta.url), 'utf8'));
const realNodes = atlas.styles.map((s) => ({ id: s.id, start: s.start, end: s.end, tier: s.tier, width: s.name.length * 8 + 20, parents: s.parents.map((p) => p.id) }));
const brk = [...atlas.eras.map((e) => e.start), 2027];
const scReal = createTimeScale(brk, segmentWidths(brk, atlas.styles.map((s) => s.start), { base: 60, perItem: 70, min: 160 }));

test('genealogy layout: every node placed, no overlapping intervals in a row', () => {
  const lay = layoutGenealogy(realNodes, scReal.x, { now: 2027 });
  assert.equal(lay.pos.size, realNodes.length);
  const byRow = new Map();
  for (const n of realNodes) {
    const r = lay.pos.get(n.id);
    assert.ok(Number.isInteger(r) && r >= 0 && r < lay.count);
    const [a, b] = lay.intervals.get(n.id);
    for (const o of byRow.get(r) ?? []) { const [c, d] = lay.intervals.get(o); assert.ok(!(a < d && c < b), `${n.id} overlaps ${o}`); }
    byRow.set(r, [...(byRow.get(r) ?? []), n.id]);
  }
});

test('genealogy layout is deterministic and ignores comparison links and input order', () => {
  const a = layoutGenealogy(realNodes, scReal.x, { now: 2027 });
  const b = layoutGenealogy([...realNodes].reverse().map((n) => ({ ...n, compare: [{ id: 'x' }] })), scReal.x, { now: 2027 });
  assert.deepEqual([...a.pos].sort(), [...b.pos].sort());
});

test('genealogy layout keeps children close to their primary parent', () => {
  const lay = layoutGenealogy(realNodes, scReal.x, { now: 2027 });
  let span = 0, n = 0;
  for (const s of realNodes) { const p = lay.primary.get(s.id); if (p) { span += Math.abs(lay.pos.get(p) - lay.pos.get(s.id)); n++; } }
  assert.ok(span / n < 3, `mean branch span ${span / n}`);
  assert.ok(lay.count < realNodes.length / 3, `rows ${lay.count}`);
});

test('genealogy layout survives cycles and missing parents', () => {
  const nodes = [
    { id: 'a', start: 0, end: 10, tier: 1, width: 30, parents: ['b'] },
    { id: 'b', start: 5, end: 20, tier: 1, width: 30, parents: ['a'] },
    { id: 'c', start: 8, end: 30, tier: 2, width: 30, parents: ['ghost'] },
  ];
  const lay = layoutGenealogy(nodes, (y) => y * 10, { now: 40 });
  assert.equal(lay.pos.size, 3);
});

test('branch router finds clear corridors for almost all branches', () => {
  const lay = layoutGenealogy(realNodes, scReal.x, { now: 2027 });
  const rt = routeBranches(realNodes, scReal.x, lay, { now: 2027 });
  const primaries = realNodes.filter((n) => lay.primary.get(n.id)).length;
  assert.equal(rt.size, primaries);
  const conflicted = [...rt.values()].filter((v) => v.cost >= 1).length;
  assert.ok(conflicted <= primaries * 0.06, `conflicted branches ${conflicted}`);
});

test('genealogy layout scales to ~650 styles quickly', () => {
  const big = [];
  for (let k = 0; k < 4; k++) for (const n of realNodes) big.push({ ...n, id: `${n.id}~${k}`, start: n.start + k * 3, parents: n.parents.map((p) => `${p}~${k}`) });
  const t0 = performance.now();
  const lay = layoutGenealogy(big, scReal.x, { now: 2027 });
  routeBranches(big, scReal.x, lay, { now: 2027 });
  const ms = performance.now() - t0;
  assert.equal(lay.pos.size, big.length);
  assert.ok(ms < 3000, `${ms} ms`);
});
