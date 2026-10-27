// Главная: заголовок с «Удиви меня» (промт для генератора картинок), лента эпох (вся история одной полосой), три входа и стиль дня.
// Поиск — в шапке, на главной он не дублируется.
import { html, mount } from '../html.js';
import { fmtDates, fmtYear, plural } from '../format.js?v=audit';
import { frame } from '../ui/image.js?v=audit-p1p2';
import { footer, thumb } from '../ui/common.js?v=audit-p1p2';
import { createTimeScale, segmentWidths } from '../timescale.js';
import { layoutRows } from '../layout.js';
import { promptFor, pickOther, surprisePool } from '../prompt.js?v=ai-5';
import { aiHead, aiPromptBody, mountAiPrompt } from '../ui/ai-prompt.js?v=ai-5';

const DICE = html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="3"/><g fill="currentColor" stroke="none"><circle cx="8.5" cy="8.5" r="1.3"/><circle cx="15.5" cy="15.5" r="1.3"/><circle cx="12" cy="12" r="1.3"/></g></svg>`;

function miniMap(store) {
  const breaks = [...store.eras.map((e) => e.start), store.now + 1];
  const widths = segmentWidths(breaks, store.styles.map((s) => s.start), { base: 60, perItem: 18, min: 70 });
  const sc = createTimeScale(breaks, widths);
  const { rows, count } = layoutRows(
    store.styles.map((s) => ({ id: s.id, start: s.start, end: s.end, tier: s.tier, width: s.name.length * 4.2, parents: s.parents.map((p) => p.id) })),
    sc.x, { now: store.now, dot: 4, gap: 8 },
  );
  const W = sc.total, rowH = 9, H = Math.max(count, 6) * rowH + 12;
  const y = (id) => 6 + rows.get(id) * rowH;
  const edges = [];
  for (const s of store.styles) for (const p of s.parents) {
    const par = store.get(p.id);
    if (!par) continue;
    const sx = sc.x(Math.min(s.start, par.end ?? store.now)), ex = sc.x(s.start);
    const c = Math.max(6, Math.abs(ex - sx) / 2);
    edges.push(`M${sx},${y(par.id)} C${sx + c},${y(par.id)} ${ex - c},${y(s.id)} ${ex},${y(s.id)}`);
  }
  return html`<svg class="mini-map" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
    ${store.eras.map((e, i) => html`<rect x="${sc.segments[i].x0}" y="0" width="${sc.segments[i].x1 - sc.segments[i].x0}" height="3" fill="var(--era-${e.id})"/>`)}
    <path d="${edges.join(' ')}" fill="none" stroke="currentColor" stroke-width="0.8" opacity="0.45" vector-effect="non-scaling-stroke"/>
    ${store.styles.map((s) => html`<line x1="${sc.x(s.start)}" x2="${sc.x(s.end ?? store.now)}" y1="${y(s.id)}" y2="${y(s.id)}" stroke="var(--era-${s.era})" stroke-width="2.4" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`)}
  </svg>`;
}

export default {
  render(root, { store }) {
    document.title = 'Атлас эстетик — родословная визуальных стилей';
    const n = store.styles.length;
    const frieze = store.styles.filter((s) => s.tier === 1);
    const day = store.styleOfDay();
    const mosaic = store.styles.filter((s) => s.example.img).sort((a, b) => a.tier - b.tier || b.start - a.start).slice(0, 6);

    mount(root, html`
    <section class="hero page">
      <h1 class="hero-title">Как люди придумывали красоту: от пещеры Ласко до уирдкора</h1>
      <div class="hero-side">
        <p class="hero-lead">${n} ${plural(n, 'визуальный стиль', 'визуальных стиля', 'визуальных стилей')} — от трафаретов ладоней, которым не меньше 67 тысяч лет, до интернет-эстетик. Для каждого — откуда он, по версии атласа, произошёл, как его узнать, главная работа и что почитать дальше.</p>
        ${store.promptSubjects.length ? html`<section class="hero-ai" aria-labelledby="hero-ai-title">
          ${aiHead('hero-ai-title', { nextHidden: true })}
          <div class="hero-ai-intro" data-ai-intro>
            <p class="hero-ai-lead">Случайный стиль атласа и случайный предмет — готовый промт для генератора картинок.</p>
            <button class="btn" type="button" data-surprise aria-controls="hero-ai-body">${DICE}Удиви меня</button>
          </div>
          <div class="hero-ai-body" id="hero-ai-body" hidden>
            <p class="ai-style" data-ai-style></p>
            ${aiPromptBody('', { id: 'hero-ai-text' })}
          </div>
        </section>` : ''}
      </div>
    </section>

    <section class="frieze" aria-label="Лента эпох: главные стили по порядку">
      <div class="frieze-track" tabindex="0">
        ${frieze.map((s) => html`<a class="frieze-item" href="#/s/${s.id}" style="--c:var(--era-${s.era})">
          ${frame(s.example.img, s.palette, { sizes: '320px', alt: '', size: 500 })}
          <span class="frieze-year">${fmtYear(s.start)}</span>
          <span class="frieze-name">${s.name}</span>
        </a>`)}
      </div>
      <div class="frieze-foot page-x">
        <p class="muted">Вся история одной полосой: листайте ленту или нажмите на работу, чтобы войти в зал.</p>
        <div class="frieze-btns">
          <button class="icon-btn" type="button" data-scroll="-1" aria-label="Назад по ленте"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M15 6l-6 6 6 6"/></svg></button>
          <button class="icon-btn" type="button" data-scroll="1" aria-label="Вперёд по ленте"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M9 6l6 6-6 6"/></svg></button>
        </div>
      </div>
    </section>

    <section class="ways page" aria-label="Способы изучать атлас">
      <a class="way" href="#/map">
        <span class="way-visual way-map">${miniMap(store)}</span>
        <span class="way-title">Карта родословной</span>
        <span class="way-text">Все стили на оси времени и связи между ними. Выберите любой — подсветятся предки и потомки; у каждой связи указано, проверена ли она.</span>
      </a>
      <a class="way" href="#/timeline">
        <span class="way-visual way-pigments">
          ${store.eras.map((e) => html`<span class="pig" style="--c:var(--era-${e.id})"><i></i><span>${e.short}</span></span>`)}
        </span>
        <span class="way-title">Хронология</span>
        <span class="way-text">Двенадцать эпох по порядку, каждая со своим пигментом. Чтобы сесть и прочитать историю от начала до конца.</span>
      </a>
      <a class="way" href="#/catalog">
        <span class="way-visual way-mosaic">${mosaic.map((s) => thumb(s, 120))}</span>
        <span class="way-title">Каталог</span>
        <span class="way-text">Все стили одной сеткой работ. Фильтры по эпохе, области, сюжету и технике: например, все стили для пейзажа или все рельефы.</span>
      </a>
    </section>

    <section class="day page" aria-labelledby="day-title">
      <a class="day-work" href="#/s/${day.id}">${frame(day.example.img, day.palette, { sizes: '(min-width: 900px) 50vw, 100vw', alt: day.example.title ?? '', size: 960 })}</a>
      <div class="day-text">
        <h2 class="day-kicker" id="day-title">Стиль дня</h2>
        <p class="day-name"><a href="#/s/${day.id}">${day.name}</a></p>
        <p class="day-dates">${fmtDates(day)}</p>
        <p class="day-summary">${day.summary}</p>
        <div class="day-actions">
          <a class="btn" href="#/s/${day.id}">Открыть зал</a>
          <a class="btn ghost" href="#/s/${store.random().id}" data-random>Случайный стиль</a>
        </div>
      </div>
    </section>

    ${footer(store)}`);

    // «Удиви меня» раскрывает блок; «Другой вариант» меняет и стиль, и предмет.
    const box = root.querySelector('.hero-ai');
    let pick = null;
    const pool = surprisePool(store.styles);
    const surprise = () => {
      const style = pickOther(pool, Math.random, pick?.style);
      pick = { style, subject: pickOther(store.promptSubjects, Math.random, pick?.subject) };
      mount(box.querySelector('[data-ai-style]'), html`<a href="#/s/${style.id}">${thumb(style, 40)}<span><span class="ai-style-name">${style.name}</span><span class="ai-style-dates">${fmtDates(style)} · открыть зал</span></span></a>`);
      return promptFor(store, style, pick.subject);
    };
    const ai = box && mountAiPrompt(box, { next: surprise });

    const track = root.querySelector('.frieze-track');
    const onClick = (e) => {
      const b = e.target.closest('[data-scroll]');
      if (b) track.scrollBy({ left: Number(b.dataset.scroll) * track.clientWidth * 0.8, behavior: 'smooth' });
      const r = e.target.closest('[data-random]');
      if (r) r.href = `#/s/${store.random().id}`;
      if (e.target.closest('[data-surprise]')) {
        ai.set(surprise());
        box.querySelector('[data-ai-intro]').hidden = true;
        box.querySelector('#hero-ai-body').hidden = false;
        box.querySelector('[data-ai-next]').hidden = false;
        // Кнопка исчезла — фокус на сам промт, чтобы с клавиатуры продолжить к «Открыть в ChatGPT».
        box.querySelector('[data-ai-text]').focus({ preventScroll: true });
      }
    };
    root.addEventListener('click', onClick);
    return { destroy() { root.removeEventListener('click', onClick); ai?.destroy(); } };
  },
};
