// Данные атласа и навигация по графу родословной.
import { NOW } from './format.js';

export async function loadAtlas(url = 'data/atlas.json') {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Не удалось загрузить данные (${res.status})`);
  return createStore(await res.json());
}

export function createStore(data) {
  const styles = [...data.styles].sort((a, b) => a.order - b.order);
  const byId = new Map(styles.map((s) => [s.id, s]));
  const eras = data.eras;
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
    get: (id) => byId.get(id),
    has: (id) => byId.has(id),
    era: (id) => eraById.get(id),
    eraColor: (id) => `var(--era-${id})`,
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
