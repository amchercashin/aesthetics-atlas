// Блок «Нарисовать с ИИ»: промт виден до клика; ниже — открыть в ChatGPT, скопировать, другой вариант.
// Общий для зала стиля и «Удиви меня» на главной; что считать «другим вариантом», решает вызывающий.
import { html } from '../html.js';
import { chatgptUrl } from '../prompt.js';
import { toast } from './toast.js';

const EXT = html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M14 5h5v5M19 5l-8 8M17 14v5H5V7h5"/></svg>`;
const COPY_LABEL = 'Скопировать промт';

export function aiPromptBody(prompt = '') {
  return html`<p class="ai-prompt" data-ai-text aria-live="polite">${prompt}</p>
    <div class="ai-actions">
      <a class="btn" data-ai-open href="${chatgptUrl(prompt)}" target="_blank" rel="noopener">Открыть в ChatGPT${EXT}<span class="visually-hidden"> (в новой вкладке)</span></a>
      <button class="btn ghost" type="button" data-ai-copy>${COPY_LABEL}</button>
      <button class="btn ghost" type="button" data-ai-next>Другой вариант</button>
      <span class="visually-hidden" role="status" data-ai-status></span>
    </div>
    <p class="ai-hint">В России ChatGPT открывается только через VPN. Скопированный промт можно вставить в Шедеврум или ГигаЧат.</p>`;
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
  const status = box.querySelector('[data-ai-status]');
  let timer;
  const set = (prompt) => {
    text.textContent = prompt;
    open.href = chatgptUrl(prompt);
  };
  const onClick = async (e) => {
    if (e.target.closest('[data-ai-next]')) { set(next()); return; }
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
  return {
    set,
    destroy() { box.removeEventListener('click', onClick); clearTimeout(timer); },
  };
}
