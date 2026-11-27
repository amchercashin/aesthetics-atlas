// Полноэкранный просмотр работы с листанием и контейнерным зумом (щипок, двойное касание,
// панорамирование увеличенного изображения — без масштабирования самого интерфейса).

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.5;
const DOUBLE_TAP_MS = 320;
const DOUBLE_TAP_DIST = 32;

export function clampPan(tx, ty, scale, stageW, stageH, imgW, imgH) {
  if (scale <= 1.001) return { tx: 0, ty: 0 };
  const maxX = Math.max(0, (imgW * scale - stageW) / 2);
  const maxY = Math.max(0, (imgH * scale - stageH) / 2);
  return {
    tx: Math.max(-maxX, Math.min(maxX, tx)),
    ty: Math.max(-maxY, Math.min(maxY, ty)),
  };
}

export function zoomAroundPoint(state, nextScale, px, py, cx, cy, dims) {
  const s1 = state.scale;
  const s2 = Math.max(MIN_SCALE, Math.min(MAX_SCALE, nextScale));
  if (s2 <= 1.01) return { scale: 1, tx: 0, ty: 0 };
  const ox = px - cx;
  const oy = py - cy;
  const tx = ox - ((ox - state.tx) * s2) / s1;
  const ty = oy - ((oy - state.ty) * s2) / s1;
  const clamped = clampPan(tx, ty, s2, dims.stageW, dims.stageH, dims.imgW, dims.imgH);
  return { scale: s2, tx: clamped.tx, ty: clamped.ty };
}

export function initLightbox() {
  const dlg = document.querySelector('.lightbox');
  if (!dlg) return () => {};
  const stage = dlg.querySelector('.lb-stage') ?? dlg;
  const img = dlg.querySelector('img');
  const cap = dlg.querySelector('.lb-caption');
  const details = dlg.querySelector('.lb-details');
  const count = dlg.querySelector('.lb-count');
  const prev = dlg.querySelector('[data-prev]');
  const next = dlg.querySelector('[data-next]');
  let items = [];
  let index = 0;

  let view = { scale: 1, tx: 0, ty: 0 };
  const pointers = new Map();
  let pan = null;
  let pinch = null;
  let moved = false;
  let lastTap = { time: 0, x: 0, y: 0 };
  let animTimer = 0;

  const measureDims = () => {
    const sr = stage.getBoundingClientRect();
    const ir = img.getBoundingClientRect();
    // При scale > 1 делим на текущий scale, чтобы получить базовый размер изображения в контейнере.
    return {
      stageW: sr.width || window.innerWidth,
      stageH: sr.height || window.innerHeight,
      imgW: (ir.width || sr.width) / view.scale,
      imgH: (ir.height || sr.height) / view.scale,
      cx: sr.left + sr.width / 2,
      cy: sr.top + sr.height / 2,
    };
  };

  const applyView = ({ animate = false } = {}) => {
    clearTimeout(animTimer);
    if (animate) {
      img.classList.add('is-animating');
      animTimer = setTimeout(() => img.classList.remove('is-animating'), 240);
    } else {
      img.classList.remove('is-animating');
    }
    const zoomed = view.scale > 1.01;
    img.style.transform = zoomed
      ? `translate3d(${view.tx.toFixed(1)}px, ${view.ty.toFixed(1)}px, 0) scale(${view.scale.toFixed(3)})`
      : '';
    dlg.dataset.zoomed = zoomed ? 'true' : '';
  };

  const resetZoom = ({ animate = false } = {}) => {
    pointers.clear();
    pan = null;
    pinch = null;
    stage.classList.remove('is-panning');
    view = { scale: 1, tx: 0, ty: 0 };
    applyView({ animate });
  };

  const toggleZoomAt = (clientX, clientY) => {
    if (view.scale > 1.01) {
      resetZoom({ animate: true });
      return;
    }
    const d = measureDims();
    view = zoomAroundPoint(view, DOUBLE_TAP_SCALE, clientX, clientY, d.cx, d.cy, d);
    applyView({ animate: true });
  };

  const render = () => {
    const item = items[index];
    if (!item) return;
    resetZoom();
    const primary = item.img.src[1280] ?? item.img.src[960] ?? item.img.src[500];
    const fbs = [item.img.src[960], item.img.src[500], item.img.src[250]]
      .filter((u, i, arr) => u && u !== primary && arr.indexOf(u) === i);
    img.dataset.fb = fbs.join('|');
    img.src = primary;
    img.alt = item.caption || '';
    cap.textContent = item.caption || '';
    // «Что здесь видно», источники и сведения о файле — уже экранированный шаблон из artItem().
    if (details) { details.innerHTML = String(item.details ?? ''); details.scrollTop = 0; }
    count.textContent = items.length > 1 ? `${index + 1} / ${items.length}` : '';
    dlg.toggleAttribute('data-single', items.length <= 1);
    prev.disabled = index === 0;
    next.disabled = index === items.length - 1;
    const pre = items[index + 1];
    if (pre?.img.src[960]) { const im = new Image(); im.src = pre.img.src[960]; }
  };

  const open = (input, captionOrIndex) => {
    if (Array.isArray(input)) {
      items = input.filter((x) => x?.img);
      index = Math.max(0, Math.min(items.length - 1, Number(captionOrIndex) || 0));
    } else {
      items = [{ img: input, caption: captionOrIndex || '' }];
      index = 0;
    }
    if (!items.length) return;
    render();
    if (!dlg.open) dlg.showModal();
    dlg.querySelector('[data-close]').focus({ preventScroll: true });
  };

  const step = (d) => {
    const i = index + d;
    if (i < 0 || i >= items.length) return;
    index = i;
    render();
  };

  const close = () => {
    resetZoom();
    if (dlg.open) dlg.close();
  };

  dlg.querySelector('[data-close]').addEventListener('click', close);
  prev.addEventListener('click', () => step(-1));
  next.addEventListener('click', () => step(1));
  dlg.addEventListener('close', () => resetZoom());
  dlg.addEventListener('click', (e) => { if (e.target === dlg) close(); });
  dlg.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
    if (e.key === 'Home') { e.preventDefault(); index = 0; render(); }
    if (e.key === 'End') { e.preventDefault(); index = items.length - 1; render(); }
    if (e.key === '0' && view.scale > 1.01) { e.preventDefault(); resetZoom({ animate: true }); }
  });

  // Жесты внутри .lb-stage: щипок (2 пальца), перетаскивание при зуме, свайп при 1x, двойное касание.
  stage.addEventListener('pointerdown', (e) => {
    if (e.button && e.button !== 0) return;
    try { stage.setPointerCapture?.(e.pointerId); } catch { /* указатель уже отпущен */ }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved = false;
    if (pointers.size === 1) {
      pan = { x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty, target: e.target, pointerType: e.pointerType };
      pinch = null;
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const d = measureDims();
      pinch = {
        dist: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
        midX: (a.x + b.x) / 2,
        midY: (a.y + b.y) / 2,
        state: { ...view },
        dims: d,
      };
      pan = null;
      moved = true;
    }
  });

  stage.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const midX = (a.x + b.x) / 2;
      const midY = (a.y + b.y) / 2;
      const base = zoomAroundPoint(pinch.state, pinch.state.scale * (dist / pinch.dist), pinch.midX, pinch.midY, pinch.dims.cx, pinch.dims.cy, pinch.dims);
      const clamped = clampPan(base.tx + (midX - pinch.midX), base.ty + (midY - pinch.midY), base.scale, pinch.dims.stageW, pinch.dims.stageH, pinch.dims.imgW, pinch.dims.imgH);
      view = { scale: base.scale, tx: clamped.tx, ty: clamped.ty };
      applyView();
      return;
    }
    if (pan && pointers.size === 1) {
      const dx = e.clientX - pan.x;
      const dy = e.clientY - pan.y;
      if (Math.hypot(dx, dy) > 6) moved = true;
      if (view.scale > 1.01 && moved) {
        stage.classList.add('is-panning');
        const d = measureDims();
        const clamped = clampPan(pan.tx + dx, pan.ty + dy, view.scale, d.stageW, d.stageH, d.imgW, d.imgH);
        view = { scale: view.scale, tx: clamped.tx, ty: clamped.ty };
        applyView();
      }
    }
  });

  const endPointer = (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    stage.classList.remove('is-panning');
    if (pointers.size < 2) pinch = null;

    if (e.type === 'pointerup' && pan && pointers.size === 0) {
      const dx = e.clientX - pan.x;
      const dy = e.clientY - pan.y;
      if (view.scale <= 1.01) {
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.2) {
          step(dx < 0 ? 1 : -1);
          lastTap = { time: 0, x: 0, y: 0 };
        } else if (!moved) {
          const now = Date.now();
          if (pan.target === img && now - lastTap.time < DOUBLE_TAP_MS && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < DOUBLE_TAP_DIST) {
            toggleZoomAt(e.clientX, e.clientY);
            lastTap = { time: 0, x: 0, y: 0 };
          } else {
            lastTap = pan.target === img ? { time: now, x: e.clientX, y: e.clientY } : { time: 0, x: 0, y: 0 };
            if (pan.target === stage) close();
          }
        }
      } else if (!moved && pan.target === img) {
        const now = Date.now();
        if (now - lastTap.time < DOUBLE_TAP_MS && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < DOUBLE_TAP_DIST) {
          toggleZoomAt(e.clientX, e.clientY);
          lastTap = { time: 0, x: 0, y: 0 };
        } else {
          lastTap = { time: now, x: e.clientX, y: e.clientY };
        }
      }
    }
    if (pointers.size === 1 && view.scale > 1.01) {
      const [rem] = [...pointers.values()];
      pan = { x: rem.x, y: rem.y, tx: view.tx, ty: view.ty, target: img, pointerType: e.pointerType };
    } else if (pointers.size === 0) {
      pan = null;
    }
  };
  stage.addEventListener('pointerup', endPointer);
  stage.addEventListener('pointercancel', endPointer);

  // На десктопе: колесо с Ctrl/щипком или двойной клик мышью масштабирует работу в контейнере.
  stage.addEventListener('wheel', (e) => {
    if (!e.ctrlKey && view.scale <= 1.01) return;
    e.preventDefault();
    const d = measureDims();
    const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.002));
    view = zoomAroundPoint(view, view.scale * factor, e.clientX, e.clientY, d.cx, d.cy, d);
    applyView();
  }, { passive: false });

  window.addEventListener('resize', () => {
    if (!dlg.open || view.scale <= 1.01) return;
    const d = measureDims();
    const clamped = clampPan(view.tx, view.ty, view.scale, d.stageW, d.stageH, d.imgW, d.imgH);
    view = { scale: view.scale, tx: clamped.tx, ty: clamped.ty };
    applyView();
  });

  return open;
}
