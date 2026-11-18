/* ApplyReady image operations, shared by the batch tools and applicant workspaces.
   Runs on the main thread or inside a Web Worker (js/workers/image-worker.js), so it only uses
   APIs available in both: createImageBitmap, OffscreenCanvas (or a <canvas> on the main thread),
   Blob. Nothing leaves the device.

   process(blob, options) -> { blob, width, height, mime, bytes, notes[] }

   options:
     resize:   'none' | 'fit' | 'fill' | 'pad' | 'exact' | 'scale'
                 fit   keep proportions, fit inside width x height (never enlarges unless upscale)
                 fill  crop the centre to exactly width x height
                 pad   fit inside, then pad with the background colour to exactly width x height
                 exact stretch to width x height
                 scale percent of the original (options.scale, 1-400)
     width, height, scale, upscale (bool)
     format:   'image/jpeg' | 'image/png' | 'image/webp' | 'keep'
     quality:  0.05-1 (lossy formats)
     maxBytes: target upper limit; quality is searched and, if allowShrink, the image is scaled down
     minBytes: JPEG only; the file is padded with a comment segment to reach it
     allowShrink: when maxBytes cannot be met at the lowest quality, reduce the pixel size
     background: CSS colour for transparent areas and padding when the output has no alpha
*/
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ApplyReadyImageOps = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const MAX_SIDE = 12000;          // per side, after resizing
  const MAX_PIXELS = 50e6;         // decoded source, about 50 megapixels
  const LOSSY = new Set(['image/jpeg', 'image/webp']);

  const clampInt = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(Number(v) || 0)));

  /** Pure geometry: where the source goes on the output canvas. */
  function plan(srcW, srcH, opts) {
    const o = opts || {};
    const mode = o.resize || 'none';
    const W = clampInt(o.width, 1, MAX_SIDE);
    const H = clampInt(o.height, 1, MAX_SIDE);
    const full = { sx: 0, sy: 0, sw: srcW, sh: srcH };
    if (mode === 'scale') {
      const f = Math.max(0.01, Math.min(4, (Number(o.scale) || 100) / 100));
      const w = clampInt(srcW * f, 1, MAX_SIDE), h = clampInt(srcH * f, 1, MAX_SIDE);
      return { width: w, height: h, src: full, dst: { dx: 0, dy: 0, dw: w, dh: h } };
    }
    if (mode === 'exact' && W && H) return { width: W, height: H, src: full, dst: { dx: 0, dy: 0, dw: W, dh: H } };
    if (mode === 'fill' && W && H) {
      const target = W / H, source = srcW / srcH;
      let sw = srcW, sh = srcH;
      if (source > target) sw = srcH * target; else sh = srcW / target;
      return { width: W, height: H, src: { sx: (srcW - sw) / 2, sy: (srcH - sh) / 2, sw, sh }, dst: { dx: 0, dy: 0, dw: W, dh: H } };
    }
    if ((mode === 'fit' || mode === 'pad') && (W || H)) {
      const boxW = W || MAX_SIDE, boxH = H || MAX_SIDE;
      let f = Math.min(boxW / srcW, boxH / srcH);
      if (!o.upscale) f = Math.min(f, 1);
      const w = clampInt(srcW * f, 1, MAX_SIDE), h = clampInt(srcH * f, 1, MAX_SIDE);
      if (mode === 'pad' && W && H) return { width: W, height: H, src: full, dst: { dx: Math.round((W - w) / 2), dy: Math.round((H - h) / 2), dw: w, dh: h } };
      return { width: w, height: h, src: full, dst: { dx: 0, dy: 0, dw: w, dh: h } };
    }
    const w = clampInt(srcW, 1, MAX_SIDE), h = clampInt(srcH, 1, MAX_SIDE);
    return { width: w, height: h, src: full, dst: { dx: 0, dy: 0, dw: w, dh: h } };
  }

  function makeCanvas(w, h) {
    if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
    if (typeof document !== 'undefined') { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
    throw new Error('This browser cannot draw images off screen.');
  }

  function canvasToBlob(canvas, mime, quality) {
    if (typeof canvas.convertToBlob === 'function') return canvas.convertToBlob({ type: mime, quality });
    return new Promise((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error('The browser could not encode this image.'))), mime, quality));
  }

  async function decode(blob) {
    if (typeof createImageBitmap === 'function') {
      try { return await createImageBitmap(blob, { imageOrientation: 'from-image' }); }
      catch (e) {
        try { return await createImageBitmap(blob); } catch (e2) { /* fall through */ }
      }
    }
    if (typeof Image !== 'undefined' && typeof URL !== 'undefined') {
      const url = URL.createObjectURL(blob);
      try {
        const img = new Image();
        img.decoding = 'async';
        img.src = url;
        await img.decode();
        return img;
      } finally { URL.revokeObjectURL(url); }
    }
    throw new Error('This image could not be opened. It may be damaged or in a format this browser does not support.');
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
      nctx.imageSmoothingEnabled = true;
      nctx.imageSmoothingQuality = 'high';
      nctx.drawImage(src, sx, sy, sw, sh, 0, 0, w, h);
      if (temp && temp.width) { temp.width = 0; temp.height = 0; }
      temp = next; src = next; sx = 0; sy = 0; sw = w; sh = h;
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(src, sx, sy, sw, sh, d.dx, d.dy, d.dw, d.dh);
    if (temp) { temp.width = 0; temp.height = 0; }
  }

  function render(source, p, opts) {
    const canvas = makeCanvas(p.width, p.height);
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) throw new Error('Not enough memory to draw this image. Try a smaller size or fewer files at once.');
    const needsBackground = !opts.transparent;
    if (needsBackground) { ctx.fillStyle = opts.background || '#ffffff'; ctx.fillRect(0, 0, p.width, p.height); }
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

  /** Encode, meeting maxBytes by searching quality (lossy) and optionally shrinking. */
  async function encodeToTarget(source, p, opts, notes, signal) {
    const mime = opts.mime;
    const lossy = LOSSY.has(mime);
    let quality = Math.max(0.05, Math.min(1, Number(opts.quality) || 0.9));
    let current = p;
    for (let shrinkStep = 0; shrinkStep < 12; shrinkStep++) {
      if (signal && signal.aborted) throw new DOMException('Cancelled', 'AbortError');
      const canvas = render(source, current, opts);
      let blob = await canvasToBlob(canvas, mime, lossy ? quality : undefined);
      if (blob.type && blob.type !== mime) {
        canvas.width = 0; canvas.height = 0;
        throw new Error(`This browser cannot save ${mime.replace('image/', '').toUpperCase()} files. Choose JPEG or PNG.`);
      }
      if (!opts.maxBytes || blob.size <= opts.maxBytes) { canvas.width = 0; canvas.height = 0; return { blob, plan: current, quality }; }
      if (lossy) {
        // Binary search for the highest quality under the limit.
        let lo = 0.05, hi = quality, best = null;
        const floor = await canvasToBlob(canvas, mime, lo);
        if (floor.size <= opts.maxBytes) {
          best = { blob: floor, q: lo };
          for (let i = 0; i < 7; i++) {
            if (signal && signal.aborted) throw new DOMException('Cancelled', 'AbortError');
            const mid = (lo + hi) / 2;
            const candidate = await canvasToBlob(canvas, mime, mid);
            if (candidate.size <= opts.maxBytes) { best = { blob: candidate, q: mid }; lo = mid; } else { hi = mid; }
          }
        }
        canvas.width = 0; canvas.height = 0;
        if (best) {
          if (best.q < 0.4) notes.push(`Quality was lowered to ${Math.round(best.q * 100)}% to fit the size limit; check that the text is still readable.`);
          return { blob: best.blob, plan: current, quality: best.q };
        }
        blob = floor;
      } else {
        canvas.width = 0; canvas.height = 0;
      }
      if (!opts.allowShrink) {
        throw new Error(`Could not get this image under ${Math.round(opts.maxBytes / 1024)} KB at this pixel size${lossy ? ' even at the lowest quality' : ''}. Allow smaller dimensions${lossy ? '' : ', choose JPEG'} or raise the limit.`);
      }
      // Shrink proportionally to the overshoot, at least 10% per step.
      const ratio = Math.min(0.9, Math.sqrt(opts.maxBytes / blob.size) * 0.95);
      const w = Math.max(16, Math.round(current.width * ratio)), h = Math.max(16, Math.round(current.height * ratio));
      const sx = w / current.width, sy = h / current.height;
      current = { width: w, height: h, src: current.src, dst: { dx: Math.round(current.dst.dx * sx), dy: Math.round(current.dst.dy * sy), dw: Math.max(1, Math.round(current.dst.dw * sx)), dh: Math.max(1, Math.round(current.dst.dh * sy)) } };
      if (shrinkStep === 0) notes.push('The pixel size was reduced to meet the file-size limit.');
    }
    throw new Error('Could not reach the file-size limit. Raise the limit or choose a smaller size.');
  }

  function outputMime(format, inputMime) {
    if (format && format !== 'keep') return format;
    if (inputMime === 'image/png' || inputMime === 'image/webp' || inputMime === 'image/jpeg') return inputMime;
    return 'image/jpeg';
  }

  async function process(blob, options, signal) {
    const opts = Object.assign({ resize: 'none', format: 'keep', quality: 0.9, allowShrink: true }, options || {});
    const notes = [];
    const source = await decode(blob);
    const srcW = source.width || source.naturalWidth, srcH = source.height || source.naturalHeight;
    try {
      if (!srcW || !srcH) throw new Error('This image has no pixels. It may be damaged.');
      if (srcW * srcH > MAX_PIXELS) throw new Error(`This image is ${Math.round(srcW * srcH / 1e6)} megapixels, more than the ${MAX_PIXELS / 1e6} MP this tool can handle safely. Resize it on the phone or computer first.`);
      const mime = outputMime(opts.format, opts.inputMime || blob.type);
      const p = plan(srcW, srcH, opts);
      if (p.width * p.height > MAX_PIXELS) throw new Error('The output size is too large. Choose smaller dimensions.');
      const transparent = mime !== 'image/jpeg' && opts.keepTransparency !== false && opts.resize !== 'pad';
      const res = await encodeToTarget(source, p, { mime, quality: opts.quality, maxBytes: opts.maxBytes, allowShrink: opts.allowShrink, background: opts.background, transparent }, notes, signal);
      let out = res.blob;
      if (opts.minBytes && mime === 'image/jpeg' && out.size < opts.minBytes) {
        const padded = await padJpeg(out, opts.minBytes);
        if (!opts.maxBytes || padded.size <= opts.maxBytes) { out = padded; notes.push(`Padded to ${Math.round(out.size / 1024)} KB to meet the minimum size.`); }
      }
      if (opts.minBytes && out.size < opts.minBytes) notes.push(`The file is ${Math.round(out.size / 1024)} KB, below the ${Math.round(opts.minBytes / 1024)} KB minimum. Choose JPEG, or a larger size, to reach it.`);
      return { blob: out, width: res.plan.width, height: res.plan.height, mime, bytes: out.size, quality: res.quality, sourceWidth: srcW, sourceHeight: srcH, notes };
    } finally {
      if (source && typeof source.close === 'function') source.close();
    }
  }

  const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

  return { process, plan, padJpeg, decode, outputMime, EXT, MAX_PIXELS, MAX_SIDE };
});
