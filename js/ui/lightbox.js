// Полноэкранный просмотр работы с листанием.
export function initLightbox() {
  const dlg = document.querySelector('.lightbox');
  if (!dlg) return () => {};
  const img = dlg.querySelector('img');
  const cap = dlg.querySelector('.lb-caption');
  const count = dlg.querySelector('.lb-count');
  const prev = dlg.querySelector('[data-prev]');
  const next = dlg.querySelector('[data-next]');
  let items = [];
  let index = 0;

  const render = () => {
    const item = items[index];
    if (!item) return;
    img.src = item.img.src[1280] ?? item.img.src[960] ?? item.img.src[500];
    img.alt = item.caption || '';
    cap.textContent = item.caption || '';
    count.textContent = items.length > 1 ? `${index + 1} / ${items.length}` : '';
    dlg.toggleAttribute('data-single', items.length <= 1);
    prev.disabled = index === 0;
    next.disabled = index === items.length - 1;
    const pre = items[index + 1];
    if (pre?.img.src[960]) { const im = new Image(); im.src = pre.img.src[960]; }
  };

  const open = (input, captionOrIndex) => {
    if (Array.isArray(input)) {
      items = input.filter((x) => x?.img);
      index = Math.max(0, Math.min(items.length - 1, Number(captionOrIndex) || 0));
    } else {
      items = [{ img: input, caption: captionOrIndex || '' }];
      index = 0;
    }
    if (!items.length) return;
    render();
    if (!dlg.open) dlg.showModal();
    dlg.querySelector('[data-close]').focus({ preventScroll: true });
  };

  const step = (d) => {
    const i = index + d;
    if (i < 0 || i >= items.length) return;
    index = i;
    render();
  };

  dlg.querySelector('[data-close]').addEventListener('click', () => dlg.close());
  prev.addEventListener('click', () => step(-1));
  next.addEventListener('click', () => step(1));
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  dlg.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
    if (e.key === 'Home') { e.preventDefault(); index = 0; render(); }
    if (e.key === 'End') { e.preventDefault(); index = items.length - 1; render(); }
  });

  // Свайп на тач-устройствах.
  let startX = 0;
  img.addEventListener('pointerdown', (e) => { startX = e.clientX; });
  img.addEventListener('pointerup', (e) => {
    const dx = e.clientX - startX;
    if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
  });

  return open;
}
