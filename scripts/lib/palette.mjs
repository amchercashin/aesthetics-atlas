// Палитра изображения: k-means в пространстве Lab + акцентные цвета с проверкой контраста (WCAG).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { CACHE_DIR, fetchWithRetry } from './wikimedia.mjs';

// ---------- цветовые преобразования ----------
const srgbToLin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const linToSrgb = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

export function rgbToLab([r, g, b]) {
  const R = srgbToLin(r / 255), G = srgbToLin(g / 255), B = srgbToLin(b / 255);
  let x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  let y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  let z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  x = f(x); y = f(y); z = f(z);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

export function labToRgb([L, a, b]) {
  let y = (L + 16) / 116, x = a / 500 + y, z = y - b / 200;
  const f = (t) => (t ** 3 > 0.008856 ? t ** 3 : (t - 16 / 116) / 7.787);
  x = f(x) * 0.95047; y = f(y); z = f(z) * 1.08883;
  const R = x * 3.2406 + y * -1.5372 + z * -0.4986;
  const G = x * -0.9689 + y * 1.8758 + z * 0.0415;
  const B = x * 0.0557 + y * -0.204 + z * 1.057;
  return [R, G, B].map((c) => Math.round(Math.min(1, Math.max(0, linToSrgb(c))) * 255));
}

export const toHex = (rgb) => '#' + rgb.map((v) => v.toString(16).padStart(2, '0')).join('');
export const fromHex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

export function luminance([r, g, b]) {
  return 0.2126 * srgbToLin(r / 255) + 0.7152 * srgbToLin(g / 255) + 0.0722 * srgbToLin(b / 255);
}
export function contrast(a, b) {
  const la = luminance(a), lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// ---------- k-means ----------
function seededRandom(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

export function kmeans(points, k, iters = 12, seed = 7) {
  const rnd = seededRandom(seed);
  const d2 = (p, q) => (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2;
  // k-means++
  const centers = [points[Math.floor(rnd() * points.length)]];
  while (centers.length < k) {
    const dist = points.map((p) => Math.min(...centers.map((c) => d2(p, c))));
    const sum = dist.reduce((a, b) => a + b, 0);
    let r = rnd() * sum, idx = 0;
    while (r > dist[idx] && idx < dist.length - 1) { r -= dist[idx]; idx++; }
    centers.push(points[idx]);
  }
  let assign = new Array(points.length).fill(0);
  for (let it = 0; it < iters; it++) {
    assign = points.map((p) => {
      let best = 0, bd = Infinity;
      centers.forEach((c, i) => { const d = d2(p, c); if (d < bd) { bd = d; best = i; } });
      return best;
    });
    for (let i = 0; i < k; i++) {
      const mine = points.filter((_, j) => assign[j] === i);
      if (mine.length) centers[i] = [0, 1, 2].map((ax) => mine.reduce((s, p) => s + p[ax], 0) / mine.length);
    }
  }
  const counts = centers.map((_, i) => assign.filter((a) => a === i).length);
  return centers.map((c, i) => ({ lab: c, weight: counts[i] / points.length })).sort((a, b) => b.weight - a.weight);
}

// ---------- акценты ----------
// Реальные фоны сайта (css/tokens.css). На странице стиля стена — бумага, смешанная с основным цветом палитры.
export const BG_LIGHT = fromHex('#f2f1ee');
export const BG_DARK = fromHex('#202226');
export function mixLab(a, b, t) {
  const A = rgbToLab(a), B = rgbToLab(b);
  return labToRgb(A.map((v, i) => v + (B[i] - v) * t));
}

// Сдвигает светлоту L, пока цвет не наберёт нужный контраст с фоном.
export function fitContrast(rgb, bg, min = 4.5) {
  const lab = rgbToLab(rgb);
  const darker = luminance(bg) > 0.5;
  for (let i = 0; i <= 100; i++) {
    const L = darker ? lab[0] - i : lab[0] + i;
    const c = labToRgb([Math.max(0, Math.min(100, L)), lab[1], lab[2]]);
    if (contrast(c, bg) >= min) return c;
  }
  return darker ? [0, 0, 0] : [255, 255, 255];
}

export function paletteFromClusters(clusters, pts = null) {
  const colors = clusters.slice(0, 5).map((c) => toHex(labToRgb(c.lab)));
  // (палитра — пять самых весомых кластеров)
  // Акцент — самый «цветной» кластер заметного веса; если всё серое — самый весомый.
  // Небольшое, но яркое пятно (солнце у Моне) важнее большого серого поля.
  const chroma = (lab) => Math.hypot(lab[1], lab[2]);
  const score = (c) => chroma(c.lab) * Math.pow(c.weight, 0.3);
  const candidates = clusters.filter((c) => c.weight >= 0.012);
  const pick = candidates.reduce((best, c) => (score(c) > score(best) ? c : best), candidates[0] ?? clusters[0]);
  // Яркое пятно: 3% самых насыщенных пикселей, если они заметно ярче выбранного кластера.
  if (pts?.length) {
    const top = [...pts].sort((a, b) => chroma(b) - chroma(a)).slice(0, Math.max(8, Math.round(pts.length * 0.03)));
    const mean = [0, 1, 2].map((i) => top.reduce((sum, p) => sum + p[i], 0) / top.length);
    if (chroma(mean) > 38 && chroma(mean) > chroma(pick.lab) * 1.6) return accentsFor(labToRgb(mean), colors);
  }
  return accentsFor(labToRgb(pick.lab), colors);
}

export function accentsFor(rgb, colors) {
  // Те же пропорции, что в css/views.css: светлая стена — 12% тона, тёмная — 18%.
  const tint = colors?.[0] ? fromHex(colors[0]) : BG_LIGHT;
  const wallLight = mixLab(BG_LIGHT, tint, 0.12);
  const wallDark = mixLab(BG_DARK, tint, 0.18);
  return {
    colors,
    accent: toHex(rgb),
    accentLight: toHex(fitContrast(rgb, wallLight)),
    accentDark: toHex(fitContrast(rgb, wallDark)),
  };
}

export function paletteFromHexList(list) {
  const rgbs = list.map(fromHex);
  const chroma = (rgb) => { const l = rgbToLab(rgb); return Math.hypot(l[1], l[2]); };
  const pick = rgbs.reduce((b, c) => (chroma(c) > chroma(b) ? c : b), rgbs[0]);
  return accentsFor(pick, list.map((h) => h.toLowerCase()));
}

// ---------- загрузка и анализ ----------
const IMG_DIR = path.join(CACHE_DIR, 'img');

export async function downloadThumb(url, { offline = false } = {}) {
  fs.mkdirSync(IMG_DIR, { recursive: true });
  const file = path.join(IMG_DIR, crypto.createHash('sha1').update(url).digest('hex') + '.bin');
  if (fs.existsSync(file)) return fs.readFileSync(file);
  if (offline) throw new Error('thumb not cached (offline): ' + url);
  const buf = await fetchWithRetry(url, { binary: true });
  fs.writeFileSync(file, buf);
  return buf;
}

export async function paletteFromImage(buf) {
  const { data, info } = await sharp(buf).resize(64, 64, { fit: 'inside' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const pts = [];
  for (let i = 0; i < data.length; i += info.channels) pts.push(rgbToLab([data[i], data[i + 1], data[i + 2]]));
  return paletteFromClusters(kmeans(pts, 9), pts);
}

// Простой пул с ограниченной параллельностью.
export async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) { const i = next++; out[i] = await fn(items[i], i); }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}
