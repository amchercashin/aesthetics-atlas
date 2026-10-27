// На телефоне шапка уезжает вверх при прокрутке вниз и возвращается при прокрутке вверх:
// экран остаётся содержимому. На карте страница не прокручивается — там шапка на месте.
// Шапку двигает top липкого блока, а не transform: transform сделал бы её контейнером
// для fixed-навигации внизу экрана.
const NARROW = '(max-width: 760px)';
const STEP = 8; // меньше — дрожание пальца, а не намерение

export function initHeaderAutoHide(header) {
  const narrow = matchMedia(NARROW);
  const root = document.documentElement;
  let lastY = window.scrollY, frame = 0;
  const set = (away) => root.classList.toggle('header-away', away);
  const update = () => {
    frame = 0;
    const y = window.scrollY;
    if (!narrow.matches || document.body.dataset.view === 'map' || y < header.offsetHeight) { set(false); lastY = y; return; }
    if (y > lastY + STEP) set(true);
    else if (y < lastY - STEP) set(false);
    else return;
    lastY = y;
  };
  window.addEventListener('scroll', () => { frame ||= requestAnimationFrame(update); }, { passive: true });
  narrow.addEventListener('change', () => set(false));
  // Фокус с клавиатуры не должен уходить в спрятанную шапку.
  header.addEventListener('focusin', () => set(false));
}
