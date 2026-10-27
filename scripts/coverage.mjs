// Матрица покрытия: регион × эпоха × область, техника и сюжет по data/atlas.json → docs/coverage.md
//   node scripts/coverage.mjs        (сначала npm run build)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MACRO, macroRegions } from './lib/regions.mjs';
import { SUBJECT, MEDIUM } from '../js/format.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const atlas = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/atlas.json'), 'utf8'));
const { styles, eras } = atlas;
const DOMAIN = { art: 'Искусство', architecture: 'Архитектура', design: 'Дизайн', internet: 'Интернет и цифра' };
const regions = [...MACRO, { id: 'unknown', name: 'Не определён' }];

const cell = (list) => {
  if (!list.length) return '·';
  const ov = list.filter((s) => s.kind[0] === 'overview').length;
  return ov ? `${list.length} (обз. ${ov})` : String(list.length);
};
const row = (cells) => `| ${cells.join(' | ')} |`;
const lines = [];
lines.push('# Матрица покрытия', '');
lines.push(`> Сгенерировано \`scripts/coverage.mjs\` из \`data/atlas.json\` (данные от ${atlas.builtAt}). Не редактировать вручную.`, '');
lines.push(`Карточек: ${styles.length}. Макрорегион выводится из свободного поля \`region\` грубыми правилами (\`scripts/lib/regions.mjs\`); карточка с несколькими регионами считается в каждом. «обз.» — сколько из них обзорных (\`kind: overview\`): одна обзорная карточка о цивилизации не равна нескольким самостоятельным традициям.`, '');

lines.push('## Регион × эпоха', '');
lines.push(row(['Регион', ...eras.map((e) => e.short), 'Всего']));
lines.push(row(['---', ...eras.map(() => '---:'), '---:']));
for (const r of regions) {
  const mine = styles.filter((s) => macroRegions(s.region).includes(r.id));
  if (!mine.length && r.id === 'unknown') continue;
  lines.push(row([r.name, ...eras.map((e) => cell(mine.filter((s) => s.era === e.id))), String(mine.length)]));
}
lines.push('');

lines.push('## Область × эпоха', '');
lines.push(row(['Область', ...eras.map((e) => e.short)]));
lines.push(row(['---', ...eras.map(() => '---:')]));
for (const [d, name] of Object.entries(DOMAIN)) lines.push(row([name, ...eras.map((e) => cell(styles.filter((s) => s.era === e.id && s.domain.includes(d))))]));
lines.push('');

// Поля фильтров каталога «Техника» и «Сюжет»: у карточки может быть несколько значений.
const facet = (title, field, dict, intro) => {
  lines.push(`## ${title}`, '', intro, '');
  lines.push(row([title, 'Карточек', 'Карточки']));
  lines.push(row(['---', '---:', '---']));
  for (const [v, name] of Object.entries(dict)) {
    const mine = styles.filter((s) => s[field].includes(v));
    lines.push(row([`${name} (\`${v}\`)`, String(mine.length), mine.map((s) => s.id).join(', ') || '·']));
  }
  lines.push('');
};
const withMedium = styles.filter((s) => s.medium.length);
facet('Техника', 'medium', MEDIUM, `Поле \`medium\` заполнено у ${withMedium.length} из ${styles.length} карточек; по нему работает фильтр каталога «Техника».`);
const noSubject = styles.filter((s) => !s.subjects.length);
facet('Сюжет', 'subjects', SUBJECT, `Поле \`subjects\` — сюжеты, характерные для стиля по описанию и работам карточки; по нему работает фильтр каталога «Сюжет». Пустой список означает, что сюжет не выражен или неясен (${noSubject.length}): ${noSubject.map((s) => s.id).join(', ') || '—'}.`);

lines.push('## Тип карточки × эпоха', '');
const kinds = [...new Set(styles.map((s) => s.kind[0] ?? '—'))];
lines.push(row(['Тип', ...eras.map((e) => e.short)]));
lines.push(row(['---', ...eras.map(() => '---:')]));
for (const k of kinds) lines.push(row([k, ...eras.map((e) => { const n = styles.filter((s) => s.era === e.id && (s.kind[0] ?? '—') === k).length; return n || '·'; })]));
lines.push('');

lines.push('## Пустые клетки до 1750 года', '');
lines.push('Регионы без единой карточки в доиндустриальных эпохах — кандидаты на расширение (см. `docs/expansion-proposal.md`).', '');
const pre = eras.slice(0, eras.findIndex((e) => e.start >= 1750));
for (const r of regions.filter((x) => !['global', 'unknown'].includes(x.id))) {
  const empty = pre.filter((e) => !styles.some((s) => s.era === e.id && macroRegions(s.region).includes(r.id)));
  if (empty.length) lines.push(`- ${r.name}: ${empty.map((e) => e.short).join(', ')}`);
}
lines.push('');

fs.writeFileSync(path.join(ROOT, 'docs/coverage.md'), lines.join('\n'));
console.log(`Wrote docs/coverage.md (${styles.length} cards)`);
