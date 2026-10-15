import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summaryCurve } from '../js/map-summary.js';

test('nearby sea names get a visible arc instead of an invisible clickable line', () => {
  const a = { x: 200, y: 200 }, b = { x: 300, y: 200 };
  const route = summaryCurve(a, b, [[150, 170, 240, 230], [260, 170, 350, 230]], [0, 0, 500, 500]);
  assert.ok(route);
  assert.ok(route.visible >= 36 && route.longest >= 28);
  assert.ok(route.visible / route.length >= 0.3);
});

test('summaries with no readable space have neither a route nor an invisible hit area', () => {
  assert.equal(summaryCurve({ x: 200, y: 200 }, { x: 300, y: 200 }, [[0, 0, 500, 500]], [0, 0, 500, 500]), null);
  assert.equal(summaryCurve({ x: 200, y: 200 }, { x: 210, y: 210 }, [], [0, 0, 500, 500]), null);
});

test('curve choice depends on layout, not hover or link order', () => {
  const a = { x: 200, y: 200 }, b = { x: 300, y: 200 };
  const boxes = [[150, 170, 240, 230], [260, 170, 350, 230]];
  assert.equal(summaryCurve(a, b, boxes, [0, 0, 500, 500]).d, summaryCurve(a, b, [...boxes].reverse(), [0, 0, 500, 500]).d);
});

test('summary endpoints stay on the supplied coasts and clear the protected names', () => {
  const a = { x: 200, y: 200, ports: [{ x: 190, y: 240 }, { x: 180, y: 250 }] };
  const b = { x: 300, y: 200, ports: [{ x: 310, y: 240 }, { x: 320, y: 250 }] };
  const route = summaryCurve(a, b, [[150, 170, 240, 230], [260, 170, 350, 230]], [0, 0, 500, 500]);
  assert.ok(route);
  assert.ok(a.ports.includes(route.ports[0]));
  assert.ok(b.ports.includes(route.ports[1]));
  assert.ok(route.visible / route.length > 0.9);
});
