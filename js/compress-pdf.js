/**
 * ApplyReady.in - PDF Compressor Engine
 * 100% Client-Side In-Browser Tool
 * Compresses document PDFs and document scans to target KB limits
 * (100 KB, 200 KB, 300 KB, 500 KB) for government recruitment portals.
 * Zero server uploads.
 */

(function () {
  'use strict';

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
      alert('Please upload a PDF file or document image (JPG, PNG).');
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
      const isPdf = currentFile.type === 'application/pdf' || currentFile.name.toLowerCase().endsWith('.pdf');

      let pages = [];

      if (isPdf) {
        updateProgress(30, 'Extracting document pages…');
        const buffer = await currentFile.arrayBuffer();
        pages = await extractPagesFromPdf(buffer);

        if (!pages.length) {
          // If no embedded DCTDecode images could be parsed, wrap original or notify
          if (currentFile.size <= targetKB * 1024) {
            updateProgress(100, 'Complete!');
            displayResult(currentFile, 1);
            return;
          }
          throw new Error('This PDF contains vector text/forms rather than scanned images. It is already compact or protected.');
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
        await new Promise(res => { img.onload = res; });
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
      displayResult(outputBlob, pages.length);

    } catch (err) {
      alert('Compression notice: ' + err.message);
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
   * Parse PDF binary for embedded JPEG streams (/DCTDecode)
   */
  async function extractPagesFromPdf(arrayBuffer) {
    const bytes = new Uint8Array(arrayBuffer);
    const pages = [];
    const len = bytes.length;

    // Search for JPEG SOI (0xFF, 0xD8) and EOI (0xFF, 0xD9) markers
    let pos = 0;
    while (pos < len - 4) {
      if (bytes[pos] === 0xFF && bytes[pos + 1] === 0xD8) {
        const start = pos;
        let end = -1;
        // Search forward for EOI
        for (let j = start + 2; j < len - 1; j++) {
          if (bytes[j] === 0xFF && bytes[j + 1] === 0xD9) {
            end = j + 2;
            break;
          }
        }
        if (end !== -1 && (end - start) > 5000) {
          // Found JPEG stream
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

    // Standard A4 dimensions
    const isLandscape = page.width > page.height;
    const pw = isLandscape ? 841.89 : 595.28;
    const ph = isLandscape ? 595.28 : 841.89;

    const margin = 18;
    const availW = pw - (margin * 2);
    const availH = ph - (margin * 2);
    const drawScale = Math.min(availW / page.width, availH / page.height);
    const drawW = page.width * drawScale;
    const drawH = page.height * drawScale;

    return {
      pageWidth: pw,
      pageHeight: ph,
      drawW,
      drawH,
      posX: margin + (availW - drawW) / 2,
      posY: margin + (availH - drawH) / 2,
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

  function displayResult(blob, pagesCount) {
    if (compressedBlobUrl) URL.revokeObjectURL(compressedBlobUrl);
    compressedBlobUrl = URL.createObjectURL(blob);

    const origBytes = currentFile.size;
    const compBytes = blob.size;
    const origKb = (origBytes / 1024).toFixed(1);
    const compKb = (compBytes / 1024).toFixed(1);

    const reductionPercent = Math.max(0, Math.round(((origBytes - compBytes) / origBytes) * 100));

    if (statOriginal) statOriginal.textContent = `${origKb} KB`;
    if (statCompressed) statCompressed.textContent = `${compKb} KB`;
    if (statReduction) statReduction.textContent = `${reductionPercent}% Saved`;
    if (statPages) statPages.textContent = `${pagesCount} ${pagesCount === 1 ? 'Page' : 'Pages'}`;

    if (btnDownload) {
      btnDownload.href = compressedBlobUrl;
      const baseName = currentFile.name.replace(/\.[^/.]+$/, '');
      btnDownload.download = `${baseName}_Compressed_${compKb}KB.pdf`;
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
