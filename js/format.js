// Форматирование дат, подписей и множественного числа.
export const NOW = new Date().getFullYear();

const group = (n) => (Math.abs(n) >= 10000 ? String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') : String(Math.abs(n)));

export function fmtYear(y, { short = false } = {}) {
  if (y == null) return 'наши дни';
  if (y < 0) return `${group(y)}${short ? ' до н. э.' : ' до н. э.'}`;
  return String(y);
}

export function fmtDates(s) {
  if (s.dates) return s.dates;
  if (s.start < 0 && s.end != null && s.end < 0) return `${group(s.start)} – ${group(s.end)} до н. э.`;
  return `${fmtYear(s.start)} – ${s.end == null ? 'наши дни' : fmtYear(s.end)}`;
}

export const RELATION = {
  evolved: { label: 'развитие', from: 'вырос из', to: 'развился в' },
  influence: { label: 'влияние', from: 'под влиянием', to: 'повлиял на' },
  reaction: { label: 'реакция', from: 'реакция на', to: 'вызвал реакцию' },
  revival: { label: 'возрождение', from: 'возрождает', to: 'возрождён в' },
};

export const REL_STATUS = { verified: 'подтверждено', unverified: 'не проверено' };

// Что сверено в карточке (review.scope), в порядке показа.
export const REVIEW_SCOPE = { relations: 'связи', dates: 'даты', text: 'описание', corpus: 'корпус работ', images: 'главная иллюстрация', gallery: 'галерея' };
// «связи, даты и описание»
export const reviewScopeText = (scope = []) => {
  const list = Object.keys(REVIEW_SCOPE).filter((k) => scope.includes(k)).map((k) => REVIEW_SCOPE[k]);
  return list.length > 1 ? `${list.slice(0, -1).join(', ')} и ${list.at(-1)}` : list[0] ?? '';
};

// Тип карточки: что именно описывает карточка.
export const KIND = {
  overview: 'Обзор',
  tradition: 'Традиция',
  period: 'Период',
  movement: 'Движение',
  school: 'Школа или группа',
  technique: 'Техника, метод',
  'design-system': 'Дизайн-подход',
  'internet-aesthetic': 'Интернет-эстетика',
  trend: 'Тренд',
  'author-style': 'Авторский визуальный язык',
};
export const KIND_DESC = {
  overview: 'обзор цивилизации, региона или эпохи, объединяющий несколько самостоятельных традиций',
  tradition: 'долгая региональная или культурная традиция без единой программы',
  period: 'стиль периода, выделенный историками задним числом',
  movement: 'направление с участниками, манифестами или самоназванием',
  school: 'школа, группа или институция',
  technique: 'техника или метод создания изображений, а не стиль',
  'design-system': 'дизайн-подход или система интерфейса',
  'internet-aesthetic': 'эстетика, сложившаяся и названная в интернет-сообществах',
  trend: 'короткая волна моды, рекламы и соцсетей',
  'author-style': 'различимый язык ограниченного корпуса работ автора, мастерской или коллектива',
};
// Семейства для фильтра каталога: история искусства и дизайна, техники, интернет-тренды.
export const KIND_FAMILY = {
  history: { label: 'Традиции и периоды', kinds: ['overview', 'tradition', 'period'] },
  movements: { label: 'Движения и школы', kinds: ['movement', 'school'] },
  methods: { label: 'Техники и дизайн-подходы', kinds: ['technique', 'design-system'] },
  online: { label: 'Интернет-эстетики и тренды', kinds: ['internet-aesthetic', 'trend'] },
  authors: { label: 'Авторские языки', kinds: ['author-style'] },
};
export const CONTEXT = {
  'member-of': { label: 'школа или среда', out: 'В контексте', in: 'Практика в этом контексте' },
  'uses-technique': { label: 'применение техники', out: 'Применяет', in: 'Техника в практике' },
  'related-context': { label: 'культурный контекст', out: 'Связанная практика', in: 'Связанная практика' },
};
export const LABEL = { historical: 'Историческое название', 'self-designation': 'Самоназвание', 'editorial-scope-title': 'Редакционное название выбранного корпуса' };
export const MATURITY = { established: 'Сложившаяся практика', emerging: 'Формирующаяся практика', contested: 'Границы практики обсуждаются' };
export const DATE_KIND = {
  archaeological: 'по археологическим датировкам',
  period: 'периодизация историков',
  institution: 'годы существования группы или институции',
  practice: 'документированная практика',
  popularity: 'период популярности',
  corpus: 'даты выбранного корпуса; не начало и конец традиции',
};
// Роль изображения: всё, кроме обычного произведения своего времени, помечается явно.
export const ROLE = {
  precursor: 'Предтеча',
  revival: 'Позднее возрождение',
  reconstruction: 'Реконструкция',
  illustration: 'Современная иллюстрация',
  portrait: 'Портрет автора',
};
export const roleLabel = (role) => ROLE[role] ?? null;

export const DOMAIN = {
  art: 'Искусство',
  architecture: 'Архитектура',
  design: 'Дизайн',
  internet: 'Интернет и цифра',
};

// Сюжеты, характерные для стиля (поле subjects), в порядке фильтра каталога.
export const SUBJECT = {
  landscape: 'Пейзаж',
  portrait: 'Портрет',
  'still-life': 'Натюрморт',
  'everyday-life': 'Бытовые сцены',
  city: 'Город и архитектура',
  'religion-myth': 'Религия и мифы',
  animals: 'Животные',
  ornament: 'Орнамент и узор',
  abstraction: 'Абстракция',
  figure: 'Фигура и тело',
};

// Техника (поле medium): от изобразительных искусств к ремёслам, дизайну и цифре; узкие — в конце.
// В свёрнутом ряду каталога видно начало списка, поэтому скульптура и рельеф стоят рано.
export const MEDIUM = {
  painting: 'Живопись',
  drawing: 'Рисунок',
  print: 'Печатная графика',
  illustration: 'Иллюстрация',
  sculpture: 'Скульптура',
  relief: 'Рельеф',
  architecture: 'Архитектура',
  interior: 'Интерьер',
  'decorative-arts': 'Декоративное искусство',
  ceramics: 'Керамика',
  textile: 'Текстиль',
  metalwork: 'Металл',
  fashion: 'Мода',
  'graphic-design': 'Графический дизайн',
  typography: 'Типографика',
  'product-design': 'Предметный дизайн',
  photography: 'Фотография',
  'moving-image': 'Кино и анимация',
  installation: 'Инсталляция',
  'digital-art': 'Цифровое искусство',
  ui: 'Интерфейсы',
  web: 'Веб',
  manuscript: 'Рукописная книга',
  'rock-art': 'Наскальное искусство',
};

export function plural(n, one, few, many) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
}
