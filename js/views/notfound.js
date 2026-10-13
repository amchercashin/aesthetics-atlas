import { html, mount } from '../html.js';
export default {
  render(root) {
    document.title = 'Не найдено — Атлас эстетик';
    mount(root, html`<div class="page empty-page">
      <h1 class="section-title">Такого зала нет</h1>
      <p>Ссылка устарела или в ней опечатка. Попробуйте <button class="btn ghost" type="button" data-open-search>найти стиль</button> или откройте <a href="#/catalog">каталог</a>.</p>
    </div>`);
  },
};
