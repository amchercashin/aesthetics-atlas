// Общая основа прототипов: камера, древо (линии, точки, подписи стилей), ось эпох.
// Прототип задаёт window.NEBULA = { name, init?(atlas), draw(ctx, view), names(g, view) }.
// draw рисует туманности на canvas под древом; names кладёт названия туманностей в SVG поверх.
// Адрес: proto.html#view=far|mid|near&theme=light|dark
(function () {
  const A = window.ATLAS, NEB = window.NEBULA || { draw() {}, names() {} };
  const NS = 'http://www.w3.org/2000/svg';
  const params = new URLSearchParams(location.hash.slice(1));
  const theme = params.get('theme') === 'dark' ? 'dark' : 'light';
  document.documentElement.dataset.theme = theme;
  const css = getComputedStyle(document.documentElement);
  const C = { paper: css.getPropertyValue('--paper').trim(), ink: css.getPropertyValue('--ink').trim(), ink2: css.getPropertyValue('--ink-2').trim(), ink3: css.getPropertyValue('--ink-3').trim() };
  const canvas = document.getElementById('neb'), ctx = canvas.getContext('2d');
  const tree = document.getElementById('tree'), names = document.getElementById('names');
  const hud = document.getElementById('hud');
  let vw = innerWidth, vh = innerHeight, dpr = Math.min(2, devicePixelRatio || 1);
  const cam = { k: 1, tx: 0, ty: 0 };
  const AXIS = 30;

  function preset(v) {
    if (v === 'far') { cam.k = (vw - 40) / A.W; cam.tx = 20; cam.ty = AXIS + (vh - AXIS - A.H * cam.k) / 2; }
    else if (v === 'near') { const e = A.eras.find((x) => x.id === 'avant-garde'); cam.k = 2.1; cam.tx = vw / 2 - ((e.x0 + e.x1) / 2) * cam.k; cam.ty = AXIS + (vh - AXIS) / 2 - (70 + 9 * A.rowPx) * cam.k; }
    else { const e = A.eras.find((x) => x.id === 'fin-de-siecle'); cam.k = 1; cam.tx = vw * 0.42 - e.x0 * cam.k; cam.ty = AXIS + (vh - AXIS - A.H) / 2; }
  }
  const level = () => (cam.k < 0.8 ? 'far' : cam.k < 1.9 ? 'mid' : 'near');
  const toScreen = (x, y) => [x * cam.k + cam.tx, y * cam.k + cam.ty];

  function el(name, attrs, parent) { const n = document.createElementNS(NS, name); for (const k in attrs) n.setAttribute(k, attrs[k]); if (parent) parent.appendChild(n); return n; }
  const colorOf = (s) => (s.nebula >= 0 ? A.nebulae[s.nebula].color : C.ink3);

  function drawTree(view) {
    tree.replaceChildren();
    const lv = view.level, k = cam.k;
    const g = el('g', {}, tree);
    // ветви: главная связь родства, ортогональная
    let d = '';
    for (const s of A.styles) {
      if (s.parent < 0) continue;
      const p = A.styles[s.parent];
      const [x1, y1] = toScreen(p.x, p.y), [x2, y2] = toScreen(s.x, s.y);
      if (Math.max(x1, x2) < -20 || Math.min(x1, x2) > vw + 20) continue;
      if (Math.abs(y1 - y2) < 0.5) d += `M${x1.toFixed(1)} ${y1.toFixed(1)}H${x2.toFixed(1)}`;
      else { const m = Math.max(x1, x2 - 6 * Math.min(k, 2)); d += `M${x1.toFixed(1)} ${y1.toFixed(1)}H${m.toFixed(1)}V${y2.toFixed(1)}H${x2.toFixed(1)}`; }
    }
    el('path', { d, fill: 'none', stroke: C.ink, 'stroke-opacity': lv === 'far' ? 0.22 : 0.3, 'stroke-width': lv === 'near' ? 1.4 : 1 }, g);
    // точки
    const R = lv === 'far' ? [0, 2.6, 2, 1.6] : lv === 'mid' ? [0, 4.6, 3.7, 3] : [0, 7, 6, 5];
    const boxes = [];
    const vis = A.styles.filter((s) => { const [x, y] = toScreen(s.x, s.y); return x > -30 && x < vw + 30 && y > AXIS - 10 && y < vh + 30; });
    for (const s of vis) {
      const [x, y] = toScreen(s.x, s.y), r = R[s.tier];
      el('circle', { cx: x.toFixed(1), cy: y.toFixed(1), r, fill: colorOf(s), stroke: C.paper, 'stroke-width': lv === 'far' ? 0.6 : 1.2 }, g);
      boxes.push([x - r - 1, y - r - 1, x + r + 1, y + r + 1]);
    }
    // подписи стилей (жадно, без наложений)
    const labels = [];
    if (lv !== 'far') {
      const maxTier = lv === 'mid' ? 2 : 3;
      const hit = (b) => labels.some((c) => b[0] < c[2] && c[0] < b[2] && b[1] < c[3] && c[1] < b[3]) || boxes.some((c) => b[0] < c[2] && c[0] < b[2] && b[1] < c[3] && c[1] < b[3]);
      const order = vis.filter((s) => s.tier <= maxTier).sort((a, b) => a.tier - b.tier || a.x - b.x);
      const mctx = document.createElement('canvas').getContext('2d');
      for (const s of order) {
        const fs = s.tier === 1 ? (lv === 'near' ? 16 : 14) : lv === 'near' ? 13.5 : 12;
        const font = s.tier === 1 ? `600 ${fs}px Spectral, Georgia, serif` : `${s.tier === 2 ? 500 : 400} ${fs}px "Golos Text", system-ui, sans-serif`;
        mctx.font = font; const w = mctx.measureText(s.name).width;
        const [x, y] = toScreen(s.x, s.y), r = R[s.tier];
        const b = [x + r + 4, y - fs * 0.72, x + r + 4 + w, y + fs * 0.3];
        if (b[2] > vw - 4 || hit(b)) continue;
        labels.push(b);
        el('text', { x: (x + r + 4).toFixed(1), y: (y + fs * 0.34).toFixed(1), class: 'lbl', style: `font:${font};fill:${s.tier === 1 ? C.ink : C.ink2}` }, g).textContent = s.name;
      }
    }
    // ось эпох
    const ax = el('g', {}, tree);
    el('rect', { x: 0, y: 0, width: vw, height: AXIS, fill: C.paper, 'fill-opacity': 0.92 }, ax);
    for (const e of A.eras) {
      const [x0] = toScreen(e.x0, 0), [x1] = toScreen(e.x1, 0);
      if (x1 < 0 || x0 > vw) continue;
      el('line', { x1: x0, y1: AXIS - 6, x2: x0, y2: AXIS, stroke: C.ink3, 'stroke-width': 1 }, ax);
      const fits = (t) => x1 - x0 > t.length * 6.6 + 10; const first = e.name.split(' ')[0]; const label = fits(e.name) ? e.name : fits(first) ? first : '';
      if (label) el('text', { x: ((Math.max(0, x0) + Math.min(vw, x1)) / 2).toFixed(1), y: 19, 'text-anchor': 'middle', style: `font:500 11px "Golos Text",system-ui,sans-serif;fill:${C.ink3};letter-spacing:.02em` }, ax).textContent = label;
    }
    return { labelBoxes: labels, dotBoxes: boxes };
  }

  function makeView() {
    return { atlas: A, k: cam.k, tx: cam.tx, ty: cam.ty, w: vw, h: vh, dpr, level: level(), theme, colors: C, axis: AXIS, toScreen, svg: (n, a, p) => el(n, a, p) };
  }

  let raf = 0, inited = false;
  function frame() {
    raf = 0;
    const view = makeView();
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const occ = drawTree(view);
    view.labelBoxes = occ.labelBoxes; view.dotBoxes = occ.dotBoxes;
    const t0 = performance.now(); try { NEB.draw(ctx, view); } catch (e) { console.error(e); } window.__nebMs = performance.now() - t0;
    names.replaceChildren(); const g = el('g', {}, names);
    try { NEB.names(g, view); } catch (e) { console.error(e); }
    hud.querySelectorAll('[data-v]').forEach((b) => b.classList.toggle('on', b.dataset.v === view.level));
    hud.querySelector('.lv').textContent = `${NEB.name || 'без туманностей'} · ${view.level} · k=${cam.k.toFixed(2)}`;
    document.body.dataset.ready = '1'; window.__frames = (window.__frames || 0) + 1;
  }
  const redraw = () => { if (inited && !raf) raf = requestAnimationFrame(frame); };

  function resize() {
    vw = innerWidth; vh = innerHeight;
    canvas.width = Math.round(vw * dpr); canvas.height = Math.round(vh * dpr);
    tree.setAttribute('viewBox', `0 0 ${vw} ${vh}`); names.setAttribute('viewBox', `0 0 ${vw} ${vh}`);
  }

  hud.innerHTML = '<button data-v="far">Далеко</button><button data-v="mid">Ближе</button><button data-v="near">Рядом</button><span class="lv"></span>';
  hud.addEventListener('click', (e) => { const b = e.target.closest('[data-v]'); if (b) { preset(b.dataset.v); redraw(); } });
  addEventListener('wheel', (e) => { e.preventDefault(); const f = Math.exp(-e.deltaY * 0.0015); const nk = Math.min(5, Math.max(0.3, cam.k * f)); cam.tx = e.clientX - (e.clientX - cam.tx) * (nk / cam.k); cam.ty = e.clientY - (e.clientY - cam.ty) * (nk / cam.k); cam.k = nk; redraw(); }, { passive: false });
  let drag = null;
  addEventListener('pointerdown', (e) => { if (e.target.closest('#hud')) return; drag = { x: e.clientX, y: e.clientY, tx: cam.tx, ty: cam.ty }; });
  addEventListener('pointermove', (e) => { if (!drag) return; cam.tx = drag.tx + e.clientX - drag.x; cam.ty = drag.ty + e.clientY - drag.y; redraw(); });
  addEventListener('pointerup', () => { drag = null; });
  addEventListener('resize', () => { resize(); redraw(); });

  resize(); preset(params.get('view') || 'far');
  Promise.resolve(document.fonts ? document.fonts.ready : null)
    .then(() => { window.__t0 = performance.now(); return NEB.init ? NEB.init(A, { colors: C, theme }) : null; })
    .catch((e) => console.error(e))
    .then(() => {
      const initMs = performance.now() - window.__t0;
      inited = true; frame();
      if (params.get('perf')) {
        // замер: 40 кадров с панорамированием и лёгким зумом
        const fr = [], nb = [];
        for (let i = 0; i < 40; i++) { cam.tx -= 9; cam.k *= i % 10 < 5 ? 1.01 : 0.99; const t = performance.now(); frame(); fr.push(performance.now() - t); nb.push(window.__nebMs); }
        const avg = (a) => +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(2);
        document.body.dataset.perf = JSON.stringify({ initMs: +initMs.toFixed(1), frameAvg: avg(fr), nebAvg: avg(nb), nebMax: +Math.max(...nb).toFixed(2) });
      }
    });
})();
