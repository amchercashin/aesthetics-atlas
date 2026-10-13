// О проекте: как читать карту, пигменты эпох, источники и лицензии, куда копать дальше.
import { html, mount, safeUrl } from '../html.js';
import { RELATION, plural } from '../format.js';
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
  render(root, { store }) {
    document.title = 'О проекте — Атлас эстетик';
    const imgs = store.styles.reduce((n, s) => n + (s.example.img ? 1 : 0) + s.gallery.filter((g) => g.img).length, 0);
    const fair = store.styles.reduce((n, s) => n + [s.example.img, ...s.gallery.map((g) => g.img)].filter((m) => m?.nonfree).length, 0);

    mount(root, html`
    <article class="page about">
      <header class="about-head">
        <h1 class="about-title">О проекте</h1>
        <p class="about-lead">Атлас эстетик — навигатор по визуальным стилям, которые придумали люди: от наскальной живописи до интернет-эстетик 2020-х. Это не энциклопедия, а карта: она показывает, откуда стиль взялся, как его узнать и куда идти читать дальше.</p>
      </header>

      <section class="about-sec">
        <h2 class="section-title">Как читать карту</h2>
        <p>По горизонтали — время. Шкала неравномерная: каждая эпоха получает место по числу стилей, поэтому сорок тысяч лет палеолита и пятнадцать лет интернет-эстетик видны одинаково подробно. Границы эпох отмечены на оси. Полоса после названия показывает, сколько стиль жил. Линии между стилями бывают четырёх видов:</p>
        <ul class="legend">
          ${Object.keys(RELATION).map((k) => html`<li>
            <svg viewBox="0 0 80 14" aria-hidden="true"><path d="M2 7 C 30 7, 50 7, 78 7" fill="none" stroke="currentColor" stroke-width="${WIDTH[k]}" stroke-dasharray="${DASH[k]}" stroke-linecap="round"/></svg>
            <span><strong>${RELATION[k].label[0].toUpperCase() + RELATION[k].label.slice(1)}.</strong> ${REL_DESC[k]}</span>
          </li>`)}
        </ul>
        <p>Даты условны: стили не начинаются в один день. Мы берём годы, когда стиль оформился и был наиболее активен.</p>
      </section>

      <section class="about-sec">
        <h2 class="section-title">Пигменты эпох</h2>
        <p>Каждой эпохе на карте и в хронологии соответствует цвет — пигмент или краска, которые её определяли.</p>
        <ol class="pigment-list">
          ${store.eras.map((e) => html`<li style="--c:var(--era-${e.id})"><span class="pl-chip"></span><span class="pl-name">${e.pigment}</span><span class="pl-era">${e.name}</span></li>`)}
        </ol>
      </section>

      <section class="about-sec">
        <h2 class="section-title">Откуда картинки</h2>
        <p>Все ${imgs} ${plural(imgs, 'изображение', 'изображения', 'изображений')} загружаются напрямую с серверов Wikimedia. Под каждым указаны автор, лицензия и ссылка на страницу файла. Палитры стилей посчитаны автоматически по главным работам.</p>
        <p>${fair} ${plural(fair, 'работа защищена', 'работы защищены', 'работ защищены')} авторским правом — в основном искусство XX–XXI веков. Их превью взяты из англоязычной Википедии, где они используются на условиях добросовестного использования (fair use), показаны в низком разрешении и помечены значком «fair use». Если вы правообладатель и хотите убрать изображение, напишите в <a href="https://github.com/amchercashin/aesthetics-atlas/issues" target="_blank" rel="noopener">issues проекта</a>.</p>
        <p>Тексты описаний написаны для атласа и не копируют энциклопедии.</p>
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
  },
};
