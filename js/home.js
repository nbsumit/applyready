/* Home page: show recently used tools so a returning visitor is one click from their task.
   Reads only the tool ids that js/site.js remembers; nothing else is stored or sent. */
(function () {
  'use strict';
  const section = document.getElementById('homeContinue');
  const list = document.getElementById('homeRecent');
  if (!section || !list || !window.ApplyReadySearch) return;
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const recent = window.ApplyReadySearch.itemsById(window.ApplyReadySearch.recentIds()).filter(i => i.kind === 'tool').slice(0, 4);
  if (!recent.length) return;
  list.innerHTML = recent.map(t => `
    <li class="tool-card" data-tool="${esc(t.id)}">
      <a class="tool-card__link" href="${esc(t.path)}">
        <span class="tool-card__icon" aria-hidden="true"><i class="fa-solid fa-${esc(t.icon)}"></i></span>
        <span class="tool-card__body"><span class="tool-card__name">${esc(t.name)}</span><span class="tool-card__desc">${esc(t.summary)}</span></span>
      </a>
    </li>`).join('');
  section.hidden = false;
})();
