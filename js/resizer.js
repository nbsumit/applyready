/**
 * ApplyReady.in - General-Purpose Image Resizer & Strict Compressor
 * 100% Client-Side Processing (HTML5 Canvas, Cropper.js)
 * Zero server uploads.
 */

(function () {
  'use strict';

  // Built-in presets, used only when js/presets.js has not loaded (it is the source of truth).
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

  // The source image: the same 50 MP limit as every other image tool (js/lib/image-ops.js), and at
  // least the smallest output side (20 px), so there is something to resize.
  const MAX_SOURCE_PIXELS = 50e6;
  const MIN_SOURCE_SIDE = 20;
  // A selection enlarged more than this is pointed out on the result: it will look soft or blocky.
  const ENLARGE_WARN = 1.5;

  // State Management
  let currentPresetKey = 'custom';
  let cropper = null;
  let currentFile = null;
  let sourceImage = null;
  let sourceDimensions = { width: 0, height: 0, sizeBytes: 0 };
  let validationTicket = 0;
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

  // Annotation Elements
  const dateOptionsBox = getEl('dateOptionsBox');
  const addDateCheckbox = getEl('addDateCheckbox');
  const dateInputGroup = getEl('dateInputGroup');
  const annotationDateInput = getEl('annotationDateInput');
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

  // Aspect ratio lock. Off at the start: a form gives both sides (300 × 200 px), and with the lock on
  // typing the second number would change the first. When it is turned on, the ratio is the one
  // the two fields show at that moment.
  const btnLockAspect = getEl('btnLockAspect');
  let isAspectLocked = Boolean(btnLockAspect && btnLockAspect.getAttribute('aria-pressed') === 'true');
  let lockedRatio = 1.0;
  // The unit the width and height fields are in now, so a change of unit converts from it.
  let fieldUnit = 'px';

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
      // A link can carry its own limit and size (?targetKB=15&width=300&height=400). They are applied
      // on top of the page's own requirement (which then becomes Custom size), so a shared or
      // bookmarked link opens with exactly the numbers in it. Only whole numbers are taken.
      const fromUrl = name => { const v = params && params.get(name); return v && /^\d{1,5}$/.test(v.trim()) ? v.trim() : null; };
      const urlKB = fromUrl('targetKB') || fromUrl('maxKB');
      const urlWidth = fromUrl('width');
      const urlHeight = fromUrl('height');
      const pageKB = appEl && appEl.dataset.maxKb;

      if (params && (params.get('preset') || urlKB || urlWidth || urlHeight)) chooseRequirement();
      const hasPreset = Boolean(targetPreset && PRESETS[targetPreset]);
      if (hasPreset) {
        initializing = true;
        applyPreset(targetPreset);
        initializing = false;
      }
      if (urlKB || urlWidth || urlHeight || (!hasPreset && pageKB)) {
        if (customMaxKBInput && (urlKB || pageKB)) customMaxKBInput.value = urlKB || pageKB;
        if (urlWidth && customWidthInput) customWidthInput.value = urlWidth;
        if (urlHeight && customHeightInput) customHeightInput.value = urlHeight;
        markCustom();
        const w = Number(customWidthInput ? customWidthInput.value : 0), h = Number(customHeightInput ? customHeightInput.value : 0);
        if (w > 0 && h > 0) lockedRatio = w / h;
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

  // Scrolling from script ignores the CSS reduced-motion rule, so every scroll asks first.
  function scrollBehavior() {
    return typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
  }

  /** The chosen file's name without its extension, safe to use in a download name. */
  function sourceStem(file) {
    const Files = typeof window !== 'undefined' ? window.ApplyReadyFiles : null;
    const raw = file && file.name ? String(file.name) : '';
    const stem = Files ? Files.stem(Files.safeFileName(raw, 'image')) : raw.replace(/\.[^.]*$/, '').replace(/[\\/:*?"<>|]/g, '_');
    return (stem || 'image').slice(0, 60).trim() || 'image';
  }

  // Keep the ratio honest: invalid or oversized results are validated, not clamped.
  // unit: 'px' (whole pixels, at least 20), 'cm' (one decimal) or 'inch' (two decimals), as the fields show them.
  function scaleLockedDimension(value, ratio, changedAxis, unit) {
    const size = Number(value);
    if (!Number.isFinite(ratio) || ratio <= 0) return null;
    const other = changedAxis === 'width' ? size / ratio : size * ratio;
    if (unit === 'cm' || unit === 'inch') {
      if (String(value).trim() === '' || !Number.isFinite(size) || size <= 0) return null;
      const places = unit === 'cm' ? 1 : 2;
      return Number(other.toFixed(places));
    }
    if (!Number.isInteger(size) || size < 20) return null;
    return Math.round(other);
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
      fieldUnit = 'px';
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

  /* The picture as it is shown: EXIF orientation (which Cropper applies as a rotation) and any
     turn the person made, so a photo taken sideways on a phone keeps its real shape. */
  function orientedSize() {
    if (cropper && cropperReady) {
      const img = cropper.getImageData();
      const rotate = (cropper.getData().rotate || 0) % 180;
      if (img && img.naturalWidth && img.naturalHeight) {
        const quarter = Math.abs(rotate) === 90;
        return { width: Math.round(quarter ? img.naturalHeight : img.naturalWidth), height: Math.round(quarter ? img.naturalWidth : img.naturalHeight) };
      }
    }
    return { width: sourceDimensions.width, height: sourceDimensions.height };
  }

  function useOriginalSize() {
    if (!cropperReady || !cropper) return;
    const { width, height } = orientedSize();
    const maxVal = customMaxKBInput ? customMaxKBInput.value : 50;
    const validation = validateDimensionSpecs(width, height, maxVal);
    if (validation.dimErrorMsg) {
      showProcessError('The original dimensions exceed the supported range (20–8,000 px per side, up to 32 megapixels). Set smaller output dimensions.');
      return;
    }
    // The original size is in pixels: switch the fields to pixels first, or 900 would be read as 900 cm.
    if (unitSelect && unitSelect.value !== 'px') {
      unitSelect.value = 'px';
      unitSelect.dispatchEvent(new Event('change'));
    }
    if (customWidthInput) customWidthInput.value = width;
    if (customHeightInput) customHeightInput.value = height;
    lockedRatio = width / height;
    markCustom();
    if (addDateCheckbox) addDateCheckbox.checked = false;
    if (dateInputGroup) dateInputGroup.style.display = 'none';
    if (aspectRatioSelect) aspectRatioSelect.value = 'original';
    if (processErrorBox) processErrorBox.classList.add('hidden');
    // Keep the rotation and flips (from EXIF or the rotate buttons); only zoom and crop are reset.
    const before = cropper.getData();
    updatePresetUI();
    cropper.reset();
    cropper.rotateTo(before.rotate || 0);
    cropper.scale(before.scaleX || 1, before.scaleY || 1);
    updateCropperRatio();
    cropper.setData({ x: 0, y: 0, width, height });
    if (window.ApplyReadyUI) window.ApplyReadyUI.notify('Full image selected at its original dimensions. Set your file limit, then resize & compress.');
  }

  // The sample suits the requirement in use: a portrait for photos, a scribble for signatures,
  // a ridge pattern for thumb impressions and a page for everything else. It is drawn at least
  // as large as the target, so the demo never has to enlarge it. Synthetic, with no personal data.
  const SAMPLE_KIND = { passport: 'photo', avatar: 'photo', 'kb-10': 'photo', 'kb-20': 'photo', 'kb-50': 'photo', 'kb-100': 'photo', 'kb-200': 'photo', signature: 'signature', declaration: 'signature', thumb: 'thumb' };

  function sampleCanvas(kind, targetW, targetH) {
    const tw = Math.max(20, targetW || 960), th = Math.max(20, targetH || 1200);
    let w, h;
    if (kind === 'document') {
      // A page keeps its 4:5 shape (text must not be stretched) and covers the target box.
      const k = Math.min(Math.max(1, tw / 960, th / 1200), Math.sqrt(12e6 / (960 * 1200)));
      w = Math.round(960 * k); h = Math.round(1200 * k);
    } else {
      let k = Math.max(1, 1200 / Math.max(tw, th));
      if (tw * th * k * k > 12e6) k = Math.sqrt(12e6 / (tw * th));
      w = Math.max(20, Math.round(tw * k)); h = Math.max(20, Math.round(th * k));
    }
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    const u = Math.min(w, h);
    const label = (text, y) => {
      ctx.font = `${Math.max(10, Math.round(u * 0.045))}px sans-serif`;
      ctx.fillStyle = '#5c6970'; ctx.textAlign = 'center';
      ctx.fillText(text, w / 2, y);
      ctx.textAlign = 'start';
    };
    if (kind === 'photo') {
      ctx.fillStyle = '#e8eef2'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#5c6970';
      ctx.beginPath(); ctx.ellipse(w / 2, h * 1.02, w * 0.42, h * 0.3, 0, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#9aa7b0';
      ctx.beginPath(); ctx.ellipse(w / 2, h * 0.42, u * 0.2, u * 0.25, 0, 0, Math.PI * 2); ctx.fill();
      label('SAMPLE PHOTO · not a real person', h * 0.08);
    } else if (kind === 'signature') {
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#1f2a5a'; ctx.lineWidth = Math.max(2, u * 0.03); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(w * 0.1, h * 0.62);
      ctx.bezierCurveTo(w * 0.18, h * 0.1, w * 0.26, h * 0.95, w * 0.34, h * 0.5);
      ctx.bezierCurveTo(w * 0.42, h * 0.15, w * 0.48, h * 0.8, w * 0.56, h * 0.48);
      ctx.bezierCurveTo(w * 0.64, h * 0.2, w * 0.72, h * 0.75, w * 0.9, h * 0.4);
      ctx.stroke();
      ctx.beginPath(); ctx.moveTo(w * 0.12, h * 0.78); ctx.lineTo(w * 0.86, h * 0.72); ctx.stroke();
      label('SAMPLE SIGNATURE', h * 0.95);
    } else if (kind === 'thumb') {
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#1f2a5a'; ctx.lineWidth = Math.max(2, u * 0.012);
      for (let i = 1; i <= 12; i++) { ctx.beginPath(); ctx.ellipse(w / 2, h / 2, u * 0.025 * i, u * 0.033 * i, 0.2, 0, Math.PI * 2); ctx.stroke(); }
      label('SAMPLE IMPRESSION', h * 0.96);
    } else {
      // A page: the 960 × 1200 layout, scaled evenly.
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
      ctx.save(); ctx.scale(w / 960, w / 960);
      ctx.fillStyle = '#17634d'; ctx.fillRect(72, 80, 56, 7);
      ctx.fillStyle = '#182126'; ctx.font = 'bold 48px sans-serif'; ctx.fillText('Sample document', 72, 170);
      ctx.font = '24px sans-serif'; ctx.fillStyle = '#5c6970'; ctx.fillText('ApplyReady image tools · demonstration file', 72, 216);
      ctx.font = 'bold 25px sans-serif'; ctx.fillStyle = '#182126'; ctx.fillText('A simple way to prepare your files', 72, 322);
      ctx.font = '22px sans-serif'; ctx.fillStyle = '#344148';
      ['Choose your dimensions and file size limit.', 'Adjust the crop to keep the details you need.', 'Download a verified image, ready to upload.', '', 'Use original size to keep this entire document.', 'Try another preset to see how the crop changes.'].forEach((line, i) => ctx.fillText(line, 72, 375 + i * 42));
      ctx.strokeStyle = '#dfe4e7'; ctx.lineWidth = 2;
      for (let y = 710; y <= 1000; y += 58) { ctx.beginPath(); ctx.moveTo(72, y); ctx.lineTo(888, y); ctx.stroke(); }
      ctx.font = '18px sans-serif'; ctx.fillStyle = '#5c6970'; ctx.fillText('SAMPLE ONLY — no personal information', 72, 1110);
      ctx.restore();
    }
    return canvas;
  }

  function loadExample() {
    // Keep the requirement the person chose; Document scan is used only when nothing is chosen yet.
    if (!requirementChosen) {
      chooseRequirement();
      applyPreset('document');
    }
    setRequirementOpen(false, false);
    const specs = getActiveSpecs();
    const kind = SAMPLE_KIND[currentPresetKey] || 'document';
    const canvas = sampleCanvas(kind, specs.isValid ? specs.width : 0, specs.isValid ? specs.height : 0);
    const requestId = currentOpId;
    if (btnTryExample) btnTryExample.disabled = true;
    canvas.toBlob(blob => {
      if (btnTryExample) btnTryExample.disabled = false;
      if (requestId !== currentOpId) return;
      if (!blob) { showProcessError('Could not create the sample. Please choose an image instead.'); return; }
      handleFileSelect(new File([blob], `ApplyReady_sample_${kind}.png`, { type: 'image/png' }));
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
    let printDpi = 0;          // set when the size was given in cm or inches: recorded in the file
    let printSize = '';        // the size as given, e.g. "3.5 × 4.5 cm at 300 DPI"

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
        printDpi = dpi;
        printSize = `${numW} × ${numH} cm at ${dpi} DPI`;
      } else if (unit === 'inch') {
        const numW = parseFloat(rawWStr);
        const numH = parseFloat(rawHStr);
        if (!isNaN(numW) && numW > 0) rawWStr = String(Math.round(numW * dpi));
        if (!isNaN(numH) && numH > 0) rawHStr = String(Math.round(numH * dpi));
        printDpi = dpi;
        printSize = `${numW} × ${numH} in at ${dpi} DPI`;
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
      var padToKB = p.padToKB || 0;
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
      padToKB: typeof padToKB === 'number' ? padToKB : 0,
      mimeType,
      bgFill,
      prefix,
      printDpi,
      printSize,
      isValid
    };
  }

  function showDimError(msg, wErr, hErr) {
    revealSettings();
    if (dimError) {
      dimError.textContent = msg;
      dimError.classList.remove('hidden');
    }
    if (customWidthInput && (wErr || (!wErr && !hErr))) { customWidthInput.classList.add('is-invalid'); customWidthInput.setAttribute('aria-invalid', 'true'); }
    if (customHeightInput && (hErr || (!wErr && !hErr))) { customHeightInput.classList.add('is-invalid'); customHeightInput.setAttribute('aria-invalid', 'true'); }
  }

  function showSizeError(msg) {
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
      const kb = specs.minKB > 0 ? `${specs.minKB}–${specs.maxKB} KB` : `under ${specs.maxKB} KB`;
      customSpec.textContent = currentPresetKey === 'custom' && requirementChosen && specs.isValid ? `${specs.width} × ${specs.height} px · ${kb}` : customSpec.dataset.empty;
    }
    if (btnProcess) btnProcess.disabled = !specs.isValid || !cropperReady || processing || !requirementChosen;

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
    // Preset names carry their spec in brackets ("Signature (300 × 100 px, max 30 KB)"); the size
    // details follow in reqSummarySpec, so only the short name is shown here.
    const presetName = (PRESETS[currentPresetKey] || PRESETS.custom).name.replace(/\s*\([^()]*\d[^()]*\)\s*$/, '');
    reqSummaryName.textContent = button ? button.textContent : presetName;
    if (!specs.isValid) { reqSummarySpec.textContent = ''; return; }
    const formatNames = { 'image/jpeg': 'JPEG', 'image/png': 'PNG', 'image/webp': 'WebP' };
    const kb = specs.minKB > 0 ? `${specs.minKB}–${specs.maxKB} KB` : `under ${specs.maxKB} KB`;
    reqSummarySpec.textContent = `${specs.width} × ${specs.height} px · ${kb} · ${formatNames[specs.mimeType] || 'JPEG'}`;
  }

  /**
   * One line beside the main action, shown only when the action cannot run yet:
   * no requirement chosen, or a setting that needs fixing. Strings can be overridden
   * per page with data-* attributes.
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
          firstInvalid.scrollIntoView({ block: 'center', behavior: scrollBehavior() });
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
        if (reqPanel) reqPanel.scrollIntoView({ block: 'start', behavior: scrollBehavior() });
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

    if (ratioType === 'original') {
      const size = orientedSize();
      if (size.width > 0 && size.height > 0) { cropper.setAspectRatio(size.width / size.height); return; }
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
        const height = scaleLockedDimension(customWidthInput.value, lockedRatio, 'width', unitSelect ? unitSelect.value : 'px');
        if (height !== null && customHeightInput) customHeightInput.value = height;
      }
      updatePresetUI();
    });

    on(customHeightInput, 'input', () => {
      markCustom();
      if (isAspectLocked && lockedRatio > 0 && customHeightInput && doc && doc.activeElement === customHeightInput) {
        const width = scaleLockedDimension(customHeightInput.value, lockedRatio, 'height', unitSelect ? unitSelect.value : 'px');
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

    // The fields keep the same size when the unit changes: the values are converted from the unit
    // they were in (at the chosen DPI), not read as pixels.
    on(unitSelect, 'change', () => {
      const unit = unitSelect ? unitSelect.value : 'px';
      const dpi = dpiSelect ? (parseInt(dpiSelect.value, 10) || 300) : 300;
      if (dpiGroup) dpiGroup.style.display = unit === 'px' ? 'none' : 'block';
      const wLabel = getEl('customWidthLabel');
      const hLabel = getEl('customHeightLabel');
      const label = { px: 'px', cm: 'cm', inch: 'in' }[unit] || 'px';
      if (wLabel) wLabel.textContent = `Width (${label})`;
      if (hLabel) hLabel.textContent = `Height (${label})`;
      const toPx = v => { const n = parseFloat(v); if (!(n > 0)) return 350; return fieldUnit === 'cm' ? n / 2.54 * dpi : fieldUnit === 'inch' ? n * dpi : n; };
      const fromPx = px => (unit === 'cm' ? (px / dpi * 2.54).toFixed(1) : unit === 'inch' ? (px / dpi).toFixed(2) : String(Math.round(px)));
      [customWidthInput, customHeightInput].forEach(input => {
        if (!input) return;
        input.step = unit === 'cm' ? '0.1' : unit === 'inch' ? '0.05' : '1';
        input.value = fromPx(toPx(input.value));
      });
      fieldUnit = unit;
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
    on(btnRemoveFile, 'click', () => removeUploadedImage());

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
        cropperActiveArea.scrollIntoView({ behavior: scrollBehavior() });
      }
      setWorkspaceStatus('Ready to edit');
    });
  }

  /**
   * Handle image selection and decode verification
   */
  async function handleFileSelect(file) {
    if (!file) return;
    hideErrors();

    // Identify the file by its first bytes, not its name or the type the browser reports.
    if (window.ApplyReadyFiles && file.size > 0) {
      const ticket = ++validationTicket;
      const check = await window.ApplyReadyFiles.validate(file, ['image'], 50 * 1024 * 1024);
      if (ticket !== validationTicket) return;   // a newer file was chosen meanwhile
      if (!check.ok) { showProcessError(check.error); return; }
      if (check.info && check.info.mime && !file.type) {
        try { file = new File([file], file.name || `image.${check.info.ext}`, { type: check.info.mime }); } catch (e) { /* keep the original */ }
      }
    }

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

    if (!window.ApplyReadyFiles && (/^image\/hei[cf](-sequence)?$/i.test(file.type) || /\.hei[cf]$/i.test(file.name || ''))) {
      showProcessError("iPhone photos (HEIC) aren't supported. Set Camera → Formats → Most Compatible, or share the photo as JPG.");
      return;
    }
    if (!window.ApplyReadyFiles && !/^(image\/(jpeg|jpg|png|webp|bmp|gif|avif))$/i.test(file.type) && !(!file.type && /\.(jpg|jpeg|png|webp|bmp|gif|avif)$/i.test(file.name))) {
      showProcessError('Unsupported format. Please select a JPG, PNG, WebP, GIF, BMP or AVIF image.');
      return;
    }

    // The same checks as the batch tools, before anything is shown: a picture over 50 megapixels is
    // refused from its header without being decoded, a truncated or damaged file is refused (an <img>
    // would show it with the missing part blank, and the result would be "verified" anyway), and so is
    // a picture too small to make anything from.
    const Ops = typeof window !== 'undefined' ? window.ApplyReadyImageOps : null;
    if (Ops && Ops.openImage) {
      const ticket = ++validationTicket;
      setWorkspaceStatus('Opening image…');
      // While the new file is checked, the image on screen (if any) is not processed by mistake.
      if (btnProcess) btnProcess.disabled = true;
      try {
        (await Ops.openImage(file, { name: file.name || 'This image', minSide: MIN_SOURCE_SIDE })).close();
      } catch (e) {
        if (ticket === validationTicket) {
          // The image already on screen, if any, stays and can still be used.
          if (btnProcess) btnProcess.disabled = !cropperReady || processing || !requirementChosen || !getActiveSpecs().isValid;
          showProcessError((e && e.message) || 'Could not decode image. The file may be corrupt or an unsupported format.');
        }
        return;
      }
      if (ticket !== validationTicket) return;   // a newer file was chosen meanwhile
    }

    removeUploadedImage(!currentFile);
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

        // Also checked from the header before decoding (above); this covers a browser without it.
        const totalPixels = testImg.naturalWidth * testImg.naturalHeight;
        if (totalPixels > MAX_SOURCE_PIXELS) {
          showProcessError(`${file.name || 'This image'} is ${Math.round(totalPixels / 1e6)} megapixels (${testImg.naturalWidth} × ${testImg.naturalHeight} px), more than the ${MAX_SOURCE_PIXELS / 1e6} MP that can be opened safely in a browser. Resize it on the phone or computer first.`);
          return;
        }
        if (Math.min(testImg.naturalWidth, testImg.naturalHeight) < MIN_SOURCE_SIDE) {
          showProcessError(`${file.name || 'This image'} is only ${testImg.naturalWidth} × ${testImg.naturalHeight} px, too small to make a usable picture from. Choose the original photo or a larger scan, at least ${MIN_SOURCE_SIDE} px on each side.`);
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
                if (Math.min(r.bottom, window.innerHeight - 80) - r.top < r.height * 0.6) cropperActiveArea.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
              }
              const specs = getActiveSpecs();
              if (btnProcess) btnProcess.disabled = !specs.isValid || !requirementChosen;
              // The drop zone, with the button that opened the file picker, is hidden now; a keyboard
              // or screen reader user continues from the crop area instead of the top of the page.
              const active = doc.activeElement;
              if (frame && (!active || active === doc.body || (cropperPlaceholder && cropperPlaceholder.contains(active)))) frame.focus({ preventScroll: true });
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
  /* The name and date strip belongs to one person's photo. A cafe operator removes or replaces
     the photo for the next customer, so the strip is switched off and the name cleared then;
     otherwise the next photo would carry the previous person's name. */
  function clearPrintedDetails() {
    const had = Boolean((addDateCheckbox && addDateCheckbox.checked) || (candidateNameInput && candidateNameInput.value.trim()));
    if (addDateCheckbox) addDateCheckbox.checked = false;
    if (dateInputGroup) dateInputGroup.style.display = 'none';
    if (candidateNameInput) candidateNameInput.value = '';
    setTodayDate();
    if (had) {
      updatePresetUI();
      if (window.ApplyReadyUI && window.ApplyReadyUI.notify) window.ApplyReadyUI.notify('The printed name and date were cleared, so they are not added to the next photo.');
    }
  }

  function removeUploadedImage(keepPrintedDetails) {
    // True only when the first photo arrives: a name and date typed before it are meant for it.
    if (!keepPrintedDetails) clearPrintedDetails();
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
    setWorkspaceStatus('Check the error below');
    if (processErrorBox && processErrorMessage) {
      processErrorMessage.textContent = msg;
      processErrorBox.classList.remove('hidden');
      processErrorBox.scrollIntoView({ behavior: scrollBehavior(), block: 'nearest' });
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

      checkCropped(croppedCanvas);

      drawCropped(ctx, croppedCanvas, targetWidth, photoHeight);

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

      checkCropped(croppedCanvas);

      drawCropped(ctx, croppedCanvas, targetWidth, targetHeight);
    }

    return canvas;
  }

  // A selection so small that nothing is left of it (a few pixels at a non-matching shape) cannot be
  // drawn; say so instead of passing on the browser's own error.
  function checkCropped(croppedCanvas) {
    if (!croppedCanvas || !croppedCanvas.width || !croppedCanvas.height) {
      throw new Error('The selected area is too small to resize. Select Reset to use the whole image, or choose a larger image.');
    }
  }

  /**
   * Draw the selection into a boxW × boxH area without distorting it. The crop box has the output's
   * shape, but the selection is made of whole source pixels, so from a small image its shape can be
   * a few per cent off. Within 3% the selection fills the area (a sliver is trimmed from the centre)
   * rather than leaving thin white bars; a different crop shape chosen on purpose (Square, Free crop
   * and so on) is fitted inside, and the margins keep the background fill.
   */
  function drawCropped(ctx, cropped, boxW, boxH) {
    const cropAspect = cropped.width / cropped.height;
    const destAspect = boxW / boxH;
    const off = cropAspect / destAspect;
    if (Math.abs(off - 1) < 0.03) {
      let sx = 0, sy = 0, sw = cropped.width, sh = cropped.height;
      if (off > 1) { sw = cropped.height * destAspect; sx = (cropped.width - sw) / 2; }
      else { sh = cropped.width / destAspect; sy = (cropped.height - sh) / 2; }
      ctx.drawImage(cropped, sx, sy, sw, sh, 0, 0, boxW, boxH);
      return;
    }
    let drawW = boxW;
    let drawH = drawW / cropAspect;
    if (drawH > boxH) {
      drawH = boxH;
      drawW = drawH * cropAspect;
    }
    ctx.drawImage(cropped, Math.round((boxW - drawW) / 2), Math.round((boxH - drawH) / 2), Math.round(drawW), Math.round(drawH));
  }

  /**
   * How much the selected part of the image is enlarged to fill the output (1 = not enlarged).
   * Above ENLARGE_WARN the result says so: the file meets the size, but will look soft or blocky.
   */
  function enlargement(specs, addDate) {
    if (!cropper) return null;
    const d = cropper.getData();
    const quarter = Math.abs((d.rotate || 0) % 180) === 90;
    const cropW = quarter ? d.height : d.width, cropH = quarter ? d.width : d.height;
    if (!(cropW > 0 && cropH > 0)) return null;
    const photoH = addDate ? Math.max(1, specs.height - Math.max(34, Math.round(specs.height * 0.16))) : specs.height;
    return { factor: Math.max(specs.width / cropW, photoH / cropH), cropW: Math.round(cropW), cropH: Math.round(cropH) };
  }

  /**
   * Ensure image meets minimum KB requirements (some application portals reject files below a minimum size)
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
          // JFIF requires its APP0 segment straight after the start-of-image marker, and some
          // portals check for it there, so the padding comments go after APP0 when it is present.
          let head = 2;
          if (bytes[2] === 0xFF && bytes[3] === 0xE0) head = 4 + ((bytes[4] << 8) | bytes[5]);
          if (head > bytes.length) head = 2;
          let remaining = padNeeded;
          const chunks = [bytes.subarray(0, head)];
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
          chunks.push(bytes.subarray(head));
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

      // The minimum, or a higher pad target when a preset sets one, so a file does not sit exactly on the limit.
      const floorKB = specs.padToKB > specs.minKB && specs.padToKB < specs.maxKB ? specs.padToKB : specs.minKB;
      if (floorKB > 0 && compressedBlob.size < floorKB * 1024) {
        compressedBlob = await ensureMinKB(compressedBlob, floorKB, specs.maxKB);
        if (opId !== currentOpId || revision !== configRevision) return;
      }

      // A size given in cm or inches is recorded in the file at the chosen DPI, so it prints and opens
      // in a document at that size. Only the header changes; the byte count stays the same.
      const Ops = window.ApplyReadyImageOps;
      if (specs.printDpi && Ops && Ops.setDensity) {
        compressedBlob = await Ops.setDensity(compressedBlob, specs.printDpi);
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
        resultTargetDims.textContent = specs.printSize ? `${specs.width} × ${specs.height} px (${specs.printSize})` : `${specs.width} × ${specs.height} px`;
      }
      const grown = enlargement(specs, addDate);
      const resultWarning = document.getElementById('resultWarning');
      const resultWarningText = document.getElementById('resultWarningText');
      const warn = Boolean(grown && grown.factor >= ENLARGE_WARN);
      if (resultWarning && resultWarningText) {
        resultWarningText.textContent = warn
          ? `The part of the image you selected is only ${grown.cropW} × ${grown.cropH} px, so it was enlarged ${grown.factor >= 10 ? Math.round(grown.factor) : grown.factor.toFixed(1)} times to make ${specs.width} × ${specs.height} px. It will look blurred or blocky. Use the original photo or a larger scan if you have one.`
          : '';
        resultWarning.classList.toggle('hidden', !warn);
      }
      if (resultArea) resultArea.classList.toggle('is-warning', warn);
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
      // The source name comes first, so one customer's file is never confused with the last one's.
      const filename = `${sourceStem(currentFile)}_${specs.prefix}${dateSuffix}_${specs.width}x${specs.height}.${ext}`;

      if (btnDownload) {
        btnDownload.href = processedBlobUrl;
        btnDownload.download = filename;
      }

      // Switch views
      if (cropperActiveArea) cropperActiveArea.classList.add('hidden');
      if (resultArea) {
        resultArea.classList.remove('hidden');
        // The result heading and the Download button, clear of the sticky header.
        if (window.ApplyReadyUI && window.ApplyReadyUI.reveal) window.ApplyReadyUI.reveal(resultArea, btnDownload, { align: true });
        else resultArea.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
      }
      setWorkspaceStatus('Ready to download');
      if (btnDownload) btnDownload.focus({ preventScroll: true });

    } catch (err) {
      if (opId !== currentOpId || revision !== configRevision) return;

      const msg = err && err.message ? err.message : 'An unexpected error occurred while processing the image.';
      showProcessError(msg);
    } finally {
      if (validationUrl) URL.revokeObjectURL(validationUrl);
      // Only one run can hold the flag (a run cannot start while it is set), so release it even when
      // this run was superseded by a new image or a reset; otherwise the button stays locked.
      processing = false;
      if (btnProcess) {
        btnProcess.disabled = !cropperReady || !getActiveSpecs().isValid || !requirementChosen;
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
      validateDimensionSpecs,
      ensureMinKB
    };
  }

})();
