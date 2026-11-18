/* ApplyReady PDF tool interface: the parts every PDF tool shares, so they all behave the same.

   ApplyReadyPdfUI.singleTool(ws, options) -> controller for tools that work on one PDF
     ws        the .ws element. Inside it: [data-pdf-error] (notice), .dropzone, [data-pdf-file]
               (file bar) with [data-pdf-name], [data-pdf-replace], [data-pdf-remove],
               [data-pdf-loading], [data-pdf-progress] (progress with [data-cancel]), [data-pdf-result]
     options   { needs: { lib, js }, onOpen(state), onClear(), maxPages, label }
   ApplyReadyPdfUI.openPdf(file, { lib, js, name })  open with the password dialog when needed
   ApplyReadyPdfUI.askPassword({ name, check })      accessible password dialog
   ApplyReadyPdfUI.runner(box, options)               progress, cancel and error handling for a job
   ApplyReadyPdfUI.sortable(list, options)            drag to reorder (mouse, pen, touch)
   ApplyReadyPdfUI.urls()                             object URLs released together

   Depends on js/lib/files.js, js/lib/file-kit.js, js/lib/pdf-kit.js. Nothing is uploaded. */
(function (root) {
  'use strict';
  const doc = document;
  const Pdf = () => root.ApplyReadyPdf;
  const Files = () => root.ApplyReadyFiles;
  const Kit = () => root.ApplyReadyFileKit;
  const announce = m => { if (Kit() && Kit().announce) Kit().announce(m); };

  /* ------------------------------------------------------------ Password dialog */
  let dialogSeq = 0;
  /**
   * Ask for a password. `check(password)` should resolve when it opens the file and throw a
   * PdfError with code 'password' when it does not; the dialog stays open and says so.
   * Resolves with check's result, or null when cancelled.
   */
  function askPassword(options) {
    const o = Object.assign({ name: 'This PDF' }, options);
    return new Promise(resolve => {
      const uid = 'pw' + (++dialogSeq);
      const opener = doc.activeElement;
      const backdrop = doc.createElement('div');
      backdrop.className = 'dialog-backdrop';
      backdrop.innerHTML = `
        <form class="dialog pdf-password" role="dialog" aria-modal="true" aria-labelledby="${uid}-t" aria-describedby="${uid}-d" novalidate>
          <div class="dialog__head"><h2 class="dialog__title" id="${uid}-t">This PDF needs a password</h2></div>
          <div class="dialog__body">
            <p id="${uid}-d"><span data-name></span> is protected. Type its password to open it.</p>
            <div class="field">
              <label class="field-label" for="${uid}-i">Password</label>
              <input class="input" type="password" id="${uid}-i" autocomplete="off" autocapitalize="off" spellcheck="false" aria-describedby="${uid}-h">
              <p class="field-error" id="${uid}-e" role="alert" hidden></p>
            </div>
            <label class="check"><input type="checkbox" data-show> <span>Show password</span></label>
            <p class="field-hint" id="${uid}-h">The password is used only in this browser tab to open the file. It is not sent anywhere or saved. The file you download will not need a password.</p>
          </div>
          <div class="dialog__foot">
            <button type="button" class="btn" data-act="cancel">Cancel</button>
            <button type="submit" class="btn btn-primary" data-act="ok">Open PDF</button>
          </div>
        </form>`;
      backdrop.querySelector('[data-name]').textContent = o.name;
      const form = backdrop.querySelector('form');
      const input = backdrop.querySelector('input[type="password"]');
      const error = backdrop.querySelector('.field-error');
      const ok = backdrop.querySelector('[data-act="ok"]');
      const cancel = backdrop.querySelector('[data-act="cancel"]');
      const show = backdrop.querySelector('[data-show]');
      const regions = Array.from(doc.querySelectorAll('.site-header, main, .site-footer, .skip-link'));
      const previous = regions.map(el => el.inert);
      regions.forEach(el => { el.inert = true; });
      doc.body.appendChild(backdrop);
      input.focus();
      let busy = false;
      function done(result) {
        doc.removeEventListener('keydown', onKey, true);
        backdrop.remove();
        regions.forEach((el, i) => { el.inert = previous[i]; });
        if (opener && typeof opener.focus === 'function' && doc.contains(opener)) opener.focus();
        resolve(result);
      }
      function fail(message) {
        error.textContent = message;
        error.hidden = false;
        input.setAttribute('aria-invalid', 'true');
        input.setAttribute('aria-describedby', `${uid}-e ${uid}-h`);
        input.focus();
        input.select();
      }
      function onKey(e) {
        if (e.key === 'Escape' && !busy) { e.preventDefault(); e.stopPropagation(); done(null); }
        else if (e.key === 'Tab') {
          const items = Array.from(form.querySelectorAll('input, button')).filter(el => !el.disabled);
          const i = items.indexOf(doc.activeElement);
          e.preventDefault();
          items[(i + (e.shiftKey ? -1 : 1) + items.length) % items.length].focus();
        }
      }
      doc.addEventListener('keydown', onKey, true);
      show.addEventListener('change', () => { input.type = show.checked ? 'text' : 'password'; });
      cancel.addEventListener('click', () => { if (!busy) done(null); });
      form.addEventListener('submit', async e => {
        e.preventDefault();
        if (busy) return;
        const value = input.value;
        if (!value) { fail('Type the password first.'); return; }
        busy = true;
        Kit().setButtonBusy(ok, true, 'Checking…');
        cancel.disabled = true;
        try {
          const result = await o.check(value);
          done(result);
        } catch (err) {
          busy = false;
          Kit().setButtonBusy(ok, false);
          cancel.disabled = false;
          if (err && err.code === 'password') fail(err.message);
          else done({ error: err });
        }
      });
    });
  }

  /**
   * Open a picked PDF for a tool. needs: { lib: pdf-lib document, js: pdf.js document }.
   * Resolves { bytes, name, size, pageCount, encrypted, password, libDoc, jsDoc }.
   * Throws PdfError (code 'cancelled' when the password dialog was closed).
   */
  async function openPdf(file, needs) {
    const n = Object.assign({ lib: true, js: false }, needs);
    const K = Pdf();
    const name = file.name || 'This PDF';
    const bytes = await K.readBytes(file);
    K.precheck(bytes, name);
    let pageCount = 0, encrypted = false;
    if (n.lib) {
      const info = await K.inspect(bytes, name);
      pageCount = info.pageCount;
      encrypted = info.encrypted;
    }
    const out = { bytes, name, size: bytes.length, pageCount, encrypted, password: '', libDoc: null, jsDoc: null };
    // Opening with the password proves it; pdf-lib checks when the tool changes the structure,
    // pdf.js when the tool only draws or reads.
    async function tryOpen(password) {
      if (n.lib) out.libDoc = await K.openLib(bytes, { password, name });
      if (n.js) {
        try { out.jsDoc = await K.openJs(bytes, { password, name }); }
        catch (e) {
          if (!n.lib || e.code === 'unsupported') throw e;
          // pdf-lib opened it but pdf.js could not draw it: work without previews.
          out.jsDoc = null; out.previewError = e;
        }
        if (!out.pageCount && out.jsDoc) out.pageCount = out.jsDoc.numPages;
      }
      out.password = password || '';
      return out;
    }
    try {
      // Many protected PDFs only restrict printing or copying and open without a password.
      return await tryOpen(encrypted ? '' : undefined);
    } catch (e) {
      if (!e || (e.code !== 'encrypted' && e.code !== 'password')) throw e;
      out.encrypted = true;
    }
    const result = await askPassword({ name, check: tryOpen });
    if (!result) throw new K.PdfError('cancelled', `${name} was not opened because no password was given.`);
    if (result.error) throw result.error;
    return result;
  }

  /* ------------------------------------------------------------ Notices */
  function errorBox(el) {
    const body = el ? (el.querySelector('.notice__body') || el) : null;
    return {
      show(message) {
        if (!el) { if (root.ApplyReadyUI && root.ApplyReadyUI.notify) root.ApplyReadyUI.notify(message, true); return; }
        body.textContent = Array.isArray(message) ? message.join(' ') : message;
        el.hidden = false;
        el.classList.remove('hidden');
      },
      hide() { if (el) { el.hidden = true; body.textContent = ''; } }
    };
  }

  /* ------------------------------------------------------------ Object URLs */
  function urls() {
    const list = [];
    return {
      make(blob) { const u = URL.createObjectURL(blob); list.push(u); return u; },
      revoke(u) { const i = list.indexOf(u); if (i >= 0) { list.splice(i, 1); URL.revokeObjectURL(u); } },
      revokeAll() { list.splice(0).forEach(u => URL.revokeObjectURL(u)); }
    };
  }

  /* ------------------------------------------------------------ Long jobs */
  /**
   * Run a job with progress, cancel and plain-word errors.
   * box: the [data-pdf-progress] element (.progress-bar, .progress-text, [data-cancel]).
   * options: { error (errorBox), button, busyLabel, onState(busy) }
   * run(job) where job(signal, progress(fraction, text)) -> result. Resolves the result, or
   * null when cancelled or failed (the reason has been shown).
   */
  function runner(box, options) {
    const o = options || {};
    const bar = box && box.querySelector('.progress-bar');
    const text = box && box.querySelector('.progress-text');
    const cancelBtn = box && box.querySelector('[data-cancel]');
    let controller = null;
    if (cancelBtn) cancelBtn.addEventListener('click', () => { if (controller) { controller.abort(); cancelBtn.disabled = true; if (text) text.textContent = 'Cancelling…'; } });
    let lastAnnounce = 0;
    function progress(fraction, message) {
      const pct = Math.max(0, Math.min(100, Math.round((fraction || 0) * 100)));
      if (bar) bar.style.width = pct + '%';
      if (box) { const p = box.querySelector('.progress'); if (p) p.setAttribute('aria-valuenow', String(pct)); }
      if (text && message) text.textContent = message;
      const now = Date.now();
      if (message && now - lastAnnounce > 4000) { lastAnnounce = now; announce(message); }
    }
    async function run(job) {
      if (controller) return null;
      controller = new AbortController();
      const signal = controller.signal;
      if (o.error) o.error.hide();
      if (box) { box.classList.remove('hidden'); box.hidden = false; }
      if (cancelBtn) cancelBtn.disabled = false;
      progress(0, o.startText || 'Starting…');
      if (o.button) Kit().setButtonBusy(o.button, true, o.busyLabel || 'Working…');
      if (o.onState) o.onState(true);
      try {
        return await job(signal, progress);
      } catch (e) {
        const K = Pdf();
        if (K.isAbort(e) || signal.aborted) {
          announce('Cancelled. Nothing was changed.');
          if (root.ApplyReadyUI && root.ApplyReadyUI.notify) root.ApplyReadyUI.notify('Cancelled. Nothing was changed.');
        } else {
          const message = e && e.name === 'PdfError' ? e.message : `Something went wrong: ${String(e && e.message || e).replace(/\.$/, '')}. Check that the file opens on your device, then try again.`;
          if (o.error) o.error.show(message); else if (root.ApplyReadyUI && root.ApplyReadyUI.notify) root.ApplyReadyUI.notify(message, true);
          if (e && e.name !== 'PdfError' && root.console) console.error(e);
        }
        return null;
      } finally {
        controller = null;
        if (box) { box.classList.add('hidden'); }
        if (o.button) Kit().setButtonBusy(o.button, false);
        if (o.onState) o.onState(false);
      }
    }
    return { run, cancel() { if (controller) controller.abort(); }, get busy() { return !!controller; } };
  }

  /* ------------------------------------------------------------ Drag to reorder */
  /**
   * Pointer drag (mouse, pen and touch) from a handle. The handle has touch-action: none, so
   * dragging it never scrolls the page. Keyboard users move items with buttons or arrow keys on the
   * handle (ArrowUp/Left earlier, ArrowDown/Right later, Home first, End last).
   * options: { item: selector, handle: selector, onMove(from, to) }
   */
  function sortable(list, options) {
    const o = options;
    let drag = null;
    const items = () => Array.from(list.querySelectorAll(o.item));
    function indexAt(x, y) {
      const all = items();
      for (let i = 0; i < all.length; i++) {
        if (drag && all[i] === drag.el) continue;
        const r = all[i].getBoundingClientRect();
        if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return i;
      }
      return null;
    }
    function clearTargets() { list.querySelectorAll('.is-drop-target').forEach(el => el.classList.remove('is-drop-target')); }
    function finish() {
      if (!drag) return null;
      const d = drag;
      drag = null;
      d.handle.removeEventListener('pointermove', move);
      d.handle.removeEventListener('pointerup', up);
      d.handle.removeEventListener('pointercancel', cancel);
      doc.removeEventListener('keydown', key, true);
      d.el.classList.remove('is-dragging');
      d.el.style.transform = '';
      clearTargets();
      return d;
    }
    function move(e) {
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) < 5) return;
      drag.moved = true;
      drag.el.classList.add('is-dragging');
      drag.el.style.transform = `translate(${dx}px, ${dy}px)`;
      const over = indexAt(e.clientX, e.clientY);
      clearTargets();
      if (over !== null && over !== drag.from) items()[over].classList.add('is-drop-target');
      drag.to = over;
      const edge = 72;
      if (e.clientY < edge) root.scrollBy(0, -14);
      else if (e.clientY > root.innerHeight - edge) root.scrollBy(0, 14);
    }
    function up() { const d = finish(); if (d && d.moved && d.to !== null && d.to !== d.from) o.onMove(d.from, d.to, 'drag'); }
    function cancel() { finish(); }
    function key(e) { if (e.key === 'Escape' && drag) { e.preventDefault(); finish(); } }
    list.addEventListener('pointerdown', e => {
      const handle = e.target.closest(o.handle);
      if (!handle || !list.contains(handle) || (e.button !== undefined && e.button !== 0)) return;
      const el = handle.closest(o.item);
      if (!el) return;
      e.preventDefault();
      try { handle.setPointerCapture(e.pointerId); } catch (err) { /* old browsers */ }
      drag = { el, handle, from: items().indexOf(el), to: null, x: e.clientX, y: e.clientY, moved: false };
      handle.addEventListener('pointermove', move);
      handle.addEventListener('pointerup', up);
      handle.addEventListener('pointercancel', cancel);
      doc.addEventListener('keydown', key, true);
    });
    list.addEventListener('keydown', e => {
      const handle = e.target.closest(o.handle);
      if (!handle) return;
      const all = items();
      const from = all.indexOf(handle.closest(o.item));
      const to = { ArrowUp: from - 1, ArrowLeft: from - 1, ArrowDown: from + 1, ArrowRight: from + 1, Home: 0, End: all.length - 1 }[e.key];
      if (to === undefined) return;
      e.preventDefault();
      if (to >= 0 && to < all.length && to !== from) o.onMove(from, to, 'key');
    });
  }

  /* ------------------------------------------------------------ Lazy thumbnails */
  /**
   * Render thumbnails only when their tile scrolls near the screen, two at a time.
   * render(el) -> Promise. Returns { observe(el), disconnect() }.
   */
  function lazy(render) {
    const queue = [];
    let running = 0;
    const MAX = 2;
    function pump() {
      while (running < MAX && queue.length) {
        const el = queue.shift();
        if (!el.isConnected || el.dataset.thumb === 'done') continue;
        running++;
        el.dataset.thumb = 'loading';
        Promise.resolve(render(el)).catch(() => { el.dataset.thumb = 'failed'; }).finally(() => { running--; if (el.dataset.thumb === 'loading') el.dataset.thumb = 'done'; pump(); });
      }
    }
    const io = 'IntersectionObserver' in root ? new IntersectionObserver(entries => {
      entries.forEach(entry => { if (entry.isIntersecting) { io.unobserve(entry.target); queue.push(entry.target); } });
      pump();
    }, { rootMargin: '400px 0px' }) : null;
    return {
      observe(el) { if (io) io.observe(el); else { queue.push(el); pump(); } },
      disconnect() { if (io) io.disconnect(); queue.length = 0; }
    };
  }

  /* ------------------------------------------------------------ Page picker */
  /**
   * A grid of page thumbnails, optionally selectable (each page a toggle button).
   * options: { count, jsDoc, selectable, onToggle(index, selected), note(element) }
   * Returns { setSelected(Set of indexes), destroy() }.
   */
  function pageGrid(list, options) {
    const o = options;
    const K = Pdf();
    const made = urls();
    list.textContent = '';
    const shown = Math.min(o.count, K.LIMITS.thumbPages);
    const loader = o.jsDoc ? lazy(async tile => {
      const i = Number(tile.dataset.index);
      const t = await K.thumbnail(o.jsDoc, i, { width: 150 });
      if (!tile.isConnected) { URL.revokeObjectURL(t.url); return; }
      const img = doc.createElement('img');
      img.alt = '';
      img.width = t.width; img.height = t.height;
      img.src = t.url;
      tile.querySelector('.page-tile__img').replaceChildren(img);
      tile.__url = t.url;
    }) : null;
    const frag = doc.createDocumentFragment();
    for (let i = 0; i < shown; i++) {
      const li = doc.createElement('li');
      li.className = 'page-tile';
      li.dataset.index = String(i);
      const inner = o.selectable ? doc.createElement('button') : doc.createElement('div');
      inner.className = 'page-tile__body';
      if (o.selectable) { inner.type = 'button'; inner.setAttribute('aria-pressed', 'false'); inner.setAttribute('aria-label', `Page ${i + 1}`); }
      const box = doc.createElement('span');
      box.className = 'page-tile__img';
      box.setAttribute('aria-hidden', 'true');
      const ph = doc.createElement('span');
      ph.className = 'page-tile__placeholder';
      ph.textContent = String(i + 1);
      box.appendChild(ph);
      const label = doc.createElement('span');
      label.className = 'page-tile__label';
      label.setAttribute('aria-hidden', 'true');
      label.textContent = `Page ${i + 1}`;
      inner.append(box, label);
      li.appendChild(inner);
      frag.appendChild(li);
    }
    list.appendChild(frag);
    if (loader) list.querySelectorAll('.page-tile').forEach(t => loader.observe(t));
    if (o.selectable) {
      list.onclick = e => {
        const b = e.target.closest('.page-tile__body');
        if (!b || !list.contains(b)) return;
        const i = Number(b.parentNode.dataset.index);
        const on = b.getAttribute('aria-pressed') !== 'true';
        b.setAttribute('aria-pressed', String(on));
        b.parentNode.classList.toggle('is-selected', on);
        if (o.onToggle) o.onToggle(i, on);
      };
    }
    if (o.note) o.note.textContent = o.count > shown ? `Previews are shown for the first ${shown} of ${o.count} pages. Type page numbers to use the others.` : '';
    return {
      setSelected(set) {
        list.querySelectorAll('.page-tile').forEach(t => {
          const on = set.has(Number(t.dataset.index));
          t.classList.toggle('is-selected', on);
          const b = t.querySelector('.page-tile__body');
          if (b && b.hasAttribute('aria-pressed')) b.setAttribute('aria-pressed', String(on));
        });
      },
      destroy() {
        if (loader) loader.disconnect();
        list.querySelectorAll('.page-tile').forEach(t => { if (t.__url) URL.revokeObjectURL(t.__url); });
        list.textContent = '';
        list.onclick = null;
      }
    };
  }

  /* ------------------------------------------------------------ One-PDF tools */
  /**
   * The intake every one-PDF tool shares: drop zone, checks, password, loading, file bar,
   * replace and remove. The tool supplies onOpen(state) and onClear().
   */
  function singleTool(ws, options) {
    const o = Object.assign({ needs: { lib: true, js: true }, maxPages: 0 }, options);
    const K = Pdf();
    const error = errorBox(ws.querySelector('[data-pdf-error]'));
    const zone = ws.querySelector('.dropzone');
    const fileBar = ws.querySelector('[data-pdf-file]');
    const nameEl = ws.querySelector('[data-pdf-name]');
    const loading = ws.querySelector('[data-pdf-loading]');
    const result = ws.querySelector('[data-pdf-result]');
    let state = null;
    let opening = 0;

    const sup = K.support();
    if (!sup.ok || (o.needs.js && !sup.render)) {
      error.show(`This browser cannot run this PDF tool (it lacks ${sup.missing.join(', ') || 'a PDF reader'}). Update it, or use a recent Chrome, Edge, Firefox or Safari.`);
      const browse = ws.querySelector('[data-browse]');
      if (browse) browse.disabled = true;
      return { get state() { return null; }, error, clear() {}, hideResult() {}, showResult() {} };
    }

    function hideResult() { if (result && !result.classList.contains('hidden')) { result.classList.add('hidden'); if (o.onStale) o.onStale(); } }
    function showResult() { if (result) { result.classList.remove('hidden'); if (root.ApplyReadyUI && root.ApplyReadyUI.reveal) root.ApplyReadyUI.reveal(result); } }

    async function release() {
      if (state && state.jsDoc) K.closeJs(state.jsDoc);
      state = null;
    }

    async function clear(silent) {
      opening++;
      await release();
      if (o.onClear) o.onClear();
      if (fileBar) fileBar.classList.add('hidden');
      if (result) result.classList.add('hidden');
      if (loading) loading.classList.add('hidden');
      if (!silent) error.hide();
      if (!silent) { const b = ws.querySelector('[data-browse]'); if (b) b.focus(); }
    }

    async function take(files) {
      const file = files[0];
      if (!file) return;
      const ticket = ++opening;
      error.hide();
      if (result) result.classList.add('hidden');
      if (loading) { loading.classList.remove('hidden'); }
      announce(`Opening ${file.name}…`);
      try {
        const next = await openPdf(file, o.needs);
        if (ticket !== opening) { if (next.jsDoc) K.closeJs(next.jsDoc); return; }
        if (o.maxPages && next.pageCount > o.maxPages) throw new K.PdfError('toolarge', o.tooManyPages ? o.tooManyPages(next.pageCount) : `${file.name} has ${next.pageCount} pages. This tool works on up to ${o.maxPages} pages at a time; split the PDF first.`);
        await release();
        state = Object.assign(next, { file });
        if (nameEl) nameEl.textContent = `${file.name} (${state.pageCount} page${state.pageCount === 1 ? '' : 's'}, ${Files().formatBytes(file.size)}${state.encrypted ? ', password protected' : ''})`;
        await o.onOpen(state);
        if (fileBar) fileBar.classList.remove('hidden');
        announce(`${file.name} is open: ${state.pageCount} page${state.pageCount === 1 ? '' : 's'}.`);
        if (state.previewError) error.show('This PDF opened, but this browser could not draw its pages, so previews are not shown. The tool still works.');
      } catch (e) {
        if (ticket !== opening) return;
        if (e && e.code === 'cancelled') { error.show(e.message + ' Choose the file again when you have the password.'); }
        else error.show(e && e.name === 'PdfError' ? e.message : `${file.name} could not be opened. Check that it opens on your device, then try again.`);
        if (e && e.name !== 'PdfError' && root.console) console.error(e);
        if (!state && fileBar) fileBar.classList.add('hidden');
      } finally {
        if (ticket === opening && loading) loading.classList.add('hidden');
      }
    }

    const dz = Kit().dropzone(zone, {
      accept: ['pdf'],
      multiple: false,
      limitBytes: K.LIMITS.fileBytes,
      onFiles: take,
      onReject: messages => error.show(messages.map(m => /Choose|choose|try/.test(m) ? m : m + ' Choose a PDF file.'))
    });
    const replace = ws.querySelector('[data-pdf-replace]');
    const remove = ws.querySelector('[data-pdf-remove]');
    if (replace) replace.addEventListener('click', () => dz.open());
    if (remove) remove.addEventListener('click', () => clear());

    return { get state() { return state; }, error, clear, take, open: () => dz.open(), hideResult, showResult };
  }

  /* ------------------------------------------------------------ Small helpers */
  function stem(name) { return Files().stem(Files().safeFileName(name || 'document.pdf', 'document')) || 'document'; }
  function pdfBlob(bytes) { return new Blob([bytes], { type: 'application/pdf' }); }
  function setDownload(a, url, name) { a.href = url; a.setAttribute('download', Files().safeFileName(name, 'document')); }
  function plural(n, word, many) { return `${n} ${n === 1 ? word : (many || word + 's')}`; }

  root.ApplyReadyPdfUI = { askPassword, openPdf, errorBox, urls, runner, sortable, lazy, pageGrid, singleTool, stem, pdfBlob, setDownload, plural };
})(typeof window !== 'undefined' ? window : this);
