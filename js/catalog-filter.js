// Фильтры каталога: чистые функции, чтобы отбор, счётчики и адрес проверялись тестами (test/catalog-filter.test.mjs).
import { DOMAIN, KIND_FAMILY, SUBJECT, MEDIUM } from './format.js?v=subjects-1';
import { normalize } from './search.js?v=author-pilot';

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

// Слова, по которым поиск предлагает фильтр каталога: «барельефы» → техника «Рельеф», «пейзажи» → сюжет «Пейзаж».
// Основа совпадает с началом слова запроса, окончание — до трёх букв (у основ короче четырёх — до одной);
// основа из нескольких слов ищется в запросе целиком. Новое значение словаря требует своих основ (тест проверяет).
const STEMS = {
  subject: {
    landscape: ['пейзаж', 'landscape'],
    portrait: ['портрет', 'portrait'],
    'still-life': ['натюрморт', 'still life'],
    'everyday-life': ['быт', 'бытов', 'повседневн', 'жанров', 'genre', 'everyday'],
    city: ['город', 'городск', 'здани', 'city', 'cities', 'cityscape', 'urban'],
    'religion-myth': ['религи', 'религиозн', 'миф', 'мифов', 'мифолог', 'сакральн', 'библейск', 'religion', 'religious', 'myth', 'mytholog', 'sacred'],
    animals: ['животн', 'звер', 'зверин', 'animal'],
    ornament: ['орнамент', 'орнаментальн', 'узор', 'узорчат', 'паттерн', 'ornament', 'pattern'],
    abstraction: ['абстракц', 'абстрактн', 'беспредметн', 'abstract', 'abstraction'],
    figure: ['фигур', 'тело', 'тела', 'обнажен', 'ню', 'figure', 'body', 'nude'],
  },
  medium: {
    painting: ['живопис', 'painting'],
    drawing: ['рисун', 'drawing'],
    print: ['гравюр', 'печатн', 'эстамп', 'ксилограф', 'линогравюр', 'литограф', 'шелкограф', 'print', 'printmaking', 'woodcut', 'woodblock'],
    illustration: ['иллюстрац', 'illustration'],
    sculpture: ['скульптур', 'статуя', 'статуи', 'статуэтк', 'изваян', 'sculpture', 'statue'],
    relief: ['рельеф', 'барельеф', 'горельеф', 'relief'],
    architecture: ['архитектур', 'зодчеств', 'architecture'],
    interior: ['интерьер', 'interior'],
    'decorative-arts': ['декоративн', 'прикладн', 'decorative'],
    ceramics: ['керамик', 'фарфор', 'гончарн', 'майолик', 'ceramic', 'ceramics', 'pottery', 'porcelain'],
    textile: ['текстил', 'ткан', 'ткач', 'ткачеств', 'гобелен', 'textile', 'fabric'],
    metalwork: ['металл', 'металлическ', 'бронз', 'бронзов', 'metal', 'metalwork', 'bronze'],
    fashion: ['мода', 'моды', 'одежд', 'костюм', 'fashion'],
    'graphic-design': ['графический дизайн', 'плакат', 'постер', 'афиш', 'graphic design', 'poster'],
    typography: ['типограф', 'шрифт', 'typography', 'font'],
    'product-design': ['предметный дизайн', 'промышленный дизайн', 'мебел', 'product design', 'furniture'],
    photography: ['фото', 'фотограф', 'photo', 'photography'],
    'moving-image': ['кино', 'фильм', 'анимац', 'мультфильм', 'мультипликац', 'film', 'animation', 'movie'],
    installation: ['инсталляц', 'installation'],
    'digital-art': ['цифров', 'компьютерн', 'digital'],
    ui: ['интерфейс', 'ui', 'interface'],
    web: ['веб', 'сайт', 'web', 'website'],
    manuscript: ['рукопис', 'манускрипт', 'manuscript'],
    'rock-art': ['наскальн', 'петроглиф', 'rock art', 'petroglyph'],
  },
};
export const FACET_STEMS = STEMS;
const NORM_STEMS = Object.entries(STEMS).flatMap(([key, values]) =>
  Object.entries(values).flatMap(([v, stems]) => stems.map((stem) => ({ key, v, stem: normalize(stem) }))));
const stemFits = (stem, word) => word.startsWith(stem) && word.length - stem.length <= (stem.length < 4 ? 1 : 3)
  || (word.length >= 5 && stem.startsWith(word)); // слово ещё дописывают: «скульп»

// [{ key: 'medium', v: 'relief', label: 'Рельеф', href: '#/catalog?m=relief' }] — в порядке словарей, без повторов.
export function facetHits(query) {
  const q = normalize(query);
  const words = q.split(' ').filter(Boolean);
  if (!words.length) return [];
  const found = new Set(NORM_STEMS.filter(({ stem }) => (stem.includes(' ') ? q.includes(stem) : words.some((w) => stemFits(stem, w))))
    .map(({ key, v }) => `${key}:${v}`));
  return Object.entries(STEMS).flatMap(([key, values]) => Object.keys(values)
    .filter((v) => found.has(`${key}:${v}`))
    .map((v) => ({ key, v, label: DICT[key][v], href: `#/catalog?${PARAM[key]}=${v}` })));
}
