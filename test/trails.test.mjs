// Кураторские экскурсии (content/trails.yaml): валидация, ссылки на реальные стили и присутствие в data/index.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { validateTrails } from '../scripts/lib/validate.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const styles = fs.readdirSync(path.join(ROOT, 'content/styles')).filter((f) => f.endsWith('.yaml')).sort()
  .flatMap((f) => yaml.load(fs.readFileSync(path.join(ROOT, 'content/styles', f), 'utf8')) ?? []);
const trails = yaml.load(fs.readFileSync(path.join(ROOT, 'content/trails.yaml'), 'utf8'));

test('content/trails.yaml passes validation and references real styles', () => {
  assert.ok(Array.isArray(trails) && trails.length >= 5);
  assert.deepEqual(validateTrails(trails, styles), []);
});

test('validateTrails catches unknown stops, duplicate ids and short trails', () => {
  const bad = [
    { id: 't1', title: 'A', subtitle: 'B', stops: [{ id: 'impressionism', note: 'x' }, { id: 'ghost', note: 'y' }] },
    { id: 't1', title: '', subtitle: 'B', stops: [{ id: 'impressionism', note: 'x' }, { id: 'impressionism', note: 'y' }, { id: 'bauhaus', note: '' }] },
  ];
  const errs = validateTrails(bad, styles).join('\n');
  assert.match(errs, /at least 3 stops/);
  assert.match(errs, /duplicate id/);
  assert.match(errs, /missing title/);
  assert.match(errs, /duplicate stop/);
  assert.match(errs, /missing note/);
});

test('built data/index.json exposes curated trails', () => {
  const index = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/index.json'), 'utf8'));
  assert.ok(Array.isArray(index.trails) && index.trails.length === trails.length);
  const byId = new Map(index.styles.map((s) => [s.id, s]));
  for (const t of index.trails) {
    for (const stop of t.stops) assert.ok(byId.has(stop.id), `${t.id}: ${stop.id}`);
  }
});
