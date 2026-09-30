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
  const btnRemoveFile = getEl('btnRemoveFile');

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
  const resultDims = getEl('resultDims');
  const resultFileSize = getEl('resultFileSize');
  const resultFormat = getEl('resultFormat');
  const resultStatus = getEl('resultStatus');
  const btnDownload = getEl('btnDownload');
  const btnCropAgain = getEl('btnCropAgain');

  /**
   * Initialize Resizer Module
   */
  function init() {
    setTodayDate();
    updatePresetUI();
    attachEventListeners();
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
  function validateDimensionSpecs(rawWStr, rawHStr, rawKBStr) {
    const isInteger = (s) => /^\d+$/.test(String(s || '').trim());
    let width = 350;
    let height = 350;
    let maxKB = 50;
    let isValid = true;
    let dimErrorMsg = null;
    let sizeErrorMsg = null;

    let wValid = false;
    let hValid = false;

    if (!isInteger(rawWStr)) {
      dimErrorMsg = 'Width must be a positive integer.';
      isValid = false;
    } else {
      const wVal = Number(rawWStr);
      if (!Number.isFinite(wVal) || !Number.isInteger(wVal) || wVal < 20 || wVal > 8000) {
        dimErrorMsg = 'Width must be an integer between 20 and 8,000 px.';
        isValid = false;
      } else {
        width = wVal;
        wValid = true;
      }
    }

    if (!isInteger(rawHStr)) {
      dimErrorMsg = dimErrorMsg || 'Height must be a positive integer.';
      isValid = false;
    } else {
      const hVal = Number(rawHStr);
      if (!Number.isFinite(hVal) || !Number.isInteger(hVal) || hVal < 20 || hVal > 8000) {
        dimErrorMsg = dimErrorMsg || 'Height must be an integer between 20 and 8,000 px.';
        isValid = false;
      } else {
        height = hVal;
        hValid = true;
      }
    }

    if (wValid && hValid && (width * height > 32000000)) {
      dimErrorMsg = 'Total image pixels exceed safe limit (32 Megapixels).';
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
      sizeErrorMsg
    };
  }

  /**
   * Validate and retrieve active specifications
   */
  function getActiveSpecs() {
    hideErrors();
    const isCustom = currentPresetKey === 'custom';
    let width = 350;
    let height = 350;
    let maxKB = 50;
    let prefix = 'ApplyReady_Custom';
    let isValid = true;

    if (isCustom) {
      const rawWStr = customWidthInput ? customWidthInput.value : '';
      const rawHStr = customHeightInput ? customHeightInput.value : '';
      const rawKBStr = customMaxKBInput ? customMaxKBInput.value : '';

      const validation = validateDimensionSpecs(rawWStr, rawHStr, rawKBStr);
      width = validation.width;
      height = validation.height;
      maxKB = validation.maxKB;
      isValid = validation.isValid;

      if (validation.dimErrorMsg) {
        showDimError(validation.dimErrorMsg);
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

  function showDimError(msg) {
    if (dimError) {
      dimError.textContent = msg;
      dimError.classList.remove('hidden');
    }
    if (customWidthInput) customWidthInput.classList.add('is-invalid');
    if (customHeightInput) customHeightInput.classList.add('is-invalid');
  }

  function showSizeError(msg) {
    if (sizeError) {
      sizeError.textContent = msg;
      sizeError.classList.remove('hidden');
    }
    if (customMaxKBInput) customMaxKBInput.classList.add('is-invalid');
  }

  function hideErrors() {
    if (dimError) dimError.classList.add('hidden');
    if (sizeError) sizeError.classList.add('hidden');
    if (customWidthInput) customWidthInput.classList.remove('is-invalid');
    if (customHeightInput) customHeightInput.classList.remove('is-invalid');
    if (customMaxKBInput) customMaxKBInput.classList.remove('is-invalid');
    if (processErrorBox) processErrorBox.classList.add('hidden');
  }

  /**
   * Update Preset UI and Cropper Aspect Ratio
   */
  function updatePresetUI() {
    currentPresetKey = presetSelect.value;
    const isCustom = currentPresetKey === 'custom';

    if (customControls) {
      if (isCustom) {
        customControls.classList.remove('hidden');
      } else {
        customControls.classList.add('hidden');
        const p = PRESETS[currentPresetKey];
        if (p) {
          customWidthInput.value = p.width;
          customHeightInput.value = p.height;
          customMaxKBInput.value = p.maxKB;
        }
      }
    }

    const specs = getActiveSpecs();
    if (specs.isValid) {
      if (specDims) specDims.textContent = `${specs.width} × ${specs.height} px`;
      if (specSize) specSize.textContent = `Under ${specs.maxKB} KB`;
      if (btnProcess) btnProcess.disabled = !currentFile;
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
    if (resultArea) resultArea.classList.add('hidden');
    if (btnDownload) {
      btnDownload.removeAttribute('href');
      btnDownload.removeAttribute('download');
    }
    if (processedBlobUrl) {
      URL.revokeObjectURL(processedBlobUrl);
      processedBlobUrl = null;
    }
  }

  /**
   * Attach all DOM Event Listeners
   */
  function attachEventListeners() {
    presetSelect.addEventListener('change', updatePresetUI);

    [customWidthInput, customHeightInput, customMaxKBInput].forEach(inp => {
      inp.addEventListener('input', () => {
        updatePresetUI();
      });
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
            if (val === 'image/jpeg' && bgFillSelect.value === 'transparent') {
              bgFillSelect.value = 'white';
            }
          }
        }
        updatePresetUI();
      });
    }

    if (bgFillSelect) {
      bgFillSelect.addEventListener('change', invalidateResult);
    }

    if (aspectRatioSelect) {
      aspectRatioSelect.addEventListener('change', updateCropperRatio);
    }

    addDateCheckbox.addEventListener('change', () => {
      if (dateInputGroup) {
        dateInputGroup.style.display = addDateCheckbox.checked ? 'block' : 'none';
      }
      updateCropperRatio();
      invalidateResult();
    });

    if (btnTodayDate) btnTodayDate.addEventListener('click', setTodayDate);

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

    // Drag and Drop
    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.add('dragover');
    });

    dropzone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove('dragover');
    });

    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove('dragover');
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleFileSelect(e.dataTransfer.files[0]);
      }
    });

    // Remove file button
    if (btnRemoveFile) {
      btnRemoveFile.addEventListener('click', removeUploadedImage);
    }

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
      if (cropper) cropper.zoom(0.1);
    });

    btnZoomOut.addEventListener('click', () => {
      if (cropper) cropper.zoom(-0.1);
    });

    // Process & Download
    btnProcess.addEventListener('click', processImage);

    // Re-adjust crop
    btnCropAgain.addEventListener('click', () => {
      resultArea.classList.add('hidden');
      cropperActiveArea.classList.remove('hidden');
      cropperActiveArea.scrollIntoView({ behavior: 'smooth' });
    });
  }

  /**
   * Handle image selection and decode verification
   */
  function handleFileSelect(file) {
    hideErrors();
    invalidateResult();

    if (!file) return;

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

    if (!file.type.match(/^image\//) && !file.name.match(/\.(jpg|jpeg|png|webp|bmp|gif|avif)$/i)) {
      showProcessError('Unsupported format. Please select a valid JPG, PNG, or WebP image.');
      return;
    }

    const opId = ++currentOpId;
    currentFile = file;

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
            updateCropperRatio();
            cropperActiveArea.scrollIntoView({ behavior: 'smooth' });
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
    if (cropper) {
      cropper.destroy();
      cropper = null;
    }
    currentFile = null;
    sourceImage = null;
    sourceDimensions = { width: 0, height: 0, sizeBytes: 0 };
    imageToCrop.src = '';

    if (fileInfoBox) fileInfoBox.classList.add('hidden');
    cropperActiveArea.classList.add('hidden');
    cropperPlaceholder.classList.remove('hidden');
    invalidateResult();
    hideErrors();
  }

  function showProcessError(msg) {
    if (processErrorBox && processErrorMessage) {
      processErrorMessage.textContent = msg;
      processErrorBox.classList.remove('hidden');
      processErrorBox.scrollIntoView({ behavior: 'smooth' });
    }
  }

  /**
   * Format exam/print date
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
      if (targetHeight < 120) {
        throw new Error('Image height must be at least 120 px when Date / Name strip is enabled.');
      }

      const stripHeight = Math.max(34, Math.round(targetHeight * 0.16));
      const photoHeight = Math.max(1, targetHeight - stripHeight);

      // Cropped canvas without forcing aspect distortion
      const croppedCanvas = cropper.getCroppedCanvas({
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

      if (candidateName) {
        // Two lines: Candidate Name + Date
        let nameFontSize = Math.max(9, Math.round(stripHeight * 0.32));
        ctx.font = `bold ${nameFontSize}px 'Inter', sans-serif`;

        // Fit long or Unicode names without clipping
        const maxTextWidth = targetWidth * 0.92;
        while (ctx.measureText(candidateName).width > maxTextWidth && nameFontSize > 7) {
          nameFontSize -= 1;
          ctx.font = `bold ${nameFontSize}px 'Inter', sans-serif`;
        }

        let displayName = candidateName;
        if (ctx.measureText(displayName).width > maxTextWidth) {
          while (displayName.length > 3 && ctx.measureText(displayName + '…').width > maxTextWidth) {
            displayName = displayName.slice(0, -1);
          }
          displayName += '…';
        }

        ctx.fillText(displayName, targetWidth / 2, photoHeight + (stripHeight * 0.38));

        const dateFontSize = Math.max(8, Math.round(stripHeight * 0.28));
        ctx.font = `600 ${dateFontSize}px 'Inter', sans-serif`;
        ctx.fillText(`DATE: ${formattedDate}`, targetWidth / 2, photoHeight + (stripHeight * 0.80));
      } else {
        // Single centered date line
        const fontSize = Math.max(10, Math.round(stripHeight * 0.44));
        ctx.font = `bold ${fontSize}px 'Inter', sans-serif`;
        ctx.textBaseline = 'middle';
        ctx.fillText(`DATE: ${formattedDate}`, targetWidth / 2, photoHeight + (stripHeight / 2));
      }
    } else {
      // Full canvas without strip
      const croppedCanvas = cropper.getCroppedCanvas({
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
  function compressStrictly(canvas, maxKB, mimeType) {
    return new Promise((resolve, reject) => {
      const maxBytes = maxKB * 1024; // 1 KB = 1024 Bytes

      // For PNG: PNG is lossless. Canvas toBlob ignores quality parameter.
      if (mimeType === 'image/png') {
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('Canvas conversion to PNG failed.'));
            return;
          }
          if (blob.size <= maxBytes) {
            resolve(blob);
          } else {
            const actualKB = (blob.size / 1024).toFixed(1);
            reject({
              code: 'PNG_OVERSIZED',
              message: `PNG is a lossless format and generated ${actualKB} KB, which exceeds your target limit of ${maxKB} KB. Canvas cannot compress PNG lossily without reducing pixel dimensions. Please switch format to JPEG or WebP, or increase the target file size.`,
              actualBytes: blob.size,
              maxBytes
            });
          }
        }, 'image/png');
        return;
      }

      // For JPEG and WebP: Adaptive Quality Search
      const qualitySteps = [0.95, 0.85, 0.75, 0.65, 0.50, 0.35, 0.20, 0.10, 0.05];
      let stepIdx = 0;

      function attempt(quality) {
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error(`Failed to encode image in format ${mimeType}.`));
            return;
          }

          if (blob.size <= maxBytes) {
            // Succeeded within target byte limit!
            resolve(blob);
          } else if (stepIdx < qualitySteps.length - 1) {
            // Try next lower quality step
            stepIdx++;
            attempt(qualitySteps[stepIdx]);
          } else {
            // Oversized even at lowest quality (0.05) - Reject honestly!
            const actualKB = (blob.size / 1024).toFixed(1);
            reject({
              code: 'TARGET_EXCEEDED',
              message: `Unable to compress to under ${maxKB} KB at current dimensions (${canvas.width} × ${canvas.height} px). At lowest quality, file size was ${actualKB} KB. Please increase your target file size, reduce image dimensions, or try WebP format.`,
              actualBytes: blob.size,
              maxBytes
            });
          }
        }, mimeType, quality);
      }

      attempt(qualitySteps[0]);
    });
  }

  /**
   * Process & Compress Image with Strict Post-Validation
   */
  async function processImage() {
    if (!cropper) return;
    hideErrors();

    const specs = getActiveSpecs();
    if (dimError && !dimError.classList.contains('hidden')) return;
    if (sizeError && !sizeError.classList.contains('hidden')) return;

    const opId = ++currentOpId;
    const originalBtnHtml = btnProcess.innerHTML;
    btnProcess.disabled = true;
    btnProcess.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing & Compressing...';

    try {
      const addDate = addDateCheckbox && addDateCheckbox.checked;

      // 1. Generate Target Canvas
      const canvas = generateTargetCanvas(specs, addDate);
      if (opId !== currentOpId) return;

      // 2. Strict Compression
      const compressedBlob = await compressStrictly(canvas, specs.maxKB, specs.mimeType);
      if (opId !== currentOpId) return;

      // 3. Post-Compression Validation: Decode blob and check dimensions, bytes, and MIME
      if (compressedBlob.size > specs.maxKB * 1024) {
        throw new Error(`Output file size (${compressedBlob.size} bytes) exceeds limit.`);
      }

      if (compressedBlob.type !== specs.mimeType) {
        throw new Error(`MIME type mismatch. Expected ${specs.mimeType}, got ${compressedBlob.type}.`);
      }

      // Decode blob back to verify integrity and exact pixel dimensions
      const validationImg = new Image();
      const validationUrl = URL.createObjectURL(compressedBlob);

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

      if (opId !== currentOpId) {
        URL.revokeObjectURL(validationUrl);
        return;
      }

      // Clean up previous blob URL
      if (processedBlobUrl) {
        URL.revokeObjectURL(processedBlobUrl);
      }
      processedBlobUrl = validationUrl;

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
      resultArea.scrollIntoView({ behavior: 'smooth' });

    } catch (err) {
      if (opId !== currentOpId) return;
      console.error('Image Processing Error:', err);
      const msg = err && err.message ? err.message : 'An unexpected error occurred while processing the image.';
      showProcessError(msg);
    } finally {
      if (opId === currentOpId) {
        btnProcess.disabled = false;
        btnProcess.innerHTML = originalBtnHtml;
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
      formatAnnotationDate,
      validateDimensionSpecs
    };
  }

})();
