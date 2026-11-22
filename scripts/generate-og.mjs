// Генерация обложки 1200×630 для Open Graph / Telegram / соцсетей (assets/og-cover.png).
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

import { plural } from '../js/format.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export async function generateOgCover(styleCount = 231) {
  const stylesWord = plural(styleCount, 'визуальный стиль', 'визуальных стиля', 'визуальных стилей');
  const pigments = [
    '#c05d1d', '#1e82b0', '#a7041c', '#91791a', '#596cda', '#913a9d',
    '#01734a', '#c22d1f', '#1d3fbf', '#932065', '#0683aa', '#693aa6',
  ];
  const barW = 1040 / pigments.length;
  const bars = pigments.map((c, i) => `<rect x="${80 + i * barW}" y="536" width="${barW - 4}" height="12" rx="2" fill="${c}"/>`).join('');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
    <rect width="1200" height="630" fill="#f2f1ee"/>
    <!-- Декоративные контуры морей в духе гравюрной карты справа -->
    <g fill="none" stroke-linecap="round" transform="translate(80, 0)">
      <path d="M770 72 C845 34, 965 44, 1055 98 C1105 140, 1098 242, 1035 292 C965 342, 860 332, 798 282 C735 232, 725 112, 770 72 Z" fill="#596cda" fill-opacity="0.09" stroke="#596cda" stroke-opacity="0.38" stroke-width="2"/>
      <path d="M792 98 C855 66, 952 74, 1028 118 C1068 152, 1062 232, 1012 272 C954 312, 868 304, 816 264 C766 222, 756 128, 792 98 Z" stroke="#596cda" stroke-opacity="0.2" stroke-width="1.2"/>
      <path d="M815 124 C865 98, 938 106, 998 138 C1028 164, 1024 222, 986 250 C940 280, 875 275, 836 244 C796 212, 790 144, 815 124 Z" stroke="#596cda" stroke-opacity="0.12" stroke-width="1"/>
      <path d="M855 316 C922 288, 1038 296, 1098 352 C1126 396, 1102 464, 1038 484 C956 502, 862 478, 826 426 C798 384, 812 336, 855 316 Z" fill="#c05d1d" fill-opacity="0.09" stroke="#c05d1d" stroke-opacity="0.38" stroke-width="2"/>
      <path d="M876 340 C930 318, 1020 324, 1068 368 C1088 400, 1070 450, 1020 464 C954 478, 882 460, 852 420 C830 390, 842 354, 876 340 Z" stroke="#c05d1d" stroke-opacity="0.18" stroke-width="1.2"/>
      <path d="M745 365 C790 342, 848 368, 866 416 C878 456, 848 486, 798 482 C746 478, 714 446, 718 408 C720 386, 730 374, 745 365 Z" fill="#01734a" fill-opacity="0.09" stroke="#01734a" stroke-opacity="0.38" stroke-width="2"/>
      <path d="M855 188 Q925 168 978 210 T1012 384" stroke="#1a1a1c" stroke-opacity="0.45" stroke-width="2" stroke-dasharray="6 5"/>
      <path d="M855 188 C862 282, 816 348, 794 422" stroke="#1a1a1c" stroke-opacity="0.38" stroke-width="1.8"/>
      <circle cx="855" cy="188" r="5.5" fill="#2f43b8"/>
      <circle cx="978" cy="210" r="5.5" fill="#c22d1f"/>
      <circle cx="1012" cy="384" r="5.5" fill="#c05d1d"/>
      <circle cx="794" cy="422" r="5" fill="#01734a"/>
    </g>
    <!-- Знак бренда -->
    <g transform="translate(80, 74)">
      <rect width="42" height="42" rx="9" fill="#2f43b8"/>
      <g fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" transform="scale(1.75)">
        <path d="M7 19V6M7 14c0-3.5 4-5.5 10-6M7 17.5c2.5-1 5-1.6 8-1.6"/>
      </g>
      <g fill="#fff" transform="scale(1.75)">
        <circle cx="7" cy="6" r="1.9"/><circle cx="17" cy="8" r="1.9"/><circle cx="15" cy="15.9" r="1.9"/>
      </g>
      <text x="58" y="30" font-family="Georgia, 'Times New Roman', serif" font-size="28" font-weight="500" fill="#1a1a1c">Атлас эстетик</text>
    </g>
    <!-- Заголовок -->
    <text x="80" y="212" font-family="Georgia, 'Times New Roman', serif" font-size="60" font-weight="400" fill="#1a1a1c">Как люди придумывали</text>
    <text x="80" y="282" font-family="Georgia, 'Times New Roman', serif" font-size="60" font-weight="400" fill="#1a1a1c">красоту: от пещеры</text>
    <text x="80" y="352" font-family="Georgia, 'Times New Roman', serif" font-size="60" font-weight="400" fill="#1a1a1c">Ласко до уирдкора</text>
    <!-- Подзаголовок -->
    <text x="80" y="422" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="23" fill="#44433f">${styleCount} ${stylesWord} · карта родословной,</text>
    <text x="80" y="454" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="23" fill="#44433f">главные работы и промты для ИИ</text>
    <!-- Полоса 12 пигментов эпох -->
    ${bars}
    <text x="80" y="582" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="17" fill="#69675f">amchercashin.github.io/aesthetics-atlas</text>
  </svg>`;

  const out = path.join(ROOT, 'assets/og-cover.png');
  await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(out);
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const out = await generateOgCover();
  console.log('Generated', out);
}
