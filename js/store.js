// Данные атласа и навигация по графу родословной.
import { NOW } from './format.js?v=audit';

export async function loadAtlas(url = 'data/atlas.json') {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Не удалось загрузить данные (${res.status})`);
  return createStore(await res.json());
}

export function createStore(data) {
  const styles = [...data.styles].sort((a, b) => a.order - b.order);
  const byId = new Map(styles.map((s) => [s.id, s]));
  // Старые адреса после разделения или переименования карточек ведут на новые.
  const former = new Map(styles.flatMap((s) => (s.formerIds ?? []).map((f) => [f, s.id])));
  const sources = new Map((data.sources ?? []).map((src) => [src.id, src]));
  const eras = data.eras;
  const nebulae = data.nebulae ?? [];
  const nebulaById = new Map(nebulae.map((n) => [n.id, n]));
  const eraById = new Map(eras.map((e, i) => [e.id, { ...e, index: i }]));

  const walk = (id, key) => {
    const seen = new Set();
    const stack = [id];
    while (stack.length) {
      const cur = byId.get(stack.pop());
      for (const rel of cur?.[key] ?? []) if (!seen.has(rel.id) && byId.has(rel.id)) { seen.add(rel.id); stack.push(rel.id); }
    }
    return seen;
  };

  return {
    raw: data,
    styles,
    eras,
    builtAt: data.builtAt,
    resources: data.resources ?? [],
    get: (id) => byId.get(id) ?? byId.get(former.get(id)),
    has: (id) => byId.has(id) || former.has(id),
    resolve: (id) => (byId.has(id) ? id : former.get(id) ?? null),
    source: (id) => sources.get(id) ?? null,
    sources: [...sources.values()],
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
