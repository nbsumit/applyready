/* ApplyReady batch image engine: the batch image processor, the image compressor and the image
   converter are one workspace (markup from scripts/lib/batch-workspace.js) that opens with
   different defaults, read from data-* attributes on #batchApp.

   Interface only: files come in through ApplyReadyFileKit.dropzone (checked by content), run
   through ApplyReadyBatch (concurrency, status, cancel, retry) on ApplyReadyImagePool (Web Workers,
   main-thread fallback) with ApplyReadyImageOps, and go out through ApplyReadyFiles.download or a
   ZIP. Results are Blobs kept in memory only; nothing is uploaded or stored. */
(function () {
  'use strict';
  const app = document.getElementById('batchApp');
  if (!app) return;
  const Files = window.ApplyReadyFiles;
  const Kit = window.ApplyReadyFileKit;
  const Ops = window.ApplyReadyImageOps;
  const UI = () => window.ApplyReadyUI || {};
  const $ = id => document.getElementById(id);

  const MODE = app.dataset.mode || 'batch';
  const MB = 1024 * 1024;
  const MAX_ITEMS = 500;
  const LIMIT_BYTES = 50 * MB;
  const WARN_BYTES = 300 * MB;
  const VERB = { batch: 'Process', compress: 'Compress', convert: 'Convert' }[MODE] || 'Process';
  const DONE_WORD = { batch: 'ready', compress: 'compressed', convert: 'converted' }[MODE] || 'ready';

  // Same table as scripts/lib/batch-workspace.js (tests compare them).
  const PRESETS = {
    custom: null,
    passport: { resize: 'fill', width: 350, height: 450, format: 'image/jpeg', maxKB: 50, quality: 90, allowShrink: false },
    signature: { resize: 'pad', width: 300, height: 100, format: 'image/jpeg', maxKB: 30, quality: 90, allowShrink: false },
    profile: { resize: 'fill', width: 400, height: 400, format: 'image/jpeg', maxKB: 100, quality: 90, allowShrink: false },
    document: { resize: 'fit', width: 1240, height: 1754, format: 'image/jpeg', maxKB: 500, quality: 85, allowShrink: true }
  };

  const el = {
    preset: $('bPreset'), resize: $('bResize'), resizeHint: $('bResizeHint'), dims: $('bDims'),
    width: $('bWidth'), height: $('bHeight'), scaleField: $('bScaleField'), scale: $('bScale'),
    maxKB: $('bMaxKB'), minKB: $('bMinKB'), quality: $('bQuality'), qualityVal: $('bQualityVal'), allowShrink: $('bAllowShrink'),
    format: $('bFormat'), formatHint: $('bFormatHint'), background: $('bBackground'),
    naming: $('bNaming'), suffix: $('bSuffix'), suffixField: $('bSuffixField'), prefix: $('bPrefix'), prefixField: $('bPrefixField'),
    more: $('batchMore'), reset: $('btnBatchReset'),
    bar: $('batchBar'), counts: $('batchCounts'), add: $('btnBatchAdd'), clear: $('btnBatchClear'),
    error: $('batchError'), errorTitle: $('batchErrorTitle'), errorList: $('batchErrorList'), errorClose: $('btnBatchErrorClose'),
    warning: $('batchWarning'), warningText: $('batchWarningText'),
    drop: $('batchDrop'),
    progress: $('batchProgress'), progressText: $('batchProgressText'), progressMeter: $('batchProgressMeter'), progressBar: $('batchProgressBar'), eta: $('batchProgressEta'), cancel: $('btnBatchCancel'),
    result: $('batchResult'), verdict: $('batchVerdict'), verdictIcon: $('batchVerdictIcon'), verdictTitle: $('batchVerdictTitle'), verdictText: $('batchVerdictText'),
    zip: $('btnBatchZip'), retry: $('btnBatchRetry'),
    stale: $('batchStale'), staleText: $('batchStaleText'), rerun: $('btnBatchRerun'),
    list: $('batchList'),
    start: $('btnBatchStart'), startLabel: $('btnBatchStartLabel'), summary: $('batchSettingsSummary')
  };

  const fmt = n => Files.formatBytes(n);
  const plural = (n, one, many) => `${n} ${n === 1 ? one : (many || one + 's')}`;
  const show = (node, on) => { if (node) node.classList.toggle('hidden', !on); };

  /* ------------------------------------------------------------------ settings */
  const DEFAULTS = {
    preset: app.dataset.preset || 'custom', resize: app.dataset.resize || 'none',
    width: app.dataset.width || '', height: app.dataset.height || '',
    format: app.dataset.format || 'keep', quality: app.dataset.quality || '85',
    maxKB: app.dataset.maxKb || '', minKB: app.dataset.minKb || '', allowShrink: app.dataset.allowShrink !== 'false',
    naming: app.dataset.naming || 'keep', suffix: app.dataset.suffix || '-resized', prefix: app.dataset.prefix || 'image'
  };

  const int = v => (String(v).trim() === '' ? null : Math.round(Number(v)));
  const num = v => (String(v).trim() === '' ? null : Number(v));

  function readSettings() {
    return {
      preset: el.preset.value, resize: el.resize.value,
      width: int(el.width.value), height: int(el.height.value), scale: int(el.scale.value),
      maxKB: num(el.maxKB.value), minKB: num(el.minKB.value),
      quality: Math.max(40, Math.min(100, Number(el.quality.value) || 85)),
      allowShrink: el.allowShrink.checked, format: el.format.value,
      background: /^#[0-9a-f]{6}$/i.test(el.background.value) ? el.background.value.toLowerCase() : '#ffffff',
      naming: el.naming.value, suffix: el.suffix.value, prefix: el.prefix.value
    };
  }

  /** Field errors in plain words; an empty object when the settings can run. */
  function validate(s) {
    const errors = {};
    const side = (v, label) => {
      if (v === null) return `Enter the ${label} in pixels.`;
      if (!Number.isFinite(v) || v < 16 || v > 12000) return `The ${label} must be between 16 and 12,000 px.`;
      return '';
    };
    if (s.resize === 'fit') {
      if (s.width === null && s.height === null) errors.width = 'Enter a width, a height or both.';
      if (s.width !== null) { const e = side(s.width, 'width'); if (e) errors.width = e; }
      if (s.height !== null) { const e = side(s.height, 'height'); if (e) errors.height = e; }
    } else if (s.resize === 'fill' || s.resize === 'pad') {
      const w = side(s.width, 'width'), h = side(s.height, 'height');
      if (w) errors.width = w;
      if (h) errors.height = h;
    } else if (s.resize === 'scale') {
      if (s.scale === null || !Number.isFinite(s.scale) || s.scale < 1 || s.scale > 400) errors.scale = 'Enter a percentage between 1 and 400.';
    }
    if (s.maxKB !== null && (!Number.isFinite(s.maxKB) || s.maxKB < 5 || s.maxKB > 20000)) errors.maxKB = 'The maximum must be between 5 and 20,000 KB.';
    if (s.minKB !== null && (!Number.isFinite(s.minKB) || s.minKB < 1 || s.minKB > 20000)) errors.minKB = 'The minimum must be between 1 and 20,000 KB.';
    else if (s.minKB !== null && s.maxKB !== null && !errors.maxKB && s.minKB >= s.maxKB) errors.minKB = 'The minimum must be smaller than the maximum.';
    return errors;
  }

  /** Options for ApplyReadyImageOps.process. File naming is not part of them. */
  function jobOptions(s) {
    return {
      resize: s.resize,
      width: s.resize === 'none' || s.resize === 'scale' ? undefined : s.width || undefined,
      height: s.resize === 'none' || s.resize === 'scale' ? undefined : s.height || undefined,
      scale: s.resize === 'scale' ? s.scale : undefined,
      format: s.format,
      quality: s.quality / 100,
      maxBytes: s.maxKB ? Math.floor(s.maxKB * 1024) : undefined,
      minBytes: s.minKB ? Math.ceil(s.minKB * 1024) : undefined,
      allowShrink: s.allowShrink,
      background: s.background
    };
  }
  const keyOf = s => JSON.stringify(jobOptions(s));

  const FORMAT_NAME = { keep: 'same format', 'image/jpeg': 'JPEG', 'image/png': 'PNG', 'image/webp': 'WebP' };
  function describe(s) {
    const parts = [];
    const box = `${s.width || 'any'} × ${s.height || 'any'} px`;
    if (s.resize === 'none') parts.push('Original size');
    else if (s.resize === 'fit') parts.push(`Fit within ${box}`);
    else if (s.resize === 'fill') parts.push(`${box}, cropped to fill`);
    else if (s.resize === 'pad') parts.push(`${box}, padded`);
    else if (s.resize === 'scale') parts.push(`${s.scale || '?'}% of the original`);
    parts.push(FORMAT_NAME[s.format] || 'JPEG');
    if (s.maxKB && s.minKB) parts.push(`${s.minKB} to ${s.maxKB} KB`);
    else if (s.maxKB) parts.push(`under ${s.maxKB} KB`);
    else if (s.format !== 'image/png') parts.push(`quality ${s.quality}%`);
    return parts.join(' · ');
  }

  const RESIZE_HINT = {
    none: 'Every image keeps its pixel size.',
    fit: 'Proportions are kept and small images are not enlarged. Leave one side empty to set only the other.',
    fill: 'Every image comes out at exactly this size; the edges are trimmed evenly to fit.',
    pad: 'Every image comes out at exactly this size; nothing is cut off and the space around it is filled with the background colour.',
    scale: 'Every image is resized to this share of its own size.'
  };

  let applyingPreset = false;
  function setFields(values) {
    applyingPreset = true;
    if ('resize' in values) el.resize.value = values.resize;
    if ('width' in values) el.width.value = values.width;
    if ('height' in values) el.height.value = values.height;
    if ('format' in values) el.format.value = values.format;
    if ('maxKB' in values) el.maxKB.value = values.maxKB;
    if ('minKB' in values) el.minKB.value = values.minKB;
    if ('quality' in values) el.quality.value = values.quality;
    if ('allowShrink' in values) el.allowShrink.checked = !!values.allowShrink;
    applyingPreset = false;
  }

  function applyPreset(key) {
    const p = PRESETS[key];
    if (!p) return;
    setFields({ resize: p.resize, width: p.width, height: p.height, format: p.format, maxKB: p.maxKB, minKB: '', quality: p.quality, allowShrink: p.allowShrink });
  }

  function resetSettings() {
    el.preset.value = DEFAULTS.preset;
    setFields({ resize: DEFAULTS.resize, width: DEFAULTS.width, height: DEFAULTS.height, format: DEFAULTS.format, maxKB: DEFAULTS.maxKB, minKB: DEFAULTS.minKB, quality: DEFAULTS.quality, allowShrink: DEFAULTS.allowShrink });
    if (DEFAULTS.preset !== 'custom') applyPreset(DEFAULTS.preset);
    el.scale.value = '50';
    el.background.value = '#ffffff';
    el.naming.value = DEFAULTS.naming;
    el.suffix.value = DEFAULTS.suffix;
    el.prefix.value = DEFAULTS.prefix;
    settingsChanged();
  }

  function fieldError(input, errorNode, message) {
    if (!input || !errorNode) return;
    input.setAttribute('aria-invalid', message ? 'true' : 'false');
    errorNode.textContent = message || '';
    show(errorNode, !!message);
  }

  let lastErrors = {};
  function renderSettings() {
    const s = readSettings();
    const errors = validate(s);
    lastErrors = errors;
    show(el.dims, s.resize !== 'none' && s.resize !== 'scale');
    show(el.scaleField, s.resize === 'scale');
    if (el.resizeHint) el.resizeHint.textContent = RESIZE_HINT[s.resize] || '';
    if (el.qualityVal) el.qualityVal.textContent = `${s.quality}%`;
    show(el.suffixField, s.naming === 'suffix');
    show(el.prefixField, s.naming === 'sequence');
    let hint = 'GIF, BMP and AVIF files are saved as JPEG when you keep the format.';
    if (s.format === 'image/png' && s.maxKB) hint = 'PNG has no quality setting. A maximum is met only by reducing the pixel size, if that is allowed; JPEG makes much smaller photos.';
    else if (s.format === 'image/png') hint = 'PNG keeps every pixel exactly. Photos saved as PNG are large.';
    else if (s.format === 'image/webp') hint = 'WebP is small, but many application portals refuse it. Some browsers cannot save it.';
    else if (s.format === 'image/jpeg') hint = 'JPEG suits photos and is accepted almost everywhere. It has no transparency.';
    if (s.minKB && s.format !== 'image/jpeg') hint += ' A minimum size can only be reached for JPEG files.';
    if (el.formatHint) el.formatHint.textContent = hint;
    fieldError(el.width, $('bWidthError'), errors.width);
    fieldError(el.height, $('bHeightError'), errors.height);
    fieldError(el.scale, $('bScaleError'), errors.scale);
    fieldError(el.maxKB, $('bMaxKBError'), errors.maxKB);
    fieldError(el.minKB, $('bMinKBError'), errors.minKB);
    // A value that needs fixing is never hidden behind a closed disclosure.
    const invalid = Object.keys(errors);
    if (invalid.length && el.more && !el.more.open) {
      const inside = invalid.some(k => { const map = { width: el.width, height: el.height, scale: el.scale, maxKB: el.maxKB, minKB: el.minKB }; return map[k] && el.more.contains(map[k]); });
      if (inside) el.more.open = true;
    }
    return { s, errors };
  }

  function settingsChanged() {
    renderSettings();
    rowsDirty = true;
    refresh();
  }

  function onFieldEdit(e) {
    if (!applyingPreset && e && e.target !== el.preset && !e.target.closest('[data-section="naming"]') && e.target !== el.background) {
      // Any change to a value the preset sets makes these your own settings.
      if (el.preset.value !== 'custom' && [el.resize, el.width, el.height, el.format, el.maxKB, el.minKB, el.quality, el.allowShrink, el.scale].includes(e.target)) el.preset.value = 'custom';
    }
    settingsChanged();
  }

  /* ------------------------------------------------------------------ queue */
  const pool = window.ApplyReadyImagePool.create();
  const queue = window.ApplyReadyBatch.createQueue({
    concurrency: pool.size,
    maxItems: MAX_ITEMS,
    process: runJob,
    release: () => { /* results hold Blobs only; dropping the reference frees them */ }
  });
  let run = null;               // { settings, key, startedAt, startDone, eta }
  const rows = new Map();       // item id -> row element

  function abortable(promise, signal) {
    if (!signal) return promise;
    return new Promise((resolve, reject) => {
      if (signal.aborted) { reject(new DOMException('Cancelled', 'AbortError')); return; }
      const onAbort = () => reject(new DOMException('Cancelled', 'AbortError'));
      signal.addEventListener('abort', onAbort, { once: true });
      promise.then(v => { signal.removeEventListener('abort', onAbort); resolve(v); },
        e => { signal.removeEventListener('abort', onAbort); reject(e); });
    });
  }

  async function runJob(item, ctx) {
    const settings = run ? run.settings : readSettings();
    const key = run ? run.key : keyOf(settings);
    const opts = Object.assign(jobOptions(settings), { inputMime: item.meta.mime || item.file.type });
    const result = await abortable(pool.run(item.file, opts, ctx.signal, ctx.progress), ctx.signal);
    // The worker already decoded the finished file and checked it; confirm what came back.
    if (!result || !result.blob || !result.blob.size) throw new Error('The browser returned an empty file. Try again.');
    if (!result.verified) throw new Error('The finished file could not be checked. Try again.');
    if (opts.maxBytes && result.bytes > opts.maxBytes) throw new Error(`The finished file is ${fmt(result.bytes)}, over the limit.`);
    const notes = (result.notes || []).slice();
    if (result.bytes >= item.size && settings.resize === 'none' && settings.format === 'keep') {
      notes.push(`The result is not smaller than the original (${fmt(item.size)}): the original was already well compressed. Keep the original, or set a lower quality or a maximum.`);
    }
    return { blob: result.blob, mime: result.mime, width: result.width, height: result.height, bytes: result.bytes, notes, key };
  }

  /* ------------------------------------------------------------------ rows */
  const STATUS = {
    queued: ['fa-solid fa-clock', 'Waiting'],
    processing: ['fa-solid fa-spinner fa-spin', 'Processing'],
    done: ['fa-solid fa-circle-check', 'Done'],
    error: ['fa-solid fa-circle-exclamation', 'Failed'],
    cancelled: ['fa-solid fa-ban', 'Cancelled']
  };

  function button(cls, icon, label, action) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `btn btn-sm btn-icon ${cls}`;
    b.dataset.action = action;
    b.setAttribute('aria-label', label);
    b.title = label;
    const i = document.createElement('i');
    i.className = icon;
    i.setAttribute('aria-hidden', 'true');
    b.appendChild(i);
    return b;
  }

  function createRow(item) {
    const li = document.createElement('li');
    li.className = 'file-row';
    li.dataset.id = item.id;
    li.innerHTML = `<span class="file-row__thumb" aria-hidden="true"><i class="fa-solid fa-image"></i></span>
      <div class="file-row__text"><span class="file-row__name"></span><span class="file-row__meta"></span><span class="file-row__result hidden"></span><span class="file-row__notes hidden"></span><span class="file-row__error hidden"></span></div>
      <span class="file-row__status"><span class="file-status"><i aria-hidden="true"></i><span class="file-status__text"></span></span></span>
      <div class="file-row__actions"></div>
      <div class="progress file-row__progress hidden"><span class="progress-bar"></span></div>`;
    li.querySelector('.file-row__name').textContent = item.name;
    li.querySelector('.file-row__name').title = item.name;
    const actions = li.querySelector('.file-row__actions');
    actions.append(
      button('btn-ghost', 'fa-solid fa-download', `Download ${item.name}`, 'download'),
      button('btn-ghost', 'fa-solid fa-rotate-right', `Retry ${item.name}`, 'retry'),
      button('btn-danger-ghost', 'fa-solid fa-xmark', `Remove ${item.name}`, 'remove')
    );
    rows.set(item.id, li);
    el.list.appendChild(li);
    thumbObserver.observe(li);
    updateRow(item);
  }

  function updateRow(item, names) {
    const li = rows.get(item.id);
    if (!li) return;
    const status = item.status;
    li.dataset.status = status;
    const [icon, word] = STATUS[status] || STATUS.queued;
    const stale = status === 'done' && item.result && currentKey && item.result.key !== currentKey;
    li.classList.toggle('is-stale', !!stale);
    li.querySelector('.file-status i').className = icon;
    li.querySelector('.file-status__text').textContent = stale ? 'Done, old settings' : word;
    const m = item.meta;
    li.querySelector('.file-row__meta').textContent = [fmt(item.size), m.dims ? `${m.dims.width} × ${m.dims.height} px` : '', m.label || ''].filter(Boolean).join(' · ');
    const resultLine = li.querySelector('.file-row__result');
    const notesLine = li.querySelector('.file-row__notes');
    const errorLine = li.querySelector('.file-row__error');
    const done = status === 'done' && item.result;
    if (done) {
      const r = item.result;
      const name = (names || outputNames()).get(item.id) || item.name;
      resultLine.textContent = `Result: ${name} · ${r.width} × ${r.height} px · ${fmt(r.bytes)} (${r.bytes.toLocaleString('en')} bytes)`;
      notesLine.textContent = r.notes.join(' ');
      li.querySelector('[data-action="download"]').setAttribute('aria-label', `Download ${name}`);
      li.querySelector('[data-action="download"]').title = `Download ${name}`;
    }
    show(resultLine, !!done);
    show(notesLine, !!(done && item.result.notes.length));
    errorLine.textContent = status === 'error' ? item.error : '';
    show(errorLine, status === 'error');
    show(li.querySelector('[data-action="download"]'), !!done);
    show(li.querySelector('[data-action="retry"]'), status === 'error' || status === 'cancelled');
    const bar = li.querySelector('.file-row__progress');
    show(bar, status === 'processing');
    bar.firstElementChild.style.width = `${Math.round((item.progress || 0) * 100)}%`;
  }

  /* Thumbnails: made only for rows on screen, two at a time, released when the row goes. */
  const thumbWaiting = [];
  let thumbRunning = 0;
  function pumpThumbs() {
    while (thumbRunning < 2 && thumbWaiting.length) {
      const item = thumbWaiting.shift();
      if (!rows.has(item.id) || item.meta.thumbUrl !== undefined) continue;
      thumbRunning++;
      item.meta.thumbUrl = null;
      Kit.thumbnail(item.file, 96).then(url => {
        if (!url) return;
        if (!rows.has(item.id)) { URL.revokeObjectURL(url); return; }
        item.meta.thumbUrl = url;
        const holder = rows.get(item.id).querySelector('.file-row__thumb');
        const img = document.createElement('img');
        img.alt = '';
        img.src = url;
        holder.replaceChildren(img);
      }).finally(() => { thumbRunning--; pumpThumbs(); });
    }
  }
  const thumbObserver = 'IntersectionObserver' in window
    ? new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        thumbObserver.unobserve(entry.target);
        const item = findItem(entry.target.dataset.id);
        if (item) { thumbWaiting.push(item); pumpThumbs(); }
      });
    }, { rootMargin: '200px 0px' })
    : { observe: li => { const item = findItem(li.dataset.id); if (item) { thumbWaiting.push(item); pumpThumbs(); } }, unobserve() {} };

  function findItem(id) { return queue.items.find(i => i.id === id); }

  function forget(item) {
    const li = rows.get(item.id);
    if (li) { thumbObserver.unobserve(li); li.remove(); }
    rows.delete(item.id);
    if (item.meta.thumbUrl) URL.revokeObjectURL(item.meta.thumbUrl);
    item.meta.thumbUrl = null;
  }

  /* Output names: keep, add a word, or number in list order; duplicates get (2), (3)... */
  function outputNames() {
    const s = readSettings();
    const used = new Set();
    const names = new Map();
    const all = queue.items;
    const digits = Math.max(3, String(all.length).length);
    const word = String(s.suffix || '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '').slice(0, 40);
    const prefix = String(s.prefix || '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '').trim().slice(0, 40) || 'image';
    all.forEach((item, index) => {
      if (item.status !== 'done' || !item.result) return;
      const ext = Ops.EXT[item.result.mime] || 'jpg';
      let stem;
      if (s.naming === 'sequence') stem = `${prefix}-${String(index + 1).padStart(digits, '0')}`;
      else stem = Files.stem(Files.safeFileName(item.name, 'image')) + (s.naming === 'suffix' ? word : '');
      let name = Files.safeFileName(`${stem}.${ext}`, 'image');
      const base = Files.stem(name);
      for (let n = 2; used.has(name.toLowerCase()); n++) name = `${base} (${n}).${ext}`;
      used.add(name.toLowerCase());
      names.set(item.id, name);
    });
    return names;
  }

  /* ------------------------------------------------------------------ adding files */
  function showErrors(title, messages) {
    if (!messages.length) { el.error.hidden = true; return; }
    el.errorTitle.textContent = title;
    el.errorList.replaceChildren(...messages.slice(0, 12).map(m => { const li = document.createElement('li'); li.textContent = m; return li; }));
    if (messages.length > 12) { const li = document.createElement('li'); li.textContent = `And ${messages.length - 12} more.`; el.errorList.appendChild(li); }
    el.error.hidden = false;
  }

  function addFiles(files, infos) {
    const room = MAX_ITEMS - queue.items.length;
    const extra = [];
    if (files.length > room) extra.push(room > 0 ? `Only ${plural(room, 'more image')} fit in this batch, which holds ${MAX_ITEMS}. Process these and download them, then clear the list for the rest.` : `This batch is full (${MAX_ITEMS} images). Process and download these, then clear the list to add more.`);
    const { added } = queue.add(files.slice(0, Math.max(0, room)));
    added.forEach((item, i) => {
      const info = infos[i] || {};
      item.meta.mime = info.mime || item.file.type;
      item.meta.label = info.label ? info.label.replace(/ image$/, '') : '';
      item.meta.downloaded = false;
      createRow(item);
      item.file.slice(0, 512 * 1024).arrayBuffer().then(buf => {
        const header = Ops.readHeader(new Uint8Array(buf));
        if (header) { item.meta.dims = header; updateRow(item); }
      }).catch(() => { /* size shown once processed */ });
    });
    if (added.length) Kit.announce(`${plural(added.length, 'image')} added. ${queue.items.length} in the list.`);
    return extra;
  }

  // The kit reports rejected files first, then (in the same tick) the accepted ones, if any.
  let pendingRejects = [];
  const notAdded = n => (n === 1 ? 'One file was not added:' : `${n} files were not added:`);
  const dz = Kit.dropzone(app, {
    accept: ['image'], multiple: true, limitBytes: LIMIT_BYTES, maxFiles: MAX_ITEMS,
    onReject: messages => {
      pendingRejects = messages;
      showErrors(notAdded(messages.length), messages);
      Kit.announce(`${plural(messages.length, 'file')} not added. ${messages[0]}`);
      Promise.resolve().then(() => { pendingRejects = []; });
    },
    onFiles: (files, infos) => {
      const extra = addFiles(files, infos);
      const all = pendingRejects.concat(extra);
      pendingRejects = [];
      showErrors(notAdded(all.length), all);
      refresh();
    }
  });

  /* ------------------------------------------------------------------ running */
  function start() {
    const { s, errors } = renderSettings();
    if (Object.keys(errors).length) { refresh(); return; }
    const queued = queue.items.filter(i => i.status === 'queued').length;
    if (!queued) return;
    showErrors('', []);
    if (!queue.running) {
      run = { settings: s, key: keyOf(s), startedAt: performance.now(), startFinished: finishedCount(), smoothed: null };
      Kit.announce(`${VERB === 'Process' ? 'Processing' : VERB.replace(/e$/, '') + 'ing'} ${plural(queued, 'image')}.`);
      queue.start().then(onIdle);
    }
    refresh();
  }

  function finishedCount() { return queue.items.filter(i => i.status === 'done' || i.status === 'error' || i.status === 'cancelled').length; }

  function onIdle(summary) {
    const finishedRun = run;
    run = null;
    refresh();
    if (!finishedRun || finishedRun.cancelled) return;
    const done = summary.done, failed = summary.error + summary.cancelled;
    Kit.announce(failed ? `Finished. ${done} of ${summary.total} images ${DONE_WORD}; ${plural(failed, 'image')} failed or cancelled.` : `Finished. ${plural(done, 'image')} ${DONE_WORD}.`);
  }

  function cancel() {
    if (!queue.running) return;
    if (run) run.cancelled = true;
    queue.cancel();
    const done = queue.items.filter(i => i.status === 'done').length;
    Kit.announce(`Cancelled. ${plural(done, 'finished image')} kept.`);
  }

  function retryFailed() {
    queue.retry();
    start();
  }

  function processAgain() {
    const key = currentKey;
    if (!key || queue.running) return;
    queue.requeueAll(item => (item.status === 'done' && item.result && item.result.key !== key) || item.status === 'error' || item.status === 'cancelled');
    queue.items.forEach(i => { if (i.status === 'queued') i.meta.downloaded = false; });
    start();
  }

  /* ------------------------------------------------------------------ downloads */
  function downloadOne(item) {
    if (!item || item.status !== 'done' || !item.result) return;
    const name = outputNames().get(item.id);
    Files.download(item.result.blob, name);
    item.meta.downloaded = true;
    Kit.announce(`Downloaded ${name}.`);
  }

  async function downloadAll() {
    const names = outputNames();
    const done = queue.items.filter(i => i.status === 'done' && i.result);
    if (!done.length) return;
    const entries = done.map(i => ({ name: names.get(i.id), data: i.result.blob }));
    const ok = await Kit.downloadZip(entries, app.dataset.zip || 'images.zip', { button: el.zip });
    if (ok) done.forEach(i => { i.meta.downloaded = true; });
    refresh();
  }

  function undownloaded() { return queue.items.filter(i => i.status === 'done' && i.result && !i.meta.downloaded).length; }

  async function clearAll() {
    const waiting = undownloaded();
    if (waiting || queue.running) {
      const confirm = UI().confirm;
      const message = waiting
        ? `${plural(waiting, 'finished image')} ${waiting === 1 ? 'has' : 'have'} not been downloaded. Clearing removes ${waiting === 1 ? 'it' : 'them'} from this page.`
        : 'Images are still being processed. Clearing stops them and removes every image from this page.';
      const yes = confirm ? await confirm({ title: 'Clear all images?', message, confirmLabel: 'Clear all', danger: true }) : window.confirm(message);
      if (!yes) return;
    }
    queue.items.forEach(forget);
    queue.clear();
    thumbWaiting.length = 0;
    run = null;
    showErrors('', []);
    el.list.replaceChildren();
    rowsDirty = true;
    refresh();
    Kit.announce('All images cleared.');
    const browse = el.drop && el.drop.querySelector('[data-browse]');
    if (browse) browse.focus();
  }

  function removeItem(item) {
    const li = rows.get(item.id);
    const next = li && (li.nextElementSibling || li.previousElementSibling);
    forget(item);
    queue.remove(item.id);
    rowsDirty = true;
    Kit.announce(`${item.name} removed.`);
    if (next) { const b = next.querySelector('[data-action="remove"]'); if (b) b.focus(); }
    else if (el.add && queue.items.length) el.add.focus();
    else { const browse = el.drop && el.drop.querySelector('[data-browse]'); if (browse) browse.focus(); }
    refresh();
  }

  el.list.addEventListener('click', e => {
    const b = e.target.closest('button[data-action]');
    if (!b) return;
    const item = findItem(b.closest('.file-row').dataset.id);
    if (!item) return;
    if (b.dataset.action === 'download') downloadOne(item);
    else if (b.dataset.action === 'retry') { queue.retry(item.id); start(); }
    else if (b.dataset.action === 'remove') removeItem(item);
  });

  /* ------------------------------------------------------------------ summary and state */
  let currentKey = null;
  let rowsDirty = true;       // every row needs repainting (settings or names changed)
  let renderedKey = null;
  let shownNames = new Map();
  let frame = 0;
  function refresh() {
    if (frame) return;
    frame = requestAnimationFrame(() => { frame = 0; render(); });
  }

  function etaText(summary) {
    if (!run) return '';
    const elapsed = (performance.now() - run.startedAt) / 1000;
    const runItems = summary.total - run.startFinished;
    const progressed = (summary.progress * summary.total) - run.startFinished;
    if (runItems <= 0 || progressed <= 0.15 || elapsed < 1.5) return 'Working out the time left…';
    const raw = elapsed * (runItems - progressed) / progressed;
    run.smoothed = run.smoothed === null ? raw : run.smoothed * 0.7 + raw * 0.3;
    const left = run.smoothed;
    if (left < 8) return 'A few seconds left';
    if (left < 55) return `About ${Math.round(left / 5) * 5} seconds left`;
    const min = Math.round(left / 60);
    return `About ${min} minute${min === 1 ? '' : 's'} left`;
  }

  function render() {
    const { s, errors } = renderSettings();
    const valid = !Object.keys(errors).length;
    currentKey = valid ? keyOf(s) : null;
    const items = queue.items;
    const summary = queue.summary();
    if (rowsDirty || currentKey !== renderedKey) {
      const names = outputNames();
      items.forEach(item => updateRow(item, names));
      shownNames = names;
      rowsDirty = false;
      renderedKey = currentKey;
    } else {
      // Cancel, retry and requeue change many items at once without an event per item.
      items.forEach(item => { const li = rows.get(item.id); if (li && li.dataset.status !== item.status) updateRow(item, shownNames); });
    }

    const total = items.length;
    const totalBytes = items.reduce((sum, i) => sum + i.size, 0);
    const running = queue.running;
    const done = items.filter(i => i.status === 'done');
    const stale = valid ? done.filter(i => i.result && i.result.key !== currentKey) : [];
    const failed = summary.error + summary.cancelled;

    show(el.bar, total > 0);
    show(el.list, total > 0);
    if (el.counts) {
      const bits = [`<strong>${total}</strong> ${total === 1 ? 'image' : 'images'}`, fmt(totalBytes)];
      if (summary.done) bits.push(`${summary.done} done`);
      if (summary.error) bits.push(`${summary.error} failed`);
      if (summary.cancelled) bits.push(`${summary.cancelled} cancelled`);
      el.counts.innerHTML = bits.join(' · ');
    }
    if (totalBytes > WARN_BYTES) {
      el.warningText.textContent = `These images add up to ${fmt(totalBytes)}. That is a lot for one browser tab: processing runs a few images at a time and may be slow on this device. If the page struggles, process them in smaller groups.`;
      el.warning.hidden = false;
    } else el.warning.hidden = true;

    // Progress while running
    show(el.progress, running);
    if (running) {
      const finished = summary.done + summary.error + summary.cancelled;
      const pct = Math.round(summary.progress * 100);
      el.progressText.textContent = `${VERB === 'Process' ? 'Processing' : VERB.replace(/e$/, '') + 'ing'}: ${finished} of ${total} finished${summary.error ? `, ${summary.error} failed` : ''}`;
      el.progressBar.style.width = `${pct}%`;
      el.progressMeter.setAttribute('aria-valuenow', String(pct));
      el.progressMeter.setAttribute('aria-valuetext', `${finished} of ${total} images finished`);
      el.eta.textContent = etaText(summary);
    }

    // Result once nothing is waiting
    const showResult = !running && summary.queued === 0 && (summary.done + failed) > 0;
    show(el.result, showResult);
    if (showResult) {
      const outBytes = done.reduce((sum, i) => sum + (i.result ? i.result.bytes : 0), 0);
      const inBytes = done.reduce((sum, i) => sum + i.size, 0);
      if (!failed) {
        el.verdictIcon.className = 'fa-solid fa-check';
        el.verdict.classList.remove('is-warning');
        el.verdictTitle.textContent = `${plural(done.length, 'image')} ${DONE_WORD}`;
      } else {
        el.verdictIcon.className = 'fa-solid fa-triangle-exclamation';
        el.verdict.classList.add('is-warning');
        el.verdictTitle.textContent = done.length ? `${done.length} of ${summary.done + failed} images ${DONE_WORD}` : 'No images could be processed';
      }
      const facts = [];
      if (done.length) facts.push(`${fmt(outBytes)} in total, from ${fmt(inBytes)}.`);
      if (summary.error) facts.push(`${plural(summary.error, 'image')} failed; each row says why.`);
      if (summary.cancelled) facts.push(`${plural(summary.cancelled, 'image')} cancelled.`);
      el.verdictText.textContent = facts.join(' ');
      show(el.zip, done.length > 0);
      if (!el.zip.getAttribute('aria-busy')) el.zip.disabled = !done.length;
      if (!el.zip.getAttribute('aria-busy')) el.zip.innerHTML = `<i class="fa-solid fa-file-zipper" aria-hidden="true"></i> Download ${done.length === 1 ? 'it' : `all ${done.length}`} as ZIP`;
      show(el.retry, failed > 0);
      el.retry.innerHTML = `<i class="fa-solid fa-rotate-right" aria-hidden="true"></i> Retry ${plural(failed, 'failed image', 'failed and cancelled images')}`;
    }

    // Settings changed after processing
    show(el.stale, !running && stale.length > 0);
    if (stale.length) el.staleText.textContent = `You changed the settings after processing. ${plural(stale.length, 'finished image')} still ${stale.length === 1 ? 'uses' : 'use'} the old settings.`;

    // The one primary action
    const queued = summary.queued;
    let label, enabled = false, note = describe(s), invalid = false;
    if (!valid) { label = `${VERB} images`; note = Object.values(errors)[0]; invalid = true; }
    else if (running) label = 'Working…';
    else if (queued) { label = `${VERB} ${plural(queued, 'image')}`; enabled = true; }
    else if (stale.length) { label = 'Process again'; enabled = true; }
    else if (total) { label = 'All images processed'; note = `${describe(s)}. Change a setting or add images to process more.`; }
    else label = `${VERB} images`;
    el.startLabel.textContent = label;
    el.start.disabled = !enabled;
    el.start.dataset.intent = queued ? 'start' : stale.length ? 'again' : '';
    el.summary.textContent = note;
    el.summary.classList.toggle('is-invalid', invalid);
    el.clear.disabled = total === 0;
  }

  /* ------------------------------------------------------------------ wiring */
  // A finished file can change another row's name ("photo.jpg" and "photo (2).jpg" follow list
  // order), so after each one only the rows whose name changed are repainted.
  queue.on(event => {
    if (event.type === 'item') {
      if (event.item.status === 'done') {
        const names = outputNames();
        queue.items.forEach(item => { if (item === event.item || (names.get(item.id) && names.get(item.id) !== shownNames.get(item.id))) updateRow(item, names); });
        shownNames = names;
      } else updateRow(event.item);
    }
    refresh();
  });

  el.start.addEventListener('click', () => { if (el.start.dataset.intent === 'again') processAgain(); else start(); });
  el.cancel.addEventListener('click', cancel);
  el.retry.addEventListener('click', retryFailed);
  el.rerun.addEventListener('click', processAgain);
  el.zip.addEventListener('click', downloadAll);
  el.clear.addEventListener('click', clearAll);
  el.add.addEventListener('click', () => dz.open());
  el.errorClose.addEventListener('click', () => { el.error.hidden = true; });
  el.reset.addEventListener('click', resetSettings);
  el.preset.addEventListener('change', () => { applyPreset(el.preset.value); settingsChanged(); });
  app.querySelector('.ws-side').addEventListener('input', onFieldEdit);
  app.querySelector('.ws-side').addEventListener('change', e => { if (e.target !== el.preset) onFieldEdit(e); });

  Kit.guardUnload(() => queue.running || undownloaded() > 0);

  // Start from the page's defaults (the markup has them too; this applies a preset if one is set).
  if (DEFAULTS.preset !== 'custom') { el.preset.value = DEFAULTS.preset; applyPreset(DEFAULTS.preset); }
  renderSettings();
  render();

  // For tests and the applicant workspace: a read-only view of the queue.
  window.ApplyReadyBatchImage = { get items() { return queue.items; }, outputNames, summary: () => queue.summary(), usesWorkers: () => pool.usesWorkers };
})();
