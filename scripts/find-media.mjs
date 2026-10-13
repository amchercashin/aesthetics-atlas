// Подбор картинок: npm run find -- "запрос"            → поиск по Commons
//                  npm run find -- --article "Title"   → картинки статьи en.wikipedia (вкл. fair use)
//                  npm run find -- --ru "Заголовок"     → картинки статьи ru.wikipedia
import { searchCommons, articleImages, resolveFiles, saveCache } from './lib/wikimedia.mjs';

const args = process.argv.slice(2);
const mode = args[0]?.startsWith('--') ? args.shift() : '--search';
const q = args.join(' ');
let names = [];
if (mode === '--search') names = await searchCommons(q, 12);
else {
  const site = mode === '--ru' ? 'ruwiki' : 'enwiki';
  const { lead, images } = await articleImages(site, q);
  console.log('lead image:', lead);
  names = images.filter((n) => !/\.(svg)$/i.test(n) || /logo/i.test(n) === false).slice(0, 25);
}
const refs = names.map((n) => (mode === '--search' ? n : 'enwiki:' + n));
const res = await resolveFiles(refs);
saveCache();
for (const r of refs) {
  const m = res.get(r);
  if (!m || m.missing) { console.log('  ✗', r); continue; }
  if (!/^image\//.test(m.mime ?? '')) continue;
  console.log(`  ${m.nonfree ? 'FAIR' : 'free'} ${String(m.width).padStart(5)}×${String(m.height).padEnd(5)} ${m.license ?? '?'} | ${r} | ${m.artist ?? ''}`.slice(0, 220));
}
