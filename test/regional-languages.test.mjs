import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import yaml from 'js-yaml';

const raw = yaml.load(fs.readFileSync(new URL('../content/styles/16-regional-languages.yaml', import.meta.url), 'utf8'));
const atlas = JSON.parse(fs.readFileSync(new URL('../data/atlas.json', import.meta.url)));
const byId = new Map(atlas.styles.map(s => [s.id, s]));

test('the regional batch retains its bounded corpora and source links after compilation', () => {
  for (const s of raw) {
    const built = byId.get(s.id);
    assert.ok(built, s.id);
    assert.deepEqual(built.corpus.map(w => w.workId), s.corpus.map(w => w.workId), s.id);
    for (let i = 0; i < s.corpus.length; i++) {
      const w = s.corpus[i], b = built.corpus[i];
      assert.equal(b.external?.page, w.reference, `${s.id}: ${w.workId}`);
      assert.deepEqual(b.sources, w.sources);
      assert.equal(b.why, w.whyRepresentative);
    }
    for (const c of s.compare ?? []) {
      assert.ok(built.comparisons.some(x => x.id === c.id && x.note === c.note), `${s.id}: ${c.id}`);
      assert.ok(byId.get(c.id).comparisons.some(x => x.id === s.id), 'comparison must work in both directions');
    }
  }
});

test('Tipoti belongs to the regional overview without turning it into a historical parent', () => {
  const author = byId.get('alick-tipoti'), overview = byId.get('torres-strait-printmaking');
  assert.deepEqual(author.parents, []);
  assert.ok(author.contexts.some(c => c.id === overview.id && c.direction === 'out' && c.type === 'member-of'));
  assert.ok(overview.contexts.some(c => c.id === author.id && c.direction === 'in'));
  assert.ok(!overview.children.some(c => c.id === author.id));
  const shared = author.corpus.find(w => w.workId === 'tipoti-cairns-199936');
  assert.deepEqual(overview.corpus.find(w => w.workId === shared.workId), shared, 'the shared composition keeps one identity and caption');
});

test('each new card reaches both levels of the map without a fabricated historical parent', () => {
  for (const s of raw) {
    const built = byId.get(s.id);
    const sea = atlas.nebulae.find(n => n.id === built.nebula);
    assert.ok(sea, s.id);
    const part = sea.parts.find(p => p.id === built.part);
    assert.ok(part.id && part.name, s.id);
  }
  for (const id of ['chola-bronzes', 'ife-sculpture', 'maori-whakairo', 'torres-strait-printmaking']) {
    assert.deepEqual(byId.get(id).parents, [], id);
  }
});
