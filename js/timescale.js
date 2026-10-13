// Кусочно-линейная шкала времени: каждая эпоха — свой сегмент со своей плотностью.
// Ширина сегмента растёт с числом стилей в нём, поэтому 40 000 лет палеолита
// и 15 лет интернет-эстетик занимают сопоставимое место.

export function segmentWidths(breaks, starts, { base = 240, perItem = 64, min = 300 } = {}) {
  const widths = [];
  for (let i = 0; i < breaks.length - 1; i++) {
    const n = starts.filter((y) => y >= breaks[i] && (y < breaks[i + 1] || (i === breaks.length - 2 && y <= breaks[i + 1]))).length;
    widths.push(Math.max(min, base + perItem * n));
  }
  return widths;
}

export function createTimeScale(breaks, widths) {
  if (breaks.length !== widths.length + 1) throw new Error('breaks must have widths.length + 1 items');
  const offsets = [0];
  for (const w of widths) offsets.push(offsets[offsets.length - 1] + w);
  const total = offsets[offsets.length - 1];

  const segIndex = (year) => {
    if (year <= breaks[0]) return 0;
    for (let i = 0; i < widths.length; i++) if (year < breaks[i + 1]) return i;
    return widths.length - 1;
  };

  const x = (year) => {
    const y = Math.min(Math.max(year, breaks[0]), breaks[breaks.length - 1]);
    const i = segIndex(y);
    return offsets[i] + ((y - breaks[i]) / (breaks[i + 1] - breaks[i])) * widths[i];
  };

  const invert = (px) => {
    const p = Math.min(Math.max(px, 0), total);
    let i = 0;
    while (i < widths.length - 1 && p >= offsets[i + 1]) i++;
    return breaks[i] + ((p - offsets[i]) / widths[i]) * (breaks[i + 1] - breaks[i]);
  };

  const segments = widths.map((w, i) => ({ start: breaks[i], end: breaks[i + 1], x0: offsets[i], x1: offsets[i + 1] }));
  return { x, invert, total, segments };
}

const STEPS = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000, 10000, 20000];

// Деления оси внутри сегмента: самый мелкий «красивый» шаг, при котором подписи не теснятся.
export function segmentTicks(seg, k = 1, minGap = 84) {
  const span = seg.end - seg.start;
  const pxPerYear = ((seg.x1 - seg.x0) * k) / span;
  const step = STEPS.find((s) => s * pxPerYear >= minGap) ?? null;
  if (!step) return [];
  const ticks = [];
  for (let y = Math.ceil(seg.start / step) * step; y < seg.end; y += step) {
    if (y === seg.start) continue;
    if ((y - seg.start) * pxPerYear < minGap * 0.7) continue;
    if ((seg.end - y) * pxPerYear < minGap * 0.7) continue;
    ticks.push(y);
  }
  return ticks;
}
