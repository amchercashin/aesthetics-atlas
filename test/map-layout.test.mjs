// Раскладка карты по морям на настоящих данных. Море рисуется облаком вокруг своих карточек,
// поэтому карточки одного моря должны лежать рядом, а области разных морей — не пересекаться:
// иначе море рвётся на острова, а часть оказывается среди чужих морей.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { layoutGenealogy, solidShape } from '../js/layout.js';
import { mapTimeScale, mapLayoutNodes, layoutMap, SEA_GAP, LONG } from '../js/map-layout.js';
import { fmtDates } from '../js/format.js';

const atlas = JSON.parse(fs.readFileSync(new URL('../data/atlas.json', import.meta.url), 'utf8'));
const NOW = 2026;
// Карта меряет подписи на canvas; здесь — средняя ширина знака по замерам этих шрифтов.
const PX = { 1: 8.9, 2: 8, 3: 7.4 };
const widthOf = (s) => ({ w: [...s.name].length * PX[s.tier], wd: [...fmtDates(s)].length * 5.6 });
const sc = mapTimeScale(atlas.eras, atlas.styles, NOW);
const nodes = mapLayoutNodes(atlas.styles, widthOf);
// Карточка части не дальше стольких строк от центра своего моря. Самое большое море, «Древние истоки»
// (19 карточек в сжатой по времени древности), сейчас занимает ±7 строк, остальные — не больше ±4.
const MAX_PART_ROWS = 8;

// Нарушения раскладки: далёкие от моря части и пересечения областей разных морей
// (карточка вне морей — сама себе область: внутри чужого моря она прорезала бы в нём дыру).
function violations(lay, gap = { rows: 0, x: 0 }) {
  const out = [];
  const seas = new Map();
  for (const n of nodes) {
    const key = n.sea ?? `#${n.id}`;
    if (!seas.has(key)) seas.set(key, []);
    seas.get(key).push(n);
  }
  for (const [sea, members] of seas) {
    if (sea.startsWith('#')) continue;
    // Центр моря — медианная строка: оторванный край его не сдвигает. Центр части не годится:
    // у части, разорванной между двумя концами карты, он как раз попадает в середину.
    const rows = members.map((n) => lay.pos.get(n.id)).sort((a, b) => a - b);
    const center = rows[(rows.length - 1) >> 1];
    for (const n of members) {
      const d = Math.abs(lay.pos.get(n.id) - center);
      if (d > MAX_PART_ROWS) out.push(`часть ${sea}/${n.part}: ${n.id} в ${d} строках от центра моря`);
    }
  }
  const shapes = [...seas].map(([sea, members]) => {
    const raw = new Map();
    for (const n of members) {
      const r = lay.pos.get(n.id);
      if (!raw.has(r)) raw.set(r, []);
      raw.get(r).push(lay.intervals.get(n.id));
    }
    return [sea, solidShape(raw)];
  });
  for (let i = 0; i < shapes.length; i++) for (let j = i + 1; j < shapes.length; j++) {
    const [a, A] = shapes[i], [b, B] = shapes[j];
    // С зазором: соседние по строке или по времени области слились бы в облаке плотности.
    hit: for (const [r, ivs] of A) for (const [x0, x1] of ivs) for (let dr = -gap.rows; dr <= gap.rows; dr++) {
      for (const [y0, y1] of B.get(r + dr) ?? []) if (x0 - gap.x < y1 && y0 < x1 + gap.x) { out.push(`области ${a} и ${b} пересекаются в строке ${r}`); break hit; }
    }
  }
  return out;
}

test('map layout: parts stay near their sea and sea areas never overlap', () => {
  const lay = layoutMap(nodes, sc.x, NOW);
  assert.equal(lay.pos.size, nodes.length);
  assert.deepEqual(violations(lay, SEA_GAP), []);
});

test('map layout: the check catches a part torn away from its sea in the plain genealogy layout', () => {
  // Прежняя раскладка ставила «Северное Возрождение» к «Интернациональной готике» далеко внизу,
  // и «Караваджо и голландцы» рвались между двумя концами карты.
  const old = layoutGenealogy(nodes, sc.x, { now: NOW, dot: 16, gap: 22, tail: 28, longGap: LONG });
  const v = violations(old);
  assert.ok(v.some((m) => m.includes('vozrozhdenie-i-barokko/karavadzho-i-gollandcy')), v.join('\n'));
  assert.ok(v.some((m) => m.startsWith('области')), v.join('\n'));
});

test('map layout: no overlapping intervals in a row, no empty rows except gaps, reasonable height', () => {
  const lay = layoutMap(nodes, sc.x, NOW);
  const byRow = new Map();
  for (const n of nodes) {
    const r = lay.pos.get(n.id);
    assert.ok(Number.isInteger(r) && r >= 0 && r < lay.count);
    const [a, b] = lay.intervals.get(n.id);
    for (const o of byRow.get(r) ?? []) { const [c, d] = lay.intervals.get(o); assert.ok(!(a < d && c < b), `${n.id} overlaps ${o}`); }
    byRow.set(r, [...(byRow.get(r) ?? []), n.id]);
  }
  // Блоки морей занимают больше строк, чем сплошное древо, но карта не должна вытянуться вдвое.
  const plain = layoutGenealogy(nodes, sc.x, { now: NOW, dot: 16, gap: 22, tail: 28, longGap: LONG });
  assert.ok(lay.count <= plain.count * 1.75, `rows ${lay.count} vs ${plain.count}`);
});

test('map layout scales to ~650 styles quickly', () => {
  const big = [];
  for (let k = 0; k < 4; k++) for (const n of nodes) big.push({ ...n, id: `${n.id}~${k}`, start: n.start + k * 3, parents: n.parents.map((p) => `${p}~${k}`) });
  const t0 = performance.now();
  const lay = layoutMap(big, sc.x, NOW);
  const ms = performance.now() - t0;
  assert.equal(lay.pos.size, big.length);
  assert.ok(ms < 3000, `${ms} ms`);
});

test('map layout is deterministic and does not depend on input order', () => {
  const a = layoutMap(nodes, sc.x, NOW);
  const b = layoutMap([...nodes].reverse(), sc.x, NOW);
  assert.deepEqual([...a.pos].sort(), [...b.pos].sort());
});
