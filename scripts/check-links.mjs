// Проверка внешних ссылок из content/: 404/410 — ошибка; защита сайта и сетевые сбои — «не проверить».
// Aesthetics Wiki (Fandom) закрыта для скриптов, поэтому проверяется через её MediaWiki API.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { UA } from './lib/wikimedia.mjs';
import { mapLimit } from './lib/palette.mjs';
import { contentLinks, linkOutcome } from './lib/content-links.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(ROOT, 'content/styles');
const only = process.argv[2]; // необязательно: имя файла
const styles = [];
for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.yaml') && (!only || f.includes(only))).sort()) {
  styles.push(...(yaml.load(fs.readFileSync(path.join(dir, f), 'utf8')) ?? []));
}
if (only && !styles.length) { console.error(`No style file matches: ${only}`); process.exit(1); }
const sources = yaml.load(fs.readFileSync(path.join(ROOT, 'content/sources.yaml'), 'utf8')) ?? [];
const links = contentLinks(styles, sources, { allSources: !only });
for (const g of yaml.load(fs.readFileSync(path.join(ROOT, 'content/resources.yaml'), 'utf8')) ?? []) for (const r of g.items) links.push({ id: 'resources', url: r.url });

async function check(url) {
  try {
    const fandom = /^https:\/\/([a-z0-9-]+)\.fandom\.com\/wiki\/(.+)$/.exec(url);
    if (fandom) {
      const api = `https://${fandom[1]}.fandom.com/api.php?action=query&format=json&redirects=1&titles=${fandom[2]}`;
      const r = await fetch(api, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20000) });
      if (!r.ok) return `api ${r.status}`;
      const j = await r.json();
      const page = Object.values(j.query?.pages ?? {})[0];
      if (!page) return 'api invalid response';
      return 'missing' in page ? 404 : 200;
    }
    const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html' }, redirect: 'follow', signal: AbortSignal.timeout(20000) });
    // SiteGround возвращает 202 с переходом на CAPTCHA. Это не подтверждённая битая ссылка.
    if (r.status === 202 && /text\/html/.test(r.headers.get('content-type') ?? '')) {
      const body = await r.text();
      if (body.includes('/.well-known/sgcaptcha/')) return 'challenge 202';
    }
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
  const outcome = linkOutcome(r.status);
  if (outcome === 'ok') continue;
  if (outcome === 'unverifiable') { unverifiable++; console.log(`  ?  ${r.status} [${r.id}] ${r.url}`); }
  else { bad++; console.log(`  ✗  ${r.status} [${r.id}] ${r.url}`); }
}
console.log(`\n${res.length} links · ${bad} broken · ${unverifiable} unverifiable`);
process.exit(bad ? 1 : 0);
