// Мелкие общие куски разметки.
import { html } from '../html.js';
import { fmtDates } from '../format.js';
import { frame } from './image.js';

export function eraTag(store, eraId, { link = true } = {}) {
  const e = store.era(eraId);
  if (!e) return '';
  return link
    ? html`<a class="era-tag" href="#/timeline?era=${e.id}"><span class="swatch" style="--c:var(--era-${e.id})"></span>${e.name}</a>`
    : html`<span class="era-tag"><span class="swatch" style="--c:var(--era-${e.id})"></span>${e.name}</span>`;
}

export function styleLink(s) {
  return html`<a href="#/s/${s.id}">${s.name}</a>`;
}

export function thumb(s, size = 52) {
  return html`<span class="thumb" style="--ph:${frameBg(s)}">${s.example.img ? html`<img src="${s.example.img.src[250]}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" width="${size}" height="${size}">` : ''}</span>`;
}

function frameBg(s) {
  const c = s.palette?.colors ?? [];
  return c.length ? `linear-gradient(160deg, ${c[0]}, ${c[1] ?? c[0]} 60%, ${c[2] ?? c[0]})` : 'var(--paper-3)';
}

export { frameBg };

export function footer(store) {
  return html`<footer class="site-footer">
    <span>Атлас эстетик, ${store.styles.length} стилей. Данные от ${store.builtAt}.</span>
    <span>Изображения — Wikimedia Commons и Википедия, авторы указаны под каждой работой.</span>
    <a href="#/about">О проекте и источниках</a>
  </footer>`;
}

export function styleCaption(s) {
  return html`<span class="cap-name">${s.name}</span><span class="cap-dates">${fmtDates(s)}</span>`;
}

export { frame };
