/* Applicant workspaces (workspace.html): the interface.

   An operator at a cyber cafe or placement office prepares documents for one person after another.
   Each applicant is an isolated object from js/lib/applicants.js holding their files, results, jobs
   and object URLs. This script only draws the active applicant from that object and wires the
   buttons to the shared engines:
     - pictures: ApplyReadyImagePool (Web Workers) running ApplyReadyImageOps with the session presets
     - PDFs: ApplyReadyPdf (merge, images as pages, compress by redrawing pages), ApplyReadyPdfUI for
       password-protected files
     - downloads: object URLs owned by the applicant, and ApplyReadyFileKit.downloadZip for the ZIP

   Privacy rules this file keeps:
     - Memory only. Nothing about applicants, files, names or results is written to any storage.
     - The panel is rebuilt from the active applicant whenever it changes; rows are never reused
       across applicants. A job delivers its result to the applicant that started it, never to
       whoever is on screen, and finishing an applicant cancels its jobs and revokes its URLs.
     - Toasts and announcements never carry names, so nothing of a finished applicant lingers in
       the page's live regions. */
(function () {
  'use strict';
  const doc = document;
  const app = doc.getElementById('workspaceApp');
  if (!app) return;
  const Files = window.ApplyReadyFiles;
  const Kit = window.ApplyReadyFileKit;
  const Ops = window.ApplyReadyImageOps;
  const Pdf = window.ApplyReadyPdf;
  const PdfUI = window.ApplyReadyPdfUI;
  const Model = window.ApplyReadyApplicants;
  const UI = () => window.ApplyReadyUI || {};
  const $ = id => doc.getElementById(id);

  const el = {
    settings: $('wkSettings'), summary: $('wkSettingsSummary'), reset: $('wkSettingsReset'),
    start: $('wkStart'), startBtn: $('wkStartBtn'),
    session: $('wkSession'), tabs: $('wkTabs'), switcher: $('wkSwitch'), newBtn: $('wkNew'), endBtn: $('wkEnd'),
    none: $('wkNone'), noneTitle: $('wkNoneTitle'), noneNew: $('wkNoneNew'),
    panel: $('wkPanel'), name: $('wkName'), nameHint: $('wkNameHint'), tally: $('wkTally'), finish: $('wkFinish'),
    errors: $('wkErrors'), errorList: $('wkErrorList'), errorClose: $('wkErrorClose'),
    fileCount: $('wkFileCount'), drop: $('wkDrop'), dropBrowse: $('wkDrop').querySelector('[data-browse]'),
    selBar: $('wkSelBar'), selText: $('wkSelText'), combine: $('wkCombine'), combineLabel: $('wkCombineLabel'), selNone: $('wkSelNone'),
    files: $('wkFiles'),
    jobsBox: $('wkJobsBox'), jobs: $('wkJobs'),
    resultsEmpty: $('wkResultsEmpty'), outBar: $('wkOutBar'), doneLine: $('wkDoneLine'), zip: $('wkZip'), zipLabel: $('wkZipLabel'),
    results: $('wkResults')
  };

  if (!Files || !Kit || !Ops || !Model) {
    el.startBtn.disabled = true;
    const p = doc.createElement('p');
    p.className = 'field-error';
    p.textContent = 'A part of this tool did not load. Reload the page and try again.';
    el.start.appendChild(p);
    return;
  }

  const plural = (n, one, many) => `${n} ${n === 1 ? one : (many || one + 's')}`;
  const kb = bytes => `${(bytes / 1024).toFixed(1)} KB`;
  const FORMAT = { 'image/jpeg': 'JPEG', 'image/png': 'PNG', 'image/webp': 'WebP' };
  const STATUS = { new: 'No files yet', working: 'In progress', ready: 'Ready', downloaded: 'Downloaded' };
  const stemOf = name => Files.stem(Files.safeFileName(name || 'file', 'file')) || 'file';
  const announce = message => Kit.announce(message);
  const notify = (message, error) => { if (UI().notify) UI().notify(message, error); };

  /* ------------------------------------------------------------------ settings */
  // Session settings live in this tab only. Defaults suit the most common Indian application forms.
  const FIELDS = {
    photoW: { id: 'wkPhotoW', min: 16, max: 12000, def: 350, what: 'photo width', unit: 'px' },
    photoH: { id: 'wkPhotoH', min: 16, max: 12000, def: 450, what: 'photo height', unit: 'px' },
    photoKB: { id: 'wkPhotoKB', min: 5, max: 20000, def: 50, what: 'photo size limit', unit: 'KB' },
    sigW: { id: 'wkSigW', min: 16, max: 12000, def: 300, what: 'signature width', unit: 'px' },
    sigH: { id: 'wkSigH', min: 16, max: 12000, def: 100, what: 'signature height', unit: 'px' },
    sigKB: { id: 'wkSigKB', min: 5, max: 20000, def: 30, what: 'signature size limit', unit: 'KB' },
    imgKB: { id: 'wkImgKB', min: 5, max: 20000, def: 100, what: 'image size limit', unit: 'KB' },
    pdfKB: { id: 'wkPdfKB', min: 20, max: 100000, def: 500, what: 'PDF size limit', unit: 'KB' }
  };
  const NEEDS = { photo: ['photoW', 'photoH', 'photoKB'], signature: ['sigW', 'sigH', 'sigKB'], compress: ['imgKB'], jpeg: [], pdf: ['pdfKB'], zip: [] };
  const fmtSel = { photo: $('wkPhotoFormat'), signature: $('wkSigFormat') };
  const zipInput = $('wkZipName');
  const zipError = $('wkZipNameError');
  const ZIP_DEFAULT = '{applicant}-{date}';

  function fieldError(key) {
    const f = FIELDS[key];
    const input = $(f.id);
    const raw = String(input.value).trim();
    const v = Number(raw);
    if (raw === '' || !Number.isFinite(v) || Math.round(v) !== v) return `Enter the ${f.what} as a whole number.`;
    if (v < f.min || v > f.max) return `The ${f.what} must be from ${f.min.toLocaleString('en-IN')} to ${f.max.toLocaleString('en-IN')} ${f.unit}.`;
    return '';
  }

  function showFieldError(key) {
    const f = FIELDS[key];
    const input = $(f.id), out = $(f.id + 'Error');
    const msg = fieldError(key);
    out.textContent = msg;
    out.hidden = !msg;
    if (msg) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid');
    return msg;
  }

  function zipPatternError() {
    const v = zipInput.value.trim();
    if (!v) return 'Enter a name pattern for the ZIP file, for example {applicant}-{date}.';
    if (/[\\/:*?"<>|]/.test(v.replace(/\{[a-z]+\}/gi, ''))) return 'Leave out these characters, which file names cannot contain: \\ / : * ? " < > |';
    return '';
  }

  function showZipError() {
    const msg = zipPatternError();
    zipError.textContent = msg;
    zipError.hidden = !msg;
    if (msg) zipInput.setAttribute('aria-invalid', 'true'); else zipInput.removeAttribute('aria-invalid');
    return msg;
  }

  const value = key => Number($(FIELDS[key].id).value);
  function settings() {
    return {
      photo: { width: value('photoW'), height: value('photoH'), kb: value('photoKB'), format: fmtSel.photo.value },
      signature: { width: value('sigW'), height: value('sigH'), kb: value('sigKB'), format: fmtSel.signature.value },
      imgKB: value('imgKB'), pdfKB: value('pdfKB'),
      zip: zipPatternError() ? ZIP_DEFAULT : zipInput.value.trim()
    };
  }

  function renderSummary() {
    const bad = Object.keys(FIELDS).some(k => fieldError(k)) || zipPatternError();
    if (bad) { el.summary.textContent = 'A setting needs fixing'; el.summary.classList.add('is-invalid'); return; }
    el.summary.classList.remove('is-invalid');
    const s = settings();
    el.summary.textContent = `Photo ${s.photo.width} × ${s.photo.height} px, ${s.photo.kb} KB · Signature ${s.signature.width} × ${s.signature.height} px, ${s.signature.kb} KB · PDF ${s.pdfKB} KB`;
  }

  /** The settings an action needs, or null after pointing at the field to fix. */
  function needSettings(action) {
    const keys = NEEDS[action] || [];
    const bad = keys.filter(k => showFieldError(k));
    if (!bad.length) return settings();
    el.settings.open = true;
    const first = $(FIELDS[bad[0]].id);
    first.focus();
    notify(`Fix the ${FIELDS[bad[0]].what} in Session settings first.`, true);
    return null;
  }

  Object.keys(FIELDS).forEach(key => {
    $(FIELDS[key].id).addEventListener('input', () => { showFieldError(key); renderSummary(); schedule(); });
  });
  Object.values(fmtSel).forEach(s => s.addEventListener('change', () => { renderSummary(); schedule(); }));
  zipInput.addEventListener('input', () => { showZipError(); renderSummary(); });

  function resetSettings() {
    Object.keys(FIELDS).forEach(key => { $(FIELDS[key].id).value = String(FIELDS[key].def); showFieldError(key); });
    fmtSel.photo.value = 'image/jpeg';
    fmtSel.signature.value = 'image/jpeg';
    zipInput.value = ZIP_DEFAULT;
    showZipError();
    renderSummary();
    schedule();
  }
  el.reset.addEventListener('click', () => { resetSettings(); announce('Session settings are back to their defaults.'); });

  /* ------------------------------------------------------------------ session */
  const session = Model.createSession();
  let inSession = false;   // true from the first applicant until End session
  let pool = null;
  const getPool = () => pool || (pool = window.ApplyReadyImagePool.create({ size: 2 }));
  let renderedFor = null;  // the applicant whose rows are on screen

  // A small serial queue for reading new files (thumbnails, page counts), so fifty large photos
  // added at once do not all decode at the same time.
  let intake = Promise.resolve();
  const queue = task => { intake = intake.then(task, task).catch(() => {}); return intake; };

  /* ------------------------------------------------------------------ rendering */
  let pending = false;
  function schedule() {
    if (pending) return;
    pending = true;
    queueMicrotask(() => { pending = false; render(); });
  }

  session.on((type, detail) => {
    if (type === 'progress') { if (detail.applicant === session.active) updateJob(detail.job); return; }
    schedule();
  });

  function render() {
    const started = inSession || session.size > 0;
    app.dataset.view = started ? 'session' : 'start';
    el.start.hidden = started;
    el.session.hidden = !started;
    renderNav();
    renderPanel();
  }

  function statusText(a) {
    const c = a.counts();
    return `${plural(c.files, 'file')} · ${STATUS[a.status]}`;
  }

  function renderNav() {
    const active = session.active;
    const hadFocus = el.tabs.contains(doc.activeElement);
    el.tabs.textContent = '';
    const options = [];
    session.applicants.forEach(a => {
      const b = doc.createElement('button');
      b.type = 'button';
      b.className = 'wk-tab';
      b.id = `wkTab-${a.id}`;
      b.dataset.id = a.id;
      b.dataset.status = a.status;
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-controls', 'wkPanel');
      b.setAttribute('aria-selected', String(a === active));
      b.tabIndex = a === active ? 0 : -1;
      const name = doc.createElement('span');
      name.className = 'wk-tab__name';
      name.textContent = a.label;
      const meta = doc.createElement('span');
      meta.className = 'wk-tab__meta';
      meta.textContent = statusText(a);
      b.append(name, meta);
      el.tabs.appendChild(b);
      const o = doc.createElement('option');
      o.value = a.id;
      o.textContent = `${a.label} (${statusText(a)})`;
      options.push(o);
    });
    el.tabs.hidden = !session.size;
    el.switcher.replaceChildren(...options);
    if (active) el.switcher.value = active.id;
    el.switcher.closest('.wk-switch').hidden = !session.size;
    if (hadFocus && active) { const t = $(`wkTab-${active.id}`); if (t) t.focus({ preventScroll: true }); }
  }

  function clearPanel() {
    [el.files, el.results, el.jobs, el.errorList].forEach(list => { list.textContent = ''; });
    el.errors.hidden = true;
    el.name.value = '';
    el.nameHint.textContent = '';
    el.tally.textContent = '';
    el.doneLine.textContent = '';
    el.zipLabel.textContent = 'Download all (ZIP)';
    el.selText.textContent = '';
    el.panel.removeAttribute('aria-labelledby');
    el.panel.setAttribute('aria-label', 'Applicant');
  }

  function renderPanel() {
    const a = session.active;
    el.panel.hidden = !a;
    el.none.hidden = !!a || !inSession;
    if (!a) { renderedFor = null; clearPanel(); return; }
    if (renderedFor !== a.id) {
      // Another applicant: nothing on screen may carry over, so start from an empty panel.
      clearPanel();
      renderedFor = a.id;
    }
    const s = settings();
    const c = a.counts();
    el.panel.setAttribute('aria-labelledby', `wkTab-${a.id}`);
    el.panel.removeAttribute('aria-label');
    if (doc.activeElement !== el.name) el.name.value = a.name;
    el.nameHint.textContent = `Shown in the list and in the ZIP name. Leave it empty to keep “Applicant ${a.number}”.`;

    // Completion
    let tally;
    if (!c.results) tally = c.running ? `${plural(c.running, 'task')} running, no results yet` : 'No results yet';
    else if (!c.waiting) tally = c.results === 1 ? '1 of 1 result downloaded' : `All ${c.results} results downloaded`;
    else tally = `${c.downloaded} of ${plural(c.results, 'result')} downloaded`;
    if (c.results && c.running) tally += ` · ${plural(c.running, 'task')} running`;
    el.tally.textContent = tally;
    el.tally.dataset.done = String(c.results > 0 && !c.waiting && !c.running);
    const allDone = c.results > 0 && !c.waiting && !c.running;
    el.finish.classList.toggle('btn-primary', allDone);

    // Problems
    el.errorList.textContent = '';
    a.errors.forEach(err => { const li = doc.createElement('li'); li.textContent = err.text; el.errorList.appendChild(li); });
    el.errors.hidden = !a.errors.length;

    // Files
    el.fileCount.textContent = String(c.files);
    const compact = c.files > 0;
    el.drop.classList.toggle('dropzone--compact', compact);
    el.dropBrowse.classList.toggle('btn-primary', !compact);
    el.dropBrowse.classList.toggle('btn-lg', !compact);
    syncList(el.files, a.files, f => f.id, f => fileSig(a, f, s), f => fileRow(a, f, s));
    renderSelection(a);

    // Jobs
    el.jobsBox.hidden = !a.jobs.length;
    syncList(el.jobs, a.jobs, j => j.id, j => j.label, j => jobRow(j));
    a.jobs.forEach(updateJob);

    // Results
    el.resultsEmpty.hidden = c.results > 0;
    el.outBar.hidden = !c.results;
    el.doneLine.textContent = c.results ? `${c.downloaded} of ${plural(c.results, 'result')} downloaded` : '';
    el.zipLabel.textContent = a.zipping ? 'Preparing ZIP…' : `Download all for ${a.label} (ZIP)`;
    el.zip.disabled = !!a.zipping || !c.results;
    el.zip.classList.toggle('btn-primary', c.waiting > 0);
    syncList(el.results, a.results, r => r.id, r => resultSig(a, r, s), r => resultRow(a, r, s));
  }

  /**
   * Keep a list in step with the model: rows whose content did not change stay in place (so a
   * click or focus is not lost), changed rows are rebuilt. Focus moves to the same control in a
   * rebuilt row, found by its data-key.
   */
  function syncList(list, items, keyOf, sigOf, build) {
    const existing = new Map(Array.from(list.children).map(li => [li.dataset.id, li]));
    const active = doc.activeElement;
    const focusKey = active && list.contains(active) && active.dataset ? active.dataset.key : null;
    let prev = null;
    items.forEach(item => {
      const id = keyOf(item);
      const sig = sigOf(item);
      let li = existing.get(id);
      if (li && li.dataset.sig === sig) existing.delete(id);
      else {
        if (li) { li.remove(); existing.delete(id); }
        li = build(item);
        li.dataset.id = id;
        li.dataset.sig = sig;
      }
      const ref = prev ? prev.nextSibling : list.firstChild;
      if (li !== ref) list.insertBefore(li, ref);
      prev = li;
    });
    existing.forEach(li => li.remove());
    list.hidden = !items.length;
    if (focusKey && !list.contains(doc.activeElement)) {
      const target = list.querySelector(`[data-key="${CSS.escape(focusKey)}"]`);
      if (target && !target.disabled) target.focus({ preventScroll: true });
    }
  }

  const node = (tag, cls, text) => { const n = doc.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const icon = name => { const i = doc.createElement('i'); i.className = `fa-solid fa-${name}`; i.setAttribute('aria-hidden', 'true'); return i; };
  function button(label, opts) {
    const o = opts || {};
    const b = doc.createElement('button');
    b.type = 'button';
    b.className = o.cls || 'btn btn-sm';
    if (o.act) b.dataset.act = o.act;
    if (o.key) b.dataset.key = o.key;
    if (o.icon) b.appendChild(icon(o.icon));
    if (o.iconOnly) { b.setAttribute('aria-label', label); b.title = label; }
    else b.append(o.icon ? ` ${label}` : label);
    if (o.disabled) b.disabled = true;
    return b;
  }

  /* ------------------------------------------------------------------ file rows */
  const ACTION_LABEL = {
    photo: () => 'Passport photo',
    signature: () => 'Signature',
    compress: s => `Compress to ${s.imgKB} KB`,
    jpeg: () => 'Convert to JPEG',
    pdf: s => `Compress PDF to ${s.pdfKB} KB`
  };
  const ACTION_ICON = { photo: 'id-badge', signature: 'signature', compress: 'compress', jpeg: 'arrows-rotate', pdf: 'file-zipper' };
  const ACTION_VERB = { photo: 'Making the passport photo', signature: 'Making the signature', compress: 'Compressing', jpeg: 'Converting to JPEG', pdf: 'Compressing the PDF' };

  function fileFacts(f) {
    const parts = [f.kind === 'pdf' ? 'PDF' : (f.info && f.info.label ? f.info.label.replace(/ image$/, '') : 'Image'), Files.formatBytes(f.size)];
    if (f.kind === 'image' && f.width) parts.push(`${f.width} × ${f.height} px`);
    if (f.kind === 'pdf') {
      if (f.checking) parts.push('counting pages…');
      else if (f.pages) parts.push(plural(f.pages, 'page'));
      if (f.encrypted) parts.push('password protected');
    }
    return parts.join(' · ');
  }

  function fileSig(a, f, s) {
    const i = a.files.indexOf(f);
    return JSON.stringify([f.name, f.size, f.width, f.height, f.pages, f.encrypted, f.checking, f.thumb, f.selected, f.error, f.actionError || '', a.busyFile(f.id), i === 0, i === a.files.length - 1, s.imgKB, s.pdfKB]);
  }

  function fileRow(a, f, s) {
    const busy = a.busyFile(f.id);
    const li = node('li', 'file-row wk-file');
    li.dataset.status = f.error ? 'error' : busy ? 'processing' : 'queued';
    const usable = !f.error && !f.checking;

    const sel = node('label', 'check wk-file__select');
    const box = doc.createElement('input');
    box.type = 'checkbox';
    box.dataset.act = 'select';
    box.dataset.key = `sel:${f.id}`;
    box.checked = !!f.selected;
    box.disabled = !usable;
    box.setAttribute('aria-label', `Select ${f.name}`);
    sel.appendChild(box);

    const thumb = node('span', 'file-row__thumb');
    if (f.thumb) { const img = doc.createElement('img'); img.src = f.thumb; img.alt = ''; img.decoding = 'async'; thumb.appendChild(img); }
    else thumb.appendChild(icon(f.kind === 'pdf' ? 'file-pdf' : 'image'));

    const text = node('div', 'file-row__text');
    const name = node('span', 'file-row__name', f.name);
    name.title = f.name;
    text.append(name, node('span', 'file-row__meta', fileFacts(f)));
    if (f.error) text.appendChild(node('span', 'file-row__error', f.error));
    else if (f.actionError) text.appendChild(node('span', 'file-row__error', f.actionError));
    if (busy) { const st = node('span', 'file-status'); st.append(icon('clock'), ' Working…'); text.appendChild(st); }

    const tools = node('div', 'file-row__actions');
    const i = a.files.indexOf(f);
    tools.append(
      button(`Move ${f.name} up`, { cls: 'btn btn-ghost btn-icon btn-sm', act: 'up', key: `up:${f.id}`, icon: 'arrow-up', iconOnly: true, disabled: i === 0 }),
      button(`Move ${f.name} down`, { cls: 'btn btn-ghost btn-icon btn-sm', act: 'down', key: `down:${f.id}`, icon: 'arrow-down', iconOnly: true, disabled: i === a.files.length - 1 }),
      button(`Remove ${f.name}`, { cls: 'btn btn-danger-ghost btn-icon btn-sm', act: 'remove', key: `rm:${f.id}`, icon: 'trash-can', iconOnly: true, disabled: busy })
    );

    li.append(sel, thumb, text, tools);
    if (usable) {
      const actions = node('div', 'wk-file__actions');
      actions.setAttribute('role', 'group');
      actions.setAttribute('aria-label', `Actions for ${f.name}`);
      const kinds = f.kind === 'pdf' ? ['pdf'] : ['photo', 'signature', 'compress', 'jpeg'];
      kinds.forEach(k => actions.appendChild(button(ACTION_LABEL[k](s), { act: `run:${k}`, key: `run:${k}:${f.id}`, icon: ACTION_ICON[k], disabled: busy })));
      li.appendChild(actions);
    }
    return li;
  }

  function renderSelection(a) {
    const picked = a.selected;
    el.selBar.hidden = !picked.length;
    if (!picked.length) return;
    const images = picked.filter(f => f.kind === 'image').length;
    const pdfs = picked.length - images;
    el.selText.textContent = `${picked.length} selected${images && pdfs ? ` (${plural(images, 'picture')}, ${plural(pdfs, 'PDF')})` : ''}`;
    if (images) {
      el.combineLabel.textContent = picked.length === 1 ? 'Make a PDF' : 'Combine into one PDF';
      el.combine.disabled = picked.some(f => a.busyFile(f.id));
    } else {
      el.combineLabel.textContent = 'Merge PDFs';
      el.combine.disabled = picked.length < 2 || picked.some(f => a.busyFile(f.id));
      if (picked.length < 2) el.selText.textContent += '. Select another PDF to merge with it.';
    }
  }

  /* ------------------------------------------------------------------ job rows */
  function jobRow(job) {
    const li = node('li', 'wk-job');
    li.dataset.job = job.id;
    const head = node('div', 'wk-job__head');
    const text = node('p', 'wk-job__text', job.text);
    text.id = `wkJobText-${job.id}`;
    head.append(text, button('Cancel', { cls: 'btn btn-sm', act: 'cancel', key: `cancel:${job.id}`, icon: 'ban' }));
    const bar = node('div', 'progress');
    bar.setAttribute('role', 'progressbar');
    bar.setAttribute('aria-labelledby', text.id);
    bar.setAttribute('aria-valuemin', '0');
    bar.setAttribute('aria-valuemax', '100');
    bar.setAttribute('aria-valuenow', '0');
    bar.appendChild(node('span', 'progress-bar'));
    li.append(head, bar);
    return li;
  }

  function updateJob(job) {
    const li = el.jobs.querySelector(`[data-job="${job.id}"]`);
    if (!li) return;
    const pct = Math.round(job.progress * 100);
    li.querySelector('.wk-job__text').textContent = job.text;
    li.querySelector('.progress').setAttribute('aria-valuenow', String(pct));
    li.querySelector('.progress-bar').style.width = `${pct}%`;
  }

  /* ------------------------------------------------------------------ result rows */
  function resultFacts(r) {
    const f = r.facts;
    if (r.kind === 'pdf') return [plural(f.pages || 0, 'page'), kb(f.bytes), f.limit ? (f.bytes <= f.limit ? `under ${f.limit / 1024} KB` : `over ${f.limit / 1024} KB`) : ''].filter(Boolean).join(' · ');
    return [`${f.width} × ${f.height} px`, kb(f.bytes), FORMAT[f.mime] || f.mime, f.limit ? `under ${f.limit / 1024} KB` : ''].filter(Boolean).join(' · ');
  }

  function resultSig(a, r, s) {
    return JSON.stringify([r.name, r.url, r.downloaded, r.warning, a.jobs.some(j => j.resultId === r.id), s.pdfKB]);
  }

  function resultRow(a, r, s) {
    const li = node('li', 'file-row wk-result');
    li.dataset.status = r.warning ? 'cancelled' : 'done';
    const thumb = node('span', 'file-row__thumb');
    if (r.kind === 'image') { const img = doc.createElement('img'); img.src = r.url; img.alt = ''; img.decoding = 'async'; thumb.appendChild(img); }
    else thumb.appendChild(icon('file-pdf'));
    const text = node('div', 'file-row__text');
    const name = node('span', 'file-row__name', r.name);
    name.title = r.name;
    text.append(name, node('span', 'file-row__result', resultFacts(r)));
    if (r.warning) text.appendChild(node('span', 'file-row__error', r.warning));
    r.notes.forEach(n => text.appendChild(node('span', 'file-row__notes', n)));
    const st = node('span', 'file-status wk-result__status');
    st.dataset.downloaded = String(r.downloaded);
    st.append(icon(r.downloaded ? 'check' : 'download'), r.downloaded ? ' Downloaded' : ' Not downloaded');
    text.appendChild(st);

    const tools = node('div', 'file-row__actions wk-result__actions');
    const dl = doc.createElement('a');
    dl.className = 'btn btn-sm';
    dl.href = r.url;
    dl.download = Files.safeFileName(r.name, 'result');
    dl.dataset.act = 'download';
    dl.dataset.key = `dl:${r.id}`;
    dl.append(icon('download'), ' Download');
    dl.setAttribute('aria-label', `Download ${r.name}`);
    const compressing = a.jobs.some(j => j.resultId === r.id);
    if (r.kind === 'pdf' && r.facts.limit && r.facts.bytes > s.pdfKB * 1024 && r.action === 'merge') {
      tools.appendChild(button(`Compress to ${s.pdfKB} KB`, { act: 'compress-result', key: `cr:${r.id}`, icon: 'file-zipper', disabled: compressing }));
    }
    tools.append(dl, button(`Remove ${r.name}`, { cls: 'btn btn-danger-ghost btn-icon btn-sm', act: 'remove-result', key: `rr:${r.id}`, icon: 'trash-can', iconOnly: true, disabled: compressing }));
    li.append(thumb, text, tools);
    return li;
  }

  /* ------------------------------------------------------------------ adding files */
  function addFiles(a, files, infos) {
    if (!a || a.finished) return;
    const room = Model.MAX_FILES - a.files.length;
    if (files.length > room) {
      a.addError(room > 0
        ? `Only ${plural(room, 'more file')} could be added: an applicant can have up to ${Model.MAX_FILES} files. The rest were left out.`
        : `This applicant already has ${Model.MAX_FILES} files, the most one applicant can have. Remove some first.`);
    }
    const added = [];
    files.slice(0, Math.max(0, room)).forEach((file, i) => {
      const entry = a.addFile(file, infos[i]);
      if (entry) { added.push(entry); queue(() => readFile(a, entry)); }
    });
    if (added.length && a === session.active) announce(`${plural(added.length, 'file')} added.`);
  }

  const alive = (a, f) => !a.finished && a.files.includes(f);

  async function readFile(a, f) {
    if (!alive(a, f)) return;
    if (f.kind === 'image') {
      try {
        const head = Ops.readHeader(new Uint8Array(await f.file.slice(0, 512 * 1024).arrayBuffer()));
        if (head && alive(a, f)) { f.width = head.width; f.height = head.height; }
      } catch (e) { /* the size shows once processed */ }
      if (!alive(a, f)) return;
      const url = await Kit.thumbnail(f.file, 96);
      if (!url) { schedule(); return; }
      if (!alive(a, f)) { URL.revokeObjectURL(url); return; }
      f.thumb = a.adoptURL(url);
      schedule();
      return;
    }
    try {
      const bytes = await Pdf.readBytes(f.file);
      if (!alive(a, f)) return;
      const facts = await Pdf.inspect(bytes, f.name);
      if (!alive(a, f)) return;
      f.pages = facts.pageCount;
      f.encrypted = facts.encrypted;
    } catch (e) {
      if (!alive(a, f)) return;
      f.error = e && e.name === 'PdfError' ? e.message : `${f.name} could not be read as a PDF. Open it on your device to check it, then add it again.`;
      f.selected = false;
    }
    f.checking = false;
    schedule();
  }

  const dz = Kit.dropzone(el.drop, {
    accept: ['image', 'pdf'],
    multiple: true,
    maxFiles: Model.MAX_FILES,
    context: () => session.active,
    onFiles: (files, infos, a) => addFiles(a || session.active, files, infos),
    onReject: (messages, a) => { const target = a || session.active; if (target) messages.forEach(m => target.addError(m)); }
  });

  /* ------------------------------------------------------------------ running jobs */
  function finishResult(a, job, result, message) {
    if (!a.endJob(job)) return null;
    const r = a.addResult(result);
    if (r && a === session.active) announce(message || `Ready to download: ${r.name}, ${resultFacts(r)}.`);
    else if (r) announce('A task for another applicant has finished.');
    return r;
  }

  function failJob(a, job, e, file, label) {
    const stillHere = a.endJob(job);
    if (!stillHere) return;
    if (e && (e.name === 'AbortError' || (Pdf && Pdf.isAbort(e) && e.code !== 'cancelled'))) { if (a === session.active) announce(`${label} cancelled.`); return; }
    const reason = e && e.message ? String(e.message) : 'Something went wrong.';
    const text = `${label} did not work: ${reason}`;
    if (file && alive(a, file)) file.actionError = text;
    else a.addError(text);
    if (a === session.active) announce(text);
    if (e && e.name !== 'PdfError' && window.console) console.warn(e);
    schedule();
  }

  function imageOptions(kind, s, f) {
    const base = { inputMime: f.info && f.info.mime, background: '#ffffff' };
    if (kind === 'photo') return Object.assign(base, { resize: 'fill', width: s.photo.width, height: s.photo.height, format: s.photo.format, quality: 0.92, maxBytes: Math.floor(s.photo.kb * 1024), allowShrink: false });
    if (kind === 'signature') return Object.assign(base, { resize: 'pad', width: s.signature.width, height: s.signature.height, format: s.signature.format, quality: 0.92, maxBytes: Math.floor(s.signature.kb * 1024), allowShrink: false });
    if (kind === 'compress') return Object.assign(base, { resize: 'none', format: 'keep', quality: 0.9, maxBytes: Math.floor(s.imgKB * 1024), allowShrink: true });
    return Object.assign(base, { resize: 'none', format: 'image/jpeg', quality: 0.92 });
  }

  function imageName(kind, f, res, s) {
    const ext = Ops.EXT[res.mime] || 'jpg';
    const stem = stemOf(f.name);
    if (kind === 'photo') return `${stem}-photo.${ext}`;
    if (kind === 'signature') return `${stem}-signature.${ext}`;
    if (kind === 'compress') return `${stem}-${s.imgKB}kb.${ext}`;
    return `${stem}.jpg`;
  }

  async function runImage(a, f, kind) {
    const s = needSettings(kind);
    if (!s || !alive(a, f) || a.busyFile(f.id)) return;
    const label = ACTION_LABEL[kind](s);
    const opts = imageOptions(kind, s, f);
    f.actionError = '';
    const job = a.startJob({ label: `${label}: ${f.name}`, fileIds: [f.id], action: kind, text: `${ACTION_VERB[kind]}: ${f.name}…` });
    const source = f.file;
    try {
      const res = await getPool().run(source, opts, job.signal, p => a.progress(job, p, `${ACTION_VERB[kind]}: ${f.name}… ${Math.round(p * 100)}%`));
      const limit = opts.maxBytes || 0;
      finishResult(a, job, {
        blob: res.blob, kind: 'image', action: kind, name: imageName(kind, f, res, s), sourceIds: [f.id],
        facts: { width: res.width, height: res.height, bytes: res.bytes, mime: res.mime, limit: limit && res.bytes <= limit ? limit : 0 },
        notes: res.notes || []
      });
    } catch (e) { failJob(a, job, e, f, label); }
  }

  /** Open a PDF of this applicant with pdf-lib and/or pdf.js, asking for its password once if needed. */
  async function openDoc(f, bytes, needs) {
    if (f.encrypted && f.password === undefined) {
      const opened = await PdfUI.openPdf(f.file, needs);
      f.password = opened.password;
      if (needs.js && !opened.jsDoc) throw opened.previewError || new Pdf.PdfError('damaged', `${f.name} could not be drawn. It may be damaged.`);
      return { libDoc: opened.libDoc, jsDoc: opened.jsDoc };
    }
    const password = f.encrypted ? f.password : undefined;
    const libDoc = needs.lib ? await Pdf.openLib(bytes, { password, name: f.name }) : null;
    const jsDoc = needs.js ? await Pdf.openJs(bytes, { password, name: f.name }) : null;
    return { libDoc, jsDoc };
  }

  /** Redraw a PDF's pages to fit `limit` bytes; null when it would not get smaller than `bytes`. */
  async function fitPdf(jsDoc, limit, job, a, from, span, original) {
    const res = await Pdf.compressRendered(jsDoc, {
      targetBytes: limit, dpi: 150, signal: job.signal,
      onProgress: (d, n, pass) => a.progress(job, from + (d / n) * span, `${pass ? 'Trying smaller: ' : ''}compressing page ${d} of ${n}…`)
    });
    Pdf.throwIfAborted(job.signal);
    const sizes = res.sizes.map(x => ({ width: x.view[2] - x.view[0], height: x.view[3] - x.view[1] }));
    const check = await Pdf.verify(res.bytes, { pages: jsDoc.numPages, sizes });
    if (original && res.bytes.length >= original.length) return null;
    return { bytes: res.bytes, pages: check.pageCount, fits: res.bytes.length <= limit };
  }

  async function runPdfCompress(a, f) {
    const s = needSettings('pdf');
    if (!s || !alive(a, f) || a.busyFile(f.id)) return;
    const label = ACTION_LABEL.pdf(s);
    const limit = Math.floor(s.pdfKB * 1024);
    f.actionError = '';
    const job = a.startJob({ label: `${label}: ${f.name}`, fileIds: [f.id], action: 'pdf', text: `Reading ${f.name}…` });
    let jsDoc = null;
    try {
      const bytes = await Pdf.readBytes(f.file);
      Pdf.throwIfAborted(job.signal);
      const stem = stemOf(f.name);
      if (!f.encrypted && bytes.length <= limit) {
        const check = await Pdf.verify(bytes, {});
        finishResult(a, job, { blob: new Blob([bytes], { type: 'application/pdf' }), kind: 'pdf', action: 'pdf', name: `${stem}.pdf`, sourceIds: [f.id], facts: { pages: check.pageCount, bytes: bytes.length, limit }, notes: [`Already under ${s.pdfKB} KB, so the original is kept unchanged.`] });
        return;
      }
      jsDoc = (await openDoc(f, bytes, { lib: false, js: true })).jsDoc;
      const fitted = await fitPdf(jsDoc, limit, job, a, 0.05, 0.85, f.encrypted ? null : bytes);
      a.progress(job, 0.95, 'Checking the finished file…');
      if (!fitted) {
        finishResult(a, job, { blob: new Blob([bytes], { type: 'application/pdf' }), kind: 'pdf', action: 'pdf', name: `${stem}.pdf`, sourceIds: [f.id], facts: { pages: f.pages, bytes: bytes.length, limit }, warning: `Compressing would not make this PDF smaller, so the original is kept. It is over ${s.pdfKB} KB: try a higher limit or fewer pages.` });
        return;
      }
      finishResult(a, job, {
        blob: new Blob([fitted.bytes], { type: 'application/pdf' }), kind: 'pdf', action: 'pdf', name: `${stem}-${s.pdfKB}kb.pdf`, sourceIds: [f.id],
        facts: { pages: fitted.pages, bytes: fitted.bytes.length, limit },
        warning: fitted.fits ? '' : `Could not get under ${s.pdfKB} KB. This is the smallest readable version; try a higher limit or fewer pages.`,
        notes: ['Pages are now pictures, so the text cannot be selected. Zoom in to check that it is easy to read.']
      });
    } catch (e) { failJob(a, job, e, f, label); }
    finally { if (jsDoc) Pdf.closeJs(jsDoc); }
  }

  async function runCombine(a, picked) {
    const files = picked.filter(f => alive(a, f));
    if (!files.length) return;
    const images = files.some(f => f.kind === 'image');
    if (!images && files.length < 2) return;
    const s = needSettings('pdf');
    if (!s) return;
    const limit = Math.floor(s.pdfKB * 1024);
    const label = images ? (files.length === 1 ? 'Make a PDF' : 'Combine into one PDF') : 'Merge PDFs';
    const job = a.startJob({ label: `${label}: ${plural(files.length, 'file')}`, fileIds: files.map(f => f.id), action: images ? 'combine' : 'merge', text: `${label}: reading ${plural(files.length, 'file')}…` });
    files.forEach(f => { f.selected = false; f.actionError = ''; });
    let jsDoc = null;
    try {
      const parts = [];
      let pages = 0;
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        Pdf.throwIfAborted(job.signal);
        a.progress(job, (i / files.length) * 0.4, `${label}: reading ${f.name} (${i + 1} of ${files.length})…`);
        if (f.kind === 'image') { parts.push({ image: await Pdf.prepareImage(f.file, f.info) }); pages += 1; }
        else {
          const bytes = await Pdf.readBytes(f.file);
          const { libDoc } = await openDoc(f, bytes, { lib: true, js: false });
          parts.push({ doc: libDoc });
          pages += libDoc.getPageCount();
        }
      }
      const merged = await Pdf.merge(parts, (d, n) => a.progress(job, 0.4 + (d / n) * 0.15, `${label}: putting page ${d} of ${n} in place…`), job.signal);
      let bytes = await Pdf.save(merged);
      Pdf.throwIfAborted(job.signal);
      await Pdf.verify(bytes, { pages });
      const notes = [];
      if (images && bytes.length > limit) {
        a.progress(job, 0.55, `${label}: making it fit ${s.pdfKB} KB…`);
        jsDoc = await Pdf.openJs(bytes, { name: 'The combined PDF' });
        const fitted = await fitPdf(jsDoc, limit, job, a, 0.55, 0.4, bytes);
        if (fitted) { bytes = fitted.bytes; notes.push('Pages were redrawn as pictures to fit the limit.'); }
      }
      a.progress(job, 0.97, 'Checking the finished file…');
      const check = await Pdf.verify(bytes, { pages });
      const over = bytes.length > limit;
      const stem = stemOf(files[0].name);
      finishResult(a, job, {
        blob: new Blob([bytes], { type: 'application/pdf' }), kind: 'pdf', action: images ? 'combine' : 'merge',
        name: `${stem}-${images ? 'combined' : 'merged'}.pdf`, sourceIds: files.map(f => f.id),
        facts: { pages: check.pageCount, bytes: bytes.length, limit },
        warning: over ? (images ? `Could not get under ${s.pdfKB} KB. This is the smallest readable version; try a higher limit or fewer pages.` : `Over the ${s.pdfKB} KB limit. Use Compress to ${s.pdfKB} KB on this result if the form needs it.`) : '',
        notes: notes.concat(images ? [`Pictures are placed on A4 pages in the order of the list.`] : [])
      });
    } catch (e) { failJob(a, job, e, null, label); }
    finally { if (jsDoc) Pdf.closeJs(jsDoc); }
  }

  async function runResultCompress(a, r) {
    const s = needSettings('pdf');
    if (!s || a.finished || !a.results.includes(r) || a.jobs.some(j => j.resultId === r.id)) return;
    const limit = Math.floor(s.pdfKB * 1024);
    const label = `Compress to ${s.pdfKB} KB`;
    const job = a.startJob({ label: `${label}: ${r.name}`, action: 'pdf', text: `Compressing ${r.name}…` });
    job.resultId = r.id;
    let jsDoc = null;
    try {
      const bytes = new Uint8Array(await r.blob.arrayBuffer());
      jsDoc = await Pdf.openJs(bytes, { name: r.name });
      const fitted = await fitPdf(jsDoc, limit, job, a, 0.05, 0.9, bytes);
      if (!fitted) throw new Pdf.PdfError('verify', 'Compressing would not make this PDF any smaller.');
      finishResult(a, job, {
        blob: new Blob([fitted.bytes], { type: 'application/pdf' }), kind: 'pdf', action: 'pdf', name: `${stemOf(r.name)}-${s.pdfKB}kb.pdf`, sourceIds: r.sourceIds,
        facts: { pages: fitted.pages, bytes: fitted.bytes.length, limit },
        warning: fitted.fits ? '' : `Could not get under ${s.pdfKB} KB. This is the smallest readable version; try a higher limit or fewer pages.`,
        notes: ['Pages are now pictures, so the text cannot be selected. Zoom in to check that it is easy to read.']
      });
    } catch (e) { failJob(a, job, e, null, label); }
    finally { if (jsDoc) Pdf.closeJs(jsDoc); }
  }

  /* ------------------------------------------------------------------ downloads */
  function saveURL(url, name) {
    const link = doc.createElement('a');
    link.href = url;
    link.download = Files.safeFileName(name, 'download');
    link.rel = 'noopener';
    link.hidden = true;
    doc.body.appendChild(link);
    link.click();
    link.remove();
  }

  el.zip.addEventListener('click', async () => {
    const a = session.active;
    if (!a || a.zipping || !a.results.length) return;
    const s = settings();
    const name = Model.zipName(s.zip, a);
    const included = a.results.slice();
    a.zipping = true;
    schedule();
    const saved = await Kit.downloadZip(included.map(r => ({ name: r.name, data: r.blob })), name, {
      save: (blob, zipName) => {
        if (a.finished) return false;
        const url = a.url(blob);
        saveURL(url, zipName);
        // The browser has the file once the download starts; the link is released soon after,
        // and at once if the applicant is finished first.
        setTimeout(() => a.releaseURL(url), 60000);
        return true;
      }
    });
    a.zipping = false;
    if (saved && !a.finished) a.markDownloaded(included.map(r => r.id));
    schedule();
  });

  /* ------------------------------------------------------------------ events */
  el.files.addEventListener('click', e => {
    const t = e.target.closest('[data-act]');
    if (!t || t.disabled) return;
    const a = session.active;
    const row = t.closest('.wk-file');
    const f = a && row ? a.file(row.dataset.id) : null;
    if (!f) return;
    const act = t.dataset.act;
    if (act === 'select') { f.selected = t.checked; schedule(); return; }
    if (act === 'up' || act === 'down') { a.moveFile(f.id, act === 'up' ? -1 : 1); return; }
    if (act === 'remove') {
      const i = a.files.indexOf(f);
      a.removeFile(f.id);
      render();
      const nextRow = el.files.children[Math.min(i, el.files.children.length - 1)];
      const target = nextRow ? nextRow.querySelector('[data-act="remove"]') : el.dropBrowse;
      if (target) target.focus();
      announce('File removed.');
      return;
    }
    if (act === 'run:pdf') { runPdfCompress(a, f); return; }
    if (act.startsWith('run:')) runImage(a, f, act.slice(4));
  });

  el.jobs.addEventListener('click', e => {
    const t = e.target.closest('[data-act="cancel"]');
    if (!t) return;
    const a = session.active;
    const li = t.closest('[data-job]');
    if (a && li) { t.disabled = true; a.cancelJob(li.dataset.job); }
  });

  el.results.addEventListener('click', e => {
    const t = e.target.closest('[data-act]');
    if (!t || t.disabled) return;
    const a = session.active;
    const row = t.closest('.wk-result');
    const r = a && row ? a.result(row.dataset.id) : null;
    if (!r) return;
    if (t.dataset.act === 'download') {
      // Let the browser start the download before the row is redrawn.
      setTimeout(() => { if (!a.finished) a.markDownloaded([r.id]); }, 0);
      return;
    }
    if (t.dataset.act === 'compress-result') { runResultCompress(a, r); return; }
    if (t.dataset.act === 'remove-result') {
      const i = a.results.indexOf(r);
      a.removeResult(r.id);
      render();
      const nextRow = el.results.children[Math.min(i, el.results.children.length - 1)];
      const target = nextRow ? nextRow.querySelector('[data-act="download"]') : el.resultsEmpty;
      if (target && target !== el.resultsEmpty) target.focus();
      announce('Result removed.');
    }
  });

  el.combine.addEventListener('click', () => { const a = session.active; if (a) runCombine(a, a.selected); });
  el.selNone.addEventListener('click', () => {
    const a = session.active;
    if (!a) return;
    a.files.forEach(f => { f.selected = false; });
    render();
    const first = el.files.querySelector('[data-act="select"]');
    if (first) first.focus();
  });
  el.errorClose.addEventListener('click', () => {
    const a = session.active;
    if (!a) return;
    a.errors.slice().forEach(err => a.dismissError(err.id));
    render();
    el.dropBrowse.focus();
  });

  el.name.addEventListener('input', () => {
    const a = session.active;
    if (!a) return;
    a.name = el.name.value.slice(0, 60);
    renderNav();
    el.zipLabel.textContent = a.zipping ? 'Preparing ZIP…' : `Download all for ${a.label} (ZIP)`;
  });

  function activate(id, focusTab) {
    const a = session.activate(id);
    render();
    if (focusTab && a) { const t = $(`wkTab-${a.id}`); if (t) t.focus(); }
  }

  el.tabs.addEventListener('click', e => { const t = e.target.closest('[role="tab"]'); if (t) activate(t.dataset.id, true); });
  // site.js already moves between the tabs of any tab list with Left, Right, Home and End (by
  // clicking the next tab); this adds Up and Down, and steps in only when it did not.
  el.tabs.addEventListener('keydown', e => {
    if (e.defaultPrevented) return;
    const tabs = Array.from(el.tabs.querySelectorAll('[role="tab"]'));
    const i = tabs.indexOf(doc.activeElement);
    if (i < 0) return;
    let j = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') j = (i + 1) % tabs.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') j = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') j = 0;
    else if (e.key === 'End') j = tabs.length - 1;
    if (j < 0) return;
    e.preventDefault();
    activate(tabs[j].dataset.id, true);
  });
  el.switcher.addEventListener('change', () => activate(el.switcher.value, false));

  function addApplicant() {
    inSession = true;
    const a = session.add();
    render();
    el.name.focus();
    announce(`${a.label} added. Type a name if you like, then add their files.`);
    return a;
  }
  el.startBtn.addEventListener('click', addApplicant);
  el.newBtn.addEventListener('click', addApplicant);
  el.noneNew.addEventListener('click', addApplicant);

  el.finish.addEventListener('click', async () => {
    const a = session.active;
    if (!a) return;
    const c = a.counts();
    const who = a.label;
    let ask = null;
    if (c.waiting) {
      ask = { title: `Finish ${who}?`, message: `${c.waiting} of ${plural(c.results, 'result')} for ${who} ${c.waiting === 1 ? 'has' : 'have'} not been downloaded. Finishing removes ${c.waiting === 1 ? 'it' : 'them'}, along with all of this applicant’s files, from this tab. This cannot be undone.${c.running ? ` ${plural(c.running, 'running task')} will be stopped.` : ''}`, confirmLabel: 'Finish and remove', danger: true };
    } else if (c.running) {
      ask = { title: `Finish ${who}?`, message: `${plural(c.running, 'task')} for ${who} ${c.running === 1 ? 'is' : 'are'} still running and will be stopped. Finishing removes all of this applicant’s files from this tab.`, confirmLabel: 'Finish and remove', danger: true };
    } else if (c.files && !c.results) {
      ask = { title: `Finish ${who}?`, message: `${who} has ${plural(c.files, 'file')} and no results yet. Finishing removes the files from this tab.`, confirmLabel: 'Finish and remove', danger: true };
    }
    if (ask && !(await UI().confirm(ask))) return;
    if (a.finished) return;
    session.finish(a.id);
    render();
    const next = session.active;
    const message = 'Applicant finished. Their files and results were removed from this tab.';
    notify(message);
    announce(message);
    if (next) { const t = $(`wkTab-${next.id}`); if (t && t.offsetParent) t.focus(); else el.name.focus(); }
    else el.noneTitle.focus();
  });

  el.endBtn.addEventListener('click', async () => {
    const list = session.applicants;
    const waiting = list.reduce((n, a) => n + a.counts().waiting, 0);
    const message = waiting
      ? `${plural(waiting, 'result')} ${waiting === 1 ? 'has' : 'have'} not been downloaded. Ending the session removes all ${plural(list.length, 'applicant')}, their files and results from this tab, and puts the session settings back to their defaults.`
      : list.length
        ? `This removes all ${plural(list.length, 'applicant')} and their files from this tab, and puts the session settings back to their defaults.`
        : 'The session settings go back to their defaults.';
    const ok = await UI().confirm({ title: 'End the session?', message, confirmLabel: 'End session', danger: session.hasData() });
    if (!ok) return;
    endSession();
    el.startBtn.focus();
    const done = 'Session ended. Everything was removed from this tab.';
    notify(done);
    announce(done);
  });

  function endSession() {
    session.end();
    if (pool) { pool.destroy(); pool = null; }
    inSession = false;
    resetSettings();
    render();
  }

  // Reloading or closing loses everything; warn while any applicant has files.
  Kit.guardUnload(() => session.hasData());
  // Leaving the page wipes the session, so a page restored from the back-forward cache is empty too.
  window.addEventListener('pagehide', () => { if (inSession || session.size) endSession(); });

  renderSummary();
  render();

  // For tests and support: counts only, never names or files.
  window.ApplyReadyWorkspace = {
    get state() {
      return { view: app.dataset.view, applicants: session.applicants.map(a => ({ id: a.id, number: a.number, files: a.files.length, results: a.results.length, running: a.jobs.length, urls: a.urlCount, status: a.status })) };
    }
  };
})();
