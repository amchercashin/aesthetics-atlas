# Техника стилей: модель, правило и сверка (27.10.2026)

Поле `medium` — чем сделаны работы стиля. По нему работает фильтр каталога «Техника»: запрос из [#40](https://github.com/amchercashin/aesthetics-atlas/issues/40) и с Хабра — «все стили скульптуры», «все барельефы».

## Модель

- **Несколько техник у одного стиля** — норма: `medium` — список. Фильтр находит стиль по любой его технике, зал стиля перечисляет все, тест проверяет, что стиль с несколькими техниками находится под каждой и ни под какой другой. Сейчас больше одной техники у 147 из 195 карточек, в среднем 2,5.
- **Словарь — 27 значений** (`scripts/lib/validate.mjs`, подписи — `MEDIUM` в `js/format.js`). 27.10.2026 добавлены мозаика, витраж и каллиграфия. Раньше мозаика Византии стояла под «Декоративным искусством», а витраж и каллиграфия не отражались никак.
- **«Универсальной» техники нет.** В отличие от сюжетов, техника — факт о работах, а не о том, во что стиль можно перенести. Иначе «Скульптура» показала бы почти весь атлас.

## Правило

Перечисляются все техники, которыми стиль известен, а не только техники трёх-пяти примеров карточки. У Северного Возрождения это живопись и гравюра Дюрера, у греческой классики — ещё рельеф фриза Парфенона и краснофигурная керамика. Второстепенное и единичное не ставится: бронзовая «Танцовщица» не делает искусство Древней Индии металлом.

У авторских и региональных карточек с ограниченным корпусом техники остаются в границах карточки: карточка Сикандер, например, прямо исключает поздние мозаику и анимацию.

Историческая мебель (ампир, бидермайер, модерн) идёт по «Декоративному искусству», промышленный дизайн вещей (Баухаус, Ульм, мидсенчури) — по «Предметному дизайну».

## Как проверено

1. **По спискам техник** (PR #52). Список каждой техники прочитан целиком: ошибочных значений нет, у 24 стилей стояли только техники примеров.
2. **По карточкам.** Каждая из 195 карточек сверена с тем, чем стиль известен: дополнены 54.
3. **Автоматически.** В тексте каждой карточки (описание, признаки, названия и материалы работ) искались слова всех техник, из `FACET_STEMS` в `js/catalog-filter.js`. Найдено 10 реальных пропусков, остальное — ложные срабатывания: «рисунок» в значении узора, «одежда» статуи, «металл» как имитация материала.
4. **Стили с одной техникой** просмотрены отдельно: дополнены укиё-э (живопись) и ямато-э (свитки — рукописная книга).
5. **Тесты:** у каждой карточки есть техника; у области «Архитектура» есть техника «архитектура»; стиль с несколькими техниками находится под каждой; мозаика, витраж и каллиграфия находят свои классические стили.

## Итоги

| Техника | Стилей |
| --- | ---: |
| Живопись | 92 |
| Рисунок | 13 |
| Печатная графика | 22 |
| Иллюстрация | 11 |
| Скульптура | 41 |
| Рельеф | 17 |
| Архитектура | 50 |
| Интерьер | 10 |
| Мозаика | 9 |
| Витраж | 4 |
| Декоративное искусство | 33 |
| Керамика | 18 |
| Текстиль | 14 |
| Металл | 13 |
| Мода | 14 |
| Графический дизайн | 22 |
| Типографика | 13 |
| Каллиграфия | 5 |
| Предметный дизайн | 8 |
| Фотография | 16 |
| Кино и анимация | 8 |
| Инсталляция | 8 |
| Цифровое искусство | 18 |
| Интерфейсы | 5 |
| Веб | 3 |
| Рукописная книга | 9 |
| Наскальное искусство | 3 |

Пограничные решения, оставленные как в карточках:
- лубяные полотна Полинезии и боголанфини размечены ещё и живописью: краска на них наносится кистью;
- лубок и няньхуа размечены иллюстрацией, хотя это скорее самостоятельные листы.

## Все карточки

«Добавлено» — техники, дописанные при сверке 27.10.2026; пусто — набор подтверждён без изменений.

| Стиль | Техники | Добавлено | Почему |
| --- | --- | --- | --- |
| [Палеолитическая наскальная живопись](https://amchercashin.github.io/aesthetics-atlas/#/s/paleolithic-cave-art) | живопись, наскальное искусство |  |  |
| [Палеолитические женские статуэтки](https://amchercashin.github.io/aesthetics-atlas/#/s/venus-figurines) | скульптура |  |  |
| [Искусство аборигенов Австралии](https://amchercashin.github.io/aesthetics-atlas/#/s/aboriginal-art) | живопись, наскальное искусство |  |  |
| [Петроглифы доисторических традиций](https://amchercashin.github.io/aesthetics-atlas/#/s/petroglyphs) | наскальное искусство |  |  |
| [Неолитическое искусство](https://amchercashin.github.io/aesthetics-atlas/#/s/neolithic-art) | живопись, скульптура, декоративное искусство, керамика | скульптура, живопись | Карточка: лепная керамика и фигурки; Росписи стен Чатал-Хююка (в работах карточки) |
| [Мегалиты Европы](https://amchercashin.github.io/aesthetics-atlas/#/s/megaliths) | архитектура |  |  |
| [Искусство Месопотамии](https://amchercashin.github.io/aesthetics-atlas/#/s/mesopotamian-art) | скульптура, рельеф, архитектура, мозаика, керамика | керамика, мозаика | Глазурованный кирпич ворот Иштар (признак карточки); мозаика Штандарта Ура и конусная мозаика Урука |
| [Древнеегипетское искусство](https://amchercashin.github.io/aesthetics-atlas/#/s/ancient-egypt) | живопись, скульптура, рельеф, архитектура, металл, рукописная книга | металл, рукописная книга | Золотая маска Тутанхамона (в работах); папирусы «Книги мёртвых» |
| [Искусство Древней Индии](https://amchercashin.github.io/aesthetics-atlas/#/s/ancient-indian-art) | живопись, скульптура, рельеф, архитектура | живопись | В работах карточки — росписи Аджанты |
| [Минойское искусство](https://amchercashin.github.io/aesthetics-atlas/#/s/minoan-art) | живопись, скульптура, керамика | скульптура | Статуэтки «богини со змеями» |
| [Искусство Древнего Китая](https://amchercashin.github.io/aesthetics-atlas/#/s/ancient-chinese-art) | живопись, скульптура, декоративное искусство, керамика, металл, каллиграфия | живопись, каллиграфия, декоративное искусство | Карточка: при Хань складываются каллиграфия и шёлковая живопись; росписи Могао; резьба по нефриту |
| [Искусство Мезоамерики](https://amchercashin.github.io/aesthetics-atlas/#/s/mesoamerican-art) | живопись, скульптура, рельеф, архитектура, керамика, рукописная книга | керамика, живопись, рукописная книга | Расписные сосуды майя, росписи Бонампака, кодексы |
| [Искусство Анд](https://amchercashin.github.io/aesthetics-atlas/#/s/andean-art) | архитектура, керамика, текстиль, металл |  |  |
| [Греческая архаика](https://amchercashin.github.io/aesthetics-atlas/#/s/greek-archaic) | скульптура, архитектура, керамика | архитектура | Первые каменные храмы и ордера |
| [Скифский звериный стиль](https://amchercashin.github.io/aesthetics-atlas/#/s/scythian-animal-style) | декоративное искусство, металл |  |  |
| [Искусство Ахеменидской Персии](https://amchercashin.github.io/aesthetics-atlas/#/s/achaemenid-art) | рельеф, архитектура, керамика, металл | металл, керамика | Золото Амударьинского клада; глазурованные кирпичные фризы Суз |
| [Кельтское искусство латенской эпохи](https://amchercashin.github.io/aesthetics-atlas/#/s/celtic-art) | декоративное искусство, металл |  |  |
| [Греческая классика](https://amchercashin.github.io/aesthetics-atlas/#/s/classical-greece) | скульптура, рельеф, архитектура, керамика | рельеф, керамика | Фриз Парфенона, краснофигурные вазы |
| [Эллинизм](https://amchercashin.github.io/aesthetics-atlas/#/s/hellenistic-art) | скульптура, рельеф, архитектура, мозаика | рельеф, архитектура, мозаика | Фриз Пергамского алтаря; Пергам и эллинистические города; «Мозаика Александра» |
| [Древний Рим](https://amchercashin.github.io/aesthetics-atlas/#/s/ancient-rome) | живопись, скульптура, рельеф, архитектура, мозаика | мозаика | Римская мозаика |
| [Гандхара](https://amchercashin.github.io/aesthetics-atlas/#/s/gandhara) | скульптура, рельеф, металл | рельеф, металл | Повествовательные рельефы из сланца; Реликварий из Бимарана и шкатулка Канишки (в работах карточки) |
| [Фаюмский портрет](https://amchercashin.github.io/aesthetics-atlas/#/s/fayum-portraits) | живопись |  |  |
| [Византийское искусство](https://amchercashin.github.io/aesthetics-atlas/#/s/byzantine-art) | живопись, архитектура, мозаика, декоративное искусство, рукописная книга | мозаика, рукописная книга | Мозаики Равенны и Константинополя (раньше стояли под «Декоративным искусством»); иллюминированные рукописи |
| [Островное искусство](https://amchercashin.github.io/aesthetics-atlas/#/s/insular-art) | рельеф, металл, каллиграфия, рукописная книга | металл, рельеф, каллиграфия | Брошь из Тары и Ардахская чаша; высокие кресты; письмо Келлской книги |
| [Исламское искусство](https://amchercashin.github.io/aesthetics-atlas/#/s/islamic-art) | архитектура, мозаика, декоративное искусство, керамика, текстиль, каллиграфия | каллиграфия, мозаика | Признак карточки: каллиграфия как главный декор; мозаики Купола Скалы, изразцовый набор |
| [Искусство викингов](https://amchercashin.github.io/aesthetics-atlas/#/s/viking-art) | рельеф, декоративное искусство, металл |  |  |
| [Кхмерское храмовое искусство](https://amchercashin.github.io/aesthetics-atlas/#/s/khmer-temple-art) | скульптура, рельеф, архитектура |  |  |
| [Бронзовая пластика Чола](https://amchercashin.github.io/aesthetics-atlas/#/s/chola-bronzes) | скульптура, металл |  |  |
| [Китайская пейзажная живопись шань-шуй](https://amchercashin.github.io/aesthetics-atlas/#/s/shan-shui) | живопись, каллиграфия | каллиграфия | Карточка: шань-шуй соединён с каллиграфией; каллиграфический мазок |
| [Ямато-э](https://amchercashin.github.io/aesthetics-atlas/#/s/yamato-e) | живопись, рукописная книга | рукописная книга | Иллюстрированные свитки-эмаки с текстом («Повесть о Гэндзи») |
| [Древнерусская иконопись](https://amchercashin.github.io/aesthetics-atlas/#/s/old-russian-icons) | живопись |  |  |
| [Романский стиль](https://amchercashin.github.io/aesthetics-atlas/#/s/romanesque) | живопись, скульптура, рельеф, архитектура | живопись, скульптура | Алтарные и стенные росписи (Тауль); Признак карточки: скульптура тимпанов и капителей |
| [Скульптура Ифе: металл и терракота](https://amchercashin.github.io/aesthetics-atlas/#/s/ife-sculpture) | скульптура, керамика, металл |  |  |
| [Готика](https://amchercashin.github.io/aesthetics-atlas/#/s/gothic) | скульптура, рельеф, архитектура, витраж | рельеф, витраж | Признак карточки: скульптурные порталы с рельефами тимпанов; Признак карточки: витражи и окна-розы |
| [Персидская миниатюра](https://amchercashin.github.io/aesthetics-atlas/#/s/persian-miniature) | живопись, рукописная книга |  |  |
| [Проторенессанс](https://amchercashin.github.io/aesthetics-atlas/#/s/proto-renaissance) | живопись, скульптура, рельеф | скульптура, рельеф | Кафедры Никколо и Джованни Пизано |
| [Интернациональная готика](https://amchercashin.github.io/aesthetics-atlas/#/s/international-gothic) | живопись, рукописная книга |  |  |
| [Раннее Возрождение](https://amchercashin.github.io/aesthetics-atlas/#/s/early-renaissance) | живопись, скульптура, рельеф, архитектура | рельеф | «Райские врата» Гиберти, рельефы Донателло |
| [Ваби-саби и дзэн-эстетика](https://amchercashin.github.io/aesthetics-atlas/#/s/wabi-sabi) | декоративное искусство, керамика |  |  |
| [Северное Возрождение](https://amchercashin.github.io/aesthetics-atlas/#/s/northern-renaissance) | живопись, печатная графика | печатная графика | Гравюры Дюрера |
| [Высокое Возрождение](https://amchercashin.github.io/aesthetics-atlas/#/s/high-renaissance) | живопись, рисунок, скульптура, архитектура | рисунок | Рисунки Леонардо, Микеланджело, Рафаэля |
| [Маньеризм](https://amchercashin.github.io/aesthetics-atlas/#/s/mannerism) | живопись, скульптура | скульптура | Джамболонья, Челлини |
| [Могольская миниатюра](https://amchercashin.github.io/aesthetics-atlas/#/s/mughal-miniature) | живопись, рукописная книга |  |  |
| [Палладианство](https://amchercashin.github.io/aesthetics-atlas/#/s/palladianism) | архитектура |  |  |
| [Изникская керамика: расписные блюда](https://amchercashin.github.io/aesthetics-atlas/#/s/iznik-ceramics) | декоративное искусство, керамика |  |  |
| [Караваджизм](https://amchercashin.github.io/aesthetics-atlas/#/s/caravaggism) | живопись |  |  |
| [Барокко](https://amchercashin.github.io/aesthetics-atlas/#/s/baroque) | живопись, скульптура, архитектура |  |  |
| [Голландский золотой век](https://amchercashin.github.io/aesthetics-atlas/#/s/dutch-golden-age) | живопись, печатная графика, керамика | печатная графика, керамика | Офорты Рембрандта; Дельфтский фаянс |
| [Русский печатный лубок](https://amchercashin.github.io/aesthetics-atlas/#/s/lubok) | печатная графика, иллюстрация |  |  |
| [Хохломская роспись](https://amchercashin.github.io/aesthetics-atlas/#/s/khokhloma) | живопись, декоративное искусство | живопись | Роспись по дереву — как у Жостова, Городца и Мезени |
| [Укиё-э](https://amchercashin.github.io/aesthetics-atlas/#/s/ukiyo-e) | живопись, печатная графика | живопись | Укиё-э — гравюры и живопись (никухицу-га, картины Хокусая) |
| [Няньхуа: региональные новогодние картинки Китая](https://amchercashin.github.io/aesthetics-atlas/#/s/nianhua) | печатная графика, иллюстрация |  |  |
| [Рококо](https://amchercashin.github.io/aesthetics-atlas/#/s/rococo) | живопись, архитектура, интерьер, декоративное искусство, керамика | архитектура, керамика | Церкви и павильоны рококо (Висскирхе); фарфор Мейсена и Севра |
| [Шинуазри](https://amchercashin.github.io/aesthetics-atlas/#/s/chinoiserie) | архитектура, интерьер, декоративное искусство, керамика |  |  |
| [Неоклассицизм XVIII — начала XIX века](https://amchercashin.github.io/aesthetics-atlas/#/s/neoclassicism) | живопись, скульптура, архитектура |  |  |
| [Романтизм](https://amchercashin.github.io/aesthetics-atlas/#/s/romanticism) | живопись, печатная графика | печатная графика | Офорты Гойи (в работах карточки — Гойя) |
| [Неоготика](https://amchercashin.github.io/aesthetics-atlas/#/s/gothic-revival) | архитектура, витраж | витраж | Витражи неоготических церквей и Вестминстера |
| [Ампир](https://amchercashin.github.io/aesthetics-atlas/#/s/empire-style) | архитектура, интерьер, декоративное искусство |  |  |
| [Кенте асанте](https://amchercashin.github.io/aesthetics-atlas/#/s/asante-kente) | текстиль |  |  |
| [Китайское вырезание бумаги: обзор](https://amchercashin.github.io/aesthetics-atlas/#/s/chinese-jianzhi) | декоративное искусство |  |  |
| [Маорийская резьба по дереву: обзор](https://amchercashin.github.io/aesthetics-atlas/#/s/maori-whakairo) | скульптура, рельеф, декоративное искусство |  |  |
| [Бидермайер](https://amchercashin.github.io/aesthetics-atlas/#/s/biedermeier) | живопись, интерьер, декоративное искусство | декоративное искусство | Карточка: мебель из светлого дерева |
| [Академизм](https://amchercashin.github.io/aesthetics-atlas/#/s/academism) | живопись, рисунок | рисунок | Признак карточки: рисунок с антиков — основа академической школы |
| [Жостовская роспись подносов](https://amchercashin.github.io/aesthetics-atlas/#/s/zhostovo-painting) | живопись, декоративное искусство |  |  |
| [Барбизонская школа](https://amchercashin.github.io/aesthetics-atlas/#/s/barbizon-school) | живопись |  |  |
| [Историзм и эклектика](https://amchercashin.github.io/aesthetics-atlas/#/s/historicism) | скульптура, архитектура | скульптура | Признак карточки: обилие декора и скульптуры (Опера Гарнье) |
| [Пейзажные гравюры Хокусая: виды Фудзи](https://amchercashin.github.io/aesthetics-atlas/#/s/hokusai-landscape-prints) | печатная графика |  |  |
| [Реализм](https://amchercashin.github.io/aesthetics-atlas/#/s/realism) | живопись, печатная графика | печатная графика | Литографии Домье |
| [Прерафаэлиты](https://amchercashin.github.io/aesthetics-atlas/#/s/pre-raphaelites) | живопись |  |  |
| [Городецкая роспись](https://amchercashin.github.io/aesthetics-atlas/#/s/gorodets-painting) | живопись, рисунок, декоративное искусство |  |  |
| [Мезенская роспись: палащельские прялки](https://amchercashin.github.io/aesthetics-atlas/#/s/mezen-painting) | живопись, декоративное искусство |  |  |
| [Движение искусств и ремёсел](https://amchercashin.github.io/aesthetics-atlas/#/s/arts-and-crafts) | архитектура, витраж, декоративное искусство, текстиль, типографика | витраж, типографика | Витражи Morris & Co; шрифты и книги Kelmscott Press |
| [Живопись Калигхата](https://amchercashin.github.io/aesthetics-atlas/#/s/kalighat-painting) | живопись, рисунок |  |  |
| [Эстетизм](https://amchercashin.github.io/aesthetics-atlas/#/s/aesthetic-movement) | живопись, печатная графика, интерьер, декоративное искусство | печатная графика | Офорты Уистлера |
| [Японизм](https://amchercashin.github.io/aesthetics-atlas/#/s/japonisme) | живопись, печатная графика, декоративное искусство |  |  |
| [Импрессионизм](https://amchercashin.github.io/aesthetics-atlas/#/s/impressionism) | живопись |  |  |
| [Передвижники](https://amchercashin.github.io/aesthetics-atlas/#/s/peredvizhniki) | живопись |  |  |
| [Янлюцинская театральная гравюра](https://amchercashin.github.io/aesthetics-atlas/#/s/yang-liuqing-nianhua) | печатная графика, иллюстрация |  |  |
| [Символизм](https://amchercashin.github.io/aesthetics-atlas/#/s/symbolism) | живопись, печатная графика | печатная графика | Литографии Редона (в работах карточки) |
| [Чикагская школа](https://amchercashin.github.io/aesthetics-atlas/#/s/chicago-school) | архитектура |  |  |
| [Постимпрессионизм](https://amchercashin.github.io/aesthetics-atlas/#/s/post-impressionism) | живопись, печатная графика | печатная графика | Карточка: афиши Тулуз-Лотрека |
| [Неоимпрессионизм](https://amchercashin.github.io/aesthetics-atlas/#/s/neo-impressionism) | живопись |  |  |
| [Наби](https://amchercashin.github.io/aesthetics-atlas/#/s/nabis) | живопись, печатная графика, графический дизайн | графический дизайн | Признак карточки: работа с плакатом, театром, книгой |
| [Модерн (ар-нуво)](https://amchercashin.github.io/aesthetics-atlas/#/s/art-nouveau) | архитектура, интерьер, витраж, декоративное искусство, керамика, металл, графический дизайн | витраж, металл, керамика, интерьер | Признаки карточки: витражи, гнутый металл, майолика; интерьеры Орта |
| [Декор самоанского сиапо](https://amchercashin.github.io/aesthetics-atlas/#/s/samoan-siapo) | живопись, декоративное искусство, текстиль |  |  |
| [Фиджийский маси: трафаретный декор](https://amchercashin.github.io/aesthetics-atlas/#/s/fijian-masi) | живопись, декоративное искусство, текстиль |  |  |
| [Венский сецессион](https://amchercashin.github.io/aesthetics-atlas/#/s/vienna-secession) | живопись, архитектура, мозаика, декоративное искусство, графический дизайн | графический дизайн, мозаика | Плакаты и журнал Ver Sacrum; мозаичный фриз Климта во дворце Стокле |
| [«Мир искусства»](https://amchercashin.github.io/aesthetics-atlas/#/s/mir-iskusstva) | живопись, рисунок, иллюстрация, мода, графический дизайн | графический дизайн, мода | Признак карточки: книжный дизайн; карточка: костюмы Бакста повлияли на моду |
| [Адинкра: печатные ткани и графические знаки](https://amchercashin.github.io/aesthetics-atlas/#/s/adinkra) | рисунок, текстиль |  |  |
| [Боголанфини](https://amchercashin.github.io/aesthetics-atlas/#/s/bogolanfini) | живопись, текстиль |  |  |
| [Органическая архитектура](https://amchercashin.github.io/aesthetics-atlas/#/s/organic-architecture) | архитектура |  |  |
| [Сказочная книжная графика Ивана Билибина](https://amchercashin.github.io/aesthetics-atlas/#/s/bilibin-illustration) | печатная графика, иллюстрация, графический дизайн |  |  |
| [Фовизм](https://amchercashin.github.io/aesthetics-atlas/#/s/fauvism) | живопись |  |  |
| [Экспрессионизм](https://amchercashin.github.io/aesthetics-atlas/#/s/expressionism) | живопись, печатная графика, архитектура, кино и анимация | печатная графика, кино и анимация, архитектура | Гравюры «Моста»; карточка: «охватил кино, театр и архитектуру» |
| [Кубизм](https://amchercashin.github.io/aesthetics-atlas/#/s/cubism) | живопись, скульптура | скульптура | «Гитара» Пикассо, Архипенко, Липшиц |
| [Футуризм](https://amchercashin.github.io/aesthetics-atlas/#/s/futurism) | живопись, скульптура, типографика | типографика | Признак карточки: манифесты и типографика |
| [Ранняя абстрактная живопись](https://amchercashin.github.io/aesthetics-atlas/#/s/abstract-art) | живопись |  |  |
| [Метафизическая живопись](https://amchercashin.github.io/aesthetics-atlas/#/s/metaphysical-painting) | живопись |  |  |
| [Кубофутуризм](https://amchercashin.github.io/aesthetics-atlas/#/s/cubo-futurism) | живопись, иллюстрация | иллюстрация | Литографированные книги футуристов |
| [Орфизм](https://amchercashin.github.io/aesthetics-atlas/#/s/orphism) | живопись, текстиль, мода | текстиль, мода | Ткани и одежда Сони Делоне |
| [Конструктивизм](https://amchercashin.github.io/aesthetics-atlas/#/s/constructivism) | скульптура, архитектура, текстиль, графический дизайн, типографика, фотография | фотография, скульптура, текстиль | Признак карточки: фотомонтаж и резкие ракурсы Родченко; Контррельефы Татлина, конструкции Габо; ткани Поповой и Степановой |
| [Супрематизм](https://amchercashin.github.io/aesthetics-atlas/#/s/suprematism) | живопись, керамика, графический дизайн | керамика, графический дизайн | Карточка: идеи ушли в фарфор; Карточка: идеи ушли в плакат |
| [Дадаизм](https://amchercashin.github.io/aesthetics-atlas/#/s/dada) | скульптура, типографика, фотография |  |  |
| [Де Стейл (неопластицизм)](https://amchercashin.github.io/aesthetics-atlas/#/s/de-stijl) | живопись, архитектура, предметный дизайн |  |  |
| [Баухаус](https://amchercashin.github.io/aesthetics-atlas/#/s/bauhaus) | архитектура, текстиль, графический дизайн, типографика, предметный дизайн, фотография | текстиль, фотография | Ткацкая мастерская (Анни Альберс); фотография Мохой-Надя |
| [Ар-деко](https://amchercashin.github.io/aesthetics-atlas/#/s/art-deco) | живопись, архитектура, интерьер, декоративное искусство, мода, графический дизайн | графический дизайн, живопись, мода | Плакаты Кассандра — канон ар-деко; Тамара де Лемпицка; мода Пуаре и Эрте |
| [Палехская лаковая миниатюра](https://amchercashin.github.io/aesthetics-atlas/#/s/palekh-miniature) | живопись, декоративное искусство |  |  |
| [Мексиканский мурализм](https://amchercashin.github.io/aesthetics-atlas/#/s/mexican-muralism) | живопись |  |  |
| [Новая вещественность](https://amchercashin.github.io/aesthetics-atlas/#/s/new-objectivity) | живопись, фотография | фотография | Август Зандер, Ренгер-Пач |
| [Сюрреализм](https://amchercashin.github.io/aesthetics-atlas/#/s/surrealism) | живопись, скульптура, фотография, кино и анимация | фотография, скульптура, кино и анимация | Ман Рэй, Дора Маар; Объекты Опенгейм и Джакометти; «Андалузский пёс» |
| [Интернациональный стиль](https://amchercashin.github.io/aesthetics-atlas/#/s/international-style) | архитектура |  |  |
| [Темперная фигурация Джамини Роя](https://amchercashin.github.io/aesthetics-atlas/#/s/jamini-roy-painting) | живопись |  |  |
| [Декор тонганского нгату](https://amchercashin.github.io/aesthetics-atlas/#/s/tongan-ngatu) | живопись, декоративное искусство, текстиль |  |  |
| [Стримлайн-модерн](https://amchercashin.github.io/aesthetics-atlas/#/s/streamline-moderne) | архитектура, предметный дизайн |  |  |
| [Социалистический реализм](https://amchercashin.github.io/aesthetics-atlas/#/s/socialist-realism) | живопись, скульптура, мозаика, графический дизайн | графический дизайн, мозаика | Признак карточки: плакатность; Мозаики московского метро (Дейнека) |
| [Сталинский ампир](https://amchercashin.github.io/aesthetics-atlas/#/s/stalinist-architecture) | скульптура, архитектура, мозаика | мозаика, скульптура | Карточка: станции метро; признак — скульптура на фасадах |
| [Польские выцинанки: Лович и Курпе](https://amchercashin.github.io/aesthetics-atlas/#/s/polish-wycinanki) | декоративное искусство |  |  |
| [Абстрактный экспрессионизм](https://amchercashin.github.io/aesthetics-atlas/#/s/abstract-expressionism) | живопись |  |  |
| [Мидсенчури-модерн](https://amchercashin.github.io/aesthetics-atlas/#/s/mid-century-modern) | архитектура, интерьер, предметный дизайн |  |  |
| [Карролапская школа рисунка](https://amchercashin.github.io/aesthetics-atlas/#/s/carrolup-school) | живопись, рисунок |  |  |
| [Гуги (атомный стиль)](https://amchercashin.github.io/aesthetics-atlas/#/s/googie) | архитектура, графический дизайн | графический дизайн | В работах карточки — знак «Welcome to Fabulous Las Vegas» |
| [Живопись цветового поля](https://amchercashin.github.io/aesthetics-atlas/#/s/color-field) | живопись |  |  |
| [Брутализм](https://amchercashin.github.io/aesthetics-atlas/#/s/brutalism) | архитектура |  |  |
| [Швейцарский стиль](https://amchercashin.github.io/aesthetics-atlas/#/s/swiss-style) | графический дизайн, типографика |  |  |
| [Кинетическое искусство](https://amchercashin.github.io/aesthetics-atlas/#/s/kinetic-art) | скульптура, инсталляция |  |  |
| [Ульмская школа дизайна](https://amchercashin.github.io/aesthetics-atlas/#/s/ulm-school) | графический дизайн, предметный дизайн | графический дизайн | Карточка: визуальные системы (Отль Айхер) |
| [Поп-арт](https://amchercashin.github.io/aesthetics-atlas/#/s/pop-art) | живопись, печатная графика, скульптура | скульптура | Мягкие скульптуры Ольденбурга |
| [Советский модернизм](https://amchercashin.github.io/aesthetics-atlas/#/s/soviet-modernism) | архитектура, мозаика | мозаика | Признак карточки: мозаичные панно |
| [Дизайн космической эры](https://amchercashin.github.io/aesthetics-atlas/#/s/space-age) | архитектура, мода, предметный дизайн |  |  |
| [Экспрессивные портреты Анатолия Зверева](https://amchercashin.github.io/aesthetics-atlas/#/s/zverev-portrait-graphics) | живопись, рисунок |  |  |
| [Метаболизм](https://amchercashin.github.io/aesthetics-atlas/#/s/metabolism) | архитектура |  |  |
| [Концептуализм](https://amchercashin.github.io/aesthetics-atlas/#/s/conceptual-art) | фотография, инсталляция | фотография | «Один и три стула» с фотографией; признак — документ вместо образа |
| [Минимализм](https://amchercashin.github.io/aesthetics-atlas/#/s/minimalism) | живопись, скульптура, инсталляция | живопись | Фрэнк Стелла (цитата в карточке), Агнес Мартин |
| [Оп-арт](https://amchercashin.github.io/aesthetics-atlas/#/s/op-art) | живопись, скульптура, мода | скульптура, мода | Сото в работах карточки; карточка: узоры перешли на платья |
| [Печатные картинки Донгхо](https://amchercashin.github.io/aesthetics-atlas/#/s/dong-ho-prints) | печатная графика |  |  |
| [Раннее компьютерное искусство](https://amchercashin.github.io/aesthetics-atlas/#/s/computer-art) | рисунок, цифровое искусство |  |  |
| [Психоделическое искусство](https://amchercashin.github.io/aesthetics-atlas/#/s/psychedelic-art) | графический дизайн, типографика |  |  |
| [Ленд-арт](https://amchercashin.github.io/aesthetics-atlas/#/s/land-art) | скульптура, фотография, инсталляция | скульптура, фотография | Earthworks — скульптура в ландшафте; Признак карточки: документация — фото, карты, фильм |
| [Фотореализм и гиперреализм](https://amchercashin.github.io/aesthetics-atlas/#/s/hyperrealism) | живопись, скульптура | скульптура | Карточка: гиперреалисты в скульптуре вроде Рона Мьюика |
| [Граффити и стрит-арт](https://amchercashin.github.io/aesthetics-atlas/#/s/graffiti-street-art) | живопись |  |  |
| [Хай-тек](https://amchercashin.github.io/aesthetics-atlas/#/s/high-tech) | архитектура |  |  |
| [Афрофутуризм](https://amchercashin.github.io/aesthetics-atlas/#/s/afrofuturism) | мода, кино и анимация, цифровое искусство |  |  |
| [Лоубров (поп-сюрреализм)](https://amchercashin.github.io/aesthetics-atlas/#/s/lowbrow) | живопись, иллюстрация | иллюстрация | Карточка: андеграундные комиксы |
| [Постмодернизм в архитектуре](https://amchercashin.github.io/aesthetics-atlas/#/s/postmodern-architecture) | архитектура |  |  |
| [Экранный язык Норштейна, Ярбусовой и съёмочных групп](https://amchercashin.github.io/aesthetics-atlas/#/s/norshtein-animation) | рисунок, кино и анимация |  |  |
| [Пиксель-арт](https://amchercashin.github.io/aesthetics-atlas/#/s/pixel-art) | цифровое искусство |  |  |
| [Ранняя компьютерная графика](https://amchercashin.github.io/aesthetics-atlas/#/s/early-cgi) | кино и анимация, цифровое искусство | кино и анимация | Карточка: «Трон» и заставки телеканалов |
| [Панк-графика и DIY](https://amchercashin.github.io/aesthetics-atlas/#/s/punk-graphics) | печатная графика, мода, графический дизайн, типографика | мода | Признак карточки: булавки и рваные края; панк-мода |
| [Новая волна и гранж-типографика](https://amchercashin.github.io/aesthetics-atlas/#/s/new-wave-graphic) | графический дизайн, типографика |  |  |
| [Неоэкспрессионизм](https://amchercashin.github.io/aesthetics-atlas/#/s/neo-expressionism) | живопись |  |  |
| [Мемфис](https://amchercashin.github.io/aesthetics-atlas/#/s/memphis-design) | предметный дизайн |  |  |
| [Киберпанк](https://amchercashin.github.io/aesthetics-atlas/#/s/cyberpunk) | иллюстрация, кино и анимация, цифровое искусство |  |  |
| [Деконструктивизм](https://amchercashin.github.io/aesthetics-atlas/#/s/deconstructivism) | архитектура |  |  |
| [Преобразование силуэта у Рэй Кавакубо](https://amchercashin.github.io/aesthetics-atlas/#/s/rei-kawakubo) | текстиль, мода |  |  |
| [Письмо как изображение у Сюй Бина](https://amchercashin.github.io/aesthetics-atlas/#/s/xu-bing-writing-systems) | печатная графика, типографика, каллиграфия, инсталляция | каллиграфия | В корпусе карточки — Square Word Calligraphy |
| [Живопись Эмили Кам Кнгваррей](https://amchercashin.github.io/aesthetics-atlas/#/s/emily-kngwarray) | живопись, рисунок |  |  |
| [Расписанные текстильные поверхности Паситы Абад](https://amchercashin.github.io/aesthetics-atlas/#/s/pacita-abad) | живопись, текстиль |  |  |
| [Миниатюры и работы на бумаге Шахзии Сикандер](https://amchercashin.github.io/aesthetics-atlas/#/s/shahzia-sikander) | живопись, рисунок, рукописная книга |  |  |
| [Живопись варли](https://amchercashin.github.io/aesthetics-atlas/#/s/warli-painting) | живопись, декоративное искусство |  |  |
| [Живопись Митхилы](https://amchercashin.github.io/aesthetics-atlas/#/s/mithila-painting) | живопись, рисунок |  |  |
| [Настенная роспись ндебеле в ЮАР и её адаптации](https://amchercashin.github.io/aesthetics-atlas/#/s/ndebele-murals) | живопись, архитектура, декоративное искусство |  |  |
| [Геометрические композиции Эстер Малангу](https://amchercashin.github.io/aesthetics-atlas/#/s/esther-mahlangu) | живопись, декоративное искусство |  |  |
| [Web 1.0 (эстетика GeoCities)](https://amchercashin.github.io/aesthetics-atlas/#/s/web-1-0) | веб |  |  |
| [Net.art](https://amchercashin.github.io/aesthetics-atlas/#/s/net-art) | веб |  |  |
| [Y2K](https://amchercashin.github.io/aesthetics-atlas/#/s/y2k-aesthetic) | мода, графический дизайн, предметный дизайн, цифровое искусство | графический дизайн, мода | Карточка: хромированные 3D-шрифты, The Designers Republic, серебристые костюмы |
| [Графика Торресова пролива: обзор](https://amchercashin.github.io/aesthetics-atlas/#/s/torres-strait-printmaking) | печатная графика |  |  |
| [Линогравюры Алика Типоти](https://amchercashin.github.io/aesthetics-atlas/#/s/alick-tipoti) | печатная графика |  |  |
| [Глитч-арт](https://amchercashin.github.io/aesthetics-atlas/#/s/glitch-art) | кино и анимация, цифровое искусство | кино и анимация | Карточка: датамошинг склеивает видеокадры |
| [Суперплоский (Superflat)](https://amchercashin.github.io/aesthetics-atlas/#/s/superflat) | живопись, скульптура | скульптура | Скульптуры Мураками |
| [Фрутигер-аэро](https://amchercashin.github.io/aesthetics-atlas/#/s/frutiger-aero) | графический дизайн, типографика, цифровое искусство, интерфейсы | типографика | Признак карточки: гуманистические гротески — Frutiger, Segoe |
| [Металлические полотна Эль Анацуи](https://amchercashin.github.io/aesthetics-atlas/#/s/el-anatsui-metal-textiles) | скульптура, металл, инсталляция |  |  |
| [Скевоморфизм](https://amchercashin.github.io/aesthetics-atlas/#/s/skeuomorphism) | интерфейсы |  |  |
| [Синтвейв (аутран)](https://amchercashin.github.io/aesthetics-atlas/#/s/synthwave) | графический дизайн, цифровое искусство | графический дизайн | Карточка: эстетика обложек и постеров |
| [Пост-интернет](https://amchercashin.github.io/aesthetics-atlas/#/s/post-internet) | фотография, инсталляция, цифровое искусство |  |  |
| [Плоский дизайн](https://amchercashin.github.io/aesthetics-atlas/#/s/flat-design) | иллюстрация, графический дизайн, интерфейсы | иллюстрация | Карточка: плоский дизайн стал стандартом иллюстрации |
| [Бенгальская патачитра](https://amchercashin.github.io/aesthetics-atlas/#/s/bengal-patachitra) | живопись |  |  |
| [Вейпорвейв](https://amchercashin.github.io/aesthetics-atlas/#/s/vaporwave) | графический дизайн, цифровое искусство |  |  |
| [Сипанк](https://amchercashin.github.io/aesthetics-atlas/#/s/seapunk) | цифровое искусство |  |  |
| [Знаки и публичная видимость у Реко Ренни](https://amchercashin.github.io/aesthetics-atlas/#/s/reko-rennie) | живопись, кино и анимация, инсталляция |  |  |
| [Соларпанк](https://amchercashin.github.io/aesthetics-atlas/#/s/solarpunk) | иллюстрация, архитектура, цифровое искусство |  |  |
| [Веб-брутализм](https://amchercashin.github.io/aesthetics-atlas/#/s/web-brutalism) | типографика, веб | типографика | Признак карточки: системные и моноширинные шрифты |
| [Material Design](https://amchercashin.github.io/aesthetics-atlas/#/s/material-design) | интерфейсы |  |  |
| [Нейросетевая эстетика](https://amchercashin.github.io/aesthetics-atlas/#/s/ai-aesthetic) | цифровое искусство |  |  |
| [Дарк-академия](https://amchercashin.github.io/aesthetics-atlas/#/s/dark-academia) | интерьер, мода, фотография |  |  |
| [Корпоративный Мемфис](https://amchercashin.github.io/aesthetics-atlas/#/s/corporate-memphis) | иллюстрация |  |  |
| [Кидкор](https://amchercashin.github.io/aesthetics-atlas/#/s/kidcore) | мода, фотография |  |  |
| [Коттеджкор](https://amchercashin.github.io/aesthetics-atlas/#/s/cottagecore) | мода, фотография |  |  |
| [Лиминальные пространства](https://amchercashin.github.io/aesthetics-atlas/#/s/liminal-space) | фотография, цифровое искусство |  |  |
| [Уирдкор](https://amchercashin.github.io/aesthetics-atlas/#/s/weirdcore) | фотография, цифровое искусство |  |  |
| [Дримкор](https://amchercashin.github.io/aesthetics-atlas/#/s/dreamcore) | фотография, цифровое искусство |  |  |
| [Глассморфизм](https://amchercashin.github.io/aesthetics-atlas/#/s/glassmorphism) | интерфейсы |  |  |
| [Барбикор](https://amchercashin.github.io/aesthetics-atlas/#/s/barbiecore) | интерьер, мода, фотография | фотография | Фотографии нарядов и интерьеров, как у других интернет-эстетик |
| [Кокетт](https://amchercashin.github.io/aesthetics-atlas/#/s/coquette) | мода, фотография | фотография | Подборки фотографий, как у других интернет-эстетик |
| [Элиенкор](https://amchercashin.github.io/aesthetics-atlas/#/s/alien-core) | цифровое искусство |  |  |
| [Брэт](https://amchercashin.github.io/aesthetics-atlas/#/s/brat) | графический дизайн, типографика |  |  |
