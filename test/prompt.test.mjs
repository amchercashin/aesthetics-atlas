// Промт «Нарисовать с ИИ»: сборка из данных карточки, лимит длины, авторские карточки без имён, ссылка в ChatGPT.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import yaml from 'js-yaml';
import { createStore } from '../js/store.js';
import { buildPrompt, promptFor, styleAnchor, chatgptUrl, shedevrumUrl, pickOther, surprisePool, PROMPT_LIMIT } from '../js/prompt.js';
import { validatePromptSubjects } from '../scripts/lib/validate.mjs';

const subjects = yaml.load(fs.readFileSync(new URL('../content/prompt-subjects.yaml', import.meta.url), 'utf8'));
const atlas = JSON.parse(fs.readFileSync(new URL('../data/atlas.json', import.meta.url)));
const real = createStore(atlas);

const card = (over = {}) => ({
  id: 'impressionism', name: 'Импрессионизм', kind: ['movement'], era: 'xix',
  traits: ['Короткие раздельные мазки.', 'Свет важнее контура', 'Пленэр'],
  palette: { colors: ['#aabbcc', '#112233'] }, creators: [], parents: [], contexts: [], ...over,
});

// Фикстура для авторских карточек: одна связана с традицией, другая — ни с чем.
function authorStore() {
  const base = { era: 'fin', traits: ['Контурная линия держит силуэт'], palette: { colors: ['#102030'] }, parents: [], contexts: [], creators: [], example: { img: null }, gallery: [] };
  const styles = [
    { ...base, id: 'ukiyo-e', name: 'Укиё-э', kind: ['tradition'] },
    { ...base, id: 'hokusai', name: 'Пейзажные гравюры Хокусая', kind: ['author-style'],
      creators: [{ name: 'Кацусика Хокусай', orig: 'Katsushika Hokusai', aliases: [] }],
      contexts: [{ id: 'ukiyo-e', type: 'member-of', direction: 'out' }],
      traits: ['Крупный передний план и малая дальняя Фудзи', 'Волна Хокусая как главный мотив', 'Дуги и диагонали'] },
    { ...base, id: 'bilibin', name: 'Книжная графика Ивана Билибина', kind: ['author-style'],
      creators: [{ name: 'Иван Яковлевич Билибин', orig: 'Ivan Bilibin', aliases: [] }] },
  ].map((s, order) => ({ ...s, order, children: [] }));
  return createStore({ styles, eras: [{ id: 'fin', name: 'Рубеж веков' }] });
}

test('the prompt names the subject, the style and its traits', () => {
  assert.equal(buildPrompt(card(), 'маяк на скале'),
    'Нарисуй маяк на скале в стиле «Импрессионизм»: короткие раздельные мазки; свет важнее контура; пленэр.');
});

test('the palette never enters the prompt: hex codes are image statistics, not the style', () => {
  const p = buildPrompt(card(), 'чайник');
  assert.ok(!p.includes('#') && !/палитр/i.test(p), p);
});

test('visual promptCues replace traits when the card has them', () => {
  const p = buildPrompt(card({ promptCues: ['Дробный мазок чистого цвета', 'Цветные тени', 'Мерцающий воздух'] }), 'чайник');
  assert.equal(p, 'Нарисуй чайник в стиле «Импрессионизм»: дробный мазок чистого цвета; цветные тени; мерцающий воздух.');
});

test('without traits the prompt still builds on the name alone', () => {
  assert.equal(buildPrompt(card({ traits: [] }), 'чайник'), 'Нарисуй чайник в стиле «Импрессионизм».');
});

test('acronyms and quoted words keep their meaning when lowercased', () => {
  const p = buildPrompt(card({ traits: ['3D-графика', 'CRT-мерцание', '«Архаическая улыбка»', 'В выбранных вещах — пары'], palette: null }), 'чайник');
  assert.match(p, /: 3D-графика; CRT-мерцание; «архаическая улыбка»; в выбранных вещах — пары\.$/);
});

test('a name already in quotes is not quoted twice', () => {
  assert.match(buildPrompt(card({ name: '«Мир искусства»', traits: [] }), 'чайник'), /в стиле «Мир искусства»\./);
});

test('at most five traits are used', () => {
  const p = buildPrompt(card({ traits: ['а1', 'а2', 'а3', 'а4', 'а5', 'а6', 'а7'], palette: null }), 'чайник');
  assert.match(p, /а5\.$/);
  assert.ok(!p.includes('а6'));
});

test('a long card is trimmed: traits down to three, then the last trait at a word', () => {
  const long = (n) => `признак ${n} ` + 'очень длинное описание '.repeat(4).trim();
  const many = card({ traits: [1, 2, 3, 4, 5].map(long) });
  const p1 = buildPrompt(many, 'чайник', { limit: 400 });
  assert.ok(p1.length <= 400, p1.length);
  assert.ok(p1.includes('признак 3') && !p1.includes('признак 4'), p1);

  const p3 = buildPrompt(many, 'чайник', { limit: 200 });
  assert.ok(p3.length <= 200, p3.length);
  assert.match(p3, /^Нарисуй чайник в стиле «Импрессионизм»: признак 1 .*[а-я]…\.$/);
});

test('an author-style card is drawn after its tradition, never by its name or its creator', () => {
  const store = authorStore();
  const s = store.get('hokusai');
  assert.equal(styleAnchor(store, s), '«Укиё-э»');
  const p = promptFor(store, s, 'маяк на скале');
  assert.equal(p, 'Нарисуй маяк на скале в духе «Укиё-э»: крупный передний план и малая дальняя Фудзи; дуги и диагонали.');
  assert.ok(!p.includes('Хокус'));
});

test('an author-style card without links falls back to its era', () => {
  const store = authorStore();
  const p = promptFor(store, store.get('bilibin'), 'чайник');
  assert.equal(p, 'Нарисуй чайник в духе эпохи «Рубеж веков»: контурная линия держит силуэт.');
  assert.equal(styleAnchor(store, store.get('ukiyo-e')), null);
});

test('the anchor drops service tails such as «: обзор» from the linked card name', () => {
  const store = authorStore();
  store.get('ukiyo-e').name = 'Графика Торресова пролива: обзор';
  assert.equal(styleAnchor(store, store.get('hokusai')), '«Графика Торресова пролива»');
  for (const s of real.styles) assert.ok(!/:\s*обзор/i.test(styleAnchor(real, s) ?? ''), s.id);
});

test('«Удиви меня» never picks an author-style card; the hall still offers the block', () => {
  const pool = surprisePool(real.styles);
  assert.ok(pool.length > 0 && pool.every((s) => !s.kind.includes('author-style')));
  assert.equal(pool.length, real.styles.filter((s) => !s.kind.includes('author-style')).length);
  const author = real.styles.find((s) => s.kind.includes('author-style'));
  assert.ok(promptFor(real, author, 'чайник').startsWith('Нарисуй чайник'));
});

test('the ChatGPT link carries the prompt URL-encoded', () => {
  const p = buildPrompt(card(), 'городскую улицу под дождём');
  const url = chatgptUrl(p);
  assert.ok(url.startsWith('https://chatgpt.com/?q='), url);
  assert.equal(new URL(url).searchParams.get('q'), p);
  assert.ok(!/[\s#«»;:&]/.test(url.slice('https://chatgpt.com/?q='.length)), url);
  assert.equal(url, `https://chatgpt.com/?q=${encodeURIComponent(p)}`);
});

test('the Shedevrum link opens its text-to-image form with the prompt filled in', () => {
  const p = buildPrompt(card(), 'городскую улицу под дождём');
  const url = shedevrumUrl(p);
  assert.ok(url.startsWith('https://shedevrum.ai/text-to-image/?prompt='), url);
  assert.equal(new URL(url).searchParams.get('prompt'), p);
  // Поле запроса в Шедевруме принимает до 1000 знаков (maxlength, проверено 22.10.2026).
  assert.ok(PROMPT_LIMIT <= 1000);
});

test('another variant never repeats the previous one', () => {
  const list = ['а', 'б', 'в'];
  for (const r of [0, 0.34, 0.5, 0.99]) assert.notEqual(pickOther(list, () => r, 'а'), 'а');
  assert.equal(pickOther(['а'], () => 0.5, 'а'), 'а');
  assert.equal(pickOther([], () => 0.5), null);
});

test('the subject list is 40–60 unique lowercase phrases', () => {
  assert.deepEqual(validatePromptSubjects(subjects), []);
  assert.ok(validatePromptSubjects(['кота', 'кота']).length > 0);
  assert.ok(validatePromptSubjects(Array.from({ length: 10 }, (_, i) => `предмет ${i}`)).length > 0);
  assert.ok(validatePromptSubjects(Array.from({ length: 45 }, (_, i) => (i ? `предмет ${i}` : 'Кот.'))).length > 0);
  assert.deepEqual(real.promptSubjects, subjects, 'data/atlas.json собран из актуального content/prompt-subjects.yaml');
});

test('every card with every subject fits the limit', () => {
  for (const s of real.styles) {
    for (const subj of subjects) {
      const p = promptFor(real, s, subj);
      assert.ok(p.length <= PROMPT_LIMIT, `${s.id}: ${p.length}`);
      assert.ok(p.startsWith(`Нарисуй ${subj} в `), `${s.id}: ${p}`);
      assert.ok(!p.includes('#'), `${s.id}: ${p}`);
      assert.ok(!/:\s*обзор»/i.test(p), `${s.id}: ${p}`);
    }
  }
});

test('no author-style prompt carries the card name or a creator name', () => {
  // Основы слов имени: без двух последних букв, чтобы ловить падежи («Хокусая», «Билибина»).
  const stems = (s) => s.creators.flatMap((c) => [c.name, c.orig, ...(c.aliases ?? [])])
    .flatMap((n) => String(n ?? '').split(/[^\p{L}]+/u))
    .filter((w) => w.length >= 3 && /^\p{Lu}/u.test(w))
    .map((w) => (w.length > 5 ? w.slice(0, -2) : w));
  const authors = real.styles.filter((s) => s.kind.includes('author-style'));
  assert.ok(authors.length >= 10, 'в атласе есть авторские карточки');
  for (const s of authors) {
    const st = stems(s);
    assert.ok(st.length, `${s.id}: у авторской карточки есть creators`);
    for (const subj of subjects) {
      const p = promptFor(real, s, subj);
      assert.ok(!p.includes(s.name), `${s.id}: ${p}`);
      const words = p.split(/[^\p{L}]+/u);
      for (const stem of st) assert.ok(!words.some((w) => w.startsWith(stem)), `${s.id}: «${stem}» в «${p}»`);
    }
  }
});
