// Регрессии шаблона <img>: условные атрибуты не должны экранироваться.
import assert from 'node:assert/strict';
import test from 'node:test';
import { imgTag } from '../js/ui/image.js';

const img = {
  w: 800,
  h: 600,
  src: { 250: '250.jpg', 500: '500.jpg', 960: '960.jpg', 1280: '1280.jpg' },
};

test('lazy images keep a real loading attribute', () => {
  const out = String(imgTag(img, {}));
  assert.match(out, / loading="lazy"/);
  assert.doesNotMatch(out, /&quot;lazy&quot;/);
});

test('eager images do not get a loading attribute', () => {
  const out = String(imgTag(img, { eager: true, alt: 'работа' }));
  assert.doesNotMatch(out, / loading=/);
  assert.match(out, / alt="работа"/);
});

test('images expose intrinsic dimensions and a webp-friendly srcset', () => {
  const out = String(imgTag(img, { sizes: '100vw' }));
  assert.match(out, /width="800"/);
  assert.match(out, /height="600"/);
  assert.match(out, /sizes="100vw"/);
  assert.match(out, /250\.jpg 250w/);
});
