// Поиск по стилям: названия (рус/ориг), алиасы, имена, признаки. Без внешних зависимостей.
// Терпим к регистру, «ё», диакритике, полноширинным символам и одной-двум опечаткам.

export function normalize(s) {
  return String(s ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

const tokens = (s) => normalize(s).split(' ').filter(Boolean);

function lev(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      rowMin = Math.min(rowMin, cur[j]);
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

const FIELDS = [
  ['name', 3], ['orig', 3], ['aliases', 2.5], ['searchKeywords', 1.8], ['names', 1.6], ['traits', 0.7], ['summary', 0.4],
  ['creators', 2], ['corpus', 0.9],
];

export function buildIndex(styles) {
  return styles.map((s) => {
    const f = {};
    for (const [k] of FIELDS) {
      const v = k === 'creators' ? (s.creators ?? []).flatMap((c) => [c.name, c.orig, ...(c.aliases ?? [])]).join(' ')
        : k === 'corpus' ? (s.corpus ?? []).map((w) => w.title).join(' ')
        : Array.isArray(s[k]) ? s[k].join(' ') : s[k];
      f[k] = { full: normalize(v), toks: tokens(v) };
    }
    return { style: s, f };
  });
}

function tokenScore(q, field) {
  let best = 0;
  if (field.full === q) return 12;
  for (const t of field.toks) {
    if (t === q) best = Math.max(best, 10);
    else if (t.startsWith(q)) best = Math.max(best, q.length >= 3 ? 8 : 5);
    else if (q.length >= 3 && t.includes(q)) best = Math.max(best, 4);
    else if (q.length >= 4) {
      const max = q.length >= 8 ? 2 : 1;
      const cmp = t.length > q.length ? t.slice(0, q.length + max) : t;
      if (lev(q, cmp, max) <= max) best = Math.max(best, 2.5);
    }
  }
  if (!best && q.length >= 3 && field.full.includes(q)) best = 3;
  return best;
}

export function parseYear(q) {
  const m = /^\s*(-?\d{1,5})\s*(до\s*н\.?\s*э\.?|bc|bce)?\s*$/i.exec(q);
  if (!m) return null;
  let y = parseInt(m[1], 10);
  if (m[2]) y = -Math.abs(y);
  return y;
}

export function activeIn(styles, year, now = 2026) {
  return styles
    .filter((s) => s.start <= year && (s.end ?? now) >= year)
    .sort((a, b) => a.tier - b.tier || b.start - a.start);
}

export function search(index, query, { limit = 12, now = 2026 } = {}) {
  const year = parseYear(query);
  if (year !== null && Math.abs(year) >= 100) {
    return activeIn(index.map((e) => e.style), year, now).slice(0, limit).map((style) => ({ style, score: 1, year }));
  }
  const qs = tokens(query);
  if (!qs.length) return [];
  const out = [];
  for (const e of index) {
    let total = 0;
    let ok = true;
    for (const q of qs) {
      let best = 0;
      for (const [k, w] of FIELDS) best = Math.max(best, tokenScore(q, e.f[k]) * w);
      if (!best) { ok = false; break; }
      total += best;
    }
    if (ok) out.push({ style: e.style, score: total + (4 - e.style.tier) * 0.5 });
  }
  return out.sort((a, b) => b.score - a.score || a.style.start - b.style.start).slice(0, limit);
}
