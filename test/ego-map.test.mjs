import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../js/store.js';
import { directLinks, linkStep, egoMap } from '../js/ui/ego-map.js';

// Бабушка → предок → стиль → два продолжения и внук; реакция — у «новой волны» на «швейцарский».
function fixture() {
  const rel = (id, type) => ({ id, type, status: 'verified' });
  const raw = [
    { id: 'grand', start: 1860, parents: [] },
    { id: 'bauhaus', start: 1919, parents: [rel('grand', 'evolved')] },
    { id: 'constructivism', start: 1915, parents: [] },
    { id: 'swiss', start: 1950, parents: [rel('bauhaus', 'influence'), rel('constructivism', 'influence')] },
    { id: 'flat', start: 2012, parents: [rel('swiss', 'influence')] },
    { id: 'wave', start: 1978, parents: [rel('punk', 'influence'), rel('swiss', 'reaction')] },
    { id: 'punk', start: 1976, parents: [] },
    { id: 'material', start: 2014, parents: [rel('flat', 'evolved')] },
    { id: 'alone', start: 1500, parents: [] },
  ];
  const styles = raw.map((s, order) => ({
    ...s, name: s.id, order, era: 'test', end: null, example: { img: null }, gallery: [],
    children: raw.flatMap((c) => c.parents.filter((p) => p.id === s.id).map((p) => ({ ...p, id: c.id }))),
  }));
  return createStore({ styles, eras: [{ id: 'test', name: 'test' }] });
}

test('the mini-map splits direct links by direction, earliest first, whatever the type', () => {
  const store = fixture();
  const swiss = directLinks(store, store.get('swiss'));
  assert.deepEqual(swiss.from.map((x) => x.style.id), ['constructivism', 'bauhaus']);
  assert.deepEqual(swiss.to.map((x) => x.style.id), ['wave', 'flat']);
  // Одна и та же реакция стоит справа у «швейцарского» и слева у «новой волны».
  assert.equal(swiss.to[0].rel.type, 'reaction');
  assert.equal(directLinks(store, store.get('wave')).from.find((x) => x.style.id === 'swiss').rel.type, 'reaction');
});

test('the mini-map shows only direct neighbours and nothing for an isolated style', () => {
  const store = fixture();
  const markup = String(egoMap(store, store.get('swiss')));
  assert.equal((markup.match(/class="em-node"/g) ?? []).length, 4);
  assert.equal((markup.match(/data-side="from"/g) ?? []).length, 2);
  assert.equal((markup.match(/data-side="to"/g) ?? []).length, 2);
  assert.doesNotMatch(markup, /#\/s\/grand"|#\/s\/material"/);
  assert.equal(egoMap(store, store.get('alone')), '');
  assert.match(String(egoMap(store, store.get('constructivism'))), /class="em-empty">Исток</);
});

test('arrow keys walk the links: left to the main ancestor, right to the nearest own continuation', () => {
  const store = fixture();
  assert.equal(linkStep(store, store.get('swiss'), 'ArrowLeft'), 'bauhaus');
  // «Плоский» считает «швейцарский» главным предком, «новая волна» — нет, хотя начинается раньше.
  assert.equal(linkStep(store, store.get('swiss'), 'ArrowRight'), 'flat');
  // Своих продолжений нет — берётся самое раннее из всех.
  assert.equal(linkStep(store, store.get('constructivism'), 'ArrowRight'), 'swiss');
  assert.equal(linkStep(store, store.get('alone'), 'ArrowLeft'), null);
  assert.equal(linkStep(store, store.get('alone'), 'ArrowRight'), null);
  assert.equal(linkStep(store, store.get('swiss'), 'ArrowUp'), null);
});
