import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  computeResearchMeta,
  applyResearchMeta,
  formatCatalog,
  isCanonicalCatalogText,
  updateCatalogMetaText,
  formatReadmeSummary,
} from '../scripts/lib/research-meta.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = path.join(ROOT, 'scripts/research-meta.mjs');

const sampleCatalog = () => ({
  meta: {
    repository: 'https://github.com/example/atlas',
    baselineCards: 153,
    previousCandidates: 999,
    newCandidates: 0,
    totalCandidates: 1,
    authorStyleCandidates: 0,
    priorities: { P1: 0, P2: 0, R: 0 },
    preparedCards: 5,
    mergedCards: 0,
    checked: '2026-10-14',
  },
  groups: {
    'ru-eurasia': 'Россия и Евразия',
    europe: 'Европа',
  },
  items: [
    { id: 'a', group: 'ru-eurasia', proposedKind: 'tradition', priority: 'P1', introducedIn: 'v1', admissionDecision: 'merged' },
    { id: 'b', group: 'ru-eurasia', proposedKind: 'author-style', priority: 'P1', introducedIn: 'v2', admissionDecision: 'candidate' },
    { id: 'c', group: 'europe', proposedKind: 'author-style', priority: 'P2', introducedIn: 'v2', admissionDecision: 'deferred' },
    { id: 'd', group: 'europe', proposedKind: 'tradition', priority: 'R', introducedIn: 'v1', admissionDecision: 'candidate' },
    { id: 'e', group: 'europe', proposedKind: 'school', priority: 'P2', introducedIn: 'v2', admissionDecision: 'rejected' },
  ],
});

test('computeResearchMeta recalculates all counters and open candidate priorities', () => {
  const { meta, stats } = computeResearchMeta(sampleCatalog());
  assert.deepEqual(meta, {
    previousCandidates: 2,
    newCandidates: 3,
    totalCandidates: 5,
    authorStyleCandidates: 2,
    priorities: { P1: 2, P2: 2, R: 1 },
    preparedCards: 0,
    mergedCards: 1,
  });
  assert.equal(stats.traditionCandidates, 2);
  assert.deepEqual(stats.openPriorities, { P1: 1, P2: 0, R: 1 });
  assert.deepEqual(stats.decisions, {
    candidate: 2,
    prepared: 0,
    published: 0,
    merged: 1,
    deferred: 1,
    rejected: 1,
  });
});

test('applyResearchMeta preserves unrelated meta fields and detects changes', () => {
  const catalog = sampleCatalog();
  const res = applyResearchMeta(catalog);
  assert.equal(res.changed, true);
  assert.equal(res.nextMeta.repository, 'https://github.com/example/atlas');
  assert.equal(res.nextMeta.baselineCards, 153);
  assert.equal(res.nextMeta.checked, '2026-10-14');
  assert.deepEqual(
    res.changes.map((c) => c.field),
    ['previousCandidates', 'newCandidates', 'totalCandidates', 'authorStyleCandidates', 'priorities', 'preparedCards', 'mergedCards'],
  );

  const synced = applyResearchMeta({ ...catalog, meta: res.nextMeta });
  assert.equal(synced.changed, false);
  assert.deepEqual(synced.changes, []);
});

test('updateCatalogMetaText preserves untouched item lines when canonical and reformats pretty JSON', () => {
  const catalog = sampleCatalog();
  const { nextMeta } = applyResearchMeta(catalog);

  // Canonical file with custom spacing inside one item line.
  const customItemLine = '    {"id": "a","group": "ru-eurasia","proposedKind": "tradition","priority": "P1","introducedIn": "v1","admissionDecision": "merged"},';
  const canonicalRaw = [
    '{',
    `  "meta": ${JSON.stringify(catalog.meta)},`,
    `  "groups": ${JSON.stringify(catalog.groups)},`,
    '  "items": [',
    customItemLine,
    ...catalog.items.slice(1).map((item, i) => `    ${JSON.stringify(item)}${i < catalog.items.length - 2 ? ',' : ''}`),
    '  ]',
    '}',
  ].join('\n') + '\n';

  assert.equal(isCanonicalCatalogText(canonicalRaw, catalog.items.length), true);
  const patched = updateCatalogMetaText(canonicalRaw, nextMeta);
  assert.equal(patched.reformatted, false);
  assert.equal(patched.text.split('\n')[4], customItemLine);
  assert.deepEqual(JSON.parse(patched.text).meta, nextMeta);

  // Pretty-printed file (like JSON.stringify(catalog, null, 2)) gets restored to 1-line-per-record.
  const prettyRaw = `${JSON.stringify(catalog, null, 2)}\n`;
  assert.equal(isCanonicalCatalogText(prettyRaw, catalog.items.length), false);
  const restored = updateCatalogMetaText(prettyRaw, nextMeta);
  assert.equal(restored.reformatted, true);
  assert.equal(isCanonicalCatalogText(restored.text, catalog.items.length), true);
  assert.equal(restored.text, formatCatalog({ ...catalog, meta: nextMeta }));
  assert.deepEqual(JSON.parse(restored.text).items, catalog.items);
});

test('formatReadmeSummary includes README counters and non-zero extra decisions', () => {
  const { changes, stats } = applyResearchMeta(sampleCatalog());
  const out = formatReadmeSummary(stats, { changes, wrote: true, reformatted: true });
  assert.match(out, /счётчики meta обновлены/);
  assert.match(out, /формат файла восстановлен к каноническому/);
  assert.match(out, /Зафиксированы \*\*5 кандидатов\*\*, включая 2 авторских языка и 2 коллективные традиции\. Сохранены 2 предложения v1, добавлены 3\./);
  assert.match(out, /\*\*1\*\* запись `merged` \(карточки в main\), \*\*2\*\* — `candidate`, `prepared` — 0, `deferred` — 1, `rejected` — 1\./);
  assert.match(out, /сначала P1 \(2 темы\), затем P2 \(2\); R \(1\)/);
});

test('CLI supports --check exit codes and updates catalog.json in place', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-meta-'));
  const file = path.join(dir, 'catalog.json');
  try {
    fs.writeFileSync(file, `${JSON.stringify(sampleCatalog(), null, 2)}\n`, 'utf8');

    // --check fails with exit code 1 and does not modify the file.
    let failed = false;
    try {
      execFileSync(process.execPath, [SCRIPT, '--check', '--catalog', file], { encoding: 'utf8', stdio: 'pipe' });
    } catch (err) {
      failed = err.status === 1;
      assert.match(err.stdout, /требуют обновления/);
    }
    assert.equal(failed, true);
    assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).meta.totalCandidates, 1);

    // Normal run updates meta and restores canonical 1-line-per-record format.
    const runOut = execFileSync(process.execPath, [SCRIPT, '--catalog', file], { encoding: 'utf8' });
    assert.match(runOut, /счётчики meta обновлены/);
    const updatedRaw = fs.readFileSync(file, 'utf8');
    const updated = JSON.parse(updatedRaw);
    assert.equal(updated.meta.totalCandidates, 5);
    assert.equal(updated.meta.mergedCards, 1);
    assert.equal(isCanonicalCatalogText(updatedRaw, updated.items.length), true);

    // Subsequent --check succeeds with exit code 0.
    const checkOut = execFileSync(process.execPath, [SCRIPT, '--check', '--catalog', file], { encoding: 'utf8' });
    assert.match(checkOut, /счётчики meta актуальны/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
