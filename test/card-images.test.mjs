// test/card-images.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cardImages, imgKey } from '../js/ui/art-item.js';

const img = (file, page = 'https://museum.example/collection') => ({ page, src: { 250: `assets/works/${file}` } });

test('card images list the main work, then gallery, then corpus, each file once', () => {
  const main = { title: 'Главная', img: img('a.jpg') };
  const s = {
    example: main,
    gallery: [{ title: 'Галерея', img: img('b.jpg') }],
    corpus: [{ title: 'Главная', img: img('a.jpg') }, { title: 'Корпус', img: img('c.jpg') }, { title: 'Без изображения', external: { page: 'https://museum.example/work' } }],
  };
  assert.deepEqual(cardImages(s).map((w) => w.title), ['Главная', 'Галерея', 'Корпус']);
});

test('works copied from one shared museum page stay separate images', () => {
  const s = { example: { title: 'Булатов', img: img('bulatov.jpg') }, gallery: [], corpus: [{ title: 'Соков', img: img('sokov.jpg') }] };
  assert.equal(cardImages(s).length, 2);
  assert.notEqual(imgKey(s.example.img), imgKey(s.corpus[0].img));
});

test('a card without the main image still shows its other images', () => {
  const s = { example: { title: 'По ссылке', external: { page: 'https://museum.example/work' } }, gallery: [], corpus: [{ title: 'Корпус', img: img('c.jpg') }] };
  assert.deepEqual(cardImages(s).map((w) => w.title), ['Корпус']);
});
