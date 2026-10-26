// Цельность морей и частей карты: вставить в консоль браузера на #/map после загрузки (или выполнить через CDP).
// По маскам областей считает острова (связные куски заметного размера) каждого моря и каждой части
// и проверяет, что все карточки области лежат в одном острове. Ещё — карточки, окружённые чужим морем.
// Обёрнуто в async-функцию, результат — объект; split пустой, если ничего не разорвано.
(async () => {
const neb = await import('/aesthetics-atlas/js/nebulae.js?v=years-only-1');
const ml = await import('/aesthetics-atlas/js/map-layout.js?v=seas-1');
const { fmtDates } = await import('/aesthetics-atlas/js/format.js?v=regional-01');
const a = await fetch('/aesthetics-atlas/data/atlas.json').then((r) => r.json());
// Та же раскладка, что строит карта: ширины подписей — тем же canvas.
const FONT = { 1: '600 16px Spectral', 2: '500 14px "Golos Text"', 3: '400 13px "Golos Text"' }, DATE_FONT = '400 11px "Golos Text"';
const cv = document.createElement('canvas').getContext('2d');
const measure = (f, t) => { cv.font = f; return cv.measureText(t).width; };
const now = new Date().getFullYear();
const sc = ml.mapTimeScale(a.eras, a.styles, now);
const nodes = ml.mapLayoutNodes(a.styles, (s) => ({ w: measure(FONT[s.tier], s.name), wd: measure(DATE_FONT, fmtDates(s)) }));
const lay = ml.layoutMap(nodes, sc.x, now);
// Координаты поля туманностей (map.js: NEB_PADX + x·OV_K, NEB_PADY + yRef·SY_OV).
const at = (s) => [60 + sc.x(s.start) * ml.OV_K, 70 + (26 + lay.pos.get(s.id) * 44 + 22) * 0.8];
const cam = { kx: 1, ky: 1, ox: 0, oy: 0 };
const partIds = a.nebulae.flatMap((n) => n.parts.map((p) => p.id));
const seaKey = new Map(a.nebulae.map((n, i) => [n.id, `neb:${i}`]));
const split = [], enclosed = [];
const islands = { neb: 0, part: 0 };
for (const kind of ['neb', 'part']) {
  for (let i = 0; i < (kind === 'neb' ? a.nebulae.length : partIds.length); i++) {
    const r = neb.nebulaRegion(`${kind}:${i}`);
    if (!r) continue;
    const members = a.styles.filter((s) => (kind === 'neb' ? s.nebula === a.nebulae[i].id : s.part === partIds[i]));
    const [x0, y0, x1, y1] = r.box, S = 2, W = Math.ceil((x1 - x0) / S) + 1, H = Math.ceil((y1 - y0) / S) + 1;
    const M = new Uint8Array(W * H);
    for (let j = 0; j < H; j++) for (let k = 0; k < W; k++) M[j * W + k] = neb.nebulaRegionAt(x0 + k * S, y0 + j * S, cam, kind === 'part') === `${kind}:${i}` ? 1 : 0;
    const lab = new Int32Array(W * H).fill(-1), sizes = [];
    for (let s = 0; s < W * H; s++) {
      if (!M[s] || lab[s] >= 0) continue;
      const id = sizes.length, st = [s]; let n = 0; lab[s] = id;
      while (st.length) {
        const q = st.pop(); n++;
        const qx = q % W, qy = (q / W) | 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = qx + dx, ny = qy + dy, t = ny * W + nx;
          if (nx >= 0 && ny >= 0 && nx < W && ny < H && M[t] && lab[t] < 0) { lab[t] = id; st.push(t); }
        }
      }
      sizes.push(n);
    }
    const big = sizes.filter((n) => n >= 45).length; // мельче 45 узлов — брызги, nebulae.js их убирает
    islands[kind] += big;
    // Остров карточки — ближайший к её точке узел маски (под чужой точкой маска прорезана).
    const comps = new Set();
    for (const s of members) {
      const [px, py] = at(s);
      let found = -1;
      for (let rad = 0; rad <= 14 && found < 0; rad += 2) for (let d = 0; d < 16 && found < 0; d++) {
        const qx = Math.round((px + rad * Math.cos(d * Math.PI / 8) - x0) / S), qy = Math.round((py + rad * Math.sin(d * Math.PI / 8) - y0) / S);
        if (qx >= 0 && qy >= 0 && qx < W && qy < H && lab[qy * W + qx] >= 0) found = lab[qy * W + qx];
      }
      comps.add(found);
    }
    if (big > 1 || comps.size > 1) split.push(`${kind === 'neb' ? 'море' : 'часть'} «${r.name}»: островов ${big}, карточки в ${comps.size}`);
  }
}
// Карточка, вокруг которой почти со всех сторон чужое море, — «остров внутри чужого моря».
for (const s of a.styles) {
  const [x, y] = at(s), own = s.nebula ? seaKey.get(s.nebula) : null;
  let foreign = 0;
  for (let k = 0; k < 12; k++) { const key = neb.nebulaRegionAt(x + 26 * Math.cos(k * Math.PI / 6), y + 20 * Math.sin(k * Math.PI / 6), cam); if (key && key !== own) foreign++; }
  if (foreign >= 3) enclosed.push(`${s.id}: чужое море с ${foreign} из 12 сторон`);
}
// Касания: узлы масок разных морей ближе NEAR px поля (сетка CS = 2 px). Берег рисуется тонкой линией,
// поэтому вплотную подошедшие моря выглядят слитыми.
const NEAR = 6, S = 2;
const W = a.nebulae.length ? Math.ceil(Math.max(...a.nebulae.map((_, i) => neb.nebulaRegion(`neb:${i}`)?.box[2] ?? 0)) / S) + 4 : 0;
const H = Math.ceil(Math.max(...a.nebulae.map((_, i) => neb.nebulaRegion(`neb:${i}`)?.box[3] ?? 0)) / S) + 4;
const L = new Int16Array(W * H).fill(-1);
for (let i = 0; i < a.nebulae.length; i++) {
  const r = neb.nebulaRegion(`neb:${i}`); if (!r) continue;
  const [x0, y0, x1, y1] = r.box;
  for (let y = Math.max(0, Math.floor(y0 / S)); y <= Math.ceil(y1 / S) && y < H; y++) for (let x = Math.max(0, Math.floor(x0 / S)); x <= Math.ceil(x1 / S) && x < W; x++) {
    if (neb.nebulaRegionAt(x * S, y * S, cam) === `neb:${i}`) L[y * W + x] = i;
  }
}
const touching = new Map(), D = Math.ceil(NEAR / S);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const p = L[y * W + x]; if (p < 0) continue;
  for (let dy = 0; dy <= D; dy++) for (let dx = -D; dx <= D; dx++) {
    if (dy === 0 && dx <= 0) continue;
    const xx = x + dx, yy = y + dy; if (xx < 0 || xx >= W || yy >= H) continue;
    const q = L[yy * W + xx]; if (q < 0 || q === p) continue;
    const d = Math.hypot(dx, dy) * S; if (d > NEAR) continue;
    const key = [a.nebulae[Math.min(p, q)].name, a.nebulae[Math.max(p, q)].name].join(' × ');
    touching.set(key, Math.min(touching.get(key) ?? Infinity, d));
  }
}
return { rows: lay.count, islands, split, enclosed, touching: [...touching].map(([k, d]) => `${k}: ${d.toFixed(1)} px`) };
})();
