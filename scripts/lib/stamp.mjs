// Единое версионирование JS и CSS в index.html без ручных ?v= в исходниках.
// Генерирует <script type="importmap"> для всех ES-модулей в js/ и единый ?v=<hash> для CSS/main.js.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

function listFiles(dir, ext, base = dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...listFiles(abs, ext, base));
    else if (e.name.endsWith(ext)) out.push(path.relative(base, abs).replace(/\\/g, '/'));
  }
  return out.sort();
}

export function stampAssets(root, dataVersion = '') {
  const jsDir = path.join(root, 'js');
  const cssDir = path.join(root, 'css');
  const jsFiles = listFiles(jsDir, '.js', root);
  const cssFiles = listFiles(cssDir, '.css', root);

  const hashOf = (rel) => crypto.createHash('sha1').update(fs.readFileSync(path.join(root, rel))).digest('hex').slice(0, 8);
  const imports = {};
  for (const rel of jsFiles) {
    const h = hashOf(rel);
    imports[`./${rel}`] = `./${rel}?v=${h}`;
  }

  const indexPath = path.join(root, 'index.html');
  let html = fs.readFileSync(indexPath, 'utf8');

  // Обновляем версии CSS и main.js
  for (const rel of cssFiles) {
    const h = hashOf(rel);
    const re = new RegExp(`href="${rel.replace(/\./g, '\\.')}(?:\\?v=[^"]*)?"`, 'g');
    html = html.replace(re, `href="${rel}?v=${h}"`);
  }
  const mainHash = hashOf('js/main.js');
  html = html.replace(/src="js\/main\.js(?:\?v=[^"]*)?"/, `src="js/main.js?v=${mainHash}"`);

  // Обновляем или вставляем meta atlas-data-version (для кэш-бастинга data/index.json)
  if (dataVersion) {
    const metaTag = `<meta name="atlas-version" content="${dataVersion}">`;
    if (/<meta name="atlas-version"[^>]*>/.test(html)) {
      html = html.replace(/<meta name="atlas-version"[^>]*>/, metaTag);
    } else {
      html = html.replace('</head>', `  ${metaTag}\n</head>`);
    }
  }

  // Вставляем единый importmap перед </head>
  const mapBlock = `  <!-- build:importmap -->\n  <script type="importmap">\n${JSON.stringify({ imports }, null, 2).replace(/^/gm, '  ')}\n  </script>\n  <!-- /build:importmap -->`;
  if (/<!-- build:importmap -->[\s\S]*?<!-- \/build:importmap -->/.test(html)) {
    html = html.replace(/[ \t]*<!-- build:importmap -->[\s\S]*?<!-- \/build:importmap -->/, mapBlock);
  } else {
    html = html.replace('</head>', `${mapBlock}\n</head>`);
  }

  fs.writeFileSync(indexPath, html);
  return { jsCount: jsFiles.length, cssCount: cssFiles.length, mainHash };
}
