// Командная палитра поиска: «/» или ⌘K, стрелки, Enter, Esc.
import { html, mount } from '../html.js';
import { buildIndex, search, parseYear } from '../search.js?v=author-pilot';
import { fmtDates, fmtYear } from '../format.js?v=author-pilot';
import { thumb } from './common.js?v=author-pilot';
import { markLoaded } from './image.js?v=author-pilot';

export function initSearch(store) {
  const dlg = document.querySelector('.search-dialog');
  const input = dlg.querySelector('input');
  const list = dlg.querySelector('.search-results');
  const hint = dlg.querySelector('.search-hint');
  const index = buildIndex(store.styles);
  let items = [];
  let active = 0;

  const row = (s, i) => html`<li role="presentation"><a href="#/s/${s.id}" role="option" id="sr-${i}" aria-selected="${i === active}">
      ${thumb(s)}
      <span><span class="r-name">${s.name}</span><br><span class="r-sub">${s.orig}</span></span>
      <span class="r-dates"><span class="swatch" style="--c:var(--era-${s.era});display:inline-block;margin-right:6px"></span>${fmtDates(s)}</span>
    </a></li>`;

  function renderEmpty() {
    const picks = ['impressionism', 'bauhaus', 'vaporwave', 'gothic', 'surrealism', 'weirdcore'].map((id) => store.get(id)).filter(Boolean);
    items = picks;
    active = 0;
    mount(list, html`<li class="search-group-title" role="presentation">Например</li>${picks.map(row)}`);
    mount(hint, html`Ищите по русскому или оригинальному названию, имени художника или году — например, <button type="button" data-q="1920">1920</button> или <button type="button" data-q="3000 до н. э.">3000 до н. э.</button>`);
    markLoaded(list);
  }

  function renderResults(q) {
    const res = search(index, q, { limit: 14, now: store.now });
    items = res.map((r) => r.style);
    active = 0;
    const year = parseYear(q);
    if (!items.length) {
      mount(list, '');
      mount(hint, html`Ничего не нашлось по запросу «${q}». Попробуйте другое написание, имя художника или год.`);
      return;
    }
    mount(list, html`${year !== null && Math.abs(year) >= 100 ? html`<li class="search-group-title" role="presentation">Карточки по датам: ${fmtYear(year)}</li>` : ''}${items.map(row)}`);
    mount(hint, html`<kbd>↑</kbd> <kbd>↓</kbd> выбрать, <kbd>Enter</kbd> открыть`);
    markLoaded(list);
  }

  const update = () => (input.value.trim() ? renderResults(input.value) : renderEmpty());
  const setActive = (i) => {
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
    input.focus();
    if (prefill) input.select();
  }
  const close = () => dlg.open && dlg.close();

  input.addEventListener('input', update);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(active + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(active - 1); }
    else if (e.key === 'Enter' && items[active]) { e.preventDefault(); location.hash = `#/s/${items[active].id}`; close(); }
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
