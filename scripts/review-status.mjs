// Ход сверки карточек в Markdown:
//   npm run review-status                          → итог по issues №44–48 и таблица по всем файлам
//   npm run review-status -- 04-medieval.yaml      → итог и таблица одного файла
//   npm run review-status -- --checklist 45        → чек-лист issue по файлам (для текста issue)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { reviewStatus, toMarkdown, checklist } from './lib/review-status.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(ROOT, 'content/styles');
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.yaml')).sort()
  .map((file) => ({ file, styles: yaml.load(fs.readFileSync(path.join(dir, file), 'utf8')) ?? [] }));
const issues = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/card-review-2026-issues.json'), 'utf8'));
const report = reviewStatus(files, issues);

const args = process.argv.slice(2);
const at = args.indexOf('--checklist');
if (at >= 0) {
  const n = args[at + 1];
  if (!issues.issues[n]) { console.error(`Нет issue «${n}» в docs/card-review-2026-issues.json`); process.exit(1); }
  console.log(checklist(report, issues, n));
} else {
  const file = args.find((a) => a.endsWith('.yaml')) ?? null;
  if (file && !files.some((f) => f.file === file)) { console.error(`Нет файла content/styles/${file}`); process.exit(1); }
  console.log(toMarkdown(report, { file }));
}
