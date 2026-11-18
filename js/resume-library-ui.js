/* Resume builder: saving on this device, "My resumes", backups and cross-tab safety.

   - Autosave is on by default. Changes are written to IndexedDB (js/lib/store.js) about 600 ms after
     typing stops, and at once when the tab is hidden or closed. The status next to the page title
     says what happened: Saving…, Saved on this device, or why it could not save.
   - "Save on this device" can be switched off for a shared computer (meta resumeSaving = 'off'):
     nothing is written, a note says so, and leaving with changes asks for confirmation.
   - "My resumes" lists every saved resume: open, rename, duplicate, delete, export, import, new.
     Damaged records are listed as damaged with Export raw and Delete.
   - Another tab saving the same resume pauses saving here and offers a choice instead of
     overwriting (BroadcastChannel "applyready-resumes", plus a timestamp check before each write).
   Record and backup formats: js/resume-library.js and docs/ARCHITECTURE.md. Nothing is uploaded. */
(function () {
  'use strict';
  const doc = document;
  const $ = id => doc.getElementById(id);
  const LIB = window.ApplyReadyResumeLibrary;
  const STORE = window.ApplyReadyStore;
  const SCHEMA = window.ApplyReadySchema;
  const ui = () => window.ApplyReadyUI || {};
  const notify = (message, error) => { if (ui().notify) ui().notify(message, !!error); };
  const askConfirm = options => (ui().confirm ? ui().confirm(options) : Promise.resolve(window.confirm(options.message)));
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const SAVE_DELAY = 600;
  const LEGACY_DRAFT = 'applyready_resume_draft';
  const LEGACY_FLAG = 'applyready_draft_enabled';
  const CHANNEL = 'applyready-resumes';
  const tabId = LIB ? LIB.newId() : String(Math.random());

  const state = {
    editor: null,
    loaded: false,
    current: null,        // { id, name, nameBase, createdAt, updatedAt }
    stored: false,        // the current resume exists in storage
    baseUpdatedAt: 0,     // updatedAt of the stored version this tab last read or wrote
    lastSavedJSON: '',    // the data as last written (or as opened), to skip no-op writes
    savingOn: true,
    persistent: true,
    phase: 'loading',
    error: '',
    timer: null,
    writing: null,
    again: false,
    conflict: null,       // { kind: 'changed' | 'deleted', updatedAt }
    records: [],
    damaged: [],
    channel: null,
    dialogOpen: false,
    opener: null,
    renaming: -1,
    importError: '',
    notFound: '',
    announcedSave: false
  };

  /* ------------------------------------------------------------------ Storage helpers */
  async function getMeta(key) {
    try { const row = await STORE.get('meta', key); return row ? row.value : undefined; } catch (e) { return undefined; }
  }
  async function setMeta(key, value) {
    try { await STORE.put('meta', { key, value }); } catch (e) { /* a preference that cannot be stored is not fatal */ }
  }
  async function loadList() {
    let raw = [];
    try { raw = await STORE.getAll('resumes'); } catch (e) { raw = []; }
    const sorted = LIB.sortOut(raw);
    state.records = sorted.records;
    state.damaged = sorted.damaged;
    return sorted;
  }
  const findRecord = id => state.records.find(r => r.id === id) || null;
  const editorJSON = () => JSON.stringify(state.editor.getData());
  const hasUnsaved = () => state.loaded && editorJSON() !== state.lastSavedJSON;
  const canWrite = () => state.savingOn && !state.conflict;

  // Releases before the library kept one draft in localStorage. Move it into the library once.
  async function migrateLegacyDraft() {
    let text = null;
    try { text = localStorage.getItem(LEGACY_DRAFT); } catch (e) { return; }
    const found = LIB.readLegacyDraft(text);
    try {
      if (found && found.data) {
        await STORE.put('resumes', LIB.createRecord(found.data, { updatedAt: found.savedAt || Date.now(), createdAt: found.savedAt || Date.now() }));
      } else if (found && found.raw !== undefined) {
        // Keep an unreadable draft as a damaged entry, so it can still be exported, rather than drop it.
        const now = Date.now();
        await STORE.put('resumes', { id: LIB.newId(), name: 'Draft from an earlier version', createdAt: now, updatedAt: now, schemaVersion: 0, data: found.raw });
      }
      localStorage.removeItem(LEGACY_DRAFT);
      localStorage.removeItem(LEGACY_FLAG);
    } catch (e) { /* leave the draft where it is and try again next time */ }
  }

  /* ------------------------------------------------------------------ Status near the title */
  const ICONS = { loading: 'fa-hourglass-half', idle: 'fa-circle-info', pending: 'fa-rotate', saving: 'fa-rotate', saved: 'fa-circle-check', off: 'fa-circle-pause', memory: 'fa-triangle-exclamation', error: 'fa-triangle-exclamation', conflict: 'fa-triangle-exclamation' };
  function statusText() {
    switch (state.phase) {
      case 'loading': return 'Opening your saved resumes…';
      case 'idle': return state.savingOn ? 'New resume. It saves on this device as you type.' : 'Not saved: saving is off on this device';
      case 'pending':
      case 'saving': return 'Saving…';
      case 'saved': return `Saved on this device · ${LIB.relativeTime(state.current && state.current.updatedAt)}`;
      case 'off': return 'Not saved: saving is off on this device';
      case 'memory': return 'Not saved: this browser is not keeping data for this site';
      case 'conflict': return state.conflict && state.conflict.kind === 'deleted' ? 'Not saved: deleted in another tab' : 'Saving paused: changed in another tab';
      case 'error': return 'Not saved: storage failed';
      default: return '';
    }
  }
  function setPhase(phase) {
    state.phase = phase;
    renderStatus();
  }
  function renderStatus() {
    const box = $('saveStatus');
    if (box) {
      box.dataset.state = state.phase;
      const icon = box.querySelector('i');
      if (icon) icon.className = `fa-solid ${ICONS[state.phase] || 'fa-circle-info'}`;
      const textNode = $('saveStatusText');
      if (textNode) textNode.textContent = statusText();
      box.title = state.phase === 'saved' && state.current ? `Last saved ${LIB.absoluteTime(state.current.updatedAt)}` : '';
    }
    const name = $('resumeName');
    if (name && state.current) name.textContent = state.current.name;
    const keep = $('saveDeviceStatus');
    if (keep) keep.textContent = statusText();
    renderNotice();
  }
  function effectivePhase() {
    if (!state.loaded) return 'loading';
    if (state.conflict) return 'conflict';
    if (!state.savingOn) return hasUnsaved() || state.editor.hasUserChanges() ? 'off' : 'idle';
    if (!state.persistent) return 'memory';
    if (state.phase === 'error') return 'error';
    if (!state.stored && !hasUnsaved()) return 'idle';
    return hasUnsaved() ? 'pending' : 'saved';
  }

  // One notice under the page head explains anything that needs a decision or puts work at risk.
  function renderNotice() {
    const box = $('saveNotice');
    if (!box) return;
    let html = '';
    let tone = 'warning';
    const backup = '<button type="button" class="btn btn-sm" data-notice="backup"><i class="fa-solid fa-file-export" aria-hidden="true"></i> Download backup</button>';
    if (!state.loaded) html = '';
    else if (state.conflict && state.conflict.kind === 'changed') {
      html = `<p><strong>This resume was changed in another tab or window.</strong> Saving is paused here so neither version is overwritten.</p>
        <div class="rb-notice__actions"><button type="button" class="btn btn-sm btn-primary" data-notice="reload">Load the other version</button><button type="button" class="btn btn-sm" data-notice="copy">Save mine as a copy</button><button type="button" class="btn btn-sm btn-ghost" data-notice="overwrite">Keep mine and overwrite</button></div>`;
    } else if (state.conflict && state.conflict.kind === 'deleted') {
      html = `<p><strong>This resume was deleted in another tab.</strong> What you see here is not saved.</p>
        <div class="rb-notice__actions"><button type="button" class="btn btn-sm btn-primary" data-notice="copy">Save it as a new resume</button></div>`;
    } else if (!state.savingOn) {
      html = `<p><strong>Saving is off on this device.</strong> Nothing you type is stored in this browser, and it is lost when you close the tab. Download a backup file to keep a copy.</p>
        <div class="rb-notice__actions">${backup}<button type="button" class="btn btn-sm btn-ghost" data-notice="saving-on">Turn saving on</button></div>`;
      tone = 'info';
    } else if (!state.persistent) {
      html = `<p><strong>This browser is not keeping data for ApplyReady</strong> (for example in a private window, or when site data is blocked). Your work is lost when you close this tab. Download a backup file to keep a copy.</p>
        <div class="rb-notice__actions">${backup}</div>`;
    } else if (state.phase === 'error') {
      html = `<p><strong>Your latest changes could not be saved on this device.</strong> ${esc(state.error)} Download a backup file now so you do not lose them.</p>
        <div class="rb-notice__actions"><button type="button" class="btn btn-sm btn-primary" data-notice="retry">Try saving again</button>${backup}</div>`;
      tone = 'error';
    } else if (state.notFound) {
      html = `<p>${esc(state.notFound)}</p><div class="rb-notice__actions"><button type="button" class="btn btn-sm btn-ghost" data-notice="dismiss">Dismiss</button></div>`;
      tone = 'info';
    }
    const key = tone + html;
    if (box.dataset.key === key) return;
    box.dataset.key = key;
    box.hidden = !html;
    box.className = `notice notice--${tone} rb-notice`;
    box.innerHTML = html ? `<i class="fa-solid ${tone === 'info' ? 'fa-circle-info' : 'fa-triangle-exclamation'}" aria-hidden="true"></i><div class="notice__body">${html}</div>` : '';
  }
  function refreshStatus() { setPhase(effectivePhase()); }

  /* ------------------------------------------------------------------ Saving */
  function scheduleSave() {
    if (!state.loaded) return;
    clearTimeout(state.timer);
    state.timer = null;
    if (!canWrite()) { refreshStatus(); return; }
    if (!hasUnsaved()) { refreshStatus(); return; }
    // An untouched new resume is not written: opening the builder must not fill the list with blanks.
    if (!state.stored && state.editor.isEmpty()) { refreshStatus(); return; }
    setPhase(state.persistent ? 'pending' : 'memory');
    state.timer = setTimeout(() => { flush(); }, SAVE_DELAY);
  }

  function updateUrl() {
    if (!state.current || !state.stored || !window.history || !history.replaceState) return;
    try {
      const url = new URL(location.href);
      if (url.searchParams.get('id') === state.current.id) return;
      url.searchParams.set('id', state.current.id);
      history.replaceState(history.state, '', url.pathname + url.search + url.hash);
    } catch (e) { /* the address bar is a convenience */ }
  }

  async function askPersistenceOnce() {
    if (await getMeta('persistAsked')) return;
    await setMeta('persistAsked', true);
    STORE.requestPersistence();
  }

  /* Write the open resume now. Resolves true when the stored copy matches the editor. */
  function flush(force) {
    clearTimeout(state.timer);
    state.timer = null;
    if (!state.loaded || !state.current || !canWrite()) return Promise.resolve(false);
    if (state.writing) { state.again = true; return state.writing; }
    const json = editorJSON();
    if (json === state.lastSavedJSON && state.stored) { refreshStatus(); return Promise.resolve(true); }
    if (!force && !state.stored && state.editor.isEmpty()) { refreshStatus(); return Promise.resolve(false); }
    if (state.persistent) setPhase('saving');
    state.writing = (async () => {
      try {
        const cur = state.current;
        let name = cur.name;
        if (state.stored) {
          const existing = await STORE.get('resumes', cur.id);
          if (!existing) { state.conflict = { kind: 'deleted' }; refreshStatus(); notify('This resume was deleted in another tab. Your changes here are not saved.', true); return false; }
          if ((existing.updatedAt || 0) > state.baseUpdatedAt) { state.conflict = { kind: 'changed', updatedAt: existing.updatedAt }; refreshStatus(); notify('This resume was changed in another tab. Saving is paused until you choose which version to keep.', true); return false; }
          // A rename made in another tab wins unless this tab renamed it as well.
          if (typeof existing.name === 'string' && existing.name !== cur.nameBase && cur.name === cur.nameBase) name = LIB.cleanName(existing.name) || name;
        }
        const data = JSON.parse(json);
        if (name === LIB.DEFAULT_NAME) name = LIB.suggestName(data);
        const now = Math.max(Date.now(), state.baseUpdatedAt + 1);
        await STORE.put('resumes', { id: cur.id, name, createdAt: cur.createdAt, updatedAt: now, schemaVersion: SCHEMA.CURRENT_VERSION, data });
        if (state.current !== cur) return false;
        cur.name = name; cur.nameBase = name; cur.updatedAt = now;
        state.baseUpdatedAt = now;
        state.stored = true;
        state.lastSavedJSON = json;
        state.error = '';
        state.phase = 'saved';
        await setMeta('lastResumeId', cur.id);
        post({ type: 'saved', id: cur.id, updatedAt: now });
        updateUrl();
        refreshStatus();
        if (!state.announcedSave && state.persistent) { state.announcedSave = true; notify('Saved on this device. Changes now save as you type.'); }
        if (state.persistent) askPersistenceOnce();
        if (state.dialogOpen) { await loadList(); renderList(); }
        return true;
      } catch (e) {
        state.error = /quota/i.test(String(e && (e.name || e.message))) ? 'The browser says its storage for this site is full.' : 'The browser refused to store it.';
        setPhase('error');
        notify('Your changes could not be saved on this device. Download a backup file to keep them.', true);
        return false;
      } finally {
        state.writing = null;
        if (state.again) { state.again = false; scheduleSave(); }
      }
    })();
    return state.writing;
  }

  // Put a resume in the editor and make it the one that saves.
  function useResume(rec, options) {
    const o = options || {};
    clearTimeout(state.timer);
    state.editor.setResume(rec.data);
    state.current = { id: rec.id, name: rec.name, nameBase: rec.name, createdAt: rec.createdAt, updatedAt: rec.updatedAt };
    state.stored = !!o.stored;
    state.baseUpdatedAt = o.stored ? rec.updatedAt : 0;
    state.lastSavedJSON = o.stored ? editorJSON() : '';
    state.conflict = null;
    state.notFound = '';
    if (o.stored) { if (state.savingOn) setMeta('lastResumeId', rec.id); updateUrl(); }
    else if (o.unsavedBaseline) state.lastSavedJSON = editorJSON();
    refreshStatus();
  }

  function newRecordFor(data, name) {
    return LIB.createRecord(data, { name: name || LIB.DEFAULT_NAME });
  }

  // Before replacing the open resume, save it; when saving is off, ask before dropping changes.
  async function leaveCurrent(actionLabel) {
    if (!state.current) return true;
    if (canWrite()) { await flush(); return true; }
    if (hasUnsaved() && !state.editor.isEmpty()) {
      return askConfirm({ title: 'Leave this resume without saving?', message: 'Saving is off, so the changes to the resume on screen are lost. Download a backup first if you need them.', confirmLabel: actionLabel || 'Continue', danger: true });
    }
    return true;
  }

  /* ------------------------------------------------------------------ Cross-tab messages */
  function post(message) {
    if (!state.channel) return;
    try { state.channel.postMessage(Object.assign({ from: tabId }, message)); } catch (e) { /* closed channel */ }
  }
  async function onRemote(msg) {
    if (!msg || typeof msg !== 'object' || msg.from === tabId || typeof msg.id !== 'string') return;
    if (state.dialogOpen) { await loadList(); renderList(); }
    if (!state.current || msg.id !== state.current.id) return;
    if (msg.type === 'saved' && typeof msg.updatedAt === 'number' && msg.updatedAt > state.baseUpdatedAt) {
      clearTimeout(state.timer);
      state.conflict = { kind: 'changed', updatedAt: msg.updatedAt };
      refreshStatus();
      notify('This resume was just changed in another tab. Choose which version to keep before you continue.', true);
    } else if (msg.type === 'deleted') {
      clearTimeout(state.timer);
      state.conflict = { kind: 'deleted' };
      state.stored = false;
      refreshStatus();
      notify('This resume was deleted in another tab. What you see here is not saved.', true);
    } else if (msg.type === 'renamed' && typeof msg.name === 'string' && state.current.name === state.current.nameBase) {
      state.current.name = state.current.nameBase = LIB.cleanName(msg.name) || state.current.name;
      refreshStatus();
    }
  }

  async function resolveConflict(choice) {
    const cur = state.current;
    if (!cur) return;
    if (choice === 'reload') {
      let raw = null;
      try { raw = await STORE.get('resumes', cur.id); } catch (e) { raw = null; }
      const result = raw ? LIB.inspect(raw) : null;
      if (!result || !result.ok) { notify('The other version could not be read. Your version is still on screen.', true); return; }
      useResume(result.record, { stored: true });
      notify(`Loaded the latest version of “${result.record.name}”.`);
    } else if (choice === 'overwrite') {
      let raw = null;
      try { raw = await STORE.get('resumes', cur.id); } catch (e) { raw = null; }
      state.baseUpdatedAt = raw ? (raw.updatedAt || 0) : 0;
      state.stored = !!raw;
      state.conflict = null;
      await flush(true);
      notify('Your version is saved.');
    } else if (choice === 'copy') {
      const rec = newRecordFor(state.editor.getData(), `${cur.name} (copy)`);
      state.conflict = null;
      state.current = { id: rec.id, name: rec.name, nameBase: rec.name, createdAt: rec.createdAt, updatedAt: rec.updatedAt };
      state.stored = false;
      state.baseUpdatedAt = 0;
      state.lastSavedJSON = '';
      await flush(true);
      notify(`Saved as a new resume, “${state.current.name}”.`);
    }
    refreshStatus();
  }

  /* ------------------------------------------------------------------ Files */
  function downloadJSON(name, payload) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = doc.createElement('a');
    a.href = url;
    a.download = name;
    doc.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
  function currentAsRecord() {
    const cur = state.current;
    return { id: cur.id, name: cur.name === LIB.DEFAULT_NAME ? LIB.suggestName(state.editor.getData()) : cur.name, createdAt: cur.createdAt, updatedAt: cur.updatedAt || Date.now(), data: state.editor.getData() };
  }
  function exportOne(rec) {
    downloadJSON(LIB.fileName(rec.name, 'resume_backup.json'), LIB.singleBackup(rec));
    notify(`Backup of “${rec.name}” downloaded. Keep the file somewhere safe; import it to restore the resume.`);
  }
  async function exportCurrent() {
    if (!state.current) return;
    await flush();
    exportOne(currentAsRecord());
  }

  // Import a backup file: every resume in it becomes a new entry; the first one opens.
  async function importFile(file) {
    state.importError = '';
    if (!file) return;
    let result;
    try {
      if (file.size > LIB.MAX_IMPORT_BYTES) throw new LIB.ImportError('This file is larger than 5 MB, which is far more than any resume backup. Choose the .json file that ApplyReady saved.');
      let text;
      try { text = await file.text(); } catch (e) { throw new LIB.ImportError('This file could not be read. Choose it again, or copy it to this device first.'); }
      result = LIB.parseBackup(text, file.size);
    } catch (e) {
      const message = e instanceof LIB.ImportError ? e.message : 'This backup could not be imported. Your saved resumes are unchanged.';
      state.importError = message;
      if (state.dialogOpen) renderList();
      notify(message, true);
      return;
    }
    if (!(await leaveCurrent('Import and open'))) return;
    const created = result.resumes.map(item => LIB.createRecord(item.data, { name: item.name, createdAt: item.createdAt || undefined }));
    let saved = 0;
    if (state.savingOn) {
      for (const rec of created) {
        try { await STORE.put('resumes', rec); saved++; post({ type: 'saved', id: rec.id, updatedAt: rec.updatedAt }); } catch (e) { break; }
      }
    }
    const first = created[0];
    useResume(first, { stored: saved > 0 });
    if (!saved) state.lastSavedJSON = '';
    refreshStatus();
    const skipped = result.skipped ? ` ${result.skipped} could not be read and ${result.skipped === 1 ? 'was' : 'were'} skipped.` : '';
    const count = created.length === 1 ? 'Imported 1 resume' : `Imported ${created.length} resumes`;
    const where = state.savingOn ? '' : ' Saving is off, so it is not stored on this device.';
    notify(`${count} and opened “${first.name}”.${skipped}${where}`);
    if (state.dialogOpen) closeDialog(false);
    showContactDetails();
  }

  // After opening or importing, show the resume from its start (the Write step, contact details).
  function showContactDetails() {
    const tabEdit = $('tabEdit');
    const bar = tabEdit && tabEdit.closest('.rb-bar');
    if (bar && getComputedStyle(bar).display !== 'none') tabEdit.click();
    const tabContent = $('tabContent');
    if (tabContent) tabContent.click();
    const section = $('sec-personal');
    if (section) {
      section.classList.add('open');
      const header = section.querySelector('.accordion-header');
      if (header) header.setAttribute('aria-expanded', 'true');
      section.scrollIntoView({ block: 'start', behavior: 'auto' });
    }
    const name = $('fullName');
    if (name) name.focus({ preventScroll: true });
  }

  /* ------------------------------------------------------------------ Library actions */
  async function openById(id) {
    const rec = findRecord(id);
    if (!rec) return;
    if (state.current && state.current.id === id && state.stored) { closeDialog(true); return; }
    if (!(await leaveCurrent('Open the other resume'))) return;
    await loadList();
    const fresh = findRecord(id) || rec;
    useResume(fresh, { stored: true });
    notify(`Opened “${fresh.name}”.`);
    closeDialog(false);
    showContactDetails();
  }

  async function createNew(kind) {
    if (!(await leaveCurrent(kind === 'sample' ? 'Open the sample' : 'Start a new resume'))) return;
    const data = kind === 'sample' ? state.editor.sample() : state.editor.blank();
    const rec = newRecordFor(data, kind === 'sample' ? 'Sample resume' : LIB.DEFAULT_NAME);
    useResume(rec, { stored: false });
    if (state.savingOn) await flush(true);
    else state.lastSavedJSON = editorJSON();
    refreshStatus();
    notify(kind === 'sample' ? 'Opened a new resume filled with sample content. Replace it with your own details.' : 'Started a new, empty resume.');
    closeDialog(false);
    showContactDetails();
  }

  async function duplicate(index) {
    const rec = state.records[index];
    if (!rec || !state.savingOn) return;
    if (state.current && state.current.id === rec.id) await flush();
    const source = state.current && state.current.id === rec.id ? state.editor.getData() : rec.data;
    const copy = LIB.createRecord(source, { name: `Copy of ${rec.name}`.slice(0, LIB.MAX_NAME) });
    try { await STORE.put('resumes', copy); } catch (e) { notify('The copy could not be saved on this device.', true); return; }
    post({ type: 'saved', id: copy.id, updatedAt: copy.updatedAt });
    await loadList();
    renderList();
    notify(`Created “${copy.name}”.`);
    focusRow(copy.id, 'open');
  }

  async function remove(index, damaged) {
    const entry = damaged ? state.damaged[index] : state.records[index];
    if (!entry) return;
    const name = entry.name;
    const ok = await askConfirm({ title: `Delete “${name}”?`, message: 'It is removed from this browser and cannot be recovered. If you might need it later, export a backup first.', confirmLabel: 'Delete resume', danger: true });
    if (!ok) return;
    const id = damaged ? entry.raw.id : entry.id;
    try { await STORE.remove('resumes', id); } catch (e) { notify('The resume could not be deleted. Try again.', true); return; }
    post({ type: 'deleted', id: typeof id === 'string' ? id : '' });
    await loadList();
    notify(`Deleted “${name}”.`);
    if (!damaged && state.current && state.current.id === id) {
      const next = state.records[0];
      if (next) useResume(next, { stored: true });
      else useResume(newRecordFor(state.editor.blank(), LIB.DEFAULT_NAME), { stored: false, unsavedBaseline: true });
    }
    renderList();
    const rows = doc.querySelectorAll('#libList [data-act="open"], #libList [data-act="delete-damaged"]');
    const target = rows[Math.min(index, rows.length - 1)] || $('libNew');
    if (target) target.focus();
  }

  async function rename(index, value) {
    const rec = state.records[index];
    const name = LIB.cleanName(value);
    if (!rec) return;
    if (!name) { const input = doc.querySelector('#libList .rl-rename .input'); if (input) { input.setAttribute('aria-invalid', 'true'); input.focus(); } return; }
    state.renaming = -1;
    if (name !== rec.name) {
      try {
        const raw = await STORE.get('resumes', rec.id);
        if (raw) { raw.name = name; await STORE.put('resumes', raw); }
      } catch (e) { notify('The new name could not be saved.', true); }
      if (state.current && state.current.id === rec.id) { state.current.name = name; state.current.nameBase = name; }
      post({ type: 'renamed', id: rec.id, name });
      await loadList();
      notify(`Renamed to “${name}”.`);
    }
    renderList();
    refreshStatus();
    focusRow(rec.id, 'rename');
  }

  function exportRaw(index) {
    const entry = state.damaged[index];
    if (!entry) return;
    downloadJSON(LIB.fileName(entry.name, 'damaged_resume_raw.json'), { app: 'ApplyReady', kind: 'damaged-resume-record', exportedAt: new Date().toISOString(), reason: entry.reason, record: entry.raw });
    notify('The damaged entry was downloaded as it is stored. It cannot be imported as a resume, but its text can be copied from the file.');
  }

  async function exportAll() {
    await flush();
    await loadList();
    if (!state.records.length) { notify('There are no saved resumes to export yet.', true); return; }
    downloadJSON(LIB.fileName('ApplyReady', `resumes_backup_${new Date().toISOString().slice(0, 10)}.json`), LIB.libraryBackup(state.records));
    notify(`Backup of ${state.records.length} ${state.records.length === 1 ? 'resume' : 'resumes'} downloaded.`);
  }

  async function setSaving(on) {
    if (on === state.savingOn) return;
    state.savingOn = on;
    if (on) {
      try { await STORE.remove('meta', 'resumeSaving'); } catch (e) { /* ignore */ }
      notify('Saving on this device is on. Your resume saves as you type.');
      scheduleSave();
    } else {
      clearTimeout(state.timer);
      await setMeta('resumeSaving', 'off');
      notify('Saving on this device is off. Nothing new is stored in this browser.');
    }
    syncSwitches();
    refreshStatus();
    if (state.dialogOpen) renderList();
  }
  function syncSwitches() {
    doc.querySelectorAll('[data-save-switch]').forEach(input => { input.checked = state.savingOn; });
  }

  /* ------------------------------------------------------------------ "My resumes" dialog */
  function buildDialog() {
    let backdrop = $('libraryDialog');
    if (backdrop) return backdrop;
    backdrop = doc.createElement('div');
    backdrop.id = 'libraryDialog';
    backdrop.className = 'dialog-backdrop rl-backdrop';
    backdrop.hidden = true;
    backdrop.innerHTML = `
      <div class="dialog rl-dialog" role="dialog" aria-modal="true" aria-labelledby="libTitle" aria-describedby="libIntro">
        <div class="dialog__head">
          <h2 class="dialog__title" id="libTitle">My resumes</h2>
          <button type="button" class="btn btn-ghost btn-icon" data-act="close" aria-label="Close My resumes"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
        </div>
        <div class="dialog__body rl-body">
          <p class="rl-intro" id="libIntro">Resumes saved in this browser on this device. They are not uploaded anywhere.</p>
          <div class="rl-actions">
            <button type="button" class="btn btn-primary" id="libNew" data-act="new"><i class="fa-solid fa-plus" aria-hidden="true"></i> New resume</button>
            <button type="button" class="btn" data-act="sample"><i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i> New from sample</button>
            <button type="button" class="btn" data-act="import"><i class="fa-solid fa-file-import" aria-hidden="true"></i> Import backup</button>
            <button type="button" class="btn" data-act="export-all"><i class="fa-solid fa-file-export" aria-hidden="true"></i> Export all</button>
            <input type="file" id="libImportInput" accept=".json,application/json" class="hidden" tabindex="-1" aria-hidden="true">
          </div>
          <div id="libError"></div>
          <ul class="rl-list" id="libList" aria-label="Saved resumes"></ul>
          <div class="rl-storage">
            <label class="switch" for="libSaveSwitch"><span>Save resumes on this device</span><input type="checkbox" id="libSaveSwitch" role="switch" data-save-switch></label>
            <p class="field-hint">Turn this off on a shared or public computer. Resumes already saved stay until you delete them.</p>
            <p class="field-hint" id="libStorageNote">Browsers can clear saved site data, for example when you clear browsing data or the device runs low on space. A downloaded backup file is the safe copy.</p>
          </div>
        </div>
      </div>`;
    doc.body.appendChild(backdrop);
    backdrop.addEventListener('click', onDialogClick);
    backdrop.addEventListener('mousedown', e => { if (e.target === backdrop) closeDialog(true); });
    backdrop.addEventListener('keydown', onDialogKey);
    backdrop.addEventListener('submit', e => {
      const form = e.target.closest('.rl-rename');
      if (!form) return;
      e.preventDefault();
      rename(Number(form.dataset.index), form.querySelector('.input').value);
    });
    $('libImportInput').addEventListener('change', e => { const file = e.target.files && e.target.files[0]; e.target.value = ''; importFile(file); });
    $('libSaveSwitch').addEventListener('change', e => setSaving(e.target.checked));
    return backdrop;
  }

  function focusRow(id, act) {
    const index = state.records.findIndex(r => r.id === id);
    const row = doc.querySelector(`#libList [data-row="${index}"]`);
    const target = row && (row.querySelector(`[data-act="${act}"]`) || row.querySelector('button'));
    if (target) target.focus();
  }

  function renderList() {
    const list = $('libList');
    if (!list) return;
    // A redraw (for example after another tab saved) keeps keyboard focus on the same control.
    const active = doc.activeElement && list.contains(doc.activeElement) ? doc.activeElement : null;
    const keep = active && active.dataset.act ? { act: active.dataset.act, index: active.dataset.index } : null;
    const err = $('libError');
    if (err) err.innerHTML = state.importError ? `<p class="field-error" role="alert">${esc(state.importError)}</p>` : '';
    const now = Date.now();
    const cur = state.current;
    const rows = state.records.map((rec, i) => {
      const isCurrent = cur && cur.id === rec.id;
      const template = state.editor.templateName(rec.data.template);
      const when = `<time datetime="${new Date(rec.updatedAt || now).toISOString()}" title="${esc(LIB.absoluteTime(rec.updatedAt))}">Edited ${esc(LIB.relativeTime(rec.updatedAt, now))}</time>`;
      const nameHtml = state.renaming === i
        ? `<form class="rl-rename" data-index="${i}"><label class="sr-only" for="libRename${i}">New name for ${esc(rec.name)}</label><input type="text" class="input" id="libRename${i}" maxlength="${LIB.MAX_NAME}" value="${esc(rec.name)}" autocomplete="off"><button type="submit" class="btn btn-sm btn-primary">Save name</button><button type="button" class="btn btn-sm" data-act="rename-cancel" data-index="${i}">Cancel</button></form>`
        : `<span class="rl-row__name">${esc(rec.name)}</span>`;
      const writes = state.savingOn ? '' : ' disabled';
      return `<li class="rl-row${isCurrent ? ' is-current' : ''}" data-row="${i}">
        <span class="rl-row__icon" aria-hidden="true"><i class="fa-solid fa-file-lines"></i></span>
        <div class="rl-row__text">
          ${nameHtml}
          <span class="rl-row__meta">${when} · ${esc(template)}${isCurrent ? ' · <strong>Open now</strong>' : ''}</span>
        </div>
        <div class="rl-row__actions">
          <button type="button" class="btn btn-sm${isCurrent ? '' : ' btn-primary'}" data-act="open" data-index="${i}" aria-label="${isCurrent ? 'Continue editing' : 'Open'} ${esc(rec.name)}">${isCurrent ? 'Continue' : 'Open'}</button>
          <button type="button" class="btn btn-sm btn-ghost btn-icon" data-act="rename" data-index="${i}" aria-label="Rename ${esc(rec.name)}" title="Rename"${writes}><i class="fa-solid fa-pen" aria-hidden="true"></i></button>
          <button type="button" class="btn btn-sm btn-ghost btn-icon" data-act="duplicate" data-index="${i}" aria-label="Duplicate ${esc(rec.name)}" title="Duplicate"${writes}><i class="fa-regular fa-copy" aria-hidden="true"></i></button>
          <button type="button" class="btn btn-sm btn-ghost btn-icon" data-act="export" data-index="${i}" aria-label="Export a backup of ${esc(rec.name)}" title="Export backup"><i class="fa-solid fa-download" aria-hidden="true"></i></button>
          <button type="button" class="btn btn-sm btn-icon btn-danger-ghost" data-act="delete" data-index="${i}" aria-label="Delete ${esc(rec.name)}" title="Delete"><i class="fa-regular fa-trash-can" aria-hidden="true"></i></button>
        </div>
      </li>`;
    });
    // The open resume is listed even before its first save, so the list never hides what is on screen.
    if (cur && !state.stored && !state.records.some(r => r.id === cur.id)) {
      rows.unshift(`<li class="rl-row is-current">
        <span class="rl-row__icon" aria-hidden="true"><i class="fa-solid fa-file-lines"></i></span>
        <div class="rl-row__text"><span class="rl-row__name">${esc(cur.name === LIB.DEFAULT_NAME ? LIB.suggestName(state.editor.getData()) : cur.name)}</span>
          <span class="rl-row__meta">${state.savingOn ? 'Not saved yet: it saves once you type something' : 'Not saved: saving is off'} · <strong>Open now</strong></span></div>
        <div class="rl-row__actions"><button type="button" class="btn btn-sm" data-act="close">Continue</button></div>
      </li>`);
    }
    state.damaged.forEach((entry, i) => {
      rows.push(`<li class="rl-row is-damaged">
        <span class="rl-row__icon" aria-hidden="true"><i class="fa-solid fa-triangle-exclamation"></i></span>
        <div class="rl-row__text"><span class="rl-row__name">${esc(entry.name)}</span>
          <span class="rl-row__meta rl-row__error">Damaged: cannot be opened. ${esc(entry.reason)}</span></div>
        <div class="rl-row__actions">
          <button type="button" class="btn btn-sm" data-act="export-raw" data-index="${i}" aria-label="Export raw data of damaged entry ${esc(entry.name)}">Export raw</button>
          <button type="button" class="btn btn-sm btn-danger-ghost" data-act="delete-damaged" data-index="${i}" aria-label="Delete damaged entry ${esc(entry.name)}">Delete</button>
        </div>
      </li>`);
    });
    list.innerHTML = rows.join('') || '<li class="rl-empty">No resumes are saved in this browser yet.</li>';
    const exportAllBtn = doc.querySelector('#libraryDialog [data-act="export-all"]');
    if (exportAllBtn) exportAllBtn.disabled = !state.records.length;
    syncSwitches();
    const input = list.querySelector('.rl-rename .input');
    if (input) { input.focus(); input.select(); }
    else if (keep) {
      const again = list.querySelector(`[data-act="${keep.act}"]${keep.index !== undefined ? `[data-index="${keep.index}"]` : ''}`);
      if (again) again.focus();
    }
  }

  async function openDialog() {
    const backdrop = buildDialog();
    state.opener = doc.activeElement;
    state.importError = '';
    state.renaming = -1;
    await flush();
    await loadList();
    renderList();
    backdrop.hidden = false;
    state.dialogOpen = true;
    ['mainContent'].map($).concat([doc.querySelector('.site-header'), doc.querySelector('.site-footer')]).forEach(el => { if (el) el.inert = true; });
    doc.body.classList.add('rl-open');
    const first = backdrop.querySelector('#libList [data-act="open"]') || $('libNew');
    if (first) first.focus();
  }

  function closeDialog(restoreFocus) {
    const backdrop = $('libraryDialog');
    if (!backdrop || backdrop.hidden) return;
    backdrop.hidden = true;
    state.dialogOpen = false;
    state.renaming = -1;
    ['mainContent'].map($).concat([doc.querySelector('.site-header'), doc.querySelector('.site-footer')]).forEach(el => { if (el) el.inert = false; });
    doc.body.classList.remove('rl-open');
    if (restoreFocus !== false) {
      const target = state.opener && doc.contains(state.opener) ? state.opener : $('btnLibrary');
      if (target && typeof target.focus === 'function') target.focus();
    }
  }

  function onDialogClick(e) {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const i = Number(btn.dataset.index);
    switch (btn.dataset.act) {
      case 'close': closeDialog(true); break;
      case 'new': createNew('blank'); break;
      case 'sample': createNew('sample'); break;
      case 'import': $('libImportInput').click(); break;
      case 'export-all': exportAll(); break;
      case 'open': if (state.records[i]) openById(state.records[i].id); break;
      case 'rename': state.renaming = i; renderList(); break;
      case 'rename-cancel': state.renaming = -1; renderList(); if (state.records[i]) focusRow(state.records[i].id, 'rename'); break;
      case 'duplicate': duplicate(i); break;
      case 'export': if (state.records[i]) exportOneFromList(i); break;
      case 'delete': remove(i, false); break;
      case 'export-raw': exportRaw(i); break;
      case 'delete-damaged': remove(i, true); break;
      default: break;
    }
  }
  async function exportOneFromList(i) {
    const rec = state.records[i];
    if (state.current && state.current.id === rec.id) { await exportCurrent(); return; }
    exportOne(rec);
  }

  function onDialogKey(e) {
    if (e.key === 'Escape') {
      if (e.target.closest && e.target.closest('.rl-rename')) {
        e.stopPropagation();
        const index = state.renaming;
        state.renaming = -1;
        renderList();
        if (state.records[index]) focusRow(state.records[index].id, 'rename');
        return;
      }
      e.preventDefault();
      closeDialog(true);
      return;
    }
    if (e.key !== 'Tab') return;
    const dialog = $('libraryDialog').querySelector('.rl-dialog');
    const items = Array.from(dialog.querySelectorAll('button:not(:disabled), input:not([type="file"]):not(:disabled), [href]')).filter(el => el.offsetParent !== null);
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && doc.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && doc.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  /* ------------------------------------------------------------------ Start */
  function wire() {
    const libraryButton = $('btnLibrary');
    if (libraryButton) libraryButton.addEventListener('click', openDialog);
    const exportButton = $('btnExportJSON');
    if (exportButton) exportButton.addEventListener('click', exportCurrent);
    const importButton = $('btnImportJSON');
    const importInput = $('fileImportInput');
    if (importButton && importInput) {
      importButton.addEventListener('click', () => importInput.click());
      importInput.addEventListener('change', e => { const file = e.target.files && e.target.files[0]; e.target.value = ''; importFile(file); });
    }
    const openLibrary = $('btnOpenLibrary');
    if (openLibrary) openLibrary.addEventListener('click', openDialog);
    doc.querySelectorAll('[data-save-switch]').forEach(input => input.addEventListener('change', () => setSaving(input.checked)));
    const notice = $('saveNotice');
    if (notice) notice.addEventListener('click', e => {
      const btn = e.target.closest('button[data-notice]');
      if (!btn) return;
      const act = btn.dataset.notice;
      if (act === 'backup') exportCurrent();
      else if (act === 'saving-on') setSaving(true);
      else if (act === 'retry') { state.phase = 'saved'; flush(true); }
      else if (act === 'dismiss') { state.notFound = ''; refreshStatus(); }
      else resolveConflict(act);
    });
    // Save about 600 ms after typing stops, and at once when the page is hidden or closed.
    const panel = $('formPanel');
    if (panel) panel.addEventListener('input', e => { if (e.target.id !== 'jobDescriptionInput') scheduleSave(); });
    state.editor.onChange(() => { if (state.loaded) scheduleSave(); });
    doc.addEventListener('visibilitychange', () => { if (doc.visibilityState === 'hidden') flush(); });
    window.addEventListener('pagehide', () => { flush(); });
    window.addEventListener('beforeunload', e => {
      if (!state.loaded || state.editor.isEmpty()) return;
      // Without lasting storage everything on screen is lost on close, saved in memory or not.
      if (state.persistent && !hasUnsaved()) return;
      if (state.savingOn && state.persistent && !state.conflict && state.phase !== 'error') { flush(); return; }
      e.preventDefault();
      e.returnValue = '';
    });
    setInterval(() => { if (state.phase === 'saved') renderStatus(); }, 30000);
    try {
      if (typeof BroadcastChannel === 'function') {
        state.channel = new BroadcastChannel(CHANNEL);
        state.channel.onmessage = e => { onRemote(e.data); };
      }
    } catch (e) { state.channel = null; }
  }

  async function start() {
    state.editor = window.ApplyReadyResumeEditor;
    if (!state.editor) return;
    const layout = $('resumeAppLayout');
    if (!LIB || !STORE || !SCHEMA) {
      state.loaded = true;
      state.persistent = false;
      state.current = { id: 'unsaved', name: 'Untitled resume', nameBase: 'Untitled resume', createdAt: Date.now(), updatedAt: 0 };
      refreshStatus();
      return;
    }
    wire();
    renderStatus();
    let status = { persistent: false };
    try { status = await STORE.status(); } catch (e) { /* treated as memory only */ }
    state.persistent = !!status.persistent;
    state.savingOn = (await getMeta('resumeSaving')) !== 'off';
    syncSwitches();
    if (state.persistent && state.savingOn) await migrateLegacyDraft();
    await loadList();

    const params = new URLSearchParams(location.search);
    const wanted = params.get('id');
    let target = null;
    let linkProblem = '';
    if (wanted) {
      target = LIB.ID_PATTERN.test(wanted) ? findRecord(wanted) : null;
      if (!target) {
        const damaged = state.damaged.some(d => d.raw && d.raw.id === wanted);
        linkProblem = damaged
          ? 'The resume in this link is damaged and cannot be opened. Open My resumes to export its raw data or delete it.'
          : 'The resume in this link is not saved in this browser. Saved resumes stay in the browser and on the device where they were made.';
      }
    }
    // On a shared computer (saving off) the last person's resume is not opened automatically.
    if (!target && state.savingOn && !wanted) {
      const last = await getMeta('lastResumeId');
      target = (typeof last === 'string' && findRecord(last)) || state.records[0] || null;
    }
    if (state.editor.hasUserChanges()) {
      // Typing began before the saved resumes were read: keep it, as a new resume.
      const rec = newRecordFor(state.editor.getData(), LIB.DEFAULT_NAME);
      state.current = { id: rec.id, name: rec.name, nameBase: rec.name, createdAt: rec.createdAt, updatedAt: rec.updatedAt };
      state.stored = false;
      state.lastSavedJSON = '';
    } else if (target) {
      useResume(target, { stored: true });
    } else {
      useResume(newRecordFor(state.editor.blank(), LIB.DEFAULT_NAME), { stored: false, unsavedBaseline: true });
    }
    state.notFound = linkProblem;
    state.loaded = true;
    if (layout) layout.removeAttribute('aria-busy');
    scheduleSave();
    refreshStatus();
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start);
  else start();
})();
