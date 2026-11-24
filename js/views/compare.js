// «Сравнить два стиля»: бок о бок — работы, палитры, признаки, связь в графе и промт на стыке двух стилей.
import { html, mount } from '../html.js';
import { fmtDates, displayTitle, DOMAIN, KIND, MEDIUM, RELATION, CONTEXT, REL_STATUS } from '../format.js';
import { frame, markLoaded } from '../ui/image.js';
import { eraTag, footer } from '../ui/common.js';
import { replaceParams } from '../router.js';
import { combinePrompt, pickOther } from '../prompt.js';
import { aiHead, aiPromptBody, mountAiPrompt, readCustomSubject } from '../ui/ai-prompt.js';
import { toast } from '../ui/toast.js';

const SWAP_ICON = html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 16V4m0 0-3 3m3-3 3 3M17 8v12m0 0 3-3m-3 3-3-3"/></svg>`;

function relationBetween(a, b) {
  const pa = b.parents.find((r) => r.id === a.id);
  if (pa) return { kind: 'history', label: `${displayTitle(a)} → ${displayTitle(b)}: ${RELATION[pa.type]?.label} (${REL_STATUS[pa.status]})`, note: pa.note };
  const pb = a.parents.find((r) => r.id === b.id);
  if (pb) return { kind: 'history', label: `${displayTitle(b)} → ${displayTitle(a)}: ${RELATION[pb.type]?.label} (${REL_STATUS[pb.status]})`, note: pb.note };
  const cmp = a.comparisons.find((c) => c.id === b.id);
  if (cmp) {
    const rev = b.comparisons.find((c) => c.id === a.id);
    return { kind: 'comparison', label: 'Визуальное сопоставление в атласе (сходство, не происхождение)', note: cmp.note ?? rev?.note };
  }
  const ctx = (a.contexts ?? []).find((c) => c.id === b.id);
  if (ctx) {
    const rev = (b.contexts ?? []).find((c) => c.id === a.id && c.direction === 'out');
    return { kind: 'context', label: `Культурный контекст: ${CONTEXT[ctx.type]?.label ?? 'связанная практика'}`, note: ctx.note ?? rev?.note };
  }
  return null;
}

function defaultPair(store) {
  const pairs = [
    ['impressionism', 'ukiyo-e'],
    ['bauhaus', 'art-deco'],
    ['gzhel-ceramics', 'iznik-ceramics'],
    ['vaporwave', 'cyberpunk'],
    ['gothic', 'brutalism'],
  ];
  for (const [x, y] of pairs) if (store.has(x) && store.has(y)) return [x, y];
  return [store.styles[0]?.id, store.styles[1]?.id];
}

export default {
  render(root, ctx) {
    const { store, openLightbox } = ctx;
    const [defA, defB] = defaultPair(store);
    let idA = store.resolve(ctx.params.get('a') ?? '') || defA;
    let idB = store.resolve(ctx.params.get('b') ?? '') || (idA === defB ? defA : defB);
    let subject = readCustomSubject() || pickOther(store.promptSubjects);
    let aiCtrl = null;
    const sortedStyles = [...store.styles].sort((x, y) => displayTitle(x).localeCompare(displayTitle(y), 'ru'));

    function styleCol(s, side) {
      const cover = s.example.img ?? s.gallery.find((g) => g.img)?.img ?? null;
      return html`<section class="cmp-col" aria-label="${displayTitle(s)}">
        <div class="cmp-picker-row">
          <label class="visually-hidden" for="cmp-sel-${side}">Выбрать стиль ${side === 'a' ? 'слева' : 'справа'}</label>
          <select id="cmp-sel-${side}" class="cmp-select" data-cmp-select="${side}">
            ${sortedStyles.map((o) => html`<option value="${o.id}" ${o.id === s.id ? html`selected` : ''}>${displayTitle(o)} (${fmtDates(o)})</option>`)}
          </select>
          <a class="cmp-hall-link" href="#/s/${s.id}">Открыть зал →</a>
        </div>
        <div class="cmp-art-box">
          <button type="button" class="cmp-art-btn" data-cmp-zoom="${side}" aria-label="Открыть работу крупно: ${displayTitle(s)}"${cover ? '' : html` disabled`}>
            ${frame(cover, s.palette, { ratio: '4 / 3', sizes: '(min-width: 900px) 44vw, 96vw', alt: s.example.title ?? '', size: 960 })}
          </button>
          <p class="cmp-art-cap">${[s.example.title, s.example.author, s.example.year].filter(Boolean).join(' · ')}</p>
        </div>
        <h2 class="cmp-name"><a href="#/s/${s.id}">${displayTitle(s)}</a></h2>
        ${s.subtitle ? html`<p class="cmp-sub">${s.subtitle}</p>` : html`<p class="cmp-sub">${s.orig}</p>`}
        <div class="cmp-meta">
          ${eraTag(store, s.era)}
          <span>${fmtDates(s)}</span>
          ${s.region ? html`<span>${s.region}</span>` : ''}
        </div>
        <p class="cmp-summary">${s.summary}</p>
        ${s.palette?.colors?.length ? html`<div class="palette-strip cmp-pal" role="group" aria-label="Палитра ${displayTitle(s)}">
          ${s.palette.colors.map((c) => html`<button type="button" class="pal" style="--c:${c}" data-hex="${c}" title="Скопировать ${c}"><span class="visually-hidden">${c}</span></button>`)}
        </div>` : ''}
        <dl class="cmp-facts">
          <div><dt>Область</dt><dd>${s.domain.map((d) => DOMAIN[d]).join(', ')}</dd></div>
          <div><dt>Тип</dt><dd>${s.kind.map((k) => KIND[k]).join(', ')}</dd></div>
          ${s.medium?.length ? html`<div><dt>Техники</dt><dd>${s.medium.map((m) => MEDIUM[m]).join(', ')}</dd></div>` : ''}
        </dl>
        <div class="cmp-traits">
          <h3 class="side-title">Как узнать</h3>
          <ul class="traits">${s.traits.map((t) => html`<li>${t}</li>`)}</ul>
        </div>
      </section>`;
    }

    function draw() {
      aiCtrl?.destroy();
      aiCtrl = null;
      const a = store.get(idA);
      const b = store.get(idB);
      if (!a || !b) return;
      document.title = `${displayTitle(a)} и ${displayTitle(b)} — Сравнение — Атлас эстетик`;
      replaceParams('compare', { a: a.id, b: b.id });

      const rel = relationBetween(a, b);
      const currentPrompt = subject ? combinePrompt(store, a, b, subject) : '';

      mount(root, html`
      <div class="page cmp-page">
        <header class="cmp-head">
          <div>
            <p class="col-kicker">Сравнение бок о бок</p>
            <h1 class="cmp-title">${displayTitle(a)} <span class="cmp-vs" aria-hidden="true">↔</span> ${displayTitle(b)}</h1>
          </div>
          <div class="cmp-head-actions">
            <button class="btn ghost" type="button" data-cmp-swap>${SWAP_ICON}Поменять местами</button>
            <button class="btn ghost" type="button" data-cmp-random>Случайная пара</button>
          </div>
        </header>

        <div class="cmp-bridge${rel ? ` is-${rel.kind}` : ''}">
          <strong>${rel ? rel.label : 'Прямой исторической связи в атласе нет — чистое визуальное сравнение.'}</strong>
          ${rel?.note ? html`<p>${rel.note}</p>` : ''}
        </div>

        <div class="cmp-grid">
          ${styleCol(a, 'a')}
          ${styleCol(b, 'b')}
        </div>

        ${subject ? html`<section class="ai-block cmp-ai" aria-labelledby="cmp-ai-title">
          ${aiHead('cmp-ai-title', { title: 'Нарисовать на стыке двух стилей', nextLabel: 'Другой сюжет' })}
          ${aiPromptBody(currentPrompt, { id: 'cmp-ai-text', subject, note: 'Промт соединяет по два визуальных признака из каждого стиля. Впишите свой сюжет, чтобы проверить гибрид.' })}
        </section>` : ''}
      </div>
      ${footer(store)}`);

      markLoaded(root);
      const aiBox = root.querySelector('.cmp-ai');
      if (aiBox) {
        aiCtrl = mountAiPrompt(aiBox, {
          next: () => {
            subject = pickOther(store.promptSubjects, Math.random, subject);
            return { prompt: combinePrompt(store, a, b, subject), subject };
          },
          onSubject: (val) => {
            const eff = val || subject;
            return combinePrompt(store, a, b, eff);
          },
        });
      }
    }

    const onChange = (e) => {
      const sel = e.target.closest('[data-cmp-select]');
      if (!sel) return;
      if (sel.dataset.cmpSelect === 'a') idA = sel.value;
      else idB = sel.value;
      draw();
    };
    const onClick = (e) => {
      const pal = e.target.closest('.pal[data-hex]');
      if (pal) {
        navigator.clipboard?.writeText(pal.dataset.hex).then(() => toast(`Скопировано: ${pal.dataset.hex}`), () => toast(pal.dataset.hex));
        return;
      }
      if (e.target.closest('[data-cmp-swap]')) { [idA, idB] = [idB, idA]; draw(); return; }
      if (e.target.closest('[data-cmp-random]')) {
        const x = store.random();
        let y = store.random();
        if (y.id === x.id) y = store.styles.find((s) => s.id !== x.id) ?? x;
        idA = x.id; idB = y.id;
        draw();
        return;
      }
      const z = e.target.closest('[data-cmp-zoom]');
      if (z) {
        const s = store.get(z.dataset.cmpZoom === 'a' ? idA : idB);
        const im = s?.example.img ?? s?.gallery.find((g) => g.img)?.img;
        if (im) openLightbox([{ img: im, caption: [s.example.title, s.example.author, s.example.year].filter(Boolean).join(' · '), details: '' }], 0);
      }
    };

    root.addEventListener('change', onChange);
    root.addEventListener('click', onClick);
    draw();

    return {
      update(next) {
        const na = store.resolve(next.params.get('a') ?? '');
        const nb = store.resolve(next.params.get('b') ?? '');
        if (na) idA = na;
        if (nb) idB = nb;
        draw();
      },
      destroy() {
        aiCtrl?.destroy();
        root.removeEventListener('change', onChange);
        root.removeEventListener('click', onClick);
      },
    };
  },
};
