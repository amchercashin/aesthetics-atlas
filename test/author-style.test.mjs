import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validate } from '../scripts/lib/validate.mjs';
import { buildRecord, childrenOf, contextsOf } from '../scripts/lib/record.mjs';
import { createStore } from '../js/store.js';
import { buildIndex, search } from '../js/search.js';

const source = { id: 'museum', title: 'Collection', url: 'https://example.org/collection', sourceType: 'museum' };
const work = (n) => ({ title: `Work ${n}`, author: 'A', year: 2000 + n, reference: `https://example.org/work/${n}`, sources: ['museum'], whyRepresentative: 'A recurring formal decision.' });
const base = (extra = {}) => ({ id: 'context', name: 'Context', orig: 'Context', start: 1900, end: null, era: 'e', domain: ['art'], tier: 2,
  root: true, parents: [], summary: 'Summary', description: 'Description', traits: ['a', 'b', 'c'], example: work(1), ...extra });
const author = (extra = {}) => base({ id: 'author', name: 'Authored practice', orig: 'Practice', kind: 'author-style', start: 2000,
  root: false, origin: 'unknown', scopeNote: 'A selected, bounded practice.', labelStatus: 'editorial-scope-title', maturity: 'established',
  creators: [{ name: 'Имя автора', orig: 'Creator Name', aliases: ['Вариант имени'], role: 'Visual design', sources: ['museum'] }],
  admission: { language: 'Observed language', corpus: 'Across three works', distinctness: 'Differs from two neighbours', significance: 'Independent collection context', sources: ['museum'] },
  corpus: [work(1), work(2), work(3)], contexts: [{ id: 'context', type: 'member-of', status: 'verified', note: 'Membership, not descent.', sources: ['museum'] }], ...extra });
const errors = (card) => validate([base(), card], [{ id: 'e' }], [source]).errors;

test('a bounded authored practice with a sourced independent corpus passes', () => {
  assert.deepEqual(errors(author()), []);
  for (const extra of [{ creators: [] }, { creators: [{ name: 'A', role: 'Designer', sources: [] }] }, { corpus: [work(1), work(2)] }, { admission: {} }, { scopeNote: '' }, { labelStatus: undefined }]) {
    assert.ok(errors(author(extra)).length, JSON.stringify(extra));
  }
  assert.ok(errors(author({ corpus: [work(1), work(1), work(3)] })).some((e) => e.includes('repeats the same work')));
});

test('context endpoints and evidence are checked without inventing historical parents', () => {
  const c = { id: 'context', type: 'uses-technique', status: 'verified', note: 'A specific application.', sources: ['museum'] };
  assert.deepEqual(errors(author({ contexts: [c] })), []);
  assert.ok(errors(author({ contexts: [{ ...c, id: 'missing' }] })).some((e) => e.includes('unknown context')));
  assert.ok(errors(author({ contexts: [{ ...c, sources: [] }] })).some((e) => e.includes('verified context needs sources')));
  assert.ok(errors(author({ contexts: [{ ...c, id: 'author' }] })).some((e) => e.includes('repeated/self context')));
  assert.deepEqual(errors(author({ contexts: [{ ...c, status: 'unverified', sources: [] }] })), []);
});

test('external works require an HTTPS reference and attribution sources', () => {
  assert.deepEqual(errors(author({ example: work(1) })), []);
  for (const example of [{ ...work(1), reference: 'http://example.org/work' }, { ...work(1), sources: [] }, { ...work(1), file: 'Conflict.jpg' }]) {
    assert.ok(errors(author({ example })).length);
  }
  const r = buildRecord(author());
  assert.equal(r.example.img, null);
  assert.equal(r.example.external.reference, true);
  assert.equal(r.example.external.rights.status, 'reference');
  assert.equal(r.palette, null);
});

test('creator roles, aliases, admission and independent works survive the build record', () => {
  const r = buildRecord(author());
  assert.deepEqual(r.kind, ['author-style']);
  assert.equal(r.creators[0].role, 'Visual design');
  assert.deepEqual(r.creators[0].aliases, ['Вариант имени']);
  assert.equal(r.admission.distinctness, 'Differs from two neighbours');
  assert.equal(r.corpus.length, 3);
  assert.equal(r.corpus[2].external.page, 'https://example.org/work/3');
});

test('context is bidirectional and cannot manufacture historical ancestors or children', () => {
  const input = [base(), author()];
  const contexts = contextsOf(input), children = childrenOf(input);
  const styles = input.map((s, order) => ({ ...buildRecord(s, { contexts: contexts.get(s.id), children: children.get(s.id) }), order }));
  const store = createStore({ styles, eras: [{ id: 'e' }] });
  assert.equal(store.get('author').contexts[0].direction, 'out');
  assert.equal(store.get('context').contexts[0].direction, 'in');
  assert.deepEqual([...store.ancestors('author')], []);
  assert.deepEqual([...store.descendants('context')], []);
  assert.deepEqual(store.mainLine('author').map((s) => s.id), ['author']);
  assert.ok(errors(author({ contexts: [{ id: 'missing', type: 'member-of', status: 'verified', note: 'x', sources: ['museum'] }] })).some((e) => e.includes('unknown context')));
  assert.ok(errors(author({ contexts: [{ id: 'context', type: 'influence', status: 'verified', note: 'x', sources: ['museum'] }] })).some((e) => e.includes('bad context type')));
});

test('search finds hidden authored detail by creator aliases and work titles', () => {
  const r = buildRecord(author());
  const index = buildIndex([r]);
  for (const q of ['Вариант имени', 'Creator Name', 'Work 3']) assert.equal(search(index, q)[0]?.style.id, 'author', q);
});
