// Блок «Нарисовать с ИИ»: компактный — в зале под палитрой, на главной в первом экране.
// Начало промта видно сразу (три строки, целиком — по кнопке), копирование — значком в углу промта.
// Ниже — кнопки сервисов в их фирменных цветах: ChatGPT и Шедеврум открываются с подставленным промтом,
// ГигаЧат не принимает текст в адресе — его кнопка копирует промт и открывает сайт.
// Что считать «другим вариантом», решает вызывающий.
import { html } from '../html.js';
import { chatgptUrl, shedevrumUrl, GIGACHAT_URL } from '../prompt.js?v=ai-4';
import { toast } from './toast.js';

const SHUFFLE = html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h3.5c2 0 3.2 1 4.3 2.7l1.4 2.2c1.1 1.7 2.3 2.6 4.3 2.6H20M4 16.5h3.5c1.2 0 2.1-.3 2.9-1M14.6 8.6c.8-.9 1.7-1.6 2.9-1.6H20M17.5 4.5 20 7l-2.5 2.5M17.5 14 20 16.5 17.5 19"/></svg>`;
const COPY = html`<svg class="ai-copy-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M15.5 8.5V6.5a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2"/></svg>`;
const CHECK = html`<svg class="ai-check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>`;

// Сервисы с промтом в адресе; ссылки обновляются при каждом новом варианте.
const OPEN = { chatgpt: chatgptUrl, shedevrum: shedevrumUrl };

// Заголовок блока; «Другой вариант» — тихая ссылка-кнопка, чтобы блок не спорил с работой и палитрой.
export function aiHead(id, { nextHidden = false } = {}) {
  return html`<div class="ai-head">
    <h2 class="ai-title" id="${id}">Нарисовать с ИИ</h2>
    <button class="ai-next" type="button" data-ai-next ${nextHidden ? html`hidden` : ''}>${SHUFFLE}Другой вариант</button>
  </div>`;
}

export function aiPromptBody(prompt = '', { id, note = '' } = {}) {
  return html`<div class="ai-prompt-box">
      <p class="ai-prompt" id="${id}" data-ai-text tabindex="-1" aria-live="polite">${prompt}</p>
      <button class="ai-copy" type="button" data-ai-copy aria-label="Скопировать промт" title="Скопировать промт">${COPY}${CHECK}<span class="ai-copied" aria-hidden="true">Скопировано</span></button>
    </div>
    <button class="ai-more" type="button" data-ai-more aria-expanded="false" aria-controls="${id}" hidden>Весь промт</button>
    <ul class="ai-services">
      <li>
        <a class="btn ai-svc ai-svc-chatgpt" data-ai-open="chatgpt" href="${chatgptUrl(prompt)}" target="_blank" rel="noopener">ChatGPT<span class="visually-hidden">: открыть с промтом в новой вкладке</span></a>
        <span class="ai-svc-note">из России — через VPN</span>
      </li>
      <li>
        <a class="btn ai-svc ai-svc-shedevrum" data-ai-open="shedevrum" href="${shedevrumUrl(prompt)}" target="_blank" rel="noopener">Шедеврум<span class="visually-hidden">: открыть с промтом в новой вкладке</span></a>
        <span class="ai-svc-note">промт подставится</span>
      </li>
      <li>
        <a class="btn ai-svc ai-svc-giga" data-ai-giga href="${GIGACHAT_URL}" target="_blank" rel="noopener">ГигаЧат<span class="visually-hidden">: скопировать промт и открыть в новой вкладке</span></a>
        <span class="ai-svc-note">промт скопируется — вставьте</span>
      </li>
    </ul>
    <span class="visually-hidden" role="status" data-ai-status></span>
    ${note ? html`<p class="ai-hint">${note}</p>` : ''}`;
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

// next() возвращает новый промт; set(prompt) обновляет текст и ссылки снаружи.
export function mountAiPrompt(box, { next }) {
  const text = box.querySelector('[data-ai-text]');
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
    box.querySelectorAll('[data-ai-open]').forEach((a) => { a.href = OPEN[a.dataset.aiOpen](prompt); });
    expand(false);
  };
  const announce = (msg) => {
    status.textContent = msg;
    clearTimeout(timer);
    timer = setTimeout(() => { copyBtn.classList.remove('is-done'); status.textContent = ''; }, 1800);
  };
  const onClick = async (e) => {
    if (e.target.closest('[data-ai-next]')) { set(next()); return; }
    if (e.target.closest('[data-ai-more]')) { expand(!text.classList.contains('is-open')); return; }
    // ГигаЧат: ссылка открывается как обычно, а промт в это время уходит в буфер.
    if (e.target.closest('[data-ai-giga]')) {
      if (await copyText(text.textContent, text)) {
        announce('Промт скопирован — вставьте его в ГигаЧат');
        toast('Промт скопирован — вставьте его в ГигаЧат');
      }
      return;
    }
    if (!e.target.closest('[data-ai-copy]')) return;
    if (await copyText(text.textContent, text)) {
      copyBtn.classList.add('is-done');
      announce('Промт скопирован');
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
