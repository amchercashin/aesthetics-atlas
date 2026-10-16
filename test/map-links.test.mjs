import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { readLinkSettings, historicalLinkVisible } from '../js/map-links.js';

test('a plain map restores the main tree with unverified links visible', () => {
  assert.deepEqual(readLinkSettings(new URLSearchParams()), { mode: 'main', verifiedOnly: false });
  assert.equal(historicalLinkVisible({ mode: 'main', primary: true, status: 'unverified' }), true);
});

test('none suppresses even focused links; all adds secondary links', () => {
  assert.equal(historicalLinkVisible({ mode: 'none', primary: true, highlighted: true, status: 'verified' }), false);
  assert.equal(historicalLinkVisible({ mode: 'main', primary: false }), false);
  assert.equal(historicalLinkVisible({ mode: 'all', primary: false }), true);
  assert.equal(historicalLinkVisible({ mode: 'main', primary: false, highlighted: true }), true);
});

test('source verification is an explicit independent filter', () => {
  assert.deepEqual(readLinkSettings(new URLSearchParams('links=all&rel=verified')), { mode: 'all', verifiedOnly: true });
  assert.equal(historicalLinkVisible({ mode: 'all', primary: true, status: 'unverified', verifiedOnly: true }), false);
  assert.equal(historicalLinkVisible({ mode: 'all', primary: false, status: 'verified', verifiedOnly: true }), true);
});

test('legacy links remain usable while an explicit mode wins over legacy overlays', () => {
  assert.deepEqual(readLinkSettings(new URLSearchParams('authors=0&rel=all')), { mode: 'main', verifiedOnly: false });
  assert.equal(readLinkSettings(new URLSearchParams('cmp=1&contexts=1')).mode, 'all');
  assert.equal(readLinkSettings(new URLSearchParams('links=none&cmp=1')).mode, 'none');
  assert.equal(readLinkSettings(new URLSearchParams('links=typo')).mode, 'main');
});

test('real atlas defaults show the complete primary tree and verification filters the current data', () => {
  const atlas = JSON.parse(fs.readFileSync(new URL('../data/atlas.json', import.meta.url)));
  const links = atlas.styles.flatMap((s) => s.parents.map((r, i) => ({ primary: i === 0, status: r.status })));
  const count = (mode, verifiedOnly = false) => links.filter((e) => historicalLinkVisible({ ...e, mode, verifiedOnly })).length;
  assert.equal(count('none'), 0);
  assert.equal(count('main'), atlas.styles.filter((s) => s.parents.length).length);
  assert.equal(count('all'), links.length);
  assert.equal(count('all', true), links.filter((e) => e.status === 'verified').length);
  assert.equal(count('main', true), links.filter((e) => e.primary && e.status === 'verified').length);
  assert.ok(count('all') >= count('main'));
});
