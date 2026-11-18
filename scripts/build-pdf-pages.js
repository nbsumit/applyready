#!/usr/bin/env node
/* Writes the PDF tool pages: merge, split, organise, PDF to images, extract text, page numbers and
   watermark. Each page is defined once here (metadata, workspace, how it works, questions), so the
   visible questions and the FAQPage structured data always match.

   node scripts/build-pdf-pages.js           create missing pages; refresh the workspace (tool:start/end) of existing ones
   node scripts/build-pdf-pages.js --force   rewrite the whole page from this file
   node scripts/build-pdf-pages.js --check   exit 1 if a workspace, or anything else in <main>, differs from this file

   Then run node scripts/sync-shell.js to fill in the header, footer and Content Security Policy.
   The tool scripts drive the workspace by id and data-* attributes, so those are a contract. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { pageHTML } = require('./new-page');
const { dropzone, esc } = require('./lib/tool-kit');

const ROOT = path.resolve(__dirname, '..');
const SITE = 'https://applyready.in/';
const START = '<!-- tool:start -->';
const END = '<!-- tool:end -->';
const force = process.argv.includes('--force');
const check = process.argv.includes('--check');

/* ------------------------------------------------------------------ Shared workspace parts */
const icon = (name, extra = '') => `<i class="fa-solid fa-${name}${extra}" aria-hidden="true"></i>`;

const errorNotice = id => `<div class="notice notice--error" id="${id}" role="alert" data-pdf-error hidden>${icon('triangle-exclamation')}<div class="notice__body"></div></div>`;

const fileBar = p => `      <div class="ws-head">
        <div id="${p}File" class="filebar hidden" data-pdf-file>
          <i class="fa-regular fa-file-pdf filebar__icon" aria-hidden="true"></i>
          <span class="filebar__name" id="${p}FileName" data-pdf-name></span>
          <div class="filebar__actions">
            <button type="button" class="btn btn-sm" id="${p}Replace" data-pdf-replace>Replace</button>
            <button type="button" class="btn btn-sm btn-danger-ghost" id="${p}Remove" data-pdf-remove>Remove</button>
          </div>
        </div>
      </div>`;

const loading = p => `        <div id="${p}Loading" class="pdf-loading hidden" data-pdf-loading role="status"><span class="pdf-spinner" aria-hidden="true"></span> Opening the PDF…</div>`;

const progressBox = (p, text = 'Working…') => `        <div id="${p}Progress" class="ws-progress pdf-progress hidden" data-pdf-progress>
          <div class="pdf-progress__row">
            <p class="progress-text" id="${p}ProgressText">${text}</p>
            <button type="button" class="btn btn-sm" id="${p}Cancel" data-cancel>Cancel</button>
          </div>
          <div class="progress" role="progressbar" aria-labelledby="${p}ProgressText" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span class="progress-bar" id="${p}ProgressBar" style="width:0%"></span></div>
        </div>`;

const stat = (label, id) => `            <div class="meta-stat-item"><dt class="meta-stat-label">${label}</dt><dd class="meta-stat-val" id="${id}">--</dd></div>`;

const result = (p, { title, stats, actions, after = '' }) => `        <div id="${p}Result" class="ws-result hidden" data-pdf-result>
          <div class="ws-result__head">
            <div class="verdict">
              ${icon('check')}
              <div><h2 class="ws-result__title" id="${p}ResultTitle">${title}</h2><p class="ws-result__ok" id="${p}ResultText"></p></div>
            </div>
          </div>
          <dl class="meta-stats meta-stats--row">
${stats.map(([l, id]) => stat(l, id)).join('\n')}
          </dl>
          <div class="ws-result__actions">
${actions}
          </div>${after}
        </div>`;

const section = (title, body, id) => `        <div class="ws-section"${id ? ` id="${id}"` : ''}>
          <h2 class="ws-section__title">${title}</h2>
${body}
        </div>`;

const select = (id, label, options, selected, hint) => `          <div class="field">
            <label for="${id}" class="field-label">${label}</label>
            <select id="${id}"${hint ? ` aria-describedby="${id}Hint"` : ''}>
${options.map(([v, t]) => `              <option value="${v}"${String(v) === String(selected) ? ' selected' : ''}>${t}</option>`).join('\n')}
            </select>${hint ? `\n            <p class="field-hint" id="${id}Hint">${hint}</p>` : ''}
          </div>`;

const nameField = (id, value) => `          <div class="field">
            <label for="${id}" class="field-label">File name</label>
            <div class="input-unit">
              <input type="text" id="${id}" class="input" value="${value}" maxlength="100" autocomplete="off" spellcheck="false" aria-describedby="${id}Hint">
              <span class="input-unit__text" aria-hidden="true">.pdf</span>
            </div>
            <p class="field-hint" id="${id}Hint">The name of the file you download.</p>
          </div>`;

const choices = (id, label, items, selected) => `          <div class="pdf-choices" role="group" aria-labelledby="${id}Label" id="${id}">
            <p class="field-label" id="${id}Label">${label}</p>
${items.map(([v, name, spec]) => `            <button type="button" class="choice" data-value="${v}" aria-pressed="${v === selected}"><span class="choice__name">${name}</span><span class="choice__spec">${spec}</span></button>`).join('\n')}
          </div>`;

const action = (id, label, iconName, summaryId) => `      <div class="ws-action">
        <button type="button" id="${id}" class="btn btn-primary btn-lg btn-block">${icon(iconName)} ${label}</button>
        <p class="process-summary" id="${summaryId}" aria-live="polite"></p>
      </div>`;

const pdfDrop = (p, title, hint, opts = {}) => '        ' + dropzone({ id: `${p}Drop`, title, button: opts.button || 'Choose PDF', hint, accept: opts.accept || 'pdf', multiple: !!opts.multiple, icon: opts.icon || 'file-pdf' });

const LIMIT = 'PDF up to 100 MB.';

const ws = (p, label, inner, extra = '') => `<section class="ws ws--pdf" id="${p}App" data-state="empty" data-keep data-simple-empty data-settings="open" data-ws-file="#${p}File" data-ws-result="#${p}Result" data-ws-busy="#${p}Progress" aria-label="${label}"${extra}>
${inner}
    </section>`;

const pagesBlock = (p, title, hint) => `        <div class="pdf-pages hidden" id="${p}Pages">
          <div class="pagelist-head">
            <h2 class="pagelist-head__title">${title}</h2>
            <p class="pagelist-head__hint">${hint}</p>
          </div>
          <ol class="page-grid" id="${p}Grid" aria-label="${title}"></ol>
          <p class="field-hint" id="${p}GridNote"></p>
        </div>`;

const outputsList = p => `
          <ul class="file-list pdf-outputs" id="${p}Outputs" aria-label="Files"></ul>`;

/* ------------------------------------------------------------------ Workspaces */
const WORKSPACES = {
  merge: () => `<section class="ws ws--pdf" id="mergeApp" data-state="empty" data-keep data-simple-empty data-compact-drop data-settings="open" data-ws-file="#mergeBar" data-ws-result="#mergeResult" data-ws-busy="#mergeProgress" aria-label="Merge PDF">
      <div class="ws-head">
        <div class="batch-bar hidden" id="mergeBar">
          <p class="batch-bar__counts" id="mergeCounts"></p>
          <div class="batch-bar__actions">
            <button type="button" class="btn btn-sm" id="mergeAdd">${icon('plus')} Add files</button>
            <button type="button" class="btn btn-sm btn-danger-ghost" id="mergeClear">Remove all</button>
          </div>
        </div>
      </div>
      <div class="ws-stage">
        ${errorNotice('mergeError')}
${pdfDrop('merge', 'Add the PDFs to join', 'PDFs, and photos or scans (JPG, PNG, WebP). Up to 50 files, 100 MB each and 500 MB in all.', { multiple: true, button: 'Choose files', accept: 'application/pdf,.pdf,image/jpeg,image/png,image/webp,image/gif,image/bmp', icon: 'object-group' })}
${result('merge', { title: 'Your merged PDF is ready', stats: [['Pages', 'mergeStatPages'], ['Files joined', 'mergeStatFiles'], ['File size', 'mergeStatSize']], actions: `            <a id="mergeDownload" class="btn btn-primary btn-lg" href="#" download="merged.pdf">${icon('download')} Download PDF</a>` })}
${progressBox('merge', 'Merging…')}
        <div class="pdf-pages hidden" id="mergePages">
          <div class="pagelist-head">
            <h2 class="pagelist-head__title">Order</h2>
            <p class="pagelist-head__hint">Files are joined from top to bottom. Drag a file by its handle, or use the arrow buttons, to change the order.</p>
          </div>
          <ol class="file-list merge-list" id="mergeList" aria-label="Files to merge, in order"></ol>
        </div>
        <p class="sr-only" id="mergeOrderStatus" role="status" aria-live="polite"></p>
      </div>
      <div class="ws-rail">
      <div class="ws-side">
${section('Output', nameField('mergeName', 'merged'))}
${section('Good to know', `          <ul class="pdf-facts">
            <li>Every page keeps its size and orientation.</li>
            <li>A photo or scan becomes one A4 page, fitted to the page.</li>
            <li>Bookmarks and fillable form fields from the original files are not carried over.</li>
          </ul>`)}
      </div>
${action('mergeRun', 'Merge files', 'object-group', 'mergeSummary')}
      </div>
    </section>`,

  split: () => ws('split', 'Split PDF', `${fileBar('split')}
      <div class="ws-stage">
        ${errorNotice('splitError')}
${pdfDrop('split', 'Add the PDF to split', `${LIMIT} Password-protected files are fine if you know the password.`)}
${loading('split')}
${result('split', { title: 'Your files are ready', stats: [['Files', 'splitStatFiles'], ['Pages in all', 'splitStatPages'], ['Total size', 'splitStatSize']], actions: `            <button type="button" id="splitZip" class="btn btn-primary btn-lg">${icon('file-zipper')} Download all as ZIP</button>`, after: outputsList('split') })}
${progressBox('split', 'Splitting…')}
${pagesBlock('split', 'Pages', 'Select pages to add them to the page list. Select a page again to take it out.')}
      </div>
      <div class="ws-rail">
      <div class="ws-side">
${section('How to split', choices('splitMode', 'Choose one', [['extract', 'Extract pages', 'The pages you choose, in one new PDF'], ['ranges', 'One PDF per range', 'For example 1-3, 4-6 gives two files'], ['every', 'Every page', 'Each page becomes its own PDF'], ['chunks', 'Equal parts', 'A new PDF every few pages']], 'extract'))}
${section('Pages', `          <div class="field" id="splitRangesField">
            <label for="splitRanges" class="field-label">Pages to use</label>
            <input type="text" id="splitRanges" class="input" inputmode="text" autocomplete="off" spellcheck="false" placeholder="e.g. 1-3, 5, 8-10" aria-describedby="splitRangesHint">
            <p class="field-hint" id="splitRangesHint">Page numbers and ranges, separated by commas. 7- means page 7 to the end.</p>
            <p class="field-error" id="splitRangesError" hidden></p>
          </div>
          <div class="field hidden" id="splitChunkField">
            <label for="splitChunk" class="field-label">Pages in each file</label>
            <input type="number" id="splitChunk" class="input" value="2" min="1" max="1000" step="1" inputmode="numeric" aria-describedby="splitChunkHint">
            <p class="field-hint" id="splitChunkHint">The last file has the pages that are left over.</p>
            <p class="field-error" id="splitChunkError" hidden></p>
          </div>`, 'splitPagesSection')}
      </div>
${action('splitRun', 'Split PDF', 'scissors', 'splitSummary')}
      </div>`),

  organize: () => ws('org', 'Organise PDF pages', `${fileBar('org')}
      <div class="ws-stage">
        ${errorNotice('orgError')}
${pdfDrop('org', 'Add the PDF to organise', `${LIMIT} Up to 1,500 pages.`)}
${loading('org')}
${result('org', { title: 'Your PDF is ready', stats: [['Pages', 'orgStatPages'], ['Changes', 'orgStatChanges'], ['File size', 'orgStatSize']], actions: `            <a id="orgDownload" class="btn btn-primary btn-lg" href="#" download="organised.pdf">${icon('download')} Download PDF</a>` })}
${progressBox('org', 'Saving…')}
        <div class="pdf-pages hidden" id="orgPages">
          <div class="pdf-toolbar" role="group" aria-label="All pages">
            <button type="button" class="btn btn-sm" id="orgInsert">${icon('file-circle-plus')} Insert pages from another PDF</button>
            <input type="file" id="orgInsertInput" accept="application/pdf,.pdf" class="hidden" tabindex="-1" aria-hidden="true">
            <button type="button" class="btn btn-sm" id="orgRotateAllLeft">${icon('rotate-left')} Rotate all left</button>
            <button type="button" class="btn btn-sm" id="orgRotateAllRight">${icon('rotate-right')} Rotate all right</button>
            <button type="button" class="btn btn-sm btn-ghost" id="orgReset">${icon('arrow-rotate-left')} Undo all changes</button>
          </div>
          <p class="pagelist-head__hint">Drag a page by its handle, or focus the handle and use the arrow keys, Home and End. Inserted pages are added at the end.</p>
          <ol class="page-grid org-grid" id="orgGrid" aria-label="Pages, in their new order"></ol>
        </div>
        <p class="sr-only" id="orgStatus" role="status" aria-live="polite"></p>
      </div>
      <div class="ws-rail">
      <div class="ws-side">
${section('Your changes', `          <p class="pdf-summary" id="orgChanges">No changes yet.</p>`)}
${section('Output', nameField('orgName', 'organised'))}
      </div>
${action('orgRun', 'Save PDF', 'floppy-disk', 'orgSummary')}
      </div>`),

  image: () => ws('img', 'PDF to images', `${fileBar('img')}
      <div class="ws-stage">
        ${errorNotice('imgError')}
${pdfDrop('img', 'Add the PDF to turn into images', `${LIMIT} Up to 500 pages at a time.`)}
${loading('img')}
${result('img', { title: 'Your images are ready', stats: [['Images', 'imgStatCount'], ['Size of each', 'imgStatDims'], ['Total size', 'imgStatSize']], actions: `            <button type="button" id="imgZip" class="btn btn-primary btn-lg">${icon('file-zipper')} Download all as ZIP</button>`, after: outputsList('img') })}
${progressBox('img', 'Drawing pages…')}
${pagesBlock('img', 'Pages', 'Select pages to convert only those. With none selected, every page is converted.')}
      </div>
      <div class="ws-rail">
      <div class="ws-side">
${section('Pages', `          <div class="field">
            <label for="imgRanges" class="field-label">Pages to convert <span class="optional">(optional)</span></label>
            <input type="text" id="imgRanges" class="input" autocomplete="off" spellcheck="false" placeholder="All pages" aria-describedby="imgRangesHint">
            <p class="field-hint" id="imgRangesHint">Leave empty for every page, or type pages such as 1-3, 5.</p>
            <p class="field-error" id="imgRangesError" hidden></p>
          </div>`)}
${section('Image', `          <div class="field">
            <p class="field-label" id="imgFormatLabel">Format</p>
            <div class="segmented" role="group" aria-labelledby="imgFormatLabel" id="imgFormat">
              <button type="button" data-value="jpg" aria-pressed="true">JPG</button>
              <button type="button" data-value="png" aria-pressed="false">PNG</button>
            </div>
            <p class="field-hint">JPG makes smaller files. PNG keeps text edges crisp but is larger.</p>
          </div>
${select('imgDpi', 'Resolution', [['72', '72 DPI, for screens (smallest)'], ['150', '150 DPI, for sharing (recommended)'], ['200', '200 DPI, sharper'], ['300', '300 DPI, for printing']], '150')}
          <p class="field-hint pdf-estimate" id="imgEstimate" aria-live="polite"></p>`)}
      </div>
${action('imgRun', 'Convert to images', 'images', 'imgSummary')}
      </div>`),

  text: () => ws('text', 'Extract text from PDF', `${fileBar('text')}
      <div class="ws-stage">
        ${errorNotice('textError')}
${pdfDrop('text', 'Add the PDF to read', `${LIMIT} Text is read as soon as the file opens.`)}
${loading('text')}
${result('text', { title: 'Text extracted', stats: [['Pages read', 'textStatPages'], ['Pages with text', 'textStatWithText'], ['Characters', 'textStatChars']], actions: `            <button type="button" id="textCopy" class="btn btn-primary btn-lg">${icon('copy')} Copy text</button>
            <a id="textDownload" class="btn btn-lg" href="#" download="text.txt">${icon('download')} Download .txt</a>`, after: `
          <div class="notice notice--warning hidden" id="textEmpty">${icon('triangle-exclamation')}<div class="notice__body" id="textEmptyBody"></div></div>
          <div class="field">
            <label for="textOut" class="field-label">Text from the PDF</label>
            <textarea id="textOut" class="textarea pdf-text" readonly rows="16" spellcheck="false"></textarea>
          </div>` })}
${progressBox('text', 'Reading pages…')}
      </div>
      <div class="ws-rail">
      <div class="ws-side">
${section('Pages', `          <div class="field">
            <label for="textRanges" class="field-label">Pages to read <span class="optional">(optional)</span></label>
            <input type="text" id="textRanges" class="input" autocomplete="off" spellcheck="false" placeholder="All pages" aria-describedby="textRangesHint">
            <p class="field-hint" id="textRangesHint">Leave empty for every page, or type pages such as 1-3, 5.</p>
            <p class="field-error" id="textRangesError" hidden></p>
          </div>
          <label class="switch" for="textMarkers"><span>Mark where each page starts</span><input type="checkbox" id="textMarkers" role="switch" checked></label>`)}
${section('Scanned pages', `          <p class="field-hint">A scanned page is a picture of text, so there is no text to copy. ApplyReady does not read pictures of text (OCR). Pages without text are listed after reading.</p>`)}
      </div>
${action('textRun', 'Extract text again', 'font', 'textSummary')}
      </div>`),

  numbers: () => ws('pn', 'Add page numbers', `${fileBar('pn')}
      <div class="ws-stage">
        ${errorNotice('pnError')}
${pdfDrop('pn', 'Add the PDF to number', LIMIT)}
${loading('pn')}
${result('pn', { title: 'Page numbers added', stats: [['Pages', 'pnStatPages'], ['Numbered', 'pnStatNumbered'], ['File size', 'pnStatSize']], actions: `            <a id="pnDownload" class="btn btn-primary btn-lg" href="#" download="numbered.pdf">${icon('download')} Download PDF</a>` })}
${progressBox('pn', 'Adding numbers…')}
        <figure class="pdf-preview hidden" id="pnPreviewBox">
          <div class="pdf-preview__frame"><img id="pnPreview" alt=""></div>
          <figcaption class="ws-preview__caption" id="pnPreviewCaption">Preview</figcaption>
        </figure>
      </div>
      <div class="ws-rail">
      <div class="ws-side">
${section('Position', `          <div class="pos-grid" role="group" aria-label="Position on the page" id="pnPosition">
            <button type="button" class="pos-grid__btn" data-value="top-left" aria-pressed="false"><span class="pos-grid__mark" aria-hidden="true"></span><span>Top left</span></button>
            <button type="button" class="pos-grid__btn" data-value="top-center" aria-pressed="false"><span class="pos-grid__mark" aria-hidden="true"></span><span>Top centre</span></button>
            <button type="button" class="pos-grid__btn" data-value="top-right" aria-pressed="false"><span class="pos-grid__mark" aria-hidden="true"></span><span>Top right</span></button>
            <button type="button" class="pos-grid__btn" data-value="bottom-left" aria-pressed="false"><span class="pos-grid__mark" aria-hidden="true"></span><span>Bottom left</span></button>
            <button type="button" class="pos-grid__btn" data-value="bottom-center" aria-pressed="true"><span class="pos-grid__mark" aria-hidden="true"></span><span>Bottom centre</span></button>
            <button type="button" class="pos-grid__btn" data-value="bottom-right" aria-pressed="false"><span class="pos-grid__mark" aria-hidden="true"></span><span>Bottom right</span></button>
          </div>`)}
${section('Numbers', `${select('pnFormat', 'Format', [['n', '1, 2, 3'], ['page', 'Page 1'], ['page-of', 'Page 1 of 10'], ['slash', '1 / 10']], 'n')}
          <div class="field">
            <label for="pnStart" class="field-label">First number</label>
            <input type="number" id="pnStart" class="input" value="1" min="0" max="99999" step="1" inputmode="numeric" aria-describedby="pnStartHint">
            <p class="field-hint" id="pnStartHint">The number on the first numbered page.</p>
            <p class="field-error" id="pnStartError" hidden></p>
          </div>
          <label class="switch" for="pnSkipFirst"><span>No number on the first page (a cover page)</span><input type="checkbox" id="pnSkipFirst" role="switch"></label>`)}
${section('Style', `${select('pnSize', 'Text size', [['8', '8 pt, small'], ['10', '10 pt'], ['11', '11 pt (recommended)'], ['12', '12 pt'], ['14', '14 pt'], ['16', '16 pt, large']], '11')}
${select('pnMargin', 'Distance from the edge', [['18', 'Small (6 mm)'], ['28', 'Normal (10 mm)'], ['43', 'Large (15 mm)']], '28')}
${select('pnColor', 'Colour', [['black', 'Black'], ['grey', 'Grey'], ['blue', 'Blue'], ['red', 'Red']], 'black')}`)}
      </div>
${action('pnRun', 'Add page numbers', 'list-ol', 'pnSummary')}
      </div>`),

  watermark: () => ws('wm', 'Watermark PDF', `${fileBar('wm')}
      <div class="ws-stage">
        ${errorNotice('wmError')}
${pdfDrop('wm', 'Add the PDF to watermark', LIMIT)}
${loading('wm')}
${result('wm', { title: 'Watermark added', stats: [['Pages', 'wmStatPages'], ['Text', 'wmStatText'], ['File size', 'wmStatSize']], actions: `            <a id="wmDownload" class="btn btn-primary btn-lg" href="#" download="watermarked.pdf">${icon('download')} Download PDF</a>` })}
${progressBox('wm', 'Adding the watermark…')}
        <figure class="pdf-preview hidden" id="wmPreviewBox">
          <div class="pdf-preview__frame"><img id="wmPreview" alt=""></div>
          <figcaption class="ws-preview__caption" id="wmPreviewCaption">Preview</figcaption>
        </figure>
      </div>
      <div class="ws-rail">
      <div class="ws-side">
${section('Text', `          <div class="field">
            <label for="wmText" class="field-label">Watermark text</label>
            <input type="text" id="wmText" class="input" value="Copy" maxlength="60" autocomplete="off" aria-describedby="wmTextHint">
            <p class="field-hint" id="wmTextHint">Up to 60 characters. Letters A to Z with accents, digits and common punctuation; other scripts cannot be written with the standard PDF font.</p>
            <p class="field-error" id="wmTextError" hidden></p>
          </div>
          <div class="chips pdf-quick" role="group" aria-label="Common watermarks" id="wmQuick">
            <button type="button" class="chip" data-text="Copy" aria-pressed="true">Copy</button>
            <button type="button" class="chip" data-text="Self-attested" aria-pressed="false">Self-attested</button>
            <button type="button" class="chip" data-text="For verification only" aria-pressed="false">For verification only</button>
            <button type="button" class="chip" data-text="Confidential" aria-pressed="false">Confidential</button>
            <button type="button" class="chip" data-text="Sample" aria-pressed="false">Sample</button>
          </div>`)}
${section('Look', `${select('wmLayout', 'Position', [['center', 'Centre of the page'], ['top', 'Top'], ['bottom', 'Bottom'], ['tiled', 'Repeated across the page']], 'center')}
${select('wmSize', 'Text size', [['32', 'Small'], ['48', 'Medium'], ['72', 'Large'], ['96', 'Extra large']], '48')}
${select('wmAngle', 'Angle', [['0', 'Level'], ['30', 'Slight slant (30°)'], ['45', 'Diagonal (45°)'], ['90', 'Upright (90°)']], '45')}
${select('wmColor', 'Colour', [['grey', 'Grey'], ['red', 'Red'], ['blue', 'Blue'], ['black', 'Black']], 'grey')}
          <div class="field">
            <div class="range-head"><label for="wmOpacity" class="field-label">Strength</label><span id="wmOpacityVal" class="range-value">30%</span></div>
            <input type="range" id="wmOpacity" min="10" max="80" step="5" value="30" aria-describedby="wmOpacityHint">
            <p class="field-hint" id="wmOpacityHint">Lower keeps the page easy to read; higher makes the watermark hard to miss.</p>
          </div>`)}
      </div>
${action('wmRun', 'Add watermark', 'stamp', 'wmSummary')}
      </div>`)
};

/* ------------------------------------------------------------------ Pages */
const PDF_SCRIPTS = ['js/lib/files.js', 'js/lib/file-kit.js', 'js/lib/pdf-kit.js', 'js/lib/pdf-ui.js'];

const PAGES = [
  {
    page: 'merge-pdf.html', tool: 'merge', name: 'Merge PDF', script: 'js/merge-pdf.js', extraScripts: ['js/lib/image-ops.js'],
    title: 'Merge PDF: Join PDFs and Photos into One File | ApplyReady',
    description: 'Join PDFs, photos and scans into one PDF in the order you choose. Free, in your browser; nothing is uploaded. Pages keep their size and the result is checked.',
    h1: 'Merge PDF',
    lede: 'Join several PDFs, and photos of documents, into one file in the order you choose. Drag to reorder, merge, and download one PDF. Your files stay on this device.',
    how: `      <p>Add the files, put them in order, and select <strong>Merge files</strong>. Each PDF is opened in your browser and its pages are copied, unchanged, into a new document: text stays selectable, and every page keeps its own size and orientation, so an A4 letter and a landscape certificate sit side by side correctly. A photo or scan becomes one A4 page, turned to suit the picture, and its metadata (camera details, the date taken and any GPS location) is left out of the PDF. Before the download appears, the new file is opened again and its page count is checked against the files you added.</p>
      <p>Portals that ask for "all documents in one PDF" usually also have a size limit. Merge first, then bring the whole file under the limit with <a href="compress-pdf.html">Compress PDF</a>. To take pages out, or to turn a sideways page, use <a href="organize-pdf.html">Organise PDF pages</a> on the merged file; to pull a few pages out of a long document before merging, use <a href="split-pdf.html">Split PDF</a>. If you only have photos, <a href="image-to-pdf.html">Image to PDF</a> gives you more control over page size and margins. Every step, including the password window, is shown with screenshots in the tutorial on <a href="guides/how-to-merge-pdf-files.html">merging PDF files</a>.</p>
      <h3>Limits</h3>
      <p>Up to 50 files, 100 MB each and 500 MB in all, so the browser tab does not run out of memory. Bookmarks, links between documents and fillable form fields are not carried over; what the pages show is kept. A password-protected PDF can be added if you know its password, which is used only in this tab, and the merged file has no password.</p>`,
    faq: [
      ['Does merging change how my pages look?', 'No. Pages are copied into the new file as they are, with the same text, images, size and orientation. Nothing is redrawn or compressed, so the merged file is about as large as the files you added put together.'],
      ['Can I add photos of documents as well as PDFs?', 'Yes. JPG, PNG and WebP images are accepted. Each image becomes one A4 page, portrait or landscape to suit the picture, with the image fitted to the page. Phone photos are turned upright first.'],
      ['How do I change the order?', 'Drag a file by its handle, or use the up and down buttons on each row. With a keyboard, focus the handle and use the arrow keys, or Home and End. Files are joined from the top of the list to the bottom.'],
      ['One of my PDFs asks for a password. Can I still merge it?', 'Yes, if you know the password. ApplyReady asks for it in a dialog and uses it only in this browser tab to open the file. The merged PDF does not need a password.'],
      ['Is there a limit on the number of files?', 'Up to 50 files at a time, each up to 100 MB, and 500 MB in all. These limits keep your browser responsive, especially on phones. For more, merge in groups, then merge the results.'],
      ['Are my files uploaded?', 'No. The PDFs are read and joined by your browser on this device. ApplyReady has no server that receives files, and the page cannot send data to any other address.']
    ],
    links: ['split-pdf.html', 'organize-pdf.html', 'compress-pdf.html'],
    examples: [
      ['"Upload all certificates as one PDF"', 'Add the certificates in the order the form lists them, for example class 10, class 12, then your degree. Merge, open the file and scroll through it once, then check its size against the limit. If it is over, bring it down with <a href="compress-pdf.html">Compress PDF</a>.'],
      ['A certificate you only have as a phone photo', 'Add the photo with the PDFs. It becomes one A4 page in its place in the list. Take it flat, in good light and with the whole page in the frame, so it is readable once it is part of the PDF.']
    ],
    guides: ['how-to-merge-pdf-files.html', 'combine-documents-into-one-pdf.html', 'compress-pdf-for-upload-portals.html']
  },
  {
    page: 'split-pdf.html', tool: 'split', name: 'Split PDF', script: 'js/split-pdf.js', extraScripts: ['js/lib/zip.js'],
    title: 'Split PDF: Extract Pages or Split into Files | ApplyReady',
    description: 'Take pages out of a PDF or split it by ranges, single pages or equal parts. Free, in your browser; nothing is uploaded. Download each file or a ZIP.',
    h1: 'Split PDF',
    lede: 'Take the pages you need out of a PDF, or split it into several files by range, by page or into equal parts. Download each file, or all of them as one ZIP. The PDF stays on this device.',
    how: `      <p>Add a PDF and choose how to split it. <strong>Extract pages</strong> puts the pages you choose into one new file, in the order you type them, so "5, 1-3" gives page 5 first; a page you type twice is included twice, and the summary under the button says so. <strong>One PDF per range</strong> makes a file for each range. <strong>Every page</strong> makes one file per page, and <strong>Equal parts</strong> makes a new file every few pages. Select page thumbnails to fill in the page list, or type it; a mistake such as a page number past the end is explained under the field.</p>
      <p>Pages are copied, not redrawn, so text stays sharp and selectable and each page keeps its size and rotation. Every file is opened again and its page count checked before it is offered. To put pages from different files together, use <a href="merge-pdf.html">Merge PDF</a>; to reorder, turn or delete pages in one file, use <a href="organize-pdf.html">Organise PDF pages</a>; and to save pages as pictures instead, use <a href="pdf-to-image.html">PDF to images</a>.</p>
      <h3>Limits</h3>
      <p>Files up to 100 MB, and up to 500 output files in one go. Fonts and images shared by many pages are copied into each new file, so the parts together can be larger than the original. Bookmarks and form fields are not kept in the new files.</p>`,
    faq: [
      ['How do I take just a few pages out of a PDF?', 'Choose Extract pages, then select the pages or type them, for example 2-4, 7. Select Split PDF and download the new file. The original file is not changed.'],
      ['What does "7-" mean in the page list?', 'From page 7 to the last page. You can also write a range such as 3-5, a single page such as 9, or several separated by commas.'],
      ['Can I get every page as a separate PDF?', 'Yes. Choose Every page. You can download each file on its own or all of them in one ZIP file, named with the page number so they sort in order.'],
      ['Will the split pages look the same?', 'Yes. Pages are copied as they are, so text, images, size and rotation stay the same. Nothing is compressed or redrawn.'],
      ['Why are the parts bigger than the original in total?', 'A font or logo used on every page is stored once in the original, but each new file needs its own copy. Each part is complete on its own, which is what makes it bigger in total.'],
      ['Is my PDF uploaded?', 'No. It is read and split by your browser on this device, and closing the tab clears it.']
    ],
    links: ['merge-pdf.html', 'organize-pdf.html', 'pdf-to-image.html'],
    examples: [
      ['"Upload only page 2"', 'Choose <strong>Extract pages</strong>, select the thumbnail of page 2 or type <em>2</em>, and select <strong>Split PDF</strong>. The download is a one-page PDF; your original file still has every page.'],
      ['One scan holds several documents', 'A scanner often puts a mark sheet, an ID card and a certificate into one file. Choose <strong>One PDF per range</strong> and type the pages of each document, for example <em>1-2, 3, 4-5</em>, to get three files, then give each the name the form asks for.'],
      ['The form has two upload slots with a size limit each', 'Split the document into the two parts the form asks for with <strong>One PDF per range</strong>, then check each part against the limit and, if needed, make it smaller with <a href="compress-pdf.html">Compress PDF</a>.']
    ],
    guides: ['compress-pdf-for-upload-portals.html', 'combine-documents-into-one-pdf.html', 'document-checklist-before-online-application.html']
  },
  {
    page: 'organize-pdf.html', tool: 'organize', name: 'Organise PDF pages', script: 'js/organize-pdf.js',
    title: 'Organise PDF Pages: Reorder, Rotate and Delete Pages | ApplyReady',
    description: 'Reorder, rotate and delete PDF pages, or insert pages from another PDF, using thumbnails. Free, in your browser; nothing is uploaded.',
    h1: 'Organise PDF pages',
    lede: 'Put pages in the right order, turn sideways pages upright, remove pages you do not need and add pages from another PDF. Then save a new copy. Your file stays on this device.',
    how: `      <p>Every page is shown as a thumbnail. Drag a page by its handle to move it, or use the buttons under it: move earlier or later, rotate left or right, and delete. A deleted page stays in place, faded, until you save, so you can restore it. <strong>Insert pages from another PDF</strong> adds that file's pages at the end, ready to move. Nothing changes in your original file; <strong>Save PDF</strong> builds a new copy, opens it again and checks that it has the pages you kept.</p>
      <p>Rotation is added to any rotation a page already has, so a page that was stored turned still comes out the way you see it. Pages are copied, not redrawn, so text stays sharp. To join whole files, <a href="merge-pdf.html">Merge PDF</a> is quicker; to make several files out of one, use <a href="split-pdf.html">Split PDF</a>; and once the order is right you can <a href="add-page-numbers.html">add page numbers</a>.</p>
      <h3>Limits</h3>
      <p>Files up to 100 MB and 1,500 pages. Thumbnails are drawn only as you scroll to them, at low resolution, so long documents stay responsive. Bookmarks and form fields are not kept in the saved copy.</p>`,
    faq: [
      ['How do I move a page?', 'Drag it by the handle at its top left corner. With a keyboard, focus the handle and press the arrow keys to move it one place, or Home and End to move it to the start or the end. The move buttons under each page do the same.'],
      ['How do I turn a sideways page upright?', 'Use rotate left or rotate right under the page, as many times as needed. The thumbnail turns so you can check it. Rotate all turns every page at once.'],
      ['I deleted the wrong page. Can I get it back?', 'Yes. A deleted page stays in the grid, faded, with a Restore button, until you save. Undo all changes puts every page back as it was in your file.'],
      ['Can I add pages from another PDF?', 'Yes. Select Insert pages from another PDF and choose the file. Its pages are added at the end, marked with the file name, and you can move them where they belong.'],
      ['Does it change my original file?', 'No. Save PDF makes a new file that you download. Your original stays as it was.'],
      ['Is my PDF uploaded?', 'No. Pages are drawn and rearranged by your browser on this device.']
    ],
    links: ['merge-pdf.html', 'split-pdf.html', 'add-page-numbers.html'],
    examples: [
      ['Rotate a sideways scan', 'Use rotate left or rotate right under the sideways page until its thumbnail reads upright, then select <strong>Save PDF</strong>. Only that page turns; the others stay as they were.'],
      ['Remove a blank page or a back side', 'Delete the page under its thumbnail. It stays in the grid, faded, so you can restore it until you save. Save PDF makes a copy without it.'],
      ['Put mark sheets in semester order', 'Drag each page by its handle, or use the move buttons, until the order matches the form. The saved copy has the pages in the order of the grid, left to right and top to bottom; each thumbnail keeps its page number from your file, so you can see where every page came from.']
    ],
    guides: ['combine-documents-into-one-pdf.html', 'phone-camera-tips-for-document-scans.html', 'document-checklist-before-online-application.html']
  },
  {
    page: 'pdf-to-image.html', tool: 'image', name: 'PDF to images', script: 'js/pdf-to-image.js', extraScripts: ['js/lib/zip.js'],
    title: 'PDF to JPG or PNG: Save PDF Pages as Images | ApplyReady',
    description: 'Save PDF pages as JPG or PNG images at 72 to 300 DPI, one page or all of them in a ZIP. Free, in your browser; nothing is uploaded.',
    h1: 'PDF to images',
    lede: 'Save PDF pages as JPG or PNG pictures, for a portal that only accepts images or for sharing a page. Choose the pages and the resolution, then download. Your file stays on this device.',
    how: `      <p>Each page is drawn by your browser at the resolution you choose and saved as an image. <strong>DPI</strong> is the number of pixels for each inch of paper: an A4 page at 150 DPI is 1240 × 1754 pixels, which reads well on a screen; 300 DPI is for printing. The estimate under the setting shows the image size and roughly how much space the images will take before you start. Images are named after the file and page, for example <em>certificate-page-01.jpg</em>, so they sort in order.</p>
      <p>A portal that wants a photo or signature at an exact pixel size or KB limit needs more than this: convert the page here, then use the <a href="image-resizer.html">image resizer</a>. To keep pages as a PDF instead, use <a href="split-pdf.html">Split PDF</a>, and to copy the words rather than a picture of them, use <a href="pdf-to-text.html">Extract text from PDF</a>.</p>
      <h3>Limits</h3>
      <p>Up to 500 pages at a time. Very large pages are drawn at a lower resolution so the image stays within what phones can handle (about 16 million pixels); when that happens, the result says so. The images are pictures: text in them cannot be selected or searched.</p>`,
    faq: [
      ['Which resolution should I choose?', '150 DPI is right for most uses: an A4 page comes out at 1240 × 1754 pixels, sharp on screen and small to send. Choose 300 DPI only for printing, as files are about four times larger. 72 DPI gives the smallest files.'],
      ['JPG or PNG?', 'JPG for most pages, especially scans and photos: the files are much smaller. PNG keeps the edges of text and lines perfectly crisp, but files are larger. Many portals accept only JPG.'],
      ['Can I convert only some pages?', 'Yes. Select the pages in the grid, or type them, for example 1, 3-4. With nothing selected, every page is converted.'],
      ['How do I get all the images at once?', 'Download all as ZIP gives you one ZIP file with every image, named with its page number. You can also download each image on its own.'],
      ['Why does the result say the resolution was lowered?', 'A very large page at a high resolution would need more pixels than a phone browser can draw. That page is drawn at the highest resolution that fits, and the size is shown with the result.'],
      ['Is my PDF uploaded?', 'No. Pages are drawn by your browser on this device, and the images are made there too.']
    ],
    links: ['split-pdf.html', 'pdf-to-text.html', 'image-resizer.html'],
    examples: [
      ['"Upload your certificate as a JPG"', 'Choose JPG and 150 DPI, select the page of the certificate, and select <strong>Convert to images</strong>. If the form also gives a KB limit or a pixel size, open the image in the <a href="image-resizer.html">image resizer</a> and set them there.'],
      ['Send one page as a picture', 'Select only that page. JPG keeps the file small for messaging apps; PNG keeps the edges of text crisp if the page is mostly text and lines.'],
      ['A copy to print', 'Choose 300 DPI so the printed page is sharp. The files are about four times larger than at 150 DPI, which the estimate shows before you start.']
    ],
    guides: ['pixels-cm-inches-dpi-explained.html', 'image-formats-guide.html', 'fix-common-photo-upload-errors.html']
  },
  {
    page: 'pdf-to-text.html', tool: 'text', name: 'Extract text from PDF', script: 'js/pdf-to-text.js',
    title: 'Extract Text from PDF: Copy or Save as TXT | ApplyReady',
    description: 'Copy the text out of a PDF or save it as a .txt file, page by page. Free, in your browser; nothing is uploaded. Scanned pages are listed, as there is no OCR.',
    h1: 'Extract text from PDF',
    lede: 'Get the words out of a PDF to paste into a form, an email or a document. Copy them, or download a .txt file. Your file stays on this device.',
    how: `      <p>A PDF made from a word processor stores its text, and that text is read page by page as soon as you add the file. Lines are rebuilt from the position of each word on the page, so headings, lines and paragraphs come out separately; columns and tables are read from left to right and may need tidying. With <strong>Mark where each page starts</strong> on, each page begins with a line such as "Page 2".</p>
      <p>A scanned document is different: each page is a picture of text, so there are no words to copy. ApplyReady does not read pictures of text (this is called OCR), and it tells you which pages had no text instead of guessing. To keep a scanned page as an image, use <a href="pdf-to-image.html">PDF to images</a>; to make it smaller for a portal, use <a href="compress-pdf.html">Compress PDF</a>. If you are copying details into a resume, the <a href="resume.html">resume builder</a> takes plain text well.</p>
      <h3>Limits</h3>
      <p>Files up to 100 MB. Text written in a font without a proper character map can come out as wrong characters; that is a fault in how the PDF was made, and the only cure is the original document. Hindi and other Indian scripts are read letter shape by letter shape, so vowel signs such as ि can come out missing or out of place; check those words before you paste them.</p>`,
    faq: [
      ['Why is no text found in my PDF?', 'The pages are probably scans or photos, which are pictures of text rather than text. ApplyReady does not do OCR (reading text from pictures), so it lists those pages instead. Ask for the original document, or type the text yourself.'],
      ['Does it keep the layout?', 'It keeps lines and paragraphs, and leaves a blank line between blocks. Columns and tables come out as plain lines read from left to right, so check them before you paste.'],
      ['Can I read only some pages?', 'Yes. Type the pages, for example 2-3, then select Extract text again.'],
      ['Some characters come out wrong. Why?', 'The PDF uses a font that does not say which letter each shape stands for. The text looks right on screen but cannot be read back reliably from that file.'],
      ['Can it read Hindi or other Indian scripts?', 'It reads the letters, but vowel signs drawn before their letter (such as ि) can come out missing or in the wrong place, because a PDF stores the shapes in the order they are drawn. The tool says when a text includes an Indian script; check those words before you use them.'],
      ['How do I save the text?', 'Copy text puts it on your clipboard. Download .txt saves a plain text file that opens in any text editor.'],
      ['Is my PDF uploaded?', 'No. The text is read by your browser on this device.']
    ],
    links: ['pdf-to-image.html', 'compress-pdf.html', 'resume.html'],
    examples: [
      ['Copy details from a PDF into a form', 'Add the PDF, find the line you need in the text, and copy it. Check numbers such as roll numbers and marks against the PDF before you submit: a table can come out as plain lines read from left to right.'],
      ['A job advert that came as a PDF', 'Extract its text, select <strong>Copy text</strong>, and paste it into the job description box in the Review step of the <a href="resume.html">resume builder</a> to see which of its key terms your resume already uses.'],
      ['"No text found"', 'The pages are scans or photos. Ask for the original file, or type the text yourself; ApplyReady does not read pictures of text.']
    ],
    guides: ['tailor-resume-to-a-job-description.html', 'document-checklist-before-online-application.html', 'staying-safe-with-document-uploads.html']
  },
  {
    page: 'add-page-numbers.html', tool: 'numbers', name: 'Add page numbers', script: 'js/add-page-numbers.js',
    title: 'Add Page Numbers to a PDF: Position and Format | ApplyReady',
    description: 'Number the pages of a PDF, free in your browser with nothing uploaded. Pick a position and a format such as "Page 1 of 10", skip a cover page and preview it.',
    h1: 'Add page numbers',
    lede: 'Number the pages of an application bundle, a report or a set of certificates so nothing gets out of order. Choose where and how, check the preview, then download. Your file stays on this device.',
    how: `      <p>Choose the position, the format and the first number. The preview shows the first numbered page exactly as it will come out, because it is made by the same code as the download. With <strong>No number on the first page</strong> on, the cover is left blank and numbering starts on page 2 with your first number, and "of 10" counts only the numbered pages. Numbers are placed by how each page is seen, so they stay upright at the bottom of a page that is stored turned sideways.</p>
      <p>Numbers are drawn on top of each page in the standard Helvetica font, which every PDF reader has. Everything else on the page is left as it was. Put the pages in order first with <a href="organize-pdf.html">Organise PDF pages</a> or <a href="merge-pdf.html">Merge PDF</a>; to stamp words such as "Self-attested" on every page, use <a href="watermark-pdf.html">Watermark PDF</a>.</p>
      <h3>Limits</h3>
      <p>Files up to 100 MB. The standard PDF font writes digits and the words used here; it cannot write every script. A number placed where the page already has text will overlap it, so pick a position with empty space, which the preview helps you check.</p>`,
    faq: [
      ['Can I leave the cover page without a number?', 'Yes. Turn on No number on the first page. Page 2 then shows your first number, usually 1, and "Page 1 of N" counts only the numbered pages.'],
      ['Can numbering start at a number other than 1?', 'Yes. Type it in First number. This is useful when the PDF continues another document, for example starting at 5.'],
      ['Will the numbers cover my text?', 'They are drawn on top of the page, so they can overlap text that is already there. Check the preview and choose a position or a larger distance from the edge where the page is empty.'],
      ['What happens with landscape or turned pages?', 'Each page is numbered as it is seen, so the number sits at the bottom of a landscape page and reads upright even when the page is stored turned.'],
      ['Which formats are available?', '1, 2, 3; Page 1; Page 1 of 10; and 1 / 10, in sizes from 8 to 16 points and in black, grey, blue or red.'],
      ['Is my PDF uploaded?', 'No. The numbers are added by your browser on this device.']
    ],
    links: ['organize-pdf.html', 'merge-pdf.html', 'watermark-pdf.html'],
    examples: [
      ['Number a bundle but not its cover letter', 'For a cover letter followed by six pages of certificates, choose <strong>Page 1 of 10</strong> and turn on <strong>No number on the first page</strong>. The certificates are numbered Page 1 of 6 to Page 6 of 6, and the letter has no number.'],
      ['Pages that continue another document', 'Type the next number in <strong>First number</strong>, for example 5 when the previous file ended on page 4.'],
      ['A number covers text at the bottom', 'Choose a top position, or a larger distance from the edge, and check the preview again before you download.']
    ],
    guides: ['combine-documents-into-one-pdf.html', 'how-to-merge-pdf-files.html', 'document-checklist-before-online-application.html']
  },
  {
    page: 'watermark-pdf.html', tool: 'watermark', name: 'Watermark PDF', script: 'js/watermark-pdf.js',
    title: 'Watermark PDF: Stamp "Copy" on Every Page | ApplyReady',
    description: 'Stamp text such as "Copy" or "For verification only" across every page of a PDF, with a preview. Free, in your browser; nothing is uploaded.',
    h1: 'Watermark PDF',
    lede: 'Mark every page of a document with words such as "Copy" or "For verification only", so a copy you share cannot be passed off as the original. Preview it, then download. Your file stays on this device.',
    how: `      <p>Type the text or pick a common one, then choose its size, angle, colour and strength. <strong>Centre</strong> puts one watermark in the middle of each page; <strong>Repeated across the page</strong> tiles it so it cannot be cropped away. The preview is the first page as it will come out. The watermark is drawn on top of the page, see-through, so the content underneath stays readable.</p>
      <p>A watermark marks a copy; it is not a signature and does not protect the file from editing. Some forms ask for documents marked "self-attested" with your signature by hand; check what the form asks for. To number the pages as well, use <a href="add-page-numbers.html">Add page numbers</a>, and to bring the marked file under an upload limit afterwards, use <a href="compress-pdf.html">Compress PDF</a>. To combine several marked documents, use <a href="merge-pdf.html">Merge PDF</a>.</p>
      <h3>Limits</h3>
      <p>Files up to 100 MB. The watermark uses the standard Helvetica font, which writes the letters A to Z (with accents such as é or ü), digits and common punctuation. Other scripts, such as Devanagari, and symbols such as ₹ cannot be written; the tool says which characters it cannot use instead of dropping them.</p>`,
    faq: [
      ['Which text should I use for document copies?', 'Use what the form or the person asking for the document says. "Copy" and "For verification only" are common for copies of ID and certificates sent with an application.'],
      ['Can I write the watermark in Hindi or another script?', 'Not with this tool. It uses the standard PDF font, which writes Latin letters (A to Z with accents), digits and common punctuation. It tells you which characters it cannot write rather than leaving gaps.'],
      ['Will the watermark make the page hard to read?', 'It is see-through. Strength sets how visible it is: 20 to 30 percent keeps text easy to read, and the preview shows the result.'],
      ['Can someone remove the watermark?', 'Someone with PDF editing software can, as with any watermark. It marks a copy clearly; it does not lock the file.'],
      ['Is a watermark the same as self-attestation?', 'No. Self-attestation usually means signing a copy yourself. A typed "Self-attested" mark does not replace your signature if the form asks for one.'],
      ['Is my PDF uploaded?', 'No. The watermark is added by your browser on this device.']
    ],
    links: ['add-page-numbers.html', 'compress-pdf.html', 'merge-pdf.html'],
    examples: [
      ['Sending a copy of an ID to a recruiter', 'Choose <strong>For verification only</strong>, and <strong>Repeated across the page</strong> so the mark cannot be cropped away. Keep the strength low enough that the details stay readable in the preview.'],
      ['"Self-attested copies"', 'A form that asks for self-attested copies usually wants your signature on each copy. The <strong>Self-attested</strong> mark can go on the page, but it does not replace the signature; sign the copies as the form asks.'],
      ['The marked file is over the upload limit', 'Check the size shown with the result. If it is over the limit, bring it down with <a href="compress-pdf.html">Compress PDF</a>, then open it once to check that the mark is still readable.']
    ],
    guides: ['staying-safe-with-document-uploads.html', 'document-checklist-before-online-application.html', 'combine-documents-into-one-pdf.html']
  }
];

/* ------------------------------------------------------------------ Page assembly */
// Common requests: a few things people are asked to do, and how to do them with this tool.
const examplesHTML = p => `    <section class="section prose" aria-labelledby="examplesHeading">
      <h2 id="examplesHeading">Common requests</h2>
${p.examples.map(([title, body]) => `      <h3>${title}</h3>
      <p>${body}</p>`).join('\n')}
    </section>`;

// Guides that help with this tool: the title and lede of each guide, read from the guide itself so the
// card cannot drift from the page it links to.
function guideCard(file) {
  const html = fs.readFileSync(path.join(ROOT, 'guides', file), 'utf8');
  const title = (html.match(/<h1 class="page-title">([\s\S]*?)<\/h1>/) || [])[1];
  const lede = (html.match(/<p class="page-lede">([\s\S]*?)<\/p>/) || [])[1];
  if (!title || !lede) throw new Error(`guides/${file}: no page title or lede for its card`);
  const text = s => s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  return `        <a href="guides/${file}" class="guide-card">
          <strong>${text(title)}</strong>
          <p class="text-muted">${text(lede)}</p>
          <span class="resource-link">Read guide ${icon('arrow-right')}</span>
        </a>`;
}
const guidesHTML = p => `    <section class="related-guides-section" aria-labelledby="guidesHeading">
      <h2 id="guidesHeading" class="related-guides-title">Guides that help with this tool</h2>
      <div class="related-guides-grid">
${p.guides.map(guideCard).join('\n')}
      </div>
    </section>`;

const faqHTML = faq => `    <section class="faq-section" aria-labelledby="faqHeading">
      <div class="faq-header">
        <h2 id="faqHeading" class="faq-title">Questions</h2>
      </div>
      <div class="faq-list">
${faq.map(([q, a]) => `        <details class="faq-item">
          <summary class="faq-question"><span>${esc(q)}</span><i class="fa-solid fa-chevron-down faq-chevron" aria-hidden="true"></i></summary>
          <div class="faq-answer"><p>${esc(a)}</p></div>
        </details>`).join('\n')}
      </div>
    </section>`;

function jsonld(p) {
  const url = SITE + p.page;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebApplication', name: `ApplyReady ${p.name}`, url, applicationCategory: 'UtilitiesApplication', operatingSystem: 'Any modern browser', isAccessibleForFree: true, offers: { '@type': 'Offer', price: '0', priceCurrency: 'INR' } },
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: SITE },
        { '@type': 'ListItem', position: 2, name: 'PDF tools', item: SITE + 'tools.html#pdf' },
        { '@type': 'ListItem', position: 3, name: p.name, item: url }
      ] },
      { '@type': 'FAQPage', mainEntity: p.faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) }
    ]
  };
}

const toolBlock = p => `${START}\n    ${WORKSPACES[p.tool]()}\n    ${END}`;

function mainHTML(p) {
  return `    <nav class="breadcrumb-nav" aria-label="Breadcrumb">
      <ol class="breadcrumb-list">
        <li class="breadcrumb-item"><a href="/">Home</a></li>
        <li class="breadcrumb-item"><a href="tools.html#pdf">PDF tools</a></li>
        <li class="breadcrumb-item active" aria-current="page">${esc(p.name)}</li>
      </ol>
    </nav>
    <header class="page-head">
      <h1 class="page-title">${esc(p.h1)}</h1>
      <p class="page-lede">${esc(p.lede)}</p>
    </header>

    <noscript><p class="noscript-note">This tool needs JavaScript. It runs entirely in your browser.</p></noscript>
    ${toolBlock(p)}

    <section class="section prose" aria-labelledby="howHeading">
      <h2 id="howHeading">How it works</h2>
${p.how}
      <p class="tool-privacy">${icon('lock')} Your files are processed in this browser and never leave your device. Closing the tab clears them.</p>
    </section>

${examplesHTML(p)}

${faqHTML(p.faq)}

${guidesHTML(p)}`;
}

function run() {
let differs = 0;
for (const p of PAGES) {
  const file = path.join(ROOT, p.page);
  const exists = fs.existsSync(file);
  if (!exists || force) {
    if (check) { differs++; console.error(`missing or out of date: ${p.page}`); continue; }
    const html = pageHTML({ page: p.page, title: p.title, description: p.description, main: mainHTML(p), jsonld: jsonld(p), scripts: [...PDF_SCRIPTS, ...(p.extraScripts || []), p.script] });
    fs.writeFileSync(file, html);
    console.log(`${exists ? 'rewritten' : 'created'}: ${p.page}`);
    continue;
  }
  const html = fs.readFileSync(file, 'utf8');
  // Everything else in <main> (how it works, common requests, questions, guide cards) also comes from
  // this file, and only --force writes it, so --check reports when it differs.
  if (check) {
    const inner = s => (s.match(/<main\b[^>]*>([\s\S]*?)<\/main>/) || [])[1];
    const fresh = pageHTML({ page: p.page, title: p.title, description: p.description, main: mainHTML(p), jsonld: jsonld(p), scripts: [] });
    if (inner(fresh) !== inner(html)) { differs++; console.error(`page content out of date: ${p.page} (run node scripts/build-pdf-pages.js --force, then node scripts/sync-shell.js)`); continue; }
  }
  const a = html.indexOf(START), b = html.indexOf(END);
  if (a < 0 || b < 0) throw new Error(`${p.page}: tool markers not found`);
  const next = html.slice(0, a) + toolBlock(p) + html.slice(b + END.length);
  if (next !== html) {
    differs++;
    if (check) console.error(`workspace out of date: ${p.page}`);
    else { fs.writeFileSync(file, next); console.log(`workspace written: ${p.page}`); }
  }
}
if (check) { if (differs) process.exit(1); console.log(`PDF tool pages in sync (${PAGES.length})`); }
}

// Run when called as a script; tests read PAGES without writing anything.
if (require.main === module) run();
module.exports = { PAGES };
