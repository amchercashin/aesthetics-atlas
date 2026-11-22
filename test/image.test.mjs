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

test('images expose intrinsic dimensions, responsive srcset and fallback sizes', () => {
  const out = String(imgTag(img, { sizes: '100vw', size: 960 }));
  assert.match(out, /width="800"/);
  assert.match(out, /height="600"/);
  assert.match(out, /sizes="100vw"/);
  assert.match(out, /250\.jpg 250w/);
  assert.match(out, /data-fb="500\.jpg\|250\.jpg"/);
  // Локальная пара WebP/оригинал формирует srcset по двум ширинам.
  const localWork = { local: true, kind: 'work', w: 1200, h: 900, src: { 250: 'assets/thumbs/a-480.webp', 500: 'assets/thumbs/a-480.webp', 960: 'assets/works/a.jpg', 1280: 'assets/works/a.jpg' } };
  assert.match(String(imgTag(localWork)), /srcset="assets\/thumbs\/a-480\.webp 480w, assets\/works\/a\.jpg 1200w"/);
});

test('lightbox item carries caption, what to look at, caption sources and file credit', async () => {
  const { artItem } = await import('../js/ui/art-item.js');
  const store = { source: (id) => (id === 'met' ? { url: 'https://www.metmuseum.org/art/1', publisher: 'Met', title: 'Ваза' } : null) };
  const work = { title: 'Ваза', author: 'мастер неизвестен', year: 'ок. 500 до н. э.', place: 'Met', why: 'Чернофигурная <роспись>', sources: ['met', 'nope'],
    img: { ...img, page: 'https://commons.wikimedia.org/wiki/File:V.jpg', artist: 'Photo <b>by</b> X', license: 'CC BY-SA 4.0', nonfree: false } };
  const item = artItem(work, store);
  assert.equal(item.caption, 'Ваза · мастер неизвестен · ок. 500 до н. э. · Met');
  const out = String(item.details);
  assert.match(out, /Что здесь видно\.<\/strong> Чернофигурная &lt;роспись&gt;/);
  assert.match(out, /Источник подписи: <a href="https:\/\/www\.metmuseum\.org\/art\/1"/);
  assert.match(out, /Photo &lt;b&gt;by&lt;\/b&gt; X, CC BY-SA 4.0/);
  assert.match(out, /Wikimedia Commons/);
  // Несвободное изображение помечено, небезопасная ссылка не проходит.
  const nonfree = String(artItem({ title: 'Плакат', img: { ...img, page: 'javascript:alert(1)', nonfree: true } }, store).details);
  assert.match(nonfree, /несвободное/);
  assert.doesNotMatch(nonfree, /javascript:/);
  // Без why и источников — только сведения о файле.
  assert.doesNotMatch(String(artItem({ title: 'X', img: { ...img, page: 'https://commons.wikimedia.org/wiki/File:X.jpg' } }, store).details), /Что здесь видно|Источник подписи/);
});
