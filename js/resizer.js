/**
 * ApplyReady.in - General-Purpose Image Resizer & Strict Compressor
 * 100% Client-Side Processing (HTML5 Canvas, Cropper.js)
 * Zero server uploads.
 */

(function () {
  'use strict';

  // General-Purpose & Official Exam Presets
  const FALLBACK_PRESETS = {
    'custom': {
      name: 'Custom Dimensions & Limit',
      width: 350,
      height: 350,
      maxKB: 50,
      minKB: 0,
      defaultPrefix: 'ApplyReady_Custom'
    },
    'avatar': {
      name: 'Profile / Avatar (400 × 400 px, max 100 KB)',
      width: 400,
      height: 400,
      maxKB: 100,
      minKB: 0,
      defaultPrefix: 'Avatar'
    },
    'passport': {
      name: 'ID / Passport Photo (350 × 450 px, max 50 KB)',
      width: 350,
      height: 450,
      maxKB: 50,
      minKB: 0,
      defaultPrefix: 'Passport_Photo'
    },
    'signature': {
      name: 'Signature / Stamp (300 × 100 px, max 30 KB)',
      width: 300,
      height: 100,
      maxKB: 30,
      minKB: 0,
      defaultPrefix: 'Signature'
    },
    'web-banner': {
      name: 'Social / Web Card (1200 × 630 px, max 300 KB)',
      width: 1200,
      height: 630,
      maxKB: 300,
      minKB: 0,
      defaultPrefix: 'Web_Card'
    },
    'document': {
      name: 'Document Scan (800 × 1000 px, max 200 KB)',
      width: 800,
      height: 1000,
      maxKB: 200,
      minKB: 0,
      defaultPrefix: 'Document'
    },
    'thumb': {
      name: 'Left Thumb Impression (240 × 240 px, 20–50 KB)',
      width: 240,
      height: 240,
      minKB: 20,
      maxKB: 50,
      defaultPrefix: 'Thumb_Impression'
    },
    'declaration': {
      name: 'Handwritten Declaration (800 × 400 px, 50–100 KB)',
      width: 800,
      height: 400,
      minKB: 50,
      maxKB: 100,
      defaultPrefix: 'Declaration'
    },
    'ssc-signature': {
      name: 'SSC Signature (6.0 × 2.0 cm at 300 DPI = 709 × 236 px, 10–20 KB)',
      width: 709,
      height: 236,
      minKB: 10,
      maxKB: 20,
      defaultPrefix: 'SSC_Signature'
    },
    'upsc-photo': {
      name: 'UPSC Photo (20–200 KB JPG; UPSC sets no pixel size, 350 × 450 px suggested)',
      width: 350,
      height: 450,
      minKB: 20,
      maxKB: 200,
      suggested: true,
      defaultPrefix: 'UPSC_Photo'
    },
    'upsc-signature': {
      name: 'UPSC Triple Signature (400 × 400 px, within 350–500 px, 20–100 KB)',
      width: 400,
      height: 400,
      minKB: 20,
      maxKB: 100,
      defaultPrefix: 'UPSC_Signature'
    },
    'ibps-photo': {
      name: 'IBPS Photo (200 × 230 px, 20–50 KB)',
      width: 200,
      height: 230,
      minKB: 20,
      maxKB: 50,
      defaultPrefix: 'IBPS_Photo'
    },
    'ibps-signature': {
      name: 'IBPS Signature (140 × 60 px, 10–20 KB)',
      width: 140,
      height: 60,
      minKB: 10,
      maxKB: 20,
      defaultPrefix: 'IBPS_Signature'
    },
    'neet-photo': {
      name: 'NEET Photo (10–200 KB JPG; NTA sets no pixel size, 400 × 500 px suggested)',
      width: 400,
      height: 500,
      minKB: 10,
      maxKB: 200,
      suggested: true,
      defaultPrefix: 'NEET_Photo'
    },
    'neet-signature': {
      name: 'NEET Signature (10–100 KB JPG; NTA sets no pixel size, 300 × 100 px suggested)',
      width: 300,
      height: 100,
      minKB: 10,
      maxKB: 100,
      suggested: true,
      defaultPrefix: 'NEET_Signature'
    },
    'kb-10': {
      name: 'Target: Under 10 KB',
      width: 300,
      height: 300,
      maxKB: 10,
      minKB: 0,
      defaultPrefix: 'Image_10KB'
    },
    'kb-20': {
      name: 'Target: Under 20 KB',
      width: 350,
      height: 350,
      maxKB: 20,
      minKB: 0,
      defaultPrefix: 'Image_20KB'
    },
    'kb-50': {
      name: 'Target: Under 50 KB',
      width: 400,
      height: 500,
      maxKB: 50,
      minKB: 0,
      defaultPrefix: 'Image_50KB'
    },
    'kb-100': {
      name: 'Target: Under 100 KB',
      width: 600,
      height: 600,
      maxKB: 100,
      minKB: 0,
      defaultPrefix: 'Image_100KB'
    },
    'kb-200': {
      name: 'Target: Under 200 KB',
      width: 800,
      height: 800,
      maxKB: 200,
      minKB: 0,
      defaultPrefix: 'Image_200KB'
    }
  };

  const PRESETS = (typeof window !== 'undefined' && window.APPLYREADY_PRESETS)
    ? window.APPLYREADY_PRESETS
    : FALLBACK_PRESETS;

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
  let processLabel = '<i class="fa-solid fa-bolt" aria-hidden="true"></i> Resize & compress';
  let busyLabel = '<i aria-hidden="true" class="fa-solid fa-spinner fa-spin"></i> Processing & Compressing...';

  // DOM Elements (safe for Node test environments)
  const doc = typeof document !== 'undefined' ? document : null;
  const getEl = (id) => doc ? doc.getElementById(id) : null;
  const on = (el, evt, fn) => {
    if (el && typeof el.addEventListener === 'function') {
      el.addEventListener(evt, fn);
    }
  };

  const presetSelect = getEl('presetSelect');
  const customControls = getEl('customControls');
  const customWidthInput = getEl('customWidth');
  const customHeightInput = getEl('customHeight');
  const customMaxKBInput = getEl('customMaxKB');
  const customMinKBInput = getEl('customMinKB');
  const unitSelect = getEl('unitSelect');
  const dpiSelect = getEl('dpiSelect');
  const dpiGroup = getEl('dpiGroup');
  const formatSelect = getEl('formatSelect');
  const bgFillSelect = getEl('bgFillSelect');
  const aspectRatioSelect = getEl('aspectRatioSelect');

  const dimError = getEl('dimError');
  const sizeError = getEl('sizeError');
  const processErrorBox = getEl('processErrorBox');
  const processErrorMessage = getEl('processErrorMessage');

  const processSummary = getEl('processSummary');
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
  // Pages in other languages carry their own button label in the markup.
  if (btnProcess && btnProcess.dataset && btnProcess.dataset.busyLabel) {
    processLabel = btnProcess.innerHTML.trim() || processLabel;
    busyLabel = '<i aria-hidden="true" class="fa-solid fa-spinner fa-spin"></i> ' + btnProcess.dataset.busyLabel;
  }

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

  // Requirement panel: a grid of requirements that folds into a one-line summary once chosen.
  // On the home page nothing is assumed (data-require-choice): processing waits for a choice.
  const appRoot = getEl('resizerApp');
  const reqPanel = getEl('reqPanel');
  const btnChangeReq = getEl('btnChangeReq');
  const reqSummaryName = getEl('reqSummaryName');
  const reqSummarySpec = getEl('reqSummarySpec');
  let requirementChosen = !(appRoot && appRoot.hasAttribute && appRoot.hasAttribute('data-require-choice'));

  let originalFileBlobUrl = null;

  /**
   * Initialize Resizer Module
   */
  function init() {
    setTodayDate();
    updatePresetUI();
    attachEventListeners();

    // Check for preloaded presets via data attributes or URL parameters
    try {
      const appEl = getEl('resizerApp');
      const params = typeof window !== 'undefined' && window.location ? new URLSearchParams(window.location.search) : null;
      const targetPreset = (params && params.get('preset')) || (appEl && appEl.dataset.preset);
      const targetKB = (params && (params.get('targetKB') || params.get('maxKB'))) || (appEl && appEl.dataset.maxKb);
      const targetWidth = (params && params.get('width')) || (appEl && appEl.dataset.width);
      const targetHeight = (params && params.get('height')) || (appEl && appEl.dataset.height);

      if (params && (params.get('preset') || params.get('targetKB') || params.get('maxKB'))) chooseRequirement();
      if (targetPreset && PRESETS[targetPreset]) {
        initializing = true;
        applyPreset(targetPreset);
        initializing = false;
      } else if (targetKB) {
        if (customMaxKBInput) customMaxKBInput.value = targetKB;
        if (targetWidth && customWidthInput) customWidthInput.value = targetWidth;
        if (targetHeight && customHeightInput) customHeightInput.value = targetHeight;
        markCustom();
        updatePresetUI();
      }
      setRequirementOpen(!requirementChosen, false);
      updatePresetUI();
    } catch (_) {}
  }

  // Settings are folded by default; anything that needs a value typed in opens them.
  let initializing = false;
  function revealSettings() {
    if (initializing) return;
    const appEl = getEl('resizerApp');
    if (appEl && typeof CustomEvent === 'function') appEl.dispatchEvent(new CustomEvent('ws:reveal-settings'));
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
    if (presetSelect) {
      let opt = presetSelect.querySelector(`option[value="${key}"]`);
      if (!opt) {
        opt = document.createElement('option');
        opt.value = key;
        opt.textContent = PRESETS[key].name;
        presetSelect.appendChild(opt);
      }
      presetSelect.value = key;
    }
    if (key === 'custom') revealSettings();
    if (key !== 'custom') {
      const preset = PRESETS[key];
      if (unitSelect) unitSelect.value = 'px';
      if (dpiGroup) dpiGroup.style.display = 'none';
      const wLabel = getEl('customWidthLabel');
      const hLabel = getEl('customHeightLabel');
      if (wLabel) wLabel.textContent = 'Width (px)';
      if (hLabel) hLabel.textContent = 'Height (px)';
      if (customWidthInput) {
        customWidthInput.step = '1';
        customWidthInput.value = preset.width;
      }
      if (customHeightInput) {
        customHeightInput.step = '1';
        customHeightInput.value = preset.height;
      }
      if (customMaxKBInput) customMaxKBInput.value = preset.maxKB;
      if (customMinKBInput) customMinKBInput.value = preset.minKB || '';
      if (aspectRatioSelect) aspectRatioSelect.value = 'target';
    }
    // Custom retains the displayed dimensions, including the previous preset's ratio.
    const width = Number(customWidthInput ? customWidthInput.value : 0), height = Number(customHeightInput ? customHeightInput.value : 0);
    if (width > 0 && height > 0) lockedRatio = width / height;
    updatePresetUI();
  }

  function markCustom() {
    if (presetSelect) presetSelect.value = 'custom';
    chooseRequirement();
  }

  function chooseRequirement() {
    requirementChosen = true;
    if (appRoot) appRoot.dataset.req = 'chosen';
  }

  function setRequirementOpen(open, moveFocus) {
    if (!reqPanel) return;
    if (!open && !requirementChosen) return;
    reqPanel.dataset.open = String(open);
    if (btnChangeReq) {
      btnChangeReq.setAttribute('aria-expanded', String(open));
      btnChangeReq.textContent = open ? (btnChangeReq.dataset.labelClose || 'Close') : (btnChangeReq.dataset.labelChange || 'Change');
    }
    if (!moveFocus) return;
    if (open) {
      const target = reqPanel.querySelector('.choice[aria-pressed="true"]') || reqPanel.querySelector('.choice');
      if (target) target.focus();
    } else if (btnChangeReq) {
      btnChangeReq.focus();
    }
  }

  function useOriginalSize() {
    if (!cropperReady || !cropper) return;
    const { width, height } = sourceDimensions;
    const maxVal = customMaxKBInput ? customMaxKBInput.value : 50;
    const validation = validateDimensionSpecs(width, height, maxVal);
    if (validation.dimErrorMsg) {
      showProcessError('The original dimensions exceed the supported range (20–8,000 px per side, up to 32 megapixels). Set smaller output dimensions.');
      return;
    }
    if (customWidthInput) customWidthInput.value = width;
    if (customHeightInput) customHeightInput.value = height;
    lockedRatio = width / height;
    markCustom();
    if (addDateCheckbox) addDateCheckbox.checked = false;
    if (dateInputGroup) dateInputGroup.style.display = 'none';
    if (aspectRatioSelect) aspectRatioSelect.value = 'original';
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
    if (btnTryExample) btnTryExample.disabled = true;
    canvas.toBlob(blob => {
      if (btnTryExample) btnTryExample.disabled = false;
      if (requestId !== currentOpId) return;
      if (!blob) { showProcessError('Could not create the sample. Please choose an image instead.'); return; }
      chooseRequirement();
      applyPreset('document');
      setRequirementOpen(false, false);
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
  function validateDimensionSpecs(rawWStr, rawHStr, rawKBStr, addDate = false, rawMinKBStr = null) {
    const isInteger = (s) => /^\d+$/.test(String(s || '').trim());
    let width = 350;
    let height = 350;
    let maxKB = 50;
    let minKB = 0;
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

    if (rawMinKBStr !== null && rawMinKBStr !== undefined && String(rawMinKBStr).trim() !== '') {
      if (!isInteger(rawMinKBStr)) {
        sizeErrorMsg = 'Min file size must be a positive integer.';
        isValid = false;
      } else {
        const minVal = Number(rawMinKBStr);
        if (minVal >= maxKB) {
          sizeErrorMsg = 'Min file size must be less than max file size.';
          isValid = false;
        } else if (minVal < 0) {
          sizeErrorMsg = 'Min file size cannot be negative.';
          isValid = false;
        } else {
          minKB = minVal;
        }
      }
    }

    return {
      isValid,
      width,
      height,
      maxKB,
      minKB,
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
    let minKB = 0;
    let prefix = 'ApplyReady_Custom';
    let isValid = true;

    if (isCustom) {
      let rawWStr = customWidthInput ? customWidthInput.value : '';
      let rawHStr = customHeightInput ? customHeightInput.value : '';
      const rawKBStr = customMaxKBInput ? customMaxKBInput.value : '';
      const rawMinKBStr = customMinKBInput ? customMinKBInput.value : null;

      const unit = unitSelect ? unitSelect.value : 'px';
      const dpi = dpiSelect ? (parseInt(dpiSelect.value, 10) || 300) : 300;

      if (unit === 'cm') {
        const numW = parseFloat(rawWStr);
        const numH = parseFloat(rawHStr);
        if (!isNaN(numW) && numW > 0) rawWStr = String(Math.round((numW / 2.54) * dpi));
        if (!isNaN(numH) && numH > 0) rawHStr = String(Math.round((numH / 2.54) * dpi));
      } else if (unit === 'inch') {
        const numW = parseFloat(rawWStr);
        const numH = parseFloat(rawHStr);
        if (!isNaN(numW) && numW > 0) rawWStr = String(Math.round(numW * dpi));
        if (!isNaN(numH) && numH > 0) rawHStr = String(Math.round(numH * dpi));
      }

      const validation = validateDimensionSpecs(rawWStr, rawHStr, rawKBStr, addDate, rawMinKBStr);
      width = validation.width;
      height = validation.height;
      maxKB = validation.maxKB;
      minKB = validation.minKB || 0;
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
      minKB = p.minKB || 0;
      prefix = p.defaultPrefix;

      if (addDate && height < 80) {
        showDimError('Height must be at least 80 px when Name / Date strip is enabled.', null, true);
        isValid = false;
      }
    }

    let mimeType = formatSelect ? formatSelect.value : 'image/jpeg';
    if (mimeType === 'jpeg' || mimeType === 'jpg') mimeType = 'image/jpeg';
    else if (mimeType === 'png') mimeType = 'image/png';
    else if (mimeType === 'webp') mimeType = 'image/webp';
    const bgFill = bgFillSelect ? bgFillSelect.value : 'white';

    return {
      width,
      height,
      maxKB,
      minKB,
      mimeType,
      bgFill,
      prefix,
      isValid
    };
  }

  // Hindi pages show Hindi messages. Each entry rewrites one English message; anything not listed
  // (internal failures that should never happen) stays in English.
  const HINDI_MESSAGES = [
    [/^Width must be a positive integer\.$/, 'चौड़ाई एक पूर्ण संख्या होनी चाहिए।'],
    [/^Width must be an integer between 20 and 8,000 px\.$/, 'चौड़ाई 20 से 8,000 px के बीच की पूर्ण संख्या होनी चाहिए।'],
    [/^Height must be a positive integer\.$/, 'ऊंचाई एक पूर्ण संख्या होनी चाहिए।'],
    [/^Height must be an integer between 20 and 8,000 px\.$/, 'ऊंचाई 20 से 8,000 px के बीच की पूर्ण संख्या होनी चाहिए।'],
    [/^Total image pixels exceed safe limit/, 'कुल पिक्सेल सुरक्षित सीमा (32 मेगापिक्सेल) से अधिक हैं। साइज़ घटाएं।'],
    [/^Width must be at least 160 px/, 'नाम की पट्टी पढ़ने योग्य रहे, इसके लिए चौड़ाई कम से कम 160 px होनी चाहिए।'],
    [/[Hh]eight must be at least 80 px/, 'नाम और तारीख की पट्टी के साथ ऊंचाई कम से कम 80 px होनी चाहिए।'],
    [/^Max file size must be a positive integer\.$/, 'अधिकतम साइज एक पूर्ण संख्या होना चाहिए।'],
    [/^Max file size must be between 5 and 20,000 KB\.$/, 'अधिकतम साइज 5 से 20,000 KB के बीच होना चाहिए।'],
    [/^Min file size must be a positive integer\.$/, 'न्यूनतम साइज एक पूर्ण संख्या होना चाहिए।'],
    [/^Min file size must be less than max file size\.$/, 'न्यूनतम साइज, अधिकतम साइज से कम होना चाहिए।'],
    [/^Min file size cannot be negative\.$/, 'न्यूनतम साइज ऋणात्मक नहीं हो सकता।'],
    [/^The selected file is empty/, 'चुनी गई फाइल खाली है (0 bytes)। कृपया कोई सही फोटो चुनें।'],
    [/^The selected file is too large \(([\d.]+) MB\)/, 'फाइल बहुत बड़ी है ($1 MB)। 50 MB से छोटी फोटो चुनें।'],
    [/^Unsupported format\./, 'यह फॉर्मेट समर्थित नहीं है। JPG, PNG, WebP, GIF, BMP या AVIF फोटो चुनें।'],
    [/^iPhone photos \(HEIC\)/, 'iPhone की HEIC फोटो समर्थित नहीं हैं। Camera → Formats → Most Compatible चुनें, या फोटो को JPG के रूप में शेयर करें।'],
    [/^Failed to read the selected file/, 'फाइल पढ़ी नहीं जा सकी। उसे दोबारा चुनें।'],
    [/^(Could not decode image|Image has invalid zero dimensions)/, 'फोटो खुल नहीं सकी। फाइल खराब हो सकती है या उसका फॉर्मेट समर्थित नहीं है। दूसरी फोटो चुनें।'],
    [/^Image resolution is extremely high \(([^)]*)\)/, 'फोटो का रेज़ोल्यूशन बहुत अधिक है ($1)। 64 मेगापिक्सेल से छोटी फोटो चुनें।'],
    [/^The original dimensions exceed the supported range/, 'मूल साइज़ समर्थित सीमा (हर तरफ 20 से 8,000 px) से बाहर है। छोटा आउटपुट साइज़ चुनें।'],
    [/^PNG needs ([\d.]+) KB at this size/, 'इस साइज़ पर PNG को $1 KB चाहिए। फाइल सीमा बढ़ाएं, साइज़ घटाएं, या JPEG चुनें।'],
    [/^The smallest result is ([\d.]+) KB/, 'सबसे छोटा परिणाम $1 KB है। फाइल सीमा बढ़ाएं या साइज़ घटाएं।'],
    [/^The image cropper library is unavailable/, 'क्रॉप टूल लोड नहीं हुआ। पेज दोबारा लोड करें।']
  ];
  function localize(message) {
    if (!doc || doc.documentElement.lang !== 'hi' || !message) return message;
    for (const [pattern, hindi] of HINDI_MESSAGES) {
      const match = message.match(pattern);
      if (match) return hindi.replace(/\$(\d)/g, (all, n) => match[n] || '');
    }
    return message;
  }

  function showDimError(msg, wErr, hErr) {
    msg = localize(msg);
    revealSettings();
    if (dimError) {
      dimError.textContent = msg;
      dimError.classList.remove('hidden');
    }
    if (customWidthInput && (wErr || (!wErr && !hErr))) { customWidthInput.classList.add('is-invalid'); customWidthInput.setAttribute('aria-invalid', 'true'); }
    if (customHeightInput && (hErr || (!wErr && !hErr))) { customHeightInput.classList.add('is-invalid'); customHeightInput.setAttribute('aria-invalid', 'true'); }
  }

  function showSizeError(msg) {
    msg = localize(msg);
    revealSettings();
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
    if (presetSelect) currentPresetKey = presetSelect.value;
    if (customControls) customControls.classList.remove('hidden');
    if (doc) doc.querySelectorAll('button[data-preset], .preset-shortcut[data-preset]').forEach(button => {
      button.setAttribute('aria-pressed', String(requirementChosen && button.dataset.preset === currentPresetKey));
    });

    const specs = getActiveSpecs();
    renderRequirementSummary(specs);
    const customSpec = doc ? doc.querySelector('[data-custom-spec]') : null;
    if (customSpec) {
      if (!customSpec.dataset.empty) customSpec.dataset.empty = customSpec.textContent;
      const hindi = doc.documentElement.lang === 'hi';
      const kb = specs.minKB > 0 ? `${specs.minKB}–${specs.maxKB} KB` : (hindi ? `${specs.maxKB} KB से कम` : `under ${specs.maxKB} KB`);
      customSpec.textContent = currentPresetKey === 'custom' && requirementChosen && specs.isValid ? `${specs.width} × ${specs.height} px · ${kb}` : customSpec.dataset.empty;
    }
    if (specs.isValid) {
      if (specDims) specDims.textContent = `${specs.width} × ${specs.height} px`;
      if (specSize) {
        specSize.textContent = specs.minKB > 0 ? `${specs.minKB} KB – ${specs.maxKB} KB` : `Under ${specs.maxKB} KB`;
      }
      if (btnProcess) btnProcess.disabled = !cropperReady || processing || !requirementChosen;
    } else {
      if (specDims) specDims.textContent = 'Invalid dimensions';
      if (specSize) specSize.textContent = 'Invalid size limit';
      if (btnProcess) btnProcess.disabled = true;
    }

    if (specFormat) {
      const formatNames = { 'image/jpeg': 'JPEG', 'image/png': 'PNG', 'image/webp': 'WebP' };
      specFormat.textContent = formatNames[specs.mimeType] || 'JPEG';
    }

    renderProcessSummary(specs);
    invalidateResult();
    if (specs.isValid) {
      updateCropperRatio();
    }
  }

  // The folded requirement panel always says which requirement is in use and what it produces.
  function renderRequirementSummary(specs) {
    if (!reqSummaryName || !reqSummarySpec) return;
    if (!requirementChosen) { reqSummaryName.textContent = ''; reqSummarySpec.textContent = ''; return; }
    const button = reqPanel && reqPanel.querySelector(`.choice[data-preset="${currentPresetKey}"] .choice__name`);
    // Preset names carry their spec in brackets ("IBPS Signature (140 × 60 px, 10–20 KB)"); the size
    // details follow in reqSummarySpec, so only the short name is shown here.
    const presetName = (PRESETS[currentPresetKey] || PRESETS.custom).name.replace(/\s*\([^()]*\d[^()]*\)\s*$/, '');
    reqSummaryName.textContent = button ? button.textContent : presetName;
    if (!specs.isValid) { reqSummarySpec.textContent = ''; return; }
    const hindi = doc && doc.documentElement.lang === 'hi';
    const formatNames = { 'image/jpeg': 'JPEG', 'image/png': 'PNG', 'image/webp': 'WebP' };
    const kb = specs.minKB > 0 ? `${specs.minKB}–${specs.maxKB} KB` : (hindi ? `${specs.maxKB} KB से कम` : `under ${specs.maxKB} KB`);
    reqSummarySpec.textContent = `${specs.width} × ${specs.height} px · ${kb} · ${formatNames[specs.mimeType] || 'JPEG'}`;
  }

  /**
   * One line beside the main action, shown only when the action cannot run yet:
   * no requirement chosen, or a setting that needs fixing. Strings can be overridden
   * per page with data-* attributes (Hindi pages).
   */
  function renderProcessSummary(specs) {
    if (!processSummary || !doc) return;
    const d = processSummary.dataset || {};
    const el = (tag, text) => { const node = doc.createElement(tag); node.textContent = text; return node; };
    processSummary.textContent = '';
    processSummary.classList.toggle('is-invalid', !specs.isValid);
    processSummary.classList.toggle('is-pending', specs.isValid && !requirementChosen);
    if (!specs.isValid) {
      processSummary.append(doc.createTextNode((d.labelFix || 'Fix the setting marked in red to continue.') + ' '));
      const firstInvalid = [customWidthInput, customHeightInput, customMinKBInput, customMaxKBInput]
        .find(input => input && input.getAttribute('aria-invalid') === 'true');
      if (firstInvalid) {
        const show = el('button', d.labelShow || 'Show me');
        show.type = 'button';
        show.addEventListener('click', () => {
          revealSettings();
          const still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
          firstInvalid.scrollIntoView({ block: 'center', behavior: still ? 'auto' : 'smooth' });
          firstInvalid.focus({ preventScroll: true });
        });
        processSummary.append(show);
      }
      return;
    }
    if (!requirementChosen) {
      processSummary.append(doc.createTextNode((d.labelPending || 'Choose what you are preparing above.') + ' '));
      const show = el('button', d.labelShow || 'Show me');
      show.type = 'button';
      show.addEventListener('click', () => {
        const still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reqPanel) reqPanel.scrollIntoView({ block: 'start', behavior: still ? 'auto' : 'smooth' });
        const first = reqPanel && reqPanel.querySelector('.choice');
        if (first) first.focus({ preventScroll: true });
      });
      processSummary.append(show);
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
    on(presetSelect, 'change', () => {
      if (!presetSelect) return;
      chooseRequirement();
      applyPreset(presetSelect.value);
    });
    if (doc) {
      doc.querySelectorAll('button[data-preset], .preset-shortcut[data-preset]').forEach(button => {
        on(button, 'click', () => {
          chooseRequirement();
          applyPreset(button.dataset.preset);
          setRequirementOpen(false, true);
        });
      });
    }
    on(btnChangeReq, 'click', () => setRequirementOpen(reqPanel && reqPanel.dataset.open !== 'true', true));
    on(reqPanel, 'keydown', e => {
      if (e.key === 'Escape' && reqPanel.dataset.open === 'true' && requirementChosen) {
        e.preventDefault();
        setRequirementOpen(false, true);
      }
    });
    on(btnOriginalSize, 'click', useOriginalSize);
    on(btnTryExample, 'click', loadExample);

    on(btnLockAspect, 'click', () => {
      isAspectLocked = !isAspectLocked;
      if (btnLockAspect) {
        btnLockAspect.classList.toggle('active', isAspectLocked);
        btnLockAspect.setAttribute('aria-pressed', String(isAspectLocked));
        btnLockAspect.title = isAspectLocked ? 'Aspect ratio locked (proportional width & height)' : 'Aspect ratio unlocked';
        btnLockAspect.innerHTML = isAspectLocked ? '<i aria-hidden="true" class="fa-solid fa-lock"></i>' : '<i aria-hidden="true" class="fa-solid fa-lock-open"></i>';
      }
      if (isAspectLocked) {
        const w = customWidthInput ? (parseFloat(customWidthInput.value) || 350) : 350;
        const h = customHeightInput ? (parseFloat(customHeightInput.value) || 350) : 350;
        if (w > 0 && h > 0) lockedRatio = w / h;
      }
    });

    on(customWidthInput, 'input', () => {
      markCustom();
      if (isAspectLocked && lockedRatio > 0 && customWidthInput && doc && doc.activeElement === customWidthInput) {
        const height = scaleLockedDimension(customWidthInput.value, lockedRatio, 'width');
        if (height !== null && customHeightInput) customHeightInput.value = height;
      }
      updatePresetUI();
    });

    on(customHeightInput, 'input', () => {
      markCustom();
      if (isAspectLocked && lockedRatio > 0 && customHeightInput && doc && doc.activeElement === customHeightInput) {
        const width = scaleLockedDimension(customHeightInput.value, lockedRatio, 'height');
        if (width !== null && customWidthInput) customWidthInput.value = width;
      }
      updatePresetUI();
    });

    on(customMaxKBInput, 'input', () => {
      markCustom();
      updatePresetUI();
    });

    on(customMinKBInput, 'input', () => {
      markCustom();
      updatePresetUI();
    });

    on(unitSelect, 'change', () => {
      const unit = unitSelect ? unitSelect.value : 'px';
      const dpi = dpiSelect ? (parseInt(dpiSelect.value, 10) || 300) : 300;
      if (dpiGroup) dpiGroup.style.display = unit === 'px' ? 'none' : 'block';
      const wLabel = getEl('customWidthLabel');
      const hLabel = getEl('customHeightLabel');
      if (unit === 'cm') {
        if (wLabel) wLabel.textContent = 'Width (cm)';
        if (hLabel) hLabel.textContent = 'Height (cm)';
        if (customWidthInput) {
          customWidthInput.step = '0.1';
          const curPx = parseFloat(customWidthInput.value) || 350;
          customWidthInput.value = (curPx / dpi * 2.54).toFixed(1);
        }
        if (customHeightInput) {
          customHeightInput.step = '0.1';
          const curPx = parseFloat(customHeightInput.value) || 350;
          customHeightInput.value = (curPx / dpi * 2.54).toFixed(1);
        }
      } else if (unit === 'inch') {
        if (wLabel) wLabel.textContent = 'Width (in)';
        if (hLabel) hLabel.textContent = 'Height (in)';
        if (customWidthInput) {
          customWidthInput.step = '0.05';
          const curPx = parseFloat(customWidthInput.value) || 350;
          customWidthInput.value = (curPx / dpi).toFixed(2);
        }
        if (customHeightInput) {
          customHeightInput.step = '0.05';
          const curPx = parseFloat(customHeightInput.value) || 350;
          customHeightInput.value = (curPx / dpi).toFixed(2);
        }
      } else {
        if (wLabel) wLabel.textContent = 'Width (px)';
        if (hLabel) hLabel.textContent = 'Height (px)';
        if (customWidthInput) {
          customWidthInput.step = '1';
          customWidthInput.value = Math.round(parseFloat(customWidthInput.value) || 350);
        }
        if (customHeightInput) {
          customHeightInput.step = '1';
          customHeightInput.value = Math.round(parseFloat(customHeightInput.value) || 350);
        }
      }
      markCustom();
      const w = Number(customWidthInput ? customWidthInput.value : 0), h = Number(customHeightInput ? customHeightInput.value : 0);
      if (w > 0 && h > 0) lockedRatio = w / h;
      updatePresetUI();
    });

    on(dpiSelect, 'change', () => {
      markCustom();
      updatePresetUI();
    });

    [customWidthInput, customHeightInput, customMaxKBInput, customMinKBInput].forEach(inp => {
      on(inp, 'blur', () => {
        getActiveSpecs();
      });
    });

    on(formatSelect, 'change', () => {
      let val = formatSelect ? formatSelect.value : 'image/jpeg';
      if (val === 'jpeg' || val === 'jpg') val = 'image/jpeg';
      else if (val === 'png') val = 'image/png';
      else if (val === 'webp') val = 'image/webp';
      if (bgFillSelect) {
        const transparentOption = bgFillSelect.querySelector('option[value="transparent"]');
        if (transparentOption) {
          transparentOption.disabled = (val === 'image/jpeg');
          if (val !== 'image/jpeg' && !bgFillChosen) bgFillSelect.value = 'transparent';
          if (val === 'image/jpeg' && bgFillSelect.value === 'transparent') {
            bgFillSelect.value = 'white';
          }
        }
      }
      updatePresetUI();
    });

    on(bgFillSelect, 'change', () => {
      bgFillChosen = true;
      invalidateResult();
    });

    on(aspectRatioSelect, 'change', () => {
      updateCropperRatio();
      invalidateResult();
    });

    on(addDateCheckbox, 'change', () => {
      if (dateInputGroup && addDateCheckbox) {
        dateInputGroup.style.display = addDateCheckbox.checked ? 'block' : 'none';
      }
      updatePresetUI();
    });

    on(btnTodayDate, 'click', () => {
      setTodayDate();
      invalidateResult();
    });

    on(annotationDateInput, 'input', invalidateResult);
    on(annotationDateInput, 'change', invalidateResult);
    on(candidateNameInput, 'input', invalidateResult);

    // File Input & Dropzone
    on(btnBrowse, 'click', () => { if (fileInput) fileInput.click(); });
    on(dropzone, 'click', (e) => {
      if (fileInput && (!btnBrowse || (e.target !== btnBrowse && !btnBrowse.contains(e.target)))) {
        fileInput.click();
      }
    });

    on(fileInput, 'change', (e) => {
      if (e.target && e.target.files && e.target.files[0]) {
        handleFileSelect(e.target.files[0]);
      }
      if (fileInput) fileInput.value = '';
    });

    const dropTarget = (doc && (doc.querySelector('.image-stage') || dropzone)) || null;
    on(dropTarget, 'dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (dropzone) dropzone.classList.add('dragover');
    });

    on(dropTarget, 'dragleave', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (dropzone) dropzone.classList.remove('dragover');
    });

    on(dropTarget, 'drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (dropzone) dropzone.classList.remove('dragover');
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleFileSelect(e.dataTransfer.files[0]);
      }
    });

    on(btnReplaceFile, 'click', () => { if (fileInput) fileInput.click(); });
    on(btnRemoveFile, 'click', removeUploadedImage);

    // Before / After comparison view toggle
    if (btnViewProcessed && btnViewOriginal) {
      on(btnViewProcessed, 'click', () => {
        btnViewProcessed.classList.add('active');
        btnViewProcessed.setAttribute('aria-pressed', 'true');
        btnViewOriginal.classList.remove('active');
        btnViewOriginal.setAttribute('aria-pressed', 'false');
        if (resultImage) resultImage.classList.remove('hidden');
        if (originalComparisonImage) originalComparisonImage.classList.add('hidden');
      });

      on(btnViewOriginal, 'click', () => {
        btnViewOriginal.classList.add('active');
        btnViewOriginal.setAttribute('aria-pressed', 'true');
        btnViewProcessed.classList.remove('active');
        btnViewProcessed.setAttribute('aria-pressed', 'false');
        if (originalComparisonImage) originalComparisonImage.classList.remove('hidden');
        if (resultImage) resultImage.classList.add('hidden');
      });
    }

    const cropSurface = imageToCrop ? imageToCrop.closest('.cropper-container-wrapper') : null;
    on(cropSurface, 'keydown', e => {
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

    on(btnRotateLeft, 'click', () => {
      if (cropper) {
        cropper.rotate(-90);
        invalidateResult();
      }
    });

    on(btnRotateRight, 'click', () => {
      if (cropper) {
        cropper.rotate(90);
        invalidateResult();
      }
    });

    on(btnResetCrop, 'click', () => {
      if (cropper) {
        cropper.reset();
        invalidateResult();
      }
    });

    on(btnZoomIn, 'click', () => {
      if (cropper) {
        cropper.zoom(0.1);
        invalidateResult();
      }
    });

    on(btnZoomOut, 'click', () => {
      if (cropper) {
        cropper.zoom(-0.1);
        invalidateResult();
      }
    });

    on(btnProcess, 'click', processImage);

    on(btnCropAgain, 'click', () => {
      if (resultArea) resultArea.classList.add('hidden');
      if (cropperActiveArea) {
        cropperActiveArea.classList.remove('hidden');
        cropperActiveArea.scrollIntoView({ behavior: 'smooth' });
      }
      setWorkspaceStatus('Ready to edit');
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

    if (/^image\/hei[cf](-sequence)?$/i.test(file.type) || /\.hei[cf]$/i.test(file.name || '')) {
      showProcessError("iPhone photos (HEIC) aren't supported. Set Camera → Formats → Most Compatible, or share the photo as JPG.");
      return;
    }
    if (!/^(image\/(jpeg|jpg|png|webp|bmp|gif|avif))$/i.test(file.type) && !(!file.type && /\.(jpg|jpeg|png|webp|bmp|gif|avif)$/i.test(file.name))) {
      showProcessError('Unsupported format. Please select a JPG, PNG, WebP, GIF, BMP or AVIF image.');
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

        if (imageToCrop) imageToCrop.src = dataUrl;
        if (cropperPlaceholder) cropperPlaceholder.classList.add('hidden');
        if (cropperActiveArea) cropperActiveArea.classList.remove('hidden');

        if (imageToCrop) {
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
              // Bring the editor into view when most of it is below the screen (phones, short laptops).
              const frame = cropperActiveArea && cropperActiveArea.querySelector ? cropperActiveArea.querySelector('.cropper-container-wrapper') : null;
              if (frame && frame.getBoundingClientRect && typeof window.innerHeight === 'number') {
                const r = frame.getBoundingClientRect();
                const still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
                if (Math.min(r.bottom, window.innerHeight - 80) - r.top < r.height * 0.6) cropperActiveArea.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'start' });
              }
              const specs = getActiveSpecs();
              if (btnProcess) btnProcess.disabled = !specs.isValid || !requirementChosen;
            },
            crop: function () {
              if (!processing && (!resultArea || resultArea.classList.contains('hidden'))) {
                invalidateResult();
              }
            }
          });
        }
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
    if (imageToCrop) imageToCrop.src = '';

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
    if (cropperActiveArea) cropperActiveArea.classList.add('hidden');
    if (cropperPlaceholder) cropperPlaceholder.classList.remove('hidden');
    invalidateResult();
    hideErrors();
    if (processErrorBox) processErrorBox.classList.add('hidden');
  }

  function showProcessError(msg) {
    msg = localize(msg);
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
   * Ensure image meets minimum KB requirements (e.g. for official portals like IBPS/RRB)
   * Uses lossless standard JPEG COM markers so decoding and visual quality are 100% intact.
   */
  async function ensureMinKB(blob, minKB, maxKB) {
    if (!minKB || minKB <= 0) return blob;
    const minBytes = minKB * 1024;
    const maxBytes = maxKB * 1024;
    if (blob.size >= minBytes) return blob;

    const padNeeded = minBytes - blob.size;
    if (padNeeded <= 0) return blob;

    if (blob.type === 'image/jpeg') {
      try {
        const buffer = await blob.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        if (bytes[0] === 0xFF && bytes[1] === 0xD8) {
          let remaining = padNeeded;
          const chunks = [bytes.subarray(0, 2)];
          while (remaining > 0) {
            const segTotalLen = Math.min(remaining + 4, 65535);
            if (segTotalLen < 5) break;
            const payloadLen = segTotalLen - 4;
            const seg = new Uint8Array(segTotalLen);
            seg[0] = 0xFF;
            seg[1] = 0xFE;
            seg[2] = (segTotalLen - 2) >> 8;
            seg[3] = (segTotalLen - 2) & 0xFF;
            chunks.push(seg);
            remaining -= payloadLen;
          }
          chunks.push(bytes.subarray(2));
          const newBlob = new Blob(chunks, { type: 'image/jpeg' });
          if (newBlob.size <= maxBytes) return newBlob;
        }
      } catch (e) {
        return blob;
      }
    }
    return blob;
  }

  /**
   * Strict Compression Algorithm
   * Never resolves oversized images as success!
   * Clearly handles PNG lossless limitation honestly.
   */
  async function compressStrictly(canvas, maxKB, mimeType, isCancelled) {
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
    if (isCancelled && isCancelled()) return best;
    if (best.size <= maxBytes) return best;
    if (mimeType === 'image/png') throw new Error(`PNG needs ${(best.size / 1024).toFixed(1)} KB at this size. Increase the file limit, reduce dimensions, or choose WebP or JPEG.`);
    best = await encode(0.05);
    if (isCancelled && isCancelled()) return best;
    if (best.size > maxBytes) throw new Error(`The smallest result is ${(best.size / 1024).toFixed(1)} KB. Increase the file limit or reduce the dimensions to preserve a usable image.`);
    // Find the highest quality that really meets the byte limit.
    let low = 0.05, high = 0.95;
    for (let i = 0; i < 7; i++) {
      if (isCancelled && isCancelled()) return best;
      const quality = (low + high) / 2;
      const candidate = await encode(quality);
      if (candidate.size <= maxBytes) { best = candidate; low = quality; }
      else high = quality;
    }
    return best;
  }

  // "50 KB (51,200 bytes)": the byte count is the exact proof, shown on its own quieter line.
  function setWithBytes(el, text) {
    if (!el) return;
    const m = /^(.*?)\s*(\([^)]*bytes\))$/.exec(text);
    el.textContent = '';
    if (!m) { el.textContent = text; return; }
    const bytes = document.createElement('span');
    bytes.className = 'bytes';
    bytes.textContent = m[2];
    el.append(document.createTextNode(m[1] + ' '), bytes);
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
    if (btnProcess) {
      btnProcess.setAttribute('aria-busy', 'true');
      btnProcess.disabled = true;
      btnProcess.innerHTML = busyLabel;
    }

    try {
      const addDate = addDateCheckbox && addDateCheckbox.checked;
      if (addDate && document.fonts) await document.fonts.ready;

      // 1. Generate Target Canvas
      const canvas = generateTargetCanvas(specs, addDate);
      if (opId !== currentOpId || revision !== configRevision) return;

      // 2. Strict Compression
      let compressedBlob = await compressStrictly(canvas, specs.maxKB, specs.mimeType, () => (opId !== currentOpId || revision !== configRevision));
      if (opId !== currentOpId || revision !== configRevision) return;

      // Ensure Minimum KB if requested
      if (specs.minKB && specs.minKB > 0 && compressedBlob.size < specs.minKB * 1024) {
        compressedBlob = await ensureMinKB(compressedBlob, specs.minKB, specs.maxKB);
        if (opId !== currentOpId || revision !== configRevision) return;
      }

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
      if (resultImage) resultImage.src = processedBlobUrl;

      const resultOrigDims = document.getElementById('resultOrigDims');
      const resultTargetDims = document.getElementById('resultTargetDims');
      const resultTargetSize = document.getElementById('resultTargetSize');

      // Pages in other languages supply their own result wording through data-* attributes.
      const words = (resultArea && resultArea.dataset) || {};
      const fill = (template, values) => template.replace(/\{(\w+)\}/g, (m, k) => (k in values ? values[k] : m));
      const nums = { min: specs.minKB, max: specs.maxKB, minBytes: (specs.minKB * 1024).toLocaleString(), maxBytes: (specs.maxKB * 1024).toLocaleString() };
      if (resultOrigDims) {
        resultOrigDims.textContent = `${sourceDimensions.width} × ${sourceDimensions.height} px${currentFile ? ` · ${(currentFile.size / 1024).toFixed(1)} KB` : ''}`;
      }
      if (resultTargetDims) {
        resultTargetDims.textContent = `${specs.width} × ${specs.height} px`;
      }
      if (resultDims) {
        resultDims.textContent = `${validationImg.naturalWidth} × ${validationImg.naturalHeight} px, ${words.verified || 'verified'}`;
      }
      if (resultTargetSize) {
        const limit = specs.minKB > 0
          ? fill(words.limitRange || '{min}–{max} KB ({minBytes} – {maxBytes} bytes)', nums)
          : fill(words.limitUnder || 'Under {max} KB ({maxBytes} bytes)', nums);
        setWithBytes(resultTargetSize, limit);
      }

      const actualBytes = compressedBlob.size;
      const actualKB = (actualBytes / 1024).toFixed(2);
      if (resultFileSize) {
        setWithBytes(resultFileSize, `${actualKB} KB (${actualBytes.toLocaleString()} bytes)`);
      }

      if (compProcessedKB) {
        compProcessedKB.textContent = `${actualKB} KB`;
      }
      if (compOriginalKB && currentFile) {
        compOriginalKB.textContent = `${(currentFile.size / 1024).toFixed(1)} KB`;
      }

      const formatNames = { 'image/jpeg': 'JPEG', 'image/png': 'PNG', 'image/webp': 'WebP' };
      if (resultFormat) resultFormat.textContent = formatNames[specs.mimeType] || specs.mimeType;
      const resultFormatRequired = document.getElementById('resultFormatRequired');
      if (resultFormatRequired) resultFormatRequired.textContent = formatNames[specs.mimeType] || specs.mimeType;

      if (resultStatus) {
        if (specs.minKB > 0) {
          resultStatus.textContent = fill(words.statusRange || 'Within the {min}–{max} KB range, at the exact size requested.', nums);
        } else {
          resultStatus.textContent = fill(words.statusUnder || 'Under the {max} KB limit, at the exact size requested.', nums);
        }
        resultStatus.className = 'meta-stat-val status-ok';
      }

      // Set Download Link
      const ext = specs.mimeType === 'image/png' ? 'png' : specs.mimeType === 'image/webp' ? 'webp' : 'jpg';
      const dateSuffix = addDate ? '_Dated' : '';
      const filename = `${specs.prefix}${dateSuffix}_${specs.width}x${specs.height}.${ext}`;

      if (btnDownload) {
        btnDownload.href = processedBlobUrl;
        btnDownload.download = filename;
      }

      // Switch views
      if (cropperActiveArea) cropperActiveArea.classList.add('hidden');
      if (resultArea) {
        resultArea.classList.remove('hidden');
        resultArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      setWorkspaceStatus('Ready to download');
      if (btnDownload) btnDownload.focus({ preventScroll: true });

    } catch (err) {
      if (opId !== currentOpId || revision !== configRevision) return;

      const msg = err && err.message ? err.message : 'An unexpected error occurred while processing the image.';
      console.error('RESIZER PROCESS ERROR:', err);
      showProcessError(msg);
    } finally {
      if (validationUrl) URL.revokeObjectURL(validationUrl);
      if (opId === currentOpId) {
        processing = false;
        if (btnProcess) {
          btnProcess.disabled = !cropperReady || !getActiveSpecs().isValid || !requirementChosen;
          btnProcess.innerHTML = processLabel;
          btnProcess.removeAttribute('aria-busy');
        }
      }
    }
  }

  // Initialize on DOM ready (browser only)
  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', init);
  }

  // Global browser API
  if (typeof window !== 'undefined') {
    window.ApplyReadyResizer = {
      applyPreset,
      PRESETS,
      useOriginalSize
    };
  }

  // Export for testing
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      PRESETS,
      scaleLockedDimension,
      formatAnnotationDate,
      validateDimensionSpecs,
      ensureMinKB
    };
  }

})();
