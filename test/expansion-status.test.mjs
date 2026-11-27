import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  expansionStatus,
  parseLsRemote,
  classifyBranches,
  formatExpansionStatus,
} from '../scripts/lib/expansion-status.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = path.join(ROOT, 'scripts/expansion-status.mjs');

const sampleCatalog = () => ({
  groups: {
    'ru-eurasia': 'Россия и Евразия',
    americas: 'Америки и Карибы',
    empty: 'Пустая группа',
  },
  items: [
    { id: 'a', group: 'ru-eurasia', priority: 'P1', admissionDecision: 'merged' },
    { id: 'b', group: 'ru-eurasia', priority: 'P1', admissionDecision: 'candidate' },
    { id: 'c', group: 'ru-eurasia', priority: 'P2', admissionDecision: 'deferred' },
    { id: 'd', group: 'americas', priority: 'P1', admissionDecision: 'candidate' },
    { id: 'e', group: 'americas', priority: 'P2', admissionDecision: 'candidate' },
    { id: 'f', group: 'americas', priority: 'R', admissionDecision: 'candidate' },
    { id: 'g', group: 'americas', priority: 'P2', admissionDecision: 'rejected' },
  ],
});

test('expansionStatus aggregates group x priority x decision and sorts by open candidates', () => {
  const status = expansionStatus(sampleCatalog());
  assert.deepEqual(status.groups.map((g) => g.id), ['americas', 'ru-eurasia', 'empty']);

  const americas = status.groups[0];
  assert.deepEqual(americas.open, { P1: 1, P2: 1, R: 1, total: 3 });
  assert.equal(americas.decisions.rejected, 1);
  assert.equal(americas.total, 4);

  const ru = status.groups[1];
  assert.deepEqual(ru.open, { P1: 1, P2: 0, R: 0, total: 1 });
  assert.equal(ru.decisions.merged, 1);
  assert.equal(ru.decisions.deferred, 1);
  assert.equal(ru.total, 3);

  assert.equal(status.totals.total, 7);
  assert.deepEqual(status.totals.open, { P1: 2, P2: 1, R: 1, total: 4 });

  const p1 = status.byPriority.find((p) => p.priority === 'P1');
  assert.equal(p1.decisions.candidate, 2);
  assert.equal(p1.decisions.merged, 1);
  assert.equal(p1.total, 3);
});

test('parseLsRemote extracts mainSha and sorts expansion/* branches naturally', () => {
  const out = [
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\trefs/heads/main',
    'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\trefs/heads/expansion/a-10',
    'cccccccccccccccccccccccccccccccccccccccc\trefs/heads/expansion/a-02',
    'dddddddddddddddddddddddddddddddddddddddd\trefs/heads/expansion/a-01b',
    'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee\trefs/heads/fix/unrelated',
  ].join('\n');

  const parsed = parseLsRemote(out);
  assert.equal(parsed.mainSha, 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
  assert.deepEqual(parsed.branches.map((b) => b.branch), [
    'expansion/a-01b',
    'expansion/a-02',
    'expansion/a-10',
  ]);
});

test('classifyBranches distinguishes active, empty-at-main, unfetched, and merged branches', () => {
  const mainSha = '1111111111111111111111111111111111111111';
  const oldMainSha = '2222222222222222222222222222222222222222';
  const mergedSideSha = '3333333333333333333333333333333333333333';
  const activeSha = '4444444444444444444444444444444444444444';
  const unfetchedSha = '5555555555555555555555555555555555555555';

  const classified = classifyBranches(
    [
      { branch: 'expansion/a-01', sha: mergedSideSha },
      { branch: 'expansion/a-08', sha: activeSha },
      { branch: 'expansion/a-09', sha: oldMainSha },
      { branch: 'expansion/b-01', sha: unfetchedSha },
      { branch: 'expansion/s-01', sha: mainSha },
    ],
    {
      mainSha,
      isFetched: (sha) => sha !== unfetchedSha,
      isAncestorOfMain: (sha) => [mainSha, oldMainSha, mergedSideSha].includes(sha),
      isMainFirstParent: (sha) => [mainSha, oldMainSha].includes(sha),
    },
  );

  assert.deepEqual(
    classified.map((b) => [b.branch, b.status]),
    [
      ['expansion/a-01', 'merged'],
      ['expansion/a-08', 'in-progress'],
      ['expansion/a-09', 'in-progress-empty'],
      ['expansion/b-01', 'remote-unfetched'],
      ['expansion/s-01', 'in-progress-empty'],
    ],
  );
});

test('formatExpansionStatus renders tables, active/merged branches, and offline fallbacks', () => {
  const status = expansionStatus(sampleCatalog());
  const branches = classifyBranches(
    [
      { branch: 'expansion/a-01', sha: '3333333333333333333333333333333333333333' },
      { branch: 'expansion/s-01', sha: '1111111111111111111111111111111111111111' },
    ],
    {
      mainSha: '1111111111111111111111111111111111111111',
      isFetched: () => true,
      isAncestorOfMain: () => true,
      isMainFirstParent: (sha) => sha === '1111111111111111111111111111111111111111',
    },
  );

  const md = formatExpansionStatus(status, { remote: 'origin', branches });
  assert.match(md, /## Группа × приоритет × решение/);
  assert.match(md, /\| Америки и Карибы \(`americas`\) \| 1 \| 1 \| 1 \| 3 \| 0 \| 0 \| 1 \| 4 \|/);
  assert.match(md, /\| \*\*Итого\*\* \| \*\*2\*\* \| \*\*1\*\* \| \*\*1\*\* \| \*\*4\*\* \| \*\*1\*\* \| \*\*1\*\* \| \*\*1\*\* \| \*\*7\*\* \|/);
  assert.match(md, /## Приоритет × решение/);
  assert.match(md, /### В работе \(1\)/);
  assert.match(md, /\| `expansion\/s-01` \| `1111111` \| в работе \(без коммитов\) \|/);
  assert.match(md, /### Слиты в `main` \(1\)/);
  assert.match(md, /`expansion\/a-01`/);
  assert.doesNotMatch(md, /\| prepared \|/);

  // Non-zero prepared adds the prepared column.
  const withPrepared = sampleCatalog();
  withPrepared.items.push({ id: 'h', group: 'ru-eurasia', priority: 'P1', admissionDecision: 'prepared' });
  const mdPrep = formatExpansionStatus(expansionStatus(withPrepared), { remote: 'origin', skipped: true });
  assert.match(mdPrep, /\| prepared \|/);
  assert.match(mdPrep, /Проверка удалённых веток пропущена/);

  const mdErr = formatExpansionStatus(status, { remote: 'origin', error: 'network unreachable' });
  assert.match(mdErr, /Не удалось получить ветки с `origin`: network unreachable/);
});

test('CLI outputs Markdown tables with --no-remote and custom --catalog', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-status-'));
  const file = path.join(dir, 'catalog.json');
  try {
    fs.writeFileSync(file, JSON.stringify(sampleCatalog()), 'utf8');
    const out = execFileSync(process.execPath, [SCRIPT, '--no-remote', '--catalog', file], { encoding: 'utf8' });
    assert.match(out, /## Итог/);
    assert.match(out, /Америки и Карибы \(`americas`\)/);
    assert.match(out, /Проверка удалённых веток пропущена/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
