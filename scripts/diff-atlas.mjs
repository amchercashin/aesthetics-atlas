// Что изменилось в data/atlas.json по карточкам:
//   node scripts/diff-atlas.mjs                       → закоммиченный (HEAD) против рабочего
//   node scripts/diff-atlas.mjs old.json new.json     → два файла
//   node scripts/diff-atlas.mjs --expect id1,id2      → ошибка, если менялось что-то кроме дрейфа у других карточек
import { diffAtlas, isDrift } from './lib/atlas-diff.mjs';
import { loadBuiltAtlas, loadGitAtlas } from './lib/load-atlas.mjs';

const args = process.argv.slice(2);
const expectAt = args.indexOf('--expect');
const expected = expectAt >= 0 ? new Set(args.splice(expectAt, 2)[1]?.split(',').filter(Boolean)) : null;
const before = args[0] ? loadBuiltAtlas(args[0]) : loadGitAtlas('HEAD');
const after = loadBuiltAtlas(args[1] ?? '.');

const { top, styles } = diffAtlas(before, after);
const drift = styles.filter(isDrift);
const edits = styles.filter((c) => !isDrift(c));
if (top.length) console.log(`Общие разделы: ${top.join(', ')}`);
console.log(`Правки (${edits.length}):`);
for (const c of edits) console.log(`  ${c.id}: ${c.fields.join(', ')}`);
console.log(`Только дрейф Commons — палитра и сведения о файлах (${drift.length}):`);
for (const c of drift) console.log(`  ${c.id}: ${c.fields.join(', ')}`);

if (expected) {
  const stray = edits.filter((c) => !expected.has(c.id));
  if (stray.length) {
    console.error(`\nИзменены карточки вне партии: ${stray.map((c) => c.id).join(', ')}`);
    process.exit(1);
  }
}
