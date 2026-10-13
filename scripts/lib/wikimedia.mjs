// Клиент Wikimedia API: разрешение файлов (Commons / en.wikipedia) и ссылок на статьи.
// Все ответы кэшируются в scripts/.cache, чтобы повторные сборки не нагружали API.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const UA = 'AestheticsAtlas/1.0 (https://github.com/amchercashin/aesthetics-atlas)';
export const THUMB_WIDTHS = [250, 500, 960, 1280];

const here = path.dirname(fileURLToPath(import.meta.url));
export const CACHE_DIR = path.resolve(here, '../.cache');
const CACHE_FILE = path.join(CACHE_DIR, 'wikimedia.json');

const API = {
  commons: 'https://commons.wikimedia.org/w/api.php',
  enwiki: 'https://en.wikipedia.org/w/api.php',
  ruwiki: 'https://ru.wikipedia.org/w/api.php',
};

let cache = null;
function loadCache() {
  if (cache) return cache;
  try { cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')); } catch { cache = {}; }
  return cache;
}
export function saveCache() {
  if (!cache) return;
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 1));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function fetchWithRetry(url, { tries = 5, binary = false } = {}) {
  let delay = 1500;
  for (let i = 0; i < tries; i++) {
    let res;
    try {
      res = await fetch(url, { headers: { 'User-Agent': UA, 'Api-User-Agent': UA } });
    } catch (e) {
      if (i === tries - 1) throw e;
      await sleep(delay); delay *= 2; continue;
    }
    if (res.ok) return binary ? Buffer.from(await res.arrayBuffer()) : res.json();
    if (res.status === 429 || res.status >= 500) {
      const ra = Number(res.headers.get('retry-after'));
      await sleep(Number.isFinite(ra) && ra > 0 ? ra * 1000 : delay);
      delay *= 2;
      continue;
    }
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  throw new Error(`Gave up after ${tries} tries: ${url}`);
}

function apiUrl(site, params) {
  const u = new URL(API[site]);
  for (const [k, v] of Object.entries({ format: 'json', formatversion: '2', ...params })) u.searchParams.set(k, v);
  return u.toString();
}

// ---------- HTML → plain text (метаданные Commons приходят HTML-фрагментами) ----------
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…' };
export function htmlToText(html) {
  if (html == null) return '';
  return String(html)
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e) => {
      if (e[0] === '#') {
        const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return Number.isFinite(code) ? String.fromCodePoint(code) : m;
      }
      return ENTITIES[e.toLowerCase()] ?? m;
    })
    .replace(/\s+/g, ' ')
    .trim();
}
export function firstHref(html) {
  const m = /href="([^"]+)"/i.exec(String(html ?? ''));
  if (!m) return null;
  let href = m[1].replace(/&amp;/g, '&');
  if (href.startsWith('//')) href = 'https:' + href;
  if (!/^https?:\/\//i.test(href)) return null;
  return href;
}

// ---------- Файлы ----------
// ref: "Имя файла.jpg" (Commons) или "enwiki:Имя файла.jpg" (локальный файл en.wikipedia, обычно fair use)
export function parseFileRef(ref) {
  const m = /^(enwiki|commons):(.*)$/.exec(ref);
  const site = m ? m[1] : 'commons';
  const name = (m ? m[2] : ref).replace(/^File:/i, '').replace(/_/g, ' ').trim();
  return { site, name, key: `${site}:${name}` };
}

function pickMeta(em, k) { return em?.[k]?.value ?? null; }

export async function resolveFiles(refs, { offline = false, refresh = false, log = () => {} } = {}) {
  const c = loadCache();
  const out = new Map();
  const todo = { commons: [], enwiki: [] };
  for (const ref of new Set(refs)) {
    const p = parseFileRef(ref);
    const ck = 'file:' + p.key;
    if (!refresh && c[ck]) { out.set(ref, c[ck]); continue; }
    if (offline) { out.set(ref, { missing: true, error: 'not cached (offline)' }); continue; }
    todo[p.site].push({ ref, ...p });
  }
  for (const site of Object.keys(todo)) {
    const list = todo[site];
    for (let i = 0; i < list.length; i += 40) {
      const batch = list.slice(i, i + 40);
      log(`  wikimedia: ${site} files ${i + 1}–${i + batch.length} of ${list.length}`);
      const titles = batch.map((b) => 'File:' + b.name).join('|');
      const perWidth = {};
      for (const w of THUMB_WIDTHS) {
        perWidth[w] = await fetchWithRetry(apiUrl(site, {
          action: 'query', titles, prop: 'imageinfo',
          iiprop: w === THUMB_WIDTHS[0] ? 'url|size|mime|extmetadata' : 'url',
          iiurlwidth: String(w),
          iiextmetadatafilter: 'Artist|LicenseShortName|LicenseUrl|NonFree|Credit|UsageTerms|ObjectName|DateTimeOriginal',
        }));
      }
      for (const b of batch) {
        const rec = buildFileRecord(b, perWidth);
        c['file:' + b.key] = rec;
        out.set(b.ref, rec);
      }
      saveCache();
    }
  }
  return out;
}

function findPage(resp, name) {
  const want = 'File:' + name;
  const norm = resp.query?.normalized?.find((n) => n.from === want)?.to ?? want;
  return resp.query?.pages?.find((p) => p.title === norm) ?? null;
}

function buildFileRecord(b, perWidth) {
  const base = findPage(perWidth[THUMB_WIDTHS[0]], b.name);
  // Файл с Commons, запрошенный через en.wikipedia, приходит с missing:true, но с imageinfo
  // (imagerepository: "shared") — это валидный файл.
  if (!base || !base.imageinfo?.length) return { missing: true, site: b.site, name: b.name };
  const ii = base.imageinfo[0];
  const em = ii.extmetadata ?? {};
  const thumbs = {};
  for (const w of THUMB_WIDTHS) {
    const p = findPage(perWidth[w], b.name);
    thumbs[w] = p?.imageinfo?.[0]?.thumburl ?? ii.url;
  }
  const nonfree = String(pickMeta(em, 'NonFree') ?? '').toLowerCase() === 'true';
  return {
    site: b.site,
    name: b.name,
    page: ii.descriptionurl,
    url: ii.url,
    width: ii.width,
    height: ii.height,
    mime: ii.mime,
    thumbs,
    artist: htmlToText(pickMeta(em, 'Artist')) || null,
    artistUrl: firstHref(pickMeta(em, 'Artist')),
    license: htmlToText(pickMeta(em, 'LicenseShortName')) || (nonfree ? 'Fair use' : null),
    licenseUrl: pickMeta(em, 'LicenseUrl') || null,
    credit: htmlToText(pickMeta(em, 'Credit')).slice(0, 200) || null,
    nonfree,
  };
}

// ---------- Статьи Википедии ----------
// wiki: "EN title" | { en?: "...", ru?: "..." }
export async function resolveWiki(entries, { offline = false, refresh = false, log = () => {} } = {}) {
  const c = loadCache();
  const out = new Map();
  const need = { enwiki: new Set(), ruwiki: new Set() };
  for (const w of entries) {
    if (w.en) need.enwiki.add(w.en);
    if (w.ru) need.ruwiki.add(w.ru);
  }
  for (const site of ['enwiki', 'ruwiki']) {
    const titles = [...need[site]];
    const todo = titles.filter((t) => refresh || !c[`wiki:${site}:${t}`]);
    if (offline) {
      for (const t of todo) c[`wiki:${site}:${t}`] ??= { missing: true, error: 'not cached (offline)' };
    } else {
      for (let i = 0; i < todo.length; i += 40) {
        const batch = todo.slice(i, i + 40);
        log(`  wikimedia: ${site} articles ${i + 1}–${i + batch.length} of ${todo.length}`);
        const resp = await fetchWithRetry(apiUrl(site, {
          action: 'query', titles: batch.join('|'), redirects: '1',
          prop: 'info|langlinks|pageprops', ppprop: 'wikibase_item', inprop: 'url', lllang: site === 'enwiki' ? 'ru' : 'en', lllimit: 'max',
        }));
        const norm = new Map((resp.query?.normalized ?? []).map((n) => [n.from, n.to]));
        const redir = new Map((resp.query?.redirects ?? []).map((n) => [n.from, n.to]));
        for (const t of batch) {
          let tt = norm.get(t) ?? t;
          tt = redir.get(tt) ?? tt;
          const page = resp.query?.pages?.find((p) => p.title === tt);
          if (!page || page.missing || page.invalid) { c[`wiki:${site}:${t}`] = { missing: true }; continue; }
          const ll = page.langlinks?.[0];
          c[`wiki:${site}:${t}`] = {
            title: page.title,
            url: page.fullurl,
            qid: page.pageprops?.wikibase_item ?? null,
            other: ll ? { title: ll.title, url: `https://${ll.lang}.wikipedia.org/wiki/${encodeURIComponent(ll.title.replace(/ /g, '_'))}` } : null,
          };
        }
        saveCache();
      }
    }
    for (const t of titles) out.set(`${site}:${t}`, c[`wiki:${site}:${t}`]);
  }
  return out;
}

// ---------- Поиск кандидатов (для подбора картинок вручную) ----------
export async function searchCommons(query, limit = 15) {
  const resp = await fetchWithRetry(apiUrl('commons', {
    action: 'query', list: 'search', srsearch: query, srnamespace: '6', srlimit: String(limit),
  }));
  return (resp.query?.search ?? []).map((s) => s.title.replace(/^File:/, ''));
}

export async function articleImages(site, title) {
  const resp = await fetchWithRetry(apiUrl(site, {
    action: 'query', titles: title, redirects: '1', prop: 'images|pageimages', imlimit: 'max', piprop: 'name',
  }));
  const page = resp.query?.pages?.[0];
  return { lead: page?.pageimage ?? null, images: (page?.images ?? []).map((i) => i.title.replace(/^File:/, '')) };
}

// Существование категорий Commons (P373 в Wikidata иногда указывает на удалённую или переименованную).
export async function commonsCategoriesExist(names, { offline = false } = {}) {
  const c = loadCache();
  const todo = [...new Set(names.filter(Boolean))].filter((n) => !(('cat:' + n) in c));
  if (!offline) {
    for (let i = 0; i < todo.length; i += 40) {
      const batch = todo.slice(i, i + 40);
      const resp = await fetchWithRetry(apiUrl('commons', { action: 'query', titles: batch.map((n) => 'Category:' + n).join('|'), prop: 'info' }));
      const norm = new Map((resp.query?.normalized ?? []).map((x) => [x.from, x.to]));
      for (const n of batch) {
        const t = norm.get('Category:' + n) ?? 'Category:' + n;
        const page = resp.query?.pages?.find((p) => p.title === t);
        c['cat:' + n] = !!page && !page.missing;
      }
      saveCache();
    }
  }
  return new Map(names.filter(Boolean).map((n) => [n, c['cat:' + n] !== false]));
}

// Категория Commons (свойство Wikidata P373) — для ссылки «Больше изображений».
export async function commonsCategories(qids, { offline = false } = {}) {
  const c = loadCache();
  const out = new Map();
  const todo = [...new Set(qids.filter(Boolean))].filter((q) => !(('p373:' + q) in c));
  if (!offline) {
    for (let i = 0; i < todo.length; i += 45) {
      const batch = todo.slice(i, i + 45);
      const resp = await fetchWithRetry(`https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=claims&ids=${batch.join('|')}`);
      for (const q of batch) {
        const v = resp.entities?.[q]?.claims?.P373?.[0]?.mainsnak?.datavalue?.value ?? null;
        c['p373:' + q] = v;
      }
      saveCache();
    }
  }
  for (const q of qids) if (q) out.set(q, c['p373:' + q] ?? null);
  return out;
}
