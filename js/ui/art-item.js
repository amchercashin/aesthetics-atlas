// Элемент лайтбокса: подпись работы, «Что здесь видно», источники подписи и сведения о файле
// (автор снимка, лицензия, «несвободное»). Один для зала и панели карты, чтобы у изображений
// галереи была та же атрибуция, что у главной работы.
import { html, safeUrl } from '../html.js';
import { credit } from './image.js?v=author-pilot';

// work — запись изображения из atlas.json (example, gallery, corpus); img — показываемый файл.
export function artItem(work, store, img = work?.img) {
  const caption = [work?.title, work?.author, work?.year, work?.place].filter(Boolean).join(' · ');
  const sources = (work?.sources ?? []).map((id) => store?.source(id)).filter(Boolean);
  const details = html`${work?.why ? html`<p class="lb-why"><strong>Что здесь видно.</strong> ${work.why}</p>` : ''}${sources.length
    ? html`<p class="lb-src">Источник подписи: ${sources.map((src, i) => html`${i ? '; ' : ''}<a href="${safeUrl(src.url)}" target="_blank" rel="noopener">${src.publisher ?? src.title}</a>`)}</p>`
    : ''}${credit(img)}`;
  return { img, caption, details };
}
