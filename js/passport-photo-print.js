/**
 * ApplyReady - Passport Photo Print Sheet Maker
 * 100% Client-Side In-Browser Tool
 * Tiles passport photos on standard 4x6" photo card or A4 paper
 * with exact millimeter dimensions, scissor cutting guidelines,
 * and exports 300 DPI printable JPEG and vector-scaled PDF.
 * Zero server uploads.
 */

(function () {
  'use strict';
  // Errors use the site's notification instead of a blocking browser dialog.
  const notifyError = message => (window.ApplyReadyUI && window.ApplyReadyUI.notify) ? window.ApplyReadyUI.notify(message, true) : window.alert(message);

  const doc = typeof document !== 'undefined' ? document : null;
  if (!doc) return;

  const dropzone = doc.getElementById('printDropzone');
  const fileInput = doc.getElementById('printFileInput');
  const btnBrowse = doc.getElementById('btnPrintBrowse');
  const fileInfoBox = doc.getElementById('printFileInfoBox');
  const fileInfoText = doc.getElementById('printFileInfoText');
  const btnRemoveFile = doc.getElementById('btnPrintRemove');
  const btnReplaceFile = doc.getElementById('btnPrintReplace');

  const photoSizeSelect = doc.getElementById('photoSizeSelect');
  const paperSizeSelect = doc.getElementById('paperSizeSelect');
  const photoCountSelect = doc.getElementById('photoCountSelect');
  const photoCountHint = doc.getElementById('photoCountSelectHint');
  const guideLinesCheckbox = doc.getElementById('guideLinesCheckbox');
  const photoBorderCheckbox = doc.getElementById('photoBorderCheckbox');
  const gapSelect = doc.getElementById('gapSelect');

  const sheetCanvas = doc.getElementById('sheetCanvas');
  const previewArea = doc.getElementById('printPreviewArea');

  const statPaper = doc.getElementById('statPrintPaper');
  const statPhotos = doc.getElementById('statPrintCount');
  const statDpi = doc.getElementById('statPrintDpi');

  const btnDownloadJpg = doc.getElementById('btnDownloadPrintJpg');
  const btnDownloadPdf = doc.getElementById('btnDownloadPrintPdf');
  let jpgPending = false, jpgWanted = false;
  // Each render gets a number; an encode that finishes after a newer render, or after Remove,
  // is thrown away so it can never put an earlier photo back behind the download button.
  let renderGen = 0;
  if (btnDownloadJpg) btnDownloadJpg.addEventListener('click', e => {
    if (!loadedImage) { e.preventDefault(); return; }
    if (jpgPending) { e.preventDefault(); jpgWanted = true; }
  });

  // Photo size dimensions in mm: { w, h }
  const PHOTO_SIZES = {
    'in-passport': { name: 'Indian Passport (3.5 × 4.5 cm)', w: 35, h: 45 },
    'us-visa': { name: 'US / International Visa (2 × 2 in / 5.1 × 5.1 cm)', w: 50.8, h: 50.8 },
    'stamp': { name: 'Stamp Size (2.5 × 3.5 cm)', w: 25, h: 35 },
    'schengen': { name: 'Schengen Visa (3.5 × 4.5 cm)', w: 35, h: 45 }
  };

  // Paper sizes in mm: { w, h, name }
  const PAPER_SIZES = {
    '4x6': { name: '4 × 6 inch Photo Paper (102 × 152 mm)', label: '4 × 6 inch paper', w: 101.6, h: 152.4 },
    'a4': { name: 'A4 Sheet (210 × 297 mm)', label: 'an A4 sheet', w: 210, h: 297 },
    '5x7': { name: '5 × 7 inch Photo Paper (127 × 178 mm)', label: '5 × 7 inch paper', w: 127, h: 177.8 }
  };

  const DPI = 300; // 300 dots per inch (standard professional print resolution)
  const MM_TO_INCH = 1 / 25.4;

  let loadedImage = null;
  let loadedFile = null;
  let currentPaper = null;
  let loadToken = 0;
  let jpgBlobUrl = null;
  let pdfBlobUrl = null;

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
        handleFile(e.dataTransfer.files[0]);
      }
    });

    fileInput.addEventListener('change', () => {
      const file = fileInput.files && fileInput.files[0];
      // Cleared at once, so choosing the same file again (after Remove or Replace) still works.
      fileInput.value = '';
      if (file) handleFile(file);
    });

    if (btnRemoveFile) btnRemoveFile.addEventListener('click', resetAll);
    if (btnDownloadPdf) btnDownloadPdf.addEventListener('click', e => {
      e.preventDefault();
      if (loadedImage && currentPaper) generatePrintPdf(currentPaper);
    });
    if (btnReplaceFile) btnReplaceFile.addEventListener('click', () => fileInput.click());

    // Controls change listeners
    [photoSizeSelect, paperSizeSelect, photoCountSelect, guideLinesCheckbox, photoBorderCheckbox, gapSelect].forEach(ctl => {
      if (ctl) ctl.addEventListener('change', renderSheet);
    });
  }

  async function handleFile(file) {
    if (!file) return;
    // Taken before the content check, so a Remove pressed while it runs still wins.
    const token = ++loadToken;
    // Identify the file by its content, not its name or the type the browser reports.
    if (window.ApplyReadyFiles) {
      const check = await window.ApplyReadyFiles.validate(file, ['image'], window.ApplyReadyFiles.LIMITS.image);
      if (token !== loadToken) return;
      if (!check.ok) { notifyError(check.error); return; }
    } else if (!file.type.startsWith('image/')) {
      notifyError('That file is not a JPG or PNG photo. Choose a passport photo and try again.');
      return;
    }

    // The same checks as the batch tools: a picture over 50 megapixels is refused before it is
    // decoded (the sheet keeps it in memory), and a truncated or damaged file is refused instead of
    // being printed six times with a blank part.
    const Ops = window.ApplyReadyImageOps;
    let opened;
    try {
      opened = Ops ? await Ops.openImage(file, { name: file.name }) : await openWithImg(file);
    } catch (e) {
      if (token === loadToken) notifyError((e && e.message) || 'That photo could not be read. Choose a JPG or PNG that opens on your device, then try again.');
      return;
    }
    if (token !== loadToken) { opened.close(); return; }   // removed or replaced while it was loading
    releaseImage();
    loadedFile = file;
    loadedImage = opened;
    if (fileInfoBox) fileInfoBox.classList.remove('hidden');
    if (fileInfoText) fileInfoText.textContent = `${file.name} (${opened.width} × ${opened.height} px)`;
    // The drop zone, with the button that opened the picker, is about to be hidden: keep keyboard
    // focus on the page, on the file bar's Replace button.
    const a = doc.activeElement;
    const focusLost = !a || a === doc.body || (dropzone && dropzone.contains(a));
    if (dropzone) dropzone.classList.add('hidden');
    if (previewArea) previewArea.classList.remove('hidden');
    // The workspace shows its file bar from a MutationObserver (js/components.js), so wait for it.
    if (focusLost && btnReplaceFile) {
      setTimeout(() => {
        const now = doc.activeElement;
        if (!now || now === doc.body || (dropzone && dropzone.contains(now))) btnReplaceFile.focus({ preventScroll: true });
      }, 0);
    }
    renderSheet();
    if (window.ApplyReadyUI && window.ApplyReadyUI.reveal && previewArea) window.ApplyReadyUI.reveal(previewArea.closest('section') || previewArea);
  }

  // Only for a browser without js/lib/image-ops.js loaded.
  function openWithImg(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve({ source: img, width: img.naturalWidth, height: img.naturalHeight, close() {} }); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That photo could not be read. Choose a JPG or PNG that opens on your device, then try again.')); };
      img.src = url;
    });
  }

  // The photo is kept decoded while the sheet is shown (every setting redraws it); this frees it.
  function releaseImage() {
    if (loadedImage) loadedImage.close();
    loadedImage = null;
  }

  function renderSheet() {
    if (!loadedImage || !sheetCanvas) return;

    const photoKey = photoSizeSelect ? photoSizeSelect.value : 'in-passport';
    const paperKey = paperSizeSelect ? paperSizeSelect.value : '4x6';
    const photoSpec = PHOTO_SIZES[photoKey] || PHOTO_SIZES['in-passport'];
    const paperSpec = PAPER_SIZES[paperKey] || PAPER_SIZES['4x6'];

    const gapMm = gapSelect ? parseFloat(gapSelect.value) : 2.5;
    const showGuides = guideLinesCheckbox && guideLinesCheckbox.checked;
    const showBorder = photoBorderCheckbox && photoBorderCheckbox.checked;

    // Convert paper mm to 300 DPI pixels
    const canvasW = Math.round(paperSpec.w * MM_TO_INCH * DPI);
    const canvasH = Math.round(paperSpec.h * MM_TO_INCH * DPI);

    sheetCanvas.width = canvasW;
    sheetCanvas.height = canvasH;
    const ctx = sheetCanvas.getContext('2d');
    currentPaper = paperSpec;

    // Fill white paper background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasW, canvasH);

    // Photo size in pixels at 300 DPI
    const photoW = Math.round(photoSpec.w * MM_TO_INCH * DPI);
    const photoH = Math.round(photoSpec.h * MM_TO_INCH * DPI);
    const gapPx = Math.round(gapMm * MM_TO_INCH * DPI);

    // Calculate maximum rows and cols that fit
    const marginMm = 6; // 6 mm paper edge margin
    const marginPx = Math.round(marginMm * MM_TO_INCH * DPI);

    const usableW = canvasW - (marginPx * 2);
    const usableH = canvasH - (marginPx * 2);

    const maxCols = Math.max(1, Math.floor((usableW + gapPx) / (photoW + gapPx)));
    const maxRows = Math.max(1, Math.floor((usableH + gapPx) / (photoH + gapPx)));
    const maxCapacity = maxCols * maxRows;

    let targetCount = maxCapacity;
    let requested = 0;
    if (photoCountSelect && photoCountSelect.value !== 'auto') {
      requested = parseInt(photoCountSelect.value, 10);
      if (requested > 0) targetCount = Math.min(requested, maxCapacity);
    }
    describeCapacity(requested, maxCapacity, paperKey, paperSpec);

    // Determine actual cols and rows needed for targetCount
    let cols = Math.min(maxCols, targetCount);
    let rows = Math.ceil(targetCount / cols);

    // Center the grid on the paper
    const gridW = (cols * photoW) + ((cols - 1) * gapPx);
    const gridH = (rows * photoH) + ((rows - 1) * gapPx);
    const startX = Math.round((canvasW - gridW) / 2);
    const startY = Math.round((canvasH - gridH) / 2);

    let drawn = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (drawn >= targetCount) break;

        const x = startX + (c * (photoW + gapPx));
        const y = startY + (r * (photoH + gapPx));

        // Draw photo with proportional cover cropping
        drawCoverPhoto(ctx, loadedImage, x, y, photoW, photoH);

        // Optional thin black photo border
        if (showBorder) {
          ctx.strokeStyle = '#222222';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(x, y, photoW, photoH);
        }

        // Optional cutting guidelines (thin dashed border outside)
        if (showGuides) {
          ctx.save();
          ctx.strokeStyle = '#9ca3af';
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 4]);
          const guideOffset = Math.round(gapPx / 2) || 4;
          // Draw dashed guide ticks
          ctx.beginPath();
          // Top line
          ctx.moveTo(x - guideOffset, y - guideOffset);
          ctx.lineTo(x + photoW + guideOffset, y - guideOffset);
          // Right line
          ctx.lineTo(x + photoW + guideOffset, y + photoH + guideOffset);
          // Bottom line
          ctx.lineTo(x - guideOffset, y + photoH + guideOffset);
          // Left line
          ctx.closePath();
          ctx.stroke();
          ctx.restore();
        }

        drawn++;
      }
    }

    // Update Stats
    if (statPaper) statPaper.textContent = paperSpec.name.split(' (')[0];
    if (statPhotos) statPhotos.textContent = `${drawn} Photos (${photoSpec.w} × ${photoSpec.h} mm)`;
    if (statDpi) statDpi.textContent = '300 DPI (High-Res)';

    updateDownloadLinks(drawn, paperSpec, canvasW, canvasH);
  }

  // Under Copies: how many photos of this size fit on this paper, and, when more were asked for than
  // fit, that the sheet has fewer and what to change.
  function describeCapacity(requested, capacity, paperKey, paperSpec) {
    if (!photoCountHint) return;
    const over = requested > capacity;
    let text = `${capacity} ${capacity === 1 ? 'photo' : 'photos'} of this size fit on ${paperSpec.label}.`;
    if (over) {
      text = `Only ${capacity} ${capacity === 1 ? 'photo' : 'photos'} of this size fit on ${paperSpec.label}, so the sheet has ${capacity}, not ${requested}. ` +
        (paperKey === 'a4' ? 'Print the sheet twice for more.' : 'Choose an A4 sheet for more, or print the sheet twice.');
    }
    if (photoCountHint.textContent !== text) photoCountHint.textContent = text;
    photoCountHint.classList.toggle('is-warning', over);
  }

  function drawCoverPhoto(ctx, img, dx, dy, dw, dh) {
    const srcW = img.width;
    const srcH = img.height;
    const srcAspect = srcW / srcH;
    const targetAspect = dw / dh;

    let sx = 0, sy = 0, sw = srcW, sh = srcH;
    if (srcAspect > targetAspect) {
      // Source is wider: crop sides
      sw = Math.round(srcH * targetAspect);
      sx = Math.round((srcW - sw) / 2);
    } else {
      // Source is taller: crop top/bottom
      sh = Math.round(srcW / targetAspect);
      sy = Math.round((srcH - sh) / 2);
    }

    ctx.drawImage(img.source, sx, sy, sw, sh, dx, dy, dw, dh);
  }


  /**
   * Record 300 DPI in the JPEG, so photo labs and image viewers read the sheet at its real size
   * (4 × 6 in) instead of the 96 DPI default. The pixels are untouched (js/lib/image-ops.js).
   */
  function withDensity(blob, dpi) {
    const Ops = window.ApplyReadyImageOps;
    return Ops && Ops.setDensity ? Ops.setDensity(blob, dpi) : Promise.resolve(blob);
  }

  function updateDownloadLinks(count, paperSpec, canvasW, canvasH) {
    if (!sheetCanvas) return;

    // 1. High-Res JPEG blob. Encoding takes a moment; a click that lands before it is ready
    //    downloads the new sheet as soon as it exists, never the previous one.
    jpgPending = true;
    const gen = ++renderGen;
    sheetCanvas.toBlob(async rawBlob => {
      if (gen !== renderGen || !loadedImage) return;   // a newer sheet, or the photo was removed
      if (!rawBlob) {
        jpgPending = false;
        jpgWanted = false;
        notifyError('The sheet could not be saved as JPEG. The device may be low on memory; choose fewer copies or a smaller paper size.');
        return;
      }
      const blob = await withDensity(rawBlob, DPI);
      if (gen !== renderGen || !loadedImage) return;
      if (jpgBlobUrl) URL.revokeObjectURL(jpgBlobUrl);
      jpgBlobUrl = URL.createObjectURL(blob);

      if (btnDownloadJpg) {
        btnDownloadJpg.href = jpgBlobUrl;
        btnDownloadJpg.download = `Passport_Photos_${count}_Copies_300DPI.jpg`;
      }
      jpgPending = false;
      if (jpgWanted && btnDownloadJpg) { jpgWanted = false; btnDownloadJpg.click(); }
    }, 'image/jpeg', 0.95);

    // 2. The PDF is built on demand from the sheet on screen (click handler in init).
  }

  async function generatePrintPdf(paperSpec) {
    if (!sheetCanvas || !loadedImage) return;
    const gen = renderGen;

    const paperPtW = (paperSpec.w * MM_TO_INCH) * 72;
    const paperPtH = (paperSpec.h * MM_TO_INCH) * 72;

    const jpegBlob = await new Promise(res => sheetCanvas.toBlob(res, 'image/jpeg', 0.95));
    if (!loadedImage) return;                                         // removed while encoding
    if (gen !== renderGen) { generatePrintPdf(currentPaper); return; }  // settings changed: build the new sheet
    if (!jpegBlob) { notifyError('The PDF could not be created. The device may be low on memory; choose fewer copies or a smaller paper size.'); return; }
    const jpegBuffer = await jpegBlob.arrayBuffer();
    const jpegBytes = new Uint8Array(jpegBuffer);

    // PDF Assembly
    const chunks = [];
    const offsets = [];
    let currentOffset = 0;

    function writeStr(s) {
      const b = new TextEncoder().encode(s);
      chunks.push(b);
      currentOffset += b.length;
    }
    function writeBytes(b) {
      chunks.push(b);
      currentOffset += b.length;
    }
    function recordObj(num) {
      offsets[num] = currentOffset;
      writeStr(`${num} 0 obj\n`);
    }

    writeStr('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
    recordObj(1);
    writeStr('<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

    recordObj(2);
    writeStr('<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');

    // Page 3
    recordObj(3);
    writeStr(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${paperPtW.toFixed(2)} ${paperPtH.toFixed(2)}] /Contents 4 0 R /Resources << /XObject << /Im1 5 0 R >> >> >>\nendobj\n`);

    // Stream 4: fit whole canvas image to page points
    const streamStr = `q ${paperPtW.toFixed(2)} 0 0 ${paperPtH.toFixed(2)} 0 0 cm /Im1 Do Q\n`;
    const streamBytes = new TextEncoder().encode(streamStr);

    recordObj(4);
    writeStr(`<< /Length ${streamBytes.length} >>\nstream\n`);
    writeBytes(streamBytes);
    writeStr('endstream\nendobj\n');

    // Image XObject 5
    recordObj(5);
    writeStr(`<< /Type /XObject /Subtype /Image /Width ${sheetCanvas.width} /Height ${sheetCanvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`);
    writeBytes(jpegBytes);
    writeStr('\nendstream\nendobj\n');

    // XRef Table
    const totalObjs = 5;
    const xrefOffset = currentOffset;
    writeStr(`xref\n0 6\n0000000000 65535 f \n`);
    for (let i = 1; i <= totalObjs; i++) {
      writeStr(`${String(offsets[i] || 0).padStart(10, '0')} 00000 n \n`);
    }
    writeStr(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);

    const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
    const out = new Uint8Array(totalLength);
    let cur = 0;
    for (const c of chunks) {
      out.set(c, cur);
      cur += c.length;
    }

    const pdfBlob = new Blob([out], { type: 'application/pdf' });
    if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl);
    pdfBlobUrl = URL.createObjectURL(pdfBlob);

    const a = doc.createElement('a');
    a.href = pdfBlobUrl;
    a.download = `Passport_Print_Sheet_${paperSpec.name.split(' ')[0]}.pdf`;
    doc.body.appendChild(a);
    a.click();
    doc.body.removeChild(a);
  }

  // Remove leaves nothing of the photo behind: on a shared computer the next person must not be
  // able to see, download or print it.
  function resetAll() {
    releaseImage();
    loadedFile = null;
    currentPaper = null;
    renderGen++;
    loadToken++;
    jpgWanted = false;
    jpgPending = false;
    if (sheetCanvas) {
      const ctx = sheetCanvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, sheetCanvas.width, sheetCanvas.height);
      sheetCanvas.width = 0;
      sheetCanvas.height = 0;
    }
    if (btnDownloadJpg) { btnDownloadJpg.setAttribute('href', '#'); btnDownloadJpg.setAttribute('download', 'Passport_Photos_300DPI.jpg'); }
    if (jpgBlobUrl) {
      URL.revokeObjectURL(jpgBlobUrl);
      jpgBlobUrl = null;
    }
    if (pdfBlobUrl) {
      URL.revokeObjectURL(pdfBlobUrl);
      pdfBlobUrl = null;
    }
    if (fileInput) fileInput.value = '';
    if (fileInfoBox) fileInfoBox.classList.add('hidden');
    if (previewArea) previewArea.classList.add('hidden');
    if (dropzone) dropzone.classList.remove('hidden');
  }

  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
