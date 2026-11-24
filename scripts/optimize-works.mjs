// Сжатие локальных репродукций в assets/works/ на месте (без смены имён и YAML):
// ограничивает длинную сторону 1400 px и перекодирует mozjpeg q82 / сжатый PNG,
// если файл больше 1400 px или уменьшается не меньше чем на 8 %. Идемпотентен.
//
// Запуск:
//   npm run optimize-works
//   node scripts/optimize-works.mjs --dry-run
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const WORKS_DIR = path.join(ROOT, 'assets/works');
const MAX_DIM = 1400;
const MIN_RATIO = 0.92;
const dryRun = process.argv.includes('--dry-run');

if (!fs.existsSync(WORKS_DIR)) {
  console.log('assets/works/ не найден — пропускаем.');
  process.exit(0);
}

const files = fs.readdirSync(WORKS_DIR)
  .filter((f) => /\.(jpe?g|png)$/i.test(f))
  .sort();

let beforeTotal = 0;
let afterTotal = 0;
let optimized = 0;
let resized = 0;

for (const file of files) {
  const full = path.join(WORKS_DIR, file);
  const buf = fs.readFileSync(full);
  beforeTotal += buf.length;

  let meta;
  try {
    meta = await sharp(buf).metadata();
  } catch (err) {
    console.warn(`! Пропущен ${file}: ${err.message}`);
    afterTotal += buf.length;
    continue;
  }

  const needResize = (meta.width || 0) > MAX_DIM || (meta.height || 0) > MAX_DIM;
  const isPng = /\.png$/i.test(file);
  let pipe = sharp(buf)
    .rotate()
    .resize(MAX_DIM, MAX_DIM, { fit: 'inside', withoutEnlargement: true });
  pipe = isPng
    ? pipe.png({ compressionLevel: 9, palette: true, quality: 85 })
    : pipe.jpeg({ quality: 82, mozjpeg: true, progressive: true });

  const out = await pipe.toBuffer();
  if (needResize || out.length < buf.length * MIN_RATIO) {
    if (needResize) resized++;
    if (out.length < buf.length || needResize) {
      if (!dryRun) fs.writeFileSync(full, out);
      afterTotal += out.length;
      optimized++;
      continue;
    }
  }
  afterTotal += buf.length;
}

const fmt = (b) => `${(b / 1048576).toFixed(1)} МБ`;
console.log(
  `${dryRun ? '[dry-run] ' : ''}assets/works/: проверено ${files.length}, оптимизировано ${optimized} (уменьшено по размеру: ${resized}), ` +
  `${fmt(beforeTotal)} → ${fmt(afterTotal)} (экономия ${fmt(beforeTotal - afterTotal)}).`
);
