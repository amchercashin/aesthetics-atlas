# Программа расширения каталога — план и трекер

> **Для исполнителя.** Владелец запускает сессию с ID работы из этого файла: «Возьми партию A-01 из `docs/superpowers/plans/2026-11-13-expansion-program.md` и доведи до слияния по плану». Сначала прочитайте «Порядок для любой сессии» и раздел своего потока. Одна работа — одна ветка `expansion/<id>` от свежего `main` — один PR. В своём PR обновляйте только свою строку трекера.

**Цель.** Довести очередь кандидатов (`research/expansion/catalog.json`) до решений: опубликованная сверенная карточка, объединение, отсрочка или отказ. Параллельно расширять саму очередь по зонам, которые ещё не исследованы. Кандидат — тема для исследования, а не обещание карточки: объединения и отказы — нормальный исход.

## Снимок

13.11.2026, `main` @ `1cd12a2`. На сайте 195 карточек. В очереди 575 записей: 42 уже стали карточками (`merged`), 533 — кандидаты: **P1 — 92, P2 — 418, R — 23**.

| Группа очереди | P1 | P2 | R | Всего |
| --- | ---: | ---: | ---: | ---: |
| Россия, Восточная Европа, Кавказ, Центральная Азия (`ru-eurasia`) | 14 | 54 | 3 | 71 |
| Америки и Карибы (`americas`) | 11 | 59 | 0 | 70 |
| Китай, Корея, Япония (`east-asia`) | 12 | 42 | 0 | 54 |
| Графический, предметный, архитектурный и модный дизайн (`graphic-fashion`) | 7 | 40 | 5 | 52 |
| Европа и международные движения (`europe`) | 9 | 40 | 1 | 50 |
| Южная Азия и Гималаи (`south-asia`) | 9 | 36 | 1 | 46 |
| Африка южнее Сахары и диаспоры (`africa`) | 7 | 35 | 1 | 43 |
| Австралия, Аотеароа, Тихий океан (`oceania`) | 5 | 28 | 1 | 34 |
| Ближний Восток и Северная Африка (`mena`) | 7 | 25 | 0 | 32 |
| Юго-Восточная Азия (`southeast-asia`) | 6 | 22 | 1 | 29 |
| Кино, анимация, игры, цифра (`screen-digital`) | 5 | 21 | 3 | 29 |
| Археология и дополнения (`additional`) | 0 | 15 | 0 | 15 |
| Формирующиеся эстетики (`contemporary`) | 0 | 1 | 7 | 8 |

Числа устаревают с каждой слитой партией. Пересчёт:

```bash
node -e 'const c=require("./research/expansion/catalog.json");const t={};for(const i of c.items){const r=t[i.group]??={};const k=i.admissionDecision==="candidate"?i.priority:i.admissionDecision;r[k]=(r[k]||0)+1}console.table(t)'
```

Зон исследования в [expansion-frontier.md](../../expansion-frontier.md) — 32. Одна разобрана (промышленный дизайн, PR #84), осталась 31.

**Объём.** P1 — 16 партий, P2 — около 60 партий по 6–8 тем, R — 2 сессии, направления — 31 сессия и больше (широкие зоны делятся), служебная — 1. Всего порядка 110 сессий. Направления добавят кандидатов, партии часть тем объединят или отклонят: числа поплывут в обе стороны.

## Потоки и параллельность

| Поток | Что делает | Меняет сайт | Результат |
| --- | --- | --- | --- |
| **A** — карточки | Берёт 4–8 кандидатов, сверяет и публикует карточки | Да | Новые карточки, решения в `catalog.json` |
| **B** — направления | Исследует зону frontier и заводит новых кандидатов | Нет | Записи в очереди, файл зоны |
| **R** — решения | Решает, нужны ли спорные темы с приоритетом R | Нет | Новый приоритет, объединение или отказ |
| **S** — служебный | Скрипты, которые упрощают параллельную работу | Нет | Код и тесты |

Правила параллельной работы:

- **Не больше одной сессии A на группу очереди одновременно.** У разных групп разные моря в `content/nebulae.yaml` и разные строки `catalog.json`, поэтому они почти не конфликтуют. Реалистично: 2 сессии A в разных группах и 1–2 сессии B.
- Сессии B и R можно запускать рядом с любыми другими.
- Каждая партия A пишет карточки в свой новый файл `content/styles/<id>-<slug>.yaml`: сборка читает папку по маске, нумерация файлов не важна.
- Перед слиянием — `git fetch` и rebase на свежий `main`. Конфликты разрешаются по типу файла:
  - сгенерированные (`data/atlas.json`, `docs/coverage.md`) — пересобрать, руками не сливать;
  - дописываемые (`content/sources.yaml`, журнал сверки, строки записей `catalog.json`, `relations.json`) — оставить обе стороны;
  - строка `meta` в `catalog.json` — пересчитать по записям (после S-01 — `npm run research:meta`).
- После rebase прогнать все проверки заново.

## Порядок для любой сессии

1. Прочитать `CLAUDE.md`, этот раздел и раздел своего потока.
2. Проверить, что работу никто не взял: `gh pr list --state open` и `git ls-remote origin 'refs/heads/expansion/*'`. Если ветка или PR уже есть — остановиться и сказать владельцу.
3. Создать ветку `expansion/<id в нижнем регистре>` от свежего `origin/main` и сразу запушить её: ветка на сервере — знак «в работе».
4. Сделать работу по разделу потока.
5. Rebase на свежий `main` по правилам выше, прогнать проверки потока.
6. Обновить свою строку трекера: статус «готово», PR, итог в одну строку.
7. Открыть PR и слить обычным merge-коммитом, когда проверки пройдены (правило из `CLAUDE.md`). Отчёт владельцу — коротко: что изменилось на сайте и что осталось открытым.

Если партия не уместилась в сессию: слить готовое, оставшиеся темы оставить `candidate` и перечислить в строке как остаток. Следующая сессия берёт остаток как `A-01b`. Стандарт не снижается: лучше меньше карточек, сверенных полностью.

## Поток A — карточки

**По каждой теме партии** работать по разделу «Для каждой карточки» в [expansion-workflow.md](../../expansion-workflow.md), по основаниям включения из [expansion-policy.md](../../expansion-policy.md) и по стандарту сверки из [плана сверки](2026-10-28-card-review.md). Источник цитируется, только если страницу открыли и прочитали сами.

- **Решение по теме** — одно из четырёх, записывается в `catalog.json` в том же PR, что и карточка (иначе `research:check` падает):
  - карточка опубликована — `admissionDecision: merged`, `productionCardId` = её id;
  - тема вошла в существующую карточку — `merged`, `productionCardId` = id той карточки, в `decisionNote` — куда и почему;
  - `deferred` или `rejected` — с причиной в `decisionNote`.

  Для `merged` нужны `decisionDate`, `decisionNote` и `verificationSources` — id из `content/sources.yaml`.
- **Карточка входит только полностью сверенной:** `review.status: reviewed`, полный `scope`, следы в `evidence`, корпус из 3–5 самостоятельных работ, `medium` и `subjects`, место ровно в одной части моря в `content/nebulae.yaml`.
- **Обзоры** (`overview`) проходят проверку полезности навигации и ясности охвата, а не четыре основания стиля. Одна картинка не представляет весь обзор.
- **Журнал:** раздел «Партия A-NN» в [журнале сверки](../../card-review-2026.md) — что добавлено, объединено, отложено и почему.

**Проверки перед слиянием:** `npm run build` без ошибок, `npm test`, `npm run review-status` (0), `npm run research:check`, `node scripts/diff-atlas.mjs --expect <id новых карточек>`, `npm run check-links <файл партии>`, снимки каждой новой карточки на 390 и 1440 и карта с новыми точками.

### Трекер P1

Порядок строк — рекомендуемый (по [сверке пробелов](../../catalog-gaps-2026-10-15.md)): сначала Юго-Восточная Азия, Африка, Восточная Азия, Россия и Центральная Азия. Пометка «обзор» — тема проверяется как обзор.

| ID | Тема партии | Кандидаты | Статус | PR | Итог |
| --- | --- | --- | --- | --- | --- |
| A-01 | Юго-Восточная Азия | `borobudur-art`, `indonesian-batik` (обзор), `nanyang-art`, `iban-pua-kumbu`, `tboli-tnalak`, `cheong-soo-pieng` | готово | #87 | 2 из 6: `borobudur-art`, `indonesian-batik` (обзор); остаток A-01b — `nanyang-art`, `cheong-soo-pieng`, `iban-pua-kumbu`, `tboli-tnalak` |
| A-01b | Юго-Восточная Азия, остаток A-01 | `nanyang-art`, `cheong-soo-pieng`, `iban-pua-kumbu`, `tboli-tnalak` | готово | #88 | 1 из 4: `iban-pua-kumbu`; отложены как A-01c — `nanyang-art` (только обзор термина, нужны записи NGS), `cheong-soo-pieng`, `tboli-tnalak` (сайт NCCA не открывается под VPN) |
| A-01c | Юго-Восточная Азия, остаток A-01b | `nanyang-art`, `cheong-soo-pieng`, `tboli-tnalak` | — | | Находки — в `furtherResearch`. `tboli-tnalak`: нет доступного корпуса атрибутированных тканей, NCCA не открывается; брать, когда найдётся собрание с записями |
| A-02 | Африка южнее Сахары | `benin-court-art`, `ethiopian-christian-art` (обзор), `congolese-popular-painting`, `kuba-textiles`, `zaria-art-society`, `ibrahim-el-salahi`, `zanele-muholi` | готово | #PR | 3 из 7: `benin-court-art`, `kuba-textiles`, `ethiopian-christian-art` (обзор); остаток A-02b — `congolese-popular-painting`, `zaria-art-society`, `ibrahim-el-salahi`, `zanele-muholi` |
| A-03 | Китай и Корея | `chinese-calligraphy` (обзор), `haipai-painting`, `lingnan-school`, `shamate`, `goryeo-celadon`, `buncheong`, `bojagi`, `dansaekhwa` | — | | |
| A-04 | Япония | `rinpa`, `shin-hanga`, `hiroshige-landscape-prints`, `ainu-attus-ornament` | — | | |
| A-05 | Россия и Украина: промыслы и рубеж веков | `gzhel-ceramics`, `petrykivka`, `perm-animal-style`, `neo-russian-style`, `vrubel-painting`, `bakst-stage-design`, `prymachenko-imagery` | — | | |
| A-06 | Советское и современное искусство | `filonov-analytical-art`, `sots-art`, `paper-architecture`, `polissky-land-art`, `aes-f-digital-tableaux` | — | | |
| A-07 | Пакистан; текстиль Южной и Центральной Азии | `pakistani-neo-miniature`, `pakistani-truck-art`, `ajrakh`, `kantha`, `central-asian-ikat`, `shyrdak` | — | | |
| A-08 | Австралия и Океания | `papunya-tula`, `yolngu-bark-painting`, `pacific-sisters`, `vanuatu-sand-drawing`, `palauan-bai-painting` | — | | |
| A-09 | Северная Америка | `northwest-coast-formline`, `inuit-printmaking`, `kenojuak-ashevak`, `norval-morrisseau`, `navajo-weaving`, `africobra` | — | | |
| A-10 | Латинская Америка и Карибы | `chicha-posters`, `haitian-popular-painting` (обзор), `guna-mola`, `mapuche-silverwork`, `tarsila-do-amaral` | — | | |
| A-11 | Живопись Индии | `gond-pardhan`, `jangarh-singh-shyam`, `pithora-painting`, `bengal-school`, `company-painting` (обзор) | — | | |
| A-12 | Ближний Восток и Магриб | `zellij`, `ottoman-miniature`, `ebru`, `al-qatt-al-asiri`, `saqqakhaneh`, `casablanca-school`, `monir-farmanfarmaian` | — | | |
| A-13 | Европа: графика и плакат | `beardsley-graphics`, `mucha-poster-language`, `polish-poster-school`, `ligne-claire` | — | | |
| A-14 | Европа: авторские языки и традиции | `hilma-af-klint`, `van-gogh-late-painting`, `matisse-cut-outs`, `art-brut` (обзор), `rosemaling`, `kosiv-ceramics` | — | | |
| A-15 | Промышленный дизайн и архитектура | `deutscher-werkbund`, `braun-rams-design`, `scandinavian-modern`, `italian-radical-design`, `soviet-industrial-design` (обзор), `tropical-modernism` (обзор) | — | | |
| A-16 | Кино и цифра | `german-expressionist-cinema`, `chinese-ink-animation`, `reiniger-animation`, `miyazaki-visual-worlds`, `vera-molnar` | — | | |

### Трекер P2

P2 нарезается при старте: сессия выбирает 6–8 тем своей группы, близких по региону, медиуму или эпохе, и записывает партию строкой в таблицу ниже. ID партии — код группы и номер: `A-RU-1`, `A-RU-2`… Одновременно в группе работает одна сессия, поэтому номера не пересекаются. Лучше начинать P2 группы, когда её P1 слит: соседние карточки уже есть, сравнивать проще.

| Код | Группа | Тем P2 | Партий, примерно |
| --- | --- | ---: | ---: |
| `A-RU` | `ru-eurasia` | 54 | 8 |
| `A-AM` | `americas` | 59 | 9 |
| `A-EA` | `east-asia` | 42 | 6 |
| `A-DS` | `graphic-fashion` | 40 | 6 |
| `A-EU` | `europe` | 40 | 6 |
| `A-SA` | `south-asia` | 36 | 6 |
| `A-AF` | `africa` | 35 | 5 |
| `A-OC` | `oceania` | 28 | 4 |
| `A-ME` | `mena` | 25 | 4 |
| `A-SE` | `southeast-asia` | 22 | 4 |
| `A-SC` | `screen-digital` | 21 | 3 |
| `A-AD` | `additional` | 15 | 3 |

Партии P2:

| ID | Кандидаты | Статус | PR | Итог |
| --- | --- | --- | --- | --- |
| | | | | |

## Поток B — направления

Каждая сессия разбирает одну зону из [expansion-frontier.md](../../expansion-frontier.md) по разделу «Процедура для новой ячейки». Широкие зоны (Китай, Индия, народы России, Северная Америка) можно делить: `B-07a`, `B-07b`, с границей раздела в строке трекера.

- **Файл зоны** `research/zones/B-NN-<slug>.md`: дата, прочитанные источники, найденные местные названия, сопоставление с карточками, их aliases и кандидатами; что добавлено, объединено с существующим кандидатом или отклонено — с причиной. Это защищает следующую сессию от повторного поиска.
- **Новые кандидаты** — в подходящую группу `catalog.json`, по схеме записей v2. Образец — записи промышленного дизайна из PR #84. Источник попадает в `sourceIds` только если страницу открыли: тогда он заносится в `research/expansion/sources.json` с `accessStatus: opened` и пределом поддержки в `supports`. Остальное — маршрут поиска в `furtherResearch`, `evidenceStatus: research-route-only`.
- Гипотезы связей — в `relations.json`, всегда `unverified`.
- Пересчитать `meta` в `catalog.json` и числа в README очереди. В строке frontier — только статус и ссылка на файл зоны.

**Проверки:** `npm run research:check`, `npm test`, `npm run build` и `node scripts/diff-atlas.mjs --expect ""` — 0 правок карточек. Если пересобранный `data/atlas.json` изменил только `builtAt`, в коммит он не идёт.

### Трекер B

Приоритет 1 — зоны, которые [сверка пробелов](../../catalog-gaps-2026-10-15.md) называет ближайшими; 3 — быстро меняющиеся сцены, где нужна дата наблюдения.

| ID | Зона | Приоритет | Статус | PR | Итог |
| --- | --- | ---: | --- | --- | --- |
| B-01 | Народы России | 1 | — | | |
| B-02 | Север и Сибирь | 1 | — | | |
| B-03 | Кавказ | 1 | — | | |
| B-04 | Восточная Европа и Балканы | 2 | — | | |
| B-05 | Центральная Азия | 1 | — | | |
| B-06 | Монголия и Гималаи | 2 | — | | |
| B-07 | Китай | 2 | — | | |
| B-08 | Корея | 2 | — | | |
| B-09 | Япония | 2 | — | | |
| B-10 | Индия | 2 | — | | |
| B-11 | Пакистан, Бангладеш, Непал, Шри-Ланка | 2 | — | | |
| B-12 | Юго-Восточная Азия | 1 | — | | |
| B-13 | Иран, Анатолия и арабский мир | 2 | — | | |
| B-14 | Северная Африка | 2 | — | | |
| B-15 | Западная Африка | 2 | — | | |
| B-16 | Центральная и Восточная Африка | 1 | — | | |
| B-17 | Южная Африка | 2 | — | | |
| B-18 | Индийский океан | 2 | — | | |
| B-19 | Австралия | 2 | — | | |
| B-20 | Меланезия | 1 | — | | |
| B-21 | Микронезия | 1 | — | | |
| B-22 | Полинезия | 2 | — | | |
| B-23 | Северная Америка | 2 | — | | |
| B-24 | Мезоамерика и Анды | 2 | — | | |
| B-25 | Карибы | 2 | — | | |
| B-26 | Южная Америка | 2 | — | | |
| B-27 | Еврейские и диаспорные практики | 2 | — | | |
| B-28 | Фотография | 2 | — | | |
| B-29 | Дизайн и типографика | 2 | — | | |
| B-30 | Промышленный дизайн | — | готово | #84 | 15 кандидатов; остальные направления — в строке frontier |
| B-31 | Новые визуальные практики | 3 | — | | |
| B-32 | Современные локальные тренды | 3 | — | | |

## Поток R — решения по спорным темам

R означает: сначала решить, нужен ли отдельный узел. По каждой теме — одно решение с причиной в `decisionNote` и `decisionDate`:

- остаётся кандидатом — новый приоритет P1 или P2;
- объединяется с другим кандидатом — `rejected`, в `decisionNote` «объединено с `<id>`», имена и признаки перенести в ту запись;
- входит в существующую карточку — `merged` с её `productionCardId`;
- `deferred` или `rejected`.

Для трендов и интернет-эстетик записать дату наблюдения и корпус: старая публикация или один вирусный пост не доказывают тренд. Сайт не меняется; проверки — как у потока B.

| ID | Темы | Статус | PR | Итог |
| --- | --- | --- | --- | --- |
| R-01 | Тренды и интернет-эстетики: `new-russian-folk-design`, `slavic-girl-aesthetic`, `post-soviet-doomer`, `indian-vernacular-maximalism`, `alte-lagos`, `hanfu-revival`, `sinofuturism`, `ps1-retro-aesthetic`; заодно P2 `calligraffiti` из той же группы | — | | |
| R-02 | Авторы и обзоры: `chalermchai-temple-art`, `thandiwe-muriu`, `lisa-reihana`, `anna-ridler-datasets`, `japanese-animation`, `contemporary-photography`, `architecture-models`, `science-fiction-illustration`, `populuxe-styling`, `blobject-design`, `picasso-synthetic-cubism`, `recycle-group-digital-reliefs`, `pokras-lampas-calligraphy`, `andrey-bartenev-costume`, `orijit-sen-graphics` | — | | |

## Поток S — служебный

Не обязателен для старта: A-01 и B можно начинать до него. Полезен, когда пойдут параллельные сессии B, потому что все они меняют строку `meta`.

| ID | Что сделать | Статус | PR |
| --- | --- | --- | --- |
| S-01 | `npm run research:meta` — пересчитать счётчики `meta` в `catalog.json` по записям (`totalCandidates`, `newCandidates`, `authorStyleCandidates`, `priorities`, `mergedCards`) и вывести числа для README. `npm run expansion-status` — таблица «группа × приоритет × решение» и список веток `expansion/*` на сервере. Тесты на оба скрипта. | — | |

## Готовые запросы для запуска

```text
Возьми партию A-01 из docs/superpowers/plans/2026-11-13-expansion-program.md и доведи до слияния по плану.
```

```text
Нарежь и сделай следующую партию P2 группы ru-eurasia (A-RU) по docs/superpowers/plans/2026-11-13-expansion-program.md.
```

```text
Исследуй направление B-12 из docs/superpowers/plans/2026-11-13-expansion-program.md по плану.
```

```text
Сделай R-01 из docs/superpowers/plans/2026-11-13-expansion-program.md по плану.
```
