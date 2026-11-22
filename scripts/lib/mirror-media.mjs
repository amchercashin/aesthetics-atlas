// Локальное зеркалирование изображений Wikimedia в оптимизированный WebP (assets/media/).
// Сайт перестаёт зависеть от доступности upload.wikimedia.org / thumb.wikimedia.org,
// а повторные сборки работают полностью офлайн и без дрейфа палитр.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { UA, CACHE_DIR, cleanWikimediaUrl } from './wikimedia.mjs';
import { mapLimit } from './palette.mjs';

const IMG_CACHE = path.join(CACHE_DIR, 'img');
const MAX_W = 1280;
const THUMB_W = 480;

export function mediaStem(site, name) {
  const hash = crypto.createHash('sha1').update(`${site}:${name}`).digest('hex').slice(0, 8);
  const slug = String(name ?? '')
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32) || 'img';
  return `${slug}-${hash}`;
}

async function fileSize(p) {
  try { return (await fs.stat(p)).size; } catch { return 0; }
}

async function fetchTimed(url, timeoutMs = 15000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, 'Api-User-Agent': UA },
      signal: ctrl.signal,
    });
    if (res.status === 429 || res.status >= 500) {
      await res.body?.cancel?.();
      const ra = Number(res.headers.get('retry-after'));
      throw Object.assign(new Error(`HTTP ${res.status}`), { retryable: true, retryAfter: Number.isFinite(ra) ? ra : 0 });
    }
    if (!res.ok) {
      await res.body?.cancel?.();
      throw new Error(`HTTP ${res.status}`);
    }
    return Buffer.from(await res.arrayBuffer());
  } finally {
    clearTimeout(timer);
  }
}

async function fetchWithBackoff(url, timeoutMs) {
  let delay = 1200;
  for (let i = 0; i < 4; i++) {
    try {
      return await fetchTimed(url, timeoutMs);
    } catch (e) {
      if (!e.retryable || i === 3) throw e;
      await new Promise((r) => setTimeout(r, e.retryAfter > 0 ? e.retryAfter * 1000 : delay));
      delay *= 2;
    }
  }
  throw new Error(`Failed: ${url}`);
}

async function readCachedImg(urls) {
  for (const raw of urls) {
    if (!raw) continue;
    const h = crypto.createHash('sha1').update(raw).digest('hex') + '.bin';
    const p = path.join(IMG_CACHE, h);
    try {
      const buf = await fs.readFile(p);
      if (buf.length > 0) return buf;
    } catch { /* нет в локальном кэше */ }
  }
  return null;
}

// Сформировать упорядоченный список URL-кандидатов для скачивания.
// Для больших файлов сразу берём thumb.wikimedia.org 1280/960 (быстро и без таймаутов).
// Для маленьких (w <= 960) сначала пробуем upload.wikimedia.org с коротким таймаутом,
// затем thumb.wikimedia.org 500 / 250.
function candidateUrls(m) {
  const seen = new Set();
  const list = [];
  const push = (u, timeoutMs) => {
    const clean = cleanWikimediaUrl(u);
    if (!clean || seen.has(clean)) return;
    seen.add(clean);
    list.push({ url: clean, timeoutMs });
  };
  const t = m.thumbs ?? {};
  const isThumbHost = (u) => typeof u === 'string' && u.includes('thumb.wikimedia.org');

  // 1. Высокое разрешение с thumb.wikimedia.org (960 / 1280)
  for (const w of [1280, 960]) if (isThumbHost(t[w])) push(t[w], 15000);
  // 2. Оригинал / upload (короткий таймаут на случай блокировки домена)
  for (const w of [1280, 960, 500]) if (t[w] && !isThumbHost(t[w])) push(t[w], 4000);
  if (m.url) push(m.url, 4000);
  // 3. Меньшие превью с thumb.wikimedia.org (500 / 250)
  for (const w of [500, 250]) if (isThumbHost(t[w])) push(t[w], 15000);
  // 4. Любой оставшийся адрес
  for (const w of [500, 250]) if (t[w]) push(t[w], 4000);
  return list;
}

// Для каждого уникального Wikimedia-файла гарантирует наличие локальных WebP в assets/media/.
// Мутирует/возвращает обновлённую запись с локальными путями в thumbs и ссылкой на локальный файл для палитр.
export async function mirrorWikimediaAssets(media, root, { offline = false, log = () => {} } = {}) {
  const dir = path.join(root, 'assets/media');
  await fs.mkdir(dir, { recursive: true });

  // Уникальные Wikimedia-файлы по ключу site:name
  const unique = new Map();
  const refsByKey = new Map();
  for (const [ref, m] of media) {
    if (!m || m.missing || m.local) continue;
    const key = `${m.site}:${m.name}`;
    if (!unique.has(key)) { unique.set(key, m); refsByKey.set(key, []); }
    refsByKey.get(key).push(ref);
  }

  let downloaded = 0, fromDisk = 0, fromCache = 0;
  const entries = [...unique.entries()];

  await mapLimit(entries, 6, async ([key, m]) => {
    const stem = mediaStem(m.site, m.name);
    const mainRel = `assets/media/${stem}.webp`;
    const thumbRel = `assets/media/${stem}-480.webp`;
    const mainAbs = path.join(root, mainRel);
    const thumbAbs = path.join(root, thumbRel);

    let mainW, mainH;
    if (await fileSize(mainAbs) > 0) {
      const meta = await sharp(mainAbs).metadata();
      mainW = meta.width; mainH = meta.height;
      if (mainW > 520 && !(await fileSize(thumbAbs))) {
        await sharp(mainAbs).resize(THUMB_W, THUMB_W, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 76, effort: 5 }).toFile(thumbAbs);
      }
      fromDisk++;
    } else {
      let buf = null;
      if (!offline) {
        for (const cand of candidateUrls(m)) {
          try {
            const raw = await fetchWithBackoff(cand.url, cand.timeoutMs);
            // Проверяем, что буфер действительно декодируется как картинка (а не HTML-страница ошибки)
            const meta = await sharp(raw).metadata();
            if (meta.width && meta.height) { buf = raw; break; }
          } catch { /* пробуем следующий размер/источник */ }
        }
      }
      if (!buf) {
        const rawCacheUrls = [
          m.thumbs?.[250], m.thumbs?.[500], m.url,
          ...(m.rawCacheUrls ?? []),
        ];
        buf = await readCachedImg(rawCacheUrls);
        if (buf) fromCache++;
      } else {
        downloaded++;
      }
      if (!buf) throw new Error(`Failed to mirror Wikimedia image "${m.name}" (${m.site})`);

      // Для SVG с Wikimedia увеличиваем плотность, для растра просто конвертируем в WebP.
      const sharpOpts = m.mime === 'image/svg+xml' ? { density: 150 } : { pages: 1 };
      const out = await sharp(buf, sharpOpts)
        .rotate()
        .resize(MAX_W, MAX_W, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 78, effort: 5 })
        .toFile(mainAbs);
      mainW = out.width; mainH = out.height;
      if (mainW > 520) {
        await sharp(mainAbs).resize(THUMB_W, THUMB_W, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 76, effort: 5 }).toFile(thumbAbs);
      }
      if ((downloaded + fromCache) % 50 === 0) {
        log(`  mirror: ${downloaded + fromCache}/${entries.length - fromDisk} processed`);
      }
    }

    const useThumb = mainW > 520 && (await fileSize(thumbAbs)) > 0;
    const tRel = useThumb ? thumbRel : mainRel;
    const palettePath = useThumb ? thumbAbs : mainAbs;
    const updated = {
      ...m,
      width: mainW,
      height: mainH,
      mirrored: true,
      palettePath,
      thumbs: { 250: tRel, 500: tRel, 960: mainRel, 1280: mainRel },
    };
    for (const ref of refsByKey.get(key)) media.set(ref, updated);
  });

  log(`  mirror: ${entries.length} Wikimedia images local (${fromDisk} existing, ${downloaded} downloaded, ${fromCache} from cache)`);
}
