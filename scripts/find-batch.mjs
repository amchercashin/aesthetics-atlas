// Пакетный подбор картинок: node scripts/find-batch.mjs batch.txt
// Строки: id | Заголовок статьи en.wikipedia | запрос для Commons (необязательно)
import fs from 'node:fs';
import { articleImages, searchCommons, resolveFiles, saveCache } from './lib/wikimedia.mjs';

const lines = fs.readFileSync(process.argv[2], 'utf8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
const SKIP = /(\.svg|\.ogg|\.webm|\.pdf|\.tif|\.djvu|\.stl|map|logo|icon|symbol|flag|commons-|wiki|question_book|edit-clear|padlock|ambox)/i;
for (const line of lines) {
  const [id, article, query] = line.split('|').map((s) => s?.trim());
  const refs = new Set();
  let lead = null;
  if (article) {
    try {
      const a = await articleImages('enwiki', article);
      lead = a.lead;
      for (const n of [a.lead, ...a.images].filter(Boolean)) if (!SKIP.test(n)) refs.add('enwiki:' + n.replace(/_/g, ' '));
    } catch (e) { console.log(`# ${id}: article error ${e.message}`); }
  }
  if (query) for (const n of await searchCommons(query, 8)) if (!SKIP.test(n)) refs.add(n);
  const list = [...refs].slice(0, 16);
  const res = await resolveFiles(list);
  console.log(`\n## ${id}  (lead: ${lead ?? '—'})`);
  for (const r of list) {
    const m = res.get(r);
    if (!m || m.missing || !/^image\//.test(m.mime ?? '') || m.width < 280) continue;
    const name = m.page?.includes('commons.wikimedia.org') ? r.replace(/^enwiki:/, '') : r;
    console.log(`  ${m.nonfree ? 'FAIR' : 'free'} ${m.width}×${m.height} ${String(m.license ?? '').slice(0, 14).padEnd(14)} ${name}  — ${String(m.artist ?? '').slice(0, 40)}`);
  }
}
saveCache();
