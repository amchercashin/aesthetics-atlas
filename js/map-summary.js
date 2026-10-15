// Обзорная дуга должна читаться между названиями, а не целиком исчезать под
// масками. Подбираем береговые порты и изгиб в экранных координатах.
export function summaryCurve(a, b, boxes, bounds) {
  if (a.ports && b.ports) {
    const blocked = (p) => boxes.some((r) => p.x >= r[0] - 3 && p.x <= r[2] + 3 && p.y >= r[1] - 3 && p.y <= r[3] + 3);
    const ports = (r, other) => {
      const sorted = r.ports.filter((p) => !blocked(p) && p.x >= bounds[0] && p.x <= bounds[2] && p.y >= bounds[1] && p.y <= bounds[3])
        .sort((p, q) => (Math.hypot(p.x - other.x, p.y - other.y) + Math.hypot(p.x - r.x, p.y - r.y) * 0.6)
          - (Math.hypot(q.x - other.x, q.y - other.y) + Math.hypot(q.x - r.x, q.y - r.y) * 0.6));
      const chosen = [];
      for (const p of sorted) { if (chosen.every((q) => Math.hypot(p.x - q.x, p.y - q.y) >= 20)) chosen.push(p); if (chosen.length === 8) break; }
      return chosen;
    };
    const ap = ports(a, b), bp = ports(b, a);
    const pairs = ap.flatMap((p) => bp.map((q) => ({ p, q, cost: Math.hypot(p.x - q.x, p.y - q.y) + (Math.hypot(p.x - a.x, p.y - a.y) + Math.hypot(q.x - b.x, q.y - b.y)) * 0.25 })))
      .filter(({ p, q }) => Math.hypot(p.x - q.x, p.y - q.y) >= 40).sort((p, q) => p.cost - q.cost).slice(0, 8);
    let best = null;
    for (const { p, q, cost } of pairs) {
      if (best && Math.hypot(p.x - q.x, p.y - q.y) + cost >= best.score + best.portCost) continue;
      const curve = summaryCurve(p, q, boxes, bounds);
      if (curve && (!best || curve.score + cost < best.score + best.portCost)) best = { ...curve, portCost: cost, ports: [p, q] };
    }
    return best;
  }
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
  if (len < 30) return null;
  const samples = Math.max(48, Math.ceil(len / 5));
  const masked = (p) => boxes.some((r) => p.x >= r[0] && p.x <= r[2] && p.y >= r[1] && p.y <= r[3]);
  const inside = (p) => p.x >= bounds[0] && p.x <= bounds[2] && p.y >= bounds[1] && p.y <= bounds[3];
  let best = null;
  for (const bend of [...new Set([Math.min(70, len * 0.18), 80, 140, 220, 320])]) for (const sign of [1, -1]) {
    const c = { x: (a.x + b.x) / 2 - dy / len * bend * sign, y: (a.y + b.y) / 2 + dx / len * bend * sign };
    let length = 0, visible = 0, longest = 0, run = 0, gaps = 0, valid = true, prev = a, wasVisible = false;
    for (let i = 1; i <= samples; i++) {
      const t = i / samples, u = 1 - t;
      const p = { x: u * u * a.x + 2 * u * t * c.x + t * t * b.x, y: u * u * a.y + 2 * u * t * c.y + t * t * b.y };
      if (!inside(p)) { valid = false; break; }
      const ds = Math.hypot(p.x - prev.x, p.y - prev.y);
      length += ds;
      if (!masked(p)) { visible += ds; run += ds; longest = Math.max(longest, run); wasVisible = true; }
      else { if (wasVisible) gaps++; run = 0; wasVisible = false; }
      prev = p;
    }
    if (!valid || visible < 36 || longest < 28 || visible / length < 0.3) continue;
    const score = length + (length - visible) * 2 + gaps * 45;
    if (!best || score < best.score) best = { score, length, visible, longest,
      d: `M${a.x.toFixed(1)},${a.y.toFixed(1)}Q${c.x.toFixed(1)},${c.y.toFixed(1)} ${b.x.toFixed(1)},${b.y.toFixed(1)}` };
    // Первый изгиб — самый короткий. Если он целиком открыт, более длинные
    // варианты не улучшат ни длину, ни видимость.
    if (bend === Math.min(70, len * 0.18) && visible === length) return best;
  }
  return best;
}
