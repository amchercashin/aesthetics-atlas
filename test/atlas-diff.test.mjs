import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diffAtlas, isDrift } from '../scripts/lib/atlas-diff.mjs';

const card = (id, over = {}) => ({
  id, name: id, palette: { colors: ['#000000'] },
  example: { title: 'Работа', why: null, img: { page: 'p', artist: 'A' } },
  gallery: [{ title: 'Ещё', author: null, img: { page: 'g', artist: 'B' } }], corpus: [],
  review: { status: 'partial', scope: ['relations'] },
  ...over,
});
const atlas = (styles, over = {}) => ({ builtAt: '2026-10-28', sources: [], styles, ...over });

test('palette and file metadata changes are drift, caption and review changes are edits', () => {
  const before = atlas([card('a'), card('b'), card('c')]);
  const after = atlas([
    card('a', { palette: { colors: ['#111111'] }, gallery: [{ title: 'Ещё', author: null, img: { page: 'g', artist: 'C' } }] }),
    card('b', { gallery: [{ title: 'Ещё', author: 'Мастер', img: { page: 'g', artist: 'B' } }] }),
    card('c', { review: { status: 'partial', scope: ['relations', 'dates'] } }),
  ], { builtAt: '2026-10-29' });
  const { top, styles } = diffAtlas(before, after);
  assert.deepEqual(top, []);
  const byId = Object.fromEntries(styles.map((c) => [c.id, c]));
  assert.deepEqual(byId.a.fields.sort(), ['gallery.file', 'palette']);
  assert.ok(isDrift(byId.a));
  assert.deepEqual(byId.b.fields, ['gallery.caption']);
  assert.ok(!isDrift(byId.b));
  assert.deepEqual(byId.c.fields, ['review']);
  assert.ok(!isDrift(byId.c));
});

test('added, removed and resized lists are reported, unchanged cards are not', () => {
  const before = atlas([card('a'), card('b')], { sources: [{ id: 's' }] });
  const after = atlas([card('a', { gallery: [] }), card('n')], { sources: [{ id: 's' }, { id: 't' }] });
  const { top, styles } = diffAtlas(before, after);
  assert.deepEqual(top, ['sources']);
  assert.deepEqual(styles.map((c) => [c.id, c.fields]), [['a', ['gallery.count']], ['b', ['removed']], ['n', ['added']]]);
  assert.deepEqual(diffAtlas(before, before).styles, []);
});
