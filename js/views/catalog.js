// Каталог: «шпалерная» сетка работ (строки выравниваются по ширине), фильтры по области, типу, сюжету, технике и эпохам.
// Отбор, счётчики и параметры адреса — чистые функции в js/catalog-filter.js.
import { html, mount } from '../html.js';
import { fmtDates, DOMAIN, KIND, KIND_FAMILY, SUBJECT, MEDIUM, plural } from '../format.js?v=subjects-1';
import { frame, markLoaded } from '../ui/image.js?v=author-pilot';
import { footer } from '../ui/common.js?v=author-pilot';
import { replaceParams } from '../router.js?v=map4';
import { readState, stateParams, emptyState, isFiltered, filterStyles, facetCounts } from '../catalog-filter.js?v=subjects-1';

const clampAr = (img) => (img ? Math.min(2.1, Math.max(0.62, img.w / img.h)) : 0.8);

// Ряды с одним выбором: «Все» и значения словаря. Длинный ряд техник на широком экране свёрнут в одну строку.
const ROWS = [
  { key: 'domain', label: 'Область', all: 'Все', items: Object.entries(DOMAIN).map(([v, name]) => ({ v, name })) },
  { key: 'family', label: 'Тип карточки', all: 'Все типы', items: Object.entries(KIND_FAMILY).map(([v, f]) => ({ v, name: f.label, title: f.kinds.map((x) => KIND[x]).join(', ') })) },
  { key: 'subject', label: 'Сюжет', all: 'Все сюжеты', items: Object.entries(SUBJECT).map(([v, name]) => ({ v, name })) },
  { key: 'medium', label: 'Техника', all: 'Любая техника', collapse: true, items: Object.entries(MEDIUM).map(([v, name]) => ({ v, name })) },
];

// Ряды фильтров. На телефоне и при прокрутке они показаны дважды: в начале страницы и в листе под полоской
// «Фильтры». Кнопки связаны через data-атрибуты, состояние общее. Числа на чипах ставит apply().
function filterRows(store) {
  return html`
    ${ROWS.map((row) => html`<div class="filter-row${row.collapse ? ' is-collapsible' : ''}" role="group" aria-label="${row.label}">
      <button class="chip" type="button" data-f="${row.key}" data-v="">${row.all}</button>
      ${row.items.map((it) => html`<button class="chip" type="button" data-f="${row.key}" data-v="${it.v}"${it.title ? html` title="${it.title}"` : ''}>${it.name} <span class="count"></span></button>`)}
      ${row.collapse ? html`<button class="chip more" type="button" data-more aria-expanded="false" hidden></button>` : ''}
    </div>`)}
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
      let list = filterStyles(store.styles, state);
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
      // Число на чипе — сколько стилей останется, если выбрать его при остальных фильтрах; ноль приглушён.
      for (const row of ROWS) {
        const counts = facetCounts(store.styles, state, row.key);
        root.querySelectorAll(`[data-f="${row.key}"]`).forEach((b) => {
          const v = b.dataset.v;
          b.setAttribute('aria-pressed', String(v === state[row.key]));
          if (!v) return;
          const n = counts.get(v);
          b.querySelector('.count').textContent = String(n);
          b.classList.toggle('is-empty', n === 0);
        });
      }
      root.querySelectorAll('[data-era]').forEach((b) => b.setAttribute('aria-pressed', String(state.eras.has(b.dataset.era))));
      root.querySelectorAll('[data-sort]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.sort === state.sort)));
      root.querySelectorAll('.reset').forEach((b) => { b.hidden = !(isFiltered(state) || state.sort !== 'time'); });
      const eras = store.eras.filter((e) => state.eras.has(e.id)).map((e) => e.short);
      const summary = [DOMAIN[state.domain], KIND_FAMILY[state.family]?.label, SUBJECT[state.subject], MEDIUM[state.medium], eras.length > 2 ? `${eras.slice(0, 2).join(', ')} и ещё ${eras.length - 2}` : eras.join(', '), state.sort === 'az' ? 'по алфавиту' : ''].filter(Boolean);
      root.querySelector('.cat-bar-summary').textContent = summary.length ? summary.join(' · ') : 'все стили';
      root.querySelector('.cat-bar-count').textContent = String(list.length);
      replaceParams('catalog', stateParams(state));
      fitRows();
    }

    // Панель фильтров стоит в начале страницы и не липнет: с рядами сюжетов и техники она выше экрана ноутбука.
    // Когда она уходит под шапку, сверху появляется тонкая полоска «Фильтры»; нажатие раскрывает под ней те же
    // фильтры листом. Лист закрывается повторным нажатием, тапом мимо, Esc или прокруткой страницы.
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
      const shown = panel.getBoundingClientRect().bottom <= headerBottom + bar.offsetHeight;
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
    // Свёрнутый ряд: на широком экране в панели видна одна строка, остальное — по кнопке «Ещё N».
    // Выбранный чип не прячется: вместо него уходят соседние. На телефоне ряд прокручивается вбок,
    // а в листе переносится целиком.
    const narrow = matchMedia('(max-width: 760px)');
    function fitRows() {
      for (const row of panel.querySelectorAll('.is-collapsible')) {
        const chips = [...row.querySelectorAll('[data-f]')];
        const more = row.querySelector('[data-more]');
        chips.forEach((c) => { c.hidden = false; });
        more.hidden = true;
        const top = chips[0].offsetTop;
        if (narrow.matches || chips.at(-1).offsetTop === top) continue;
        more.hidden = false;
        more.textContent = 'Ещё 00'; // ширина подписи, пока подбираем строку
        const open = row.classList.contains('is-open');
        let hidden = 0;
        for (let i = chips.length - 1; !open && i > 0 && more.offsetTop !== top; i--) {
          if (chips[i].getAttribute('aria-pressed') === 'true') continue;
          chips[i].hidden = true;
          hidden++;
        }
        more.textContent = open ? 'Свернуть' : `Ещё ${hidden}`;
        more.setAttribute('aria-expanded', String(open));
      }
    }
    const onResize = () => { fitRows(); onScroll(); };

    toggle.addEventListener('click', () => setOpen(openedAt === null));
    scrim.addEventListener('click', () => setOpen(false));
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    narrow.addEventListener('change', onResize);
    document.addEventListener('keydown', onKey);
    document.fonts?.ready.then(() => { if (root.contains(panel)) fitRows(); });

    const onClick = (e) => {
      const more = e.target.closest('[data-more]');
      if (more) { more.closest('.filter-row').classList.toggle('is-open'); fitRows(); return; }
      const f = e.target.closest('[data-f]');
      const er = e.target.closest('[data-era]');
      const so = e.target.closest('[data-sort]');
      if (f) state[f.dataset.f] = f.dataset.v;
      else if (er) { const id = er.dataset.era; state.eras.has(id) ? state.eras.delete(id) : state.eras.add(id); }
      else if (so) state.sort = so.dataset.sort;
      else if (e.target.closest('[data-reset]')) state = emptyState();
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
        window.removeEventListener('resize', onResize);
        narrow.removeEventListener('change', onResize);
        document.removeEventListener('keydown', onKey);
        cancelAnimationFrame(raf);
      },
    };
  },
};
