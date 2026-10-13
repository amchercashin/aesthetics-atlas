// Структурная валидация контента (чистая функция, без сети).
export const DOMAINS = ['art', 'architecture', 'design', 'internet'];
export const RELATIONS = ['evolved', 'influence', 'reaction', 'revival'];
const HEX = /^#[0-9a-f]{6}$/i;
const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function validate(styles, eras) {
  const errors = [];
  const warnings = [];
  const eraIds = new Set(eras.map((e) => e.id));
  const byId = new Map();

  for (const s of styles) {
    const at = `[${s.id ?? '?'}]`;
    if (!s.id || !ID.test(s.id)) errors.push(`${at} bad id`);
    if (byId.has(s.id)) errors.push(`${at} duplicate id`);
    byId.set(s.id, s);

    for (const f of ['name', 'orig', 'summary', 'description']) {
      if (typeof s[f] !== 'string' || !s[f].trim()) errors.push(`${at} missing ${f}`);
    }
    if (!Number.isFinite(s.start)) errors.push(`${at} start must be a number`);
    if (s.end !== null && s.end !== undefined && !Number.isFinite(s.end)) errors.push(`${at} end must be a number or null`);
    if (Number.isFinite(s.start) && Number.isFinite(s.end) && s.start > s.end) errors.push(`${at} start > end`);
    if (!eraIds.has(s.era)) errors.push(`${at} unknown era "${s.era}"`);
    if (!Array.isArray(s.domain) || !s.domain.length || s.domain.some((d) => !DOMAINS.includes(d))) errors.push(`${at} bad domain`);
    if (![1, 2, 3].includes(s.tier)) errors.push(`${at} tier must be 1, 2 or 3`);

    if (!Array.isArray(s.traits) || s.traits.length < 3) errors.push(`${at} needs ≥3 traits`);
    else if (s.traits.length > 6) warnings.push(`${at} more than 6 traits`);

    const hasImage = typeof s.example?.file === 'string' && s.example.file.trim();
    const hasPalette = Array.isArray(s.palette) && s.palette.length >= 3 && s.palette.every((h) => HEX.test(h));
    if (!hasImage && !hasPalette) errors.push(`${at} needs an image or palette`);
    if (s.palette && !hasPalette) errors.push(`${at} palette must be ≥3 hex colors`);
    if (!s.example?.title) errors.push(`${at} example.title required (the most famous work)`);

    for (const g of s.gallery ?? []) if (!g.file) errors.push(`${at} gallery item without file`);
    for (const l of s.links ?? []) if (!/^https:\/\//.test(l.url ?? '')) errors.push(`${at} link must be https: ${l.url}`);

    if (!Array.isArray(s.parents)) errors.push(`${at} parents must be an array`);
    else {
      if (!s.parents.length && !s.root) errors.push(`${at} has no parents (mark root: true if it is an independent origin)`);
      const seen = new Set();
      for (const p of s.parents) {
        if (!RELATIONS.includes(p.type)) errors.push(`${at} bad relation type "${p.type}"`);
        if (p.id === s.id) errors.push(`${at} is its own parent`);
        if (seen.has(p.id)) errors.push(`${at} duplicate parent "${p.id}"`);
        seen.add(p.id);
      }
    }
  }

  for (const s of styles) {
    for (const p of s.parents ?? []) {
      const parent = byId.get(p.id);
      if (!parent) { errors.push(`[${s.id}] unknown parent "${p.id}"`); continue; }
      if (Number.isFinite(parent.start) && Number.isFinite(s.start) && parent.start > s.start) {
        warnings.push(`[${s.id}] parent "${p.id}" starts after child (${parent.start} > ${s.start})`);
      }
    }
  }

  // Циклы: DFS с цветами.
  const color = new Map();
  const visit = (id, stack) => {
    color.set(id, 1);
    for (const p of byId.get(id)?.parents ?? []) {
      if (!byId.has(p.id)) continue;
      const c = color.get(p.id);
      if (c === 1) { errors.push(`cycle: ${[...stack, id, p.id].join(' → ')}`); continue; }
      if (!c) visit(p.id, [...stack, id]);
    }
    color.set(id, 2);
  };
  for (const id of byId.keys()) if (!color.get(id)) visit(id, []);

  return { errors, warnings };
}
