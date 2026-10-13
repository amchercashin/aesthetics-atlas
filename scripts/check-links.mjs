// Проверка внешних ссылок из content/ (включая sources.yaml): 404 — ошибка; 403/429 (защита от ботов) — «не проверить».
// Aesthetics Wiki (Fandom) закрыта для скриптов, поэтому проверяется через её MediaWiki API.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { UA } from './lib/wikimedia.mjs';
import { mapLimit } from './lib/palette.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(ROOT, 'content/styles');
const only = process.argv[2]; // необязательно: имя файла
const links = [];
for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.yaml') && (!only || f.includes(only))).sort()) {
  for (const s of yaml.load(fs.readFileSync(path.join(dir, f), 'utf8')) ?? []) for (const l of s.links ?? []) links.push({ id: s.id, url: l.url });
}
for (const g of yaml.load(fs.readFileSync(path.join(ROOT, 'content/resources.yaml'), 'utf8')) ?? []) for (const r of g.items) links.push({ id: 'resources', url: r.url });
// Источники утверждений: битая ссылка здесь хуже, чем в «почитать».
if (!only) for (const src of yaml.load(fs.readFileSync(path.join(ROOT, 'content/sources.yaml'), 'utf8')) ?? []) links.push({ id: `source ${src.id}`, url: src.url });

async function check(url) {
  const fandom = /^https:\/\/([a-z0-9-]+)\.fandom\.com\/wiki\/(.+)$/.exec(url);
  if (fandom) {
    const api = `https://${fandom[1]}.fandom.com/api.php?action=query&format=json&redirects=1&titles=${fandom[2]}`;
    const r = await fetch(api, { headers: { 'User-Agent': UA } });
    if (!r.ok) return `api ${r.status}`;
    const j = await r.json();
    const page = Object.values(j.query?.pages ?? {})[0];
    return page && !('missing' in page) ? 200 : 404;
  }
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html' }, redirect: 'follow', signal: AbortSignal.timeout(20000) });
    // World History Encyclopedia отвечает 403 на несуществующие страницы.
    if (r.status === 403 && url.includes('worldhistory.org')) return '403 (нет страницы)';
    // «Мягкий 404»: код 200, но в заголовке страницы — Not Found.
    if (r.status === 200 && /text\/html/.test(r.headers.get('content-type') ?? '')) {
      const title = /<title[^>]*>([^<]*)<\/title>/i.exec(await r.text())?.[1] ?? '';
      if (/\b404\b|not found|page not found/i.test(title)) return 'soft 404';
    }
    return r.status;
  } catch (e) { return 'ERR ' + e.message; }
}

const res = await mapLimit(links, 4, async (l) => ({ ...l, status: await check(l.url) }));
let bad = 0, unverifiable = 0;
for (const r of res) {
  if (r.status === 200) continue;
  if (r.status === 403 || r.status === 429 || String(r.status).startsWith('api')) { unverifiable++; console.log(`  ?  ${r.status} [${r.id}] ${r.url}`); }
  else { bad++; console.log(`  ✗  ${r.status} [${r.id}] ${r.url}`); }
}
console.log(`\n${res.length} links · ${bad} broken · ${unverifiable} unverifiable`);
process.exit(bad ? 1 : 0);
