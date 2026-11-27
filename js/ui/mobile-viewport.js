// Защита мобильного интерфейса от случайного зума страницы (щипок в Safari/WebKit,
// мультитач вне полотна карты/лайтбокса) и синхронизация видимой высоты экрана
// (--vvh / --vv-top) при появлении экранной клавиатуры.

export function shouldBlockTouchMove(e) {
  if ((e.touches?.length ?? 0) > 1) return true;
  if (typeof e.scale === 'number' && Number.isFinite(e.scale) && e.scale !== 1) return true;
  return false;
}

export function isTouchDevice(win = window, nav = navigator) {
  return (nav?.maxTouchPoints ?? 0) > 0 || 'ontouchstart' in win;
}

export function initMobileViewport({ win = window, doc = document, nav = navigator } = {}) {
  const root = doc.documentElement;
  const cleanups = [];
  const on = (target, ev, fn, opts) => {
    target.addEventListener(ev, fn, opts);
    cleanups.push(() => target.removeEventListener(ev, fn, opts));
  };

  // Синхронизируем реальную видимую высоту (важно в iOS Safari, где 100dvh не уменьшается
  // при открытии экранной клавиатуры, из-за чего списки поиска уходят под клавиатуру).
  const vv = win.visualViewport;
  const syncViewport = () => {
    const h = vv ? vv.height : win.innerHeight;
    const top = vv ? vv.offsetTop : 0;
    if (Number.isFinite(h) && h > 0) root.style.setProperty('--vvh', `${Math.round(h)}px`);
    if (Number.isFinite(top)) root.style.setProperty('--vv-top', `${Math.max(0, Math.round(top))}px`);
  };
  syncViewport();
  if (vv) {
    on(vv, 'resize', syncViewport, { passive: true });
    on(vv, 'scroll', syncViewport, { passive: true });
  }
  on(win, 'resize', syncViewport, { passive: true });
  on(win, 'orientationchange', syncViewport, { passive: true });

  // На сенсорных устройствах (iPhone, iPad, Android) запрещаем браузерный щипок по всей странице.
  // Внутреннее увеличение карты (.map-stage) и лайтбокса (.lb-stage) работает через PointerEvent
  // внутри своих контейнеров с touch-action: none, не масштабируя сам интерфейс.
  if (isTouchDevice(win, nav)) {
    const blockGesture = (e) => { if (e.cancelable !== false) e.preventDefault(); };
    on(doc, 'gesturestart', blockGesture, { passive: false });
    on(doc, 'gesturechange', blockGesture, { passive: false });
    on(doc, 'gestureend', blockGesture, { passive: false });

    on(doc, 'touchmove', (e) => {
      if (shouldBlockTouchMove(e) && e.cancelable !== false) e.preventDefault();
    }, { passive: false });
  }

  // После закрытия экранной клавиатуры в iOS Safari фиксированный экран карты иногда остаётся
  // слегка сдвинутым по скроллу — возвращаем viewport в (0, 0).
  let resetTimer = 0;
  on(doc, 'focusout', (e) => {
    if (!e.target?.matches?.('input, select, textarea')) return;
    clearTimeout(resetTimer);
    resetTimer = setTimeout(() => {
      const active = doc.activeElement;
      if (active?.matches?.('input, select, textarea')) return;
      if (doc.body?.dataset?.view === 'map' && (win.scrollX !== 0 || win.scrollY !== 0)) {
        win.scrollTo(0, 0);
      }
      syncViewport();
    }, 80);
  });

  return () => {
    clearTimeout(resetTimer);
    cleanups.forEach((fn) => fn());
  };
}
