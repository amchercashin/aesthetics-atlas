// Ход сверки карточек (план docs/superpowers/plans/2026-10-28-card-review.md): что не сверено, каких следов
// сверки не хватает и сколько осталось по issues №44–48. Чистые функции без сети.
import { applicableScope, reviewTraceIssues, REVIEW_STANDARD_FROM, ymd } from './validate.mjs';

const PART = { relations: 'связи', dates: 'даты', text: 'описание', corpus: 'корпус', images: 'главная иллюстрация', gallery: 'галерея' };
export const partNames = (keys) => keys.map((k) => PART[k] ?? k).join(', ');

// Изображения галереи, которым не хватает подписи по стандарту (автор, год, whyRepresentative, источник).
const galleryGaps = (s) => (s.gallery ?? []).filter((g) => reviewTraceIssues({ review: { scope: ['gallery'] }, gallery: [g] }).length).length;

// files: [{ file, styles }]; issues — содержимое docs/card-review-2026-issues.json.
export function reviewStatus(files, issues) {
  const cards = files.flatMap(({ file, styles }) => styles.map((s) => {
    const scope = s.review?.scope ?? [];
    const date = ymd(s.review?.date);
    return {
      id: s.id, file, status: s.review?.status ?? 'legacy', date, scope,
      missing: applicableScope(s).filter((k) => !scope.includes(k)),
      // Следы проверяются для заявленного scope; до порога это долг, после — ошибка сборки.
      trace: s.review ? reviewTraceIssues(s) : [],
      enforced: (date ?? '') >= REVIEW_STANDARD_FROM,
      gallery: (s.gallery ?? []).length, galleryGaps: galleryGaps(s),
    };
  }));
  const byId = new Map(cards.map((c) => [c.id, c]));
  const open = (id, parts) => { const c = byId.get(id); return !c || parts.some((p) => c.missing.includes(p)); };
  const is = issues.issues;
  const progress = {
    44: (() => {
      const left = cards.filter((c) => c.gallery && c.missing.includes('gallery'));
      return { total: cards.filter((c) => c.gallery).length, left: left.map((c) => c.id), images: left.reduce((n, c) => n + c.gallery, 0) };
    })(),
    45: { total: is['45'].cards.length, left: is['45'].cards.filter((id) => open(id, is['45'].parts)) },
    46: { total: is['46'].cards.length, left: is['46'].cards.filter((id) => open(id, is['46'].parts)) },
    48: { total: Object.keys(is['48'].cards).length, left: Object.entries(is['48'].cards).filter(([id, parts]) => open(id, parts)).map(([id]) => id) },
  };
  return { cards, progress };
}

// «из 81 карточки», «из 111 карточек».
const ofCards = (n) => `${n} ${n % 10 === 1 && n % 100 !== 11 ? 'карточки' : 'карточек'}`;

export function toMarkdown({ cards, progress }, { file = null } = {}) {
  const p = progress;
  const lines = [
    '## Итог',
    '',
    `- №44, галереи: не сверены у ${p[44].left.length} из ${ofCards(p[44].total)} (изображений в них: ${p[44].images}).`,
    `- №45, даты, описание и главная иллюстрация: осталось ${p[45].left.length} из ${ofCards(p[45].total)}.`,
    `- №46, черновые карточки: осталось ${p[46].left.length} из ${p[46].total}.`,
    `- №48, неполная сверка: осталось ${p[48].left.length} из ${ofCards(p[48].total)}.`,
    `- Полностью сверены: ${cards.filter((c) => c.status === 'reviewed').length} из ${cards.length}.`,
    `- Ошибки стандарта сверки (отметки с ${REVIEW_STANDARD_FROM}): ${cards.filter((c) => c.enforced && c.trace.length).length}; старых отметок без следов: ${cards.filter((c) => !c.enforced && c.trace.length).length}.`,
  ];
  for (const f of [...new Set(cards.map((c) => c.file))].filter((f) => !file || f === file)) {
    const rows = cards.filter((c) => c.file === f);
    lines.push('', `## ${f}`, '', '| Карточка | Статус | Не сверено | Не хватает следов | Галерея без подписи |', '|---|---|---|---|---|');
    for (const c of rows) {
      const trace = c.trace.length ? `${c.enforced ? '**ошибка:** ' : ''}${c.trace.join('; ')}` : '';
      lines.push(`| \`${c.id}\` | ${c.status} | ${partNames(c.missing)} | ${trace} | ${c.galleryGaps ? `${c.galleryGaps} из ${c.gallery}` : ''} |`);
    }
  }
  return lines.join('\n');
}

// Чек-лист issue по файлам: «- [x] `id` — что требуется».
export function checklist({ cards, progress }, issues, number) {
  const is = issues.issues[number];
  const need = number === '48' ? is.cards : Object.fromEntries((is.all ? cards.map((c) => c.id) : is.cards).map((id) => [id, is.parts]));
  const left = new Set(progress[number].left);
  const lines = [];
  for (const f of [...new Set(cards.map((c) => c.file))]) {
    const ids = cards.filter((c) => c.file === f && need[c.id]).map((c) => c.id);
    if (!ids.length) continue;
    lines.push('', `### \`${f}\` (${ids.length})`);
    for (const id of ids) lines.push(`- [${left.has(id) ? ' ' : 'x'}] \`${id}\` — ${partNames(need[id])}`);
  }
  return lines.join('\n').trim();
}
