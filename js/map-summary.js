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

// Геометрия градиентной ленты-течения от главного берега моря A к берегу моря B:
// основание мягко утоплено внутрь акварели A (растворяется через прозрачность градиента 0→1),
// тело плавно сужается и переходит в чёткий вогнутый наконечник-стрелку на входе в B.
export function flowRibbon(a, b, { bendSign = 1, bendScale = 0.2, width = 10, tuck = 16, bounds = null } = {}) {
  const inside = (p) => !bounds || (p.x >= bounds[0] && p.x <= bounds[2] && p.y >= bounds[1] && p.y <= bounds[3]);
  const portsOf = (reg, other) => {
    const raw = (reg.ports ?? []).filter(inside);
    if (!raw.length) return [{ x: reg.x, y: reg.y }];
    // Отбираем точки берега, обращённые к парному морю, чтобы течение выходило с ближнего берега.
    const sorted = raw.slice().sort((p, q) =>
      (Math.hypot(p.x - other.x, p.y - other.y) + Math.hypot(p.x - reg.x, p.y - reg.y) * 0.25)
      - (Math.hypot(q.x - other.x, q.y - other.y) + Math.hypot(q.x - reg.x, q.y - reg.y) * 0.25));
    const chosen = [];
    for (const p of sorted) {
      if (chosen.every((q) => Math.hypot(p.x - q.x, p.y - q.y) >= 16)) chosen.push(p);
      if (chosen.length === 6) break;
    }
    return chosen;
  };
  const ap = portsOf(a, b), bp = portsOf(b, a);
  let bestPair = null;
  for (const p of ap) for (const q of bp) {
    const d = Math.hypot(q.x - p.x, q.y - p.y);
    if (d < 2) continue;
    const cost = d + (Math.hypot(p.x - a.x, p.y - a.y) + Math.hypot(q.x - b.x, q.y - b.y)) * 0.14;
    if (!bestPair || cost < bestPair.cost) bestPair = { p, q, d, cost };
  }
  if (!bestPair) {
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    if (d < 16) return null;
    bestPair = { p: { x: a.x, y: a.y }, q: { x: b.x, y: b.y }, d };
  }

  // Утапливаем основание внутрь исходного моря (к его центру), чтобы градиент плавно «вытекал» из воды.
  // Если моря почти касаются берегами (узкий пролив), утапливаем исток глубже, чтобы течение оставалось читаемым.
  const inDx = a.x - bestPair.p.x, inDy = a.y - bestPair.p.y;
  const inLen = Math.hypot(inDx, inDy);
  const minSpan = Math.max(30, width * 2.4);
  const needExtra = Math.max(0, minSpan - bestPair.d);
  const tuckDist = Math.min(Math.max(tuck, needExtra), inLen * 0.65);
  const p0 = inLen > 1
    ? { x: bestPair.p.x + (inDx / inLen) * tuckDist, y: bestPair.p.y + (inDy / inLen) * tuckDist }
    : bestPair.p;

  // Остриё стрелки чуть заходит на береговую линию приёмника (на 3–5 px), чтобы плотно стыковаться.
  const toDx = b.x - bestPair.q.x, toDy = b.y - bestPair.q.y;
  const toLen = Math.hypot(toDx, toDy);
  const p1 = toLen > 1
    ? { x: bestPair.q.x + (toDx / toLen) * Math.min(5, toLen * 0.25), y: bestPair.q.y + (toDy / toLen) * Math.min(5, toLen * 0.25) }
    : bestPair.q;

  const dx = p1.x - p0.x, dy = p1.y - p0.y, len = Math.hypot(dx, dy);
  if (len < 16) return null;
  const nx = -dy / len, ny = dx / len;
  const bend = Math.min(58, Math.max(12, len * bendScale)) * bendSign;
  const c = { x: (p0.x + p1.x) / 2 + nx * bend, y: (p0.y + p1.y) / 2 + ny * bend };

  const qPt = (t) => { const u = 1 - t; return { x: u * u * p0.x + 2 * u * t * c.x + t * t * p1.x, y: u * u * p0.y + 2 * u * t * c.y + t * t * p1.y }; };
  const qTan = (t) => {
    const tx = 2 * (1 - t) * (c.x - p0.x) + 2 * t * (p1.x - c.x);
    const ty = 2 * (1 - t) * (c.y - p0.y) + 2 * t * (p1.y - c.y);
    const l = Math.hypot(tx, ty) || 1;
    return { x: tx / l, y: ty / l };
  };

  // Пропорции ленты и вогнутого наконечника-стрелки.
  const headLen = Math.min(len * 0.34, Math.max(11, width * 1.4));
  const headHalfW = Math.max(5.5, Math.min(13, width * 0.78));
  const tBarb = Math.max(0.5, 1 - headLen / len);
  const tNeck = Math.max(tBarb + 0.03, Math.min(0.92, 1 - (headLen * 0.72) / len));
  const steps = 20;
  const left = [], right = [];
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    const t = f * tNeck;
    const p = qPt(t), tan = qTan(t);
    const rnx = -tan.y, rny = tan.x;
    // Мягкий раструб у истока (внутри моря) → изящное сужение к шейке стрелки.
    const ease = 1 - f * f * (3 - 2 * f);
    const flare = Math.pow(1 - f, 3) * 0.38;
    const hw = width * (0.21 + 0.34 * ease + flare);
    left.push([p.x + rnx * hw, p.y + rny * hw]);
    right.push([p.x - rnx * hw, p.y - rny * hw]);
  }
  const pBarb = qPt(tBarb), tB = qTan(tBarb);
  const bnx = -tB.y, bny = tB.x;
  const barbL = [pBarb.x + bnx * headHalfW, pBarb.y + bny * headHalfW];
  const barbR = [pBarb.x - bnx * headHalfW, pBarb.y - bny * headHalfW];
  const tip = [p1.x, p1.y];

  const poly = [...left, barbL, tip, barbR, ...right.reverse()];
  const fmt = (pt) => `${pt[0].toFixed(1)},${pt[1].toFixed(1)}`;
  const ribbonD = 'M' + poly.map(fmt).join('L') + 'Z';
  // Контрастный шеврон по передним кромкам наконечника — делает направление мгновенно читаемым.
  const chevronD = `M${fmt(barbL)}L${fmt(tip)}L${fmt(barbR)}`;
  const centerD = `M${p0.x.toFixed(1)},${p0.y.toFixed(1)}Q${c.x.toFixed(1)},${c.y.toFixed(1)} ${p1.x.toFixed(1)},${p1.y.toFixed(1)}`;
  return { ribbonD, chevronD, centerD, p0, p1, c, len };
}
