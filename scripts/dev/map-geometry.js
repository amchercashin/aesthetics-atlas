// Геометрическая проверка карты: вставить в консоль браузера на #/map (или выполнить через CDP).
// Считает подписи стилей, наложения подписей и места, где линия связи проходит через текст подписи
// (и сколько из них закрыто подложкой). Обёрнуто в async-функцию, результат — объект.
(async () => {
// Сравнимая проверка для старой и новой карты: все подписи стилей и все видимые линии связей,
// без исключения подписей концов связи (в старой разметке концы неизвестны).
const vis = (el) => { for (let e = el; e && e.tagName !== 'svg'; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.display === 'none' || +cs.opacity < 0.15) return false; } return true; };
const texts = [...document.querySelectorAll('.map-svg .m-nodes text, .map-svg .m-labels text')].filter(vis);
const labels = texts.map((t) => { const r = t.getBoundingClientRect(); return { x0: r.left + 1, x1: r.right - 1, y0: r.top + 2, y1: r.bottom - 2 }; }).filter((b) => b.x1 > 0 && b.x0 < innerWidth && b.y1 > 60 && b.y0 < innerHeight && b.x1 - b.x0 > 4);
let ll = 0;
for (let i = 0; i < labels.length; i++) for (let j = i + 1; j < labels.length; j++) { const a = labels[i], b = labels[j]; if (a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1) ll++; }
// Плашки под подписями (если есть) закрывают линии: такое пересечение не видно глазу.
const plates = [...document.querySelectorAll('.map-svg .plate')].filter(vis).map((p) => p.getBoundingClientRect());
let hits = 0, hidden = 0, drawn = 0;
for (const p of document.querySelectorAll('.map-svg .m-edges path:not(.case), .map-svg .m-cmp path')) {
  if (!p.getAttribute('d') || !vis(p) || +getComputedStyle(p).strokeOpacity < 0.15) continue;
  drawn++;
  const L = p.getTotalLength(); const m = p.getScreenCTM(); const seen = new Set();
  for (let s = 0; s <= L; s += 3) {
    const q = p.getPointAtLength(s); const x = m.a * q.x + m.c * q.y + m.e, y = m.b * q.x + m.d * q.y + m.f;
    labels.forEach((l, i) => { if (!seen.has(i) && x > l.x0 + 3 && x < l.x1 - 3 && y > l.y0 && y < l.y1) { seen.add(i); hits++; if (plates.some((r) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom)) hidden++; } });
  }
}
return { labels: labels.length, edgesDrawn: drawn, labelOverLabel: ll, lineThroughText: hits, ofThemUnderPlate: hidden, visibleThroughText: hits - hidden };
})();
