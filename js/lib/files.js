/* ApplyReady file helpers: identify files by their content, make safe download names,
   format sizes and trigger downloads. Nothing here sends data anywhere.
   Files are untrusted input: the type is decided from the first bytes of the file, not from
   the name or the type the browser reports, and names are cleaned before they are reused. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ApplyReadyFiles = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const MB = 1024 * 1024;
  // Per-file limits. They protect the browser tab, not a business rule: a phone can run out
  // of memory decoding a 200 MB photo. Every tool states the limit next to its file picker.
  const LIMITS = { image: 50 * MB, pdf: 100 * MB, text: 5 * MB, json: 5 * MB, docx: 25 * MB };

  const startsWith = (b, sig, offset) => sig.every((v, i) => v === null || b[(offset || 0) + i] === v);
  const ascii = (b, from, to) => String.fromCharCode.apply(null, Array.from(b.slice(from, to)));

  /** Identify a file from its first bytes. Returns { kind, ext, mime, label }. */
  function sniff(bytes) {
    const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
    if (startsWith(b, [0xFF, 0xD8, 0xFF])) return { kind: 'image', ext: 'jpg', mime: 'image/jpeg', label: 'JPEG image' };
    if (startsWith(b, [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])) return { kind: 'image', ext: 'png', mime: 'image/png', label: 'PNG image' };
    if (ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 12) === 'WEBP') return { kind: 'image', ext: 'webp', mime: 'image/webp', label: 'WebP image' };
    if (ascii(b, 0, 6) === 'GIF87a' || ascii(b, 0, 6) === 'GIF89a') return { kind: 'image', ext: 'gif', mime: 'image/gif', label: 'GIF image' };
    if (ascii(b, 0, 2) === 'BM' && b.length >= 14) return { kind: 'image', ext: 'bmp', mime: 'image/bmp', label: 'BMP image' };
    if (ascii(b, 4, 8) === 'ftyp') {
      const brand = ascii(b, 8, 12);
      if (/^avi[fs]$/.test(brand)) return { kind: 'image', ext: 'avif', mime: 'image/avif', label: 'AVIF image' };
      if (/^(heic|heix|hevc|heim|heis|mif1|msf1)$/.test(brand)) return { kind: 'heic', ext: 'heic', mime: 'image/heic', label: 'HEIC photo' };
    }
    if (ascii(b, 0, 5) === '%PDF-') return { kind: 'pdf', ext: 'pdf', mime: 'application/pdf', label: 'PDF document', version: ascii(b, 5, 8).replace(/[^0-9.]/g, '') };
    // Some PDFs have junk before the header; readers accept the header within the first 1 KB.
    if (b.length > 8) { const head = ascii(b, 0, Math.min(b.length, 1024)); const at = head.indexOf('%PDF-'); if (at > 0) return { kind: 'pdf', ext: 'pdf', mime: 'application/pdf', label: 'PDF document', version: head.slice(at + 5, at + 8).replace(/[^0-9.]/g, '') }; }
    if (startsWith(b, [0x50, 0x4B, 0x03, 0x04])) return { kind: 'zip', ext: 'zip', mime: 'application/zip', label: 'ZIP-based file (ZIP, DOCX, XLSX…)' };
    if (startsWith(b, [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1])) return { kind: 'ole', ext: 'doc', mime: 'application/msword', label: 'Older Office file (DOC, XLS…)' };
    if (startsWith(b, [0x49, 0x49, 0x2A, 0x00]) || startsWith(b, [0x4D, 0x4D, 0x00, 0x2A])) return { kind: 'tiff', ext: 'tif', mime: 'image/tiff', label: 'TIFF image' };
    // UTF-16 text (Windows Notepad's "Unicode") starts with a byte-order mark and is full of zero bytes.
    if (b.length >= 2 && ((b[0] === 0xFF && b[1] === 0xFE) || (b[0] === 0xFE && b[1] === 0xFF))) return { kind: 'text', ext: 'txt', mime: 'text/plain', label: 'Plain text (UTF-16)', encoding: b[0] === 0xFF ? 'utf-16le' : 'utf-16be' };
    if (b.length && looksLikeText(b)) return { kind: 'text', ext: 'txt', mime: 'text/plain', label: 'Plain text' };
    return { kind: 'unknown', ext: '', mime: 'application/octet-stream', label: 'Unknown file type' };
  }

  function looksLikeText(b) {
    const n = Math.min(b.length, 4096);
    let control = 0;
    for (let i = 0; i < n; i++) {
      const c = b[i];
      if (c === 0) return false;
      if (c < 9 || (c > 13 && c < 32)) control++;
    }
    return control / Math.max(n, 1) < 0.02;
  }

  async function sniffFile(file) {
    const head = await file.slice(0, 1024).arrayBuffer();
    return sniff(new Uint8Array(head));
  }

  const RESERVED = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/i;
  // Invisible characters that change the direction of text. In a name they can disguise the real
  // extension: "invoice\u202Efdp.exe" is displayed as "invoiceexe.pdf".
  const HIDDEN_DIRECTION = /[\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069]/g;
  /** The name without hidden direction characters, so it reads as it really is. */
  function withoutHiddenDirection(name) {
    return String(name == null ? '' : name).replace(HIDDEN_DIRECTION, '');
  }

  /** A file name that is safe on Windows, macOS, Linux and Android. Keeps the extension. */
  function safeFileName(name, fallback) {
    let s = String(name || '').normalize('NFC');
    s = s.replace(/^.*[\\/]/, '');                       // drop any path
    s = s.replace(HIDDEN_DIRECTION, '_');                 // characters that disguise the extension
    s = s.replace(/[\u0000-\u001f\u007f<>:"/\\|?*]/g, '_'); // reserved characters
    s = s.replace(/\s+/g, ' ').trim().replace(/^[.\s]+|[.\s]+$/g, '');
    const dot = s.lastIndexOf('.');
    let stem = dot > 0 ? s.slice(0, dot) : s;
    let ext = dot > 0 ? s.slice(dot + 1).replace(/[^A-Za-z0-9]/g, '').slice(0, 10) : '';
    if (!stem || RESERVED.test(stem)) stem = (fallback || 'file') + (stem ? '_' + stem : '');
    if (stem.length > 120) stem = stem.slice(0, 120).trim();
    return ext ? `${stem}.${ext.toLowerCase()}` : stem;
  }

  function stem(name) {
    const s = String(name || '');
    const dot = s.lastIndexOf('.');
    return dot > 0 ? s.slice(0, dot) : s;
  }

  function withExtension(name, ext) {
    return safeFileName(`${stem(safeFileName(name, 'file'))}.${ext}`);
  }

  function formatBytes(n) {
    if (!Number.isFinite(n) || n < 0) return '–';
    if (n < 1024) return `${n} B`;
    if (n < MB) return `${(n / 1024).toFixed(n < 10 * 1024 ? 1 : 0)} KB`;
    if (n < 1024 * MB) return `${(n / MB).toFixed(n < 10 * MB ? 1 : 0)} MB`;
    return `${(n / (1024 * MB)).toFixed(1)} GB`;
  }

  /** Save a Blob under a safe name. The object URL is released after the download starts. */
  function download(blob, name) {
    if (typeof document === 'undefined') return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = safeFileName(name, 'download');
    a.rel = 'noopener';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  /**
   * Check a picked file against what a tool accepts.
   * accept: array of kinds, e.g. ['image'] or ['pdf']. Returns { ok, info, error }.
   */
  async function validate(file, accept, limitBytes) {
    if (!file || typeof file.size !== 'number') return { ok: false, error: 'That is not a file.' };
    if (file.size === 0) return { ok: false, error: `${file.name || 'This file'} is empty (0 bytes).` };
    const info = await sniffFile(file);
    const kinds = Array.isArray(accept) ? accept : [accept];
    if (!kinds.includes(info.kind)) {
      if (info.kind === 'heic') return { ok: false, info, error: `${file.name} is an HEIC photo. Most browsers cannot open HEIC; on an iPhone choose "Most Compatible" in Settings → Camera → Formats, or share the photo as JPEG.` };
      const wanted = kinds.map(k => ({ image: 'an image (JPEG, PNG, WebP)', pdf: 'a PDF', text: 'a text file', zip: 'a ZIP or DOCX file', json: 'a JSON backup' }[k] || k)).join(' or ');
      const what = info.kind === 'unknown' ? 'not a recognised file type'
        : info.kind === 'text' ? 'a plain text file'
        : `${/^[AEIOU]/i.test(info.label) ? 'an' : 'a'} ${info.label}`;
      return { ok: false, info, error: `${file.name} is ${what}. This tool needs ${wanted}; choose a file of that type instead.` };
    }
    const limit = limitBytes || LIMITS[info.kind] || 50 * MB;
    if (file.size > limit) return { ok: false, info, error: `${file.name} is ${formatBytes(file.size)}. The limit for this tool is ${formatBytes(limit)}, to keep your browser responsive.` };
    return { ok: true, info };
  }

  return { sniff, sniffFile, safeFileName, withoutHiddenDirection, withExtension, stem, formatBytes, download, validate, LIMITS };
});
