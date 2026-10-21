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

// The document bar: a privacy line before a file exists, the file and its actions after.
const head = (privacy, bar = '', always = false) => `      <div class="ws-head">
        <p class="ws-privacy${always ? ' ws-privacy--always' : ''}"><i class="fa-solid fa-lock" aria-hidden="true"></i> ${privacy}</p>${bar ? '\n' + bar : ''}
      </div>`;

const dropzone = ({ id, inputId, browseId, accept, multiple, aria, title, text, button, hint }) => `        <div id="${id}" class="dropzone" role="group" aria-label="${aria}">
          <input type="file" id="${inputId}" accept="${accept}"${multiple ? ' multiple' : ''} class="hidden" tabindex="-1" aria-hidden="true">
          <span class="dropzone__icon" aria-hidden="true"><i class="fa-solid fa-arrow-up-from-bracket"></i></span>
          <h2 class="dropzone__title">${title}</h2>
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

const stat = (label, id, value = '--') => `            <div class="meta-stat-item"><dt class="meta-stat-label">${label}</dt><dd class="meta-stat-val" id="${id}">${value}</dd></div>`;

const select = (id, label, options, selectedIdx = 0, hint = '') => `          <div class="field">
            <label for="${id}" class="field-label">${label}</label>
            <select id="${id}">
${options.map(([v, t], i) => `              <option value="${v}"${i === selectedIdx ? ' selected' : ''}>${t}</option>`).join('\n')}
            </select>${hint ? `\n            <p class="field-hint">${hint}</p>` : ''}
          </div>`;

const section = (title, body) => `        <div class="ws-section">
          <h2 class="ws-section__title">${title}</h2>
${body}
        </div>`;

const TOOLS = {
  'signature-cleaner.html': () => `<section class="ws" id="cleanerApp" data-state="empty" data-simple-empty data-settings="open" data-ws-file="#cleanerFileInfoBox" aria-label="Signature background cleaner">
${head('Your signature is processed on this device. Nothing is uploaded.', filebar('cleanerFileInfoBox', 'cleanerFileInfoText', 'btnCleanerReplace', 'btnCleanerRemove', 'Choose a different photo', 'Remove this photo'))}
      <div class="ws-stage">
${dropzone({ id: 'cleanerDropzone', inputId: 'cleanerFileInput', browseId: 'btnCleanerBrowse', accept: 'image/jpeg,image/png,image/webp', aria: 'Upload a signature photo', title: 'Add a photo of your signature', text: 'Sign on plain white paper, take a photo in daylight, then choose it here.', button: 'Choose signature photo', hint: 'JPG, PNG or WebP. A phone photo is fine.' })}
        <div id="cleanerPreviewArea" class="ws-result hidden">
          <h2 class="ws-result__title">Before and after</h2>
          <div class="compare-pair">
            <figure class="compare-pane">
              <figcaption class="compare-pane__label">Your photo</figcaption>
              <div class="ws-preview checkerboard"><canvas id="cleanerOriginalCanvas" class="sheet-canvas" role="img" aria-label="Original signature photo"></canvas></div>
            </figure>
            <figure class="compare-pane compare-pane--result">
              <figcaption class="compare-pane__label">Cleaned, ready to download</figcaption>
              <div class="ws-preview checkerboard"><canvas id="cleanerCanvas" class="sheet-canvas" role="img" aria-label="Cleaned signature"></canvas></div>
            </figure>
          </div>
          <dl class="meta-stats meta-stats--row">
${stat('Dimensions', 'statDimensions')}
${stat('File size', 'statFileSize')}
${stat('Format', 'statFormat', 'JPEG (White)')}
          </dl>
        </div>
      </div>
      <div class="ws-rail">
      <div class="ws-side">
${section('Clean up', `          <div class="field">
            <div class="range-head"><label for="whitenessInput" class="field-label">Paper whiteness</label><span id="whitenessVal" class="range-value">70</span></div>
            <input type="range" id="whitenessInput" min="20" max="100" value="70">
            <p class="field-hint">Raise it if the paper still looks grey or yellow. Lower it if thin strokes disappear.</p>
          </div>
          <div class="field">
            <div class="range-head"><label for="contrastInput" class="field-label">Ink darkness</label><span id="contrastVal" class="range-value">80</span></div>
            <input type="range" id="contrastInput" min="20" max="100" value="80">
            <p class="field-hint">Strengthens faint pen strokes and darkens their edges.</p>
          </div>
          <label class="switch" for="denoiseCheckbox"><span>Remove specks and paper dust</span><input type="checkbox" id="denoiseCheckbox" role="switch" checked></label>`)}
${section('Output', `${select('inkColorSelect', 'Ink colour', [['original', 'Keep original ink (cleaned)'], ['black', 'Pure black'], ['blue', 'Deep blue']])}
${select('cleanerFormatSelect', 'File type', [['image/jpeg', 'White JPEG (.jpg), for exam forms'], ['image/png', 'White PNG (.png)'], ['image/png-transparent', 'Transparent PNG (.png), for documents']])}`)}
        <button type="button" id="btnResetSettings" class="btn btn-sm btn-ghost ws-reset"><i class="fa-solid fa-rotate-left" aria-hidden="true"></i> Reset to defaults</button>
      </div>
      <div class="ws-action">
        <a id="btnCleanerDownload" class="btn btn-primary btn-lg btn-block" href="#" download="Cleaned_Signature.jpg"><i class="fa-solid fa-download" aria-hidden="true"></i> Download signature</a>
        <a href="/?preset=signature" class="btn btn-block"><i class="fa-solid fa-crop-simple" aria-hidden="true"></i> Resize it for an exam form</a>
      </div>
      </div>
    </section>`,

  'image-to-pdf.html': () => `<section class="ws" id="pdfApp" data-state="empty" data-simple-empty data-compact-drop data-keep data-settings="open" data-ws-file="#workspaceControls" data-ws-result="#pdfResultArea" aria-label="Image to PDF converter">
${head('Your images are combined on this device. Nothing is uploaded.', '', true)}
      <div class="ws-stage">
        <div id="pdfResultArea" class="ws-result hidden" aria-live="polite">
          <div class="ws-result__head">
            <div class="verdict">
              <i class="fa-solid fa-check" aria-hidden="true"></i>
              <div><h2 class="ws-result__title">Your PDF is ready</h2><p class="ws-result__ok">Pages are in the order shown below.</p></div>
            </div>
          </div>
          <dl class="meta-stats meta-stats--row">
${stat('Pages', 'statPdfPages')}
${stat('File size', 'statPdfSize')}
          </dl>
          <div class="ws-result__actions">
            <a id="btnDownloadPdf" class="btn btn-primary btn-lg" href="#" download="Document.pdf"><i class="fa-solid fa-download" aria-hidden="true"></i> Download PDF</a>
            <a href="compress-pdf.html" class="btn btn-lg"><i class="fa-solid fa-compress" aria-hidden="true"></i> Compress to a size limit</a>
          </div>
        </div>
${dropzone({ id: 'imgPdfDropzone', inputId: 'imgPdfFileInput', browseId: 'btnImgPdfBrowse', accept: 'image/jpeg,image/png,image/webp', multiple: true, aria: 'Upload images for PDF conversion', title: 'Add photos or scans', text: 'Each image becomes one page. Drop them here, or choose several at once.', button: 'Choose images', hint: 'JPG, PNG or WebP. You can reorder, rotate and remove pages next.' })}
        <div class="pagelist-head">
          <h2 class="pagelist-head__title">Pages</h2>
          <p class="pagelist-head__hint" id="pageOrderHint">Pages print in this order. Drag a page by its handle to move it, and rotate any page that is sideways.</p>
        </div>
        <div id="imageListContainer" class="pagelist"></div>
        <p id="pageOrderStatus" class="sr-only" role="status" aria-live="polite"></p>
      </div>
      <div class="ws-rail">
      <div class="ws-side">
${section('Page setup', `${select('pageSizeSelect', 'Page size', [['a4', 'A4 (210 × 297 mm), standard in India'], ['letter', 'US Letter (8.5 × 11 in)'], ['fit', 'Same as each image, no margins']])}
${select('orientationSelect', 'Orientation', [['auto', 'Automatic, follows each image'], ['portrait', 'Portrait'], ['landscape', 'Landscape']])}
${select('marginSelect', 'Margins', [['0', 'None (full bleed)'], ['20', 'Small (0.25 inch)'], ['36', 'Normal (0.5 inch)']], 1)}`)}
${section('Quality', select('pdfQualitySelect', 'Image quality', [['0.92', 'High, for clear text scans'], ['0.80', 'Balanced, for most forms'], ['0.65', 'Compact, for a smaller file']], 1, 'Need a strict KB limit? Compress the PDF afterwards.'))}
      </div>
      <div id="workspaceControls" class="ws-action hidden">
        <button type="button" id="btnConvertToPdf" class="btn btn-primary btn-lg btn-block"><i class="fa-solid fa-file-pdf" aria-hidden="true"></i> Create PDF</button>
        <div class="row">
          <button type="button" id="btnAddMoreImages" class="btn btn-sm"><i class="fa-solid fa-plus" aria-hidden="true"></i> Add pages</button>
          <button type="button" id="btnClearAllImages" class="btn btn-sm btn-danger-ghost">Remove all</button>
          <input type="file" id="addMoreFileInput" accept="image/jpeg,image/png,image/webp" multiple class="hidden" tabindex="-1" aria-hidden="true">
        </div>
      </div>
      </div>
    </section>`,

  'compress-pdf.html': () => `<section class="ws" id="compressApp" data-state="empty" data-keep data-settings="open" data-ws-file="#compressFileInfoBox" data-ws-result="#compressResultArea" data-ws-busy="#compressProgressBox" aria-label="PDF compressor">
${head('Your document is compressed on this device. Nothing is uploaded.', filebar('compressFileInfoBox', 'compressFileInfoText', 'btnCompressReplace', 'btnCompressRemove', 'Choose a different file', 'Remove this file', 'fa-file-pdf'))}
      <div class="ws-stage">
${dropzone({ id: 'compressDropzone', inputId: 'compressFileInput', browseId: 'btnCompressBrowse', accept: 'application/pdf,image/jpeg,image/png', aria: 'Upload a PDF to compress', title: 'Add the PDF to make smaller', text: 'A certificate, mark sheet or scanned document. Photos of a document work too.', button: 'Choose file', hint: 'PDF, JPG or PNG.' })}
        <div class="ws-note">
          <div class="ws-note__body">
            <i class="fa-solid fa-file-pdf" aria-hidden="true"></i>
            <p class="ws-note__title">Ready to compress</p>
            <p>Check the maximum file size on the right, then press Compress PDF.</p>
          </div>
        </div>
        <div id="compressProgressBox" class="ws-progress hidden" role="status">
          <div class="progress"><span id="compressProgressBar" class="progress-bar" style="width: 0%;"></span></div>
          <p id="compressProgressText" class="progress-text">Processing document…</p>
        </div>
        <div id="compressResultArea" class="ws-result hidden">
          <p id="compressStatus" class="result-status" role="status"></p>
          <div class="size-compare">
            <dl class="size-compare__item"><dt class="size-compare__label">Before</dt><dd id="statOrigSize">--</dd></dl>
            <span class="size-compare__arrow" aria-hidden="true"><i class="fa-solid fa-arrow-right"></i></span>
            <dl class="size-compare__item"><dt class="size-compare__label">After</dt><dd id="statCompSize">--</dd></dl>
            <dl class="size-compare__foot"><div><dt>Reduction</dt><dd id="statReduction">--</dd></div><div><dt>Pages</dt><dd id="statCompPages">--</dd></div></dl>
          </div>
          <div class="ws-result__actions">
            <a id="btnDownloadCompressedPdf" class="btn btn-primary btn-lg" href="#" download="Compressed_Document.pdf"><i class="fa-solid fa-download" aria-hidden="true"></i> Download compressed PDF</a>
            <a href="image-to-pdf.html" class="btn btn-lg"><i class="fa-solid fa-layer-group" aria-hidden="true"></i> Combine images into a PDF</a>
          </div>
        </div>
      </div>
      <div class="ws-rail">
      <div class="ws-side">
        <div class="ws-section">
          <h2 class="ws-section__title" id="targetKbLabel">Maximum file size</h2>
          <div class="target-grid" role="group" aria-labelledby="targetKbLabel">
            <button type="button" class="chip preset-kb-btn" data-kb="100" aria-pressed="false">100 KB <span class="chip-sub">strict portals</span></button>
            <button type="button" class="chip preset-kb-btn active" data-kb="200" aria-pressed="true">200 KB <span class="chip-sub">most common</span></button>
            <button type="button" class="chip preset-kb-btn" data-kb="300" aria-pressed="false">300 KB <span class="chip-sub">UPSC documents</span></button>
            <button type="button" class="chip preset-kb-btn" data-kb="500" aria-pressed="false">500 KB <span class="chip-sub">larger scans</span></button>
          </div>
          <div class="field">
            <label for="targetKbInput" class="field-label">Or type the limit from your form</label>
            <div class="input-unit">
              <input type="number" id="targetKbInput" class="input" value="200" min="20" max="10000" step="10" inputmode="numeric">
              <span class="input-unit__text" aria-hidden="true">KB</span>
            </div>
            <p class="field-hint">Image quality is lowered only as far as needed to fit. Text stays sharp where it can.</p>
          </div>
        </div>
      </div>
      <div class="ws-action">
        <button type="button" id="btnStartCompress" class="btn btn-primary btn-lg btn-block" disabled><i class="fa-solid fa-compress" aria-hidden="true"></i> Compress PDF</button>
      </div>
      </div>
    </section>`,

  'passport-photo-print.html': () => `<section class="ws" id="printApp" data-state="empty" data-simple-empty data-settings="open" data-ws-file="#printFileInfoBox" aria-label="Passport photo print sheet">
${head('Your photo stays on this device. Nothing is uploaded.', filebar('printFileInfoBox', 'printFileInfoText', 'btnPrintReplace', 'btnPrintRemove', 'Choose a different photo', 'Remove this photo'))}
      <div class="ws-stage">
${dropzone({ id: 'printDropzone', inputId: 'printFileInput', browseId: 'btnPrintBrowse', accept: 'image/jpeg,image/png,image/webp', aria: 'Upload a photo to create a print sheet', title: 'Add your passport photo', text: 'Use a cropped, front-facing photo on a plain background.', button: 'Choose photo', hint: 'JPG, PNG or WebP. Need to crop first? Use the image resizer.' })}
        <div id="printPreviewArea" class="ws-result hidden">
          <div class="ws-preview-bar">
            <h2 class="ws-result__title">Print preview</h2>
            <p class="ws-preview__caption">The whole sheet, to scale</p>
          </div>
          <div class="ws-preview ws-preview--desk"><canvas id="sheetCanvas" class="sheet-canvas"></canvas></div>
          <dl class="meta-stats meta-stats--row">
${stat('Paper', 'statPrintPaper', '4 × 6 inch')}
${stat('Copies', 'statPrintCount', '8 Photos')}
${stat('Resolution', 'statPrintDpi', '300 DPI')}
          </dl>
          <p class="field-hint">Print at 100% (turn off “Fit to page”) so every photo comes out at its real size.</p>
        </div>
      </div>
      <div class="ws-rail">
      <div class="ws-side">
${section('Photo', select('photoSizeSelect', 'Photo size', [['in-passport', 'Indian passport or exam (3.5 × 4.5 cm)'], ['us-visa', 'US, OCI or international visa (2 × 2 in)'], ['stamp', 'Stamp size (2.5 × 3.5 cm)'], ['schengen', 'Schengen visa (3.5 × 4.5 cm)']]))}
${section('Sheet', `${select('paperSizeSelect', 'Paper', [['4x6', '4 × 6 inch photo paper, lab standard'], ['a4', 'A4 sheet, home or office printer'], ['5x7', '5 × 7 inch photo paper']])}
${select('photoCountSelect', 'Copies', [['auto', 'As many as fit'], ['4', '4 photos'], ['6', '6 photos'], ['8', '8 photos'], ['12', '12 photos'], ['16', '16 photos']])}
${select('gapSelect', 'Space between photos', [['1.5', 'Compact (1.5 mm)'], ['2.5', 'Standard (2.5 mm), easy to cut'], ['4', 'Wide (4 mm)']], 1)}`)}
${section('Cutting aids', `          <div class="check-group">
            <label class="switch" for="guideLinesCheckbox"><span>Dashed cutting guides</span><input type="checkbox" id="guideLinesCheckbox" role="switch" checked></label>
            <label class="switch" for="photoBorderCheckbox"><span>Thin border around photos</span><input type="checkbox" id="photoBorderCheckbox" role="switch" checked></label>
          </div>`)}
      </div>
      <div class="ws-action">
        <a id="btnDownloadPrintJpg" class="btn btn-primary btn-lg btn-block" href="#" download="Passport_Photos_300DPI.jpg"><i class="fa-solid fa-download" aria-hidden="true"></i> Download print sheet (JPEG)</a>
        <button type="button" id="btnDownloadPrintPdf" class="btn btn-block"><i class="fa-solid fa-file-pdf" aria-hidden="true"></i> Download as PDF</button>
      </div>
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
