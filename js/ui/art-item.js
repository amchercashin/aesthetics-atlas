// Элемент лайтбокса: подпись работы, «Что здесь видно», источники подписи и сведения о файле
// (автор снимка, лицензия, «несвободное»). Один для зала и панели карты, чтобы у изображений
// галереи была та же атрибуция, что у главной работы.
import { html, safeUrl } from '../html.js';
import { credit } from './image.js';

// work — запись изображения из atlas.json (example, gallery, corpus); img — показываемый файл.
export function artItem(work, store, img = work?.img) {
  const caption = [work?.title, work?.author, work?.year, work?.medium, work?.place].filter(Boolean).join(' · ');
  // Страница работы у музея — если она не та же, что источник самого файла (её ссылка уже есть в credit).
  const page = work?.external?.reference && work.external.page !== img?.page ? work.external.page : null;
  const sources = (work?.sources ?? []).map((id) => store?.source(id)).filter(Boolean);
  const details = html`${work?.why ? html`<p class="lb-why"><strong>Что здесь видно.</strong> ${work.why}</p>` : ''}${sources.length
    ? html`<p class="lb-src">Источник подписи: ${sources.map((src, i) => html`${i ? '; ' : ''}<a href="${safeUrl(src.url)}" target="_blank" rel="noopener">${src.publisher ?? src.title}</a>`)}</p>`
    : ''}${credit(img)}${page ? html`<p class="lb-src"><a href="${safeUrl(page)}" target="_blank" rel="noopener">Посмотреть работу у источника</a></p>` : ''}`;
  return { img, caption, details };
}

// Один и тот же файл может стоять в примере, галерее и корпусе. Сравниваем по самому файлу, а не по странице:
// у локальных копий одна страница музея бывает общей для нескольких работ.
export const imgKey = (img) => img?.src?.[250] ?? img?.page ?? null;

// Все изображения карточки без повторов: главная работа, галерея, затем корпус.
// Корпус — данные для сверки (у авторской карточки не меньше трёх работ); на странице его работы стоят
// в одном ряду с галереей.
export function cardImages(s) {
  const seen = new Set();
  const out = [];
  for (const w of [s.example, ...(s.gallery ?? []), ...(s.corpus ?? [])]) {
    const k = imgKey(w?.img);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(w);
  }
  return out;
}

// Работы галереи и корпуса без изображения — только ссылкой на страницу источника. Не входят главная работа
// (её ссылка стоит в подписи под ней) и работа с тем же названием, что уже показана изображением.
export function cardRefs(s) {
  const shown = new Set([s.example?.title, ...cardImages(s).map((w) => w.title)].filter(Boolean));
  const seen = new Set();
  const out = [];
  for (const w of [...(s.gallery ?? []), ...(s.corpus ?? [])]) {
    if (w?.img || !w?.external?.page || shown.has(w.title)) continue;
    const k = `${w.external.page} ${w.title ?? ''}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(w);
  }
  return out;
}
