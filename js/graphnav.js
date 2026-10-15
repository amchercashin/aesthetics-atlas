// js/graphnav.js
// Шаг по графу с клавиатуры. row(id) — строка стиля в древе: вертикальный порядок.
export function stepTarget(store, row, id, key) {
  const s = store.get(id);
  if (!s) return null;
  const known = (x) => !!x && !!store.get(x);
  const start = (x) => store.get(x).start;
  if (key === 'ArrowLeft') return known(s.parents[0]?.id) ? s.parents[0].id : null;
  if (key === 'ArrowRight') {
    // Только дети, для которых этот стиль — главный предок: вторичные связи идут через панель.
    const kids = s.children.map((c) => c.id).filter((x) => known(x) && store.get(x).parents[0]?.id === id);
    const d = (x) => Math.abs(row(x) - row(id));
    return kids.sort((a, b) => d(a) - d(b) || start(a) - start(b) || a.localeCompare(b))[0] ?? null;
  }
  if (key === 'ArrowUp' || key === 'ArrowDown') {
    const pid = s.parents[0]?.id;
    const pool = known(pid)
      ? store.get(pid).children.map((c) => c.id).filter((x) => known(x) && store.get(x).parents[0]?.id === pid)
      : store.styles.filter((x) => !x.parents.length).map((x) => x.id);
    const sorted = [...new Set(pool)].sort((a, b) => row(a) - row(b) || start(a) - start(b) || a.localeCompare(b));
    return sorted[sorted.indexOf(id) + (key === 'ArrowDown' ? 1 : -1)] ?? null;
  }
  return null;
}
