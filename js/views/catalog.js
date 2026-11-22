// Каталог: «шпалерная» сетка работ (строки выравниваются по ширине), компактная верхняя панель фильтров
// + раскрывающийся лист всех фильтров (область, регион, тип, сюжет, техника, эпохи).
// Отбор, счётчики и параметры адреса — чистые функции в js/catalog-filter.js.
import { html, mount } from '../html.js';
import { fmtDates, displayTitle, DOMAIN, REGION, KIND, KIND_FAMILY, SUBJECT, MEDIUM, plural } from '../format.js';
import { frame, markLoaded } from '../ui/image.js';
import { footer } from '../ui/common.js';
import { replaceParams } from '../router.js';
import { readState, stateParams, emptyState, isFiltered, filterStyles, facetCounts, universalExtras } from '../catalog-filter.js';

const clampAr = (img) => (img ? Math.min(2.1, Math.max(0.62, img.w / img.h)) : 0.8);

// Все ряды фильтров внутри листа .cat-sheet (и для подсчёта счётчиков).
const ROWS = [
  { key: 'domain', label: 'Область', all: 'Все', items: Object.entries(DOMAIN).map(([v, name]) => ({ v, name })) },
  { key: 'region', label: 'Регион', all: 'Все регионы', items: Object.entries(REGION).map(([v, name]) => ({ v, name })) },
  { key: 'family', label: 'Тип карточки', all: 'Все типы', items: Object.entries(KIND_FAMILY).map(([v, f]) => ({ v, name: f.label, title: f.kinds.map((x) => KIND[x]).join(', ') })) },
  { key: 'subject', label: 'Сюжет', all: 'Все сюжеты', items: Object.entries(SUBJECT).map(([v, name]) => ({ v, name })) },
  { key: 'medium', label: 'Техника', all: 'Любая техника', items: Object.entries(MEDIUM).map(([v, name]) => ({ v, name })) },
];

const FILTER_ICON = html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4"/></svg>`;
const CHEVRON = html`<svg class="cat-bar-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>`;

function sheetFilters(store) {
  return html`
    <div class="cat-sheet-head">
      <strong>Фильтры каталога</strong>
      <div class="cat-sheet-actions">
        <button class="chip reset" type="button" data-reset hidden>Сбросить</button>
        <button class="icon-btn" type="button" data-sheet-close aria-label="Закрыть фильтры">×</button>
      </div>
    </div>
    ${ROWS.map((row) => html`<div class="cat-sheet-group">
      <p class="cat-sheet-label">${row.label}</p>
      <div class="filter-row" role="group" aria-label="${row.label}">
        <button class="chip" type="button" data-f="${row.key}" data-v="">${row.all}</button>
        ${row.items.map((it) => html`<button class="chip" type="button" data-f="${row.key}" data-v="${it.v}"${it.title ? html` title="${it.title}"` : ''}>${it.name} <span class="count"></span></button>`)}
      </div>
    </div>`)}
    <div class="cat-sheet-group">
      <p class="cat-sheet-label">Эпохи</p>
      <div class="era-bar" role="group" aria-label="Эпохи">
        ${store.eras.map((e) => html`<button type="button" class="era-seg" data-era="${e.id}" style="--c:var(--era-${e.id})" title="${e.name}">
          <span class="seg-bar"></span><span class="seg-name">${e.short}</span>
        </button>`)}
      </div>
    </div>
    <div class="cat-sheet-group">
      <p class="cat-sheet-label">Порядок</p>
      <div class="filter-row sort-row" role="group" aria-label="Порядок">
        <button class="chip" type="button" data-sort="time">По времени</button>
        <button class="chip" type="button" data-sort="az">По алфавиту</button>
      </div>
    </div>`;
}

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
      <div class="cat-filters cat-filters-compact">
        <div class="cat-top-row">
          <div class="filter-row cat-domain-row" role="group" aria-label="Область">
            <button class="chip" type="button" data-f="domain" data-v="">Все</button>
            ${ROWS[0].items.map((it) => html`<button class="chip" type="button" data-f="domain" data-v="${it.v}">${it.name} <span class="count"></span></button>`)}
          </div>
          <div class="cat-top-ctrls">
            <button class="chip cat-all-btn" type="button" data-open-sheet aria-expanded="false" aria-controls="cat-sheet">
              ${FILTER_ICON}<span>Фильтры</span><span class="cat-extra-badge" hidden></span>
            </button>
            <div class="cat-sort-seg" role="group" aria-label="Порядок">
              <button class="chip" type="button" data-sort="time">По времени</button>
              <button class="chip" type="button" data-sort="az">А–Я</button>
            </div>
            <button class="chip reset" type="button" data-reset hidden>Сбросить</button>
          </div>
        </div>
        <div class="era-bar" role="group" aria-label="Эпохи">
          ${store.eras.map((e) => html`<button type="button" class="era-seg" data-era="${e.id}" style="--c:var(--era-${e.id})" title="${e.name}">
            <span class="seg-bar"></span><span class="seg-name">${e.short}</span>
          </button>`)}
        </div>
        <div class="cat-active-pills" aria-label="Выбранные фильтры" hidden></div>
      </div>
      <div class="cat-bar">
        <button class="cat-bar-toggle" type="button" aria-expanded="false" aria-controls="cat-sheet">
          ${FILTER_ICON}<span class="cat-bar-text"><span class="cat-bar-label">Фильтры</span> <span class="cat-bar-summary"></span></span>
          <span class="cat-bar-count"></span>${CHEVRON}
        </button>
      </div>
      <div class="cat-scrim" hidden></div>
      <div class="cat-sheet" id="cat-sheet" role="region" aria-label="Фильтры каталога" hidden>${sheetFilters(store)}</div>
      <div class="cat-grid"></div>
      <div class="cat-empty" hidden>
        <p>Под эти фильтры ничего не подходит.</p>
        <button class="btn ghost" type="button" data-reset>Сбросить фильтры</button>
      </div>
      <section class="cat-any" aria-labelledby="cat-any-title" hidden>
        <div class="cat-any-head">
          <h2 class="cat-any-title" id="cat-any-title">Универсальные стили <span class="count"></span></h2>
          <p class="cat-any-note"></p>
          <button class="btn ghost" type="button" data-any-toggle aria-expanded="false" aria-controls="cat-any-grid"></button>
        </div>
        <div class="cat-grid" id="cat-any-grid" hidden></div>
      </section>
    </div>
    ${footer(store)}`);

    const grid = root.querySelector('.cat-grid');
    const count = root.querySelector('.cat-count');
    const anyBox = root.querySelector('.cat-any');
    const anyGrid = root.querySelector('#cat-any-grid');
    const anyToggle = anyBox.querySelector('[data-any-toggle]');
    const activePills = root.querySelector('.cat-active-pills');
    const topOpenBtn = root.querySelector('[data-open-sheet]');
    const extraBadge = root.querySelector('.cat-extra-badge');
    let anyOpen = false, anyFor = '';

    const tiles = (list) => html`${list.map((s) => {
      const cover = s.example.img ?? s.gallery.find((g) => g.img)?.img ?? null;
      const ar = clampAr(cover);
      return html`<a class="tile" href="#/s/${s.id}" style="--ar:${ar.toFixed(3)}">
        ${frame(cover, s.palette, { ratio: ar.toFixed(3), sizes: `${Math.round(ar * 240)}px`, alt: '', size: ar > 1.3 ? 960 : 500, note: !cover && s.example.external ? 'Репродукция — у источника' : '' })}
        <span class="tile-cap"><span class="swatch" style="--c:var(--era-${s.era})"></span><span class="tile-name">${displayTitle(s)}</span><span class="tile-dates">${s.kind[0] ? `${KIND[s.kind[0]]}, ` : ''}${fmtDates(s)}</span></span>
      </a>`;
    })}`;
    const sorted = (list) => (state.sort === 'az' ? [...list].sort((a, b) => displayTitle(a).localeCompare(displayTitle(b), 'ru')) : list);

    function renderAny(main, extras) {
      if (state.subject !== anyFor) { anyOpen = false; anyFor = state.subject; }
      const forced = !main.length && extras.length > 0;
      const open = forced || anyOpen;
      anyBox.hidden = !extras.length;
      if (!extras.length) { mount(anyGrid, ''); return; }
      const label = SUBJECT[state.subject];
      anyBox.querySelector('.count').textContent = String(extras.length);
      anyBox.querySelector('.cat-any-note').textContent = forced
        ? `Стилей, которым сюжет «${label}» главный, при этих фильтрах нет. Подойдут универсальные: их приёмы переносятся на любой сюжет.`
        : `Сюжет «${label}» им не главный, но их приёмы переносятся на любой сюжет.`;
      anyToggle.hidden = forced;
      anyToggle.textContent = open ? 'Свернуть' : `Показать ${extras.length}`;
      anyToggle.setAttribute('aria-expanded', String(open));
      anyGrid.hidden = !open;
      mount(anyGrid, open ? tiles(extras) : '');
      if (open) markLoaded(anyGrid);
    }

    function apply() {
      const list = sorted(filterStyles(store.styles, state));
      const extras = sorted(universalExtras(store.styles, state));
      mount(grid, tiles(list));
      markLoaded(grid);
      count.textContent = `${list.length} ${plural(list.length, 'стиль', 'стиля', 'стилей')} из ${store.styles.length}`
        + (extras.length ? ` · ещё ${extras.length} ${plural(extras.length, 'универсальный', 'универсальных', 'универсальных')}` : '');
      root.querySelector('.cat-empty').hidden = list.length > 0 || extras.length > 0;
      renderAny(list, extras);

      for (const row of ROWS) {
        const counts = facetCounts(store.styles, state, row.key);
        root.querySelectorAll(`[data-f="${row.key}"]`).forEach((b) => {
          const v = b.dataset.v;
          b.setAttribute('aria-pressed', String(v === state[row.key]));
          if (!v) return;
          const n = counts.get(v);
          const cnt = b.querySelector('.count');
          if (cnt) cnt.textContent = String(n);
          b.classList.toggle('is-empty', n === 0);
        });
      }
      root.querySelectorAll('[data-era]').forEach((b) => b.setAttribute('aria-pressed', String(state.eras.has(b.dataset.era))));
      root.querySelectorAll('[data-sort]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.sort === state.sort)));
      root.querySelectorAll('.reset').forEach((b) => { b.hidden = !(isFiltered(state) || state.sort !== 'time'); });

      // Выбранные «глубокие» фильтры (регион, тип, сюжет, техника) показываем пиллами под строкой эпох.
      const pills = [
        state.region && { key: 'region', label: `Регион: ${REGION[state.region]}` },
        state.family && { key: 'family', label: `Тип: ${KIND_FAMILY[state.family].label}` },
        state.subject && { key: 'subject', label: `Сюжет: ${SUBJECT[state.subject]}` },
        state.medium && { key: 'medium', label: `Техника: ${MEDIUM[state.medium]}` },
      ].filter(Boolean);
      extraBadge.hidden = !pills.length;
      extraBadge.textContent = String(pills.length);
      topOpenBtn.classList.toggle('is-active', pills.length > 0);
      activePills.hidden = !pills.length;
      mount(activePills, pills.length ? html`${pills.map((p) => html`<button class="chip active-pill" type="button" data-clear-key="${p.key}">${p.label} <span aria-hidden="true">×</span></button>`)}` : '');

      const eras = store.eras.filter((e) => state.eras.has(e.id)).map((e) => e.short);
      const summary = [DOMAIN[state.domain], REGION[state.region], KIND_FAMILY[state.family]?.label, SUBJECT[state.subject], MEDIUM[state.medium], eras.length > 2 ? `${eras.slice(0, 2).join(', ')} и ещё ${eras.length - 2}` : eras.join(', '), state.sort === 'az' ? 'по алфавиту' : ''].filter(Boolean);
      root.querySelector('.cat-bar-summary').textContent = summary.length ? summary.join(' · ') : 'все стили';
      root.querySelector('.cat-bar-count').textContent = String(list.length);
      replaceParams('catalog', stateParams(state));
    }

    const header = document.querySelector('.site-header');
    const panel = root.querySelector('.cat-filters');
    const bar = root.querySelector('.cat-bar');
    const toggle = root.querySelector('.cat-bar-toggle');
    const sheet = root.querySelector('.cat-sheet');
    const scrim = root.querySelector('.cat-scrim');
    let openedAt = null, openedFromBar = false, raf = 0;

    const setOpen = (open, { fromBar = false } = {}) => {
      sheet.hidden = scrim.hidden = !open;
      toggle.setAttribute('aria-expanded', String(open));
      topOpenBtn.setAttribute('aria-expanded', String(open));
      bar.classList.toggle('is-open', open);
      sheet.classList.toggle('from-top', open && !fromBar);
      openedAt = open ? window.scrollY : null;
      openedFromBar = open && fromBar;
    };
    const syncBar = () => {
      raf = 0;
      const headerBottom = document.documentElement.classList.contains('header-away') ? 0 : header.offsetHeight;
      const shown = panel.getBoundingClientRect().bottom <= headerBottom + bar.offsetHeight;
      bar.classList.toggle('is-shown', shown);
      if (openedAt !== null && ((openedFromBar && !shown) || Math.abs(window.scrollY - openedAt) > 120)) setOpen(false);
    };
    const onScroll = () => { raf ||= requestAnimationFrame(syncBar); };
    const onKey = (e) => { if (e.key === 'Escape' && openedAt !== null) { setOpen(false); (openedFromBar ? toggle : topOpenBtn).focus(); } };
    const toResults = () => {
      const top = grid.getBoundingClientRect().top + window.scrollY - header.offsetHeight - bar.offsetHeight - 12;
      if (window.scrollY > top) window.scrollTo(0, top);
      openedAt = window.scrollY;
    };

    toggle.addEventListener('click', () => setOpen(openedAt === null, { fromBar: true }));
    topOpenBtn.addEventListener('click', () => setOpen(openedAt === null, { fromBar: false }));
    scrim.addEventListener('click', () => setOpen(false));
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    document.addEventListener('keydown', onKey);

    const onClick = (e) => {
      if (e.target.closest('[data-sheet-close]')) { setOpen(false); return; }
      if (e.target.closest('[data-any-toggle]')) {
        anyOpen = !anyOpen;
        renderAny(filterStyles(store.styles, state), sorted(universalExtras(store.styles, state)));
        return;
      }
      const clr = e.target.closest('[data-clear-key]');
      if (clr) { state[clr.dataset.clearKey] = ''; apply(); return; }
      const f = e.target.closest('[data-f]');
      const er = e.target.closest('[data-era]');
      const so = e.target.closest('[data-sort]');
      if (f) state[f.dataset.f] = f.dataset.v;
      else if (er) { const id = er.dataset.era; state.eras.has(id) ? state.eras.delete(id) : state.eras.add(id); }
      else if (so) state.sort = so.dataset.sort;
      else if (e.target.closest('[data-reset]')) state = emptyState();
      else return;
      apply();
      if (e.target.closest('.cat-sheet') && openedFromBar) toResults();
    };
    root.addEventListener('click', onClick);
    apply();
    syncBar();

    return {
      update(next) { state = readState(next.params); apply(); },
      destroy() {
        root.removeEventListener('click', onClick);
        window.removeEventListener('scroll', onScroll);
        window.removeEventListener('resize', onScroll);
        document.removeEventListener('keydown', onKey);
        cancelAnimationFrame(raf);
      },
    };
  },
};
