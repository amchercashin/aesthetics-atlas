// Картинки: srcset из реальных ширин, плейсхолдер из палитры, атрибуция, фолбэк на палитра-карточку.
import { html, esc, safeUrl, raw } from '../html.js';

const WIDTHS = [250, 500, 960, 1280];

export function placeholder(palette) {
  const c = palette?.colors ?? [];
  if (!c.length) return 'var(--paper-3)';
  return `linear-gradient(160deg, ${c[0]} 0%, ${c[1] ?? c[0]} 55%, ${c[2] ?? c[0]} 100%)`;
}

export function srcset(img) {
  if (img.local && img.kind !== 'work') return ''; // локальная SVG-схема
  const seen = new Set();
  const parts = [];
  const add = (url, w) => {
    if (!url || seen.has(url)) return;
    seen.add(url);
    parts.push(`${url} ${w}w`);
  };
  if (img.local || img.mirrored) {
    const thumb = img.src[500] ?? img.src[250];
    const full = img.src[1280] ?? img.src[960] ?? thumb;
    if (thumb && full && thumb !== full) {
      add(thumb, Math.min(480, img.w));
      add(full, img.w);
      return parts.join(', ');
    }
    return '';
  }
  for (const w of WIDTHS) if (w < img.w) add(img.src[w], w);
  if (img.w <= 1280) add(img.src[1280] ?? img.src[960], img.w);
  return parts.join(', ');
}

// Запасные адреса меньших размеров: если upload.wikimedia.org не отвечает или таймаутит,
// браузер автоматически пробует thumb.wikimedia.org (500 / 250) вместо заглушки.
export function fallbacksOf(img, primaryUrl) {
  const out = [];
  for (const w of [960, 500, 250]) {
    const u = img.src?.[w];
    if (u && u !== primaryUrl && !out.includes(u)) out.push(u);
  }
  return out;
}

export function imgTag(img, { sizes = '100vw', alt = '', eager = false, size = 500 } = {}) {
  if (!img) return '';
  const src = img.src[size] ?? img.src[500];
  const fbs = fallbacksOf(img, src);
  const fbAttr = fbs.length ? html` data-fb="${fbs.join('|')}"` : '';
  return html`<img src="${src}" srcset="${srcset(img)}" sizes="${sizes}" width="${img.w}" height="${img.h}" alt="${alt}"${fbAttr} ${eager ? '' : raw('loading="lazy"')} decoding="async" referrerpolicy="no-referrer">`;
}

export function paletteCard(palette, note) {
  const c = palette?.colors ?? [];
  return html`<span class="palette-card" aria-hidden="true">${c.map((col) => html`<i style="background:${col}"></i>`)}</span>
    ${note ? html`<span class="palette-card-note">${note}</span>` : ''}`;
}

// Рамка с работой. ratio: 'natural' | число | строка CSS aspect-ratio
export function frame(img, palette, { ratio = 'natural', sizes, alt, eager, fit = 'cover', note, size, capUpscale = false } = {}) {
  const ar = ratio === 'natural' ? (img ? `${img.w} / ${img.h}` : '4 / 3') : ratio;
  // Маленькие превью (обычно fair use) не растягиваем больше чем в 1,6 раза — иначе они «мылятся».
  const cap = capUpscale && img && img.w < 700 ? `;max-width:${Math.round(img.w * 1.6)}px` : '';
  const arn = img ? (img.w / img.h).toFixed(4) : '1.3333';
  return html`<span class="art-frame ${fit === 'contain' ? 'contain' : ''}" style="--ar:${ar};--arn:${arn};--ph:${placeholder(palette)}${cap}">
    ${img ? imgTag(img, { sizes, alt, eager, size }) : paletteCard(palette, note)}
  </span>`;
}

const NONFREE_TITLE = 'Работа защищена авторским правом. Превью низкого разрешения взято из английской Википедии, где оно используется по её собственному обоснованию fair use. Это обоснование не переносится автоматически на атлас.';

// Подпись к изображению: автор фотографии или репродукции, лицензия файла, статус прав.
// Лицензия фотографии не распространяется на изображённое произведение.
export function credit(img) {
  if (!img) return '';
  if (img.local) {
    if (img.kind === 'work') {
      const who = img.artist || 'автор не указан';
      const r = img.rights ?? {};
      return html`<p class="credit">
        ${img.nonfree ? html`<span class="badge-fair" title="${NONFREE_TITLE}">несвободное</span>` : ''}${who}${img.license ? `, ${img.license}` : ''}.
        <a href="${safeUrl(img.page)}" target="_blank" rel="noopener">Источник</a>
        ${img.nonfree ? html`<span class="credit-note">${r.basis ? `Основание: ${r.basis}` : 'Основание использования в атласе ещё не проверено.'}</span>` : ''}
        ${r.note ? html`<span class="credit-note">${r.note}</span>` : ''}
      </p>`;
    }
    const source = /^assets\/illustrations\/[a-z0-9-]+\.svg$/.test(img.page ?? '') ? img.page : '#/';
    return html`<p class="credit">${img.artist}. Иллюстрация создана для атласа.
      <a href="${source}" target="_blank" rel="noopener">SVG-исходник</a></p>`;
  }
  const who = (img.artist || 'автор не указан').replace(/(Unknown author)(?:\s*Unknown author)+/gi, '$1');
  const r = img.rights ?? {};
  return html`<p class="credit">
    ${img.nonfree ? html`<span class="badge-fair" title="${NONFREE_TITLE}">несвободное</span>` : ''}${who}${img.license ? `, ${img.license}` : ''}.
    <a href="${safeUrl(img.page)}" target="_blank" rel="noopener">${img.page?.includes('commons.wikimedia') ? 'Wikimedia Commons' : 'Википедия'}</a>
    ${img.nonfree ? html`<span class="credit-note">${r.basis ? `Основание: ${r.basis}` : 'Основание использования в атласе ещё не проверено.'}</span>` : ''}
    ${r.note ? html`<span class="credit-note">${r.note}</span>` : ''}
  </p>`;
}

// Подписи: плавное проявление при загрузке и замена на палитру при ошибке (load/error не всплывают — ловим на захвате).
export function initImageEvents(root = document) {
  root.addEventListener('load', (e) => {
    if (e.target.tagName === 'IMG' && e.target.closest('.art-frame, .thumb, .node-thumb')) e.target.classList.add('is-loaded');
  }, true);
  root.addEventListener('error', (e) => {
    const img = e.target;
    if (img.tagName !== 'IMG') return;
    if (img.dataset.fb) {
      const rest = img.dataset.fb.split('|').filter(Boolean);
      const next = rest.shift();
      img.dataset.fb = rest.join('|');
      if (next) {
        img.removeAttribute('srcset');
        img.src = next;
        return;
      }
    }
    const frameEl = img.closest('.art-frame');
    if (frameEl) { img.remove(); frameEl.insertAdjacentHTML('beforeend', '<span class="palette-card-note">Изображение недоступно</span>'); }
    else img.style.visibility = 'hidden';
  }, true);
}

export function markLoaded(root) {
  root.querySelectorAll('img').forEach((img) => { if (img.complete && img.naturalWidth) img.classList.add('is-loaded'); });
}

export { esc };
