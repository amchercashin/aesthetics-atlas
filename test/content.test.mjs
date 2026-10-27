// Проверки настоящего контента (content/*.yaml) без сети: структура, синхронность чисел, старые адреса.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { validate, SUBJECTS, MEDIUMS } from '../scripts/lib/validate.mjs';
import { buildRecord } from '../scripts/lib/record.mjs';
import { createStore } from '../js/store.js';
import { buildIndex, search } from '../js/search.js';
import { SUBJECT, MEDIUM } from '../js/format.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => yaml.load(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const eras = read('content/eras.yaml');
const sources = read('content/sources.yaml');
const styles = fs.readdirSync(path.join(ROOT, 'content/styles')).filter((f) => f.endsWith('.yaml')).sort()
  .flatMap((f) => read(`content/styles/${f}`));

test('content passes structural validation', () => {
  const { errors } = validate(styles, eras, sources);
  assert.deepEqual(errors, []);
});

test('card count in README matches the data', () => {
  const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
  const m = /(\d+)\s+карточ/.exec(readme);
  assert.ok(m, 'README должен называть число карточек');
  assert.equal(Number(m[1]), styles.length);
});

test('the earliest era starts no later than the earliest card', () => {
  const earliest = Math.min(...styles.map((s) => s.start));
  assert.ok(eras[0].start <= earliest, `${eras[0].start} > ${earliest}`);
});

test('images described as precursors, reconstructions or renders carry a matching role', () => {
  const marked = /предтеч|реконструкц|визуализац|современн\w* иллюстрац/i;
  for (const s of styles) {
    for (const im of [s.example, ...(s.gallery ?? [])].filter(Boolean)) {
      const text = [im.note, im.title, im.whyRepresentative].filter(Boolean).join(' ');
      if (marked.test(text) && im.file) assert.notEqual(im.role ?? 'work', 'work', `[${s.id}] «${im.title}»`);
    }
  }
});

// Миниатюра карточки — картинка примера, а если её нельзя встроить, первая встраиваемая картинка галереи
// (как thumb() в js/ui/common.js). Одна и та же миниатюра у двух карточек сбивает с толку в каталоге и на карте.
test('card thumbnails are not repeated across cards', () => {
  const embeds = (im) => (im?.file || im?.asset) && im.rights?.embed !== false;
  const key = (im) => String(im.file ?? im.asset).replace(/^File:/i, '').replace(/_/g, ' ').trim().toLowerCase();
  const owner = new Map();
  for (const s of styles) {
    const cover = embeds(s.example) ? s.example : (s.gallery ?? []).find(embeds);
    if (!cover) continue;
    const k = key(cover);
    assert.ok(!owner.has(k), `[${s.id}] повторяет миниатюру [${owner.get(k)}]: ${cover.file ?? cover.asset}`);
    owner.set(k, s.id);
  }
});

test('old URLs keep working: former ids resolve and split overviews keep their id', () => {
  const store = createStore({ eras, styles: styles.map((s, i) => ({ ...buildRecord(s), order: i })) });
  assert.ok(store.get('mesoamerican-art'), 'mesoamerican-art must stay addressable');
  for (const s of styles) for (const f of s.formerIds ?? []) assert.equal(store.resolve(f), s.id);
});

test('search still finds terms moved from aliases to searchKeywords', () => {
  const index = buildIndex(styles.map((s) => buildRecord(s)));
  assert.equal(search(index, 'неоморфизм')[0]?.style.id, 'glassmorphism');
  assert.equal(search(index, 'Backrooms')[0]?.style.id, 'liminal-space');
  assert.ok(search(index, 'Дюшан').some((r) => r.style.id === 'dada'));
  for (const [query, id] of [['Гэндзи-моногатари', 'yamato-e'], ['Ротко', 'color-field'], ['Alegria', 'corporate-memphis'], ['Y3K', 'alien-core'], ['плоттерная графика', 'computer-art'], ['Metro', 'flat-design']]) {
    assert.ok(search(index, query).some(r => r.style.id === id), query);
  }
});

test('macro-region rules: spread vs origin, multi-region and nothing unclassified', async () => {
  const { macroRegions } = await import('../scripts/lib/regions.mjs');
  assert.deepEqual(macroRegions('Франция, затем весь мир'), ['europe']);
  assert.deepEqual(macroRegions('США, Африка'), ['africa', 'americas']);
  assert.deepEqual(macroRegions('Филиппины; США'), ['se-asia', 'americas']);
  assert.deepEqual(macroRegions('Польша: Лович и Курпе'), ['europe']);
  assert.deepEqual(macroRegions('Вьетнам: деревня Донгхо, север страны'), ['se-asia']);
  assert.deepEqual(macroRegions('Иле-Ифе, йоруба, Нигерия'), ['africa']);
  assert.deepEqual(macroRegions('Изник, Османская Анатолия; современная Турция'), ['mena']);
  assert.deepEqual(macroRegions('Интернет'), ['global']);
  for (const s of styles) assert.ok(!macroRegions(s.region).includes('unknown'), `[${s.id}] ${s.region}`);
});

test('every tier-1 card has visual promptCues without names of artists', () => {
  const tier1 = styles.filter((s) => s.tier === 1);
  assert.ok(tier1.length > 0);
  for (const s of tier1) {
    assert.ok(Array.isArray(s.promptCues) && s.promptCues.length >= 3 && s.promptCues.length <= 4, `${s.id}: promptCues`);
    // Подсказки чисто визуальные: ни имён из «Ключевых имён», ни авторов.
    const stems = [...(s.names ?? []), ...(s.creators ?? []).map((c) => c.name)]
      .flatMap((n) => String(n).split(/[^\p{L}]+/u))
      .filter((w) => w.length >= 4 && /^\p{Lu}/u.test(w))
      .map((w) => (w.length > 5 ? w.slice(0, -2) : w));
    for (const cue of s.promptCues) {
      const words = cue.split(/[^\p{L}]+/u);
      for (const st of stems) assert.ok(!words.some((w) => w.startsWith(st)), `${s.id}: «${st}» в «${cue}»`);
    }
  }
});

test('every review lists its scope, and no gallery is claimed as checked yet', () => {
  for (const s of styles.filter((x) => x.review)) {
    assert.ok(Array.isArray(s.review.scope) && s.review.scope.length, `${s.id} review.scope`);
    // Галереи добавлены 17–18.10.2026, после всех сверок; снять это условие, когда их сверят.
    assert.ok(!s.review.scope.includes('gallery'), `${s.id} gallery is not reviewed yet`);
  }
});

// Каталог фильтрует по сюжету и технике: каждая карточка явно размечена. Стиль либо привязан к своим
// сюжетам, либо помечен any (универсальный), либо и то и другое; medium нужен, чтобы находились «все рельефы».
test('every card states its subjects (from the vocabulary, at least any) and its technique', () => {
  for (const s of styles) {
    assert.ok(Array.isArray(s.subjects) && s.subjects.length > 0, `${s.id}: subjects — свои сюжеты или any`);
    for (const x of s.subjects) assert.ok(SUBJECTS.includes(x), `${s.id}: subject "${x}"`);
    const medium = [].concat(s.medium ?? []);
    assert.ok(medium.length > 0, `${s.id}: medium`);
    for (const m of medium) assert.ok(MEDIUMS.includes(m), `${s.id}: medium "${m}"`);
  }
  // Привязанных к своим сюжетам и универсальных — оба множества не пусты.
  assert.ok(styles.some((s) => !s.subjects.includes('any')) && styles.some((s) => s.subjects.includes('any')));
});

test('catalog labels cover exactly the validator vocabularies', () => {
  assert.deepEqual(Object.keys(SUBJECT).sort(), [...SUBJECTS].sort());
  assert.deepEqual(Object.keys(MEDIUM).sort(), [...MEDIUMS].sort());
});
