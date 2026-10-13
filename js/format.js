// Форматирование дат, подписей и множественного числа.
export const NOW = new Date().getFullYear();

const group = (n) => (Math.abs(n) >= 10000 ? String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') : String(Math.abs(n)));

export function fmtYear(y, { short = false } = {}) {
  if (y == null) return 'наши дни';
  if (y < 0) return `${group(y)}${short ? ' до н. э.' : ' до н. э.'}`;
  return String(y);
}

export function fmtDates(s) {
  if (s.dates) return s.dates;
  if (s.start < 0 && s.end != null && s.end < 0) return `${group(s.start)} – ${group(s.end)} до н. э.`;
  return `${fmtYear(s.start)} – ${s.end == null ? 'наши дни' : fmtYear(s.end)}`;
}

export const RELATION = {
  evolved: { label: 'развитие', from: 'вырос из', to: 'развился в' },
  influence: { label: 'влияние', from: 'под влиянием', to: 'повлиял на' },
  reaction: { label: 'реакция', from: 'реакция на', to: 'вызвал реакцию' },
  revival: { label: 'возрождение', from: 'возрождает', to: 'возрождён в' },
};

export const DOMAIN = {
  art: 'Искусство',
  architecture: 'Архитектура',
  design: 'Дизайн',
  internet: 'Интернет и цифра',
};

export function plural(n, one, few, many) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
}
