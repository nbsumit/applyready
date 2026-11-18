/* Merge PDF: the interface. Files are checked by their content, PDFs opened (with a password when
   needed) to count pages, shown in order with a first-page thumbnail, then joined by
   ApplyReadyPdf.merge, verified and offered for download. Nothing leaves the browser. */
(function () {
  'use strict';
  const doc = document;
  const app = doc.getElementById('mergeApp');
  if (!app) return;
  const K = window.ApplyReadyPdf, UI = window.ApplyReadyPdfUI, Files = window.ApplyReadyFiles, Kit = window.ApplyReadyFileKit;
  const $ = id => doc.getElementById(id);

  const els = {
    bar: $('mergeBar'), counts: $('mergeCounts'), add: $('mergeAdd'), clear: $('mergeClear'),
    pages: $('mergePages'), list: $('mergeList'), status: $('mergeOrderStatus'),
    name: $('mergeName'), run: $('mergeRun'), summary: $('mergeSummary'),
    result: $('mergeResult'), resultText: $('mergeResultText'), download: $('mergeDownload'),
    statPages: $('mergeStatPages'), statFiles: $('mergeStatFiles'), statSize: $('mergeStatSize')
  };
  const error = UI.errorBox($('mergeError'));
  const urls = UI.urls();
  let items = []; // { id, file, kind: 'pdf'|'image', info, pages, password, thumb, size, paper }
  let seq = 0;
  let output = null;
  let adding = Promise.resolve();

  const sup = K.support();
  if (!sup.ok) {
    error.show(`This browser cannot merge PDFs (it lacks ${sup.missing.join(', ')}). Update it, or use a recent Chrome, Edge, Firefox or Safari.`);
    app.querySelectorAll('[data-browse]').forEach(b => { b.disabled = true; });
    return;
  }

  const runner = UI.runner($('mergeProgress'), { error, button: els.run, busyLabel: 'Merging…', onState: busy => { [els.add, els.clear].forEach(b => { b.disabled = busy; }); } });

  const totalBytes = () => items.reduce((s, it) => s + it.size, 0);
  const totalPages = () => items.reduce((s, it) => s + (it.pages || 0), 0);

  function invalidate() {
    if (!els.result.classList.contains('hidden')) els.result.classList.add('hidden');
    if (output) { urls.revoke(output.url); output = null; }
  }

  function updateCounts() {
    const has = items.length > 0;
    els.bar.classList.toggle('hidden', !has);
    els.pages.classList.toggle('hidden', !has);
    els.counts.innerHTML = '';
    if (has) {
      const strong = doc.createElement('strong');
      strong.textContent = UI.plural(items.length, 'file');
      els.counts.append(strong, ` · ${UI.plural(totalPages(), 'page')} · ${Files.formatBytes(totalBytes())}`);
    }
    const ready = items.length >= 2;
    els.run.disabled = !ready;
    els.summary.textContent = !has ? '' : ready ? `${UI.plural(totalPages(), 'page')} from ${UI.plural(items.length, 'file')} will be joined in the order shown.` : 'Add at least one more file to merge.';
  }

  function render(focus) {
    els.list.textContent = '';
    items.forEach((it, i) => {
      const li = doc.createElement('li');
      li.className = 'file-row merge-row';
      li.dataset.id = String(it.id);

      const handle = doc.createElement('button');
      handle.type = 'button';
      handle.className = 'btn btn-ghost btn-icon btn-sm merge-row__handle';
      handle.setAttribute('aria-label', `Move ${it.file.name}, position ${i + 1} of ${items.length}. Drag, or use the arrow keys.`);
      handle.innerHTML = '<i class="fa-solid fa-grip-vertical" aria-hidden="true"></i>';

      const thumb = doc.createElement('span');
      thumb.className = 'file-row__thumb';
      thumb.setAttribute('aria-hidden', 'true');
      if (it.thumb) { const img = doc.createElement('img'); img.src = it.thumb; img.alt = ''; thumb.appendChild(img); }
      else thumb.innerHTML = `<i class="fa-solid fa-${it.kind === 'image' ? 'image' : 'file-pdf'}"></i>`;

      const text = doc.createElement('span');
      text.className = 'file-row__text';
      const name = doc.createElement('span');
      name.className = 'file-row__name';
      name.textContent = `${i + 1}. ${it.file.name}`;
      const meta = doc.createElement('span');
      meta.className = 'file-row__meta';
      meta.textContent = it.kind === 'image'
        ? `Image, becomes 1 A4 page · ${Files.formatBytes(it.size)}`
        : `${UI.plural(it.pages, 'page')}${it.paper ? ' · ' + it.paper : ''} · ${Files.formatBytes(it.size)}${it.password !== undefined && it.encrypted ? ' · password given' : ''}`;
      text.append(name, meta);

      const actions = doc.createElement('span');
      actions.className = 'file-row__actions';
      const mk = (cls, iconName, label, disabled) => {
        const b = doc.createElement('button');
        b.type = 'button';
        b.className = `btn btn-ghost btn-icon btn-sm ${cls}`;
        b.setAttribute('aria-label', label);
        b.innerHTML = `<i class="fa-solid fa-${iconName}" aria-hidden="true"></i>`;
        b.disabled = !!disabled;
        return b;
      };
      actions.append(
        mk('merge-up', 'arrow-up', `Move ${it.file.name} up`, i === 0),
        mk('merge-down', 'arrow-down', `Move ${it.file.name} down`, i === items.length - 1),
        mk('merge-remove btn-danger-ghost', 'xmark', `Remove ${it.file.name}`)
      );
      li.append(handle, thumb, text, actions);
      els.list.appendChild(li);
    });
    updateCounts();
    if (focus) {
      const row = els.list.querySelector(`[data-id="${focus.id}"]`);
      const target = row && (row.querySelector(focus.sel + ':not(:disabled)') || row.querySelector('.merge-row__handle'));
      if (target) target.focus();
    }
  }

  function move(from, to, how) {
    if (to < 0 || to >= items.length || from === to) return;
    const [it] = items.splice(from, 1);
    items.splice(to, 0, it);
    invalidate();
    render({ id: it.id, sel: how === 'up' ? '.merge-up' : how === 'down' ? '.merge-down' : '.merge-row__handle' });
    els.status.textContent = `${it.file.name} moved to position ${to + 1} of ${items.length}.`;
  }

  els.list.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b || b.classList.contains('merge-row__handle')) return;
    const row = b.closest('.merge-row');
    const i = items.findIndex(it => String(it.id) === row.dataset.id);
    if (i < 0) return;
    if (b.classList.contains('merge-up')) move(i, i - 1, 'up');
    else if (b.classList.contains('merge-down')) move(i, i + 1, 'down');
    else if (b.classList.contains('merge-remove')) {
      const [it] = items.splice(i, 1);
      if (it.thumb) URL.revokeObjectURL(it.thumb);
      invalidate();
      const next = items[Math.min(i, items.length - 1)];
      render(next ? { id: next.id, sel: '.merge-remove' } : null);
      els.status.textContent = `${it.file.name} removed.`;
      if (!items.length) { const browse = app.querySelector('[data-browse]'); if (browse) browse.focus(); }
    }
  });
  UI.sortable(els.list, { item: '.merge-row', handle: '.merge-row__handle', onMove: (from, to) => move(from, to, 'handle') });

  async function firstPageThumb(bytes, password) {
    if (!K.support().render) return null;
    let js = null;
    try {
      js = await K.openJs(bytes, { password });
      const t = await K.thumbnail(js, 0, { width: 48 });
      return t.url;
    } catch (e) { return null; }
    finally { K.closeJs(js); }
  }

  async function addOne(file, info) {
    if (items.length >= K.LIMITS.maxFiles) throw new K.PdfError('toolarge', `Only ${K.LIMITS.maxFiles} files can be merged at a time. Merge these, then merge the result with the rest.`);
    if (totalBytes() + file.size > K.LIMITS.totalBytes) throw new K.PdfError('toolarge', `${file.name} would bring the total over ${Files.formatBytes(K.LIMITS.totalBytes)}. Merge these files first, then merge the result with the rest.`);
    if (info.kind === 'image') {
      const it = { id: ++seq, file, kind: 'image', info, pages: 1, size: file.size, thumb: await Kit.thumbnail(file, 96) };
      items.push(it);
      return it;
    }
    const opened = await UI.openPdf(file, { lib: true, js: false });
    const first = opened.libDoc.getPage(0);
    const facts = K.pageFacts(first);
    const it = { id: ++seq, file, kind: 'pdf', info, pages: opened.pageCount, size: file.size, password: opened.password, encrypted: opened.encrypted, paper: opened.pageCount === 1 ? K.paperName(facts.width, facts.height) : `starts ${K.paperName(facts.width, facts.height)}` };
    it.thumb = await firstPageThumb(opened.bytes, opened.password);
    items.push(it);
    return it;
  }

  // Files refused by the drop zone are reported together with problems found while opening the rest.
  let rejected = [];
  function addFiles(files, infos) {
    const earlier = rejected;
    rejected = [];
    if (!earlier.length) error.hide();
    invalidate();
    // One file at a time, in the order chosen: password dialogs never overlap and memory stays low.
    adding = adding.then(async () => {
      const problems = earlier.slice();
      let added = 0;
      for (let i = 0; i < files.length; i++) {
        try { await addOne(files[i], infos[i]); added++; render(); }
        catch (e) {
          problems.push(e && e.name === 'PdfError' ? e.message : `${files[i].name} could not be added. Check that it opens on your device.`);
          if (e && e.code === 'toolarge') break;
        }
      }
      render();
      if (problems.length) error.show(problems);
      if (added) Kit.announce(`${UI.plural(added, 'file')} added. ${UI.plural(items.length, 'file')} in the list.`);
    });
    return adding;
  }

  const dz = Kit.dropzone($('mergeDrop'), {
    accept: ['pdf', 'image'],
    multiple: true,
    maxFiles: K.LIMITS.maxFiles,
    limitBytes: K.LIMITS.fileBytes,
    onFiles: addFiles,
    onReject: messages => { rejected = messages; error.show(messages); setTimeout(() => { rejected = []; }, 0); }
  });
  els.add.addEventListener('click', () => dz.open());
  els.clear.addEventListener('click', async () => {
    if (window.ApplyReadyUI && window.ApplyReadyUI.confirm && !(await window.ApplyReadyUI.confirm({ title: 'Remove all files?', message: 'The list is cleared. Your files on this device are not touched.', confirmLabel: 'Remove all', danger: true }))) return;
    items.forEach(it => { if (it.thumb) URL.revokeObjectURL(it.thumb); });
    items = [];
    invalidate();
    error.hide();
    render();
    const browse = app.querySelector('[data-browse]'); if (browse) browse.focus();
  });
  els.name.addEventListener('input', invalidate);

  els.run.addEventListener('click', () => {
    if (items.length < 2) return;
    const order = items.slice();
    runner.run(async (signal, progress) => {
      const parts = [];
      for (let i = 0; i < order.length; i++) {
        K.throwIfAborted(signal);
        const it = order[i];
        progress(i / order.length * 0.6, `Reading ${it.file.name} (${i + 1} of ${order.length})…`);
        if (it.kind === 'image') parts.push({ image: await K.prepareImage(it.file, it.info) });
        else {
          const bytes = await K.readBytes(it.file);
          parts.push({ doc: await K.openLib(bytes, { password: it.encrypted ? it.password : undefined, name: it.file.name }) });
        }
        await K.tick();
      }
      const merged = await K.merge(parts, (d, t) => progress(0.6 + d / t * 0.3, `Joining pages… ${d} of ${t} files`), signal);
      progress(0.92, 'Saving…');
      const bytes = await K.save(merged);
      progress(0.96, 'Checking the merged file…');
      const expected = order.reduce((s, it) => s + it.pages, 0);
      await K.verify(bytes, { pages: expected });
      K.throwIfAborted(signal);
      const name = `${(els.name.value || 'merged').trim().replace(/\.pdf$/i, '') || 'merged'}.pdf`;
      const url = urls.make(UI.pdfBlob(bytes));
      output = { url, name };
      UI.setDownload(els.download, url, name);
      els.statPages.textContent = String(expected);
      els.statFiles.textContent = String(order.length);
      els.statSize.textContent = Files.formatBytes(bytes.length);
      els.resultText.textContent = `${UI.plural(expected, 'page')} in the order shown, checked after saving.`;
      els.result.classList.remove('hidden');
      if (window.ApplyReadyUI && window.ApplyReadyUI.reveal) window.ApplyReadyUI.reveal(els.result);
      Kit.announce(`Merged PDF ready: ${UI.plural(expected, 'page')}, ${Files.formatBytes(bytes.length)}.`);
      els.download.focus({ preventScroll: true });
      return true;
    });
  });

  Kit.guardUnload(() => runner.busy);
  render();
})();
