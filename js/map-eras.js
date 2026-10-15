// Подписи следуют видимым отрезкам времени. При тесноте сдвигаются вдоль оси,
// сохраняя порядок; указатель в интерфейсе остаётся у исходного отрезка.
export function layoutEraLabels(intervals, top, bottom, { height = 24, gap = 4 } = {}) {
  const capacity = Math.max(0, Math.floor((bottom - top + gap) / (height + gap)));
  if (!capacity) return [];
  let labels = intervals.flatMap(({ id, start, end }) => {
    const a = Math.max(top, start), b = Math.min(bottom, end);
    return b > a ? [{ id, anchor: (a + b) / 2, extent: b - a }] : [];
  });
  // В очень низком окне остаются самые протяжённые видимые эпохи.
  // Полный список переходов доступен в каталоге карты при любом масштабе.
  if (labels.length > capacity) labels = labels.sort((a, b) => b.extent - a.extent || a.anchor - b.anchor).slice(0, capacity);
  labels.sort((a, b) => a.anchor - b.anchor);
  const step = height + gap, blocks = [];
  labels.forEach((l, i) => {
    blocks.push({ sum: l.anchor - i * step, n: 1, first: i });
    while (blocks.length > 1) {
      const a = blocks.at(-2), b = blocks.at(-1);
      if (a.sum / a.n <= b.sum / b.n) break;
      blocks.splice(-2, 2, { sum: a.sum + b.sum, n: a.n + b.n, first: a.first });
    }
  });
  const lo = top + height / 2, hi = bottom - height / 2 - (labels.length - 1) * step;
  for (const b of blocks) {
    const y = Math.max(lo, Math.min(hi, b.sum / b.n));
    for (let i = b.first; i < b.first + b.n; i++) labels[i].y = y + i * step;
  }
  return labels;
}
