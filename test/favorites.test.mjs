// «Моя полка вкуса»: сохранение, переключение, разрешение formerIds и шаринг подборки ссылкой.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readSaved, toggleSaved, isSaved, mergeSaved, clearSaved, parseSharedIds, shareCollectionUrl } from '../js/favorites.js';

function memoryStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
}

const fakeStore = {
  resolve: (id) => ({ impressionism: 'impressionism', bauhaus: 'bauhaus', old_id: 'bauhaus' }[id] ?? null),
};

test('toggleSaved adds and removes styles without duplicates and resolves formerIds', () => {
  const st = memoryStorage();
  assert.deepEqual(readSaved(fakeStore, st), []);

  const r1 = toggleSaved('impressionism', fakeStore, st);
  assert.equal(r1.saved, true);
  assert.deepEqual(readSaved(fakeStore, st), ['impressionism']);
  assert.equal(isSaved('impressionism', fakeStore, st), true);

  const r2 = toggleSaved('old_id', fakeStore, st);
  assert.equal(r2.saved, true);
  assert.deepEqual(readSaved(fakeStore, st), ['bauhaus', 'impressionism']);

  const r3 = toggleSaved('bauhaus', fakeStore, st);
  assert.equal(r3.saved, false);
  assert.deepEqual(readSaved(fakeStore, st), ['impressionism']);

  clearSaved(st);
  assert.deepEqual(readSaved(fakeStore, st), []);
});

test('parseSharedIds filters unknown ids and round-trips through shareCollectionUrl', () => {
  const url = shareCollectionUrl(['impressionism', 'bauhaus', 'impressionism'], 'https://example.com/');
  assert.equal(url, 'https://example.com/#/collection?ids=impressionism,bauhaus');
  const params = new URLSearchParams('ids=old_id,ghost,impressionism,bauhaus');
  assert.deepEqual(parseSharedIds(params, fakeStore), ['bauhaus', 'impressionism']);

  const st = memoryStorage();
  mergeSaved(['old_id', 'impressionism'], fakeStore, st);
  assert.deepEqual(readSaved(fakeStore, st), ['bauhaus', 'impressionism']);
});
