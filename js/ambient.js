// js/ambient.js
// Фоновые дуги на рабочем масштабе: вторичные связи, оба конца которых на экране. Не больше cap,
// самые короткие по времени первыми: они читаются как «рядом» и не превращаются в паутину.
export function pickAmbient(edges, { visible, span, cap = 40 }) {
  return edges
    .filter((e) => !e.primary && visible(e.par) && visible(e.ch))
    .sort((a, b) => span(a) - span(b))
    .slice(0, cap);
}
