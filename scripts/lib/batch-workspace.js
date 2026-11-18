/* The batch image workspace: one engine (js/batch-image.js) behind three pages that open with
   different defaults and copy (batch processor, image compressor, image converter).
   scripts/build-image-pages.js writes it between <!-- tool:start --> and <!-- tool:end -->.
   Element ids and data-* attributes are read by js/batch-image.js, so they are a contract.
   Styles: css/app.css sections 12 (workspace), 17 (file lists) and 18 (batch images). */
'use strict';

const { dropzone, esc } = require('./tool-kit');

// Presets. js/batch-image.js keeps the same table (PRESETS); tests compare the two.
const PRESETS = {
  custom: { name: 'Custom settings' },
  passport: { name: 'Passport photo', spec: '350 × 450 px, under 50 KB', resize: 'fill', width: 350, height: 450, format: 'image/jpeg', maxKB: 50, quality: 90, allowShrink: false },
  signature: { name: 'Signature', spec: '300 × 100 px, under 30 KB', resize: 'pad', width: 300, height: 100, format: 'image/jpeg', maxKB: 30, quality: 90, allowShrink: false },
  profile: { name: 'Profile photo', spec: '400 × 400 px, under 100 KB', resize: 'fill', width: 400, height: 400, format: 'image/jpeg', maxKB: 100, quality: 90, allowShrink: false },
  document: { name: 'Document scan', spec: 'within 1240 × 1754 px, under 500 KB', resize: 'fit', width: 1240, height: 1754, format: 'image/jpeg', maxKB: 500, quality: 85, allowShrink: true }
};

const RESIZE = [
  ['none', 'Keep the original size'],
  ['fit', 'Fit within a box, keep proportions'],
  ['fill', 'Exact size, crop to fill'],
  ['pad', 'Exact size, add padding'],
  ['scale', 'Scale by a percentage']
];
const FORMATS = [
  ['keep', 'Same as the original'],
  ['image/jpeg', 'JPEG (.jpg), accepted everywhere'],
  ['image/png', 'PNG (.png), sharp edges, transparency'],
  ['image/webp', 'WebP (.webp), small, not accepted everywhere']
];
const NAMING = [
  ['keep', 'Keep the original name'],
  ['suffix', 'Add a word to the end'],
  ['sequence', 'Number them in order']
];

/* Each page: copy, defaults and which settings come first. Every page has every setting
   (the engine reads them all); the rest sit under "More settings". */
const MODES = {
  batch: {
    label: 'Batch image processor', zip: 'applyready-images.zip',
    title: 'Add the photos or signatures to process', button: 'Choose images',
    defaults: { preset: 'custom', resize: 'fit', width: 1200, height: 1200, format: 'image/jpeg', quality: 85, maxKB: '', minKB: '', allowShrink: true, naming: 'keep', suffix: '-resized', prefix: 'image' },
    primary: ['size', 'limit', 'format'], more: ['naming']
  },
  compress: {
    label: 'Image compressor', zip: 'compressed-images.zip',
    title: 'Add the images to make smaller', button: 'Choose images',
    defaults: { preset: 'custom', resize: 'none', width: '', height: '', format: 'keep', quality: 85, maxKB: 100, minKB: '', allowShrink: true, naming: 'keep', suffix: '-small', prefix: 'image' },
    primary: ['limit', 'format'], more: ['size', 'naming']
  },
  convert: {
    label: 'Image converter', zip: 'converted-images.zip',
    title: 'Add the images to convert', button: 'Choose images',
    defaults: { preset: 'custom', resize: 'none', width: '', height: '', format: 'image/jpeg', quality: 92, maxKB: '', minKB: '', allowShrink: true, naming: 'keep', suffix: '-converted', prefix: 'image' },
    primary: ['format'], more: ['limit', 'size', 'naming']
  }
};

const opt = (list, value) => list.map(([v, t]) => `<option value="${esc(v)}"${String(v) === String(value) ? ' selected' : ''}>${esc(t)}</option>`).join('');

function sectionMarkup(id, d, I) {
  if (id === 'size') {
    return `${I}<div class="ws-section" data-section="size">
${I}  <h2 class="ws-section__title">Size</h2>
${I}  <div class="field">
${I}    <label for="bPreset" class="field-label">Preset</label>
${I}    <select id="bPreset" aria-describedby="bPresetHint">${Object.entries(PRESETS).map(([k, p]) => `<option value="${k}"${k === d.preset ? ' selected' : ''}>${esc(p.spec ? `${p.name}: ${p.spec}` : p.name)}</option>`).join('')}</select>
${I}    <p class="field-hint" id="bPresetHint">A preset fills in the size, format and file limit. Change any value to make your own.</p>
${I}  </div>
${I}  <div class="field">
${I}    <label for="bResize" class="field-label">Resize</label>
${I}    <select id="bResize" aria-describedby="bResizeHint">${opt(RESIZE, d.resize)}</select>
${I}    <p class="field-hint" id="bResizeHint"></p>
${I}  </div>
${I}  <div class="field-row" id="bDims">
${I}    <div class="field">
${I}      <label for="bWidth" class="field-label">Width</label>
${I}      <div class="input-unit"><input type="number" id="bWidth" class="input" min="16" max="12000" step="1" inputmode="numeric" value="${esc(d.width)}" aria-describedby="bWidthError"><span class="input-unit__text" aria-hidden="true">px</span></div>
${I}      <p class="field-error hidden" id="bWidthError"></p>
${I}    </div>
${I}    <div class="field">
${I}      <label for="bHeight" class="field-label">Height</label>
${I}      <div class="input-unit"><input type="number" id="bHeight" class="input" min="16" max="12000" step="1" inputmode="numeric" value="${esc(d.height)}" aria-describedby="bHeightError"><span class="input-unit__text" aria-hidden="true">px</span></div>
${I}      <p class="field-error hidden" id="bHeightError"></p>
${I}    </div>
${I}  </div>
${I}  <div class="field hidden" id="bScaleField">
${I}    <label for="bScale" class="field-label">Scale</label>
${I}    <div class="input-unit"><input type="number" id="bScale" class="input" min="1" max="400" step="1" inputmode="numeric" value="50" aria-describedby="bScaleError"><span class="input-unit__text" aria-hidden="true">%</span></div>
${I}    <p class="field-error hidden" id="bScaleError"></p>
${I}  </div>
${I}</div>`;
  }
  if (id === 'limit') {
    return `${I}<div class="ws-section" data-section="limit">
${I}  <h2 class="ws-section__title">File size and quality</h2>
${I}  <div class="field-row">
${I}    <div class="field">
${I}      <label for="bMaxKB" class="field-label">Maximum <span class="optional">(optional)</span></label>
${I}      <div class="input-unit"><input type="number" id="bMaxKB" class="input" min="5" max="20000" step="1" inputmode="numeric" value="${esc(d.maxKB)}" aria-describedby="bMaxKBError"><span class="input-unit__text" aria-hidden="true">KB</span></div>
${I}      <p class="field-error hidden" id="bMaxKBError"></p>
${I}    </div>
${I}    <div class="field">
${I}      <label for="bMinKB" class="field-label">Minimum <span class="optional">(optional)</span></label>
${I}      <div class="input-unit"><input type="number" id="bMinKB" class="input" min="1" max="20000" step="1" inputmode="numeric" value="${esc(d.minKB)}" aria-describedby="bMinKBError"><span class="input-unit__text" aria-hidden="true">KB</span></div>
${I}      <p class="field-error hidden" id="bMinKBError"></p>
${I}    </div>
${I}  </div>
${I}  <p class="field-hint">Leave the maximum empty for no limit. A minimum is reached by adding harmless padding inside JPEG files.</p>
${I}  <div class="field">
${I}    <div class="range-head"><label for="bQuality" class="field-label">Quality</label><span id="bQualityVal" class="range-value">${esc(d.quality)}%</span></div>
${I}    <input type="range" id="bQuality" min="40" max="100" step="1" value="${esc(d.quality)}" aria-describedby="bQualityHint">
${I}    <p class="field-hint" id="bQualityHint">The highest quality to use for JPEG and WebP. With a maximum, it is lowered only as far as needed.</p>
${I}  </div>
${I}  <label class="switch" for="bAllowShrink"><span>Allow smaller dimensions to meet the limit</span><input type="checkbox" id="bAllowShrink" role="switch" aria-describedby="bAllowShrinkHint"${d.allowShrink ? ' checked' : ''}></label>
${I}  <p class="field-hint" id="bAllowShrinkHint">On: quality stays at 50% or more, and an image that still does not fit is made smaller. Off: the pixel size never changes.</p>
${I}</div>`;
  }
  if (id === 'format') {
    return `${I}<div class="ws-section" data-section="format">
${I}  <h2 class="ws-section__title">Format</h2>
${I}  <div class="field">
${I}    <label for="bFormat" class="field-label">Save as</label>
${I}    <select id="bFormat" aria-describedby="bFormatHint">${opt(FORMATS, d.format)}</select>
${I}    <p class="field-hint" id="bFormatHint">GIF, BMP and AVIF files are saved as JPEG when you keep the format.</p>
${I}  </div>
${I}  <div class="field">
${I}    <label for="bBackground" class="field-label">Background colour</label>
${I}    <input type="color" id="bBackground" class="input input--colour" value="#ffffff" aria-describedby="bBackgroundHint">
${I}    <p class="field-hint" id="bBackgroundHint">Fills transparent areas and padding. JPEG has no transparency, so transparent parts of a PNG become this colour.</p>
${I}  </div>
${I}</div>`;
  }
  if (id === 'naming') {
    return `${I}<div class="ws-section" data-section="naming">
${I}  <h2 class="ws-section__title">File names</h2>
${I}  <div class="field">
${I}    <label for="bNaming" class="field-label">Name the results</label>
${I}    <select id="bNaming" aria-describedby="bNamingHint">${opt(NAMING, d.naming)}</select>
${I}  </div>
${I}  <div class="field" id="bSuffixField">
${I}    <label for="bSuffix" class="field-label">Word to add</label>
${I}    <input type="text" id="bSuffix" class="input" maxlength="40" value="${esc(d.suffix)}" autocomplete="off" spellcheck="false">
${I}  </div>
${I}  <div class="field" id="bPrefixField">
${I}    <label for="bPrefix" class="field-label">Name before the number</label>
${I}    <input type="text" id="bPrefix" class="input" maxlength="40" value="${esc(d.prefix)}" autocomplete="off" spellcheck="false">
${I}  </div>
${I}  <p class="field-hint" id="bNamingHint">Two results with the same name get (2), (3) and so on, in the list and in the ZIP file.</p>
${I}  <div class="field">
${I}    <label for="bZipName" class="field-label">ZIP file name</label>
${I}    <div class="input-unit"><input type="text" id="bZipName" class="input" maxlength="60" value="${esc(String(d.zip || 'images.zip').replace(/\.zip$/i, ''))}" autocomplete="off" spellcheck="false" aria-describedby="bZipNameHint"><span class="input-unit__text" aria-hidden="true">.zip</span></div>
${I}    <p class="field-hint" id="bZipNameHint">Name each batch, for example after the class or the date, so the downloads are easy to tell apart.</p>
${I}  </div>
${I}</div>`;
  }
  throw new Error(`unknown section ${id}`);
}

function renderBatchWorkspace(mode) {
  const m = MODES[mode];
  if (!m) throw new Error(`unknown batch mode ${mode}`);
  const d = m.defaults;
  const dz = Object.assign({ zip: m.zip }, d);   // the ZIP name field starts from the page's ZIP name
  const I = '        ';
  const data = [
    ['mode', mode], ['zip', m.zip], ['preset', d.preset], ['resize', d.resize], ['width', d.width], ['height', d.height],
    ['format', d.format], ['quality', d.quality], ['max-kb', d.maxKB], ['min-kb', d.minKB], ['allow-shrink', d.allowShrink ? 'true' : 'false'],
    ['naming', d.naming], ['suffix', d.suffix], ['prefix', d.prefix]
  ].map(([k, v]) => ` data-${k}="${esc(v)}"`).join('');
  const drop = dropzone({
    id: 'batchDrop', title: m.title, button: m.button, accept: 'image', multiple: true,
    hint: 'JPG, PNG, WebP, GIF, BMP or AVIF, up to 50 MB each and 500 files at a time. You can paste images too.'
  });
  return `<section class="ws ws--batch" id="batchApp"${data} data-state="empty" data-keep data-compact-drop data-settings="open" data-ws-file="#batchBar" data-ws-result="#batchResult" data-ws-busy="#batchProgress" aria-label="${esc(m.label)}">
      <div class="ws-head">
        <div class="batch-bar hidden" id="batchBar">
          <p class="batch-bar__counts" id="batchCounts"></p>
          <div class="batch-bar__actions">
            <button type="button" class="btn btn-sm" id="btnBatchAdd"><i class="fa-solid fa-plus" aria-hidden="true"></i> Add images</button>
            <button type="button" class="btn btn-sm btn-danger-ghost" id="btnBatchClear"><i class="fa-solid fa-trash-can" aria-hidden="true"></i> Clear all</button>
          </div>
        </div>
      </div>
      <div class="ws-stage">
        <div class="notice notice--error" id="batchError" role="alert" hidden><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i><div class="notice__body"><p class="batch-msg__title" id="batchErrorTitle"></p><ul class="batch-msg__list" id="batchErrorList"></ul><button type="button" class="btn btn-sm btn-ghost" id="btnBatchErrorClose">Dismiss</button></div></div>
        <div class="notice notice--warning" id="batchWarning" hidden><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i><div class="notice__body" id="batchWarningText"></div></div>
        ${drop}
        <div id="batchProgress" class="batch-progress batch-panel hidden">
          <div class="batch-progress__head">
            <p class="batch-progress__text" id="batchProgressText">Starting…</p>
            <button type="button" class="btn btn-sm" id="btnBatchCancel"><i class="fa-solid fa-ban" aria-hidden="true"></i> Cancel</button>
          </div>
          <div class="progress" id="batchProgressMeter" role="progressbar" aria-labelledby="batchProgressText" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span class="progress-bar" id="batchProgressBar" style="width: 0%;"></span></div>
          <p class="batch-progress__eta" id="batchProgressEta"></p>
        </div>
        <div id="batchResult" class="ws-result batch-panel hidden">
          <div class="ws-result__head">
            <div class="verdict" id="batchVerdict">
              <i class="fa-solid fa-check" id="batchVerdictIcon" aria-hidden="true"></i>
              <div><h2 class="ws-result__title" id="batchVerdictTitle" tabindex="-1"></h2><p class="ws-result__ok" id="batchVerdictText"></p></div>
            </div>
          </div>
          <div class="ws-result__actions">
            <button type="button" class="btn btn-primary btn-lg" id="btnBatchZip"><i class="fa-solid fa-file-zipper" aria-hidden="true"></i> Download all as ZIP</button>
            <button type="button" class="btn btn-lg hidden" id="btnBatchRetry"><i class="fa-solid fa-rotate-right" aria-hidden="true"></i> Retry failed</button>
          </div>
          <p class="batch-result__note">Every file was read back and checked against your settings before it was listed as done. Saving a new copy removes location (GPS), camera and other hidden details from photos.</p>
        </div>
        <div class="notice notice--warning hidden" id="batchStale"><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i><div class="notice__body"><p id="batchStaleText">You changed the settings after processing. The finished files still use the old settings.</p><button type="button" class="btn btn-sm" id="btnBatchRerun"><i class="fa-solid fa-arrows-rotate" aria-hidden="true"></i> Process again</button></div></div>
        <ul class="file-list hidden" id="batchList" aria-label="Images in this batch"></ul>
      </div>
      <div class="ws-rail">
      <div class="ws-side">
${m.primary.map(id => sectionMarkup(id, dz, I)).join('\n')}
        <details class="disclosure batch-more" id="batchMore">
          <summary>More settings</summary>
          <div class="disclosure__body">
${m.more.map(id => sectionMarkup(id, dz, I + '    ')).join('\n')}
          </div>
        </details>
        <button type="button" id="btnBatchReset" class="btn btn-sm btn-ghost ws-reset"><i class="fa-solid fa-rotate-left" aria-hidden="true"></i> Reset to defaults</button>
      </div>
      <div class="ws-action">
        <button type="button" id="btnBatchStart" class="btn btn-primary btn-lg btn-block" disabled><i class="fa-solid fa-bolt" aria-hidden="true"></i> <span id="btnBatchStartLabel">Process images</span></button>
        <p class="process-summary" id="batchSettingsSummary"></p>
      </div>
      </div>
    </section>`;
}

module.exports = { renderBatchWorkspace, PRESETS, MODES };
