// test/nebulae-geo.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { edt, contours, chaikin, rdp, components, screenAngle, screenLength, blitRect, covers, keepNonEmpty, nameFitsRegion } from '../js/nebulae.js';

const disc = (r, w = 41) => {
  const M = new Uint8Array(w * w);
  for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) if (Math.hypot(x - 20, y - 20) <= r) M[y * w + x] = 1;
  return { M, w };
};

test('edt: distance to the nearest node outside the mask', () => {
  const { M, w } = disc(10);
  const D = edt(M, w, w);
  assert.equal(D[0], 0);
  assert.ok(D[20 * w + 20] > 10 && D[20 * w + 20] <= 11, String(D[20 * w + 20]));
  assert.ok(D[20 * w + 25] < D[20 * w + 20]);
});

test('contours: one closed loop of the expected radius; repeated calls agree', () => {
  const w = 41, V = new Float32Array(w * w);
  for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) V[y * w + x] = Math.max(0, 10 - Math.hypot(x - 20, y - 20));
  const loops = contours(V, w, w, 5);
  assert.equal(loops.length, 1);
  const p = loops[0];
  assert.ok(p.length / 2 >= 16);
  for (let i = 0; i < p.length; i += 2) assert.ok(Math.abs(Math.hypot(p[i] - 20, p[i + 1] - 20) - 5) < 0.2);
  assert.equal(contours(V, w, w, 5)[0].length, p.length);
});

test('contours: an empty field and a one-node bump do not throw', () => {
  const w = 9, zero = new Float32Array(w * w), bump = new Float32Array(w * w);
  bump[4 * w + 4] = 1;
  assert.deepEqual(contours(zero, w, w, 0.5), []);
  assert.ok(Array.isArray(contours(bump, w, w, 0.5)));
});

test('rdp keeps the corners of a square ring and drops collinear points', () => {
  const ring = [];
  for (let i = 0; i < 10; i++) ring.push(i, 0);
  for (let i = 0; i < 10; i++) ring.push(10, i);
  for (let i = 0; i < 10; i++) ring.push(10 - i, 10);
  for (let i = 0; i < 10; i++) ring.push(0, 10 - i);
  assert.deepEqual(rdp(ring, 0.01), [0, 0, 10, 0, 10, 10, 0, 10]);
});

test('rdp does not collapse a smooth closed loop (regression: prototype returned one point)', () => {
  const p = [];
  for (let i = 0; i < 200; i++) { const t = (i / 200) * 2 * Math.PI; p.push(50 + 30 * Math.cos(t), 50 + 30 * Math.sin(t)); }
  const n = rdp(p, 0.3).length / 2;
  assert.ok(n > 12 && n < 120, `${n} points`);
  assert.deepEqual(rdp([0, 0, 1, 0, 1, 1], 0.1), [0, 0, 1, 0, 1, 1]);
});

test('chaikin quadruples the point count per iteration', () => {
  assert.equal(chaikin([0, 0, 4, 0, 4, 4, 0, 4], 1).length, 16);
  assert.equal(chaikin([0, 0, 4, 0, 4, 4, 0, 4], 2).length, 32);
});

test('components counts separate blobs', () => {
  const w = 10, M = new Uint8Array(w * w);
  for (const [x, y] of [[1, 1], [2, 1], [1, 2], [2, 2], [7, 7], [8, 7], [7, 8], [8, 8]]) M[y * w + x] = 1;
  const { comps } = components(M, w, w);
  assert.deepEqual(comps.map((c) => c.n), [4, 4]);
});

test('screenAngle and screenLength follow an anisotropic camera', () => {
  assert.equal(screenAngle(0, 3, 1), 0);
  assert.ok(Math.abs(screenAngle(0.5, 2, 2) - 0.5) < 1e-12);
  assert.ok(Math.abs(screenAngle(Math.PI / 4, 2, 1) - Math.atan(0.5)) < 1e-12);
  assert.equal(screenLength(10, 0, 3, 1), 30);
  assert.ok(Math.abs(screenLength(10, Math.PI / 2, 3, 2) - 20) < 1e-9);
});

const cache = { kx: 1, ky: 1, ox: 0, oy: 0, mx: 100, my: 50, w: 1000, h: 600, u0: -100, u1: 900, v0: -50, v1: 550 };
const cam = (over = {}) => ({ kx: 1, ky: 1, ox: 0, oy: 0, w: 800, h: 500, axis: 30, ...over });

test('blitRect: identity, pan and zoom', () => {
  assert.deepEqual(blitRect(cache, cam()), { x: -100, y: -50, w: 1000, h: 600 });
  assert.deepEqual(blitRect(cache, cam({ ox: 50 })), { x: -50, y: -50, w: 1000, h: 600 });
  assert.deepEqual(blitRect(cache, cam({ kx: 2, ky: 2 })), { x: -200, y: -100, w: 2000, h: 1200 });
});

test('covers: a small pan is covered, a pan beyond the margin is not', () => {
  assert.equal(covers(cache, cam()), true);
  assert.equal(covers(cache, cam({ ox: -50 })), true);
  assert.equal(covers(cache, cam({ ox: -300 })), false);
});

test('keepNonEmpty drops groups without members (no free stars must not break the layer)', () => {
  assert.deepEqual(keepNonEmpty([{ i: 0, idx: [1, 2] }, { i: -1, idx: [] }]).map((g) => g.i), [0]);
  assert.deepEqual(keepNonEmpty([{ i: -1, idx: [] }]), []);
});

test('disposing a map cancels nebula initialization waiting for fonts', async () => {
  const { initNebulae, disposeNebulae } = await import('../js/nebulae.js');
  const previous = globalThis.document;
  let release;
  const pendingFont = new Promise((r) => { release = r; });
  globalThis.document = { fonts: { load: () => pendingFont } };
  try {
    const pending = initNebulae({}, {});
    disposeNebulae();
    release();
    assert.equal(await pending, false);
  } finally {
    if (previous === undefined) delete globalThis.document;
    else globalThis.document = previous;
  }
});

test('a name cannot float between disconnected islands even when its ends overlap them', () => {
  const name = { cx: 0, cy: 0, ang: 0, curv: 0, widths: [100], lh: 14 };
  const islands = (x, y) => Math.abs(x) > 15 && Math.abs(x) < 60 && Math.abs(y) < 12;
  assert.equal(nameFitsRegion(name, islands, 2), false);
  assert.equal(nameFitsRegion({ ...name, cx: 35, widths: [30] }, islands, 5), true);
});

test('every line of a sea name must stay attached to its own region', () => {
  const name = { cx: 0, cy: 0, ang: 0, curv: 0, widths: [50, 50], lh: 14 };
  const lowerIsland = (x, y) => Math.abs(x) < 30 && y >= -1 && y < 20;
  assert.equal(nameFitsRegion(name, lowerIsland, 2), false);
  assert.equal(nameFitsRegion({ ...name, widths: [50] }, lowerIsland, 2), true);
});
