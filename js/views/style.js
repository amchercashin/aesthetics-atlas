// Зал стиля: стена тонируется палитрой, работа висит с этикеткой, ниже — текст, родословная, ссылки.
// Статус проверки карточки и связей виден сразу; источники утверждений — под раскрытием.
import { html, mount, safeUrl } from '../html.js';
import { fmtDates, fmtYear, RELATION, DOMAIN, KIND, DATE_KIND, REL_STATUS, roleLabel, plural } from '../format.js?v=audit';
import { frame, credit } from '../ui/image.js?v=audit-p1p2';
import { eraTag, thumb, footer } from '../ui/common.js?v=audit-p1p2';
import { toast } from '../ui/toast.js';
import notfound from './notfound.js';

const ARROW_L = html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>`;
const ARROW_R = html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`;
const EXT = html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M14 5h5v5M19 5l-8 8M17 14v5H5V7h5"/></svg>`;

// «13 октября 2026» — без «г.», чтобы не получить двойную точку в конце фразы.
const fmtDay = (d) => (d ? new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).replace(/\s*г\.$/, '') : '');

function sourceLinks(store, ids) {
  const list = (ids ?? []).map((id) => store.source(id)).filter(Boolean);
  if (!list.length) return '';
  return html`<p class="ego-src">Источник: ${list.map((src, i) => html`${i ? '; ' : ''}<a href="${safeUrl(src.url)}" target="_blank" rel="noopener">${src.publisher ?? src.title}</a>`)}</p>`;
}

function relCard(store, rel, dir) {
  const s = store.get(rel.id);
  if (!s) return '';
  const label = RELATION[rel.type]?.[dir] ?? '';
  return html`<li class="ego-item rel-${rel.type} st-${rel.status}">
    <span class="ego-rel">${label} · <span class="st st-${rel.status}">${REL_STATUS[rel.status]}</span></span>
    <a class="ego-link" href="#/s/${s.id}">${thumb(s, 44)}<span><span class="ego-name">${s.name}</span><span class="ego-dates">${fmtDates(s)}</span></span></a>
    ${rel.note ? html`<p class="ego-note">${rel.note}</p>` : ''}
    ${sourceLinks(store, rel.sources)}
  </li>`;
}

// Первый parent задаёт маршрут, но каждый переход сохраняет собственный тип и статус.
export function lineageStrip(line, currentId) {
  return html`<ol class="line-strip">${line.map((s, i) => {
    const rel = i ? s.parents.find((p) => p.id === line[i - 1].id) : null;
    return html`<li class="${s.id === currentId ? 'is-current' : ''}" style="--c:var(--era-${s.era})">
      <span class="ls-connection">${rel
        ? html`${RELATION[rel.type]?.label} · <span class="st st-${rel.status}">${REL_STATUS[rel.status]}</span>`
        : 'Начало маршрута'}</span>
      <a href="#/s/${s.id}" ${s.id === currentId ? html`aria-current="page"` : ''}>${thumb(s, 64)}<span class="ls-name">${s.name}</span><span class="ls-dates">${fmtDates(s)}</span></a>
    </li>`;
  })}</ol>`;
}

function reviewLine(s) {
  const r = s.review;
  if (r.status === 'reviewed') return html`<p class="review st-reviewed">Сверено с источниками ${fmtDay(r.date)}.${r.note ? ` ${r.note}` : ''}</p>`;
  if (r.status === 'partial') return html`<p class="review st-partial">Частично сверено с источниками ${fmtDay(r.date)}. ${r.note ?? ''}</p>`;
  return html`<p class="review st-legacy">Черновая карточка: даты, связи и формулировки ещё не сверены с источниками. <a href="#/about">Как устроена проверка</a></p>`;
}

function datesBlock(store, s) {
  const term = s.termAttested;
  const src = term ? store.source(term.source) : null;
  if (!s.dateKind && !s.dateNote && !term && !s.revivals.length) return '';
  return html`<h2 class="side-title">Что значат даты</h2>
    <p class="dates-main">${fmtDates(s)}${s.dateKind ? html`<span class="dates-kind">${DATE_KIND[s.dateKind]}</span>` : ''}</p>
    ${s.dateNote ? html`<p class="dates-note">${s.dateNote}</p>` : ''}
    ${term ? html`<p class="dates-note">Слово документировано к ${fmtYear(term.year)} году${src ? html` — <a href="${safeUrl(src.url)}" target="_blank" rel="noopener">${src.publisher ?? src.title}</a>` : ''}.${term.note ? ` ${term.note}` : ''}</p>` : ''}
    ${s.revivals.map((r) => html`<p class="dates-note">Возвращение: ${fmtYear(r.start)}${r.end ? `–${fmtYear(r.end)}` : '-е'}${r.note ? ` — ${r.note.toLowerCase()}` : ''}.</p>`)}`;
}

function paletteBlock(s, img) {
  const p = s.palette;
  if (!p) return '';
  const editorial = p.source === 'editorial';
  const label = editorial ? 'Редакторская подборка цветов' : 'Цвета этого изображения';
  const hint = editorial
    ? p.note ?? 'Цвета подобраны редакцией по признакам стиля.'
    : 'Пять цветов, которые алгоритм нашёл на главной иллюстрации. Это не палитра всего стиля.';
  return html`<p class="pal-label">${label}</p>
    <div class="palette-strip" role="group" aria-label="${label}">
      ${p.colors.map((c) => html`<button type="button" class="pal" style="--c:${c}" data-hex="${c}" title="Скопировать ${c}"><span class="visually-hidden">Скопировать цвет ${c}</span></button>`)}
    </div>
    <p class="pal-hint">${hint} Нажмите на цвет, чтобы скопировать.</p>`;
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

    const ex = s.example;
    const img = ex.img;
    const line = store.mainLine(s.id);
    const prev = store.prev(s.id);
    const next = store.next(s.id);
    const role = roleLabel(ex.role);
    const evidence = s.evidence.map((e) => ({ ...e, src: store.source(e.source) })).filter((e) => e.src);

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
        ${s.kind.length ? html`<p class="room-kind">${s.kind.map((k) => html`<span class="kind-badge">${KIND[k]}</span>`)}${s.kindNote ? html`<span class="kind-note">${s.kindNote}</span>` : ''}</p>` : ''}
        ${s.scopeNote ? html`<p class="room-scope"><strong>Границы карточки.</strong> ${s.scopeNote}</p>` : ''}
        ${reviewLine(s)}
      </header>

      <div class="room-hang">
        <figure class="room-work">
          <button class="work-zoom" type="button" ${img ? '' : 'disabled'} aria-label="Открыть работу крупно">
            ${frame(img, p, { sizes: '(min-width: 1100px) 58vw, 100vw', eager: true, size: 960, alt: ex.title ?? '', note: ex.external ? 'Изображение не встраивается' : ex.note, capUpscale: true })}
          </button>
        </figure>
        <aside class="wall-label" aria-label="Этикетка">
          ${role ? html`<p class="wl-role">${role}</p>` : ''}
          <p class="wl-title">${ex.title}</p>
          ${ex.author ? html`<p class="wl-author">${ex.author}</p>` : ''}
          <p class="wl-facts">${[ex.year, ex.place].filter(Boolean).join(', ')}</p>
          ${ex.note && ex.note !== role ? html`<p class="wl-note">${ex.note}</p>` : ''}
          ${ex.why ? html`<p class="wl-why"><strong>Что здесь видно.</strong> ${ex.why}</p>` : ''}
          ${sourceLinks(store, ex.sources)}
          ${credit(img)}
          ${ex.external ? html`<p class="credit"><a href="${safeUrl(ex.external.page)}" target="_blank" rel="noopener">Открыть изображение на странице файла</a></p>` : ''}
          <p class="wl-summary">${s.summary}</p>
          ${paletteBlock(s, img)}
        </aside>
      </div>

      <section class="room-body">
        <div class="room-text">${s.description.map((para) => html`<p>${para}</p>`)}</div>
        <aside class="room-side">
          <h2 class="side-title">Как узнать</h2>
          <ul class="traits">${s.traits.map((t) => html`<li>${t}</li>`)}</ul>
          ${s.names.length ? html`<h2 class="side-title">Ключевые имена</h2><p class="names">${s.names.join(', ')}</p>` : ''}
          ${datesBlock(store, s)}
        </aside>
      </section>

      ${s.gallery.length ? html`<section class="room-gallery">
        <h2 class="section-title">Ещё примеры</h2>
        <div class="gallery-grid">
          ${s.gallery.map((g, i) => html`<figure class="art">
            <button class="work-zoom" type="button" data-gallery="${i}" ${g.img ? '' : 'disabled'} aria-label="Открыть крупно: ${g.title ?? ''}">${frame(g.img, p, { sizes: '(min-width: 900px) 30vw, 90vw', alt: g.title ?? '', capUpscale: true })}</button>
            <figcaption>${roleLabel(g.role) ? html`<span class="wl-role">${roleLabel(g.role)}</span>` : ''}<span class="g-title">${g.title}</span>${[g.author, g.year, g.place].filter(Boolean).length ? html`<span class="g-meta">${[g.author, g.year, g.place].filter(Boolean).join(', ')}</span>` : ''}${g.note ? html`<span class="g-meta">${g.note}</span>` : ''}${g.why ? html`<span class="g-meta">${g.why}</span>` : ''}</figcaption>
            ${sourceLinks(store, g.sources)}
            ${credit(g.img)}
            ${g.external ? html`<p class="credit"><a href="${safeUrl(g.external.page)}" target="_blank" rel="noopener">Открыть изображение на странице файла</a></p>` : ''}
          </figure>`)}
        </div>
      </section>` : ''}

      <section class="lineage">
        <h2 class="section-title">Цепочка связей</h2>
        ${line.length > 1 ? html`<p class="lineage-lead">Один из редакционных маршрутов по атласу, по первой связи каждой карточки. Для переходов показаны тип и степень проверки: влияние, реакция и возрождение не означают прямого происхождения.</p>
        ${lineageStrip(line, s.id)}` : s.origin === 'unknown'
          ? html`<p class="lineage-lead">Подтверждённый предшественник в атласе не установлен.${s.comparisons.length ? ' Похожие по виду стили — в разделе «Визуальные сопоставления».' : ''}</p>`
          : html`<p class="lineage-lead">Один из независимых истоков в атласе: предшественников у этого стиля здесь нет.</p>`}
        <div class="ego">
          <div class="ego-col">
            <h3 class="ego-title">Откуда</h3>
            ${s.parents.length ? html`<ul>${s.parents.map((r) => relCard(store, r, 'from'))}</ul>` : html`<p class="muted">${s.origin === 'unknown' ? 'Не установлено' : 'Исток'}</p>`}
          </div>
          <div class="ego-center" aria-hidden="true"><span>${s.name}</span></div>
          <div class="ego-col">
            <h3 class="ego-title">Куда</h3>
            ${s.children.length ? html`<ul>${s.children.map((r) => relCard(store, r, 'to'))}</ul>` : html`<p class="muted">Продолжения пока не появились или ещё не описаны в атласе.</p>`}
          </div>
        </div>
        <a class="btn ghost" href="#/map?s=${s.id}">Показать на карте</a>
      </section>

      ${s.comparisons.length ? html`<section class="compare">
        <h2 class="section-title">Визуальные сопоставления</h2>
        <p class="lineage-lead">Похожие по виду стили. Это сходство, а не заявление о происхождении.</p>
        <ul class="cmp-list">
          ${s.comparisons.map((c) => { const o = store.get(c.id); return o ? html`<li class="ego-item">
            <a class="ego-link" href="#/s/${o.id}">${thumb(o, 44)}<span><span class="ego-name">${o.name}</span><span class="ego-dates">${fmtDates(o)}</span></span></a>
            ${c.note ? html`<p class="ego-note">${c.note}</p>` : ''}
          </li>` : ''; })}
        </ul>
      </section>` : ''}

      ${evidence.length ? html`<section class="evidence">
        <details>
          <summary><span class="section-title">На чём основано</span><span class="ev-count">${evidence.length} ${plural(evidence.length, 'утверждение', 'утверждения', 'утверждений')} с источниками</span></summary>
          <ul class="ev-list">
            ${evidence.map((e) => html`<li>
              <p class="ev-claim">${e.claim}</p>
              <p class="ev-src"><a href="${safeUrl(e.src.url)}" target="_blank" rel="noopener">${e.src.title}</a>${e.src.publisher ? `, ${e.src.publisher}` : ''}${e.src.checked ? ` · проверено ${fmtDay(e.src.checked)}` : ''}</p>
              ${e.src.note ? html`<p class="ev-note">${e.src.note}</p>` : ''}
            </li>`)}
          </ul>
        </details>
      </section>` : ''}

      <section class="study">
        <h2 class="section-title">Изучить дальше</h2>
        <p class="lineage-lead">Материалы для самостоятельного чтения. Сами по себе они не подтверждают каждое утверждение карточки.</p>
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
