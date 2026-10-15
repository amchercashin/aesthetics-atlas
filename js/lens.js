// js/lens.js
// Краевые «желоба»: в середине окна масштаб рабочий (x·k + tx), а всё, что вылезло за края,
// сжато в узкие желоба слева и справа — вся история остаётся на экране.
// Отображение непрерывно, монотонно и обратимо.
export function createGutterLens({ total, k, tx, width, gutter = 56, pad = 6 }) {
  const lin = (x) => x * k + tx;
  const hasL = tx < pad;
  const hasR = lin(total) > width - pad;
  const xL = hasL ? Math.min(total, (gutter - tx) / k) : 0;
  const xR = hasR ? Math.max(xL, (width - gutter - tx) / k) : total;
  const sL = hasL ? (gutter - pad) / Math.max(xL, 1e-6) : 0;
  const sR = hasR ? (gutter - pad) / Math.max(total - xR, 1e-6) : 0;
  const fwd = (x) => {
    if (hasL && x < xL) return pad + x * sL;
    if (hasR && x > xR) return width - gutter + (x - xR) * sR;
    return lin(x);
  };
  const inv = (px) => {
    if (hasL && px < gutter) return Math.max(0, (px - pad) / sL);
    if (hasR && px > width - gutter) return Math.min(total, xR + (px - (width - gutter)) / sR);
    return (px - tx) / k;
  };
  const zone = (x) => (hasL && x < xL ? 'L' : hasR && x > xR ? 'R' : 'C');
  return { fwd, inv, zone, hasL, hasR, xL, xR, gutter, width };
}
