// Мобильный viewport: запрет системного зума, защита полей ввода от автозума iOS Safari,
// контейнерный зум в лайтбоксе и блокировка жестов масштабирования вне полотна.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { shouldBlockTouchMove, isTouchDevice, initMobileViewport } from '../js/ui/mobile-viewport.js';
import { clampPan, zoomAroundPoint } from '../js/ui/lightbox.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

test('index.html and static style pages lock viewport zoom and support safe areas', () => {
  const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const vpMatch = /<meta name="viewport" content="([^"]+)">/.exec(indexHtml);
  assert.ok(vpMatch, 'viewport meta exists in index.html');
  const vp = vpMatch[1];
  assert.match(vp, /\bwidth=device-width\b/);
  assert.match(vp, /\binitial-scale=1\b/);
  assert.match(vp, /\bmaximum-scale=1\b/);
  assert.match(vp, /\buser-scalable=no\b/);
  assert.match(vp, /\bviewport-fit=cover\b/);

  const samplePage = fs.readFileSync(path.join(ROOT, 's/impressionism/index.html'), 'utf8');
  assert.match(samplePage, /maximum-scale=1, user-scalable=no, viewport-fit=cover/);
});

test('CSS prevents page-level zoom, horizontal overflow, and sub-16px mobile inputs', () => {
  const baseCss = fs.readFileSync(path.join(ROOT, 'css/base.css'), 'utf8');
  const mapCss = fs.readFileSync(path.join(ROOT, 'css/map.css'), 'utf8');
  const viewsCss = fs.readFileSync(path.join(ROOT, 'css/views.css'), 'utf8');

  assert.match(baseCss, /touch-action:\s*pan-x pan-y/);
  assert.match(baseCss, /overflow-x:\s*clip/);
  assert.match(baseCss, /font-size:\s*max\(16px,\s*1rem\)/);
  assert.doesNotMatch(mapCss, /\.map-find input\s*\{[^}]*font-size:\s*1[0-5]px/);
  assert.match(mapCss, /\.map-find input\s*\{[^}]*font-size:\s*1rem/);
  assert.match(viewsCss, /\.ai-subj-input\s*\{[^}]*font-size:\s*1rem/);
  assert.match(viewsCss, /\.cmp-select\s*\{[^}]*font-size:\s*1rem/);
  assert.match(viewsCss, /\.cat-filters\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
});

test('shouldBlockTouchMove blocks multi-touch and pinch-scale events only', () => {
  assert.equal(shouldBlockTouchMove({ touches: [{}] }), false);
  assert.equal(shouldBlockTouchMove({ touches: [{}, {}] }), true);
  assert.equal(shouldBlockTouchMove({ touches: [{}], scale: 1 }), false);
  assert.equal(shouldBlockTouchMove({ touches: [{}], scale: 1.15 }), true);
});

test('initMobileViewport blocks Safari gestures on touch devices and syncs visualViewport CSS vars', () => {
  const listeners = new Map();
  const makeTarget = (extra = {}) => ({
    ...extra,
    addEventListener(ev, fn) {
      if (!listeners.has(ev)) listeners.set(ev, []);
      listeners.get(ev).push({ target: this, fn });
    },
    removeEventListener(ev, fn) {
      const arr = listeners.get(ev);
      if (!arr) return;
      listeners.set(ev, arr.filter((x) => !(x.target === this && x.fn === fn)));
    },
  });

  const cssVars = new Map();
  const vv = makeTarget({ height: 520, offsetTop: 12 });
  let scrolledTo = null;
  const win = makeTarget({
    innerHeight: 844,
    scrollX: 0,
    scrollY: 24,
    visualViewport: vv,
    scrollTo(x, y) { scrolledTo = [x, y]; },
  });
  const doc = makeTarget({
    documentElement: { style: { setProperty: (k, v) => cssVars.set(k, v) } },
    body: { dataset: { view: 'map' } },
    activeElement: null,
  });
  const nav = { maxTouchPoints: 5 };

  assert.equal(isTouchDevice(win, nav), true);
  const cleanup = initMobileViewport({ win, doc, nav });

  assert.equal(cssVars.get('--vvh'), '520px');
  assert.equal(cssVars.get('--vv-top'), '12px');

  let prevented = false;
  const gEv = { cancelable: true, preventDefault() { prevented = true; } };
  listeners.get('gesturestart').forEach(({ fn }) => fn(gEv));
  assert.equal(prevented, true, 'gesturestart is prevented on touch devices');

  let tmPrevented = false;
  listeners.get('touchmove').forEach(({ fn }) => fn({ touches: [{}, {}], cancelable: true, preventDefault() { tmPrevented = true; } }));
  assert.equal(tmPrevented, true, 'multi-touch touchmove is prevented');

  let singlePrevented = false;
  listeners.get('touchmove').forEach(({ fn }) => fn({ touches: [{}], cancelable: true, preventDefault() { singlePrevented = true; } }));
  assert.equal(singlePrevented, false, 'single-finger scroll is allowed');

  vv.height = 410;
  vv.offsetTop = 0;
  listeners.get('resize').filter((x) => x.target === vv).forEach(({ fn }) => fn());
  assert.equal(cssVars.get('--vvh'), '410px');
  assert.equal(cssVars.get('--vv-top'), '0px');

  cleanup();
  assert.equal(scrolledTo, null);
});

test('lightbox container zoom clamps pan and zooms around focal point', () => {
  assert.deepEqual(clampPan(50, -30, 1, 400, 600, 380, 300), { tx: 0, ty: 0 });
  const c = clampPan(500, -500, 2, 400, 600, 380, 400);
  // maxX = (380*2 - 400)/2 = 180, maxY = (400*2 - 600)/2 = 100
  assert.deepEqual(c, { tx: 180, ty: -100 });

  const z = zoomAroundPoint({ scale: 1, tx: 0, ty: 0 }, 2.5, 200, 300, 200, 300, { stageW: 400, stageH: 600, imgW: 380, imgH: 400 });
  assert.equal(z.scale, 2.5);
  assert.equal(z.tx, 0);
  assert.equal(z.ty, 0);

  const zOut = zoomAroundPoint(z, 0.8, 200, 300, 200, 300, { stageW: 400, stageH: 600, imgW: 380, imgH: 400 });
  assert.deepEqual(zOut, { scale: 1, tx: 0, ty: 0 });
});
