// Проверка извлечения палитр: цветная работа на сером музейном фоне сохраняет цвет,
// а монохромная графика остаётся монохромной.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { paletteFromImage, fromHex, rgbToLab } from '../scripts/lib/palette.mjs';

const chromaOf = (hex) => {
  const [, a, b] = rgbToLab(fromHex(hex));
  return Math.hypot(a, b);
};

async function makeTestPng(width, height, pixelFn) {
  const data = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b] = pixelFn(x, y, width, height);
      const i = (y * width + x) * 3;
      data[i] = r; data[i + 1] = g; data[i + 2] = b;
    }
  }
  return sharp(data, { raw: { width, height, channels: 3 } }).png().toBuffer();
}

test('colored motif on neutral museum backdrop keeps vivid colors in the palette', async () => {
  // 75% нейтрально-серого музейного фона, в центре — кобальтово-синий и охристый узор.
  const buf = await makeTestPng(64, 64, (x, y) => {
    if (x >= 20 && x < 34 && y >= 20 && y < 44) return [24, 62, 168]; // кобальт
    if (x >= 34 && x < 44 && y >= 24 && y < 40) return [196, 128, 36]; // охра
    return [182, 180, 178]; // серый фон
  });
  const pal = await paletteFromImage(buf);
  assert.equal(pal.colors.length, 5);
  assert.ok(pal.colors.some((c) => chromaOf(c) > 35), `expected cobalt/ochre in ${pal.colors.join(', ')}`);
});

test('monochrome drawing stays monochrome without artificial tinting', async () => {
  const buf = await makeTestPng(64, 64, (x, y) => {
    const v = (x + y) % 8 < 3 ? 35 : (x < 32 ? 190 : 235);
    return [v, v, v];
  });
  const pal = await paletteFromImage(buf);
  assert.equal(pal.colors.length, 5);
  assert.ok(pal.colors.every((c) => chromaOf(c) < 10), `expected neutral grays: ${pal.colors.join(', ')}`);
});
