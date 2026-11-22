// Разделение собранного атласа на лёгкий индекс data/index.json (для главной, карты,
// каталога, хронологии и поиска) и детальные файлы data/styles/<id>.json (для залов стилей).
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export function collectStyleSourceIds(s) {
  const ids = new Set();
  const addAll = (list) => { for (const id of list ?? []) if (id) ids.add(id); };
  for (const r of [...(s.parents ?? []), ...(s.children ?? []), ...(s.comparisons ?? []), ...(s.contexts ?? [])]) addAll(r.sources);
  for (const w of [s.example, ...(s.gallery ?? []), ...(s.corpus ?? [])]) if (w) addAll(w.sources);
  for (const e of s.evidence ?? []) if (e?.source) ids.add(e.source);
  for (const c of s.creators ?? []) addAll(c.sources);
  addAll(s.admission?.sources);
  if (s.termAttested?.source) ids.add(s.termAttested.source);
  return ids;
}

export function collectIndexSourceIds(styles) {
  const ids = new Set();
  for (const s of styles) {
    for (const r of [...(s.parents ?? []), ...(s.comparisons ?? []), ...(s.contexts ?? [])]) {
      for (const id of r.sources ?? []) if (id) ids.add(id);
    }
  }
  return ids;
}

export function toBriefStyle(s) {
  const fallbackWork = !s.example?.img
    ? (s.gallery?.find((g) => g.img) ?? s.corpus?.find((c) => c.img) ?? null)
    : null;
  return {
    id: s.id,
    name: s.name,
    ...(s.shortTitle ? { shortTitle: s.shortTitle } : {}),
    ...(s.subtitle ? { subtitle: s.subtitle } : {}),
    orig: s.orig,
    kind: s.kind,
    aliases: s.aliases,
    searchKeywords: s.searchKeywords,
    formerIds: s.formerIds,
    creators: (s.creators ?? []).map(({ name, orig, role, aliases }) => ({ name, orig, role, aliases })),
    corpusTitles: (s.corpus ?? []).map((w) => w.title).filter(Boolean),
    start: s.start,
    end: s.end,
    dates: s.dates,
    dateKind: s.dateKind,
    approx: s.approx,
    endKind: s.endKind,
    era: s.era,
    domain: s.domain,
    medium: s.medium,
    subjects: s.subjects,
    region: s.region,
    regions: s.regions ?? [],
    tier: s.tier,
    order: s.order,
    nebula: s.nebula,
    part: s.part,
    root: s.root,
    origin: s.origin,
    row: s.row,
    parents: s.parents,
    children: s.children,
    comparisons: s.comparisons,
    contexts: s.contexts,
    ...(s.featuredContext ? { featuredContext: s.featuredContext } : {}),
    summary: s.summary,
    traits: s.traits,
    promptCues: s.promptCues,
    names: s.names,
    palette: s.palette,
    example: s.example,
    gallery: fallbackWork ? [fallbackWork] : [],
  };
}

export function splitAtlas(atlas, stats = null) {
  const sourcesById = new Map((atlas.sources ?? []).map((src) => [src.id, src]));
  const indexSrcIds = collectIndexSourceIds(atlas.styles);
  const indexSources = [...indexSrcIds]
    .map((id) => sourcesById.get(id))
    .filter(Boolean)
    .map(({ id, title, url, publisher }) => ({ id, title, url, publisher }));

  const styles = new Map();
  const hash = crypto.createHash('sha1');
  for (const s of atlas.styles) {
    const cardSources = [...collectStyleSourceIds(s)]
      .map((id) => sourcesById.get(id))
      .filter(Boolean);
    const full = { ...s, sources: cardSources };
    const json = JSON.stringify(full);
    styles.set(s.id, json);
    hash.update(s.id);
    hash.update(json);
  }

  const indexPayload = {
    _generated: atlas._generated,
    builtAt: atlas.builtAt,
    version: '',
    stats,
    eras: atlas.eras,
    resources: atlas.resources,
    promptSubjects: atlas.promptSubjects,
    ...(atlas.trails ? { trails: atlas.trails } : {}),
    nebulae: atlas.nebulae,
    sources: indexSources,
    styles: atlas.styles.map(toBriefStyle),
  };
  hash.update(JSON.stringify(indexPayload));
  const version = hash.digest('hex').slice(0, 8);
  indexPayload.version = version;

  return {
    version,
    indexJson: JSON.stringify(indexPayload),
    styleJsons: styles,
  };
}

export function writeSplitAtlas(root, atlas, stats = null) {
  const { version, indexJson, styleJsons } = splitAtlas(atlas, stats);
  const dataDir = path.join(root, 'data');
  const stylesDir = path.join(dataDir, 'styles');
  fs.mkdirSync(stylesDir, { recursive: true });

  const keep = new Set();
  for (const [id, json] of styleJsons) {
    const name = `${id}.json`;
    keep.add(name);
    const dest = path.join(stylesDir, name);
    if (!fs.existsSync(dest) || fs.readFileSync(dest, 'utf8') !== json) {
      fs.writeFileSync(dest, json);
    }
  }
  for (const f of fs.readdirSync(stylesDir)) {
    if (f.endsWith('.json') && !keep.has(f)) fs.unlinkSync(path.join(stylesDir, f));
  }
  fs.writeFileSync(path.join(dataDir, 'index.json'), indexJson);
  return { version, indexBytes: Buffer.byteLength(indexJson), styleCount: styleJsons.size };
}
