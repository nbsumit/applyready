/* Split PDF: the interface. One PDF in; one or many PDFs out, each copied page for page with
   ApplyReadyPdf.extract, reopened and counted before it is offered. Nothing leaves the browser. */
(function () {
  'use strict';
  const doc = document;
  const app = doc.getElementById('splitApp');
  if (!app) return;
  const K = window.ApplyReadyPdf, UI = window.ApplyReadyPdfUI, Files = window.ApplyReadyFiles, Kit = window.ApplyReadyFileKit;
  const $ = id => doc.getElementById(id);
  const els = {
    pages: $('splitPages'), grid: $('splitGrid'), note: $('splitGridNote'),
    mode: $('splitMode'), ranges: $('splitRanges'), rangesField: $('splitRangesField'), rangesError: $('splitRangesError'),
    chunk: $('splitChunk'), chunkField: $('splitChunkField'), chunkError: $('splitChunkError'),
    run: $('splitRun'), summary: $('splitSummary'),
    result: $('splitResult'), resultTitle: $('splitResultTitle'), resultText: $('splitResultText'), outputs: $('splitOutputs'), zip: $('splitZip'),
    statFiles: $('splitStatFiles'), statPages: $('splitStatPages'), statSize: $('splitStatSize')
  };
  const urls = UI.urls();
  let mode = 'extract';
  let grid = null;
  let outputs = [];
  let selected = new Set();

  const tool = UI.singleTool(app, {
    needs: { lib: true, js: true },
    tooManyPages: n => `This PDF has ${K.grouped(n)} pages. Split works on up to ${K.grouped(K.LIMITS.pages)} pages at a time in a browser, so it cannot open a file this long; use a desktop PDF program for it.`,
    onOpen(state) {
      selected = new Set();
      els.ranges.value = '';
      clearOutputs();
      if (grid) grid.destroy();
      grid = UI.pageGrid(els.grid, { count: state.pageCount, jsDoc: state.jsDoc, selectable: true, note: els.note, onToggle });
      els.pages.classList.remove('hidden');
      validate();
    },
    onClear() { if (grid) grid.destroy(); grid = null; clearOutputs(); els.pages.classList.add('hidden'); els.ranges.value = ''; selected = new Set(); validate(); },
    onStale: clearOutputs
  });
  const runner = UI.runner($('splitProgress'), { error: tool.error, button: els.run, busyLabel: 'Splitting…' });

  function clearOutputs() {
    urls.revokeAll();
    outputs = [];
    els.outputs.textContent = '';
    els.result.classList.add('hidden');
  }

  function onToggle(i, on) {
    if (mode !== 'extract' && mode !== 'ranges') setMode('extract');
    if (on) selected.add(i); else selected.delete(i);
    els.ranges.value = K.formatRanges(Array.from(selected));
    tool.hideResult();
    validate();
  }

  function setMode(next) {
    mode = next;
    els.mode.querySelectorAll('.choice').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.value === mode)));
    els.rangesField.classList.toggle('hidden', !(mode === 'extract' || mode === 'ranges'));
    els.chunkField.classList.toggle('hidden', mode !== 'chunks');
    tool.hideResult();
    validate();
  }
  els.mode.addEventListener('click', e => { const b = e.target.closest('.choice'); if (b) setMode(b.dataset.value); });

  function fieldError(input, box, message) {
    box.textContent = message || '';
    box.hidden = !message;
    if (message) { input.setAttribute('aria-invalid', 'true'); input.setAttribute('aria-describedby', `${box.id} ${input.id}Hint`); }
    else { input.removeAttribute('aria-invalid'); input.setAttribute('aria-describedby', `${input.id}Hint`); }
  }

  /** The files this split will make: [{ name, indexes }] or { error }. */
  function plan(showErrors) {
    const state = tool.state;
    if (!state) return { error: 'Add a PDF first.' };
    const n = state.pageCount;
    const base = UI.stem(state.file.name);
    const pad = i => K.pad(i, n);
    fieldError(els.ranges, els.rangesError, '');
    fieldError(els.chunk, els.chunkError, '');
    if (mode === 'every') {
      return { files: Array.from({ length: n }, (_, i) => ({ name: `${base}-page-${pad(i + 1)}.pdf`, indexes: [i] })) };
    }
    if (mode === 'chunks') {
      const size = Number(els.chunk.value);
      if (!Number.isInteger(size) || size < 1) { if (showErrors) fieldError(els.chunk, els.chunkError, 'Type a whole number of pages, 1 or more.'); return { error: 'Type how many pages go in each file.' }; }
      if (size >= n) { if (showErrors) fieldError(els.chunk, els.chunkError, `This PDF has ${UI.plural(n, 'page')}, so parts of ${size} would give one file. Choose a smaller number.`); return { error: 'Choose a smaller number of pages per file.' }; }
      const files = [];
      for (let s = 0, part = 1; s < n; s += size, part++) {
        const idx = []; for (let i = s; i < Math.min(n, s + size); i++) idx.push(i);
        files.push({ name: `${base}-part-${K.pad(part, Math.ceil(n / size))}.pdf`, indexes: idx });
      }
      return { files };
    }
    const parsed = K.parseRanges(els.ranges.value, n);
    if (!parsed.ok) {
      if (showErrors || els.ranges.value.trim()) fieldError(els.ranges, els.rangesError, parsed.error);
      return { error: els.ranges.value.trim() ? 'Fix the page list first.' : 'Select pages or type them, for example 1-3, 5.' };
    }
    if (mode === 'extract') {
      const label = parsed.ranges.map(([a, b]) => (a === b ? `${a}` : `${a}-${b}`)).join('_');
      // Pages typed more than once (for example 1-3, 2-4) are included each time, in the order typed;
      // say so, since the thumbnails can only show a page as selected once.
      const seen = new Set(), repeated = new Set();
      parsed.pages.forEach(i => { if (seen.has(i)) repeated.add(i); seen.add(i); });
      return { files: [{ name: `${base}-pages-${label.length > 40 ? 'selected' : label}.pdf`, indexes: parsed.pages }], repeated: Array.from(repeated) };
    }
    return { files: parsed.ranges.map(([a, b]) => ({ name: a === b ? `${base}-page-${pad(a)}.pdf` : `${base}-pages-${a}-${b}.pdf`, indexes: Array.from({ length: b - a + 1 }, (_, i) => a - 1 + i) })) };
  }

  function repeatNote(repeated) {
    if (!repeated || !repeated.length) return '';
    const one = repeated.length === 1;
    return ` ${one ? 'Page' : 'Pages'} ${K.formatRanges(repeated)} ${one ? 'is' : 'are'} in the list more than once, so ${one ? 'it appears' : 'they appear'} more than once in the file.`;
  }

  function validate(showErrors) {
    const p = plan(showErrors);
    els.summary.classList.remove('is-invalid');
    if (p.error) { els.run.disabled = !tool.state; els.summary.textContent = tool.state ? p.error : ''; els.summary.classList.toggle('is-pending', !!tool.state); return p; }
    els.summary.classList.remove('is-pending');
    const pages = p.files.reduce((s, f) => s + f.indexes.length, 0);
    const tooMany = p.files.length > K.LIMITS.outputs;
    els.run.disabled = tooMany;
    els.summary.classList.toggle('is-invalid', tooMany);
    els.summary.textContent = tooMany
      ? `That would make ${K.grouped(p.files.length)} files; the limit is ${K.grouped(K.LIMITS.outputs)}. Choose larger parts.`
      : p.files.length === 1 ? `Creates 1 PDF with ${UI.plural(pages, 'page')}.${repeatNote(p.repeated)}` : `Creates ${p.files.length} PDFs, ${UI.plural(pages, 'page')} in all.`;
    // Selected thumbnails follow the typed list.
    if (grid && (mode === 'extract' || mode === 'ranges')) { selected = new Set(p.files.flatMap(f => f.indexes)); grid.setSelected(selected); }
    else if (grid) grid.setSelected(new Set());
    return p;
  }
  els.ranges.addEventListener('input', () => { tool.hideResult(); validate(); });
  els.ranges.addEventListener('blur', () => validate(true));
  els.chunk.addEventListener('input', () => { tool.hideResult(); validate(true); });

  function renderOutputs() {
    els.outputs.textContent = '';
    outputs.forEach(o => {
      const li = doc.createElement('li');
      li.className = 'file-row pdf-output';
      li.innerHTML = '<span class="file-row__thumb" aria-hidden="true"><i class="fa-solid fa-file-pdf"></i></span><span class="file-row__text"><span class="file-row__name"></span><span class="file-row__meta"></span></span>';
      li.querySelector('.file-row__name').textContent = o.name;
      li.querySelector('.file-row__meta').textContent = `${UI.plural(o.pages, 'page')} · ${Files.formatBytes(o.size)}`;
      const a = doc.createElement('a');
      a.className = 'btn btn-sm';
      a.innerHTML = '<i class="fa-solid fa-download" aria-hidden="true"></i> Download';
      a.setAttribute('aria-label', `Download ${o.name}`);
      UI.setDownload(a, o.url, o.name);
      li.appendChild(a);
      els.outputs.appendChild(li);
    });
  }

  els.run.addEventListener('click', () => {
    const p = validate(true);
    if (p.error) { tool.error.show(p.error); return; }
    if (p.files.length > K.LIMITS.outputs) { tool.error.show(`That would make ${K.grouped(p.files.length)} files. The limit is ${K.grouped(K.LIMITS.outputs)} at a time; choose larger parts or fewer pages.`); return; }
    const state = tool.state;
    clearOutputs();
    runner.run(async (signal, progress) => {
      const made = [];
      for (let i = 0; i < p.files.length; i++) {
        K.throwIfAborted(signal);
        const f = p.files[i];
        progress(i / p.files.length, `Making file ${i + 1} of ${p.files.length}…`);
        const part = await K.extract(state.libDoc, f.indexes);
        const bytes = await K.save(part);
        await K.verify(bytes, { pages: f.indexes.length });
        made.push({ name: f.name, pages: f.indexes.length, size: bytes.length, blob: UI.pdfBlob(bytes) });
        await K.tick();
      }
      K.throwIfAborted(signal);
      outputs = made.map(m => Object.assign(m, { url: urls.make(m.blob) }));
      renderOutputs();
      const total = outputs.reduce((s, o) => s + o.size, 0);
      els.statFiles.textContent = String(outputs.length);
      els.statPages.textContent = String(outputs.reduce((s, o) => s + o.pages, 0));
      els.statSize.textContent = Files.formatBytes(total);
      els.resultTitle.textContent = outputs.length === 1 ? 'Your PDF is ready' : `${outputs.length} PDFs are ready`;
      const damage = UI.damageNote(state, p.files.flatMap(f => f.indexes));
      els.resultText.textContent = `Each file was opened again and its pages counted after saving.${damage ? ` ${damage}` : ''}`;
      els.zip.classList.toggle('hidden', outputs.length < 2);
      const first = outputs.length > 1 ? els.zip : els.outputs.querySelector('a');
      tool.showResult(first);
      Kit.announce(`${UI.plural(outputs.length, 'file')} ready to download.`);
      if (first) first.focus({ preventScroll: true });
      return true;
    });
  });

  els.zip.addEventListener('click', () => {
    if (!outputs.length) return;
    Kit.downloadZip(outputs.map(o => ({ name: o.name, data: o.blob })), `${UI.stem(tool.state ? tool.state.file.name : 'split')}-split.zip`, { button: els.zip });
  });

  Kit.guardUnload(() => runner.busy);
  setMode('extract');
})();
