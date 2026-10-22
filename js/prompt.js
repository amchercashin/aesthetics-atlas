// «Нарисовать с ИИ»: промт для генератора картинок из данных карточки. Чистые функции без DOM;
// случайность приходит снаружи (rng), поэтому сборку можно проверить тестами.
// Признаки и палитра — только из карточки. Ссылки на изображения в промт не идут: генераторы надёжнее понимают слова.

export const PROMPT_LIMIT = 600;
const MAX_TRAITS = 5;
const MIN_TRAITS = 3;

const isAuthor = (s) => (s.kind ?? []).includes('author-style');

// Строчная первая буква, если это обычное слово или однобуквенный предлог («В»): «3D», «CRT» не трогаем.
function lower(t) {
  const text = String(t).trim().replace(/[.;,\s]+$/, '');
  const m = /^([«"„(]*)(\p{Lu})(\p{L}?)/u.exec(text);
  if (!m || (m[3] && !/\p{Ll}/u.test(m[3]))) return text;
  const i = m[1].length;
  return text.slice(0, i) + text[i].toLowerCase() + text.slice(i + 1);
}

const quote = (name) => (/^«.*»$/.test(name) ? name : `«${name.replace(/«/g, '„').replace(/»/g, '“')}»`);

// Основы имён авторов: без двух последних букв, чтобы ловить падежи («Хокусая», «Билибина»).
function nameStems(s) {
  return (s.creators ?? []).flatMap((c) => [c.name, c.orig, ...(c.aliases ?? [])])
    .flatMap((n) => String(n ?? '').split(/[^\p{L}]+/u))
    .filter((w) => w.length >= 3 && /^\p{Lu}/u.test(w))
    .map((w) => (w.length > 5 ? w.slice(0, -2) : w));
}
const mentions = (text, stems) => text.split(/[^\p{L}]+/u).some((w) => stems.some((st) => w.startsWith(st)));

// Название авторской карточки содержит имя автора, поэтому промт опирается на традицию или эпоху:
// первую связанную неавторскую карточку (контекст, затем предок), иначе — на эпоху.
export function styleAnchor(store, s) {
  if (!isAuthor(s)) return null;
  const linked = [...(s.contexts ?? []).filter((c) => c.direction !== 'in'), ...(s.parents ?? [])]
    .map((r) => store.get(r.id))
    .find((o) => o && !isAuthor(o));
  if (linked) return quote(linked.name);
  const era = store.era(s.era);
  return era ? `эпохи ${quote(era.name)}` : null;
}

// Не длиннее limit: сначала убираем признаки с конца (до трёх), затем палитру, затем режем последний признак по слову.
export function buildPrompt(s, subject, { anchor = null, limit = PROMPT_LIMIT } = {}) {
  const author = isAuthor(s);
  const stems = author ? nameStems(s) : [];
  const head = author
    ? `Нарисуй ${subject}${anchor ? ` в духе ${anchor}` : ''}`
    : `Нарисуй ${subject} в стиле ${quote(s.name)}`;
  let traits = (s.traits ?? []).map(lower).filter((t) => t && !mentions(t, stems)).slice(0, MAX_TRAITS);
  let palette = s.palette?.colors?.length ? ` Палитра: ${s.palette.colors.join(', ')}.` : '';
  const compose = () => `${head}${traits.length ? `: ${traits.join('; ')}` : ''}.${palette}`;

  while (compose().length > limit && traits.length > MIN_TRAITS) traits = traits.slice(0, -1);
  if (compose().length > limit) palette = '';
  if (compose().length > limit && traits.length) {
    const budget = limit - head.length - ': '.length - '….'.length;
    const text = traits.join('; ').slice(0, Math.max(0, budget + 1));
    const cut = text.slice(0, Math.max(0, text.lastIndexOf(' '))).replace(/[\s;,:—-]+$/u, '');
    return cut ? `${head}: ${cut}….` : `${head}.`;
  }
  return compose();
}

export const promptFor = (store, s, subject) => buildPrompt(s, subject, { anchor: styleAnchor(store, s) });

export const chatgptUrl = (prompt) => `https://chatgpt.com/?q=${encodeURIComponent(prompt)}`;

// Случайный элемент, отличный от предыдущего (если есть из чего выбрать).
export function pickOther(list, rng = Math.random, prev = undefined) {
  if (!list.length) return null;
  const pool = list.length > 1 ? list.filter((x) => x !== prev) : list;
  return pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))];
}
