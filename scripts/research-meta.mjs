// Пересчитать счётчики meta в research/expansion/catalog.json по записям и вывести числа для README:
//   npm run research:meta                 → пересчитать meta, сохранить при изменениях и вывести сводку
//   npm run research:meta -- --check      → проверить без записи (код 1, если счётчики устарели)
//   npm run research:meta -- --format     → принудительно нормализовать построчный формат catalog.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  applyResearchMeta,
  isCanonicalCatalogText,
  updateCatalogMetaText,
  formatReadmeSummary,
} from './lib/research-meta.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const checkOnly = args.includes('--check');
const forceFormat = args.includes('--format');
const catalogFlag = args.indexOf('--catalog');
const catalogPath = catalogFlag >= 0 && args[catalogFlag + 1]
  ? path.resolve(args[catalogFlag + 1])
  : path.join(ROOT, 'research/expansion/catalog.json');

const raw = fs.readFileSync(catalogPath, 'utf8');
const catalog = JSON.parse(raw);
const { nextMeta, changed, changes, stats } = applyResearchMeta(catalog);
const canonical = isCanonicalCatalogText(raw, catalog.items.length);

let wrote = false;
let reformatted = !canonical;

if (!checkOnly) {
  if (changed || !canonical || forceFormat) {
    const updated = updateCatalogMetaText(raw, nextMeta, { reformat: forceFormat });
    reformatted = updated.reformatted;
    if (updated.text !== raw) {
      fs.writeFileSync(catalogPath, updated.text, 'utf8');
      wrote = true;
    }
  }
}

console.log(formatReadmeSummary(stats, { changes, wrote, reformatted, checkOnly }));

if (checkOnly && changed) {
  process.exitCode = 1;
}
