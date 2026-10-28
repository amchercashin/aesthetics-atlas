# Журнал сверки карточек и галерей, 2026

Сверка закрывает issues №44 (галереи), №45 (111 карточек, где сверены только связи), №46 (две черновые карточки) и №48 (81 карточка с неполной сверкой). Метод, стандарт сверки и порядок партий — в [плане](superpowers/plans/2026-10-28-card-review.md). Состав issues на снимке `106a4f9` — в [card-review-2026-issues.json](card-review-2026-issues.json). Текущий остаток показывает `npm run review-status`.

Журнал записывает то, чего не видно в самих карточках: что было исправлено (было → стало, по какому источнику), что снято, какие изображения заменены и почему, что не удалось сверить. Что подтверждено, видно в `evidence`, `sources` и `review.note` карточек.

## Партии

| Партия | Файл | PR | Дата | Карточек | Изображений галереи | Состояние |
|---|---|---|---|---|---|---|
| 0 | подготовка: сборка, валидатор, лайтбокс, отчёт | [#55](https://github.com/amchercashin/aesthetics-atlas/pull/55) | 28.10.2026 | — | — | готова, ждёт слияния |
| 1 | `01-prehistory.yaml` (пилот) | | | 6 | 15 | не начата |
| 02 | `02-ancient.yaml` | | | 9 | 21 | не начата |
| 03 | `03-antiquity.yaml` | | | 7 | 16 | не начата |
| 04 | `04-medieval.yaml` | | | 13 | 28 | не начата |
| 05 | `05-renaissance.yaml` | | | 13 | 26 | не начата |
| 06a | `06-xix.yaml`: neoclassicism … peredvizhniki | | | 8 | 16 | не начата |
| 06b | `06-xix.yaml`: historicism … impressionism | | | 7 | 14 | не начата |
| 07 | `07-fin-de-siecle.yaml` | | | 10 | 20 | не начата |
| 08a | `08-avant-garde.yaml`: cubism … surrealism | | | 10 | 20 | не начата |
| 08b | `08-avant-garde.yaml`: de-stijl … mexican-muralism | | | 10 | 21 | не начата |
| 09a | `09-postwar.yaml`: abstract-expressionism … metabolism | | | 9 | 19 | не начата |
| 09b | `09-postwar.yaml`: pop-art … computer-art | | | 9 | 18 | не начата |
| 10 | `10-postmodern.yaml` | | | 14 | 28 | не начата |
| 11 | `11-digital.yaml` | | | 12 | 24 | не начата |
| 12a | `12-internet.yaml`: vaporwave … weirdcore | | | 8 | 18 | не начата |
| 12b | `12-internet.yaml`: dreamcore … alien-core | | | 8 | 16 | не начата |
| 13 | `13-pilot.yaml` | | | 12 | 31 | не начата |
| 14 | `14-regional-traditions.yaml` | | | 10 | 30 | не начата |
| 15 | `15-regional-graphics.yaml` | | | 10 | 30 | не начата |
| 16 | `16-regional-languages.yaml` | | | 10 | 27 | не начата |

## Партия 0. Подготовка (28.10.2026)

Карточки по содержанию не сверялись. Что изменилось:

- **Статусы.** 19 карточек со статусом `reviewed` переведены в `partial`: у них сверены описание и корпус, даты и корпус или только корпус, а связи, главная иллюстрация и галерея — нет. `scope`, дата и заметка не менялись. Это `khokhloma`, `emily-kngwarray`, `zverev-portrait-graphics`, `shahzia-sikander`, `carrolup-school`, `rei-kawakubo`, `pacita-abad`, `esther-mahlangu`, `reko-rennie`, `hokusai-landscape-prints`, `norshtein-animation`, `zhostovo-painting`, `palekh-miniature`, `tongan-ngatu`, `kalighat-painting`, `asante-kente`, `bogolanfini`, `gorodets-painting`, `bengal-patachitra`.
- **Строка автора снимка.** Сборка очищает поле Artist с Commons от служебного текста; это изменило автора у 28 изображений: 18 «Unknown authorUnknown author» и «Unknown artistUnknown artist» и одно «anonymous» → «автор неизвестен», 2 текста шаблона «photo of 2D work more than 100 years old» убраны, 3 «No machine-readable author provided. X assumed…» → «X (предположительно)», 3 ссылки сведены к имени, 1 склейка разделена.
- **Дрейф данных.** Пересборка без кэша сдвинула палитры 24 карточек и оформление сведений о файле у 6 изображений галерей; отдельный коммит без правок карточек.
- **Старые отметки без следов.** По `npm run review-status` на 28.10.2026 у 30 карточек заявленные части сверки не оставили следа, которого теперь требует стандарт: чаще всего у главной иллюстрации нет `whyRepresentative` или источника подписи. Это долг; он закрывается в партиях.

Замечено попутно, разбирается в своих партиях:

- `glitch-art`, первое изображение галереи: на картинке подпись «RAWVAMP», а в атласе автор — «Неизвестный автор», `credit` — «Glitch art archive» (партия 11).
- `warli-painting`: одно изображение с Commons приходит с автором «Jean-Pierre Dalb�ra». Символ замены стоит в самом описании файла на Commons (рядом на той же странице есть правильное «Dalbéra»), сборка его не исправляет (партия 15).
- `npm run check-links` 28.10.2026: 634 ссылки, 5 битых, 154 не проверить (403, 429 и подобные). Все 5 битых — `reference` локальных копий в галереях, то есть адрес, откуда копия якобы взята, не открывается (404): `high-renaissance` — страница «Афинской школы» на сайте Музеев Ватикана (партия 05); `postmodern-architecture` — страница 550 Madison у SOM, `punk-graphics` — статья V&A о панке (партия 10); `reko-rennie` — статья en.wikipedia «Reko Rennie» (партия 13); `torres-strait-printmaking` — статья en.wikipedia «Torres Strait Islander art» (партия 16).

## Шаблон раздела партии

```
## Партия NN. `файл` (дата, PR)

Карточек: N; изображений галереи: M; новых источников: K; контрольная выборка: X утверждений и Y изображений.

### `id`
- Исправлено: было → стало (источник `id`).
- Снято: … (почему).
- Изображения: заменено … (почему); подписи …
- Открыто: …
```
