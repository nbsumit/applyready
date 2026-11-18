/* PDF to images: the interface. Pages are drawn by pdf.js at the chosen resolution, saved as JPG
   or PNG, decoded again to check their size, and offered one by one or as a ZIP. Nothing leaves
   the browser. */
(function () {
  'use strict';
  const doc = document;
  const app = doc.getElementById('imgApp');
  if (!app) return;
  const K = window.ApplyReadyPdf, UI = window.ApplyReadyPdfUI, Files = window.ApplyReadyFiles, Kit = window.ApplyReadyFileKit;
  const $ = id => doc.getElementById(id);
  const els = {
    pages: $('imgPages'), grid: $('imgGrid'), note: $('imgGridNote'),
    ranges: $('imgRanges'), rangesError: $('imgRangesError'), format: $('imgFormat'), dpi: $('imgDpi'), estimate: $('imgEstimate'),
    run: $('imgRun'), summary: $('imgSummary'),
    result: $('imgResult'), resultTitle: $('imgResultTitle'), resultText: $('imgResultText'), outputs: $('imgOutputs'), zip: $('imgZip'),
    statCount: $('imgStatCount'), statDims: $('imgStatDims'), statSize: $('imgStatSize')
  };
  // Rough bytes per pixel for document pages, to estimate sizes before drawing anything.
  const BYTES_PER_PX = { jpg: 0.22, png: 0.75 };
  const MAX_OUTPUT_BYTES = 1024 * 1024 * 1024;
  const urls = UI.urls();
  let grid = null, outputs = [], selected = new Set(), firstSize = null, format = 'jpg';

  const tool = UI.singleTool(app, {
    needs: { lib: false, js: true },
    maxPages: 5000,
    async onOpen(state) {
      clearOutputs();
      selected = new Set();
      els.ranges.value = '';
      if (grid) grid.destroy();
      firstSize = await K.jsPageSize(state.jsDoc, 0);
      grid = UI.pageGrid(els.grid, { count: state.pageCount, jsDoc: state.jsDoc, selectable: true, note: els.note, onToggle });
      els.pages.classList.remove('hidden');
      update();
    },
    onClear() { if (grid) grid.destroy(); grid = null; clearOutputs(); els.pages.classList.add('hidden'); els.ranges.value = ''; selected = new Set(); firstSize = null; update(); },
    onStale: clearOutputs
  });
  const runner = UI.runner($('imgProgress'), { error: tool.error, button: els.run, busyLabel: 'Converting…' });

  function clearOutputs() { urls.revokeAll(); outputs = []; els.outputs.textContent = ''; els.result.classList.add('hidden'); }

  function onToggle(i, on) {
    if (on) selected.add(i); else selected.delete(i);
    els.ranges.value = selected.size ? K.formatRanges(Array.from(selected)) : '';
    tool.hideResult();
    update();
  }

  function setFieldError(message) {
    els.rangesError.textContent = message || '';
    els.rangesError.hidden = !message;
    if (message) { els.ranges.setAttribute('aria-invalid', 'true'); els.ranges.setAttribute('aria-describedby', 'imgRangesError imgRangesHint'); }
    else { els.ranges.removeAttribute('aria-invalid'); els.ranges.setAttribute('aria-describedby', 'imgRangesHint'); }
  }

  /** Pages to convert (0-based, sorted, unique), or { error }. */
  function pageList() {
    const state = tool.state;
    if (!state) return { error: '' };
    const text = els.ranges.value.trim();
    if (!text) return { pages: Array.from({ length: state.pageCount }, (_, i) => i) };
    const parsed = K.parseRanges(text, state.pageCount);
    if (!parsed.ok) return { error: parsed.error };
    return { pages: Array.from(new Set(parsed.pages)).sort((a, b) => a - b) };
  }

  function update(showErrors) {
    const state = tool.state;
    if (!state || !firstSize) { els.estimate.textContent = ''; els.summary.textContent = ''; els.run.disabled = true; return null; }
    const list = pageList();
    setFieldError(list.error && (showErrors || els.ranges.value.trim()) ? list.error : '');
    if (grid) grid.setSelected(list.pages && els.ranges.value.trim() ? new Set(list.pages) : new Set());
    const dpi = Number(els.dpi.value);
    let w = Math.round(firstSize.width / 72 * dpi), h = Math.round(firstSize.height / 72 * dpi);
    let capped = false;
    if (w * h > K.LIMITS.canvasPixels) { const s = Math.sqrt(K.LIMITS.canvasPixels / (w * h)); w = Math.floor(w * s); h = Math.floor(h * s); capped = true; }
    if (list.error) { els.run.disabled = true; els.summary.textContent = 'Fix the page list first.'; els.estimate.textContent = ''; return null; }
    const n = list.pages.length;
    const est = n * w * h * BYTES_PER_PX[format];
    els.estimate.textContent = `Page 1 becomes ${w} × ${h} pixels${capped ? ' (lowered to stay within what browsers can draw)' : ''}. ${UI.plural(n, 'image')}, roughly ${Files.formatBytes(est)} in all.`;
    if (n > K.LIMITS.renderPages) { els.run.disabled = true; els.summary.textContent = `That is ${n} pages; up to ${K.LIMITS.renderPages} can be converted at a time. Type a smaller range.`; els.summary.classList.add('is-invalid'); return null; }
    if (est > MAX_OUTPUT_BYTES) { els.run.disabled = true; els.summary.textContent = 'These images would take more memory than a browser tab can safely hold. Choose fewer pages or a lower resolution.'; els.summary.classList.add('is-invalid'); return null; }
    els.summary.classList.remove('is-invalid');
    els.run.disabled = false;
    els.summary.textContent = `Converts ${UI.plural(n, 'page')} to ${format.toUpperCase()} at ${dpi} DPI.`;
    return { pages: list.pages, dpi };
  }

  els.ranges.addEventListener('input', () => { tool.hideResult(); update(); });
  els.ranges.addEventListener('blur', () => update(true));
  els.dpi.addEventListener('change', () => { tool.hideResult(); update(); });
  els.format.addEventListener('click', e => {
    const b = e.target.closest('button[data-value]');
    if (!b) return;
    format = b.dataset.value;
    els.format.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    tool.hideResult();
    update();
  });

  function renderOutputs() {
    els.outputs.textContent = '';
    outputs.forEach(o => {
      const li = doc.createElement('li');
      li.className = 'file-row pdf-output';
      li.innerHTML = '<span class="file-row__thumb" aria-hidden="true"><i class="fa-solid fa-image"></i></span><span class="file-row__text"><span class="file-row__name"></span><span class="file-row__meta"></span></span>';
      li.querySelector('.file-row__name').textContent = o.name;
      li.querySelector('.file-row__meta').textContent = `${o.width} × ${o.height} px · ${Files.formatBytes(o.size)}${o.capped ? ' · resolution lowered' : ''}`;
      const a = doc.createElement('a');
      a.className = 'btn btn-sm';
      a.innerHTML = '<i class="fa-solid fa-download" aria-hidden="true"></i> Download';
      a.setAttribute('aria-label', `Download ${o.name}`);
      a.href = o.url;
      a.setAttribute('download', o.name);
      li.appendChild(a);
      els.outputs.appendChild(li);
    });
  }

  async function checkImage(blob, w, h) {
    if (typeof createImageBitmap !== 'function') return;
    let bmp;
    try { bmp = await createImageBitmap(blob); }
    catch (e) { throw new K.PdfError('verify', 'A finished image could not be opened again, so the images were not offered. Try a lower resolution.'); }
    const okSize = bmp.width === w && bmp.height === h;
    if (bmp.close) bmp.close();
    if (!okSize) throw new K.PdfError('verify', 'A finished image came out at the wrong size, so the images were not offered. Try again.');
  }

  els.run.addEventListener('click', () => {
    const plan = update(true);
    if (!plan) return;
    const state = tool.state;
    const ext = format;
    const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
    clearOutputs();
    runner.run(async (signal, progress) => {
      const made = [];
      const base = UI.stem(state.file.name);
      for (let k = 0; k < plan.pages.length; k++) {
        K.throwIfAborted(signal);
        const i = plan.pages[k];
        progress(k / plan.pages.length, `Drawing page ${i + 1} (${k + 1} of ${plan.pages.length})…`);
        const r = await K.renderPage(state.jsDoc, i, { scale: plan.dpi / 72, signal });
        let blob;
        try { blob = await K.canvasBlob(r.canvas, mime, ext === 'png' ? undefined : 0.92); }
        finally { K.releaseCanvas(r.canvas); }
        await checkImage(blob, r.width, r.height);
        made.push({ name: `${base}-page-${K.pad(i + 1, state.pageCount)}.${ext}`, blob, size: blob.size, width: r.width, height: r.height, capped: r.capped });
      }
      K.throwIfAborted(signal);
      outputs = made.map(m => Object.assign(m, { url: urls.make(m.blob) }));
      renderOutputs();
      const total = outputs.reduce((s, o) => s + o.size, 0);
      const dims = new Set(outputs.map(o => `${o.width} × ${o.height} px`));
      els.statCount.textContent = String(outputs.length);
      els.statDims.textContent = dims.size === 1 ? [...dims][0] : 'Varies by page';
      els.statSize.textContent = Files.formatBytes(total);
      els.resultTitle.textContent = outputs.length === 1 ? 'Your image is ready' : `${outputs.length} images are ready`;
      const lowered = outputs.filter(o => o.capped).length;
      els.resultText.textContent = `${ext.toUpperCase()} at ${plan.dpi} DPI, each opened again to check its size.${lowered ? ` ${UI.plural(lowered, 'large page')} ${lowered === 1 ? 'was' : 'were'} drawn at a lower resolution to stay within what browsers can draw.` : ''}`;
      els.zip.innerHTML = outputs.length === 1 ? '<i class="fa-solid fa-download" aria-hidden="true"></i> Download image' : '<i class="fa-solid fa-file-zipper" aria-hidden="true"></i> Download all as ZIP';
      tool.showResult();
      Kit.announce(`${UI.plural(outputs.length, 'image')} ready to download.`);
      els.zip.focus({ preventScroll: true });
      return true;
    });
  });

  els.zip.addEventListener('click', () => {
    if (!outputs.length) return;
    if (outputs.length === 1) { Files.download(outputs[0].blob, outputs[0].name); return; }
    Kit.downloadZip(outputs.map(o => ({ name: o.name, data: o.blob })), `${UI.stem(tool.state ? tool.state.file.name : 'pages')}-images.zip`, { button: els.zip });
  });

  Kit.guardUnload(() => runner.busy);
})();
