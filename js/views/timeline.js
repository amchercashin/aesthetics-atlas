// Хронология: двенадцать глав-эпох, у каждой свой пигмент; внутри — стили по времени.
import { html, mount } from '../html.js';
import { fmtDates, fmtYear, RELATION } from '../format.js?v=audit';
import { frame } from '../ui/image.js?v=audit';
import { footer } from '../ui/common.js?v=audit';

export default {
  render(root, ctx) {
    const { store } = ctx;
    document.title = 'Хронология — Атлас эстетик';

    mount(root, html`
    <div class="tl">
      <nav class="tl-spine" aria-label="Эпохи">
        <ol>
          ${store.eras.map((e) => html`<li><a href="#/timeline?era=${e.id}" data-era="${e.id}" style="--c:var(--era-${e.id})">
            <span class="sp-mark"></span><span class="sp-name">${e.short}</span>
          </a></li>`)}
        </ol>
      </nav>
      <div class="tl-main">
        <header class="tl-head">
          <h1 class="tl-title">Хронология</h1>
          <p class="tl-lead">От первых отпечатков ладоней до эстетик, которые родились в TikTok вчера. Читайте по порядку или переходите к нужной эпохе через оглавление.</p>
        </header>
        ${store.eras.map((e) => {
          const items = store.inEra(e.id);
          return html`<section class="chapter" id="era-${e.id}" style="--c:var(--era-${e.id})" aria-labelledby="t-${e.id}">
            <header class="chapter-head">
              <div class="paint-chip" aria-hidden="true"><span class="paint"></span><span class="paint-name">${e.pigment}</span></div>
              <div>
                <h2 class="chapter-title" id="t-${e.id}">${e.name}</h2>
                <p class="chapter-range">${fmtYear(e.start)} – ${e.end >= store.now ? 'наши дни' : fmtYear(e.end)}</p>
                <p class="chapter-intro">${e.intro}</p>
              </div>
            </header>
            ${items.length ? html`<ol class="entries">
              ${items.map((s) => html`<li class="entry">
                <a class="entry-link" href="#/s/${s.id}">
                  <span class="e-art">${frame(s.example.img, s.palette, { ratio: '4 / 3', sizes: '(min-width: 900px) 220px, 34vw', alt: '', size: 500 })}</span>
                  <span class="e-text">
                    <span class="e-dates">${fmtDates(s)}</span>
                    <span class="e-name">${s.name}</span>
                    <span class="e-orig">${s.orig}</span>
                    <span class="e-sum">${s.summary}</span>
                  </span>
                </a>
                ${s.parents.length ? html`<p class="e-from">${s.parents.every((p) => p.status !== 'verified') ? 'По версии атласа: ' : ''}${s.parents.map((p, i) => {
                  const par = store.get(p.id);
                  return par ? html`${i ? ', ' : ''}${RELATION[p.type].from} <a href="#/s/${par.id}">${par.name}</a>${p.status === 'verified' ? html` <span class="st st-verified" title="Связь подтверждена источником"><span class="visually-hidden">подтверждено</span></span>` : ''}` : '';
                })}</p>` : s.origin === 'unknown' ? html`<p class="e-from">Происхождение не установлено</p>` : ''}
              </li>`)}
            </ol>` : html`<p class="chapter-empty">Стили этой эпохи появятся в атласе позже.</p>`}
          </section>`;
        })}
      </div>
    </div>
    ${footer(store)}`);

    const links = [...root.querySelectorAll('.tl-spine a')];
    const setActive = (id) => links.forEach((a) => a.classList.toggle('is-active', a.dataset.era === id));
    const io = new IntersectionObserver((entries) => {
      const vis = entries.filter((en) => en.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (vis) setActive(vis.target.id.replace('era-', ''));
    }, { rootMargin: '-30% 0px -60% 0px' });
    root.querySelectorAll('.chapter').forEach((c) => io.observe(c));

    const jump = (era, smooth) => {
      const el = era && root.querySelector(`#era-${CSS.escape(era)}`);
      if (el) { el.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' }); setActive(era); }
    };
    requestAnimationFrame(() => jump(ctx.params.get('era'), false));

    return {
      update(next) { jump(next.params.get('era'), true); },
      destroy() { io.disconnect(); },
    };
  },
};
