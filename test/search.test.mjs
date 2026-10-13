import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildIndex, search, normalize, parseYear } from '../js/search.js';

const styles = [
  { id: 'impressionism', name: 'Импрессионизм', orig: 'Impressionism', aliases: [], names: ['Клод Моне'], traits: [], summary: '', tier: 1, start: 1867, end: 1886 },
  { id: 'vaporwave', name: 'Вейпорвейв', orig: 'Vaporwave', aliases: ['Ａｅｓｔｈｅｔｉｃ'], names: [], traits: [], summary: '', tier: 1, start: 2011, end: null },
  { id: 'suprematism', name: 'Супрематизм', orig: 'Suprematism', aliases: [], names: ['Казимир Малевич'], traits: [], summary: '', tier: 1, start: 1915, end: 1935 },
  { id: 'cubism', name: 'Кубизм', orig: 'Cubism', aliases: [], names: [], traits: [], summary: '', tier: 1, start: 1907, end: 1925 },
  { id: 'egypt', name: 'Древнеегипетское искусство', orig: 'Ancient Egyptian art', aliases: [], names: [], traits: [], summary: '', tier: 1, start: -3100, end: -30 },
];
const idx = buildIndex(styles);
const first = (q) => search(idx, q)[0]?.style.id;

test('normalize handles ё, case and full-width letters', () => {
  assert.equal(normalize('Ёлка'), 'елка');
  assert.equal(normalize('Ａｅｓｔｈｅｔｉｃ'), 'aesthetic');
});

test('finds by Russian prefix, English name and artist', () => {
  assert.equal(first('импр'), 'impressionism');
  assert.equal(first('vapor'), 'vaporwave');
  assert.equal(first('Малевич'), 'suprematism');
});

test('tolerates a typo', () => {
  assert.equal(first('импресионизм'), 'impressionism');
});

test('a year returns styles active in that year', () => {
  const ids = search(idx, '1920').map((r) => r.style.id);
  assert.deepEqual(ids.sort(), ['cubism', 'suprematism']);
  assert.equal(parseYear('3000 до н. э.'), -3000);
  assert.deepEqual(search(idx, '2000 до н. э.').map((r) => r.style.id), ['egypt']);
});

test('all query words must match', () => {
  assert.equal(search(idx, 'кубизм моне').length, 0);
});
