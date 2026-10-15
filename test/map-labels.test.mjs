import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fitLabelText } from '../js/map-labels.js';

test('focused labels retain their full name when it fits and use a measured ellipsis when it does not', () => {
  const measure = (text) => [...text].reduce((w, c) => w + (c === '…' ? 1 : c === 'И' ? 3 : 2), 0);
  assert.deepEqual(fitLabelText('Индия', 11, measure), { text: 'Индия', width: 11 });
  const short = fitLabelText('Индия', 6, measure);
  assert.deepEqual(short, { text: 'Ин…', width: 6 });
  assert.ok(measure('Инд…') > 6);
});

test('shortening never splits a non-BMP character or leaves a space before the ellipsis', () => {
  const measure = (text) => [...text].length;
  assert.equal(fitLabelText('🎨 мир', 3, measure).text, '🎨…');
  assert.equal(fitLabelText('🎨 мир', 5, measure).text, '🎨 мир');
});

test('a viewport narrower than the ellipsis produces no text or overflow', () => {
  assert.deepEqual(fitLabelText('Хокусай', 0.5, (text) => [...text].length), { text: '', width: 0 });
});
