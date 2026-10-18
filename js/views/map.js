// Карта родословной. Время — по горизонтали; по вертикали — родословное древо: потомок стоит рядом
// с главным предком, ветви расходятся вверх и вниз. Каждый стиль — точка зарождения, подпись и ствол
// до последнего потомка; длительность видна только у выбранного стиля (и в датах подписи).
// Ветви древа обходят подписи и на пересечениях проходят «над» чужими линиями (подложка цвета бумаги).
// Уровни: моря → части → эстетики → связи и детали. Клик по стилю — крупный план ближайших связей,
// с подписями типов связей и метками дальних родственников на краю экрана; полная родословная — по запросу.
import { html, mount, safeUrl } from '../html.js';
import { fmtDates, fmtYear, RELATION, REL_STATUS, CONTEXT, DOMAIN, KIND, KIND_FAMILY, plural } from '../format.js?v=regional-01';
import { createTimeScale, segmentWidths, segmentTicks } from '../timescale.js';
import { layoutGenealogy, routeBranches } from '../layout.js?v=sparse';
import { frame, markLoaded } from '../ui/image.js?v=author-pilot';
import { eraTag, thumb } from '../ui/common.js?v=author-pilot';
import { replaceParams, pushParams } from '../router.js?v=map4';
import { pushStep, toParam, parseTrail } from '../trail.js?v=map4';
import { stepTarget } from '../graphnav.js?v=chain-author-map4';
import { createGutterLens } from '../lens.js?v=map4';
import { initNebulae, drawNebulae, drawNebulaNames, disposeNebulae, setNebulaDirtyHandler, nebulaRegion, nebulaRegionAt, nebulaShore } from '../nebulae.js?v=years-only-1';
import { buildIndex, search } from '../search.js?v=author-pilot';
import { fitLabelText } from '../map-labels.js?v=focus-fit-1';
import { LINK_MODES, readLinkSettings, historicalLinkVisible } from '../map-links.js?v=link-modes-1';
import { mapDetail, aggregateMapLinks } from '../map-detail.js?v=years-only-1';
import { summaryCurve } from '../map-summary.js?v=years-only-1';

const NS = 'http://www.w3.org/2000/svg';
const AXIS_H = 30;      // строка делений шкалы внутри SVG
const ROW = 44;         // высота строки при рабочем масштабе
const PAD = 26;         // поля сверху и снизу полотна (в координатах раскладки)
const K_DETAIL = 1;     // масштаб, при котором строки раскрыты полностью
const MAX_K = 2;        // дальше растёт только пустое расстояние между датами
const OV_K = 0.2;       // просторный обзор (вид по умолчанию): раскладка оставляет место под все подписи
const SY_OV = 0.8;      // высота строки на просторном обзоре — доля рабочей
const Z2_K = 0.42;      // с этого масштаба — крупный план: миниатюры и даты под названием
const FONT = { 1: '600 16px Spectral', 2: '500 14px "Golos Text"', 3: '400 13px "Golos Text"' };
const FONT_PX = { 1: 16, 2: 14, 3: 13 };
const DATE_FONT = '400 11px "Golos Text"';
const R = { z0: { 1: 3.6, 2: 2.8, 3: 2.4 }, z1: { 1: 6, 2: 5, 3: 4.2 }, z2: { 1: 15, 2: 13, 3: 11 } };
const DASH = { evolved: '', influence: '', reaction: '6 4', revival: '1.5 4' };
const NEB_PADX = 60, NEB_PADY = 70;   // поля поля плотности туманностей в обзорных единицах
const LONG = 1200;      // разрыв во времени (px рабочего масштаба), после которого связь рисуется парными отростками
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
// Карточка может не иметь главной работы, но иметь галерейный пример — он и служит обложкой.
const coverOf = (s) => s.example.img ?? s.gallery?.find((g) => g.img)?.img ?? null;

function el(name, attrs = {}, parent) {
  const n = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  parent?.appendChild(n);
  return n;
}

// Пространственная сетка для проверки наложения подписей: быстро и на сотнях стилей.
function grid(cell = 96) {
  const m = new Map();
  const keys = (b) => { const out = []; for (let i = Math.floor(b[0] / cell); i <= Math.floor(b[1] / cell); i++) for (let j = Math.floor(b[2] / cell); j <= Math.floor(b[3] / cell); j++) out.push(i + ',' + j); return out; };
  return {
    hit(b, id) { for (const k of keys(b)) for (const o of m.get(k) ?? []) if (o[4] !== id && b[0] < o[1] && o[0] < b[1] && b[2] < o[3] && o[2] < b[3]) return true; return false; },
    add(b) { for (const k of keys(b)) { if (!m.has(k)) m.set(k, []); m.get(k).push(b); } },
  };
}

export default {
  render(root, ctx) {
    const { store, openLightbox } = ctx;
    document.title = 'Карта эстетик — Атлас эстетик';
    const famCount = (k) => store.styles.filter((s) => KIND_FAMILY[k].kinds.includes(s.kind[0])).length;

    mount(root, html`
    <div class="map-view">
      <h1 class="visually-hidden">Карта эстетик</h1>
      <div class="map-toolbar">
        <div class="map-find" role="search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>
          <input type="search" placeholder="Найти на карте" aria-label="Найти стиль на карте" autocomplete="off" spellcheck="false">
          <ul class="map-find-results" role="listbox" hidden></ul>
        </div>
        <div class="map-pop-wrap map-filter-wrap">
          <button class="chip map-filter-btn" type="button" data-filter-btn aria-expanded="false" aria-haspopup="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4"/></svg>
            <span class="mfb-label">Все стили</span>
          </button>
          <div class="map-pop map-filter-pop" hidden>
            <p class="lg-title">Показать на карте</p>
            <p class="mf-group">Область</p>
            <div class="mf-chips" role="group" aria-label="Область">
              <button class="chip" type="button" data-f-domain="">Все</button>
              ${Object.entries(DOMAIN).map(([k, v]) => html`<button class="chip" type="button" data-f-domain="${k}">${v} <span class="count">${store.styles.filter((s) => s.domain.includes(k)).length}</span></button>`)}
            </div>
            <p class="mf-group">Тип карточки</p>
            <div class="mf-chips" role="group" aria-label="Тип карточки">
              <button class="chip" type="button" data-f-family="">Все</button>
              ${Object.entries(KIND_FAMILY).map(([k, f]) => html`<button class="chip" type="button" data-f-family="${k}" title="${f.kinds.map((x) => KIND[x]).join(', ')}">${f.label} <span class="count">${famCount(k)}</span></button>`)}
            </div>
            <p class="lg-note">Остальные стили не исчезают, а бледнеют: карта не перестраивается, камера наводится на найденное. «Сбросить» возвращает прежний вид.</p>
            <button class="btn ghost mf-reset" type="button" data-f-reset>Сбросить</button>
          </div>
        </div>
        <div class="map-links" role="group" aria-label="Связи на карте">
          ${Object.entries(LINK_MODES).map(([id, name]) => html`<button type="button" data-link-mode="${id}" aria-pressed="${id === 'main'}">${name}</button>`)}
        </div>
        <div class="map-pop-wrap map-legend-wrap">
          <button class="icon-btn" type="button" data-legend aria-expanded="false" aria-label="Как читать карту">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 1 1 3.3 2.4c-.6.2-.9.7-.9 1.3v.5M12 16.6v.3"/></svg>
          </button>
          <div class="map-pop map-legend-pop" hidden>
            <p class="lg-title">Как читать карту</p>
            <ul>
              <li><svg viewBox="0 0 40 14" aria-hidden="true"><circle cx="5" cy="7" r="4" fill="var(--ink-3)"/><path d="M10 7h24" class="edge lg"/></svg>Точка — дата начала, принятая в карточке; для авторских языков и ряда традиций — начало выбранного корпуса работ. Цвет — море, редакционная область навигации</li>
              <li><svg viewBox="0 0 40 14" aria-hidden="true"><path d="M4 7h32" class="dur-legend"/></svg>Длительность — у выбранного стиля и в датах подписи</li>
              <li><svg viewBox="0 0 40 14" aria-hidden="true"><path d="M4 2v5q0 5 5 5h27" class="edge lg rel-evolved"/></svg>Развитие — ветвь от предка</li>
              <li><svg viewBox="0 0 40 14" aria-hidden="true"><path d="M2 7h36" class="edge lg rel-influence"/></svg>Влияние</li>
              <li><svg viewBox="0 0 40 14" aria-hidden="true"><path d="M2 7h36" class="edge lg rel-reaction" stroke-dasharray="6 4"/></svg>Реакция, спор с предшественником</li>
              <li><svg viewBox="0 0 40 14" aria-hidden="true"><path d="M2 7h36" class="edge lg rel-revival" stroke-dasharray="1.5 4"/></svg>Возрождение через века</li>
              <li><svg viewBox="0 0 40 14" aria-hidden="true"><path d="M2 7h36" class="edge lg weight"/></svg>Толщина — сколько стилей выросло из этой линии</li>
              <li><svg viewBox="0 0 40 14" aria-hidden="true"><path d="M2 4h36" class="edge lg st-verified"/><path d="M2 11h36" class="edge lg st-unverified"/></svg>Тёмная — подтверждена источником, светлая — гипотеза редакции</li>
              <li><svg viewBox="0 0 40 14" aria-hidden="true"><path d="M2 7h36" class="edge cmp"/></svg>Визуальное сопоставление — сходство, а не происхождение</li>
              <li><svg viewBox="0 0 40 14" aria-hidden="true"><path d="M2 7h36" class="edge context"/></svg>Контекст — школа, среда или техника</li>
            </ul>
            <div class="lg-layers" role="group" aria-label="Слои карты">
              <label class="map-switch"><input type="checkbox" data-layer="verified"><span class="sw" aria-hidden="true"></span>Только подтверждённые связи</label>
            </div>
            <p class="lg-note">На дальнем плане читаются моря: отдельные точки и ветви скрыты, пунктир объединяет связи карточек из разных морей. Нажмите на него, чтобы увидеть конкретные связи, типы и источники. При приближении появляются части, затем эстетики; лёгкая цветная заливка и тонкий внешний берег моря остаются ориентирами даже на крупном плане. Нажмите на море или его название, чтобы приблизить область. В списке доступны все моря и карточки вне них. Соседство и расстояния не означают географическую или культурную близость; состав групп не доказывает происхождение. «Основные» показывает ветви по первым указанным предкам, «Все связи» добавляет остальные связи, контекст и визуальные сопоставления; на дальнем плане показывается только несколько сводных линий. Наведение выделяет связи моря, сохраняя основные маршруты на месте. «Без связей» отключает также сводки и маршрут. Авторские карточки доступны на тех же уровнях, что и остальные. У исторических связей указаны статус проверки и источники. Фильтр «Только подтверждённые» независим от режима линий. Время идёт слева направо, на узком экране — сверху вниз; текст остаётся горизонтальным. Шкала времени неравномерная: участки с большим числом карточек занимают больше места. Перейти к периоду можно через меню карты ☰. Перетаскивание двигает карту; колесо мыши плавно меняет масштаб к точке под курсором, без Ctrl/⌘. Щипок двумя пальцами на трекпаде или экране также меняет масштаб. Работает и двойной щелчок по свободному месту.</p>
          </div>
        </div>
        <div class="zoom-ctrls">
          <button class="icon-btn" type="button" data-zoom="out" aria-label="Отдалить"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M6 12h12"/></svg></button>
          <button class="icon-btn" type="button" data-zoom="in" aria-label="Приблизить"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M6 12h12M12 6v12"/></svg></button>
          <button class="chip" type="button" data-zoom="fit">Вся история</button>
        </div>
      </div>
      <div class="map-stage" tabindex="0" aria-label="Карта эстетик: моря, части и карточки. Стрелки — двигать, плюс и минус — масштаб, Tab — по областям и стилям.">
        <canvas class="map-neb" aria-hidden="true"></canvas>
        <svg class="map-svg z0">
          <defs>${[11, 13, 15].map((r) => html`<clipPath id="clip-${r}"><circle cx="0" cy="0" r="${r}"/></clipPath>`)}</defs>
          <g class="m-summary"></g><g class="m-summary-hits"></g><g class="m-dur"></g><g class="m-life"></g><g class="m-cmp"></g><g class="m-contexts"></g><g class="m-edges"></g><g class="m-edge-hits"></g><g class="m-trail"></g><g class="m-nebnames"></g><g class="m-plates"></g>
          <g class="m-nodes"></g><g class="m-labels"></g><g class="m-stubs"></g><g class="m-sel"></g><g class="m-elabels"></g><g class="m-axis" role="group" aria-label="Годы. Неравномерная шкала времени"></g>
        </svg>
        <div class="map-offscreen" role="group" aria-label="Связи за краем экрана"></div>
        <div class="mm-box">
          <div class="minimap" role="img" aria-label="Миникарта: вся карта, рамка — видимая часть. Нажмите или тяните, чтобы перейти">
            <canvas></canvas><div class="mm-frame" aria-hidden="true"></div>
          </div>
          <button class="mm-toggle" type="button" aria-expanded="true" aria-label="Свернуть миникарту" title="Свернуть миникарту">
            <svg class="mm-ic-hide" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M7 12h10"/></svg>
            <svg class="mm-ic-show" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 6.5 9 4l6 2.5L20.5 4v13.5L15 20l-6-2.5L3.5 20z"/><path d="M9 4v13.5M15 6.5V20"/></svg>
          </button>
        </div>
        <div class="map-tip" hidden></div>
        <div class="map-edge-pop" role="dialog" aria-label="Связь" hidden></div>
        <aside class="map-panel" hidden aria-live="polite"></aside>
        <p class="map-loading">Строим карту…</p>
        <nav class="map-levels" aria-label="Подробность карты">
          <button type="button" data-detail="seas">Моря</button><span aria-hidden="true">›</span>
          <button type="button" data-detail="parts">Части</button><span aria-hidden="true">›</span>
          <button type="button" data-detail="styles">Эстетики</button>
          <button type="button" class="map-browse" data-browse aria-expanded="false" aria-label="Меню карты">☰</button>
        </nav>
        <section class="map-directory" hidden aria-label="Навигация по карте">
          <div class="md-head"><strong>Навигация по карте</strong><button type="button" class="icon-btn" data-browse-close aria-label="Закрыть меню">×</button></div>
          <p>Выберите период или море, чтобы приблизить нужную область.</p>
          <details class="md-periods"><summary>Перейти к периоду</summary><div class="md-list md-period-list">${store.eras.map((e, i) => html`<button type="button" data-period="${i}"><span>${fmtYear(e.start)} — ${fmtYear(store.eras[i + 1]?.start ?? store.now)}</span><small>${e.name}</small></button>`)}</div></details>
          <h3 class="md-section-title">Моря эстетик</h3>
          <div class="md-list">${store.nebulae.map((n, i) => html`<button type="button" data-region="neb:${i}"><i style="--c:${n.color}"></i><span>${n.name}</span><small>${store.styles.filter((s) => s.nebula === n.id).length}</small></button>`)}</div>
          <details><summary>Карточки вне морей</summary><div class="md-list">${store.styles.filter((s) => !s.nebula).map((s) => html`<button type="button" data-select="${s.id}">${s.name}</button>`)}</div></details>
        </section>
        <p class="map-hint"></p>
        <nav class="map-trail" aria-label="Маршрут" hidden></nav>
      </div>
    </div>`);

    const q = (s) => root.querySelector(s);
    const stage = q('.map-stage');
    const svg = q('.map-svg');
    const G = Object.fromEntries(['summary', 'summary-hits', 'dur', 'life', 'cmp', 'contexts', 'edges', 'edge-hits', 'trail', 'nebnames', 'plates', 'nodes', 'labels', 'stubs', 'sel', 'elabels', 'axis'].map((k) => [k, svg.querySelector(`.m-${k}`)]));
    const summaryMask = el('mask', { id: 'map-summary-mask', maskUnits: 'userSpaceOnUse', maskContentUnits: 'userSpaceOnUse' }, svg.querySelector('defs'));
    G.summary.setAttribute('mask', 'url(#map-summary-mask)'); G['summary-hits'].setAttribute('mask', 'url(#map-summary-mask)');
    const regionMask = el('mask', { id: 'map-region-mask', maskUnits: 'userSpaceOnUse', maskContentUnits: 'userSpaceOnUse' }, svg.querySelector('defs'));
    for (const g of [G.edges, G['edge-hits'], G.cmp, G.contexts, G.life, G.trail, G.dur]) g.setAttribute('mask', 'url(#map-region-mask)');
    const directory = q('.map-directory');
    const tip = q('.map-tip');
    const edgePop = q('.map-edge-pop');
    const panel = q('.map-panel');
    const chips = q('.map-offscreen');
    const hint = q('.map-hint');
    const trailNav = q('.map-trail');
    const nebCanvas = q('.map-neb');
    const nebCtx = nebCanvas.getContext('2d');
    const trailPath = el('path', { class: 'trail-path' }, G.trail);
    const mmBox = q('.mm-box');
    const mmToggle = q('.mm-toggle');
    const mm = q('.minimap');
    const mmCanvas = mm.querySelector('canvas');
    const mmFrame = mm.querySelector('.mm-frame');

    let destroyed = false;
    const cleanups = [];
    const on = (target, ev, fn, opts) => { target.addEventListener(ev, fn, opts); cleanups.push(() => target.removeEventListener(ev, fn, opts)); };

    // ---------- состояние ----------
    const t = { k: 1, tx: 0, ty: 0 };
    // Узкий экран: карта повёрнута на 90° по часовой стрелке — время идёт сверху вниз. Внутри всё считается
    // как раньше, в «виртуальной» альбомной сцене vw × vh; pw × ph — настоящий размер, rot — повёрнута ли сцена.
    let vw = 0, vh = 0, pw = 0, ph = 0, rot = false, sc, k0 = 0.1, syFit = 0.5, contentRefH = 0;
    const rotateOn = ctx.params?.get('rot') !== '0';
    const nodes = [], edges = [], cmps = [], contextEdges = [];
    const nodeById = new Map();
    const axis = {};
    let raf = 0, selected = null, focusMode = 'near', hovered = null, mode = 'z0';
    let linkMode = 'main', verifiedOnly = false;
    let detail = mapDetail(0, 0, OV_K), aggregateLinks = [], summaryRecords = [], regionHover = null;
    const regionNames = new Map();
    let filter = { domain: '', family: '' };
    let camBeforeFocus = null, camBeforeFilter = null;
    let trail = [];        // маршрут по стилям; источник правды — параметр trail в адресе
    let edgeInfoFocus = null;
    const lensParam = ctx.params?.get('lens') !== '0';
    const lensNow = () => lensParam && !rot;   // на повёрнутой карте (телефон) желоба не нужны: сцена слишком короткая
    // Желоба по краям: центр — камера, остальное сжато у краёв (js/lens.js). Пока кадр не нарисован — тождество камеры.
    const IDENT = { fwd: (x) => x * t.k + t.tx, zone: () => 'C', hasL: false, hasR: false, gutter: 0, width: 1e9 };
    let lens = IDENT;
    let primaryOf = null, nebDpr = 1, nebTimer = 0;   // туманности: главный предок по id, DPR слоя, пауза перед пересборкой
    const neb = { ready: false };
    let labelMeasure;
    let nebBuildVersion = 0;
    const nebOn = ctx.params?.get('neb') !== '0';
    q('.map-levels').hidden = !nebOn;
    const LABEL_PAD = window.innerWidth < 760 ? 110 : 170;
    const isNarrow = () => pw <= 760;
    // Экранные координаты ↔ виртуальные (x_в = y_э, y_в = pw − x_э) и сдвиги.
    const toV = (cx, cy) => { const r = stage.getBoundingClientRect(), x = cx - r.left, y = cy - r.top; return rot ? { x: y, y: pw - x } : { x, y }; };
    const toP = (x, y) => (rot ? { x: pw - y, y: x } : { x, y });
    const dV = (dx, dy) => (rot ? { x: dy, y: -dx } : { x: dx, y: dy });

    // Высота строк зависит от масштаба: «Вся история» вписывает всё по высоте, просторный обзор
    // держит строки читаемыми (SY_OV), рабочий масштаб раскрывает их полностью.
    const kOv = () => Math.max(OV_K, k0 * 1.05);
    function syOf(k) {
      if (k >= K_DETAIL) return 1;
      const ko = kOv(), fitY = Math.min(SY_OV, syFit);
      if (k >= ko) return SY_OV * Math.pow(1 / SY_OV, Math.log(k / ko) / Math.log(K_DETAIL / ko));
      const p = clamp(Math.log(k / k0) / Math.log(ko / k0), 0, 1);
      return fitY * Math.pow(SY_OV / fitY, p);
    }
    const X = (year) => lens.fwd(sc.x(year));
    const XR = (xr) => lens.fwd(xr);              // координата раскладки → экран (с желобами по краям)
    const yRef = (n) => PAD + n.row * ROW + ROW / 2;
    const Y = (n) => AXIS_H + t.ty + yRef(n) * syOf(t.k);
    // Нижняя шторка на повёрнутой карте занимает «правый» край сцены (конец времени).
    const panelWidth = () => (rot ? (!panel.hidden ? panel.offsetHeight + 8 : 0) : (!panel.hidden && !isNarrow() ? panel.offsetWidth + 24 : 0));
    const sheetHeight = () => (!rot && !panel.hidden && isNarrow() ? panel.offsetHeight + 8 : 0);
    const viewRect = () => ({ x0: 0, x1: vw - panelWidth(), y0: AXIS_H, y1: vh - sheetHeight() });

    // ---------- построение ----------
    async function build() {
      try {
        await Promise.all([...Object.values(FONT), DATE_FONT].map((f) => document.fonts.load(f, 'Аа0123456789')));
        await document.fonts.ready;
      } catch { /* шрифты не критичны */ }
      if (destroyed) return;
      const canvas = document.createElement('canvas').getContext('2d');
      const measure = (font, text) => { canvas.font = font; return canvas.measureText(text); };
      labelMeasure = (font, text) => measure(font, text).width;

      const breaks = [...store.eras.map((e) => e.start), store.now + 1];
      sc = createTimeScale(breaks, segmentWidths(breaks, store.styles.map((s) => s.start), { base: 60, perItem: 76, min: 170 }));

      const meta = new Map(store.styles.map((s) => {
        const name = measure(FONT[s.tier], s.name), dates = measure(DATE_FONT, fmtDates(s));
        return [s.id, { w: name.width, wd: dates.width,
          ascent: name.fontBoundingBoxAscent ?? FONT_PX[s.tier] * 1.15,
          descent: name.fontBoundingBoxDescent ?? FONT_PX[s.tier] * 0.55,
          dateDescent: dates.fontBoundingBoxDescent ?? 5 }];
      }));
      const layNodes = store.styles.map((s) => ({
        id: s.id, start: s.start, end: s.end, tier: s.tier,
        width: R.z2[s.tier] + 8 + Math.max(meta.get(s.id).w, meta.get(s.id).wd),
        parents: s.parents.map((p) => p.id),
        // На просторном обзоре подпись того же размера, а масштаб мельче: строка держит место под неё.
        reach: ((s.tier === 1 ? 11 : R.z1[s.tier]) + 7 + meta.get(s.id).w + 12) / OV_K,
      }));
      const lay = layoutGenealogy(layNodes, sc.x, { now: store.now, dot: 16, gap: 22, tail: 28, longGap: LONG });
      primaryOf = lay.primary;
      // Коридоры ищутся при масштабе обзора: свободный там — свободен и при любом более крупном.
      const routes = routeBranches(layNodes, sc.x, lay, { now: store.now, dot: 16, scale: OV_K, extent: (n) => n.reach });
      contentRefH = PAD * 2 + lay.count * ROW;
      // Вес линии (как в OneZoom): сколько стилей выросло из неё по главной линии родства.
      const kidsOf = new Map(store.styles.map((s) => [s.id, []]));
      for (const s of store.styles) { const pid = lay.primary.get(s.id); if (pid) kidsOf.get(pid).push(s.id); }
      const sizeOf = new Map();
      const size = (id) => { if (sizeOf.has(id)) return sizeOf.get(id); sizeOf.set(id, 1); const v = 1 + kidsOf.get(id).reduce((a, k) => a + size(k), 0); sizeOf.set(id, v); return v; };
      store.styles.forEach((s) => size(s.id));
      const weight = (id) => Math.log2(sizeOf.get(id));
      // Ориентиры для общего вида: крупные узлы родословной с картинкой, не больше двух на эпоху.
      const perEra = new Map();
      const landmarks = new Set(store.styles.filter((s) => coverOf(s))
        .sort((a, b) => sizeOf.get(b.id) - sizeOf.get(a.id) || a.tier - b.tier || a.start - b.start)
        .filter((s) => { const c = perEra.get(s.era) ?? 0; if (c >= 2 || (sizeOf.get(s.id) < 4 && s.tier > 1)) return false; perEra.set(s.era, c + 1); return true; })
        .slice(0, 16).map((s) => s.id));

      // Годы на прежней неравномерной шкале, без слоя эпох.
      axis.bg = el('rect', { class: 'axis-bg', x: 0, y: 0, height: AXIS_H }, G.axis);
      axis.line = el('line', { class: 'axis-line', y1: AXIS_H - 0.5, y2: AXIS_H - 0.5, x1: 0 }, G.axis);
      axis.ticks = el('g', { class: 'axis-ticks' }, G.axis);
      axis.pool = [];

      // Стили: линия жизни, точка, подпись (имя и даты)
      for (const s of store.styles) {
        // Ствол: от точки зарождения до последнего потомка, толщина — вес родословной.
        const life = el('path', { class: `life t${s.tier}`, 'data-id': s.id, style: `--w:${weight(s.id).toFixed(2)}` }, G.life);
        const g = el('g', { class: `node t${s.tier}`, tabindex: '0', role: 'button', 'aria-label': `${s.name}, ${fmtDates(s)}`, 'data-id': s.id }, G.nodes);
        el('circle', { class: 'hit', r: 18 }, g);
        const dot = el('circle', { class: 'dot', fill: store.nebulaColor(s.id) }, g);
        const ring = el('circle', { class: 'ring', stroke: store.nebulaColor(s.id) }, g);
        // Подложка подписи: линии уходят под название, как на транспортной карте, а не сквозь текст.
        const plate = el('rect', { class: 'plate', rx: 3 }, G.plates);
        const text = el('text', { class: `label t${s.tier}`, 'data-id': s.id }, G.labels);
        const name = el('tspan', { class: 'l-name' }, text);
        name.textContent = s.name;
        const dates = el('tspan', { class: 'l-dates' }, text);
        dates.textContent = fmtDates(s);
        const m = meta.get(s.id);
        const n = { s, row: lay.pos.get(s.id), g, dot, ring, text, name, dates, fullDates: dates.textContent, life, plate, img: null, cover: coverOf(s), w: m.w, wd: m.wd, wt: weight(s.id), ascent: m.ascent, descent: m.descent, dateDescent: m.dateDescent, x: 0, y: 0, r: 4, labelOn: false, landmark: landmarks.has(s.id) };
        if (n.landmark) g.classList.add('landmark');
        nodes.push(n);
        nodeById.set(s.id, n);
      }
      // Связи: первая (parents[0]) — ветвь древа с подобранным коридором; остальные — дуги.
      for (const s of store.styles) s.parents.forEach((p, i) => {
        const par = nodeById.get(p.id), ch = nodeById.get(s.id);
        if (!par || !ch) return;
        const primary = i === 0;
        const st = p.status === 'verified' ? 'st-verified' : 'st-unverified';
        const g = el('g', { class: `edge-g ${primary ? 'tree' : 'sec'}` }, G.edges);
        const casing = el('path', { class: 'case' }, g);
        const path = el('path', { class: `edge ${primary ? 'tree' : 'sec'} rel-${p.type} ${st}`, 'data-from': p.id, 'data-to': s.id, style: `--w:${(primary ? weight(s.id) : 0).toFixed(2)}` }, g);
        if (DASH[p.type]) path.setAttribute('stroke-dasharray', DASH[p.type]);
        const hit = el('path', { class: `edge-hit ${st}`, 'data-edge': edges.length }, G['edge-hits']);
        const long = sc.x(s.start) - sc.x(par.s.end ?? store.now) > LONG;
        const stubText = long ? el('text', { class: 'stub-label' }, G.stubs) : null;
        if (stubText) stubText.textContent = `← ${par.s.name}`;
        edges.push({ par, ch, type: p.type, primary, g, casing, path, hit, rel: p, jx: primary ? routes.get(s.id)?.jx ?? null : null, drawn: false, long, stubText });
      });
      for (const n of nodes) n.kidEdges = edges.filter((e) => e.par === n && e.primary);
      // У предка — парная метка для всех его «далёких» потомков: куда ведёт оборванная линия.
      for (const n of nodes) {
        const far = edges.filter((e) => e.par === n && e.long && e.primary);
        if (!far.length) continue;
        n.outText = el('text', { class: 'stub-label out-label' }, G.stubs);
        const names = far.map((e) => e.ch.s.name);
        n.outText.textContent = `→ ${names.slice(0, 2).join(', ')}${names.length > 2 ? ` и ещё ${names.length - 2}` : ''}`;
        n.outCount = far.length;
      }
      const seenCmp = new Set();
      for (const s of store.styles) for (const c of s.comparisons) {
        const key = [s.id, c.id].sort().join('|');
        const a = nodeById.get(s.id), b = nodeById.get(c.id);
        if (seenCmp.has(key) || !a || !b) continue;
        seenCmp.add(key);
        const path = el('path', { class: 'edge cmp', 'data-from': s.id, 'data-to': c.id }, G.cmp);
        const hit = el('path', { class: 'edge-hit cmp-hit', 'data-cmp': cmps.length }, G['edge-hits']);
        cmps.push({ a, b, path, hit, note: c.note, sources: c.sources });
      }
      for (const s of store.styles) for (const c of s.contexts ?? []) {
        if (c.direction !== 'out') continue;
        const a = nodeById.get(s.id), b = nodeById.get(c.id);
        if (!a || !b) continue;
        const path = el('path', { class: `edge context st-${c.status}`, 'data-from': s.id, 'data-to': c.id }, G.contexts);
        const hit = el('path', { class: 'edge-hit context-hit', 'data-context': contextEdges.length }, G['edge-hits']);
        contextEdges.push({ a, b, path, hit, type: c.type, status: c.status, note: c.note, sources: c.sources, context: true });
      }
      // Годы выбранного стиля — у концов его линии жизни
      axis.durHover = el('path', { class: 'dur hover' }, G.dur);
      axis.durSel = el('path', { class: 'dur' }, G.dur);
      axis.selStart = el('text', { class: 'sel-year' }, G.sel);
      axis.selEnd = el('text', { class: 'sel-year end' }, G.sel);

      svg.dataset.nodes = String(nodes.length);
      svg.dataset.edges = String(edges.length);
      svg.dataset.comparisons = String(cmps.length);
      svg.dataset.contexts = String(contextEdges.length);
      svg.dataset.rows = String(lay.count);
      if (!nebOn) q('.map-loading').remove();
      resize();
      drawMinimap();
      if (nebOn) fit(false); else overview(false);
      applyParams(ctx.params, true);
      buildNebulae();
    }

    // Туманности. Обзорные единицы прототипа: x = PADX + sc.x·OV_K, y = PADY + yRef·SY_OV.
    function rebuildNeb() { clearTimeout(nebTimer); nebTimer = setTimeout(buildNebulae, 120); }
    async function buildNebulae() {
      clearTimeout(nebTimer);
      if (!nebOn || !store.nebulae.length) return;
      const version = ++nebBuildVersion;
      const nebNodes = nodes;
      const css = getComputedStyle(document.documentElement);
      const colors = { paper: css.getPropertyValue('--paper').trim(), ink: css.getPropertyValue('--ink').trim() };
      const theme = css.colorScheme.includes('dark') ? 'dark' : 'light';
      const idx = new Map(nebNodes.map((n, i) => [n.s.id, i]));
      // id части в слое — её номер (так устроены поля стилей: part = номер части)
      const partList = store.nebulae.flatMap((n, ni) => n.parts.map((p) => ({ key: p.id, name: p.name, nebula: ni })));
      const parts = partList.map((p, i) => ({ id: i, name: p.name, nebula: p.nebula }));
      const partIdx = new Map(partList.map((p, i) => [p.key, i]));
      const nebIdx = new Map(store.nebulae.map((n, i) => [n.id, i]));
      const A = {
        W: NEB_PADX * 2 + sc.total * OV_K, H: NEB_PADY * 2 + contentRefH * SY_OV,
        nebulae: store.nebulae.map((n) => ({ name: n.name, color: n.color })), parts,
        styles: nebNodes.map((n) => ({
          x: NEB_PADX + sc.x(n.s.start) * OV_K, y: NEB_PADY + yRef(n) * SY_OV, tier: n.s.tier,
          nebula: nebIdx.get(n.s.nebula) ?? -1, part: partIdx.get(n.s.part) ?? -1,
          palette: n.s.palette?.colors?.length ? n.s.palette.colors : ['#888780'], accent: n.s.palette?.accent ?? null,
          parent: idx.get(primaryOf.get(n.s.id)) ?? -1,
          links: n.s.parents.map((r) => [idx.get(r.id), 0]).filter(([j]) => j !== undefined),
        })),
      };
      neb.ready = false;
      const t0 = performance.now();
      const ready = await initNebulae(A, { theme, colors });
      if (!ready || destroyed || version !== nebBuildVersion) return;
      svg.dataset.nebulaMembers = String(nebNodes.length);
      svg.dataset.nebulaBuild = String(version);
      window.__nebInit = performance.now() - t0;
      neb.ready = true;
      q('.map-loading')?.remove();
      schedule();
    }
    const nebulaCam = () => {
      const kx = t.k / OV_K, ky = syOf(t.k) / SY_OV;
      return { kx, ky, ox: t.tx - NEB_PADX * kx, oy: AXIS_H + t.ty - NEB_PADY * ky, w: vw, h: vh, axis: AXIS_H, dpr: nebDpr, detail,
        toScreen: (ux, uy) => [t.tx + (ux - NEB_PADX) * kx, AXIS_H + t.ty + (uy - NEB_PADY) * ky], svg: el };
    };
    // На телефоне время идёт сверху вниз, но текст читается горизонтально.
    const nameCam = () => {
      const c = nebulaCam();
      if (!rot) return c;
      return { ...c, w: pw, h: ph, axis: 0, narrow: true,
        toScreen: (ux, uy) => { const [x, y] = c.toScreen(ux, uy); return [pw - y, x]; },
        toMap: (x, y) => [(y - c.ox) / c.kx, (pw - x - c.oy) / c.ky],
        screenAngle: () => 0 };
    };
    const toNameBox = (b) => rot ? [pw - b[3], b[0], pw - b[1], b[2]] : b;
    const fromNameBox = (b) => rot ? [b[1], pw - b[2], b[3], pw - b[0]] : b;

    function applyParams(params, first = false) {
      const settings = readLinkSettings(params);
      setLinkMode(settings.mode);
      setLayer('verified', settings.verifiedOnly);
      const d = DOMAIN[params.get('d')] ? params.get('d') : '';
      const k = KIND_FAMILY[params.get('k')] ? params.get('k') : '';
      if (d !== filter.domain || k !== filter.family) setFilter({ domain: d, family: k }, { animate: !first });
      const focus = store.resolve(params.get('s') ?? '');
      const eraI = store.eras.findIndex((e) => e.id === params.get('era'));
      trail = parseTrail(params.get('trail'), (x) => nodeById.has(x));
      if (focus && nodeById.has(focus)) select(focus, { animate: !first, mode: params.get('view') === 'line' ? 'line' : 'near', nav: 'url' });
      else if (selected) clearSelection({ restore: true, nav: 'url' });
      else if (eraI >= 0) zoomToEra(eraI, first ? 0 : 650);
    }

    // ---------- отрисовка ----------
    const schedule = () => { if (!raf) raf = requestAnimationFrame(draw); };

    function draw() {
      raf = 0;
      if (!sc) return;
      const focusedRegion = document.activeElement?.classList.contains('region-name') ? document.activeElement.dataset.region : null;
      const focusedSummary = document.activeElement?.classList.contains('summary-hit') ? document.activeElement.dataset.key : null;
      for (const g of [G.labels, G.plates, G.nebnames, G.summary, G['summary-hits']]) {
        if (rot) g.setAttribute('transform', `matrix(0,-1,1,0,0,${pw})`); else g.removeAttribute('transform');
      }
      detail = mapDetail(t.k, k0, kOv(), nebOn);
      svg.dataset.detail = JSON.stringify(detail);
      svg.dataset.zoom = t.k.toFixed(6);
      G.nodes.setAttribute('aria-hidden', String(detail.nodes === 0 && !selected && !hovered));
      G.labels.setAttribute('aria-hidden', String(detail.labels === 0 && !selected && !hovered));
      svg.dataset.level = detail.level;
      stage.dataset.level = detail.level;
      const quietMini = detail.nodes < 0.5;
      if (mmBox.classList.contains('is-quiet') !== quietMini) { mmBox.classList.toggle('is-quiet', quietMini); drawMinimap(); }
      for (const btn of root.querySelectorAll('[data-detail]')) {
        if (btn.dataset.detail === detail.level) btn.setAttribute('aria-current', 'step'); else btn.removeAttribute('aria-current');
      }
      lens = lensNow() ? createGutterLens({ total: sc.total, k: t.k, tx: t.tx, width: vw - panelWidth() }) : IDENT;
      const sy = syOf(t.k);
      const rowH = ROW * sy;
      const m = rowH < 17 ? 'z0' : rowH < 31 || t.k < Z2_K ? 'z1' : 'z2';
      if (m !== mode) { svg.classList.remove(mode); svg.classList.add(m); mode = m; }

      drawAxis();

      // Туманности: слой на canvas под деревом, названия — в SVG поверх (ниже, после подписей стилей).
      const nebT0 = window.__mapPerf ? performance.now() : 0;
      nebCtx.setTransform(1, 0, 0, 1, 0, 0);
      nebCtx.clearRect(0, 0, nebCanvas.width, nebCanvas.height);
      if (neb.ready && nebOn) {
        nebCtx.setTransform(nebDpr, 0, 0, nebDpr, 0, 0);
        const gl = lens.hasL ? lens.gutter : 0, gr = lens.hasR ? lens.width - lens.gutter : vw;
        nebCtx.save(); nebCtx.beginPath(); nebCtx.rect(gl, AXIS_H, gr - gl, vh - AXIS_H); nebCtx.clip();
        drawNebulae(nebCtx, nebulaCam());
        nebCtx.restore();
      }

      // Узлы и линии жизни
      const visible = [];
      for (const n of nodes) {
        const x = X(n.s.start), y = Y(n);
        const x2 = X(n.s.end ?? store.now);
        n.x = x; n.y = y; n.r = n.landmark && m !== 'z2' ? 11 : R[m][n.s.tier];
        n.zone = lens.zone(sc.x(n.s.start));
        if (n.zone !== 'C') n.r = 2.2;          // в желобе — просто точка
        n.g.classList.toggle('gutter', n.zone !== 'C');
        const hitR = n.zone === 'C' ? 18 : 4;     // у сжатых точек круг попадания маленький: соседи стоят вплотную
        if (n.hitR !== hitR) { n.hitR = hitR; n.g.firstChild.setAttribute('r', hitR); }
        const off = x2 < -40 || x > vw + 40 || y < AXIS_H - 30 || y > vh + 30;
        const emphasized = n.g.classList.contains(selected ? 'lit' : 'near') || n.s.id === selected || n.s.id === hovered;
        n.alpha = emphasized ? 1 : n.zone !== 'C' ? 0 : detail.nodes;
        n.g.style.setProperty('--node-zoom', n.alpha);
        n.g.style.pointerEvents = n.alpha < 0.15 ? 'none' : '';
        n.g.style.display = off || n.alpha === 0 ? 'none' : '';
        n.g.setAttribute('aria-hidden', String(off || n.alpha < 0.15));
        n.life.style.display = off ? 'none' : '';
        n.life.style.opacity = emphasized ? 1 : detail.edges;
        // С клавиатуры обходятся только стили на экране: Tab не уводит камеру в другой конец истории.
        const tabOff = off || n.alpha < 0.15 || n.zone !== 'C' || x < 0 || x > vw - panelWidth() || y < AXIS_H || y > vh - sheetHeight();
        if (n.tabOff !== tabOff) { n.tabOff = tabOff; n.g.setAttribute('tabindex', tabOff ? '-1' : '0'); }
        if (off) { n.text.style.display = 'none'; n.plate.style.display = 'none'; n.labelOn = false; n.lbox = null; continue; }
        n.g.setAttribute('transform', `translate(${x.toFixed(1)},${y.toFixed(1)})`);
        n.dot.setAttribute('r', n.r);
        n.ring.setAttribute('r', n.r + 1);
        if (n.alpha > 0.15 && (m === 'z2' || n.landmark) && n.cover) {
          const r = m === 'z2' ? R.z2[n.s.tier] : 11;
          if (!n.img) {
            n.img = el('image', { href: n.cover.src[250], preserveAspectRatio: 'xMidYMid slice', class: 'thumb-img' });
            n.g.insertBefore(n.img, n.ring);
          }
          if (n.imgR !== r) {
            n.imgR = r;
            for (const [k, v] of Object.entries({ x: -r, y: -r, width: r * 2, height: r * 2, 'clip-path': `url(#clip-${r})` })) n.img.setAttribute(k, v);
          }
        }
        visible.push(n);
      }

      // Подписи: по приоритету, без наложений друг на друга и на точки. Сетка — чтобы и 600 стилей не тормозили.
      // На просторном обзоре место под каждую подпись оставила раскладка; мельче — побеждает приоритет.
      const occ = grid();
      for (const n of visible) if (n.alpha > 0.15) occ.add([n.x - n.r - 1, n.x + n.r + 1, n.y - n.r - 1, n.y + n.r + 1, n.s.id]);
      // Подпись целиком в видимой области и не под миникартой — иначе не показываем: обрезанное
      // название хуже отсутствующего (сдвиньте карту — оно появится).
      const view = viewRect();
      occ.add([mmBox.offsetLeft - 4, mmBox.offsetLeft + mmBox.offsetWidth + 4, mmBox.offsetTop - 4, mmBox.offsetTop + mmBox.offsetHeight + 4, '']);
      const levelRect = q('.map-levels').getBoundingClientRect();
      if (levelRect.width) {
        const a = toV(levelRect.left, levelRect.top), b = toV(levelRect.right, levelRect.bottom);
        occ.add([Math.min(a.x, b.x) - 5, Math.max(a.x, b.x) + 5, Math.min(a.y, b.y) - 5, Math.max(a.y, b.y) + 5, '']);
      }
      // На «Всей истории» названия туманностей важнее подписей стилей: ставятся первыми, подписи их обходят.
      const nebNamesFirst = neb.ready && nebOn && detail.labels < 0.65;
      G.nebnames.replaceChildren();
      regionNames.clear();
      const placeNebNames = (labelBoxes) => {
        const reserved = [[mmBox.offsetLeft - 4, mmBox.offsetTop - 4, mmBox.offsetLeft + mmBox.offsetWidth + 4, mmBox.offsetTop + mmBox.offsetHeight + 4]];
        if (panelWidth()) reserved.push([vw - panelWidth(), AXIS_H, vw, vh]);
        if (lens.hasL) reserved.push([0, AXIS_H, lens.gutter, vh]);
        if (lens.hasR) reserved.push([lens.width - lens.gutter, AXIS_H, lens.width, vh]);
        const levelRect = q('.map-levels').getBoundingClientRect();
        if (levelRect.width) {
          const a = toV(levelRect.left, levelRect.top), b = toV(levelRect.right, levelRect.bottom);
          reserved.push([Math.min(a.x, b.x) - 5, Math.min(a.y, b.y) - 5, Math.max(a.x, b.x) + 5, Math.max(a.y, b.y) + 5]);
        }
        if (rot) reserved.push([0, 0, vw, AXIS_H]);
        return drawNebulaNames(G.nebnames, {
          ...nameCam(), labelBoxes: labelBoxes.map(toNameBox), reserved: reserved.map(toNameBox),
          dotBoxes: visible.filter((n) => n.alpha > 0.15).map((n) => toNameBox([n.x - n.r - 1, n.y - n.r - 1, n.x + n.r + 1, n.y + n.r + 1])),
          onName: (r) => regionNames.set(`${r.kind}:${r.id}`, r),
        }).map(fromNameBox);
      };
      if (nebNamesFirst) {
        // Выбранная/наведённая подпись сохраняется даже на дальнем плане.
        // Моря обходят её заранее: последующая отсечка коллизий её не скрывает.
        const focusBoxes = visible.filter((n) => n.s.id === selected || n.s.id === hovered).map((n) => {
          const b = spotOf(n, m, m === 'z2' ? Math.max(n.w, n.wd) : n.w, FONT_PX[n.s.tier], true).box;
          return [b[0], b[2], b[1], b[3]];
        });
        for (const b of placeNebNames(focusBoxes)) occ.add([b[0], b[2], b[1], b[3], '']);
      }
      const inView = (b) => b[0] >= view.x0 + 4 && b[1] <= view.x1 - 4 && b[2] >= AXIS_H && b[3] <= view.y1;
      const allowTier = m === 'z0' ? 2 : 3;
      const focusSet = svg.classList.contains('has-selection');
      const labelAlpha = detail.labels;
      svg.dataset.labelOpacity = labelAlpha.toFixed(4);
      svg.style.setProperty('--context-alpha', (0.22 + 0.13 * labelAlpha).toFixed(3));
      visible.sort((a, b) => prio(b) - prio(a));
      for (const n of visible) {
        const forced = n.s.id === selected || n.s.id === hovered;
        const lit = n.g.classList.contains('lit');
        const emphasized = forced || (focusSet && lit) || (!!hovered && n.g.classList.contains('near'));
        const alpha = emphasized ? 1 : labelAlpha;
        for (const label of [n.text, n.plate]) label.style.setProperty('--label-zoom', alpha);
        const fh = FONT_PX[n.s.tier];
        const w = m === 'z2' ? Math.max(n.w, n.wd) : n.w;
        const spot = spotOf(n, m, w, fh, forced);
        let show = forced || (focusSet ? lit : n.s.tier <= allowTier || n.g.classList.contains('near'));
        // Невидимые подписи не занимают место и не перехватывают щелчки.
        if (alpha === 0) show = false;
        if (!spot.name) show = false;
        if (n.zone !== 'C' && !forced) show = false;
        if (show && !forced) show = inView(spot.box) && !occ.hit(spot.box, n.s.id);
        // Ориентир без подписи — не ориентир: в тесноте он становится обычной точкой.
        if (n.landmark && m !== 'z2') {
          const asThumb = show && !!n.img;
          n.g.classList.toggle('lm-on', asThumb);
          if (!asThumb && n.r !== R[m][n.s.tier]) { n.r = R[m][n.s.tier]; n.dot.setAttribute('r', n.r); n.ring.setAttribute('r', n.r + 1); }
        } else n.g.classList.remove('lm-on');
        n.text.style.display = show ? '' : 'none';
        n.plate.style.display = show ? '' : 'none';
        n.labelOn = show;
        n.lbox = show ? spot.box : null;
        n.lpos = show ? (spot.anchor === 'end' ? 'l' : 'r') : null;
        if (show) {
          if (n.name.textContent !== spot.name) n.name.textContent = spot.name;
          if (n.dates.textContent !== spot.dates) n.dates.textContent = spot.dates;
          const [a, b, c, d] = spot.box;
          occ.add([a, b, c, d, n.s.id]);
          if (spot.anchor !== (n.anchor ?? 'start')) { n.anchor = spot.anchor; n.text.setAttribute('text-anchor', spot.anchor); }
          const tx = spot.tx.toFixed(1);
          n.name.setAttribute('x', tx); n.name.setAttribute('y', spot.base.toFixed(1));
          n.dates.setAttribute('x', tx); n.dates.setAttribute('y', (spot.base + 15).toFixed(1));
          const pb = spot.renderBox ?? spot.box;
          n.plate.setAttribute('x', (pb[0] - 1).toFixed(1)); n.plate.setAttribute('width', (pb[1] - pb[0] - 1).toFixed(1));
          n.plate.setAttribute('y', (pb[2] - 1).toFixed(1)); n.plate.setAttribute('height', (pb[3] - pb[2] + 3).toFixed(1));
        }
      }
      if (neb.ready && nebOn && !nebNamesFirst) placeNebNames(visible.filter((n) => n.lbox).map((n) => [n.lbox[0], n.lbox[2], n.lbox[1], n.lbox[3]]));
      updateRegionMasks();
      drawSummary();
      if (nebT0) window.__mapPerf.push(performance.now() - nebT0);
      drawEdges();
      drawTrail();
      drawSelection();
      drawOffscreen();
      updateFitButton();
      drawMinimapFrame();
      if (focusedRegion) [...G.nebnames.querySelectorAll('.region-name')].find((n) => n.dataset.region === focusedRegion)?.focus({ preventScroll: true });
      if (focusedSummary) [...G['summary-hits'].children].find((n) => n.dataset.key === focusedSummary)?.focus({ preventScroll: true });
    }

    function updateRegionMasks() {
      for (const [mask, w, h, project] of [[summaryMask, pw, ph, (b) => b], [regionMask, vw, vh, fromNameBox]]) {
        mask.replaceChildren();
        for (const [k, value] of Object.entries({ x: 0, y: 0, width: w, height: h })) mask.setAttribute(k, value);
        el('rect', { x: 0, y: 0, width: w, height: h, fill: 'white' }, mask);
        for (const r of regionNames.values()) {
          const bs = r.boxes.map(project);
          const x = Math.min(...bs.map((b) => b[0])) - 5, y = Math.min(...bs.map((b) => b[1])) - 4;
          el('rect', { x, y, width: Math.max(...bs.map((b) => b[2])) - x + 5, height: Math.max(...bs.map((b) => b[3])) - y + 4, fill: 'black' }, mask);
        }
      }
    }
    function drawSummary() {
      G.summary.replaceChildren(); G['summary-hits'].replaceChildren();
      aggregateLinks = [];
      if (!neb.ready || !nebOn || detail.aggregates < 0.15 || linkMode === 'none' || selected) return;
      const records = [
        ...edges.map((e) => ({ from: e.par.s.id, to: e.ch.s.id, kind: 'history', primary: e.primary, status: e.rel.status, info: { edge: e } })),
        ...cmps.map((c) => ({ from: c.a.s.id, to: c.b.s.id, kind: 'comparison', info: { cmp: c } })),
        ...contextEdges.map((c) => ({ from: c.a.s.id, to: c.b.s.id, kind: 'context', status: c.status, info: { context: c } })),
      ].filter((r) => !nodeById.get(r.from).g.classList.contains('out') && !nodeById.get(r.to).g.classList.contains('out'));
      const seaKeys = new Map(store.nebulae.map((s, i) => [s.id, `neb:${i}`]));
      const groups = aggregateMapLinks(records, (id) => seaKeys.get(nodeById.get(id).s.nebula), { mode: linkMode, verifiedOnly });
      const named = groups.filter((g) => regionNames.has(g.a) && regionNames.has(g.b));
      const baseline = named.filter((g) => verifiedOnly || g.records.length >= 2).slice(0, linkMode === 'all' ? 10 : 6);
      const incident = (g) => g.a === regionHover || g.b === regionHover;
      // Базовые маршруты сохраняются при наведении, чтобы карта не менялась под указателем.
      aggregateLinks = [...baseline, ...(regionHover ? named.filter((g) => incident(g) && !baseline.includes(g)).slice(0, 4) : [])];
      const boxes = [...summaryMask.querySelectorAll('rect[fill="black"]')].map((r) => [+r.getAttribute('x'), +r.getAttribute('y'), +r.getAttribute('x') + +r.getAttribute('width'), +r.getAttribute('y') + +r.getAttribute('height')]);
      const shores = new Map();
      const shore = (key) => { if (!shores.has(key)) shores.set(key, nebulaShore(key, nameCam().toScreen)); return shores.get(key); };
      for (const [i, g] of aggregateLinks.entries()) {
        const a = regionNames.get(g.a), b = regionNames.get(g.b);
        const route = summaryCurve({ ...a, ports: shore(g.a) }, { ...b, ports: shore(g.b) }, boxes, [6, rot ? 6 : AXIS_H + 6, pw - (rot ? AXIS_H + 6 : 6), ph - 6]);
        if (!route) continue;
        const { d } = route;
        const width = Math.min(2.6, 0.85 + Math.log2(g.records.length + 1) * 0.4);
        el('path', { class: 'summary-case', d, 'stroke-width': width + 2.4, opacity: detail.aggregates * 0.85 }, G.summary);
        el('path', { class: 'summary-line', d, 'stroke-width': width, opacity: detail.aggregates * (regionHover ? incident(g) ? 0.82 : 0.34 : 0.5) }, G.summary);
        for (const p of route.ports) el('circle', { class: 'summary-port', cx: p.x, cy: p.y, r: 2.4, opacity: detail.aggregates * (regionHover && incident(g) ? 0.9 : 0.65) }, G.summary);
        const count = `${g.records.length} ${plural(g.records.length, 'связь карточек', 'связи карточек', 'связей карточек')}`;
        const h = el('path', { class: 'summary-hit', d, 'data-summary': i, 'data-key': `${g.a}/${g.b}`, role: 'button', tabindex: 0, 'aria-label': `${a.name} и ${b.name}: ${count}. Открыть список` }, G['summary-hits']);
        el('title', {}, h).textContent = `${count} · ${a.name} / ${b.name}`;
      }
    }

    function focusRegion(key) {
      const r = nebulaRegion(key);
      if (!r) return;
      directory.hidden = true; q('[data-browse]').setAttribute('aria-expanded', 'false');
      hideTip(); hideEdgeInfo(); regionHover = null;
      if (selected) clearSelection();
      const members = r.members.map((i) => nodes[i]);
      const xs = members.map((n) => sc.x(n.s.start)), ys = members.map(yRef);
      const anchor = Math.max(kOv(), k0 * 2.2);
      fitBox(Math.min(...xs) - 90, Math.max(...xs) + 240, Math.min(...ys) - 55, Math.max(...ys) + 55,
        { kMin: anchor * (r.kind === 'neb' ? 0.83 : 1.7), kMax: r.kind === 'neb' ? anchor * 1.7 : 1.15 });
    }

    function showSummaryInfo(group, px, py) {
      if (!group) return;
      summaryRecords = group.records;
      mount(edgePop, html`<p class="ep-head">${nebulaRegion(group.a)?.name} · ${nebulaRegion(group.b)?.name}</p>
        <p class="ep-kind">${group.records.length} ${plural(group.records.length, 'связь карточек', 'связи карточек', 'связей карточек')}</p>
        <p class="ep-note">Это сводка связей отдельных эстетик. Моря — области навигации, а не исторические предки. Откройте связь, чтобы увидеть её тип и источник.</p>
        <div class="summary-records">${group.records.map((r, i) => html`<button type="button" data-summary-record="${i}">${store.get(r.from).name} ${r.kind === 'comparison' ? '↔' : '→'} ${store.get(r.to).name}<small>${r.kind === 'history' ? RELATION[r.info.edge.type].label : r.kind === 'comparison' ? 'Визуальное сходство' : 'Контекст'} · ${r.kind === 'comparison' ? 'редакционное сопоставление' : REL_STATUS[r.status]}</small></button>`)}</div>`);
      placeEdgeInfo(px, py);
    }

    // Подпись — справа от точки на своей строке. У правого края экрана — слева, чтобы не обрезалась.
    // Прямоугольник подписи — от базовой линии шрифта: с надстрочными и подстрочными элементами.
    function spotOf(n, m, w, fh, forced = false) {
      const { x, y, r } = n;
      if (rot) {
        const p = toP(x, y), gap = r + 7;
        const right = pw - AXIS_H - 8 - p.x - gap, left = p.x - gap - 8;
        const side = right >= w || right >= left ? 'start' : 'end', room = Math.max(0, side === 'start' ? right : left);
        const font = n.s.id === selected ? FONT[n.s.tier].replace(/^\d+/, '700') : FONT[n.s.tier];
        const name = fitLabelText(n.s.name, room, (s) => labelMeasure(font, s));
        const dates = fitLabelText(n.fullDates, room, (s) => labelMeasure(DATE_FONT, s));
        const width = Math.max(name.width, m === 'z2' ? dates.width : 0);
        const tx = side === 'start' ? p.x + gap : p.x - gap, base = p.y + (m === 'z2' ? -1 : fh * 0.36);
        const pb = [side === 'start' ? tx - 2 : tx - width - 2, side === 'start' ? tx + width + 2 : tx + 2,
          base - n.ascent - 2, m === 'z2' ? base + 15 + n.dateDescent + 2 : base + n.descent + 2];
        return { anchor: side, tx, base, name: name.text, dates: dates.text, renderBox: pb, box: [pb[2], pb[3], pw - pb[1], pw - pb[0]] };
      }
      const view = viewRect();
      let name = n.s.name, dates = n.fullDates;
      if (forced) {
        const font = n.s.id === selected ? FONT[n.s.tier].replace(/^\d+/, '700') : FONT[n.s.tier];
        w = Math.max(labelMeasure(font, name), m === 'z2' ? n.wd : 0);
        const room = Math.max(0, view.x1 - 10 - (x + r + 7), x - r - 7 - view.x0 - 10);
        if (w > room) {
          const clippedName = fitLabelText(name, room, (text) => labelMeasure(font, text));
          const clippedDates = fitLabelText(dates, room, (text) => labelMeasure(DATE_FONT, text));
          name = clippedName.text; dates = clippedDates.text;
          w = Math.max(clippedName.width, m === 'z2' ? clippedDates.width : 0);
        }
      }
      const base = y + (m === 'z2' ? -1 : fh * 0.36);
      const place = (anchor, tx) => {
        const a = anchor === 'end' ? tx - w - 2 : tx - 2, b = anchor === 'end' ? tx + 2 : tx + w + 2;
        return { anchor, tx, base, name, dates, box: [a, b, base - n.ascent - 2, m === 'z2' ? base + 15 + n.dateDescent + 2 : base + n.descent + 2] };
      };
      const right = place('start', x + r + 7);
      if (right.box[1] > view.x1 - 6) { const left = place('end', x - r - 7); if (left.box[0] > view.x0 + 4) return left; }
      return right;
    }

    function prio(n) {
      // Внутри уровня важнее стиль, из которого выросло больше: как крупный город на карте.
      let p = (4 - n.s.tier) * 1000 + n.wt * 10 - n.s.start / 100000;
      if (n.s.id === selected || n.s.id === hovered) p += 1e6;
      if (n.g.classList.contains('is-related') || n.g.classList.contains('on-line')) p += 5e5;
      else if (n.g.classList.contains('lit') || n.g.classList.contains('near')) p += 2e5;
      if (n.landmark) p += 3e5;
      if (n.g.classList.contains('out')) p -= 5e5;
      return p;
    }

    function drawAxis() {
      axis.bg.setAttribute('width', vw);
      axis.line.setAttribute('x2', vw);
      const left = 4, right = vw - panelWidth() - 4, candidates = new Map();
      const add = (year, priority) => {
        const x = X(year);
        if (x < 0 || x > right || candidates.has(year)) return;
        candidates.set(year, { year, x, priority });
      };
      // Концы истории — ориентиры; остальные годы заполняют свободное место.
      // Подпись может выходить за свой сегмент, но никогда за экран или на соседа.
      add(sc.segments[0].start, 0); add(store.now, 0);
      for (const seg of sc.segments) {
        add(seg.start, 1);
        for (const year of segmentTicks(seg, t.k, 90)) if (lens.zone(sc.x(year)) === 'C') add(year, 2);
      }
      add(Math.min(store.now, Math.round(sc.invert(((left + right) / 2 - t.tx) / t.k))), 3);
      const occupied = [];
      for (const c of [...candidates.values()].sort((a, b) => a.priority - b.priority || a.x - b.x)) {
        const font = `${c.priority < 2 ? 500 : 400} 11px "Golos Text"`;
        c.text = fmtYear(c.year);
        c.width = labelMeasure(font, c.text);
        if (c.width > right - left && c.year < 0) {
          c.text = `−${fmtYear(-c.year)}`;
          c.width = labelMeasure(font, c.text);
        }
        c.tx = clamp(c.x + 6, left, right - c.width);
        c.show = c.width <= right - left && !occupied.some(([a, b]) => c.tx < b + 12 && a < c.tx + c.width + 12);
        if (c.show) occupied.push([c.tx, c.tx + c.width]);
      }
      let ti = 0;
      for (const c of [...candidates.values()].sort((a, b) => a.x - b.x)) {
        let tk = axis.pool[ti];
        if (!tk) { tk = { line: el('line', { class: 'tick', y1: AXIS_H - 5, y2: AXIS_H }, axis.ticks), text: el('text', { y: 20 }, axis.ticks) }; axis.pool.push(tk); }
        for (const key of ['x1', 'x2']) tk.line.setAttribute(key, c.x);
        tk.line.dataset.year = c.year; tk.line.style.display = '';
        tk.text.setAttribute('x', c.tx); tk.text.setAttribute('class', c.priority < 2 ? 'axis-start' : 'tick-label');
        tk.text.setAttribute('aria-label', fmtYear(c.year));
        tk.text.textContent = c.text; tk.text.style.display = c.show ? '' : 'none';
        ti++;
      }
      for (; ti < axis.pool.length; ti++) { axis.pool[ti].line.style.display = 'none'; axis.pool[ti].text.style.display = 'none'; }
    }

    // Геометрия ветви древа: по строке предка (если потомок появился после его конца) → поворот →
    // вертикаль в коридоре jx → поворот → по строке потомка к его точке. Повороты скруглены одинаково.
    function branchPath(e) {
      const p = e.par, c = e.ch;
      const xc = X(c.s.start) - c.r - 1, yc = c.y, yp = p.y;
      const xps = X(p.s.start), xpe = X(p.s.end ?? store.now);
      if (Math.abs(yc - yp) < 0.5) { e.trunkTo = Math.min(xpe, xc); return `M${Math.min(xpe, xc).toFixed(1)},${yp.toFixed(1)}H${xc.toFixed(1)}`; }
      let jx = e.jx != null ? XR(e.jx) : xc - 10;
      jx = clamp(jx, xps, xc - 2);
      const dir = yc > yp ? 1 : -1;
      const rad = Math.max(0, Math.min(8, Math.abs(yc - yp) / 2, xc - jx));
      let d;
      if (jx > xpe + 1) {
        const r1 = Math.min(rad, jx - xpe);
        d = `M${xpe.toFixed(1)},${yp.toFixed(1)}H${(jx - r1).toFixed(1)}Q${jx.toFixed(1)},${yp.toFixed(1)} ${jx.toFixed(1)},${(yp + dir * r1).toFixed(1)}`;
      } else if (jx - xps < p.r + 1) {
        jx = xps;
        d = `M${xps.toFixed(1)},${(yp + dir * (p.r + 1)).toFixed(1)}`;
      } else if (p.lbox && jx > p.lbox[0] && jx < p.lbox[1] && ((dir > 0 ? p.lbox[3] : p.lbox[2]) - yp) * dir > 0) {
        // Ветвь выходит из-под подписи предка: начинаем у края подписи, а не сквозь текст.
        d = `M${jx.toFixed(1)},${(dir > 0 ? p.lbox[3] : p.lbox[2]).toFixed(1)}`;
      } else d = `M${jx.toFixed(1)},${yp.toFixed(1)}`;
      d += `V${(yc - dir * rad).toFixed(1)}Q${jx.toFixed(1)},${yc.toFixed(1)} ${(jx + rad).toFixed(1)},${yc.toFixed(1)}H${xc.toFixed(1)}`;
      e.trunkTo = Math.min(jx, xpe);
      return d;
    }
    // Оборванная далёкая связь: короткий отросток с кружком на входе в потомка и отросток у предка.
    function stubPath(e) {
      const p = e.par, c = e.ch;
      const xc = X(c.s.start) - c.r - 1, yc = c.y;
      const xpe = X(p.s.end ?? store.now), yp = p.y;
      const L = 22, o = 2.4;
      return `M${(xc - L - o).toFixed(1)},${yc.toFixed(1)}a${o},${o} 0 1,0 ${2 * o},0a${o},${o} 0 1,0 ${-2 * o},0M${(xc - L + o).toFixed(1)},${yc.toFixed(1)}H${xc.toFixed(1)}`;
    }
    // Стволы: от точки зарождения до места, где от строки отходит последняя ветвь (не дальше конца
    // жизни стиля — дальше ветвь идёт своим штрихом). Если есть далёкие потомки — стрелка «→».
    function drawTrunks() {
      for (const n of nodes) {
        if (n.g.style.display === 'none') { n.life.setAttribute('d', ''); n.outX = null; continue; }
        let end = -Infinity, far = false;
        for (const e of n.kidEdges) {
          if (!e.drawn) continue;
          if (e.stub) far = true; else if (e.trunkTo != null) end = Math.max(end, e.trunkTo);
        }
        const x0 = n.x + n.r + 1;
        let d = end > x0 + 2 ? `M${x0.toFixed(1)},${n.y.toFixed(1)}H${end.toFixed(1)}` : '';
        n.outX = null;
        if (far) {
          const labelEnd = n.lpos === 'r' ? n.lbox[1] : n.x + n.r + 2;
          const ox = Math.max(end, labelEnd) + 4;
          n.outX = ox;
          d += `M${ox.toFixed(1)},${n.y.toFixed(1)}h16l-3,-3m3,3l-3,3`;
        }
        n.life.setAttribute('d', d);
      }
    }
    function drawStubLabels() {
      const show = mode === 'z2' && !svg.classList.contains('has-selection');
      const occ = grid();
      for (const n of nodes) if (n.lbox) occ.add([...n.lbox, n.s.id]);
      for (const e of edges) {
        if (!e.stubText) continue;
        const on = show && e.stub && e.drawn && e.ch.g.style.display !== 'none' && e.ch.zone === 'C';
        let vis = false;
        if (on) {
          const x1 = X(e.ch.s.start) - e.ch.r - 30, w = e.stubText.getComputedTextLength?.() || 80;
          const xe = x1 + 22;
          const box = [xe - w - 2, xe + 2, e.ch.y - 18, e.ch.y - 4];
          if (!occ.hit(box)) { occ.add(box); vis = true; e.stubText.setAttribute('x', xe.toFixed(1)); e.stubText.setAttribute('y', (e.ch.y - 7).toFixed(1)); }
        }
        e.stubText.style.display = vis ? '' : 'none';
      }
      for (const n of nodes) {
        if (!n.outText) continue;
        const xpe = X(n.s.end ?? store.now);
        let vis = false;
        if (show && n.outX != null && n.zone === 'C') {
          const x0 = n.outX + 20, w = n.outText.getComputedTextLength?.() || 120;
          const box = [x0 - 2, x0 + w + 2, n.y - 8, n.y + 6];
          if (!occ.hit(box)) { occ.add(box); vis = true; n.outText.setAttribute('x', x0.toFixed(1)); n.outText.setAttribute('y', (n.y + 4).toFixed(1)); }
        }
        n.outText.style.display = vis ? '' : 'none';
      }
    }
    function arcPath(e) {
      const p = e.par, c = e.ch;
      const xc = X(c.s.start) - c.r - 1, yc = c.y, yp = p.y;
      const xps = X(p.s.start), xpe = X(p.s.end ?? store.now);
      const sx = clamp(Math.min(xc - 24, xpe), xps, xc - 12);
      const k1 = Math.max(16, (xc - sx) * 0.5);
      return `M${sx.toFixed(1)},${yp.toFixed(1)}C${(sx + k1).toFixed(1)},${yp.toFixed(1)} ${(xc - k1).toFixed(1)},${yc.toFixed(1)} ${xc.toFixed(1)},${yc.toFixed(1)}`;
    }

    // Маршрут: трек по связям между пройденными стилями (по ветви или дуге; без связи — пунктир напрямую).
    function drawTrail() {
      G.trail.style.opacity = selected ? 1 : detail.edges;
      if (linkMode === 'none' || (!selected && detail.edges === 0)) { trailPath.setAttribute('d', ''); return; }
      let d = '';
      for (let i = 1; i < trail.length; i++) {
        const a = nodeById.get(trail[i - 1]), b = nodeById.get(trail[i]);
        if (!a || !b) continue;
        const e = edges.find((x) => (x.par === a && x.ch === b) || (x.par === b && x.ch === a));
        d += e ? (e.primary ? branchPath(e) : arcPath(e)) : `M${a.x.toFixed(1)},${a.y.toFixed(1)}L${b.x.toFixed(1)},${b.y.toFixed(1)}`;
      }
      trailPath.setAttribute('d', d);
    }
    function renderTrail() {
      trailNav.hidden = trail.length < 2;
      if (trailNav.hidden) return;
      mount(trailNav, html`<ol>${trail.map((id, i) => html`<li><button type="button" class="${i === trail.length - 1 ? 'is-last' : ''}" data-select="${id}">${store.get(id).name}</button></li>`)}</ol><button type="button" class="mt-clear" data-trail-clear aria-label="Сбросить маршрут">×</button>`);
    }

    function drawEdges() {
      const showAll = linkMode === 'all';
      for (const e of edges) {
        const p = e.par, c = e.ch;
        const lit = e.g.classList.contains('hl');
        const near = !!hovered && (p.s.id === hovered || c.s.id === hovered);
        e.g.classList.toggle('near', near);
        const out = e.g.classList.contains('out');
        const alpha = lit || near ? 1 : detail.edges;
        e.g.style.opacity = alpha;
        e.hit.style.pointerEvents = alpha < 0.15 ? 'none' : '';
        const want = alpha > 0 && (lit || near || (p.zone === 'C' && c.zone === 'C')) && historicalLinkVisible({ mode: linkMode, primary: e.primary, highlighted: lit || near, verifiedOnly, status: e.rel.status, filtered: out && !lit });
        const xa = Math.min(X(p.s.start), X(c.s.start)), xb = Math.max(X(p.s.start), X(c.s.start));
        const offscreen = xb < -60 || xa > vw + 60 || Math.max(p.y, c.y) < AXIS_H - 40 || Math.min(p.y, c.y) > vh + 40;
        if (!want || offscreen) {
          if (e.drawn) { e.path.setAttribute('d', ''); e.casing.setAttribute('d', ''); e.hit.setAttribute('d', ''); e.drawn = false; }
          continue;
        }
        e.stub = e.long && !lit && !near && !showAll;
        e.g.classList.toggle('stub', e.stub);
        const d = e.stub ? stubPath(e) : e.primary ? branchPath(e) : arcPath(e);
        e.path.setAttribute('d', d); e.casing.setAttribute('d', d); e.hit.setAttribute('d', d);
        e.drawn = true;
      }
      drawTrunks();
      drawStubLabels();
      for (const c of [...cmps, ...contextEdges]) {
        const near = !!hovered && (c.a.s.id === hovered || c.b.s.id === hovered);
        const sel = !!selected && (c.a.s.id === selected || c.b.s.id === selected);
        const alpha = sel || near ? 1 : detail.edges;
        c.path.style.opacity = alpha; c.hit.style.pointerEvents = alpha < 0.15 ? 'none' : '';
        const offA = c.a.g.style.display === 'none', offB = c.b.g.style.display === 'none';
        c.path.classList.toggle('near', near || sel);
        const enabled = linkMode === 'all';
        const hidden = alpha === 0 || linkMode === 'none' || (!(sel || near) && (c.a.zone !== 'C' || c.b.zone !== 'C')) || (c.context && verifiedOnly && c.status !== 'verified');
        if (hidden || !(enabled || near || sel) || (offA && offB && !sel)) { c.path.setAttribute('d', ''); c.hit.setAttribute('d', ''); continue; }
        const [l, r] = c.a.x <= c.b.x ? [c.a, c.b] : [c.b, c.a];
        const mx = (l.x + r.x) / 2, lift = Math.min(70, Math.abs(r.x - l.x) * 0.15 + 14);
        const d = `M${l.x.toFixed(1)},${l.y.toFixed(1)}Q${mx.toFixed(1)},${(Math.min(l.y, r.y) - lift).toFixed(1)} ${r.x.toFixed(1)},${r.y.toFixed(1)}`;
        c.path.setAttribute('d', d); c.hit.setAttribute('d', d);
      }
    }

    // Крупный план: подписи типов связей словами и годы выбранного стиля.
    // Длительность — только у выбранного и наведённого стиля: полоса цвета эпохи от начала до конца.
    function durPath(n) {
      const x0 = X(n.s.start), x1 = X(n.s.end ?? store.now);
      return x1 > x0 + 2 ? `M${x0.toFixed(1)},${n.y.toFixed(1)}H${x1.toFixed(1)}` : '';
    }
    function drawSelection() {
      const n = selected && nodeById.get(selected);
      const h = hovered && hovered !== selected && nodeById.get(hovered);
      axis.durSel.setAttribute('d', detail.level === 'styles' && n && n.g.style.display !== 'none' ? durPath(n) : '');
      if (n) axis.durSel.setAttribute('stroke', `var(--era-${n.s.era})`);
      axis.durHover.setAttribute('d', detail.level === 'styles' && h && h.g.style.display !== 'none' ? durPath(h) : '');
      if (h) axis.durHover.setAttribute('stroke', `var(--era-${h.s.era})`);
      const showYears = detail.level === 'styles' && !!n && n.g.style.display !== 'none';
      axis.selStart.style.display = showYears ? '' : 'none';
      axis.selEnd.style.display = showYears && n.s.end != null ? '' : 'none';
      if (showYears) {
        axis.selStart.textContent = fmtYear(n.s.start);
        axis.selStart.setAttribute('x', n.x.toFixed(1)); axis.selStart.setAttribute('y', (n.y + n.r + 14).toFixed(1));
        if (n.s.end != null) {
          axis.selEnd.textContent = fmtYear(n.s.end);
          axis.selEnd.setAttribute('x', X(n.s.end).toFixed(1)); axis.selEnd.setAttribute('y', (n.y + 17).toFixed(1));
        }
      }
      const labels = [];
      if (detail.level === 'styles' && selected && focusMode === 'near') {
        for (const e of edges) if (e.g.classList.contains('hl') && e.drawn) labels.push({ text: `${RELATION[e.type].label}${e.rel.status === 'verified' ? ' ✓' : ''}`, path: e.path });
        for (const c of cmps) if (c.path.classList.contains('near') && c.path.getAttribute('d')) labels.push({ text: 'сходство', path: c.path });
        for (const c of contextEdges) if (c.path.classList.contains('near') && c.path.getAttribute('d')) labels.push({ text: CONTEXT[c.type]?.label ?? 'контекст', path: c.path });
      }
      const pool = G.elabels;
      while (pool.children.length < labels.length) el('text', { class: 'elabel' }, pool);
      [...pool.children].forEach((tEl, i) => {
        const L = labels[i];
        if (!L) { tEl.style.display = 'none'; return; }
        const len = L.path.getTotalLength();
        const pt = L.path.getPointAtLength(len * 0.5);
        const vr = viewRect();
        if (pt.x < vr.x0 + 30 || pt.x > vr.x1 - 30 || pt.y < vr.y0 + 8 || pt.y > vr.y1 - 8) { tEl.style.display = 'none'; return; }
        tEl.style.display = '';
        tEl.textContent = L.text;
        tEl.setAttribute('x', pt.x.toFixed(1)); tEl.setAttribute('y', (pt.y + 4).toFixed(1));
      });
    }

    // Метки связей за краем экрана: дальние концы длинных связей не теряются.
    function drawOffscreen() {
      if (linkMode === 'none' || !selected || focusMode !== 'near' || isNarrow()) { if (chips.childElementCount) chips.replaceChildren(); return; }
      const s = store.get(selected);
      const sel = nodeById.get(selected);
      const rect = viewRect();
      const inset = 10;
      const rels = [
        ...s.parents.map((r) => ({ id: r.id, word: RELATION[r.type].from })),
        ...s.children.map((r) => ({ id: r.id, word: RELATION[r.type].to })),
        ...s.comparisons.map((r) => ({ id: r.id, word: 'похож на' })),
        ...(s.contexts ?? []).filter((r) => !verifiedOnly || r.status === 'verified').map((r) => ({ id: r.id, word: CONTEXT[r.type]?.[r.direction] ?? CONTEXT[r.type]?.label })),
      ];
      const items = [];
      for (const r of rels) {
        const o = nodeById.get(r.id);
        if (!o) continue;
        if (o.zone === 'C' && o.x > rect.x0 + 4 && o.x < rect.x1 - 4 && o.y > rect.y0 + 4 && o.y < rect.y1 - 4) continue;
        // Точка выхода луча «выбранный → родственник» на рамке видимой области.
        const cx = clamp(sel.x, rect.x0 + 40, rect.x1 - 40), cy = clamp(sel.y, rect.y0 + 30, rect.y1 - 30);
        const dx = o.x - cx, dy = o.y - cy;
        const tx = dx > 0 ? (rect.x1 - inset - cx) / dx : dx < 0 ? (rect.x0 + inset - cx) / dx : Infinity;
        const ty = dy > 0 ? (rect.y1 - inset - cy) / dy : dy < 0 ? (rect.y0 + inset - cy) / dy : Infinity;
        const tt = Math.min(tx, ty);
        const ang = Math.atan2(dy, dx);
        const arrow = ['→', '↘', '↓', '↙', '←', '↖', '↑', '↗'][((Math.round(ang / (Math.PI / 4)) % 8) + 8) % 8];
        items.push({ o, word: r.word, arrow, x: cx + dx * tt, y: clamp(cy + dy * tt, rect.y0 + 22, rect.y1 - 22), left: dx < 0 });
      }
      // Метка не закрывает подписи и точки на экране, другие метки и миникарту: ищем ближайшее
      // свободное место по вертикали у того же края.
      const mmTop = mmBox.offsetTop - 22, mmRight = mmBox.offsetLeft + mmBox.offsetWidth + 8;
      const busy = [];
      for (const n of nodes) {
        if (n.g.style.display === 'none') continue;
        if (n.lbox) busy.push(n.lbox);
        if (n.s.id === selected || n.g.classList.contains('lit')) busy.push([n.x - n.r - 3, n.x + n.r + 3, n.y - n.r - 3, n.y + n.r + 3]);
      }
      const hit = (b) => busy.some((o) => b[0] < o[1] && o[0] < b[1] && b[2] < o[3] && o[2] < b[3]);
      items.sort((a, b) => a.y - b.y);
      for (const it of items) {
        const w = Math.min(230, 48 + Math.max(it.word.length * 6.2, it.o.s.name.length * 8));
        const [x0, x1] = it.left ? [it.x, it.x + w] : [it.x - w, it.x];
        const lo = rect.y0 + 22, hi = x0 < mmRight ? Math.min(rect.y1 - 22, mmTop) : rect.y1 - 22;
        const box = (y) => [x0 - 4, x1 + 4, y - 22, y + 22];
        let best = clamp(it.y, lo, hi);
        for (let d = 0; d <= 240; d += 6) {
          const c = [best + d, best - d].find((y) => y >= lo && y <= hi && !hit(box(y)));
          if (c != null) { best = c; break; }
        }
        it.y = best;
        busy.push(box(best));
      }
      chips.replaceChildren(...items.map((it) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'oc-chip';
        b.dataset.select = it.o.s.id;
        b.innerHTML = String(html`<span class="oc-arrow" data-arrow="${it.arrow}" aria-hidden="true"></span><span class="oc-text"><span class="oc-rel">${it.word}</span> <span class="oc-name">${it.o.s.name}</span></span>`);
        b.setAttribute('aria-label', `${it.word} ${it.o.s.name} — за краем экрана, перейти`);
        b.style.transform = `translate(${it.x.toFixed(0)}px, ${it.y.toFixed(0)}px) translate(${it.left ? '0' : '-100%'}, -50%)`;
        return b;
      }));
    }

    // Кнопка возврата к полной истории и перехода к просторному обзору.
    const atFit = () => Math.abs(t.k - k0) < k0 * 0.03;
    const fitBtn = q('[data-zoom="fit"]');
    function updateFitButton() {
      const fitLabel = atFit() ? 'Части' : 'Вся история';
      if (fitBtn.textContent !== fitLabel) fitBtn.textContent = fitLabel;
    }

    // ---------- миникарта: вся карта в координатах раскладки, рамка — видимая область ----------
    let mmW = 0, mmH = 0;
    function drawMinimap() {
      const dpr = window.devicePixelRatio || 1;
      // Миникарта — отдельное окошко в углу полотна, как в играх. Свёрнута — не рисуется.
      if (mmBox.classList.contains('collapsed') || mmBox.classList.contains('is-quiet')) { mmW = 0; return; }
      mmW = mm.clientWidth || 240; mmH = mm.clientHeight || 100;
      mmCanvas.width = mmW * dpr; mmCanvas.height = mmH * dpr;
      mmCanvas.style.width = `${mmW}px`; mmCanvas.style.height = `${mmH}px`;
      const c = mmCanvas.getContext('2d');
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, mmW, mmH);
      const cs = getComputedStyle(svg);
      const mx = (xr) => (xr / sc.total) * mmW, my = (yr) => (yr / contentRefH) * mmH;
      // Очертания древа: главные ветви тонкими линиями — по ним видно, где «материки» карты.
      c.globalAlpha = 0.28; c.strokeStyle = cs.getPropertyValue('--ink-2').trim() || '#666'; c.lineWidth = 0.8;
      c.beginPath();
      for (const e of edges) {
        if (linkMode === 'none' || !e.primary || e.long || (verifiedOnly && e.rel.status !== 'verified')) continue;
        const px = mx(sc.x(e.par.s.start)), py = my(yRef(e.par)), cx = mx(sc.x(e.ch.s.start)), cy = my(yRef(e.ch));
        c.moveTo(px, py); c.lineTo(Math.max(px, cx - 2), py); c.lineTo(Math.max(px, cx - 2), cy); c.lineTo(cx, cy);
      }
      c.stroke();
      for (const n of nodes) {
        const out = n.g.classList.contains('out');
        c.globalAlpha = out ? 0.2 : 0.9;
        c.fillStyle = store.nebula(n.s.id)?.color ?? (cs.getPropertyValue('--ink-3').trim() || '#555');
        const r = n.s.tier === 1 ? 1.7 : 1.15;
        c.beginPath(); c.arc(mx(sc.x(n.s.start)), my(yRef(n)), r, 0, Math.PI * 2); c.fill();
      }
      c.globalAlpha = 1;
    }
    function drawMinimapFrame() {
      if (!mmW) return;
      const sy = syOf(t.k);
      const xr0 = (0 - t.tx) / t.k, xr1 = (vw - panelWidth() - t.tx) / t.k;
      const yr0 = (0 - t.ty) / sy, yr1 = (vh - AXIS_H - sheetHeight() - t.ty) / sy;
      const fx0 = clamp((xr0 / sc.total) * mmW, 0, mmW), fx1 = clamp((xr1 / sc.total) * mmW, 0, mmW);
      const fy0 = clamp((yr0 / contentRefH) * mmH, 0, mmH), fy1 = clamp((yr1 / contentRefH) * mmH, 0, mmH);
      mmFrame.style.transform = `translate(${fx0.toFixed(1)}px, ${fy0.toFixed(1)}px)`;
      mmFrame.style.width = `${Math.max(6, fx1 - fx0).toFixed(1)}px`;
      mmFrame.style.height = `${Math.max(6, fy1 - fy0).toFixed(1)}px`;
    }
    function minimapGo(e) {
      stopAnimation();
      dismissHint();
      const r = mmCanvas.getBoundingClientRect();
      const xr = clamp((e.clientX - r.left) / r.width, 0, 1) * sc.total;
      const yr = clamp((e.clientY - r.top) / r.height, 0, 1) * contentRefH;
      const sy = syOf(t.k);
      t.tx = (vw - panelWidth()) / 2 - xr * t.k;
      t.ty = (vh - AXIS_H - sheetHeight()) / 2 - yr * sy;
      clampT(); schedule();
    }

    // ---------- трансформация ----------
    function clampT() {
      const sy = syOf(t.k);
      const w = sc.total * t.k + LABEL_PAD + panelWidth();
      const minTx = Math.min(40, vw - w - 40), maxTx = Math.max(40, vw - w - 40);
      t.tx = clamp(t.tx, minTx, maxTx);
      const h = contentRefH * sy;
      const avail = vh - AXIS_H - sheetHeight();
      t.ty = h <= avail ? clamp(t.ty, 0, avail - h) : clamp(t.ty, avail - h, 0);
    }
    function zoomTransformAt(px, py, k) {
      const k2 = clamp(k, Math.min(k0 * 0.9, t.k), MAX_K);
      const s1 = syOf(t.k), s2 = syOf(k2);
      const tx = px - ((px - t.tx) * k2) / t.k;
      const yy = py - AXIS_H;
      const ty = yy - ((yy - t.ty) * s2) / s1;
      return { k: k2, tx, ty };
    }
    function zoomAt(px, py, factor, animate = false) {
      stopAnimation(); clearTimeout(flightTimer);
      const next = zoomTransformAt(px, py, t.k * factor);
      if (animate) { animateTo(next.k, next.tx, next.ty, 500); return; }
      Object.assign(t, next);
      clampT(); schedule();
    }
    let anim = 0, flightTimer = 0, wheelTarget = null;
    function stopAnimation() {
      cancelAnimationFrame(anim);
      anim = 0; wheelTarget = null;
    }
    // Колесо задаёт цель, а камера догоняет её по кадрам. На каждом кадре заново
    // держим точку под курсором: вертикальный масштаб карты меняется нелинейно.
    function wheelZoomAt(px, py, delta) {
      const previous = wheelTarget;
      const base = previous && Math.sign(Math.log(previous.k / t.k)) === Math.sign(delta) ? previous.k : t.k;
      const k = clamp(base * Math.exp(delta), Math.min(k0 * 0.9, t.k), MAX_K);
      if (reduceMotion()) { zoomAt(px, py, k / t.k); return; }
      if (!previous) stopAnimation();
      wheelTarget = { k, px, py };
      if (previous) return;
      let last = performance.now();
      const step = (now) => {
        const { k, px, py } = wheelTarget;
        const gap = Math.log(k / t.k);
        const done = Math.abs(gap) < 0.001;
        const nextK = done ? k : t.k * Math.exp(gap * (1 - Math.exp(-(now - last) / 70)));
        last = now;
        Object.assign(t, zoomTransformAt(px, py, nextK));
        clampT(); draw();
        if (done) { anim = 0; wheelTarget = null; }
        else anim = requestAnimationFrame(step);
      };
      anim = requestAnimationFrame(step);
    }
    function animateTo(k, tx, ty, ms = 650) {
      stopAnimation();
      if (reduceMotion() || ms === 0) { Object.assign(t, { k, tx, ty }); clampT(); schedule(); return; }
      const from = { ...t };
      const t0 = performance.now();
      const step = (now) => {
        const p = Math.min(1, (now - t0) / ms);
        const e = 1 - Math.pow(1 - p, 3);
        t.k = Math.exp(Math.log(from.k) + (Math.log(k) - Math.log(from.k)) * e);
        t.tx = from.tx + (tx - from.tx) * e;
        t.ty = from.ty + (ty - from.ty) * e;
        clampT(); draw();
        if (p < 1) anim = requestAnimationFrame(step);
      };
      anim = requestAnimationFrame(step);
    }
    function computeFit() {
      const rect = viewRect();
      k0 = Math.max(24, rect.x1 - rect.x0 - 100) / sc.total;
      syFit = Math.max(24, rect.y1 - rect.y0 - 16) / contentRefH;
    }
    function fit(animate = true) {
      computeFit();
      animateTo(k0, 40, 0, animate ? 600 : 0);
    }
    // Просторный обзор — вид по умолчанию: начало истории слева, по вертикали — середина того,
    // что попало в кадр. Дальше по карте ведут перетаскивание, навигатор эпох и миникарта.
    function overview(animate = true) {
      computeFit();
      const k = Math.max(kOv(), k0 * 2.2) * 0.83, sy = syOf(k), rect = viewRect(), tx = 40;
      const xr1 = (rect.x1 - tx) / k;
      const ys = nodes.filter((n) => sc.x(n.s.start) <= xr1).map(yRef);
      const yc = ys.length ? ys.reduce((a, b) => a + b, 0) / ys.length : contentRefH / 2;
      animateTo(k, tx, (rect.y1 - rect.y0) / 2 - yc * sy, animate ? 600 : 0);
    }
    // Вписать прямоугольник раскладки [x0..x1] × [y0..y1] в видимую область.
    // fitY: false — не ужимать масштаб ради высоты (рабочий вид, вертикаль листается);
    // тогда по вертикали центрируется «центр тяжести» yFocus.
    // keep — стиль, который обязан остаться в видимой области (не под панелью и не за краем).
    function fitBox(x0, x1, y0, y1, { kMin = k0, kMax = 1.15, ms = 650, fitY = true, yFocus = null, keep = null } = {}) {
      const rect = viewRect();
      const gut = lensNow() ? 56 : 0;   // желоба по краям занимают место: рабочий вид начинается правее левого желоба
      const availW = Math.max(120, rect.x1 - rect.x0 - 80 - 2 * gut - (isNarrow() ? 60 : 160)), availH = rect.y1 - rect.y0 - 50;
      let k = clamp(availW / Math.max(1, x1 - x0), kMin, kMax);
      if (fitY) for (let i = 0; i < 6; i++) { if ((y1 - y0) * syOf(k) > availH && k > kMin) k = Math.max(kMin, k * 0.85); else break; }
      const sy = syOf(k);
      let tx = rect.x0 + 40 + gut + Math.max(0, availW - (x1 - x0) * k) / 2 - x0 * k;
      const yc = (y1 - y0) * sy <= availH || yFocus == null ? (y0 + y1) / 2 : yFocus;
      let ty = (rect.y1 - rect.y0) / 2 - yc * sy;
      if (keep) {
        const n = nodeById.get(keep);
        const nx = sc.x(n.s.start) * k + tx, ny = AXIS_H + ty + yRef(n) * sy;
        const right = rect.x1 - Math.min(220, (rect.x1 - rect.x0) * 0.35), left = rect.x0 + 30 + gut + (rot ? 44 : 0);   // на повёрнутой карте сверху лежит цепочка маршрута
        if (nx > right) tx -= nx - right; else if (nx < left) tx += left - nx;
        const top = rect.y0 + 40, bottom = rect.y1 - 50;
        if (ny > bottom) ty -= ny - bottom; else if (ny < top) ty += top - ny;
      }
      animateTo(k, tx, ty, ms);
    }
    function zoomToEra(i, ms = 650) {
      if (ms) dismissHint();
      const seg = sc.segments[i];
      const ys = nodes.filter((n) => n.s.start >= seg.start && n.s.start < seg.end).map(yRef);
      const y0 = ys.length ? Math.min(...ys) - ROW : 0, y1 = ys.length ? Math.max(...ys) + ROW : contentRefH;
      const yFocus = ys.length ? ys.reduce((a, b) => a + b, 0) / ys.length : contentRefH / 2;
      fitBox(seg.x0, seg.x1, y0, y1, { kMin: isNarrow() ? 0.5 : 0.72, kMax: MAX_K, ms, fitY: false, yFocus });
    }
    // Крупный план: выбранный стиль и ближайшие связи в рабочем масштабе. Если родственники далеко,
    // камера держит выбранный стиль читаемым, а дальние концы показывают метки на краю экрана.
    function focusCamera(id, ms = 650) {
      const s = store.get(id);
      const n = nodeById.get(id);
      const rel = [...s.parents, ...s.children, ...s.comparisons, ...(s.contexts ?? []).filter((r) => !verifiedOnly || r.status === 'verified')].map((r) => nodeById.get(r.id)).filter(Boolean);
      const rect = viewRect();
      const availW = Math.max(120, rect.x1 - rect.x0 - 80 - (lensNow() ? 112 : 0) - (isNarrow() ? 60 : 220));
      const kRead = isNarrow() ? 0.6 : 0.72;
      // Берём ближайших по времени родственников, пока они помещаются в рабочем масштабе;
      // остальные останутся метками на краю экрана.
      const x0 = sc.x(n.s.start);
      const keep = [n];
      let lo = x0, hi = x0;
      for (const o of [...rel].sort((a, b) => Math.abs(sc.x(a.s.start) - x0) - Math.abs(sc.x(b.s.start) - x0))) {
        const xo = sc.x(o.s.start);
        const nlo = Math.min(lo, xo), nhi = Math.max(hi, xo);
        if ((nhi - nlo) * kRead <= availW) { keep.push(o); lo = nlo; hi = nhi; }
      }
      // Если в рабочем масштабе не помещается ни один родственник, чуть отдаляемся ради ближайшего:
      // крупный план без единой связи на экране теряет смысл.
      let kMin = kRead;
      if (keep.length === 1 && rel.length && !isNarrow()) {
        const near = [...rel].sort((a, b) => Math.abs(sc.x(a.s.start) - x0) - Math.abs(sc.x(b.s.start) - x0))[0];
        const xo = sc.x(near.s.start), k2 = availW / Math.max(1, Math.abs(xo - x0));
        if (k2 >= 0.42) { keep.push(near); lo = Math.min(lo, xo); hi = Math.max(hi, xo); kMin = Math.min(kRead, k2); }
      }
      const ys = keep.map(yRef);
      fitBox(lo, hi, Math.min(...ys) - ROW, Math.max(...ys) + ROW, { kMin, kMax: 1.15, ms, keep: id, fitY: !isNarrow(), yFocus: yRef(n) });
    }
    // Полёт по связи: сначала камера охватывает оба конца (без приближения), затем садится на новый стиль.
    function flyTo(fromId, toId) {
      clearTimeout(flightTimer);
      const a = nodeById.get(fromId), b = nodeById.get(toId);
      if (!a || !b || reduceMotion()) { focusCamera(toId, 0); return; }
      const xa = sc.x(a.s.start), xb = sc.x(b.s.start), ys = [yRef(a), yRef(b)];
      fitBox(Math.min(xa, xb), Math.max(xa, xb), Math.min(...ys) - ROW, Math.max(...ys) + ROW, { kMin: k0, kMax: t.k, ms: 420, keep: toId });
      flightTimer = setTimeout(() => focusCamera(toId, 480), 440);
    }
    function fitLineage(id, animate = true) {
      const ns = [id, ...store.ancestors(id), ...store.descendants(id)].map((i) => nodeById.get(i)).filter(Boolean);
      const xs = ns.map((n) => sc.x(n.s.start)), ys = ns.map(yRef);
      const rect = viewRect();
      const span = Math.max(1, Math.max(...xs) - Math.min(...xs));
      const kMin = Math.min(k0, Math.max(0.02, (rect.x1 - rect.x0 - 240) / span));
      fitBox(Math.min(...xs), Math.max(...xs), Math.min(...ys) - ROW, Math.max(...ys) + ROW, { kMin, kMax: 1.1, ms: animate ? 750 : 0, keep: id });
    }
    function resize() {
      stopAnimation();
      pw = stage.clientWidth; ph = stage.clientHeight;
      rot = rotateOn && pw < 760;
      vw = rot ? ph : pw; vh = rot ? pw : ph;
      stage.classList.toggle('rot', rot);
      for (const el2 of [svg, nebCanvas]) {
        el2.style.width = rot ? `${vw}px` : ''; el2.style.height = rot ? `${vh}px` : '';
        el2.style.transform = rot ? `translate(${pw}px, 0) rotate(90deg)` : '';
      }
      svg.setAttribute('width', vw); svg.setAttribute('height', vh);
      svg.setAttribute('viewBox', `0 0 ${vw} ${vh}`);
      nebDpr = Math.min(2, window.devicePixelRatio || 1);
      nebCanvas.width = Math.round(vw * nebDpr); nebCanvas.height = Math.round(vh * nebDpr);
      if (sc) {
        const wasFit = Math.abs(t.k - k0) < 1e-6;
        computeFit();
        if (wasFit) t.k = k0;
        clampT(); drawMinimap(); schedule();
      }
    }
    const camera = () => ({ k: t.k, tx: t.tx, ty: t.ty });

    // ---------- наведение ----------
    function setHover(id) {
      if (hovered === id) return;
      hovered = id;
      const s = id ? store.get(id) : null;
      const near = s ? new Set([id, ...s.parents.map((p) => p.id), ...s.children.map((c) => c.id), ...s.comparisons.map((c) => c.id), ...(s.contexts ?? []).filter((r) => !verifiedOnly || r.status === 'verified').map((c) => c.id)]) : null;
      svg.classList.toggle('has-hover', !!id && !selected);
      for (const n of nodes) { const v = !!near && near.has(n.s.id); n.g.classList.toggle('near', v); n.text.classList.toggle('near', v); n.life.classList.toggle('near', v); n.plate.classList.toggle('near', v); }
      schedule();
    }

    // ---------- выбор: крупный план связей или полная родословная ----------
    function select(id, { animate = true, mode: m = 'near', nav = 'push' } = {}) {
      if (!selected) camBeforeFocus = camera();
      const prev = selected;
      selected = id;
      trail = pushStep(trail, id);
      focusMode = m;
      setHover(null);
      hideTip(); hideEdgeInfo();
      const s = store.get(id);
      const relIds = new Set([...s.parents.map((r) => r.id), ...s.children.map((r) => r.id), ...s.comparisons.map((r) => r.id), ...(s.contexts ?? []).map((r) => r.id)]);
      const anc = store.ancestors(id), desc = store.descendants(id);
      const lit = m === 'near' ? new Set([id, ...relIds]) : new Set([id, ...anc, ...desc]);
      const line = m === 'line' ? store.mainLine(id).map((x) => x.id) : [];
      const mainPairs = new Set(line.slice(1).map((cid, i) => `${line[i]}>${cid}`));
      svg.classList.add('has-selection');
      svg.classList.toggle('mode-line', m === 'line');
      svg.classList.remove('has-hover');
      for (const n of nodes) {
        const on = lit.has(n.s.id);
        for (const x of [n.g, n.text, n.life, n.plate]) {
          x.classList.toggle('lit', on);
          x.classList.toggle('is-related', m === 'near' && relIds.has(n.s.id));
          x.classList.toggle('on-line', line.includes(n.s.id));
          x.classList.toggle('is-selected', n.s.id === id);
        }
      }
      const depthOf = (sid, set, dir) => {
        let dpt = 0, frontier = [id];
        const seen = new Set([id]);
        while (frontier.length && dpt < 60) {
          if (frontier.includes(sid)) return dpt;
          const next = [];
          for (const f of frontier) for (const r of store.get(f)[dir]) if (set.has(r.id) && !seen.has(r.id)) { seen.add(r.id); next.push(r.id); }
          frontier = next; dpt++;
        }
        return dpt;
      };
      for (const e of edges) {
        let hl, up = false, down = false;
        if (m === 'near') hl = e.par.s.id === id || e.ch.s.id === id;
        else {
          up = (anc.has(e.par.s.id) || e.par.s.id === id) && (anc.has(e.ch.s.id) || e.ch.s.id === id);
          down = desc.has(e.ch.s.id) && (desc.has(e.par.s.id) || e.par.s.id === id);
          hl = up || down;
        }
        e.g.classList.toggle('hl', hl);
        e.g.classList.toggle('main', mainPairs.has(`${e.par.s.id}>${e.ch.s.id}`));
        e.g.classList.toggle('desc', down && !up);
        const dd = up ? depthOf(e.par.s.id, anc, 'parents') : down ? depthOf(e.ch.s.id, desc, 'children') : 0;
        e.path.style.transitionDelay = (up || down) && animate && !reduceMotion() ? `${Math.min(dd, 14) * 60}ms` : '0ms';
      }
      openPanel(s);
      syncUrl({ push: nav === 'push' && prev !== id });
      draw();
      clearTimeout(flightTimer);
      if (m === 'line') fitLineage(id, animate);
      else if (animate && prev && prev !== id) flyTo(prev, id);
      else focusCamera(id, animate ? 650 : 0);
    }
    function clearSelection({ restore = false, nav = 'push' } = {}) {
      if (!selected) return;
      clearTimeout(flightTimer);
      selected = null;
      svg.classList.remove('has-selection', 'mode-line');
      for (const n of nodes) for (const x of [n.g, n.text, n.life, n.plate]) x.classList.remove('lit', 'is-selected', 'on-line', 'is-related');
      for (const e of edges) { e.g.classList.remove('hl', 'main', 'desc'); e.path.style.transitionDelay = '0ms'; }
      panel.hidden = true;
      computeFit();
      drawMinimap();
      trail = [];
      syncUrl({ push: nav === 'push' && (history.state?.mapStep ?? 0) > 0 });   // иначе «Назад» после снятия выбора ничего не делает
      if (restore && camBeforeFocus) { const c = camBeforeFocus; animateTo(c.k, c.tx, c.ty, 550); }
      camBeforeFocus = null;
      schedule();
    }

    // Назад по маршруту: шаг истории, если он наш (state.mapStep), иначе — к предыдущему стилю маршрута.
    function goBack() {
      if (!selected) return;
      if ((history.state?.mapStep ?? 0) > 0) { history.back(); return; }   // update() вернёт стиль или снимет выбор
      if (trail.length >= 2) { trail = trail.slice(0, -1); select(trail[trail.length - 1], { nav: 'replace' }); return; }
      clearSelection({ restore: true });
    }

    function relList(s, key, dir) {
      if (!s[key].length) return '';
      return html`<div class="mp-rel"><h3>${dir === 'from' ? 'Откуда' : 'Куда'}</h3><ul>
        ${s[key].map((r) => { const o = store.get(r.id); return o ? html`<li><button type="button" class="mp-node" data-select="${o.id}"><span class="swatch" style="--c:var(--era-${o.era})"></span><span><span class="mp-node-rel">${RELATION[r.type][dir]} · <span class="st st-${r.status}">${REL_STATUS[r.status]}</span></span>${o.name}</span></button>${r.note ? html`<p class="mp-rel-note">${r.note}</p>` : ''}</li>` : ''; })}
      </ul></div>`;
    }
    function cmpList(s) {
      if (!s.comparisons.length) return '';
      return html`<div class="mp-rel"><h3>Похоже на</h3><ul>
        ${s.comparisons.map((c) => { const o = store.get(c.id); return o ? html`<li><button type="button" class="mp-node" data-select="${o.id}"><span class="swatch" style="--c:var(--era-${o.era})"></span><span><span class="mp-node-rel">сопоставление, не происхождение</span>${o.name}</span></button>${c.note ? html`<p class="mp-rel-note">${c.note}</p>` : ''}</li>` : ''; })}
      </ul></div>`;
    }
    function contextList(s) {
      if (!s.contexts?.length) return '';
      return html`<div class="mp-rel"><h3>Школы и контекст</h3><ul>${s.contexts.map((c) => {
        const other = store.get(c.id);
        return other ? html`<li><button type="button" class="mp-node" data-select="${other.id}"><span class="swatch" style="--c:var(--era-${other.era})"></span><span><span class="mp-node-rel">${CONTEXT[c.type]?.[c.direction]} · ${REL_STATUS[c.status]}</span>${other.name}</span></button><p class="mp-rel-note">${c.note}</p></li>` : '';
      })}</ul></div>`;
    }
    function sourceLinks(ids) {
      const list = (ids ?? []).map((id) => store.source(id)).filter(Boolean);
      return list.length ? html`<p class="ep-src">Источник: ${list.map((src, i) => html`${i ? ', ' : ''}<a href="${safeUrl(src.url)}" target="_blank" rel="noopener">${src.publisher ?? src.title}</a>`)}</p>` : '';
    }
    function openPanel(s) {
      const nRel = s.parents.length + s.children.length + s.comparisons.length + (s.contexts?.length ?? 0);
      const arts = [];
      const seen = new Set();
      const addArt = (img, title, author, year, place) => {
        if (!img || seen.has(img.page)) return;
        seen.add(img.page);
        arts.push({ img, caption: [title, author, year, place].filter(Boolean).join(' · ') });
      };
      addArt(s.example.img, s.example.title, s.example.author, s.example.year, s.example.place);
      for (const g of s.gallery ?? []) addArt(g.img, g.title, g.author, g.year, g.place);
      const cover = arts[0]?.img ?? null;
      mount(panel, html`
        <button class="icon-btn mp-close" type="button" data-close-panel aria-label="Закрыть и вернуться к прежнему виду"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
        ${cover ? html`<div class="mp-art-wrap">
          <button class="mp-art mp-art-btn" type="button" data-panel-open data-panel-index="0" aria-label="Открыть изображение крупно: ${s.name}">
            ${frame(cover, s.palette, { ratio: '16 / 10', sizes: '380px', alt: '', note: s.example.img ? '' : 'Пример традиции' })}
            <span class="mp-art-hint">Увеличить</span>
          </button>
          <p class="mp-art-cap">${arts[0].caption}</p>
        </div>` : s.example.external?.reference ? html`<div class="mp-reference"><p class="mp-kind">Основная работа</p><p>${s.example.title}</p><a href="${safeUrl(s.example.external.page)}" target="_blank" rel="noopener">Посмотреть репродукцию ↗</a></div>` : html`<div class="mp-art-wrap"><a class="mp-art" href="#/s/${s.id}" aria-label="Открыть карточку: ${s.name}">${frame(null, s.palette, { ratio: '16 / 10', sizes: '380px', alt: '', note: s.palette?.source === 'editorial' ? 'Редакторская подборка цветов' : '' })}</a></div>`}
        ${arts.length > 1 ? html`<div class="mp-thumbs" role="group" aria-label="Другие изображения этого стиля">
          ${arts.map((a, i) => html`<button class="mp-thumb" type="button" data-panel-thumb="${i}" aria-label="Показать изображение: ${a.caption}" aria-pressed="${i === 0}"><img src="${a.img.src[250]}" alt="" loading="lazy"></button>`)}
        </div>` : ''}
        <div class="mp-body">
          <p class="mp-meta">${s.dateKind === 'corpus' ? '' : eraTag(store, s.era, { link: false })}${s.kind[0] ? html`<span class="mp-kind">${KIND[s.kind[0]].toLowerCase()}</span>` : ''}</p>
          <h2 class="mp-name">${s.name}</h2>
          <p class="mp-orig">${s.orig}, ${fmtDates(s)}</p>
          <p class="mp-sum">${s.summary}</p>
          <div class="mp-modes" role="group" aria-label="Что показать на карте">
            <button class="chip" type="button" data-focus-mode="near" aria-pressed="${focusMode === 'near'}">Ближайшие связи <span class="count">${nRel}</span></button>
            <button class="chip" type="button" data-focus-mode="line" aria-pressed="${focusMode === 'line'}">Вся родословная</button>
          </div>
          ${s.origin === 'unknown' ? html`<p class="mp-origin">Связи происхождения пока не представлены на карте.</p>` : ''}
          ${relList(s, 'parents', 'from')}
          ${relList(s, 'children', 'to')}
          ${cmpList(s)}
          ${contextList(s)}
          <a class="btn mp-open" href="#/s/${s.id}">Открыть зал</a>
        </div>`);
      panel.hidden = false;
      computeFit();
      markLoaded(panel);
      const mainArt = panel.querySelector('[data-panel-open]');
      if (mainArt) {
        mainArt.addEventListener('click', () => openLightbox(arts, Number(mainArt.dataset.panelIndex) || 0));
        for (const btn of panel.querySelectorAll('[data-panel-thumb]')) {
          btn.addEventListener('click', () => {
            const i = Number(btn.dataset.panelThumb) || 0;
            mainArt.dataset.panelIndex = String(i);
            mainArt.innerHTML = frame(arts[i].img, s.palette, { ratio: '16 / 10', sizes: '380px', alt: '', note: '' }) + '<span class="mp-art-hint">Увеличить</span>';
            mainArt.setAttribute('aria-label', `Открыть изображение крупно: ${s.name}`);
            const cap = panel.querySelector('.mp-art-cap');
            if (cap) cap.textContent = arts[i].caption;
            for (const b of panel.querySelectorAll('[data-panel-thumb]')) b.setAttribute('aria-pressed', String(b === btn));
          });
        }
      }
    }

    // Объяснение связи по клику на линию.
    function showEdgeInfo(info, px, py) {
      if (info.context) {
        const c = info.context;
        mount(edgePop, html`<p class="ep-head"><span>${c.a.s.name}</span> · <span>${c.b.s.name}</span></p>
          <p class="ep-kind">${CONTEXT[c.type]?.label} · ${REL_STATUS[c.status]}</p><p class="ep-note">${c.note}</p>${sourceLinks(c.sources)}
          <p class="ep-go"><button class="chip" type="button" data-select="${c.a.s.id}">${c.a.s.name}</button><button class="chip" type="button" data-select="${c.b.s.id}">${c.b.s.name}</button></p>`);
      } else if (info.cmp) {
        const c = info.cmp;
        mount(edgePop, html`<p class="ep-head"><span>${c.a.s.name}</span> ↔ <span>${c.b.s.name}</span></p>
          <p class="ep-kind">Визуальное сопоставление · не заявление о происхождении</p>
          ${c.note ? html`<p class="ep-note">${c.note}</p>` : ''}${sourceLinks(c.sources)}
          <p class="ep-go"><button class="chip" type="button" data-select="${c.a.s.id}">${c.a.s.name}</button><button class="chip" type="button" data-select="${c.b.s.id}">${c.b.s.name}</button></p>`);
      } else {
        const e = info.edge, r = e.rel;
        mount(edgePop, html`<p class="ep-head"><span>${e.par.s.name}</span> → <span>${e.ch.s.name}</span></p>
          <p class="ep-kind">${RELATION[r.type].label} · <span class="st st-${r.status}">${REL_STATUS[r.status]}</span></p>
          ${r.note ? html`<p class="ep-note">${r.note}</p>` : r.status !== 'verified' ? html`<p class="ep-note muted">Пояснения и источника пока нет: связь проведена редакцией атласа и ждёт проверки.</p>` : ''}
          ${sourceLinks(r.sources)}
          <p class="ep-go"><button class="chip" type="button" data-select="${e.par.s.id}">← ${e.par.s.name}</button><button class="chip" type="button" data-select="${e.ch.s.id}">${e.ch.s.name} →</button></p>`);
      }
      placeEdgeInfo(px, py);
    }
    function placeEdgeInfo(px, py) {
      if (edgePop.hidden) edgeInfoFocus = stage.contains(document.activeElement) ? document.activeElement : stage;
      const close = document.createElement('button');
      close.type = 'button'; close.className = 'icon-btn'; close.dataset.closeEdge = '';
      close.setAttribute('aria-label', 'Закрыть сведения о связи'); close.textContent = '×';
      edgePop.prepend(close);
      edgePop.hidden = false;
      const w = edgePop.offsetWidth, h = edgePop.offsetHeight;
      const left = clamp(px + 12, 8, pw - w - 8), top = py + 14 + h > ph - 8 ? Math.max(rot ? 4 : AXIS_H + 4, py - h - 14) : py + 14;
      edgePop.style.transform = `translate(${left}px, ${top}px)`;
      close.focus({ preventScroll: true });
    }
    const hideEdgeInfo = ({ restoreFocus = false } = {}) => {
      edgePop.hidden = true;
      if (restoreFocus) (edgeInfoFocus?.isConnected ? edgeInfoFocus : stage).focus({ preventScroll: true });
      edgeInfoFocus = null;
    };

    // ---------- слои и фильтр ----------
    const syncUrl = ({ push = false } = {}) => {
      renderTrail();
      const params = {
        s: selected ?? '', view: selected && focusMode === 'line' ? 'line' : '',
        d: filter.domain, k: filter.family,
        rel: verifiedOnly ? 'verified' : '', links: linkMode === 'main' ? '' : linkMode,
        trail: selected && trail.length > 1 ? toParam(trail) : '',
      };
      if (push) pushParams('map', params, { mapStep: (history.state?.mapStep ?? 0) + 1 });
      else replaceParams('map', params);
    };
    function setLinkMode(next) {
      linkMode = Object.hasOwn(LINK_MODES, next) ? next : 'main';
      svg.dataset.linkMode = linkMode;
      svg.classList.toggle('show-all', linkMode === 'all');
      root.querySelectorAll('button[data-link-mode]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.linkMode === linkMode)));
      hideEdgeInfo();
      if (sc) drawMinimap();
      schedule();
    }
    function setLayer(name, v) {
      if (name === 'verified') { verifiedOnly = v; svg.classList.toggle('verified-only', v); drawMinimap(); }
      root.querySelectorAll(`[data-layer="${name}"]`).forEach((b) => { b.checked = v; });
      schedule();
    }
    const matches = (s) => (!filter.domain || s.domain.includes(filter.domain)) && (!filter.family || KIND_FAMILY[filter.family].kinds.includes(s.kind[0]));
    // Фильтр не перестраивает карту: несовпавшие стили бледнеют, камера наводится на найденное.
    function setFilter(next, { animate = true } = {}) {
      const was = filter.domain || filter.family;
      filter = next;
      const active = !!(filter.domain || filter.family);
      if (active && !was) camBeforeFilter = camera();
      svg.classList.toggle('has-filter', active);
      const hits = [];
      for (const n of nodes) { const ok = !active || matches(n.s); for (const x of [n.g, n.text, n.life, n.plate]) x.classList.toggle('out', !ok); if (ok) hits.push(n); }
      for (const e of edges) e.g.classList.toggle('out', active && (e.par.g.classList.contains('out') || e.ch.g.classList.contains('out')));
      const label = [filter.domain && DOMAIN[filter.domain], filter.family && KIND_FAMILY[filter.family].label].filter(Boolean).join(' · ');
      q('.mfb-label').textContent = active ? `${label} · ${hits.length}` : 'Все стили';
      q('[data-filter-btn]').classList.toggle('is-active', active);
      root.querySelectorAll('[data-f-domain]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.fDomain === filter.domain)));
      root.querySelectorAll('[data-f-family]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.fFamily === filter.family)));
      drawMinimap();
      syncUrl();
      if (active && hits.length) {
        const xs = hits.map((n) => sc.x(n.s.start)), ys = hits.map(yRef);
        fitBox(Math.min(...xs), Math.max(...xs), Math.min(...ys) - ROW, Math.max(...ys) + ROW, { ms: animate ? 650 : 0, kMin: Math.max(kOv(), k0 * 2.2) * 1.5, kMax: 1.1 });
      } else if (!active && camBeforeFilter) {
        const c = camBeforeFilter; camBeforeFilter = null;
        animateTo(c.k, c.tx, c.ty, animate ? 550 : 0);
      } else schedule();
    }

    // ---------- подсказка при наведении ----------
    let tipTimer = 0, tipFor = null;
    function showTip(n) {
      const s = n.s;
      tipFor = s.id;
      const sea = store.nebula(s.id);
      const part = sea?.parts.find((p) => p.id === s.part);
      const from = s.parents.slice(0, 2).map((p) => store.get(p.id)?.name).filter(Boolean);
      const to = s.children.length;
      mount(tip, html`${thumb(s, 72)}<span class="tip-text"><span class="tip-name">${s.name}</span><span class="tip-dates">${fmtDates(s)}</span><span class="tip-rel">${sea ? `${sea.name} → ${part?.name ?? ''}` : 'Вне морей'}</span><span class="tip-sum">${s.summary}</span>
        <span class="tip-rel">${from.length ? `из: ${from.join(', ')}` : s.origin === 'unknown' ? 'связи происхождения пока не показаны' : 'исток'}${to ? ` · ${to} ${plural(to, 'потомок', 'потомка', 'потомков')}` : ''}</span></span>`);
      markLoaded(tip);
      tip.hidden = false;
      const tw = tip.offsetWidth, th = tip.offsetHeight;
      const np = toP(n.x, n.y);
      let left = np.x + 18, top = np.y + 18;
      if (left + tw > pw - 10) left = Math.max(10, np.x - tw - 18);
      if (top + th > ph - 10) top = np.y - th - 18;
      tip.style.transform = `translate(${left}px, ${top}px)`;
    }
    function hideTip() { clearTimeout(tipTimer); tipTimer = 0; tip.hidden = true; tipFor = null; }

    // ---------- события полотна ----------
    const pointers = new Map();
    let drag = null, pinch = null, moved = false, nativeGesture = null, lastPointer = null;
    const uiTarget = (e) => e.target.closest?.('.map-panel, .map-tip, .map-edge-pop, .map-offscreen, .mm-box, .map-trail, .map-levels, .map-directory');
    const gesturePoint = (e) => {
      const r = stage.getBoundingClientRect();
      const inside = (p) => p && Number.isFinite(p.clientX) && Number.isFinite(p.clientY)
        && p.clientX >= r.left && p.clientX <= r.right && p.clientY >= r.top && p.clientY <= r.bottom;
      if (inside(e)) return toV(e.clientX, e.clientY);
      if (nativeGesture) return nativeGesture.point;
      return inside(lastPointer) ? toV(lastPointer.clientX, lastPointer.clientY) : { x: vw / 2, y: vh / 2 };
    };

    // Подсказка нужна до первого движения по карте, дальше она только закрывает подписи.
    const dismissHint = () => hint.classList.add('is-gone');
    on(stage, 'pointerdown', (e) => {
      if (uiTarget(e)) return;
      nativeGesture = null;
      stopAnimation(); clearTimeout(flightTimer);
      dismissHint();
      hideEdgeInfo();
      try { stage.setPointerCapture?.(e.pointerId); } catch { /* указатель уже отпущен */ }
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      moved = false;
      if (pointers.size === 1) {
        const rect = stage.getBoundingClientRect(), x = e.clientX - rect.left, y = e.clientY - rect.top;
        const name = [...regionNames].find(([, r]) => r.boxes.some((b) => x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3]));
        const region = e.target.closest('.region-name')?.dataset.region ?? name?.[0];
        drag = { x: e.clientX, y: e.clientY, tx: t.tx, ty: t.ty, node: e.target.closest('.node, .label'), edge: region ? null : e.target.closest('.edge-hit'), summary: region ? null : e.target.closest('.summary-hit'), region };
      }
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const c0 = toV((a.x + b.x) / 2, (a.y + b.y) / 2);
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), k: t.k, cx: c0.x, cy: c0.y, tx: t.tx, ty: t.ty };
        drag = null;
      }
    });
    on(stage, 'pointermove', (e) => {
      if (e.pointerType === 'mouse' && !uiTarget(e)) lastPointer = { clientX: e.clientX, clientY: e.clientY };
      if (!pointers.has(e.pointerId)) {
        if (uiTarget(e)) return;
        if (e.target.closest('.summary-hit')) return;
        if (neb.ready && detail.nodes < 0.15 && e.pointerType === 'mouse') {
          const pt = toV(e.clientX, e.clientY);
          const next = nebulaRegionAt(pt.x, pt.y, nebulaCam(), detail.level === 'parts');
          if (next !== regionHover) { regionHover = next; schedule(); }
        } else if (regionHover) { regionHover = null; schedule(); }
        const nodeEl = e.target.closest('.node, .label');
        if (nodeEl && e.pointerType === 'mouse') {
          const id = nodeEl.dataset.id;
          if (id !== tipFor) {
            clearTimeout(tipTimer);
            tipTimer = setTimeout(() => { setHover(id); showTip(nodeById.get(id)); }, 90);
          }
        } else if (tipFor || tipTimer) { hideTip(); setHover(null); }
        return;
      }
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch && pointers.size >= 2) {
        const [a, b] = [...pointers.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        const k2 = clamp(pinch.k * (dist / pinch.d), Math.min(k0 * 0.9, pinch.k), MAX_K);
        const c1 = toV((a.x + b.x) / 2, (a.y + b.y) / 2), cx = c1.x, cy = c1.y - AXIS_H;
        const s1 = syOf(pinch.k), s2 = syOf(k2);
        t.tx = cx - ((pinch.cx - pinch.tx) * k2) / pinch.k;
        t.ty = cy - ((pinch.cy - AXIS_H - pinch.ty) * s2) / s1;
        t.k = k2;
        moved = true; clampT(); schedule();
      } else if (drag) {
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        if (Math.abs(dx) + Math.abs(dy) > 4) moved = true;
        if (moved) { hideTip(); setHover(null); stage.classList.add('dragging'); const d = dV(dx, dy); t.tx = drag.tx + d.x; t.ty = drag.ty + d.y; clampT(); schedule(); }
      }
    });
    const end = (e) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.delete(e.pointerId);
      stage.classList.remove('dragging');
      if (pointers.size < 2) pinch = null;
      if (drag && !moved && e.type === 'pointerup') {
        const rect = stage.getBoundingClientRect();
        if (drag.node) select(drag.node.dataset.id);
        else if (drag.edge) {
          const info = drag.edge.dataset.context != null ? { context: contextEdges[+drag.edge.dataset.context] }
            : drag.edge.dataset.cmp != null ? { cmp: cmps[+drag.edge.dataset.cmp] } : { edge: edges[+drag.edge.dataset.edge] };
          showEdgeInfo(info, e.clientX - rect.left, e.clientY - rect.top);
        } else if (drag.summary) showSummaryInfo(aggregateLinks[+drag.summary.dataset.summary], e.clientX - rect.left, e.clientY - rect.top);
        else if (drag.region) focusRegion(drag.region);
        else if (neb.ready && detail.nodes < 0.15) {
          const pt = toV(e.clientX, e.clientY), key = nebulaRegionAt(pt.x, pt.y, nebulaCam(), detail.level === 'parts');
          if (key) focusRegion(key); else clearSelection();
        } else clearSelection();
      }
      if (!pointers.size) drag = null;
    };
    on(stage, 'pointerup', end);
    on(stage, 'pointercancel', end);
    on(stage, 'pointerleave', (e) => { if (e.pointerType === 'mouse' && !pointers.size) { hideTip(); setHover(null); if (regionHover) { regionHover = null; schedule(); } } });

    on(stage, 'wheel', (e) => {
      if (e.target.closest('.map-panel, .map-directory, .map-edge-pop')) return;
      clearTimeout(flightTimer);
      e.preventDefault();
      hideTip();
      dismissHint();
      if (nativeGesture) return; // Safari может послать и wheel в той же последовательности.
      if (!Number.isFinite(e.deltaY) || e.deltaY === 0) return;
      const p = toV(e.clientX, e.clientY);
      // Chromium передаёт щипок небольшими пиксельными ctrl+wheel: сохраняем
      // прямой отклик. Крупные шаги мыши, в том числе с Ctrl/⌘, сглаживаем.
      if (e.ctrlKey && e.deltaMode === 0 && Math.abs(e.deltaY) < 40) {
        zoomAt(p.x, p.y, Math.exp(-e.deltaY * 0.01));
      } else {
        const unit = e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? 120 : 1;
        wheelZoomAt(p.x, p.y, clamp(-e.deltaY * unit * 0.0015, -0.18, 0.18));
      }
    }, { passive: false });

    // Safari на Mac передаёт щипок через GestureEvent. Касания экрана уже
    // обслуживают PointerEvent: не применяем один жест дважды.
    on(stage, 'gesturestart', (e) => {
      if (uiTarget(e) || pointers.size) return;
      e.preventDefault();
      stopAnimation(); clearTimeout(flightTimer);
      dismissHint(); hideTip();
      nativeGesture = { scale: 1, point: gesturePoint(e) };
    }, { passive: false });
    on(stage, 'gesturechange', (e) => {
      if (!nativeGesture) return;
      e.preventDefault();
      if (pointers.size || !Number.isFinite(e.scale) || e.scale <= 0) return;
      const p = gesturePoint(e);
      zoomAt(p.x, p.y, e.scale / nativeGesture.scale);
      nativeGesture = { scale: e.scale, point: p };
    }, { passive: false });
    on(window, 'gestureend', (e) => {
      if (!nativeGesture) return;
      e.preventDefault();
      nativeGesture = null;
    }, { passive: false });
    on(window, 'blur', () => { nativeGesture = null; stopAnimation(); });

    on(stage, 'dblclick', (e) => {
      if (uiTarget(e) || e.target.closest('.node, .label')) return;
      const pv = toV(e.clientX, e.clientY), px = pv.x, py = pv.y - AXIS_H;
      const k2 = Math.min(MAX_K, t.k * 2.2);
      const s1 = syOf(t.k), s2 = syOf(k2);
      animateTo(k2, px - ((px - t.tx) * k2) / t.k, py - ((py - t.ty) * s2) / s1, 450);
    });

    on(stage, 'keydown', (e) => {
      if (e.key === 'Escape' && !directory.hidden) { e.preventDefault(); directory.hidden = true; q('[data-browse]').setAttribute('aria-expanded', 'false'); q('[data-browse]').focus(); return; }
      const nodeEl = e.target.closest?.('.node');
      const regionEl = e.target.closest?.('.region-name'), summaryEl = e.target.closest?.('.summary-hit');
      if ((regionEl || summaryEl) && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        if (regionEl) focusRegion(regionEl.dataset.region);
        else { const b = summaryEl.getBoundingClientRect(), r = stage.getBoundingClientRect(); showSummaryInfo(aggregateLinks[+summaryEl.dataset.summary], b.x - r.x, b.y - r.y); }
        return;
      }
      if (nodeEl && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); select(nodeEl.dataset.id); return; }
      if ((e.metaKey || e.altKey) && e.key.startsWith('Arrow')) return;   // Cmd/Alt+← — «Назад» браузера
      if (uiTarget(e)) { if (e.key === 'Escape' && selected) goBack(); return; }
      if (selected && e.key.startsWith('Arrow')) {
        e.preventDefault();
        const to = stepTarget(store, (x) => nodeById.get(x)?.row ?? 0, selected, e.key);
        if (to) select(to, { mode: focusMode });
        return;
      }
      if (e.key === 'Backspace' && selected) { e.preventDefault(); goBack(); return; }
      const step = 90;
      const pan = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step / 2], ArrowDown: [0, -step / 2] }[e.key];
      if (pan) { stopAnimation(); const d = dV(pan[0], pan[1]); t.tx += d.x; t.ty += d.y; }
      else if (e.key === '+' || e.key === '=') return zoomAt(vw / 2, vh / 2, 1.5);
      else if (e.key === '-' || e.key === '_') return zoomAt(vw / 2, vh / 2, 1 / 1.5);
      else if (e.key === '0') return fit();
      else if (e.key === 'Escape') { if (!edgePop.hidden) return hideEdgeInfo(); return goBack(); }
      else return;
      e.preventDefault(); clampT(); schedule();
    });
    on(stage, 'focusin', (e) => {
      const nodeEl = e.target.closest?.('.node');
      if (!nodeEl || !e.target.matches(':focus-visible')) return;
      const n = nodeById.get(nodeEl.dataset.id);
      if (n.x < 40 || n.x > vw - 200 || n.y < AXIS_H + 20 || n.y > vh - 40) { t.tx += vw * 0.4 - n.x; t.ty += vh / 2 - n.y; clampT(); schedule(); }
    });

    // ---------- миникарта ----------
    let mmDrag = false;
    on(mm, 'pointerdown', (e) => { mmDrag = true; try { mm.setPointerCapture(e.pointerId); } catch { /* */ } minimapGo(e); });
    on(mm, 'pointermove', (e) => { if (mmDrag) minimapGo(e); });
    on(mm, 'pointerup', () => { mmDrag = false; });
    on(mm, 'pointercancel', () => { mmDrag = false; });
    const setMinimap = (open) => {
      mmBox.classList.toggle('collapsed', !open);
      mmToggle.setAttribute('aria-expanded', String(open));
      const label = open ? 'Свернуть миникарту' : 'Показать миникарту';
      mmToggle.setAttribute('aria-label', label); mmToggle.title = label;
      try { localStorage.setItem('atlas.minimap', open ? '1' : '0'); } catch { /* хранилище недоступно — не страшно */ }
      if (sc) { drawMinimap(); drawMinimapFrame(); }
      schedule();
    };
    let mmOpen = true;
    try { mmOpen = localStorage.getItem('atlas.minimap') !== '0'; } catch { /* по умолчанию открыта */ }
    setMinimap(mmOpen);
    on(mmToggle, 'click', () => setMinimap(mmBox.classList.contains('collapsed')));

    // ---------- тулбар ----------
    const findInput = q('.map-find input');
    const findList = q('.map-find-results');
    const index = buildIndex(store.styles);
    let findItems = [], findActive = 0;
    const renderFind = () => {
      const v = findInput.value.trim();
      findItems = v ? search(index, v, { limit: 7, now: store.now }).map((r) => r.style) : [];
      findActive = 0;
      findList.hidden = !findItems.length;
      mount(findList, html`${findItems.map((s, i) => html`<li role="option" aria-selected="${i === 0}" data-find="${s.id}"><span class="swatch" style="--c:var(--era-${s.era})"></span><span class="mf-name">${s.name}</span><span class="mf-dates">${fmtDates(s)}</span></li>`)}`);
    };
    const pickFind = (id) => { findInput.value = ''; findList.hidden = true; findInput.blur(); select(id); };
    on(findInput, 'input', renderFind);
    on(findInput, 'keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (!findItems.length) return;
        findActive = (findActive + (e.key === 'ArrowDown' ? 1 : -1) + findItems.length) % findItems.length;
        findList.querySelectorAll('li').forEach((li, i) => li.setAttribute('aria-selected', String(i === findActive)));
      } else if (e.key === 'Enter' && findItems[findActive]) { e.preventDefault(); pickFind(findItems[findActive].id); }
      else if (e.key === 'Escape') { e.preventDefault(); findInput.value = ''; findList.hidden = true; }
      e.stopPropagation();
    });
    on(findList, 'pointerdown', (e) => { const li = e.target.closest('[data-find]'); if (li) { e.preventDefault(); pickFind(li.dataset.find); } });
    on(findInput, 'blur', () => setTimeout(() => { findList.hidden = true; }, 150));

    // Всплывающие окна тулбара: легенда и фильтр.
    const pops = [...root.querySelectorAll('.map-pop-wrap')].map((wrap) => ({ wrap, btn: wrap.querySelector('button'), pop: wrap.querySelector('.map-pop') }));
    const togglePop = (p, force) => {
      const open = force ?? p.pop.hidden;
      for (const o of pops) if (o !== p && open) { o.pop.hidden = true; o.btn.setAttribute('aria-expanded', 'false'); }
      p.pop.hidden = !open;
      p.btn.setAttribute('aria-expanded', String(open));
    };
    for (const p of pops) on(p.btn, 'click', () => togglePop(p));
    on(document, 'pointerdown', (e) => { for (const p of pops) if (!p.pop.hidden && !p.wrap.contains(e.target)) togglePop(p, false); });
    on(document, 'keydown', (e) => {
      if (e.key === 'Escape' && !edgePop.hidden) {
        e.preventDefault(); e.stopPropagation(); hideEdgeInfo({ restoreFocus: true });
      }
    }, { capture: true });
    on(document, 'keydown', (e) => { if (e.key === 'Escape') for (const p of pops) if (!p.pop.hidden) { togglePop(p, false); p.btn.focus(); } });

    for (const box of root.querySelectorAll('[data-layer]')) on(box, 'change', (e) => { setLayer(box.dataset.layer, e.target.checked); syncUrl(); });

    on(root, 'click', (e) => {
      const period = e.target.closest('button[data-period]');
      if (period) {
        directory.hidden = true; q('[data-browse]').setAttribute('aria-expanded', 'false');
        hideEdgeInfo();
        if (selected) clearSelection();
        stage.focus({ preventScroll: true });
        zoomToEra(Number(period.dataset.period)); return;
      }
      if (e.target.closest('[data-close-edge]')) { hideEdgeInfo({ restoreFocus: true }); return; }
      if (e.target.closest('[data-browse]')) { directory.hidden = !directory.hidden; q('[data-browse]').setAttribute('aria-expanded', String(!directory.hidden)); return; }
      if (e.target.closest('[data-browse-close]')) { directory.hidden = true; q('[data-browse]').setAttribute('aria-expanded', 'false'); return; }
      const region = e.target.closest('button[data-region]');
      if (region) { focusRegion(region.dataset.region); return; }
      const record = e.target.closest('[data-summary-record]');
      if (record) { const r = stage.getBoundingClientRect(); showEdgeInfo(summaryRecords[+record.dataset.summaryRecord].info, e.clientX - r.x, e.clientY - r.y); return; }
      const level = e.target.closest('button[data-detail]');
      if (level) {
        if (selected) clearSelection();
        if (level.dataset.detail === 'seas') fit();
        else { const k = Math.max(kOv(), k0 * 2.2) * (level.dataset.detail === 'parts' ? 0.83 : 1.7); zoomAt(vw / 2, vh / 2, k / t.k, true); }
        return;
      }
      const links = e.target.closest('button[data-link-mode]');
      if (links) { setLinkMode(links.dataset.linkMode); syncUrl(); return; }
      if (e.target.closest('[data-trail-clear]')) { trail = selected ? [selected] : []; syncUrl(); schedule(); return; }
      const z = e.target.closest('button[data-zoom]');
      if (z) {
        if (z.dataset.zoom === 'fit') { if (selected) clearSelection(); if (atFit()) overview(); else fit(); }
        else {
          const f = z.dataset.zoom === 'in' ? 1.7 : 1 / 1.7;
          let k2 = clamp(t.k * f, Math.min(k0 * 0.9, t.k), MAX_K);
          // Масштаб обзора — остановка по пути: на нём все подписи на месте.
          const ko = kOv();
          if ((t.k < ko * 0.98 && k2 > ko) || (t.k > ko * 1.02 && k2 < ko)) k2 = ko;
          const s1 = syOf(t.k), s2 = syOf(k2);
          const cy = (vh - AXIS_H) / 2;
          animateTo(k2, vw / 2 - ((vw / 2 - t.tx) * k2) / t.k, cy - ((cy - t.ty) * s2) / s1, 380);
        }
      }
      const sel = e.target.closest('[data-select]');
      if (sel) { directory.hidden = true; q('[data-browse]').setAttribute('aria-expanded', 'false'); select(sel.dataset.select); }
      const fm = e.target.closest('[data-focus-mode]');
      if (fm && selected) select(selected, { mode: fm.dataset.focusMode });
      if (e.target.closest('[data-close-panel]')) clearSelection({ restore: true });
      const fd = e.target.closest('[data-f-domain]');
      if (fd) setFilter({ ...filter, domain: fd.dataset.fDomain });
      const ff = e.target.closest('[data-f-family]');
      if (ff) setFilter({ ...filter, family: ff.dataset.fFamily });
      if (e.target.closest('[data-f-reset]')) { setFilter({ domain: '', family: '' }); togglePop(pops.find((p) => p.wrap.classList.contains('map-filter-wrap')), false); }
    });

    hint.textContent = 'Нажмите на море, чтобы рассмотреть его. Колесо или щипок — масштаб к курсору.';

    const ro = new ResizeObserver(() => resize());
    ro.observe(stage);
    cleanups.push(() => ro.disconnect());

    build();

    setNebulaDirtyHandler(schedule);
    const themeObs = new MutationObserver(rebuildNeb);
    themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    on(window.matchMedia('(prefers-color-scheme: dark)'), 'change', rebuildNeb);
    cleanups.push(() => { themeObs.disconnect(); clearTimeout(nebTimer); disposeNebulae(); });

    for (const ev of ['pointerdown', 'wheel']) on(stage, ev, () => clearTimeout(flightTimer), { passive: true });

    return {
      update(next) {
        if (!sc) return;
        applyParams(next.params);
      },
      destroy() {
        destroyed = true;
        cancelAnimationFrame(raf); stopAnimation(); clearTimeout(tipTimer); clearTimeout(flightTimer);
        cleanups.forEach((f) => f());
      },
    };
  },
};
