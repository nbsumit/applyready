/* ApplyReady file kit: the shared way every tool takes in files and hands results back.

   Using one implementation means every tool behaves the same: the same drop zone, the same
   messages for a wrong or oversized file, the same download and ZIP behaviour. Markup comes from
   scripts/lib/tool-kit.js; styles are in css/app.css section 17.

   ApplyReadyFileKit.dropzone(root, options) -> { open(), reset() }
     root       element containing [data-dropzone], input[type=file] and a [data-browse] button
     options    { accept: ['image'] | ['pdf'] | ..., multiple, limitBytes, maxFiles,
                  onFiles(files, infos), onReject(messages), paste: true }
   ApplyReadyFileKit.thumbnail(file, size) -> Promise<objectURL|null>   small JPEG preview
   ApplyReadyFileKit.downloadZip(entries, name, { button, signal })      ZIP with progress
   ApplyReadyFileKit.guardUnload(() => boolean)                          warn before losing results
   ApplyReadyFileKit.announce(message)                                   polite screen-reader update

   Depends on js/lib/files.js and, for ZIP, js/lib/zip.js. Nothing is uploaded. */
(function (root) {
  'use strict';
  const Files = () => root.ApplyReadyFiles;
  const ui = () => root.ApplyReadyUI || {};

  function dropzone(container, options) {
    const opts = Object.assign({ accept: ['image'], multiple: false, maxFiles: 500, paste: true }, options || {});
    const zone = container.querySelector('[data-dropzone]') || container;
    const input = container.querySelector('input[type="file"]');
    const browse = container.querySelectorAll('[data-browse]');
    if (!input) throw new Error('file-kit: no file input in the drop zone');
    if (opts.multiple) input.multiple = true;

    async function take(fileList) {
      let files = Array.from(fileList || []).filter(f => f && typeof f.size === 'number');
      if (!files.length) return;
      if (!opts.multiple) files = files.slice(0, 1);
      const messages = [];
      if (files.length > opts.maxFiles) {
        messages.push(`Only the first ${opts.maxFiles} files were added. Process these, then add the rest.`);
        files = files.slice(0, opts.maxFiles);
      }
      const results = await Promise.all(files.map(f => Files().validate(f, opts.accept, opts.limitBytes).then(r => ({ file: f, r }))));
      const good = results.filter(x => x.r.ok);
      results.filter(x => !x.r.ok).forEach(x => messages.push(x.r.error));
      if (messages.length && opts.onReject) opts.onReject(messages);
      if (good.length && opts.onFiles) opts.onFiles(good.map(x => x.file), good.map(x => x.r.info));
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

  /** A small JPEG preview (object URL) for a list row. Null when the browser cannot decode it. */
  async function thumbnail(file, size) {
    const max = size || 160;
    try {
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
      announce(`ZIP file with ${entries.length} file${entries.length === 1 ? '' : 's'} downloaded.`);
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

  let liveNode = null;
  function announce(message) {
    if (!liveNode) {
      liveNode = document.createElement('div');
      liveNode.className = 'sr-only';
      liveNode.setAttribute('aria-live', 'polite');
      document.body.appendChild(liveNode);
    }
    liveNode.textContent = '';
    setTimeout(() => { liveNode.textContent = message; }, 40);
  }

  root.ApplyReadyFileKit = { dropzone, thumbnail, downloadZip, guardUnload, announce, setButtonBusy };
})(typeof window !== 'undefined' ? window : this);
