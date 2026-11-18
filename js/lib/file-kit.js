/* ApplyReady file kit: the shared way every tool takes in files and hands results back.

   Using one implementation means every tool behaves the same: the same drop zone, the same
   messages for a wrong or oversized file, the same download and ZIP behaviour. Markup comes from
   scripts/lib/tool-kit.js; styles are in css/app.css section 17.

   ApplyReadyFileKit.dropzone(root, options) -> { open(), reset() }
     root       element containing [data-dropzone], input[type=file] and a [data-browse] button
     options    { accept: ['image'] | ['pdf'] | ..., multiple, limitBytes,
                  maxFiles: a number, or (context) => the room left, for a tool whose list already
                  holds files; tooMany(room, offered, context) => the message when more are offered,
                  onFiles(files, infos, context), onReject(messages, context), paste: true,
                  validate: false to accept any file unchecked (infos are then null),
                  context: () => value, read when files arrive and passed back after checking,
                  so a tool can deliver them where they were dropped (applicant workspaces) }
   ApplyReadyFileKit.thumbnail(file, size) -> Promise<objectURL|null>   small JPEG preview; null when
                  the browser cannot decode it or the image is too large to decode safely
   ApplyReadyFileKit.tooManyPixels(file) -> Promise<message|''>          refuses images over 50 MP
   ApplyReadyFileKit.downloadZip(entries, name, { button, signal })      ZIP with progress
   ApplyReadyFileKit.guardUnload(() => boolean)                          warn before losing results
   ApplyReadyFileKit.announce(message)                                   polite screen-reader update

   Depends on js/lib/files.js, on js/lib/image-ops.js for the pixel-size check (pages that show
   image previews load it; tests/content_tests.js checks), and, for ZIP, js/lib/zip.js.
   Nothing is uploaded. */
(function (root) {
  'use strict';
  const Files = () => root.ApplyReadyFiles;
  const ui = () => root.ApplyReadyUI || {};

  /**
   * A name with hidden direction characters (U+202E and others) can display a false extension:
   * "invoice<U+202E>fdp.exe" shows as "invoiceexe.pdf". Tools get such a file under its name without
   * them, so every list, message and download shows the name as it really is. The new File shares
   * the original's data (nothing is copied); originalName keeps the name as it was given.
   */
  function revealName(file) {
    const F = Files();
    const name = file && file.name;
    if (!name || !F || !F.withoutHiddenDirection || typeof File !== 'function') return file;
    const visible = F.withoutHiddenDirection(name);
    if (visible === name) return file;
    try {
      const renamed = new File([file], visible || 'file', { type: file.type, lastModified: file.lastModified });
      renamed.originalName = name;
      return renamed;
    } catch (e) { return file; }
  }

  function dropzone(container, options) {
    const opts = Object.assign({ accept: ['image'], multiple: false, maxFiles: 500, paste: true }, options || {});
    const zone = container.querySelector('[data-dropzone]') || container;
    const input = container.querySelector('input[type="file"]');
    const browse = container.querySelectorAll('[data-browse]');
    if (!input) throw new Error('file-kit: no file input in the drop zone');
    if (opts.multiple) input.multiple = true;

    async function take(fileList) {
      let files = Array.from(fileList || []).filter(f => f && typeof f.size === 'number').map(revealName);
      if (!files.length) return;
      const context = typeof opts.context === 'function' ? opts.context() : undefined;
      if (!opts.multiple) files = files.slice(0, 1);
      const messages = [];
      // The room is read when the files arrive, so a list that already holds files gets one message
      // with the real count, not "the first 50" from here and a different number from the tool.
      const room = Math.max(0, typeof opts.maxFiles === 'function' ? opts.maxFiles(context) : opts.maxFiles);
      if (files.length > room) {
        messages.push(typeof opts.tooMany === 'function' ? opts.tooMany(room, files.length, context) : `Only the first ${room} files were added. Process these, then add the rest.`);
        files = files.slice(0, room);
      }
      // Tools that report on any file, even an empty or unknown one (the file checker), take them unvalidated.
      if (opts.validate === false) {
        if (messages.length && opts.onReject) opts.onReject(messages, context);
        if (opts.onFiles) opts.onFiles(files, files.map(() => null), context);
        return;
      }
      const results = await Promise.all(files.map(f => Files().validate(f, opts.accept, opts.limitBytes).then(r => ({ file: f, r }))));
      const good = results.filter(x => x.r.ok);
      results.filter(x => !x.r.ok).forEach(x => messages.push(x.r.error));
      if (messages.length && opts.onReject) opts.onReject(messages, context);
      if (good.length && opts.onFiles) opts.onFiles(good.map(x => x.file), good.map(x => x.r.info), context);
    }

    const open = () => { input.value = ''; input.click(); };
    browse.forEach(b => b.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); open(); }));
    // Clicking the empty area of the zone opens the picker too (the button is the keyboard route).
    zone.addEventListener('click', e => { if (e.target === zone || (e.target.closest('[data-dropzone]') === zone && !e.target.closest('button, a, input, label'))) open(); });
    input.addEventListener('change', () => { const list = Array.from(input.files || []); input.value = ''; take(list); });

    let depth = 0;
    zone.addEventListener('dragenter', e => { e.preventDefault(); depth++; zone.classList.add('dragover'); });
    zone.addEventListener('dragover', e => { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'; });
    zone.addEventListener('dragleave', () => { depth = Math.max(0, depth - 1); if (!depth) zone.classList.remove('dragover'); });
    zone.addEventListener('drop', e => { e.preventDefault(); depth = 0; zone.classList.remove('dragover'); take(e.dataTransfer && e.dataTransfer.files); });
    // A file dropped outside the zone would otherwise make the browser open it and leave the page.
    if (!root.__arDropGuard) {
      root.__arDropGuard = true;
      ['dragover', 'drop'].forEach(type => document.addEventListener(type, e => { if (!e.target.closest || !e.target.closest('[data-dropzone]')) e.preventDefault(); }));
    }
    if (opts.paste) {
      document.addEventListener('paste', e => {
        const t = e.target;
        if (t && (/^(INPUT|TEXTAREA)$/.test(t.tagName) || t.isContentEditable)) return;
        if (!container.isConnected || container.closest('[hidden]')) return;
        const files = Array.from((e.clipboardData && e.clipboardData.files) || []);
        if (files.length) { e.preventDefault(); take(files); }
      });
    }
    return { open, take, reset: () => { input.value = ''; } };
  }

  /**
   * The pixel size an image declares in its header, read from its first bytes without decoding it
   * ({ width, height } or null when it cannot be read).
   */
  async function imageHeader(file) {
    const Ops = root.ApplyReadyImageOps;
    if (!Ops || !file || !file.slice) return null;
    try { return Ops.readHeader(new Uint8Array(await file.slice(0, 512 * 1024).arrayBuffer())); }
    catch (e) { return null; }
  }

  /**
   * A message when an image declares more pixels than the tools decode safely (the same 50 MP limit
   * as the image tools), otherwise ''. A small file can declare a huge size, and decoding it, even
   * for a preview, can take gigabytes of memory and close the tab on a phone.
   */
  async function tooManyPixels(file) {
    const Ops = root.ApplyReadyImageOps;
    const h = await imageHeader(file);
    if (!h || !Ops || h.width * h.height <= Ops.MAX_PIXELS) return '';
    return `${file.name || 'This image'} is ${Math.round(h.width * h.height / 1e6)} megapixels (${h.width} × ${h.height} px), more than the ${Ops.MAX_PIXELS / 1e6} MP that can be opened safely in a browser. Resize it on the phone or computer first.`;
  }

  /**
   * A small JPEG preview (object URL) for a list row. Null when the browser cannot decode it, and
   * when the image is too large to decode safely (see tooManyPixels): it is not decoded at all then.
   */
  async function thumbnail(file, size) {
    const max = size || 160;
    try {
      if (await tooManyPixels(file)) return null;
      let bitmap;
      try { bitmap = await createImageBitmap(file, { resizeWidth: max, resizeQuality: 'low', imageOrientation: 'from-image' }); }
      catch (e) { bitmap = await createImageBitmap(file); }
      const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      if (bitmap.close) bitmap.close();
      const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.7));
      canvas.width = 0; canvas.height = 0;
      return blob ? URL.createObjectURL(blob) : null;
    } catch (e) { return null; }
  }

  function setButtonBusy(button, busy, label) {
    if (!button) return;
    if (busy) {
      if (!button.dataset.label) button.dataset.label = button.innerHTML;
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
      button.textContent = label || 'Working…';
    } else {
      button.disabled = false;
      button.removeAttribute('aria-busy');
      if (button.dataset.label) { button.innerHTML = button.dataset.label; delete button.dataset.label; }
    }
  }

  /** Build a ZIP from [{ name, data }] and download it, showing progress on the button. */
  async function downloadZip(entries, name, options) {
    const opts = options || {};
    if (!entries.length) { if (ui().notify) ui().notify('There is nothing to download yet.', true); return false; }
    setButtonBusy(opts.button, true, 'Preparing ZIP…');
    try {
      const zip = await root.ApplyReadyZip.createZip(entries, {
        signal: opts.signal,
        onProgress: (done, total) => { if (opts.button) opts.button.textContent = `Preparing ZIP… ${done} of ${total}`; }
      });
      Files().download(zip, name);
      // The page hands the file to the browser but cannot see whether it was saved: a browser can
      // block or ask about a download (several in a row, for example). So the message says the ZIP
      // is ready, visibly as well as for screen readers, and what to do if nothing arrives.
      const ready = `ZIP file with ${entries.length} file${entries.length === 1 ? '' : 's'} ready: ${Files().safeFileName(name, 'download')}. If no download starts, allow downloads for this site in your browser and try again.`;
      if (ui().notify) ui().notify(ready); else announce(ready);
      return true;
    } catch (e) {
      if (ui().notify) ui().notify(e && e.name === 'AbortError' ? 'ZIP cancelled.' : (e && e.message) || 'The ZIP file could not be created.', true);
      return false;
    } finally {
      setButtonBusy(opts.button, false);
    }
  }

  let guardFn = null;
  function guardUnload(fn) {
    guardFn = fn;
    if (root.__arUnloadGuard) return;
    root.__arUnloadGuard = true;
    root.addEventListener('beforeunload', e => {
      if (guardFn && guardFn()) { e.preventDefault(); e.returnValue = ''; }
    });
  }

  // An empty message clears the region (applicant workspaces do this when a person is finished, so
  // nothing about them stays in the page); a newer message replaces one still waiting to be written.
  let liveNode = null;
  let liveTimer = 0;
  function announce(message) {
    if (!liveNode) {
      liveNode = document.createElement('div');
      liveNode.className = 'sr-only';
      liveNode.setAttribute('aria-live', 'polite');
      document.body.appendChild(liveNode);
    }
    clearTimeout(liveTimer);
    liveNode.textContent = '';
    if (message) liveTimer = setTimeout(() => { liveNode.textContent = message; }, 40);
  }

  root.ApplyReadyFileKit = { dropzone, thumbnail, tooManyPixels, downloadZip, guardUnload, announce, setButtonBusy };
})(typeof window !== 'undefined' ? window : this);
