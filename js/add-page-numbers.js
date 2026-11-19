/* Add page numbers: the interface. The preview is the first numbered page, made by the same
   function as the download (ApplyReadyPdf.addPageNumbers) and drawn by pdf.js. The download is
   made from a fresh copy of the file, reopened and counted. Nothing leaves the browser. */
(function () {
  'use strict';
  const doc = document;
  const app = doc.getElementById('pnApp');
  if (!app) return;
  const K = window.ApplyReadyPdf, UI = window.ApplyReadyPdfUI, Files = window.ApplyReadyFiles, Kit = window.ApplyReadyFileKit;
  const $ = id => doc.getElementById(id);
  const els = {
    position: $('pnPosition'), format: $('pnFormat'), start: $('pnStart'), startError: $('pnStartError'), skip: $('pnSkipFirst'),
    size: $('pnSize'), margin: $('pnMargin'), color: $('pnColor'),
    previewBox: $('pnPreviewBox'), preview: $('pnPreview'), caption: $('pnPreviewCaption'),
    run: $('pnRun'), summary: $('pnSummary'),
    result: $('pnResult'), resultText: $('pnResultText'), download: $('pnDownload'),
    statPages: $('pnStatPages'), statNumbered: $('pnStatNumbered'), statSize: $('pnStatSize')
  };
  const urls = UI.urls();
  let position = 'bottom-center';
  let previewUrl = null, previewTicket = 0, previewTimer = null, output = null;

  const tool = UI.singleTool(app, {
    needs: { lib: true, js: true },
    onOpen() { dropOutput(); update(); schedulePreview(0); },
    onClear() { dropOutput(); clearPreview(); update(); },
    onStale: dropOutput
  });
  const runner = UI.runner($('pnProgress'), { error: tool.error, button: els.run, busyLabel: 'Adding numbers…' });

  function dropOutput() { if (output) { urls.revoke(output); output = null; } els.result.classList.add('hidden'); }
  function clearPreview() { previewTicket++; if (previewUrl) URL.revokeObjectURL(previewUrl); previewUrl = null; els.preview.removeAttribute('src'); els.previewBox.classList.add('hidden'); }

  function options() {
    const start = Number(els.start.value);
    return { position, format: els.format.value, start, skipFirst: els.skip.checked, size: Number(els.size.value), margin: Number(els.margin.value), color: els.color.value };
  }

  function validStart() {
    const v = els.start.value.trim();
    const n = Number(v);
    const bad = !v || !Number.isInteger(n) || n < 0 || n > 99999;
    els.startError.textContent = bad ? 'Type a whole number from 0 to 99999.' : '';
    els.startError.hidden = !bad;
    if (bad) { els.start.setAttribute('aria-invalid', 'true'); els.start.setAttribute('aria-describedby', 'pnStartError pnStartHint'); }
    else { els.start.removeAttribute('aria-invalid'); els.start.setAttribute('aria-describedby', 'pnStartHint'); }
    return !bad;
  }

  function update() {
    const state = tool.state;
    const ok = validStart();
    if (!state) { els.run.disabled = true; els.summary.textContent = ''; return; }
    const numbered = els.skip.checked ? state.pageCount - 1 : state.pageCount;
    els.run.disabled = !ok || numbered < 1;
    els.summary.classList.toggle('is-invalid', !ok || numbered < 1);
    if (!ok) els.summary.textContent = 'Fix the first number.';
    else if (numbered < 1) els.summary.textContent = 'This PDF has one page, and it is set as the cover, so nothing would be numbered.';
    else {
      const o = options();
      const first = K.pageNumberLabel(els.skip.checked ? 1 : 0, state.pageCount, o);
      const last = K.pageNumberLabel(state.pageCount - 1, state.pageCount, o);
      els.summary.textContent = `Numbers ${UI.plural(numbered, 'page')}, from "${first}" to "${last}".`;
    }
  }

  function changed() { tool.hideResult(); update(); schedulePreview(); }

  function schedulePreview(delay) {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(renderPreview, delay === undefined ? 250 : delay);
  }

  async function renderPreview() {
    const state = tool.state;
    if (!state || !validStart() || !state.jsDoc) return;
    const ticket = ++previewTicket;
    const o = options();
    const k = o.skipFirst && state.pageCount > 1 ? 1 : 0;
    let js = null;
    try {
      const one = await K.extract(state.libDoc, [k]);
      if (!(o.skipFirst && state.pageCount === 1)) await K.addPageNumbers(one, Object.assign({}, o, { indexOffset: k, countOverride: state.pageCount }));
      const bytes = await K.save(one);
      if (ticket !== previewTicket) return;
      js = await K.openJs(bytes);
      const t = await K.thumbnail(js, 0, { width: 440 });
      if (ticket !== previewTicket) { URL.revokeObjectURL(t.url); return; }
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      previewUrl = t.url;
      els.preview.src = t.url;
      els.preview.width = t.width; els.preview.height = t.height;
      const label = K.pageNumberLabel(k, state.pageCount, o);
      els.preview.alt = label ? `Page ${k + 1} with the number "${label}" at the ${o.position.replace('-', ' ').replace('center', 'centre')}` : `Page ${k + 1}, without a number`;
      els.caption.textContent = label ? `Preview of page ${k + 1}, showing "${label}".` : 'Preview of page 1. It is the cover, so it has no number.';
      els.previewBox.classList.remove('hidden');
    } catch (e) {
      if (ticket === previewTicket) { els.previewBox.classList.add('hidden'); }
    } finally { K.closeJs(js); }
  }

  els.position.addEventListener('click', e => {
    const b = e.target.closest('.pos-grid__btn');
    if (!b) return;
    position = b.dataset.value;
    els.position.querySelectorAll('.pos-grid__btn').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    changed();
  });
  [els.format, els.size, els.margin, els.color, els.skip].forEach(el => el.addEventListener('change', changed));
  els.start.addEventListener('input', changed);

  els.run.addEventListener('click', () => {
    const state = tool.state;
    if (!state || !validStart()) return;
    const o = options();
    runner.run(async (signal, progress) => {
      progress(0.05, 'Opening a fresh copy…');
      const fresh = await K.openLib(state.bytes, { password: state.encrypted ? state.password : undefined, name: state.file.name });
      await K.addPageNumbers(fresh, o, (d, n) => progress(0.1 + d / n * 0.6, `Numbering page ${d} of ${n}…`), signal);
      progress(0.75, 'Saving…');
      const bytes = await K.save(fresh);
      progress(0.9, 'Checking the new file…');
      await K.verify(bytes, { pages: state.pageCount });
      K.throwIfAborted(signal);
      dropOutput();
      output = urls.make(UI.pdfBlob(bytes));
      UI.setDownload(els.download, output, `${UI.stem(state.file.name)}-numbered.pdf`);
      const numbered = o.skipFirst ? state.pageCount - 1 : state.pageCount;
      els.statPages.textContent = String(state.pageCount);
      els.statNumbered.textContent = String(numbered);
      els.statSize.textContent = Files.formatBytes(bytes.length);
      els.resultText.textContent = `${UI.plural(numbered, 'page')} numbered${o.skipFirst ? ', the cover left blank' : ''}. The file was checked after saving.${UI.damageNote(state) ? ` ${UI.damageNote(state)}` : ''}`;
      tool.showResult(els.download);
      Kit.announce(`Page numbers added to ${UI.plural(numbered, 'page')}.`);
      els.download.focus({ preventScroll: true });
      return true;
    });
  });

  Kit.guardUnload(() => runner.busy);
  update();
})();
