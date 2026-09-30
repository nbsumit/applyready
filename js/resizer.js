/**
 * ApplyReady.in - Sarkari Exam Photo & Signature Resizer
 * 100% Client-Side Processing (HTML5 Canvas, Cropper.js, Compressor.js)
 */

(function () {
  'use strict';

  // Preset Configurations
  const PRESETS = {
    'upsc-photo': {
      name: 'UPSC Photo',
      width: 350,
      height: 350,
      maxKB: 50,
      hasDate: true,
      defaultPrefix: 'UPSC_Photo'
    },
    'ssc-sig': {
      name: 'SSC Signature',
      width: 140,
      height: 60,
      maxKB: 20,
      hasDate: false,
      defaultPrefix: 'SSC_Signature'
    },
    'ssc-photo': {
      name: 'SSC Photo',
      width: 350,
      height: 450,
      maxKB: 50,
      hasDate: true,
      defaultPrefix: 'SSC_Photo'
    },
    'ibps-photo': {
      name: 'IBPS Photo',
      width: 200,
      height: 230,
      maxKB: 50,
      hasDate: false,
      defaultPrefix: 'IBPS_Photo'
    },
    'ibps-sig': {
      name: 'IBPS Signature',
      width: 140,
      height: 60,
      maxKB: 20,
      hasDate: false,
      defaultPrefix: 'IBPS_Signature'
    },
    'custom': {
      name: 'Custom Size',
      width: 350,
      height: 350,
      maxKB: 50,
      hasDate: false,
      defaultPrefix: 'ApplyReady_Custom'
    }
  };

  // State
  let currentPresetKey = 'upsc-photo';
  let cropper = null;
  let currentFile = null;
  let processedBlobUrl = null;

  // DOM Elements
  const presetSelect = document.getElementById('presetSelect');
  const customControls = document.getElementById('customControls');
  const customWidthInput = document.getElementById('customWidth');
  const customHeightInput = document.getElementById('customHeight');
  const customMaxKBInput = document.getElementById('customMaxKB');
  const specDims = document.getElementById('specDims');
  const specSize = document.getElementById('specSize');

  const dateOptionsBox = document.getElementById('dateOptionsBox');
  const addDateCheckbox = document.getElementById('addDateCheckbox');
  const dateInputGroup = document.getElementById('dateInputGroup');
  const examDateInput = document.getElementById('examDateInput');
  const btnTodayDate = document.getElementById('btnTodayDate');
  const candidateNameInput = document.getElementById('candidateNameInput');

  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('fileInput');
  const btnBrowse = document.getElementById('btnBrowse');

  const cropperPlaceholder = document.getElementById('cropperPlaceholder');
  const cropperActiveArea = document.getElementById('cropperActiveArea');
  const imageToCrop = document.getElementById('imageToCrop');

  const btnRotateLeft = document.getElementById('btnRotateLeft');
  const btnRotateRight = document.getElementById('btnRotateRight');
  const btnResetCrop = document.getElementById('btnResetCrop');
  const btnZoomIn = document.getElementById('btnZoomIn');
  const btnZoomOut = document.getElementById('btnZoomOut');
  const btnProcess = document.getElementById('btnProcess');

  const resultArea = document.getElementById('resultArea');
  const resultImage = document.getElementById('resultImage');
  const resultDims = document.getElementById('resultDims');
  const resultFileSize = document.getElementById('resultFileSize');
  const btnDownload = document.getElementById('btnDownload');
  const btnCropAgain = document.getElementById('btnCropAgain');

  // Modal Elements
  const monetizeModal = document.getElementById('monetizeModal');
  const btnCloseModal = document.getElementById('btnCloseModal');
  const linkDismissModal = document.getElementById('linkDismissModal');

  // Initialization
  function init() {
    setTodayDate();
    updatePresetUI();
    attachEventListeners();
  }

  // Format today's date for date input (YYYY-MM-DD)
  function setTodayDate() {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    examDateInput.value = `${yyyy}-${mm}-${dd}`;
  }

  // Get active dimensions and limit
  function getActiveSpecs() {
    if (currentPresetKey === 'custom') {
      const w = parseInt(customWidthInput.value, 10) || 350;
      const h = parseInt(customHeightInput.value, 10) || 350;
      const kb = parseInt(customMaxKBInput.value, 10) || 50;
      return { width: Math.max(20, w), height: Math.max(20, h), maxKB: Math.max(5, kb), prefix: 'Custom' };
    }
    const p = PRESETS[currentPresetKey];
    return { width: p.width, height: p.height, maxKB: p.maxKB, prefix: p.defaultPrefix };
  }

  // Update UI when Preset Changes
  function updatePresetUI() {
    currentPresetKey = presetSelect.value;
    const isCustom = currentPresetKey === 'custom';

    if (isCustom) {
      customControls.classList.remove('hidden');
    } else {
      customControls.classList.add('hidden');
    }

    const specs = getActiveSpecs();
    specDims.textContent = `${specs.width} x ${specs.height} px`;
    specSize.textContent = `Under ${specs.maxKB} KB`;

    // Manage date box visibility based on preset
    const presetConfig = PRESETS[currentPresetKey];
    if (presetConfig && presetConfig.hasDate) {
      dateOptionsBox.style.display = 'block';
      addDateCheckbox.checked = true;
      dateInputGroup.style.display = 'block';
    } else if (currentPresetKey === 'ssc-sig' || currentPresetKey === 'ibps-sig') {
      // Signatures never need a date strip
      dateOptionsBox.style.display = 'none';
      addDateCheckbox.checked = false;
    } else {
      dateOptionsBox.style.display = 'block';
      addDateCheckbox.checked = false;
      dateInputGroup.style.display = 'none';
    }

    // Update Cropper aspect ratio if cropper is initialized
    if (cropper) {
      const ratio = specs.width / specs.height;
      cropper.setAspectRatio(ratio);
    }
  }

  // Attach Event Listeners
  function attachEventListeners() {
    presetSelect.addEventListener('change', updatePresetUI);

    [customWidthInput, customHeightInput, customMaxKBInput].forEach(inp => {
      inp.addEventListener('input', () => {
        if (currentPresetKey === 'custom') {
          const specs = getActiveSpecs();
          specDims.textContent = `${specs.width} x ${specs.height} px`;
          specSize.textContent = `Under ${specs.maxKB} KB`;
          if (cropper) {
            cropper.setAspectRatio(specs.width / specs.height);
          }
        }
      });
    });

    addDateCheckbox.addEventListener('change', () => {
      dateInputGroup.style.display = addDateCheckbox.checked ? 'block' : 'none';
    });

    btnTodayDate.addEventListener('click', setTodayDate);

    // Browse file trigger
    btnBrowse.addEventListener('click', () => fileInput.click());
    dropzone.addEventListener('click', (e) => {
      if (e.target !== btnBrowse && !btnBrowse.contains(e.target)) {
        fileInput.click();
      }
    });

    // File input change
    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        handleFileSelect(e.target.files[0]);
      }
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

    // Cropper Toolbar Controls
    btnRotateLeft.addEventListener('click', () => {
      if (cropper) cropper.rotate(-90);
    });

    btnRotateRight.addEventListener('click', () => {
      if (cropper) cropper.rotate(90);
    });

    btnResetCrop.addEventListener('click', () => {
      if (cropper) cropper.reset();
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

    // Download button triggers monetization modal
    btnDownload.addEventListener('click', () => {
      setTimeout(() => {
        openMonetizeModal();
      }, 500);
    });

    // Modal Close
    btnCloseModal.addEventListener('click', closeMonetizeModal);
    linkDismissModal.addEventListener('click', (e) => {
      e.preventDefault();
      closeMonetizeModal();
    });
    monetizeModal.addEventListener('click', (e) => {
      if (e.target === monetizeModal) {
        closeMonetizeModal();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && monetizeModal.classList.contains('active')) {
        closeMonetizeModal();
      }
    });
  }

  // Handle image file selection
  function handleFileSelect(file) {
    if (!file.type.match(/^image\//)) {
      alert('Please select a valid image file (JPG, PNG, or WEBP).');
      return;
    }

    currentFile = file;
    const reader = new FileReader();

    reader.onload = function (e) {
      if (cropper) {
        cropper.destroy();
        cropper = null;
      }

      imageToCrop.src = e.target.result;
      cropperPlaceholder.classList.add('hidden');
      resultArea.classList.add('hidden');
      cropperActiveArea.classList.remove('hidden');

      const specs = getActiveSpecs();
      const targetRatio = specs.width / specs.height;

      cropper = new Cropper(imageToCrop, {
        aspectRatio: targetRatio,
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
          cropperActiveArea.scrollIntoView({ behavior: 'smooth' });
        }
      });
    };

    reader.readAsDataURL(file);
  }

  // Format date string from input YYYY-MM-DD to DD-MM-YYYY
  function formatExamDate(dateStr) {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return dateStr;
  }

  // Draw offscreen canvas with exact dimensions and optional date strip
  function generateTargetCanvas(specs, addDate) {
    const targetWidth = specs.width;
    const targetHeight = specs.height;

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');

    // Fill canvas background white
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, targetWidth, targetHeight);

    if (addDate) {
      // Calculate strip height (approx 16% to 20% of image height, minimum 36px)
      const stripHeight = Math.max(34, Math.round(targetHeight * 0.17));
      const photoHeight = targetHeight - stripHeight;

      // Get cropped image from Cropper scaled to width and photoHeight
      const croppedCanvas = cropper.getCroppedCanvas({
        imageSmoothingEnabled: true,
        imageSmoothingQuality: 'high'
      });

      // Draw cropped image in the top portion
      ctx.drawImage(croppedCanvas, 0, 0, targetWidth, photoHeight);

      // Draw clean white strip at bottom
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, photoHeight, targetWidth, stripHeight);

      // Draw thin top border for strip
      ctx.strokeStyle = '#D1D5DB';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, photoHeight);
      ctx.lineTo(targetWidth, photoHeight);
      ctx.stroke();

      // Draw Text
      const candidateName = candidateNameInput.value.trim().toUpperCase();
      const rawDate = examDateInput.value;
      const formattedDate = formatExamDate(rawDate);

      ctx.fillStyle = '#000000';
      ctx.textAlign = 'center';

      if (candidateName) {
        // Two lines: Name on top, Date below
        const nameFontSize = Math.max(9, Math.round(stripHeight * 0.30));
        const dateFontSize = Math.max(8, Math.round(stripHeight * 0.28));

        ctx.font = `bold ${nameFontSize}px 'Inter', sans-serif`;
        ctx.fillText(candidateName, targetWidth / 2, photoHeight + (stripHeight * 0.38));

        ctx.font = `600 ${dateFontSize}px 'Inter', sans-serif`;
        ctx.fillText(`DATE: ${formattedDate}`, targetWidth / 2, photoHeight + (stripHeight * 0.80));
      } else {
        // Single line centered
        const fontSize = Math.max(10, Math.round(stripHeight * 0.44));
        ctx.font = `bold ${fontSize}px 'Inter', sans-serif`;
        ctx.textBaseline = 'middle';
        ctx.fillText(`DATE: ${formattedDate}`, targetWidth / 2, photoHeight + (stripHeight / 2));
      }
    } else {
      // Full canvas without strip
      const croppedCanvas = cropper.getCroppedCanvas({
        width: targetWidth,
        height: targetHeight,
        imageSmoothingEnabled: true,
        imageSmoothingQuality: 'high'
      });
      ctx.drawImage(croppedCanvas, 0, 0, targetWidth, targetHeight);
    }

    return canvas;
  }

  // Compress canvas blob strictly under maxKB using Compressor.js quality loop
  function compressStrictly(canvas, maxKB) {
    return new Promise((resolve, reject) => {
      // Convert canvas to initial JPEG blob
      canvas.toBlob((initialBlob) => {
        if (!initialBlob) {
          reject(new Error('Canvas conversion to blob failed'));
          return;
        }

        const maxBytes = maxKB * 1024;
        let qualitySteps = [0.92, 0.85, 0.78, 0.70, 0.60, 0.50, 0.40, 0.30, 0.20, 0.12];
        let stepIndex = 0;

        function attemptCompression(blobToCompress) {
          const currentQuality = qualitySteps[stepIndex];

          new Compressor(blobToCompress, {
            quality: currentQuality,
            mimeType: 'image/jpeg',
            convertSize: 0,
            success(compressedResult) {
              if (compressedResult.size <= maxBytes || stepIndex >= qualitySteps.length - 1) {
                resolve(compressedResult);
              } else {
                stepIndex++;
                attemptCompression(blobToCompress);
              }
            },
            error(err) {
              // If Compressor.js fails for any reason, fallback to original blob
              resolve(blobToCompress);
            }
          });
        }

        attemptCompression(initialBlob);
      }, 'image/jpeg', 0.95);
    });
  }

  // Process and Compress Image
  async function processImage() {
    if (!cropper) return;

    const originalBtnHtml = btnProcess.innerHTML;
    btnProcess.disabled = true;
    btnProcess.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing & Compressing...';

    try {
      const specs = getActiveSpecs();
      const addDate = addDateCheckbox.checked && dateOptionsBox.style.display !== 'none';

      // 1. Generate Target Canvas with exact dimensions and optional date strip
      const canvas = generateTargetCanvas(specs, addDate);

      // 2. Strict KB compression loop using Compressor.js
      const compressedBlob = await compressStrictly(canvas, specs.maxKB);

      // Clean up previous blob URL
      if (processedBlobUrl) {
        URL.revokeObjectURL(processedBlobUrl);
      }

      processedBlobUrl = URL.createObjectURL(compressedBlob);

      // Update Result UI
      resultImage.src = processedBlobUrl;
      resultDims.textContent = `${specs.width} x ${specs.height} px`;
      
      const actualKB = (compressedBlob.size / 1024).toFixed(1);
      resultFileSize.textContent = `${actualKB} KB (Limit: ${specs.maxKB} KB)`;

      // Set Download Link
      const dateSuffix = addDate ? '_Dated' : '';
      const filename = `${specs.prefix}${dateSuffix}_ApplyReady.jpg`;
      btnDownload.href = processedBlobUrl;
      btnDownload.download = filename;

      // Switch views
      cropperActiveArea.classList.add('hidden');
      resultArea.classList.remove('hidden');
      resultArea.scrollIntoView({ behavior: 'smooth' });

      // Automatically trigger monetization modal after slight delay
      setTimeout(() => {
        openMonetizeModal();
      }, 1200);

    } catch (err) {
      console.error('Processing error:', err);
      alert('An error occurred while processing the image. Please try again.');
    } finally {
      btnProcess.disabled = false;
      btnProcess.innerHTML = originalBtnHtml;
    }
  }

  // Monetization Modal Management
  function openMonetizeModal() {
    monetizeModal.classList.add('active');
  }

  function closeMonetizeModal() {
    monetizeModal.classList.remove('active');
  }

  // Run on DOM ready
  document.addEventListener('DOMContentLoaded', init);

})();
