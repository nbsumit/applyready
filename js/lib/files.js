/* ApplyReady file helpers: identify files by their content, make safe download names,
   format sizes and trigger downloads. Nothing here sends data anywhere.
   Files are untrusted input: the type is decided from the first bytes of the file, not from
   the name or the type the browser reports, and names are cleaned before they are reused. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ApplyReadyFiles = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Sizes: 1 KB is 1,000 bytes and 1 MB is 1,000,000 bytes everywhere on this site, so the same file
  // shows the same size in every tool (see formatBytes, maxBytes and minBytes below).
  const MB = 1000 * 1000;
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

  // Windows device names. They are reserved whatever follows the first dot: "CON.jpg" and "con.backup.jpg"
  // both name the device, so such a file cannot be created or extracted from a ZIP there.
  const RESERVED = /^(con|prn|aux|nul|com[0-9\u00b9\u00b2\u00b3]|lpt[0-9\u00b9\u00b2\u00b3])$/i;
  const reservedName = s => RESERVED.test(String(s).split('.')[0].trim());
  // Invisible characters that change the direction of text. In a name they can disguise the real
  // extension: "invoice\u202Efdp.exe" is displayed as "invoiceexe.pdf".
  const HIDDEN_DIRECTION = /[\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069]/g;
  /** The name without hidden direction characters, so it reads as it really is. */
  function withoutHiddenDirection(name) {
    return String(name == null ? '' : name).replace(HIDDEN_DIRECTION, '');
  }
  // Every picture type sniff() recognises as kind 'image'; messages name them all.
  const IMAGE_TYPES = 'JPEG, PNG, WebP, GIF, BMP or AVIF';

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
    if (!stem || reservedName(s)) stem = (fallback || 'file') + (stem ? '_' + stem : '');
    if (stem.length > 120) stem = stem.slice(0, 120).trim();
    return ext ? `${stem}.${ext.toLowerCase()}` : stem;
  }

  /**
   * What an image file holds besides one still picture, as a sorted list of kinds:
   *   'animation'   more than one frame (animated PNG or WebP)
   *   'camera'      EXIF, which can include the camera, date, location and orientation
   *   'description' XMP or IPTC description and editing data
   *   'text'        text notes or comments (PNG text chunks, JPEG comments)
   *   'date'        a PNG "last changed" time
   *   'other'       other embedded data (unknown JPEG application segments, extra pictures)
   * An empty list means a plain still picture: it can be handed back as it is instead of a re-encoded
   * copy without losing anything a new copy would remove. null means the file is not a JPEG, PNG or
   * WebP, or could not be read to the end, so nothing can be said about it.
   */
  function hiddenParts(bytes) {
    const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
    const n = b.length;
    const found = new Set();
    const done = () => Array.from(found).sort();
    const u32 = i => ((b[i] << 24) >>> 0) + (b[i + 1] << 16) + (b[i + 2] << 8) + b[i + 3];
    const le32 = i => b[i] + (b[i + 1] << 8) + (b[i + 2] << 16) + ((b[i + 3] << 24) >>> 0);
    if (startsWith(b, [0xFF, 0xD8, 0xFF])) {
      // Segments up to the image data. Plain: APP0 (JFIF), APP2 colour profile, APP14 (Adobe colour).
      for (let i = 2; i + 4 <= n;) {
        if (b[i] !== 0xFF) return null;
        const m = b[i + 1];
        if (m === 0xFF) { i++; continue; }
        if (m === 0x01 || (m >= 0xD0 && m <= 0xD7)) { i += 2; continue; }
        if (m === 0xDA) return done();
        if (m === 0xD9) return null;
        const len = (b[i + 2] << 8) | b[i + 3];
        const sig = ascii(b, i + 4, Math.min(n, i + 4 + Math.min(len - 2, 32)));
        if (m === 0xFE) found.add('text');
        else if (m === 0xE1) found.add(sig.startsWith('Exif') ? 'camera' : /^http:\/\/ns\.adobe\.com\/(xap|xmp)/.test(sig) ? 'description' : 'other');
        else if (m === 0xED) found.add('description');
        else if (m === 0xE2) { if (!sig.startsWith('ICC_PROFILE')) found.add('other'); }  // MPF: more pictures after this one
        else if (m >= 0xE3 && m <= 0xEF && m !== 0xEE) found.add('other');
        i += 2 + len;
      }
      return null;
    }
    if (startsWith(b, [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])) {
      for (let i = 8; i + 8 <= n;) {
        const len = u32(i), type = ascii(b, i + 4, i + 8);
        if (type === 'IEND') return done();
        if (type === 'acTL') found.add('animation');
        else if (type === 'eXIf') found.add('camera');
        else if (type === 'tIME') found.add('date');
        else if (/^(tEXt|zTXt|iTXt)$/.test(type)) {
          const key = ascii(b, i + 8, Math.min(n, i + 8 + Math.min(len, 80))).split('\0')[0];
          found.add(key === 'XML:com.adobe.xmp' ? 'description' : 'text');
        }
        i += 12 + len;
      }
      return null;
    }
    if (ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 12) === 'WEBP') {
      for (let i = 12; i + 8 <= n;) {
        const type = ascii(b, i, i + 4), len = le32(i + 4);
        if (type === 'VP8X') {
          if (b[i + 8] & 0x02) found.add('animation');
          if (b[i + 8] & 0x04) found.add('description');
          if (b[i + 8] & 0x08) found.add('camera');
        }
        if (type === 'ANIM' || type === 'ANMF') found.add('animation');
        else if (type === 'EXIF') found.add('camera');
        else if (type === 'XMP ') found.add('description');
        i += 8 + len + (len & 1);
      }
      return done();
    }
    return null;
  }

  /** True when an image file is a single still picture with no hidden details (see hiddenParts). */
  function plainStill(bytes) {
    const parts = hiddenParts(bytes);
    return !!parts && parts.length === 0;
  }

  function stem(name) {
    const s = String(name || '');
    const dot = s.lastIndexOf('.');
    return dot > 0 ? s.slice(0, dot) : s;
  }

  function withExtension(name, ext) {
    return safeFileName(`${stem(safeFileName(name, 'file'))}.${ext}`);
  }

  /** A whole number with thousands separators (51,200), the same in every browser and locale. */
  function grouped(n) {
    const [int, frac] = String(Math.round(Number(n) * 1000) / 1000).split('.');
    return int.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (frac ? '.' + frac : '');
  }

  const trimZeros = s => s.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');

  /**
   * A file size as people read it next to an upload limit. One rule for the whole site:
   * 1 KB = 1,000 bytes and 1 MB = 1,000,000 bytes, and sizes are rounded up (to 0.1 KB or 0.01 MB),
   * so a size never reads as under a limit it is over, whichever way a portal counts a KB. 505,000 bytes is "505 KB"; 505,001 bytes is "505.1 KB".
   */
  function formatBytes(n) {
    if (!Number.isFinite(n) || n < 0) return '–';
    if (n < 1000) return `${n} B`;
    const kb = Math.ceil(n / 100) / 10;
    if (kb < 1000) return `${trimZeros(kb.toFixed(1))} KB`;
    const mb = Math.ceil(n / 10000) / 100;
    if (mb < 1000) return `${trimZeros(mb.toFixed(2))} MB`;
    return `${trimZeros((Math.ceil(n / 1e7) / 100).toFixed(2))} GB`;
  }

  /** A size with its exact byte count: "49.9 KB (49,873 bytes)". */
  function formatExact(n) {
    return n < 1000 ? `${grouped(n)} bytes` : `${formatBytes(n)} (${grouped(n)} bytes)`;
  }

  /**
   * A size limit typed in KB, in bytes. A maximum is met at kb x 1,000 bytes, which is under the
   * limit however a portal counts a KB (1,000 or 1,024 bytes). A minimum is met at kb x 1,024 bytes,
   * which reaches it either way; when that would leave no room under the maximum (a 49 to 50 KB
   * range), the minimum is counted as kb x 1,000 bytes instead.
   */
  function maxBytes(kb) { return Math.floor(Number(kb) * 1000); }
  function minBytes(kb, maxKB) {
    const strict = Math.ceil(Number(kb) * 1024);
    return maxKB && strict > maxBytes(maxKB) ? Math.ceil(Number(kb) * 1000) : strict;
  }

  /**
   * A size that is over `limit`, written so that it reads as more than the limit. formatBytes
   * already rounds up; when two sizes still share a label, more decimals are shown, and "just over"
   * the limit when even three decimals would not tell them apart.
   */
  function formatOver(n, limit) {
    const shown = formatBytes(n);
    if (shown !== formatBytes(limit)) return shown;
    const [unit, word] = n >= 1000 * MB ? [1000 * MB, 'GB'] : n >= MB ? [MB, 'MB'] : [1000, 'KB'];
    for (let d = 1; d <= 4; d++) {
      const v = (Math.ceil(n / unit * 10 ** d) / 10 ** d).toFixed(d);
      if (Number(v) > limit / unit && v !== (Math.ceil(limit / unit * 10 ** d) / 10 ** d).toFixed(d)) return `${v} ${word}`;
    }
    return `just over ${formatBytes(limit)}`;
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
      const wanted = kinds.map(k => ({ image: `an image (${IMAGE_TYPES})`, pdf: 'a PDF', text: 'a text file', zip: 'a ZIP or DOCX file', json: 'a JSON backup' }[k] || k)).join(' or ');
      const what = info.kind === 'unknown' ? 'not a recognised file type'
        : info.kind === 'text' ? 'a plain text file'
        : `${/^[AEIOU]/i.test(info.label) ? 'an' : 'a'} ${info.label}`;
      return { ok: false, info, error: `${file.name} is ${what}. This tool needs ${wanted}; choose a file of that type instead.` };
    }
    const limit = limitBytes || LIMITS[info.kind] || 50 * MB;
    if (file.size > limit) return { ok: false, info, error: `${file.name} is ${formatOver(file.size, limit)}. The limit for this tool is ${formatBytes(limit)}, to keep your browser responsive.` };
    return { ok: true, info };
  }

  return { sniff, sniffFile, hiddenParts, plainStill, safeFileName, withoutHiddenDirection, withExtension, stem, grouped, formatBytes, formatExact, formatOver, maxBytes, minBytes, download, validate, LIMITS, MB };
});
