// Локальные схемы (assets/illustrations/) и музейные репродукции (assets/works/).
// Для растровых работ генерируются лёгкие WebP-миниатюры в assets/thumbs/, чтобы каталог,
// поиск и карта не скачивали мегабайтные оригиналы. Все пути относительные (для GitHub Pages).
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

export const isLocalAsset = (ref) => /^assets\/(?:illustrations\/[a-z0-9-]+\.svg|works\/[a-z0-9-]+\.(?:jpe?g|png|webp))$/.test(ref ?? '');

async function ensureWebpThumb(srcPath, buffer, root, stem, maxW, srcMtimeMs) {
  const rel = `assets/thumbs/${stem}-${maxW}.webp`;
  const dst = path.join(root, rel);
  try {
    const st = await fs.stat(dst);
    if (st.size > 0 && st.mtimeMs >= srcMtimeMs) return rel;
  } catch { /* ещё не сгенерировано */ }
  await fs.mkdir(path.dirname(dst), { recursive: true });
  await sharp(buffer).rotate().resize(maxW, null, { withoutEnlargement: true }).webp({ quality: 82 }).toFile(dst);
  return rel;
}

export async function resolveLocalAssets(refs, root, { writeThumbs = true } = {}) {
  const out = new Map();
  for (const ref of new Set(refs)) {
    if (!isLocalAsset(ref)) throw new Error(`Unsupported local illustration: ${ref}`);
    const abs = path.join(root, ref);
    const [buffer, stat] = await Promise.all([fs.readFile(abs), fs.stat(abs)]);
    const { width, height } = await sharp(buffer).metadata();
    if (!width || !height) throw new Error(`Illustration has no dimensions: ${ref}`);
    const kind = /^assets\/works\//.test(ref) ? 'work' : 'illustration';
    let thumbs;
    if (kind === 'work' && writeThumbs) {
      const stem = path.basename(ref, path.extname(ref));
      const t480 = width > 520 ? await ensureWebpThumb(abs, buffer, root, stem, 480, stat.mtimeMs) : ref;
      thumbs = { 250: t480, 500: t480, 960: ref, 1280: ref };
    } else {
      thumbs = Object.fromEntries([250, 500, 960, 1280].map((w) => [w, ref]));
    }
    out.set(ref, {
      local: true, kind, page: ref, width, height, thumbs,
      artist: kind === 'work' ? null : 'Редакция атласа', license: null, nonfree: false, buffer,
    });
  }
  return out;
}
