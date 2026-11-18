/* ApplyReady PDF kit: the processing side of every PDF tool.

   Two vendored libraries do the work, and both load only when a PDF tool first needs them:
   - pdf-lib (@cantoo/pdf-lib, js/vendor/pdf-lib.min.js) changes the structure of a document:
     merge, split, reorder, rotate, page numbers, watermarks, images as pages. It also opens
     password-protected files when it is given the password.
   - pdf.js (js/vendor/pdfjs/) draws pages (thumbnails, previews, PDF to image, compression) and
     reads their text. It runs in its own worker, loaded through js/lib/pdf-kit-boot.js, a tiny
     module script, so this file stays readable by browsers that cannot run pdf.js and can say so.

   Every function takes and returns plain values (Uint8Array, PDFDocument, canvas, string); the
   tool scripts own the interface. Everything happens in this browser tab: the file, its pages and
   any password stay on the device.

   Indexes are 0-based everywhere in this API (page 1 is index 0).
   Works in Node for tests (pdf-lib parts only): require('js/lib/pdf-kit.js'). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(root, true);
  else root.ApplyReadyPdf = factory(root, false);
})(typeof self !== 'undefined' ? self : this, function (root, isNode) {
  'use strict';

  const MB = 1024 * 1024;
  const LIMITS = {
    fileBytes: 100 * MB,      // one PDF
    totalBytes: 500 * MB,     // all files in one job (merge)
    maxFiles: 50,             // files in one merge
    renderPages: 500,         // pages drawn in one job (PDF to image)
    compressPages: 300,       // pages rasterised by the compressor
    textPages: 3000,          // pages read for text
    thumbPages: 1500,         // pages shown as thumbnails
    outputs: 500,             // files produced by one split
    // iOS Safari refuses canvases over 16.7 million pixels; staying under it works everywhere.
    canvasPixels: 16000000
  };

  /* ------------------------------------------------------------------ Errors */
  // code: damaged | encrypted | password | empty | notpdf | toolarge | unsupported | verify | cancelled | font
  class PdfError extends Error {
    constructor(code, message, detail) { super(message); this.name = 'PdfError'; this.code = code; this.detail = detail; }
  }
  const abortError = () => (typeof DOMException === 'function' ? new DOMException('Cancelled', 'AbortError') : Object.assign(new Error('Cancelled'), { name: 'AbortError' }));
  const isAbort = e => !!e && (e.name === 'AbortError' || e.name === 'RenderingCancelledException' || e.code === 'cancelled');
  function throwIfAborted(signal) { if (signal && signal.aborted) throw abortError(); }
  // Let the browser paint and handle input between heavy steps.
  const tick = () => new Promise(r => setTimeout(r, 0));

  /* ------------------------------------------------------------------ Loading */
  // The site root, from where this script was loaded, so the vendored files resolve the same
  // way on applyready.in, on a test server and in a sub-folder.
  const SITE_ROOT = (() => {
    if (isNode || typeof document === 'undefined') return '/';
    const s = document.currentScript || document.querySelector('script[src*="js/lib/pdf-kit.js"]');
    try { return s ? new URL('../../', s.src).href : new URL('/', location.href).href; } catch (e) { return '/'; }
  })();
  const asset = p => SITE_ROOT + p;

  /** What this browser lacks for the PDF tools. { ok, render, missing: [names] } */
  function support() {
    if (isNode) return { ok: true, render: false, missing: [] };
    const missing = [];
    if (typeof Promise === 'undefined') missing.push('Promise');
    if (typeof Blob === 'undefined' || !Blob.prototype.arrayBuffer) missing.push('Blob.arrayBuffer');
    if (typeof URL === 'undefined' || !URL.createObjectURL) missing.push('URL.createObjectURL');
    if (typeof TextDecoder === 'undefined') missing.push('TextDecoder');
    if (typeof Uint8Array === 'undefined') missing.push('Uint8Array');
    const canvas = document.createElement('canvas');
    if (!canvas.getContext || !canvas.toBlob) missing.push('canvas.toBlob');
    const modules = typeof HTMLScriptElement !== 'undefined' && 'noModule' in HTMLScriptElement.prototype;
    const render = modules && typeof Worker !== 'undefined' && !missing.length;
    return { ok: !missing.length, render, missing: modules ? missing : missing.concat('JavaScript modules') };
  }

  function injectScript(src, type) {
    return new Promise((resolve, reject) => {
      const el = document.createElement('script');
      if (type) el.type = type;
      el.src = src;
      el.onload = () => resolve();
      el.onerror = () => reject(new PdfError('unsupported', 'A part of the PDF tool could not load. Check your connection and reload the page.'));
      document.head.appendChild(el);
    });
  }

  let libPromise = null;
  /** pdf-lib, loaded once. */
  function lib() {
    if (isNode) return Promise.resolve(require('../vendor/pdf-lib.min.js'));
    if (root.PDFLib) return Promise.resolve(root.PDFLib);
    if (!libPromise) {
      libPromise = injectScript(asset('js/vendor/pdf-lib.min.js')).then(() => {
        if (!root.PDFLib) throw new PdfError('unsupported', 'This browser could not start the PDF library. Update the browser, or try a recent Chrome, Edge, Firefox or Safari.');
        return root.PDFLib;
      }).catch(e => { libPromise = null; throw e; });
    }
    return libPromise;
  }

  let jsPromise = null;
  /** pdf.js, loaded once, with its worker and same-origin asset folders configured. */
  function pdfjs() {
    if (isNode) return Promise.reject(new PdfError('unsupported', 'pdf.js is not available in Node.'));
    if (!jsPromise) {
      jsPromise = new Promise((resolve, reject) => {
        if (!support().render) {
          reject(new PdfError('unsupported', 'This browser cannot draw PDF pages. Update it, or use a recent Chrome, Edge, Firefox or Safari.'));
          return;
        }
        if (root.__arPdfjs) { resolve(root.__arPdfjs); return; }
        let settled = false;
        const done = (fn, v) => { if (!settled) { settled = true; root.removeEventListener('applyready:pdfjs', onReady); clearTimeout(timer); fn(v); } };
        const onReady = () => root.__arPdfjs ? done(resolve, root.__arPdfjs) : done(reject, new PdfError('unsupported', 'The PDF reader did not start in this browser. Update it, or use a recent Chrome, Edge, Firefox or Safari.'));
        root.addEventListener('applyready:pdfjs', onReady);
        // A browser that cannot parse pdf.js reports the module as failed, or never runs it.
        const timer = setTimeout(() => done(reject, new PdfError('unsupported', 'The PDF reader took too long to start. Reload the page and try again; if it keeps happening, update your browser.')), 30000);
        injectScript(asset('js/lib/pdf-kit-boot.js'), 'module').catch(() => done(reject, new PdfError('unsupported', 'The PDF reader could not load in this browser. Update it, or use a recent Chrome, Edge, Firefox or Safari.')));
      }).then(lib => {
        lib.GlobalWorkerOptions.workerSrc = asset('js/vendor/pdfjs/pdf.worker.min.mjs');
        return lib;
      }).catch(e => { jsPromise = null; throw e; });
    }
    return jsPromise;
  }

  /* ------------------------------------------------------------------ Reading */
  async function readBytes(file) {
    if (file instanceof Uint8Array) return file;
    if (file instanceof ArrayBuffer) return new Uint8Array(file);
    try { return new Uint8Array(await file.arrayBuffer()); }
    catch (e) { throw new PdfError('damaged', `${file && file.name ? file.name : 'The file'} could not be read. It may have been moved or deleted; choose it again.`); }
  }

  function hasHeader(bytes) {
    const n = Math.min(bytes.length, 1024);
    for (let i = 0; i + 4 < n; i++) if (bytes[i] === 0x25 && bytes[i + 1] === 0x50 && bytes[i + 2] === 0x44 && bytes[i + 3] === 0x46 && bytes[i + 4] === 0x2D) return true;
    return false;
  }

  const DAMAGED = 'is damaged or incomplete, so it cannot be opened. Open it on your device to check it, or download or export it again.';
  const TRUNCATED = 'seems to be incomplete: the end of the file is missing, which usually means a download or copy did not finish. Download or copy it again, then try once more.';

  /** A PDF ends with "%%EOF" (sometimes followed by a little padding). Without it, pages may be missing. */
  function looksTruncated(bytes) {
    const tail = bytes.subarray(Math.max(0, bytes.length - 4096));
    let s = '';
    for (let i = 0; i < tail.length; i++) s += String.fromCharCode(tail[i]);
    return s.indexOf('%%EOF') < 0 && s.indexOf('startxref') < 0;
  }

  /** The checks every PDF gets before a library sees it. Throws PdfError empty / notpdf / damaged. */
  function precheck(bytes, name) {
    const label = name || 'This PDF';
    if (!bytes || !bytes.length) throw new PdfError('empty', `${label} is empty (0 bytes).`);
    if (!hasHeader(bytes)) throw new PdfError('notpdf', `${label} is not a PDF file. Choose a PDF.`);
    if (looksTruncated(bytes)) throw new PdfError('damaged', `${label} ${TRUNCATED}`);
  }

  /**
   * A first look at a PDF: page count and whether it is password protected.
   * Encrypted files report their page count without a password (the page tree is not encrypted).
   * Throws PdfError damaged / empty / notpdf.
   */
  async function inspect(bytes, name) {
    const label = name || 'This PDF';
    precheck(bytes, name);
    const P = await lib();
    let doc;
    try { doc = await P.PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false, throwOnInvalidObject: false }); }
    catch (e) { throw new PdfError('damaged', `${label} ${DAMAGED}`, e && e.message); }
    let pageCount = 0;
    try { pageCount = doc.getPageCount(); } catch (e) { throw new PdfError('damaged', `${label} ${DAMAGED}`, e && e.message); }
    if (!pageCount) throw new PdfError('damaged', `${label} has no pages that can be read. ${DAMAGED.replace(/^is damaged or incomplete, so it cannot be opened\. /, '')}`);
    return { pageCount, encrypted: !!doc.isEncrypted };
  }

  /**
   * Open with pdf-lib for changing the structure. With a password, an encrypted file is decrypted
   * in memory; what the tools save is not password protected.
   * Throws PdfError encrypted (password needed), password (wrong password), damaged.
   */
  async function openLib(bytes, options) {
    const o = options || {};
    const P = await lib();
    const label = o.name || 'This PDF';
    try {
      const doc = await P.PDFDocument.load(bytes, { password: typeof o.password === 'string' ? o.password : undefined, updateMetadata: false, throwOnInvalidObject: false });
      // Opened with its password, the document is decrypted in memory. Drop the encryption
      // dictionary too, or a saved copy would claim to be encrypted while it is not.
      // The old cross-reference streams stay in memory as objects and still name it, so they go as well.
      if (typeof o.password === 'string') dropEncryption(P, doc);
      return doc;
    } catch (e) {
      const msg = String(e && e.message || '');
      if (/is encrypted/i.test(msg)) throw new PdfError('encrypted', `${label} is protected with a password.`);
      if (/password/i.test(msg)) throw new PdfError('password', 'That password is not right. Check it and try again; passwords are case sensitive.');
      throw new PdfError('damaged', `${label} ${DAMAGED}`, msg);
    }
  }

  function dropEncryption(P, doc) {
    const ctx = doc.context;
    const refs = new Set();
    if (ctx.trailerInfo && ctx.trailerInfo.Encrypt) { if (ctx.trailerInfo.Encrypt instanceof P.PDFRef) refs.add(ctx.trailerInfo.Encrypt); delete ctx.trailerInfo.Encrypt; }
    const TYPE = P.PDFName.of('Type'), XREF = P.PDFName.of('XRef'), ENCRYPT = P.PDFName.of('Encrypt');
    const FILTER = P.PDFName.of('Filter'), STANDARD = P.PDFName.of('Standard'), O = P.PDFName.of('O'), U = P.PDFName.of('U');
    for (const [ref, obj] of ctx.enumerateIndirectObjects()) {
      if (obj instanceof P.PDFInvalidObject) {
        // An old cross-reference stream that could not be read as an object once decrypted.
        const raw = obj.data instanceof Uint8Array ? String.fromCharCode.apply(null, Array.from(obj.data.subarray(0, 2048))) : '';
        if (/\/Type\s*\/XRef/.test(raw)) ctx.delete(ref);
        continue;
      }
      const dict = obj instanceof P.PDFDict ? obj : obj && obj.dict instanceof P.PDFDict ? obj.dict : null;
      if (!dict) continue;
      if (dict.get(TYPE) === XREF) {
        const enc = dict.get(ENCRYPT);
        if (enc instanceof P.PDFRef) refs.add(enc);
        ctx.delete(ref);
      } else if (dict.get(FILTER) === STANDARD && dict.has(O) && dict.has(U)) {
        refs.add(ref); // the encryption dictionary itself
      }
    }
    refs.forEach(r => ctx.delete(r));
  }

  /** Open with pdf.js for drawing and text. The bytes are copied, so the caller keeps its own. */
  async function openJs(bytes, options) {
    const o = options || {};
    const lib = await pdfjs();
    const label = o.name || 'This PDF';
    const task = lib.getDocument({
      data: bytes.slice(),
      password: o.password || undefined,
      wasmUrl: asset('js/vendor/pdfjs/wasm/'),
      iccUrl: asset('js/vendor/pdfjs/iccs/'),
      standardFontDataUrl: asset('js/vendor/pdfjs/standard_fonts/'),
      cMapUrl: asset('js/vendor/pdfjs/cmaps/'),
      cMapPacked: true,
      enableXfa: false,
      stopAtErrors: false
    });
    try {
      return await task.promise;
    } catch (e) {
      if (e && e.name === 'PasswordException') {
        if (e.code === 2) throw new PdfError('password', 'That password is not right. Check it and try again; passwords are case sensitive.');
        throw new PdfError('encrypted', `${label} is protected with a password.`);
      }
      throw new PdfError('damaged', `${label} ${DAMAGED}`, e && e.message);
    }
  }

  async function closeJs(doc) { if (doc && doc.destroy) { try { await doc.destroy(); } catch (e) { /* already closed */ } } }

  /* ------------------------------------------------------------------ Saving and checking */
  async function save(doc) {
    doc.setProducer('ApplyReady (pdf-lib)');
    return doc.save({ useObjectStreams: true, addDefaultPage: false, updateFieldAppearances: false });
  }

  /**
   * Reopen a finished file and check it before it is offered: it must parse, have the expected
   * number of pages and, if given, the expected page sizes. Returns { pageCount }.
   */
  async function verify(bytes, expect) {
    const e = expect || {};
    const P = await lib();
    if (!bytes || !hasHeader(bytes)) throw new PdfError('verify', 'The finished file is not a valid PDF, so it was not offered. Try again; if it keeps happening, report it.');
    let doc;
    try { doc = await P.PDFDocument.load(bytes, { updateMetadata: false }); }
    catch (err) { throw new PdfError('verify', 'The finished file could not be reopened, so it was not offered. Try again; if it keeps happening, report it.', err && err.message); }
    const pageCount = doc.getPageCount();
    if (typeof e.pages === 'number' && pageCount !== e.pages) throw new PdfError('verify', `The finished file has ${pageCount} pages instead of ${e.pages}, so it was not offered. Try again; if it keeps happening, report it.`);
    if (Array.isArray(e.sizes)) {
      const pages = doc.getPages();
      e.sizes.forEach((s, i) => {
        if (!s || !pages[i]) return;
        const box = pages[i].getMediaBox();
        if (Math.abs(box.width - s.width) > 1 || Math.abs(box.height - s.height) > 1) throw new PdfError('verify', `Page ${i + 1} of the finished file changed size, so it was not offered.`);
      });
    }
    return { pageCount };
  }

  /* ------------------------------------------------------------------ Page facts */
  const norm = deg => ((Math.round(deg / 90) * 90) % 360 + 360) % 360;

  /** Size of a page as it is seen (rotation applied), in points, and its rotation. */
  function pageFacts(page) {
    const box = page.getCropBox ? page.getCropBox() : page.getMediaBox();
    const rotation = norm(page.getRotation().angle || 0);
    const turned = rotation % 180 !== 0;
    return { width: turned ? box.height : box.width, height: turned ? box.width : box.height, rotation, box };
  }

  const PAPER = [['A4', 595.28, 841.89], ['Letter', 612, 792], ['Legal', 612, 1008], ['A3', 841.89, 1190.55], ['A5', 419.53, 595.28]];
  /** "A4 portrait", "Letter landscape" or "210 × 297 mm". */
  function paperName(w, h) {
    for (const [name, a, b] of PAPER) {
      if (Math.abs(w - a) < 3 && Math.abs(h - b) < 3) return `${name} portrait`;
      if (Math.abs(w - b) < 3 && Math.abs(h - a) < 3) return `${name} landscape`;
    }
    const mm = v => Math.round(v / 72 * 25.4);
    return `${mm(w)} × ${mm(h)} mm`;
  }

  /* ------------------------------------------------------------------ Page ranges */
  /**
   * Parse "1-3, 5, 8-10" against a page count. Also accepts "7-" (to the last page), "-3"
   * (from the first), "last" and "all". Returns { ok, ranges: [[from, to], ...] (1-based), pages
   * (0-based indexes, in order, may repeat), error }.
   */
  function parseRanges(text, pageCount) {
    const fail = error => ({ ok: false, ranges: [], pages: [], error });
    const src = String(text == null ? '' : text).trim();
    if (!src) return fail('Type the pages you want, for example 1-3, 5.');
    if (/^all$/i.test(src)) return { ok: true, ranges: [[1, pageCount]], pages: Array.from({ length: pageCount }, (_, i) => i), error: '' };
    const parts = src.split(/[,;]+/).map(s => s.trim()).filter(Boolean);
    if (!parts.length) return fail('Type the pages you want, for example 1-3, 5.');
    const ranges = [];
    const num = s => (/^last$|^end$/i.test(s) ? pageCount : /^\d+$/.test(s) ? parseInt(s, 10) : NaN);
    for (const part of parts) {
      const p = part.replace(/\s+/g, '').replace(/[–—−]/g, '-').replace(/to/i, '-');
      let m;
      if ((m = p.match(/^([0-9]+|last|end)$/i))) {
        const n = num(m[1]);
        ranges.push([n, n, part]);
      } else if ((m = p.match(/^([0-9]+|last|end)?-([0-9]+|last|end)?$/i)) && (m[1] || m[2])) {
        ranges.push([m[1] ? num(m[1]) : 1, m[2] ? num(m[2]) : pageCount, part]);
      } else {
        return fail(`"${part}" is not a page or a range. Use numbers and hyphens, for example 1-3, 5, 8-10.`);
      }
    }
    for (const [a, b, part] of ranges) {
      if (a < 1 || b < 1) return fail(`"${part}": page numbers start at 1.`);
      if (a > pageCount || b > pageCount) return fail(`"${part}": this PDF has ${pageCount} page${pageCount === 1 ? '' : 's'}, so the highest page number is ${pageCount}.`);
      if (a > b) return fail(`"${part}": the first number should be the smaller one, for example ${b}-${a}.`);
    }
    const clean = ranges.map(([a, b]) => [a, b]);
    const pages = [];
    clean.forEach(([a, b]) => { for (let i = a; i <= b; i++) pages.push(i - 1); });
    return { ok: true, ranges: clean, pages, error: '' };
  }

  /** "1-3, 5, 8-10" from a sorted list of 0-based page indexes. */
  function formatRanges(indexes) {
    const sorted = Array.from(new Set(indexes)).sort((a, b) => a - b);
    const out = [];
    for (let i = 0; i < sorted.length; i++) {
      const start = sorted[i];
      while (i + 1 < sorted.length && sorted[i + 1] === sorted[i] + 1) i++;
      out.push(start === sorted[i] ? `${start + 1}` : `${start + 1}-${sorted[i] + 1}`);
    }
    return out.join(', ');
  }

  /* ------------------------------------------------------------------ Standard fonts */
  // The 14 standard PDF fonts can only write the Windows-1252 (WinAnsi) character set. Text for
  // page numbers and watermarks is checked against it before anything is drawn.
  const WINANSI_EXTRA = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ';
  function winAnsiProblems(text) {
    const bad = [];
    for (const ch of String(text || '')) {
      const c = ch.codePointAt(0);
      const okChar = (c >= 0x20 && c <= 0x7E) || (c >= 0xA0 && c <= 0xFF) || WINANSI_EXTRA.includes(ch);
      if (!okChar && !bad.includes(ch)) bad.push(ch);
    }
    return bad;
  }

  /* ------------------------------------------------------------------ Structure operations */
  /** A new document from parts [{ doc, indexes? }] in order. Page sizes, rotation and content are kept. */
  async function merge(parts, onProgress, signal) {
    const P = await lib();
    const out = await P.PDFDocument.create();
    for (let i = 0; i < parts.length; i++) {
      throwIfAborted(signal);
      const part = parts[i];
      if (part.doc) {
        const idx = part.indexes || part.doc.getPageIndices();
        const pages = await out.copyPages(part.doc, idx);
        pages.forEach(p => out.addPage(p));
      } else if (part.image) {
        await addImagePage(out, part.image);
      }
      if (onProgress) onProgress(i + 1, parts.length);
      await tick();
    }
    return out;
  }

  /** A new document with the given pages of one document (0-based, any order, repeats allowed). */
  async function extract(doc, indexes) {
    const P = await lib();
    const out = await P.PDFDocument.create();
    const pages = await out.copyPages(doc, indexes);
    pages.forEach(p => out.addPage(p));
    return out;
  }

  /**
   * Organise: items [{ doc, index, turn }] in their new order. `turn` is the quarter turns to add
   * clockwise (90, -90, 180...), on top of any rotation the page already has.
   */
  async function assemble(items, onProgress, signal) {
    const P = await lib();
    const out = await P.PDFDocument.create();
    // Copy each source document's pages in one call, then add them in the chosen order.
    const bySource = new Map();
    items.forEach((it, i) => { if (!bySource.has(it.doc)) bySource.set(it.doc, []); bySource.get(it.doc).push(i); });
    const copied = new Array(items.length);
    let done = 0;
    for (const [doc, positions] of bySource) {
      throwIfAborted(signal);
      const pages = await out.copyPages(doc, positions.map(i => items[i].index));
      positions.forEach((pos, k) => { copied[pos] = pages[k]; });
      done += positions.length;
      if (onProgress) onProgress(done, items.length);
      await tick();
    }
    copied.forEach((page, i) => {
      const turn = items[i].turn || 0;
      if (turn) page.setRotation(P.degrees(norm((page.getRotation().angle || 0) + turn)));
      out.addPage(page);
    });
    return out;
  }

  /* Where a point on the page as seen (x right, y up, from its visible bottom-left corner) lies in the
     page's own coordinates, for a page shown with /Rotate. Returns the point and the extra angle text
     needs so it reads upright on screen. */
  function toPageSpace(facts, vx, vy) {
    const { box, rotation } = facts;
    const w = box.width, h = box.height;
    switch (rotation) {
      case 90: return { x: box.x + w - vy, y: box.y + vx, angle: 90 };
      case 180: return { x: box.x + w - vx, y: box.y + h - vy, angle: 180 };
      case 270: return { x: box.x + vy, y: box.y + h - vx, angle: 270 };
      default: return { x: box.x + vx, y: box.y + vy, angle: 0 };
    }
  }

  const COLORS = { black: [0, 0, 0], grey: [0.42, 0.42, 0.4], blue: [0.13, 0.2, 0.62], red: [0.72, 0.1, 0.1] };
  const rgbOf = async name => { const P = await lib(); const c = COLORS[name] || COLORS.black; return P.rgb(c[0], c[1], c[2]); };

  const NUMBER_FORMATS = {
    n: (n) => `${n}`,
    page: (n) => `Page ${n}`,
    'page-of': (n, t) => `Page ${n} of ${t}`,
    slash: (n, t) => `${n} / ${t}`
  };

  /** The label for page `i` (0-based) of `count`, or '' when it is not numbered. */
  function pageNumberLabel(i, count, opts) {
    const o = Object.assign({ format: 'n', start: 1, skipFirst: false }, opts);
    if (o.skipFirst && i === 0) return '';
    const numbered = o.skipFirst ? count - 1 : count;
    const n = o.start + (o.skipFirst ? i - 1 : i);
    const total = o.start + numbered - 1;
    return (NUMBER_FORMATS[o.format] || NUMBER_FORMATS.n)(n, total);
  }

  /**
   * Draw page numbers onto `doc` (changed in place).
   * opts: { position: 'bottom-center' | 'bottom-left' | 'bottom-right' | 'top-left' | 'top-center' | 'top-right',
   *         format: 'n' | 'page' | 'page-of' | 'slash', start, skipFirst, size, margin (points), color, pages (0-based subset) }
   */
  async function addPageNumbers(doc, options, onProgress, signal) {
    const P = await lib();
    const o = Object.assign({ position: 'bottom-center', format: 'n', start: 1, skipFirst: false, size: 11, margin: 28, color: 'black' }, options);
    const font = await doc.embedFont(P.StandardFonts.Helvetica);
    const color = await rgbOf(o.color);
    const pages = doc.getPages();
    const count = o.countOverride || pages.length;
    const only = o.pages ? new Set(o.pages) : null;
    const [vert, horiz] = o.position.split('-');
    for (let i = 0; i < pages.length; i++) {
      if (only && !only.has(i)) continue;
      throwIfAborted(signal);
      const label = pageNumberLabel(o.indexOffset ? i + o.indexOffset : i, count, o);
      if (!label) continue;
      const bad = winAnsiProblems(label);
      if (bad.length) throw new PdfError('font', `The characters ${bad.join(' ')} cannot be written with the standard PDF font.`);
      const facts = pageFacts(pages[i]);
      const tw = font.widthOfTextAtSize(label, o.size);
      const cap = font.heightAtSize(o.size, { descender: false });
      const margin = Math.min(o.margin, facts.width / 4, facts.height / 4);
      const vx = horiz === 'left' ? margin : horiz === 'right' ? facts.width - margin - tw : (facts.width - tw) / 2;
      const vy = vert === 'top' ? facts.height - margin - cap : margin;
      const at = toPageSpace(facts, vx, vy);
      pages[i].drawText(label, { x: at.x, y: at.y, size: o.size, font, color, rotate: P.degrees(at.angle) });
      if (onProgress && i % 20 === 0) { onProgress(i + 1, pages.length); await tick(); }
    }
    if (onProgress) onProgress(pages.length, pages.length);
    return doc;
  }

  /**
   * Stamp a text watermark on every page (changed in place).
   * opts: { text, size, opacity (0-1), angle (degrees, counter-clockwise as seen), color,
   *         layout: 'center' | 'top' | 'bottom' | 'tiled', pages (0-based subset) }
   */
  async function addWatermark(doc, options, onProgress, signal) {
    const P = await lib();
    const o = Object.assign({ text: 'Copy', size: 48, opacity: 0.25, angle: 45, color: 'grey', layout: 'center' }, options);
    const text = String(o.text).replace(/\s+/g, ' ').trim();
    if (!text) throw new PdfError('font', 'Type the watermark text.');
    const bad = winAnsiProblems(text);
    if (bad.length) throw new PdfError('font', `The characters ${bad.join(' ')} cannot be written with the standard PDF font.`);
    const font = await doc.embedFont(o.bold === false ? P.StandardFonts.Helvetica : P.StandardFonts.HelveticaBold);
    const color = await rgbOf(o.color);
    const pages = doc.getPages();
    const only = o.pages ? new Set(o.pages) : null;
    const tw = font.widthOfTextAtSize(text, o.size);
    const cap = font.heightAtSize(o.size, { descender: false });
    const rad = o.angle * Math.PI / 180;
    const cos = Math.cos(rad), sin = Math.sin(rad);
    // Start of the baseline so that the text's centre lands on (cx, cy) after rotation.
    const startFor = (cx, cy) => ({ x: cx - (tw / 2) * cos + (cap / 2) * sin, y: cy - (tw / 2) * sin - (cap / 2) * cos });
    for (let i = 0; i < pages.length; i++) {
      if (only && !only.has(i)) continue;
      throwIfAborted(signal);
      const facts = pageFacts(pages[i]);
      const W = facts.width, H = facts.height;
      const centres = [];
      if (o.layout === 'tiled') {
        const stepX = Math.max(tw * Math.abs(cos) + cap * Math.abs(sin), 40) + o.size * 1.6;
        const stepY = Math.max(tw * Math.abs(sin) + cap * Math.abs(cos), 40) + o.size * 1.6;
        let row = 0;
        for (let y = stepY / 2; y < H + stepY / 2 && centres.length < 400; y += stepY, row++) {
          for (let x = (row % 2 ? stepX : stepX / 2); x < W + stepX / 2 && centres.length < 400; x += stepX) centres.push([x, y]);
        }
      } else {
        const ext = (tw * Math.abs(sin) + cap * Math.abs(cos)) / 2;
        const pad = Math.max(24, H * 0.05);
        const cy = o.layout === 'top' ? H - pad - ext : o.layout === 'bottom' ? pad + ext : H / 2;
        centres.push([W / 2, cy]);
      }
      for (const [cx, cy] of centres) {
        const s = startFor(cx, cy);
        const at = toPageSpace(facts, s.x, s.y);
        pages[i].drawText(text, { x: at.x, y: at.y, size: o.size, font, color, opacity: o.opacity, rotate: P.degrees(o.angle + at.angle) });
      }
      if (onProgress && i % 10 === 0) { onProgress(i + 1, pages.length); await tick(); }
    }
    if (onProgress) onProgress(pages.length, pages.length);
    return doc;
  }

  /* ------------------------------------------------------------------ Images as pages */
  const A4 = [595.28, 841.89];

  /** EXIF orientation of a JPEG (1 when absent). */
  function jpegOrientation(bytes) {
    const b = bytes;
    if (b[0] !== 0xFF || b[1] !== 0xD8) return 1;
    let p = 2;
    while (p + 4 < b.length) {
      if (b[p] !== 0xFF) return 1;
      const marker = b[p + 1];
      const len = (b[p + 2] << 8) | b[p + 3];
      if (marker === 0xDA || marker === 0xD9) return 1;
      if (marker === 0xE1 && b[p + 4] === 0x45 && b[p + 5] === 0x78 && b[p + 6] === 0x69 && b[p + 7] === 0x66) {
        const t = p + 10;
        const le = b[t] === 0x49;
        const u16 = o => (le ? b[t + o] | (b[t + o + 1] << 8) : (b[t + o] << 8) | b[t + o + 1]);
        const u32 = o => (le ? (b[t + o] | (b[t + o + 1] << 8) | (b[t + o + 2] << 16) | (b[t + o + 3] << 24)) : ((b[t + o] << 24) | (b[t + o + 1] << 16) | (b[t + o + 2] << 8) | b[t + o + 3])) >>> 0;
        const ifd = u32(4);
        const n = u16(ifd);
        for (let i = 0; i < n; i++) {
          const e = ifd + 2 + i * 12;
          if (t + e + 10 > b.length) return 1;
          if (u16(e) === 0x0112) return u16(e + 8) || 1;
        }
        return 1;
      }
      p += 2 + len;
    }
    return 1;
  }

  /**
   * Add an image as an A4 page (portrait or landscape to suit the image), fitted and centred.
   * image: { bytes, type: 'jpg' | 'png' }.
   */
  async function addImagePage(doc, image) {
    const embedded = image.type === 'png' ? await doc.embedPng(image.bytes) : await doc.embedJpg(image.bytes);
    const landscape = embedded.width > embedded.height;
    const [pw, ph] = landscape ? [A4[1], A4[0]] : A4;
    const s = Math.min(pw / embedded.width, ph / embedded.height);
    const w = embedded.width * s, h = embedded.height * s;
    const page = doc.addPage([pw, ph]);
    page.drawImage(embedded, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h });
    return page;
  }

  /**
   * Turn a picked image file into bytes a PDF can hold. JPEGs that need no turning and PNGs are
   * kept exactly as they are; other images (WebP, GIF, BMP, turned phone photos) are drawn upright
   * and saved as high-quality JPEG. Browser only.
   */
  async function prepareImage(file, info) {
    const bytes = await readBytes(file);
    const kind = info && info.ext;
    if (kind === 'png') return { bytes, type: 'png' };
    if (kind === 'jpg' && jpegOrientation(bytes) === 1) return { bytes, type: 'jpg' };
    let bitmap;
    try { bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
    catch (e) { throw new PdfError('damaged', `${file.name} could not be read as an image. Open it on your device to check it, or choose another file.`); }
    const max = 4000;
    const s = Math.min(1, max / Math.max(bitmap.width, bitmap.height), Math.sqrt(LIMITS.canvasPixels / (bitmap.width * bitmap.height)));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * s));
    canvas.height = Math.max(1, Math.round(bitmap.height * s));
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    if (bitmap.close) bitmap.close();
    const blob = await canvasBlob(canvas, 'image/jpeg', 0.92);
    releaseCanvas(canvas);
    return { bytes: new Uint8Array(await blob.arrayBuffer()), type: 'jpg' };
  }

  /* ------------------------------------------------------------------ Drawing (pdf.js) */
  function canvasBlob(canvas, type, quality) {
    return new Promise((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new PdfError('unsupported', 'This browser could not save the page image. The page may be too large; try a lower resolution.'))), type, quality));
  }
  function releaseCanvas(canvas) { if (canvas) { canvas.width = 0; canvas.height = 0; } }

  /**
   * Draw a page onto a new canvas. opts: { scale, rotation (absolute degrees, default the page's
   * own), maxPixels, signal }. Returns { canvas, width, height, scale, capped }. Call releaseCanvas()
   * when finished with it.
   */
  async function renderPage(jsDoc, index, options) {
    const o = Object.assign({ scale: 1, maxPixels: LIMITS.canvasPixels, rotation: null, signal: null }, options);
    throwIfAborted(o.signal);
    const page = await jsDoc.getPage(index + 1);
    const rotation = o.rotation == null ? page.rotate : o.rotation;
    let scale = o.scale;
    let vp = page.getViewport({ scale, rotation });
    if (vp.width * vp.height > o.maxPixels) {
      scale = scale * Math.sqrt(o.maxPixels / (vp.width * vp.height)) * 0.999;
      vp = page.getViewport({ scale, rotation });
    }
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.floor(vp.width));
    canvas.height = Math.max(1, Math.floor(vp.height));
    const ctx = canvas.getContext('2d', { alpha: false });
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    const task = page.render({ canvasContext: ctx, viewport: vp });
    const stop = () => { try { task.cancel(); } catch (e) { /* finished */ } };
    if (o.signal) o.signal.addEventListener('abort', stop, { once: true });
    try {
      await task.promise;
    } catch (e) {
      releaseCanvas(canvas);
      if (isAbort(e) || (o.signal && o.signal.aborted)) throw abortError();
      throw new PdfError('damaged', `Page ${index + 1} could not be drawn. The PDF may be damaged.`, e && e.message);
    } finally {
      if (o.signal) o.signal.removeEventListener('abort', stop);
      page.cleanup();
    }
    return { canvas, width: canvas.width, height: canvas.height, scale, capped: scale < o.scale - 1e-6, rotation };
  }

  /** A small JPEG of a page (object URL), about `width` CSS pixels wide. Revoke it when done. */
  async function thumbnail(jsDoc, index, options) {
    const o = Object.assign({ width: 160, signal: null }, options);
    const page = await jsDoc.getPage(index + 1);
    const base = page.getViewport({ scale: 1, rotation: page.rotate });
    page.cleanup();
    const ratio = Math.min(2, (typeof devicePixelRatio === 'number' && devicePixelRatio) || 1);
    const scale = Math.min(2, (o.width * ratio) / base.width);
    const r = await renderPage(jsDoc, index, { scale, signal: o.signal, maxPixels: 1200000 });
    const blob = await canvasBlob(r.canvas, 'image/jpeg', 0.82);
    const out = { url: URL.createObjectURL(blob), width: r.width, height: r.height };
    releaseCanvas(r.canvas);
    return out;
  }

  /** Page size in points as seen, with pdf.js. */
  async function jsPageSize(jsDoc, index) {
    const page = await jsDoc.getPage(index + 1);
    const vp = page.getViewport({ scale: 1, rotation: page.rotate });
    const out = { width: vp.width, height: vp.height, rotation: page.rotate, view: page.view.slice() };
    page.cleanup();
    return out;
  }

  /* ------------------------------------------------------------------ Text */
  /**
   * Join pdf.js text items into lines. Items on a new baseline start a new line, a large vertical
   * gap leaves a blank line (a new paragraph), and a horizontal gap becomes a space.
   */
  function joinTextItems(items) {
    let out = '';
    let lastY = null, lastEnd = null, lastH = 0, broke = true;
    for (const it of items || []) {
      if (!it || typeof it.str !== 'string') continue;
      const tr = it.transform || [1, 0, 0, 1, 0, 0];
      const x = tr[4], y = tr[5];
      const h = Math.abs(it.height || tr[3] || 10) || 10;
      if (it.str === '') {
        if (it.hasEOL && !broke) { out += '\n'; broke = true; lastY = y; lastEnd = null; }
        continue;
      }
      if (lastY !== null && Math.abs(y - lastY) > Math.max(2, Math.min(h, lastH || h) * 0.5)) {
        if (!broke) out += '\n';
        if (Math.abs(y - lastY) > Math.max(h, lastH) * 1.9 && !/\n\n$/.test(out) && out.length) out += '\n';
        lastEnd = null;
      } else if (lastEnd !== null && x - lastEnd > h * 0.2 && !/\s$/.test(out) && !/^\s/.test(it.str)) {
        out += ' ';
      }
      out += it.str;
      broke = false;
      lastY = y; lastH = h;
      lastEnd = x + (it.width || 0);
      if (it.hasEOL) { out += '\n'; broke = true; }
    }
    return out.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  async function pageText(jsDoc, index) {
    const page = await jsDoc.getPage(index + 1);
    try {
      const content = await page.getTextContent();
      return joinTextItems(content.items);
    } finally { page.cleanup(); }
  }

  /* ------------------------------------------------------------------ Compression by rendering */
  // Each page is drawn at the chosen resolution and saved as a JPEG whose quality is searched to
  // fit the page's share of the size limit. The new PDF has the same number of pages, in the same
  // order, with the same page sizes and rotation; the pages become pictures of themselves.
  const Q_MAX = 0.9, Q_MIN = 0.3;
  const MIN_DPI = 50;

  function toGrey(canvas) {
    const ctx = canvas.getContext('2d');
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) { const v = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) | 0; d[i] = d[i + 1] = d[i + 2] = v; }
    ctx.putImageData(img, 0, 0);
  }

  function scaledCopy(canvas, factor) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(canvas.width * factor));
    c.height = Math.max(1, Math.round(canvas.height * factor));
    const ctx = c.getContext('2d', { alpha: false });
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(canvas, 0, 0, c.width, c.height);
    return c;
  }

  /** Largest JPEG quality whose size fits `budget`; the smallest result when none fits. */
  async function fitJpeg(canvas, budget, signal) {
    let best = null, smallest = null;
    let lo = Q_MIN, hi = Q_MAX;
    const at = async q => { throwIfAborted(signal); const b = await canvasBlob(canvas, 'image/jpeg', q); if (!smallest || b.size < smallest.blob.size) smallest = { blob: b, q }; return b; };
    const top = await at(Q_MAX);
    if (top.size <= budget) return { blob: top, q: Q_MAX, fits: true };
    const bottom = await at(Q_MIN);
    if (bottom.size > budget) return { blob: smallest.blob, q: smallest.q, fits: false };
    best = { blob: bottom, q: Q_MIN };
    for (let step = 0; step < 6; step++) {
      const mid = (lo + hi) / 2;
      const b = await at(mid);
      if (b.size <= budget) { best = { blob: b, q: mid }; lo = mid; } else hi = mid;
      if (hi - lo < 0.03) break;
    }
    return { blob: best.blob, q: best.q, fits: true };
  }

  /** Encode one page picture under `budget` bytes, lowering the resolution only if quality alone cannot. */
  async function encodePage(canvas, dpi, budget, signal) {
    let current = canvas, currentDpi = dpi, result = null;
    for (let attempt = 0; attempt < 6; attempt++) {
      result = await fitJpeg(current, budget, signal);
      result.dpi = currentDpi;
      result.width = current.width; result.height = current.height;
      if (result.fits || currentDpi <= MIN_DPI) break;
      const factor = Math.max(MIN_DPI / currentDpi, Math.min(0.85, Math.sqrt(budget / result.blob.size) * 0.95));
      const next = scaledCopy(current, factor);
      if (current !== canvas) releaseCanvas(current);
      current = next;
      currentDpi = currentDpi * factor;
    }
    if (current !== canvas) releaseCanvas(current);
    return result;
  }

  /**
   * Compress a PDF by redrawing its pages. source: { jsDoc } (an open pdf.js document).
   * opts: { targetBytes, dpi, grey, signal, onProgress(done, total, phase) }.
   * Returns { bytes, pageCount, fits, sizes, minDpi }.
   */
  async function compressRendered(jsDoc, options) {
    const o = Object.assign({ dpi: 150, grey: false }, options);
    const P = await lib();
    const count = jsDoc.numPages;
    if (count > LIMITS.compressPages) throw new PdfError('toolarge', `This PDF has ${count} pages. The compressor redraws every page, so it works on up to ${LIMITS.compressPages} pages at a time. Split the PDF first, compress each part, then merge them.`);
    const sizes = [];
    for (let i = 0; i < count; i++) sizes.push(await jsPageSize(jsDoc, i));
    const areas = sizes.map(s => (s.view[2] - s.view[0]) * (s.view[3] - s.view[1]));
    const totalArea = areas.reduce((a, b) => a + b, 0) || 1;
    let available = Math.max(2000, o.targetBytes - (1800 + 520 * count));
    let output = null;
    for (let pass = 0; pass < 3; pass++) {
      const out = await P.PDFDocument.create();
      let allFit = true, minDpi = o.dpi;
      for (let i = 0; i < count; i++) {
        throwIfAborted(o.signal);
        const budget = Math.max(600, available * areas[i] / totalArea);
        const r = await renderPage(jsDoc, i, { scale: o.dpi / 72, rotation: 0, signal: o.signal });
        if (o.grey) toGrey(r.canvas);
        const enc = await encodePage(r.canvas, o.dpi * (r.scale / (o.dpi / 72)), budget, o.signal);
        releaseCanvas(r.canvas);
        allFit = allFit && enc.fits;
        minDpi = Math.min(minDpi, enc.dpi);
        const img = await out.embedJpg(new Uint8Array(await enc.blob.arrayBuffer()));
        const v = sizes[i].view;
        const w = v[2] - v[0], h = v[3] - v[1];
        const page = out.addPage([w, h]);
        page.drawImage(img, { x: 0, y: 0, width: w, height: h });
        if (sizes[i].rotation) page.setRotation(P.degrees(norm(sizes[i].rotation)));
        if (o.onProgress) o.onProgress(i + 1, count, pass);
        await tick();
      }
      const bytes = await save(out);
      output = { bytes, pageCount: count, fits: bytes.length <= o.targetBytes, allPagesFit: allFit, minDpi: Math.round(minDpi), sizes };
      // The estimate of the PDF's own overhead was too low: try once more with smaller budgets.
      if (output.fits || !allFit) break;
      available = available * (o.targetBytes / bytes.length) * 0.96;
    }
    return output;
  }

  /** Compress one image into a one-page A4 PDF under the target. Browser only. */
  async function compressImage(file, options) {
    const o = Object.assign({ dpi: 150, grey: false }, options);
    const P = await lib();
    let bitmap;
    try { bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
    catch (e) { throw new PdfError('damaged', `${file.name} could not be read as an image. Open it on your device to check it, or choose another file.`); }
    const landscape = bitmap.width > bitmap.height;
    const [pw, ph] = landscape ? [A4[1], A4[0]] : A4;
    const fit = Math.min(pw / bitmap.width, ph / bitmap.height);
    const w = bitmap.width * fit, h = bitmap.height * fit;
    // Pixels needed to show the image at the chosen resolution on the page; never more than it has.
    const s = Math.min(1, (w / 72 * o.dpi) / bitmap.width, Math.sqrt(LIMITS.canvasPixels / (bitmap.width * bitmap.height)));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * s));
    canvas.height = Math.max(1, Math.round(bitmap.height * s));
    const ctx = canvas.getContext('2d', { alpha: false });
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    if (bitmap.close) bitmap.close();
    if (o.grey) toGrey(canvas);
    const effectiveDpi = canvas.width / (w / 72);
    const enc = await encodePage(canvas, effectiveDpi, Math.max(600, o.targetBytes - 1800), o.signal);
    releaseCanvas(canvas);
    const out = await P.PDFDocument.create();
    const img = await out.embedJpg(new Uint8Array(await enc.blob.arrayBuffer()));
    const page = out.addPage([pw, ph]);
    page.drawImage(img, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h });
    const bytes = await save(out);
    return { bytes, pageCount: 1, fits: bytes.length <= o.targetBytes, allPagesFit: enc.fits, minDpi: Math.round(enc.dpi) };
  }

  /* ------------------------------------------------------------------ Names */
  const pad = (n, total) => String(n).padStart(Math.max(2, String(total).length), '0');

  return {
    LIMITS, PdfError, MB,
    support, lib, pdfjs, asset,
    readBytes, hasHeader, precheck, inspect, openLib, openJs, closeJs, save, verify,
    pageFacts, paperName, parseRanges, formatRanges, winAnsiProblems, pageNumberLabel,
    merge, extract, assemble, addPageNumbers, addWatermark, addImagePage, prepareImage, jpegOrientation,
    renderPage, thumbnail, jsPageSize, releaseCanvas, canvasBlob, joinTextItems, pageText,
    compressRendered, compressImage,
    throwIfAborted, isAbort, abortError, tick, pad, norm
  };
});
