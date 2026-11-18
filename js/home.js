/* Home page: "Pick up where you left off".
   - Saved resumes (newest three) from this browser's storage, each linking to resume.html?id=…
   - Recently used tools: only the tool ids that js/site.js remembers.
   Both stay current while the page is open: a resume deleted, renamed or saved in another tab
   (BroadcastChannel "applyready-resumes", posted by the resume builder and Your data), or the
   recently used list cleared there, is reflected here at once, so a deleted resume's name does not
   stay on screen on a shared computer. Nothing is stored or sent from here. */
(function () {
  'use strict';
  const section = document.getElementById('homeContinue');
  const list = document.getElementById('homeRecent');
  const resumes = document.getElementById('homeResumes');
  if (!section) return;
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const show = () => { section.hidden = !((list && !list.hidden && list.children.length) || (resumes && !resumes.hidden && resumes.children.length)); };
  const hasResumes = () => !!(resumes && !resumes.hidden && resumes.children.length);

  // Recently used tools. The resume cards, when there are any, replace the generic "Resume builder" card.
  function renderRecent() {
    if (!list || !window.ApplyReadySearch) return;
    const recent = window.ApplyReadySearch.itemsById(window.ApplyReadySearch.recentIds())
      .filter(i => i.kind === 'tool' && !(i.id === 'resume' && hasResumes())).slice(0, 4);
    list.innerHTML = recent.map(t => `
    <li class="tool-card" data-tool="${esc(t.id)}">
      <a class="tool-card__link" href="${esc(t.path)}">
        <span class="tool-card__icon" aria-hidden="true"><i class="fa-solid fa-${esc(t.icon)}"></i></span>
        <span class="tool-card__body"><span class="tool-card__name">${esc(t.name)}</span><span class="tool-card__desc">${esc(t.summary)}</span></span>
      </a>
    </li>`).join('');
    list.hidden = !recent.length;
    show();
  }

  function renderResumes(rows) {
    if (!resumes) return;
    const Lib = window.ApplyReadyResumeLibrary;
    resumes.innerHTML = rows.map(r => {
      const name = Lib.cleanName(r.name) || 'Untitled resume';
      return `
    <li class="tool-card" data-resume="${esc(r.id)}">
      <a class="tool-card__link" href="resume.html?id=${encodeURIComponent(r.id)}">
        <span class="tool-card__icon" aria-hidden="true"><i class="fa-solid fa-file-lines"></i></span>
        <span class="tool-card__body"><span class="tool-card__name">Continue editing ${esc(name)}</span><span class="tool-card__desc" title="${esc(Lib.absoluteTime(r.updatedAt))}">Edited ${esc(Lib.relativeTime(r.updatedAt))}, saved on this device</span></span>
      </a>
    </li>`;
    }).join('');
    resumes.hidden = !rows.length;
    renderRecent();
  }

  // Saved resumes. The database is only read when it already exists, so a first visit creates nothing.
  async function readResumes() {
    const Store = window.ApplyReadyStore;
    const Lib = window.ApplyReadyResumeLibrary;
    if (!Store || !Lib || typeof indexedDB === 'undefined') return [];
    if (indexedDB.databases) {
      const dbs = await indexedDB.databases();
      if (!dbs.some(db => db.name === Store.DB_NAME)) return [];
    }
    const status = await Store.status();
    if (!status.persistent) return [];
    const saving = await Store.get('meta', 'resumeSaving');
    if (saving && saving.value === 'off') return []; // a shared computer: do not show the last person's resumes
    return (await Store.getAll('resumes'))
      .filter(r => r && typeof r.id === 'string' && Lib.ID_PATTERN.test(r.id) && r.data && typeof r.data === 'object' && !Array.isArray(r.data))
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
      .slice(0, 3);
  }
  let reading = null, again = false;
  async function refreshResumes() {
    if (!resumes || !window.ApplyReadyStore || !window.ApplyReadyResumeLibrary) return;
    if (reading) { again = true; return; }
    reading = (async () => {
      do {
        again = false;
        try { renderResumes(await readResumes()); }
        catch (e) { /* storage is optional here; the rest of the home page works without it */ }
      } while (again);
    })();
    await reading;
    reading = null;
  }

  renderRecent();
  refreshResumes();

  // Changes made in other tabs. A deleted resume is taken off the page straight away, without reading
  // the database: Your data is deleting it, and opening it now would hold that up.
  let timer = null;
  try {
    if (typeof BroadcastChannel === 'function') {
      const channel = new BroadcastChannel('applyready-resumes');
      channel.onmessage = e => {
        const msg = e.data || {};
        if (msg.type === 'deleted') {
          if (!resumes) return;
          const card = typeof msg.id === 'string' && msg.id ? resumes.querySelector(`[data-resume="${CSS.escape(msg.id)}"]`) : null;
          if (card) card.remove();
          resumes.hidden = !resumes.children.length;
          renderRecent();
        } else if (msg.type === 'saved' || msg.type === 'renamed') {
          clearTimeout(timer);
          timer = setTimeout(refreshResumes, 300);
        }
      };
    }
  } catch (e) { /* no cross-tab updates in this browser; a reload shows the current state */ }
  // The recently used list (localStorage) cleared or switched off in another tab.
  window.addEventListener('storage', e => { if (e.key === null || e.key === 'applyready_recent_tools' || e.key === 'applyready_recent_off') renderRecent(); });
})();
