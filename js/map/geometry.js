// Геометрия и пространственная сетка карты: чистые помощники без состояния сцены.
const NS = 'http://www.w3.org/2000/svg';
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export function el(name, attrs = {}, parent) {
  const n = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  parent?.appendChild(n);
  return n;
}

// Пространственная сетка для проверки наложения подписей: быстро и на сотнях стилей.
export function spatialGrid(cell = 96) {
  const m = new Map();
  const keys = (b) => {
    const out = [];
    for (let i = Math.floor(b[0] / cell); i <= Math.floor(b[1] / cell); i++) {
      for (let j = Math.floor(b[2] / cell); j <= Math.floor(b[3] / cell); j++) out.push(`${i},${j}`);
    }
    return out;
  };
  return {
    hit(b, id) {
      for (const k of keys(b)) {
        for (const o of m.get(k) ?? []) if (o[4] !== id && b[0] < o[1] && o[0] < b[1] && b[2] < o[3] && o[2] < b[3]) return true;
      }
      return false;
    },
    add(b) {
      for (const k of keys(b)) {
        if (!m.has(k)) m.set(k, []);
        m.get(k).push(b);
      }
    },
  };
}

// Геометрия ветви древа: по строке предка → поворот → вертикаль в коридоре jx → поворот → к точке потомка.
export function branchPath(e, { X, XR, now }) {
  const p = e.par, c = e.ch;
  const xc = X(c.s.start) - c.r - 1, yc = c.y, yp = p.y;
  const xps = X(p.s.start), xpe = X(p.s.end ?? now);
  if (Math.abs(yc - yp) < 0.5) {
    e.trunkTo = Math.min(xpe, xc);
    return `M${Math.min(xpe, xc).toFixed(1)},${yp.toFixed(1)}H${xc.toFixed(1)}`;
  }
  let jx = e.jx != null ? XR(e.jx) : xc - 10;
  jx = clamp(jx, xps, xc - 2);
  const dir = yc > yp ? 1 : -1;
  const rad = Math.max(0, Math.min(8, Math.abs(yc - yp) / 2, xc - jx));
  let d;
  if (jx > xpe + 1) {
    const r1 = Math.min(rad, jx - xpe);
    d = `M${xpe.toFixed(1)},${yp.toFixed(1)}H${(jx - r1).toFixed(1)}Q${jx.toFixed(1)},${yp.toFixed(1)} ${jx.toFixed(1)},${(yp + dir * r1).toFixed(1)}`;
  } else if (jx - xps < p.r + 1) {
    jx = xps;
    d = `M${xps.toFixed(1)},${(yp + dir * (p.r + 1)).toFixed(1)}`;
  } else if (p.lbox && jx > p.lbox[0] && jx < p.lbox[1] && ((dir > 0 ? p.lbox[3] : p.lbox[2]) - yp) * dir > 0) {
    d = `M${jx.toFixed(1)},${(dir > 0 ? p.lbox[3] : p.lbox[2]).toFixed(1)}`;
  } else d = `M${jx.toFixed(1)},${yp.toFixed(1)}`;
  d += `V${(yc - dir * rad).toFixed(1)}Q${jx.toFixed(1)},${yc.toFixed(1)} ${(jx + rad).toFixed(1)},${yc.toFixed(1)}H${xc.toFixed(1)}`;
  e.trunkTo = Math.min(jx, xpe);
  return d;
}

// Оборванная далёкая связь: короткий отросток с кружком на входе в потомка.
export function stubPath(e, { X }) {
  const c = e.ch;
  const xc = X(c.s.start) - c.r - 1, yc = c.y;
  const L = 22, o = 2.4;
  return `M${(xc - L - o).toFixed(1)},${yc.toFixed(1)}a${o},${o} 0 1,0 ${2 * o},0a${o},${o} 0 1,0 ${-2 * o},0M${(xc - L + o).toFixed(1)},${yc.toFixed(1)}H${xc.toFixed(1)}`;
}

export function arcPath(e, { X, now }) {
  const p = e.par, c = e.ch;
  const xc = X(c.s.start) - c.r - 1, yc = c.y, yp = p.y;
  const xps = X(p.s.start), xpe = X(p.s.end ?? now);
  const sx = clamp(Math.min(xc - 24, xpe), xps, xc - 12);
  const k1 = Math.max(16, (xc - sx) * 0.5);
  return `M${sx.toFixed(1)},${yp.toFixed(1)}C${(sx + k1).toFixed(1)},${yp.toFixed(1)} ${(xc - k1).toFixed(1)},${yc.toFixed(1)} ${xc.toFixed(1)},${yc.toFixed(1)}`;
}

export function durPath(n, { X, now }) {
  const x0 = X(n.s.start), x1 = X(n.s.end ?? now);
  return x1 > x0 + 2 ? `M${x0.toFixed(1)},${n.y.toFixed(1)}H${x1.toFixed(1)}` : '';
}
