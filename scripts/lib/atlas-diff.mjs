// Сравнение двух data/atlas.json по карточкам: что изменилось у каждой. Чистая функция без сети.
// Нужна, чтобы отделить дрейф данных Commons (палитры, метаданные файлов) от правок партии.

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Изображения сравниваются отдельно: подпись из YAML и сведения о файле с Commons (img/external).
function imageChanges(a = {}, b = {}) {
  const out = [];
  const file = (x) => ({ img: x?.img ?? null, external: x?.external ?? null });
  const own = (x) => { const { img, external, ...rest } = x ?? {}; return rest; };
  if (!same(own(a), own(b))) out.push('caption');
  if (!same(file(a), file(b))) out.push('file');
  return out;
}

function listChanges(a = [], b = []) {
  if (a.length !== b.length) return ['count'];
  return [...new Set(a.flatMap((x, i) => imageChanges(x, b[i])))];
}

export function diffAtlas(before, after) {
  const top = Object.keys({ ...before, ...after })
    .filter((k) => !['styles', 'builtAt'].includes(k) && !same(before[k], after[k]));
  const prev = new Map(before.styles.map((s) => [s.id, s]));
  const next = new Map(after.styles.map((s) => [s.id, s]));
  const styles = [];
  for (const id of new Set([...prev.keys(), ...next.keys()])) {
    const a = prev.get(id), b = next.get(id);
    if (!a || !b) { styles.push({ id, fields: [a ? 'removed' : 'added'] }); continue; }
    const fields = [];
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (same(a[k], b[k])) continue;
      if (k === 'example') fields.push(...imageChanges(a[k], b[k]).map((x) => `example.${x}`));
      else if (k === 'gallery' || k === 'corpus') fields.push(...listChanges(a[k], b[k]).map((x) => `${k}.${x}`));
      else fields.push(k);
    }
    if (fields.length) styles.push({ id, fields });
  }
  return { top, styles };
}

// Только палитра и сведения о файлах с Commons — так выглядит дрейф при сборке без кэша.
export const DRIFT_FIELDS = new Set(['palette', 'example.file', 'gallery.file', 'corpus.file']);
export const isDrift = (change) => change.fields.every((f) => DRIFT_FIELDS.has(f));
