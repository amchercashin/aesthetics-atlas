import { html, safeUrl } from '../html.js';
import { CONTEXT, LABEL, MATURITY, REL_STATUS } from '../format.js?v=author-pilot';
import { credit } from './image.js?v=author-pilot';
import { imgKey } from './art-item.js?v=corpus-top-3';
import { thumb } from './common.js?v=author-pilot';

const refs = (store, ids) => {
  const sources = (ids ?? []).map((id) => store.source(id)).filter(Boolean);
  return sources.length ? html`<p class="ego-src">${sources.map((s, i) => html`${i ? '; ' : ''}<a href="${safeUrl(s.url)}" target="_blank" rel="noopener">${s.publisher ?? s.title}</a>`)}</p>` : '';
};

export function authorshipSection(store, s) {
  if (!s.creators?.length && !s.admission) return '';
  const fields = { language: 'Визуальный язык', corpus: 'Повторяемость в работах', distinctness: 'Отличие от соседних тем', significance: 'Культурное значение' };
  return html`<section class="authorship">
    <h2 class="section-title">Авторы и границы практики</h2>
    ${s.labelStatus || MATURITY[s.maturity] ? html`<p class="lineage-lead">${[LABEL[s.labelStatus], MATURITY[s.maturity]].filter(Boolean).join(' · ')}</p>` : ''}
    <ul class="creator-list">${(s.creators ?? []).map((c) => html`<li><strong>${c.name}</strong>${c.orig ? html` <span class="muted">(${c.orig})</span>` : ''} — ${c.role}${refs(store, c.sources)}</li>`)}</ul>
    ${s.admission ? html`<details class="admission"><summary>Почему выделена отдельная карточка</summary><dl>${Object.entries(fields).map(([key, label]) => html`<div><dt>${label}</dt><dd>${s.admission[key]}</dd></div>`)}</dl>${refs(store, s.admission.sources)}</details>` : ''}
  </section>`;
}

// Изображения корпуса показаны вверху, рядом с главной работой. Здесь — подписи: что в каждой работе
// повторяется и откуда сведения. Превью открывает ту же работу в лайтбоксе, главная работа только помечена.
export function corpusSection(store, s, { lightboxIndex = new Map(), coverKey = null, mainTitle = null } = {}) {
  if (!s.corpus?.length) return '';
  const isMain = (w) => (w.img && coverKey && imgKey(w.img) === coverKey) || (mainTitle && w.title === mainTitle);
  const shown = (w) => (w.img ? lightboxIndex.get(imgKey(w.img)) : undefined);
  // Подводка говорит только о том, что есть на странице: у части карточек работы корпуса — по ссылкам.
  const rest = s.corpus.filter((w) => !isMain(w));
  const withImg = rest.filter((w) => shown(w) != null).length;
  const where = withImg === rest.length ? 'их изображения — вверху, рядом с главной'
    : withImg ? 'изображения части из них — вверху, рядом с главной, остальные — у источника'
      : 'их репродукции — у источника';
  const media = (w) => {
    if (isMain(w)) return html`<p class="corpus-main">Главная работа — вверху</p>`;
    const i = shown(w);
    if (i != null) return html`<button class="corpus-thumb" type="button" data-gallery="${i}" aria-label="Открыть крупно: ${w.title ?? ''}"><img src="${w.img.src[250]}" alt="" loading="lazy"></button>`;
    return w.external?.page ? html`<a class="corpus-ref" href="${safeUrl(w.external.page)}" target="_blank" rel="noopener"><span aria-hidden="true">↗</span> Репродукция у источника</a>` : '';
  };
  return html`<section class="room-corpus">
    <h2 class="section-title">Корпус для сравнения</h2>
    <p class="lineage-lead">Самостоятельные работы, на которых держится карточка; ${where}. Здесь — подписи: что повторяется в каждой работе и откуда сведения.</p>
    <ol class="corpus-list">${s.corpus.map((w) => html`<li class="corpus-work${isMain(w) ? ' is-main' : ''}">
      <div class="corpus-media">${media(w)}</div>
      <div class="corpus-text">
        <h3>${w.title}</h3><p>${[w.author, w.year, w.medium, w.place].filter(Boolean).join(' · ')}</p>${w.why ? html`<p>${w.why}</p>` : ''}${w.note ? html`<p class="muted">${w.note}</p>` : ''}
        ${refs(store, w.sources)}${credit(w.img)}
        ${w.external ? html`<p><a href="${safeUrl(w.external.page)}" target="_blank" rel="noopener">Посмотреть работу у источника</a></p>` : ''}
      </div>
    </li>`)}</ol>
  </section>`;
}

export function contextSection(store, s) {
  if (!s.contexts?.length) return '';
  return html`<section class="contexts">
    <h2 class="section-title">Школы, техники и культурный контекст</h2>
    <ul class="context-list">${s.contexts.map((c) => { const other = store.get(c.id); return other ? html`<li class="ego-item">
      <span class="ego-rel">${CONTEXT[c.type]?.[c.direction] ?? CONTEXT[c.type]?.label} · <span class="st st-${c.status}">${REL_STATUS[c.status]}</span></span>
      <a class="ego-link" href="#/s/${other.id}">${thumb(other, 44)}<span class="ego-name">${other.name}</span></a><p class="ego-note">${c.note}</p>${refs(store, c.sources)}
    </li>` : ''; })}</ul>
    <p class="lineage-lead">Эти связи описывают окружение практики и применение приёмов. Историческое влияние показывается отдельно.</p>
  </section>`;
}
