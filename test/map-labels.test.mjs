import { test } from 'node:test';
import assert from 'node:assert/strict';
import { styleLabelOpacity } from '../js/map-labels.js';

test('overview labels are readable, halfway labels subdued, whole-history labels absent at different window fits', () => {
  for (const fit of [0.013, 0.035, 0.06]) {
    assert.equal(styleLabelOpacity(fit * 0.9, fit, 0.2), 0);
    assert.equal(styleLabelOpacity(fit, fit, 0.2), 0);
    assert.ok(Math.abs(styleLabelOpacity(Math.sqrt(fit * 0.2), fit, 0.2) - 0.16) < 1e-12);
    assert.equal(styleLabelOpacity(0.2, fit, 0.2), 1);
    assert.equal(styleLabelOpacity(1, fit, 0.2), 1);
  }
});

test('zoom in and out retrace a continuous monotone fade without a midpoint jump', () => {
  const values = Array.from({ length: 1001 }, (_, i) => styleLabelOpacity(0.02 * 10 ** (i / 1000), 0.02, 0.2));
  assert.equal(values[0], 0);
  assert.equal(values.at(-1), 1);
  for (let i = 1; i < values.length; i++) {
    assert.ok(values[i] >= values[i - 1]);
    assert.ok(values[i] - values[i - 1] < 0.003);
  }
  const reverse = values.map((_, i) => styleLabelOpacity(0.02 * 10 ** ((1000 - i) / 1000), 0.02, 0.2));
  assert.deepEqual(reverse, [...values].reverse());
});
