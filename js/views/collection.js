// «Моя полка вкуса»: сохранённые стили, общая палитра вкуса, сравнение и шаринг подборки ссылкой.
import { html, mount } from '../html.js';
import { fmtDates, displayTitle, DOMAIN, KIND, plural } from '../format.js';
import { frame, markLoaded } from '../ui/image.js';
import { footer } from '../ui/common.js';
import { toast } from '../ui/toast.js';
import { readSaved, toggleSaved, mergeSaved, clearSaved, parseSharedIds, shareCollectionUrl } from '../favorites.js';

const clampAr = (img) => (img ? Math.min(2.1, Math.max(0.62, img.w / img.h)) : 0.8);

function compositePalette(styles) {
  const out = [];
  const seen = new Set();
  for (let pass = 0; pass < 3 && out.length < 10; pass++) {
    for (const s of styles) {
      const col = s.palette?.colors?.[pass];
      if (col && !seen.has(col)) { seen.add(col); out.push(col); if (out.length >= 10) break; }
    }
  }
  return out;
}

function breakdown(store, styles) {
  const eraCounts = new Map();
  const domCounts = new Map();
  for (const s of styles) {
    eraCounts.set(s.era, (eraCounts.get(s.era) ?? 0) + 1);
    for (const d of s.domain) domCounts.set(d, (domCounts.get(d) ?? 0) + 1);
  }
  const topEras = [...eraCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4)
    .map(([id, n]) => ({ id, name: store.era(id)?.short ?? id, n }));
  const topDoms = [...domCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)
    .map(([id, n]) => ({ id, name: DOMAIN[id] ?? id, n }));
  return { topEras, topDoms };
}

export default {
  render(root, { store, params }) {
    const sharedIds = parseSharedIds(params, store);
    const isShared = sharedIds.length > 0;
    document.title = isShared ? 'Подборка стилей — Атлас эстетик' : 'Моя полка вкуса — Атлас эстетик';

    function draw() {
      const ids = isShared ? sharedIds : readSaved(store);
      const list = ids.map((id) => store.get(id)).filter(Boolean);
      const colors = compositePalette(list);
      const stats = breakdown(store, list);

      mount(root, html`
      <div class="page collection">
        <header class="col-head">
          <div>
            <p class="col-kicker">${isShared ? 'Общая подборка по ссылке' : 'Личный словарь вкуса'}</p>
            <h1 class="col-title">${isShared ? 'Подборка стилей' : 'Моя полка вкуса'}</h1>
            <p class="col-lead">${list.length
              ? `${list.length} ${plural(list.length, 'стиль', 'стиля', 'стилей')}${isShared ? ' в этой ссылке.' : ' сохранено на этом устройстве. Без регистрации — только ваш браузер.'}`
              : 'Сохраняйте откликнувшиеся стили в любом зале или на карте, чтобы собрать собственную палитру вкуса и поделиться ею ссылкой.'}</p>
          </div>
          ${list.length ? html`<div class="col-actions">
            ${isShared ? html`<button class="btn" type="button" data-import-shared>Сохранить на мою полку</button>` : ''}
            ${list.length >= 2 ? html`<a class="btn${isShared ? ' ghost' : ''}" href="#/compare?a=${list[0].id}&b=${list[1].id}">Сравнить два стиля</a>` : ''}
            <button class="btn ghost" type="button" data-share-col>Поделиться ссылкой</button>
            ${!isShared ? html`<button class="btn ghost" type="button" data-clear-col>Очистить</button>` : ''}
          </div>` : ''}
        </header>

        ${list.length ? html`
          <section class="col-summary" aria-label="Срез вкуса">
            ${colors.length ? html`<div class="col-pal-wrap">
              <p class="pal-label">Собранная палитра вкуса</p>
              <div class="palette-strip col-palette" role="group" aria-label="Собранная палитра вкуса">
                ${colors.map((c) => html`<button type="button" class="pal" style="--c:${c}" data-hex="${c}" title="Скопировать ${c}"><span class="visually-hidden">Скопировать ${c}</span></button>`)}
              </div>
              <p class="pal-hint">Ключевые цвета сохранённых стилей. Нажмите на оттенок, чтобы скопировать HEX.</p>
            </div>` : ''}
            <div class="col-stats">
              <div>
                <p class="pal-label">Ближе всего по эпохам</p>
                <div class="col-tags">${stats.topEras.map((e) => html`<a class="chip" href="#/catalog?e=${e.id}"><span class="swatch" style="--c:var(--era-${e.id})"></span>${e.name} <span class="count">${e.n}</span></a>`)}</div>
              </div>
              <div>
                <p class="pal-label">Области</p>
                <div class="col-tags">${stats.topDoms.map((d) => html`<a class="chip" href="#/catalog?d=${d.id}">${d.name} <span class="count">${d.n}</span></a>`)}</div>
              </div>
            </div>
          </section>

          <div class="cat-grid col-grid">
            ${list.map((s) => {
              const cover = s.example.img ?? s.gallery.find((g) => g.img)?.img ?? null;
              const ar = clampAr(cover);
              return html`<div class="col-tile" style="--ar:${ar.toFixed(3)}">
                <a class="tile" href="#/s/${s.id}">
                  ${frame(cover, s.palette, { ratio: ar.toFixed(3), sizes: `${Math.round(ar * 240)}px`, alt: '', size: ar > 1.3 ? 960 : 500 })}
                  <span class="tile-cap"><span class="swatch" style="--c:var(--era-${s.era})"></span><span class="tile-name">${displayTitle(s)}</span><span class="tile-dates">${s.kind[0] ? `${KIND[s.kind[0]]}, ` : ''}${fmtDates(s)}</span></span>
                </a>
                ${!isShared ? html`<button class="col-rm" type="button" data-rm-fav="${s.id}" aria-label="Убрать «${displayTitle(s)}» с полки" title="Убрать с полки">×</button>` : ''}
              </div>`;
            })}
          </div>
        ` : html`
          <div class="col-empty">
            <p>Пока полка пуста. Откройте любой стиль и нажмите «На полку» — или начните с короткой экскурсии.</p>
            <div class="hero-actions">
              <a class="btn" href="#/catalog">Открыть каталог</a>
              <a class="btn ghost" href="#/map">Открыть карту</a>
              ${store.trails?.[0] ? html`<a class="btn ghost" href="#/s/${store.trails[0].stops[0].id}?trail=${store.trails[0].id}">Экскурсия «${store.trails[0].title}»</a>` : ''}
            </div>
          </div>
        `}
      </div>
      ${footer(store)}`);
      markLoaded(root);
    }

    const onClick = (e) => {
      const pal = e.target.closest('.pal[data-hex]');
      if (pal) {
        navigator.clipboard?.writeText(pal.dataset.hex).then(() => toast(`Скопировано: ${pal.dataset.hex}`), () => toast(pal.dataset.hex));
        return;
      }
      const rm = e.target.closest('[data-rm-fav]');
      if (rm) {
        toggleSaved(rm.dataset.rmFav, store);
        draw();
        toast('Убрано с полки');
        return;
      }
      if (e.target.closest('[data-share-col]')) {
        const ids = isShared ? sharedIds : readSaved(store);
        const url = shareCollectionUrl(ids);
        navigator.clipboard?.writeText(url).then(() => toast('Ссылка на подборку скопирована'), () => toast(url));
        return;
      }
      if (e.target.closest('[data-import-shared]')) {
        mergeSaved(sharedIds, store);
        toast('Подборка добавлена на вашу полку');
        location.hash = '#/collection';
        return;
      }
      if (e.target.closest('[data-clear-col]')) {
        clearSaved();
        draw();
        toast('Полка очищена');
      }
    };

    root.addEventListener('click', onClick);
    draw();
    return {
      update(next) { params = next.params; draw(); },
      destroy() { root.removeEventListener('click', onClick); },
    };
  },
};
