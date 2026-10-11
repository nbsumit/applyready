/**
 * ApplyReady.in - Signature Background Cleaner
 * 100% Client-Side In-Browser Tool
 * Whitens paper background, removes shadows, darkens ink lines,
 * and outputs clean JPEG (white bg) or transparent PNG.
 */

(function () {
  'use strict';
  // Errors use the site's notification instead of a blocking browser dialog.
  const notifyError = message => (window.ApplyReadyUI && window.ApplyReadyUI.notify) ? window.ApplyReadyUI.notify(message, true) : window.alert(message);

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
  const emptyState = doc.getElementById('cleanerEmptyState');
  const canvas = doc.getElementById('cleanerCanvas');
  const btnDownload = doc.getElementById('btnCleanerDownload');
  const statDimensions = doc.getElementById('statDimensions');
  const statFileSize = doc.getElementById('statFileSize');
  const statFormat = doc.getElementById('statFormat');

  const btnViewCleaned = doc.getElementById('btnViewCleaned');
  const btnViewOriginal = doc.getElementById('btnViewOriginal');

  let originalImage = null;
  let originalFile = null;
  let originalImageData = null;
  let showingOriginal = false;
  let processedBlobUrl = null;
  let debounceTimer = null;

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
      if (fileInput.files && fileInput.files.length) {
        handleFile(fileInput.files[0]);
      }
    });

    if (btnRemoveFile) {
      btnRemoveFile.addEventListener('click', resetAll);
    }

    if (btnReplaceFile) {
      btnReplaceFile.addEventListener('click', () => fileInput.click());
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

    if (btnViewCleaned && btnViewOriginal) {
      btnViewCleaned.addEventListener('click', () => {
        showingOriginal = false;
        btnViewCleaned.classList.add('active');
        btnViewCleaned.setAttribute('aria-pressed', 'true');
        btnViewOriginal.classList.remove('active');
        btnViewOriginal.setAttribute('aria-pressed', 'false');
        processSignature();
      });

      btnViewOriginal.addEventListener('click', () => {
        if (!originalImage) return;
        showingOriginal = true;
        btnViewOriginal.classList.add('active');
        btnViewOriginal.setAttribute('aria-pressed', 'true');
        btnViewCleaned.classList.remove('active');
        btnViewCleaned.setAttribute('aria-pressed', 'false');
        drawOriginal();
      });
    }
  }

  function handleFile(file) {
    if (!file || !file.type.startsWith('image/')) {
      notifyError('That file is not a JPG, PNG or WebP image. Choose a photo of your signature.');
      return;
    }

    originalFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        originalImage = img;
        if (fileInfoBox) fileInfoBox.classList.remove('hidden');
        if (fileInfoText) fileInfoText.textContent = `${file.name} (${img.naturalWidth} × ${img.naturalHeight} px, ${(file.size / 1024).toFixed(1)} KB)`;
        if (dropzone) dropzone.classList.add('hidden');
        if (emptyState) emptyState.classList.add('hidden');
        if (previewArea) previewArea.classList.remove('hidden');

        // Draw to offscreen buffer
        const offscreen = doc.createElement('canvas');
        offscreen.width = img.naturalWidth;
        offscreen.height = img.naturalHeight;
        const ctx = offscreen.getContext('2d');
        ctx.drawImage(img, 0, 0);
        originalImageData = ctx.getImageData(0, 0, offscreen.width, offscreen.height);

        processSignature();
        if (window.ApplyReadyUI && window.ApplyReadyUI.reveal && previewArea) window.ApplyReadyUI.reveal(previewArea.closest('section') || previewArea);
      };
      img.onerror = () => { originalFile = null; notifyError('That image could not be read. Choose a JPG, PNG or WebP photo that opens on your device, then try again.'); };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  function scheduleProcess() {
    if (!originalImageData || showingOriginal) return;
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

    // Normalize parameters
    // Threshold between 100 and 245
    const threshold = 120 + (whiteness / 100) * 115;
    // Contrast multiplier
    const contrastFactor = 1.0 + (contrast / 100) * 1.8;

    const src = originalImageData.data;
    const output = ctx.createImageData(width, height);
    const dst = output.data;
    const len = src.length;

    for (let i = 0; i < len; i += 4) {
      const r = src[i];
      const g = src[i + 1];
      const b = src[i + 2];
      const a = src[i + 3];

      if (a < 10) {
        dst[i] = 255;
        dst[i + 1] = 255;
        dst[i + 2] = 255;
        dst[i + 3] = isTransparent ? 0 : 255;
        continue;
      }

      // Perceptual luminance (ITU-R BT.601)
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;

      if (lum >= threshold) {
        // Whiten paper / background
        dst[i] = 255;
        dst[i + 1] = 255;
        dst[i + 2] = 255;
        dst[i + 3] = isTransparent ? 0 : 255;
      } else {
        // Ink stroke: darken and enhance
        // Scale stroke strength based on distance from threshold
        const strokeStrength = Math.min(1.0, (threshold - lum) / (threshold * 0.7));
        const darkenAmount = strokeStrength * contrastFactor;

        if (inkColor === 'black') {
          // Pure black ink with anti-aliased edge
          const val = Math.max(0, Math.round(lum * (1 - darkenAmount)));
          dst[i] = val;
          dst[i + 1] = val;
          dst[i + 2] = val;
          dst[i + 3] = 255;
        } else if (inkColor === 'blue') {
          // Deep official blue (#0A1E6E)
          const baseR = 10, baseG = 30, baseB = 110;
          const factor = Math.max(0, 1 - darkenAmount);
          dst[i] = Math.min(255, Math.round(baseR + factor * (r - baseR)));
          dst[i + 1] = Math.min(255, Math.round(baseG + factor * (g - baseG)));
          dst[i + 2] = Math.min(255, Math.round(baseB + factor * (b - baseB)));
          dst[i + 3] = 255;
        } else {
          // Preserve original pen hue, but darken and clear paper haze
          dst[i] = Math.max(0, Math.round(r - (255 - r) * (darkenAmount - 1)));
          dst[i + 1] = Math.max(0, Math.round(g - (255 - g) * (darkenAmount - 1)));
          dst[i + 2] = Math.max(0, Math.round(b - (255 - b) * (darkenAmount - 1)));
          dst[i + 3] = 255;
        }
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

  function drawOriginal() {
    if (!originalImage || !canvas) return;
    canvas.width = originalImage.naturalWidth;
    canvas.height = originalImage.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(originalImage, 0, 0);
  }

  function updateDownloadAndStats() {
    if (!canvas || !btnDownload) return;

    const isTransparent = formatSelect && formatSelect.value === 'image/png-transparent';
    const mimeType = isTransparent || (formatSelect && formatSelect.value === 'image/png') ? 'image/png' : 'image/jpeg';
    const quality = mimeType === 'image/jpeg' ? 0.92 : undefined;

    canvas.toBlob(blob => {
      if (!blob) return;

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

  function resetAll() {
    originalImage = null;
    originalFile = null;
    originalImageData = null;
    showingOriginal = false;
    if (processedBlobUrl) {
      URL.revokeObjectURL(processedBlobUrl);
      processedBlobUrl = null;
    }
    if (fileInput) fileInput.value = '';
    if (fileInfoBox) fileInfoBox.classList.add('hidden');
    if (previewArea) previewArea.classList.add('hidden');
    if (emptyState) emptyState.classList.remove('hidden');
    if (dropzone) dropzone.classList.remove('hidden');
  }

  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
