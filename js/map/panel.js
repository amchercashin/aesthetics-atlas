// Боковая панель выбранного стиля и всплывающие пояснения связей на карте.
import { html, mount, safeUrl } from '../html.js';
import { fmtDates, RELATION, REL_STATUS, CONTEXT, KIND, plural } from '../format.js';
import { frame, markLoaded } from '../ui/image.js';
import { artItem, cardImages } from '../ui/art-item.js';
import { eraTag } from '../ui/common.js';
import { isSaved, toggleSaved } from '../favorites.js';
import { toast } from '../ui/toast.js';

const BOOKMARK = html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" aria-hidden="true"><path d="M6 4.5h12v16l-6-4-6 4v-16Z"/></svg>`;

const displayTitle = (s) => s.shortTitle || s.name;

function relList(store, s, key, dir) {
  if (!s[key].length) return '';
  return html`<div class="mp-rel"><h3>${dir === 'from' ? 'Откуда' : 'Куда'}</h3><ul>
    ${s[key].map((r) => {
      const o = store.get(r.id);
      if (!o) return '';
      const note = r.note ?? (dir === 'to' ? o.parents?.find((p) => p.id === s.id)?.note : null);
      return html`<li><button type="button" class="mp-node" data-select="${o.id}"><span class="swatch" style="--c:${store.nebulaColor(o.id)}"></span><span><span class="mp-node-rel">${RELATION[r.type][dir]} · <span class="st st-${r.status}">${REL_STATUS[r.status]}</span></span>${displayTitle(o)}</span></button>${note ? html`<p class="mp-rel-note">${note}</p>` : ''}</li>`;
    })}
  </ul></div>`;
}

function cmpList(store, s) {
  if (!s.comparisons.length) return '';
  return html`<div class="mp-rel"><h3>Похоже на</h3><ul>
    ${s.comparisons.map((c) => {
      const o = store.get(c.id);
      if (!o) return '';
      const note = c.note ?? o.comparisons?.find((x) => x.id === s.id)?.note;
      return html`<li><button type="button" class="mp-node" data-select="${o.id}"><span class="swatch" style="--c:${store.nebulaColor(o.id)}"></span><span><span class="mp-node-rel">сопоставление, не происхождение</span>${displayTitle(o)}</span></button>${note ? html`<p class="mp-rel-note">${note}</p>` : ''}</li>`;
    })}
  </ul></div>`;
}

function contextList(store, s) {
  if (!s.contexts?.length) return '';
  return html`<div class="mp-rel"><h3>Школы и контекст</h3><ul>${s.contexts.map((c) => {
    const other = store.get(c.id);
    if (!other) return '';
    const note = c.note ?? other.contexts?.find((x) => x.id === s.id && x.direction === 'out')?.note;
    return html`<li><button type="button" class="mp-node" data-select="${other.id}"><span class="swatch" style="--c:${store.nebulaColor(other.id)}"></span><span><span class="mp-node-rel">${CONTEXT[c.type]?.[c.direction]} · ${REL_STATUS[c.status]}</span>${displayTitle(other)}</span></button>${note ? html`<p class="mp-rel-note">${note}</p>` : ''}</li>`;
  })}</ul></div>`;
}

export function sourceLinks(store, ids) {
  const list = (ids ?? []).map((id) => store.source(id)).filter(Boolean);
  return list.length ? html`<p class="ep-src">Источник: ${list.map((src, i) => html`${i ? ', ' : ''}<a href="${safeUrl(src.url)}" target="_blank" rel="noopener">${src.publisher ?? src.title}</a>`)}</p>` : '';
}

export function renderMapPanel(panel, store, s, { focusMode, openLightbox, onReady } = {}) {
  const nRel = s.parents.length + s.children.length + s.comparisons.length + (s.contexts?.length ?? 0);
  const arts = cardImages(s).map((w) => artItem(w, store));
  const cover = arts[0]?.img ?? null;
  const title = displayTitle(s);
  const saved = isSaved(s.id, store);
  const comparePartner = s.comparisons[0]?.id ?? s.parents[0]?.id ?? s.children[0]?.id ?? store.styles.find((x) => x.id !== s.id)?.id;
  mount(panel, html`
    <button class="icon-btn mp-close" type="button" data-close-panel aria-label="Закрыть и вернуться к прежнему виду"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
    ${cover ? html`<div class="mp-art-wrap">
      <button class="mp-art mp-art-btn" type="button" data-panel-open data-panel-index="0" aria-label="Открыть изображение крупно: ${title}">
        ${frame(cover, s.palette, { ratio: '16 / 10', sizes: '380px', alt: '', note: s.example.img ? '' : 'Пример традиции' })}
        <span class="mp-art-hint">Увеличить</span>
      </button>
      <p class="mp-art-cap">${arts[0].caption}</p>
    </div>` : s.example.external?.reference ? html`<div class="mp-reference"><p class="mp-kind">Основная работа</p><p>${s.example.title}</p><a href="${safeUrl(s.example.external.page)}" target="_blank" rel="noopener">Посмотреть репродукцию ↗</a></div>` : html`<div class="mp-art-wrap"><a class="mp-art" href="#/s/${s.id}" aria-label="Открыть карточку: ${title}">${frame(null, s.palette, { ratio: '16 / 10', sizes: '380px', alt: '', note: s.palette?.source === 'editorial' ? 'Редакторская подборка цветов' : '' })}</a></div>`}
    ${arts.length > 1 ? html`<div class="mp-thumbs" role="group" aria-label="Другие изображения этого стиля">
      ${arts.map((a, i) => html`<button class="mp-thumb" type="button" data-panel-thumb="${i}" aria-label="Показать изображение: ${a.caption}" aria-pressed="${i === 0}"><img src="${a.img.src[250]}" alt="" loading="lazy"></button>`)}
    </div>` : ''}
    <div class="mp-body">
      <p class="mp-meta">${s.dateKind === 'corpus' ? '' : eraTag(store, s.era, { link: false })}${s.kind[0] ? html`<span class="mp-kind">${KIND[s.kind[0]].toLowerCase()}</span>` : ''}</p>
      <h2 class="mp-name">${title}</h2>
      <p class="mp-orig">${s.subtitle ? `${s.subtitle} · ` : ''}${s.orig}, ${fmtDates(s)}</p>
      <p class="mp-sum">${s.summary}</p>
      <div class="mp-modes" role="group" aria-label="Что показать на карте">
        <button class="chip" type="button" data-focus-mode="near" aria-pressed="${focusMode === 'near'}">Ближайшие связи <span class="count">${nRel}</span></button>
        <button class="chip" type="button" data-focus-mode="line" aria-pressed="${focusMode === 'line'}">Вся родословная</button>
      </div>
      ${s.origin === 'unknown' ? html`<p class="mp-origin">Связи происхождения пока не представлены на карте.</p>` : ''}
      ${relList(store, s, 'parents', 'from')}
      ${relList(store, s, 'children', 'to')}
      ${cmpList(store, s)}
      ${contextList(store, s)}
      <div class="mp-actions">
        <a class="btn mp-open" href="#/s/${s.id}">Открыть зал</a>
        <button type="button" class="chip mp-fav${saved ? ' is-saved' : ''}" data-mp-fav aria-pressed="${saved}" title="${saved ? 'Убрать с полки' : 'Сохранить на полку вкуса'}">${BOOKMARK}<span>${saved ? 'На полке' : 'На полку'}</span></button>
        ${comparePartner ? html`<a class="chip" href="#/compare?a=${s.id}&b=${comparePartner}">Сравнить</a>` : ''}
      </div>
    </div>`);
  panel.hidden = false;
  onReady?.();
  markLoaded(panel);
  const favBtn = panel.querySelector('[data-mp-fav]');
  if (favBtn) {
    favBtn.addEventListener('click', () => {
      const res = toggleSaved(s.id, store);
      favBtn.classList.toggle('is-saved', res.saved);
      favBtn.setAttribute('aria-pressed', String(res.saved));
      const sp = favBtn.querySelector('span');
      if (sp) sp.textContent = res.saved ? 'На полке' : 'На полку';
      toast(res.saved ? 'Добавлено на полку вкуса' : 'Убрано с полки');
    });
  }
  const mainArt = panel.querySelector('[data-panel-open]');
  if (mainArt) {
    mainArt.addEventListener('click', () => openLightbox(arts, Number(mainArt.dataset.panelIndex) || 0));
    for (const btn of panel.querySelectorAll('[data-panel-thumb]')) {
      btn.addEventListener('click', () => {
        const i = Number(btn.dataset.panelThumb) || 0;
        mainArt.dataset.panelIndex = String(i);
        mainArt.innerHTML = frame(arts[i].img, s.palette, { ratio: '16 / 10', sizes: '380px', alt: '', note: '' }) + '<span class="mp-art-hint">Увеличить</span>';
        markLoaded(mainArt);
        mainArt.setAttribute('aria-label', `Открыть изображение крупно: ${title}`);
        const cap = panel.querySelector('.mp-art-cap');
        if (cap) cap.textContent = arts[i].caption;
        for (const b of panel.querySelectorAll('[data-panel-thumb]')) b.setAttribute('aria-pressed', String(b === btn));
      });
    }
  }
}

export function renderSummaryPopup(edgePop, store, group, regionNameOf) {
  const arrow = group.kind === 'flow' ? ' → ' : group.kind === 'bridge' ? ' ↔ ' : ' · ';
  const lead = group.kind === 'flow'
    ? 'Направленный поток подтверждённых исторических связей между карточками этих морей. Откройте любую пару, чтобы увидеть источник.'
    : group.kind === 'bridge'
      ? 'Визуальные сопоставления и контексты между карточками этих морей (сходство, не заявление о происхождении).'
      : 'Это сводка связей отдельных эстетик. Моря — области навигации, а не исторические предки. Откройте связь, чтобы увидеть её тип и источник.';
  mount(edgePop, html`<p class="ep-head">${regionNameOf(group.a)}${arrow}${regionNameOf(group.b)}</p>
    <p class="ep-kind">${group.records.length} ${plural(group.records.length, 'связь карточек', 'связи карточек', 'связей карточек')}</p>
    <p class="ep-note">${lead}</p>
    <div class="summary-records">${group.records.map((r, i) => html`<button type="button" data-summary-record="${i}">${displayTitle(store.get(r.from))} ${r.kind === 'comparison' ? '↔' : '→'} ${displayTitle(store.get(r.to))}<small>${r.kind === 'history' ? RELATION[r.info.edge.type].label : r.kind === 'comparison' ? 'Визуальное сходство' : 'Контекст'} · ${r.kind === 'comparison' ? 'редакционное сопоставление' : REL_STATUS[r.status]}</small></button>`)}</div>`);
}

export function renderEdgePopup(edgePop, store, info) {
  if (info.context) {
    const c = info.context;
    mount(edgePop, html`<p class="ep-head"><span>${displayTitle(c.a.s)}</span> · <span>${displayTitle(c.b.s)}</span></p>
      <p class="ep-kind">${CONTEXT[c.type]?.label} · ${REL_STATUS[c.status]}</p><p class="ep-note">${c.note}</p>${sourceLinks(store, c.sources)}
      <p class="ep-go"><button class="chip" type="button" data-select="${c.a.s.id}">${displayTitle(c.a.s)}</button><button class="chip" type="button" data-select="${c.b.s.id}">${displayTitle(c.b.s)}</button></p>`);
  } else if (info.cmp) {
    const c = info.cmp;
    mount(edgePop, html`<p class="ep-head"><span>${displayTitle(c.a.s)}</span> ↔ <span>${displayTitle(c.b.s)}</span></p>
      <p class="ep-kind">Визуальное сопоставление · не заявление о происхождении</p>
      ${c.note ? html`<p class="ep-note">${c.note}</p>` : ''}${sourceLinks(store, c.sources)}
      <p class="ep-go"><button class="chip" type="button" data-select="${c.a.s.id}">${displayTitle(c.a.s)}</button><button class="chip" type="button" data-select="${c.b.s.id}">${displayTitle(c.b.s)}</button></p>`);
  } else {
    const e = info.edge, r = e.rel;
    mount(edgePop, html`<p class="ep-head"><span>${displayTitle(e.par.s)}</span> → <span>${displayTitle(e.ch.s)}</span></p>
      <p class="ep-kind">${RELATION[r.type].label} · <span class="st st-${r.status}">${REL_STATUS[r.status]}</span></p>
      ${r.note ? html`<p class="ep-note">${r.note}</p>` : r.status !== 'verified' ? html`<p class="ep-note muted">Пояснения и источника пока нет: связь проведена редакцией атласа и ждёт проверки.</p>` : ''}
      ${sourceLinks(store, r.sources)}
      <p class="ep-go"><button class="chip" type="button" data-select="${e.par.s.id}">← ${displayTitle(e.par.s)}</button><button class="chip" type="button" data-select="${e.ch.s.id}">${displayTitle(e.ch.s)} →</button></p>`);
  }
}
