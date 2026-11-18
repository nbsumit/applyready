/* Tool directory: filter the list as you type, using the same matching as site search
   (synonyms and small typing mistakes included). ?q= in the address pre-fills the filter.

   What the filter shows is what it counts: each matching tool once, in its own category (a tool
   listed under two categories is not shown twice), and a matching preset page ("Resize image to
   50 KB") shows the card it belongs to. When nothing on the page matches, it says so. */
(function () {
  'use strict';
  const input = document.getElementById('toolFilter');
  const status = document.getElementById('toolFilterStatus');
  const empty = document.getElementById('toolFilterEmpty');
  const dir = document.getElementById('toolDirectory');
  if (!input || !dir || !window.ApplyReadySearch) return;
  const sections = Array.from(dir.querySelectorAll('.dir-section'));
  const nav = document.querySelector('.dir-nav');
  const index = (window.APPLYREADY_TOOL_INDEX && window.APPLYREADY_TOOL_INDEX.items) || [];
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const categoryOf = id => { const item = index.find(i => i.id === id); return item ? item.category : null; };

  // Does this card answer the query: its own tool, or one of the preset pages listed on it?
  const cardIds = card => [card.dataset.tool, ...Array.from(card.querySelectorAll('[data-tool]'), a => a.dataset.tool)];

  function apply() {
    const q = input.value.trim();
    if (!q) {
      dir.querySelectorAll('.tool-card').forEach(card => { card.hidden = false; });
      sections.forEach(s => { s.hidden = false; });
      if (nav) nav.hidden = false;
      empty.hidden = true;
      status.textContent = '';
      return;
    }
    const results = window.ApplyReadySearch.search(q, 50);
    const ids = new Set(results.filter(i => i.kind === 'tool').map(i => i.id));
    const shown = new Set();
    sections.forEach(section => {
      let any = false;
      section.querySelectorAll('.tool-card').forEach(card => {
        const tool = card.dataset.tool;
        // A tool listed in several categories is shown in its own one only.
        const home = categoryOf(tool);
        const match = cardIds(card).some(id => ids.has(id)) && (!home || home === section.id || !document.getElementById(home));
        card.hidden = !match || shown.has(tool);
        if (!card.hidden) { shown.add(tool); any = true; }
      });
      section.hidden = !any;
    });
    if (nav) nav.hidden = true;
    const n = shown.size;
    empty.hidden = n > 0;
    if (!n) {
      // No tool, but a help page or guide may answer it ("word to pdf" explains how to export from Word).
      const others = results.filter(i => i.kind !== 'tool').slice(0, 4);
      empty.innerHTML = (others.length ? `<p>These pages may help:</p><ul class="dir-empty__list">${others.map(i => `<li><a href="${esc(i.path)}">${esc(i.name)}</a></li>`).join('')}</ul>` : '') +
        `<p>${others.length ? 'Or try' : 'Try'} a shorter word, or <a href="guides/">read the guides</a>.</p>`;
    }
    status.textContent = n ? `${n} tool${n === 1 ? ' matches' : 's match'} “${q}”` : `No tool matches “${q}”`;
  }

  input.addEventListener('input', apply);
  input.addEventListener('keydown', e => { if (e.key === 'Escape' && input.value) { input.value = ''; apply(); } });
  const q = new URLSearchParams(location.search).get('q');
  if (q) { input.value = q.slice(0, 80); apply(); }
})();
