// Мини-карта прямых связей в зале: стиль в центре, слева — из чего он вырос, справа — что выросло из него.
// Стороны означают направление, а не тип: реакция может стоять с любой стороны. Тип — подпись и рисунок линии
// (как на карте), дальние поколения — только на карте. Модуль без DOM на верхнем уровне: его импортируют тесты.
import { html } from '../html.js';
import { fmtDates, RELATION, REL_STATUS } from '../format.js?v=regional-01';
import { thumb } from './common.js?v=links-1';

// Больше стольких соседей на стороне — карточки мельче, чтобы столбец не уходил за экран.
const DENSE = 4;
// Уже этого мини-карта становится вертикальным деревом: предки сверху, зал посередине, продолжения снизу.
// Меньше — и длинные однословные имена («Конструктивизм») не помещаются рядом с кругом.
const VERTICAL_BELOW = 860;

const byStart = (a, b) => a.style.start - b.style.start || a.style.name.localeCompare(b.style.name, 'ru');

// Прямые связи стиля по направлению, раньше начавшиеся — выше.
export function directLinks(store, s) {
  const side = (rels) => rels.map((rel) => ({ style: store.get(rel.id), rel })).filter((x) => x.style).sort(byStart);
  return { from: side(s.parents), to: side(s.children) };
}

// Шаг стрелками: ← главный предок, → ближайшее продолжение — сначала те, для кого этот стиль главный предок.
export function linkStep(store, s, key) {
  if (key === 'ArrowLeft') return store.get(s.parents[0]?.id)?.id ?? null;
  if (key !== 'ArrowRight') return null;
  const kids = s.children.map((c) => store.get(c.id)).filter(Boolean);
  const own = kids.filter((k) => k.parents[0]?.id === s.id);
  return [...(own.length ? own : kids)].sort((a, b) => a.start - b.start || a.id.localeCompare(b.id))[0]?.id ?? null;
}

export function relMark(rel) {
  return html`<span class="ls-rel">${RELATION[rel.type]?.label}</span><span class="ls-state st st-${rel.status}" title="${REL_STATUS[rel.status]}"><span class="visually-hidden">${REL_STATUS[rel.status]}</span></span>`;
}

function node({ style: o, rel }, side, key) {
  return html`<a class="em-node" href="#/s/${o.id}" data-link="${key}" data-side="${side}" data-rel="${rel.type}" data-st="${rel.status}">
    <span class="em-med">${thumb(o, 96)}</span>
    <span class="em-copy"><span class="em-rel">${relMark(rel)}</span><span class="em-name">${o.name}</span><span class="em-dates">${fmtDates(o)}</span></span>
  </a>`;
}

// Ключи связей общие для мини-карты и списка пояснений: подсветка идёт по ним.
export const linkKey = (side, i) => `${side}${i}`;

export function egoMap(store, s) {
  const { from, to } = directLinks(store, s);
  if (!from.length && !to.length) return '';
  return html`<nav class="ego-map" data-ego-map aria-label="Прямые связи">
    <svg class="em-edges" aria-hidden="true"></svg>
    <p class="em-head em-head-from">Откуда</p>
    <p class="em-head em-head-to">Куда</p>
    <div class="em-side em-from${from.length > DENSE ? ' is-dense' : ''}">
      ${from.length ? from.map((x, i) => node(x, 'from', linkKey('f', i))) : html`<p class="em-empty">${s.origin === 'unknown' ? 'Связи пока не показаны' : 'Исток'}</p>`}
    </div>
    <div class="em-hub"><span class="em-med">${thumb(s, 216, 500)}</span><span class="em-name">${s.name}</span><span class="em-dates">${fmtDates(s)}</span><span class="ls-now">вы здесь</span></div>
    <div class="em-side em-to${to.length > DENSE ? ' is-dense' : ''}">
      ${to.length ? to.map((x, i) => node(x, 'to', linkKey('t', i))) : html`<p class="em-empty">Продолжения пока не появились или ещё не описаны в атласе.</p>`}
    </div>
  </nav>
  <p class="em-legend" aria-hidden="true">${Object.entries(RELATION).map(([type, r]) => html`<span><svg viewBox="0 0 32 8"><path class="rel-${type}" d="M2 4h28"/></svg>${r.label}</span>`)}</p>`;
}

const ARROWS = html`<defs>${['em-arrow', 'em-arrow-hl'].map((id) => html`<marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" markerUnits="userSpaceOnUse" orient="auto"><path d="M0 1L10 5L0 9z"/></marker>`)}</defs>`;

const edge = (d, el, arrow) => html`<path class="rel-${el.dataset.rel} st-${el.dataset.st}" data-link="${el.dataset.link}" d="${d}"${arrow ? html` marker-end="url(#em-arrow)"` : ''}/>`;

// Десктоп: дуги от каждого соседа к кругу зала; конец дуги лежит на окружности напротив соседа.
function arcs(map, box) {
  const hub = map.querySelector('.em-hub .em-med').getBoundingClientRect();
  const cx = hub.left + hub.width / 2 - box.left, cy = hub.top + hub.height / 2 - box.top, cr = hub.width / 2 + 8;
  const onHub = ([x, y]) => { const dx = x - cx, dy = y - cy, l = Math.hypot(dx, dy) || 1; return [cx + (dx / l) * cr, cy + (dy / l) * cr]; };
  return [...map.querySelectorAll('.em-node')].map((el) => {
    const r = el.querySelector('.em-med').getBoundingClientRect();
    const y = r.top + r.height / 2 - box.top;
    const from = el.dataset.side === 'from';
    const end = [from ? r.right - box.left + 6 : r.left - box.left - 6, y];
    const [a, b] = from ? [end, onHub(end)] : [onHub(end), end];
    const mx = (a[0] + b[0]) / 2;
    return edge(`M${a[0]},${a[1]} C${mx},${a[1]} ${mx},${b[1]} ${b[0]},${b[1]}`, el, true);
  });
}

// Телефон: дерево. Ствол слева, к каждой карточке — короткая ветка, так что ветки не пересекают соседей.
function tree(map, box) {
  const hub = map.querySelector('.em-hub').getBoundingClientRect();
  const med = map.querySelector('.em-hub .em-med').getBoundingClientRect();
  const cx = med.left + med.width / 2 - box.left;
  const tx = map.querySelector('.em-side').getBoundingClientRect().left - box.left + 14;
  const at = (el) => { const r = el.querySelector('.em-med').getBoundingClientRect(); return [r.left - box.left - 5, r.top + r.height / 2 - box.top]; };
  const out = [];
  const from = [...map.querySelectorAll('.em-from .em-node')];
  if (from.length) {
    const pts = from.map(at);
    from.forEach((el, i) => out.push(edge(`M${pts[i][0]},${pts[i][1]} H${tx}`, el, false)));
    const ym = (from.at(-1).getBoundingClientRect().bottom + med.top) / 2 - box.top;
    out.push(html`<path class="em-trunk" d="M${tx},${pts[0][1]} V${ym} H${cx} V${med.top - box.top - 8}" marker-end="url(#em-arrow)"/>`);
  }
  const to = [...map.querySelectorAll('.em-to .em-node')];
  if (to.length) {
    const pts = to.map(at);
    const ym = map.querySelector('.em-head-to').getBoundingClientRect().top - box.top - 12;
    out.push(html`<path class="em-trunk" d="M${cx},${hub.bottom - box.top + 8} V${ym} H${tx} V${pts.at(-1)[1]}"/>`);
    to.forEach((el, i) => out.push(edge(`M${tx},${pts[i][1]} H${pts[i][0]}`, el, true)));
  }
  return out;
}

// Рисует линии и связывает подсветку мини-карты со списком пояснений. Возвращает уборку для destroy().
export function mountEgoMap(root) {
  const map = root.querySelector('[data-ego-map]');
  if (!map) return () => {};
  const svg = map.querySelector('.em-edges');
  let alive = true;
  const draw = () => {
    if (!alive) return;
    const box = map.getBoundingClientRect();
    const paths = map.classList.contains('is-vert') ? tree(map, box) : arcs(map, box);
    svg.innerHTML = String(html`${ARROWS}${paths}`);
  };
  const fit = () => {
    map.classList.toggle('is-vert', map.clientWidth < VERTICAL_BELOW);
    draw();
  };
  // Первый раз — сразу: в фоновой вкладке ResizeObserver молчит до первой отрисовки.
  fit();
  const ro = new ResizeObserver(fit);
  ro.observe(map);
  document.fonts?.ready.then(draw);

  const highlight = (key) => {
    for (const el of root.querySelectorAll('[data-link].is-hl')) {
      el.classList.remove('is-hl');
      if (el.hasAttribute('marker-end')) el.setAttribute('marker-end', 'url(#em-arrow)');
    }
    if (!key) return;
    for (const el of root.querySelectorAll(`[data-link="${key}"]`)) {
      el.classList.add('is-hl');
      if (el.hasAttribute('marker-end')) el.setAttribute('marker-end', 'url(#em-arrow-hl)');
    }
  };
  const onOver = (e) => highlight(e.target.closest?.('[data-link]')?.dataset.link ?? null);
  root.addEventListener('mouseover', onOver);
  root.addEventListener('focusin', onOver);

  return () => {
    alive = false;
    ro.disconnect();
    root.removeEventListener('mouseover', onOver);
    root.removeEventListener('focusin', onOver);
  };
}
