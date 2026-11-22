// Единое чтение собранного атласа из data/index.json + data/styles/<id>.json
// (или из устаревшего монолита data/atlas.json, если передан прямой путь).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

export function loadBuiltAtlas(rootOrFile) {
  const stat = fs.existsSync(rootOrFile) ? fs.statSync(rootOrFile) : null;
  if (stat?.isFile()) return JSON.parse(fs.readFileSync(rootOrFile, 'utf8'));

  const indexPath = path.join(rootOrFile, 'data/index.json');
  if (fs.existsSync(indexPath)) {
    const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
    const sourcesMap = new Map();
    const styles = index.styles.map((brief) => {
      const sp = path.join(rootOrFile, 'data/styles', `${brief.id}.json`);
      if (!fs.existsSync(sp)) return brief;
      const full = JSON.parse(fs.readFileSync(sp, 'utf8'));
      for (const src of full.sources ?? []) sourcesMap.set(src.id, src);
      const { sources: _s, ...card } = full;
      return { ...brief, ...card };
    });
    return { ...index, sources: [...sourcesMap.values()], styles };
  }
  const legacy = path.join(rootOrFile, 'data/atlas.json');
  return JSON.parse(fs.readFileSync(legacy, 'utf8'));
}

// Загрузить собранный атлас из коммита git (для scripts/diff-atlas.mjs).
export function loadGitAtlas(ref = 'HEAD') {
  const show = (p) => execFileSync('git', ['show', `${ref}:${p}`], { encoding: 'utf8', maxBuffer: 64 << 20 });
  try {
    const index = JSON.parse(show('data/index.json'));
    const sourcesMap = new Map();
    const styles = index.styles.map((brief) => {
      try {
        const full = JSON.parse(show(`data/styles/${brief.id}.json`));
        for (const src of full.sources ?? []) sourcesMap.set(src.id, src);
        const { sources: _s, ...card } = full;
        return { ...brief, ...card };
      } catch {
        return brief;
      }
    });
    return { ...index, sources: [...sourcesMap.values()], styles };
  } catch {
    return JSON.parse(show('data/atlas.json'));
  }
}
