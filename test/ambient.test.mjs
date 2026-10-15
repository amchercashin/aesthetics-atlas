// test/ambient.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickAmbient } from '../js/ambient.js';

const a = { id: 'a', vis: true }, b = { id: 'b', vis: true }, c = { id: 'c', vis: false };
const edges = [
  { par: a, ch: b, primary: true, span: 1 },
  { par: a, ch: b, primary: false, span: 300 },
  { par: b, ch: c, primary: false, span: 10 },
  { par: a, ch: b, primary: false, span: 50 },
];
const opt = { visible: (n) => n.vis, span: (e) => e.span };

test('only secondary edges with both ends on screen, shortest first', () => {
  assert.deepEqual(pickAmbient(edges, opt).map((e) => e.span), [50, 300]);
});

test('the cap keeps the shortest', () => {
  assert.deepEqual(pickAmbient(edges, { ...opt, cap: 1 }).map((e) => e.span), [50]);
});

test('nothing to draw gives an empty list', () => {
  assert.deepEqual(pickAmbient([], opt), []);
});
