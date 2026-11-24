// О проекте: зачем атлас, как читать карту, пигменты эпох, проверка, картинки и куда копать дальше.
import { html, mount, safeUrl } from '../html.js';
import { RELATION, KIND, KIND_DESC, REVIEW_SCOPE, plural } from '../format.js';
import { footer } from '../ui/common.js';

const REL_DESC = {
  evolved: 'Стиль прямо вырос из предшественника: те же мастера, школа или приёмы, доведённые до нового качества.',
  influence: 'Заметное влияние со стороны — как японская гравюра на импрессионистов.',
  reaction: 'Стиль возник в споре с предшественником, как его отрицание.',
  revival: 'Сознательное возрождение давнего стиля спустя века — неоготика, неоклассицизм, ретро-эстетики.',
};
const DASH = { evolved: '', influence: '2 0', reaction: '7 5', revival: '1.5 4.5' };
const WIDTH = { evolved: 2.2, influence: 1.2, reaction: 1.6, revival: 2.2 };

export default {
  render(root, { store, params }) {
    document.title = 'О проекте — Атлас эстетик';
    const st = store.stats;
    const total = store.styles.length;
    const imgs = st?.embedded ?? store.styles.reduce((n, s) => n + (s.example?.img ? 1 : 0) + (s.gallery ?? []).filter((g) => g.img).length + (s.corpus ?? []).filter((w) => w.img).length, 0);
    const fair = st?.nonfree ?? store.styles.reduce((n, s) => n + [s.example?.img, ...(s.gallery ?? []).map((g) => g.img), ...(s.corpus ?? []).map((w) => w.img)].filter((m) => m?.nonfree).length, 0);
    const galleryImgs = st?.galleryImgs ?? store.styles.reduce((n, s) => n + (s.gallery ?? []).filter((g) => g.img).length, 0);
    const corpusWorks = st?.corpusWorks ?? store.styles.reduce((n, s) => n + (s.corpus ?? []).length, 0);
    const sourceCount = st?.sources ?? store.sources.length;
    const reviewed = st?.reviewed ?? store.styles.filter((s) => s.review?.status !== 'legacy').length;
    const rels = store.styles.flatMap((s) => s.parents);
    const verified = rels.filter((r) => r.status === 'verified').length;
    const cmp = store.styles.reduce((n, s) => n + s.comparisons.length, 0) / 2;
    const extracted = store.styles.filter((s) => s.palette?.source === 'image').length;
    const byScope = Object.keys(REVIEW_SCOPE)
      .map((k) => [k, st?.byScope?.[k] ?? store.styles.filter((s) => s.review?.scope?.includes(k)).length])
      .filter(([, n]) => n);
    const full = st?.full ?? store.styles.filter((s) => s.review?.status === 'reviewed').length;

    mount(root, html`
    <article class="page about">
      <header class="about-head">
        <h1 class="about-title">О проекте</h1>
        <p class="about-lead">Генеративный ИИ дал каждому человеку «суперкисть», но не дал словаря вкуса. Чтобы попросить картину, интерьер или интерфейс не «как у соседа», а в духе укиё-э, баухауса, гжели или вейпорвейва, нужно знать, какие визуальные языки вообще придумало человечество — и почувствовать, что откликается именно тебе.</p>
        <p class="about-lead">Атлас эстетик — это навигатор по ${total} визуальным стилям: от наскальной живописи до эстетик 2020-х. Не энциклопедия, а карта: откуда стиль взялся, с чем перекликается на глаз, как его узнать и как сразу попробовать на своём сюжете с ИИ.</p>
      </header>

      <section class="about-sec">
        <h2 class="section-title">Как читать карту</h2>
        <p>По горизонтали — время. Шкала неравномерная: каждая эпоха получает место по числу стилей, поэтому десятки тысяч лет первобытности и пятнадцать лет интернет-эстетик видны одинаково подробно. По вертикали 20 макро-морей уложены в три культурные широты: сверху — Азия и Тихий океан, в центре — Средиземноморье, Европа и глобальный поток, снизу — народные традиции, Африка и Америки. Внутри моря лежат его части, а внутри части стиль стоит рядом со своим первым предком; широты помогают ориентироваться и не означают иерархии.</p>
        <p>На обзоре «Моря» полупрозрачные градиентные течения со стрелкой показывают все подтверждённые исторические потоки между морями; наведение на море ярко подсвечивает его входы и выходы, а нажатие на течение открывает список конкретных стилей. При приближении появляются части, затем отдельные эстетики и ветви. Точка — дата начала, принятая в карточке; у авторских языков и ряда живых традиций это начало выбранного музейного корпуса работ, а не всей традиции. Цвет точки — море. Линия от точки — ствол, от которого отходят потомки; чем больше стилей выросло из линии, тем она толще. Карта двигается перетаскиванием и миникартой; колесо мыши, щипок или двойной щелчок плавно меняют масштаб. Нажмите на стиль — откроются его ближайшие связи (включая визуальные сопоставления и контекст), полоса длительности и панель с работами. Линии между стилями бывают четырёх видов:</p>
        <ul class="legend">
          ${Object.keys(RELATION).map((k) => html`<li>
            <svg viewBox="0 0 80 14" aria-hidden="true"><path d="M2 7 C 30 7, 50 7, 78 7" fill="none" stroke="currentColor" stroke-width="${WIDTH[k]}" stroke-dasharray="${DASH[k]}" stroke-linecap="round"/></svg>
            <span><strong>${RELATION[k].label[0].toUpperCase() + RELATION[k].label.slice(1)}.</strong> ${REL_DESC[k]}</span>
          </li>`)}
        </ul>
      </section>

      <section class="about-sec" id="review">
        <h2 class="section-title">Насколько это проверено</h2>
        <p>Атлас выборочный и живой: ${total} ${plural(total, 'карточка', 'карточки', 'карточек')} не претендуют на полную историю мировых культур — каталог постепенно расширяется по регионам и техникам, но каждая новая карточка входит только после полной сверки с открытыми источниками.</p>
        <p>Из ${rels.length} исторических ${plural(rels.length, 'связи', 'связей', 'связей')} источниками подтверждены ${verified}.${verified < rels.length ? ' Остальные помечены «не проверено» — это гипотеза редакции.' : ' Непроверенных исторических связей в текущих данных нет.'} Визуальных сопоставлений (сходство без утверждения о происхождении) — ${cmp}. В реестре источников сейчас ${sourceCount} ${plural(sourceCount, 'запись', 'записи', 'записей')}.</p>
        <p>Полностью ${plural(full, 'сверена', 'сверены', 'сверены')} ${full} из ${total} ${plural(total, 'карточки', 'карточек', 'карточек')} (отметка стоит у ${reviewed}): ${byScope.map(([k, n], i) => `${i ? '; ' : ''}${REVIEW_SCOPE[k]} — у ${n}`)}. Всего в атласе ${imgs} ${plural(imgs, 'изображение', 'изображения', 'изображений')} (в том числе ${galleryImgs} в галереях) и ${corpusWorks} ${plural(corpusWorks, 'работа', 'работы', 'работ')} в корпусах сравнения. То, чего открытые источники не называют (например, неизвестный автор или год), честно указано прямо в подписи. <a href="https://github.com/amchercashin/aesthetics-atlas/issues/80" target="_blank" rel="noopener">Открытые вопросы по источникам</a>.</p>
        <p>Автоматическая сборка проверяет структуру графа, отсутствие циклов, наличие источников и следы сверки. Ссылки «Изучить дальше» — материалы для самостоятельного чтения, а не подтверждение каждого утверждения. Даты условны и значат разное: археологические датировки, периодизацию историков, годы существования группы или выбранного корпуса работ — это пояснено в блоке «Что значат даты».</p>
      </section>

      <section class="about-sec">
        <h2 class="section-title">Что описывает карточка</h2>
        <p>Карточки описывают очень разные явления, и у каждой указан тип:</p>
        <ul class="kind-list">
          ${Object.keys(KIND).map((k) => html`<li><strong>${KIND[k]}</strong> — ${KIND_DESC[k]}.</li>`)}
        </ul>
      </section>

      <section class="about-sec">
        <h2 class="section-title">Пигменты эпох</h2>
        <p>Каждой эпохе в хронологии, каталоге и поиске соответствует цвет — исторический пигмент или краска, которые её определяли.</p>
        <ol class="pigment-list">
          ${store.eras.map((e) => html`<li style="--c:var(--era-${e.id})"><span class="pl-chip"></span><span class="pl-name">${e.pigment}</span><span class="pl-era">${e.name}</span></li>`)}
        </ol>
      </section>

      <section class="about-sec">
        <h2 class="section-title">Откуда картинки и как они хранятся</h2>
        <p>В атласе ${imgs} ${plural(imgs, 'изображение', 'изображения', 'изображений')}: материалы Wikimedia Commons и Википедии, музейные и студийные репродукции, а также собственные поясняющие SVG-схемы. Все изображения хранятся локально в репозитории в оптимизированном формате WebP/SVG, чтобы страницы открывались мгновенно и не зависели от доступности внешних серверов; под каждой работой указаны автор, лицензия и ссылка на первоисточник.</p>
        <p>Собственные схемы созданы для атласа в 2026 году. Если главная иллюстрация — не произведение своего времени, это подписано: «Предтеча», «Современная иллюстрация», «Реконструкция».</p>
        <p>${fair} ${plural(fair, 'изображение защищено', 'изображения защищены', 'изображений защищены')} авторским правом и помечены «несвободное». Их превью низкого разрешения взяты из английской Википедии. Под каждым таким изображением видно, проверено ли основание его использования. Если вы правообладатель, напишите в <a href="https://github.com/amchercashin/aesthetics-atlas/issues" target="_blank" rel="noopener">issues проекта</a> — мы заменим изображение ссылкой.</p>
        <p>Палитры бывают двух видов. «Цвета всех изображений» (${extracted} ${plural(extracted, 'карточка', 'карточки', 'карточек')}) — пять характерных цветов, извлечённых алгоритмом по всем изображениям карточки с ослаблением нейтрального фона; это ориентир по работам карточки, а не канон всего стиля. «Редакторская подборка» — цвета, подобранные вручную по признакам стиля. Тексты описаний написаны для атласа и не копируют энциклопедии.</p>
      </section>

      ${store.resources.length ? html`<section class="about-sec">
        <h2 class="section-title">Копать дальше</h2>
        <p>Если хочется глубже — или в соседние области, которые атлас не охватывает: моду, кино, музыку, игры.</p>
        ${store.resources.map((g) => html`<h3 class="res-group">${g.group}</h3>
          <ul class="res-list">${g.items.map((r) => html`<li><a href="${safeUrl(r.url)}" target="_blank" rel="noopener">${r.title}</a><span>${r.note}${r.lang === 'ru' ? '' : ', на английском'}</span></li>`)}</ul>`)}
      </section>` : ''}

      <section class="about-sec">
        <h2 class="section-title">Предложить правку</h2>
        <p>Нашли ошибку, не хватает стиля или связи? Данные лежат в открытом репозитории в виде простых YAML-файлов — откройте issue или pull request на <a href="https://github.com/amchercashin/aesthetics-atlas" target="_blank" rel="noopener">GitHub</a>.</p>
      </section>
    </article>
    ${footer(store)}`);
    // #/about?s=review — сразу к разделу. Кадр спустя: роутер после рендера прокручивает страницу к началу.
    const section = params?.get('s');
    if (section) requestAnimationFrame(() => document.getElementById(section)?.scrollIntoView({ block: 'start' }));
  },
};
