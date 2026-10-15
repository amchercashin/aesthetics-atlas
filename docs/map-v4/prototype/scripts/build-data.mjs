// Данные для прототипов туманностей: настоящая раскладка древа в px просторного обзора (масштаб 0,2).
import fs from 'node:fs';
const ROOT = '/Users/amchercashin/Developer/aesthetics-atlas';
const { createTimeScale, segmentWidths } = await import(ROOT + '/js/timescale.js');
const { layoutGenealogy } = await import(ROOT + '/js/layout.js');
const a = JSON.parse(fs.readFileSync(ROOT + '/data/atlas.json'));
const neb = JSON.parse(fs.readFileSync(process.argv[2]));
const S = a.styles, now = 2026, K = 0.2, ROWPX = 35, PADX = 60, PADY = 70;
const breaks = [...a.eras.map(e => e.start), now + 1];
const sc = createTimeScale(breaks, segmentWidths(breaks, S.map(s => s.start), { base: 60, perItem: 76, min: 170 }));
const R1 = { 1: 6, 2: 5, 3: 4.2 }, R2 = { 1: 15, 2: 13, 3: 11 }, CH = { 1: 8.6, 2: 7.4, 3: 6.8 };
const nameW = s => s.name.length * CH[s.tier];
const nodes = S.map(s => ({ id: s.id, start: s.start, end: s.end, tier: s.tier, width: R2[s.tier] + 8 + Math.max(nameW(s), 80), parents: s.parents.map(p => p.id), reach: ((s.tier === 1 ? 11 : R1[s.tier]) + 7 + nameW(s) + 12) / K }));
const tree = layoutGenealogy(nodes, sc.x, { now, dot: 16, gap: 22, tail: 28, longGap: 1200 });
const idx = new Map(S.map((s, i) => [s.id, i]));
const T = { evolved: 0, influence: 1, reaction: 2, revival: 3 };
const styles = S.map((s, i) => ({
  id: s.id, name: s.name, tier: s.tier, era: s.era, dates: s.dates || '',
  x: Math.round(PADX + sc.x(s.start) * K), y: PADY + tree.pos.get(s.id) * ROWPX,
  nebula: neb.FI[i] < 0 ? -1 : neb.FC[neb.FI[i]], part: neb.FI[i],
  palette: s.palette?.colors || [], accent: s.palette?.accent || null,
  parent: s.parents.length ? idx.get(s.parents[0].id) : -1,
  links: s.parents.map(p => [idx.get(p.id), T[p.type]]),
}));
const nebulae = neb.CN.map((name, c) => ({ name, color: neb.CC[c], parts: neb.FN.map((n, f) => ({ id: f, name: n, nebula: neb.FC[f] })).filter(p => p.nebula === c) }));
const parts = neb.FN.map((name, f) => ({ id: f, name, nebula: neb.FC[f] }));
const eras = a.eras.map((e, i) => ({ id: e.id, name: e.name, x0: Math.round(PADX + sc.segments[i].x0 * K), x1: Math.round(PADX + sc.segments[i].x1 * K) }));
const W = Math.round(PADX * 2 + sc.total * K), H = PADY * 2 + (tree.count - 1) * ROWPX;
const out = { W, H, rowPx: ROWPX, styles, nebulae, parts, eras };
fs.writeFileSync(process.argv[3], '// СГЕНЕРИРОВАНО build-data.mjs: раскладка древа сайта, туманности из Louvain + правки редактора\nwindow.ATLAS = ' + JSON.stringify(out) + ';\n');
console.log({ W, H, rows: tree.count, styles: styles.length, nebulae: nebulae.length, parts: parts.length });
