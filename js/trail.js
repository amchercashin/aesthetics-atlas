// js/trail.js
// Маршрут по карте — простой путь без петель. Источник правды — адрес (параметр trail),
// поэтому «Назад» и ссылки работают без отдельного хранилища.
export const TRAIL_MAX = 24;

export function pushStep(trail, id) {
  if (trail[trail.length - 1] === id) return trail;
  const at = trail.indexOf(id);
  const next = at >= 0 ? trail.slice(0, at + 1) : [...trail, id];
  return next.length > TRAIL_MAX ? next.slice(next.length - TRAIL_MAX) : next;
}

export const toParam = (trail) => trail.join(',');

export function parseTrail(param, has) {
  return String(param ?? '').split(',').map((s) => s.trim()).filter((id) => id && has(id)).reduce(pushStep, []);
}
