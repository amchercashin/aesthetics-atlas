// test/lens.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGutterLens } from '../js/lens.js';

const base = { total: 1000, width: 400, gutter: 50, pad: 6 };
const L = createGutterLens({ ...base, k: 1, tx: -300 });
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≠ ${b}`);

test('the middle is the camera itself', () => near(L.fwd(500), 200));

test('the ends are squeezed into the gutters', () => {
  near(L.fwd(0), 6);
  near(L.fwd(1000), 394);
});

test('the mapping is continuous at the gutter borders', () => {
  near(L.fwd(L.xL), 50);
  near(L.fwd(L.xR), 350);
});

test('monotone and invertible', () => {
  for (let x = 0; x < 1000; x += 7) {
    assert.ok(L.fwd(x) < L.fwd(x + 7));
    near(L.inv(L.fwd(x)), x);
  }
});

test('zones', () => {
  assert.equal(L.zone(0), 'L');
  assert.equal(L.zone(500), 'C');
  assert.equal(L.zone(900), 'R');
});

test('when everything fits there are no gutters and the lens is the camera', () => {
  const F = createGutterLens({ total: 300, width: 400, gutter: 50, pad: 6, k: 1, tx: 40 });
  assert.equal(F.hasL, false);
  assert.equal(F.hasR, false);
  near(F.fwd(0), 40);
  near(F.fwd(300), 340);
  assert.equal(F.zone(0), 'C');
});

test('only the right side squeezes when the content starts on screen', () => {
  const R = createGutterLens({ total: 1000, width: 400, gutter: 50, pad: 6, k: 1, tx: 20 });
  assert.equal(R.hasL, false);
  assert.equal(R.hasR, true);
  near(R.fwd(0), 20);
  near(R.fwd(1000), 394);
});
