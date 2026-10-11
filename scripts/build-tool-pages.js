#!/usr/bin/env node
/* Writes the workspace of the four single-file tools (signature cleaner, image to PDF, compress PDF,
   passport photo print) using the shared workspace pattern. The tool scripts drive these elements by id,
   so ids, data-* attributes and the hidden/active state classes are a contract. Safe to re-run. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const START = '<!-- tool:start -->';
const END = '<!-- tool:end -->';

function balanced(html, from, tag) {
  const re = new RegExp(`<${tag}\\b|</${tag}>`, 'g');
  re.lastIndex = from;
  let depth = 0, m;
  while ((m = re.exec(html))) { if (m[0][1] !== '/') depth++; else if (--depth === 0) return m.index + m[0].length; }
  throw new Error(`unbalanced <${tag}>`);
}

const head = first => `      <div class="ws-head">
        <ol class="steps" aria-label="Progress">
          <li data-step="add"><span class="steps__n" aria-hidden="true">1</span>${first}</li>
          <li data-step="adjust"><span class="steps__n" aria-hidden="true">2</span>Adjust</li>
          <li data-step="download"><span class="steps__n" aria-hidden="true">3</span>Download</li>
        </ol>
      </div>`;

const dropzone = ({ id, inputId, browseId, accept, multiple, aria, title, text, button, hint }) => `        <div id="${id}" class="dropzone" role="group" aria-label="${aria}">
          <input type="file" id="${inputId}" accept="${accept}"${multiple ? ' multiple' : ''} class="hidden" tabindex="-1" aria-hidden="true">
          <i class="fa-solid fa-arrow-up-from-bracket dropzone__icon" aria-hidden="true"></i>
          <h3 class="dropzone__title">${title}</h3>
          <p class="dropzone__text">${text}</p>
          <button type="button" id="${browseId}" class="btn btn-primary btn-lg"><i class="fa-solid fa-plus" aria-hidden="true"></i> ${button}</button>
          <p class="dropzone__hint">${hint}</p>
        </div>`;

const filebar = (id, textId, replaceId, removeId, replaceTitle, removeTitle, icon = 'fa-file-image') => `        <div id="${id}" class="filebar hidden" aria-live="polite">
          <i class="fa-regular ${icon} filebar__icon" aria-hidden="true"></i>
          <span id="${textId}" class="filebar__name"></span>
          <div class="filebar__actions">
            <button type="button" id="${replaceId}" class="btn btn-sm" title="${replaceTitle}">Replace</button>
            <button type="button" id="${removeId}" class="btn btn-sm btn-danger-ghost" title="${removeTitle}">Remove</button>
          </div>
        </div>`;

const stat = (label, id, extra = '') => `            <div class="meta-stat-item"><dt class="meta-stat-label">${label}</dt><dd class="meta-stat-val${extra}" id="${id}">--</dd></div>`;

const select = (id, label, options, selectedIdx = 0) => `        <div class="field">
          <label for="${id}" class="field-label">${label}</label>
          <select id="${id}">
${options.map(([v, t], i) => `            <option value="${v}"${i === selectedIdx ? ' selected' : ''}>${t}</option>`).join('\n')}
          </select>
        </div>`;

const TOOLS = {
  'signature-cleaner.html': () => `<section class="ws" id="cleanerApp" data-state="empty" data-simple-empty data-compact-drop data-ws-file="#cleanerFileInfoBox" aria-label="Signature background cleaner">
${head('Add photo')}
      <div class="ws-stage">
${filebar('cleanerFileInfoBox', 'cleanerFileInfoText', 'btnCleanerReplace', 'btnCleanerRemove', 'Choose a different photo', 'Remove this photo')}
${dropzone({ id: 'cleanerDropzone', inputId: 'cleanerFileInput', browseId: 'btnCleanerBrowse', accept: 'image/jpeg,image/png,image/webp', aria: 'Upload a signature photo', title: 'Add a signature photo', text: 'Drop a photo or scan of your signature here, or choose a file', button: 'Choose signature photo', hint: 'JPG, PNG or WebP. Everything stays on your device.' })}
        <div id="cleanerPreviewArea" class="ws-result hidden">
          <div class="ws-result__head">
            <h3 class="ws-result__title">Preview</h3>
            <div class="segmented" role="group" aria-label="Preview version">
              <button type="button" id="btnViewCleaned" class="active" aria-pressed="true">Cleaned</button>
              <button type="button" id="btnViewOriginal" aria-pressed="false">Original</button>
            </div>
          </div>
          <div class="ws-preview checkerboard"><canvas id="cleanerCanvas" class="sheet-canvas"></canvas></div>
          <dl class="meta-stats">
${stat('Dimensions', 'statDimensions')}
${stat('File size', 'statFileSize')}
${stat('Format', 'statFormat').replace('>--<', '>JPEG (White)<')}
          </dl>
        </div>
      </div>
      <div class="ws-side">
        <h2 class="ws-side__title">Cleaning</h2>
        <div class="field">
          <div class="range-head"><label for="whitenessInput" class="field-label">Paper whiteness</label><span id="whitenessVal" class="range-value">70</span></div>
          <input type="range" id="whitenessInput" min="20" max="100" value="70">
          <p class="field-hint">Raise it if the paper still looks grey or yellow. Lower it if thin strokes disappear.</p>
        </div>
        <div class="field">
          <div class="range-head"><label for="contrastInput" class="field-label">Ink darkness</label><span id="contrastVal" class="range-value">80</span></div>
          <input type="range" id="contrastInput" min="20" max="100" value="80">
          <p class="field-hint">Strengthens faint pen strokes and darkens their edges.</p>
        </div>
${select('inkColorSelect', 'Ink colour', [['original', 'Keep original ink (auto-cleaned)'], ['black', 'Pure black (#000000)'], ['blue', 'Deep blue (#0A1E6E)']])}
${select('cleanerFormatSelect', 'Output format', [['image/jpeg', 'White JPEG (.jpg), best for exam forms'], ['image/png', 'White PNG (.png)'], ['image/png-transparent', 'Transparent PNG (.png), for documents']])}
        <label class="switch" for="denoiseCheckbox"><span>Remove speckles and paper dust</span><input type="checkbox" id="denoiseCheckbox" role="switch" checked></label>
        <button type="button" id="btnResetSettings" class="btn btn-sm btn-ghost ws-reset"><i class="fa-solid fa-rotate-left" aria-hidden="true"></i> Reset to defaults</button>
      </div>
      <div class="ws-action">
        <a id="btnCleanerDownload" class="btn btn-primary btn-lg btn-block" href="#" download="Cleaned_Signature.jpg"><i class="fa-solid fa-download" aria-hidden="true"></i> Download cleaned signature</a>
        <a href="/?preset=signature" class="btn btn-sm btn-block"><i class="fa-solid fa-crop-simple" aria-hidden="true"></i> Resize for upload</a>
      </div>
    </section>`,

  'image-to-pdf.html': () => `<section class="ws" id="pdfApp" data-state="empty" data-simple-empty data-compact-drop data-keep data-ws-file="#workspaceControls" data-ws-result="#pdfResultArea" aria-label="Image to PDF converter">
${head('Add images')}
      <div class="ws-stage">
${dropzone({ id: 'imgPdfDropzone', inputId: 'imgPdfFileInput', browseId: 'btnImgPdfBrowse', accept: 'image/jpeg,image/png,image/webp', multiple: true, aria: 'Upload images for PDF conversion', title: 'Add images to convert', text: 'Drop one or more images here to create your PDF', button: 'Choose photos or scans', hint: 'JPG, PNG or WebP. Add as many pages as you need, then reorder them.' })}
        <div id="imageListContainer" class="pagelist"></div>
        <div id="pdfResultArea" class="ws-result hidden" aria-live="polite">
          <div class="ws-result__head"><h3 class="ws-result__title"><i class="fa-solid fa-circle-check" aria-hidden="true"></i> Your PDF is ready</h3></div>
          <dl class="meta-stats">
${stat('Pages', 'statPdfPages')}
${stat('PDF file size', 'statPdfSize')}
          </dl>
          <div class="ws-result__actions">
            <a id="btnDownloadPdf" class="btn btn-primary btn-lg" href="#" download="Document.pdf"><i class="fa-solid fa-download" aria-hidden="true"></i> Download PDF</a>
            <a href="compress-pdf.html" class="btn btn-lg"><i class="fa-solid fa-compress" aria-hidden="true"></i> Compress to a target size</a>
          </div>
        </div>
      </div>
      <div class="ws-side">
        <h2 class="ws-side__title">PDF settings</h2>
${select('pageSizeSelect', 'Page size', [['a4', 'A4 (210 × 297 mm), standard in India'], ['letter', 'US Letter (8.5 × 11 in)'], ['fit', 'Fit to image, no extra margins']])}
${select('orientationSelect', 'Orientation', [['auto', 'Auto, matches each image'], ['portrait', 'Portrait'], ['landscape', 'Landscape']])}
${select('marginSelect', 'Margins', [['0', 'None (full bleed)'], ['20', 'Small (0.25 inch)'], ['36', 'Normal (0.5 inch)']], 1)}
${select('pdfQualitySelect', 'Image quality', [['0.92', 'High, for clear text scans'], ['0.80', 'Balanced, for standard submissions'], ['0.65', 'Compact, for a smaller file']], 1)}
      </div>
      <div id="workspaceControls" class="ws-action hidden">
        <button type="button" id="btnConvertToPdf" class="btn btn-primary btn-lg btn-block"><i class="fa-solid fa-file-pdf" aria-hidden="true"></i> Convert to PDF</button>
        <div class="row">
          <button type="button" id="btnAddMoreImages" class="btn btn-sm"><i class="fa-solid fa-plus" aria-hidden="true"></i> Add more images</button>
          <button type="button" id="btnClearAllImages" class="btn btn-sm btn-danger-ghost">Clear all</button>
          <input type="file" id="addMoreFileInput" accept="image/jpeg,image/png,image/webp" multiple class="hidden" tabindex="-1" aria-hidden="true">
        </div>
      </div>
    </section>`,

  'compress-pdf.html': () => `<section class="ws" id="compressApp" data-state="empty" data-keep data-ws-file="#compressFileInfoBox" data-ws-result="#compressResultArea" data-ws-busy="#compressProgressBox" aria-label="PDF compressor">
${head('Add file')}
      <div class="ws-stage">
${filebar('compressFileInfoBox', 'compressFileInfoText', 'btnCompressReplace', 'btnCompressRemove', 'Choose a different file', 'Remove this file', 'fa-file-pdf')}
${dropzone({ id: 'compressDropzone', inputId: 'compressFileInput', browseId: 'btnCompressBrowse', accept: 'application/pdf,image/jpeg,image/png', aria: 'Upload a PDF to compress', title: 'Add a PDF or document image', text: 'Drop your certificate PDF or photo scan here', button: 'Choose file', hint: 'PDF, JPG or PNG. Everything stays on your device.' })}
        <p class="ws-note">Choose a target size on the right, then press Compress.</p>
        <div id="compressProgressBox" class="ws-progress hidden" role="status">
          <div class="progress"><span id="compressProgressBar" class="progress-bar" style="width: 0%;"></span></div>
          <p id="compressProgressText" class="progress-text">Processing document…</p>
        </div>
        <div id="compressResultArea" class="ws-result hidden">
          <p id="compressStatus" class="result-status" role="status"></p>
          <dl class="meta-stats">
${stat('Original size', 'statOrigSize')}
${stat('Compressed size', 'statCompSize', ' status-ok')}
${stat('Saved', 'statReduction')}
${stat('Pages', 'statCompPages')}
          </dl>
          <div class="ws-result__actions">
            <a id="btnDownloadCompressedPdf" class="btn btn-primary btn-lg" href="#" download="Compressed_Document.pdf"><i class="fa-solid fa-download" aria-hidden="true"></i> Download compressed PDF</a>
            <a href="image-to-pdf.html" class="btn btn-lg"><i class="fa-solid fa-layer-group" aria-hidden="true"></i> Combine images to PDF</a>
          </div>
        </div>
      </div>
      <div class="ws-side">
        <h2 class="ws-side__title">Target size</h2>
        <div class="field">
          <span class="field-label" id="targetKbLabel">Keep the file under</span>
          <div class="chips" role="group" aria-labelledby="targetKbLabel">
            <button type="button" class="chip preset-kb-btn" data-kb="100" aria-pressed="false">100 KB</button>
            <button type="button" class="chip preset-kb-btn active" data-kb="200" aria-pressed="true">200 KB <span class="chip-sub">popular</span></button>
            <button type="button" class="chip preset-kb-btn" data-kb="300" aria-pressed="false">300 KB <span class="chip-sub">UPSC</span></button>
            <button type="button" class="chip preset-kb-btn" data-kb="500" aria-pressed="false">500 KB</button>
          </div>
        </div>
        <div class="field">
          <label for="targetKbInput" class="field-label">Or a custom limit</label>
          <div class="input-unit">
            <input type="number" id="targetKbInput" class="input" value="200" min="20" max="10000" step="10" inputmode="numeric">
            <span class="input-unit__text" aria-hidden="true">KB</span>
          </div>
          <p class="field-hint">Image quality is lowered just enough to stay under this limit.</p>
        </div>
      </div>
      <div class="ws-action">
        <p class="ws-action__need">Add a file to continue.</p>
        <button type="button" id="btnStartCompress" class="btn btn-primary btn-lg btn-block" disabled><i class="fa-solid fa-bolt" aria-hidden="true"></i> Compress</button>
      </div>
    </section>`,

  'passport-photo-print.html': () => `<section class="ws" id="printApp" data-state="empty" data-simple-empty data-compact-drop data-ws-file="#printFileInfoBox" aria-label="Passport photo print sheet">
${head('Add photo')}
      <div class="ws-stage">
${filebar('printFileInfoBox', 'printFileInfoText', 'btnPrintReplace', 'btnPrintRemove', 'Choose a different photo', 'Remove this photo')}
${dropzone({ id: 'printDropzone', inputId: 'printFileInput', browseId: 'btnPrintBrowse', accept: 'image/jpeg,image/png,image/webp', aria: 'Upload a photo to create a print sheet', title: 'Add a passport photo', text: 'Drop your passport size photo here', button: 'Choose photo', hint: 'JPG, PNG or WebP. Everything stays on your device.' })}
        <div id="printPreviewArea" class="ws-result hidden">
          <div class="ws-result__head"><h3 class="ws-result__title">Print sheet preview</h3></div>
          <div class="ws-preview"><canvas id="sheetCanvas" class="sheet-canvas"></canvas></div>
          <dl class="meta-stats">
${stat('Paper', 'statPrintPaper').replace('>--<', '>4 × 6 inch<')}
${stat('Copies', 'statPrintCount', ' status-ok').replace('>--<', '>8 Photos<')}
${stat('Resolution', 'statPrintDpi').replace('>--<', '>300 DPI<')}
          </dl>
        </div>
      </div>
      <div class="ws-side">
        <h2 class="ws-side__title">Sheet settings</h2>
${select('photoSizeSelect', 'Photo size', [['in-passport', 'Indian passport or exam (3.5 × 4.5 cm)'], ['us-visa', 'US, OCI or international visa (2 × 2 in)'], ['stamp', 'Stamp size (2.5 × 3.5 cm)'], ['schengen', 'Schengen visa (3.5 × 4.5 cm)']])}
${select('paperSizeSelect', 'Paper size', [['4x6', '4 × 6 inch photo paper, lab standard'], ['a4', 'A4 sheet, home or office printer'], ['5x7', '5 × 7 inch photo paper']])}
${select('photoCountSelect', 'Number of copies', [['auto', 'Fill the whole sheet'], ['4', '4 photos'], ['6', '6 photos'], ['8', '8 photos'], ['12', '12 photos'], ['16', '16 photos']])}
${select('gapSelect', 'Spacing between photos', [['1.5', 'Compact (1.5 mm)'], ['2.5', 'Standard (2.5 mm), easy to cut'], ['4', 'Wide (4 mm)']], 1)}
        <div class="check-group">
          <label class="switch" for="guideLinesCheckbox"><span>Dashed cutting guides</span><input type="checkbox" id="guideLinesCheckbox" role="switch" checked></label>
          <label class="switch" for="photoBorderCheckbox"><span>Thin border around photos</span><input type="checkbox" id="photoBorderCheckbox" role="switch" checked></label>
        </div>
      </div>
      <div class="ws-action">
        <a id="btnDownloadPrintJpg" class="btn btn-primary btn-lg btn-block" href="#" download="Passport_Photos_300DPI.jpg"><i class="fa-solid fa-download" aria-hidden="true"></i> Download 300 DPI image (JPEG)</a>
        <button type="button" id="btnDownloadPrintPdf" class="btn btn-sm btn-block"><i class="fa-solid fa-file-pdf" aria-hidden="true"></i> Download print PDF</button>
      </div>
    </section>`
};

for (const [page, render] of Object.entries(TOOLS)) {
  const file = path.join(root, page);
  let html = fs.readFileSync(file, 'utf8');
  const markup = `${START}\n    ${render()}\n    ${END}`;
  if (html.includes(START)) {
    html = html.slice(0, html.indexOf(START)) + markup + html.slice(html.indexOf(END) + END.length);
  } else {
    const at = html.indexOf('<div class="resizer-grid"');
    if (at < 0) throw new Error(`${page}: workspace grid not found`);
    const end = balanced(html, at, 'div');
    const lineStart = html.lastIndexOf('\n', at) + 1;
    html = html.slice(0, lineStart) + '    ' + markup + html.slice(end);
  }
  fs.writeFileSync(file, html);
  console.log('workspace written:', page);
}
