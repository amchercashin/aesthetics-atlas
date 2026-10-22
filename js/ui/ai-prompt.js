// Блок «Нарисовать с ИИ»: компактный — в зале под палитрой, на главной в первом экране.
// Начало промта видно сразу (три строки, целиком — по кнопке); ниже — открыть в ChatGPT и скопировать.
// Что считать «другим вариантом», решает вызывающий.
import { html } from '../html.js';
import { chatgptUrl } from '../prompt.js';
import { toast } from './toast.js';

const EXT = html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M14 5h5v5M19 5l-8 8M17 14v5H5V7h5"/></svg>`;
const SHUFFLE = html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h3.5c2 0 3.2 1 4.3 2.7l1.4 2.2c1.1 1.7 2.3 2.6 4.3 2.6H20M4 16.5h3.5c1.2 0 2.1-.3 2.9-1M14.6 8.6c.8-.9 1.7-1.6 2.9-1.6H20M17.5 4.5 20 7l-2.5 2.5M17.5 14 20 16.5 17.5 19"/></svg>`;
const COPY_LABEL = 'Скопировать промт';

// Заголовок блока; «Другой вариант» — тихая ссылка-кнопка, чтобы блок не спорил с работой и палитрой.
export function aiHead(id, { nextHidden = false } = {}) {
  return html`<div class="ai-head">
    <h2 class="ai-title" id="${id}">Нарисовать с ИИ</h2>
    <button class="ai-next" type="button" data-ai-next ${nextHidden ? html`hidden` : ''}>${SHUFFLE}Другой вариант</button>
  </div>`;
}

export function aiPromptBody(prompt = '', { id, note = '' } = {}) {
  return html`<p class="ai-prompt" id="${id}" data-ai-text tabindex="-1" aria-live="polite">${prompt}</p>
    <button class="ai-more" type="button" data-ai-more aria-expanded="false" aria-controls="${id}" hidden>Весь промт</button>
    <div class="ai-actions">
      <a class="btn" data-ai-open href="${chatgptUrl(prompt)}" target="_blank" rel="noopener">Открыть в ChatGPT${EXT}<span class="visually-hidden"> (в новой вкладке)</span></a>
      <button class="btn ghost" type="button" data-ai-copy>${COPY_LABEL}</button>
      <span class="visually-hidden" role="status" data-ai-status></span>
    </div>
    <p class="ai-hint">${note ? `${note} ` : ''}В России ChatGPT открывается только через VPN. Скопированный промт можно вставить в Шедеврум или ГигаЧат.</p>`;
}

async function copyText(text, el) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Буфер недоступен (нет https или разрешения): выделяем промт, чтобы его можно было скопировать вручную.
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { /* остаётся выделение */ }
    if (ok) sel.removeAllRanges();
    return ok;
  }
}

// next() возвращает новый промт; set(prompt) обновляет текст и ссылку снаружи.
export function mountAiPrompt(box, { next }) {
  const text = box.querySelector('[data-ai-text]');
  const open = box.querySelector('[data-ai-open]');
  const copyBtn = box.querySelector('[data-ai-copy]');
  const more = box.querySelector('[data-ai-more]');
  const status = box.querySelector('[data-ai-status]');
  let timer;
  // «Весь промт» нужен, только если текст не уместился в три строки.
  const syncMore = () => {
    if (text.classList.contains('is-open')) return;
    more.hidden = text.scrollHeight <= text.clientHeight + 1;
  };
  const expand = (on) => {
    text.classList.toggle('is-open', on);
    more.setAttribute('aria-expanded', String(on));
    more.textContent = on ? 'Свернуть' : 'Весь промт';
    syncMore();
  };
  const set = (prompt) => {
    text.textContent = prompt;
    open.href = chatgptUrl(prompt);
    expand(false);
  };
  const onClick = async (e) => {
    if (e.target.closest('[data-ai-next]')) { set(next()); return; }
    if (e.target.closest('[data-ai-more]')) { expand(!text.classList.contains('is-open')); return; }
    if (!e.target.closest('[data-ai-copy]')) return;
    if (await copyText(text.textContent, text)) {
      copyBtn.textContent = 'Скопировано';
      status.textContent = 'Промт скопирован';
      clearTimeout(timer);
      timer = setTimeout(() => { copyBtn.textContent = COPY_LABEL; status.textContent = ''; }, 1800);
    } else {
      toast('Промт выделен — скопируйте его вручную');
    }
  };
  box.addEventListener('click', onClick);
  const resize = new ResizeObserver(syncMore);
  resize.observe(text);
  syncMore();
  return {
    set,
    destroy() { box.removeEventListener('click', onClick); resize.disconnect(); clearTimeout(timer); },
  };
}
