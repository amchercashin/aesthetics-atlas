import fs from 'node:fs';
const ROOT = '/Users/amchercashin/Developer/aesthetics-atlas';
const { createTimeScale, segmentWidths } = await import(ROOT + '/js/timescale.js');
const { layoutGenealogy, layoutLanes } = await import(ROOT + '/js/layout.js');
const a = JSON.parse(fs.readFileSync(ROOT + '/data/atlas.json'));
const S = a.styles, now = 2026;
const breaks = [...a.eras.map(e => e.start), now + 1];
const sc = createTimeScale(breaks, segmentWidths(breaks, S.map(s => s.start), { base: 60, perItem: 76, min: 170 }));
const R1 = { 1: 6, 2: 5, 3: 4.2 }, R2 = { 1: 15, 2: 13, 3: 11 }, CH = { 1: 8.6, 2: 7.4, 3: 6.8 };
const nameW = s => s.name.length * CH[s.tier];
const nodes = S.map(s => ({ id: s.id, start: s.start, end: s.end, tier: s.tier,
  width: R2[s.tier] + 8 + Math.max(nameW(s), 80),
  parents: s.parents.map(p => p.id),
  reach: ((s.tier === 1 ? 11 : R1[s.tier]) + 7 + nameW(s) + 12) / 0.2 }));
const tree = layoutGenealogy(nodes, sc.x, { now, dot: 16, gap: 22, tail: 28, longGap: 1200 });
const STREAMS = [
  ['Восточная Азия', /^(Китай|Япония)/],
  ['Южная Азия', /^(Индия|Пакистан|Австралия)/],
  ['Средиземноморье и Ближний Восток', /^(Междуречье|Египет|Крит|Греция|Восточное Средиземноморье|Римская империя|Римский Египет|Восточная Римская империя|Иран|От Испании)/],
  ['Европа', /./],
  ['Россия и СССР', /^(Русь|Россия|СССР)/],
  ['Северная Америка', /^(США|Нью-Йорк|Калифорния|Кремниевая)/],
  ['Латинская Америка', /^(Мексика|Перу)/],
  ['Весь мир и интернет', /^(По всему миру|Весь мир|Интернет|Tumblr|TikTok)/],
];
const order = [0, 1, 2, 4, 5, 6, 7, 3]; // проверять специфичные раньше «Европы»
const laneOfId = new Map(S.map(s => { const f = (s.region || '').split(/,| — /)[0].trim(); const i = order.find(i => STREAMS[i][1].test(f)); return [s.id, i]; }));
const lanes = STREAMS.map((_, i) => i);
const LW = +(process.env.LW || 1); const ln = layoutLanes(nodes.map(n => ({ ...n, end: n.start, width: n.reach * LW })), sc.x, { lanes, laneOf: n => laneOfId.get(n.id), now, dot: 16, gap: 22 });
const idx = new Map(S.map((s, i) => [s.id, i]));
const T = { evolved: 0, influence: 1, reaction: 2, revival: 3 };
const N = S.map(s => [s.name, Math.round(sc.x(s.start) / sc.total * 10000), tree.pos.get(s.id), ln.pos.get(s.id).lane, ln.pos.get(s.id).row, s.tier, s.parents.map(p => [idx.get(p.id), T[p.type]])]);
let cross = 0; for (const s of S) for (const p of s.parents) if (laneOfId.get(s.id) !== laneOfId.get(p.id)) cross++;
const out = { N, tc: tree.count, lc: ln.counts, sn: STREAMS.map(s => s[0]),
  eb: sc.segments.map(g => Math.round(g.x0 / sc.total * 10000)),
  en: ['Перв.', 'Древн.', 'Антич.', 'Ср. века', 'Возр.', '1750', '1880', 'Аванг.', '1945', 'Постм.', 'Цифра', 'Интернет'],
  fr: [Math.round(sc.x(1850) / sc.total * 10000), Math.round(sc.x(1975) / sc.total * 10000)] };
console.error('tree rows', tree.count, 'lane rows', ln.counts, 'sum', ln.counts.reduce((a, b) => a + b), 'cross', cross, '/', S.reduce((a, s) => a + s.parents.length, 0));
console.error('per stream', ln.counts.map((c, i) => STREAMS[i][0] + ':' + S.filter(s => laneOfId.get(s.id) === i).length).join(', '));
fs.writeFileSync(process.argv[2], JSON.stringify(out));
