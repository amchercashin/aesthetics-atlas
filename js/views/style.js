// Зал стиля: стена тонируется палитрой, под работой — её этикетка; рядом — суть стиля и цвета, отдельным блоком — «Нарисовать с ИИ».
// Ниже — текст, родословная, ссылки.
// Статус проверки карточки и связей виден сразу; источники утверждений — под раскрытием.
import { html, mount, safeUrl } from '../html.js';
import { fmtDates, fmtYear, RELATION, DOMAIN, KIND, DATE_KIND, REL_STATUS, roleLabel, plural } from '../format.js?v=regional-01';
import { frame, credit } from '../ui/image.js?v=author-pilot';
import { eraTag, thumb, footer } from '../ui/common.js?v=links-1';
import { toast } from '../ui/toast.js';
import notfound from './notfound.js';
import { authorshipSection, corpusSection, contextSection } from '../ui/corpus.js';
import { directLinks, linkStep, linkKey, egoMap, mountEgoMap } from '../ui/ego-map.js?v=links-1';
import { promptFor, styleAnchor, pickOther } from '../prompt.js';
import { aiHead, aiPromptBody, mountAiPrompt } from '../ui/ai-prompt.js?v=ai-2';

const ARROW_L = html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>`;
const ARROW_R = html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`;
const EXT = html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M14 5h5v5M19 5l-8 8M17 14v5H5V7h5"/></svg>`;

// «13 октября 2026» — без «г.», чтобы не получить двойную точку в конце фразы.
const fmtDay = (d) => {
  if (!d) return '';
  const [y, m, day] = String(d).slice(0, 10).split('-').map(Number);
  const date = Number.isFinite(y) && Number.isFinite(m) && Number.isFinite(day) ? new Date(y, m - 1, day) : new Date(d);
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).replace(/\s*г\.$/, '');
};

function sourceLinks(store, ids) {
  const list = (ids ?? []).map((id) => store.source(id)).filter(Boolean);
  if (!list.length) return '';
  return html`<p class="ego-src">Источник: ${list.map((src, i) => html`${i ? '; ' : ''}<a href="${safeUrl(src.url)}" target="_blank" rel="noopener">${src.publisher ?? src.title}</a>`)}</p>`;
}

// Пояснения к прямым связям: строка на связь, текст свёрнут до двух строк, источники — при раскрытии.
// Порядок и ключи те же, что у мини-карты, поэтому наведение подсвечивает связь и там, и здесь.
function linkNotes(store, s, { from, to }) {
  const rows = [
    ...from.map((x, i) => ({ key: linkKey('f', i), a: x.style, b: s, rel: x.rel })),
    ...to.map((x, i) => ({ key: linkKey('t', i), a: s, b: x.style, rel: x.rel })),
  ];
  if (!rows.length) return '';
  const head = (r) => html`<span class="em-line"><span class="em-pair">${r.a.name} → ${r.b.name}</span><span class="em-type">${RELATION[r.rel.type]?.label} · <span class="st st-${r.rel.status}">${REL_STATUS[r.rel.status]}</span></span></span>${r.rel.note ? html`<span class="em-note">${r.rel.note}</span>` : ''}`;
  return html`<div class="em-why">
    <h3 class="em-why-title">Почему связаны</h3>
    <ul>${rows.map((r) => html`<li data-link="${r.key}">${r.rel.sources?.length
      ? html`<details><summary>${head(r)}</summary>${sourceLinks(store, r.rel.sources)}</details>`
      : html`<div class="em-row">${head(r)}</div>`}</li>`)}</ul>
  </div>`;
}

// Первый parent задаёт маршрут, но каждый переход сохраняет собственный тип и статус.
export function lineageStrip(line, currentId) {
  return html`<ol class="line-strip">${line.map((s, i) => {
    const rel = i ? s.parents.find((p) => p.id === line[i - 1].id) : null;
    return html`<li class="${s.id === currentId ? 'is-current' : ''}" style="--c:var(--era-${s.era})">
      <span class="ls-connection">${rel
        ? html`<span class="ls-rel">${RELATION[rel.type]?.label}</span><span class="ls-state st st-${rel.status}" title="${REL_STATUS[rel.status]}"><span class="visually-hidden">${REL_STATUS[rel.status]}</span></span>`
        : html`<span class="ls-rel">Начало маршрута</span>`}</span>
      <a href="#/s/${s.id}" ${s.id === currentId ? html`aria-current="page"` : ''}>
        <span class="ls-medallion">${thumb(s, 96)}</span>
        <span class="ls-copy"><span class="ls-name">${s.name}</span><span class="ls-dates">${fmtDates(s)}</span>${s.id === currentId ? html`<span class="ls-now">вы здесь</span>` : ''}</span>
      </a>
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
  const label = editorial ? 'Редакторская подборка цветов' : 'Цвета всех изображений';
  const hint = editorial
    ? p.note ?? 'Цвета подобраны редакцией по признакам стиля.'
    : 'Пять цветов, которые алгоритм нашёл по всем изображениям карточки. Это не палитра всего стиля.';
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
    const galleryCover = img ? null : s.gallery.find((g) => g.img) ?? null;
    const cover = img ?? galleryCover?.img ?? null;
    const coverTitle = img ? ex.title : galleryCover?.title ?? null;
    const coverAuthor = img ? ex.author : galleryCover?.author ?? null;
    const coverYear = img ? ex.year : galleryCover?.year ?? null;
    const galleryImgs = s.gallery.filter((g) => g.img);
    const lightboxItems = [];
    if (cover) lightboxItems.push({ img: cover, caption: [coverTitle, coverAuthor, coverYear].filter(Boolean).join(' · ') });
    for (const g of galleryImgs) {
      if (cover && g.img.page === cover.page) continue;
      lightboxItems.push({ img: g.img, caption: [g.title, g.author, g.year, g.place].filter(Boolean).join(' · ') });
    }
    const thumbItems = galleryImgs.filter((g) => !cover || g.img.page !== cover.page);
    const galleryRefs = s.gallery.filter((g) => !g.img && g.external);
    const line = store.mainLine(s.id);
    const direct = directLinks(store, s);
    const linkCount = direct.from.length + direct.to.length;
    const keys = [s.parents.length ? html`<kbd>←</kbd> главный предок` : '', s.children.length ? html`<kbd>→</kbd> ближайшее продолжение` : ''].filter(Boolean);
    const role = roleLabel(ex.role);
    const evidence = s.evidence.map((e) => ({ ...e, src: store.source(e.source) })).filter((e) => e.src);
    let subject = pickOther(store.promptSubjects);
    const anchor = styleAnchor(store, s);

    mount(root, html`
    <article class="room">
      <header class="room-head">
        <div class="room-meta">
          ${s.dateKind === 'corpus' ? '' : eraTag(store, s.era)}
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
        <div class="room-main">
        <div class="room-art">
        <figure class="room-work"${cover ? html` style="--cover-ar:${(cover.w / cover.h).toFixed(4)}${cover.w < 700 ? `;--cover-max:${Math.round(cover.w * 1.6)}px` : ''}"` : ''}>
          ${cover ? html`<button class="work-zoom" type="button" aria-label="Открыть работу крупно">
            ${frame(cover, p, { sizes: '(min-width: 1100px) 58vw, 100vw', eager: true, size: 960, alt: coverTitle ?? '', note: galleryCover ? 'Пример традиции; основная работа — по ссылке' : img.local ? 'Локальная репродукция; источник — по ссылке' : ex.external ? 'Репродукция — у источника' : ex.note, capUpscale: true })}
          </button>` : ex.external?.reference ? html`<div class="reference-work">
            <p class="reference-note">Репродукция — у источника</p>
            <p class="reference-title">${ex.title}</p>
            <a class="btn" href="${safeUrl(ex.external.page)}" target="_blank" rel="noopener">Посмотреть работу ↗</a>
          </div>` : html`<button class="work-zoom" type="button" disabled aria-label="Открыть работу крупно">
            ${frame(null, p, { sizes: '(min-width: 1100px) 58vw, 100vw', eager: true, size: 960, alt: ex.title ?? '', note: ex.note, capUpscale: true })}
          </button>`}
        </figure>
        ${thumbItems.length || galleryRefs.length ? html`<div class="room-thumbs" role="group" aria-label="Другие изображения этого стиля">
          ${thumbItems.map((g) => html`<button class="room-thumb" type="button" data-gallery="${lightboxItems.findIndex((x) => x.img.page === g.img.page)}" aria-label="Открыть крупно: ${g.title ?? ''}">
            <img src="${g.img.src[250]}" alt="${g.title ?? ''}">
            <span class="room-thumb-cap">${g.title ?? ''}</span>
          </button>`)}
          ${galleryRefs.map((g) => html`<a class="room-thumb room-thumb-ref" href="${safeUrl(g.external.page)}" target="_blank" rel="noopener">
            <span class="room-thumb-ref-mark" aria-hidden="true">↗</span>
            <span class="room-thumb-cap">${g.title ?? 'Репродукция у источника'}</span>
          </a>`)}
        </div>` : ''}
        </div>
        <div class="work-label">
          ${role ? html`<p class="wl-role">${role}</p>` : ''}
          <p class="wl-title">${ex.title}</p>
          ${ex.author ? html`<p class="wl-author">${ex.author}</p>` : ''}
          <p class="wl-facts">${[ex.year, ex.place].filter(Boolean).join(', ')}</p>
          ${ex.note && ex.note !== role ? html`<p class="wl-note">${ex.note}</p>` : ''}
          ${galleryCover ? html`<p class="wl-note"><strong>На изображении.</strong> ${galleryCover.title} — другой пример традиции; основная работа открывается по ссылке ниже.</p>` : ''}
          ${ex.why ? html`<p class="wl-why"><strong>Что здесь видно.</strong> ${ex.why}</p>` : ''}
          ${sourceLinks(store, ex.sources)}
          ${credit(cover)}
          ${ex.external ? html`<p class="credit"><a href="${safeUrl(ex.external.page)}" target="_blank" rel="noopener">${ex.external.reference ? 'Посмотреть работу у источника' : 'Открыть изображение на странице файла'}</a></p>` : ''}
        </div>
        </div>
        <div class="room-aside">
          <aside class="style-panel" aria-label="О стиле">
            <p class="sp-summary">${s.summary}</p>
            ${paletteBlock(s, img)}
          </aside>
          ${subject ? html`<section class="ai-block ai-panel" aria-labelledby="ai-title">
            ${aiHead('ai-title')}
            ${aiPromptBody(promptFor(store, s, subject), { id: 'ai-text', note: anchor ? `Имя автора в промт не входит: он просит рисовать в духе ${anchor}.` : '' })}
          </section>` : ''}
        </div>
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

      ${authorshipSection(store, s)}
      ${corpusSection(store, s)}
      ${contextSection(store, s)}

      <section class="lineage">
        <div class="lineage-head">
          <div><p class="lineage-kicker">Родословная</p><h2 class="section-title">Связи</h2></div>
          ${linkCount ? html`<p class="lineage-count">${direct.from.length} ${plural(direct.from.length, 'предшественник', 'предшественника', 'предшественников')} · ${direct.to.length} ${plural(direct.to.length, 'продолжение', 'продолжения', 'продолжений')}</p>` : ''}
        </div>
        ${line.length > 1 ? html`<div class="lineage-sub">
          <h3>Линия по первому предку</h3>
          <p class="lineage-count">${line.length} ${plural(line.length, 'стиль', 'стиля', 'стилей')} · ${line.length - 1} ${plural(line.length - 1, 'переход', 'перехода', 'переходов')}</p>
        </div>
        <p class="lineage-lead">Один из редакционных маршрутов по атласу, по первой связи каждой карточки. Для переходов показаны тип и степень проверки: влияние, реакция и возрождение не означают прямого происхождения.</p>
        <div class="lineage-rail">
          <button class="line-nav line-prev" type="button" data-line-prev aria-label="Предыдущие стили">${ARROW_L}</button>
          ${lineageStrip(line, s.id)}
          <button class="line-nav line-next" type="button" data-line-next aria-label="Следующие стили">${ARROW_R}</button>
          <div class="line-progress" aria-hidden="true"><span></span></div>
        </div>` : linkCount ? '' : s.origin === 'unknown'
          ? html`<p class="lineage-lead">Связи происхождения пока не представлены на карте.${s.comparisons.length ? ' Похожие по виду стили — в разделе «Визуальные сопоставления».' : ''}</p>`
          : html`<p class="lineage-lead">Один из независимых истоков в атласе: связей с другими стилями здесь пока нет.</p>`}
        ${linkCount ? html`<div class="lineage-sub"><h3>Прямые связи</h3></div>
        <p class="lineage-lead">Слева — из чего вырос стиль, справа — что выросло из него. Тип связи подписан у каждого стиля, дальние поколения — на карте.</p>
        ${egoMap(store, s)}
        ${linkNotes(store, s, direct)}` : ''}
        <div class="em-actions">
          <a class="btn ghost" href="#/map?s=${s.id}">Показать на карте</a>
          ${line.length > 1 ? html`<a class="em-more" href="#/map?s=${s.id}&view=line">Вся родословная на карте</a>` : ''}
          ${keys.length ? html`<p class="em-keys">${keys.map((k, i) => html`${i ? ' · ' : ''}${k}`)}</p>` : ''}
        </div>
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

    </article>
    ${footer(store)}`);

    // Интерактив
    const onClick = (e) => {
      const pal = e.target.closest('.pal');
      if (pal) {
        navigator.clipboard?.writeText(pal.dataset.hex).then(() => toast(`Скопировано: ${pal.dataset.hex}`), () => toast(pal.dataset.hex));
        return;
      }
      const thumb = e.target.closest('.room-thumb');
      if (thumb) {
        openLightbox(lightboxItems, Number(thumb.dataset.gallery) || 0);
        return;
      }
      const zoom = e.target.closest('.work-zoom');
      if (zoom && !zoom.disabled && lightboxItems.length) openLightbox(lightboxItems, 0);
    };
    root.addEventListener('click', onClick);

    const onKey = (e) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName) || document.querySelector('dialog[open]')) return;
      // Стрелки ходят по связям, как на карте: ← главный предок, → ближайшее продолжение.
      const to = linkStep(store, s, e.key);
      if (to) location.hash = `#/s/${to}`;
    };
    document.addEventListener('keydown', onKey);
    const unmountEgo = mountEgoMap(root);
    const aiBox = root.querySelector('.ai-block');
    const ai = aiBox && mountAiPrompt(aiBox, {
      next: () => promptFor(store, s, (subject = pickOther(store.promptSubjects, Math.random, subject))),
    });

    // Полоса родословной: центрируем текущий стиль и управляем прокруткой.
    const strip = root.querySelector('.line-strip');
    const rail = root.querySelector('.lineage-rail');
    let syncRail = () => {};
    let onRailScroll = () => {};
    let railObserver = null;
    if (strip && rail) {
      const prevBtn = rail.querySelector('[data-line-prev]');
      const nextBtn = rail.querySelector('[data-line-next]');
      const bar = rail.querySelector('.line-progress span');
      syncRail = () => {
        const max = strip.scrollWidth - strip.clientWidth;
        rail.classList.toggle('is-scrollable', max > 4);
        prevBtn.disabled = strip.scrollLeft <= 2;
        nextBtn.disabled = strip.scrollLeft >= max - 2;
        if (bar) {
          const visible = Math.min(1, strip.clientWidth / strip.scrollWidth);
          bar.style.width = `${Math.max(12, visible * 100)}%`;
          bar.style.left = `${(strip.scrollLeft / Math.max(1, strip.scrollWidth)) * 100}%`;
        }
      };
      onRailScroll = () => syncRail();
      strip.addEventListener('scroll', onRailScroll, { passive: true });
      prevBtn.addEventListener('click', () => strip.scrollBy({ left: -Math.round(strip.clientWidth * 0.8), behavior: 'smooth' }));
      nextBtn.addEventListener('click', () => strip.scrollBy({ left: Math.round(strip.clientWidth * 0.8), behavior: 'smooth' }));
      const current = strip.querySelector('.is-current');
      if (current) strip.scrollLeft = Math.max(0, current.offsetLeft - (strip.clientWidth - current.offsetWidth) / 2);
      railObserver = new ResizeObserver(() => syncRail());
      railObserver.observe(strip);
      syncRail();
    }

    return {
      destroy() {
        root.removeEventListener('click', onClick);
        document.removeEventListener('keydown', onKey);
        if (strip) strip.removeEventListener('scroll', onRailScroll);
        railObserver?.disconnect();
        unmountEgo();
        ai?.destroy();
      },
    };
  },
};
