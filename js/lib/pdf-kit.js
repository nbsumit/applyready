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

  // Sizes, size limits and number grouping follow the one rule in js/lib/files.js (1 KB = 1,000 bytes).
  const Files = isNode ? require('./files.js') : root.ApplyReadyFiles;
  const MB = 1024 * 1024; // internal memory budgets
  const LIMITS = {
    fileBytes: 100 * Files.MB, // one PDF (100 MB, counted as the site counts sizes)
    totalBytes: 500 * Files.MB, // all files in one job (merge)
    maxFiles: 50,             // files in one merge
    // Pages in one job that copies or changes pages (merge, split, page numbers, watermark). A small
    // crafted file can claim hundreds of thousands of pages, and copying them would freeze the tab.
    pages: 2000,
    renderPages: 500,         // pages drawn in one job (PDF to image)
    compressPages: 300,       // pages rasterised by the compressor
    textPages: 3000,          // pages read for text
    thumbPages: 1500,         // pages shown as thumbnails
    outputs: 500,             // files produced by one split
    // iOS Safari refuses canvases over 16.7 million pixels; staying under it works everywhere.
    canvasPixels: 16000000
  };

  // Numbers in messages are grouped the way the rest of the site writes them (2,000 pages).
  const grouped = n => Files.grouped(n);
  /**
   * What to tell someone whose PDF has more pages than a tool takes. Splitting it first helps only
   * when Split PDF can open the file; past LIMITS.pages it cannot either, so say that plainly instead
   * of sending them to a tool that refuses the same file. then: what to do with each part.
   */
  function splitFirst(pages, then) {
    if (pages <= LIMITS.pages) return `Split it into smaller parts with Split PDF first${then ? `, then ${then}` : ''}.`;
    return `Split PDF also works on up to ${grouped(LIMITS.pages)} pages, so it cannot break this file into parts here; use a desktop PDF program for a file this long.`;
  }
  /** Why the compressor refuses a long PDF, and what to do instead. */
  const compressAdvice = pages => `The compressor redraws every page, so it works on up to ${grouped(LIMITS.compressPages)} pages at a time. ${splitFirst(pages, 'compress each part and merge the parts again')}`;

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
      // detail 'load': the library itself is missing, so every file would fail the same way.
      el.onerror = () => { el.remove(); reject(new PdfError('unsupported', 'A part of the PDF tool could not load. Check your connection and reload the page.', 'load')); };
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
        lib.GlobalWorkerOptions.workerSrc = workerSource();
        return lib;
      }).catch(e => { jsPromise = null; throw e; });
    }
    return jsPromise;
  }

  /* The pdf.js worker reads untrusted files, so it must run under the site's Content-Security-Policy.
     GitHub Pages cannot send a policy header, and the policy in each page's <meta> tag covers only
     that page: a worker started from its file's URL takes its policy from that file's response
     headers, so it would run with none and could send data to any website. A worker started from a
     blob: URL takes the policy of the page that starts it instead (worker-src allows blob:), so pdf.js
     is given a one-line blob: module that imports the real worker file from this site. */
  let workerUrl = null;
  function workerSource() {
    if (!workerUrl) {
      const src = `import ${JSON.stringify(asset('js/vendor/pdfjs/pdf.worker.min.mjs'))};`;
      workerUrl = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
    }
    return workerUrl;
  }

  /* One pdf.js worker for the whole page, shared by every open document. Left to itself, pdf.js
     starts a new worker for each document; the browser does not give back all of a stopped worker's
     memory, so a tab that opened dozens of PDFs kept growing by several MB per file even after every
     worker was stopped. Each document is still freed on its own: closeJs destroys its loading task,
     which leaves a worker it did not start running. A worker that failed or was stopped is replaced
     on the next open. */
  let sharedWorker = null;
  function pdfWorker(lib) {
    if (!sharedWorker || sharedWorker.destroyed) sharedWorker = new lib.PDFWorker({ name: 'applyready-pdf' });
    return sharedWorker;
  }
  function dropWorker() {
    if (!sharedWorker) return;
    try { sharedWorker.destroy(); } catch (e) { /* already stopped */ }
    sharedWorker = null;
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

  /**
   * Whether a Flate stream that pdf-lib could not decode completely still gives some content.
   * pdf-lib's decoder throws on any error and keeps nothing; pdf.js, like other readers, keeps what
   * came before the error, so a stream with only its last bytes cut off still shows most of the page.
   * The browser's own decompressor hands over what it decoded before it fails. Resolves true (some
   * content), false (none at all), or null when this browser cannot tell.
   */
  async function inflatesPartly(bytes) {
    const DS = (root && root.DecompressionStream) || (typeof globalThis !== 'undefined' ? globalThis.DecompressionStream : undefined);
    if (typeof DS !== 'function') return null;
    let reader = null;
    try {
      const ds = new DS('deflate');
      const writer = ds.writable.getWriter();
      reader = ds.readable.getReader();
      writer.write(bytes).catch(() => { /* reported by the reader */ });
      writer.close().catch(() => { /* reported by the reader */ });
      for (;;) {
        const step = await reader.read();
        if (step.done) return false;
        if (step.value && step.value.length) return true;
      }
    } catch (e) {
      return false;
    } finally {
      if (reader) reader.cancel().catch(() => { /* already finished */ });
    }
  }

  /**
   * Shared by the PDF tools and the File checker (ApplyReadyInspect.unreadablePdfPages in
   * js/lib/inspect.js holds the same rules). Returns { unreadable, incomplete }, 0-based indexes.
   * unreadable: pages none of whose content can be read (the /Contents names an object that is
   * missing or not a stream, or Flate data that gives nothing at all), which come out blank.
   * incomplete: pages with some content broken, for example a stream with its end cut off, where
   * readers still show the part before the damage. A page with no /Contents, an empty /Contents array
   * or an empty content stream is blank by design and is not reported. Flate streams are checked up to a total of 16 MB.
   */
  async function damagedPages(P, doc, partly) {
    const ctx = doc.context;
    const CONTENTS = P.PDFName.of('Contents'), FILTER = P.PDFName.of('Filter'), FLATE = P.PDFName.of('FlateDecode');
    let budget = 16 * MB;
    const known = new Map();
    // 'ok', 'partial' (broken, but some content comes out) or 'bad' (nothing comes out).
    const state = async obj => {
      if (!(obj instanceof P.PDFStream)) return 'bad';
      if (known.has(obj)) return known.get(obj);
      let result = 'ok';
      if (obj instanceof P.PDFRawStream && budget > 0 && typeof P.decodePDFRawStream === 'function') {
        const f = obj.dict.lookup(FILTER);
        const flate = f === FLATE || (f instanceof P.PDFArray && f.size() > 0 && f.asArray().every(x => ctx.lookup(x) === FLATE));
        // An empty stream (0 bytes) is a blank page by design, like a page with no /Contents.
        if (flate && obj.contents.length) {
          budget -= obj.contents.length;
          try { P.decodePDFRawStream(obj).decode(); }
          catch (e) { result = (await partly(obj.contents)) === false ? 'bad' : 'partial'; }
        }
      }
      known.set(obj, result);
      return result;
    };
    const unreadable = [], incomplete = [];
    const pages = doc.getPages();
    for (let i = 0; i < pages.length; i++) {
      const ref = pages[i].node.get(CONTENTS);
      if (ref === undefined) continue;
      const c = ctx.lookup(ref);
      const parts = c instanceof P.PDFArray ? c.asArray().map(x => ctx.lookup(x)) : [c];
      const states = [];
      for (const part of parts) states.push(await state(part));
      if (!states.length) continue; // /Contents [] is a blank page by design too
      if (states.every(x => x === 'bad')) unreadable.push(i);
      else if (states.some(x => x !== 'ok')) incomplete.push(i);
    }
    return { unreadable, incomplete };
  }

  /** Damaged pages of a document opened with openLib: { unreadable, incomplete } (see damagedPages). */
  function pageDamage(doc) {
    const P = isNode ? require('../vendor/pdf-lib.min.js') : root.PDFLib; // loaded: `doc` came from it
    return damagedPages(P, doc, inflatesPartly);
  }
  /** Pages (0-based) none of whose content can be read, so they come out blank. */
  async function unreadablePages(doc) { return (await pageDamage(doc)).unreadable; }

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
      worker: pdfWorker(lib),
      password: o.password || undefined,
      wasmUrl: asset('js/vendor/pdfjs/wasm/'),
      iccUrl: asset('js/vendor/pdfjs/iccs/'),
      standardFontDataUrl: asset('js/vendor/pdfjs/standard_fonts/'),
      cMapUrl: asset('js/vendor/pdfjs/cmaps/'),
      cMapPacked: true,
      enableXfa: false,
      stopAtErrors: false,
      // pdf.js can hand JPEG pictures to the browser's ImageDecoder (WebCodecs). In Chrome the memory
      // that path takes is not given back when the document is closed: every drawn page with a photo
      // or scan kept about 2 MB until the tab closed. pdf.js's own JPEG decoder frees it.
      isImageDecoderSupported: false
    });
    try {
      return await task.promise;
    } catch (e) {
      // A document that did not open is still held by the worker: free it (the shared worker keeps running).
      task.destroy().catch(() => { /* already stopped */ });
      if (e && e.name === 'PasswordException') {
        if (e.code === 2) throw new PdfError('password', 'That password is not right. Check it and try again; passwords are case sensitive.');
        throw new PdfError('encrypted', `${label} is protected with a password.`);
      }
      // The worker itself could not start (offline before it was saved, or blocked): not the file's fault.
      const msg = String(e && e.message);
      if (/fake worker|worker was destroyed|worker failed/i.test(msg)) {
        // A worker that never started is replaced on the next open, once the connection is back.
        // (Not one that was only told to drop this document: other open files still use it.)
        if (/fake worker|worker failed/i.test(msg)) dropWorker();
        throw new PdfError('unsupported', 'A part of the PDF tool could not load. Check your connection and reload the page.', e && e.message);
      }
      throw new PdfError('damaged', `${label} ${DAMAGED}`, e && e.message);
    }
  }

  /**
   * Close a pdf.js document: its copy of the file and its parsed pages are freed in the shared
   * worker, which keeps running for the next file. pdf.js closes a document through the loading task
   * that opened it (PDFDocumentProxy has no destroy() of its own), so without this every opened PDF
   * would stay in the worker's memory until the tab closes.
   */
  async function closeJs(doc) {
    if (!doc) return;
    try {
      const task = doc.loadingTask;
      if (task && typeof task.destroy === 'function') await task.destroy();
      else if (typeof doc.destroy === 'function') await doc.destroy();
    } catch (e) { /* already closed */ }
  }

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
  const tooManyPages = n => `That is ${grouped(n)} pages. Up to ${grouped(LIMITS.pages)} pages can be put together at a time in a browser; use fewer pages.`;

  /*
   * Copying pages without the pages that were left out.
   * pdf-lib's copyPages copies everything a page refers to. A link on a page (/Dest, or a GoTo
   * action's /D) and an annotation's /P name another page, so that whole page, its text and images
   * included, would be copied too, as a page object outside the page list: a page deleted in Organise
   * or left out in Split could be recovered from the downloaded file, and in Merge internal links
   * would point at hidden copies instead of the real pages. So before copying, every page of the
   * source is mapped: a kept page to its copy in the new file, any other page to `dead`, a reference
   * that is never written. unlinkDropped() then removes what still points at `dead`.
   */
  function copier(P, out, src) {
    const c = P.PDFObjectCopier.for(src.context, out.context);
    // pdf-lib keeps what it has copied in this map; if that ever changes, copying cannot be steered.
    if (!(c.traversedObjects instanceof Map)) throw new PdfError('unsupported', 'The PDF library is not the expected version, so pages cannot be copied safely. Reload the page.');
    return c;
  }

  /** Copy pages `indexes` (0-based, repeats allowed) of `src` into `out`. Returns the new PDFPage objects, not yet added. */
  async function copyInto(P, out, src, indexes, dead) {
    await src.flush();
    const c = copier(P, out, src);
    const seen = c.traversedObjects;
    const srcPages = src.getPages();
    const refs = indexes.map(i => {
      const ref = out.context.nextRef();
      if (!seen.has(srcPages[i].ref)) seen.set(srcPages[i].ref, ref); // links to this page lead to its first copy
      return ref;
    });
    for (const page of srcPages) if (!seen.has(page.ref)) seen.set(page.ref, dead);
    return indexes.map((idx, k) => {
      const node = c.copy(srcPages[idx].node);
      out.context.assign(refs[k], node);
      return P.PDFPage.of(node, refs[k], out);
    });
  }

  /**
   * Clear every reference to a page that was not copied: a link on a kept page that leads to one is
   * removed (it would lead nowhere), and any other reference (an annotation's /P, an article bead's
   * page) is dropped, so the saved file has no references to objects it does not contain.
   */
  function unlinkDropped(P, out, dead) {
    const isDead = v => v instanceof P.PDFRef && v.objectNumber === dead.objectNumber && v.generationNumber === dead.generationNumber;
    const DEST = P.PDFName.of('Dest'), A = P.PDFName.of('A'), D = P.PDFName.of('D'), ANNOTS = P.PDFName.of('Annots');
    const deadDest = d => d instanceof P.PDFArray && d.size() > 0 && isDead(d.get(0));
    for (const page of out.getPages()) {
      const annots = page.node.lookup(ANNOTS);
      if (!(annots instanceof P.PDFArray)) continue;
      for (let i = annots.size() - 1; i >= 0; i--) {
        const entry = annots.get(i);
        const a = out.context.lookup(entry);
        if (!(a instanceof P.PDFDict)) continue;
        const action = a.lookup(A);
        if (deadDest(a.lookup(DEST)) || (action instanceof P.PDFDict && deadDest(action.lookup(D)))) {
          annots.remove(i);
          if (entry instanceof P.PDFRef) out.context.delete(entry);
        }
      }
    }
    const sweep = obj => {
      if (obj instanceof P.PDFDict) {
        for (const [key, value] of obj.entries()) { if (isDead(value)) obj.delete(key); else sweep(value); }
      } else if (obj instanceof P.PDFArray) {
        for (let i = 0; i < obj.size(); i++) { const value = obj.get(i); if (isDead(value)) obj.set(i, P.PDFNull); else sweep(value); }
      } else if (obj instanceof P.PDFStream) {
        sweep(obj.dict);
      }
    };
    for (const [, obj] of out.context.enumerateIndirectObjects()) sweep(obj);
  }
  /**
   * A new document from parts [{ doc, indexes? } | { image }] in order. Page sizes, rotation and
   * content are kept. Throws PdfError toolarge over LIMITS.pages in all.
   */
  async function merge(parts, onProgress, signal) {
    const P = await lib();
    const total = parts.reduce((n, part) => n + (part.doc ? (part.indexes ? part.indexes.length : part.doc.getPageCount()) : 1), 0);
    if (total > LIMITS.pages) throw new PdfError('toolarge', tooManyPages(total));
    const out = await P.PDFDocument.create();
    const dead = out.context.nextRef();
    for (let i = 0; i < parts.length; i++) {
      throwIfAborted(signal);
      const part = parts[i];
      if (part.doc) {
        const idx = part.indexes || part.doc.getPageIndices();
        const pages = await copyInto(P, out, part.doc, idx, dead);
        pages.forEach(p => out.addPage(p));
      } else if (part.image) {
        await addImagePage(out, part.image);
      }
      if (onProgress) onProgress(i + 1, parts.length);
      await tick();
    }
    unlinkDropped(P, out, dead);
    return out;
  }

  /** A new document with the given pages of one document (0-based, any order, repeats allowed). */
  async function extract(doc, indexes) {
    const P = await lib();
    if (indexes.length > LIMITS.pages) throw new PdfError('toolarge', tooManyPages(indexes.length));
    const out = await P.PDFDocument.create();
    const dead = out.context.nextRef();
    const pages = await copyInto(P, out, doc, indexes, dead);
    pages.forEach(p => out.addPage(p));
    unlinkDropped(P, out, dead);
    return out;
  }

  /**
   * Organise: items [{ doc, index, turn }] in their new order. `turn` is the quarter turns to add
   * clockwise (90, -90, 180...), on top of any rotation the page already has.
   */
  async function assemble(items, onProgress, signal) {
    const P = await lib();
    const out = await P.PDFDocument.create();
    const dead = out.context.nextRef();
    // Copy each source document's pages in one call, then add them in the chosen order.
    const bySource = new Map();
    items.forEach((it, i) => { if (!bySource.has(it.doc)) bySource.set(it.doc, []); bySource.get(it.doc).push(i); });
    const copied = new Array(items.length);
    let done = 0;
    for (const [doc, positions] of bySource) {
      throwIfAborted(signal);
      const pages = await copyInto(P, out, doc, positions.map(i => items[i].index), dead);
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
    unlinkDropped(P, out, dead);
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

  /**
   * Give a page its own resource dictionaries before text is drawn on it. Many programs (LibreOffice,
   * ReportLab) let every page share one /Resources or /Font dictionary. pdf-lib adds the stamp's font
   * (and, for see-through text, a graphics state) to the page's dictionary under a new name each time,
   * so on a shared dictionary every page would gain every other page's entry, and the dictionary is
   * then written out in full on each page: the file would grow with the square of the page count
   * (a 300-page file became 11 times larger). Shallow copies keep the original fonts and images shared.
   */
  function ownResources(P, page) {
    const node = page.node;
    const ctx = node.context;
    const R = P.PDFName.of('Resources');
    const shared = ctx.lookupMaybe(node.getInheritableAttribute(R), P.PDFDict);
    const mine = shared ? shared.clone() : ctx.obj({});
    for (const name of ['Font', 'ExtGState', 'XObject']) {
      const key = P.PDFName.of(name);
      const sub = ctx.lookupMaybe(mine.get(key), P.PDFDict);
      if (sub) mine.set(key, sub.clone());
    }
    node.set(R, mine);
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
      ownResources(P, pages[i]);
      pages[i].drawText(label, { x: at.x, y: at.y, size: o.size, font, color, rotate: P.degrees(at.angle) });
      if (onProgress && i % 20 === 0) { onProgress(i + 1, pages.length); await tick(); }
    }
    if (onProgress) onProgress(pages.length, pages.length);
    return doc;
  }

  /**
   * Stamp a text watermark on every page (changed in place).
   * opts: { text, size, opacity (0-1), angle (degrees, counter-clockwise as seen), color,
   *         layout: 'center' | 'top' | 'bottom' | 'tiled', pages (0-based subset),
   *         report (optional object, filled with { fitted: pages where the text was made smaller, smallest: size used }) }
   * The text is made smaller where it would not fit on a page, so that every word typed stays visible.
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
    const rad = o.angle * Math.PI / 180;
    const cos = Math.cos(rad), sin = Math.sin(rad);
    // One see-through graphics state for the whole file, named once on each page. pdf-lib would add a
    // new one to the page for every stamp drawn with an opacity (up to 400 on a tiled page).
    const see = o.opacity < 1 ? doc.context.register(doc.context.obj({ Type: 'ExtGState', ca: o.opacity })) : null;
    let fitted = 0, smallest = o.size;
    for (let i = 0; i < pages.length; i++) {
      if (only && !only.has(i)) continue;
      throwIfAborted(signal);
      const facts = pageFacts(pages[i]);
      const W = facts.width, H = facts.height;
      // The stamp's box after turning, at the chosen size: it must fit inside the page with a margin.
      const pad = Math.max(24, H * 0.05);
      const w0 = font.widthOfTextAtSize(text, o.size), c0 = font.heightAtSize(o.size, { descender: false });
      const boxW = w0 * Math.abs(cos) + c0 * Math.abs(sin), boxH = w0 * Math.abs(sin) + c0 * Math.abs(cos);
      const room = Math.min(1, (W * 0.9) / boxW, Math.min(H * 0.9, H - 2 * pad) / boxH);
      const size = room < 1 ? Math.max(4, Math.floor(o.size * room * 10) / 10) : o.size;
      if (size < o.size) { fitted++; smallest = Math.min(smallest, size); }
      const tw = font.widthOfTextAtSize(text, size);
      const cap = font.heightAtSize(size, { descender: false });
      // Start of the baseline so that the text's centre lands on (cx, cy) after rotation.
      const startFor = (cx, cy) => ({ x: cx - (tw / 2) * cos + (cap / 2) * sin, y: cy - (tw / 2) * sin - (cap / 2) * cos });
      const centres = [];
      if (o.layout === 'tiled') {
        const stepX = Math.max(tw * Math.abs(cos) + cap * Math.abs(sin), 40) + size * 1.6;
        const stepY = Math.max(tw * Math.abs(sin) + cap * Math.abs(cos), 40) + size * 1.6;
        let row = 0;
        for (let y = stepY / 2; y < H + stepY / 2 && centres.length < 400; y += stepY, row++) {
          for (let x = (row % 2 ? stepX : stepX / 2); x < W + stepX / 2 && centres.length < 400; x += stepX) centres.push([x, y]);
        }
      } else {
        const ext = (tw * Math.abs(sin) + cap * Math.abs(cos)) / 2;
        const cy = o.layout === 'top' ? H - pad - ext : o.layout === 'bottom' ? pad + ext : H / 2;
        centres.push([W / 2, cy]);
      }
      const page = pages[i];
      ownResources(P, page);
      page.setFont(font); // named once on this page, not once per stamp
      if (see) page.pushOperators(P.pushGraphicsState(), P.setGraphicsState(page.node.newExtGState('GS', see)));
      for (const [cx, cy] of centres) {
        const s = startFor(cx, cy);
        const at = toPageSpace(facts, s.x, s.y);
        page.drawText(text, { x: at.x, y: at.y, size, color, rotate: P.degrees(o.angle + at.angle) });
      }
      if (see) page.pushOperators(P.popGraphicsState());
      if (onProgress && i % 10 === 0) { onProgress(i + 1, pages.length); await tick(); }
    }
    if (o.report) { o.report.fitted = fitted; o.report.smallest = smallest; }
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
   * A copy of a JPEG without its metadata, for embedding in a PDF: pdf-lib embeds a JPEG file
   * byte for byte, so EXIF (camera, serial number, GPS location, date taken), XMP, IPTC, comments,
   * embedded thumbnails and other application segments would otherwise travel inside the PDF.
   * The image data is copied unchanged, so there is no loss of quality. The JFIF header, the colour
   * profile (APP2 ICC_PROFILE) and the Adobe colour marker (APP14) are kept, because decoders need
   * them for the right colours; anything after the end of the image is dropped. The same rules as
   * ApplyReadyInspect.stripMetadata (js/lib/inspect.js), which the File checker uses.
   * Returns null when the file is not a well-formed JPEG.
   */
  function jpegWithoutMetadata(bytes) {
    const b = bytes;
    if (!b || b[0] !== 0xFF || b[1] !== 0xD8) return null;
    const ascii = (at, s) => { for (let k = 0; k < s.length; k++) if (b[at + k] !== s.charCodeAt(k)) return false; return true; };
    const parts = [b.subarray(0, 2)];
    let p = 2, guard = 0, total = 2;
    const keep = (from, to) => { parts.push(b.subarray(from, to)); total += to - from; };
    while (p < b.length) {
      if (++guard > 100000 || b[p] !== 0xFF) return null;
      const m = b[p + 1];
      if (m === undefined) return null;
      if (m === 0xFF) { p++; continue; }
      if (m === 0xD9) {
        keep(p, p + 2);
        const out = new Uint8Array(total);
        let at = 0;
        for (const part of parts) { out.set(part, at); at += part.length; }
        return out;
      }
      if ((m >= 0xD0 && m <= 0xD7) || m === 0x01) { keep(p, p + 2); p += 2; continue; }
      if (p + 4 > b.length) return null;
      const len = (b[p + 2] << 8) | b[p + 3];
      if (len < 2 || p + 2 + len > b.length) return null;
      const end = p + 2 + len, data = p + 4;
      const app = m >= 0xE0 && m <= 0xEF;
      const wanted = m === 0xE0 ? !ascii(data, 'JFXX\0')
        : m === 0xE2 ? ascii(data, 'ICC_PROFILE\0')
          : m === 0xEE ? ascii(data, 'Adobe')
            : !app && m !== 0xFE;
      if (wanted) keep(p, end);
      p = end;
      if (m === 0xDA) {
        // Entropy-coded data runs to the next marker that is not a stuffed byte (FF00) or a restart.
        let j = p;
        for (;;) {
          j = b.indexOf(0xFF, j);
          if (j < 0 || j + 1 >= b.length) return null;
          const n = b[j + 1];
          if (n === 0x00 || (n >= 0xD0 && n <= 0xD7)) { j += 2; continue; }
          if (n === 0xFF) { j += 1; continue; }
          break;
        }
        keep(p, j);
        p = j;
      }
    }
    return null;
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
   * Turn a picked image file into bytes a PDF can hold, without the photo's metadata. JPEGs that
   * need no turning keep their image data exactly, minus metadata (jpegWithoutMetadata). PNGs are
   * decoded by pdf-lib, which stores only the pixels, so their text chunks never reach the PDF.
   * Other images (WebP, GIF, BMP, turned phone photos) are drawn upright and saved as high-quality
   * JPEG, which carries no metadata either. Browser only.
   */
  async function prepareImage(file, info) {
    const bytes = await readBytes(file);
    const kind = info && info.ext;
    // A small file can declare a huge picture; decoding it would take gigabytes of memory. A picture
    // whose size cannot be read from its header is refused too (ApplyReadyImageOps.checkHeader).
    const Ops = root.ApplyReadyImageOps;
    if (Ops) {
      const checked = await Ops.checkHeader(new Blob([bytes]), file.name);
      if (checked.message) throw new PdfError(checked.code === 'toolarge' ? 'toolarge' : 'damaged', checked.message);
    }
    if (kind === 'png') return { bytes, type: 'png' };
    if (kind === 'jpg' && jpegOrientation(bytes) === 1) {
      const clean = jpegWithoutMetadata(bytes);
      if (clean) return { bytes: clean, type: 'jpg' };
      // Not a well-formed JPEG: redraw it below, which also leaves the metadata behind.
    }
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
  // Control characters never belong in extracted text. pdf.js writes U+0000 for a glyph it cannot map
  // (for example the Hindi vowel sign ि in some fonts); in a copied or downloaded text it can break
  // pasting into forms. Tab and line breaks are kept.
  const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

  /**
   * Join pdf.js text items into lines. Items on a new baseline start a new line, a large vertical
   * gap leaves a blank line (a new paragraph), and a horizontal gap becomes a space. Control
   * characters are left out; info (optional) gets { dropped: how many }.
   */
  function joinTextItems(items, info) {
    let out = '';
    let dropped = 0;
    let lastY = null, lastEnd = null, lastH = 0, broke = true;
    for (const raw of items || []) {
      if (!raw || typeof raw.str !== 'string') continue;
      let it = raw;
      if (CONTROL.test(raw.str)) {
        const str = raw.str.replace(CONTROL, '');
        dropped += raw.str.length - str.length;
        it = Object.assign({}, raw, { str });
      }
      CONTROL.lastIndex = 0;
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
    if (info) info.dropped = (info.dropped || 0) + dropped;
    return out.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  async function pageText(jsDoc, index, info) {
    const page = await jsDoc.getPage(index + 1);
    try {
      const content = await page.getTextContent();
      return joinTextItems(content.items, info);
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
    if (count > LIMITS.compressPages) throw new PdfError('toolarge', `This PDF has ${grouped(count)} pages. ${compressAdvice(count)}`);
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

  /* A size limit typed in KB is met when the file is at most kb x 1,000 bytes (Files.maxBytes), the
     smaller of the two ways portals count a KB, so it is accepted either way. Sizes use the site's one
     size format (Files.formatBytes: 1 KB = 1,000 bytes, rounded up), so a size can never read as under
     a limit it is over, and the same file shows the same size in every tool. */
  const limitKB = bytes => (Math.ceil(bytes / 100) / 10).toFixed(1);
  const limitSize = bytes => Files.formatBytes(bytes);

  /**
   * The result line of Compress PDF. bytes: the size offered; kb: the limit; kept: '' (compressed),
   * 'fits' (already under the limit) or 'larger' (compressing would not make it smaller).
   * Returns { met, text }.
   */
  function compressResult(bytes, kb, kept) {
    const met = bytes <= Files.maxBytes(kb);
    const exact = `${grouped(bytes)} bytes, under ${kb} KB whether a KB is counted as 1,000 or 1,024 bytes`;
    const size = `${limitSize(bytes)}, ${grouped(bytes)} bytes`;
    // Over kb x 1,000 bytes but not over kb x 1,024: some portals take it, some do not.
    const either = !met && bytes <= kb * 1024 ? ` A portal that counts 1 KB as 1,024 bytes would accept it (up to ${grouped(kb * 1024)} bytes); one that counts 1,000 bytes would not.` : '';
    let text;
    if (kept === 'fits') text = `Already under ${kb} KB (${exact}), so your original file is kept unchanged. Upload it as it is.`;
    else if (kept === 'larger') text = met
      ? `Already as small as it gets: compressing would not make this file smaller, so your original (${exact}) is kept.`
      : `This file could not get under ${kb} KB, and compressing would not make it smaller, so your original (${size}) is kept.${either} Try a higher limit, or upload fewer pages.`;
    else text = met ? `Under ${kb} KB (${exact}). Ready to upload.` : `This file could not get under ${kb} KB. The smallest readable version is ${size}.${either} Try a higher limit, or upload fewer pages.`;
    return { met, text };
  }

  /* ------------------------------------------------------------------ Names */
  const pad = (n, total) => String(n).padStart(Math.max(2, String(total).length), '0');

  return {
    LIMITS, PdfError, MB, grouped, splitFirst, compressAdvice, limitKB, limitSize, compressResult,
    support, lib, pdfjs, asset,
    readBytes, hasHeader, precheck, inspect, openLib, openJs, closeJs, save, verify, unreadablePages, pageDamage, inflatesPartly,
    pageFacts, paperName, parseRanges, formatRanges, winAnsiProblems, pageNumberLabel,
    merge, extract, assemble, addPageNumbers, addWatermark, addImagePage, prepareImage, jpegOrientation, jpegWithoutMetadata,
    renderPage, thumbnail, jsPageSize, releaseCanvas, canvasBlob, joinTextItems, pageText,
    compressRendered, compressImage,
    throwIfAborted, isAbort, abortError, tick, pad, norm
  };
});
