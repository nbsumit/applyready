/**
 * ApplyReady.in - PDF Compressor Engine
 * 100% Client-Side In-Browser Tool
 * Compresses document PDFs and document scans to target KB limits
 * (100 KB, 200 KB, 300 KB, 500 KB) for government recruitment portals.
 * Zero server uploads.
 */

(function () {
  'use strict';
  // Errors use the site's notification instead of a blocking browser dialog.
  const notifyError = message => (window.ApplyReadyUI && window.ApplyReadyUI.notify) ? window.ApplyReadyUI.notify(message, true) : window.alert(message);

  const doc = typeof document !== 'undefined' ? document : null;
  if (!doc) return;

  const dropzone = doc.getElementById('compressDropzone');
  const fileInput = doc.getElementById('compressFileInput');
  const btnBrowse = doc.getElementById('btnCompressBrowse');
  const fileInfoBox = doc.getElementById('compressFileInfoBox');
  const fileInfoText = doc.getElementById('compressFileInfoText');
  const btnRemoveFile = doc.getElementById('btnCompressRemove');
  const btnReplaceFile = doc.getElementById('btnCompressReplace');

  const targetKbInput = doc.getElementById('targetKbInput');
  const targetKbButtons = doc.querySelectorAll('.preset-kb-btn');
  const btnStartCompress = doc.getElementById('btnStartCompress');

  const progressBox = doc.getElementById('compressProgressBox');
  const progressBar = doc.getElementById('compressProgressBar');
  const progressText = doc.getElementById('compressProgressText');

  const resultArea = doc.getElementById('compressResultArea');
  const statOriginal = doc.getElementById('statOrigSize');
  const statCompressed = doc.getElementById('statCompSize');
  const statReduction = doc.getElementById('statReduction');
  const statPages = doc.getElementById('statCompPages');
  const btnDownload = doc.getElementById('btnDownloadCompressedPdf');

  let currentFile = null;
  let compressedBlobUrl = null;
  let isCompressing = false;

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
      if (fileInput.files && fileInput.files.length) {
        handleFile(fileInput.files[0]);
      }
    });

    if (btnRemoveFile) btnRemoveFile.addEventListener('click', resetAll);
    if (btnReplaceFile) btnReplaceFile.addEventListener('click', () => fileInput.click());

    // Target KB preset buttons
    targetKbButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        targetKbButtons.forEach(b => {
          b.classList.remove('active');
          b.setAttribute('aria-pressed', 'false');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-pressed', 'true');
        if (targetKbInput) targetKbInput.value = btn.dataset.kb;
      });
    });

    if (targetKbInput) {
      targetKbInput.addEventListener('input', () => {
        targetKbButtons.forEach(b => {
          const match = b.dataset.kb === targetKbInput.value;
          b.classList.toggle('active', match);
          b.setAttribute('aria-pressed', String(match));
        });
      });
    }

    if (btnStartCompress) {
      btnStartCompress.addEventListener('click', compressDocument);
    }
  }

  function handleFile(file) {
    if (!file) return;
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const isImg = file.type.startsWith('image/');

    if (!isPdf && !isImg) {
      notifyError('That file is not a PDF, JPG or PNG. Choose a PDF or a photo of the document.');
      return;
    }

    currentFile = file;
    if (fileInfoBox) fileInfoBox.classList.remove('hidden');
    if (fileInfoText) fileInfoText.textContent = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
    if (dropzone) dropzone.classList.add('hidden');
    if (btnStartCompress) btnStartCompress.disabled = false;
    if (resultArea) resultArea.classList.add('hidden');
  }

  async function compressDocument() {
    if (!currentFile || isCompressing) return;
    isCompressing = true;
    btnStartCompress.disabled = true;

    if (progressBox) progressBox.classList.remove('hidden');
    if (resultArea) resultArea.classList.add('hidden');
    updateProgress(15, 'Reading document…');

    try {
      const targetKB = parseInt(targetKbInput ? targetKbInput.value : '200', 10) || 200;
      lastTargetKB = targetKB;
      const isPdf = currentFile.type === 'application/pdf' || currentFile.name.toLowerCase().endsWith('.pdf');

      let pages = [];

      // A PDF that already fits is returned as it is: re-encoding its pages can only lose detail,
      // and can even make the file larger.
      if (isPdf && currentFile.size <= targetKB * 1024) {
        updateProgress(100, 'Complete!');
        displayResult(currentFile, null, 'fits');
        return;
      }

      if (isPdf) {
        updateProgress(30, 'Extracting document pages…');
        const buffer = await currentFile.arrayBuffer();
        pages = await extractPagesFromPdf(buffer);

        if (!pages.length) {
          // If no embedded DCTDecode images could be parsed, wrap original or notify
          throw new Error('This tool works best for scanned documents and image-based PDFs. Your PDF appears to contain selectable text or vector forms with no embedded page images to compress. If your file is already under the portal size limit, you can upload it directly.');
        }
      } else {
        updateProgress(30, 'Processing document image…');
        const dataUrl = await new Promise(res => {
          const r = new FileReader();
          r.onload = e => res(e.target.result);
          r.readAsDataURL(currentFile);
        });
        const img = new Image();
        img.src = dataUrl;
        await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error('The image could not be read')); });
        pages.push({
          width: img.naturalWidth,
          height: img.naturalHeight,
          imgElement: img
        });
      }

      updateProgress(55, `Compressing ${pages.length} ${pages.length === 1 ? 'page' : 'pages'} to under ${targetKB} KB…`);

      // Allocate target budget per page
      // PDF envelope overhead ~1.5 KB
      const targetTotalBytes = targetKB * 1024;
      const budgetPerImage = Math.max(8192, Math.floor((targetTotalBytes - 2048) / pages.length));

      const processedPages = [];
      for (let i = 0; i < pages.length; i++) {
        const p = pages[i];
        updateProgress(55 + Math.round((i / pages.length) * 35), `Compressing page ${i + 1} of ${pages.length}…`);

        const compressedJpeg = await compressPageImage(p, budgetPerImage);
        processedPages.push(compressedJpeg);
      }

      updateProgress(95, 'Assembling optimized PDF…');
      const pdfBytes = assemblePdfDocument(processedPages);
      const outputBlob = new Blob([pdfBytes], { type: 'application/pdf' });

      updateProgress(100, 'Done!');
      // Never hand back a PDF that is larger than the one the person started with.
      if (isPdf && outputBlob.size >= currentFile.size) displayResult(currentFile, pages.length, 'larger');
      else displayResult(outputBlob, pages.length);

    } catch (err) {
      notifyError('Compression did not finish. ' + String(err.message).replace(/\.$/, '') + '. Check that the file opens on your device, then try again.');
    } finally {
      isCompressing = false;
      btnStartCompress.disabled = false;
      if (progressBox) progressBox.classList.add('hidden');
    }
  }

  function updateProgress(percent, msg) {
    if (progressBar) progressBar.style.width = `${percent}%`;
    if (progressText) progressText.textContent = msg;
  }

  /**
   * Read the page boxes of a PDF whose page dictionaries are stored uncompressed
   * (scanner output, print-to-PDF, this site's image to PDF tool). Returns one
   * [width, height] in points per /MediaBox found, in file order, or [] when the
   * page dictionaries are inside compressed object streams and cannot be read here.
   */
  function readMediaBoxes(bytes) {
    const text = new TextDecoder('latin1').decode(bytes);
    const boxes = [];
    const re = /\/MediaBox\s*\[\s*(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s*\]/g;
    let m;
    while ((m = re.exec(text))) {
      const w = Math.abs(parseFloat(m[3]) - parseFloat(m[1]));
      const h = Math.abs(parseFloat(m[4]) - parseFloat(m[2]));
      if (w > 1 && h > 1 && w < 20000 && h < 20000) boxes.push([w, h]);
    }
    return boxes;
  }

  /**
   * Find the end of the JPEG that starts at `start`. Walks the marker segments
   * up to the start of scan, then looks for the end-of-image marker in the
   * entropy-coded data, where FF D9 cannot occur except as that marker. Searching
   * for FF D9 from the start instead stops at the EXIF thumbnail many camera
   * JPEGs carry, which yields an unreadable file and silently drops the page.
   * Returns -1 when the bytes are not a well-formed JPEG.
   */
  function jpegEnd(bytes, start) {
    const len = bytes.length;
    let pos = start + 2;
    while (pos + 4 <= len) {
      if (bytes[pos] !== 0xFF) return -1;
      const marker = bytes[pos + 1];
      if (marker === 0xFF) { pos++; continue; }                // fill byte
      if (marker === 0xD8 || (marker >= 0xD0 && marker <= 0xD7) || marker === 0x01) { pos += 2; continue; }
      if (marker === 0xD9) return pos + 2;                     // empty image
      const segLen = (bytes[pos + 2] << 8) | bytes[pos + 3];
      if (segLen < 2) return -1;
      if (marker === 0xDA) {                                   // start of scan: entropy-coded data follows
        pos += 2 + segLen;
        for (let j = pos; j < len - 1; j++) {
          if (bytes[j] === 0xFF && bytes[j + 1] === 0xD9) return j + 2;
        }
        return -1;
      }
      pos += 2 + segLen;
    }
    return -1;
  }

  /**
   * Parse PDF binary for embedded JPEG streams (/DCTDecode). Each one becomes a page.
   * When the file's page boxes can be read and there is one image per page, the
   * original page size is kept and the image is placed on it as the source placed it
   * (fitted and centred); otherwise the page takes the image's own size.
   */
  async function extractPagesFromPdf(arrayBuffer) {
    const bytes = new Uint8Array(arrayBuffer);
    const pages = [];
    const len = bytes.length;

    let pos = 0;
    while (pos < len - 4) {
      if (bytes[pos] === 0xFF && bytes[pos + 1] === 0xD8 && bytes[pos + 2] === 0xFF) {
        const start = pos;
        const end = jpegEnd(bytes, start);
        if (end !== -1 && (end - start) > 5000) {
          const jpegSlice = bytes.subarray(start, end);
          const blob = new Blob([jpegSlice], { type: 'image/jpeg' });
          const url = URL.createObjectURL(blob);
          const img = new Image();
          img.src = url;
          try {
            await new Promise((res, rej) => {
              img.onload = () => res();
              img.onerror = () => rej();
            });
            pages.push({
              width: img.naturalWidth,
              height: img.naturalHeight,
              imgElement: img
            });
          } catch (e) {}
          pos = end;
          continue;
        }
      }
      pos++;
    }

    const boxes = readMediaBoxes(bytes);
    if (boxes.length === pages.length) {
      pages.forEach((p, i) => { p.pageWidthPt = boxes[i][0]; p.pageHeightPt = boxes[i][1]; });
    }

    return pages;
  }

  /**
   * Compress a single page image to fit within target bytes
   */
  async function compressPageImage(page, maxBytes) {
    let scale = 1.0;
    // Downscale if very high resolution
    const maxDim = Math.max(page.width, page.height);
    if (maxDim > 1600) scale = 1600 / maxDim;

    const w = Math.round(page.width * scale);
    const h = Math.round(page.height * scale);

    const canvas = doc.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(page.imgElement, 0, 0, w, h);

    const encode = q => new Promise(res => canvas.toBlob(res, 'image/jpeg', q));

    let qLow = 0.15, qHigh = 0.90;
    let bestBlob = await encode(qLow);

    // If lowest quality exceeds maxBytes, downsample further
    if (bestBlob.size > maxBytes && (w > 800 || h > 800)) {
      canvas.width = Math.round(w * 0.7);
      canvas.height = Math.round(h * 0.7);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(page.imgElement, 0, 0, canvas.width, canvas.height);
      bestBlob = await encode(0.40);
    } else {
      // Binary search for highest visual quality under budget
      for (let step = 0; step < 5; step++) {
        const mid = (qLow + qHigh) / 2;
        const candidate = await encode(mid);
        if (candidate.size <= maxBytes) {
          bestBlob = candidate;
          qLow = mid;
        } else {
          qHigh = mid;
        }
      }
    }

    const jpegBuf = await bestBlob.arrayBuffer();
    const jpegBytes = new Uint8Array(jpegBuf);

    // Keep the original page size when it is known (so an A4 scan stays A4, with its
    // orientation and margins); otherwise the page takes the image's size in PDF points
    // (0.75 pt/px, the standard 96 DPI). The image is fitted to the page and centred.
    let pw, ph, drawW, drawH;
    if (page.pageWidthPt && page.pageHeightPt) {
      pw = Number(page.pageWidthPt.toFixed(2));
      ph = Number(page.pageHeightPt.toFixed(2));
      const fit = Math.min(pw / page.width, ph / page.height);
      drawW = Number((page.width * fit).toFixed(2));
      drawH = Number((page.height * fit).toFixed(2));
    } else {
      pw = drawW = Number((page.width * 0.75).toFixed(2));
      ph = drawH = Number((page.height * 0.75).toFixed(2));
    }

    return {
      pageWidth: pw,
      pageHeight: ph,
      drawW,
      drawH,
      posX: Number(((pw - drawW) / 2).toFixed(2)),
      posY: Number(((ph - drawH) / 2).toFixed(2)),
      imgWidthPx: canvas.width,
      imgHeightPx: canvas.height,
      jpegBytes
    };
  }

  function assemblePdfDocument(pages) {
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

    const numPages = pages.length;
    const pageObjNums = [];
    for (let i = 0; i < numPages; i++) pageObjNums.push(3 + (i * 3));

    recordObj(2);
    writeStr(`<< /Type /Pages /Kids [${pageObjNums.map(n => `${n} 0 R`).join(' ')}] /Count ${numPages} >>\nendobj\n`);

    for (let i = 0; i < numPages; i++) {
      const p = pages[i];
      const pageNum = pageObjNums[i];
      const contentNum = pageNum + 1;
      const imgNum = pageNum + 2;

      recordObj(pageNum);
      writeStr(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${p.pageWidth.toFixed(2)} ${p.pageHeight.toFixed(2)}] /Contents ${contentNum} 0 R /Resources << /XObject << /Im1 ${imgNum} 0 R >> >> >>\nendobj\n`);

      const streamStr = `q ${p.drawW.toFixed(2)} 0 0 ${p.drawH.toFixed(2)} ${p.posX.toFixed(2)} ${p.posY.toFixed(2)} cm /Im1 Do Q\n`;
      const streamBytes = new TextEncoder().encode(streamStr);

      recordObj(contentNum);
      writeStr(`<< /Length ${streamBytes.length} >>\nstream\n`);
      writeBytes(streamBytes);
      writeStr('endstream\nendobj\n');

      recordObj(imgNum);
      writeStr(`<< /Type /XObject /Subtype /Image /Width ${p.imgWidthPx} /Height ${p.imgHeightPx} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpegBytes.length} >>\nstream\n`);
      writeBytes(p.jpegBytes);
      writeStr('\nendstream\nendobj\n');
    }

    const totalObjs = 2 + (numPages * 3);
    const xrefOffset = currentOffset;
    writeStr(`xref\n0 ${totalObjs + 1}\n0000000000 65535 f \n`);
    for (let i = 1; i <= totalObjs; i++) {
      const off = String(offsets[i] || 0).padStart(10, '0');
      writeStr(`${off} 00000 n \n`);
    }

    writeStr(`trailer\n<< /Size ${totalObjs + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);

    const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
    const out = new Uint8Array(totalLength);
    let cur = 0;
    for (const c of chunks) {
      out.set(c, cur);
      cur += c.length;
    }
    return out;
  }

  let lastTargetKB = 0;

  // Say plainly whether the file meets the limit the user asked for.
  function showTargetStatus(compBytes, compKb, kept) {
    const statusEl = doc.getElementById('compressStatus');
    const met = !lastTargetKB || compBytes <= lastTargetKB * 1024;
    if (statCompressed) statCompressed.className = 'meta-stat-val ' + (met ? 'status-ok' : 'status-warning');
    if (!statusEl) return;
    statusEl.className = 'result-status' + (met ? '' : ' is-warning');
    statusEl.textContent = '';
    const icon = doc.createElement('i');
    icon.className = met ? 'fa-solid fa-circle-check' : 'fa-solid fa-triangle-exclamation';
    icon.setAttribute('aria-hidden', 'true');
    const text = doc.createElement('span');
    if (kept === 'fits') text.textContent = `Already under ${lastTargetKB} KB, so your original file is kept unchanged. Upload it as it is.`;
    else if (kept === 'larger') text.textContent = met
      ? `Compressing would not make this file smaller, so your original is kept. It is under ${lastTargetKB} KB and ready to upload.`
      : `This file could not get under ${lastTargetKB} KB, and compressing would not make it smaller, so your original (${compKb} KB) is kept. Try a higher limit, or upload fewer pages.`;
    else text.textContent = met
      ? `Under ${lastTargetKB} KB. Ready to upload.`
      : `This file could not get under ${lastTargetKB} KB. The smallest readable version is ${compKb} KB. Try a higher limit, or upload fewer pages.`;
    statusEl.append(icon, text);
  }

  // kept: 'fits' (the original was already under the limit) or 'larger' (compressing did not help).
  function displayResult(blob, pagesCount, kept) {
    if (compressedBlobUrl) URL.revokeObjectURL(compressedBlobUrl);
    compressedBlobUrl = URL.createObjectURL(blob);

    const origBytes = currentFile.size;
    const compBytes = blob.size;
    const origKb = (origBytes / 1024).toFixed(1);
    const compKb = (compBytes / 1024).toFixed(1);

    const reductionPercent = Math.max(0, Math.round(((origBytes - compBytes) / origBytes) * 100));

    if (statOriginal) statOriginal.textContent = `${origKb} KB`;
    if (statCompressed) statCompressed.textContent = `${compKb} KB`;
    if (statReduction) statReduction.textContent = kept ? 'Unchanged' : `${reductionPercent}% smaller`;
    if (statPages) statPages.textContent = pagesCount ? `${pagesCount} ${pagesCount === 1 ? 'Page' : 'Pages'}` : 'Not changed';
    showTargetStatus(compBytes, compKb, kept);

    if (btnDownload) {
      btnDownload.href = compressedBlobUrl;
      const baseName = currentFile.name.replace(/\.[^/.]+$/, '');
      btnDownload.download = kept ? currentFile.name : `${baseName}_Compressed_${compKb}KB.pdf`;
    }

    if (resultArea) {
      resultArea.classList.remove('hidden');
      resultArea.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  function resetAll() {
    currentFile = null;
    if (compressedBlobUrl) {
      URL.revokeObjectURL(compressedBlobUrl);
      compressedBlobUrl = null;
    }
    if (fileInput) fileInput.value = '';
    if (fileInfoBox) fileInfoBox.classList.add('hidden');
    if (resultArea) resultArea.classList.add('hidden');
    if (dropzone) dropzone.classList.remove('hidden');
    if (btnStartCompress) btnStartCompress.disabled = true;
  }

  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
