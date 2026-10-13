import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTimeScale, segmentWidths, segmentTicks } from '../js/timescale.js';

const breaks = [-40000, -3000, 1500, 2026];
const sc = createTimeScale(breaks, [400, 600, 1000]);

test('scale is monotonic and hits segment boundaries', () => {
  assert.equal(sc.x(-40000), 0);
  assert.equal(sc.x(-3000), 400);
  assert.equal(sc.x(1500), 1000);
  assert.equal(sc.x(2026), 2000);
  let prev = -1;
  for (let y = -40000; y <= 2026; y += 97) { const v = sc.x(y); assert.ok(v >= prev); prev = v; }
});

test('invert is the inverse of x', () => {
  for (const y of [-39000, -3000, 0, 1500, 1999]) assert.ok(Math.abs(sc.invert(sc.x(y)) - y) < 1e-6);
});

test('values outside the range are clamped', () => {
  assert.equal(sc.x(-90000), 0);
  assert.equal(sc.x(3000), 2000);
});

test('segment widths grow with the number of styles', () => {
  const w = segmentWidths(breaks, [-35000, 100, 200, 300, 2020], { base: 100, perItem: 50, min: 0 });
  assert.deepEqual(w, [150, 250, 150]);
});

test('ticks keep their minimum spacing', () => {
  const seg = sc.segments[2];
  const ticks = segmentTicks(seg, 1, 80);
  const pxPerYear = (seg.x1 - seg.x0) / (seg.end - seg.start);
  for (let i = 1; i < ticks.length; i++) assert.ok((ticks[i] - ticks[i - 1]) * pxPerYear >= 80);
});

test('very early dates (tens of thousands of years) stay finite and ordered', () => {
  const early = createTimeScale([-66000, -3000, 1500, 2027], [400, 600, 1000]);
  const ys = [-66000, -65800, -40000, -10000, -3000];
  const xs = ys.map(early.x);
  assert.ok(xs.every(Number.isFinite));
  for (let i = 1; i < xs.length; i++) assert.ok(xs[i] > xs[i - 1]);
  const ticks = segmentTicks(early.segments[0], 1, 60);
  assert.ok(ticks.every((t) => t > -66000 && t < -3000));
});
