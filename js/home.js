/* Home page: "Pick up where you left off".
   - Saved resumes (newest three) from this browser's storage, each linking to resume.html?id=…
   - Recently used tools: only the tool ids that js/site.js remembers.
   Nothing is stored or sent from here. */
(function () {
  'use strict';
  const section = document.getElementById('homeContinue');
  const list = document.getElementById('homeRecent');
  const resumes = document.getElementById('homeResumes');
  if (!section) return;
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const show = () => { section.hidden = !((list && !list.hidden && list.children.length) || (resumes && !resumes.hidden && resumes.children.length)); };

  let recent = [];
  if (list && window.ApplyReadySearch) {
    recent = window.ApplyReadySearch.itemsById(window.ApplyReadySearch.recentIds()).filter(i => i.kind === 'tool').slice(0, 4);
    list.innerHTML = recent.map(t => `
    <li class="tool-card" data-tool="${esc(t.id)}">
      <a class="tool-card__link" href="${esc(t.path)}">
        <span class="tool-card__icon" aria-hidden="true"><i class="fa-solid fa-${esc(t.icon)}"></i></span>
        <span class="tool-card__body"><span class="tool-card__name">${esc(t.name)}</span><span class="tool-card__desc">${esc(t.summary)}</span></span>
      </a>
    </li>`).join('');
    list.hidden = !recent.length;
  }
  show();

  // Saved resumes. The database is only read when it already exists, so a first visit creates nothing.
  (async function savedResumes() {
    const Store = window.ApplyReadyStore;
    const Lib = window.ApplyReadyResumeLibrary;
    if (!resumes || !Store || !Lib) return;
    try {
      if (typeof indexedDB === 'undefined') return;
      if (indexedDB.databases) {
        const dbs = await indexedDB.databases();
        if (!dbs.some(db => db.name === Store.DB_NAME)) return;
      }
      const status = await Store.status();
      if (!status.persistent) return;
      const saving = await Store.get('meta', 'resumeSaving');
      if (saving && saving.value === 'off') return; // a shared computer: do not show the last person's resumes
      const rows = (await Store.getAll('resumes'))
        .filter(r => r && typeof r.id === 'string' && Lib.ID_PATTERN.test(r.id) && r.data && typeof r.data === 'object' && !Array.isArray(r.data))
        .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
        .slice(0, 3);
      if (!rows.length) return;
      resumes.innerHTML = rows.map(r => {
        const name = Lib.cleanName(r.name) || 'Untitled resume';
        return `
    <li class="tool-card">
      <a class="tool-card__link" href="resume.html?id=${encodeURIComponent(r.id)}">
        <span class="tool-card__icon" aria-hidden="true"><i class="fa-solid fa-file-lines"></i></span>
        <span class="tool-card__body"><span class="tool-card__name">Continue editing ${esc(name)}</span><span class="tool-card__desc" title="${esc(Lib.absoluteTime(r.updatedAt))}">Edited ${esc(Lib.relativeTime(r.updatedAt))}, saved on this device</span></span>
      </a>
    </li>`;
      }).join('');
      resumes.hidden = false;
      // The resume cards replace the generic "Resume builder" card among the recent tools.
      if (list) {
        const generic = list.querySelector('[data-tool="resume"]');
        if (generic) generic.remove();
        list.hidden = !list.children.length;
      }
      show();
    } catch (e) { /* storage is optional here; the rest of the home page works without it */ }
  })();
})();
