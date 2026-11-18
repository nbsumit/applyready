/* Your data (your-data.html): everything ApplyReady keeps in this browser, following the storage
   contract in docs/ARCHITECTURE.md section 3, with ways to back it up and delete it.

   Reads and writes IndexedDB only through js/lib/store.js; records and backups go through
   js/resume-library.js (and so js/resume-schema.js), the same code the resume builder uses. Nothing is sent anywhere. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const Store = window.ApplyReadyStore, Lib = window.ApplyReadyResumeLibrary, Files = window.ApplyReadyFiles;
  if (!$('ydResumeList') || !Store || !Lib || !Files) return;
  const ui = () => window.ApplyReadyUI || {};
  const announce = msg => { if (window.ApplyReadyFileKit) window.ApplyReadyFileKit.announce(msg); };
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const plural = (n, one, many) => `${n} ${n === 1 ? one : (many || one + 's')}`;
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const fmtDate = ms => { const d = new Date(ms); return isNaN(d) || !ms ? 'unknown' : `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
  const KEY = { theme: 'applyready_theme', recent: 'applyready_recent_tools', recentOff: 'applyready_recent_off' };

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
  // Record checks, backup formats and import parsing are the resume library's (js/resume-library.js),
  // so this page and the resume builder always read and write the same files.
  function sortRecords(all) {
    const { records: good, damaged } = Lib.sortOut(all || []);
    return good.map(rec => ({ ok: true, id: rec.id, name: rec.name, updatedAt: rec.updatedAt, rec }))
      .concat(damaged.map(d => ({ ok: false, id: d.raw && typeof d.raw.id === 'string' ? d.raw.id : '', name: d.name, updatedAt: d.updatedAt, reason: d.reason, raw: d.raw })));
  }

  // Tell open resume builder tabs what changed here, so a tab showing a deleted resume stops saving
  // it again, and an open My resumes list refreshes (BroadcastChannel "applyready-resumes").
  let channel = null;
  try { if (typeof BroadcastChannel === 'function') channel = new BroadcastChannel('applyready-resumes'); } catch (e) { channel = null; }
  const tabId = 'your-data-' + Math.random().toString(36).slice(2);
  function post(message) {
    if (!channel) return;
    try { channel.postMessage(Object.assign({ from: tabId }, message)); } catch (e) { /* closed channel */ }
  }
  function postDeleted(list) { list.forEach(r => { if (r.id) post({ type: 'deleted', id: r.id }); }); }

  let savingOff = false;
  async function loadResumes() {
    panelNotice('ydResumeError', '');
    if (wiped) { records = []; savingOff = false; renderResumes(); return; }
    try {
      records = sortRecords(await Store.getAll('resumes'));
      let row = null;
      try { row = await Store.get('meta', 'resumeSaving'); } catch (e) { row = null; }
      savingOff = !!row && row.value === 'off';
    } catch (e) {
      records = [];
      panelNotice('ydResumeError', 'Saved resumes could not be read from this browser’s storage. Close other ApplyReady tabs and reload this page.', true);
    }
    renderResumes();
  }

  function renderResumes() {
    const list = $('ydResumeList');
    const n = records.length;
    const damaged = records.filter(r => !r.ok).length;
    $('ydResumeCount').textContent = n ? plural(n, 'resume') + (damaged ? `, ${damaged} damaged` : '') : 'None';
    $('ydResumeEmpty').hidden = n > 0;
    $('ydSavingOff').hidden = !savingOff;
    list.hidden = n === 0;
    list.innerHTML = records.map((r, i) => r.ok ? `
      <li class="file-row" data-index="${i}" data-id="${esc(r.id)}">
        <span class="file-row__thumb" aria-hidden="true"><i class="fa-solid fa-file-lines"></i></span>
        <div class="file-row__text"><span class="file-row__name">${esc(r.name)}</span><span class="file-row__meta">Last edited ${esc(fmtDate(r.updatedAt))}</span></div>
        <div class="file-row__actions"><a class="btn btn-sm" href="resume.html?id=${encodeURIComponent(r.id)}" aria-label="Open ${esc(r.name)} in the resume builder">Open</a></div>
      </li>` : `
      <li class="file-row" data-status="error" data-index="${i}" data-id="${esc(r.id)}">
        <span class="file-row__thumb" aria-hidden="true"><i class="fa-solid fa-triangle-exclamation"></i></span>
        <div class="file-row__text"><span class="file-row__name">${esc(r.name)}</span><span class="file-row__error">Damaged: ${esc(r.reason)} It cannot be opened.</span></div>
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
    const r = records[Number(btn.closest('[data-index]').dataset.index)];
    if (!r || r.ok) return;
    if (btn.dataset.act === 'raw') {
      // The same envelope the resume builder uses for a damaged entry.
      const body = { app: 'ApplyReady', kind: 'damaged-resume-record', exportedAt: new Date().toISOString(), reason: r.reason, record: r.raw };
      Files.download(new Blob([JSON.stringify(body, null, 2)], { type: 'application/json' }), Lib.fileName(r.name, 'damaged_resume_raw.json'));
      announce('Raw copy downloaded. It cannot be imported as a resume, but its text can be copied from the file.');
    } else {
      const okay = ui().confirm ? await ui().confirm({ title: 'Delete this damaged resume?', message: `“${r.name}” will be removed from this browser. Download a raw copy first if you want to try to recover it.`, confirmLabel: 'Delete', danger: true }) : true;
      if (!okay) return;
      if (!r.id) { panelNotice('ydResumeError', 'This damaged entry has no usable identifier, so it can only be removed with Delete all resumes.', true); return; }
      try { await Store.remove('resumes', r.id); postDeleted([r]); await loadResumes(); done(`Deleted “${r.name}”.`); }
      catch (err) { panelNotice('ydResumeError', 'That resume could not be deleted. Close other ApplyReady tabs and try again.', true); }
    }
  });

  $('ydExport').addEventListener('click', () => {
    const good = records.filter(r => r.ok).map(r => r.rec);
    if (!good.length) return;
    Files.download(new Blob([JSON.stringify(Lib.libraryBackup(good), null, 2)], { type: 'application/json' }), Lib.fileName('ApplyReady', `resumes_backup_${new Date().toISOString().slice(0, 10)}.json`));
    const skipped = records.length - good.length;
    done(`Backup of ${plural(good.length, 'resume')} downloaded.${skipped ? ` ${plural(skipped, 'damaged record')} ${skipped === 1 ? 'was' : 'were'} not included; use Download raw copy for ${skipped === 1 ? 'it' : 'them'}.` : ''} Keep the file somewhere safe.`);
  });

  let importing = false;
  async function importFile(file) {
    panelNotice('ydResumeError', '');
    panelNotice('ydImportResult', '');
    if (!file || importing) return;
    if (file.size === 0) { panelNotice('ydResumeError', `${file.name} is empty (0 bytes), so there is nothing to import.`, true); return; }
    if (file.size > Lib.MAX_IMPORT_BYTES) { panelNotice('ydResumeError', `${file.name} is ${Files.formatBytes(file.size)}. Backups up to 5 MB can be imported; this is too large to be an ApplyReady backup.`, true); return; }
    if (savingOff) { panelNotice('ydResumeError', 'Saving resumes on this device is turned off in the resume builder, so nothing was imported. To read a backup without storing it, import it in the resume builder; to store it here, turn saving on there first.', true); return; }
    importing = true;
    const btn = $('ydImport');
    btn.disabled = true;
    try {
      let parsed;
      try { parsed = Lib.parseBackup(await file.text(), file.size); }
      catch (e) { panelNotice('ydResumeError', e instanceof Lib.ImportError ? e.message : 'This backup could not be imported. Your saved resumes are unchanged.', true); return; }
      if (wiped) wiped = false; // importing after a full delete starts a fresh database on purpose
      // Each resume becomes a new entry with a new id and keeps its edit dates (never later than now),
      // exactly as an import in the resume builder does.
      const now = Date.now();
      const created = parsed.resumes.map((item, i) => Lib.createRecord(item.data, {
        name: item.name, createdAt: Math.min(item.createdAt || now, now) || undefined, updatedAt: Math.min(item.updatedAt || now - i, now) || undefined
      }));
      let added = 0;
      try { for (const rec of created) { await Store.put('resumes', rec); added++; post({ type: 'saved', id: rec.id, updatedAt: rec.updatedAt }); } }
      catch (e) { panelNotice('ydResumeError', `Only ${plural(added, 'resume was', 'resumes were')} saved: this browser refused to store more. Its storage for this site may be full.`, true); }
      await loadResumes();
      if (added) {
        let msg = `Added ${plural(added, 'resume')} from ${file.name} as new entries; nothing was overwritten.`;
        if (parsed.skipped) msg += ` ${plural(parsed.skipped, 'resume')} could not be read and ${parsed.skipped === 1 ? 'was' : 'were'} skipped.`;
        if (parsed.overLimit) msg += ` One import holds at most ${Lib.MAX_IMPORT_RESUMES} resumes, so the last ${parsed.overLimit} in the file ${parsed.overLimit === 1 ? 'was' : 'were'} not imported.`;
        panelNotice('ydImportResult', msg);
      }
      await renderStorage();
    } finally {
      importing = false;
      btn.disabled = false;
    }
  }
  $('ydImport').addEventListener('click', () => { const input = $('ydImportInput'); input.value = ''; input.click(); });
  $('ydImportInput').addEventListener('change', e => { const f = e.target.files && e.target.files[0]; e.target.value = ''; importFile(f); });

  $('ydDeleteResumes').addEventListener('click', async () => {
    await loadResumes(); // count what is stored now, not when the page opened
    const n = records.length;
    if (!n) return;
    const okay = ui().confirm ? await ui().confirm({ title: `Delete ${plural(n, 'saved resume')}?`, message: `Every saved resume will be removed from this browser. This cannot be undone. Download a backup first if you might need ${n === 1 ? 'it' : 'them'} again.`, confirmLabel: 'Delete all resumes', danger: true }) : true;
    if (!okay) return;
    const gone = records.slice();
    try {
      await Store.clear('resumes');
      try { await Store.remove('meta', 'lastResumeId'); } catch (e) { /* optional record */ }
      postDeleted(gone);
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
    await loadResumes(); // count what is stored now, not when the page opened
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
    // 1. The IndexedDB database (saved resumes and app records). Open resume builder tabs are told
    //    first, so they stop autosaving (and so recreating) what is being deleted.
    postDeleted(records);
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
