import { test } from 'node:test';
import assert from 'node:assert/strict';
import { worksOf, imageUsage } from '../scripts/lib/works.mjs';
import { contentLinks, linkOutcome } from '../scripts/lib/content-links.mjs';

test('image accounting includes corpus-only embeds and their rights', () => {
  const main = { img: { nonfree: false } };
  const extra = { img: { nonfree: true, rights: { basis: 'Recorded basis' } } };
  const corpus = { img: { nonfree: true } };
  const external = { reference: 'https://museum.example/work' };
  const style = { example: main, gallery: [extra], corpus: [corpus, external] };
  assert.deepEqual(worksOf(style), [main, extra, corpus, external]);
  assert.deepEqual(imageUsage([style]), { embedded: 3, corpus: 1, nonfree: 2, withoutBasis: 1 });
  assert.deepEqual(imageUsage([{}]), { embedded: 0, corpus: 0, nonfree: 0, withoutBasis: 0 });
});

test('file-scoped link checks include references and every kind of cited source', () => {
  const ids = ['example', 'gallery', 'corpus', 'creator', 'admission', 'context', 'parent', 'comparison', 'evidence', 'term'];
  const sources = [...ids, 'unused'].map((id) => ({ id, url: `https://museum.example/source/${id}` }));
  const work = (id) => ({ reference: `https://museum.example/work/${id}`, sources: [id] });
  const style = { id: 'a', example: work('example'), gallery: [work('gallery')], corpus: [work('corpus')],
    creators: [{ sources: ['creator'] }], admission: { sources: ['admission'] }, contexts: [{ sources: ['context'] }],
    parents: [{ sources: 'parent' }], compare: [{ sources: ['comparison'] }], evidence: [{ source: 'evidence' }],
    termAttested: { source: 'term' }, links: [{ url: 'https://museum.example/read' }] };
  const urls = contentLinks([style], sources, { allSources: false }).map((link) => link.url);
  assert.equal(urls.length, 14);
  for (const id of ids) assert.ok(urls.includes(`https://museum.example/source/${id}`), id);
  for (const id of ['example', 'gallery', 'corpus']) assert.ok(urls.includes(work(id).reference), id);
  assert.ok(!urls.includes(sources.at(-1).url));
  assert.ok(contentLinks([style], sources).some((link) => link.url === sources.at(-1).url));
});

test('one URL is checked once and retains both work and source attribution', () => {
  const url = 'https://museum.example/work';
  const links = contentLinks([{ id: 'a', links: [{ url }], example: { reference: url } }], [{ id: 'record', url }]);
  assert.deepEqual(links, [{ id: 'a, source record', url }]);
});

test('only evidence of a missing page counts as a broken link', () => {
  assert.equal(linkOutcome(200), 'ok');
  for (const status of [404, 410, 'soft 404']) assert.equal(linkOutcome(status), 'broken');
  for (const status of [202, 401, 403, 429, 503, 'api 403', 'challenge 202', 'ERR The operation was aborted due to timeout']) {
    assert.equal(linkOutcome(status), 'unverifiable', String(status));
  }
});
