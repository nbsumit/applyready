/**
 * ApplyReady.in - General-Purpose Image Resizer & Strict Compressor
 * 100% Client-Side Processing (HTML5 Canvas, Cropper.js)
 * Zero server uploads.
 */

(function () {
  'use strict';

  // General-Purpose Presets
  const PRESETS = {
    'custom': {
      name: 'Custom Dimensions & Limit',
      width: 350,
      height: 350,
      maxKB: 50,
      defaultPrefix: 'ApplyReady_Custom'
    },
    'avatar': {
      name: 'Profile / Avatar (400 × 400 px, max 100 KB)',
      width: 400,
      height: 400,
      maxKB: 100,
      defaultPrefix: 'Avatar'
    },
    'passport': {
      name: 'ID / Passport Photo (350 × 450 px, max 50 KB)',
      width: 350,
      height: 450,
      maxKB: 50,
      defaultPrefix: 'Passport_Photo'
    },
    'signature': {
      name: 'Signature / Stamp (300 × 100 px, max 30 KB)',
      width: 300,
      height: 100,
      maxKB: 30,
      defaultPrefix: 'Signature'
    },
    'web-banner': {
      name: 'Social / Web Card (1200 × 630 px, max 300 KB)',
      width: 1200,
      height: 630,
      maxKB: 300,
      defaultPrefix: 'Web_Card'
    },
    'document': {
      name: 'Document Scan (800 × 1000 px, max 200 KB)',
      width: 800,
      height: 1000,
      maxKB: 200,
      defaultPrefix: 'Document'
    }
  };

  // State Management
  let currentPresetKey = 'custom';
  let cropper = null;
  let currentFile = null;
  let sourceImage = null;
  let sourceDimensions = { width: 0, height: 0, sizeBytes: 0 };
  let processedBlobUrl = null;
  let currentOpId = 0;
  let configRevision = 0;
  let cropperReady = false;
  let processing = false;
  let bgFillChosen = false;
  const processLabel = '<i class="fa-solid fa-bolt" aria-hidden="true"></i> Resize & compress';

  // DOM Elements (safe for Node test environments)
  const doc = typeof document !== 'undefined' ? document : null;
  const getEl = (id) => doc ? doc.getElementById(id) : null;

  const presetSelect = getEl('presetSelect');
  const customControls = getEl('customControls');
  const customWidthInput = getEl('customWidth');
  const customHeightInput = getEl('customHeight');
  const customMaxKBInput = getEl('customMaxKB');
  const formatSelect = getEl('formatSelect');
  const bgFillSelect = getEl('bgFillSelect');
  const aspectRatioSelect = getEl('aspectRatioSelect');

  const dimError = getEl('dimError');
  const sizeError = getEl('sizeError');
  const processErrorBox = getEl('processErrorBox');
  const processErrorMessage = getEl('processErrorMessage');

  const specDims = getEl('specDims');
  const specSize = getEl('specSize');
  const specFormat = getEl('specFormat');

  // Annotation Elements
  const dateOptionsBox = getEl('dateOptionsBox');
  const addDateCheckbox = getEl('addDateCheckbox');
  const dateInputGroup = getEl('dateInputGroup');
  const annotationDateInput = getEl('annotationDateInput') || getEl('examDateInput');
  const btnTodayDate = getEl('btnTodayDate');
  const candidateNameInput = getEl('candidateNameInput');

  // Upload Elements
  const dropzone = getEl('dropzone');
  const fileInput = getEl('fileInput');
  const btnBrowse = getEl('btnBrowse');
  const fileInfoBox = getEl('fileInfoBox');
  const fileInfoText = getEl('fileInfoText');
  const btnReplaceFile = getEl('btnReplaceFile');
  const btnRemoveFile = getEl('btnRemoveFile');
  const btnOriginalSize = getEl('btnOriginalSize');
  const btnTryExample = getEl('btnTryExample');
  const workspaceStatus = getEl('workspaceStatus');

  // Aspect Ratio Lock
  const btnLockAspect = getEl('btnLockAspect');
  let isAspectLocked = true;
  let lockedRatio = 1.0;

  // Cropper Elements
  const cropperPlaceholder = getEl('cropperPlaceholder');
  const cropperActiveArea = getEl('cropperActiveArea');
  const imageToCrop = getEl('imageToCrop');

  // Cropper Toolbar Controls
  const btnRotateLeft = getEl('btnRotateLeft');
  const btnRotateRight = getEl('btnRotateRight');
  const btnResetCrop = getEl('btnResetCrop');
  const btnZoomIn = getEl('btnZoomIn');
  const btnZoomOut = getEl('btnZoomOut');
  const btnProcess = getEl('btnProcess');

  // Result Elements
  const resultArea = getEl('resultArea');
  const resultImage = getEl('resultImage');
  const originalComparisonImage = getEl('originalComparisonImage');
  const btnViewProcessed = getEl('btnViewProcessed');
  const btnViewOriginal = getEl('btnViewOriginal');
  const compProcessedKB = getEl('compProcessedKB');
  const compOriginalKB = getEl('compOriginalKB');
  const resultDims = getEl('resultDims');
  const resultFileSize = getEl('resultFileSize');
  const resultFormat = getEl('resultFormat');
  const resultStatus = getEl('resultStatus');
  const btnDownload = getEl('btnDownload');
  const btnCropAgain = getEl('btnCropAgain');

  let originalFileBlobUrl = null;

  /**
   * Initialize Resizer Module
   */
  function init() {
    setTodayDate();
    updatePresetUI();
    attachEventListeners();
  }

  function setWorkspaceStatus(message) {
    if (workspaceStatus) workspaceStatus.textContent = message;
  }

  // Keep the ratio honest: invalid or oversized results are validated, not clamped.
  function scaleLockedDimension(value, ratio, changedAxis) {
    const size = Number(value);
    if (!Number.isInteger(size) || size < 20 || !Number.isFinite(ratio) || ratio <= 0) return null;
    return Math.round(changedAxis === 'width' ? size / ratio : size * ratio);
  }

  function applyPreset(key) {
    if (!PRESETS[key]) return;
    presetSelect.value = key;
    if (key !== 'custom') {
      const preset = PRESETS[key];
      customWidthInput.value = preset.width;
      customHeightInput.value = preset.height;
      customMaxKBInput.value = preset.maxKB;
      aspectRatioSelect.value = 'target';
    }
    // Custom retains the displayed dimensions, including the previous preset's ratio.
    const width = Number(customWidthInput.value), height = Number(customHeightInput.value);
    if (width > 0 && height > 0) lockedRatio = width / height;
    updatePresetUI();
  }

  function markCustom() { presetSelect.value = 'custom'; }

  function useOriginalSize() {
    if (!cropperReady || !cropper) return;
    const { width, height } = sourceDimensions;
    const validation = validateDimensionSpecs(width, height, customMaxKBInput.value);
    if (validation.dimErrorMsg) {
      showProcessError('The original dimensions exceed the supported range (20–8,000 px per side, up to 32 megapixels). Set smaller output dimensions.');
      return;
    }
    customWidthInput.value = width;
    customHeightInput.value = height;
    lockedRatio = width / height;
    markCustom();
    addDateCheckbox.checked = false;
    dateInputGroup.style.display = 'none';
    aspectRatioSelect.value = 'original';
    if (processErrorBox) processErrorBox.classList.add('hidden');
    updatePresetUI();
    cropper.reset();
    cropper.setData({ x: 0, y: 0, width, height, rotate: 0, scaleX: 1, scaleY: 1 });
    if (window.ApplyReadyUI) window.ApplyReadyUI.notify('Full image selected at its original dimensions. Set your file limit, then resize & compress.');
  }

  function loadExample() {
    // A clearly labelled synthetic document keeps the demo local and contains no personal data.
    const canvas = document.createElement('canvas');
    canvas.width = 960; canvas.height = 1200;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 960, 1200);
    ctx.fillStyle = '#17634d'; ctx.fillRect(72, 80, 56, 7);
    ctx.fillStyle = '#182126'; ctx.font = 'bold 48px sans-serif'; ctx.fillText('Sample document', 72, 170);
    ctx.font = '24px sans-serif'; ctx.fillStyle = '#5c6970'; ctx.fillText('ApplyReady image tools · demonstration file', 72, 216);
    ctx.font = 'bold 25px sans-serif'; ctx.fillStyle = '#182126'; ctx.fillText('A simple way to prepare your files', 72, 322);
    ctx.font = '22px sans-serif'; ctx.fillStyle = '#344148';
    ['Choose your dimensions and file size limit.', 'Adjust the crop to keep the details you need.', 'Download a verified image, ready to upload.', '', 'Use original size to keep this entire document.', 'Try another preset to see how the crop changes.'].forEach((line, i) => ctx.fillText(line, 72, 375 + i * 42));
    ctx.strokeStyle = '#dfe4e7'; ctx.lineWidth = 2;
    for (let y = 710; y <= 1000; y += 58) { ctx.beginPath(); ctx.moveTo(72, y); ctx.lineTo(888, y); ctx.stroke(); }
    ctx.font = '18px sans-serif'; ctx.fillStyle = '#5c6970'; ctx.fillText('SAMPLE ONLY — no personal information', 72, 1110);
    const requestId = currentOpId;
    btnTryExample.disabled = true;
    canvas.toBlob(blob => {
      btnTryExample.disabled = false;
      if (requestId !== currentOpId) return;
      if (!blob) { showProcessError('Could not create the sample. Please choose an image instead.'); return; }
      applyPreset('document');
      handleFileSelect(new File([blob], 'ApplyReady_sample_document.png', { type: 'image/png' }));
    }, 'image/png');
  }

  function setTodayDate() {
    if (!annotationDateInput) return;
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    annotationDateInput.value = `${yyyy}-${mm}-${dd}`;
  }

  /**
   * Pure Dimension & File Size Validator
   * Validates custom dimensions, Megapixel ceiling, and size limits
   */
  function validateDimensionSpecs(rawWStr, rawHStr, rawKBStr, addDate = false) {
    const isInteger = (s) => /^\d+$/.test(String(s || '').trim());
    let width = 350;
    let height = 350;
    let maxKB = 50;
    let isValid = true;
    let dimErrorMsg = null;
    let wErrorMsg = null;
    let hErrorMsg = null;
    let sizeErrorMsg = null;

    let wValid = false;
    let hValid = false;

    if (!isInteger(rawWStr)) {
      wErrorMsg = 'Width must be a positive integer.';
      dimErrorMsg = wErrorMsg;
      isValid = false;
    } else {
      const wVal = Number(rawWStr);
      if (!Number.isFinite(wVal) || !Number.isInteger(wVal) || wVal < 20 || wVal > 8000) {
        wErrorMsg = 'Width must be an integer between 20 and 8,000 px.';
        dimErrorMsg = wErrorMsg;
        isValid = false;
      } else {
        width = wVal;
        wValid = true;
      }
    }

    if (!isInteger(rawHStr)) {
      hErrorMsg = 'Height must be a positive integer.';
      dimErrorMsg = dimErrorMsg || hErrorMsg;
      isValid = false;
    } else {
      const hVal = Number(rawHStr);
      if (!Number.isFinite(hVal) || !Number.isInteger(hVal) || hVal < 20 || hVal > 8000) {
        hErrorMsg = 'Height must be an integer between 20 and 8,000 px.';
        dimErrorMsg = dimErrorMsg || hErrorMsg;
        isValid = false;
      } else {
        height = hVal;
        hValid = true;
      }
    }

    if (wValid && hValid && (width * height > 32000000)) {
      dimErrorMsg = 'Total image pixels exceed safe limit (32 Megapixels).';
      wErrorMsg = 'Total image pixels exceed safe limit (32 Megapixels).';
      hErrorMsg = 'Total image pixels exceed safe limit (32 Megapixels).';
      isValid = false;
    }

    if (wValid && addDate && width < 160) {
      dimErrorMsg = 'Width must be at least 160 px for a readable text strip.';
      wErrorMsg = dimErrorMsg;
      isValid = false;
    }

    if (hValid && addDate && height < 80) {
      dimErrorMsg = 'Height must be at least 80 px when Name / Date strip is enabled.';
      hErrorMsg = dimErrorMsg;
      isValid = false;
    }

    if (!isInteger(rawKBStr)) {
      sizeErrorMsg = 'Max file size must be a positive integer.';
      isValid = false;
    } else {
      const kbVal = Number(rawKBStr);
      if (!Number.isFinite(kbVal) || !Number.isInteger(kbVal) || kbVal < 5 || kbVal > 20000) {
        sizeErrorMsg = 'Max file size must be between 5 and 20,000 KB.';
        isValid = false;
      } else {
        maxKB = kbVal;
      }
    }

    return {
      isValid,
      width,
      height,
      maxKB,
      dimErrorMsg,
      wErrorMsg,
      hErrorMsg,
      sizeErrorMsg
    };
  }

  /**
   * Validate and retrieve active specifications
   */
  function getActiveSpecs() {
    hideErrors();
    const isCustom = currentPresetKey === 'custom';
    const addDate = Boolean(addDateCheckbox && addDateCheckbox.checked);
    let width = 350;
    let height = 350;
    let maxKB = 50;
    let prefix = 'ApplyReady_Custom';
    let isValid = true;

    if (isCustom) {
      const rawWStr = customWidthInput ? customWidthInput.value : '';
      const rawHStr = customHeightInput ? customHeightInput.value : '';
      const rawKBStr = customMaxKBInput ? customMaxKBInput.value : '';

      const validation = validateDimensionSpecs(rawWStr, rawHStr, rawKBStr, addDate);
      width = validation.width;
      height = validation.height;
      maxKB = validation.maxKB;
      isValid = validation.isValid;

      if (validation.dimErrorMsg) {
        showDimError(validation.dimErrorMsg, validation.wErrorMsg, validation.hErrorMsg);
      }
      if (validation.sizeErrorMsg) {
        showSizeError(validation.sizeErrorMsg);
      }

      prefix = 'Custom';
    } else {
      const p = PRESETS[currentPresetKey] || PRESETS['custom'];
      width = p.width;
      height = p.height;
      maxKB = p.maxKB;
      prefix = p.defaultPrefix;

      if (addDate && height < 80) {
        showDimError('Height must be at least 80 px when Name / Date strip is enabled.', null, true);
        isValid = false;
      }
    }

    const mimeType = formatSelect ? formatSelect.value : 'image/jpeg';
    const bgFill = bgFillSelect ? bgFillSelect.value : 'white';

    return {
      width,
      height,
      maxKB,
      mimeType,
      bgFill,
      prefix,
      isValid
    };
  }

  function showDimError(msg, wErr, hErr) {
    if (dimError) {
      dimError.textContent = msg;
      dimError.classList.remove('hidden');
    }
    if (customWidthInput && (wErr || (!wErr && !hErr))) { customWidthInput.classList.add('is-invalid'); customWidthInput.setAttribute('aria-invalid', 'true'); }
    if (customHeightInput && (hErr || (!wErr && !hErr))) { customHeightInput.classList.add('is-invalid'); customHeightInput.setAttribute('aria-invalid', 'true'); }
  }

  function showSizeError(msg) {
    if (sizeError) {
      sizeError.textContent = msg;
      sizeError.classList.remove('hidden');
    }
    if (customMaxKBInput) { customMaxKBInput.classList.add('is-invalid'); customMaxKBInput.setAttribute('aria-invalid', 'true'); }
  }

  function hideErrors() {
    if (dimError) dimError.classList.add('hidden');
    if (sizeError) sizeError.classList.add('hidden');
    if (customWidthInput) customWidthInput.classList.remove('is-invalid');
    if (customHeightInput) customHeightInput.classList.remove('is-invalid');
    if (customMaxKBInput) customMaxKBInput.classList.remove('is-invalid');
    [customWidthInput, customHeightInput, customMaxKBInput].forEach(input => { if (input) input.removeAttribute('aria-invalid'); });
  }

  /**
   * Update Preset UI and Cropper Aspect Ratio
   */
  function updatePresetUI() {
    currentPresetKey = presetSelect.value;
    if (customControls) customControls.classList.remove('hidden');
    if (doc) doc.querySelectorAll('[data-preset]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.preset === currentPresetKey));
    });

    const specs = getActiveSpecs();
    if (specs.isValid) {
      if (specDims) specDims.textContent = `${specs.width} × ${specs.height} px`;
      if (specSize) specSize.textContent = `Under ${specs.maxKB} KB`;
      if (btnProcess) btnProcess.disabled = !cropperReady || processing;
    } else {
      if (specDims) specDims.textContent = 'Invalid dimensions';
      if (specSize) specSize.textContent = 'Invalid size limit';
      if (btnProcess) btnProcess.disabled = true;
    }

    if (specFormat) {
      const formatNames = { 'image/jpeg': 'JPEG', 'image/png': 'PNG', 'image/webp': 'WebP' };
      specFormat.textContent = formatNames[specs.mimeType] || 'JPEG';
    }

    invalidateResult();
    if (specs.isValid) {
      updateCropperRatio();
    }
  }

  /**
   * Update Cropper aspect ratio according to settings and annotations
   */
  function updateCropperRatio() {
    if (!cropper) return;
    const specs = getActiveSpecs();
    if (!specs.isValid) return;

    const ratioType = aspectRatioSelect ? aspectRatioSelect.value : 'target';

    if (ratioType === 'free') {
      cropper.setAspectRatio(NaN);
      return;
    }

    if (ratioType === 'original' && sourceDimensions.width > 0 && sourceDimensions.height > 0) {
      cropper.setAspectRatio(sourceDimensions.width / sourceDimensions.height);
      return;
    }

    if (ratioType === '1:1') {
      cropper.setAspectRatio(1);
      return;
    }

    if (ratioType === '4:3') {
      cropper.setAspectRatio(4 / 3);
      return;
    }

    if (ratioType === '16:9') {
      cropper.setAspectRatio(16 / 9);
      return;
    }

    // Default 'target': Match the exact area that will be drawn!
    const addDate = addDateCheckbox && addDateCheckbox.checked;
    if (addDate) {
      // Calculate photo region height above strip to prevent distortion
      const stripHeight = Math.max(34, Math.round(specs.height * 0.16));
      const photoHeight = Math.max(1, specs.height - stripHeight);
      cropper.setAspectRatio(specs.width / photoHeight);
    } else {
      cropper.setAspectRatio(specs.width / specs.height);
    }
  }

  /**
   * Invalidate previous download and result
   */
  function invalidateResult() {
    configRevision++;
    if (processing) {
      processing = false;
      btnProcess.innerHTML = processLabel;
      btnProcess.disabled = !cropperReady;
      btnProcess.removeAttribute('aria-busy');
    }
    if (cropperReady && cropperActiveArea) cropperActiveArea.classList.remove('hidden');
    if (resultArea) resultArea.classList.add('hidden');
    setWorkspaceStatus(cropperReady ? 'Ready to edit' : 'No image selected');
    if (btnDownload) {
      btnDownload.removeAttribute('href');
      btnDownload.removeAttribute('download');
    }
    if (processedBlobUrl) {
      URL.revokeObjectURL(processedBlobUrl);
      processedBlobUrl = null;
    }
    if (btnViewProcessed && btnViewOriginal) {
      btnViewProcessed.classList.add('active');
      btnViewProcessed.setAttribute('aria-pressed', 'true');
      btnViewOriginal.classList.remove('active');
      btnViewOriginal.setAttribute('aria-pressed', 'false');
    }
    if (resultImage) resultImage.classList.remove('hidden');
    if (originalComparisonImage) originalComparisonImage.classList.add('hidden');
  }

  /**
   * Attach all DOM Event Listeners
   */
  function attachEventListeners() {
    presetSelect.addEventListener('change', () => applyPreset(presetSelect.value));
    doc.querySelectorAll('[data-preset]').forEach(button => {
      button.addEventListener('click', () => applyPreset(button.dataset.preset));
    });
    if (btnOriginalSize) btnOriginalSize.addEventListener('click', useOriginalSize);
    if (btnTryExample) btnTryExample.addEventListener('click', loadExample);

    if (btnLockAspect) {
      btnLockAspect.addEventListener('click', () => {
        isAspectLocked = !isAspectLocked;
        btnLockAspect.classList.toggle('active', isAspectLocked);
        btnLockAspect.setAttribute('aria-pressed', String(isAspectLocked));
        btnLockAspect.title = isAspectLocked ? 'Aspect ratio locked (proportional width & height)' : 'Aspect ratio unlocked';
        btnLockAspect.innerHTML = isAspectLocked ? '<i aria-hidden="true" class="fa-solid fa-lock"></i>' : '<i aria-hidden="true" class="fa-solid fa-lock-open"></i>';
        if (isAspectLocked) {
          const w = parseFloat(customWidthInput.value) || 350;
          const h = parseFloat(customHeightInput.value) || 350;
          if (w > 0 && h > 0) lockedRatio = w / h;
        }
      });
    }

    customWidthInput.addEventListener('input', () => {
      markCustom();
      if (isAspectLocked && lockedRatio > 0 && document.activeElement === customWidthInput) {
        const height = scaleLockedDimension(customWidthInput.value, lockedRatio, 'width');
        if (height !== null) customHeightInput.value = height;
      }
      updatePresetUI();
    });

    customHeightInput.addEventListener('input', () => {
      markCustom();
      if (isAspectLocked && lockedRatio > 0 && document.activeElement === customHeightInput) {
        const width = scaleLockedDimension(customHeightInput.value, lockedRatio, 'height');
        if (width !== null) customWidthInput.value = width;
      }
      updatePresetUI();
    });

    customMaxKBInput.addEventListener('input', () => {
      markCustom();
      updatePresetUI();
    });

    [customWidthInput, customHeightInput, customMaxKBInput].forEach(inp => {
      inp.addEventListener('blur', () => {
        getActiveSpecs();
      });
    });

    if (formatSelect) {
      formatSelect.addEventListener('change', () => {
        const val = formatSelect.value;
        if (bgFillSelect) {
          // Transparency is only supported on PNG / WebP
          const transparentOption = bgFillSelect.querySelector('option[value="transparent"]');
          if (transparentOption) {
            transparentOption.disabled = (val === 'image/jpeg');
            // Keep transparency by default, but never override a fill the person chose.
            if (val !== 'image/jpeg' && !bgFillChosen) bgFillSelect.value = 'transparent';
            if (val === 'image/jpeg' && bgFillSelect.value === 'transparent') {
              bgFillSelect.value = 'white';
            }
          }
        }
        updatePresetUI();
      });
    }

    if (bgFillSelect) {
      bgFillSelect.addEventListener('change', () => {
        bgFillChosen = true;
        invalidateResult();
      });
    }

    if (aspectRatioSelect) {
      aspectRatioSelect.addEventListener('change', () => {
        updateCropperRatio();
        invalidateResult();
      });
    }

    addDateCheckbox.addEventListener('change', () => {
      if (dateInputGroup) {
        dateInputGroup.style.display = addDateCheckbox.checked ? 'block' : 'none';
      }
      updatePresetUI();
    });

    if (btnTodayDate) {
      btnTodayDate.addEventListener('click', () => {
        setTodayDate();
        invalidateResult();
      });
    }

    if (annotationDateInput) {
      annotationDateInput.addEventListener('input', invalidateResult);
      annotationDateInput.addEventListener('change', invalidateResult);
    }

    if (candidateNameInput) {
      candidateNameInput.addEventListener('input', invalidateResult);
    }

    // File Input & Dropzone
    btnBrowse.addEventListener('click', () => fileInput.click());
    dropzone.addEventListener('click', (e) => {
      if (e.target !== btnBrowse && !btnBrowse.contains(e.target)) {
        fileInput.click();
      }
    });

    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        handleFileSelect(e.target.files[0]);
      }
      // Reset input value to allow selecting the same file again
      fileInput.value = '';
    });

    // Accept replacements anywhere in the workspace, including over an active crop.
    const dropTarget = doc.querySelector('.image-stage') || dropzone;
    dropTarget.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.add('dragover');
    });

    dropTarget.addEventListener('dragleave', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove('dragover');
    });

    dropTarget.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove('dragover');
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleFileSelect(e.dataTransfer.files[0]);
      }
    });

    // Replace file button
    if (btnReplaceFile) {
      btnReplaceFile.addEventListener('click', () => fileInput.click());
    }

    // Remove file button
    if (btnRemoveFile) {
      btnRemoveFile.addEventListener('click', removeUploadedImage);
    }

    // Before / After comparison view toggle
    if (btnViewProcessed && btnViewOriginal) {
      btnViewProcessed.addEventListener('click', () => {
        btnViewProcessed.classList.add('active');
        btnViewProcessed.setAttribute('aria-pressed', 'true');
        btnViewOriginal.classList.remove('active');
        btnViewOriginal.setAttribute('aria-pressed', 'false');
        if (resultImage) resultImage.classList.remove('hidden');
        if (originalComparisonImage) originalComparisonImage.classList.add('hidden');
      });

      btnViewOriginal.addEventListener('click', () => {
        btnViewOriginal.classList.add('active');
        btnViewOriginal.setAttribute('aria-pressed', 'true');
        btnViewProcessed.classList.remove('active');
        btnViewProcessed.setAttribute('aria-pressed', 'false');
        if (originalComparisonImage) originalComparisonImage.classList.remove('hidden');
        if (resultImage) resultImage.classList.add('hidden');
      });
    }

    const cropSurface = imageToCrop.closest('.cropper-container-wrapper');
    cropSurface.addEventListener('keydown', e => {
      if (!cropperReady || !cropper || !['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-','='].includes(e.key)) return;
      e.preventDefault();
      if (['+','-','='].includes(e.key)) cropper.zoom(e.key === '-' ? -.05 : .05);
      else {
        const box = cropper.getCropBoxData();
        const step = e.shiftKey ? 10 : 2;
        cropper.setCropBoxData({ left: box.left + (e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0), top: box.top + (e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0) });
      }
      invalidateResult();
    });

    // Cropper Toolbar Controls
    btnRotateLeft.addEventListener('click', () => {
      if (cropper) {
        cropper.rotate(-90);
        invalidateResult();
      }
    });

    btnRotateRight.addEventListener('click', () => {
      if (cropper) {
        cropper.rotate(90);
        invalidateResult();
      }
    });

    btnResetCrop.addEventListener('click', () => {
      if (cropper) {
        cropper.reset();
        invalidateResult();
      }
    });

    btnZoomIn.addEventListener('click', () => {
      if (cropper) {
        cropper.zoom(0.1);
        invalidateResult();
      }
    });

    btnZoomOut.addEventListener('click', () => {
      if (cropper) {
        cropper.zoom(-0.1);
        invalidateResult();
      }
    });

    // Process & Download
    btnProcess.addEventListener('click', processImage);

    // Re-adjust crop
    btnCropAgain.addEventListener('click', () => {
      resultArea.classList.add('hidden');
      cropperActiveArea.classList.remove('hidden');
      setWorkspaceStatus('Ready to edit');
      cropperActiveArea.scrollIntoView({ behavior: 'smooth' });
    });
  }

  /**
   * Handle image selection and decode verification
   */
  function handleFileSelect(file) {
    if (!file) return;
    hideErrors();

    if (file.size === 0) {
      showProcessError('The selected file is empty (0 bytes). Please select a valid image.');
      return;
    }

    const MAX_SOURCE_BYTES = 50 * 1024 * 1024; // 50 MB
    if (file.size > MAX_SOURCE_BYTES) {
      const mbSize = (file.size / (1024 * 1024)).toFixed(1);
      showProcessError(`The selected file is too large (${mbSize} MB). Please choose an image under 50 MB to prevent device memory exhaustion.`);
      return;
    }

    if (!/^(image\/(jpeg|jpg|png|webp|bmp|gif|avif))$/i.test(file.type) && !(!file.type && /\.(jpg|jpeg|png|webp|bmp|gif|avif)$/i.test(file.name))) {
      showProcessError('Unsupported format. Please select a valid JPG, PNG, or WebP image.');
      return;
    }

    removeUploadedImage();
    const opId = ++currentOpId;
    currentFile = file;
    setWorkspaceStatus('Opening image…');
    if (btnProcess) btnProcess.disabled = true;

    const reader = new FileReader();
    reader.onerror = function () {
      if (opId !== currentOpId) return;
      showProcessError('Failed to read the selected file from disk.');
    };

    reader.onload = function (e) {
      if (opId !== currentOpId) return;
      const dataUrl = e.target.result;

      // Verify decoding via Image constructor
      const testImg = new Image();
      testImg.onerror = function () {
        if (opId !== currentOpId) return;
        showProcessError('Could not decode image. The file may be corrupt or an unsupported format.');
      };

      testImg.onload = function () {
        if (opId !== currentOpId) return;

        if (testImg.naturalWidth === 0 || testImg.naturalHeight === 0) {
          showProcessError('Image has invalid zero dimensions or could not be decoded.');
          return;
        }

        const totalPixels = testImg.naturalWidth * testImg.naturalHeight;
        if (totalPixels > 64000000) {
          const mp = (totalPixels / 1000000).toFixed(1);
          showProcessError(`Image resolution is extremely high (${testImg.naturalWidth} × ${testImg.naturalHeight} px, ${mp} MP). Please select an image under 64 Megapixels to prevent browser tab crashes.`);
          return;
        }

        if (typeof Cropper === 'undefined') {
          showProcessError('The image cropper library is unavailable. Please verify your internet connection or reload the page.');
          return;
        }

        sourceImage = testImg;
        sourceDimensions = {
          width: testImg.naturalWidth,
          height: testImg.naturalHeight,
          sizeBytes: file.size
        };

        // Display Source File Info
        const kbSize = (file.size / 1024).toFixed(1);
        if (fileInfoBox && fileInfoText) {
          fileInfoText.textContent = `${file.name} (${testImg.naturalWidth} × ${testImg.naturalHeight} px, ${kbSize} KB)`;
          fileInfoBox.classList.remove('hidden');
        }

        if (originalFileBlobUrl) {
          URL.revokeObjectURL(originalFileBlobUrl);
        }
        originalFileBlobUrl = URL.createObjectURL(file);
        if (originalComparisonImage) {
          originalComparisonImage.src = originalFileBlobUrl;
        }

        // Initialize Cropper.js
        if (cropper) {
          cropper.destroy();
          cropper = null;
        }

        imageToCrop.src = dataUrl;
        cropperPlaceholder.classList.add('hidden');
        cropperActiveArea.classList.remove('hidden');

        cropper = new Cropper(imageToCrop, {
          viewMode: 1,
          dragMode: 'move',
          autoCropArea: 0.95,
          restore: false,
          guides: true,
          center: true,
          highlight: false,
          cropBoxMovable: true,
          cropBoxResizable: true,
          toggleDragModeOnDblclick: false,
          ready: function () {
            if (opId !== currentOpId) return;
            cropperReady = true;
            if (btnOriginalSize) btnOriginalSize.disabled = false;
            setWorkspaceStatus('Ready to edit');
            updateCropperRatio();
            if (window.innerWidth <= 760) cropperActiveArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
            const specs = getActiveSpecs();
            if (btnProcess) btnProcess.disabled = !specs.isValid;
          },
          crop: function () {
            invalidateResult();
          }
        });
      };

      testImg.src = dataUrl;
    };

    reader.readAsDataURL(file);
  }

  /**
   * Reset / Remove image state
   */
  function removeUploadedImage() {
    currentOpId++;
    cropperReady = false;
    if (cropper) {
      cropper.destroy();
      cropper = null;
    }
    currentFile = null;
    sourceImage = null;
    sourceDimensions = { width: 0, height: 0, sizeBytes: 0 };
    imageToCrop.src = '';

    if (originalFileBlobUrl) {
      URL.revokeObjectURL(originalFileBlobUrl);
      originalFileBlobUrl = null;
    }
    if (originalComparisonImage) {
      originalComparisonImage.src = '';
    }

    if (btnProcess) btnProcess.disabled = true;
    if (btnOriginalSize) btnOriginalSize.disabled = true;
    if (fileInfoBox) fileInfoBox.classList.add('hidden');
    cropperActiveArea.classList.add('hidden');
    cropperPlaceholder.classList.remove('hidden');
    invalidateResult();
    hideErrors();
    if (processErrorBox) processErrorBox.classList.add('hidden');
  }

  function showProcessError(msg) {
    setWorkspaceStatus('Check the error below');
    if (processErrorBox && processErrorMessage) {
      processErrorMessage.textContent = msg;
      processErrorBox.classList.remove('hidden');
      processErrorBox.scrollIntoView({ behavior: 'smooth' });
    }
  }

  /**
   * Format an optional printed date
   */
  function formatAnnotationDate(dateStr) {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return dateStr;
  }

  /**
   * Draw target canvas with exact dimensions and optional distortion-free annotation strip
   */
  function generateTargetCanvas(specs, addDate) {
    const targetWidth = specs.width;
    const targetHeight = specs.height;

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');

    // Background fill
    if (specs.mimeType === 'image/jpeg' || specs.bgFill !== 'transparent') {
      ctx.fillStyle = specs.bgFill === 'black' ? '#000000' : '#FFFFFF';
      ctx.fillRect(0, 0, targetWidth, targetHeight);
    } else {
      ctx.clearRect(0, 0, targetWidth, targetHeight);
    }

    if (addDate) {
      if (targetHeight < 80) {
        throw new Error('Image height must be at least 80 px when Date / Name strip is enabled.');
      }

      const stripHeight = Math.max(34, Math.round(targetHeight * 0.16));
      const photoHeight = Math.max(1, targetHeight - stripHeight);

      // Cropped canvas without forcing aspect distortion
      const croppedCanvas = cropper.getCroppedCanvas({
        width: targetWidth, maxWidth: 8000, maxHeight: Math.min(8000, Math.floor(32000000 / targetWidth)),
        imageSmoothingEnabled: true,
        imageSmoothingQuality: 'high'
      });

      if (!croppedCanvas) {
        throw new Error('Failed to extract cropped canvas.');
      }

      const cropAspect = croppedCanvas.width / croppedCanvas.height;
      const destAspect = targetWidth / photoHeight;

      if (Math.abs(cropAspect - destAspect) < 0.01) {
        ctx.drawImage(croppedCanvas, 0, 0, targetWidth, photoHeight);
      } else {
        // Fit within photo area preserving aspect ratio
        let drawW = targetWidth;
        let drawH = drawW / cropAspect;
        if (drawH > photoHeight) {
          drawH = photoHeight;
          drawW = drawH * cropAspect;
        }
        const drawX = Math.round((targetWidth - drawW) / 2);
        const drawY = Math.round((photoHeight - drawH) / 2);
        ctx.drawImage(croppedCanvas, drawX, drawY, Math.round(drawW), Math.round(drawH));
      }

      // Draw white annotation strip at bottom
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, photoHeight, targetWidth, stripHeight);

      // Border above strip
      ctx.strokeStyle = '#D1D5DB';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, photoHeight);
      ctx.lineTo(targetWidth, photoHeight);
      ctx.stroke();

      // Render Text
      const candidateName = candidateNameInput ? candidateNameInput.value.trim().toUpperCase() : '';
      const rawDate = annotationDateInput ? annotationDateInput.value : '';
      const formattedDate = formatAnnotationDate(rawDate);

      ctx.fillStyle = '#000000';
      ctx.textAlign = 'center';

      const hasName = Boolean(candidateName);
      const hasDate = Boolean(formattedDate);

      if (hasName && hasDate) {
        // Two lines: Candidate Name + Date
        let nameFontSize = Math.max(9, Math.round(stripHeight * 0.32));
        ctx.font = `bold ${nameFontSize}px 'Inter', 'ApplyReady Devanagari', sans-serif`;

        // Fit long or Unicode names without clipping
        const maxTextWidth = targetWidth * 0.92;
        while (ctx.measureText(candidateName).width > maxTextWidth && nameFontSize > 7) {
          nameFontSize -= 1;
          ctx.font = `bold ${nameFontSize}px 'Inter', 'ApplyReady Devanagari', sans-serif`;
        }

        let displayName = candidateName;
        if (ctx.measureText(displayName).width > maxTextWidth) {
          const chars = Array.from(candidateName);
          while (chars.length > 1 && ctx.measureText(chars.join('') + '…').width > maxTextWidth) {
            chars.pop();
          }
          displayName = chars.join('') + '…';
        }

        ctx.textBaseline = 'middle';
        ctx.fillText(displayName, targetWidth / 2, photoHeight + (stripHeight * 0.35));

        let dateFontSize = Math.max(8, Math.round(stripHeight * 0.28));
        ctx.font = `600 ${dateFontSize}px 'Inter', 'ApplyReady Devanagari', sans-serif`;
        while (ctx.measureText(`DATE: ${formattedDate}`).width > targetWidth * .92 && dateFontSize > 7) { dateFontSize--; ctx.font = `600 ${dateFontSize}px 'Inter', 'ApplyReady Devanagari', sans-serif`; }
        ctx.fillText(`DATE: ${formattedDate}`, targetWidth / 2, photoHeight + (stripHeight * 0.75));
      } else if (hasName) {
        // Single centered candidate name
        let nameFontSize = Math.max(10, Math.round(stripHeight * 0.44));
        ctx.font = `bold ${nameFontSize}px 'Inter', 'ApplyReady Devanagari', sans-serif`;

        const maxTextWidth = targetWidth * 0.92;
        while (ctx.measureText(candidateName).width > maxTextWidth && nameFontSize > 7) {
          nameFontSize -= 1;
          ctx.font = `bold ${nameFontSize}px 'Inter', 'ApplyReady Devanagari', sans-serif`;
        }

        let displayName = candidateName;
        if (ctx.measureText(displayName).width > maxTextWidth) {
          const chars = Array.from(candidateName);
          while (chars.length > 1 && ctx.measureText(chars.join('') + '…').width > maxTextWidth) {
            chars.pop();
          }
          displayName = chars.join('') + '…';
        }

        ctx.textBaseline = 'middle';
        ctx.fillText(displayName, targetWidth / 2, photoHeight + (stripHeight / 2));
      } else if (hasDate) {
        // Single centered date line
        let fontSize = Math.max(10, Math.round(stripHeight * 0.44));
        ctx.font = `bold ${fontSize}px 'Inter', 'ApplyReady Devanagari', sans-serif`;
        while (ctx.measureText(`DATE: ${formattedDate}`).width > targetWidth * .92 && fontSize > 7) { fontSize--; ctx.font = `bold ${fontSize}px 'Inter', 'ApplyReady Devanagari', sans-serif`; }
        ctx.textBaseline = 'middle';
        ctx.fillText(`DATE: ${formattedDate}`, targetWidth / 2, photoHeight + (stripHeight / 2));
      }
    } else {
      // Full canvas without strip
      const croppedCanvas = cropper.getCroppedCanvas({
        width: targetWidth, maxWidth: 8000, maxHeight: Math.min(8000, Math.floor(32000000 / targetWidth)),
        imageSmoothingEnabled: true,
        imageSmoothingQuality: 'high'
      });

      if (!croppedCanvas) {
        throw new Error('Failed to extract cropped canvas.');
      }

      const cropAspect = croppedCanvas.width / croppedCanvas.height;
      const destAspect = targetWidth / targetHeight;

      if (Math.abs(cropAspect - destAspect) < 0.01) {
        ctx.drawImage(croppedCanvas, 0, 0, targetWidth, targetHeight);
      } else {
        // Fit within target preserving aspect ratio
        let drawW = targetWidth;
        let drawH = drawW / cropAspect;
        if (drawH > targetHeight) {
          drawH = targetHeight;
          drawW = drawH * cropAspect;
        }
        const drawX = Math.round((targetWidth - drawW) / 2);
        const drawY = Math.round((targetHeight - drawH) / 2);
        ctx.drawImage(croppedCanvas, drawX, drawY, Math.round(drawW), Math.round(drawH));
      }
    }

    return canvas;
  }

  /**
   * Strict Compression Algorithm
   * Never resolves oversized images as success!
   * Clearly handles PNG lossless limitation honestly.
   */
  async function compressStrictly(canvas, maxKB, mimeType) {
    const maxBytes = maxKB * 1024;
    const encode = quality => new Promise((resolve, reject) => {
      try {
        canvas.toBlob(blob => {
          if (!blob) return reject(new Error('Image encoding failed. Try a smaller image.'));
          if (blob.type !== mimeType) return reject(new Error('Your browser cannot export this format. Choose JPEG or PNG.'));
          resolve(blob);
        }, mimeType, quality);
      } catch (error) { reject(error); }
    });
    let best = await encode(0.95);
    if (best.size <= maxBytes) return best;
    if (mimeType === 'image/png') throw new Error(`PNG needs ${(best.size / 1024).toFixed(1)} KB at this size. Increase the file limit, reduce dimensions, or choose WebP or JPEG.`);
    best = await encode(0.05);
    if (best.size > maxBytes) throw new Error(`The smallest result is ${(best.size / 1024).toFixed(1)} KB. Increase the file limit or reduce the dimensions to preserve a usable image.`);
    // Find the highest quality that really meets the byte limit.
    let low = 0.05, high = 0.95;
    for (let i = 0; i < 7; i++) {
      const quality = (low + high) / 2;
      const candidate = await encode(quality);
      if (candidate.size <= maxBytes) { best = candidate; low = quality; }
      else high = quality;
    }
    return best;
  }

  /**
   * Process & Compress Image with Strict Post-Validation
   */
  async function processImage() {
    if (!cropper || !cropperReady || processing) return;
    hideErrors();
    if (processErrorBox) processErrorBox.classList.add('hidden');

    const specs = getActiveSpecs();
    if (dimError && !dimError.classList.contains('hidden')) return;
    if (sizeError && !sizeError.classList.contains('hidden')) return;

    const opId = ++currentOpId;
    const revision = configRevision;
    let validationUrl = null;
    processing = true;
    setWorkspaceStatus('Processing…');
    btnProcess.setAttribute('aria-busy', 'true');
    btnProcess.disabled = true;
    btnProcess.innerHTML = '<i aria-hidden="true" class="fa-solid fa-spinner fa-spin"></i> Processing & Compressing...';

    try {
      const addDate = addDateCheckbox && addDateCheckbox.checked;
      if (addDate && document.fonts) await document.fonts.ready;

      // 1. Generate Target Canvas
      const canvas = generateTargetCanvas(specs, addDate);
      if (opId !== currentOpId || revision !== configRevision) return;

      // 2. Strict Compression
      const compressedBlob = await compressStrictly(canvas, specs.maxKB, specs.mimeType);
      if (opId !== currentOpId || revision !== configRevision) return;

      // 3. Post-Compression Validation: Decode blob and check dimensions, bytes, and MIME
      if (compressedBlob.size > specs.maxKB * 1024) {
        throw new Error(`Output file size (${compressedBlob.size} bytes) exceeds limit.`);
      }

      if (compressedBlob.type !== specs.mimeType) {
        throw new Error(`MIME type mismatch. Expected ${specs.mimeType}, got ${compressedBlob.type}.`);
      }

      // Decode blob back to verify integrity and exact pixel dimensions
      const validationImg = new Image();
      validationUrl = URL.createObjectURL(compressedBlob);

      await new Promise((resolveVal, rejectVal) => {
        validationImg.onload = () => {
          if (validationImg.naturalWidth !== specs.width || validationImg.naturalHeight !== specs.height) {
            rejectVal(new Error(`Measured output dimensions (${validationImg.naturalWidth} × ${validationImg.naturalHeight} px) do not match target (${specs.width} × ${specs.height} px).`));
          } else {
            resolveVal();
          }
        };
        validationImg.onerror = () => rejectVal(new Error('Encoded blob could not be decoded.'));
        validationImg.src = validationUrl;
      });

      if (opId !== currentOpId || revision !== configRevision) {
        URL.revokeObjectURL(validationUrl);
        return;
      }

      // Clean up previous blob URL
      if (processedBlobUrl) {
        URL.revokeObjectURL(processedBlobUrl);
      }
      processedBlobUrl = validationUrl;
      validationUrl = null;

      // Update Result UI
      resultImage.src = processedBlobUrl;

      const resultOrigDims = document.getElementById('resultOrigDims');
      const resultTargetDims = document.getElementById('resultTargetDims');
      const resultTargetSize = document.getElementById('resultTargetSize');

      if (resultOrigDims) {
        resultOrigDims.textContent = `${sourceDimensions.width} × ${sourceDimensions.height} px`;
      }
      if (resultTargetDims) {
        resultTargetDims.textContent = `${specs.width} × ${specs.height} px`;
      }
      if (resultDims) {
        resultDims.textContent = `${validationImg.naturalWidth} × ${validationImg.naturalHeight} px (Measured)`;
      }
      if (resultTargetSize) {
        resultTargetSize.textContent = `Under ${specs.maxKB} KB (${(specs.maxKB * 1024).toLocaleString()} bytes)`;
      }

      const actualBytes = compressedBlob.size;
      const actualKB = (actualBytes / 1024).toFixed(2);
      resultFileSize.textContent = `${actualBytes.toLocaleString()} bytes (${actualKB} KB, 1 KB = 1024 B)`;

      if (compProcessedKB) {
        compProcessedKB.textContent = `${actualKB} KB`;
      }
      if (compOriginalKB && currentFile) {
        compOriginalKB.textContent = `${(currentFile.size / 1024).toFixed(1)} KB`;
      }

      const formatNames = { 'image/jpeg': 'JPEG', 'image/png': 'PNG', 'image/webp': 'WebP' };
      if (resultFormat) resultFormat.textContent = formatNames[specs.mimeType] || specs.mimeType;

      if (resultStatus) {
        resultStatus.textContent = `Satisfies target of under ${specs.maxKB} KB`;
        resultStatus.className = 'meta-stat-val status-ok';
      }

      // Set Download Link
      const ext = specs.mimeType === 'image/png' ? 'png' : specs.mimeType === 'image/webp' ? 'webp' : 'jpg';
      const dateSuffix = addDate ? '_Dated' : '';
      const filename = `${specs.prefix}${dateSuffix}_${specs.width}x${specs.height}.${ext}`;

      btnDownload.href = processedBlobUrl;
      btnDownload.download = filename;

      // Switch views
      cropperActiveArea.classList.add('hidden');
      resultArea.classList.remove('hidden');
      setWorkspaceStatus('Ready to download');
      resultArea.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      btnDownload.focus();

    } catch (err) {
      if (opId !== currentOpId || revision !== configRevision) return;

      const msg = err && err.message ? err.message : 'An unexpected error occurred while processing the image.';
      showProcessError(msg);
    } finally {
      if (validationUrl) URL.revokeObjectURL(validationUrl);
      if (opId === currentOpId && revision === configRevision) {
        processing = false;
        btnProcess.disabled = !cropperReady || !getActiveSpecs().isValid;
        btnProcess.innerHTML = processLabel;
        btnProcess.removeAttribute('aria-busy');
      }
    }
  }

  // Initialize on DOM ready (browser only)
  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', init);
  }

  // Export for testing
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      PRESETS,
      scaleLockedDimension,
      formatAnnotationDate,
      validateDimensionSpecs
    };
  }

})();
