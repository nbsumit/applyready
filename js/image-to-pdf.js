/* Image to PDF: turns JPG, PNG and WebP images into the pages of one PDF, in the order chosen,
   with page size, orientation, margins and quality. The PDF is written by this file in the browser,
   with no library and no upload. Files are identified by their content (js/lib/files.js), and every
   image is opened with the checks the other image tools make (js/lib/image-ops.js): no picture over
   50 megapixels, no truncated or damaged file. Files that cannot be used (a PDF, an SVG, a damaged
   photo) are listed in a notice with the reason instead of being dropped silently. */

(function () {
  'use strict';
  // Errors use the site's notification instead of a blocking browser dialog.
  const notifyError = message => (window.ApplyReadyUI && window.ApplyReadyUI.notify) ? window.ApplyReadyUI.notify(message, true) : window.alert(message);

  const doc = typeof document !== 'undefined' ? document : null;
  if (!doc) return;

  // Standard paper dimensions in points (72 pt per inch)
  const A4_W = 595.28;
  const A4_H = 841.89;
  const LETTER_W = 612.00;
  const LETTER_H = 792.00;
  const MAX_SIDE_PX = 4000;

  const dropzone = doc.getElementById('imgPdfDropzone');
  const fileInput = doc.getElementById('imgPdfFileInput');
  const btnBrowse = doc.getElementById('btnImgPdfBrowse');
  const btnAddMore = doc.getElementById('btnAddMoreImages');
  const addMoreInput = doc.getElementById('addMoreFileInput');

  const pageSizeSelect = doc.getElementById('pageSizeSelect');
  const orientationSelect = doc.getElementById('orientationSelect');
  const marginSelect = doc.getElementById('marginSelect');
  const qualitySelect = doc.getElementById('pdfQualitySelect');

  const imageListContainer = doc.getElementById('imageListContainer');
  const workspaceControls = doc.getElementById('workspaceControls');
  const btnConvert = doc.getElementById('btnConvertToPdf');
  const btnClearAll = doc.getElementById('btnClearAllImages');

  const resultArea = doc.getElementById('pdfResultArea');
  const statPages = doc.getElementById('statPdfPages');
  const statSize = doc.getElementById('statPdfSize');
  const btnDownload = doc.getElementById('btnDownloadPdf');

  // List of uploaded image items: { id, file, name, url (object URL for the thumbnail), width, height, rotation }
  let items = [];
  let pdfBlobUrl = null;
  let isConverting = false;

  function init() {
    if (!dropzone || !fileInput) return;

    btnBrowse.addEventListener('click', (e) => {
      e.stopPropagation();
      fileInput.click();
    });

    dropzone.addEventListener('click', () => fileInput.click());

    dropzone.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        fileInput.click();
      }
    });

    ['dragenter', 'dragover'].forEach(evt => {
      dropzone.addEventListener(evt, (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
      });
    });

    ['dragleave', 'drop'].forEach(evt => {
      dropzone.addEventListener(evt, (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
      });
    });

    dropzone.addEventListener('drop', (e) => {
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
        handleFiles(e.dataTransfer.files);
      }
    });

    fileInput.addEventListener('change', () => {
      if (fileInput.files && fileInput.files.length) {
        handleFiles(fileInput.files);
      }
    });

    if (btnAddMore && addMoreInput) {
      btnAddMore.addEventListener('click', () => addMoreInput.click());
      addMoreInput.addEventListener('change', () => {
        if (addMoreInput.files && addMoreInput.files.length) {
          handleFiles(addMoreInput.files);
        }
      });
    }

    if (btnClearAll) {
      btnClearAll.addEventListener('click', clearAll);
    }

    if (btnConvert) {
      btnConvert.addEventListener('click', generatePdf);
    }

    // A finished PDF describes the pages and settings it was made from; any change makes it stale.
    [pageSizeSelect, orientationSelect, marginSelect, qualitySelect].forEach(select => {
      if (select) select.addEventListener('change', invalidateResult);
    });
  }

  function invalidateResult() {
    if (resultArea) resultArea.classList.add('hidden');
    if (btnDownload) btnDownload.removeAttribute('href');
    if (pdfBlobUrl) {
      URL.revokeObjectURL(pdfBlobUrl);
      pdfBlobUrl = null;
    }
  }

  // Width and height as the page will show them, after any quarter turns.
  const turned = item => (item.rotation % 180 === 0 ? { w: item.width, h: item.height } : { w: item.height, h: item.width });

  // Files that were not added stay listed in a notice until the next files are chosen or the list
  // is cleared, so a PDF chosen with the photos is never dropped without a word. A PDF cannot become
  // a page here; Merge PDF combines PDFs and photos.
  let skippedNotice = null;
  const nameList = files => files.slice(0, 3).map(f => '"' + f.name + '"').join(', ') + (files.length > 3 ? ' and ' + (files.length - 3) + ' more' : '');
  // pdfs: files; others: { file, reason } (reason: why it was not added, or '' when not known).
  function showSkipped(pdfs, others, announce) {
    // A new element each time: an alert is announced when it is added, not when it is unhidden.
    hideSkipped();
    skippedNotice = doc.createElement('div');
    skippedNotice.className = 'notice notice--warning';
    skippedNotice.id = 'imgPdfSkipped';
    if (announce) skippedNotice.setAttribute('role', 'alert');
    const icon = doc.createElement('i');
    icon.className = 'fa-solid fa-triangle-exclamation';
    icon.setAttribute('aria-hidden', 'true');
    const body = doc.createElement('div');
    body.className = 'notice__body';
    if (pdfs.length) {
      const p = doc.createElement('p');
      p.append((pdfs.length === 1 ? nameList(pdfs) + ' is a PDF, so it was not added.' : pdfs.length + ' PDF files were not added: ' + nameList(pdfs) + '.') + ' This tool turns images into pages. To combine PDFs with photos or scans, use ');
      const link = doc.createElement('a');
      link.href = 'merge-pdf.html';
      link.textContent = 'Merge PDF';
      p.append(link, '.');
      body.append(p);
    }
    if (others.length) {
      // Each reason already says what to choose instead, so no general advice is added after them.
      const reasons = others.filter(o => o.reason).slice(0, 3);
      const p = doc.createElement('p');
      p.textContent = reasons.length
        ? (others.length === 1 ? '' : others.length + ' files were not added. ') + reasons.map(o => o.reason).join(' ') + (others.length > reasons.length ? ' ' + (others.length - reasons.length) + ' more could not be used either.' : '')
        : (others.length === 1 ? nameList(others.map(o => o.file)) + ' was not added' : others.length + ' files were not added: ' + nameList(others.map(o => o.file))) + '. Choose JPG, PNG or WebP images.';
      body.append(p);
    }
    skippedNotice.append(icon, body);
    const stage = dropzone.parentElement;
    stage.insertBefore(skippedNotice, stage.firstChild);
  }
  function hideSkipped() {
    if (skippedNotice) skippedNotice.remove();
    skippedNotice = null;
  }

  // Files are checked one after another, and a second choice waits for the first, so pages are
  // always added in the order they were chosen.
  let intake = Promise.resolve();
  function handleFiles(fileList) {
    const all = Array.from(fileList);
    intake = intake.then(() => addFiles(all), () => addFiles(all));
    return intake;
  }

  async function addFiles(all) {
    const Files = window.ApplyReadyFiles;
    const Ops = window.ApplyReadyImageOps;
    const pdfs = [], others = [], added = [];
    for (const file of all) {
      // Identify the file by its content, not by its name or the type the browser reports: an SVG
      // or a renamed text file is not an image this tool can place on a page.
      if (Files) {
        const check = await Files.validate(file, ['image']);
        if (!check.ok) {
          if (check.info && check.info.kind === 'pdf') pdfs.push(file);
          else others.push({ file, reason: check.error });
          continue;
        }
      } else if (!file.type.startsWith('image/')) {
        if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) pdfs.push(file); else others.push({ file, reason: '' });
        continue;
      }
      // Too many pixels or a damaged file is refused here, before it becomes a page.
      let size;
      try { size = await measure(file, Ops); }
      catch (e) { others.push({ file, reason: (e && e.message) || '' }); continue; }
      added.push({ id: 'img_' + Math.random().toString(36).slice(2, 11), file, name: file.name, url: URL.createObjectURL(file), width: size.width, height: size.height, rotation: 0 });
    }
    // With nothing usable, the site's notification says so (and is announced); the notice keeps the
    // details on the page. Otherwise the notice itself is the announcement.
    if (pdfs.length || others.length) showSkipped(pdfs, others, added.length > 0);
    else hideSkipped();
    if (fileInput) fileInput.value = '';
    if (addMoreInput) addMoreInput.value = '';
    if (!added.length) {
      notifyError(pdfs.length ? 'No images were added. This tool takes JPG, PNG or WebP images; choose Merge PDF to combine PDFs.' : (others.length === 1 && others[0].reason ? others[0].reason : 'Those files could not be used. Choose JPG, PNG or WebP images.'));
      return;
    }
    added.forEach(item => items.push(item));
    renderList();
  }

  // The pixel size of an image after a full decode (the decoded copy is freed at once).
  async function measure(file, Ops) {
    if (Ops) {
      const opened = await Ops.openImage(file, { name: file.name });
      const size = { width: opened.width, height: opened.height };
      opened.close();
      return size;
    }
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return { width: img.naturalWidth, height: img.naturalHeight };
    } catch (e) {
      throw new Error('"' + file.name + '" could not be read as an image. Choose JPG, PNG or WebP files that open on your device.');
    } finally { URL.revokeObjectURL(url); }
  }

  const release = item => { if (item && item.url) URL.revokeObjectURL(item.url); };

  function renderList(focus) {
    if (!imageListContainer) return;
    invalidateResult();
    imageListContainer.innerHTML = '';

    if (items.length === 0) {
      if (workspaceControls) workspaceControls.classList.add('hidden');
      if (resultArea) resultArea.classList.add('hidden');
      return;
    }

    if (workspaceControls) workspaceControls.classList.remove('hidden');

    items.forEach((item, index) => {
      const card = doc.createElement('div');
      card.className = 'page-row';
      card.setAttribute('role', 'group');
      card.setAttribute('aria-label', `Page ${index + 1} of ${items.length}: ${item.name}`);
      const dims = turned(item);

      card.innerHTML = `
        <span class="page-row__num" aria-hidden="true">${index + 1}</span>
        <img class="page-row__thumb" src="${item.url}" alt="" style="transform: rotate(${item.rotation}deg)${item.rotation % 180 ? ' scale(.75)' : ''};">
        <div class="page-row__text">
          <strong class="page-row__name">${escapeHTML(item.name)}</strong>
          <span class="page-row__meta">${dims.w} × ${dims.h} px · ${(item.file.size / 1024).toFixed(1)} KB</span>
        </div>
        <div class="page-row__actions">
          <button type="button" class="btn btn-sm btn-icon page-row__handle" data-idx="${index}" title="Drag to reorder" aria-label="Reorder page ${index + 1}. Drag it, or use the arrow keys." aria-describedby="pageOrderHint">
            <i class="fa-solid fa-arrows-up-down" aria-hidden="true"></i>
          </button>
          <button type="button" class="btn btn-sm btn-icon btn-rotate" data-idx="${index}" title="Rotate a quarter turn" aria-label="Rotate page ${index + 1} a quarter turn clockwise">
            <i class="fa-solid fa-rotate-right" aria-hidden="true"></i>
          </button>
          <button type="button" class="btn btn-sm btn-icon btn-move-up" data-idx="${index}" title="Move earlier" aria-label="Move page ${index + 1} earlier" ${index === 0 ? 'disabled' : ''}>
            <i class="fa-solid fa-arrow-up" aria-hidden="true"></i>
          </button>
          <button type="button" class="btn btn-sm btn-icon btn-move-down" data-idx="${index}" title="Move later" aria-label="Move page ${index + 1} later" ${index === items.length - 1 ? 'disabled' : ''}>
            <i class="fa-solid fa-arrow-down" aria-hidden="true"></i>
          </button>
          <button type="button" class="btn btn-sm btn-icon btn-danger-ghost btn-del" data-idx="${index}" title="Remove page" aria-label="Remove page ${index + 1}, ${escapeHTML(item.name)}">
            <i class="fa-regular fa-trash-can" aria-hidden="true"></i>
          </button>
        </div>
      `;

      imageListContainer.appendChild(card);
    });

    // Attach row events. After a re-render, focus follows the page that moved,
    // so keyboard and screen reader users keep their place.
    imageListContainer.querySelectorAll('.btn-move-up').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx, 10);
        if (idx > 0) {
          const temp = items[idx];
          items[idx] = items[idx - 1];
          items[idx - 1] = temp;
          renderList({ idx: idx - 1, sel: idx - 1 === 0 ? '.btn-move-down' : '.btn-move-up' });
        }
      });
    });

    imageListContainer.querySelectorAll('.btn-move-down').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx, 10);
        if (idx < items.length - 1) {
          const temp = items[idx];
          items[idx] = items[idx + 1];
          items[idx + 1] = temp;
          renderList({ idx: idx + 1, sel: idx + 1 === items.length - 1 ? '.btn-move-up' : '.btn-move-down' });
        }
      });
    });

    imageListContainer.querySelectorAll('.btn-rotate').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx, 10);
        items[idx].rotation = (items[idx].rotation + 90) % 360;
        renderList({ idx, sel: '.btn-rotate' });
      });
    });

    imageListContainer.querySelectorAll('.btn-del').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx, 10);
        items.splice(idx, 1).forEach(release);
        renderList(items.length ? { idx: Math.min(idx, items.length - 1), sel: '.btn-del' } : null);
        if (!items.length && btnBrowse) btnBrowse.focus();
      });
    });

    imageListContainer.querySelectorAll('.page-row__handle').forEach(handle => {
      handle.addEventListener('pointerdown', startDrag);
      handle.addEventListener('keydown', e => {
        const idx = parseInt(handle.dataset.idx, 10);
        const step = { ArrowUp: -1, ArrowLeft: -1, ArrowDown: 1, ArrowRight: 1 }[e.key];
        if (!step) return;
        e.preventDefault();
        moveItem(idx, idx + step);
      });
    });

    if (focus) {
      const row = imageListContainer.children[focus.idx];
      const target = row && row.querySelector(focus.sel);
      if (target) target.focus();
    }
  }

  // Move one page to a new position, then keep focus on its reorder handle.
  function moveItem(from, to) {
    if (to < 0 || to >= items.length || from === to) return;
    const [item] = items.splice(from, 1);
    items.splice(to, 0, item);
    renderList({ idx: to, sel: '.page-row__handle' });
    announce(`Page moved to position ${to + 1} of ${items.length}.`);
  }

  function announce(message) {
    const live = doc.getElementById('pageOrderStatus');
    if (live) live.textContent = message;
  }

  // Pointer drag (mouse, pen and touch) from the handle. The handle has touch-action: none,
  // so dragging it never scrolls the page; the rest of the tile still scrolls normally.
  let drag = null;
  function startDrag(e) {
    if (e.button !== undefined && e.button !== 0) return;
    const handle = e.currentTarget;
    const row = handle.closest('.page-row');
    if (!row) return;
    e.preventDefault();
    handle.setPointerCapture(e.pointerId);
    const rect = row.getBoundingClientRect();
    drag = { handle, row, from: parseInt(handle.dataset.idx, 10), to: null, startX: e.clientX, startY: e.clientY, moved: false, rect };
    handle.addEventListener('pointermove', onDragMove);
    handle.addEventListener('pointerup', endDrag);
    handle.addEventListener('pointercancel', cancelDrag);
    doc.addEventListener('keydown', onDragKey, true);
  }
  function rowAt(x, y) {
    const rows = Array.from(imageListContainer.children);
    for (let i = 0; i < rows.length; i++) {
      if (drag && rows[i] === drag.row) continue; // the dragged tile follows the pointer; look beneath it
      const r = rows[i].getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return i;
    }
    return null;
  }
  function onDragMove(e) {
    if (!drag) return;
    const dx = e.clientX - drag.startX, dy = e.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) < 4) return;
    drag.moved = true;
    drag.row.classList.add('is-dragging');
    drag.row.style.transform = `translate(${dx}px, ${dy}px)`;
    const over = rowAt(e.clientX, e.clientY);
    imageListContainer.querySelectorAll('.is-drop-target').forEach(el => el.classList.remove('is-drop-target'));
    if (over !== null && over !== drag.from) imageListContainer.children[over].classList.add('is-drop-target');
    drag.to = over;
    // Keep the drop area reachable on a long list.
    const edge = 72;
    if (e.clientY < edge) window.scrollBy(0, -12);
    else if (e.clientY > window.innerHeight - edge) window.scrollBy(0, 12);
  }
  function finishDrag() {
    if (!drag) return null;
    const { handle, row } = drag;
    handle.removeEventListener('pointermove', onDragMove);
    handle.removeEventListener('pointerup', endDrag);
    handle.removeEventListener('pointercancel', cancelDrag);
    doc.removeEventListener('keydown', onDragKey, true);
    row.classList.remove('is-dragging');
    row.style.transform = '';
    imageListContainer.querySelectorAll('.is-drop-target').forEach(el => el.classList.remove('is-drop-target'));
    const done = drag;
    drag = null;
    return done;
  }
  function endDrag() {
    const done = finishDrag();
    if (done && done.moved && done.to !== null) moveItem(done.from, done.to);
  }
  function cancelDrag() { finishDrag(); }
  function onDragKey(e) {
    if (e.key === 'Escape' && drag) { e.preventDefault(); cancelDrag(); }
  }

  function clearAll() {
    items.forEach(release);
    items = [];
    hideSkipped();
    if (fileInput) fileInput.value = '';
    if (addMoreInput) addMoreInput.value = '';
    if (pdfBlobUrl) {
      URL.revokeObjectURL(pdfBlobUrl);
      pdfBlobUrl = null;
    }
    renderList();
  }

  async function generatePdf() {
    if (isConverting || !items.length) return;
    isConverting = true;
    btnConvert.disabled = true;
    btnConvert.innerHTML = '<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> Generating PDF…';

    try {
      const pageSize = pageSizeSelect ? pageSizeSelect.value : 'a4';
      const orientMode = orientationSelect ? orientationSelect.value : 'auto';
      const marginVal = marginSelect ? parseInt(marginSelect.value, 10) : 20;
      const quality = qualitySelect ? parseFloat(qualitySelect.value) : 0.85;

      // Array of page definitions: { pageWidth, pageHeight, imgWidthPt, imgHeightPt, imgX, imgY, jpegBytes }
      const pages = [];

      for (const item of items) {
        // Draw to offscreen canvas to standardize to JPEG bytes
        const { w: itemW, h: itemH } = turned(item);
        // Phone cameras produce 24 to 50 MP photos, beyond the canvas limit of mobile browsers.
        // 4000 px on the long side is still over 300 DPI on an A4 or Letter page.
        const k = Math.min(1, MAX_SIDE_PX / Math.max(itemW, itemH));
        const canvas = doc.createElement('canvas');
        canvas.width = Math.max(1, Math.round(itemW * k));
        canvas.height = Math.max(1, Math.round(itemH * k));
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Decoded only while its page is drawn, so a long list of phone photos never sits in memory at once.
        const opened = await openForDrawing(item);
        try {
          ctx.translate(canvas.width / 2, canvas.height / 2);
          ctx.rotate(item.rotation * Math.PI / 180);
          ctx.scale(k, k);
          ctx.drawImage(opened.source, -item.width / 2, -item.height / 2, item.width, item.height);
        } finally { opened.close(); }

        const jpegBlob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', quality));
        if (!jpegBlob) throw new Error('"' + item.name + '" is too large for this browser to convert');
        const jpegBuffer = await jpegBlob.arrayBuffer();
        const jpegBytes = new Uint8Array(jpegBuffer);

        // Calculate page size and orientation
        let isLandscape = false;
        if (orientMode === 'landscape') {
          isLandscape = true;
        } else if (orientMode === 'portrait') {
          isLandscape = false;
        } else {
          // Auto: match image aspect ratio
          isLandscape = itemW > itemH;
        }

        let pw, ph;
        if (pageSize === 'letter') {
          pw = isLandscape ? LETTER_H : LETTER_W;
          ph = isLandscape ? LETTER_W : LETTER_H;
        } else if (pageSize === 'fit') {
          // Convert pixels to 72dpi points: pt = px * 72 / 150
          pw = Math.max(72, Math.round(itemW * 0.5));
          ph = Math.max(72, Math.round(itemH * 0.5));
        } else {
          // Default A4
          pw = isLandscape ? A4_H : A4_W;
          ph = isLandscape ? A4_W : A4_H;
        }

        // Available area inside margins
        const availW = Math.max(10, pw - (marginVal * 2));
        const availH = Math.max(10, ph - (marginVal * 2));

        // Proportional scale to fit within margin box
        const scale = Math.min(availW / itemW, availH / itemH);
        const drawW = itemW * scale;
        const drawH = itemH * scale;

        // Centered coordinates in PDF coordinate space (origin at bottom-left)
        const posX = marginVal + (availW - drawW) / 2;
        const posY = marginVal + (availH - drawH) / 2;

        pages.push({
          pageWidth: pw,
          pageHeight: ph,
          drawW,
          drawH,
          posX,
          posY,
          imgWidthPx: canvas.width,
          imgHeightPx: canvas.height,
          jpegBytes
        });
      }

      // Build Binary PDF 1.4
      const pdfBytes = assemblePdf(pages);
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });

      if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl);
      pdfBlobUrl = URL.createObjectURL(blob);

      btnDownload.href = pdfBlobUrl;
      btnDownload.download = `Document_${items.length}_Pages.pdf`;

      if (statPages) statPages.textContent = `${items.length} ${items.length === 1 ? 'Page' : 'Pages'}`;
      if (statSize) statSize.textContent = `${(blob.size / 1024).toFixed(1)} KB (${blob.size.toLocaleString()} bytes)`;

      if (resultArea) {
        resultArea.classList.remove('hidden');
        resultArea.scrollIntoView({ behavior: (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'), block: 'nearest' });
      }

    } catch (e) {
      notifyError('The PDF could not be created. ' + String(e.message).replace(/\.$/, '') + '. Remove the last image you added and try again.');
    } finally {
      isConverting = false;
      btnConvert.disabled = false;
      btnConvert.innerHTML = '<i class="fa-solid fa-file-pdf" aria-hidden="true"></i> Create PDF';
    }
  }

  async function openForDrawing(item) {
    const Ops = window.ApplyReadyImageOps;
    if (Ops) {
      try { return await Ops.openImage(item.file, { name: item.name }); }
      catch (e) { throw new Error((e && e.message ? e.message.replace(/\.$/, '') : '"' + item.name + '" could not be read')); }
    }
    const img = new Image();
    await new Promise((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error('"' + item.name + '" could not be read'));
      img.src = item.url;
    });
    return { source: img, close() {} };
  }

  /**
   * Pure Client-Side Binary PDF 1.4 Assembler
   */
  function assemblePdf(pages) {
    const chunks = [];
    const offsets = [];
    let currentOffset = 0;

    function writeStr(str) {
      const bytes = new TextEncoder().encode(str);
      chunks.push(bytes);
      currentOffset += bytes.length;
    }

    function writeBytes(bytes) {
      chunks.push(bytes);
      currentOffset += bytes.length;
    }

    function recordObj(num) {
      offsets[num] = currentOffset;
      writeStr(`${num} 0 obj\n`);
    }

    // 1. Header
    writeStr('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');

    // Obj 1: Catalog
    recordObj(1);
    writeStr('<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

    // Obj 2: Pages Root (Obj numbers for individual pages start at 3)
    const numPages = pages.length;
    const pageObjNums = [];
    // Page objects: each page takes 3 objects (Page, Content stream, Image XObject)
    for (let i = 0; i < numPages; i++) {
      pageObjNums.push(3 + (i * 3));
    }

    recordObj(2);
    writeStr(`<< /Type /Pages /Kids [${pageObjNums.map(n => `${n} 0 R`).join(' ')}] /Count ${numPages} >>\nendobj\n`);

    // Individual Pages
    for (let i = 0; i < numPages; i++) {
      const p = pages[i];
      const pageNum = pageObjNums[i];
      const contentNum = pageNum + 1;
      const imgNum = pageNum + 2;

      // Page Object
      recordObj(pageNum);
      writeStr(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${p.pageWidth.toFixed(2)} ${p.pageHeight.toFixed(2)}] /Contents ${contentNum} 0 R /Resources << /XObject << /Im1 ${imgNum} 0 R >> >> >>\nendobj\n`);

      // Content Stream
      // Draw image using cm matrix: q <w> 0 0 <h> <x> <y> cm /Im1 Do Q
      const streamStr = `q ${p.drawW.toFixed(2)} 0 0 ${p.drawH.toFixed(2)} ${p.posX.toFixed(2)} ${p.posY.toFixed(2)} cm /Im1 Do Q\n`;
      const streamBytes = new TextEncoder().encode(streamStr);

      recordObj(contentNum);
      writeStr(`<< /Length ${streamBytes.length} >>\nstream\n`);
      writeBytes(streamBytes);
      writeStr('endstream\nendobj\n');

      // Image XObject
      recordObj(imgNum);
      writeStr(`<< /Type /XObject /Subtype /Image /Width ${p.imgWidthPx} /Height ${p.imgHeightPx} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpegBytes.length} >>\nstream\n`);
      writeBytes(p.jpegBytes);
      writeStr('\nendstream\nendobj\n');
    }

    // XRef Table
    const totalObjs = 2 + (numPages * 3);
    const xrefOffset = currentOffset;
    writeStr(`xref\n0 ${totalObjs + 1}\n0000000000 65535 f \n`);
    for (let i = 1; i <= totalObjs; i++) {
      const off = String(offsets[i] || 0).padStart(10, '0');
      writeStr(`${off} 00000 n \n`);
    }

    // Trailer
    writeStr(`trailer\n<< /Size ${totalObjs + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);

    // Concatenate chunks into single Uint8Array
    const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
    const out = new Uint8Array(totalLength);
    let pos = 0;
    for (const c of chunks) {
      out.set(c, pos);
      pos += c.length;
    }

    return out;
  }

  function escapeHTML(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
