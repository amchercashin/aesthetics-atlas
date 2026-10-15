// От «Всей истории» до читаемого обзора: сначала силуэты подписей,
// затем полный контраст. Логарифм совпадает с ходом камеры и сжатием строк.
export function styleLabelOpacity(k, fit, overview) {
  if (k <= fit) return 0;
  if (k >= overview || overview <= fit) return 1;
  const p = Math.log(k / fit) / Math.log(overview / fit);
  const smooth = (t) => t * t * (3 - 2 * t);
  return p < 0.5 ? 0.16 * smooth(p * 2) : 0.16 + 0.84 * smooth(p * 2 - 1);
}

// В тесном фокусе полное имя остаётся в карточке и aria-label точки.
// На карте сокращаем его по измеренной ширине, сохраняя целые символы.
export function fitLabelText(text, width, measure) {
  if (measure(text) <= width) return { text, width: measure(text) };
  if (measure('…') > width) return { text: '', width: 0 };
  const chars = [...text];
  let lo = 0, hi = chars.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (measure(chars.slice(0, mid).join('').trimEnd() + '…') <= width) lo = mid;
    else hi = mid - 1;
  }
  const shortened = chars.slice(0, lo).join('').trimEnd() + '…';
  return { text: shortened, width: measure(shortened) };
}
