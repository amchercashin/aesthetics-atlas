// Кластеры стилей для «туманностей»: Louvain по графу связей с затуханием по времени и по строкам древа.
import fs from 'node:fs';
const D = JSON.parse(fs.readFileSync(process.argv[2]));
const N = D.N, n = N.length;
const TW = [1, 0.7, 0.4, 0.25]; // evolved, influence, reaction, revival
const cfg = { tau: +process.env.TAU || 1200, rho: +process.env.RHO || 6, gamma: +process.env.G || 1 };
const edges = [];
N.forEach((s, i) => s[6].forEach(([p, t]) => {
  const dx = Math.abs(N[p][1] - s[1]), dr = Math.abs(N[p][2] - s[2]);
  edges.push([p, i, TW[t] * Math.exp(-dx / cfg.tau) * Math.exp(-dr / cfg.rho)]);
}));
function louvainLevels(n, edges, gamma) {
  let nodeOf = [...Array(n).keys()]; // исходный узел -> узел текущего уровня
  let curN = n, curE = edges, levels = [];
  for (let pass = 0; pass < 10; pass++) {
    const adj = Array.from({ length: curN }, () => new Map()); let m2 = 0; const k = new Array(curN).fill(0);
    for (const [a, b, w] of curE) { adj[a].set(b, (adj[a].get(b) || 0) + w); adj[b].set(a, (adj[b].get(a) || 0) + w); k[a] += w; k[b] += w; m2 += 2 * w; }
    const com = [...Array(curN).keys()], tot = k.slice();
    let moved = true, any = false;
    while (moved) { moved = false;
      for (let v = 0; v < curN; v++) {
        const cv = com[v]; const nw = new Map();
        for (const [u, w] of adj[v]) if (u !== v) nw.set(com[u], (nw.get(com[u]) || 0) + w);
        tot[cv] -= k[v];
        let best = cv, bg = (nw.get(cv) || 0) - gamma * tot[cv] * k[v] / m2;
        for (const [c, w] of nw) { const g = w - gamma * tot[c] * k[v] / m2; if (g > bg + 1e-12) { bg = g; best = c; } }
        tot[best] += k[v]; if (best !== cv) { com[v] = best; moved = true; any = true; }
      } }
    if (!any) break;
    const ids = new Map(); com.forEach(c => { if (!ids.has(c)) ids.set(c, ids.size); });
    nodeOf = nodeOf.map(v => ids.get(com[v])); levels.push(nodeOf.slice());
    const agg = new Map(); for (const [a, b, w] of curE) { const ca = ids.get(com[a]), cb = ids.get(com[b]); if (ca === cb) continue; const key = ca < cb ? ca + ',' + cb : cb + ',' + ca; agg.set(key, (agg.get(key) || 0) + w); }
    curE = [...agg].map(([kk, w]) => { const [a, b] = kk.split(',').map(Number); return [a, b, w]; }); curN = ids.size;
  }
  return levels;
}
const levels = louvainLevels(n, edges, cfg.gamma);
// компактность на карте: точки в px обзора (x: 10000 -> ~2470 px, строка 35 px)
const P = N.map(s => [s[1] * 0.247, s[2] * 35]);
function hull(pts) { pts = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]); const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); const lo = [], up = []; for (const p of pts) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); } for (const p of pts.slice().reverse()) { while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); } return lo.slice(0, -1).concat(up.slice(0, -1)); }
function inside(h, p) { let c = false; for (let i = 0, j = h.length - 1; i < h.length; j = i++) { if ((h[i][1] > p[1]) !== (h[j][1] > p[1]) && p[0] < (h[j][0] - h[i][0]) * (p[1] - h[i][1]) / (h[j][1] - h[i][1]) + h[i][0]) c = !c; } return c; }
levels.forEach((lv, li) => {
  const groups = new Map(); lv.forEach((c, i) => { if (!groups.has(c)) groups.set(c, []); groups.get(c).push(i); });
  const gs = [...groups.values()].sort((a, b) => Math.min(...a.map(i => N[i][1])) - Math.min(...b.map(i => N[i][1])));
  let intr = 0, sizes = gs.map(g => g.length);
  console.log(`\n=== уровень ${li + 1}: ${gs.length} кластеров, размеры ${sizes.join(' ')}`);
  for (const g of gs) {
    let inn = 0; if (g.length >= 3) { const h = hull(g.map(i => P[i])); const set = new Set(g); for (let j = 0; j < n; j++) if (!set.has(j) && inside(h, P[j])) inn++; } intr += inn;
    const rows = g.map(i => N[i][2]);
    const top = g.slice().sort((a, b) => N[a][5] - N[b][5]).slice(0, 7).map(i => N[i][0]);
    if (g.length >= 2 || process.env.ALL) console.log(`[${g.length}] строки ${Math.min(...rows)}–${Math.max(...rows)}, чужих внутри ${inn}: ${top.join(', ')}${g.length > 7 ? '…' : ''}`);
  }
  console.log('всего чужих внутри оболочек:', intr, '| одиночек:', sizes.filter(s => s === 1).length);
});
fs.writeFileSync(process.argv[3] || '/dev/null', JSON.stringify(levels));
