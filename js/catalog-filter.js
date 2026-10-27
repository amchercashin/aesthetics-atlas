// Фильтры каталога: чистые функции, чтобы отбор, счётчики и адрес проверялись тестами (test/catalog-filter.test.mjs).
import { DOMAIN, KIND_FAMILY, SUBJECT, MEDIUM } from './format.js?v=subjects-1';

// Каждый ряд фильтров — одно условие на карточку. Эпохи — отдельно: их можно выбрать несколько.
const TESTS = {
  domain: (s, v) => s.domain.includes(v),
  family: (s, v) => KIND_FAMILY[v].kinds.includes(s.kind[0]), // по основному типу (первому в списке kind)
  subject: (s, v) => s.subjects.includes(v),
  medium: (s, v) => s.medium.includes(v),
};
// Ключи адреса: d — область, k — тип карточки, t — сюжет, m — техника, e — эпохи через запятую, sort=az.
const PARAM = { domain: 'd', family: 'k', subject: 't', medium: 'm' };
const DICT = { domain: DOMAIN, family: KIND_FAMILY, subject: SUBJECT, medium: MEDIUM };

export const emptyState = () => ({ domain: '', family: '', subject: '', medium: '', eras: new Set(), sort: 'time' });

// Неизвестное значение в адресе не выбирает ничего, а не оставляет пустой список.
export function readState(params) {
  const st = emptyState();
  for (const [key, p] of Object.entries(PARAM)) {
    const v = params.get(p) ?? '';
    if (Object.hasOwn(DICT[key], v)) st[key] = v;
  }
  st.eras = new Set((params.get('e') || '').split(',').filter(Boolean));
  if (params.get('sort') === 'az') st.sort = 'az';
  return st;
}

export function stateParams(st) {
  const out = Object.fromEntries(Object.entries(PARAM).map(([key, p]) => [p, st[key]]));
  return { ...out, e: [...st.eras].join(','), sort: st.sort === 'az' ? 'az' : '' };
}

export const isFiltered = (st) => Object.keys(PARAM).some((key) => st[key]) || st.eras.size > 0;

// skip — ряд, который не учитывается: так считаются его собственные чипы.
export function matches(s, st, skip = null) {
  for (const [key, test] of Object.entries(TESTS)) if (key !== skip && st[key] && !test(s, st[key])) return false;
  return skip === 'eras' || !st.eras.size || st.eras.has(s.era);
}

export const filterStyles = (styles, st) => styles.filter((s) => matches(s, st));

// Число на чипе: сколько стилей покажет каталог, если выбрать это значение при остальных фильтрах.
export function facetCounts(styles, st, key) {
  const pool = styles.filter((s) => matches(s, st, key));
  return new Map(Object.keys(DICT[key]).map((v) => [v, pool.filter((s) => TESTS[key](s, v)).length]));
}
