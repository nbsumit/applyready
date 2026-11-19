/* Compress PDF: the interface. Every page is redrawn by pdf.js at the chosen resolution and saved
   as a JPEG whose quality is searched to fit the page's share of the limit
   (ApplyReadyPdf.compressRendered). The new PDF keeps the page count, order, page sizes and
   rotation, and is reopened and checked before it is offered. A photo of a document becomes a
   one-page A4 PDF. A file already under the limit, or one that would not get smaller, is kept as it
   is. Nothing leaves the browser.

   This replaces an older approach that looked for JPEG images inside the file's bytes, which could
   silently drop pages that held text. */
(function () {
  'use strict';
  const doc = document;
  const app = doc.getElementById('compressApp');
  if (!app) return;
  const K = window.ApplyReadyPdf, UI = window.ApplyReadyPdfUI, Kit = window.ApplyReadyFileKit;
  const notify = (m, e) => { if (window.ApplyReadyUI && window.ApplyReadyUI.notify) window.ApplyReadyUI.notify(m, e); };
  const $ = id => doc.getElementById(id);
  const els = {
    zone: $('compressDropzone'), fileBox: $('compressFileInfoBox'), fileText: $('compressFileInfoText'),
    replace: $('btnCompressReplace'), remove: $('btnCompressRemove'), loading: $('compressLoading'),
    target: $('targetKbInput'), targetError: $('targetKbError'), presets: app.querySelectorAll('.preset-kb-btn'),
    dpi: $('compressDpi'), grey: $('compressGrey'), start: $('btnStartCompress'),
    result: $('compressResultArea'), status: $('compressStatus'), note: $('compressNote'), download: $('btnDownloadCompressedPdf'),
    orig: $('statOrigSize'), comp: $('statCompSize'), reduction: $('statReduction'), pages: $('statCompPages'), dpiStat: $('statCompDpi')
  };
  const errorBox = UI.errorBox($('compressError'));
  const error = { show(m) { errorBox.show(m); notify(Array.isArray(m) ? m.join(' ') : m, true); }, hide() { errorBox.hide(); } };
  const urls = UI.urls();
  let current = null; // { file, kind, info, bytes, pageCount, password, encrypted, jsDoc }
  let output = null;
  let opening = 0;

  const sup = K.support();
  if (!sup.ok) {
    error.show(`This browser cannot compress PDFs (it lacks ${sup.missing.join(', ')}). Update it, or use a recent Chrome, Edge, Firefox or Safari.`);
    els.zone.querySelectorAll('button').forEach(b => { b.disabled = true; });
    return;
  }

  // Progress box keeps its historical ids; the shared runner reads its classes.
  const box = $('compressProgressBox');
  $('compressCancel').setAttribute('data-cancel', '');
  const runner = UI.runner(box, { error, button: els.start, busyLabel: 'Compressing…', onState: busy => { els.replace.disabled = busy; els.remove.disabled = busy; } });

  // Every size here uses the site's one size format: 1 KB = 1,000 bytes, rounded up
  // (ApplyReadyFiles.formatBytes), so a size never reads as under a limit it is over.
  const sized = bytes => K.limitSize(bytes);

  function dropResult() {
    if (output) { urls.revoke(output); output = null; }
    els.result.classList.add('hidden');
  }

  async function release() {
    if (current && current.jsDoc) K.closeJs(current.jsDoc);
    current = null;
  }

  async function clear() {
    if (runner.busy) return;
    opening++;
    await release();
    dropResult();
    error.hide();
    els.fileBox.classList.add('hidden');
    els.loading.classList.add('hidden');
    els.start.disabled = true;
    const b = $('btnCompressBrowse'); if (b) b.focus();
  }

  async function take(files, infos) {
    const file = files[0], info = infos[0];
    if (runner.busy) { error.show('Wait for compression to finish, or select Cancel, before choosing another file.'); return; }
    const ticket = ++opening;
    error.hide();
    dropResult();
    els.loading.classList.remove('hidden');
    try {
      let next;
      if (info.kind === 'image') {
        // The same checks as the image tools: a picture over 50 megapixels is refused before it is
        // decoded, and a truncated or damaged photo now rather than after Start (js/lib/image-ops.js).
        const Ops = window.ApplyReadyImageOps;
        if (Ops) {
          try { (await Ops.openImage(file, { name: file.name })).close(); }
          catch (e) { throw new K.PdfError(e && e.code === 'toolarge' ? 'toolarge' : 'damaged', e && e.message ? e.message : `${file.name} could not be read as an image.`); }
        }
        next = { file, kind: 'image', info, pageCount: 1 };
      } else {
        if (!sup.render) throw new K.PdfError('unsupported', 'This browser cannot draw PDF pages, which the compressor needs. Update it, or use a recent Chrome, Edge, Firefox or Safari.');
        const opened = await UI.openPdf(file, { lib: true, js: true });
        if (!opened.jsDoc) throw opened.previewError || new K.PdfError('damaged', `${file.name} could not be drawn. It may be damaged.`);
        if (opened.pageCount > K.LIMITS.compressPages) { K.closeJs(opened.jsDoc); throw new K.PdfError('toolarge', `${file.name} has ${K.grouped(opened.pageCount)} pages. ${K.compressAdvice(opened.pageCount)}`); }
        next = Object.assign({ file, kind: 'pdf', info }, opened);
      }
      if (ticket !== opening) { if (next.jsDoc) K.closeJs(next.jsDoc); return; }
      await release();
      current = next;
      els.fileText.textContent = `${file.name} (${sized(file.size)}${next.kind === 'pdf' ? `, ${UI.plural(next.pageCount, 'page')}` : ', photo'}${next.encrypted ? ', password protected' : ''})`;
      els.fileBox.classList.remove('hidden');
      UI.keepFocus(els.zone, els.fileText);
      validateTarget();
      Kit.announce(`${file.name} is ready to compress.`);
      // A PDF with some pages damaged opens (the rest may be fine); say which, as every PDF tool does.
      const damage = next.kind === 'pdf' ? UI.damageNotice(next) : '';
      if (damage) error.show(damage);
    } catch (e) {
      if (ticket !== opening) return;
      const message = e && e.name === 'PdfError' ? e.message : `${file.name} could not be opened. Check that it opens on your device, then choose it again.`;
      error.show(e && e.code === 'cancelled' ? `${message} Choose the file again when you have the password.` : /hoose|try/i.test(message) ? message : `${message} Choose another file.`);
      if (!current) els.fileBox.classList.add('hidden');
    } finally {
      if (ticket === opening) els.loading.classList.add('hidden');
    }
  }

  const dz = Kit.dropzone(els.zone, {
    accept: ['pdf', 'image'],
    limitBytes: K.LIMITS.fileBytes,
    onFiles: take,
    onReject: messages => error.show(messages.map(m => /hoose|try/i.test(m) ? m : `${m} Choose a PDF or a photo of the document.`))
  });
  // The workspace markup (scripts/build-tool-pages.js) names its button by id rather than data-browse.
  $('btnCompressBrowse').addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); dz.open(); });
  els.replace.addEventListener('click', () => dz.open());
  els.remove.addEventListener('click', clear);

  function targetKB() { return Number(els.target.value); }
  function validateTarget() {
    const kb = targetKB();
    const bad = !Number.isFinite(kb) || kb < 5 || kb > 10000;
    els.targetError.textContent = bad ? 'Type a limit from 5 to 10000 KB.' : '';
    els.targetError.hidden = !bad;
    if (bad) { els.target.setAttribute('aria-invalid', 'true'); els.target.setAttribute('aria-describedby', 'targetKbError targetKbHint'); }
    else { els.target.removeAttribute('aria-invalid'); els.target.setAttribute('aria-describedby', 'targetKbHint'); }
    els.start.disabled = bad || !current;
    return !bad;
  }

  els.presets.forEach(btn => btn.addEventListener('click', () => {
    els.presets.forEach(b => { b.classList.toggle('active', b === btn); b.setAttribute('aria-pressed', String(b === btn)); });
    els.target.value = btn.dataset.kb;
    dropResult();
    validateTarget();
  }));
  els.target.addEventListener('input', () => {
    els.presets.forEach(b => { const m = b.dataset.kb === els.target.value; b.classList.toggle('active', m); b.setAttribute('aria-pressed', String(m)); });
    dropResult();
    validateTarget();
  });
  [els.dpi, els.grey].forEach(el => el.addEventListener('change', dropResult));

  function show(res) {
    const { bytes, kept, pageCount, minDpi, target, original } = res;
    dropResult();
    output = urls.make(UI.pdfBlob(bytes));
    UI.setDownload(els.download, output, kept ? current.file.name : `${UI.stem(current.file.name)}-compressed.pdf`);
    const outcome = K.compressResult(bytes.length, res.kb, kept);
    const met = outcome.met && bytes.length <= target && !(current.kind === 'pdf' && UI.damageNote(current));
    els.status.className = 'result-status' + (met ? '' : ' is-warning');
    els.status.textContent = '';
    const icon = doc.createElement('i');
    icon.className = met ? 'fa-solid fa-check' : 'fa-solid fa-triangle-exclamation';
    icon.setAttribute('aria-hidden', 'true');
    const text = doc.createElement('span');
    const damage = current.kind === 'pdf' ? UI.damageNote(current) : '';
    text.textContent = damage ? `${outcome.text} ${damage}` : outcome.text;
    els.status.append(icon, text);
    els.orig.textContent = sized(original);
    els.comp.textContent = sized(bytes.length);
    els.reduction.textContent = kept ? 'None' : original > bytes.length ? `${Math.round((1 - bytes.length / original) * 100)}%` : 'None';
    els.pages.textContent = String(pageCount);
    els.dpiStat.textContent = kept ? 'Unchanged' : `${minDpi} DPI${minDpi < Number(els.dpi.value) ? ' (lowered to fit)' : ''}`;
    els.note.textContent = kept ? '' : `Every page is now an image, so its text cannot be selected or searched. Zoom in on the download to check that numbers, dates and stamps are easy to read.`;
    els.result.classList.remove('hidden');
    if (window.ApplyReadyUI && window.ApplyReadyUI.reveal) window.ApplyReadyUI.reveal(els.result, els.download);
    Kit.announce(text.textContent);
    els.download.focus({ preventScroll: true });
  }

  els.start.addEventListener('click', () => {
    if (!current || !validateTarget()) return;
    // Some portals count 1 KB as 1,000 bytes and others as 1,024: aim under the smaller figure, so a
    // "500 KB" result is accepted either way (ApplyReadyFiles.maxBytes, the rule every tool uses).
    const kb = targetKB();
    const target = window.ApplyReadyFiles.maxBytes(kb);
    const state = current;
    const dpi = Number(els.dpi.value);
    const grey = els.grey.checked;
    runner.run(async (signal, progress) => {
      const original = state.file.size;
      if (state.kind === 'pdf' && original <= target) {
        progress(1, 'Already under the limit.');
        return show({ bytes: state.bytes, kept: 'fits', fits: true, pageCount: state.pageCount, target, original, kb });
      }
      let res;
      if (state.kind === 'image') {
        progress(0.2, 'Compressing the photo…');
        res = await K.compressImage(state.file, { targetBytes: target, dpi, grey, signal });
      } else {
        res = await K.compressRendered(state.jsDoc, {
          targetBytes: target, dpi, grey, signal,
          onProgress: (d, n, pass) => progress((d / n) * 0.9, `${pass ? 'Trying smaller: ' : ''}Compressing page ${d} of ${n}…`)
        });
      }
      K.throwIfAborted(signal);
      progress(0.95, 'Checking the compressed file…');
      const sizes = res.sizes ? res.sizes.map(s => ({ width: s.view[2] - s.view[0], height: s.view[3] - s.view[1] })) : null;
      await K.verify(res.bytes, { pages: state.pageCount, sizes });
      if (state.kind === 'pdf' && res.bytes.length >= original) {
        return show({ bytes: state.bytes, kept: 'larger', fits: original <= target, pageCount: state.pageCount, target, original, kb });
      }
      return show({ bytes: res.bytes, kept: null, fits: res.fits, pageCount: res.pageCount, minDpi: res.minDpi, target, original, kb });
    });
  });

  Kit.guardUnload(() => runner.busy);
})();
