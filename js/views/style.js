// Зал стиля: стена тонируется палитрой, работа висит с этикеткой, ниже — текст, родословная, ссылки.
import { html, mount, safeUrl } from '../html.js';
import { fmtDates, RELATION, DOMAIN } from '../format.js';
import { frame, credit } from '../ui/image.js';
import { eraTag, thumb, footer } from '../ui/common.js';
import { toast } from '../ui/toast.js';
import notfound from './notfound.js';

const ARROW_L = html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>`;
const ARROW_R = html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`;
const EXT = html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M14 5h5v5M19 5l-8 8M17 14v5H5V7h5"/></svg>`;

function relCard(store, rel, dir) {
  const s = store.get(rel.id);
  if (!s) return '';
  const label = RELATION[rel.type]?.[dir] ?? '';
  return html`<li class="ego-item rel-${rel.type}">
    <span class="ego-rel">${label}</span>
    <a class="ego-link" href="#/s/${s.id}">${thumb(s, 44)}<span><span class="ego-name">${s.name}</span><span class="ego-dates">${fmtDates(s)}</span></span></a>
  </li>`;
}

export default {
  render(root, ctx) {
    const { store, id, openLightbox } = ctx;
    const s = store.get(id);
    if (!s) return notfound.render(root, ctx);
    document.title = `${s.name} — Атлас эстетик`;

    const p = s.palette;
    const body = document.body;
    body.style.setProperty('--tint', p?.colors?.[0] ?? 'transparent');
    body.style.setProperty('--style-accent-l', p?.accentLight ?? '');
    body.style.setProperty('--style-accent-d', p?.accentDark ?? '');

    const img = s.example.img;
    const line = store.mainLine(s.id);
    const prev = store.prev(s.id);
    const next = store.next(s.id);
    const ex = s.example;

    mount(root, html`
    <article class="room">
      <header class="room-head">
        <div class="room-meta">
          ${eraTag(store, s.era)}
          <span>${fmtDates(s)}</span>
          ${s.region && s.region !== 'Интернет' ? html`<span>${s.region}</span>` : ''}
          <span>${s.domain.map((d) => DOMAIN[d]).join(', ')}</span>
        </div>
        <h1 class="room-title">${s.name}</h1>
        <p class="room-orig">${s.orig}</p>
      </header>

      <div class="room-hang">
        <figure class="room-work">
          <button class="work-zoom" type="button" ${img ? '' : 'disabled'} aria-label="Открыть работу крупно">
            ${frame(img, p, { sizes: '(min-width: 1100px) 58vw, 100vw', eager: true, size: 960, alt: ex.title ?? '', note: ex.note, capUpscale: true })}
          </button>
        </figure>
        <aside class="wall-label" aria-label="Этикетка">
          <p class="wl-title">${ex.title}</p>
          ${ex.author ? html`<p class="wl-author">${ex.author}</p>` : ''}
          <p class="wl-facts">${[ex.year, ex.place].filter(Boolean).join(', ')}</p>
          ${ex.note ? html`<p class="wl-note">${ex.note}</p>` : ''}
          ${credit(img)}
          <p class="wl-summary">${s.summary}</p>
          ${p ? html`<div class="palette-strip" role="group" aria-label="Палитра стиля">
            ${p.colors.map((c) => html`<button type="button" class="pal" style="--c:${c}" data-hex="${c}" title="Скопировать ${c}"><span class="visually-hidden">Скопировать цвет ${c}</span></button>`)}
          </div>
          <p class="pal-hint">${img ? 'Палитра посчитана по главной работе.' : 'Палитра эстетики.'} Нажмите на цвет, чтобы скопировать.</p>` : ''}
        </aside>
      </div>

      <section class="room-body">
        <div class="room-text">${s.description.map((para) => html`<p>${para}</p>`)}</div>
        <aside class="room-side">
          <h2 class="side-title">Как узнать</h2>
          <ul class="traits">${s.traits.map((t) => html`<li>${t}</li>`)}</ul>
          ${s.names.length ? html`<h2 class="side-title">Ключевые имена</h2><p class="names">${s.names.join(', ')}</p>` : ''}
        </aside>
      </section>

      ${s.gallery.length ? html`<section class="room-gallery">
        <h2 class="section-title">Ещё примеры</h2>
        <div class="gallery-grid">
          ${s.gallery.map((g, i) => html`<figure class="art">
            <button class="work-zoom" type="button" data-gallery="${i}" ${g.img ? '' : 'disabled'} aria-label="Открыть крупно: ${g.title ?? ''}">${frame(g.img, p, { sizes: '(min-width: 900px) 30vw, 90vw', alt: g.title ?? '', capUpscale: true })}</button>
            <figcaption><span class="g-title">${g.title}</span>${[g.author, g.year].filter(Boolean).length ? html`<span class="g-meta">${[g.author, g.year].filter(Boolean).join(', ')}</span>` : ''}</figcaption>
            ${credit(g.img)}
          </figure>`)}
        </div>
      </section>` : ''}

      <section class="lineage">
        <h2 class="section-title">Родословная</h2>
        ${line.length > 1 ? html`<p class="lineage-lead">Главная линия от истоков до этого стиля</p>
        <ol class="line-strip">
          ${line.map((a) => html`<li class="${a.id === s.id ? 'is-current' : ''}" style="--c:var(--era-${a.era})">
            <a href="#/s/${a.id}" ${a.id === s.id ? 'aria-current="page"' : ''}>${thumb(a, 64)}<span class="ls-name">${a.name}</span><span class="ls-dates">${fmtDates(a)}</span></a>
          </li>`)}
        </ol>` : html`<p class="lineage-lead">Один из истоков: в атласе у этого стиля нет предшественников.</p>`}
        <div class="ego">
          <div class="ego-col">
            <h3 class="ego-title">Откуда</h3>
            ${s.parents.length ? html`<ul>${s.parents.map((r) => relCard(store, r, 'from'))}</ul>` : html`<p class="muted">Исток</p>`}
          </div>
          <div class="ego-center" aria-hidden="true"><span>${s.name}</span></div>
          <div class="ego-col">
            <h3 class="ego-title">Куда</h3>
            ${s.children.length ? html`<ul>${s.children.map((r) => relCard(store, r, 'to'))}</ul>` : html`<p class="muted">Продолжения пока не появились или ещё не описаны в атласе.</p>`}
          </div>
        </div>
        <a class="btn ghost" href="#/map?s=${s.id}">Показать на карте</a>
      </section>

      <section class="study">
        <h2 class="section-title">Изучить дальше</h2>
        <ul class="links">
          ${s.links.map((l) => html`<li><a href="${safeUrl(l.url)}" target="_blank" rel="noopener">
            <span class="l-title">${l.title ?? l.src}</span>
            <span class="l-src">${l.src}${l.lang === 'multi' ? '' : l.lang === 'ru' ? ', на русском' : ', на английском'}</span>
            ${EXT}
          </a></li>`)}
        </ul>
      </section>

      <nav class="room-pager" aria-label="Соседние стили по времени">
        ${prev ? html`<a class="pager-prev" href="#/s/${prev.id}">${ARROW_L}<span><span class="pg-label">Раньше</span><span class="pg-name">${prev.name}</span></span></a>` : html`<span></span>`}
        ${next ? html`<a class="pager-next" href="#/s/${next.id}"><span><span class="pg-label">Позже</span><span class="pg-name">${next.name}</span></span>${ARROW_R}</a>` : html`<span></span>`}
      </nav>
    </article>
    ${footer(store)}`);

    // Интерактив
    const onClick = (e) => {
      const pal = e.target.closest('.pal');
      if (pal) {
        navigator.clipboard?.writeText(pal.dataset.hex).then(() => toast(`Скопировано: ${pal.dataset.hex}`), () => toast(pal.dataset.hex));
        return;
      }
      const zoom = e.target.closest('.work-zoom');
      if (zoom && !zoom.disabled) {
        const gi = zoom.dataset.gallery;
        if (gi !== undefined) { const g = s.gallery[+gi]; openLightbox(g.img, [g.title, g.author, g.year].filter(Boolean).join(', ')); }
        else openLightbox(img, [ex.title, ex.author, ex.year].filter(Boolean).join(', '));
      }
    };
    root.addEventListener('click', onClick);

    const onKey = (e) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName) || document.querySelector('dialog[open]')) return;
      if (e.key === 'ArrowLeft' && prev) location.hash = `#/s/${prev.id}`;
      if (e.key === 'ArrowRight' && next) location.hash = `#/s/${next.id}`;
    };
    document.addEventListener('keydown', onKey);

    // Прокрутить полосу родословной к текущему стилю
    const strip = root.querySelector('.line-strip');
    if (strip) strip.scrollLeft = strip.scrollWidth;

    return {
      destroy() {
        root.removeEventListener('click', onClick);
        document.removeEventListener('keydown', onKey);
      },
    };
  },
};
