/* Your data (your-data.html): everything ApplyReady keeps in this browser, following the storage
   contract in docs/ARCHITECTURE.md section 3, with ways to back it up and delete it.

   Reads and writes IndexedDB only through js/lib/store.js; resume data goes through
   js/resume-schema.js (validate, migrate) before it is exported or imported. Nothing is sent anywhere. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const Store = window.ApplyReadyStore, Schema = window.ApplyReadySchema, Files = window.ApplyReadyFiles;
  if (!$('ydResumeList') || !Store || !Schema || !Files) return;
  const ui = () => window.ApplyReadyUI || {};
  const announce = msg => { if (window.ApplyReadyFileKit) window.ApplyReadyFileKit.announce(msg); };
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const plural = (n, one, many) => `${n} ${n === 1 ? one : (many || one + 's')}`;
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const fmtDate = ms => { const d = new Date(ms); return isNaN(d) || !ms ? 'unknown' : `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
  const MAX_IMPORT = 5 * 1024 * 1024;
  const LIBRARY_VERSION = 1;   // newest resume-library backup version this page understands
  const SINGLE_VERSION = 2;    // newest single-resume backup version
  const KEY = { theme: 'applyready_theme', recent: 'applyready_recent_tools', recentOff: 'applyready_recent_off' };
  const ID_RE = /^[A-Za-z0-9_-]{1,80}$/;

  const ls = {
    get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } },
    remove: k => { try { localStorage.removeItem(k); } catch (e) { /* unavailable */ } },
    keys: () => { const out = []; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith('applyready_')) out.push(k); } } catch (e) { /* unavailable */ } return out; }
  };

  let wiped = false;   // after "Delete everything" the database is not opened (and so not recreated) again
  let records = [];

  function done(message) {
    const box = $('ydDone');
    $('ydDoneText').textContent = message;
    box.hidden = false;
    box.focus();
    announce(message);
  }
  function panelNotice(id, message, isError) {
    const box = $(id);
    if (!box) return;
    box.querySelector('.notice__body').textContent = message || '';
    box.hidden = !message;
    if (message && !isError) announce(message);
  }

  /* ---------------------------------------------------------------- saved resumes */
  function displayName(rec) {
    if (rec && typeof rec.name === 'string' && rec.name.trim()) return rec.name.trim().slice(0, 120);
    const n = rec && rec.data && rec.data.personal && rec.data.personal.fullName;
    return typeof n === 'string' && n.trim() ? n.trim().slice(0, 120) : 'Untitled resume';
  }
  function classify(rec) {
    let ok = false;
    try { ok = !!rec && typeof rec.id === 'string' && ID_RE.test(rec.id) && Schema.validate({ data: rec.data }); } catch (e) { ok = false; }
    return { rec, ok, id: rec && rec.id, name: displayName(rec), updatedAt: Number(rec && rec.updatedAt) || 0 };
  }

  async function loadResumes() {
    panelNotice('ydResumeError', '');
    if (wiped) { records = []; renderResumes(); return; }
    try {
      const all = await Store.getAll('resumes');
      records = (all || []).map(classify).sort((a, b) => b.updatedAt - a.updatedAt);
    } catch (e) {
      records = [];
      panelNotice('ydResumeError', `Saved resumes could not be read from this browser\u2019s storage. ${e && e.message ? e.message : ''}`.trim(), true);
    }
    renderResumes();
  }

  function renderResumes() {
    const list = $('ydResumeList');
    const n = records.length;
    const damaged = records.filter(r => !r.ok).length;
    $('ydResumeCount').textContent = n ? plural(n, 'resume') + (damaged ? `, ${damaged} damaged` : '') : 'None';
    $('ydResumeEmpty').hidden = n > 0;
    list.hidden = n === 0;
    list.innerHTML = records.map(r => r.ok ? `
      <li class="file-row" data-id="${esc(r.id)}">
        <span class="file-row__thumb" aria-hidden="true"><i class="fa-solid fa-file-lines"></i></span>
        <div class="file-row__text"><span class="file-row__name">${esc(r.name)}</span><span class="file-row__meta">Last edited ${esc(fmtDate(r.updatedAt))}</span></div>
        <div class="file-row__actions"><a class="btn btn-sm" href="resume.html?id=${encodeURIComponent(r.id)}" aria-label="Open ${esc(r.name)} in the resume builder">Open</a></div>
      </li>` : `
      <li class="file-row" data-status="error" data-id="${esc(r.id)}">
        <span class="file-row__thumb" aria-hidden="true"><i class="fa-solid fa-triangle-exclamation"></i></span>
        <div class="file-row__text"><span class="file-row__name">${esc(r.name)}</span><span class="file-row__error">Damaged: this record cannot be opened safely.</span></div>
        <div class="file-row__actions">
          <button type="button" class="btn btn-sm" data-act="raw" aria-label="Download a raw copy of ${esc(r.name)}">Download raw copy</button>
          <button type="button" class="btn btn-sm btn-danger-ghost" data-act="delete" aria-label="Delete ${esc(r.name)}">Delete</button>
        </div>
      </li>`).join('');
    const good = records.filter(r => r.ok).length;
    $('ydExport').hidden = good === 0;
    $('ydDeleteResumes').hidden = n === 0;
  }

  $('ydResumeList').addEventListener('click', async e => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const id = btn.closest('[data-id]').dataset.id;
    const r = records.find(x => String(x.id) === id);
    if (!r) return;
    if (btn.dataset.act === 'raw') {
      Files.download(new Blob([JSON.stringify(r.rec, null, 2)], { type: 'application/json' }), `damaged-resume-${String(r.id).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40) || 'record'}.json`);
      announce('Raw copy downloaded.');
    } else {
      const okay = ui().confirm ? await ui().confirm({ title: 'Delete this damaged resume?', message: `\u201C${r.name}\u201D will be removed from this browser. Download a raw copy first if you want to try to recover it.`, confirmLabel: 'Delete', danger: true }) : true;
      if (!okay) return;
      try { await Store.remove('resumes', r.rec.id); await loadResumes(); done(`Deleted \u201C${r.name}\u201D.`); }
      catch (err) { panelNotice('ydResumeError', 'That resume could not be deleted. Close other ApplyReady tabs and try again.', true); }
    }
  });

  function backupName() {
    const d = new Date();
    return `applyready-resumes-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.json`;
  }

  $('ydExport').addEventListener('click', () => {
    const good = records.filter(r => r.ok);
    if (!good.length) return;
    const backup = {
      app: 'ApplyReady', kind: 'resume-library', version: LIBRARY_VERSION, exportedAt: new Date().toISOString(),
      resumes: good.map(r => ({ name: r.name, createdAt: Number(r.rec.createdAt) || 0, updatedAt: Number(r.rec.updatedAt) || 0, data: Schema.migrate(r.rec.data) }))
    };
    Files.download(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }), backupName());
    const skipped = records.length - good.length;
    done(`Backup of ${plural(good.length, 'resume')} downloaded.${skipped ? ` ${plural(skipped, 'damaged record')} ${skipped === 1 ? 'was' : 'were'} not included; use Download raw copy for ${skipped === 1 ? 'it' : 'them'}.` : ''} Keep the file somewhere safe.`);
  });

  function newId() {
    const a = new Uint8Array(12);
    try { crypto.getRandomValues(a); } catch (e) { for (let i = 0; i < a.length; i++) a[i] = Math.floor(Math.random() * 256); }
    return 'r_' + Array.from(a, b => (b % 36).toString(36)).join('');
  }
  const validTime = (t, now) => (Number.isFinite(t) && t > 0 && t <= now + 864e5 ? t : now);

  /** Turn a backup file's text into resume records, or throw an Error with a plain message. */
  function parseBackup(text) {
    let obj;
    try { obj = JSON.parse(text); } catch (e) { throw new Error('This file is not a valid backup: it is not readable JSON. Choose a .json file that ApplyReady downloaded.'); }
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('This file is not an ApplyReady backup.');
    if (obj.app !== 'ApplyReady') throw new Error('This file was not made by ApplyReady, so it was not imported.');
    let entries;
    if (obj.kind === 'resume-library') {
      if (typeof obj.version !== 'number') throw new Error('This backup has no version number, so it cannot be read safely.');
      if (obj.version > LIBRARY_VERSION) throw new Error('This backup was made by a newer version of ApplyReady. Reload this page to get the latest version, then try again.');
      if (!Array.isArray(obj.resumes)) throw new Error('This backup is damaged: its list of resumes is missing.');
      entries = obj.resumes.slice(0, 1000).map(r => (r && typeof r === 'object' ? r : {}));
    } else if (obj.kind === undefined && 'data' in obj) {
      if (typeof obj.version === 'number' && obj.version > SINGLE_VERSION) throw new Error('This backup was made by a newer version of ApplyReady. Reload this page to get the latest version, then try again.');
      entries = [{ data: obj.data }];
    } else throw new Error('This ApplyReady file is not a resume backup.');
    const now = Date.now();
    const out = [];
    let skipped = 0;
    for (const e of entries) {
      let valid = false;
      try { valid = Schema.validate({ data: e.data }); } catch (err) { valid = false; }
      if (!valid) { skipped++; continue; }
      const data = Schema.migrate(e.data);
      const name = typeof e.name === 'string' && e.name.trim() ? e.name.trim().slice(0, 120) : (data.personal && data.personal.fullName ? data.personal.fullName.slice(0, 120) : 'Imported resume');
      const createdAt = validTime(Number(e.createdAt), now);
      out.push({ id: newId(), name, createdAt, updatedAt: Math.max(createdAt, validTime(Number(e.updatedAt), now)), schemaVersion: data.schemaVersion || data.version || 2, data });
    }
    return { records: out, skipped, total: entries.length };
  }

  async function importFile(file) {
    panelNotice('ydResumeError', '');
    panelNotice('ydImportResult', '');
    if (!file) return;
    if (file.size === 0) { panelNotice('ydResumeError', `${file.name} is empty (0 bytes), so there is nothing to import.`, true); return; }
    if (file.size > MAX_IMPORT) { panelNotice('ydResumeError', `${file.name} is ${Files.formatBytes(file.size)}. Backups up to 5 MB can be imported; this is too large to be an ApplyReady backup.`, true); return; }
    if (wiped) wiped = false; // importing after a full delete starts a fresh database on purpose
    let parsed;
    try { parsed = parseBackup(await file.text()); }
    catch (e) { panelNotice('ydResumeError', e.message, true); return; }
    if (!parsed.records.length) {
      panelNotice('ydResumeError', parsed.total ? `None of the ${plural(parsed.total, 'resume')} in this backup could be read, so nothing was imported.` : 'This backup has no resumes in it.', true);
      return;
    }
    let added = 0;
    try { for (const rec of parsed.records) { await Store.put('resumes', rec); added++; } }
    catch (e) { panelNotice('ydResumeError', `Only ${plural(added, 'resume was', 'resumes were')} saved: this browser refused to store more. ${e && e.message ? e.message : ''}`.trim(), true); }
    await loadResumes();
    if (added) panelNotice('ydImportResult', `Added ${plural(added, 'resume')} from ${file.name} as new entries; nothing was overwritten.${parsed.skipped ? ` ${plural(parsed.skipped, 'resume')} could not be read and ${parsed.skipped === 1 ? 'was' : 'were'} skipped.` : ''}`);
    await renderStorage();
  }
  $('ydImport').addEventListener('click', () => { const input = $('ydImportInput'); input.value = ''; input.click(); });
  $('ydImportInput').addEventListener('change', e => { const f = e.target.files && e.target.files[0]; e.target.value = ''; importFile(f); });

  $('ydDeleteResumes').addEventListener('click', async () => {
    const n = records.length;
    if (!n) return;
    const okay = ui().confirm ? await ui().confirm({ title: `Delete ${plural(n, 'saved resume')}?`, message: `Every saved resume will be removed from this browser. This cannot be undone. Download a backup first if you might need ${n === 1 ? 'it' : 'them'} again.`, confirmLabel: 'Delete all resumes', danger: true }) : true;
    if (!okay) return;
    try {
      await Store.clear('resumes');
      try { await Store.remove('meta', 'lastResumeId'); } catch (e) { /* optional record */ }
      await loadResumes();
      await renderStorage();
      done(`Deleted ${plural(n, 'saved resume')}.`);
    } catch (e) { panelNotice('ydResumeError', 'The resumes could not be deleted. Close other ApplyReady tabs and try again.', true); }
  });

  /* ---------------------------------------------------------------- recently used tools */
  function recentIds() {
    try { const v = JSON.parse(ls.get(KEY.recent) || '[]'); return Array.isArray(v) ? v.filter(x => typeof x === 'string').slice(0, 6) : []; } catch (e) { return []; }
  }
  function renderRecent() {
    const index = window.APPLYREADY_TOOL_INDEX;
    const items = recentIds().map(id => (index && index.items.find(i => i.id === id)) || null).filter(Boolean);
    const off = ls.get(KEY.recentOff) === '1';
    $('ydRecentOn').checked = !off;
    $('ydRecentCount').textContent = off ? 'Off' : items.length ? plural(items.length, 'tool') : 'Empty';
    $('ydRecentList').hidden = !items.length;
    $('ydRecentEmpty').hidden = !!items.length;
    $('ydRecentEmpty').textContent = off ? 'Off: ApplyReady does not remember which tools you open.' : 'The list is empty.';
    $('ydRecentList').innerHTML = items.map(t => `<li><a href="${esc(t.path)}"><i class="fa-solid fa-${esc(t.icon)}" aria-hidden="true"></i>${esc(t.name)}</a></li>`).join('');
    $('ydRecentClear').hidden = !items.length;
  }
  $('ydRecentOn').addEventListener('change', e => {
    if (e.target.checked) { ls.remove(KEY.recentOff); announce('ApplyReady will remember the tools you open.'); }
    else { ls.set(KEY.recentOff, '1'); ls.remove(KEY.recent); announce('Recently used tools turned off and the list cleared.'); }
    renderRecent();
  });
  $('ydRecentClear').addEventListener('click', () => {
    ls.remove(KEY.recent);
    renderRecent();
    $('ydRecentOn').focus();
    announce('Recently used tools cleared.');
  });

  /* ---------------------------------------------------------------- theme */
  const media = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  function renderTheme() {
    const stored = ls.get(KEY.theme);
    const system = media && media.matches ? 'dark' : 'light';
    const chosen = stored === 'light' || stored === 'dark';
    $('ydThemeText').textContent = chosen
      ? `${stored === 'dark' ? 'Dark' : 'Light'}, chosen with the theme button at the top of each page. Your device is set to ${system}.`
      : `Follows your device\u2019s setting, which is ${system} at the moment. Nothing is stored.`;
    $('ydThemeReset').hidden = !chosen;
  }
  $('ydThemeReset').addEventListener('click', () => {
    ls.remove(KEY.theme);
    const theme = media && media.matches ? 'dark' : 'light';
    document.documentElement.dataset.theme = theme;
    const toggle = $('themeToggle');
    if (toggle) { const next = theme === 'dark' ? 'light' : 'dark'; toggle.setAttribute('aria-label', `Switch to ${next} theme`); toggle.title = `Switch to ${next} theme`; }
    document.querySelectorAll('meta[name="theme-color"]').forEach(m => { m.content = theme === 'dark' ? '#1a1a19' : '#ffffff'; });
    renderTheme();
    $('ydThemeText').setAttribute('tabindex', '-1');
    $('ydThemeText').focus();
    announce(`The theme now follows your device: ${theme}.`);
  });

  /* ---------------------------------------------------------------- storage and persistence */
  async function renderStorage() {
    const st = navigator.storage;
    let usageText = 'Not reported by this browser';
    try {
      if (st && st.estimate) {
        const e = await st.estimate();
        if (typeof e.usage === 'number') usageText = `${Files.formatBytes(e.usage)}${e.quota ? `, of up to about ${Files.formatBytes(e.quota)} this browser allows` : ''}`;
      }
    } catch (e) { /* optional */ }
    $('ydUsage').textContent = usageText;
    let persisted = null;
    try { if (st && st.persisted) persisted = await st.persisted(); } catch (e) { persisted = null; }
    $('ydPersisted').textContent = persisted === true ? 'Yes' : persisted === false ? 'No' : 'Not supported by this browser';
    $('ydPersist').hidden = persisted !== false || !(st && st.persist);
    if (!wiped) {
      try {
        const s = await Store.status();
        const warn = $('ydStorageWarning');
        if (!s.persistent) {
          $('ydStorageWarningText').textContent = 'This browser is not letting ApplyReady save anything right now (this happens in some private windows and when site data is blocked). Resumes cannot be kept on this device; download backups instead.';
          warn.hidden = false;
        } else warn.hidden = true;
      } catch (e) { /* status is optional */ }
    }
  }
  $('ydPersist').addEventListener('click', async () => {
    const granted = await Store.requestPersistence();
    const note = $('ydPersistResult');
    note.textContent = granted
      ? 'Done. This browser agreed not to clear ApplyReady\u2019s data on its own. Clearing site data yourself still removes it, so keep a backup.'
      : 'The browser said no for now. Chrome and Edge usually agree for sites you use often, bookmark or install; Firefox may ask you; Safari decides by itself. A backup file keeps your resumes safe either way.';
    note.hidden = false;
    await renderStorage();
    announce(note.textContent);
  });

  /* ---------------------------------------------------------------- offline copy */
  async function offlineCaches() {
    if (!('caches' in window)) return null;
    try { return (await caches.keys()).filter(k => k.startsWith('applyready-')); } catch (e) { return null; }
  }
  async function offlineSize(names) {
    let files = 0, bytes = 0;
    for (const name of names) {
      try {
        const cache = await caches.open(name);
        for (const req of await cache.keys()) {
          files++;
          const res = await cache.match(req);
          if (!res) continue;
          const len = Number(res.headers.get('content-length'));
          bytes += len > 0 ? len : (await res.blob()).size;
        }
      } catch (e) { /* skip unreadable caches */ }
    }
    return { files, bytes };
  }
  let offlineInfo = { names: [], files: 0, bytes: 0 };
  async function renderOffline() {
    const names = await offlineCaches();
    if (names === null) { $('ydOfflineSize').textContent = 'Not available'; $('ydOfflineRemove').hidden = true; offlineInfo = { names: [], files: 0, bytes: 0 }; return; }
    const size = await offlineSize(names);
    offlineInfo = { names, files: size.files, bytes: size.bytes };
    $('ydOfflineSize').textContent = size.files ? `${plural(size.files, 'file')}, ${Files.formatBytes(size.bytes)}` : 'None';
    $('ydOfflineRemove').hidden = !names.length;
  }
  $('ydOfflineRemove').addEventListener('click', async () => {
    const { names, bytes } = offlineInfo;
    for (const n of names) { try { await caches.delete(n); } catch (e) { /* ignore */ } }
    await renderOffline();
    await renderStorage();
    done(`Offline copy removed (${Files.formatBytes(bytes)}). ApplyReady saves a fresh copy the next time you open one of its pages while online.`);
  });

  /* ---------------------------------------------------------------- delete everything */
  $('ydDeleteAll').addEventListener('click', async () => {
    const keys = ls.keys();
    const n = records.length;
    const parts = [plural(n, 'saved resume')];
    if (keys.length) parts.push(plural(keys.length, 'setting'));
    if (offlineInfo.files) parts.push(`the offline copy (${Files.formatBytes(offlineInfo.bytes)})`);
    parts.push('the offline service');
    const okay = ui().confirm ? await ui().confirm({ title: 'Delete everything ApplyReady stored?', message: `This removes from this browser: ${parts.join(', ')}. It cannot be undone. Download a backup first if you want to keep your resumes.`, confirmLabel: 'Delete everything', danger: true }) : true;
    if (!okay) return;
    const removed = [];
    const problems = [];
    // 1. The IndexedDB database (saved resumes and app records)
    const destroyed = await Store.destroy();
    wiped = true;
    if (destroyed) removed.push(`${plural(n, 'saved resume')} and the resume database`);
    else problems.push('The resume database could not be deleted while ApplyReady is open in another tab. Close the other tabs, then select Delete everything again.');
    // 2. Settings in localStorage and sessionStorage
    keys.forEach(k => ls.remove(k));
    try { Object.keys(sessionStorage).filter(k => k.startsWith('applyready_')).forEach(k => sessionStorage.removeItem(k)); } catch (e) { /* unavailable */ }
    const left = ls.keys();
    if (keys.length) removed.push(`${plural(keys.length - left.length, 'setting')} (${keys.map(k => k.replace(/^applyready_/, '').replace(/_/g, ' ')).join(', ')})`);
    // 3. The offline copy
    const names = (await offlineCaches()) || [];
    for (const c of names) { try { await caches.delete(c); } catch (e) { problems.push('Part of the offline copy could not be removed.'); } }
    if (names.length) removed.push(`the offline copy (${Files.formatBytes(offlineInfo.bytes)})`);
    // 4. The service worker that keeps the offline copy
    try {
      if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations) {
        const regs = await navigator.serviceWorker.getRegistrations();
        let count = 0;
        for (const r of regs) { if (await r.unregister()) count++; }
        if (count) removed.push('the offline service');
      }
    } catch (e) { /* not available */ }
    document.documentElement.dataset.theme = media && media.matches ? 'dark' : 'light';
    records = [];
    renderResumes(); renderRecent(); renderTheme();
    await renderOffline();
    await renderStorage();
    const summary = removed.length ? `Deleted ${removed.join('; ')}.` : 'Nothing was stored, so there was nothing to delete.';
    done(`${summary}${problems.length ? ' ' + problems.join(' ') : ' Nothing ApplyReady stored is left in this browser.'} If you open ApplyReady pages again, a fresh offline copy is saved; your resumes are not coming back unless you import a backup.`);
  });

  /* ---------------------------------------------------------------- start */
  renderRecent();
  renderTheme();
  loadResumes().then(renderStorage);
  renderOffline();
  if (media && media.addEventListener) media.addEventListener('change', renderTheme);
})();
