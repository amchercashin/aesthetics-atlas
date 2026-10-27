// Запись стиля для data/atlas.json: чистые функции без сети, чтобы перенос полей проверялся тестами.
// build.mjs передаёт сюда уже разрешённые картинки, ссылки и палитру.

import { ymd } from './validate.mjs';

const asList = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);
const str = (v) => (v == null ? null : String(v).trim() || null);
export const paragraphs = (t) => String(t ?? '').split(/\n\s*\n/).map((p) => p.replace(/\s+/g, ' ').trim()).filter(Boolean);

// Историческая связь. Старые связи без статуса мигрируют как непроверенные — не как подтверждённые.
export function relation(p) {
  return { id: p.id, type: p.type, status: p.status ?? 'unverified', note: str(p.note), sources: asList(p.sources) };
}

export function childrenOf(styles) {
  const out = new Map(styles.map((s) => [s.id, []]));
  for (const s of styles) for (const p of s.parents ?? []) out.get(p.id)?.push({ ...relation(p), id: s.id });
  return out;
}

// Визуальные сопоставления симметричны: объявлены на одной стороне, видны с обеих.
export function comparisonsOf(styles) {
  const out = new Map(styles.map((s) => [s.id, []]));
  for (const s of styles) {
    for (const c of s.compare ?? []) {
      const rec = { note: str(c.note), sources: asList(c.sources) };
      out.get(s.id)?.push({ id: c.id, ...rec });
      out.get(c.id)?.push({ id: s.id, ...rec });
    }
  }
  return out;
}

// Context is navigable in both directions, but never participates in historical ancestry.
export function contextsOf(styles) {
  const out = new Map(styles.map((s) => [s.id, []]));
  for (const s of styles) for (const c of s.contexts ?? []) {
    const rec = { type: c.type, status: c.status, note: str(c.note), sources: asList(c.sources) };
    out.get(s.id)?.push({ ...rec, id: c.id, direction: 'out' });
    out.get(c.id)?.push({ ...rec, id: s.id, direction: 'in' });
  }
  return out;
}

// Права: лицензия фотографии не распространяется на изображённое произведение — это отдельная пометка.
function rightsOf(spec, img) {
  return {
    status: img.nonfree ? 'nonfree' : 'free',
    basis: str(spec.rights?.basis),
    reviewed: ymd(spec.rights?.reviewed),
    note: str(spec.rights?.note),
  };
}

// spec — запись example/gallery из YAML, img — разрешённый Wikimedia-файл (или null).
export function imageRecord(spec = {}, img = null) {
  const rec = {
    title: str(spec.title), author: str(spec.author), year: spec.year ?? null, place: str(spec.place),
    note: str(spec.note), role: spec.role ?? 'work', why: str(spec.whyRepresentative), sources: asList(spec.sources),
    medium: str(spec.medium), workId: str(spec.workId), img: null, external: null,
  };
  if (!img) {
    if (spec.reference) {
      rec.external = { page: spec.reference, reference: true, license: null, nonfree: null,
        rights: { status: 'reference', basis: str(spec.rights?.basis), reviewed: ymd(spec.rights?.reviewed), note: str(spec.rights?.note) } };
    }
    return rec;
  }
  const merged = { ...img };
  if (img.local && img.kind === 'work') {
    merged.artist = str(spec.credit) ?? img.artist;
    merged.license = str(spec.license) ?? img.license;
    merged.nonfree = spec.nonfree === true;
    merged.page = str(spec.reference) ?? img.page;
  }
  const rights = rightsOf(spec, merged);
  if (spec.rights?.embed === false) {
    // Не встраиваем: только ссылка на страницу файла.
    rec.external = { page: merged.page, license: merged.license, nonfree: !!merged.nonfree, rights };
  } else {
    rec.img = { ...merged, rights };
  }
  if (spec.reference) {
    rec.external = { page: spec.reference, reference: true, license: merged.license, nonfree: !!merged.nonfree, rights };
  }
  return rec;
}

export function paletteRecord(spec, computed, example, fromImages = false) {
  if (!computed) return null;
  const editorial = !fromImages && Array.isArray(spec.palette) && spec.palette.length > 0;
  return {
    ...computed,
    source: editorial ? 'editorial' : 'image',
    note: editorial ? str(spec.paletteNote) : fromImages ? 'Средний цвет по всем изображениям карточки' : str(spec.paletteNote),
    from: editorial ? null : fromImages ? null : example?.img?.page ?? example?.external?.page ?? null,
  };
}

export function buildRecord(s, { links = [], palette = null, paletteFromImages = false, img = () => null, children = [], comparisons = [], contexts = null } = {}) {
  const example = imageRecord(s.example, img(s.example?.file ?? s.example?.asset));
  return {
    id: s.id, name: s.name, orig: s.orig,
    kind: asList(s.kind), kindNote: str(s.kindNote), scopeNote: str(s.scopeNote),
    aliases: s.aliases ?? [], searchKeywords: s.searchKeywords ?? [], formerIds: s.formerIds ?? [],
    labelStatus: str(s.labelStatus), maturity: s.maturity ?? 'not-assessed',
    creators: (s.creators ?? []).map((c) => ({ name: str(c.name), orig: str(c.orig), role: str(c.role), aliases: asList(c.aliases), sources: asList(c.sources) })),
    admission: s.admission ? { ...Object.fromEntries(['language', 'corpus', 'distinctness', 'significance'].map((k) => [k, str(s.admission[k])])), sources: asList(s.admission.sources) } : null,
    start: s.start, end: s.end ?? null, dates: s.dates ?? null,
    dateKind: s.dateKind ?? null, approx: !!s.approx, dateNote: str(s.dateNote),
    endKind: s.end == null ? s.endKind ?? 'ongoing' : null,
    termAttested: s.termAttested ? { year: s.termAttested.year, source: s.termAttested.source, note: str(s.termAttested.note) } : null,
    revivals: (s.revivals ?? []).map((r) => ({ start: r.start, end: r.end ?? null, note: str(r.note) })),
    era: s.era, domain: s.domain, medium: asList(s.medium), region: s.region ?? null, tier: s.tier,
    root: !!s.root, origin: s.origin ?? null, row: s.row ?? null,
    parents: (s.parents ?? []).map(relation), children, comparisons,
    contexts: contexts ?? (s.contexts ?? []).map((c) => ({ ...relation(c), direction: 'out' })),
    summary: String(s.summary).trim(), description: paragraphs(s.description),
    traits: s.traits ?? [], promptCues: s.promptCues ?? [], names: s.names ?? [],
    example,
    gallery: (s.gallery ?? []).map((g) => imageRecord(g, img(g.file ?? g.asset))),
    corpus: (s.corpus ?? []).map((w) => imageRecord(w, img(w.file ?? w.asset))),
    palette: paletteRecord(s, palette, example, paletteFromImages),
    evidence: (s.evidence ?? []).map((e) => ({ claim: str(e.claim), field: str(e.field), source: e.source, note: str(e.note) })),
    review: s.review ? { status: s.review.status, date: ymd(s.review.date), scope: s.review.scope ?? [], note: str(s.review.note) } : { status: 'legacy', date: null, scope: [], note: null },
    links,
  };
}
