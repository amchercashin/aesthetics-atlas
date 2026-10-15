// От «Всей истории» до читаемого обзора: сначала силуэты подписей,
// затем полный контраст. Логарифм совпадает с ходом камеры и сжатием строк.
export function styleLabelOpacity(k, fit, overview) {
  if (k <= fit) return 0;
  if (k >= overview || overview <= fit) return 1;
  const p = Math.log(k / fit) / Math.log(overview / fit);
  const smooth = (t) => t * t * (3 - 2 * t);
  return p < 0.5 ? 0.16 * smooth(p * 2) : 0.16 + 0.84 * smooth(p * 2 - 1);
}
