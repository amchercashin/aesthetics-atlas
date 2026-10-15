const smooth = (a, b, x) => {
  const p = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return p * p * (3 - 2 * p);
};

// Один ход масштаба для всех слоёв. Учитывает полную историю на широком окне.
export function mapDetail(k, fit, overview, regions = true) {
  if (!regions) return { level: 'styles', regions: 0, coast: 0, partMix: 0, seaNames: 0, partNames: 0, nodes: 1, labels: 1, edges: 1, aggregates: 0 };
  const ratio = k / Math.max(overview, fit * 2.2);
  return {
    level: ratio < 0.74 ? 'seas' : ratio < 1.25 ? 'parts' : 'styles',
    regions: 1 - smooth(0.96, 1.28, ratio),
    coast: smooth(0.96, 1.28, ratio),
    partMix: smooth(0.54, 0.9, ratio),
    seaNames: 1 - smooth(0.73, 0.79, ratio),
    partNames: smooth(0.73, 0.79, ratio) * (1 - smooth(1.02, 1.14, ratio)),
    nodes: smooth(1.03, 1.26, ratio),
    labels: smooth(1.06, 1.34, ratio),
    edges: smooth(1.2, 1.65, ratio),
    aggregates: 1 - smooth(0.68, 0.95, ratio),
  };
}

// Это сводка реальных связей карточек, а не генеалогия редакционных морей.
// Типы, направления и статусы сохраняются в records для раскрытия по клику.
export function aggregateMapLinks(records, groupOf, { mode = 'main', verifiedOnly = false } = {}) {
  if (mode === 'none') return [];
  const groups = new Map();
  for (const r of records) {
    if (mode !== 'all' && (!r.primary || r.kind !== 'history')) continue;
    if (verifiedOnly && (r.kind === 'comparison' || r.status !== 'verified')) continue;
    const from = groupOf(r.from), to = groupOf(r.to);
    if (!from || !to || from === to) continue;
    const [a, b] = [from, to].sort(), key = JSON.stringify([a, b]);
    if (!groups.has(key)) groups.set(key, { a, b, records: [] });
    groups.get(key).records.push(r);
  }
  return [...groups.values()].sort((a, b) => b.records.length - a.records.length || a.a.localeCompare(b.a) || a.b.localeCompare(b.b));
}
