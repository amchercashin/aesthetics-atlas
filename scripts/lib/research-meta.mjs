// Пересчёт счётчиков meta в research/expansion/catalog.json по записям и сводка чисел для README.
// Чистые функции без сети и файловой системы.

export const PRIORITY_KEYS = ['P1', 'P2', 'R'];
export const DECISION_KEYS = ['candidate', 'prepared', 'published', 'merged', 'deferred', 'rejected'];
export const META_FIELDS = [
  'previousCandidates',
  'newCandidates',
  'totalCandidates',
  'authorStyleCandidates',
  'priorities',
  'preparedCards',
  'mergedCards',
];

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Склонение существительных в русском языке: plural(n, ['запись', 'записи', 'записей']).
export function plural(n, [one, few, many]) {
  const abs = Math.abs(n) % 100;
  const mod10 = abs % 10;
  if (abs > 10 && abs < 20) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

// Считает все производные счётчики meta и сводку по записям catalog.json.
export function computeResearchMeta(catalog) {
  const items = catalog?.items ?? [];
  const totalCandidates = items.length;
  const previousCandidates = items.filter((item) => item.introducedIn === 'v1').length;
  const newCandidates = totalCandidates - previousCandidates;
  const authorStyleCandidates = items.filter((item) => item.proposedKind === 'author-style').length;
  const traditionCandidates = items.filter((item) => item.proposedKind === 'tradition').length;

  const priorities = { P1: 0, P2: 0, R: 0 };
  const openPriorities = { P1: 0, P2: 0, R: 0 };
  const decisions = { candidate: 0, prepared: 0, published: 0, merged: 0, deferred: 0, rejected: 0 };

  for (const item of items) {
    if (item.priority) priorities[item.priority] = (priorities[item.priority] ?? 0) + 1;
    const dec = item.admissionDecision ?? 'candidate';
    decisions[dec] = (decisions[dec] ?? 0) + 1;
    if (dec === 'candidate' && item.priority) {
      openPriorities[item.priority] = (openPriorities[item.priority] ?? 0) + 1;
    }
  }

  const meta = {
    previousCandidates,
    newCandidates,
    totalCandidates,
    authorStyleCandidates,
    priorities,
    preparedCards: decisions.prepared,
    mergedCards: decisions.merged,
  };

  return {
    meta,
    stats: {
      totalCandidates,
      previousCandidates,
      newCandidates,
      authorStyleCandidates,
      traditionCandidates,
      priorities,
      openPriorities,
      decisions,
    },
  };
}

// Применяет пересчитанные счётчики к catalog.meta, сохраняя остальные поля и их порядок.
export function applyResearchMeta(catalog) {
  const { meta: computed, stats } = computeResearchMeta(catalog);
  const prevMeta = catalog?.meta ?? {};
  const nextMeta = { ...prevMeta, ...computed };
  const changes = [];
  for (const field of META_FIELDS) {
    if (!same(prevMeta[field], computed[field])) {
      changes.push({ field, before: prevMeta[field], after: computed[field] });
    }
  }
  return { nextMeta, changed: changes.length > 0, changes, stats };
}

// Канонический формат catalog.json: meta, groups и каждая запись items занимают по одной строке.
export function formatCatalog(catalog) {
  const items = catalog.items ?? [];
  const lines = [
    '{',
    `  "meta": ${JSON.stringify(catalog.meta)},`,
    `  "groups": ${JSON.stringify(catalog.groups)},`,
    '  "items": [',
    ...items.map((item, i) => `    ${JSON.stringify(item)}${i < items.length - 1 ? ',' : ''}`),
    '  ]',
    '}',
  ];
  return `${lines.join('\n')}\n`;
}

// Проверяет, записан ли файл уже в каноническом построчном формате.
export function isCanonicalCatalogText(rawText, itemCount) {
  const normalized = rawText.replace(/\r\n/g, '\n');
  const trimmed = normalized.endsWith('\n') ? normalized.slice(0, -1) : normalized;
  const lines = trimmed.split('\n');
  if (lines.length !== itemCount + 6) return false;
  return (
    lines[0] === '{'
    && /^  "meta": \{.*\},$/.test(lines[1])
    && /^  "groups": \{.*\},$/.test(lines[2])
    && lines[3] === '  "items": ['
    && lines[itemCount + 4] === '  ]'
    && lines[itemCount + 5] === '}'
  );
}

// Обновляет строку meta в тексте catalog.json. Если файл уже в построчном формате и reformat не задан,
// остальные строки сохраняются байт-в-байт; иначе файл приводится к каноническому построчному виду.
export function updateCatalogMetaText(rawText, nextMeta, { reformat = false } = {}) {
  const catalog = JSON.parse(rawText);
  const canonical = isCanonicalCatalogText(rawText, catalog.items.length);
  if (!reformat && canonical) {
    const eol = rawText.includes('\r\n') ? '\r\n' : '\n';
    const hasTrailingNewline = rawText.endsWith('\n');
    const lines = rawText.replace(/\r\n/g, '\n').replace(/\n$/, '').split('\n');
    lines[1] = `  "meta": ${JSON.stringify(nextMeta)},`;
    const text = lines.join(eol) + (hasTrailingNewline ? eol : '');
    return { text, reformatted: false };
  }
  const text = formatCatalog({ ...catalog, meta: nextMeta });
  return { text, reformatted: !canonical || reformat };
}

// Форматирует числа и готовые фрагменты текста для research/expansion/README.md.
export function formatReadmeSummary(stats, { changes = [], wrote = false, reformatted = false, checkOnly = false } = {}) {
  const d = stats.decisions;
  const p = stats.priorities;
  const op = stats.openPriorities;
  const lines = [];

  if (changes.length === 0 && !reformatted) {
    lines.push('catalog.json: счётчики meta актуальны.');
  } else {
    const verb = checkOnly ? 'требуют обновления' : (wrote ? 'обновлены' : 'изменены');
    if (changes.length > 0) {
      lines.push(`catalog.json: счётчики meta ${verb}:`);
      for (const { field, before, after } of changes) {
        lines.push(`- ${field}: ${JSON.stringify(before)} → ${JSON.stringify(after)}`);
      }
    } else {
      lines.push('catalog.json: счётчики meta актуальны.');
    }
    if (reformatted) {
      lines.push(checkOnly
        ? '- формат файла отличается от канонического (1 запись = 1 строка); запустите `npm run research:meta`.'
        : '- формат файла восстановлен к каноническому (1 запись = 1 строка).');
    }
  }

  const statusParts = [
    `**${d.merged}** ${plural(d.merged, ['запись', 'записи', 'записей'])} \`merged\` (карточки в main)`,
    `**${d.candidate}** — \`candidate\``,
    `\`prepared\` — ${d.prepared}`,
  ];
  if (d.published) statusParts.push(`\`published\` — ${d.published}`);
  if (d.deferred) statusParts.push(`\`deferred\` — ${d.deferred}`);
  if (d.rejected) statusParts.push(`\`rejected\` — ${d.rejected}`);

  lines.push(
    '',
    '## Числа для research/expansion/README.md',
    '',
    `- Всего записей (\`totalCandidates\`): **${stats.totalCandidates}** (v1: ${stats.previousCandidates}, добавлены v2+: ${stats.newCandidates})`,
    `- Авторских языков (\`authorStyleCandidates\`): **${stats.authorStyleCandidates}**, коллективных традиций (\`tradition\`): **${stats.traditionCandidates}**`,
    `- Приоритеты всего (\`priorities\`): P1 — ${p.P1}, P2 — ${p.P2}, R — ${p.R}`,
    `- Открытые кандидаты (\`candidate\` = ${d.candidate}): P1 — ${op.P1}, P2 — ${op.P2}, R — ${op.R}`,
    `- Решения: merged — ${d.merged}, candidate — ${d.candidate}, prepared — ${d.prepared}, published — ${d.published}, deferred — ${d.deferred}, rejected — ${d.rejected}`,
    '',
    'Готовые строки для `research/expansion/README.md`:',
    `> Зафиксированы **${stats.totalCandidates} ${plural(stats.totalCandidates, ['кандидат', 'кандидата', 'кандидатов'])}**, включая ${stats.authorStyleCandidates} ${plural(stats.authorStyleCandidates, ['авторский язык', 'авторских языка', 'авторских языков'])} и ${stats.traditionCandidates} ${plural(stats.traditionCandidates, ['коллективную традицию', 'коллективные традиции', 'коллективных традиций'])}. Сохранены ${stats.previousCandidates} ${plural(stats.previousCandidates, ['предложение', 'предложения', 'предложений'])} v1, добавлены ${stats.newCandidates}.`,
    `> Статусы программы: ${statusParts.join(', ')}.`,
    `> сначала P1 (${p.P1} ${plural(p.P1, ['тема', 'темы', 'тем'])}), затем P2 (${p.P2}); R (${p.R})`,
  );

  return lines.join('\n');
}
