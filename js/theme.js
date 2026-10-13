// Переключатель темы: системная по умолчанию, выбор пользователя запоминается.
const KEY = 'atlas-theme';
const media = window.matchMedia('(prefers-color-scheme: dark)');

export const currentTheme = () => document.documentElement.dataset.theme || (media.matches ? 'dark' : 'light');

export function initTheme(button) {
  button?.addEventListener('click', () => {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem(KEY, next); } catch { /* приватный режим */ }
    window.dispatchEvent(new CustomEvent('themechange', { detail: next }));
  });
  media.addEventListener?.('change', () => window.dispatchEvent(new CustomEvent('themechange', { detail: currentTheme() })));
}
