// Геометрическая проверка карты: вставить в консоль браузера на #/map (или выполнить через CDP).
// Считает подписи стилей, наложения подписей и места, где линия связи проходит через текст подписи
// (и сколько из них закрыто подложкой). Обёрнуто в async-функцию, результат — объект.
(async () => {
// Сравнимая проверка для старой и новой карты: все подписи стилей и все видимые линии связей,
// без исключения подписей концов связи (в старой разметке концы неизвестны).
const vis = (el) => { for (let e = el; e && e.tagName !== 'svg'; e = e.parentElement) { const cs = getComputedStyle(e); if (e.matches('text') && +cs.fillOpacity < 0.15) return false; if (cs.display === 'none' || +cs.opacity < 0.15) return false; } return true; };
const edgePaths = [...document.querySelectorAll('.map-svg .m-edges path:not(.case), .map-svg .m-cmp path, .map-svg .m-contexts path, .map-svg .m-summary path:not(.summary-case), .map-svg .m-life path, .map-svg .m-trail path')];
const maskBoxes = new Map(edgePaths.map((p) => {
  const g = p.closest('[mask]'); if (!g) return [p, []];
  const id = g.getAttribute('mask').match(/#([^)]*)/)?.[1], mask = id && document.getElementById(id);
  if (!mask) return [p, []];
  const m = g.getScreenCTM();
  return [p, [...mask.querySelectorAll('rect[fill="black"]')].map((r) => {
    const a = new DOMPoint(r.x.baseVal.value, r.y.baseVal.value).matrixTransform(m);
    const b = new DOMPoint(r.x.baseVal.value + r.width.baseVal.value, r.y.baseVal.value + r.height.baseVal.value).matrixTransform(m);
    return { x0: Math.min(a.x, b.x), x1: Math.max(a.x, b.x), y0: Math.min(a.y, b.y), y1: Math.max(a.y, b.y) };
  })];
}));
const masked = (p, x, y) => maskBoxes.get(p).some((r) => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1);
const texts = [...document.querySelectorAll('.map-svg .m-nodes text, .map-svg .m-labels text')].filter(vis);
const labels = texts.map((t) => { const r = t.getBoundingClientRect(); return { x0: r.left + 1, x1: r.right - 1, y0: r.top + 2, y1: r.bottom - 2 }; }).filter((b) => b.x1 > 0 && b.x0 < innerWidth && b.y1 > 60 && b.y0 < innerHeight && b.x1 - b.x0 > 4);
let ll = 0;
for (let i = 0; i < labels.length; i++) for (let j = i + 1; j < labels.length; j++) { const a = labels[i], b = labels[j]; if (a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1) ll++; }
// Плашки под подписями (если есть) закрывают линии: такое пересечение не видно глазу.
const plates = [...document.querySelectorAll('.map-svg .plate')].filter(vis).map((p) => p.getBoundingClientRect());
let hits = 0, hidden = 0, drawn = 0;
for (const p of edgePaths) {
  if (!p.getAttribute('d') || !vis(p) || +getComputedStyle(p).strokeOpacity < 0.15) continue;
  drawn++;
  const L = p.getTotalLength(); const m = p.getScreenCTM(); const seen = new Set();
  for (let s = 0; s <= L; s += 3) {
    const q = p.getPointAtLength(s); const x = m.a * q.x + m.c * q.y + m.e, y = m.b * q.x + m.d * q.y + m.f;
    if (masked(p, x, y)) continue;
    labels.forEach((l, i) => { if (!seen.has(i) && x > l.x0 + 3 && x < l.x1 - 3 && y > l.y0 && y < l.y1) { seen.add(i); hits++; if (plates.some((r) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom)) hidden++; } });
  }
}
// Названия туманностей (textPath): пакеты символов поштучно, чтобы наклон не раздувал рамки.
const charBoxes = (t) => { const out = []; for (const node of t.querySelectorAll('tspan, textPath')) for (const tn of node.childNodes) { if (tn.nodeType !== 3) continue; const r = document.createRange(); for (let i = 0; i < tn.length; i++) { if (!tn.data[i].trim()) continue; r.setStart(tn, i); r.setEnd(tn, i + 1); const b = r.getBoundingClientRect(); if (b.width) out.push({ x0: b.left + 1, x1: b.right - 1, y0: b.top + 2, y1: b.bottom - 2 }); } } return out; };
const nameEls = [...document.querySelectorAll('.map-svg .m-nebnames text')].filter(vis);
const names = nameEls.map(charBoxes);
const nameText = (i) => nameEls[i].textContent.trim();
const labelEls = texts.filter((t) => { const r = t.getBoundingClientRect(); return r.right > 0 && r.left < innerWidth && r.bottom > 60 && r.top < innerHeight && r.width > 4; });
const collisions = [];
const hit2 = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
let nameOverLabel = 0, nameOverName = 0;
names.forEach((nb, i) => {
  const li = labels.findIndex((l) => nb.some((c) => hit2(c, l)));
  if (li >= 0) { nameOverLabel++; collisions.push([nameText(i), 'label:' + (labelEls[li]?.textContent ?? '?').trim()]); }
  names.forEach((ob, j) => { if (j > i && nb.some((c) => ob.some((d) => hit2(c, d)))) { nameOverName++; collisions.push([nameText(i), 'name:' + nameText(j)]); } });
});
let dotOverName = 0, visibleLineThroughName = 0;
for (const d of document.querySelectorAll('.map-svg .node .dot')) {
  if (!vis(d)) continue;
  const r = d.getBoundingClientRect(), b = { x0: r.left, x1: r.right, y0: r.top, y1: r.bottom };
  if (names.some((ns) => ns.some((c) => hit2(b, c)))) dotOverName++;
}
for (const p of edgePaths) {
  if (!p.getAttribute('d') || !vis(p) || +getComputedStyle(p).strokeOpacity < 0.15) continue;
  const L = p.getTotalLength(), m = p.getScreenCTM(), seen = new Set();
  for (let s = 0; s <= L; s += 4) {
    const q = p.getPointAtLength(s), x = m.a * q.x + m.c * q.y + m.e, y = m.b * q.x + m.d * q.y + m.f;
    if (masked(p, x, y)) continue;
    names.forEach((ns, i) => { if (!seen.has(i) && ns.some((c) => x > c.x0 && x < c.x1 && y > c.y0 && y < c.y1)) { seen.add(i); visibleLineThroughName++; } });
  }
}
// Мобильные эпохи живут в HTML поверх SVG: их геометрия проверяется отдельно.
const eras = [...document.querySelectorAll('.me-label')].filter((e) => e.getClientRects().length).map((e) => {
  const r = e.getBoundingClientRect(); return { x0: r.left, y0: r.top, x1: r.right, y1: r.bottom };
});
let eraOverEra = 0, eraOverName = 0, eraOverLabel = 0, eraMaskMismatch = 0;
for (const [i, b] of eras.entries()) {
  eraOverEra += eras.slice(i + 1).filter((c) => hit2(b, c)).length;
  eraOverName += names.filter((ns) => ns.some((c) => hit2(b, c))).length;
  eraOverLabel += labels.filter((c) => hit2(b, c)).length;
}
const eraMasks = [...document.querySelectorAll('#map-region-mask rect[fill="black"]')].slice(-eras.length);
const matrix = document.querySelector('.map-svg')?.getScreenCTM();
for (const [i, b] of eras.entries()) {
  const r = eraMasks[i];
  if (!r || !matrix) { eraMaskMismatch++; continue; }
  const a = new DOMPoint(r.x.baseVal.value, r.y.baseVal.value).matrixTransform(matrix);
  const z = new DOMPoint(r.x.baseVal.value + r.width.baseVal.value, r.y.baseVal.value + r.height.baseVal.value).matrixTransform(matrix);
  if (Math.abs(Math.min(a.x, z.x) - b.x0 + 4) > 0.6 || Math.abs(Math.max(a.x, z.x) - b.x1 - 4) > 0.6 ||
      Math.abs(Math.min(a.y, z.y) - b.y0 + 4) > 0.6 || Math.abs(Math.max(a.y, z.y) - b.y1 - 4) > 0.6) eraMaskMismatch++;
}
return { names: names.length, nameOverLabel, nameOverName, dotOverName, visibleLineThroughName, collisions, labels: labels.length, edgesDrawn: drawn, labelOverLabel: ll, lineThroughText: hits, ofThemUnderPlate: hidden, visibleThroughText: hits - hidden, eraLabels: eras.length, eraOverEra, eraOverName, eraOverLabel, eraMaskMismatch };
})();
