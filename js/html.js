// Безопасные HTML-шаблоны: все подстановки экранируются, кроме явно помеченных raw().
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

class Raw { constructor(s) { this.s = s; } toString() { return this.s; } }
export const raw = (s) => new Raw(String(s));

function render(v) {
  if (v == null || v === false) return '';
  if (v instanceof Raw) return v.s;
  if (Array.isArray(v)) return v.map(render).join('');
  return esc(v);
}

export function html(strings, ...vals) {
  let out = strings[0];
  vals.forEach((v, i) => { out += render(v) + strings[i + 1]; });
  return new Raw(out);
}

// Только https и внутренние hash-ссылки.
export const safeUrl = (u) => (/^(https:\/\/|#\/)/.test(String(u ?? '')) ? u : '#/');

export function mount(el, tpl) { el.innerHTML = String(tpl); return el; }
