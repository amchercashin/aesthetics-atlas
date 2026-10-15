export const LINK_MODES = { none: 'Без связей', main: 'Основные', all: 'Все связи' };

export function readLinkSettings(params) {
  const requested = params.get('links');
  const legacyAll = params.get('cmp') === '1' || params.get('contexts') === '1';
  return {
    mode: Object.hasOwn(LINK_MODES, requested) ? requested : legacyAll ? 'all' : 'main',
    verifiedOnly: params.get('rel') === 'verified',
  };
}

export function historicalLinkVisible({ mode, primary, highlighted = false, verifiedOnly = false, status, filtered = false }) {
  if (mode === 'none' || filtered || (verifiedOnly && status !== 'verified')) return false;
  return mode === 'all' || primary || highlighted;
}
