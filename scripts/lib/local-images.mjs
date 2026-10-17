// Собственные SVG-схемы атласа. Пути относительные, чтобы работала публикация в подпапке.
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

export const isLocalAsset = (ref) => /^assets\/(?:illustrations\/[a-z0-9-]+\.svg|works\/[a-z0-9-]+\.(?:jpe?g|png|webp))$/.test(ref ?? '');

export async function resolveLocalAssets(refs, root) {
  const out = new Map();
  for (const ref of new Set(refs)) {
    if (!isLocalAsset(ref)) throw new Error(`Unsupported local illustration: ${ref}`);
    const buffer = await fs.readFile(path.join(root, ref));
    const { width, height } = await sharp(buffer).metadata();
    if (!width || !height) throw new Error(`Illustration has no dimensions: ${ref}`);
    const kind = /^assets\/works\//.test(ref) ? 'work' : 'illustration';
    out.set(ref, {
      local: true, kind, page: ref, width, height,
      thumbs: Object.fromEntries([250, 500, 960, 1280].map((w) => [w, ref])),
      artist: kind === 'work' ? null : 'Редакция атласа', license: null, nonfree: false, buffer,
    });
  }
  return out;
}
