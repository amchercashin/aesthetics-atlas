// Раскладка генеалогии по строкам. X фиксирован временем; строку подбираем жадно:
// ближайшая к предпочтительной свободная строка (по умолчанию — средний ряд родителей).
// Узел занимает интервал от точки начала до max(конец подписи, конец полосы жизни).

export function layoutRows(nodes, x, { now = 2026, dot = 14, gap = 28, prefer = null } = {}) {
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
      let pref = prefer ? prefer(n, rowOf, rows.length) : null;
      if (pref == null) {
        const placed = (n.parents ?? []).map((p) => rowOf.get(p)).filter((v) => v !== undefined);
        pref = placed.length ? placed.reduce((s, v) => s + v, 0) / placed.length : 0;
      }
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

// Раскладка по полосам (областям). Внутри полосы стиль тянется к строке своего главного родителя;
// если родитель живёт в другой полосе — к краю, обращённому к ней (меньше пересечений полос).
export function layoutLanes(nodes, x, { lanes, laneOf, now = 2026, dot = 14, gap = 28 } = {}) {
  const laneIndex = new Map(lanes.map((l, i) => [l, i]));
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const pos = new Map();
  const counts = [];
  const intervals = new Map();
  lanes.forEach((lane, li) => {
    const mine = nodes.filter((n) => laneOf(n) === lane);
    const prefer = (n, rowOf, rowsSoFar) => {
      const main = n.parents?.[0] ? byId.get(n.parents[0]) : null;
      if (!main) return 0;
      const pl = laneIndex.get(laneOf(main));
      if (pl === li) return rowOf.get(main.id) ?? 0;
      return pl < li ? 0 : rowsSoFar;
    };
    const res = layoutRows(mine, x, { now, dot, gap, prefer });
    for (const [id, row] of res.rows) pos.set(id, { lane: li, row });
    for (const [id, iv] of res.intervals) intervals.set(id, iv);
    counts.push(res.count);
  });
  return { pos, counts, intervals };
}

// ---------------------------------------------------------------------------
// Родословное древо на оси времени (карта, версия 3).
// X задан временем; строка подбирается так, чтобы потомок был рядом с главным предком (parents[0]).
// Обход в ширину от корней, ветви расходятся вверх и вниз от середины, затем несколько проходов
// уплотнения. Раскладка детерминирована и зависит только от дат, ширины подписей и parents[0]:
// фильтры, наведение и слой сопоставлений её не меняют.
//   nodes: { id, start, end, tier, width, parents: [id, …] }
//   width — ширина подписи в px при рабочем масштабе (k = 1).
//   Строка занята точкой, подписью и стволом — до места, где от него отходит последний близкий
//   потомок. Длительность стиля строку не занимает: на карте её нет.
//   longGap — разрыв (px), после которого связь рисуется отростками и не занимает строку предка.
//   reach (у узла, необязательно) — сколько px строки занять от точки: место под подпись на обзоре,
//   где масштаб мельче рабочего, а подпись того же размера.
export function layoutGenealogy(nodes, x, { now = 2026, dot = 16, gap = 22, tail = 26, passes = 6, center = 0.08, longGap = Infinity } = {}) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const cmp = (a, b) => a.start - b.start || a.tier - b.tier || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const primary = (n) => (n.parents?.[0] && byId.has(n.parents[0]) && n.parents[0] !== n.id ? n.parents[0] : null);
  const kids = new Map(nodes.map((n) => [n.id, []]));
  const roots = [];
  for (const n of nodes) { const p = primary(n); if (p) kids.get(p).push(n); else roots.push(n); }
  for (const k of kids.values()) k.sort(cmp);
  roots.sort(cmp);

  // Занятый интервал: точка, подпись и ствол плюс «хвост», чтобы чужой стиль на той же строке
  // не выглядел продолжением ствола.
  const intervals = new Map();
  for (const n of nodes) {
    const xs = x(n.start), xe = x(n.end ?? now);
    let end = xs;
    for (const k of kids.get(n.id)) { const xk = x(k.start); if (xk - xe <= longGap) end = Math.max(end, xk - dot); }
    intervals.set(n.id, [xs - dot, Math.max(xs + dot + n.width + gap, end + tail, xs + (n.reach ?? 0))]);
  }

  // Обход в ширину; циклы и висячие ссылки не ломают обход.
  const seq = [];
  const seen = new Set();
  const queue = [...roots];
  while (queue.length) {
    const n = queue.shift();
    if (seen.has(n.id)) continue;
    seen.add(n.id); seq.push(n);
    queue.push(...kids.get(n.id));
  }
  for (const n of [...nodes].sort(cmp)) if (!seen.has(n.id)) seq.push(n); // на случай цикла в данных

  const rows = new Map(); // row → [[x0, x1, id]]
  const rowOf = new Map();
  const free = (r, [a, b], skip) => !(rows.get(r) ?? []).some(([c, d, id]) => id !== skip && a < d && c < b);
  const put = (r, id) => { if (!rows.has(r)) rows.set(r, []); rows.get(r).push([...intervals.get(id), id]); rowOf.set(id, r); };
  const take = (r, id) => rows.set(r, rows.get(r).filter((e) => e[2] !== id));

  // Корни раскладываются от середины поочерёдно вверх и вниз, потомки — у строки предка.
  // Направление чередуется между братьями, чтобы древо росло в обе стороны, а не вниз по диагонали.
  const sib = new Map();
  for (const k of [roots, ...kids.values()]) k.forEach((n, i) => sib.set(n.id, i));
  for (const n of seq) {
    const iv = intervals.get(n.id);
    const p = primary(n);
    const pref = p && rowOf.has(p) ? rowOf.get(p) : 0;
    const up = sib.get(n.id) % 2 === 1;
    let r = null;
    for (let d = 0; r === null; d++) {
      const order = d === 0 ? [pref] : up ? [pref - d, pref + d] : [pref + d, pref - d];
      for (const c of order) if (free(c, iv)) { r = c; break; }
    }
    put(r, n.id);
  }

  // Уплотнение: строка, ближайшая к главному предку и прямым потомкам.
  const cost = (n, r) => {
    let c = 0;
    const p = primary(n);
    if (p) c += Math.abs(r - rowOf.get(p));
    for (const k of kids.get(n.id)) c += Math.abs(r - rowOf.get(k.id));
    return c;
  };
  // Лёгкое притяжение к середине холста уравновешивает композицию: редкие ранние эпохи
  // не прижимаются к верху, оставляя пустой низ.
  for (let it = 0; it < passes; it++) {
    let moved = 0;
    const span = [...rows.keys()].filter((r) => rows.get(r).length);
    const lo = Math.min(...span) - 1, hi = Math.max(...span) + 1;
    const mid = (lo + hi) / 2;
    const total = (n, r) => cost(n, r) + center * Math.abs(r - mid);
    for (const n of seq) {
      const iv = intervals.get(n.id);
      const cur = rowOf.get(n.id);
      let best = cur, bc = total(n, cur);
      for (let r = lo; r <= hi; r++) {
        if (r === cur || !free(r, iv, n.id)) continue;
        const c = total(n, r);
        if (c < bc - 1e-9) { bc = c; best = r; }
      }
      if (best !== cur) { take(cur, n.id); put(best, n.id); moved++; }
    }
    if (!moved) break;
  }

  const used = [...new Set(rowOf.values())].sort((a, b) => a - b);
  const remap = new Map(used.map((r, i) => [r, i]));
  const pos = new Map([...rowOf].map(([id, r]) => [id, remap.get(r)]));
  return { pos, count: used.length, intervals, primary: new Map(nodes.map((n) => [n.id, primary(n)])) };
}

// Трассировка ветвей древа в обход подписей.
// Ветвь: от строки предка по вертикали в точке jx до строки потомка и по ней — к точке потомка.
// jx подбирается так, чтобы вертикаль и горизонтальные отрезки не проходили через подписи и точки
// других стилей (в координатах рабочего масштаба). Возвращает Map(childId → { jx, cost }).
//   scale — наименьший масштаб камеры, при котором коридоры должны оставаться чистыми:
//   подписи имеют постоянный размер в пикселях, поэтому при отдалении занимают больше времени.
// extent(n) — сколько px строки справа от точки занимает подпись (по умолчанию — подпись при масштабе scale).
export function routeBranches(nodes, x, lay, { now = 2026, dot = 16, labelGap = 8, step = 4, near = 240, scale = 1, extent = null } = {}) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const ext = extent ?? ((n) => (dot + labelGap + n.width) / scale);
  // Препятствия по строкам: точка + подпись каждого стиля.
  const boxes = new Map();
  for (const n of nodes) {
    const r = lay.pos.get(n.id);
    const xs = x(n.start);
    if (!boxes.has(r)) boxes.set(r, []);
    boxes.get(r).push([xs - dot / scale, xs + ext(n), n.id]);
  }
  const hitPoint = (r, px, skip) => (boxes.get(r) ?? []).some(([a, b, id]) => !skip.has(id) && px > a && px < b);
  const hitSpan = (r, a0, a1, skip) => (boxes.get(r) ?? []).some(([a, b, id]) => !skip.has(id) && a0 < b && a < a1);
  const out = new Map();
  for (const n of nodes) {
    const pid = lay.primary.get(n.id);
    if (!pid) continue;
    const p = byId.get(pid);
    const rp = lay.pos.get(pid), rc = lay.pos.get(n.id);
    const xc = x(n.start), xps = x(p.start), xpe = x(p.end ?? now);
    if (rp === rc) { out.set(n.id, { jx: null, cost: 0 }); continue; } // продолжение на той же строке
    const skip = new Set([pid, n.id]);
    const right = xc - dot * 0.75;
    const left = Math.min(right, xps);
    const cands = [];
    for (let v = right; v >= Math.max(left, right - near); v -= step) cands.push(v);
    for (let v = right - near; v >= left; v -= step * 6) cands.push(v);
    cands.push(left);
    const lo = Math.min(rp, rc), hi = Math.max(rp, rc);
    let best = null;
    for (const jx of cands) {
      let c = 0;
      for (let r = lo + 1; r < hi; r++) if (hitPoint(r, jx, skip)) c++;
      if (hitSpan(rc, jx, xc - dot, skip)) c++;                    // горизонталь к потомку
      if (jx > xpe && hitSpan(rp, xpe, jx, skip)) c++;              // продолжение после конца предка
      if (jx > xps && jx < xps + ext(p) && jx !== xps) c += 0.5; // ветвь из-под подписи предка
      const score = c * 10000 + (right - jx);
      if (!best || score < best.score) best = { jx, cost: c, score };
      if (c === 0) break;
    }
    out.set(n.id, { jx: best.jx, cost: best.cost });
  }
  return out;
}
