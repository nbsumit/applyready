/**
 * ApplyReady.in - Signature Background Cleaner
 * 100% Client-Side In-Browser Tool
 * Whitens paper background, removes shadows, darkens ink lines,
 * and outputs clean JPEG (white bg) or transparent PNG.
 */

(function () {
  'use strict';
  // How it decides what is paper: the paper's own brightness is measured across the photo
  // (paperLevels), so a dim indoor photo or a shadow over one side counts as paper too. Each pixel is
  // then compared with the paper around it: "Paper whiteness" sets how close to that paper a pixel
  // must be to turn white (higher turns more of it white), and "Ink darkness" how strongly the rest
  // is darkened.
  // Errors use the site's notification instead of a blocking browser dialog.
  const notifyError = message => (window.ApplyReadyUI && window.ApplyReadyUI.notify) ? window.ApplyReadyUI.notify(message, true) : window.alert(message);
  const MAX_SIDE_PX = 2400;

  const doc = typeof document !== 'undefined' ? document : null;
  if (!doc) return;

  const dropzone = doc.getElementById('cleanerDropzone');
  const fileInput = doc.getElementById('cleanerFileInput');
  const btnBrowse = doc.getElementById('btnCleanerBrowse');
  const fileInfoBox = doc.getElementById('cleanerFileInfoBox');
  const fileInfoText = doc.getElementById('cleanerFileInfoText');
  const btnRemoveFile = doc.getElementById('btnCleanerRemove');
  const btnReplaceFile = doc.getElementById('btnCleanerReplace');

  const whitenessInput = doc.getElementById('whitenessInput');
  const whitenessVal = doc.getElementById('whitenessVal');
  const contrastInput = doc.getElementById('contrastInput');
  const contrastVal = doc.getElementById('contrastVal');
  const inkColorSelect = doc.getElementById('inkColorSelect');
  const formatSelect = doc.getElementById('cleanerFormatSelect');
  const denoiseCheckbox = doc.getElementById('denoiseCheckbox');
  const btnResetSettings = doc.getElementById('btnResetSettings');

  const previewArea = doc.getElementById('cleanerPreviewArea');
  const canvas = doc.getElementById('cleanerCanvas');
  const originalCanvas = doc.getElementById('cleanerOriginalCanvas');
  const btnDownload = doc.getElementById('btnCleanerDownload');
  const statDimensions = doc.getElementById('statDimensions');
  const statFileSize = doc.getElementById('statFileSize');
  const statFormat = doc.getElementById('statFormat');

  let originalFile = null;
  let originalImageData = null;
  let paper = null;       // per pixel: the brightness of the paper around it (paperLevels)
  let relLum = null;      // per pixel: brightness relative to that paper, 255 = as bright as the paper
  let processedBlobUrl = null;
  let debounceTimer = null;
  let loadToken = 0;      // a photo that finishes loading after Remove or Replace is ignored
  let encodeToken = 0;    // an encode that finishes after a newer one, or after Remove, is ignored

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

    ['dragenter', 'dragover'].forEach(name => {
      dropzone.addEventListener(name, (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
      });
    });

    ['dragleave', 'drop'].forEach(name => {
      dropzone.addEventListener(name, (e) => {
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

    if (btnRemoveFile) {
      btnRemoveFile.addEventListener('click', resetAll);
    }

    if (btnReplaceFile) {
      btnReplaceFile.addEventListener('click', () => fileInput.click());
    }

    if (btnDownload) {
      btnDownload.addEventListener('click', e => { if (!processedBlobUrl || !originalImageData) e.preventDefault(); });
    }

    // Sliders & controls
    if (whitenessInput) {
      whitenessInput.addEventListener('input', () => {
        if (whitenessVal) whitenessVal.textContent = whitenessInput.value;
        scheduleProcess();
      });
    }

    if (contrastInput) {
      contrastInput.addEventListener('input', () => {
        if (contrastVal) contrastVal.textContent = contrastInput.value;
        scheduleProcess();
      });
    }

    if (inkColorSelect) inkColorSelect.addEventListener('change', scheduleProcess);
    if (formatSelect) formatSelect.addEventListener('change', scheduleProcess);
    if (denoiseCheckbox) denoiseCheckbox.addEventListener('change', scheduleProcess);

    if (btnResetSettings) {
      btnResetSettings.addEventListener('click', () => {
        if (whitenessInput) whitenessInput.value = '70';
        if (whitenessVal) whitenessVal.textContent = '70';
        if (contrastInput) contrastInput.value = '80';
        if (contrastVal) contrastVal.textContent = '80';
        if (inkColorSelect) inkColorSelect.value = 'original';
        if (formatSelect) formatSelect.value = 'image/jpeg';
        if (denoiseCheckbox) denoiseCheckbox.checked = true;
        scheduleProcess();
      });
    }
  }

  async function handleFile(file) {
    if (!file) return;
    // Taken before the content check, so a Remove pressed while it runs still wins.
    const token = ++loadToken;
    // Identify the file by its content, not its name or the type the browser reports.
    if (window.ApplyReadyFiles) {
      const check = await window.ApplyReadyFiles.validate(file, ['image'], 50 * 1024 * 1024);
      if (token !== loadToken) return;
      if (!check.ok) { notifyError(check.error); return; }
    } else if (!file.type.startsWith('image/')) {
      notifyError('That file is not a JPG, PNG or WebP image. Choose a photo of your signature.');
      return;
    }

    // The same checks as the batch tools: a picture over 50 megapixels is refused before it is
    // decoded, and a truncated or damaged file is refused instead of being cleaned with a blank part.
    const Ops = window.ApplyReadyImageOps;
    let opened;
    try {
      opened = Ops ? await Ops.openImage(file, { name: file.name }) : await openWithImg(file);
    } catch (e) {
      if (token === loadToken) notifyError((e && e.message) || 'That image could not be read. Choose a JPG, PNG or WebP photo that opens on your device, then try again.');
      return;
    }
    if (token !== loadToken) { opened.close(); return; }   // removed or replaced while it was opening
    try {
      showImage(file, opened);
    } finally {
      opened.close();
    }
  }

  // Only for a browser without js/lib/image-ops.js loaded.
  function openWithImg(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve({ source: img, width: img.naturalWidth, height: img.naturalHeight, close() {} }); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That image could not be read. Choose a JPG, PNG or WebP photo that opens on your device, then try again.')); };
      img.src = url;
    });
  }

  function showImage(file, opened) {
    originalFile = file;
    const { source, width: naturalW, height: naturalH } = opened;
    if (fileInfoBox) fileInfoBox.classList.remove('hidden');
    if (fileInfoText) fileInfoText.textContent = `${file.name} (${naturalW} × ${naturalH} px, ${(file.size / 1024).toFixed(1)} KB)`;
    // The drop zone (and the button that opened the picker) is about to be hidden: keep keyboard focus
    // on the page, on the file bar's Replace button.
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

    // Work on at most MAX_SIDE_PX on the long side: the cleaning pass runs over every pixel on each
    // slider change, and a phone photo of a signature can be 12 MP or more. Forms ask for far less.
    const k = Math.min(1, MAX_SIDE_PX / Math.max(naturalW, naturalH));
    const w = Math.max(1, Math.round(naturalW * k));
    const h = Math.max(1, Math.round(naturalH * k));
    const offscreen = doc.createElement('canvas');
    offscreen.width = w;
    offscreen.height = h;
    const ctx = offscreen.getContext('2d');
    ctx.drawImage(source, 0, 0, w, h);
    originalImageData = ctx.getImageData(0, 0, w, h);
    offscreen.width = 0; offscreen.height = 0;
    const levels = paperLevels(originalImageData);
    paper = levels.paper;
    relLum = levels.rel;
    // The original stays on screen beside the cleaned version.
    if (originalCanvas) {
      originalCanvas.width = w;
      originalCanvas.height = h;
      originalCanvas.getContext('2d').drawImage(source, 0, 0, w, h);
    }

    processSignature();
    if (window.ApplyReadyUI && window.ApplyReadyUI.reveal && previewArea) window.ApplyReadyUI.reveal(previewArea.closest('section') || previewArea);
  }

  /**
   * The brightness of the paper around every pixel. A phone photo of white paper is rarely white:
   * indoors it is grey (often only 160 to 200 of 255), and a hand or the phone casts a shadow over
   * part of it. A single brightness threshold either leaves that paper grey or eats the ink.
   * Here the photo is cut into blocks; in each, the 90th percentile of brightness is the paper (a
   * signature covers far less than 90% of a block). A block taken up by a thick stroke or a stamp
   * gets the median of its neighbours instead, and the levels are interpolated between block
   * centres, so a gradual shadow is followed smoothly.
   * Returns { paper, rel }: paper level per pixel, and each pixel's brightness relative to it
   * (255 = as bright as the paper), both Uint8Array.
   */
  function paperLevels(image) {
    const { width: w, height: h, data } = image;
    const n = w * h;
    const lum = new Uint8Array(n);
    const all = new Uint32Array(256);
    for (let i = 0, p = 0; p < n; i += 4, p++) {
      // Transparent pixels count as paper.
      const v = data[i + 3] < 10 ? 255 : Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
      lum[p] = v;
      all[v]++;
    }
    const percentile = (hist, count, q) => { let acc = 0; const want = count * q; for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= want) return v; } return 255; };
    const overall = percentile(all, n, 0.9);
    const size = Math.max(16, Math.min(96, Math.round(Math.max(w, h) / 30)));
    const bw = Math.ceil(w / size), bh = Math.ceil(h / size);
    const block = new Float32Array(bw * bh);
    const hist = new Uint32Array(256);
    for (let by = 0; by < bh; by++) {
      for (let bx = 0; bx < bw; bx++) {
        hist.fill(0);
        const x0 = bx * size, y0 = by * size, x1 = Math.min(w, x0 + size), y1 = Math.min(h, y0 + size);
        for (let y = y0; y < y1; y++) for (let p = y * w + x0, end = y * w + x1; p < end; p++) hist[lum[p]]++;
        block[by * bw + bx] = percentile(hist, (x1 - x0) * (y1 - y0), 0.9);
      }
    }
    // The median of each block and its neighbours: a block filled by ink is outvoted by the paper
    // around it, while the edge of a real shadow (dark on one side, light on the other) stays put.
    const level = new Float32Array(bw * bh);
    const near = [];
    for (let by = 0; by < bh; by++) {
      for (let bx = 0; bx < bw; bx++) {
        near.length = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const x = bx + dx, y = by + dy;
          if (x >= 0 && y >= 0 && x < bw && y < bh) near.push(block[y * bw + x]);
        }
        near.sort((a, b) => a - b);
        // Never below half the paper level of the whole photo (a large dark area is not paper),
        // and never zero.
        level[by * bw + bx] = Math.max(24, overall * 0.5, near[near.length >> 1]);
      }
    }
    const paperOut = new Uint8Array(n);
    const rel = new Uint8Array(n);
    const gxs = new Float32Array(w);
    for (let x = 0; x < w; x++) gxs[x] = Math.min(bw - 1, Math.max(0, (x + 0.5) / size - 0.5));
    for (let y = 0; y < h; y++) {
      const gy = Math.min(bh - 1, Math.max(0, (y + 0.5) / size - 0.5));
      const y0 = Math.floor(gy), y1 = Math.min(bh - 1, y0 + 1), fy = gy - y0;
      for (let x = 0; x < w; x++) {
        const gx = gxs[x];
        const x0 = Math.floor(gx), x1 = Math.min(bw - 1, x0 + 1), fx = gx - x0;
        const top = level[y0 * bw + x0] * (1 - fx) + level[y0 * bw + x1] * fx;
        const bottom = level[y1 * bw + x0] * (1 - fx) + level[y1 * bw + x1] * fx;
        const b = Math.min(255, top * (1 - fy) + bottom * fy);
        const p = y * w + x;
        paperOut[p] = Math.round(b);
        rel[p] = Math.min(255, Math.round(lum[p] * 255 / b));
      }
    }
    return { paper: paperOut, rel };
  }

  function scheduleProcess() {
    if (!originalImageData) return;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(processSignature, 60);
  }

  function processSignature() {
    if (!originalImageData || !canvas) return;

    const width = originalImageData.width;
    const height = originalImageData.height;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    const whiteness = parseInt(whitenessInput ? whitenessInput.value : '70', 10);
    const contrast = parseInt(contrastInput ? contrastInput.value : '80', 10);
    const inkColor = inkColorSelect ? inkColorSelect.value : 'original';
    const isTransparent = formatSelect && formatSelect.value === 'image/png-transparent';
    const doDenoise = denoiseCheckbox && denoiseCheckbox.checked;

    // A pixel at least `threshold` bright relative to the paper around it becomes white paper. Higher
    // whiteness lowers the threshold, so more of the paper (and in the end faint strokes) turns white:
    // 20 keeps everything darker than the paper itself, 70 clears grey paper and shadows, 100 also
    // clears paper texture and smudges.
    const threshold = 260 - 0.6 * whiteness;
    // How quickly a stroke reaches full strength.
    const contrastFactor = 1.0 + (contrast / 100) * 1.8;

    const src = originalImageData.data;
    const output = ctx.createImageData(width, height);
    const dst = output.data;
    const len = src.length;

    for (let i = 0, p = 0; i < len; i += 4, p++) {
      const rel = relLum[p];
      if (src[i + 3] < 10 || rel >= threshold) {
        // Paper (or an already transparent pixel)
        dst[i] = 255;
        dst[i + 1] = 255;
        dst[i + 2] = 255;
        dst[i + 3] = isTransparent ? 0 : 255;
        continue;
      }
      // Ink: strength grows with the distance below the threshold. `cover` is how much ink the pixel
      // holds (1 inside a stroke, less on its soft edge), so edges blend into the white paper.
      const strength = Math.min(1, (threshold - rel) / (threshold * 0.7));
      const cover = Math.min(1, strength * contrastFactor);
      let ir, ig, ib;
      if (inkColor === 'black') {
        ir = 0; ig = 0; ib = 0;
      } else if (inkColor === 'blue') {
        // Deep official blue (#0A1E6E)
        ir = 10; ig = 30; ib = 110;
      } else {
        // The pen's own colour: the paper's grey or yellow cast is divided out, then the colour is
        // darkened by scaling all three channels together, which keeps blue ink blue (subtracting
        // from each channel would push every dark colour to black).
        const scale = (255 / paper[p]) / (1 + 0.3 * (contrastFactor - 1) * strength);
        ir = Math.min(255, src[i] * scale);
        ig = Math.min(255, src[i + 1] * scale);
        ib = Math.min(255, src[i + 2] * scale);
      }
      if (isTransparent) {
        // The ink colour with its coverage as opacity: no white fringe on a coloured background.
        dst[i] = Math.round(ir);
        dst[i + 1] = Math.round(ig);
        dst[i + 2] = Math.round(ib);
        dst[i + 3] = Math.round(cover * 255);
      } else {
        dst[i] = Math.round(255 + (ir - 255) * cover);
        dst[i + 1] = Math.round(255 + (ig - 255) * cover);
        dst[i + 2] = Math.round(255 + (ib - 255) * cover);
        dst[i + 3] = 255;
      }
    }

    // Optional 3x3 Denoise / speckle filter on background
    if (doDenoise && width > 4 && height > 4) {
      applySimpleDenoise(dst, width, height, isTransparent);
    }

    ctx.putImageData(output, 0, 0);
    updateDownloadAndStats();
  }

  function applySimpleDenoise(data, w, h, isTransparent) {
    // Quick pass to eliminate isolated single dark pixels in white background
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const idx = (y * w + x) * 4;
        // If current pixel is dark (lum < 200)
        if (data[idx] < 200 || data[idx + 1] < 200 || data[idx + 2] < 200) {
          // Count surrounding white/transparent neighbors
          let whiteNeighbors = 0;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (dx === 0 && dy === 0) continue;
              const nIdx = ((y + dy) * w + (x + dx)) * 4;
              if (data[nIdx] >= 250 && data[nIdx + 1] >= 250 && data[nIdx + 2] >= 250) {
                whiteNeighbors++;
              }
            }
          }
          // If 7 or 8 surrounding pixels are pure white, this is background speckle
          if (whiteNeighbors >= 7) {
            data[idx] = 255;
            data[idx + 1] = 255;
            data[idx + 2] = 255;
            if (isTransparent) data[idx + 3] = 0;
          }
        }
      }
    }
  }

  function updateDownloadAndStats() {
    if (!canvas || !btnDownload) return;

    const isTransparent = formatSelect && formatSelect.value === 'image/png-transparent';
    const mimeType = isTransparent || (formatSelect && formatSelect.value === 'image/png') ? 'image/png' : 'image/jpeg';
    const quality = mimeType === 'image/jpeg' ? 0.92 : undefined;

    const token = ++encodeToken;
    canvas.toBlob(blob => {
      if (token !== encodeToken || !originalImageData) return;
      if (!blob) { notifyError('The cleaned signature could not be saved. The device may be low on memory; try a smaller photo.'); return; }

      if (processedBlobUrl) URL.revokeObjectURL(processedBlobUrl);
      processedBlobUrl = URL.createObjectURL(blob);

      const ext = mimeType === 'image/png' ? 'png' : 'jpg';
      const baseName = originalFile ? originalFile.name.replace(/\.[^/.]+$/, '') : 'Signature';
      const filename = `Cleaned_${baseName}.${ext}`;

      btnDownload.href = processedBlobUrl;
      btnDownload.download = filename;

      if (statDimensions) statDimensions.textContent = `${canvas.width} × ${canvas.height} px`;
      if (statFileSize) statFileSize.textContent = `${(blob.size / 1024).toFixed(1)} KB (${blob.size.toLocaleString()} bytes)`;
      if (statFormat) statFormat.textContent = isTransparent ? 'PNG (Transparent)' : mimeType === 'image/png' ? 'PNG (White)' : 'JPEG (White)';
    }, mimeType, quality);
  }

  // Remove leaves nothing of the signature behind: on a shared computer the next person must not
  // be able to see or download it.
  function resetAll() {
    loadToken++;
    encodeToken++;
    clearTimeout(debounceTimer);
    originalFile = null;
    originalImageData = null;
    paper = null;
    relLum = null;
    if (processedBlobUrl) {
      URL.revokeObjectURL(processedBlobUrl);
      processedBlobUrl = null;
    }
    [canvas, originalCanvas].forEach(c => {
      if (!c) return;
      const ctx = c.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, c.width, c.height);
      c.width = 0;
      c.height = 0;
    });
    if (btnDownload) { btnDownload.setAttribute('href', '#'); btnDownload.setAttribute('download', 'Cleaned_Signature.jpg'); }
    if (statDimensions) statDimensions.textContent = '--';
    if (statFileSize) statFileSize.textContent = '--';
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
