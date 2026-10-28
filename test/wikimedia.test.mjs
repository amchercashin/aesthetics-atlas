// Разбор ответов Wikimedia без сети: сбой API не должен попадать в кэш как «файла нет».
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { apiProblem, fileStatus, cleanArtist, THUMB_WIDTHS } from '../scripts/lib/wikimedia.mjs';

const page = (title, extra = {}) => ({ title: `File:${title}`, ...extra });
const info = { url: 'https://upload.wikimedia.org/x.jpg', thumburl: 'https://upload.wikimedia.org/t.jpg' };
// Один и тот же ответ на все ширины превью.
const all = (resp) => Object.fromEntries(THUMB_WIDTHS.map((w) => [w, resp]));

test('an API error or a response without the expected section is a failed request', () => {
  assert.equal(apiProblem({ query: { pages: [] } }), null);
  assert.equal(apiProblem({ entities: {} }, 'entities'), null);
  assert.match(apiProblem({ error: { code: 'ratelimited', info: 'too many' } }), /ratelimited: too many/);
  assert.match(apiProblem({ batchcomplete: true }), /no "query"/);
  assert.match(apiProblem({ query: {} }, 'entities'), /no "entities"/);
  assert.match(apiProblem(null), /no "query"/);
});

test('a file is missing only when the API says so', () => {
  assert.equal(fileStatus('A.jpg', all({ query: { pages: [page('A.jpg', { imageinfo: [info] })] } })), 'ok');
  assert.equal(fileStatus('A.jpg', all({ query: { pages: [page('A.jpg', { missing: true })] } })), 'missing');
  assert.equal(fileStatus('A.jpg', all({ query: { pages: [page('A.jpg', { invalid: true })] } })), 'missing');
  // Файл с Commons, запрошенный через en.wikipedia: missing, но с imageinfo — валидный.
  assert.equal(fileStatus('A.jpg', all({ query: { pages: [page('A.jpg', { missing: true, imageinfo: [info] })] } })), 'ok');
  // Обрезанный ответ: страница есть, imageinfo нет, отсутствие не подтверждено.
  assert.equal(fileStatus('A.jpg', all({ query: { pages: [page('A.jpg')] } })), 'retry');
  // Страницы нет в ответе вовсе.
  assert.equal(fileStatus('A.jpg', all({ query: { pages: [] } })), 'retry');
  // Превью одной из ширин не пришло — без него вместо превью встал бы оригинал.
  const partial = all({ query: { pages: [page('A.jpg', { imageinfo: [info] })] } });
  partial[THUMB_WIDTHS.at(-1)] = { query: { pages: [page('A.jpg')] } };
  assert.equal(fileStatus('A.jpg', partial), 'retry');
});

test('file titles are matched through API normalization', () => {
  const resp = { query: { normalized: [{ from: 'File:A_b.jpg', to: 'File:A b.jpg' }], pages: [page('A b.jpg', { imageinfo: [info] })] } };
  assert.equal(fileStatus('A_b.jpg', all(resp)), 'ok');
});

test('service strings in the Artist field become a plain statement or nothing', () => {
  assert.equal(cleanArtist('Unknown authorUnknown author'), 'автор неизвестен');
  assert.equal(cleanArtist('Unknown artistUnknown artist'), 'автор неизвестен');
  assert.equal(cleanArtist('anonymous'), 'автор неизвестен');
  assert.equal(cleanArtist('Anonymous (Moche culture)Unknown author'), 'Anonymous (Moche culture)');
  assert.equal(cleanArtist('photo of 2D work more than 100 years old'), null);
  assert.equal(cleanArtist('  '), null);
  assert.equal(cleanArtist(null), null);
  assert.equal(cleanArtist('No machine-readable author provided. Soman assumed (based on copyright claims).'), 'Soman (предположительно)');
  assert.equal(cleanArtist('No machine-readable author provided. Borowski~commonswiki assumed (based on copyright claims).'), 'Borowski (предположительно)');
  assert.equal(cleanArtist('[https://www.flickr.com/people/72746018@N00 Jean-Pierre Dalbéra] from Paris, France'), 'Jean-Pierre Dalbéra from Paris, France');
  assert.equal(cleanArtist('https://www.flickr.com/people/sweet_child_of_mine/'), 'sweet_child_of_mine');
  assert.equal(cleanArtist('http://en.wikipedia.org/wiki/User:I%40n'), 'I@n');
  // Обычные имена не трогаем.
  assert.equal(cleanArtist('Museo de Altamira y D. Rodríguez'), 'Museo de Altamira y D. Rodríguez');
  assert.equal(cleanArtist('Anonymous folk artist'), 'Anonymous folk artist');
  assert.equal(cleanArtist('Unknown artisan from the village of Dong Ho.'), 'Unknown artisan from the village of Dong Ho.');
});
