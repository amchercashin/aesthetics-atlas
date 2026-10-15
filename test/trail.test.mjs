// test/trail.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pushStep, toParam, parseTrail, TRAIL_MAX } from '../js/trail.js';

test('pushStep appends a new style and ignores a repeat of the last one', () => {
  assert.deepEqual(pushStep([], 'a'), ['a']);
  assert.deepEqual(pushStep(['a'], 'b'), ['a', 'b']);
  assert.deepEqual(pushStep(['a', 'b'], 'b'), ['a', 'b']);
});

test('revisiting a style rewinds the route to it (no loops)', () => {
  assert.deepEqual(pushStep(['a', 'b', 'c'], 'a'), ['a']);
  assert.deepEqual(pushStep(['a', 'b', 'c'], 'b'), ['a', 'b']);
});

test('the route keeps only the last TRAIL_MAX steps', () => {
  let t = [];
  for (let i = 0; i < TRAIL_MAX + 5; i++) t = pushStep(t, 's' + i);
  assert.equal(t.length, TRAIL_MAX);
  assert.equal(t[0], 's5');
  assert.equal(t[t.length - 1], 's' + (TRAIL_MAX + 4));
});

test('parseTrail round-trips and drops unknown ids', () => {
  const has = (id) => ['a', 'b', 'c'].includes(id);
  assert.deepEqual(parseTrail(toParam(['a', 'b', 'c']), has), ['a', 'b', 'c']);
  assert.deepEqual(parseTrail('a,zzz,b', has), ['a', 'b']);
  assert.deepEqual(parseTrail('', has), []);
  assert.deepEqual(parseTrail(null, has), []);
});

test('parseTrail removes loops from a hand-edited address', () => {
  assert.deepEqual(parseTrail('a,b,a,c', () => true), ['a', 'c']);
});
