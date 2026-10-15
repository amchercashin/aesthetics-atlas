import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapDetail, aggregateMapLinks } from '../js/map-detail.js';

test('whole history prioritises seas at phone, laptop and very wide viewport fits', () => {
  for (const fit of [0.013, 0.035, 0.06, 0.15, 0.3]) {
    const d = mapDetail(fit, fit, Math.max(0.2, fit * 1.05));
    assert.equal(d.level, 'seas');
    for (const layer of ['nodes', 'labels', 'edges']) assert.equal(d[layer], 0, layer);
    assert.equal(d.seaNames, 1);
    assert.equal(d.regions, 1);
  }
});

test('parts have their own readable scale before individual cards and branches', () => {
  const d = mapDetail(0.2 * 0.9, 0.04, 0.2);
  assert.equal(d.level, 'parts');
  assert.equal(d.partNames, 1);
  assert.equal(d.seaNames, 0);
  assert.equal(d.regions, 1);
  assert.equal(d.nodes + d.labels + d.edges, 0);
});

test('card labels replace engraving while stable geography preserves orientation at maximum zoom', () => {
  for (const k of [0.268, 0.42, 1, 2, 5]) {
    const d = mapDetail(k, 0.04, 0.2);
    assert.equal(d.labels, 1);
    assert.equal(d.nodes, 1);
    assert.equal(d.regions + d.seaNames + d.partNames, 0);
    assert.equal(d.coast, 1, 'the orientation coast must survive further zooming');
  }
  assert.equal(mapDetail(0.2 * 1.7, 0.04, 0.2).edges, 1);
});

test('continuous layer fades retrace the same values in both directions', () => {
  const values = Array.from({ length: 2001 }, (_, i) => mapDetail(0.04 * 20 ** (i / 2000), 0.04, 0.2));
  for (const key of ['regions', 'coast', 'nodes', 'labels', 'edges']) {
    const up = values.map((d) => d[key]);
    for (let i = 1; i < up.length; i++) {
      assert.ok(Math.abs(up[i] - up[i - 1]) < 0.018, key);
      assert.ok(key === 'regions' ? up[i] <= up[i - 1] : up[i] >= up[i - 1], key);
    }
    for (let i = 0; i <= 2000; i++) {
      const reverse = mapDetail(0.04 * 20 ** ((2000 - i) / 2000), 0.04, 0.2)[key];
      assert.ok(Math.abs(reverse - up[2000 - i]) < 1e-12, key);
    }
  }
  for (const d of values) for (const [key, v] of Object.entries(d)) if (key !== 'level') assert.ok(v >= 0 && v <= 1, key);
});

test('a disabled region layer still exposes individual cards and their graph', () => {
  const d = mapDetail(0.04, 0.04, 0.2, false);
  assert.equal(d.nodes + d.labels + d.edges, 3);
  assert.equal(d.regions + d.coast + d.aggregates, 0);
});

const groups = new Map([['a', 'sea-1'], ['b', 'sea-2'], ['c', 'sea-1'], ['free', null]]);
const records = [
  { from: 'a', to: 'b', kind: 'history', primary: true, status: 'unverified' },
  { from: 'b', to: 'c', kind: 'history', primary: false, status: 'verified' },
  { from: 'a', to: 'c', kind: 'history', primary: true, status: 'verified' },
  { from: 'a', to: 'free', kind: 'history', primary: true, status: 'verified' },
  { from: 'a', to: 'b', kind: 'comparison' },
  { from: 'c', to: 'b', kind: 'context', status: 'verified' },
];

test('sea summaries preserve the actual types, statuses and opposite directions of card links', () => {
  const all = aggregateMapLinks(records, (id) => groups.get(id), { mode: 'all' });
  assert.equal(all.length, 1);
  assert.deepEqual(all[0].records, [records[0], records[1], records[4], records[5]]);
  assert.deepEqual([all[0].a, all[0].b], ['sea-1', 'sea-2']);
  assert.equal(all[0].records[1].from, 'b', 'the opposite direction must not be rewritten');
});

test('all three line modes and the verification filter also govern sea summaries', () => {
  const go = (opts) => aggregateMapLinks(records, (id) => groups.get(id), opts);
  assert.deepEqual(go({ mode: 'none' }), []);
  assert.deepEqual(go({ mode: 'main' })[0].records, [records[0]]);
  assert.deepEqual(go({ mode: 'main', verifiedOnly: true }), []);
  assert.deepEqual(go({ mode: 'all', verifiedOnly: true })[0].records, [records[1], records[5]]);
});
