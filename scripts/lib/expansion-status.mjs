// Сводка очереди расширения («группа × приоритет × решение») и разбор удалённых веток expansion/*.
// Чистые функции без сети и файловой системы.

import { PRIORITY_KEYS } from './research-meta.mjs';

const BASE_DECISIONS = ['merged', 'deferred', 'rejected'];
const EXTRA_DECISIONS = ['prepared', 'published'];
const ALL_DECISIONS = ['candidate', 'merged', 'deferred', 'rejected', 'prepared', 'published'];

const emptyPriorities = () => ({ P1: 0, P2: 0, R: 0 });
const emptyDecisions = () => ({ candidate: 0, prepared: 0, published: 0, merged: 0, deferred: 0, rejected: 0 });

// Агрегирует записи catalog.json по группам, приоритетам и решениям.
export function expansionStatus(catalog) {
  const groupNames = catalog?.groups ?? {};
  const items = catalog?.items ?? [];
  const groupOrder = new Map(Object.keys(groupNames).map((id, idx) => [id, idx]));
  const map = new Map();

  const ensureGroup = (id) => {
    if (!map.has(id)) {
      map.set(id, {
        id,
        name: groupNames[id] ?? id,
        open: { ...emptyPriorities(), total: 0 },
        decisions: emptyDecisions(),
        priorities: emptyPriorities(),
        total: 0,
      });
    }
    return map.get(id);
  };

  for (const id of Object.keys(groupNames)) ensureGroup(id);

  const totals = {
    open: { ...emptyPriorities(), total: 0 },
    decisions: emptyDecisions(),
    priorities: emptyPriorities(),
    total: 0,
  };

  const byPriority = Object.fromEntries(
    PRIORITY_KEYS.map((p) => [p, { priority: p, decisions: emptyDecisions(), total: 0 }]),
  );

  for (const item of items) {
    const group = ensureGroup(item.group ?? 'unknown');
    const dec = item.admissionDecision ?? 'candidate';
    const prio = item.priority ?? 'P2';

    group.total += 1;
    group.decisions[dec] = (group.decisions[dec] ?? 0) + 1;
    group.priorities[prio] = (group.priorities[prio] ?? 0) + 1;

    totals.total += 1;
    totals.decisions[dec] = (totals.decisions[dec] ?? 0) + 1;
    totals.priorities[prio] = (totals.priorities[prio] ?? 0) + 1;

    if (dec === 'candidate') {
      group.open[prio] = (group.open[prio] ?? 0) + 1;
      group.open.total += 1;
      totals.open[prio] = (totals.open[prio] ?? 0) + 1;
      totals.open.total += 1;
    }

    if (!byPriority[prio]) byPriority[prio] = { priority: prio, decisions: emptyDecisions(), total: 0 };
    byPriority[prio].decisions[dec] = (byPriority[prio].decisions[dec] ?? 0) + 1;
    byPriority[prio].total += 1;
  }

  const groups = [...map.values()].sort((a, b) => (
    (b.open.total - a.open.total)
    || (b.total - a.total)
    || ((groupOrder.get(a.id) ?? 999) - (groupOrder.get(b.id) ?? 999))
    || a.id.localeCompare(b.id)
  ));

  return { groups, totals, byPriority: Object.values(byPriority) };
}

// Разбирает вывод `git ls-remote --heads origin 'refs/heads/expansion/*' 'refs/heads/main'`.
export function parseLsRemote(output) {
  let mainSha = null;
  const branches = [];
  for (const rawLine of String(output ?? '').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const match = line.match(/^([0-9a-f]{40})\s+refs\/heads\/(.+)$/i);
    if (!match) continue;
    const [, sha, branch] = match;
    if (branch === 'main') {
      mainSha = sha;
    } else if (branch.startsWith('expansion/')) {
      branches.push({ branch, sha });
    }
  }
  branches.sort((a, b) => a.branch.localeCompare(b.branch, 'en', { numeric: true }));
  return { mainSha, branches };
}

// Классифицирует ветки expansion/* относительно main: активные (в работе) vs уже слитые.
export function classifyBranches(branches, {
  mainSha = null,
  isFetched = null,
  isAncestorOfMain = null,
  isMainFirstParent = null,
} = {}) {
  return branches.map(({ branch, sha }) => {
    const shortSha = sha.slice(0, 7);
    if (mainSha && sha === mainSha) {
      return { branch, sha, shortSha, status: 'in-progress-empty', label: 'в работе (без коммитов)' };
    }
    if (isFetched && !isFetched(sha)) {
      return { branch, sha, shortSha, status: 'remote-unfetched', label: 'на сервере (не загружена локально)' };
    }
    if (isAncestorOfMain) {
      if (isAncestorOfMain(sha)) {
        if (isMainFirstParent && isMainFirstParent(sha)) {
          return { branch, sha, shortSha, status: 'in-progress-empty', label: 'в работе (от прежнего main, без коммитов)' };
        }
        return { branch, sha, shortSha, status: 'merged', label: 'слита в main' };
      }
      return { branch, sha, shortSha, status: 'in-progress', label: 'в работе' };
    }
    return { branch, sha, shortSha, status: 'remote', label: 'на сервере' };
  });
}

const row = (cells) => `| ${cells.join(' | ')} |`;

// Форматирует полный Markdown-отчёт: итог, таблицы и список удалённых веток expansion/*.
export function formatExpansionStatus(status, remoteInfo = { remote: 'origin', branches: [] }) {
  const { groups, totals, byPriority } = status;
  const d = totals.decisions;
  const op = totals.open;
  const decisionCols = [
    ...BASE_DECISIONS,
    ...EXTRA_DECISIONS.filter((k) => (d[k] ?? 0) > 0),
  ];

  const extraSummary = [];
  if (d.prepared) extraSummary.push(`\`prepared\`: ${d.prepared}`);
  if (d.published) extraSummary.push(`\`published\`: ${d.published}`);
  if (d.deferred) extraSummary.push(`\`deferred\`: ${d.deferred}`);
  if (d.rejected) extraSummary.push(`\`rejected\`: ${d.rejected}`);
  const extraTail = extraSummary.length ? `, ${extraSummary.join(', ')}` : '';

  const lines = [
    '## Итог',
    '',
    `- Всего записей в очереди: **${totals.total}** (\`merged\`: **${d.merged}**, открытых кандидатов: **${op.total}** — P1: ${op.P1}, P2: ${op.P2}, R: ${op.R}${extraTail}).`,
    '',
    '## Группа × приоритет × решение',
    '',
    'Столбцы `P1`, `P2`, `R` показывают открытых кандидатов (`admissionDecision: candidate`), `Кандидаты` — их сумму.',
    '',
    row(['Группа очереди', 'P1', 'P2', 'R', 'Кандидаты', ...decisionCols, 'Всего']),
    row(['---', '---:', '---:', '---:', '---:', ...decisionCols.map(() => '---:'), '---:']),
  ];

  for (const g of groups) {
    lines.push(row([
      `${g.name} (\`${g.id}\`)`,
      String(g.open.P1),
      String(g.open.P2),
      String(g.open.R),
      String(g.open.total),
      ...decisionCols.map((k) => String(g.decisions[k] ?? 0)),
      String(g.total),
    ]));
  }

  lines.push(row([
    '**Итого**',
    `**${op.P1}**`,
    `**${op.P2}**`,
    `**${op.R}**`,
    `**${op.total}**`,
    ...decisionCols.map((k) => `**${d[k] ?? 0}**`),
    `**${totals.total}**`,
  ]));

  const prioDecisionCols = ['candidate', ...decisionCols];
  lines.push(
    '',
    '## Приоритет × решение',
    '',
    row(['Приоритет', ...prioDecisionCols, 'Всего']),
    row(['---', ...prioDecisionCols.map(() => '---:'), '---:']),
  );

  for (const p of byPriority) {
    lines.push(row([
      p.priority,
      ...prioDecisionCols.map((k) => String(p.decisions[k] ?? 0)),
      String(p.total),
    ]));
  }
  lines.push(row([
    '**Итого**',
    ...prioDecisionCols.map((k) => `**${d[k] ?? 0}**`),
    `**${totals.total}**`,
  ]));

  const remote = remoteInfo.remote ?? 'origin';
  lines.push('', '## Ветки `expansion/*` на сервере', '');
  if (remoteInfo.skipped) {
    lines.push('- Проверка удалённых веток пропущена (`--no-remote`).');
  } else if (remoteInfo.error) {
    lines.push(`- Не удалось получить ветки с \`${remote}\`: ${remoteInfo.error}`);
  } else {
    const list = remoteInfo.branches ?? [];
    if (list.length === 0) {
      lines.push(`- Веток \`expansion/*\` на \`${remote}\` нет.`);
    } else {
      const active = list.filter((b) => b.status !== 'merged');
      const merged = list.filter((b) => b.status === 'merged');
      lines.push(`Всего на \`${remote}\`: **${list.length}** (активные: **${active.length}**, слиты в \`main\`: **${merged.length}**).`);
      if (active.length > 0) {
        lines.push('', `### В работе (${active.length})`, '', row(['Ветка', 'Коммит', 'Состояние']), row(['---', '---', '---']));
        for (const b of active) {
          lines.push(row([`\`${b.branch}\``, `\`${b.shortSha}\``, b.label]));
        }
      } else {
        lines.push('', '- Активных веток `expansion/*` нет.');
      }
      if (merged.length > 0) {
        lines.push('', `### Слиты в \`main\` (${merged.length})`, '', merged.map((b) => `\`${b.branch}\``).join(', '));
      }
    }
  }

  return lines.join('\n');
}

export { ALL_DECISIONS };
