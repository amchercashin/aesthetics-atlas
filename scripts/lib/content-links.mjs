import { worksOf } from './works.mjs';

// Отсутствие ответа или защита сайта не доказывают, что адрес исчез.
export function linkOutcome(status) {
  if (status === 200) return 'ok';
  if (status === 404 || status === 410 || status === 'soft 404') return 'broken';
  return 'unverifiable';
}

// Ссылки работ и источники утверждений нужны и при проверке одного YAML-файла.
export function contentLinks(styles, sources, { allSources = true } = {}) {
  const urls = new Map();
  const add = (id, url) => {
    if (!url) return;
    if (!urls.has(url)) urls.set(url, new Set());
    urls.get(url).add(id);
  };
  const used = new Set();
  const use = (ids) => { for (const id of ids == null ? [] : Array.isArray(ids) ? ids : [ids]) used.add(id); };
  for (const style of styles) {
    for (const link of style.links ?? []) add(style.id, link.url);
    for (const work of worksOf(style)) {
      add(style.id, work.reference);
      use(work.sources);
    }
    for (const evidence of style.evidence ?? []) used.add(evidence.source);
    if (style.termAttested?.source) used.add(style.termAttested.source);
    for (const item of [...(style.creators ?? []), ...(style.parents ?? []), ...(style.contexts ?? []), ...(style.compare ?? [])]) use(item.sources);
    use(style.admission?.sources);
  }
  for (const source of sources) if (allSources || used.has(source.id)) add(`source ${source.id}`, source.url);
  return [...urls].map(([url, ids]) => ({ id: [...ids].join(', '), url }));
}
