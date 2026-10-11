/**
 * ApplyReady.in - Image to PDF Converter Engine
 * 100% Client-Side Pure Binary PDF 1.4 Generator
 * Supports multiple images (JPG, PNG, WebP), reordering,
 * A4/Letter/Fit Page, margins, orientations, and custom quality.
 * Zero external libraries or server uploads.
 */

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
  const emptyState = doc.getElementById('imgPdfEmptyState');
  const workspaceControls = doc.getElementById('workspaceControls');
  const btnConvert = doc.getElementById('btnConvertToPdf');
  const btnClearAll = doc.getElementById('btnClearAllImages');

  const resultArea = doc.getElementById('pdfResultArea');
  const statPages = doc.getElementById('statPdfPages');
  const statSize = doc.getElementById('statPdfSize');
  const btnDownload = doc.getElementById('btnDownloadPdf');

  // List of uploaded image items: { id, file, name, dataUrl, width, height }
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
  }

  function handleFiles(fileList) {
    const validFiles = Array.from(fileList).filter(f => f.type.startsWith('image/'));
    if (!validFiles.length) {
      notifyError('Those files could not be used. Choose JPG, PNG or WebP images.');
      return;
    }

    let loaded = 0;
    validFiles.forEach(file => {
      const id = 'img_' + Math.random().toString(36).substr(2, 9);
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          items.push({
            id,
            file,
            name: file.name,
            dataUrl: e.target.result,
            width: img.naturalWidth,
            height: img.naturalHeight
          });
          loaded++;
          if (loaded === validFiles.length) {
            renderList();
          }
        };
        img.onerror = () => {
          loaded++;
          notifyError('"' + file.name + '" could not be read as an image. Choose JPG, PNG or WebP files that open on your device.');
          if (loaded === validFiles.length) renderList();
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function renderList() {
    if (!imageListContainer) return;
    imageListContainer.innerHTML = '';

    if (items.length === 0) {
      if (emptyState) emptyState.classList.remove('hidden');
      if (workspaceControls) workspaceControls.classList.add('hidden');
      if (resultArea) resultArea.classList.add('hidden');
      return;
    }

    if (emptyState) emptyState.classList.add('hidden');
    if (workspaceControls) workspaceControls.classList.remove('hidden');

    items.forEach((item, index) => {
      const card = doc.createElement('div');
      card.className = 'app-card page-row';

      card.innerHTML = `
        <span class="page-row__num">#${index + 1}</span>
        <img class="page-row__thumb" src="${item.dataUrl}" alt="${escapeHTML(item.name)}">
        <div class="page-row__text">
          <strong class="page-row__name">${escapeHTML(item.name)}</strong>
          <span class="page-row__meta">${item.width} × ${item.height} px · ${(item.file.size / 1024).toFixed(1)} KB</span>
        </div>
        <div class="page-row__actions">
          <button type="button" class="btn btn-secondary btn-sm btn-move-up" data-idx="${index}" title="Move up" aria-label="Move ${escapeHTML(item.name)} up" ${index === 0 ? 'disabled' : ''}>
            <i class="fa-solid fa-arrow-up" aria-hidden="true"></i>
          </button>
          <button type="button" class="btn btn-secondary btn-sm btn-move-down" data-idx="${index}" title="Move down" aria-label="Move ${escapeHTML(item.name)} down" ${index === items.length - 1 ? 'disabled' : ''}>
            <i class="fa-solid fa-arrow-down" aria-hidden="true"></i>
          </button>
          <button type="button" class="btn btn-outline-danger btn-sm btn-del" data-idx="${index}" title="Remove" aria-label="Remove ${escapeHTML(item.name)}">
            <i class="fa-regular fa-trash-can" aria-hidden="true"></i>
          </button>
        </div>
      `;

      imageListContainer.appendChild(card);
    });

    // Attach row events
    imageListContainer.querySelectorAll('.btn-move-up').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx, 10);
        if (idx > 0) {
          const temp = items[idx];
          items[idx] = items[idx - 1];
          items[idx - 1] = temp;
          renderList();
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
          renderList();
        }
      });
    });

    imageListContainer.querySelectorAll('.btn-del').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx, 10);
        items.splice(idx, 1);
        renderList();
      });
    });
  }

  function clearAll() {
    items = [];
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
    btnConvert.innerHTML = '<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> Generating PDF...';

    try {
      const pageSize = pageSizeSelect ? pageSizeSelect.value : 'a4';
      const orientMode = orientationSelect ? orientationSelect.value : 'auto';
      const marginVal = marginSelect ? parseInt(marginSelect.value, 10) : 20;
      const quality = qualitySelect ? parseFloat(qualitySelect.value) : 0.85;

      // Array of page definitions: { pageWidth, pageHeight, imgWidthPt, imgHeightPt, imgX, imgY, jpegBytes }
      const pages = [];

      for (const item of items) {
        // Draw to offscreen canvas to standardize to JPEG bytes
        const canvas = doc.createElement('canvas');
        canvas.width = item.width;
        canvas.height = item.height;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const img = new Image();
        img.src = item.dataUrl;
        await new Promise(res => {
          if (img.complete) return res();
          img.onload = () => res();
        });
        ctx.drawImage(img, 0, 0);

        const jpegBlob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', quality));
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
          isLandscape = item.width > item.height;
        }

        let pw, ph;
        if (pageSize === 'letter') {
          pw = isLandscape ? LETTER_H : LETTER_W;
          ph = isLandscape ? LETTER_W : LETTER_H;
        } else if (pageSize === 'fit') {
          // Convert pixels to 72dpi points: pt = px * 72 / 150
          pw = Math.max(72, Math.round(item.width * 0.5));
          ph = Math.max(72, Math.round(item.height * 0.5));
        } else {
          // Default A4
          pw = isLandscape ? A4_H : A4_W;
          ph = isLandscape ? A4_W : A4_H;
        }

        // Available area inside margins
        const availW = Math.max(10, pw - (marginVal * 2));
        const availH = Math.max(10, ph - (marginVal * 2));

        // Proportional scale to fit within margin box
        const scale = Math.min(availW / item.width, availH / item.height);
        const drawW = item.width * scale;
        const drawH = item.height * scale;

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
          imgWidthPx: item.width,
          imgHeightPx: item.height,
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
        resultArea.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }

    } catch (e) {
      notifyError('The PDF could not be created. ' + String(e.message).replace(/\.$/, '') + '. Remove the last image you added and try again.');
    } finally {
      isConverting = false;
      btnConvert.disabled = false;
      btnConvert.innerHTML = '<i class="fa-solid fa-file-pdf" aria-hidden="true"></i> Convert to PDF';
    }
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
