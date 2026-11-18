/* Organise PDF pages: the interface. Pages are tiles with thumbnails drawn as they scroll into
   view; moving, turning, deleting and inserting only change a list in memory. Save builds a new
   document with ApplyReadyPdf.assemble, reopens it and counts its pages. Nothing leaves the browser. */
(function () {
  'use strict';
  const doc = document;
  const app = doc.getElementById('orgApp');
  if (!app) return;
  const K = window.ApplyReadyPdf, UI = window.ApplyReadyPdfUI, Files = window.ApplyReadyFiles, Kit = window.ApplyReadyFileKit;
  const $ = id => doc.getElementById(id);
  const els = {
    pages: $('orgPages'), grid: $('orgGrid'), status: $('orgStatus'), changes: $('orgChanges'),
    insert: $('orgInsert'), insertInput: $('orgInsertInput'), rotL: $('orgRotateAllLeft'), rotR: $('orgRotateAllRight'), reset: $('orgReset'),
    name: $('orgName'), run: $('orgRun'), summary: $('orgSummary'),
    result: $('orgResult'), resultText: $('orgResultText'), download: $('orgDownload'),
    statPages: $('orgStatPages'), statChanges: $('orgStatChanges'), statSize: $('orgStatSize')
  };
  const MAX_PAGES = K.LIMITS.thumbPages;
  const urls = UI.urls();
  let sources = []; // { name, bytes, password, libDoc, jsDoc, count }
  let tiles = [];   // { key, src, index, turn, deleted }
  const nodes = new Map();
  const thumbs = new Map(); // key -> { url, width, height }
  let loader = null;
  let output = null;

  const tool = UI.singleTool(app, {
    needs: { lib: true, js: true },
    maxPages: MAX_PAGES,
    tooManyPages: n => `This PDF has ${n} pages. Organise works on up to ${MAX_PAGES} pages at a time; split it into parts first with Split PDF.`,
    onOpen(state) {
      reset(true);
      sources = [{ name: state.file.name, bytes: state.bytes, password: state.password, libDoc: state.libDoc, jsDoc: state.jsDoc, count: state.pageCount }];
      tiles = Array.from({ length: state.pageCount }, (_, i) => ({ key: `0:${i}`, src: 0, index: i, turn: 0, deleted: false }));
      els.name.value = `${UI.stem(state.file.name)}-organised`;
      els.pages.classList.remove('hidden');
      sync();
    },
    onClear() { reset(true); els.pages.classList.add('hidden'); sync(); },
    onStale: dropOutput
  });
  const runner = UI.runner($('orgProgress'), { error: tool.error, button: els.run, busyLabel: 'Saving…', onState: busy => { [els.insert, els.rotL, els.rotR, els.reset].forEach(b => { b.disabled = busy; }); } });

  function dropOutput() { if (output) { urls.revoke(output.url); output = null; } els.result.classList.add('hidden'); }

  function reset(all) {
    if (loader) loader.disconnect();
    loader = null;
    thumbs.forEach(t => URL.revokeObjectURL(t.url));
    thumbs.clear();
    nodes.clear();
    els.grid.textContent = '';
    // The first source belongs to singleTool, which closes it; inserted ones are closed here.
    sources.slice(1).forEach(s => K.closeJs(s.jsDoc));
    if (all) { sources = []; tiles = []; }
    dropOutput();
  }

  function changed(focus) { tool.hideResult(); dropOutput(); sync(focus); }

  const label = t => {
    const s = sources[t.src];
    return `Page ${t.index + 1}${t.src ? ` of ${s.name}` : ''}`;
  };

  function makeNode(t) {
    const li = doc.createElement('li');
    li.className = 'page-tile org-tile';
    li.dataset.key = t.key;
    li.innerHTML = `
      <div class="org-tile__top">
        <button type="button" class="btn btn-ghost btn-icon btn-sm org-tile__handle" title="Drag to move"><i class="fa-solid fa-grip-vertical" aria-hidden="true"></i></button>
        <span class="org-tile__pos" aria-hidden="true"></span>
      </div>
      <span class="page-tile__img" aria-hidden="true"><span class="page-tile__placeholder"></span></span>
      <span class="page-tile__label"><span class="org-tile__name"></span><span class="org-tile__state"></span></span>
      <div class="page-tile__actions">
        <button type="button" class="btn btn-ghost btn-icon btn-sm" data-act="earlier" title="Move earlier"><i class="fa-solid fa-arrow-left" aria-hidden="true"></i></button>
        <button type="button" class="btn btn-ghost btn-icon btn-sm" data-act="later" title="Move later"><i class="fa-solid fa-arrow-right" aria-hidden="true"></i></button>
        <button type="button" class="btn btn-ghost btn-icon btn-sm" data-act="left" title="Rotate left"><i class="fa-solid fa-rotate-left" aria-hidden="true"></i></button>
        <button type="button" class="btn btn-ghost btn-icon btn-sm" data-act="right" title="Rotate right"><i class="fa-solid fa-rotate-right" aria-hidden="true"></i></button>
        <button type="button" class="btn btn-ghost btn-icon btn-sm btn-danger-ghost" data-act="delete"><i class="fa-solid fa-trash-can" aria-hidden="true"></i></button>
      </div>`;
    li.querySelector('.page-tile__placeholder').textContent = String(t.index + 1);
    if (sources[t.src] && sources[t.src].jsDoc) {
      if (!loader) loader = UI.lazy(renderThumb);
      loader.observe(li);
    }
    return li;
  }

  async function renderThumb(li) {
    const t = tiles.find(x => x.key === li.dataset.key);
    if (!t) return;
    let th = thumbs.get(t.key);
    if (!th) {
      th = await K.thumbnail(sources[t.src].jsDoc, t.index, { width: 140 });
      if (!nodes.has(t.key)) { URL.revokeObjectURL(th.url); return; }
      thumbs.set(t.key, th);
    }
    const img = doc.createElement('img');
    img.alt = '';
    img.width = th.width; img.height = th.height;
    img.src = th.url;
    li.querySelector('.page-tile__img').replaceChildren(img);
    paint(li, t);
  }

  function paint(li, t, i, kept) {
    const n = tiles.length;
    if (typeof i === 'number') {
      li.querySelector('.org-tile__pos').textContent = t.deleted ? '' : String(kept);
      li.querySelector('.org-tile__handle').setAttribute('aria-label', `${label(t)}, position ${i + 1} of ${n}${t.deleted ? ', deleted' : ''}. Drag, or use the arrow keys to move.`);
      const b = li.querySelector('[data-act="earlier"]'); b.disabled = i === 0; b.setAttribute('aria-label', `Move ${label(t)} earlier`);
      const c = li.querySelector('[data-act="later"]'); c.disabled = i === n - 1; c.setAttribute('aria-label', `Move ${label(t)} later`);
    }
    li.querySelector('[data-act="left"]').setAttribute('aria-label', `Rotate ${label(t)} left`);
    li.querySelector('[data-act="right"]').setAttribute('aria-label', `Rotate ${label(t)} right`);
    const del = li.querySelector('[data-act="delete"]');
    del.setAttribute('aria-label', `${t.deleted ? 'Restore' : 'Delete'} ${label(t)}`);
    del.title = t.deleted ? 'Restore' : 'Delete';
    // Whole class names, so scripts/build-icons.py finds both icons for the subset.
    del.innerHTML = `<i class="fa-solid ${t.deleted ? 'fa-trash-can-arrow-up' : 'fa-trash-can'}" aria-hidden="true"></i>`;
    li.querySelector('.org-tile__name').textContent = label(t);
    const turn = K.norm(t.turn);
    li.querySelector('.org-tile__state').textContent = t.deleted ? 'Deleted' : turn ? `Turned ${turn === 90 ? 'right' : turn === 270 ? 'left' : 'upside down'}` : '';
    li.classList.toggle('is-deleted', t.deleted);
    li.classList.toggle('is-inserted', t.src > 0);
    const img = li.querySelector('.page-tile__img img');
    if (img) img.style.transform = turn ? `rotate(${turn}deg)` : '';
  }

  function sync(focus) {
    const live = new Set(tiles.map(t => t.key));
    nodes.forEach((li, key) => { if (!live.has(key)) { li.remove(); nodes.delete(key); } });
    let kept = 0;
    tiles.forEach((t, i) => {
      let li = nodes.get(t.key);
      if (!li) { li = makeNode(t); nodes.set(t.key, li); }
      if (els.grid.children[i] !== li) els.grid.insertBefore(li, els.grid.children[i] || null);
      if (!t.deleted) kept++;
      paint(li, t, i, kept);
    });
    summarise();
    if (focus) {
      const li = nodes.get(focus.key);
      const target = li && (li.querySelector(`[data-act="${focus.act}"]:not(:disabled)`) || li.querySelector('.org-tile__handle'));
      if (target) target.focus();
    }
  }

  /** What has changed so far: { kept, deleted, turned, inserted, moved }. */
  function changeCounts() {
    const keptTiles = tiles.filter(t => !t.deleted);
    const original = tiles.filter(t => t.src === 0).map(t => t.index);
    return {
      kept: keptTiles.length,
      deleted: tiles.length - keptTiles.length,
      turned: keptTiles.filter(t => K.norm(t.turn)).length,
      inserted: tiles.filter(t => t.src > 0 && !t.deleted).length,
      moved: original.some((v, i) => v !== i) || tiles.some((t, i) => t.src > 0 && tiles.slice(i + 1).some(x => x.src === 0))
    };
  }

  function summarise() {
    if (!tiles.length) { els.changes.textContent = 'No changes yet.'; els.summary.textContent = ''; els.run.disabled = true; return; }
    const c = changeCounts();
    const parts = [];
    if (c.moved) parts.push('pages reordered');
    if (c.turned) parts.push(`${UI.plural(c.turned, 'page')} turned`);
    if (c.deleted) parts.push(`${UI.plural(c.deleted, 'page')} deleted`);
    if (c.inserted) parts.push(`${UI.plural(c.inserted, 'page')} inserted`);
    els.changes.textContent = parts.length ? `${parts.join(', ')}.`.replace(/^./, ch => ch.toUpperCase()) : 'No changes yet.';
    els.run.disabled = !c.kept;
    els.summary.textContent = c.kept ? `Saves a new PDF with ${UI.plural(c.kept, 'page')}.` : 'Every page is deleted. Restore at least one page to save.';
    els.summary.classList.toggle('is-invalid', !c.kept);
  }

  function move(from, to, act) {
    if (to < 0 || to >= tiles.length || from === to) return;
    const [t] = tiles.splice(from, 1);
    tiles.splice(to, 0, t);
    changed({ key: t.key, act: act || 'handle' });
    els.status.textContent = `${label(t)} moved to position ${to + 1} of ${tiles.length}.`;
  }

  els.grid.addEventListener('click', e => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const li = b.closest('.org-tile');
    const i = tiles.findIndex(t => t.key === li.dataset.key);
    if (i < 0) return;
    const t = tiles[i];
    const act = b.dataset.act;
    if (act === 'earlier') return move(i, i - 1, 'earlier');
    if (act === 'later') return move(i, i + 1, 'later');
    if (act === 'left' || act === 'right') {
      t.turn = K.norm(t.turn + (act === 'left' ? -90 : 90));
      changed({ key: t.key, act });
      els.status.textContent = `${label(t)} ${K.norm(t.turn) ? `is turned ${K.norm(t.turn)} degrees clockwise from the original` : 'is back to its original rotation'}.`;
      return;
    }
    if (act === 'delete') {
      t.deleted = !t.deleted;
      changed({ key: t.key, act: 'delete' });
      els.status.textContent = `${label(t)} ${t.deleted ? 'deleted. Select Restore to bring it back.' : 'restored.'}`;
    }
  });
  UI.sortable(els.grid, { item: '.org-tile', handle: '.org-tile__handle', onMove: (from, to) => move(from, to, 'handle') });

  function rotateAll(delta) {
    tiles.forEach(t => { if (!t.deleted) t.turn = K.norm(t.turn + delta); });
    changed();
    els.status.textContent = `Every page turned ${delta < 0 ? 'left' : 'right'}.`;
  }
  els.rotL.addEventListener('click', () => rotateAll(-90));
  els.rotR.addEventListener('click', () => rotateAll(90));
  els.reset.addEventListener('click', () => {
    if (!sources.length) return;
    sources.slice(1).forEach(s => K.closeJs(s.jsDoc));
    sources = sources.slice(0, 1);
    Array.from(thumbs.keys()).filter(k => !k.startsWith('0:')).forEach(k => { URL.revokeObjectURL(thumbs.get(k).url); thumbs.delete(k); });
    tiles = Array.from({ length: sources[0].count }, (_, i) => ({ key: `0:${i}`, src: 0, index: i, turn: 0, deleted: false }));
    changed();
    els.status.textContent = 'All changes undone. The pages are back as they are in your file.';
  });

  // Insert pages from another PDF, at the end.
  els.insert.addEventListener('click', () => { els.insertInput.value = ''; els.insertInput.click(); });
  els.insertInput.addEventListener('change', async () => {
    const file = els.insertInput.files && els.insertInput.files[0];
    els.insertInput.value = '';
    if (!file) return;
    tool.error.hide();
    const v = await Files.validate(file, ['pdf'], K.LIMITS.fileBytes);
    if (!v.ok) { tool.error.show(v.error + (/hoose/.test(v.error) ? '' : ' Choose a PDF file.')); return; }
    Kit.setButtonBusy(els.insert, true, 'Opening…');
    try {
      const opened = await UI.openPdf(file, { lib: true, js: true });
      if (tiles.length + opened.pageCount > MAX_PAGES) { K.closeJs(opened.jsDoc); throw new K.PdfError('toolarge', `${file.name} has ${opened.pageCount} pages, which would bring the total over ${MAX_PAGES}. Split it first and insert only the pages you need.`); }
      const src = sources.length;
      sources.push({ name: file.name, bytes: opened.bytes, password: opened.password, libDoc: opened.libDoc, jsDoc: opened.jsDoc, count: opened.pageCount });
      const first = tiles.length;
      for (let i = 0; i < opened.pageCount; i++) tiles.push({ key: `${src}:${i}`, src, index: i, turn: 0, deleted: false });
      changed({ key: tiles[first].key, act: 'handle' });
      els.status.textContent = `${UI.plural(opened.pageCount, 'page')} from ${file.name} added at the end.`;
      Kit.announce(`${UI.plural(opened.pageCount, 'page')} from ${file.name} added at the end.`);
    } catch (e) {
      tool.error.show(e && e.name === 'PdfError' ? e.message : `${file.name} could not be opened. Check that it opens on your device.`);
    } finally {
      Kit.setButtonBusy(els.insert, false);
    }
  });

  els.name.addEventListener('input', () => tool.hideResult());

  els.run.addEventListener('click', () => {
    const keep = tiles.filter(t => !t.deleted);
    if (!keep.length) { tool.error.show('Every page is deleted. Restore at least one page to save.'); return; }
    runner.run(async (signal, progress) => {
      progress(0.05, 'Copying pages…');
      const out = await K.assemble(keep.map(t => ({ doc: sources[t.src].libDoc, index: t.index, turn: t.turn })), (d, n) => progress(0.05 + d / n * 0.6, `Copying pages… ${d} of ${n}`), signal);
      progress(0.75, 'Saving…');
      const bytes = await K.save(out);
      progress(0.9, 'Checking the new file…');
      await K.verify(bytes, { pages: keep.length });
      K.throwIfAborted(signal);
      const name = `${(els.name.value || 'organised').trim().replace(/\.pdf$/i, '') || 'organised'}.pdf`;
      dropOutput();
      const url = urls.make(UI.pdfBlob(bytes));
      output = { url };
      UI.setDownload(els.download, url, name);
      els.statPages.textContent = String(keep.length);
      const c = changeCounts();
      els.statChanges.textContent = [c.moved && 'Reordered', c.turned && `${c.turned} turned`, c.deleted && `${c.deleted} deleted`, c.inserted && `${c.inserted} added`].filter(Boolean).join(', ') || 'None';
      els.statSize.textContent = Files.formatBytes(bytes.length);
      els.resultText.textContent = `${UI.plural(keep.length, 'page')} in the order shown, checked after saving. Your original file is unchanged.`;
      tool.showResult(els.download);
      Kit.announce(`New PDF ready: ${UI.plural(keep.length, 'page')}.`);
      els.download.focus({ preventScroll: true });
      return true;
    });
  });

  Kit.guardUnload(() => runner.busy);
})();
