// Все места показа работ: основной пример, галерея и сравнительный корпус.
export const worksOf = (style) => [style.example, ...(style.gallery ?? []), ...(style.corpus ?? [])].filter(Boolean);

// Считаются размещения, а не уникальные произведения: одна работа может быть и примером, и частью корпуса.
export function imageUsage(styles) {
  const embedded = styles.flatMap(worksOf).filter((work) => work.img);
  return {
    embedded: embedded.length,
    corpus: styles.flatMap((style) => style.corpus ?? []).filter((work) => work.img).length,
    nonfree: embedded.filter((work) => work.img.nonfree).length,
    withoutBasis: embedded.filter((work) => work.img.nonfree && !work.img.rights?.basis).length,
  };
}
