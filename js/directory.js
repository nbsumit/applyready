/* Tool directory: filter the list as you type, using the same matching as site search
   (synonyms and small typing mistakes included). ?q= in the address pre-fills the filter. */
(function () {
  'use strict';
  const input = document.getElementById('toolFilter');
  const status = document.getElementById('toolFilterStatus');
  const empty = document.getElementById('toolFilterEmpty');
  const dir = document.getElementById('toolDirectory');
  if (!input || !dir || !window.ApplyReadySearch) return;
  const sections = Array.from(dir.querySelectorAll('.dir-section'));
  const nav = document.querySelector('.dir-nav');

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
    const ids = new Set(window.ApplyReadySearch.search(q, 50).filter(i => i.kind === 'tool').map(i => i.id));
    let shown = 0;
    sections.forEach(section => {
      let any = false;
      section.querySelectorAll('.tool-card').forEach(card => {
        const match = ids.has(card.dataset.tool);
        card.hidden = !match;
        if (match) any = true;
      });
      section.hidden = !any;
    });
    shown = ids.size;
    if (nav) nav.hidden = true;
    empty.hidden = shown > 0;
    status.textContent = shown ? `${shown} tool${shown === 1 ? '' : 's'} match “${q}”` : '';
  }

  input.addEventListener('input', apply);
  input.addEventListener('keydown', e => { if (e.key === 'Escape' && input.value) { input.value = ''; apply(); } });
  const q = new URLSearchParams(location.search).get('q');
  if (q) { input.value = q.slice(0, 80); apply(); }
})();
