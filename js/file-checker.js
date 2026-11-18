/* File checker (file-checker.html): what a file really is, what it carries, and whether it meets a
   form's requirement. Remove metadata from JPEG and PNG without re-encoding.

   Interface only: parsing lives in js/lib/inspect.js, the queue in js/lib/batch.js, file intake and
   downloads in js/lib/file-kit.js and js/lib/files.js. pdf-lib loads only when a PDF is added.
   Files stay in memory; nothing is stored or sent. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const Files = window.ApplyReadyFiles, Kit = window.ApplyReadyFileKit, Inspect = window.ApplyReadyInspect, Batch = window.ApplyReadyBatch;
  const app = $('checkerApp');
  if (!app || !Files || !Kit || !Inspect || !Batch) return;
  const ui = () => window.ApplyReadyUI || {};
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const MAX_FILES = 50;
  const els = {
    bar: $('fcBar'), counts: $('fcCounts'), add: $('fcAdd'), cancel: $('fcCancel'), zip: $('fcZip'), clear: $('fcClear'),
    list: $('fcList'), error: $('fcError'), progress: $('fcProgress'), progressBar: $('fcProgressBar'), progressText: $('fcProgressText'),
    req: $('fcReq'), reqState: $('fcReqState'), reqError: $('fcReqError'), reqClear: $('fcReqClear'),
    minKB: $('fcMinKB'), maxKB: $('fcMaxKB'), width: $('fcWidth'), height: $('fcHeight'), maxPages: $('fcMaxPages')
  };
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  /* ---------------------------------------------------------------- messages */
  function showError(messages) {
    const list = [].concat(messages).filter(Boolean);
    if (!list.length) { els.error.hidden = true; return; }
    els.error.querySelector('.notice__body').innerHTML = list.length === 1 ? esc(list[0]) : `<ul>${list.map(m => `<li>${esc(m)}</li>`).join('')}</ul>`;
    els.error.hidden = false;
  }

  /* ---------------------------------------------------------------- pdf-lib, loaded on first PDF */
  let pdfLibPromise = null;
  function loadPdfLib() {
    if (window.PDFLib) return Promise.resolve(window.PDFLib);
    if (!pdfLibPromise) {
      pdfLibPromise = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'js/vendor/pdf-lib.min.js';
        s.onload = () => (window.PDFLib ? resolve(window.PDFLib) : reject(new Error('The PDF reader did not start.')));
        s.onerror = () => { pdfLibPromise = null; s.remove(); reject(new Error('The PDF reader could not be loaded. Check your connection, then select Check again.')); };
        document.head.appendChild(s);
      });
    }
    return pdfLibPromise;
  }

  /* ---------------------------------------------------------------- requirement */
  let pixelMode = 'exact';
  function num(input) {
    const raw = input.value.trim();
    if (!raw) return { value: 0 };
    const v = Number(raw);
    if (!Number.isFinite(v) || v < 0) return { error: true };
    return { value: v };
  }
  function readRequirement() {
    const formats = Array.from(app.querySelectorAll('input[name="fcFormat"]:checked')).map(i => i.value);
    const fields = { minKB: num(els.minKB), maxKB: num(els.maxKB), width: num(els.width), height: num(els.height), maxPages: num(els.maxPages) };
    const bad = Object.keys(fields).filter(k => fields[k].error);
    let error = bad.length ? 'Enter numbers of 0 or more.' : '';
    if (!error && fields.minKB.value && fields.maxKB.value && fields.minKB.value > fields.maxKB.value) { error = 'The minimum size is larger than the maximum.'; bad.push('minKB', 'maxKB'); }
    if (!error && ((fields.width.value && !Number.isInteger(fields.width.value)) || (fields.height.value && !Number.isInteger(fields.height.value)))) { error = 'Pixel sizes are whole numbers.'; bad.push('width', 'height'); }
    ['minKB', 'maxKB', 'width', 'height', 'maxPages'].forEach(k => els[k].setAttribute('aria-invalid', String(bad.includes(k))));
    els.reqError.textContent = error;
    els.reqError.hidden = !error;
    const req = { formats, minKB: fields.minKB.value || 0, maxKB: fields.maxKB.value || 0, width: fields.width.value || 0, height: fields.height.value || 0, pixelMode, maxPages: fields.maxPages.value || 0 };
    const rules = (formats.length ? 1 : 0) + (req.minKB || req.maxKB ? 1 : 0) + (req.width || req.height ? 1 : 0) + (req.maxPages ? 1 : 0);
    return { req: error ? null : req, rules: error ? 0 : rules, error };
  }
  let requirement = { req: null, rules: 0 };
  let lastKey = '';
  function requirementChanged() {
    requirement = readRequirement();
    // A field's change event fires again on blur. Re-rendering the cards then would swap out the
    // button the visitor is pressing, so only re-render when the rules really changed.
    const key = JSON.stringify(requirement);
    if (key === lastKey) return;
    lastKey = key;
    els.reqState.textContent = requirement.error ? 'Needs fixing' : requirement.rules ? `${requirement.rules} rule${requirement.rules === 1 ? '' : 's'} set` : 'Optional';
    queue.items.forEach(item => { if (item.status === 'done') renderItem(item); });
    updateBar();
  }
  let reqTimer = null;
  app.querySelector('.fc-req').addEventListener('input', () => { clearTimeout(reqTimer); reqTimer = setTimeout(requirementChanged, 200); });
  app.querySelector('.fc-req').addEventListener('change', requirementChanged);
  app.querySelectorAll('.fc-req .segmented button').forEach(b => b.addEventListener('click', () => {
    pixelMode = b.dataset.mode;
    app.querySelectorAll('.fc-req .segmented button').forEach(x => { x.classList.toggle('active', x === b); x.setAttribute('aria-pressed', String(x === b)); });
    requirementChanged();
  }));
  els.reqClear.addEventListener('click', () => {
    app.querySelectorAll('input[name="fcFormat"]').forEach(i => { i.checked = false; });
    ['minKB', 'maxKB', 'width', 'height', 'maxPages'].forEach(k => { els[k].value = ''; });
    requirementChanged();
    Kit.announce('Requirement cleared.');
  });

  /* ---------------------------------------------------------------- the queue */
  const queue = Batch.createQueue({ concurrency: 1, maxItems: MAX_FILES, process: inspectItem, release: releaseResult });

  async function inspectItem(item, ctx) {
    const file = item.file;
    let PDFLib = null;
    if (file.size > 0 && file.size <= Inspect.DEEP_LIMITS.pdf) {
      const head = new Uint8Array(await file.slice(0, 1024).arrayBuffer());
      if (Files.sniff(head).kind === 'pdf') PDFLib = await loadPdfLib();
    }
    if (ctx.signal.aborted) throw new DOMException('Cancelled', 'AbortError');
    const report = await Inspect.inspect(file, { name: file.name, type: file.type, PDFLib });
    let thumb = null;
    if (report.real.kind === 'image' && report.deep && report.image) {
      // Decoding a small preview is also the test that the browser can open the picture at all.
      thumb = await Kit.thumbnail(file, 96);
      report.decodes = !!thumb;
      if (!thumb) {
        report.damaged = true;
        report.canStrip = false;
        report.warnings.unshift({ level: 'error', text: 'Your browser could not open this image. It may be damaged or incomplete, and most portals will reject it.' });
      }
    }
    return { report, thumb, cleaned: null, cleanError: '' };
  }

  function releaseResult(result) {
    if (!result) return;
    if (result.thumb) URL.revokeObjectURL(result.thumb);
    result.thumb = null;
    if (result.cleaned) result.cleaned.blob = null;
  }

  /* ---------------------------------------------------------------- formatting helpers */
  const group = Inspect.group;
  function fmtDate(s) {
    if (!s) return '';
    const exif = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2})/.exec(s);
    if (exif) return `${+exif[3]} ${MONTHS[+exif[2] - 1] || exif[2]} ${exif[1]}, ${exif[4]}:${exif[5]}`;
    const d = new Date(s);
    if (isNaN(d)) return s;
    return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  function ranges(pages) {
    const out = [];
    for (let i = 0; i < pages.length; i++) {
      let j = i;
      while (j + 1 < pages.length && pages[j + 1] === pages[j] + 1) j++;
      out.push(j > i ? `${pages[i]} to ${pages[j]}` : String(pages[i]));
      i = j;
    }
    return out.length > 8 ? out.slice(0, 8).join(', ') + ` and ${out.length - 8} more` : out.join(', ');
  }
  const row = (label, value, extra, cls) => (value === '' || value == null ? '' : `<div class="meta-stat-item${cls ? ' ' + cls : ''}"><dt class="meta-stat-label">${esc(label)}</dt><dd class="meta-stat-val">${esc(value)}${extra ? `<span class="bytes">${esc(extra)}</span>` : ''}</dd></div>`);
  const groupHTML = (title, rows) => {
    const body = rows.filter(Boolean).join('');
    return body ? `<section class="fc-group"><h4 class="fc-group__title">${esc(title)}</h4><dl class="meta-stats">${body}</dl></section>` : '';
  };
  const ICON = { error: 'fa-circle-exclamation', warning: 'fa-triangle-exclamation', info: 'fa-circle-info' };
  const PRIVACY_ICON = { gps: 'fa-location-dot', device: 'fa-camera', thumbnail: 'fa-image', author: 'fa-user', company: 'fa-building' };

  function fileFacts(r) {
    const nameNote = r.extensionAgrees === false ? 'Does not match the name' : r.extensionAgrees === true ? 'Matches the name' : '';
    return groupHTML('File', [
      row('Real type', r.real.label, nameNote, r.extensionAgrees === false ? 'fc-risk' : ''),
      row('Name ends in', r.extension ? '.' + r.extension : 'No extension'),
      row('Your browser reports', r.browserType || 'No type', r.browserTypeAgrees === false ? 'Does not match the contents' : ''),
      row('Size', r.size.kbText, `${r.size.text} · ${r.size.mbText}`)
    ]);
  }

  function imageFacts(r) {
    const img = r.image;
    if (!img) return '';
    const exif = img.exif;
    const dpi = img.density;
    const w = img.width, h = img.height;
    const gps = exif && exif.gps;
    let gpsText = 'No';
    if (gps) gpsText = gps.latitude != null && gps.longitude != null ? `Yes: ${gps.latitude.toFixed(5)}, ${gps.longitude.toFixed(5)}` : 'Yes';
    else if (img.xmpGps) gpsText = 'Yes, in XMP data';
    const orientation = exif && exif.orientation ? Inspect.ORIENTATION[exif.orientation] : '';
    const camera = exif ? [exif.make, exif.model].filter(Boolean).join(' ') : '';
    const texts = (img.text || []).filter(t => t.value).slice(0, 3).map(t => `${t.keyword}: ${t.value}`).join('; ');
    return groupHTML('Image', [
      w ? row('Pixel size', `${group(w)} × ${group(h)} px`, `${(w * h / 1e6).toFixed(2)} megapixels`) : '',
      dpi && dpi.x ? row('DPI stored', dpi.x === dpi.y ? `${dpi.x} DPI` : `${dpi.x} × ${dpi.y} DPI`, `From ${dpi.source}. Prints at ${(w / dpi.x * 2.54).toFixed(1)} × ${(h / dpi.y * 2.54).toFixed(1)} cm`) : w ? row('DPI stored', 'None', 'Only matters for printing') : '',
      img.colour ? row('Colour', img.colour + (img.bitDepth && img.bitDepth !== 8 ? `, ${img.bitDepth}-bit` : '')) : '',
      w ? row('Transparency', img.alpha ? 'Yes' : 'No', img.alpha ? 'Some portals show transparent areas as black' : '') : '',
      w && r.key !== 'heic' ? row('Orientation', orientation || 'Not stored', orientation && exif.orientation > 1 ? 'Apps rotate the picture when they show it' : '') : '',
      row('Camera', camera),
      row('Date taken', fmtDate(exif && (exif.dateTimeOriginal || exif.dateTime))),
      row('Edited with', exif && exif.software),
      exif || r.real.kind === 'image' ? row('EXIF data', exif ? (img.orientationOnly ? 'Only the orientation' : `Yes, ${exif.tagCount} tags`) : 'None') : '',
      r.real.kind === 'image' ? row('GPS location', gpsText, gps || img.xmpGps ? 'Shows where the photo was taken' : '', gps || img.xmpGps ? 'fc-risk' : '') : '',
      row('Text in the file', texts),
      img.comments && img.comments.length ? row('Comment', img.comments.join('; ')) : '',
      r.real.kind === 'image' ? row('Other metadata', r.metadata.filter(m => !/^EXIF/.test(m)).join(', ') || 'None') : '',
      r.decodes != null ? row('Opens in this browser', r.decodes ? 'Yes' : 'No', r.decodes ? '' : 'The file may be damaged', r.decodes ? '' : 'fc-risk') : ''
    ]);
  }

  function pdfFacts(r) {
    const p = r.pdf;
    if (!p) return '';
    const m = p.metadata || {};
    const sizes = (p.sizeGroups || []).slice(0, 6).map(g => {
      const name = g.paper ? `${g.paper} ${g.orientations.join(' and ')}` : g.orientations.join(' and ');
      const label = p.sizeGroups.length > 1 ? `Page${g.pages.length === 1 ? '' : 's'} ${ranges(g.pages)}` : 'Page size';
      return row(label, `${g.widthMm} × ${g.heightMm} mm`, `${g.widthIn} × ${g.heightIn} in${name ? ' · ' + name : ''}`, p.sizeGroups.length > 1 ? 'fc-warn' : '');
    });
    if ((p.sizeGroups || []).length > 6) sizes.push(row('Other sizes', `${p.sizeGroups.length - 6} more`));
    return groupHTML('PDF', [
      row('PDF version', p.catalogVersion ? `${p.catalogVersion} (header says ${p.version})` : p.version || 'Unknown'),
      row('Pages', p.pages ? group(p.pages) : 'Could not be counted'),
      ...sizes,
      row('Encrypted', p.needsPassword ? 'Yes, needs a password to open' : p.encrypted ? 'Yes, opens without a password' : 'No', '', p.encrypted ? 'fc-warn' : ''),
      row('Title', m.title), row('Author', m.author, '', m.author ? 'fc-warn' : ''), row('Subject', m.subject), row('Keywords', m.keywords),
      row('Created with', m.creator), row('PDF made by', m.producer), row('Created', fmtDate(m.created)), row('Modified', fmtDate(m.modified)),
      p.needsPassword ? row('Document information', 'Not readable without the password') : '',
      p.forms ? row('Form fields', 'Yes, it has fillable fields') : '',
      p.updates > 0 ? row('Saved again after creation', `${p.updates} time${p.updates === 1 ? '' : 's'}`, 'Earlier versions may still be inside the file') : ''
    ]);
  }

  function officeFacts(r) {
    const o = r.office;
    if (!o) return '';
    const p = o.properties || {}, a = o.app || {};
    const isZip = o.key === 'zip';
    return groupHTML(isZip ? 'ZIP archive' : 'Document properties', [
      isZip ? row('Files inside', group(o.files), `${Inspect.sizes(o.uncompressed).kbText} unpacked`) : '',
      row('Title', p.title), row('Subject', p.subject), row('Author', p.creator, '', p.creator ? 'fc-warn' : ''), row('Last saved by', p.lastModifiedBy, '', p.lastModifiedBy ? 'fc-warn' : ''),
      row('Created', fmtDate(p.created)), row('Modified', fmtDate(p.modified)), row('Last printed', fmtDate(p.lastPrinted)),
      row('Pages', a.pages, a.pages ? 'As last saved; it can differ on another computer' : ''), row('Words', a.words ? group(a.words) : ''), row('Slides', a.slides),
      row('Made with', [a.application, a.appVersion].filter(Boolean).join(' ')), row('Company', a.company, '', a.company ? 'fc-warn' : ''), row('Template', a.template), row('Revision', p.revision),
      !isZip && !Object.keys(p).length && !Object.keys(a).length && !o.propertiesError ? row('Properties', 'None stored') : ''
    ]);
  }

  function noticesHTML(r) {
    const out = [];
    r.warnings.filter(w => w.level === 'error').forEach(w => out.push(`<div class="notice notice--error"><i class="fa-solid ${ICON.error}" aria-hidden="true"></i><div class="notice__body"><strong>Problem:</strong> ${esc(w.text)}</div></div>`));
    r.privacy.forEach(p => out.push(`<div class="notice notice--warning fc-privacy"><i class="fa-solid ${PRIVACY_ICON[p.kind] || 'fa-user-shield'}" aria-hidden="true"></i><div class="notice__body"><strong>Privacy:</strong> ${esc(p.text)}</div></div>`));
    r.warnings.filter(w => w.level === 'warning').forEach(w => out.push(`<div class="notice notice--warning"><i class="fa-solid ${ICON.warning}" aria-hidden="true"></i><div class="notice__body"><strong>Check:</strong> ${esc(w.text)}</div></div>`));
    r.warnings.filter(w => w.level === 'info').forEach(w => out.push(`<div class="notice notice--info"><i class="fa-solid ${ICON.info}" aria-hidden="true"></i><div class="notice__body">${esc(w.text)}</div></div>`));
    return out.join('');
  }

  function requirementHTML(r, check) {
    if (!check || !check.rows.length) return '';
    const word = x => (x.pass === true ? '<span class="fc-result fc-result--pass"><i class="fa-solid fa-check" aria-hidden="true"></i> Meets it</span>' : x.pass === false ? '<span class="fc-result fc-result--fail"><i class="fa-solid fa-xmark" aria-hidden="true"></i> Does not</span>' : '<span class="fc-result">Not applicable</span>');
    return `<table class="check-table fc-check">
      <caption class="fc-check__caption">Against the requirement</caption>
      <thead><tr><th scope="col">Rule</th><th scope="col">Required</th><th scope="col">This file</th><th scope="col">Result</th></tr></thead>
      <tbody>${check.rows.map(x => `<tr><th scope="row">${esc(x.label)}</th><td data-label="Required">${esc(x.required)}</td><td data-label="This file">${esc(x.actual)}${x.bytes ? `<span class="bytes">${esc(x.bytes)}</span>` : ''}</td><td data-label="Result">${word(x)}</td></tr>`).join('')}</tbody>
    </table>`;
  }

  function cleanHTML(item, r, res) {
    const c = res.cleaned;
    if (c) {
      const removed = c.removed.map(x => `${x.what} (${x.bytes < 1024 ? Inspect.group(x.bytes) + " bytes" : Inspect.sizes(x.bytes).kbText})`).join(', ');
      return `<div class="fc-clean fc-clean--done">
        <div class="verdict"><i class="fa-solid fa-check" aria-hidden="true"></i><div>
          <h4 class="fc-clean__title">Metadata removed</h4>
          <p class="fc-clean__text">Removed: ${esc(removed)}.${c.orientation ? ' The orientation setting was kept so the photo still appears upright.' : ''}</p>
          <p class="fc-clean__text">Checked again: no metadata left, ${esc(group(c.check.image.width))} × ${esc(group(c.check.image.height))} px as before, ${esc(c.pixels)}. New size ${esc(Inspect.sizes(c.size).kbText)} (was ${esc(r.size.kbText)}).</p>
        </div></div>
        <button type="button" class="btn btn-primary" data-action="download"><i class="fa-solid fa-download" aria-hidden="true"></i> Download cleaned copy</button>
      </div>`;
    }
    const err = res.cleanError ? `<div class="notice notice--error" role="alert"><i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i><div class="notice__body">${esc(res.cleanError)}</div></div>` : '';
    if (r.canStrip) {
      return `<div class="fc-clean">${err}
        <button type="button" class="btn" data-action="clean"${res.cleaning ? ' disabled aria-busy="true"' : ''}><i class="fa-solid fa-eraser" aria-hidden="true"></i> ${res.cleaning ? 'Removing metadata…' : 'Remove metadata'}</button>
        <p class="field-hint">Makes a copy without EXIF, GPS location, comments and other hidden details. The picture is not compressed again, so quality stays the same.</p>
      </div>`;
    }
    if ((r.pdf || (r.office && r.office.key !== 'zip')) && r.metadata.length) {
      return `<div class="fc-clean"><p class="field-hint">PDF and Office files are only inspected here, not changed. To remove these details, export a fresh copy from the program that made the file; <a href="#howHeading">see how</a>.</p></div>`;
    }
    if (r.real.kind === 'image' && r.metadata.length && !r.canStrip && !r.damaged) {
      return `<div class="fc-clean"><p class="field-hint">Metadata can be removed from JPEG and PNG files here. To remove it from this ${esc(r.real.label)}, save it as JPEG with the <a href="image-resizer.html">image resizer</a>; saving a new file leaves the metadata behind.</p></div>`;
    }
    return err;
  }

  function subtitle(r) {
    const parts = [r.real.label, r.size.kbText];
    if (r.image && r.image.width) parts.push(`${group(r.image.width)} × ${group(r.image.height)} px`);
    if (r.pdf && r.pdf.pages) parts.push(`${group(r.pdf.pages)} page${r.pdf.pages === 1 ? '' : 's'}`);
    return parts.join(' · ');
  }

  const thumbIcon = r => {
    const k = r ? r.real.kind : '';
    return k === 'pdf' ? 'fa-file-pdf' : k === 'image' || k === 'heic' || k === 'tiff' ? 'fa-file-image' : k === 'zip' && r.key !== 'zip' ? 'fa-file-word' : k === 'zip' ? 'fa-file-zipper' : k === 'text' ? 'fa-file-lines' : 'fa-file';
  };

  /* ---------------------------------------------------------------- rendering */
  const nodes = new Map();
  function renderItem(item) {
    let li = nodes.get(item.id);
    if (!li) {
      li = document.createElement('li');
      li.className = 'fc-item';
      li.dataset.id = item.id;
      nodes.set(item.id, li);
    }
    li.dataset.status = item.status;
    const res = item.result;
    const r = res && res.report;
    const nameId = `fcName-${item.id}`;
    const removeBtn = `<button type="button" class="btn btn-ghost btn-icon btn-sm" data-action="remove" aria-label="Remove ${esc(item.name)} from the list" title="Remove from the list"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>`;
    if (item.status !== 'done' || !r) {
      const status = { queued: ['fa-clock', 'Waiting'], processing: ['fa-spinner fa-spin', 'Checking…'], error: ['fa-circle-exclamation', 'Could not be checked'], cancelled: ['fa-circle-pause', 'Not checked'] }[item.status] || ['fa-clock', ''];
      li.innerHTML = `<article class="fc-card" aria-labelledby="${nameId}">
        <header class="fc-card__head">
          <span class="file-row__thumb" aria-hidden="true"><i class="fa-solid fa-file"></i></span>
          <div class="fc-card__title"><h3 class="fc-card__name" id="${nameId}">${esc(item.name)}</h3><p class="fc-card__sub">${esc(Inspect.sizes(item.size).kbText)}</p></div>
          <span class="file-status"><i class="fa-solid ${status[0]}" aria-hidden="true"></i> ${status[1]}</span>
          ${removeBtn}
        </header>
        ${item.status === 'error' ? `<div class="fc-card__body"><div class="notice notice--error"><i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i><div class="notice__body">${esc(item.error)}</div></div><div><button type="button" class="btn btn-sm" data-action="retry"><i class="fa-solid fa-rotate-right" aria-hidden="true"></i> Check again</button></div></div>` : ''}
        ${item.status === 'cancelled' ? `<div class="fc-card__body"><div><button type="button" class="btn btn-sm" data-action="retry"><i class="fa-solid fa-rotate-right" aria-hidden="true"></i> Check again</button></div></div>` : ''}
      </article>`;
      return li;
    }
    const check = requirement.req && requirement.rules ? Inspect.checkRequirements(r, requirement.req) : null;
    item.meta.pass = check ? check.pass : null;
    const verdict = check ? (check.pass ? '<span class="badge fc-badge fc-badge--pass"><i class="fa-solid fa-check" aria-hidden="true"></i> Meets the requirement</span>' : '<span class="badge fc-badge fc-badge--fail"><i class="fa-solid fa-xmark" aria-hidden="true"></i> Does not meet it</span>') : '';
    const thumb = res.thumb ? `<img src="${esc(res.thumb)}" alt="">` : `<i class="fa-solid ${thumbIcon(r)}"></i>`;
    li.innerHTML = `<article class="fc-card" aria-labelledby="${nameId}">
      <header class="fc-card__head">
        <span class="file-row__thumb" aria-hidden="true">${thumb}</span>
        <div class="fc-card__title"><h3 class="fc-card__name" id="${nameId}" tabindex="-1">${esc(item.name)}</h3><p class="fc-card__sub">${esc(subtitle(r))}</p></div>
        ${verdict}
        ${removeBtn}
      </header>
      <div class="fc-card__body">
        ${noticesHTML(r)}
        ${requirementHTML(r, check)}
        <div class="fc-facts">${fileFacts(r)}${imageFacts(r)}${pdfFacts(r)}${officeFacts(r)}</div>
        ${cleanHTML(item, r, res)}
      </div>
    </article>`;
    return li;
  }

  function syncList() {
    const items = queue.items;
    const ids = new Set(items.map(i => i.id));
    for (const [id, li] of nodes) if (!ids.has(id)) { li.remove(); nodes.delete(id); }
    items.forEach((item, i) => {
      // Cancel and retry change many items at once with a single change event: re-render any whose status moved.
      let li = nodes.get(item.id);
      if (!li || li.dataset.status !== item.status) li = renderItem(item);
      if (els.list.children[i] !== li) els.list.insertBefore(li, els.list.children[i] || null);
    });
  }

  function updateBar() {
    const s = queue.summary();
    const items = queue.items;
    els.bar.hidden = s.total === 0;
    const done = s.done;
    let text = `<strong>${s.total}</strong> file${s.total === 1 ? '' : 's'}`;
    if (s.running && (s.queued || s.processing)) text = `Checking <strong>${Math.min(s.total, done + s.error + s.cancelled + 1)}</strong> of ${s.total}…`;
    else {
      const parts = [];
      if (done) parts.push(`${done} checked`);
      if (s.error) parts.push(`${s.error} could not be checked`);
      if (s.cancelled) parts.push(`${s.cancelled} not checked`);
      if (requirement.req && requirement.rules) {
        const pass = items.filter(i => i.status === 'done' && i.meta.pass === true).length;
        const fail = items.filter(i => i.status === 'done' && i.meta.pass === false).length;
        parts.push(`${pass} meet${pass === 1 ? 's' : ''} the requirement, ${fail} ${fail === 1 ? 'does' : 'do'} not`);
      }
      if (parts.length) text += ': ' + parts.join(', ');
    }
    els.counts.innerHTML = text;
    els.cancel.hidden = !(s.running && (s.queued || s.processing));
    const cleaned = items.filter(i => i.result && i.result.cleaned && i.result.cleaned.blob);
    els.zip.hidden = cleaned.length < 2;
    const showProgress = s.running && s.total > 1;
    els.progress.hidden = !showProgress;
    if (showProgress) {
      const pct = Math.round(s.progress * 100);
      els.progressBar.style.width = pct + '%';
      els.progressBar.parentElement.setAttribute('aria-valuenow', String(pct));
      els.progressText.textContent = `${done + s.error + s.cancelled} of ${s.total} files checked`;
    }
  }

  queue.on(event => {
    if (event.type === 'item') renderItem(event.item);
    if (event.type === 'change') { syncList(); updateBar(); }
    if (event.type === 'idle') {
      const items = queue.items;
      const done = items.filter(i => i.status === 'done');
      const issues = done.filter(i => i.result.report.warnings.some(w => w.level !== 'info') || i.result.report.privacy.length).length;
      if (done.length) Kit.announce(`Checked ${done.length} file${done.length === 1 ? '' : 's'}.${issues ? ` ${issues} ${issues === 1 ? 'has' : 'have'} something to look at.` : ' No problems found.'}`);
    }
  });

  function addFiles(files) {
    showError([]);
    const { added, skipped } = queue.add(files);
    if (skipped) showError(`Only ${MAX_FILES} files can be in the list at once, so ${skipped} ${skipped === 1 ? 'was' : 'were'} not added. Remove some files, then add the rest.`);
    if (added.length && !queue.running) queue.start();
  }

  Kit.dropzone(app, {
    validate: false, multiple: true, maxFiles: 1000, // the queue enforces the 50-file list limit and says how many were left out
    onFiles: addFiles,
    onReject: messages => showError(messages)
  });
  const input = $('fcDropInput');
  els.add.addEventListener('click', () => { input.value = ''; input.click(); });
  els.cancel.addEventListener('click', () => { queue.cancel(); Kit.announce('Checking stopped.'); });
  els.clear.addEventListener('click', async () => {
    const unsaved = queue.items.some(i => i.result && i.result.cleaned && !i.result.cleaned.downloaded);
    if (unsaved && ui().confirm) {
      const okay = await ui().confirm({ title: 'Clear the list?', message: 'Some cleaned copies have not been downloaded. Clearing the list removes them from this page. Your original files are not affected.', confirmLabel: 'Clear the list', danger: true });
      if (!okay) return;
    }
    queue.clear();
    showError([]);
    Kit.announce('The list is empty.');
    const browse = app.querySelector('[data-browse]');
    if (browse) browse.focus();
  });
  els.zip.addEventListener('click', () => {
    const entries = queue.items.filter(i => i.result && i.result.cleaned && i.result.cleaned.blob).map(i => ({ name: i.result.cleaned.name, data: i.result.cleaned.blob }));
    Kit.downloadZip(entries, 'cleaned-files.zip', { button: els.zip }).then(okay => { if (okay) queue.items.forEach(i => { if (i.result && i.result.cleaned) i.result.cleaned.downloaded = true; }); });
  });
  Kit.guardUnload(() => queue.items.some(i => i.result && i.result.cleaned && !i.result.cleaned.downloaded));

  /* ---------------------------------------------------------------- card actions */
  els.list.addEventListener('click', e => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const li = btn.closest('.fc-item');
    const item = queue.items.find(i => i.id === li.dataset.id);
    if (!item) return;
    const action = btn.dataset.action;
    if (action === 'remove') {
      const next = li.nextElementSibling || li.previousElementSibling;
      queue.remove(item.id);
      Kit.announce(`${item.name} removed from the list.`);
      const target = next && next.querySelector('.fc-card__name[tabindex], [data-action="remove"]');
      (target || app.querySelector('[data-browse]')).focus();
    } else if (action === 'retry') {
      queue.retry(item.id);
      if (!queue.running) queue.start();
    } else if (action === 'clean') clean(item, btn);
    else if (action === 'download') {
      const c = item.result.cleaned;
      Files.download(c.blob, c.name);
      c.downloaded = true;
      Kit.announce(`Downloading ${c.name}.`);
    }
  });

  /** Decode two images the same way and compare their pixels. Large pictures are compared at 2,048 px. */
  async function samePixels(a, b, width, height) {
    const full = width * height <= 8e6;
    const scale = full ? 1 : Math.min(1, 2048 / Math.max(width, height));
    const opts = full ? {} : { resizeWidth: Math.max(1, Math.round(width * scale)), resizeHeight: Math.max(1, Math.round(height * scale)), resizeQuality: 'high' };
    const read = async blob => {
      const bmp = await createImageBitmap(blob, opts);
      const canvas = document.createElement('canvas');
      canvas.width = bmp.width; canvas.height = bmp.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(bmp, 0, 0);
      if (bmp.close) bmp.close();
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      canvas.width = 0; canvas.height = 0;
      return data;
    };
    const x = await read(a);
    const y = await read(b);
    if (x.length !== y.length) return { same: false };
    for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return { same: false };
    return { same: true, full };
  }

  async function clean(item, btn) {
    const res = item.result;
    const r = res.report;
    if (res.cleaning) return;
    res.cleaning = true; // a re-render (requirement change) keeps the button busy, see cleanHTML
    Kit.setButtonBusy(btn, true, 'Removing metadata…');
    res.cleanError = '';
    try {
      const bytes = new Uint8Array(await item.file.arrayBuffer());
      const out = Inspect.stripMetadata(bytes, r.key);
      const mime = r.key === 'png' ? 'image/png' : 'image/jpeg';
      const blob = new Blob([out.bytes], { type: mime });
      const check = await Inspect.inspect(out.bytes, { name: item.name, type: mime });
      if (check.damaged || !check.image || check.image.width !== r.image.width || check.image.height !== r.image.height) throw new Error('The cleaned copy did not read back correctly, so it is not offered. Your original file is unchanged.');
      if (check.metadata.length || check.privacy.length) throw new Error('Some metadata was still found in the cleaned copy, so it is not offered.');
      let pixels;
      try {
        const cmp = await samePixels(item.file, blob, r.image.width, r.image.height);
        if (!cmp.same) throw new Error('The pixels of the cleaned copy differ from the original, so it is not offered. Your original file is unchanged.');
        pixels = cmp.full ? 'pixels identical to the original' : 'pixels identical to the original (compared at 2,048 px)';
      } catch (e) {
        if (/differ/.test(e.message)) throw e;
        throw new Error('This browser could not open the cleaned copy to compare it, so it is not offered.');
      }
      if (!nodes.has(item.id)) return; // removed from the list while it was being cleaned
      const ext = r.key === 'png' ? 'png' : 'jpg';
      res.cleaned = { blob, size: blob.size, removed: out.removed, orientation: out.orientation, check, pixels, name: Files.withExtension(`${Files.stem(item.name)}-clean`, ext), downloaded: false };
      renderItem(item);
      updateBar();
      Kit.announce(`Metadata removed from ${item.name}. The cleaned copy is ready to download.`);
      const dl = nodes.get(item.id).querySelector('[data-action="download"]');
      if (dl) dl.focus();
    } catch (e) {
      if (!nodes.has(item.id)) return;
      res.cleanError = (e && e.message) || 'The metadata could not be removed. Your original file is unchanged.';
      renderItem(item);
      const again = nodes.get(item.id).querySelector('[data-action="clean"]');
      if (again) again.focus();
      Kit.announce(res.cleanError);
    } finally {
      res.cleaning = false;
    }
  }

  requirementChanged();
})();
