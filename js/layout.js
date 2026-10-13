// Раскладка генеалогии по строкам. X фиксирован временем; строку подбираем жадно:
// ближайшая к среднему ряду родителей свободная строка (барицентрическая эвристика).
// Узел занимает интервал от точки начала до max(конец подписи, конец полосы жизни).

export function layoutRows(nodes, x, { now = 2026, dot = 14, gap = 28 } = {}) {
  const sorted = [...nodes].sort((a, b) => a.start - b.start || a.tier - b.tier || a.id.localeCompare(b.id));
  const rows = []; // rows[r] = [[x0, x1], ...]
  const rowOf = new Map();
  const intervals = new Map();

  const free = (r, [a, b]) => !(rows[r] ?? []).some(([c, d]) => a < d && c < b);

  for (const n of sorted) {
    const x0 = x(n.start) - dot;
    const x1 = Math.max(x(n.start) + dot + n.width + gap, x(n.end ?? now) + gap / 2);
    const iv = [x0, x1];
    intervals.set(n.id, iv);

    let r;
    if (Number.isInteger(n.row)) r = n.row;
    else {
      const placed = (n.parents ?? []).map((p) => rowOf.get(p)).filter((v) => v !== undefined);
      const pref = placed.length ? placed.reduce((s, v) => s + v, 0) / placed.length : 0;
      r = null;
      for (let d = 0; d < 400 && r === null; d++) {
        const cands = d === 0 ? [Math.round(pref)] : [Math.round(pref) + d, Math.round(pref) - d];
        for (const c of cands) if (c >= 0 && free(c, iv)) { r = c; break; }
      }
      r ??= rows.length;
    }
    (rows[r] ??= []).push(iv);
    rowOf.set(n.id, r);
  }

  // Сжимаем пустые строки.
  const used = [...new Set(rowOf.values())].sort((a, b) => a - b);
  const remap = new Map(used.map((r, i) => [r, i]));
  const out = new Map();
  for (const [id, r] of rowOf) out.set(id, remap.get(r));
  return { rows: out, count: used.length, intervals };
}
