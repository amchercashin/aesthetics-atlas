// docs/map-v4/prototype/scripts/to-yaml.mjs — одноразово: состав туманностей прототипа → content/nebulae.yaml
// Запуск: node docs/map-v4/prototype/scripts/to-yaml.mjs
import fs from 'node:fs';
import yaml from 'js-yaml';
const src = fs.readFileSync(new URL('../data.js', import.meta.url), 'utf8');
const A = JSON.parse(src.slice(src.indexOf('{'), src.lastIndexOf('}') + 1));
const T = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya' };
const slug = (s) => s.toLowerCase().split('').map((c) => T[c] ?? c).join('').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const uniq = (list, what) => { const seen = new Set(); for (const x of list) { if (seen.has(x)) throw new Error(`duplicate ${what} id ${x}`); seen.add(x); } };
const nebIds = A.nebulae.map((n) => slug(n.name)), partIds = A.parts.map((p) => slug(p.name));
uniq(nebIds, 'nebula'); uniq(partIds, 'part');
const doc = {
  nebulae: A.nebulae.map((n, ni) => ({
    id: nebIds[ni], name: n.name, color: n.color,
    parts: A.parts.map((p, pi) => ({ p, pi })).filter(({ p }) => p.nebula === ni).map(({ p, pi }) => ({
      id: partIds[pi], name: p.name, styles: A.styles.filter((s) => s.part === pi).map((s) => s.id),
    })),
  })),
  free: A.styles.filter((s) => s.part < 0).map((s) => s.id),
};
const head = '# Состав туманностей карты. Туманность → части → стили. Стиль без туманности — в free (явно).\n# Новый стиль добавляют в ближайшую по связям часть: подсказку даёт сообщение сборки.\n';
fs.writeFileSync(new URL('../../../../content/nebulae.yaml', import.meta.url), head + yaml.dump(doc, { lineWidth: 120, noRefs: true }));
console.log('nebulae', doc.nebulae.length, 'parts', doc.nebulae.reduce((n, x) => n + x.parts.length, 0), 'free', doc.free.length);
