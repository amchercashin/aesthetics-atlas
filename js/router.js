// Hash-роутер: #/, #/map, #/timeline, #/catalog, #/s/<id>, #/about. Параметры — после «?».
export function parseHash(hash = location.hash) {
  if (hash && !hash.startsWith('#/')) hash = '';
  const h = hash.replace(/^#/, '') || '/';
  const [path, query = ''] = h.split('?');
  const params = new URLSearchParams(query);
  const parts = path.split('/').filter(Boolean);
  if (!parts.length) return { view: 'home', params };
  if (parts[0] === 's' && parts[1]) return { view: 'style', id: decodeURIComponent(parts[1]), params };
  if (['map', 'timeline', 'catalog', 'about'].includes(parts[0])) return { view: parts[0], params };
  return { view: 'notfound', params };
}

// Обновить параметры текущего адреса без новой записи в истории и без перерисовки вида.
export function replaceParams(view, params) {
  const q = new URLSearchParams(params);
  for (const [k, v] of [...q]) if (v === '' || v == null) q.delete(k);
  const s = q.toString();
  history.replaceState(null, '', `#/${view}${s ? '?' + s : ''}`);
}
