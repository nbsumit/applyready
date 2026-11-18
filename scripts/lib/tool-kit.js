/* Markup helpers for tool pages, so every tool shares one structure.
   Used by page builders; the runtime side is js/lib/file-kit.js and the styles are css/app.css
   section 17 (file lists and batches) and section 12 (workspace). */
'use strict';

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const ACCEPT = {
  image: 'image/jpeg,image/png,image/webp,image/gif,image/bmp,image/avif',
  pdf: 'application/pdf,.pdf',
  text: 'text/plain,.txt,.md,.csv',
  json: 'application/json,.json'
};

/**
 * A drop zone: icon, title, a primary "Choose" button, the hint with formats and limits, and the
 * privacy line. opts: { id, title, button, hint, accept: 'image'|'pdf'|..., multiple, icon }
 * The "Drag it here, or" line is hidden on touch screens, which cannot drag files in, and its "or"
 * is hidden when the compact drop zone hides the button (css/app.css, drop zone section).
 */
function dropzone(opts) {
  const o = Object.assign({ icon: 'arrow-up-from-bracket', button: 'Choose files', multiple: false }, opts);
  const accept = ACCEPT[o.accept] || o.accept || '';
  return `<div class="dropzone" data-dropzone id="${esc(o.id)}" role="group" aria-labelledby="${esc(o.id)}Title">
          <input type="file" id="${esc(o.id)}Input" accept="${esc(accept)}"${o.multiple ? ' multiple' : ''} class="hidden" tabindex="-1" aria-hidden="true">
          <span class="dropzone__icon" aria-hidden="true"><i class="fa-solid fa-${esc(o.icon)}"></i></span>
          <p class="dropzone__title" id="${esc(o.id)}Title">${esc(o.title)}</p>
          <p class="dropzone__text dropzone__drag">Drag ${o.multiple ? 'them' : 'it'} here<span class="dropzone__or">, or</span></p>
          <button type="button" class="btn btn-primary btn-lg" data-browse><i class="fa-solid fa-plus" aria-hidden="true"></i> ${esc(o.button)}</button>
          <p class="dropzone__hint">${esc(o.hint)} Processed on your device, never uploaded.</p>
        </div>`;
}

/** The inline message area tools write file errors into (role=alert). */
function notice(id) {
  return `<div class="notice notice--error" id="${esc(id)}" role="alert" hidden><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i><div class="notice__body"></div></div>`;
}

/** A short privacy note shown under a tool. */
function privacyNote(text) {
  return `<p class="tool-privacy"><i class="fa-solid fa-lock" aria-hidden="true"></i> ${esc(text || 'Your files are processed in this browser and never leave your device.')}</p>`;
}

module.exports = { dropzone, notice, privacyNote, ACCEPT, esc };
