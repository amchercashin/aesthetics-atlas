// Поиск статей ru.wikipedia: node scripts/ru-wiki.mjs "запрос" ["запрос 2" ...]
import { fetchWithRetry } from './lib/wikimedia.mjs';
for (const q of process.argv.slice(2)) {
  const u = new URL('https://ru.wikipedia.org/w/api.php');
  for (const [k, v] of Object.entries({ action: 'query', list: 'search', srsearch: q, srlimit: '5', format: 'json', formatversion: '2' })) u.searchParams.set(k, v);
  const r = await fetchWithRetry(u.toString());
  console.log(`${q}: ${r.query.search.map((s) => s.title).join(' | ')}`);
}
