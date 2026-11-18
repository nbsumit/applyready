/* ApplyReady image operations, shared by the batch tools and applicant workspaces.
   Runs on the main thread or inside a Web Worker (js/workers/image-worker.js), so it only uses
   APIs available in both: createImageBitmap, OffscreenCanvas (or a <canvas> on the main thread),
   Blob. Nothing leaves the device.

   process(blob, options, signal, onProgress) -> { blob, width, height, mime, bytes, quality, notes[], verified }

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
     allowShrink: when maxBytes cannot be met at the lowest quality, reduce the pixel size
     background: #rrggbb for transparent areas and padding when the output has no alpha
     verify:   (default true) decode the finished file and check its pixel size, type and bytes

   onProgress(fraction) is called with 0..1 as the work advances (decode, encode, size search).
   readHeader(bytes) reads pixel size and EXIF orientation from the first bytes of a file without
   decoding it, so oversized images are refused before they take memory.
*/
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ApplyReadyImageOps = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const MAX_SIDE = 12000;          // per side, after resizing
  const MAX_PIXELS = 50e6;         // decoded source, about 50 megapixels
  const HEADER_BYTES = 512 * 1024; // enough to pass a large EXIF block and reach the JPEG frame header
  const LOSSY = new Set(['image/jpeg', 'image/webp']);

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
   * Pixel size (as displayed, after EXIF orientation) from the first bytes of an image.
   * Returns { width, height, orientation, format } or null when the size cannot be read.
   */
  function readHeader(input) {
    const b = input instanceof Uint8Array ? input : new Uint8Array(input || []);
    const n = b.length;
    let w = 0, h = 0, orientation = 1, format = '';
    if (n > 3 && b[0] === 0xFF && b[1] === 0xD8) {
      format = 'jpeg';
      let i = 2;
      while (i + 4 <= n) {
        if (b[i] !== 0xFF) break;
        let marker = b[i + 1];
        if (marker === 0xFF) { i++; continue; }            // fill byte
        if (marker === 0xD8 || marker === 0x01 || (marker >= 0xD0 && marker <= 0xD7)) { i += 2; continue; }
        if (marker === 0xD9 || marker === 0xDA) break;      // end of image, start of scan
        const len = u16be(b, i + 2);
        if (len < 2) break;
        if (marker === 0xE1 && i + 10 <= n && tag(b, i + 4, 'Exif') && b[i + 8] === 0 && b[i + 9] === 0) {
          orientation = exifOrientation(b, i + 10, Math.min(n, i + 2 + len));
        }
        if ((marker >= 0xC0 && marker <= 0xCF) && marker !== 0xC4 && marker !== 0xC8 && marker !== 0xCC) {
          if (i + 9 <= n) { h = u16be(b, i + 5); w = u16be(b, i + 7); }
          break;
        }
        i += 2 + len;
      }
    } else if (n >= 24 && b[0] === 0x89 && tag(b, 1, 'PNG') && tag(b, 12, 'IHDR')) {
      format = 'png'; w = u32be(b, 16); h = u32be(b, 20);
    } else if (n >= 10 && (tag(b, 0, 'GIF87a') || tag(b, 0, 'GIF89a'))) {
      format = 'gif'; w = u16le(b, 6); h = u16le(b, 8);
    } else if (n >= 26 && tag(b, 0, 'BM')) {
      format = 'bmp'; w = Math.abs(u32le(b, 18) | 0); h = Math.abs(u32le(b, 22) | 0);
    } else if (n >= 30 && tag(b, 0, 'RIFF') && tag(b, 8, 'WEBP')) {
      format = 'webp';
      if (tag(b, 12, 'VP8 ') && b[23] === 0x9D && b[24] === 0x01 && b[25] === 0x2A) { w = u16le(b, 26) & 0x3FFF; h = u16le(b, 28) & 0x3FFF; }
      else if (tag(b, 12, 'VP8L') && b[20] === 0x2F) { w = 1 + (((b[22] & 0x3F) << 8) | b[21]); h = 1 + (((b[24] & 0x0F) << 10) | (b[23] << 2) | ((b[22] & 0xC0) >> 6)); }
      else if (tag(b, 12, 'VP8X')) { w = 1 + (b[24] | (b[25] << 8) | (b[26] << 16)); h = 1 + (b[27] | (b[28] << 8) | (b[29] << 16)); }
    }
    if (!w || !h) return null;
    const swap = orientation >= 5;
    return { width: swap ? h : w, height: swap ? w : h, orientation, format };
  }

  async function readHeaderOf(blob) {
    try { return readHeader(new Uint8Array(await blob.slice(0, HEADER_BYTES).arrayBuffer())); }
    catch (e) { return null; }
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

  async function decode(blob) {
    if (typeof createImageBitmap === 'function') {
      try { return await createImageBitmap(blob, { imageOrientation: 'from-image' }); }
      catch (e) {
        try { return await createImageBitmap(blob); } catch (e2) { /* fall through */ }
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

  const kb = n => `${Math.round(n / 1024)} KB`;

  /** Encode, meeting maxBytes by searching quality (lossy) and optionally shrinking. */
  async function encodeToTarget(source, p, opts, notes, signal, progress) {
    const mime = opts.mime;
    const lossy = LOSSY.has(mime);
    const quality = Math.max(0.05, Math.min(1, Number(opts.quality) || 0.9));
    let current = p;
    for (let shrinkStep = 0; shrinkStep < 12; shrinkStep++) {
      if (signal && signal.aborted) throw cancelled();
      const canvas = render(source, current, opts);
      let blob;
      try { blob = await canvasToBlob(canvas, mime, lossy ? quality : undefined); }
      catch (e) { release(canvas); throw e; }
      progress(0.5 + Math.min(shrinkStep, 4) * 0.08);
      if (blob.type && blob.type !== mime) {
        release(canvas);
        throw new Error(`This browser cannot save ${mime.replace('image/', '').toUpperCase()} files. Choose JPEG or PNG.`);
      }
      if (!opts.maxBytes || blob.size <= opts.maxBytes) { release(canvas); return { blob, plan: current, quality: lossy ? quality : null }; }
      if (lossy) {
        // Binary search for the highest quality under the limit.
        let lo = 0.05, hi = quality, best = null;
        const floor = await canvasToBlob(canvas, mime, lo);
        if (floor.size <= opts.maxBytes) {
          best = { blob: floor, q: lo };
          for (let i = 0; i < 7; i++) {
            if (signal && signal.aborted) { release(canvas); throw cancelled(); }
            const mid = (lo + hi) / 2;
            const candidate = await canvasToBlob(canvas, mime, mid);
            if (candidate.size <= opts.maxBytes) { best = { blob: candidate, q: mid }; lo = mid; } else { hi = mid; }
            progress(0.55 + i * 0.05);
          }
        }
        release(canvas);
        if (best) {
          const pct = Math.round(best.q * 100);
          if (best.q < 0.4) notes.push(`Quality was lowered to ${pct}% to fit under ${kb(opts.maxBytes)}; check that the picture is still clear.`);
          else notes.push(`Quality was lowered to ${pct}% to fit under ${kb(opts.maxBytes)}.`);
          return { blob: best.blob, plan: current, quality: best.q };
        }
        blob = floor;
      } else {
        release(canvas);
      }
      if (!opts.allowShrink) {
        throw new Error(`This image does not fit under ${kb(opts.maxBytes)} at ${current.width} × ${current.height} px${lossy ? ' even at the lowest quality' : ''}. Turn on "Allow smaller dimensions"${lossy ? '' : ', choose JPEG'} or raise the limit.`);
      }
      // Shrink proportionally to the overshoot, at least 10% per step.
      const ratio = Math.min(0.9, Math.sqrt(opts.maxBytes / blob.size) * 0.95);
      const w = Math.max(16, Math.round(current.width * ratio)), h = Math.max(16, Math.round(current.height * ratio));
      if (w === current.width && h === current.height) break;
      const sx = w / current.width, sy = h / current.height;
      current = { width: w, height: h, src: current.src, dst: { dx: Math.round(current.dst.dx * sx), dy: Math.round(current.dst.dy * sy), dw: Math.max(1, Math.round(current.dst.dw * sx)), dh: Math.max(1, Math.round(current.dst.dh * sy)) } };
      if (shrinkStep === 0) notes.push(`The pixel size was reduced to meet the ${kb(opts.maxBytes)} limit.`);
    }
    throw new Error(`Could not get this image under ${kb(opts.maxBytes)}. Raise the limit or choose a smaller size.`);
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
    // Refuse very large images before decoding them: a 100 MP photo needs 400 MB of memory.
    const header = await readHeaderOf(blob);
    if (header && header.width * header.height > MAX_PIXELS) {
      throw new Error(`This image is ${Math.round(header.width * header.height / 1e6)} megapixels (${header.width} × ${header.height} px), more than the ${MAX_PIXELS / 1e6} MP this tool can handle safely. Resize it on the phone or computer first.`);
    }
    progress(0.05);
    const source = await decode(blob);
    const srcW = source.width || source.naturalWidth, srcH = source.height || source.naturalHeight;
    try {
      if (signal && signal.aborted) throw cancelled();
      if (!srcW || !srcH) throw new Error('This image has no pixels. It may be damaged.');
      if (srcW * srcH > MAX_PIXELS) throw new Error(`This image is ${Math.round(srcW * srcH / 1e6)} megapixels, more than the ${MAX_PIXELS / 1e6} MP this tool can handle safely. Resize it on the phone or computer first.`);
      progress(0.25);
      const mime = outputMime(opts.format, opts.inputMime || blob.type);
      const p = plan(srcW, srcH, opts);
      if (p.width * p.height > MAX_PIXELS) throw new Error('The output size is too large. Choose smaller dimensions.');
      const transparent = mime !== 'image/jpeg' && opts.keepTransparency !== false && opts.resize !== 'pad';
      const res = await encodeToTarget(source, p, { mime, quality: opts.quality, maxBytes: opts.maxBytes, allowShrink: opts.allowShrink, background: opts.background, transparent }, notes, signal, progress);
      let out = res.blob;
      if (opts.minBytes && mime === 'image/jpeg' && out.size < opts.minBytes) {
        const padded = await padJpeg(out, opts.minBytes);
        if (!opts.maxBytes || padded.size <= opts.maxBytes) { out = padded; notes.push(`Padded to ${kb(out.size)} to meet the ${kb(opts.minBytes)} minimum; the picture is unchanged.`); }
      }
      if (opts.minBytes && out.size < opts.minBytes) notes.push(`The file is ${kb(out.size)}, below the ${kb(opts.minBytes)} minimum. Choose JPEG, or a larger size, to reach it.`);
      if (signal && signal.aborted) throw cancelled();
      progress(0.92);
      let verified = false;
      if (opts.verify !== false) verified = await verify(out, { mime, width: res.plan.width, height: res.plan.height, maxBytes: opts.maxBytes });
      progress(1);
      return { blob: out, width: res.plan.width, height: res.plan.height, mime, bytes: out.size, quality: res.quality, sourceWidth: srcW, sourceHeight: srcH, notes, verified };
    } finally {
      if (source && typeof source.close === 'function') source.close();
    }
  }

  const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

  return { process, plan, padJpeg, decode, verify, readHeader, outputMime, EXT, MAX_PIXELS, MAX_SIDE };
});
