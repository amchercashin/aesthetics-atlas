// Сборка данных: content/*.yaml → data/atlas.json
//   node scripts/build.mjs [--offline] [--refresh]
// Разрешает картинки и статьи через Wikimedia API, считает палитры, валидирует граф.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { validate } from './lib/validate.mjs';
import { resolveFiles, resolveWiki, commonsCategories, commonsCategoriesExist, saveCache } from './lib/wikimedia.mjs';
import { downloadThumb, paletteFromImage, paletteFromHexList, mapLimit } from './lib/palette.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));
const opts = { offline: args.has('--offline'), refresh: args.has('--refresh'), log: (m) => console.log(m) };

const readYaml = (p) => yaml.load(fs.readFileSync(p, 'utf8'));
const eras = readYaml(path.join(ROOT, 'content/eras.yaml'));
const resources = readYaml(path.join(ROOT, 'content/resources.yaml')) ?? [];
const styleDir = path.join(ROOT, 'content/styles');
const styles = fs.readdirSync(styleDir).filter((f) => f.endsWith('.yaml')).sort()
  .flatMap((f) => (readYaml(path.join(styleDir, f)) ?? []).map((s) => ({ ...s, _file: f })));

console.log(`Loaded ${styles.length} styles, ${eras.length} eras`);

// 1. Структура и граф
const { errors, warnings } = validate(styles, eras);

// 2. Картинки
const fileRefs = styles.flatMap((s) => [s.example?.file, ...(s.gallery ?? []).map((g) => g.file)]).filter(Boolean);
const media = await resolveFiles(fileRefs, opts);
for (const s of styles) {
  for (const ref of [s.example?.file, ...(s.gallery ?? []).map((g) => g.file)].filter(Boolean)) {
    const m = media.get(ref);
    if (!m || m.missing) errors.push(`[${s.id}] image not found on Wikimedia: "${ref}"`);
  }
}

// 3. Википедия
const wikiOf = (s) => (typeof s.wiki === 'string' ? { en: s.wiki } : s.wiki ?? {});
const wiki = await resolveWiki(styles.map(wikiOf), opts);
const qidOf = (s) => { const w = wikiOf(s); const r = w.en ? wiki.get(`enwiki:${w.en}`) : w.ru ? wiki.get(`ruwiki:${w.ru}`) : null; return r?.qid ?? null; };
const cats = await commonsCategories(styles.map(qidOf), opts);
const catExists = await commonsCategoriesExist(styles.map((s) => s.commons ?? cats.get(qidOf(s))), opts);
function wikiLinks(s) {
  const w = wikiOf(s);
  const links = [];
  let en = w.en ? wiki.get(`enwiki:${w.en}`) : null;
  let ru = w.ru ? wiki.get(`ruwiki:${w.ru}`) : null;
  if (w.en && (!en || en.missing)) { errors.push(`[${s.id}] en.wikipedia article not found: "${w.en}"`); en = null; }
  if (w.ru && (!ru || ru.missing)) { errors.push(`[${s.id}] ru.wikipedia article not found: "${w.ru}"`); ru = null; }
  const ruLink = ru ? { title: ru.title, url: ru.url } : en?.other;
  const enLink = en ? { title: en.title, url: en.url } : ru?.other;
  if (ruLink) links.push({ title: ruLink.title, url: ruLink.url, src: 'Википедия', lang: 'ru' });
  else if (w.en || w.ru) warnings.push(`[${s.id}] no Russian Wikipedia article`);
  if (enLink) links.push({ title: enLink.title, url: enLink.url, src: 'Wikipedia', lang: 'en' });
  const cat = s.commons ?? cats.get(qidOf(s));
  if (cat && !catExists.get(cat)) warnings.push(`[${s.id}] Commons category not found: ${cat}`);
  if (cat && catExists.get(cat)) links.push({ title: 'Больше изображений', url: `https://commons.wikimedia.org/wiki/Category:${encodeURIComponent(cat.replace(/ /g, '_'))}`, src: 'Wikimedia Commons', lang: 'multi' });
  return links;
}

// 4. Палитры
const palettes = new Map();
await mapLimit(styles, 3, async (s) => {
  try {
    if (Array.isArray(s.palette) && s.palette.length) { palettes.set(s.id, paletteFromHexList(s.palette)); return; }
    const m = media.get(s.example?.file);
    if (!m || m.missing) return;
    const buf = await downloadThumb(m.thumbs[250] ?? m.url, opts);
    palettes.set(s.id, await paletteFromImage(buf));
  } catch (e) {
    errors.push(`[${s.id}] palette failed: ${e.message}`);
  }
});

// 5. Сборка записей
const img = (ref) => {
  const m = ref && media.get(ref);
  if (!m || m.missing) return null;
  return {
    w: m.width, h: m.height, src: m.thumbs, page: m.page,
    artist: m.artist, artistUrl: m.artistUrl, license: m.license, licenseUrl: m.licenseUrl,
    credit: m.credit, nonfree: m.nonfree,
  };
};
const paragraphs = (t) => String(t ?? '').split(/\n\s*\n/).map((p) => p.replace(/\s+/g, ' ').trim()).filter(Boolean);

const children = new Map(styles.map((s) => [s.id, []]));
for (const s of styles) for (const p of s.parents ?? []) children.get(p.id)?.push({ id: s.id, type: p.type });

const out = styles.map((s) => {
  const links = [...wikiLinks(s), ...(s.links ?? []).map((l) => ({ title: l.title ?? null, url: l.url, src: l.src, lang: l.lang ?? 'en' }))];
  // ≥3 ссылки; для свежих эстетик без статьи в русской Википедии достаточно двух.
  const need = links.some((l) => l.src === 'Википедия') ? 3 : 2;
  if (links.length < need) errors.push(`[${s.id}] needs ≥${need} links (has ${links.length})`);
  if (!palettes.has(s.id)) errors.push(`[${s.id}] no palette`);
  return {
    id: s.id, name: s.name, orig: s.orig, aliases: s.aliases ?? [],
    start: s.start, end: s.end ?? null, dates: s.dates ?? null,
    era: s.era, domain: s.domain, region: s.region ?? null, tier: s.tier,
    root: !!s.root, row: s.row ?? null,
    parents: s.parents ?? [], children: children.get(s.id) ?? [],
    summary: String(s.summary).trim(), description: paragraphs(s.description),
    traits: s.traits ?? [], names: s.names ?? [],
    example: { title: s.example?.title ?? null, author: s.example?.author ?? null, year: s.example?.year ?? null,
      place: s.example?.place ?? null, note: s.example?.note ?? null, img: img(s.example?.file) },
    gallery: (s.gallery ?? []).map((g) => ({ title: g.title ?? null, author: g.author ?? null, year: g.year ?? null, img: img(g.file) })),
    palette: palettes.get(s.id) ?? null,
    links,
  };
});
out.sort((a, b) => a.start - b.start || a.tier - b.tier || a.name.localeCompare(b.name, 'ru'));
out.forEach((s, i) => { s.order = i; });

saveCache();

// 6. Отчёт
for (const w of warnings) console.warn('  warn  ' + w);
for (const e of errors) console.error('  ERROR ' + e);
const imgs = out.reduce((n, s) => n + (s.example.img ? 1 : 0) + s.gallery.length, 0);
const fair = out.reduce((n, s) => n + [s.example.img, ...s.gallery.map((g) => g.img)].filter((m) => m?.nonfree).length, 0);
console.log(`\n${out.length} styles · ${imgs} images (${fair} fair use) · ${out.reduce((n, s) => n + s.links.length, 0)} links · ${errors.length} errors · ${warnings.length} warnings`);

if (errors.length) { console.error('\nBuild failed — data/atlas.json not written.'); process.exit(1); }

const atlas = {
  _generated: 'Сгенерировано scripts/build.mjs из content/*.yaml. Не редактировать вручную — правьте content/ и запускайте npm run build.',
  builtAt: new Date().toISOString().slice(0, 10),
  eras: eras.map((e) => ({ ...e, intro: String(e.intro ?? '').trim() })),
  resources,
  styles: out,
};
fs.writeFileSync(path.join(ROOT, 'data/atlas.json'), JSON.stringify(atlas));
console.log(`Wrote data/atlas.json (${(fs.statSync(path.join(ROOT, 'data/atlas.json')).size / 1024).toFixed(0)} KB)`);
