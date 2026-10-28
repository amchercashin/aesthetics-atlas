import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reviewStatus, toMarkdown, checklist } from '../scripts/lib/review-status.mjs';
import { REVIEW_STANDARD_FROM } from '../scripts/lib/validate.mjs';

const g = { file: 'G.jpg', title: 'Ваза', author: 'мастер неизвестен', year: 'дата неизвестна', whyRepresentative: 'Роспись по глине.' };
const files = [
  { file: '01-a.yaml', styles: [
    { id: 'draft', gallery: [{ file: 'D.jpg', title: 'Д' }] },
    { id: 'rel', review: { status: 'partial', date: '2026-10-16', scope: ['relations'] }, gallery: [g] },
  ] },
  { file: '02-b.yaml', styles: [
    { id: 'full', review: { status: 'reviewed', date: REVIEW_STANDARD_FROM, scope: ['relations', 'dates', 'text', 'images', 'gallery'] },
      dateKind: 'period', evidence: [{ field: 'dates' }, { field: 'description' }], example: { whyRepresentative: 'w', sources: ['s'] }, gallery: [g] },
    { id: 'part', review: { status: 'partial', date: REVIEW_STANDARD_FROM, scope: ['relations', 'images'] }, example: {}, gallery: [g] },
  ] },
];
const issues = { issues: {
  44: { all: true, parts: ['gallery'] },
  45: { parts: ['dates', 'text', 'images'], cards: ['rel', 'full'] },
  46: { parts: ['relations', 'dates', 'text', 'images', 'gallery'], cards: ['draft'] },
  48: { cards: { part: ['dates', 'text'] } },
} };

test('progress per issue counts only the parts each issue asks for', () => {
  const r = reviewStatus(files, issues);
  assert.deepEqual(r.progress[44], { total: 4, left: ['draft', 'rel', 'part'], images: 3 });
  assert.deepEqual(r.progress[45].left, ['rel']);
  assert.deepEqual(r.progress[46].left, ['draft']);
  assert.deepEqual(r.progress[48].left, ['part']);
  const part = r.cards.find((c) => c.id === 'part');
  assert.deepEqual(part.missing, ['dates', 'text', 'gallery']);
  assert.ok(part.enforced && part.trace.some((t) => t.includes('whyRepresentative')));
  assert.equal(r.cards.find((c) => c.id === 'draft').galleryGaps, 1);
  assert.equal(r.cards.find((c) => c.id === 'full').galleryGaps, 0);
});

test('markdown report marks enforced trace problems and can be limited to one file', () => {
  const md = toMarkdown(reviewStatus(files, issues), { file: '02-b.yaml' });
  assert.match(md, /№45, даты, описание и главная иллюстрация: осталось 1 из 2 карточек/);
  assert.match(md, /№48, неполная сверка: осталось 1 из 1 карточки/);
  assert.match(md, /Полностью сверены: 1 из 4/);
  assert.match(md, /\| `part` \| partial \| даты, описание, галерея \| \*\*ошибка:\*\* images: example needs whyRepresentative/);
  assert.doesNotMatch(md, /## 01-a\.yaml/);
});

test('issue checklist ticks finished cards and groups them by file', () => {
  const r = reviewStatus(files, issues);
  assert.equal(checklist(r, issues, '45'), '### `01-a.yaml` (1)\n- [ ] `rel` — даты, описание, главная иллюстрация\n\n### `02-b.yaml` (1)\n- [x] `full` — даты, описание, главная иллюстрация');
  assert.match(checklist(r, issues, '48'), /- \[ \] `part` — даты, описание/);
  assert.match(checklist(r, issues, '44'), /- \[x\] `full` — галерея/);
});
