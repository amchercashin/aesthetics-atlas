// Точка входа: данные, тема, поиск, роутинг между видами.
import { loadAtlas } from './store.js';
import { parseHash } from './router.js';
import { initTheme } from './theme.js';
import { initSearch } from './ui/search-dialog.js';
import { initLightbox } from './ui/lightbox.js';
import { initImageEvents, markLoaded } from './ui/image.js';
import { initHeaderAutoHide } from './ui/header.js';
import { initFavoritesBadge } from './favorites.js';
import { html, mount } from './html.js';

const app = document.getElementById('app');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let current = null;
let routeSeq = 0;

function setNav(view) {
  document.querySelectorAll('[data-nav]').forEach((a) => {
    if (a.dataset.nav === view) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
}

async function route(base, { first = false } = {}) {
  const r = parseHash();
  // Старый адрес карточки (после разделения или переименования) — на действующий, без лишней записи в истории.
  if (r.view === 'style') {
    const id = base.store.resolve(r.id);
    if (id && id !== r.id) { history.replaceState(null, '', `#/s/${id}`); r.id = id; }
  }
  const seq = ++routeSeq;
  setNav(r.view);
  if (current && current.view === r.view && current.instance?.update && r.view !== 'style') {
    current.instance.update({ ...base, ...r });
    return;
  }
  const preload = [];
  if (r.view === 'style' && base.store.has(r.id)) preload.push(base.store.loadStyle(r.id));
  if (r.view === 'compare') {
    for (const key of ['a', 'b']) {
      const id = base.store.resolve(r.params?.get(key) ?? '');
      if (id) preload.push(base.store.loadStyle(id));
    }
  }
  const [mod] = await Promise.all([import(`./views/${r.view}.js`), ...preload]);
  if (seq !== routeSeq) return;
  const swap = () => {
    current?.instance?.destroy?.();
    document.body.removeAttribute('style');
    document.body.dataset.view = r.view;
    app.replaceChildren();
    const instance = mod.default.render(app, { ...base, ...r });
    current = { view: r.view, instance };
    markLoaded(app);
    if (!first) {
      window.scrollTo(0, 0);
      app.focus({ preventScroll: true });
    }
  };
  if (!first && document.startViewTransition && !reduceMotion.matches && document.visibilityState === 'visible') {
    const vt = document.startViewTransition(swap);
    // Переход может прерваться (быстрая навигация, скрытая вкладка) — это не ошибка.
    vt.ready.catch(() => {});
    vt.finished.catch(() => {});
    vt.updateCallbackDone.catch(() => {});
  } else swap();
}

async function boot() {
  initTheme(document.querySelector('.theme-toggle'));
  initHeaderAutoHide(document.querySelector('.site-header'));
  initImageEvents();
  let store;
  try {
    store = await loadAtlas();
  } catch (e) {
    mount(app, html`<div class="error-state">Не удалось загрузить атлас: ${e.message}. Обновите страницу.</div>`);
    return;
  }
  const base = { store, openLightbox: initLightbox() };
  initSearch(store);
  initFavoritesBadge(store);
  document.querySelector('.skip-link')?.addEventListener('click', (e) => { e.preventDefault(); app.focus(); });
  // Хэши, не начинающиеся с «#/» (например, ссылка «К содержимому» → #app), — не маршруты.
  window.addEventListener('hashchange', () => { if (!location.hash || location.hash.startsWith('#/')) route(base); });
  route(base, { first: true });
}

boot();






