// Карта родословной. Ось X — кусочно-линейное время (масштабируется), строки фиксированной высоты.
// Подписи имеют постоянный экранный размер и скрываются, когда не помещаются.
import { html, mount } from '../html.js';
import { fmtDates, fmtYear, RELATION, DOMAIN } from '../format.js';
import { createTimeScale, segmentWidths, segmentTicks } from '../timescale.js';
import { layoutRows } from '../layout.js';
import { frame, markLoaded } from '../ui/image.js';
import { eraTag, thumb } from '../ui/common.js';
import { replaceParams } from '../router.js';

const NS = 'http://www.w3.org/2000/svg';
const AXIS_H = 64;
const ROW_H = 30;
const R = { 1: 6, 2: 4.5, 3: 3.5 };
const FONT = { 1: '600 16px Spectral', 2: '500 13px "Golos Text"', 3: '400 12px "Golos Text"' };
const DASH = { evolved: '', influence: '', reaction: '7 5', revival: '1.5 4.5' };
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function el(name, attrs = {}, parent) {
  const n = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  parent?.appendChild(n);
  return n;
}

export default {
  render(root, ctx) {
    const { store } = ctx;
    document.title = 'Карта родословной — Атлас эстетик';

    mount(root, html`
    <div class="map-view">
      <div class="map-toolbar">
        <div class="filter-row" role="group" aria-label="Область">
          <button class="chip" type="button" data-domain="" aria-pressed="true">Все</button>
          ${Object.entries(DOMAIN).map(([k, v]) => html`<button class="chip" type="button" data-domain="${k}" aria-pressed="false">${v}</button>`)}
        </div>
        <ul class="map-legend" aria-label="Типы связей">
          ${Object.keys(RELATION).map((k) => html`<li><svg viewBox="0 0 34 10" aria-hidden="true"><path d="M1 5h32" class="edge rel-${k}"/></svg>${RELATION[k].label}</li>`)}
        </ul>
        <div class="zoom-ctrls">
          <button class="icon-btn" type="button" data-zoom="out" aria-label="Отдалить"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M6 12h12"/></svg></button>
          <button class="icon-btn" type="button" data-zoom="in" aria-label="Приблизить"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M6 12h12M12 6v12"/></svg></button>
          <button class="chip" type="button" data-zoom="fit">Вся история</button>
        </div>
      </div>
      <div class="map-stage" tabindex="0" aria-label="Карта родословной стилей. Стрелки — двигать, плюс и минус — масштаб.">
        <svg class="map-svg" aria-hidden="false">
          <g class="m-cols"></g><g class="m-edges"></g><g class="m-bars"></g><g class="m-nodes"></g><g class="m-axis"></g>
        </svg>
        <div class="map-tip" hidden></div>
        <aside class="map-panel" hidden aria-live="polite"></aside>
        <p class="map-loading">Строим карту…</p>
        <p class="map-hint">Тяните, чтобы двигать. Shift с колесом — по времени, Ctrl или ⌘ с колесом и щипок — масштаб.</p>
      </div>
      <div class="map-mini" aria-hidden="true"><svg class="mini-svg" preserveAspectRatio="none"></svg><div class="mini-window"></div></div>
    </div>`);

    const stage = root.querySelector('.map-stage');
    const svg = root.querySelector('.map-svg');
    const gCols = svg.querySelector('.m-cols');
    const gEdges = svg.querySelector('.m-edges');
    const gBars = svg.querySelector('.m-bars');
    const gNodes = svg.querySelector('.m-nodes');
    const gAxis = svg.querySelector('.m-axis');
    const tip = root.querySelector('.map-tip');
    const panel = root.querySelector('.map-panel');
    const mini = root.querySelector('.map-mini');
    const miniSvg = root.querySelector('.mini-svg');
    const miniWin = root.querySelector('.mini-window');

    let destroyed = false;
    const cleanups = [];
    const on = (target, ev, fn, opts) => { target.addEventListener(ev, fn, opts); cleanups.push(() => target.removeEventListener(ev, fn, opts)); };

    // Состояние
    const t = { k: 1, tx: 0, ty: 0 };
    let vw = 0, vh = 0, sc, rows, rowCount = 0, contentH = 0;
    let nodes = [], edges = [], colEls = [], tickPool = [];
    let selected = null, domain = '', raf = 0, kFit = 0.1;
    const nodeById = new Map();
    const axis = {};

    const X = (year) => sc.x(year) * t.k + t.tx;
    const Y = (row) => AXIS_H + 26 + row * ROW_H + t.ty;

    // ---------- построение ----------
    async function build() {
      // Подписи меряем настоящими шрифтами: явно подгружаем начертания и кириллический набор.
      try {
        await Promise.all(Object.values(FONT).map((f) => document.fonts.load(f, 'Аа')));
        await document.fonts.ready;
      } catch { /* шрифты не критичны */ }
      if (destroyed) return;
      const canvas = document.createElement('canvas').getContext('2d');
      const width = (s) => { canvas.font = FONT[s.tier]; return canvas.measureText(s.name).width; };

      const breaks = [...store.eras.map((e) => e.start), store.now + 1];
      const widths = segmentWidths(breaks, store.styles.map((s) => s.start), { base: 200, perItem: 70, min: 320 });
      sc = createTimeScale(breaks, widths);
      const lay = layoutRows(
        store.styles.map((s) => ({ id: s.id, start: s.start, end: s.end, tier: s.tier, row: s.row ?? undefined, width: width(s) + R[s.tier] + 6, parents: s.parents.map((p) => p.id) })),
        sc.x, { now: store.now, dot: 14, gap: 30 },
      );
      rows = lay.rows; rowCount = lay.count;
      contentH = AXIS_H + 26 + rowCount * ROW_H + 30;

      // Колонки эпох
      colEls = store.eras.map((e, i) => {
        const g = el('g', { class: 'm-col' }, gCols);
        const rect = el('rect', { class: 'col-bg', fill: `var(--era-${e.id})` }, g);
        const line = el('line', { class: 'col-line' }, g);
        return { e, seg: sc.segments[i], g, rect, line };
      });
      // Ось
      const axisBg = el('rect', { class: 'axis-bg', x: 0, y: 0, height: AXIS_H }, gAxis);
      const axisLine = el('line', { class: 'axis-line', y1: AXIS_H - 0.5, y2: AXIS_H - 0.5, x1: 0 }, gAxis);
      const eraLabels = colEls.map(({ e }) => {
        const strip = el('rect', { class: 'axis-strip', y: 0, height: 4, fill: `var(--era-${e.id})` }, gAxis);
        const label = el('text', { class: 'axis-era', y: 26 }, gAxis);
        label.textContent = e.name;
        label.dataset.full = e.name;
        label.dataset.short = e.short;
        const start = el('text', { class: 'axis-start', y: 48 }, gAxis);
        start.textContent = fmtYear(e.start);
        const brk = el('path', { class: 'axis-break', d: 'M-4,58 l3,-6 l2,4 l3,-6' }, gAxis);
        return { strip, label, start, brk, w: 0, sw: 0 };
      });
      const tickGroup = el('g', { class: 'axis-ticks' }, gAxis);
      Object.assign(axis, { axisBg, axisLine, eraLabels, tickGroup });

      // Узлы, полосы, связи
      for (const s of store.styles) {
        const bar = el('line', { class: `bar t${s.tier}`, stroke: `var(--era-${s.era})` }, gBars);
        const g = el('g', { class: `node t${s.tier}`, tabindex: '0', role: 'button', 'aria-label': `${s.name}, ${fmtDates(s)}`, 'data-id': s.id }, gNodes);
        el('circle', { r: R[s.tier] + 7, class: 'hit' }, g);
        el('circle', { r: R[s.tier], class: 'dot', fill: `var(--era-${s.era})` }, g);
        const text = el('text', { x: R[s.tier] + 6, y: s.tier === 1 ? 5.5 : 4.5 }, g);
        text.textContent = s.name;
        const n = { s, row: rows.get(s.id), g, bar, text, w: width(s), visible: true };
        nodes.push(n);
        nodeById.set(s.id, n);
      }
      for (const s of store.styles) for (const p of s.parents) {
        const par = nodeById.get(p.id), ch = nodeById.get(s.id);
        if (!par || !ch) continue;
        // Дальние связи (возрождения через века) на обзоре бледнее, чтобы не забивать карту.
        const span = sc.x(s.start) - sc.x(Math.min(s.start, par.s.end ?? store.now));
        const path = el('path', { class: `edge rel-${p.type}${span > 1400 ? ' far' : ''}` }, gEdges);
        if (DASH[p.type]) path.setAttribute('stroke-dasharray', DASH[p.type]);
        edges.push({ par, ch, type: p.type, path });
      }
      buildMini();
      root.querySelector('.map-loading').remove();

      resize();
      // На телефоне вся история в одну ширину нечитаема — стартуем с крупного вида от начала.
      if (vw < 760) { Object.assign(t, { k: 0.34, tx: 24, ty: 0 }); clamp(); schedule(); }
      else fit(false);
      const focus = ctx.params.get('s');
      if (focus && nodeById.has(focus)) select(focus, { center: true, animate: false });
    }

    function buildMini() {
      const W = 1000, H = 40;
      miniSvg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      const fx = (year) => (sc.x(year) / sc.total) * W;
      const fy = (row) => 6 + (row / Math.max(rowCount - 1, 1)) * (H - 10);
      store.eras.forEach((e, i) => {
        const seg = sc.segments[i];
        el('rect', { x: (seg.x0 / sc.total) * W, y: 0, width: ((seg.x1 - seg.x0) / sc.total) * W, height: H, fill: `var(--era-${e.id})`, 'fill-opacity': 0.12 }, miniSvg);
      });
      for (const n of nodes) el('line', { x1: fx(n.s.start), x2: Math.max(fx(n.s.end ?? store.now), fx(n.s.start) + 2), y1: fy(n.row), y2: fy(n.row), stroke: `var(--era-${n.s.era})`, 'stroke-width': 2, 'vector-effect': 'non-scaling-stroke' }, miniSvg);
    }

    // ---------- отрисовка ----------
    function schedule() { if (!raf) raf = requestAnimationFrame(draw); }

    function draw() {
      raf = 0;
      if (!sc) return;
      // Колонки эпох
      for (const c of colEls) {
        const x0 = X(c.e.start), x1 = X(c.seg.end);
        c.rect.setAttribute('x', x0); c.rect.setAttribute('width', Math.max(0, x1 - x0));
        c.rect.setAttribute('y', 0); c.rect.setAttribute('height', vh);
        c.line.setAttribute('x1', x0); c.line.setAttribute('x2', x0); c.line.setAttribute('y1', 0); c.line.setAttribute('y2', vh);
      }
      // Ось
      const { axisBg, axisLine, eraLabels, tickGroup } = axis;
      axisBg.setAttribute('width', vw); axisLine.setAttribute('x2', vw);
      colEls.forEach((c, i) => {
        const L = eraLabels[i];
        const x0 = X(c.e.start), x1 = X(c.seg.end), w = x1 - x0;
        L.strip.setAttribute('x', x0); L.strip.setAttribute('width', Math.max(0, w - 1));
        if (!L.w) {
          L.w = L.label.getComputedTextLength();
          L.label.textContent = L.label.dataset.short;
          L.ws = L.label.getComputedTextLength();
          L.label.textContent = L.label.dataset.full;
          L.sw = L.start.getComputedTextLength();
          L.mode = 'full';
        }
        const mode = w > L.w + 20 ? 'full' : w > L.ws + 16 ? 'short' : 'none';
        if (mode !== L.mode && mode !== 'none') { L.label.textContent = L.label.dataset[mode]; L.mode = mode; }
        const lw = mode === 'short' ? L.ws : L.w;
        const lx = Math.min(Math.max(x0 + 10, 10), x1 - lw - 10);
        const fits = mode !== 'none' && x1 > 0 && x0 < vw;
        L.label.setAttribute('x', lx); L.label.style.display = fits ? '' : 'none';
        L.start.setAttribute('x', x0 + 8); L.start.style.display = w > L.sw + 16 && x1 > 0 && x0 < vw ? '' : 'none';
        L.brk.setAttribute('transform', `translate(${x0},0)`); L.brk.style.display = i && x0 > -10 && x0 < vw + 10 ? '' : 'none';
      });
      // Деления
      let ti = 0;
      colEls.forEach((c, idx) => {
        const x0 = X(c.e.start), x1 = X(c.seg.end);
        if (x1 < 0 || x0 > vw) return;
        const startW = eraLabels[idx].start.style.display === 'none' ? 0 : (eraLabels[idx].sw || 40);
        for (const y of segmentTicks(c.seg, t.k, 84)) {
          const x = X(y);
          if (x < x0 + startW + 50 || x > vw + 40 || x < -40) continue;
          let tk = tickPool[ti];
          if (!tk) { tk = { line: el('line', { class: 'tick', y1: AXIS_H - 6, y2: AXIS_H }, tickGroup), text: el('text', { class: 'tick-label', y: 48 }, tickGroup) }; tickPool.push(tk); }
          tk.line.setAttribute('x1', x); tk.line.setAttribute('x2', x); tk.line.style.display = '';
          tk.text.setAttribute('x', x); tk.text.textContent = fmtYear(y); tk.text.style.display = '';
          ti++;
        }
      });
      for (; ti < tickPool.length; ti++) { tickPool[ti].line.style.display = 'none'; tickPool[ti].text.style.display = 'none'; }

      // Полосы и узлы. Точки видны всегда — сначала занимаем их место, потом раздаём подписи.
      const occupied = new Map();
      for (const n of nodes) {
        if (n.g.classList.contains('filtered')) continue;
        const x = X(n.s.start), r = R[n.s.tier] + 3;
        const list = occupied.get(n.row) ?? [];
        list.push([x - r, x + r, n.s.id]);
        occupied.set(n.row, list);
      }
      const order = [...nodes].sort((a, b) => prio(b) - prio(a));
      for (const n of order) {
        const x = X(n.s.start), y = Y(n.row);
        const x2 = X(n.s.end ?? store.now);
        const off = x2 < -20 || x > vw + 20 || y < AXIS_H - 10 || y > vh + 20;
        n.bar.setAttribute('x1', x); n.bar.setAttribute('x2', Math.max(x, x2)); n.bar.setAttribute('y1', y); n.bar.setAttribute('y2', y);
        n.g.setAttribute('transform', `translate(${x.toFixed(1)},${y.toFixed(1)})`);
        n.g.style.display = off && x > vw + 20 ? 'none' : '';
        // Подпись: помещается ли без наложений в своей строке
        const a = x + R[n.s.tier] + 4, b = x + R[n.s.tier] + 6 + n.w + 8;
        const list = occupied.get(n.row) ?? [];
        const free = !list.some(([c, d, id]) => id !== n.s.id && a < d && c < b);
        const show = free && !n.g.classList.contains('filtered');
        n.text.style.display = show ? '' : 'none';
        if (show) list.push([a, b, n.s.id]);
      }
      // Связи
      for (const e of edges) {
        const p = e.par.s, c = e.ch.s;
        const py = Y(e.par.row), cy = Y(e.ch.row);
        const ex = X(c.start);
        let sx = X(Math.max(p.start, Math.min(c.start, p.end ?? store.now)));
        sx = Math.max(X(p.start), Math.min(sx, ex - 16));
        if (Math.max(sx, ex) < -50 || Math.min(sx, ex) > vw + 50) { e.path.setAttribute('d', ''); continue; }
        if (Math.abs(cy - py) < 1) e.path.setAttribute('d', `M${sx.toFixed(1)},${py.toFixed(1)}L${ex.toFixed(1)},${cy.toFixed(1)}`);
        else {
          const c1 = Math.max(14, (ex - sx) * 0.5);
          e.path.setAttribute('d', `M${sx.toFixed(1)},${py.toFixed(1)}C${(sx + c1).toFixed(1)},${py.toFixed(1)} ${(ex - c1).toFixed(1)},${cy.toFixed(1)} ${ex.toFixed(1)},${cy.toFixed(1)}`);
        }
      }
      // Мини-карта
      const mw = mini.clientWidth;
      const left = (-t.tx / (sc.total * t.k)) * mw, width = (vw / (sc.total * t.k)) * mw;
      miniWin.style.transform = `translateX(${Math.max(0, left)}px)`;
      miniWin.style.width = `${Math.max(12, Math.min(mw, width + Math.min(0, left)))}px`;
    }

    function prio(n) {
      let p = (4 - n.s.tier) * 1000 - n.s.start / 100000;
      if (n.s.id === selected) p += 1e6;
      if (n.g.classList.contains('lit')) p += 5e5;
      return p;
    }

    // ---------- трансформация ----------
    function clamp() {
      // Открытая панель закрывает правую часть — разрешаем прокрутить карту дальше на её ширину.
      const panelW = !panel.hidden && vw >= 760 ? panel.offsetWidth + 24 : 0;
      const w = sc.total * t.k + LABEL_PAD + panelW;
      const minTx = Math.min(40, vw - w - 40), maxTx = Math.max(40, vw - w - 40);
      t.tx = Math.min(maxTx, Math.max(minTx, t.tx));
      const sheet = vw < 760 && !panel.hidden ? panel.offsetHeight : 0;
      const minTy = Math.min(0, vh - contentH - 20 - sheet);
      t.ty = Math.min(0, Math.max(minTy, t.ty));
    }
    function zoomAt(px, factor) {
      const k2 = Math.min(5, Math.max(kFit * 0.9, t.k * factor));
      t.tx = px - ((px - t.tx) * k2) / t.k;
      t.k = k2;
      clamp(); schedule();
    }
    let anim = 0;
    function animateTo(k, tx, ty, ms = 650) {
      cancelAnimationFrame(anim);
      if (reduceMotion() || ms === 0) { Object.assign(t, { k, tx, ty }); clamp(); schedule(); return; }
      const from = { ...t };
      const t0 = performance.now();
      const step = (now) => {
        const p = Math.min(1, (now - t0) / ms);
        const e = 1 - Math.pow(1 - p, 3);
        // Масштаб интерполируем логарифмически — так движение выглядит равномерным.
        t.k = Math.exp(Math.log(from.k) + (Math.log(k) - Math.log(from.k)) * e);
        t.tx = from.tx + (tx - from.tx) * e;
        t.ty = from.ty + (ty - from.ty) * e;
        clamp(); draw();
        if (p < 1) anim = requestAnimationFrame(step);
      };
      anim = requestAnimationFrame(step);
    }
    const LABEL_PAD = window.innerWidth < 760 ? 140 : 220; // место справа под подписи последних стилей
    function fit(animate = true) {
      kFit = (vw - 80 - LABEL_PAD) / sc.total;
      const ty = 0;
      if (animate) animateTo(kFit, 40, ty); else { Object.assign(t, { k: kFit, tx: 40, ty }); clamp(); schedule(); }
    }
    function centerOn(id, animate = true) {
      const n = nodeById.get(id);
      if (!n) return;
      const k = Math.max(t.k, 0.9);
      const panelW = panel.hidden || vw < 760 ? 0 : panel.offsetWidth;
      const targetX = (vw - panelW) * 0.42;
      const tx = targetX - sc.x(n.s.start) * k;
      const visibleH = vw < 760 && !panel.hidden ? vh - panel.offsetHeight - 16 : vh;
      const ty = Math.min(0, Math.max(AXIS_H + 40, visibleH / 2) - (AXIS_H + 26 + n.row * ROW_H));
      animateTo(k, tx, ty, animate ? 700 : 0);
    }
    // Вписать в экран всю линию: от самого раннего предка до самого позднего потомка.
    function fitLineage(id, animate = true) {
      const ids = [id, ...store.ancestors(id), ...store.descendants(id)];
      const ns = ids.map((i) => nodeById.get(i)).filter(Boolean);
      const x0 = Math.min(...ns.map((n) => sc.x(n.s.start)));
      const x1 = Math.max(...ns.map((n) => sc.x(n.s.start)));
      const panelW = panel.hidden || vw < 760 ? 0 : panel.offsetWidth + 24;
      const avail = vw - panelW - 80 - 160;
      const k = Math.min(1.4, Math.max(kFit, avail / Math.max(1, x1 - x0)));
      // Если линия не помещается целиком — прижимаем её к правому краю: выбранный стиль и потомки видны,
      // ранние предки уходят влево (их видно на мини-карте и при прокрутке).
      const fitsAll = (x1 - x0) * k <= avail;
      const tx = fitsAll ? 40 - x0 * k + (avail - (x1 - x0) * k) / 2 : vw - panelW - 200 - x1 * k;
      const rowsY = ns.map((n) => n.row);
      const r0 = Math.min(...rowsY), r1 = Math.max(...rowsY);
      const visibleH = vw < 760 && !panel.hidden ? vh - panel.offsetHeight - 16 : vh;
      const midRow = (r1 - r0) * ROW_H < visibleH - AXIS_H - 60 ? (r0 + r1) / 2 : nodeById.get(id).row;
      const ty = Math.min(0, (AXIS_H + visibleH) / 2 - (AXIS_H + 26 + midRow * ROW_H));
      animateTo(k, tx, ty, animate ? 750 : 0);
    }
    // Сдвинуть карту, не меняя масштаба, чтобы узел не прятался под панелью.
    function revealNode(id) {
      const n = nodeById.get(id);
      const panelW = vw < 760 ? 0 : panel.offsetWidth + 24;
      const x = X(n.s.start), y = Y(n.row);
      let tx = t.tx, ty = t.ty;
      if (x > vw - panelW - 140) tx -= x - (vw - panelW) * 0.6;
      const visibleH = vw < 760 ? vh - panel.offsetHeight - 16 : vh;
      if (y > visibleH - 30) ty -= y - visibleH * 0.5;
      animateTo(t.k, tx, ty, 450);
    }
    function resize() {
      vw = stage.clientWidth; vh = stage.clientHeight;
      svg.setAttribute('width', vw); svg.setAttribute('height', vh);
      svg.setAttribute('viewBox', `0 0 ${vw} ${vh}`);
      if (sc) { kFit = (vw - 80 - LABEL_PAD) / sc.total; clamp(); schedule(); }
    }

    // ---------- выбор ----------
    function select(id, { center = false, animate = true } = {}) {
      selected = id;
      const anc = store.ancestors(id), desc = store.descendants(id);
      const lit = new Set([id, ...anc, ...desc]);
      svg.classList.add('has-selection');
      for (const n of nodes) {
        n.g.classList.toggle('lit', lit.has(n.s.id));
        n.g.classList.toggle('is-selected', n.s.id === id);
      }
      const depth = (sid, set, dir) => {
        // Расстояние по графу от выбранного: для задержки анимации.
        let d = 0, frontier = [id];
        const seen = new Set([id]);
        while (frontier.length && d < 60) {
          if (frontier.includes(sid)) return d;
          const next = [];
          for (const f of frontier) for (const r of store.get(f)[dir]) if (set.has(r.id) && !seen.has(r.id)) { seen.add(r.id); next.push(r.id); }
          frontier = next; d++;
        }
        return d;
      };
      // Главная линия (по первым родителям) — как полоса «Родословная» на странице стиля.
      const line = store.mainLine(id).map((x) => x.id);
      const mainPairs = new Set(line.slice(1).map((cid, i) => `${line[i]}>${cid}`));
      for (const n of nodes) n.g.classList.toggle('on-line', line.includes(n.s.id));
      for (const e of edges) {
        e.path.classList.toggle('main', mainPairs.has(`${e.par.s.id}>${e.ch.s.id}`));
        const up = (anc.has(e.par.s.id) || e.par.s.id === id) && (anc.has(e.ch.s.id) || e.ch.s.id === id);
        const down = (desc.has(e.ch.s.id)) && (desc.has(e.par.s.id) || e.par.s.id === id);
        const hl = up || down;
        e.path.classList.toggle('hl', hl);
        e.path.classList.toggle('desc', down && !up);
        const d = hl ? (up ? depth(e.par.s.id, anc, 'parents') : depth(e.ch.s.id, desc, 'children')) : 0;
        e.path.style.transitionDelay = hl && animate && !reduceMotion() ? `${Math.min(d, 14) * 70}ms` : '0ms';
      }
      openPanel(store.get(id));
      replaceParams('map', { s: id });
      const n = nodeById.get(id);
      const sx = X(n.s.start), sy = Y(n.row);
      const covered = vw >= 760 ? sx > vw - panel.offsetWidth - 60 : sy > vh - panel.offsetHeight - 30;
      if (center) fitLineage(id, animate);
      else if (covered) revealNode(id);
      schedule();
    }
    function clearSelection() {
      selected = null;
      svg.classList.remove('has-selection');
      for (const n of nodes) n.g.classList.remove('lit', 'is-selected', 'on-line');
      for (const e of edges) { e.path.classList.remove('hl', 'main', 'desc'); e.path.style.transitionDelay = '0ms'; }
      panel.hidden = true;
      replaceParams('map', {});
      schedule();
    }

    function relList(s, key, dir) {
      if (!s[key].length) return '';
      return html`<div class="mp-rel"><h3>${dir === 'from' ? 'Откуда' : 'Куда'}</h3><ul>
        ${s[key].map((r) => { const o = store.get(r.id); return o ? html`<li><button type="button" class="mp-node" data-select="${o.id}"><span class="swatch" style="--c:var(--era-${o.era})"></span><span><span class="mp-node-rel">${RELATION[r.type][dir]}</span>${o.name}</span></button></li>` : ''; })}
      </ul></div>`;
    }
    function openPanel(s) {
      mount(panel, html`
        <button class="icon-btn mp-close" type="button" data-close-panel aria-label="Закрыть"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
        <a class="mp-art" href="#/s/${s.id}">${frame(s.example.img, s.palette, { ratio: '16 / 10', sizes: '360px', alt: '', note: s.example.img ? '' : 'Палитра стиля' })}</a>
        <div class="mp-body">
          ${eraTag(store, s.era, { link: false })}
          <h2 class="mp-name">${s.name}</h2>
          <p class="mp-orig">${s.orig}, ${fmtDates(s)}</p>
          <p class="mp-sum">${s.summary}</p>
          ${relList(s, 'parents', 'from')}
          ${relList(s, 'children', 'to')}
          <a class="btn mp-open" href="#/s/${s.id}">Открыть зал</a>
        </div>`);
      panel.hidden = false;
      markLoaded(panel);
    }

    // ---------- подсказка при наведении ----------
    let tipTimer = 0, tipFor = null;
    function showTip(n) {
      const s = n.s;
      tipFor = s.id;
      mount(tip, html`${thumb(s, 72)}<span class="tip-text"><span class="tip-name">${s.name}</span><span class="tip-dates">${fmtDates(s)}</span><span class="tip-sum">${s.summary}</span></span>`);
      markLoaded(tip);
      tip.hidden = false;
      const x = X(s.start), y = Y(n.row);
      const tw = tip.offsetWidth, th = tip.offsetHeight;
      let left = x + 14, top = y + 16;
      if (left + tw > vw - 10) left = Math.max(10, x - tw - 14);
      if (top + th > vh - 10) top = y - th - 16;
      tip.style.transform = `translate(${left}px, ${top}px)`;
    }
    function hideTip() { clearTimeout(tipTimer); tip.hidden = true; tipFor = null; }

    // ---------- события ----------
    const pointers = new Map();
    let drag = null, pinch = null, moved = false;

    on(stage, 'pointerdown', (e) => {
      if (e.target.closest('.map-panel, .map-tip')) return;
      stage.setPointerCapture?.(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      moved = false;
      if (pointers.size === 1) drag = { x: e.clientX, y: e.clientY, tx: t.tx, ty: t.ty, node: e.target.closest('.node') };
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), k: t.k, mid: (a.x + b.x) / 2, tx: t.tx, ty: t.ty, my: (a.y + b.y) / 2 };
        drag = null;
      }
    });
    on(stage, 'pointermove', (e) => {
      if (!pointers.has(e.pointerId)) {
        // наведение
        const nodeEl = e.target.closest('.node');
        if (nodeEl && e.pointerType === 'mouse') {
          const id = nodeEl.dataset.id;
          if (id !== tipFor) { clearTimeout(tipTimer); tipTimer = setTimeout(() => showTip(nodeById.get(id)), 110); }
        } else if (tipFor || tipTimer) hideTip();
        return;
      }
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const rect = stage.getBoundingClientRect();
      if (pinch && pointers.size >= 2) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const k2 = Math.min(5, Math.max(kFit * 0.9, pinch.k * (d / pinch.d)));
        const mid = (a.x + b.x) / 2 - rect.left, my = (a.y + b.y) / 2;
        t.tx = mid - ((pinch.mid - rect.left - pinch.tx) * k2) / pinch.k;
        t.k = k2;
        t.ty = pinch.ty + (my - pinch.my);
        moved = true; clamp(); schedule();
      } else if (drag) {
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        if (Math.abs(dx) + Math.abs(dy) > 4) moved = true;
        if (moved) { hideTip(); stage.classList.add('dragging'); t.tx = drag.tx + dx; t.ty = drag.ty + dy; clamp(); schedule(); }
      }
    });
    const end = (e) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.delete(e.pointerId);
      stage.classList.remove('dragging');
      if (pointers.size < 2) pinch = null;
      if (drag && !moved && e.type === 'pointerup') {
        if (drag.node) select(drag.node.dataset.id);
        else if (!e.target.closest('.map-panel')) clearSelection();
      }
      if (!pointers.size) drag = null;
    };
    on(stage, 'pointerup', end);
    on(stage, 'pointercancel', end);
    on(stage, 'pointerleave', (e) => { if (e.pointerType === 'mouse' && !pointers.size) hideTip(); });

    on(stage, 'wheel', (e) => {
      if (e.target.closest('.map-panel')) return;
      e.preventDefault();
      hideTip();
      const rect = stage.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) zoomAt(e.clientX - rect.left, Math.exp(-e.deltaY * (e.deltaMode ? 0.05 : 0.0025)));
      else {
        const unit = e.deltaMode === 1 ? 16 : 1;
        const tall = contentH > vh;
        if (e.shiftKey || !tall) t.tx -= (e.deltaY + e.deltaX) * unit;
        else { t.tx -= e.deltaX * unit; t.ty -= e.deltaY * unit; }
        clamp(); schedule();
      }
    }, { passive: false });

    on(stage, 'dblclick', (e) => {
      if (e.target.closest('.map-panel, .node')) return;
      const rect = stage.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const k2 = Math.min(5, t.k * 2);
      animateTo(k2, px - ((px - t.tx) * k2) / t.k, t.ty, 450);
    });

    on(stage, 'keydown', (e) => {
      const nodeEl = e.target.closest?.('.node');
      if (nodeEl && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); select(nodeEl.dataset.id, { center: true }); return; }
      if (e.target.closest('.map-panel')) return;
      const step = 90;
      if (e.key === 'ArrowLeft') t.tx += step; else if (e.key === 'ArrowRight') t.tx -= step;
      else if (e.key === 'ArrowUp') t.ty += step / 2; else if (e.key === 'ArrowDown') t.ty -= step / 2;
      else if (e.key === '+' || e.key === '=') return zoomAt(vw / 2, 1.4);
      else if (e.key === '-' || e.key === '_') return zoomAt(vw / 2, 1 / 1.4);
      else if (e.key === '0') return fit();
      else if (e.key === 'Escape') return clearSelection();
      else return;
      e.preventDefault(); clamp(); schedule();
    });
    on(stage, 'focusin', (e) => {
      const nodeEl = e.target.closest?.('.node');
      if (!nodeEl || e.target.matches(':focus-visible') === false) return;
      const n = nodeById.get(nodeEl.dataset.id);
      const x = X(n.s.start), y = Y(n.row);
      if (x < 40 || x > vw - 200 || y < AXIS_H + 20 || y > vh - 40) {
        t.tx += vw * 0.4 - x; t.ty += vh / 2 - y; clamp(); schedule();
      }
    });

    on(root, 'click', (e) => {
      const z = e.target.closest('[data-zoom]');
      if (z) {
        if (z.dataset.zoom === 'fit') fit();
        else { const f = z.dataset.zoom === 'in' ? 1.6 : 1 / 1.6; const k2 = Math.min(5, Math.max(kFit * 0.9, t.k * f)); animateTo(k2, vw / 2 - ((vw / 2 - t.tx) * k2) / t.k, t.ty, 350); }
      }
      const d = e.target.closest('[data-domain]');
      if (d) {
        domain = d.dataset.domain;
        root.querySelectorAll('[data-domain]').forEach((b) => b.setAttribute('aria-pressed', String(b === d)));
        for (const n of nodes) {
          const off = domain && !n.s.domain.includes(domain);
          n.g.classList.toggle('filtered', !!off);
          n.bar.classList.toggle('filtered', !!off);
        }
        for (const ed of edges) ed.path.classList.toggle('filtered', !!domain && (!ed.par.s.domain.includes(domain) || !ed.ch.s.domain.includes(domain)));
        schedule();
      }
      const sel = e.target.closest('[data-select]');
      if (sel) select(sel.dataset.select, { center: true });
      if (e.target.closest('[data-close-panel]')) clearSelection();
    });

    // Мини-карта: клик или перетаскивание переносит окно.
    let miniDrag = false;
    const miniMove = (e) => {
      const rect = mini.getBoundingClientRect();
      const frac = (e.clientX - rect.left) / rect.width;
      t.tx = vw / 2 - frac * sc.total * t.k;
      clamp(); schedule();
    };
    on(mini, 'pointerdown', (e) => { if (!sc) return; miniDrag = true; mini.setPointerCapture(e.pointerId); miniMove(e); });
    on(mini, 'pointermove', (e) => { if (miniDrag) miniMove(e); });
    on(mini, 'pointerup', () => { miniDrag = false; });

    const ro = new ResizeObserver(() => resize());
    ro.observe(stage);
    cleanups.push(() => ro.disconnect());

    build();

    return {
      update(next) {
        const id = next.params.get('s');
        if (id && id !== selected && nodeById.has(id)) select(id, { center: true });
      },
      destroy() {
        destroyed = true;
        cancelAnimationFrame(raf); cancelAnimationFrame(anim); clearTimeout(tipTimer);
        cleanups.forEach((f) => f());
      },
    };
  },
};
