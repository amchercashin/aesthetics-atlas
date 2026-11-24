// «Моя полка вкуса»: локальное сохранение любимых стилей без бэкенда + шаринг подборки в URL.
const KEY = 'atlas-saved';
const MAX_SAVED = 60;

function defaultStorage() {
  try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch { return null; }
}

function notify(ids) {
  if (typeof window !== 'undefined' && typeof CustomEvent !== 'undefined') {
    window.dispatchEvent(new CustomEvent('atlas-favorites', { detail: { ids } }));
  }
}

export function readRawSaved(storage = defaultStorage()) {
  if (!storage) return [];
  try {
    const parsed = JSON.parse(storage.getItem(KEY) ?? '[]');
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed.filter((x) => typeof x === 'string' && x.trim()))].slice(0, MAX_SAVED);
  } catch {
    return [];
  }
}

export function readSaved(store, storage = defaultStorage()) {
  const raw = readRawSaved(storage);
  if (!store) return raw;
  const out = [];
  const seen = new Set();
  for (const id of raw) {
    const resolved = store.resolve ? store.resolve(id) : (store.has?.(id) ? id : null);
    if (resolved && !seen.has(resolved)) { seen.add(resolved); out.push(resolved); }
  }
  return out;
}

export function writeSaved(ids, storage = defaultStorage()) {
  const clean = [...new Set(ids.filter((x) => typeof x === 'string' && x.trim()))].slice(0, MAX_SAVED);
  try { storage?.setItem(KEY, JSON.stringify(clean)); } catch { /* */ }
  notify(clean);
  return clean;
}

export function isSaved(id, store = null, storage = defaultStorage()) {
  const real = store?.resolve ? store.resolve(id) ?? id : id;
  return readSaved(store, storage).includes(real);
}

export function toggleSaved(id, store = null, storage = defaultStorage()) {
  const real = store?.resolve ? store.resolve(id) ?? id : id;
  const cur = readSaved(store, storage);
  const exists = cur.includes(real);
  const next = exists ? cur.filter((x) => x !== real) : [real, ...cur];
  writeSaved(next, storage);
  return { saved: !exists, ids: next };
}

export function mergeSaved(ids, store = null, storage = defaultStorage()) {
  const cur = readSaved(store, storage);
  const resolved = ids.map((id) => (store?.resolve ? store.resolve(id) : id)).filter(Boolean);
  return writeSaved([...resolved, ...cur], storage);
}

export function clearSaved(storage = defaultStorage()) {
  return writeSaved([], storage);
}

export function parseSharedIds(params, store) {
  const raw = params?.get('ids') ?? '';
  if (!raw.trim()) return [];
  const out = [];
  const seen = new Set();
  for (const part of raw.split(',')) {
    const id = store?.resolve ? store.resolve(part.trim()) : part.trim();
    if (id && !seen.has(id)) { seen.add(id); out.push(id); }
  }
  return out.slice(0, MAX_SAVED);
}

export function shareCollectionUrl(ids, baseHref = typeof location !== 'undefined' ? location.href.split('#')[0] : '') {
  const clean = [...new Set(ids.filter(Boolean))].slice(0, MAX_SAVED);
  return `${baseHref}#/collection${clean.length ? `?ids=${clean.map(encodeURIComponent).join(',')}` : ''}`;
}

export function initFavoritesBadge(store) {
  const badge = document.querySelector('[data-fav-count]');
  if (!badge) return;
  const sync = () => {
    const n = readSaved(store).length;
    badge.textContent = String(n);
    badge.hidden = n === 0;
  };
  sync();
  window.addEventListener('atlas-favorites', sync);
  window.addEventListener('storage', (e) => { if (e.key === KEY) sync(); });
}
