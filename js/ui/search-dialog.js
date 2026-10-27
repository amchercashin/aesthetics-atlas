// Командная палитра поиска: «/» или ⌘K, стрелки, Enter, Esc.
// Слово вроде «барельеф» или «пейзажи» сначала предлагает фильтр каталога, затем — карточки по тексту.
import { html, mount } from '../html.js';
import { buildIndex, search, parseYear } from '../search.js?v=author-pilot';
import { fmtDates, fmtYear, plural } from '../format.js?v=subjects-3';
import { thumb } from './common.js?v=author-pilot';
import { markLoaded } from './image.js?v=author-pilot';
import { facetHits, facetCounts, emptyState } from '../catalog-filter.js?v=subjects-3';

const FILTER_ICON = html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4"/></svg>`;
const FACET_KIND = { subject: 'Сюжет', medium: 'Техника' };

export function initSearch(store) {
  const dlg = document.querySelector('.search-dialog');
  const input = dlg.querySelector('input');
  const list = dlg.querySelector('.search-results');
  const hint = dlg.querySelector('.search-hint');
  const index = buildIndex(store.styles);
  const totals = { subject: facetCounts(store.styles, emptyState(), 'subject'), medium: facetCounts(store.styles, emptyState(), 'medium') };
  let items = []; // адреса строк в порядке показа: по ним ходят стрелки и Enter
  let active = 0;

  const row = (s, i) => html`<li role="presentation"><a href="#/s/${s.id}" role="option" id="sr-${i}" aria-selected="${i === active}">
      ${thumb(s)}
      <span><span class="r-name">${s.name}</span><br><span class="r-sub">${s.orig}</span></span>
      <span class="r-dates"><span class="swatch" style="--c:var(--era-${s.era});display:inline-block;margin-right:6px"></span>${fmtDates(s)}</span>
    </a></li>`;
  const facetRow = (f, i) => {
    const n = totals[f.key].get(f.v);
    return html`<li role="presentation"><a href="${f.href}" role="option" id="sr-${i}" aria-selected="${i === active}">
      <span class="thumb r-facet">${FILTER_ICON}</span>
      <span><span class="r-name">${f.label}</span><br><span class="r-sub">${FACET_KIND[f.key]} — фильтр каталога</span></span>
      <span class="r-dates">${n} ${plural(n, 'стиль', 'стиля', 'стилей')}</span>
    </a></li>`;
  };

  function renderEmpty() {
    const picks = ['impressionism', 'bauhaus', 'vaporwave', 'gothic', 'surrealism', 'weirdcore'].map((id) => store.get(id)).filter(Boolean);
    items = picks.map((s) => `#/s/${s.id}`);
    active = 0;
    mount(list, html`<li class="search-group-title" role="presentation">Например</li>${picks.map(row)}`);
    mount(hint, html`Ищите по русскому или оригинальному названию, имени художника или году — например, <button type="button" data-q="1920">1920</button> или <button type="button" data-q="3000 до н. э.">3000 до н. э.</button>`);
    markLoaded(list);
  }

  function renderResults(q) {
    const styles = search(index, q, { limit: 14, now: store.now }).map((r) => r.style);
    const year = parseYear(q);
    const facets = year === null ? facetHits(q) : [];
    items = [...facets.map((f) => f.href), ...styles.map((s) => `#/s/${s.id}`)];
    active = 0;
    if (!items.length) {
      mount(list, '');
      mount(hint, html`Ничего не нашлось по запросу «${q}». Попробуйте другое написание, имя художника или год.`);
      return;
    }
    const byYear = year !== null && Math.abs(year) >= 100;
    mount(list, html`${facets.length ? html`<li class="search-group-title" role="presentation">В каталоге</li>${facets.map(facetRow)}` : ''}
      ${byYear ? html`<li class="search-group-title" role="presentation">Карточки по датам: ${fmtYear(year)}</li>` : facets.length && styles.length ? html`<li class="search-group-title" role="presentation">Карточки</li>` : ''}
      ${styles.map((s, i) => row(s, facets.length + i))}`);
    mount(hint, html`<kbd>↑</kbd> <kbd>↓</kbd> выбрать, <kbd>Enter</kbd> открыть`);
    markLoaded(list);
  }

  const update = () => {
    input.value.trim() ? renderResults(input.value) : renderEmpty();
    if (items.length) setActive(0);
    else {
      input.removeAttribute('aria-activedescendant');
      input.setAttribute('aria-expanded', dlg.open ? 'true' : 'false');
    }
  };
  const setActive = (i) => {
    if (!items.length) { input.removeAttribute('aria-activedescendant'); return; }
    active = (i + items.length) % items.length;
    list.querySelectorAll('[role=option]').forEach((a, j) => a.setAttribute('aria-selected', String(j === active)));
    const el = list.querySelector(`#sr-${active}`);
    el?.scrollIntoView({ block: 'nearest' });
    input.setAttribute('aria-activedescendant', `sr-${active}`);
  };

  function open(prefill = '') {
    if (dlg.open) return;
    input.value = prefill;
    update();
    dlg.showModal();
    input.setAttribute('aria-expanded', 'true');
    input.focus();
    if (prefill) input.select();
  }
  const close = () => {
    if (!dlg.open) return;
    dlg.close();
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
  };

  input.addEventListener('input', update);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(active + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(active - 1); }
    else if (e.key === 'Enter' && items[active]) { e.preventDefault(); location.hash = items[active]; close(); }
    // В поле type=search Escape сначала очищает текст — закрываем окно сразу, как ожидает пользователь.
    else if (e.key === 'Escape') { e.preventDefault(); close(); }
  });
  list.addEventListener('click', (e) => { if (e.target.closest('a')) close(); });
  hint.addEventListener('click', (e) => { const b = e.target.closest('[data-q]'); if (b) { input.value = b.dataset.q; update(); input.focus(); } });
  dlg.addEventListener('click', (e) => { if (e.target === dlg) close(); });

  window.addEventListener('hashchange', close);
  document.addEventListener('click', (e) => { if (e.target.closest('[data-open-search]')) { e.preventDefault(); open(e.target.closest('[data-open-search]').dataset.q ?? ''); } });
  document.addEventListener('keydown', (e) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable;
    if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) { e.preventDefault(); open(); }
    else if (e.key === '/' && !typing && !dlg.open) { e.preventDefault(); open(); }
  });
  return { open, close };
}
