// Раскладка карты из карточек: шкала времени, узлы с шириной подписей и строки по морям.
// Общая для карты и тестов: map.js меряет подписи на canvas, тесты — моделью ширины,
// а расстановка одна и та же.
import { createTimeScale, segmentWidths } from './timescale.js';
import { layoutRegions } from './layout.js';

export const OV_K = 0.2;    // просторный обзор (вид по умолчанию): раскладка оставляет место под все подписи
export const LONG = 1200;   // разрыв во времени (px рабочего масштаба), после которого связь рисуется парными отростками
export const R = { z0: { 1: 3.6, 2: 2.8, 3: 2.4 }, z1: { 1: 6, 2: 5, 3: 4.2 }, z2: { 1: 15, 2: 13, 3: 11 } };
// Зазор между морями: пустая строка там, где они идут в одно время, и 120 px по времени в соседних строках —
// облака морей не сливаются и не касаются (облако выходит за точку примерно на 47 px поля, то есть 235 px здесь).
export const SEA_GAP = { rows: 1, x: 120 };
export const BAND_GAP = 2;
export const LATITUDE_BANDS = [
  { id: 'north', label: 'Азия и Тихий океан' },
  { id: 'center', label: 'Средиземноморье · Европа · глобальный поток' },
  { id: 'south', label: 'Народные традиции · Африка · Америки' },
];
const BAND_ORDER = LATITUDE_BANDS.map((b) => b.id);
const NORTH_REGIONS = new Set(['east-asia', 'south-asia', 'se-asia', 'oceania']);
const SOUTH_REGIONS = new Set(['africa', 'americas']);

function bandForStyle(s, seaBandById) {
  if (s.nebula && seaBandById?.has(s.nebula)) return seaBandById.get(s.nebula);
  const regs = s.regions ?? [];
  if (regs.some((r) => NORTH_REGIONS.has(r))) return 'north';
  if (regs.some((r) => SOUTH_REGIONS.has(r))) return 'south';
  return 'center';
}

export function mapTimeScale(eras, styles, now) {
  const breaks = [...eras.map((e) => e.start), now + 1];
  return createTimeScale(breaks, segmentWidths(breaks, styles.map((s) => s.start), { base: 60, perItem: 76, min: 170 }));
}

// widthOf(s) → { w, wd }: ширина названия и строки дат в px.
export function mapLayoutNodes(styles, widthOf, nebulae = null) {
  const seaBandById = nebulae ? new Map(nebulae.map((nb) => [nb.id, nb.band ?? 'center'])) : null;
  return styles.map((s) => {
    const { w, wd } = widthOf(s);
    return {
      id: s.id, start: s.start, end: s.end, tier: s.tier,
      width: R.z2[s.tier] + 8 + Math.max(w, wd),
      parents: s.parents.map((p) => p.id),
      // На просторном обзоре подпись того же размера, а масштаб мельче: строка держит место под неё.
      reach: ((s.tier === 1 ? 11 : R.z1[s.tier]) + 7 + w + 12) / OV_K,
      sea: s.nebula ?? null, part: s.part ?? null,
      band: bandForStyle(s, seaBandById),
    };
  });
}

// Море — блок строк, внутри него блоки частей, внутри части — древо. Моря уложены по трём широтам (north/center/south).
export function layoutMap(nodes, x, now) {
  return layoutRegions(nodes, x, {
    now, dot: 16, gap: 22, tail: 28, longGap: LONG,
    levels: [(n) => n.sea, (n) => n.part],
    sep: SEA_GAP,
    bandOrder: BAND_ORDER,
    bandOf: (n) => n.band ?? 'center',
    bandGap: BAND_GAP,
  });
}
