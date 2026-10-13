// Полноэкранный просмотр работы.
export function initLightbox() {
  const dlg = document.querySelector('.lightbox');
  if (!dlg) return () => {};
  dlg.querySelector('[data-close]').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  return function open(img, caption) {
    const el = dlg.querySelector('img');
    el.src = img.src[1280] ?? img.src[960];
    el.alt = caption;
    dlg.querySelector('figcaption').textContent = caption;
    dlg.showModal();
  };
}
