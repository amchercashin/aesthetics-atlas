// Генерация статических SEO/OpenGraph-страниц s/<id>/index.html, sitemap.xml и robots.txt.
// При открытии ссылки в мессенджере (Telegram, VK, Discord, X) краулер получает превью конкретного стиля
// с локальной обложкой, а браузер мгновенно переходит в SPA на #/s/<id>.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadBuiltAtlas } from './lib/load-atlas.mjs';

export const SITE_URL = 'https://amchercashin.github.io/aesthetics-atlas/';

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

function coverForOg(s) {
  const im = s.example?.img ?? s.gallery?.find((g) => g.img)?.img ?? s.corpus?.find((c) => c.img)?.img ?? null;
  const rel = im?.src?.[960] ?? im?.src?.[1280] ?? im?.src?.[500] ?? null;
  if (rel && !/\.svg$/i.test(rel)) {
    return { url: `${SITE_URL}${rel}`, w: im.w, h: im.h, rel };
  }
  return { url: `${SITE_URL}assets/og-cover.png`, w: 1200, h: 630, rel: 'assets/og-cover.png' };
}

function renderStylePage(s, targetId = s.id) {
  const title = s.shortTitle || s.name;
  const fullTitle = `${title} — Атлас эстетик`;
  const desc = String(s.summary ?? '').replace(/\s+/g, ' ').trim();
  const canonical = `${SITE_URL}s/${encodeURIComponent(targetId)}/`;
  const og = coverForOg(s);
  const hashTarget = `../../#/s/${encodeURIComponent(targetId)}`;
  const dates = s.dates || (s.end == null ? `${s.start} – наши дни` : `${s.start} – ${s.end}`);

  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(fullTitle)}</title>
  <meta name="description" content="${esc(desc)}">
  <link rel="canonical" href="${esc(canonical)}">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="Атлас эстетик">
  <meta property="og:title" content="${esc(fullTitle)}">
  <meta property="og:description" content="${esc(desc)}">
  <meta property="og:url" content="${esc(canonical)}">
  <meta property="og:image" content="${esc(og.url)}">
  ${og.w && og.h ? `<meta property="og:image:width" content="${og.w}">\n  <meta property="og:image:height" content="${og.h}">` : ''}
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(fullTitle)}">
  <meta name="twitter:description" content="${esc(desc)}">
  <meta name="twitter:image" content="${esc(og.url)}">
  <script>location.replace(${JSON.stringify(hashTarget)} + location.search);</script>
  <noscript><meta http-equiv="refresh" content="0;url=${esc(hashTarget)}"></noscript>
  <style>body{font-family:system-ui,-apple-system,sans-serif;max-width:680px;margin:48px auto;padding:0 20px;line-height:1.6;color:#1b1a18;background:#f2f1ee}a{color:#2f43b8}</style>
</head>
<body>
  <main>
    <h1>${esc(title)}</h1>
    ${s.subtitle ? `<p><strong>${esc(s.subtitle)}</strong></p>` : ''}
    <p>${esc(s.orig)} · ${esc(dates)}</p>
    <p>${esc(desc)}</p>
    ${s.traits?.length ? `<ul>${s.traits.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
    <p><a href="${esc(hashTarget)}">Открыть зал в Атласе эстетик →</a></p>
  </main>
</body>
</html>
`;
}

function writeIfChanged(dest, content) {
  if (fs.existsSync(dest) && fs.readFileSync(dest, 'utf8') === content) return false;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, content);
  return true;
}

export function generatePages(root, atlas) {
  const outRoot = path.join(root, 's');
  fs.mkdirSync(outRoot, { recursive: true });

  const keepDirs = new Set();
  let written = 0;

  for (const s of atlas.styles) {
    keepDirs.add(s.id);
    if (writeIfChanged(path.join(outRoot, s.id, 'index.html'), renderStylePage(s, s.id))) written++;
    for (const oldId of s.formerIds ?? []) {
      if (!oldId || keepDirs.has(oldId)) continue;
      keepDirs.add(oldId);
      if (writeIfChanged(path.join(outRoot, oldId, 'index.html'), renderStylePage(s, s.id))) written++;
    }
  }

  for (const entry of fs.readdirSync(outRoot, { withFileTypes: true })) {
    if (entry.isDirectory() && !keepDirs.has(entry.name)) {
      fs.rmSync(path.join(outRoot, entry.name), { recursive: true, force: true });
    }
  }

  const lastmod = atlas.builtAt || new Date().toISOString().slice(0, 10);
  const urls = [
    { loc: SITE_URL, priority: '1.0' },
    ...atlas.styles.map((s) => ({ loc: `${SITE_URL}s/${encodeURIComponent(s.id)}/`, priority: s.tier === 1 ? '0.9' : '0.7' })),
  ];
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${
    urls.map((u) => `  <url><loc>${esc(u.loc)}</loc><lastmod>${esc(lastmod)}</lastmod><priority>${u.priority}</priority></url>`).join('\n')
  }\n</urlset>\n`;
  writeIfChanged(path.join(root, 'sitemap.xml'), sitemap);

  const robots = `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}sitemap.xml\n`;
  writeIfChanged(path.join(root, 'robots.txt'), robots);

  return { totalPages: keepDirs.size, written, sitemapUrls: urls.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const atlas = loadBuiltAtlas(ROOT);
  const res = generatePages(ROOT, atlas);
  console.log(`Generated ${res.totalPages} static pages in s/ (${res.written} updated), sitemap.xml (${res.sitemapUrls} URLs) and robots.txt`);
}
