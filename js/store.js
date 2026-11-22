// Данные атласа и навигация по графу родословной.
// Поддерживает разделённую загрузку: лёгкий data/index.json при старте + ленивую подгрузку data/styles/<id>.json.
import { NOW } from './format.js';

function indexVersionFromDom() {
  return typeof document !== 'undefined'
    ? document.querySelector('meta[name="atlas-version"]')?.getAttribute('content') ?? ''
    : '';
}

export async function loadAtlas(url) {
  const domVersion = indexVersionFromDom();
  const target = url ?? (domVersion ? `data/index.json?v=${encodeURIComponent(domVersion)}` : 'data/index.json');
  const res = await fetch(target, domVersion ? {} : { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Не удалось загрузить данные (${res.status})`);
  const data = await res.json();
  return createStore(data, { baseUrl: 'data/styles', version: data.version || domVersion });
}

export function createStore(data, { baseUrl = 'data/styles', version = data.version ?? '', fetcher } = {}) {
  const styles = [...data.styles].sort((a, b) => a.order - b.order);
  const byId = new Map(styles.map((s) => [s.id, s]));
  // Старые адреса после разделения или переименования карточек ведут на новые.
  const former = new Map(styles.flatMap((s) => (s.formerIds ?? []).map((f) => [f, s.id])));
  const sources = new Map((data.sources ?? []).map((src) => [src.id, src]));
  const eras = data.eras;
  const nebulae = data.nebulae ?? [];
  const nebulaById = new Map(nebulae.map((n) => [n.id, n]));
  const eraById = new Map(eras.map((e, i) => [e.id, { ...e, index: i }]));
  const inflight = new Map();

  const walk = (id, key) => {
    const seen = new Set();
    const stack = [id];
    while (stack.length) {
      const cur = byId.get(stack.pop());
      for (const rel of cur?.[key] ?? []) if (!seen.has(rel.id) && byId.has(rel.id)) { seen.add(rel.id); stack.push(rel.id); }
    }
    return seen;
  };

  const resolve = (id) => (byId.has(id) ? id : former.get(id) ?? null);
  const isLoaded = (s) => Boolean(s?._loaded || (Array.isArray(s?.description) && Array.isArray(s?.evidence)));

  async function loadStyle(id) {
    const realId = resolve(id);
    if (!realId) return null;
    const s = byId.get(realId);
    if (isLoaded(s)) return s;
    if (inflight.has(realId)) return inflight.get(realId);

    const doFetch = fetcher ?? ((u) => fetch(u));
    const url = `${baseUrl}/${encodeURIComponent(realId)}.json${version ? `?v=${encodeURIComponent(version)}` : ''}`;
    const p = Promise.resolve(doFetch(url))
      .then((res) => {
        if (!res.ok) throw new Error(`Не удалось загрузить карточку ${realId} (${res.status})`);
        return res.json();
      })
      .then((full) => {
        for (const src of full.sources ?? []) sources.set(src.id, src);
        const { sources: _s, ...card } = full;
        Object.assign(s, card, { _loaded: true });
        return s;
      })
      .finally(() => { inflight.delete(realId); });

    inflight.set(realId, p);
    return p;
  }

  return {
    raw: data,
    styles,
    eras,
    builtAt: data.builtAt,
    version,
    stats: data.stats ?? null,
    resources: data.resources ?? [],
    promptSubjects: data.promptSubjects ?? [],
    trails: data.trails ?? [],
    get: (id) => byId.get(id) ?? byId.get(former.get(id)),
    has: (id) => byId.has(id) || former.has(id),
    resolve,
    loadStyle,
    source: (id) => sources.get(id) ?? null,
    get sources() { return [...sources.values()]; },
    era: (id) => eraById.get(id),
    eraColor: (id) => `var(--era-${id})`,
    nebulae,
    nebula: (id) => nebulaById.get(byId.get(id)?.nebula) ?? null,
    nebulaColor: (id) => nebulaById.get(byId.get(id)?.nebula)?.color ?? 'var(--ink-3)',
    ancestors: (id) => walk(id, 'parents'),
    descendants: (id) => walk(id, 'children'),
    // Главная линия: по первому родителю до корня.
    mainLine(id) {
      const line = [];
      const seen = new Set();
      let cur = byId.get(id);
      while (cur && !seen.has(cur.id)) {
        line.unshift(cur);
        seen.add(cur.id);
        cur = cur.parents[0] ? byId.get(cur.parents[0].id) : null;
      }
      return line;
    },
    prev: (id) => styles[byId.get(id)?.order - 1] ?? null,
    next: (id) => styles[byId.get(id)?.order + 1] ?? null,
    inEra: (eraId) => styles.filter((s) => s.era === eraId),
    styleOfDay() {
      const d = new Date();
      const seed = d.getFullYear() * 372 + d.getMonth() * 31 + d.getDate();
      const pool = styles.filter((s) => s.example.img);
      return pool[(seed * 2654435761) % pool.length >>> 0] ?? styles[0];
    },
    random: () => styles[Math.floor(Math.random() * styles.length)],
    now: NOW,
  };
}
