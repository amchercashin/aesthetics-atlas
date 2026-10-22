import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lineageStrip } from '../js/views/style.js';
import { RELATION } from '../js/format.js';

test('the route labels every incoming edge with its own type and verification status', () => {
  const types = ['evolved', 'influence', 'reaction', 'revival'];
  const line = ['root', ...types].map((id, i) => ({
    id, name: id, era: 'test', start: 1900 + i, end: null, example: { img: null },
    parents: i ? [{ id: i === 1 ? 'root' : types[i - 2], type: types[i - 1], status: i === 2 ? 'verified' : 'unverified' }] : [],
  }));
  const markup = String(lineageStrip(line, 'revival'));
  for (const type of types) assert.match(markup, new RegExp(`<span class="ls-rel">${RELATION[type].label}</span>`));
  assert.equal((markup.match(/class="ls-state st st-unverified"/g) ?? []).length, 3);
  assert.equal((markup.match(/class="ls-state st st-verified"/g) ?? []).length, 1);
  assert.equal((markup.match(/Начало маршрута/g) ?? []).length, 1);
  assert.equal((markup.match(/aria-current="page"/g) ?? []).length, 1);
});
