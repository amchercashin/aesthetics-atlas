// Структурная валидация контента (чистая функция, без сети).
// Проверяет форму данных и согласованность графа. Историческую истинность и репрезентативность
// изображений валидатор доказать не может — это работа редактора (см. docs/content-audit.md).
import { isLocalAsset } from './local-images.mjs';
export const DOMAINS = ['art', 'architecture', 'design', 'internet'];
export const RELATIONS = ['evolved', 'influence', 'reaction', 'revival'];
export const REL_STATUS = ['verified', 'unverified'];
export const KINDS = ['overview', 'tradition', 'period', 'movement', 'school', 'technique', 'design-system', 'internet-aesthetic', 'trend', 'author-style'];
export const CONTEXT_TYPES = ['member-of', 'uses-technique', 'related-context'];
export const LABEL_STATUS = ['historical', 'self-designation', 'editorial-scope-title'];
export const MATURITY = ['established', 'emerging', 'contested', 'not-assessed'];
export const DATE_KINDS = ['archaeological', 'period', 'institution', 'practice', 'popularity', 'corpus'];
export const END_KINDS = ['ongoing', 'unknown'];
export const IMAGE_ROLES = ['work', 'precursor', 'revival', 'reconstruction', 'illustration', 'portrait'];
export const MEDIUMS = [
  'painting', 'sculpture', 'architecture', 'graphic-design', 'typography', 'illustration', 'photography',
  'product-design', 'interior', 'decorative-arts', 'ceramics', 'textile', 'metalwork', 'manuscript', 'print',
  'ui', 'web', 'digital-art', 'installation', 'moving-image', 'rock-art', 'drawing', 'fashion',
];
export const SOURCE_TYPES = ['museum', 'scholarly', 'primary', 'official', 'encyclopedia', 'community', 'press', 'catalog'];
export const REVIEW_STATUS = ['reviewed', 'partial'];
const HEX = /^#[0-9a-f]{6}$/i;
const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const DATE = /^\d{4}(-\d{2}(-\d{2})?)?$/;

const asList = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);
// YAML превращает 2026-10-13 в Date — приводим к строке YYYY-MM-DD.
export const ymd = (v) => (v == null ? null : v instanceof Date ? v.toISOString().slice(0, 10) : String(v));

// Насколько можно «простить» расхождение дат связи: у приблизительных дат — запас.
function slack(a, b) {
  if (!a.approx && !b.approx) return 0;
  return Math.max(25, Math.round(Math.abs(Math.min(a.start, b.start)) * 0.05));
}

// Проверка дат исторической связи с учётом её типа. Возвращает текст предупреждения или null.
export function relationDateIssue(parent, child, type, now = 2026) {
  if (!Number.isFinite(parent.start) || !Number.isFinite(child.start)) return null;
  const tol = slack(parent, child);
  if (type === 'evolved' && parent.start > child.start + tol) {
    return `развитие из "${parent.id}", который начинается позже (${parent.start} > ${child.start})`;
  }
  if (type === 'revival' && parent.start > child.start + tol) {
    return `возрождение "${parent.id}", который появился позже возрождающего (${parent.start} > ${child.start})`;
  }
  if ((type === 'influence' || type === 'reaction') && parent.start > (child.end ?? now) + tol) {
    return `${type === 'influence' ? 'влияние' : 'реакция на'} "${parent.id}", начавшийся после конца стиля (${parent.start} > ${child.end ?? now})`;
  }
  return null;
}

function checkImage(at, im, where, sourceIds, errors) {
  const localWork = /^assets\/works\//.test(im.asset ?? '');
  if (im.reference != null) {
    if (!/^https:\/\//.test(im.reference)) errors.push(`${at} ${where}: reference must be https`);
    if (im.file || (im.asset && !localWork)) errors.push(`${at} ${where}: choose reference or embedded image`);
    if (!asList(im.sources).length && !localWork) errors.push(`${at} ${where}: external reference needs caption sources`);
  }
  if (im.asset != null) {
    if (!isLocalAsset(im.asset)) errors.push(`${at} ${where}: invalid local asset path`);
    if (im.file) errors.push(`${at} ${where}: choose file or asset, not both`);
    if (localWork) {
      if (!im.credit) errors.push(`${at} ${where}: local work needs credit`);
      if (!im.license) errors.push(`${at} ${where}: local work needs license`);
      if (!/^https:\/\//.test(im.reference ?? '')) errors.push(`${at} ${where}: local work needs an https source reference`);
      if (!im.whyRepresentative) errors.push(`${at} ${where}: local work needs whyRepresentative`);
    } else {
      if (!['illustration', 'reconstruction'].includes(im.role)) errors.push(`${at} ${where}: local illustration needs an explicit role`);
      if (!im.author || !im.year || !im.whyRepresentative) errors.push(`${at} ${where}: local illustration needs author, year and whyRepresentative`);
    }
  }
  if (im.role != null && !IMAGE_ROLES.includes(im.role)) errors.push(`${at} ${where}: bad image role "${im.role}"`);
  if (im.rights != null) {
    if (typeof im.rights !== 'object') errors.push(`${at} ${where}: rights must be an object`);
    else if (im.rights.embed != null && typeof im.rights.embed !== 'boolean') errors.push(`${at} ${where}: rights.embed must be boolean`);
  }
  for (const id of asList(im.sources)) if (!sourceIds.has(id)) errors.push(`${at} ${where}: unknown source "${id}"`);
}

export function validate(styles, eras, sources = []) {
  const errors = [];
  const warnings = [];
  const eraIds = new Set(eras.map((e) => e.id));
  const byId = new Map();

  const sourceIds = new Set();
  const siteWide = new Set(); // источники для методологии сайта, а не для карточек
  for (const src of sources) {
    if (src.site) siteWide.add(src.id);
    const at = `[source ${src.id ?? '?'}]`;
    if (!src.id || !ID.test(src.id)) errors.push(`${at} bad id`);
    if (sourceIds.has(src.id)) errors.push(`${at} duplicate source id`);
    sourceIds.add(src.id);
    if (!src.title) errors.push(`${at} missing title`);
    if (!/^https:\/\//.test(src.url ?? '')) errors.push(`${at} url must be https`);
    if (!SOURCE_TYPES.includes(src.sourceType)) errors.push(`${at} bad sourceType "${src.sourceType}"`);
    if (src.checked != null && !DATE.test(ymd(src.checked))) errors.push(`${at} checked must be YYYY-MM-DD`);
  }
  const usedSources = new Set();
  const useSource = (at, id, where) => {
    usedSources.add(id);
    if (!sourceIds.has(id)) errors.push(`${at} ${where}: unknown source "${id}"`);
  };

  for (const s of styles) {
    const at = `[${s.id ?? '?'}]`;
    if (!s.id || !ID.test(s.id)) errors.push(`${at} bad id`);
    if (byId.has(s.id)) errors.push(`${at} duplicate id`);
    byId.set(s.id, s);

    for (const f of ['name', 'orig', 'summary', 'description']) {
      if (typeof s[f] !== 'string' || !s[f].trim()) errors.push(`${at} missing ${f}`);
    }
    if (!Number.isFinite(s.start)) errors.push(`${at} start must be a number`);
    if (s.end !== null && s.end !== undefined && !Number.isFinite(s.end)) errors.push(`${at} end must be a number or null`);
    if (Number.isFinite(s.start) && Number.isFinite(s.end) && s.start > s.end) errors.push(`${at} start > end`);
    if (!eraIds.has(s.era)) errors.push(`${at} unknown era "${s.era}"`);
    if (!Array.isArray(s.domain) || !s.domain.length || s.domain.some((d) => !DOMAINS.includes(d))) errors.push(`${at} bad domain`);
    if (![1, 2, 3].includes(s.tier)) errors.push(`${at} tier must be 1, 2 or 3`);

    // Тип карточки и границы термина
    for (const k of asList(s.kind)) if (!KINDS.includes(k)) errors.push(`${at} bad kind "${k}"`);
    if (asList(s.kind).length > 2) errors.push(`${at} kind: at most primary + secondary`);
    if (s.kindNote != null && !s.kind) errors.push(`${at} kindNote without kind`);
    for (const m of asList(s.medium)) if (!MEDIUMS.includes(m)) errors.push(`${at} bad medium "${m}"`);
    for (const f of ['aliases', 'searchKeywords', 'formerIds']) if (s[f] != null && !Array.isArray(s[f])) errors.push(`${at} ${f} must be a list`);
    if (s.labelStatus != null && !LABEL_STATUS.includes(s.labelStatus)) errors.push(`${at} bad labelStatus`);
    if (s.maturity != null && !MATURITY.includes(s.maturity)) errors.push(`${at} bad maturity`);
    for (const creator of s.creators ?? []) {
      if (!creator.name || !creator.role) errors.push(`${at} creator needs name and role`);
      if (!asList(creator.sources).length) errors.push(`${at} creator needs attribution sources`);
      if (creator.aliases != null && !Array.isArray(creator.aliases)) errors.push(`${at} creator aliases must be a list`);
      for (const id of asList(creator.sources)) useSource(at, id, 'creator');
    }
    if (asList(s.kind).includes('author-style')) {
      if (!s.scopeNote) errors.push(`${at} author style needs a bounded scopeNote`);
      if (!s.creators?.length) errors.push(`${at} author style needs creators and their roles`);
      if (!s.labelStatus) errors.push(`${at} author style needs labelStatus`);
      if (!Array.isArray(s.corpus) || s.corpus.length < 3) errors.push(`${at} author style needs ≥3 independent corpus works`);
      for (const field of ['language', 'corpus', 'distinctness', 'significance']) {
        if (typeof s.admission?.[field] !== 'string' || !s.admission[field].trim()) errors.push(`${at} author style needs admission.${field}`);
      }
      if (!asList(s.admission?.sources).length) errors.push(`${at} author style needs sources for admission`);
    }
    for (const id of asList(s.admission?.sources)) useSource(at, id, 'admission');
    const corpusKeys = new Set();
    for (const work of s.corpus ?? []) {
      if (!work.title || !work.author || work.year == null || !work.whyRepresentative) errors.push(`${at} corpus work needs title, author, date and visual argument`);
      if (!work.file && !work.asset && !work.reference) errors.push(`${at} corpus work needs an image or external reference`);
      if (!asList(work.sources).length) errors.push(`${at} corpus work needs attribution sources`);
      const key = work.workId ?? work.reference ?? work.file ?? work.asset;
      if (corpusKeys.has(key)) errors.push(`${at} corpus repeats the same work/reference`);
      corpusKeys.add(key);
      checkImage(at, work, 'corpus', sourceIds, errors);
      for (const id of asList(work.sources)) useSource(at, id, 'corpus');
    }

    // Значение дат
    if (s.dateKind != null && !DATE_KINDS.includes(s.dateKind)) errors.push(`${at} bad dateKind "${s.dateKind}"`);
    if (s.dateKind === 'corpus' && (!s.corpus?.length || typeof s.dates !== 'string' || !s.dates.trim() || typeof s.dateNote !== 'string' || !s.dateNote.trim())) {
      errors.push(`${at} corpus dates need works, an explicit dates label and dateNote`);
    }
    if (s.endKind != null && !END_KINDS.includes(s.endKind)) errors.push(`${at} bad endKind "${s.endKind}"`);
    if (s.endKind != null && s.end != null) errors.push(`${at} endKind only applies when end is null`);
    if (s.approx != null && typeof s.approx !== 'boolean') errors.push(`${at} approx must be boolean`);
    if (s.termAttested != null) {
      if (!Number.isFinite(s.termAttested.year)) errors.push(`${at} termAttested.year must be a number`);
      if (!s.termAttested.source) errors.push(`${at} termAttested needs a source`);
      else useSource(at, s.termAttested.source, 'termAttested');
    }
    for (const r of s.revivals ?? []) if (!Number.isFinite(r.start)) errors.push(`${at} revival needs start`);

    // Источники утверждений
    for (const ev of s.evidence ?? []) {
      if (!ev.claim) errors.push(`${at} evidence without claim`);
      if (!ev.source) errors.push(`${at} evidence without source`);
      else useSource(at, ev.source, 'evidence');
    }
    if (s.review != null) {
      if (!REVIEW_STATUS.includes(s.review.status)) errors.push(`${at} bad review.status "${s.review.status}"`);
      if (!DATE.test(ymd(s.review.date) ?? '')) errors.push(`${at} review.date must be YYYY-MM-DD`);
    }

    if (!Array.isArray(s.traits) || s.traits.length < 3) errors.push(`${at} needs ≥3 traits`);
    else if (s.traits.length > 6) warnings.push(`${at} more than 6 traits`);

    const hasImage = (typeof s.example?.file === 'string' && s.example.file.trim()) || isLocalAsset(s.example?.asset);
    const hasPalette = Array.isArray(s.palette) && s.palette.length >= 3 && s.palette.every((h) => HEX.test(h));
    const hasReference = /^https:\/\//.test(s.example?.reference ?? '');
    if (!hasImage && !hasPalette && !hasReference) errors.push(`${at} needs an image, palette or sourced external reference`);
    if (s.palette && !hasPalette) errors.push(`${at} palette must be ≥3 hex colors`);
    if (hasPalette && !hasImage && !s.paletteNote) warnings.push(`${at} editorial palette without paletteNote`);
    if (!s.example?.title) errors.push(`${at} example.title required (the most famous work)`);
    if (s.example) checkImage(at, s.example, 'example', sourceIds, errors);
    for (const id of asList(s.example?.sources)) usedSources.add(id);

    for (const g of s.gallery ?? []) {
      if (!g.file && !g.asset && !g.reference) errors.push(`${at} gallery item without file, asset or reference`);
      checkImage(at, g, 'gallery', sourceIds, errors);
      for (const id of asList(g.sources)) usedSources.add(id);
    }
    for (const l of s.links ?? []) if (!/^https:\/\//.test(l.url ?? '')) errors.push(`${at} link must be https: ${l.url}`);
    const contextSeen = new Set();
    for (const c of s.contexts ?? []) {
      const key = `${c.id}:${c.type}`;
      if (!CONTEXT_TYPES.includes(c.type)) errors.push(`${at} bad context type ${c.type}`);
      if (!REL_STATUS.includes(c.status)) errors.push(`${at} context needs explicit status`);
      if (!c.note) errors.push(`${at} context needs a scope note`);
      if (c.status === 'verified' && !asList(c.sources).length) errors.push(`${at} verified context needs sources`);
      if (c.id === s.id || contextSeen.has(key)) errors.push(`${at} repeated/self context ${key}`);
      contextSeen.add(key);
      for (const id of asList(c.sources)) useSource(at, id, 'context');
    }

    // Генеалогия
    if (!Array.isArray(s.parents)) errors.push(`${at} parents must be an array`);
    else {
      if (s.origin != null && s.origin !== 'unknown') errors.push(`${at} origin can only be "unknown"`);
      if (s.origin === 'unknown' && s.root) errors.push(`${at} root and origin: unknown are mutually exclusive`);
      if (!s.parents.length && !s.root && s.origin !== 'unknown') {
        errors.push(`${at} has no parents (mark root: true for an independent origin, or origin: unknown)`);
      }
      const seen = new Set();
      for (const p of s.parents) {
        if (!RELATIONS.includes(p.type)) errors.push(`${at} bad relation type "${p.type}"`);
        if (p.status != null && !REL_STATUS.includes(p.status)) errors.push(`${at} bad relation status "${p.status}"`);
        if (p.status === 'verified' && !asList(p.sources).length) errors.push(`${at} verified relation to "${p.id}" needs sources`);
        for (const id of asList(p.sources)) useSource(at, id, `relation ${p.id}`);
        if (p.id === s.id) errors.push(`${at} is its own parent`);
        if (seen.has(p.id)) errors.push(`${at} duplicate parent "${p.id}"`);
        seen.add(p.id);
      }
    }
  }

  // Старые адреса не должны совпадать с действующими id.
  const former = new Map();
  for (const s of styles) {
    for (const c of s.contexts ?? []) if (!byId.has(c.id)) errors.push(`[${s.id}] unknown context ${c.id}`);
    for (const f of s.formerIds ?? []) {
      if (byId.has(f)) errors.push(`[${s.id}] formerId "${f}" is still an active id`);
      if (former.has(f)) errors.push(`[${s.id}] formerId "${f}" also claimed by "${former.get(f)}"`);
      former.set(f, s.id);
    }
  }

  for (const s of styles) {
    for (const p of s.parents ?? []) {
      const parent = byId.get(p.id);
      if (!parent) { errors.push(`[${s.id}] unknown parent "${p.id}"`); continue; }
      const issue = relationDateIssue(parent, s, p.type);
      if (issue) warnings.push(`[${s.id}] ${issue}`);
    }
    // Слой визуальных сопоставлений: симметричный, вне генеалогии и вне проверки циклов.
    const cseen = new Set();
    for (const c of s.compare ?? []) {
      if (!byId.has(c.id)) { errors.push(`[${s.id}] unknown comparison "${c.id}"`); continue; }
      if (c.id === s.id) errors.push(`[${s.id}] compared with itself`);
      if (cseen.has(c.id)) errors.push(`[${s.id}] duplicate comparison "${c.id}"`);
      cseen.add(c.id);
      if (!c.note) errors.push(`[${s.id}] comparison with "${c.id}" needs a note (what is similar)`);
      if ((byId.get(c.id).compare ?? []).some((x) => x.id === s.id) && s.id > c.id) {
        errors.push(`[${s.id}] comparison with "${c.id}" is declared on both sides — keep one`);
      }
      const linked = (s.parents ?? []).some((p) => p.id === c.id) || (byId.get(c.id).parents ?? []).some((p) => p.id === s.id);
      if (linked) warnings.push(`[${s.id}] "${c.id}" is both a historical relation and a comparison`);
      for (const id of asList(c.sources)) useSource(`[${s.id}]`, id, `comparison ${c.id}`);
    }
  }

  // Циклы: DFS с цветами — только по генеалогии (parents).
  const color = new Map();
  const visit = (id, stack) => {
    color.set(id, 1);
    for (const p of byId.get(id)?.parents ?? []) {
      if (!byId.has(p.id)) continue;
      const c = color.get(p.id);
      if (c === 1) { errors.push(`cycle: ${[...stack, id, p.id].join(' → ')}`); continue; }
      if (!c) visit(p.id, [...stack, id]);
    }
    color.set(id, 2);
  };
  for (const id of byId.keys()) if (!color.get(id)) visit(id, []);

  for (const id of sourceIds) if (!usedSources.has(id) && !siteWide.has(id)) warnings.push(`[source ${id}] not referenced by any card`);

  return { errors, warnings };
}
