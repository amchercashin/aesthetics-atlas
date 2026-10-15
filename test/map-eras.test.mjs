import { test } from 'node:test';
import assert from 'node:assert/strict';
import { layoutEraLabels } from '../js/map-eras.js';

const intervals = [0, 12, 24, 42, 130, 190, 230, 260, 350, 400, 450, 500, 580]
  .slice(0, -1).map((start, id, a) => ({ id, start, end: a[id + 1] ?? 580 }));

test('all overview epochs fit without overlap, including compressed early history', () => {
  const labels = layoutEraLabels(intervals, 4, 600);
  assert.equal(labels.length, 12);
  assert.deepEqual(labels.map((l) => l.id), intervals.map((l) => l.id));
  for (let i = 0; i < labels.length; i++) {
    assert.ok(labels[i].y >= 16 && labels[i].y <= 588);
    if (i) assert.ok(labels[i].y - labels[i - 1].y >= 28 - 1e-9);
    assert.equal(labels[i].anchor, (Math.max(4, intervals[i].start) + intervals[i].end) / 2);
  }
});

test('uncongested labels stay at the actual time interval centres', () => {
  const labels = layoutEraLabels([{ id: 0, start: 10, end: 90 }, { id: 1, start: 90, end: 200 }], 0, 200);
  assert.deepEqual(labels.map((l) => [l.anchor, l.y]), [[50, 50], [145, 145]]);
});

test('compact overview keeps all twelve epochs on a small portrait phone', () => {
  const small = intervals.map((s) => ({ ...s, start: s.start / 2 + 6, end: s.end / 2 + 6 }));
  const labels = layoutEraLabels(small, 6, 300, { height: 20, gap: 3 });
  assert.equal(labels.length, 12);
  for (let i = 0; i < labels.length; i++) {
    assert.ok(labels[i].y >= 16 && labels[i].y <= 290);
    if (i) assert.ok(labels[i].y - labels[i - 1].y >= 23 - 1e-9);
  }
});

test('zoom clips intervals and excludes epochs outside the available map above a sheet', () => {
  const labels = layoutEraLabels([{ id: 0, start: -500, end: -10 }, { id: 1, start: -10, end: 80 }, { id: 2, start: 80, end: 800 }], 10, 200);
  assert.deepEqual(labels.map((l) => [l.id, l.anchor]), [[1, 45], [2, 140]]);
  assert.deepEqual(layoutEraLabels(intervals, 10, 20), []);
});

test('short landscapes keep the largest intervals, in chronological order and within bounds', () => {
  for (const bottom of [60, 120, 180, 300, 400, 600]) {
    const labels = layoutEraLabels(intervals, 4, bottom);
    assert.ok(labels.length <= Math.floor((bottom - 4 + 4) / 28));
    for (let i = 0; i < labels.length; i++) {
      assert.ok(labels[i].y - 12 >= 4 && labels[i].y + 12 <= bottom);
      if (i) { assert.ok(labels[i].anchor > labels[i - 1].anchor); assert.ok(labels[i].y - labels[i - 1].y >= 28 - 1e-9); }
    }
  }
});
