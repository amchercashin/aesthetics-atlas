// Каталог: «шпалерная» сетка работ (строки выравниваются по ширине), фильтры по областям и эпохам.
import { html, mount } from '../html.js';
import { fmtDates, DOMAIN, KIND, KIND_FAMILY, plural } from '../format.js?v=author-pilot';
import { frame, markLoaded } from '../ui/image.js?v=author-pilot';
import { footer } from '../ui/common.js?v=author-pilot';
import { replaceParams } from '../router.js?v=map4';

// Карточка попадает в семейство по основному типу (первому в списке kind).
const inFamily = (s, fam) => !fam || KIND_FAMILY[fam].kinds.includes(s.kind[0]);
const clampAr = (img) => (img ? Math.min(2.1, Math.max(0.62, img.w / img.h)) : 0.8);

function readState(params) {
  return {
    domain: params.get('d') || '',
    family: KIND_FAMILY[params.get('k')] ? params.get('k') : '',
    eras: new Set((params.get('e') || '').split(',').filter(Boolean)),
    sort: params.get('sort') === 'az' ? 'az' : 'time',
  };
}

// Ряды фильтров. На телефоне они показаны дважды: в начале страницы и в листе под полоской
// «Фильтры», которая появляется при прокрутке. Кнопки связаны через data-атрибуты, состояние общее.
function filterRows(store) {
  return html`
    <div class="filter-row" role="group" aria-label="Область">
      <button class="chip" type="button" data-domain="">Все</button>
      ${Object.entries(DOMAIN).map(([k, v]) => html`<button class="chip" type="button" data-domain="${k}">${v} <span class="count">${store.styles.filter((s) => s.domain.includes(k)).length}</span></button>`)}
    </div>
    <div class="filter-row" role="group" aria-label="Тип карточки">
      <button class="chip" type="button" data-family="">Все типы</button>
      ${Object.entries(KIND_FAMILY).map(([k, f]) => html`<button class="chip" type="button" data-family="${k}" title="${f.kinds.map((x) => KIND[x]).join(', ')}">${f.label} <span class="count">${store.styles.filter((s) => inFamily(s, k)).length}</span></button>`)}
    </div>
    <div class="era-bar" role="group" aria-label="Эпохи">
      ${store.eras.map((e) => html`<button type="button" class="era-seg" data-era="${e.id}" style="--c:var(--era-${e.id})" title="${e.name}">
        <span class="seg-bar"></span><span class="seg-name">${e.short}</span>
      </button>`)}
    </div>
    <div class="filter-row sort-row" role="group" aria-label="Порядок">
      <button class="chip" type="button" data-sort="time">По времени</button>
      <button class="chip" type="button" data-sort="az">По алфавиту</button>
      <button class="chip reset" type="button" data-reset hidden>Сбросить фильтры</button>
    </div>`;
}

const FILTER_ICON = html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4"/></svg>`;
const CHEVRON = html`<svg class="cat-bar-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>`;

export default {
  render(root, ctx) {
    const { store } = ctx;
    document.title = 'Каталог — Атлас эстетик';
    let state = readState(ctx.params);

    mount(root, html`
    <div class="page catalog">
      <header class="cat-head">
        <h1 class="cat-title">Каталог</h1>
        <p class="cat-count" aria-live="polite"></p>
      </header>
      <div class="cat-filters">${filterRows(store)}</div>
      <div class="cat-bar">
        <button class="cat-bar-toggle" type="button" aria-expanded="false" aria-controls="cat-sheet">
          ${FILTER_ICON}<span class="cat-bar-text"><span class="cat-bar-label">Фильтры</span> <span class="cat-bar-summary"></span></span>
          <span class="cat-bar-count"></span>${CHEVRON}
        </button>
      </div>
      <div class="cat-scrim" hidden></div>
      <div class="cat-sheet" id="cat-sheet" role="region" aria-label="Фильтры каталога" hidden>${filterRows(store)}</div>
      <div class="cat-grid"></div>
      <div class="cat-empty" hidden>
        <p>Под эти фильтры ничего не подходит.</p>
        <button class="btn ghost" type="button" data-reset>Сбросить фильтры</button>
      </div>
    </div>
    ${footer(store)}`);

    const grid = root.querySelector('.cat-grid');
    const count = root.querySelector('.cat-count');

    function apply() {
      let list = store.styles.filter((s) => (!state.domain || s.domain.includes(state.domain)) && inFamily(s, state.family) && (!state.eras.size || state.eras.has(s.era)));
      if (state.sort === 'az') list = [...list].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
      mount(grid, html`${list.map((s) => {
        const cover = s.example.img ?? s.gallery.find((g) => g.img)?.img ?? null;
        const ar = clampAr(cover);
        return html`<a class="tile" href="#/s/${s.id}" style="--ar:${ar.toFixed(3)}">
          ${frame(cover, s.palette, { ratio: ar.toFixed(3), sizes: `${Math.round(ar * 240)}px`, alt: '', size: ar > 1.3 ? 960 : 500, note: !cover && s.example.external ? 'Репродукция — у источника' : '' })}
          <span class="tile-cap"><span class="swatch" style="--c:var(--era-${s.era})"></span><span class="tile-name">${s.name}</span><span class="tile-dates">${s.kind[0] ? `${KIND[s.kind[0]]}, ` : ''}${fmtDates(s)}</span></span>
        </a>`;
      })}`);
      markLoaded(grid);
      count.textContent = `${list.length} ${plural(list.length, 'стиль', 'стиля', 'стилей')} из ${store.styles.length}`;
      root.querySelector('.cat-empty').hidden = list.length > 0;
      root.querySelectorAll('[data-domain]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.domain === state.domain)));
      root.querySelectorAll('[data-family]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.family === state.family)));
      root.querySelectorAll('[data-era]').forEach((b) => b.setAttribute('aria-pressed', String(state.eras.has(b.dataset.era))));
      root.querySelectorAll('[data-sort]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.sort === state.sort)));
      root.querySelectorAll('.reset').forEach((b) => { b.hidden = !(state.domain || state.family || state.eras.size || state.sort !== 'time'); });
      const eras = store.eras.filter((e) => state.eras.has(e.id)).map((e) => e.short);
      const summary = [DOMAIN[state.domain], KIND_FAMILY[state.family]?.label, eras.length > 2 ? `${eras.slice(0, 2).join(', ')} и ещё ${eras.length - 2}` : eras.join(', '), state.sort === 'az' ? 'по алфавиту' : ''].filter(Boolean);
      root.querySelector('.cat-bar-summary').textContent = summary.length ? summary.join(' · ') : 'все стили';
      root.querySelector('.cat-bar-count').textContent = String(list.length);
      replaceParams('catalog', { d: state.domain, k: state.family, e: [...state.eras].join(','), sort: state.sort === 'az' ? 'az' : '' });
    }

    // Телефон: панель фильтров стоит в начале страницы и не липнет. Когда она уходит под шапку,
    // сверху появляется тонкая полоска «Фильтры»; нажатие раскрывает под ней те же фильтры листом.
    // Лист закрывается повторным нажатием, тапом мимо, Esc или прокруткой страницы.
    const narrow = matchMedia('(max-width: 760px)');
    const header = document.querySelector('.site-header');
    const panel = root.querySelector('.cat-filters');
    const bar = root.querySelector('.cat-bar');
    const toggle = root.querySelector('.cat-bar-toggle');
    const sheet = root.querySelector('.cat-sheet');
    const scrim = root.querySelector('.cat-scrim');
    let openedAt = null, raf = 0;
    const setOpen = (open) => {
      sheet.hidden = scrim.hidden = !open;
      toggle.setAttribute('aria-expanded', String(open));
      bar.classList.toggle('is-open', open);
      openedAt = open ? window.scrollY : null;
    };
    // Нижний край полоски — из состояния шапки, а не из её рамки: рамка в это время ещё едет
    // за анимацией шапки (и сдвинута, пока полоска спрятана).
    const syncBar = () => {
      raf = 0;
      const headerBottom = document.documentElement.classList.contains('header-away') ? 0 : header.offsetHeight;
      const shown = narrow.matches && panel.getBoundingClientRect().bottom <= headerBottom + bar.offsetHeight;
      bar.classList.toggle('is-shown', shown);
      if (openedAt !== null && (!shown || Math.abs(window.scrollY - openedAt) > 48)) setOpen(false);
    };
    const onScroll = () => { raf ||= requestAnimationFrame(syncBar); };
    const onKey = (e) => { if (e.key === 'Escape' && openedAt !== null) { setOpen(false); toggle.focus(); } };
    // Выбор в листе показывает новый список с начала, лист остаётся открытым для следующего выбора.
    // Прокрутка вверх возвращает шапку, поэтому место оставляем под шапкой и полоской.
    const toResults = () => {
      const top = grid.getBoundingClientRect().top + window.scrollY - header.offsetHeight - bar.offsetHeight - 12;
      if (window.scrollY > top) window.scrollTo(0, top);
      openedAt = window.scrollY;
    };
    toggle.addEventListener('click', () => setOpen(openedAt === null));
    scrim.addEventListener('click', () => setOpen(false));
    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('keydown', onKey);
    narrow.addEventListener('change', onScroll);

    const onClick = (e) => {
      const d = e.target.closest('[data-domain]');
      const fam = e.target.closest('[data-family]');
      const er = e.target.closest('[data-era]');
      const so = e.target.closest('[data-sort]');
      if (d) state.domain = d.dataset.domain;
      else if (fam) state.family = fam.dataset.family;
      else if (er) { const id = er.dataset.era; state.eras.has(id) ? state.eras.delete(id) : state.eras.add(id); }
      else if (so) state.sort = so.dataset.sort;
      else if (e.target.closest('[data-reset]')) state = { domain: '', family: '', eras: new Set(), sort: 'time' };
      else return;
      apply();
      if (e.target.closest('.cat-sheet')) toResults();
    };
    root.addEventListener('click', onClick);
    apply();
    syncBar();

    return {
      update(next) { state = readState(next.params); apply(); },
      destroy() {
        root.removeEventListener('click', onClick);
        window.removeEventListener('scroll', onScroll);
        document.removeEventListener('keydown', onKey);
        narrow.removeEventListener('change', onScroll);
        cancelAnimationFrame(raf);
      },
    };
  },
};
