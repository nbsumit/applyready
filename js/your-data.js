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
  // Releases before the resume library kept one draft in localStorage. The resume builder moves it
  // into the library when it opens with saving on; until then it is listed here like a resume.
  const LEGACY = { draft: 'applyready_resume_draft', flag: 'applyready_draft_enabled' };
  // Changes to a resume typed just before the page closed, copied by the resume builder in case its
  // save was cut short (js/resume-library-ui.js, UNSAVED_PREFIX). They hold a whole resume, so they
  // are listed, exported and deleted with the resumes, never counted as a setting.
  const UNSAVED = 'applyready_resume_unsaved:';

  const ls = {
    get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } },
    remove: k => { try { localStorage.removeItem(k); } catch (e) { /* unavailable */ } },
    keys: () => { const out = []; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith('applyready_')) out.push(k); } } catch (e) { /* unavailable */ } return out; }
  };

  let wiped = false;   // after "Delete everything" the database is not opened (and so not recreated) again
  let records = [];
  let legacy = null;   // { data, savedAt } or { raw } from LEGACY.draft, or null
  let unsaved = [];    // [{ key, id, name, savedAt, data }] from UNSAVED copies

  function readUnsaved() {
    return ls.keys().filter(k => k.startsWith(UNSAVED)).map(key => {
      let stash = null, data = null;
      try { stash = JSON.parse(ls.get(key)); data = stash && typeof stash.json === 'string' ? JSON.parse(stash.json) : null; } catch (e) { stash = stash || null; }
      const name = (stash && typeof stash.name === 'string' && stash.name.trim()) || (data ? Lib.suggestName(data) : Lib.DEFAULT_NAME);
      return { key, id: stash && typeof stash.id === 'string' ? stash.id : '', name, savedAt: stash && stash.savedAt, data };
    });
  }

  // Opening the database creates it, so it is opened only when it already exists: looking at this
  // page must not store anything. Browsers that cannot list databases open it as before.
  async function databaseExists() {
    if (wiped) return false;
    try {
      if (typeof indexedDB === 'undefined' || !indexedDB.databases) return true;
      return (await indexedDB.databases()).some(db => db && db.name === Store.DB_NAME);
    } catch (e) { return true; }
  }

  function done(message) {
    const box = $('ydDone');
    $('ydDoneText').textContent = message;
    box.hidden = false;
    // Moving focus here reads the message; announcing it as well would read it twice.
    box.focus();
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
    legacy = Lib.readLegacyDraft(ls.get(LEGACY.draft));
    unsaved = readUnsaved();
    if (!(await databaseExists())) { records = []; savingOff = false; renderResumes(); return; }
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

  function legacyRow() {
    if (!legacy) return '';
    const who = legacy.data ? Lib.suggestName(legacy.data) : '';
    const when = legacy.savedAt ? `, last saved ${fmtDate(legacy.savedAt)}` : '';
    const what = legacy.data
      ? `Kept by an earlier version of the resume builder${when}. The builder adds it to your saved resumes the next time it opens with saving on.`
      : 'Kept by an earlier version of the resume builder, but it cannot be read as a resume.';
    return `
      <li class="file-row" data-legacy="true"${legacy.data ? '' : ' data-status="error"'}>
        <span class="file-row__thumb" aria-hidden="true"><i class="fa-solid fa-clock-rotate-left"></i></span>
        <div class="file-row__text"><span class="file-row__name">Draft from an earlier version${who && who !== Lib.DEFAULT_NAME ? `: ${esc(who)}` : ''}</span><span class="file-row__meta">${esc(what)}</span></div>
        <div class="file-row__actions">
          <button type="button" class="btn btn-sm" data-act="legacy-download" aria-label="Download the draft from an earlier version">${legacy.data ? 'Download' : 'Download raw copy'}</button>
          <button type="button" class="btn btn-sm btn-danger-ghost" data-act="legacy-delete" aria-label="Delete the draft from an earlier version">Delete</button>
        </div>
      </li>`;
  }

  function unsavedRows() {
    return unsaved.map((u, i) => {
      const when = u.savedAt ? `, typed ${fmtDate(u.savedAt)}` : '';
      const what = savingOff
        ? `Changes typed just before the page closed${when}, not saved. Saving is off on this device, so the resume builder removes them when it opens.`
        : `Changes typed just before the page closed${when}, not saved yet. The resume builder saves them the next time it opens.`;
      return `
      <li class="file-row" data-unsaved="${i}">
        <span class="file-row__thumb" aria-hidden="true"><i class="fa-solid fa-clock-rotate-left"></i></span>
        <div class="file-row__text"><span class="file-row__name">Unsaved changes: ${esc(u.name)}</span><span class="file-row__meta">${esc(what)}</span></div>
        <div class="file-row__actions">
          ${u.data ? `<button type="button" class="btn btn-sm" data-act="unsaved-download" aria-label="Download the unsaved changes of ${esc(u.name)}">Download</button>` : ''}
          <button type="button" class="btn btn-sm btn-danger-ghost" data-act="unsaved-delete" aria-label="Delete the unsaved changes of ${esc(u.name)}">Delete</button>
        </div>
      </li>`;
    }).join('');
  }

  function renderResumes() {
    const list = $('ydResumeList');
    const n = records.length;
    const damaged = records.filter(r => !r.ok).length;
    const count = n ? plural(n, 'resume') + (damaged ? `, ${damaged} damaged` : '') : '';
    const pending = unsaved.length ? `unsaved changes of ${plural(unsaved.length, 'resume')}` : '';
    $('ydResumeCount').textContent = [count, legacy ? '1 earlier draft' : '', pending].filter(Boolean).join(', ') || 'None';
    $('ydResumeEmpty').hidden = n > 0 || !!legacy || unsaved.length > 0;
    $('ydSavingOff').hidden = !savingOff;
    list.hidden = n === 0 && !legacy && !unsaved.length;
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
      </li>`).join('') + legacyRow() + unsavedRows();
    const good = records.filter(r => r.ok).length;
    $('ydExport').hidden = good === 0 && !unsaved.some(u => u.data);
    $('ydDeleteResumes').hidden = n === 0 && !legacy && !unsaved.length;
  }

  function unsavedAction(act, u) {
    if (!u) return;
    if (act === 'unsaved-download') {
      const at = u.savedAt || Date.now();
      Files.download(new Blob([JSON.stringify(Lib.singleBackup({ name: u.name, data: u.data, createdAt: at, updatedAt: at }), null, 2)], { type: 'application/json' }), Lib.fileName(u.name, 'unsaved_changes_backup.json'));
      announce('Unsaved changes downloaded as a backup file. You can import it in the resume builder or on this page.');
      return;
    }
    return (async () => {
      const okay = ui().confirm ? await ui().confirm({ title: 'Delete these unsaved changes?', message: `The changes to “${u.name}” typed just before the page closed will be removed from this browser. A saved version of that resume, if there is one, is not touched.`, confirmLabel: 'Delete', danger: true }) : true;
      if (!okay) return;
      ls.remove(u.key);
      await loadResumes();
      done(`Deleted the unsaved changes of “${u.name}”.`);
    })();
  }

  $('ydResumeList').addEventListener('click', async e => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    if (btn.dataset.act === 'legacy-download' || btn.dataset.act === 'legacy-delete') { legacyAction(btn.dataset.act); return; }
    if (btn.dataset.act === 'unsaved-download' || btn.dataset.act === 'unsaved-delete') { unsavedAction(btn.dataset.act, unsaved[Number(btn.closest('[data-unsaved]').dataset.unsaved)]); return; }
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
      try { await Store.remove('resumes', r.id); ls.remove(UNSAVED + r.id); postDeleted([r]); await loadResumes(); done(`Deleted “${r.name}”.`); }
      catch (err) { panelNotice('ydResumeError', 'That resume could not be deleted. Close other ApplyReady tabs and try again.', true); }
    }
  });

  async function legacyAction(act) {
    if (!legacy) return;
    if (act === 'legacy-download') {
      if (legacy.data) {
        const name = Lib.suggestName(legacy.data);
        const at = legacy.savedAt || Date.now();
        Files.download(new Blob([JSON.stringify(Lib.singleBackup({ name, data: legacy.data, createdAt: at, updatedAt: at }), null, 2)], { type: 'application/json' }), Lib.fileName(name, 'resume_backup.json'));
        announce('Draft downloaded as a backup file. You can import it in the resume builder or on this page.');
      } else {
        const body = { app: 'ApplyReady', kind: 'damaged-resume-record', exportedAt: new Date().toISOString(), reason: 'A draft from an earlier version that cannot be read as a resume.', record: legacy.raw };
        Files.download(new Blob([JSON.stringify(body, null, 2)], { type: 'application/json' }), Lib.fileName('ApplyReady', 'earlier_draft_raw.json'));
        announce('Raw copy downloaded. It cannot be imported as a resume, but its text can be copied from the file.');
      }
      return;
    }
    const okay = ui().confirm ? await ui().confirm({ title: 'Delete the draft from an earlier version?', message: 'It will be removed from this browser. This cannot be undone. Download it first if you might need it.', confirmLabel: 'Delete', danger: true }) : true;
    if (!okay) return;
    ls.remove(LEGACY.draft);
    ls.remove(LEGACY.flag);
    await loadResumes();
    if (legacy) panelNotice('ydResumeError', 'The draft could not be deleted. Close other ApplyReady tabs and try again.', true);
    else done('Deleted the draft from an earlier version.');
  }

  $('ydExport').addEventListener('click', () => {
    const good = records.filter(r => r.ok).map(r => r.rec);
    // Unsaved changes go in too, as entries of their own, so the backup holds everything listed here.
    const pending = unsaved.filter(u => u.data).map(u => ({ name: `${u.name} (unsaved changes)`, data: u.data, createdAt: u.savedAt || Date.now(), updatedAt: u.savedAt || Date.now() }));
    if (!good.length && !pending.length) return;
    Files.download(new Blob([JSON.stringify(Lib.libraryBackup(good.concat(pending)), null, 2)], { type: 'application/json' }), Lib.fileName('ApplyReady', `resumes_backup_${new Date().toISOString().slice(0, 10)}.json`));
    const skipped = records.length - good.length;
    // Resumes saved by an earlier release with text over the limits are backed up shortened (js/resume-library.js inspect).
    const trimmed = good.filter(rec => rec.trimmed).length;
    const shortened = trimmed ? ` ${plural(trimmed, 'resume')} ${trimmed === 1 ? 'has' : 'have'} text over the limits and ${trimmed === 1 ? 'is' : 'are'} shortened in the file; open ${trimmed === 1 ? 'it' : 'each one'} in the resume builder and use Download the original for the full text.` : '';
    done(`Backup of ${plural(good.length, 'resume')}${pending.length ? ` and the unsaved changes of ${plural(pending.length, 'resume')}` : ''} downloaded.${skipped ? ` ${plural(skipped, 'damaged record')} ${skipped === 1 ? 'was' : 'were'} not included; use Download raw copy for ${skipped === 1 ? 'it' : 'them'}.` : ''}${shortened} Keep the file somewhere safe.`);
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
      // Without browser storage the store keeps records in this tab's memory only: an import would
      // look successful and vanish when the tab closes, so say so instead.
      let persistent = true;
      try { persistent = wiped || (await Store.status()).persistent; } catch (e) { persistent = true; }
      if (!persistent) { panelNotice('ydResumeError', 'This browser is not letting ApplyReady save anything right now, so the backup could not be stored here. To use it for this visit only, import it in the resume builder.', true); return; }
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
        if (parsed.trimmed) msg += ` ${parsed.trimmed === 1 ? (parsed.resumes.length === 1 ? 'It had' : 'One had') : `${parsed.trimmed} had`} text over the limits (a box over 50,000 characters or a list over 150 entries), so ${parsed.trimmed === 1 ? 'it was' : 'they were'} shortened to fit; the file you imported is unchanged.`;
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
    const hadDraft = !!legacy;
    const pending = unsaved.slice();
    if (!n && !hadDraft && !pending.length) return;
    const what = [n ? plural(n, 'saved resume') : '', hadDraft ? 'the draft from an earlier version' : '', pending.length ? `the unsaved changes of ${plural(pending.length, 'resume')}` : ''].filter(Boolean).join(' and ');
    const okay = ui().confirm ? await ui().confirm({ title: `Delete ${what}?`, message: `Every saved resume${hadDraft ? ', and the draft from an earlier version,' : ''}${pending.length ? ', and every unsaved change,' : ''} will be removed from this browser. This cannot be undone. Download a backup first if you might need ${n + (hadDraft ? 1 : 0) + pending.length === 1 ? 'it' : 'them'} again.`, confirmLabel: 'Delete all resumes', danger: true }) : true;
    if (!okay) return;
    const gone = records.slice();
    try {
      if (n) {
        await Store.clear('resumes');
        try { await Store.remove('meta', 'lastResumeId'); } catch (e) { /* optional record */ }
        postDeleted(gone);
      }
      if (hadDraft) { ls.remove(LEGACY.draft); ls.remove(LEGACY.flag); }
      pending.forEach(u => ls.remove(u.key));
      await loadResumes();
      await renderStorage();
      done(`Deleted ${what}.`);
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
    if (await databaseExists()) {
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
    await renderSiteCopy();
  }

  // The service worker answers questions about the full copy of the site (sw.js, "Messages").
  let serviceGone = false;   // unregistered by Delete everything
  function within(promise, ms) { return Promise.race([promise, new Promise(resolve => setTimeout(() => resolve(null), ms))]); }
  async function offlineService() {
    if (serviceGone || !('serviceWorker' in navigator) || typeof MessageChannel !== 'function') return null;
    try { const reg = await within(navigator.serviceWorker.ready, 4000); return reg && reg.active ? reg.active : null; } catch (e) { return null; }
  }
  function ask(sw, type, onProgress) {
    return new Promise(resolve => {
      const channel = new MessageChannel();
      let timer = null;
      const wait = () => { clearTimeout(timer); timer = setTimeout(() => resolve(null), 60000); };
      channel.port1.onmessage = e => {
        const m = e.data || {};
        if (m.type === 'progress') { wait(); if (onProgress) onProgress(m); return; }
        clearTimeout(timer);
        resolve(m);
      };
      wait();
      try { sw.postMessage({ type }, [channel.port2]); } catch (e) { clearTimeout(timer); resolve(null); }
    });
  }
  async function renderSiteCopy() {
    const btn = $('ydOfflineAll'), note = $('ydOfflineAllNote');
    const sw = await offlineService();
    const info = sw ? await within(ask(sw, 'site-info'), 5000) : null;
    if (!info || !info.files) { btn.hidden = true; note.hidden = true; return; }
    const all = info.saved >= info.files;
    btn.hidden = all;
    note.hidden = false;
    note.textContent = all
      ? 'Every tool and guide is saved for offline use. One exception: the character maps for PDFs whose text is in Chinese, Japanese or Korean are not saved (they are large), so such text in a PDF needs a connection the first time it is read or drawn.'
      : `${info.saved} of the site’s ${info.files} files are saved. Saving every tool and guide downloads up to about ${Files.formatBytes(info.transfer)} and keeps about ${Files.formatBytes(info.bytes)} on this device.`;
  }
  let savingSite = false;
  $('ydOfflineAll').addEventListener('click', async () => {
    if (savingSite) return;
    const sw = await offlineService();
    const btn = $('ydOfflineAll'), progress = $('ydOfflineProgress');
    if (!sw) { progress.textContent = 'The offline service is not running in this browser, so nothing could be saved. Reload the page and try again.'; progress.hidden = false; return; }
    savingSite = true;
    btn.disabled = true;
    btn.setAttribute('aria-busy', 'true');
    progress.hidden = false;
    progress.textContent = 'Saving every tool for offline use…';
    const result = await ask(sw, 'save-site', m => { progress.textContent = `Saving every tool for offline use: ${m.done} of ${m.total} files…`; });
    savingSite = false;
    btn.disabled = false;
    btn.removeAttribute('aria-busy');
    progress.hidden = true;
    await renderOffline();
    await renderStorage();
    if (result && result.failed === 0) done('Every tool and guide is saved for offline use on this device. One exception: the character maps for PDFs whose text is in Chinese, Japanese or Korean are not saved (they are large), so such text in a PDF needs a connection the first time it is read or drawn.');
    else if (result && result.failed > 0) done(`${result.saved} of ${result.files} files are saved for offline use; ${plural(result.failed, 'file')} could not be downloaded. Check your connection and select Save every tool for offline use again.`);
    else done('The files could not be saved for offline use. Check your connection, reload the page and try again.');
  });

  $('ydOfflineRemove').addEventListener('click', async () => {
    const { names, bytes } = offlineInfo;
    for (const n of names) { try { await caches.delete(n); } catch (e) { /* ignore */ } }
    await renderOffline();
    await renderStorage();
    done(`Offline copy removed (${Files.formatBytes(bytes)}). ApplyReady keeps a page again when you open it while online.`);
  });

  /* ---------------------------------------------------------------- delete everything */
  $('ydDeleteAll').addEventListener('click', async () => {
    await loadResumes(); // count what is stored now, not when the page opened
    // The draft and unsaved changes are listed with the resumes, not as settings.
    const keys = ls.keys().filter(k => k !== LEGACY.draft && !k.startsWith(UNSAVED));
    const pending = unsaved.slice();
    const n = records.length;
    const parts = [plural(n, 'saved resume')];
    if (legacy) parts.push('a draft from an earlier version');
    if (pending.length) parts.push(`the unsaved changes of ${plural(pending.length, 'resume')}`);
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
    if (await databaseExists()) {
      const destroyed = await Store.destroy();
      if (destroyed) removed.push(`${plural(n, 'saved resume')} and the resume database`);
      else problems.push('The resume database could not be deleted while ApplyReady is open in another tab. Close the other tabs, then select Delete everything again.');
    }
    wiped = true;
    ls.remove(LEGACY.draft);
    if (legacy) { removed.push('the draft from an earlier version'); legacy = null; }
    pending.forEach(u => ls.remove(u.key));
    if (pending.length) removed.push(`the unsaved changes of ${plural(pending.length, 'resume')}`);
    unsaved = [];
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
        serviceGone = true;
      }
    } catch (e) { /* not available */ }
    document.documentElement.dataset.theme = media && media.matches ? 'dark' : 'light';
    records = [];
    renderResumes(); renderRecent(); renderTheme();
    await renderOffline();
    await renderStorage();
    const summary = removed.length ? `Deleted ${removed.join('; ')}.` : 'Nothing was stored, so there was nothing to delete.';
    done(`${summary}${problems.length ? ' ' + problems.join(' ') : ' Nothing ApplyReady stored is left in this browser.'} If you open ApplyReady pages again, those pages are kept for offline use again; your resumes are not coming back unless you import a backup.`);
  });

  /* ---------------------------------------------------------------- start */
  renderRecent();
  renderTheme();
  loadResumes().then(renderStorage);
  renderOffline();
  if (media && media.addEventListener) media.addEventListener('change', renderTheme);
})();
