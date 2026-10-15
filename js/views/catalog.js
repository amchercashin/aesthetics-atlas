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
      <div class="cat-filters">
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
        </div>
      </div>
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
        const ar = clampAr(s.example.img);
        return html`<a class="tile" href="#/s/${s.id}" style="--ar:${ar.toFixed(3)}">
          ${frame(s.example.img, s.palette, { ratio: ar.toFixed(3), sizes: `${Math.round(ar * 240)}px`, alt: '', size: ar > 1.3 ? 960 : 500, note: s.example.external ? 'Репродукция — у источника' : '' })}
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
      root.querySelector('.reset').hidden = !(state.domain || state.family || state.eras.size || state.sort !== 'time');
      replaceParams('catalog', { d: state.domain, k: state.family, e: [...state.eras].join(','), sort: state.sort === 'az' ? 'az' : '' });
    }

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
    };
    root.addEventListener('click', onClick);
    apply();

    return {
      update(next) { state = readState(next.params); apply(); },
      destroy() { root.removeEventListener('click', onClick); },
    };
  },
};
