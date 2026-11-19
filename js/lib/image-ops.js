/* ApplyReady image operations, shared by the batch tools and applicant workspaces.
   Runs on the main thread or inside a Web Worker (js/workers/image-worker.js), so it only uses
   APIs available in both: createImageBitmap, OffscreenCanvas (or a <canvas> on the main thread),
   Blob. Nothing leaves the device.

   process(blob, options, signal, onProgress) -> { blob, width, height, mime, bytes, quality, reduced, notes[], verified }
     reduced: true when the pixel size was made smaller than planned to meet maxBytes

   options:
     resize:   'none' | 'fit' | 'fill' | 'pad' | 'exact' | 'scale'
                 fit   keep proportions, fit inside width x height (never enlarges unless upscale)
                 fill  crop the centre to exactly width x height
                 pad   fit inside, then pad with the background colour to exactly width x height
                 exact stretch to width x height
                 scale percent of the original (options.scale, 1-400)
     width, height, scale, upscale (bool)
     format:   'image/jpeg' | 'image/png' | 'image/webp' | 'keep'
     quality:  0.05-1 (lossy formats): the highest quality to use
     maxBytes: target upper limit; quality is searched and, if allowShrink, the image is scaled down
     minBytes: JPEG only; the file is padded with a comment segment to reach it
     minKB:    the minimum as the person typed it, for notes (minBytes is minKB x 1,024)
     allowShrink: when maxBytes cannot be met at 50% quality, reduce the pixel size instead of
                lowering quality further (without it, quality goes down to 5%)
     background: #rrggbb for transparent areas and padding when the output has no alpha
     verify:   (default true) decode the finished file and check its pixel size, type and bytes

   onProgress(fraction) is called with 0..1 as the work advances (decode, encode, size search).
   readHeader(bytes) reads pixel size and EXIF orientation from the first bytes of a file without
   decoding it, so oversized images are refused before they take memory; readHeaderFrom(blob) reads
   on past a large JPEG metadata block. checkHeader(blob, name) gives the refusal message for a picture
   that is too large or whose size cannot be read (both are refused before decoding).
   openImage(blob, { name, minSide }) opens a picked image for the single-image tools with the same
   checks (pixel limit from the header, a complete decode, a minimum size); see the function.
   setDensity(blob, dpi) records a print resolution in a finished JPEG or PNG.
*/
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ApplyReadyImageOps = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const MAX_SIDE = 12000;          // per side, after resizing
  const MAX_PIXELS = 50e6;         // decoded source, about 50 megapixels
  const MIN_SIDE = 20;             // a picture smaller than this on a side is too small to make one from
  const ENLARGE_WARN = 1.5;        // enlarged this much or more, a picture looks blurred (as in the resizer)
  const MAX_JPEG_STRAY = 64 * 1024; // stray bytes skipped between JPEG segments before giving up
  const HEADER_BYTES = 512 * 1024; // enough to pass a large EXIF block and reach the JPEG frame header
  const LOSSY = new Set(['image/jpeg', 'image/webp']);
  // With allowShrink on, quality is not lowered below this: a 12 MP photo squeezed to 100 KB at
  // 5% quality is a blocky mess, while the same photo at fewer pixels and 50% quality looks fine.
  const SHRINK_QUALITY_FLOOR = 0.5;

  const clampInt = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(Number(v) || 0)));
  // A dimension the person left empty is 0 ("not set"), never 1 px.
  const dim = v => (Number(v) > 0 ? clampInt(v, 1, MAX_SIDE) : 0);
  const cancelled = () => new DOMException('Cancelled', 'AbortError');

  /** Pure geometry: where the source goes on the output canvas. */
  function plan(srcW, srcH, opts) {
    const o = opts || {};
    const mode = o.resize || 'none';
    const W = dim(o.width);
    const H = dim(o.height);
    const full = { sx: 0, sy: 0, sw: srcW, sh: srcH };
    const whole = (w, h) => ({ width: w, height: h, src: full, dst: { dx: 0, dy: 0, dw: w, dh: h } });
    // Proportional size, never above MAX_SIDE on either side.
    const sized = f => {
      const k = Math.min(f, MAX_SIDE / srcW, MAX_SIDE / srcH);
      return [clampInt(srcW * k, 1, MAX_SIDE), clampInt(srcH * k, 1, MAX_SIDE)];
    };
    if (mode === 'scale') {
      const f = Math.max(0.01, Math.min(4, (Number(o.scale) || 100) / 100));
      return whole(...sized(f));
    }
    if (mode === 'exact' && W && H) return whole(W, H);
    if (mode === 'fill' && W && H) {
      const target = W / H, source = srcW / srcH;
      let sw = srcW, sh = srcH;
      if (source > target) sw = srcH * target; else sh = srcW / target;
      return { width: W, height: H, src: { sx: (srcW - sw) / 2, sy: (srcH - sh) / 2, sw, sh }, dst: { dx: 0, dy: 0, dw: W, dh: H } };
    }
    if ((mode === 'fit' || mode === 'pad') && (W || H)) {
      const boxW = W || MAX_SIDE, boxH = H || MAX_SIDE;
      let f = Math.min(boxW / srcW, boxH / srcH);
      if (!o.upscale && mode === 'fit') f = Math.min(f, 1);
      const [w, h] = sized(f);
      if (mode === 'pad' && W && H) {
        const pw = Math.min(w, W), ph = Math.min(h, H);
        return { width: W, height: H, src: full, dst: { dx: Math.round((W - pw) / 2), dy: Math.round((H - ph) / 2), dw: pw, dh: ph } };
      }
      return whole(w, h);
    }
    return whole(...sized(1));
  }

  /* ------------------------------------------------------------ header */
  const u16be = (b, i) => (b[i] << 8) | b[i + 1];
  const u16le = (b, i) => b[i] | (b[i + 1] << 8);
  const u32be = (b, i) => ((b[i] << 24) >>> 0) + (b[i + 1] << 16) + (b[i + 2] << 8) + b[i + 3];
  const u32le = (b, i) => b[i] + (b[i + 1] << 8) + (b[i + 2] << 16) + ((b[i + 3] << 24) >>> 0);
  const tag = (b, i, s) => s.split('').every((c, k) => b[i + k] === c.charCodeAt(0));

  function exifOrientation(b, start, end) {
    // start: first byte after "Exif\0\0" (the TIFF header)
    if (start + 8 > end) return 1;
    const le = tag(b, start, 'II');
    if (!le && !tag(b, start, 'MM')) return 1;
    const r16 = i => (le ? u16le(b, i) : u16be(b, i));
    const r32 = i => (le ? u32le(b, i) : u32be(b, i));
    const ifd = start + r32(start + 4);
    if (ifd + 2 > end) return 1;
    const count = r16(ifd);
    for (let k = 0; k < count; k++) {
      const entry = ifd + 2 + k * 12;
      if (entry + 12 > end) break;
      if (r16(entry) === 0x0112) { const v = r16(entry + 8); return v >= 1 && v <= 8 ? v : 1; }
    }
    return 1;
  }

  /**
   * The JPEG frame header: walks the segments from offset 2. Returns { width, height, orientation }
   * once the frame header (SOFn) is found, { next } when the bytes ran out first (the offset of the
   * next segment, so the caller can read on from there), or null when the layout is broken.
   * Stray bytes between segments (zero padding after APP0, say) are skipped up to the next marker,
   * as libjpeg and so the browser do (it only warns), within a bound.
   */
  function scanJpeg(b, from, orientationIn) {
    const n = b.length;
    let i = from, orientation = orientationIn || 1, stray = 0;
    while (i + 4 <= n) {
      // 0xFF 0x00 is a stuffed byte, not a marker: stray too.
      if (b[i] !== 0xFF || b[i + 1] === 0x00) {
        if (++stray > MAX_JPEG_STRAY) return null;
        i++;
        continue;
      }
      const marker = b[i + 1];
      if (marker === 0xFF) { i++; continue; }            // fill byte
      if (marker === 0xD8 || marker === 0x01 || (marker >= 0xD0 && marker <= 0xD7)) { i += 2; continue; }
      if (marker === 0xD9 || marker === 0xDA) return null; // end of image or start of scan before a frame
      const len = u16be(b, i + 2);
      if (len < 2) return null;
      if (marker === 0xE1 && i + 10 <= n && tag(b, i + 4, 'Exif') && b[i + 8] === 0 && b[i + 9] === 0) {
        orientation = exifOrientation(b, i + 10, Math.min(n, i + 2 + len));
      }
      if ((marker >= 0xC0 && marker <= 0xCF) && marker !== 0xC4 && marker !== 0xC8 && marker !== 0xCC) {
        if (i + 9 > n) return { next: i, orientation };
        return { height: u16be(b, i + 5), width: u16be(b, i + 7), orientation };
      }
      i += 2 + len;
    }
    return { next: i, orientation };
  }

  /**
   * A GIF's largest extent: the logical screen and every image frame found in the bytes given (a
   * frame can be far larger than the screen it claims, and browsers decode the frame).
   */
  function gifExtent(b) {
    const n = b.length;
    let w = u16le(b, 6), h = u16le(b, 8);
    let i = 13;
    if (b[10] & 0x80) i += 3 * (1 << ((b[10] & 7) + 1));
    const skipBlocks = j => { while (j < n && b[j] !== 0) j += b[j] + 1; return j + 1; };
    for (let guard = 0; i < n && guard < 100000; guard++) {
      if (b[i] === 0x21) i = skipBlocks(i + 2);
      else if (b[i] === 0x2C) {
        if (i + 10 > n) break;
        w = Math.max(w, u16le(b, i + 1) + u16le(b, i + 5));
        h = Math.max(h, u16le(b, i + 3) + u16le(b, i + 7));
        const flags = b[i + 9];
        i += 10;
        if (flags & 0x80) i += 3 * (1 << ((flags & 7) + 1));
        i = skipBlocks(i + 1); // the LZW minimum code size, then the image data
      } else break;           // 0x3B trailer, or bytes this reader does not know
    }
    return { w, h };
  }

  /**
   * AVIF (and HEIF): the largest image spatial extent ('ispe' in meta / iprp / ipco). A grid image
   * has its own ispe with the full output size, so the largest one is the size that gets decoded.
   */
  function isobmffExtent(b) {
    const n = b.length;
    let best = null, depth = 0;
    const boxes = (from, to, visit) => {
      if (++depth > 8) return;
      let i = from;
      while (i + 8 <= to) {
        let size = u32be(b, i), head = 8;
        const type = String.fromCharCode(b[i + 4], b[i + 5], b[i + 6], b[i + 7]);
        if (size === 1) { if (i + 16 > to) break; size = u32be(b, i + 8) * 4294967296 + u32be(b, i + 12); head = 16; }
        else if (size === 0) size = to - i;
        if (size < head) break;
        visit(type, i + head, Math.min(to, i + size));
        i += size;
      }
      depth--;
    };
    boxes(0, n, (t, s0, e0) => {
      if (t !== 'meta') return;
      boxes(s0 + 4, e0, (t1, s1, e1) => {          // meta is a full box: 4 bytes of version and flags
        if (t1 !== 'iprp') return;
        boxes(s1, e1, (t2, s2, e2) => {
          if (t2 !== 'ipco') return;
          boxes(s2, e2, (t3, s3, e3) => {
            if (t3 !== 'ispe' || s3 + 12 > e3) return;
            const w = u32be(b, s3 + 4), h = u32be(b, s3 + 8);
            if (!best || w * h > best.w * best.h) best = { w, h };
          });
        });
      });
    });
    return best;
  }

  /**
   * Pixel size (as displayed, after EXIF orientation) from the first bytes of an image.
   * Returns { width, height, orientation, format } or null when the size cannot be read.
   * A JPEG whose frame header lies past the bytes given returns null here; readHeaderFrom(blob)
   * reads on from the file until it finds it.
   */
  function readHeader(input) {
    const r = headerOrNext(input);
    return r && r.width ? r : null;
  }

  function headerOrNext(input) {
    const b = input instanceof Uint8Array ? input : new Uint8Array(input || []);
    const n = b.length;
    let w = 0, h = 0, orientation = 1, format = '';
    if (n > 3 && b[0] === 0xFF && b[1] === 0xD8) {
      format = 'jpeg';
      const r = scanJpeg(b, 2, 1);
      if (!r) return null;
      if (r.next !== undefined) return { format, next: r.next, orientation: r.orientation };
      w = r.width; h = r.height; orientation = r.orientation;
    } else if (n >= 24 && b[0] === 0x89 && tag(b, 1, 'PNG') && tag(b, 12, 'IHDR')) {
      format = 'png'; w = u32be(b, 16); h = u32be(b, 20);
    } else if (n >= 10 && (tag(b, 0, 'GIF87a') || tag(b, 0, 'GIF89a'))) {
      format = 'gif'; ({ w, h } = gifExtent(b));
    } else if (n >= 26 && tag(b, 0, 'BM')) {
      format = 'bmp';
      // An OS/2 bitmap core header (12 bytes) stores 16-bit sizes; the usual ones 32-bit.
      if (u32le(b, 14) === 12) { w = u16le(b, 18); h = u16le(b, 20); }
      else { w = Math.abs(u32le(b, 18) | 0); h = Math.abs(u32le(b, 22) | 0); }
    } else if (n >= 30 && tag(b, 0, 'RIFF') && tag(b, 8, 'WEBP')) {
      format = 'webp';
      if (tag(b, 12, 'VP8 ') && b[23] === 0x9D && b[24] === 0x01 && b[25] === 0x2A) { w = u16le(b, 26) & 0x3FFF; h = u16le(b, 28) & 0x3FFF; }
      else if (tag(b, 12, 'VP8L') && b[20] === 0x2F) { w = 1 + (((b[22] & 0x3F) << 8) | b[21]); h = 1 + (((b[24] & 0x0F) << 10) | (b[23] << 2) | ((b[22] & 0xC0) >> 6)); }
      else if (tag(b, 12, 'VP8X')) { w = 1 + (b[24] | (b[25] << 8) | (b[26] << 16)); h = 1 + (b[27] | (b[28] << 8) | (b[29] << 16)); }
    } else if (n >= 16 && tag(b, 4, 'ftyp')) {
      format = 'avif';
      const e = isobmffExtent(b);
      if (e) { w = e.w; h = e.h; }
    }
    if (!w || !h) return null;
    const swap = orientation >= 5;
    return { width: swap ? h : w, height: swap ? w : h, orientation, format };
  }

  /**
   * The header of an image file (a Blob), read without decoding it. A JPEG can carry megabytes of
   * metadata before its frame header; segments past the first HEADER_BYTES are skipped by reading
   * only their 4-byte headers. Null when the size cannot be read.
   */
  async function readHeaderFrom(blob) {
    try {
      let r = headerOrNext(new Uint8Array(await blob.slice(0, HEADER_BYTES).arrayBuffer()));
      for (let hops = 0; r && r.next !== undefined && hops < 20000 && r.next < blob.size; hops++) {
        const at = r.next;
        const chunk = new Uint8Array(await blob.slice(at, at + 16).arrayBuffer());
        // Read on from this segment: the scan restarts at offset 0 of a 16-byte window.
        const step = scanJpeg(chunk, 0, r.orientation);
        if (!step) return null;
        if (step.next === undefined) return finishJpeg(step);
        if (step.next === 0) return null;
        // Only the segment length was read: jump over the segment without reading it.
        r = { format: 'jpeg', next: at + step.next, orientation: step.orientation };
      }
      return r && r.width ? r : null;
    } catch (e) { return null; }
  }
  const finishJpeg = r => {
    const swap = r.orientation >= 5;
    return { width: swap ? r.height : r.width, height: swap ? r.width : r.height, orientation: r.orientation, format: 'jpeg' };
  };
  const readHeaderOf = readHeaderFrom;

  /** Megapixels for a message, to 0.1, and never rounded down to the 50 MP limit it is over (50.1, not 50). */
  function megapixels(width, height) {
    const exact = width * height / 1e6;
    let mp = Math.round(exact * 10) / 10;
    if (exact > MAX_PIXELS / 1e6 && mp <= MAX_PIXELS / 1e6) mp = Math.ceil(exact * 10) / 10;
    return mp >= 100 ? String(Math.round(mp)) : String(mp);
  }

  /* ------------------------------------------------------------ drawing */
  function makeCanvas(w, h) {
    if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
    if (typeof document !== 'undefined') { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
    throw new Error('This browser cannot draw images off screen.');
  }
  const release = c => { if (c) { c.width = 0; c.height = 0; } };

  function canvasToBlob(canvas, mime, quality) {
    if (typeof canvas.convertToBlob === 'function') return canvas.convertToBlob({ type: mime, quality });
    return new Promise((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error('The browser could not encode this image. The device may be low on memory.'))), mime, quality));
  }

  const DECODE_ERROR = 'This image could not be opened. It may be damaged, or in a format this browser cannot read.';

  // Where createImageBitmap exists, a file it cannot decode is refused: an <img> would still accept
  // a truncated JPEG and show the missing part blank. The <img> route is only for browsers without it.
  async function decode(blob) {
    if (typeof createImageBitmap === 'function') {
      try { return await createImageBitmap(blob, { imageOrientation: 'from-image' }); }
      catch (e) {
        try { return await createImageBitmap(blob); } catch (e2) { throw new Error(DECODE_ERROR); }
      }
    }
    if (typeof Image !== 'undefined' && typeof URL !== 'undefined' && typeof document !== 'undefined') {
      const url = URL.createObjectURL(blob);
      try {
        const img = new Image();
        img.decoding = 'async';
        img.src = url;
        await img.decode();
        return img;
      } catch (e) { /* fall through */ } finally { URL.revokeObjectURL(url); }
    }
    throw new Error(DECODE_ERROR);
  }

  /** The message for a picture over MAX_PIXELS, worded as in every other tool that refuses one. */
  function tooManyPixelsMessage(width, height, name) {
    return `${name || 'This image'} is ${megapixels(width, height)} megapixels (${width} × ${height} px), more than the ${MAX_PIXELS / 1e6} MP that can be opened safely in a browser. Resize it on the phone or computer first.`;
  }

  /** The message for a picture too small to make anything from (openImage minSide, process). */
  function tooSmallMessage(width, height, name, min) {
    return `${name || 'This image'} is only ${width} × ${height} px, too small to make a usable picture from. Choose the original photo or a larger scan, at least ${min || MIN_SIDE} px on each side.`;
  }

  /** The message for a picture whose pixel size cannot be read from its file, so it is not decoded. */
  function unknownSizeMessage(name) {
    return `${name || 'This image'} could not be opened safely: its pixel size could not be read from the file, so it may be damaged or saved in a way this tool cannot check before opening it. Open it on your device and save it again as JPEG or PNG, or choose another file.`;
  }

  /**
   * Whether a picked image can be decoded safely, from its header alone: '' when it can, otherwise a
   * message with .code 'toolarge' (over MAX_PIXELS) or 'unknown' (its size cannot be read). A small
   * file can declare a huge picture, so a size that cannot be read is a reason to refuse, not to go
   * ahead: decoding a 2 KB AVIF of 16384 × 16384 px takes about 1.4 GB.
   * Returns { message, code, header }.
   */
  async function checkHeader(blob, name) {
    const header = await readHeaderFrom(blob);
    if (!header) return { message: unknownSizeMessage(name), code: 'unknown', header: null };
    if (header.width * header.height > MAX_PIXELS) return { message: tooManyPixelsMessage(header.width, header.height, name), code: 'toolarge', header };
    return { message: '', code: '', header };
  }

  /**
   * Open a picked image for a tool that shows it on the page (the resizer, signature cleaner, print
   * sheet, image to PDF), with the same checks the batch tools make before they use a file:
   *  - the pixel size is read from the header first, so a picture over MAX_PIXELS is refused before
   *    it takes any memory (a 400 KB PNG can declare 400 megapixels, 1.6 GB once decoded);
   *  - the whole file is decoded. A truncated or damaged JPEG fails here, where an <img> element
   *    would show it with the missing part blank and the tool would offer a partly blank result;
   *  - options.minSide: a picture smaller than this on either side is refused.
   * Returns { source, width, height, close() }. source can be passed to drawImage (an ImageBitmap,
   * or an <img> in a browser without createImageBitmap); close() frees its memory. Throws an Error
   * whose message can be shown to the person, with code 'toolarge', 'damaged' or 'toosmall'.
   * options.name: the file name used in messages (default: the blob's name).
   */
  async function openImage(blob, options) {
    const o = options || {};
    const name = o.name || (blob && blob.name) || 'This image';
    const fail = (code, message) => { const e = new Error(message); e.code = code; return e; };
    const damaged = () => fail('damaged', `${name} could not be opened. It may be damaged or only partly downloaded, or in a format this browser cannot read. Open it on your device to check it, or choose another file.`);
    const checked = await checkHeader(blob, name);
    if (checked.message) throw fail(checked.code === 'toolarge' ? 'toolarge' : 'damaged', checked.message);
    let source = null;
    try { source = await decode(blob); } catch (e) { throw damaged(); }
    const width = source.width || source.naturalWidth, height = source.height || source.naturalHeight;
    const close = () => { if (source && typeof source.close === 'function') source.close(); source = null; };
    if (!width || !height) { close(); throw damaged(); }
    if (width * height > MAX_PIXELS) { close(); throw fail('toolarge', tooManyPixelsMessage(width, height, name)); }
    if (o.minSide && Math.min(width, height) < o.minSide) {
      close();
      throw fail('toosmall', tooSmallMessage(width, height, name, o.minSide));
    }
    return { source, width, height, close };
  }

  /* ------------------------------------------------------------ print resolution */
  let crcTable = null;
  function crc32(bytes) {
    if (!crcTable) {
      crcTable = new Uint32Array(256);
      for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; crcTable[n] = c >>> 0; }
    }
    let c = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) c = crcTable[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  /**
   * Record a print resolution in a finished JPEG or PNG, so a print shop, Word or a photo viewer
   * shows it at its real size (3.5 × 4.5 cm at 300 DPI) instead of assuming 72 or 96 DPI. The
   * pixels are not touched. JPEG: the density fields of the JFIF APP0 header that canvas encoders
   * write. PNG: a pHYs chunk after IHDR (an existing one is replaced). Other types, or a file whose
   * header is not as expected, come back unchanged.
   */
  async function setDensity(blob, dpi) {
    const d = Math.round(Number(dpi));
    if (!blob || !(d > 0 && d < 65536)) return blob;
    try {
      const bytes = new Uint8Array(await blob.arrayBuffer());
      // SOI, then APP0 "JFIF\0": density unit at offset 13, X and Y density at 14-17.
      if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF && bytes[3] === 0xE0 && tag(bytes, 6, 'JFIF') && bytes[10] === 0) {
        bytes[13] = 1;                                  // dots per inch
        bytes[14] = (d >> 8) & 0xFF; bytes[15] = d & 0xFF;
        bytes[16] = (d >> 8) & 0xFF; bytes[17] = d & 0xFF;
        return new Blob([bytes], { type: 'image/jpeg' });
      }
      if (bytes.length > 33 && bytes[0] === 0x89 && tag(bytes, 1, 'PNG') && tag(bytes, 12, 'IHDR')) {
        const ppm = Math.round(d / 0.0254);             // pixels per metre, the only unit PNG has
        const chunk = new Uint8Array(21);
        chunk[3] = 9;
        chunk.set([0x70, 0x48, 0x59, 0x73], 4);         // "pHYs"
        for (const at of [8, 12]) { chunk[at] = (ppm >>> 24) & 0xFF; chunk[at + 1] = (ppm >>> 16) & 0xFF; chunk[at + 2] = (ppm >>> 8) & 0xFF; chunk[at + 3] = ppm & 0xFF; }
        chunk[16] = 1;                                  // unit: metre
        const crc = crc32(chunk.subarray(4, 17));
        chunk[17] = (crc >>> 24) & 0xFF; chunk[18] = (crc >>> 16) & 0xFF; chunk[19] = (crc >>> 8) & 0xFF; chunk[20] = crc & 0xFF;
        // Leave out any pHYs already there; the new one goes straight after IHDR, before IDAT.
        const parts = [bytes.subarray(0, 33), chunk];
        let i = 33, from = 33;
        while (i + 8 <= bytes.length) {
          const len = u32be(bytes, i);
          const end = i + 12 + len;
          if (end > bytes.length) break;
          if (tag(bytes, i + 4, 'pHYs')) { parts.push(bytes.subarray(from, i)); from = end; }
          if (tag(bytes, i + 4, 'IDAT') || tag(bytes, i + 4, 'IEND')) break;
          i = end;
        }
        parts.push(bytes.subarray(from));
        return new Blob(parts, { type: 'image/png' });
      }
    } catch (e) { /* keep the file as it was */ }
    return blob;
  }

  /**
   * Draw in steps of at most 2x reduction. One big drawImage step from 4000 px to 300 px
   * aliases fine detail (signatures lose strokes); halving keeps lines smooth.
   */
  function drawStepped(ctx, source, s, d) {
    let src = source, sx = s.sx, sy = s.sy, sw = s.sw, sh = s.sh;
    let temp = null;
    while (sw / d.dw > 2.2 && sh / d.dh > 2.2) {
      const w = Math.max(d.dw, Math.round(sw / 2)), h = Math.max(d.dh, Math.round(sh / 2));
      const next = makeCanvas(w, h);
      const nctx = next.getContext('2d');
      if (!nctx) { release(next); break; }
      nctx.imageSmoothingEnabled = true;
      nctx.imageSmoothingQuality = 'high';
      nctx.drawImage(src, sx, sy, sw, sh, 0, 0, w, h);
      release(temp);
      temp = next; src = next; sx = 0; sy = 0; sw = w; sh = h;
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(src, sx, sy, sw, sh, d.dx, d.dy, d.dw, d.dh);
    release(temp);
  }

  const safeColour = c => (/^#[0-9a-f]{6}$/i.test(String(c || '')) ? c : '#ffffff');

  function render(source, p, opts) {
    const canvas = makeCanvas(p.width, p.height);
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) { release(canvas); throw new Error('Not enough memory to draw this image. Try a smaller size or fewer files at once.'); }
    if (!opts.transparent) { ctx.fillStyle = safeColour(opts.background); ctx.fillRect(0, 0, p.width, p.height); }
    drawStepped(ctx, source, p.src, p.dst);
    return canvas;
  }

  /* JPEG padding: insert zero-filled COM segments after the JFIF APP0 header, so portals that
     reject files below a minimum KB accept the result. The image data is untouched. */
  async function padJpeg(blob, minBytes) {
    if (!minBytes || blob.size >= minBytes) return blob;
    const bytes = new Uint8Array(await blob.arrayBuffer());
    if (bytes[0] !== 0xFF || bytes[1] !== 0xD8) return blob;
    let insertAt = 2;
    if (bytes[2] === 0xFF && bytes[3] === 0xE0) insertAt = 4 + ((bytes[4] << 8) | bytes[5]);
    let needed = minBytes - bytes.length;
    const segments = [];
    while (needed > 0) {
      const payload = Math.min(65533, Math.max(1, needed - 4));
      const seg = new Uint8Array(payload + 4);
      seg[0] = 0xFF; seg[1] = 0xFE; seg[2] = ((payload + 2) >> 8) & 0xFF; seg[3] = (payload + 2) & 0xFF;
      segments.push(seg);
      needed -= seg.length;
    }
    return new Blob([bytes.slice(0, insertAt), ...segments, bytes.slice(insertAt)], { type: 'image/jpeg' });
  }

  // Sizes in the site's one format (js/lib/files.js formatBytes, which this file cannot load inside a
  // worker): 1 KB = 1,000 bytes, rounded up to 0.1 KB, so a size never reads as under a limit it is over.
  // A maximum of N KB arrives as N x 1,000 bytes and reads "N KB". A minimum arrives as N x 1,024
  // bytes (met however a portal counts), so its label is the KB the person typed (opts.minKB).
  const kb = n => (n < 1000 * 1000 ? `${String(Math.ceil(n / 100) / 10)} KB` : `${String(Math.ceil(n / 10000) / 100)} MB`);
  const minLabel = o => (o.minKB ? `${o.minKB} KB` : kb(o.minBytes));

  /** The same layout at a fraction k of the pixel size (at least 16 px a side). */
  function scaledPlan(p, k) {
    const w = Math.max(16, Math.round(p.width * k)), h = Math.max(16, Math.round(p.height * k));
    const sx = w / p.width, sy = h / p.height;
    return { width: w, height: h, src: p.src, dst: { dx: Math.round(p.dst.dx * sx), dy: Math.round(p.dst.dy * sy), dw: Math.max(1, Math.round(p.dst.dw * sx)), dh: Math.max(1, Math.round(p.dst.dh * sy)) } };
  }

  /**
   * Encode, meeting maxBytes. Lossy formats: the highest quality under the limit is searched
   * (down to 5%, or to SHRINK_QUALITY_FLOOR when allowShrink is on). If that is not enough and
   * allowShrink is on, the largest pixel size that fits at the floor quality is found by bisection,
   * then the quality is raised again as far as the limit allows at that size.
   */
  async function encodeToTarget(source, p, opts, notes, signal, progress) {
    const mime = opts.mime;
    const lossy = LOSSY.has(mime);
    const quality = Math.max(0.05, Math.min(1, Number(opts.quality) || 0.9));
    const floorQ = lossy ? (opts.allowShrink ? Math.min(quality, SHRINK_QUALITY_FLOOR) : 0.05) : undefined;
    const limit = opts.maxBytes;
    const check = () => { if (signal && signal.aborted) throw cancelled(); };

    async function encode(plan, q) {
      check();
      const canvas = render(source, plan, opts);
      try { return await canvasToBlob(canvas, mime, q); } finally { release(canvas); }
    }
    // Highest quality in [lo, hi] under the limit on one canvas; lo is known to fit.
    async function raiseQuality(plan, lo, loBlob, hi) {
      const canvas = render(source, plan, opts);
      let best = { blob: loBlob, q: lo };
      try {
        for (let i = 0; i < 7 && hi - lo > 0.01; i++) {
          check();
          const mid = (lo + hi) / 2;
          const candidate = await canvasToBlob(canvas, mime, mid);
          if (candidate.size <= limit) { best = { blob: candidate, q: mid }; lo = mid; } else hi = mid;
          progress(0.7 + i * 0.03);
        }
      } finally { release(canvas); }
      return best;
    }
    const qualityNote = q => {
      if (q >= quality - 0.005) return;
      const pct = Math.round(q * 100);
      notes.push(q < 0.4 ? `Quality was lowered to ${pct}% to fit under ${kb(limit)}; check that the picture is still clear.` : `Quality was lowered to ${pct}% to fit under ${kb(limit)}.`);
    };

    const first = await encode(p, lossy ? quality : undefined);
    progress(0.5);
    if (first.type && first.type !== mime) throw new Error(`This browser cannot save ${mime.replace('image/', '').toUpperCase()} files. Choose JPEG or PNG.`);
    if (!limit || first.size <= limit) return { blob: first, plan: p, quality: lossy ? quality : null };

    // 1. Lower the quality at the planned size.
    let floorBlob = first;
    if (lossy && floorQ < quality) {
      floorBlob = await encode(p, floorQ);
      progress(0.55);
      if (floorBlob.size <= limit) {
        const best = await raiseQuality(p, floorQ, floorBlob, quality);
        qualityNote(best.q);
        return { blob: best.blob, plan: p, quality: best.q };
      }
    }
    if (!opts.allowShrink) {
      // The code and detail let a page word this for its own settings (the workspace has no such switch).
      const err = new Error(`This image does not fit under ${kb(limit)} at ${p.width} × ${p.height} px${lossy ? ' even at the lowest quality' : ''}. Turn on "Allow smaller dimensions"${lossy ? '' : ', choose JPEG'} or raise the limit.`);
      err.code = 'nofit';
      err.detail = { limit, width: p.width, height: p.height, lossy };
      throw err;
    }

    // 2. Find the largest pixel size that fits at the floor quality: estimate from the overshoot
    //    (bytes grow roughly with the pixel count), then bisect between a size that fits and one
    //    that does not until they are within 5% of each other.
    let fitK = 0, fitBlob = null, overK = 1, k = Math.min(0.9, Math.sqrt(limit / floorBlob.size) * 0.95);
    for (let step = 0; step < 10; step++) {
      const plan = scaledPlan(p, k);
      const blob = await encode(plan, floorQ);
      progress(0.58 + Math.min(step, 4) * 0.03);
      if (blob.size <= limit) { fitK = k; fitBlob = blob; } else overK = k;
      if (fitK && overK / fitK < 1.05) break;
      if (!fitK && (plan.width === 16 || plan.height === 16)) break;
      k = fitK ? Math.sqrt(fitK * overK) : k * Math.min(0.9, Math.sqrt(limit / blob.size) * 0.95);
    }
    if (!fitK) throw new Error(`Could not get this image under ${kb(limit)}. Raise the limit or choose a smaller size.`);
    const plan = scaledPlan(p, fitK);
    notes.push(`The pixel size was reduced to meet the ${kb(limit)} limit.`);
    // 3. At that size, raise the quality again as far as the limit allows.
    if (!lossy) return { blob: fitBlob, plan, quality: null };
    const best = await raiseQuality(plan, floorQ, fitBlob, quality);
    qualityNote(best.q);
    return { blob: best.blob, plan, quality: best.q };
  }

  function outputMime(format, inputMime) {
    if (format && format !== 'keep') return format;
    if (inputMime === 'image/png' || inputMime === 'image/webp' || inputMime === 'image/jpeg') return inputMime;
    return 'image/jpeg';
  }

  const MAGIC = {
    'image/jpeg': b => b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF,
    'image/png': b => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47,
    'image/webp': b => tag(b, 0, 'RIFF') && tag(b, 8, 'WEBP')
  };

  /** Read the finished file back: right type, decodable, the promised pixel size and byte limit. */
  async function verify(out, expect) {
    const head = new Uint8Array(await out.slice(0, 16).arrayBuffer());
    if (MAGIC[expect.mime] && !MAGIC[expect.mime](head)) throw new Error('The finished file did not pass its check (wrong file type). Try again.');
    if (expect.maxBytes && out.size > expect.maxBytes) throw new Error(`The finished file is ${kb(out.size)}, over the ${kb(expect.maxBytes)} limit. Try again with a lower limit.`);
    let check;
    try { check = await decode(out); } catch (e) { throw new Error('The finished file could not be read back. Try again, or choose another format.'); }
    const w = check.width || check.naturalWidth, h = check.height || check.naturalHeight;
    if (typeof check.close === 'function') check.close();
    if (w !== expect.width || h !== expect.height) throw new Error(`The finished file did not pass its check (expected ${expect.width} × ${expect.height} px, got ${w} × ${h}). Try again.`);
    return true;
  }

  async function process(blob, options, signal, onProgress) {
    const opts = Object.assign({ resize: 'none', format: 'keep', quality: 0.9, allowShrink: true, verify: true }, options || {});
    const progress = f => { if (typeof onProgress === 'function') { try { onProgress(f); } catch (e) { /* ignore */ } } };
    const notes = [];
    if (signal && signal.aborted) throw cancelled();
    // Refuse very large images before decoding them: a 100 MP photo needs 400 MB of memory. An image
    // whose size cannot be read is refused too (checkHeader).
    const checked = await checkHeader(blob);
    if (checked.message) throw new Error(checked.message);
    progress(0.05);
    const source = await decode(blob);
    const srcW = source.width || source.naturalWidth, srcH = source.height || source.naturalHeight;
    try {
      if (signal && signal.aborted) throw cancelled();
      if (!srcW || !srcH) throw new Error('This image has no pixels. It may be damaged.');
      if (srcW * srcH > MAX_PIXELS) throw new Error(tooManyPixelsMessage(srcW, srcH));
      progress(0.25);
      const mime = outputMime(opts.format, opts.inputMime || blob.type);
      const p = plan(srcW, srcH, opts);
      if (p.width * p.height > MAX_PIXELS) throw new Error('The output size is too large. Choose smaller dimensions.');
      // The same rule as the resizer: a picture is not blown up from a few pixels without a word.
      const grown = Math.max(p.dst.dw / p.src.sw, p.dst.dh / p.src.sh);
      if (grown > 1 && Math.min(srcW, srcH) < MIN_SIDE) throw new Error(tooSmallMessage(srcW, srcH));
      if (grown >= ENLARGE_WARN) notes.push(`The picture was enlarged ${grown >= 10 ? Math.round(grown) : grown.toFixed(1)} times to make ${p.width} × ${p.height} px, so it will look blurred or blocky. Use the original photo or a larger scan if you have one.`);
      const transparent = mime !== 'image/jpeg' && opts.keepTransparency !== false && opts.resize !== 'pad';
      const res = await encodeToTarget(source, p, { mime, quality: opts.quality, maxBytes: opts.maxBytes, allowShrink: opts.allowShrink, background: opts.background, transparent }, notes, signal, progress);
      let out = res.blob;
      if (opts.minBytes && mime === 'image/jpeg' && out.size < opts.minBytes) {
        const padded = await padJpeg(out, opts.minBytes);
        if (!opts.maxBytes || padded.size <= opts.maxBytes) { out = padded; notes.push(`Padded to ${kb(out.size)} to meet the ${minLabel(opts)} minimum; the picture is unchanged.`); }
      }
      if (opts.minBytes && out.size < opts.minBytes) notes.push(`The file is ${kb(out.size)}, below the ${minLabel(opts)} minimum. Choose JPEG, or a larger size, to reach it.`);
      if (signal && signal.aborted) throw cancelled();
      progress(0.92);
      let verified = false;
      if (opts.verify !== false) verified = await verify(out, { mime, width: res.plan.width, height: res.plan.height, maxBytes: opts.maxBytes });
      progress(1);
      return { blob: out, width: res.plan.width, height: res.plan.height, mime, bytes: out.size, quality: res.quality, sourceWidth: srcW, sourceHeight: srcH, reduced: res.plan !== p, notes, verified };
    } finally {
      if (source && typeof source.close === 'function') source.close();
    }
  }

  const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

  return { process, plan, padJpeg, decode, verify, readHeader, readHeaderFrom, checkHeader, megapixels, outputMime, openImage, tooManyPixelsMessage, unknownSizeMessage, setDensity, EXT, MAX_PIXELS, MAX_SIDE, MIN_SIDE };
});
