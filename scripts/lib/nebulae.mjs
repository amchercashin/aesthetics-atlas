// Состав туманностей: проверка, подсказка для нового стиля, цвета.
const HEX = /^#[0-9a-f]{6}$/i;
const W = { evolved: 1, influence: 0.7, reaction: 0.4, revival: 0.25 };

// Куда по связям ближе всего стиль, которого ещё нет в туманностях.
export function closestPart(id, styles, partOf) {
  const score = new Map();
  const add = (other, type) => { const p = partOf.get(other); if (p) score.set(p, (score.get(p) ?? 0) + (W[type] ?? 0.25)); };
  for (const s of styles) {
    if (s.id === id) for (const p of s.parents ?? []) add(p.id, p.type);
    else for (const p of s.parents ?? []) if (p.id === id) add(s.id, p.type);
  }
  return [...score].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? null;
}

export function validateNebulae(doc, styles) {
  const errors = [], warnings = [];
  const ids = new Set(styles.map((s) => s.id));
  const nebIds = new Set(), partIds = new Set(), partOf = new Map(), place = new Map();
  for (const n of doc?.nebulae ?? []) {
    if (!n.id || !n.name) errors.push(`nebula without id or name: ${JSON.stringify(n.id ?? n.name)}`);
    if (nebIds.has(n.id)) errors.push(`duplicate nebula id "${n.id}"`);
    nebIds.add(n.id);
    if (n.color != null && !HEX.test(n.color)) errors.push(`nebula "${n.id}": color must be #rrggbb`);
    if (!n.parts?.length) errors.push(`nebula "${n.id}" has no parts`);
    for (const p of n.parts ?? []) {
      if (!p.id || !p.name) errors.push(`nebula "${n.id}": part needs id and name`);
      if (partIds.has(p.id)) errors.push(`duplicate part id "${p.id}"`);
      partIds.add(p.id);
      if (!p.styles?.length) errors.push(`part "${p.id}" has no styles`);
      for (const sid of p.styles ?? []) {
        if (!ids.has(sid)) { errors.push(`part "${p.id}": unknown style "${sid}"`); continue; }
        if (place.has(sid)) errors.push(`style "${sid}" is listed twice (${place.get(sid)} and part "${p.id}")`);
        place.set(sid, `part "${p.id}"`);
        partOf.set(sid, p.id);
      }
    }
  }
  for (const sid of doc?.free ?? []) {
    if (!ids.has(sid)) { errors.push(`free: unknown style "${sid}"`); continue; }
    if (place.has(sid)) errors.push(`style "${sid}" is listed twice (${place.get(sid)} and free)`);
    place.set(sid, 'free');
  }
  for (const s of styles) {
    if (place.has(s.id)) continue;
    const near = closestPart(s.id, styles, partOf);
    errors.push(`style "${s.id}" is not in any nebula part${near ? ` (closest by links: part "${near}")` : ''}; add it to content/nebulae.yaml or to free`);
  }
  return { errors, warnings };
}

// Туманности для сайта: цвет — редакторский, иначе акцент палитры главного стиля (низший ярус, раньше начавшийся).
export function resolveNebulae(doc, styles) {
  const byId = new Map(styles.map((s) => [s.id, s]));
  const byStyle = new Map();
  const nebulae = (doc.nebulae ?? []).map((n) => {
    const members = n.parts.flatMap((p) => p.styles.map((id) => byId.get(id)).filter(Boolean));
    for (const p of n.parts) for (const id of p.styles) byStyle.set(id, { nebula: n.id, part: p.id });
    const lead = members.filter((s) => s.palette?.accent).sort((a, b) => a.tier - b.tier || a.start - b.start)[0];
    return { id: n.id, name: n.name, color: n.color ?? lead?.palette.accent ?? '#888780', parts: n.parts.map((p) => ({ id: p.id, name: p.name })) };
  });
  return { nebulae, byStyle };
}
