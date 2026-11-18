/* ApplyReady file inspection: read what a file really is and what it carries, without changing it.

   Used by the File checker (file-checker.html) and tested in Node (tests/doc_tools_unit_tests.js).
   Everything here works on bytes the browser already has; nothing is sent anywhere.

   ApplyReadyInspect.inspect(source, { name, type, PDFLib }) -> Promise<report>
     source   a File/Blob, a Uint8Array, or a reader { size, read(offset, length) -> Promise<Uint8Array> }
   ApplyReadyInspect.checkRequirements(report, requirement) -> { rows, pass, applicable }
   ApplyReadyInspect.stripMetadata(bytes, kind) -> { bytes, removed, kept, orientation, trailing }
   Lower-level parsers (parseJpeg, parsePng, parseWebp, parseGif, parseBmp, parseTiff, inspectPdf,
   inspectZip) are exported for tests.

   Files are untrusted. Every parser checks bounds before it reads, caps loops, and returns
   `damaged: true` with a plain reason instead of throwing on bad input. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./files.js'));
  else root.ApplyReadyInspect = factory(root.ApplyReadyFiles);
})(typeof self !== 'undefined' ? self : this, function (Files) {
  'use strict';

  const KB = 1024;
  const MB = 1024 * 1024;
  // Deep inspection reads the whole file into memory; these limits keep a phone responsive.
  // Larger files still get their real type and size.
  const DEEP_LIMITS = { image: 50 * MB, pdf: 100 * MB, zip: 500 * MB, text: 5 * MB };
  const MAX_XML = 2 * MB; // largest docProps part we inflate (protects against ZIP bombs)

  /* ------------------------------------------------------------------ small helpers */
  const latin1 = (b, from, to) => {
    let s = '';
    const end = Math.min(to, b.length);
    for (let i = from; i < end; i++) s += String.fromCharCode(b[i]);
    return s;
  };
  const u16be = (b, o) => (b[o] << 8) | b[o + 1];
  const u32be = (b, o) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
  const u16le = (b, o) => b[o] | (b[o + 1] << 8);
  const u24le = (b, o) => b[o] | (b[o + 1] << 8) | (b[o + 2] << 16);
  const u32le = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
  const i32le = (b, o) => b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24);
  const startsAscii = (b, o, s) => { if (o + s.length > b.length) return false; for (let i = 0; i < s.length; i++) if (b[o + i] !== s.charCodeAt(i)) return false; return true; };
  const clean = (s, max) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max || 200);

  function utf8(b) {
    try { return new TextDecoder('utf-8').decode(b); } catch (e) { return latin1(b, 0, b.length); }
  }

  /** Find an ASCII pattern in bytes. Returns the index or -1. */
  function indexOfAscii(b, pattern, from, to) {
    const first = pattern.charCodeAt(0);
    const end = Math.min(to == null ? b.length : to, b.length) - pattern.length;
    let i = from || 0;
    while (i <= end) {
      i = b.indexOf(first, i);
      if (i < 0 || i > end) return -1;
      if (startsAscii(b, i, pattern)) return i;
      i++;
    }
    return -1;
  }
  function countAscii(b, pattern, cap) {
    let n = 0, i = 0;
    while ((i = indexOfAscii(b, pattern, i)) >= 0) { n++; i += pattern.length; if (n >= (cap || 1000)) break; }
    return n;
  }

  let crcTable = null;
  function crc32(b, from, to) {
    if (!crcTable) {
      crcTable = new Uint32Array(256);
      for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; crcTable[n] = c >>> 0; }
    }
    let c = 0xFFFFFFFF;
    for (let i = from; i < to; i++) c = crcTable[(c ^ b[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  function concat(parts) {
    const total = parts.reduce((n, p) => n + p.length, 0);
    const out = new Uint8Array(total);
    let at = 0;
    for (const p of parts) { out.set(p, at); at += p.length; }
    return out;
  }

  /** Number with thousands separators, independent of the browser's locale. */
  function group(n) {
    const [int, frac] = String(n).split('.');
    return int.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (frac ? '.' + frac : '');
  }

  /** Sizes the way upload forms state them: bytes, KB of 1,024 bytes, MB of 1,048,576 bytes. */
  function sizes(n) {
    return { bytes: n, kb: n / KB, mb: n / MB, text: `${group(n)} bytes`, kbText: `${group((n / KB).toFixed(1))} KB`, mbText: `${(n / MB).toFixed(n < 0.1 * MB ? 3 : n < 10 * MB ? 2 : 1)} MB` };
  }

  /* ------------------------------------------------------------------ TIFF / EXIF */
  const TIFF_TYPES = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8 };
  const ORIENTATION = {
    1: 'Normal', 2: 'Mirrored', 3: 'Rotated 180°', 4: 'Mirrored and rotated 180°',
    5: 'Mirrored and rotated 90°', 6: 'Rotated 90° clockwise', 7: 'Mirrored and rotated 270°', 8: 'Rotated 90° anticlockwise'
  };

  /**
   * Parse a TIFF structure (EXIF data in JPEG, PNG eXIf and WebP EXIF chunks, and TIFF images).
   * Returns null when it is not TIFF. Reads only the tags the checker reports.
   */
  function parseTiff(t) {
    if (!t || t.length < 8) return null;
    const le = t[0] === 0x49 && t[1] === 0x49;
    const be = t[0] === 0x4D && t[1] === 0x4D;
    if (!le && !be) return null;
    const u16 = o => (o + 2 <= t.length ? (le ? u16le(t, o) : u16be(t, o)) : 0);
    const u32 = o => (o + 4 <= t.length ? (le ? u32le(t, o) : u32be(t, o)) : 0);
    if (u16(2) !== 42) return null;
    const visited = new Set();

    function readIfd(offset) {
      const tags = new Map();
      if (!offset || offset + 2 > t.length || visited.has(offset)) return { tags, next: 0 };
      visited.add(offset);
      const count = Math.min(u16(offset), 1000);
      for (let i = 0; i < count; i++) {
        const e = offset + 2 + i * 12;
        if (e + 12 > t.length) break;
        const tag = u16(e), type = u16(e + 2), n = u32(e + 4);
        const size = (TIFF_TYPES[type] || 0) * n;
        const at = size <= 4 ? e + 8 : u32(e + 8);
        tags.set(tag, { type, count: n, at, size });
      }
      const nextAt = offset + 2 + count * 12;
      return { tags, next: nextAt + 4 <= t.length ? u32(nextAt) : 0 };
    }
    function value(entry) {
      if (!entry || entry.at + entry.size > t.length || entry.size === 0) return undefined;
      const { type, count, at } = entry;
      if (type === 2) return clean(latin1(t, at, at + Math.min(count, 400)).replace(/\0[\s\S]*$/, ''), 200);
      if (type === 3) return u16(at);
      if (type === 4 || type === 9) return u32(at);
      if (type === 5 || type === 10) {
        const out = [];
        for (let i = 0; i < Math.min(count, 8); i++) { const d = u32(at + i * 8 + 4); out.push(d ? u32(at + i * 8) / d : 0); }
        return count === 1 ? out[0] : out;
      }
      if (type === 1 || type === 7) return t[at];
      return undefined;
    }

    const ifd0 = readIfd(u32(4));
    const get = (ifd, tag) => value(ifd.tags.get(tag));
    const out = {
      byteOrder: le ? 'little-endian' : 'big-endian',
      make: get(ifd0, 0x010F) || '', model: get(ifd0, 0x0110) || '', software: get(ifd0, 0x0131) || '',
      dateTime: get(ifd0, 0x0132) || '', artist: get(ifd0, 0x013B) || '', copyright: get(ifd0, 0x8298) || '',
      orientation: get(ifd0, 0x0112) || 0, xResolution: get(ifd0, 0x011A) || 0, yResolution: get(ifd0, 0x011B) || 0,
      resolutionUnit: get(ifd0, 0x0128) || 2, width: get(ifd0, 0x0100) || 0, height: get(ifd0, 0x0101) || 0,
      dateTimeOriginal: '', lens: '', serial: '', owner: '', gps: null, thumbnail: false, tagCount: ifd0.tags.size
    };
    if (typeof out.orientation !== 'number' || out.orientation < 1 || out.orientation > 8) out.orientation = 0;
    const exifPtr = get(ifd0, 0x8769);
    if (exifPtr) {
      const exif = readIfd(exifPtr);
      out.tagCount += exif.tags.size;
      out.dateTimeOriginal = get(exif, 0x9003) || '';
      out.lens = get(exif, 0xA434) || '';
      out.serial = get(exif, 0xA431) || '';
      out.owner = get(exif, 0xA430) || '';
    }
    const gpsPtr = get(ifd0, 0x8825);
    if (gpsPtr) {
      const gps = readIfd(gpsPtr);
      out.tagCount += gps.tags.size;
      const lat = get(gps, 2), lon = get(gps, 4);
      const latRef = get(gps, 1), lonRef = get(gps, 3);
      const deg = v => (Array.isArray(v) && v.length >= 3 ? v[0] + v[1] / 60 + v[2] / 3600 : typeof v === 'number' ? v : null);
      const la = deg(lat), lo = deg(lon);
      if (la !== null || lo !== null || gps.tags.size > 1) {
        out.gps = {
          latitude: la === null ? null : (String(latRef).toUpperCase().startsWith('S') ? -la : la),
          longitude: lo === null ? null : (String(lonRef).toUpperCase().startsWith('W') ? -lo : lo),
          tags: gps.tags.size
        };
      }
    }
    if (ifd0.next) { const ifd1 = readIfd(ifd0.next); out.thumbnail = ifd1.tags.size > 0; }
    return out;
  }

  /** The smallest EXIF block that keeps only the orientation, so a cleaned photo is not shown sideways. */
  function minimalTiff(orientation) {
    const t = new Uint8Array(26);
    t.set([0x4D, 0x4D, 0x00, 0x2A, 0, 0, 0, 8, 0, 1, 0x01, 0x12, 0, 3, 0, 0, 0, 1, 0, orientation, 0, 0, 0, 0, 0, 0]);
    return t;
  }

  function dpiFromTiff(x) {
    if (!x || !x.xResolution) return null;
    const f = x.resolutionUnit === 3 ? 2.54 : x.resolutionUnit === 1 ? 0 : 1;
    if (!f) return null;
    return { x: Math.round(x.xResolution * f), y: Math.round((x.yResolution || x.xResolution) * f), source: 'EXIF' };
  }

  /* ------------------------------------------------------------------ JPEG */
  const SOF = new Set([0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF]);

  /**
   * Walk the segments of a JPEG. `onSegment(marker, start, end, payloadStart)` sees every marker
   * segment (start..end are the bytes to copy); entropy-coded data after SOS is reported as
   * marker -1. Returns { eoi, damaged, reason }.
   */
  function walkJpeg(b, onSegment) {
    if (!(b[0] === 0xFF && b[1] === 0xD8)) return { damaged: true, reason: 'The file does not start like a JPEG.' };
    let i = 2;
    let guard = 0;
    while (i < b.length) {
      if (++guard > 100000) return { damaged: true, reason: 'Too many segments.' };
      if (b[i] !== 0xFF) return { damaged: true, reason: 'Unexpected data between JPEG segments.', at: i };
      const m = b[i + 1];
      if (m === undefined) return { damaged: true, reason: 'The file ends in the middle of a segment.' };
      if (m === 0xFF) { i++; continue; }
      if (m === 0xD9) { onSegment(0xD9, i, i + 2, i + 2); return { eoi: i + 2 }; }
      if ((m >= 0xD0 && m <= 0xD7) || m === 0x01) { onSegment(m, i, i + 2, i + 2); i += 2; continue; }
      if (i + 4 > b.length) return { damaged: true, reason: 'The file ends in the middle of a segment.' };
      const len = u16be(b, i + 2);
      if (len < 2 || i + 2 + len > b.length) return { damaged: true, reason: 'A JPEG segment is cut off; the file looks incomplete.' };
      onSegment(m, i, i + 2 + len, i + 4);
      i += 2 + len;
      if (m === 0xDA) {
        // Entropy-coded data: runs until a marker that is not a stuffed byte (FF00) or a restart (FFD0-FFD7).
        let j = i;
        for (;;) {
          j = b.indexOf(0xFF, j);
          if (j < 0 || j + 1 >= b.length) { onSegment(-1, i, b.length, i); return { damaged: true, reason: 'The image data is cut off before the end marker; the file looks incomplete.' }; }
          const n = b[j + 1];
          if (n === 0x00 || (n >= 0xD0 && n <= 0xD7)) { j += 2; continue; }
          if (n === 0xFF) { j += 1; continue; }
          break;
        }
        onSegment(-1, i, j, i);
        i = j;
      }
    }
    return { damaged: true, reason: 'The JPEG end marker is missing; the file looks incomplete.' };
  }

  function parseJpeg(b) {
    const out = {
      format: 'JPEG', width: 0, height: 0, components: 0, bitDepth: 8, progressive: false, colour: '',
      density: null, exif: null, xmp: false, xmpGps: false, icc: false, iptc: false, adobe: false, mpf: false, jfxx: false,
      comments: [], otherApp: [], metadataBytes: 0, trailing: 0, damaged: false, reason: ''
    };
    const res = walkJpeg(b, (m, start, end, p) => {
      const size = end - start;
      if (m === 0xE0) {
        if (startsAscii(b, p, 'JFIF\0') && end - p >= 14) {
          const units = b[p + 7], x = u16be(b, p + 8), y = u16be(b, p + 10);
          if (units === 1 || units === 2) out.density = { x: Math.round(units === 2 ? x * 2.54 : x), y: Math.round(units === 2 ? y * 2.54 : y), source: 'JFIF' };
        } else if (startsAscii(b, p, 'JFXX\0')) { out.jfxx = true; out.metadataBytes += size; }
      } else if (m === 0xE1) {
        out.metadataBytes += size;
        if (startsAscii(b, p, 'Exif\0')) out.exif = parseTiff(b.subarray(p + 6, end)) || out.exif;
        else if (startsAscii(b, p, 'http://ns.adobe.com/xap/1.0/') || startsAscii(b, p, 'http://ns.adobe.com/xmp/extension/')) {
          out.xmp = true;
          if (indexOfAscii(b, 'GPSLatitude', p, end) >= 0 || indexOfAscii(b, 'GPSLongitude', p, end) >= 0) out.xmpGps = true;
        } else out.otherApp.push('APP1');
      } else if (m === 0xE2) {
        if (startsAscii(b, p, 'ICC_PROFILE\0')) out.icc = true;
        else { out.metadataBytes += size; if (startsAscii(b, p, 'MPF\0')) out.mpf = true; else out.otherApp.push('APP2'); }
      } else if (m === 0xED) { out.metadataBytes += size; out.iptc = true; }
      else if (m === 0xEE && startsAscii(b, p, 'Adobe')) out.adobe = true;
      else if (m >= 0xE3 && m <= 0xEF) { out.metadataBytes += size; out.otherApp.push('APP' + (m - 0xE0)); }
      else if (m === 0xFE) { out.metadataBytes += size; if (out.comments.length < 5) out.comments.push(clean(latin1(b, p, Math.min(end, p + 300)), 120)); }
      else if (SOF.has(m) && !out.width && end - p >= 6) {
        out.bitDepth = b[p];
        out.height = u16be(b, p + 1);
        out.width = u16be(b, p + 3);
        out.components = b[p + 5];
        out.progressive = m === 0xC2 || m === 0xC6 || m === 0xCA || m === 0xCE;
      }
    });
    if (res.damaged) { out.damaged = true; out.reason = res.reason; }
    if (res.eoi && res.eoi < b.length) out.trailing = b.length - res.eoi;
    out.colour = out.components === 1 ? 'Greyscale' : out.components === 3 ? 'Colour (RGB)' : out.components === 4 ? 'CMYK (print colours)' : out.components ? `${out.components} channels` : '';
    out.alpha = false;
    if (!out.density) out.density = dpiFromTiff(out.exif);
    if (!out.width && !out.damaged) { out.damaged = true; out.reason = 'No image size was found in this JPEG.'; }
    return out;
  }

  /* ------------------------------------------------------------------ PNG */
  const PNG_SIG = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
  const PNG_COLOUR = { 0: 'Greyscale', 2: 'Colour (RGB)', 3: 'Indexed colour (palette)', 4: 'Greyscale with transparency', 6: 'Colour with transparency (RGBA)' };
  const PNG_METADATA = new Set(['tEXt', 'iTXt', 'zTXt', 'eXIf', 'tIME']);

  function walkPng(b, onChunk) {
    if (!PNG_SIG.every((v, i) => b[i] === v)) return { damaged: true, reason: 'The file does not start like a PNG.' };
    let i = 8, guard = 0;
    while (i + 12 <= b.length) {
      if (++guard > 200000) return { damaged: true, reason: 'Too many chunks.' };
      const len = u32be(b, i);
      const type = latin1(b, i + 4, i + 8);
      if (!/^[A-Za-z]{4}$/.test(type)) return { damaged: true, reason: 'Unexpected data inside the PNG.' };
      if (i + 12 + len > b.length) return { damaged: true, reason: `The ${type} chunk is cut off; the file looks incomplete.` };
      onChunk(type, i, i + 12 + len, i + 8, len);
      i += 12 + len;
      if (type === 'IEND') return { end: i };
    }
    return { damaged: true, reason: 'The PNG end marker (IEND) is missing; the file looks incomplete.' };
  }

  function parsePng(b, options) {
    const verifyCrc = !options || options.crc !== false;
    const out = {
      format: 'PNG', width: 0, height: 0, bitDepth: 0, colourType: -1, colour: '', interlaced: false, alpha: false, transparency: '',
      density: null, exif: null, text: [], time: '', icc: false, iccName: '', animated: false, metadataBytes: 0, crcErrors: 0, trailing: 0, damaged: false, reason: ''
    };
    const res = walkPng(b, (type, start, end, data, len) => {
      if (verifyCrc && type !== 'IDAT' && crc32(b, start + 4, end - 4) !== u32be(b, end - 4)) out.crcErrors++;
      if (type === 'IHDR' && len >= 13) {
        out.width = u32be(b, data); out.height = u32be(b, data + 4);
        out.bitDepth = b[data + 8]; out.colourType = b[data + 9]; out.interlaced = b[data + 12] === 1;
      } else if (type === 'tRNS') { out.transparency = 'tRNS'; }
      else if (type === 'pHYs' && len >= 9) {
        const x = u32be(b, data), y = u32be(b, data + 4);
        if (b[data + 8] === 1) out.density = { x: Math.round(x * 0.0254), y: Math.round(y * 0.0254), source: 'pHYs' };
      } else if (type === 'iCCP') { out.icc = true; out.iccName = clean(latin1(b, data, Math.min(data + 80, end - 4)).split('\0')[0], 79); }
      else if (type === 'acTL') out.animated = true;
      if (PNG_METADATA.has(type)) {
        out.metadataBytes += end - start;
        if (type === 'eXIf') out.exif = parseTiff(b.subarray(data, data + len));
        else if (type === 'tIME' && len >= 7) out.time = `${u16be(b, data)}-${String(b[data + 2]).padStart(2, '0')}-${String(b[data + 3]).padStart(2, '0')} ${String(b[data + 4]).padStart(2, '0')}:${String(b[data + 5]).padStart(2, '0')}`;
        else if (out.text.length < 20) {
          const raw = b.subarray(data, data + len);
          const nul = raw.indexOf(0);
          const keyword = clean(latin1(raw, 0, nul < 0 ? Math.min(raw.length, 79) : nul), 79);
          let value = '';
          if (type === 'tEXt' && nul >= 0) value = clean(latin1(raw, nul + 1, Math.min(raw.length, nul + 400)), 120);
          else if (type === 'iTXt' && nul >= 0 && raw[nul + 1] === 0) {
            let p = nul + 3;
            for (let k = 0; k < 2 && p < raw.length; k++) { const z = raw.indexOf(0, p); p = z < 0 ? raw.length : z + 1; }
            value = clean(utf8(raw.subarray(p, Math.min(raw.length, p + 400))), 120);
          } else value = '(compressed text)';
          out.text.push({ type, keyword, value });
        }
      }
    });
    if (res.damaged) { out.damaged = true; out.reason = res.reason; }
    if (res.end && res.end < b.length) out.trailing = b.length - res.end;
    out.colour = PNG_COLOUR[out.colourType] || '';
    out.alpha = out.colourType === 4 || out.colourType === 6 || !!out.transparency;
    if (!out.width && !out.damaged) { out.damaged = true; out.reason = 'No image header (IHDR) was found.'; }
    if (out.crcErrors && !out.damaged) { out.damaged = true; out.reason = `${out.crcErrors} chunk${out.crcErrors === 1 ? '' : 's'} failed the PNG checksum; the file may be damaged.`; }
    if (!out.density) out.density = dpiFromTiff(out.exif);
    return out;
  }

  /* ------------------------------------------------------------------ WebP, GIF, BMP, TIFF, HEIC */
  function parseWebp(b) {
    const out = { format: 'WebP', width: 0, height: 0, alpha: false, animated: false, exif: null, xmp: false, icc: false, lossless: false, colour: 'Colour (RGB)', metadataBytes: 0, damaged: false, reason: '' };
    let i = 12, guard = 0;
    while (i + 8 <= b.length && ++guard < 10000) {
      const type = latin1(b, i, i + 4), len = u32le(b, i + 4), d = i + 8;
      if (d + len > b.length) { out.damaged = true; out.reason = 'The WebP data is cut off; the file looks incomplete.'; break; }
      if (type === 'VP8X' && len >= 10) {
        const f = b[d];
        out.icc = !!(f & 0x20); out.alpha = !!(f & 0x10); out.animated = !!(f & 0x02);
        out.width = u24le(b, d + 4) + 1; out.height = u24le(b, d + 7) + 1;
      } else if (type === 'VP8 ' && len >= 10 && !out.width) {
        out.width = u16le(b, d + 6) & 0x3FFF; out.height = u16le(b, d + 8) & 0x3FFF;
      } else if (type === 'VP8L' && len >= 5 && !out.width) {
        out.lossless = true;
        const bits = u32le(b, d + 1);
        out.width = (bits & 0x3FFF) + 1; out.height = ((bits >>> 14) & 0x3FFF) + 1; out.alpha = out.alpha || !!((bits >>> 28) & 1);
      } else if (type === 'EXIF') {
        out.metadataBytes += len + 8;
        const off = startsAscii(b, d, 'Exif\0\0') ? 6 : 0;
        out.exif = parseTiff(b.subarray(d + off, d + len));
      } else if (type === 'XMP ') { out.xmp = true; out.metadataBytes += len + 8; }
      else if (type === 'ICCP') out.icc = true;
      else if (type === 'ANIM') out.animated = true;
      if (type === 'VP8L') out.lossless = true;
      i = d + len + (len & 1);
    }
    if (!out.width && !out.damaged) { out.damaged = true; out.reason = 'No image size was found in this WebP.'; }
    if (out.alpha) out.colour = 'Colour with transparency';
    out.density = dpiFromTiff(out.exif);
    return out;
  }

  function parseGif(b) {
    const out = { format: 'GIF', width: u16le(b, 6), height: u16le(b, 8), frames: 0, alpha: false, animated: false, comments: [], colour: 'Indexed colour (palette)', metadataBytes: 0, density: null, damaged: false, reason: '' };
    let i = 13;
    if (b[10] & 0x80) i += 3 * (1 << ((b[10] & 7) + 1));
    const skipBlocks = j => { let g = 0; while (j < b.length && b[j] !== 0 && ++g < 1e6) j += b[j] + 1; return j + 1; };
    let guard = 0;
    while (i < b.length && ++guard < 200000) {
      const c = b[i];
      if (c === 0x3B) break;
      if (c === 0x21) {
        const label = b[i + 1];
        if (label === 0xF9 && b[i + 3] & 1) out.alpha = true;
        if (label === 0xFE) { const start = i; i = skipBlocks(i + 2); out.metadataBytes += i - start; if (out.comments.length < 3) out.comments.push(clean(latin1(b, start + 3, Math.min(i - 1, start + 200)), 120)); continue; }
        i = skipBlocks(i + 2);
      } else if (c === 0x2C) {
        out.frames++;
        let j = i + 10;
        if (b[i + 9] & 0x80) j += 3 * (1 << ((b[i + 9] & 7) + 1));
        i = skipBlocks(j + 1);
      } else { out.damaged = true; out.reason = 'Unexpected data inside the GIF.'; break; }
    }
    if (i >= b.length && !out.damaged) { out.damaged = true; out.reason = 'The GIF is cut off before its end marker.'; }
    out.animated = out.frames > 1;
    return out;
  }

  function parseBmp(b) {
    const out = { format: 'BMP', width: 0, height: 0, bitDepth: 0, alpha: false, colour: '', density: null, metadataBytes: 0, damaged: false, reason: '' };
    if (b.length < 30) { out.damaged = true; out.reason = 'The BMP header is incomplete.'; return out; }
    const header = u32le(b, 14);
    if (header === 12) { out.width = u16le(b, 18); out.height = u16le(b, 20); out.bitDepth = u16le(b, 24); }
    else { out.width = Math.abs(i32le(b, 18)); out.height = Math.abs(i32le(b, 22)); out.bitDepth = u16le(b, 28); }
    if (header >= 40 && b.length >= 46) {
      const x = u32le(b, 38), y = u32le(b, 42);
      if (x) out.density = { x: Math.round(x * 0.0254), y: Math.round(y * 0.0254), source: 'BMP header' };
    }
    out.alpha = out.bitDepth === 32;
    out.colour = out.bitDepth <= 8 ? 'Indexed colour (palette)' : out.alpha ? 'Colour with transparency' : 'Colour (RGB)';
    return out;
  }

  function parseTiffImage(b) {
    const t = parseTiff(b);
    if (!t) return { format: 'TIFF', width: 0, height: 0, damaged: true, reason: 'The TIFF header could not be read.' };
    return { format: 'TIFF', width: t.width, height: t.height, exif: t, density: dpiFromTiff(t), colour: '', alpha: false, metadataBytes: 0, damaged: false, reason: '' };
  }

  /** HEIC and AVIF: the largest 'ispe' (image spatial extent) box is the full picture. */
  function parseHeif(b, format) {
    const out = { format, width: 0, height: 0, alpha: false, colour: '', density: null, metadataBytes: 0, damaged: false, reason: '' };
    let i = 0, guard = 0;
    while ((i = indexOfAscii(b, 'ispe', i, Math.min(b.length, 4 * MB))) >= 0 && ++guard < 200) {
      const w = u32be(b, i + 8), h = u32be(b, i + 12);
      if (w * h > out.width * out.height && w < 100000 && h < 100000) { out.width = w; out.height = h; }
      i += 4;
    }
    out.exifPresent = indexOfAscii(b, 'Exif', 0, Math.min(b.length, 4 * MB)) >= 0;
    return out;
  }

  /* ------------------------------------------------------------------ PDF */
  const PAPERS = [['A4', 210, 297], ['US Letter', 215.9, 279.4], ['US Legal', 215.9, 355.6], ['A3', 297, 420], ['A5', 148, 210], ['B5', 176, 250]];
  const ptToMm = pt => pt * 25.4 / 72;

  function paperName(wMm, hMm) {
    const short = Math.min(wMm, hMm), long = Math.max(wMm, hMm);
    const p = PAPERS.find(([, a, c]) => Math.abs(short - a) <= 3 && Math.abs(long - c) <= 3);
    return p ? p[0] : '';
  }

  function toIso(d) {
    return d instanceof Date && !isNaN(d) ? d.toISOString() : '';
  }

  /**
   * Inspect a PDF with pdf-lib. Never throws: a file pdf-lib cannot parse is reported as damaged.
   * Encrypted files are opened without a password when they allow it (restrictions only); otherwise
   * only the page structure is read.
   */
  async function inspectPdf(b, PDFLib) {
    const head = latin1(b, 0, Math.min(b.length, 1024));
    const at = head.indexOf('%PDF-');
    const out = {
      version: at >= 0 ? (head.slice(at + 5, at + 8).match(/\d\.\d/) || [''])[0] : '',
      pages: 0, pageSizes: [], sizeGroups: [], mixedSizes: false, mixedOrientation: false,
      encrypted: false, needsPassword: false, metadata: {}, xmpMetadata: false, javascript: false, attachments: false,
      forms: false, updates: Math.max(0, countAscii(b.subarray(Math.max(0, b.length - 4 * MB)), '%%EOF', 50) - 1), linearized: /\/Linearized/.test(head),
      damaged: false, reason: '', truncated: indexOfAscii(b, '%%EOF', Math.max(0, b.length - 2048)) < 0
    };
    out.encrypted = indexOfAscii(b, '/Encrypt', Math.max(0, b.length - 8 * MB)) >= 0;
    out.javascript = indexOfAscii(b, '/JavaScript') >= 0;
    out.attachments = indexOfAscii(b, '/EmbeddedFiles') >= 0;
    out.forms = indexOfAscii(b, '/AcroForm') >= 0;
    if (!PDFLib) { out.reason = 'The PDF reader did not load.'; return out; }
    let doc = null;
    try {
      doc = await PDFLib.PDFDocument.load(b, { updateMetadata: false });
    } catch (e) {
      if (/encrypt/i.test(String(e && e.message))) {
        out.encrypted = true;
        try { doc = await PDFLib.PDFDocument.load(b, { password: '', updateMetadata: false }); out.restricted = true; }
        catch (e2) {
          out.needsPassword = true;
          try { doc = await PDFLib.PDFDocument.load(b, { ignoreEncryption: true, updateMetadata: false }); } catch (e3) { doc = null; }
        }
      }
      if (!doc) { out.damaged = true; out.reason = out.needsPassword ? 'This PDF needs a password to open.' : out.truncated ? 'This PDF is incomplete: its end is missing, so it could not be read. Download or export it again.' : 'This PDF could not be read. It may be damaged or incomplete.'; return out; }
    }
    try {
      const pages = doc.getPages();
      out.pages = pages.length;
      const groups = new Map();
      pages.forEach((p, idx) => {
        const box = p.getCropBox ? p.getCropBox() : p.getSize();
        const rot = ((p.getRotation().angle % 360) + 360) % 360;
        let w = box.width, h = box.height;
        if (rot === 90 || rot === 270) [w, h] = [h, w];
        const wMm = Math.round(ptToMm(w)), hMm = Math.round(ptToMm(h));
        const key = `${Math.min(wMm, hMm)}x${Math.max(wMm, hMm)}`;
        const orient = w > h + 1 ? 'landscape' : h > w + 1 ? 'portrait' : 'square';
        if (out.pageSizes.length < 2000) out.pageSizes.push({ widthMm: wMm, heightMm: hMm, orientation: orient });
        if (!groups.has(key)) groups.set(key, { widthMm: wMm, heightMm: hMm, widthIn: +(w / 72).toFixed(2), heightIn: +(h / 72).toFixed(2), paper: paperName(wMm, hMm), pages: [], orientations: new Set() });
        const g = groups.get(key);
        g.pages.push(idx + 1);
        g.orientations.add(orient);
      });
      out.sizeGroups = Array.from(groups.values()).map(g => ({ widthMm: g.widthMm, heightMm: g.heightMm, widthIn: g.widthIn, heightIn: g.heightIn, paper: g.paper, pages: g.pages, orientations: Array.from(g.orientations) }));
      out.mixedSizes = out.sizeGroups.length > 1;
      out.mixedOrientation = new Set(out.pageSizes.map(p => p.orientation).filter(o => o !== 'square')).size > 1;
    } catch (e) { out.damaged = true; out.reason = out.truncated ? 'This PDF is incomplete: its end is missing, so its pages could not be read. Download or export it again.' : 'The pages of this PDF could not be read. It may be damaged; most portals will reject it.'; }
    if (!out.needsPassword) {
      const safe = f => { try { return f(); } catch (e) { return undefined; } };
      const m = {
        title: safe(() => doc.getTitle()), author: safe(() => doc.getAuthor()), subject: safe(() => doc.getSubject()),
        keywords: safe(() => doc.getKeywords()), creator: safe(() => doc.getCreator()), producer: safe(() => doc.getProducer()),
        created: toIso(safe(() => doc.getCreationDate())), modified: toIso(safe(() => doc.getModificationDate()))
      };
      for (const k of Object.keys(m)) if (m[k]) out.metadata[k] = clean(m[k], 300);
      try {
        out.xmpMetadata = !!doc.catalog.get(PDFLib.PDFName.of('Metadata'));
        const v = doc.catalog.get(PDFLib.PDFName.of('Version'));
        if (v) { const s = String(v).replace(/^\//, ''); if (/^\d\.\d$/.test(s) && s > out.version) out.catalogVersion = s; }
      } catch (e) { /* optional */ }
    }
    return out;
  }

  /* ------------------------------------------------------------------ ZIP and Office files */
  function readerFrom(source) {
    if (source && typeof source.read === 'function' && typeof source.size === 'number') return source;
    if (source instanceof Uint8Array) return { size: source.length, read: async (o, l) => source.subarray(o, o + l), bytes: source };
    if (source && typeof source.slice === 'function' && typeof source.size === 'number') {
      return { size: source.size, read: async (o, l) => new Uint8Array(await source.slice(o, o + l).arrayBuffer()) };
    }
    throw new Error('Unsupported source');
  }

  function zipError(message, code) { const e = new Error(message); e.code = code || 'ZIP'; return e; }

  async function zipEntries(reader) {
    const size = reader.size;
    const tailLen = Math.min(size, 65557);
    const tail = await reader.read(size - tailLen, tailLen);
    let e = -1;
    for (let i = tail.length - 22; i >= 0; i--) if (tail[i] === 0x50 && tail[i + 1] === 0x4B && tail[i + 2] === 5 && tail[i + 3] === 6) { e = i; break; }
    if (e < 0) throw zipError('The ZIP directory at the end of the file is missing; the file looks incomplete or damaged.', 'DAMAGED');
    let count = u16le(tail, e + 10), cdSize = u32le(tail, e + 12), cdOffset = u32le(tail, e + 16);
    if (count === 0xFFFF || cdSize === 0xFFFFFFFF || cdOffset === 0xFFFFFFFF) {
      // ZIP64: the locator just before the end record points at the 64-bit end record.
      const locAt = size - tailLen + e - 20;
      const loc = locAt >= 0 ? await reader.read(locAt, 20) : new Uint8Array(0);
      if (!(loc[0] === 0x50 && loc[1] === 0x4B && loc[2] === 6 && loc[3] === 7)) throw zipError('This ZIP file uses a layout that could not be read.', 'DAMAGED');
      const recAt = u32le(loc, 8) + u32le(loc, 12) * 4294967296;
      const rec = await reader.read(recAt, 56);
      if (!(rec[0] === 0x50 && rec[1] === 0x4B && rec[2] === 6 && rec[3] === 6)) throw zipError('This ZIP file uses a layout that could not be read.', 'DAMAGED');
      count = u32le(rec, 32) + u32le(rec, 36) * 4294967296;
      cdSize = u32le(rec, 40) + u32le(rec, 44) * 4294967296;
      cdOffset = u32le(rec, 48) + u32le(rec, 52) * 4294967296;
    }
    if (cdSize > 32 * MB || cdOffset + cdSize > size) throw zipError('The ZIP directory is damaged or too large to read.', 'DAMAGED');
    const cd = await reader.read(cdOffset, cdSize);
    const entries = [];
    let p = 0;
    while (p + 46 <= cd.length && entries.length < Math.min(count, 100000)) {
      if (u32le(cd, p) !== 0x02014B50) break;
      const flags = u16le(cd, p + 8), method = u16le(cd, p + 10);
      let csize = u32le(cd, p + 20), usize = u32le(cd, p + 24);
      const nameLen = u16le(cd, p + 28), extraLen = u16le(cd, p + 30), commentLen = u16le(cd, p + 32);
      let offset = u32le(cd, p + 42);
      const rawName = cd.subarray(p + 46, p + 46 + nameLen);
      const name = flags & 0x800 ? utf8(rawName) : latin1(rawName, 0, rawName.length);
      // ZIP64 sizes live in the extra field (id 0x0001), in this order, only for fields set to 0xFFFFFFFF.
      let x = p + 46 + nameLen;
      const xEnd = x + extraLen;
      while (x + 4 <= xEnd) {
        const id = u16le(cd, x), len = u16le(cd, x + 2);
        if (id === 1) {
          let q = x + 4;
          const big = () => { const v = u32le(cd, q) + u32le(cd, q + 4) * 4294967296; q += 8; return v; };
          if (usize === 0xFFFFFFFF) usize = big();
          if (csize === 0xFFFFFFFF) csize = big();
          if (offset === 0xFFFFFFFF) offset = big();
        }
        x += 4 + len;
      }
      entries.push({ name, flags, method, csize, usize, offset, encrypted: !!(flags & 1) });
      p += 46 + nameLen + extraLen + commentLen;
    }
    return entries;
  }

  async function inflateRaw(data, max) {
    let ds;
    try { ds = new DecompressionStream('deflate-raw'); }
    catch (e) { throw zipError('This browser cannot unpack compressed document properties. Chrome 103, Edge 103, Firefox 113, Safari 16.4 or later can.', 'NO_INFLATE'); }
    const stream = new Blob([data]).stream().pipeThrough(ds);
    const reader = stream.getReader();
    const parts = [];
    let total = 0;
    for (;;) {
      let step;
      try { step = await reader.read(); } catch (e) { throw zipError('A part of this document could not be unpacked; the file may be damaged.', 'DAMAGED'); }
      if (step.done) break;
      total += step.value.length;
      if (total > max) { try { await reader.cancel(); } catch (e) { /* ignore */ } throw zipError('A part of this document is unusually large and was not read.', 'TOO_LARGE'); }
      parts.push(step.value);
    }
    return concat(parts);
  }

  async function readZipEntry(reader, entry, max) {
    if (entry.encrypted) throw zipError('This part of the file is password-protected.', 'ENCRYPTED');
    if (entry.usize > max) throw zipError('A part of this document is unusually large and was not read.', 'TOO_LARGE');
    const lh = await reader.read(entry.offset, 30);
    if (u32le(lh, 0) !== 0x04034B50) throw zipError('The ZIP file is damaged.', 'DAMAGED');
    const start = entry.offset + 30 + u16le(lh, 26) + u16le(lh, 28);
    const data = await reader.read(start, entry.csize);
    if (entry.method === 0) return data.subarray(0, Math.min(data.length, max));
    if (entry.method === 8) return inflateRaw(data, max);
    throw zipError('This document uses a compression method the checker cannot read.', 'METHOD');
  }

  function decodeXml(s) {
    return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]+>/g, '')
      .replace(/&#x([0-9a-f]+);/gi, (m, h) => { const c = parseInt(h, 16); return c > 0 && c < 0x110000 ? String.fromCodePoint(c) : ''; })
      .replace(/&#(\d+);/g, (m, d) => { const c = +d; return c > 0 && c < 0x110000 ? String.fromCodePoint(c) : ''; })
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
  }
  function xmlField(xml, local) {
    const re = new RegExp(`<(?:[\\w.-]+:)?${local}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[\\w.-]+:)?${local}>`);
    const m = xml.match(re);
    return m ? clean(decodeXml(m[1]), 300) : '';
  }
  function xmlAttr(xml, local) {
    const m = xml.match(new RegExp(`\\s(?:[\\w.-]+:)?${local}="([^"]*)"`));
    return m ? clean(decodeXml(m[1]), 100) : '';
  }

  const OFFICE = [
    ['word/document.xml', 'docx', 'Word document (DOCX)'],
    ['xl/workbook.xml', 'xlsx', 'Excel workbook (XLSX)'],
    ['ppt/presentation.xml', 'pptx', 'PowerPoint presentation (PPTX)']
  ];
  const ODF = { 'application/vnd.oasis.opendocument.text': ['odt', 'OpenDocument text (ODT)'], 'application/vnd.oasis.opendocument.spreadsheet': ['ods', 'OpenDocument spreadsheet (ODS)'], 'application/vnd.oasis.opendocument.presentation': ['odp', 'OpenDocument presentation (ODP)'], 'application/epub+zip': ['epub', 'EPUB e-book'] };

  async function inspectZip(source) {
    const reader = readerFrom(source);
    const out = { kind: 'zip', key: 'zip', label: 'ZIP archive', files: 0, uncompressed: 0, encryptedEntries: false, macros: false, properties: {}, app: {}, propertiesError: '', damaged: false, reason: '' };
    let entries;
    try { entries = await zipEntries(reader); }
    catch (e) { out.damaged = true; out.reason = e.message; return out; }
    out.files = entries.length;
    out.uncompressed = entries.reduce((n, x) => n + x.usize, 0);
    out.encryptedEntries = entries.some(x => x.encrypted);
    const byName = new Map(entries.map(x => [x.name, x]));
    const office = OFFICE.find(([part]) => byName.has(part));
    let odf = null;
    if (byName.has('mimetype')) {
      try { const mt = latin1(await readZipEntry(reader, byName.get('mimetype'), 200), 0, 200).trim(); odf = ODF[mt] || null; } catch (e) { odf = null; }
    }
    if (office) {
      out.key = office[1];
      out.label = office[2];
      out.macros = entries.some(x => /(^|\/)vbaProject\.bin$/i.test(x.name));
      if (out.macros) { out.key = out.key.replace(/x$/, 'm'); out.label = out.label.replace(/\((\w+)X\)/, '($1M, with macros)'); }
      try {
        if (byName.has('docProps/core.xml')) {
          const xml = utf8(await readZipEntry(reader, byName.get('docProps/core.xml'), MAX_XML));
          out.properties = {
            title: xmlField(xml, 'title'), subject: xmlField(xml, 'subject'), creator: xmlField(xml, 'creator'),
            lastModifiedBy: xmlField(xml, 'lastModifiedBy'), created: xmlField(xml, 'created'), modified: xmlField(xml, 'modified'),
            revision: xmlField(xml, 'revision'), keywords: xmlField(xml, 'keywords'), description: xmlField(xml, 'description'), lastPrinted: xmlField(xml, 'lastPrinted')
          };
        }
        if (byName.has('docProps/app.xml')) {
          const xml = utf8(await readZipEntry(reader, byName.get('docProps/app.xml'), MAX_XML));
          out.app = {
            application: xmlField(xml, 'Application'), appVersion: xmlField(xml, 'AppVersion'), company: xmlField(xml, 'Company'),
            pages: xmlField(xml, 'Pages'), words: xmlField(xml, 'Words'), characters: xmlField(xml, 'Characters'),
            slides: xmlField(xml, 'Slides'), template: xmlField(xml, 'Template'), totalTime: xmlField(xml, 'TotalTime')
          };
        }
      } catch (e) { out.propertiesError = e.message; out.propertiesCode = e.code; }
    } else if (odf) {
      out.key = odf[0];
      out.label = odf[1];
      try {
        if (byName.has('meta.xml')) {
          const xml = utf8(await readZipEntry(reader, byName.get('meta.xml'), MAX_XML));
          out.properties = { title: xmlField(xml, 'title'), subject: xmlField(xml, 'subject'), creator: xmlField(xml, 'initial-creator'), lastModifiedBy: xmlField(xml, 'creator'), created: xmlField(xml, 'creation-date'), modified: xmlField(xml, 'date'), keywords: xmlField(xml, 'keyword') };
          out.app = { application: xmlField(xml, 'generator'), pages: xmlAttr(xml, 'page-count'), words: xmlAttr(xml, 'word-count') };
        }
      } catch (e) { out.propertiesError = e.message; out.propertiesCode = e.code; }
    }
    for (const group of [out.properties, out.app]) for (const k of Object.keys(group)) if (!group[k]) delete group[k];
    return out;
  }

  /* ------------------------------------------------------------------ the report */
  // What each file name extension promises. The real type comes from the bytes.
  const EXT_KEY = {
    jpg: 'jpg', jpeg: 'jpg', jpe: 'jpg', jfif: 'jpg', png: 'png', webp: 'webp', gif: 'gif', bmp: 'bmp', avif: 'avif',
    heic: 'heic', heif: 'heic', tif: 'tif', tiff: 'tif', pdf: 'pdf', docx: 'docx', xlsx: 'xlsx', pptx: 'pptx', docm: 'docm', xlsm: 'xlsm', pptm: 'pptm',
    odt: 'odt', ods: 'ods', odp: 'odp', epub: 'epub', zip: 'zip', doc: 'ole', xls: 'ole', ppt: 'ole', txt: 'text', csv: 'text', md: 'text', json: 'text', xml: 'text', rtf: 'text', html: 'text', htm: 'text'
  };
  const KEY_LABEL = {
    jpg: 'JPEG image', png: 'PNG image', webp: 'WebP image', gif: 'GIF image', bmp: 'BMP image', avif: 'AVIF image', heic: 'HEIC photo', tif: 'TIFF image',
    pdf: 'PDF document', docx: 'Word document (DOCX)', xlsx: 'Excel workbook (XLSX)', pptx: 'PowerPoint presentation (PPTX)', zip: 'ZIP archive',
    ole: 'older Office file (DOC, XLS or PPT) or a password-protected Office file', text: 'plain text', unknown: 'not a recognised file type'
  };
  const KEY_MIME = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', bmp: 'image/bmp', avif: 'image/avif', heic: 'image/heic', tif: 'image/tiff', pdf: 'application/pdf' };

  /** "a PNG image", "an Excel workbook (XLSX)", "not a recognised file type". */
  function describeReal(report) {
    if (report.key === 'unknown' || report.key === 'ole') return KEY_LABEL[report.key].replace(/^older/, 'an older');
    const label = report.real.label.replace(/^Plain text/, 'plain text');
    return `${/^[AEIOU]/.test(label) ? 'an' : 'a'} ${label}`;
  }

  function extensionOf(name) {
    const m = String(name || '').toLowerCase().match(/\.([a-z0-9]{1,8})$/);
    return m ? m[1] : '';
  }

  /** Does the name's extension agree with the real type? */
  function extensionAgrees(ext, key) {
    const promised = EXT_KEY[ext];
    if (!promised) return null; // unknown extension: no opinion
    if (promised === key) return true;
    if (promised === 'zip' && /^(docx|xlsx|pptx|docm|xlsm|pptm|odt|ods|odp|epub)$/.test(key)) return true; // an Office file is a ZIP
    return false;
  }

  function browserTypeAgrees(type, key, mime) {
    if (!type) return null;
    const t = type.toLowerCase();
    if (KEY_MIME[key]) return t === KEY_MIME[key] || (key === 'jpg' && t === 'image/pjpeg') || (key === 'png' && t === 'image/x-png') || (key === 'bmp' && t === 'image/x-ms-bmp') || (key === 'heic' && t === 'image/heif');
    if (/^(docx|docm)$/.test(key)) return /wordprocessingml|msword|ms-word/.test(t);
    if (/^(xlsx|xlsm)$/.test(key)) return /spreadsheetml|ms-excel/.test(t);
    if (/^(pptx|pptm)$/.test(key)) return /presentationml|ms-powerpoint/.test(t);
    if (key === 'zip') return /zip/.test(t);
    if (key === 'text') return /^text\/|json|xml|csv/.test(t);
    if (key === 'ole') return /msword|ms-excel|ms-powerpoint|x-ole|cfb/.test(t);
    return t === mime;
  }

  /**
   * Inspect a file. Returns a plain report object; the checker turns it into words.
   * Never throws for bad input.
   */
  async function inspect(source, options) {
    const opts = options || {};
    const reader = readerFrom(source);
    const name = opts.name || (source && source.name) || '';
    const browserType = opts.type != null ? opts.type : (source && source.type) || '';
    const size = reader.size;
    const report = {
      name, size: sizes(size), extension: extensionOf(name), browserType,
      real: null, key: 'unknown', image: null, pdf: null, office: null, text: null,
      warnings: [], privacy: [], metadata: [], canStrip: false, deep: true, damaged: false
    };
    const warn = (level, text) => report.warnings.push({ level, text });
    if (size === 0) {
      report.real = { kind: 'empty', label: 'Empty file', mime: '' };
      report.key = 'empty';
      warn('error', 'This file is empty (0 bytes). It holds nothing, so any form will reject it. Save or export it again.');
      return report;
    }
    const head = await reader.read(0, Math.min(size, 4096));
    const real = Files.sniff(head);
    report.real = { kind: real.kind, label: real.label, mime: real.mime, ext: real.ext };
    report.key = real.kind === 'image' ? real.ext : real.kind === 'heic' ? 'heic' : real.kind === 'tiff' ? 'tif' : real.kind === 'ole' ? 'ole' : real.kind;

    const limit = DEEP_LIMITS[real.kind === 'heic' || real.kind === 'tiff' ? 'image' : real.kind];
    if (limit && size > limit) {
      report.deep = false;
      warn('info', `This file is ${sizes(size).mbText}, larger than the ${Math.round(limit / MB)} MB the checker reads in a browser. Only its type and size are shown.`);
    }

    try {
      if (report.deep && (real.kind === 'image' || real.kind === 'heic' || real.kind === 'tiff')) {
        const b = reader.bytes || await reader.read(0, size);
        const parse = { jpg: parseJpeg, png: parsePng, webp: parseWebp, gif: parseGif, bmp: parseBmp, avif: x => parseHeif(x, 'AVIF'), heic: x => parseHeif(x, 'HEIC'), tif: parseTiffImage }[report.key];
        report.image = parse ? parse(b) : null;
        const img = report.image;
        if (img) {
          if (img.damaged) { report.damaged = true; warn('error', img.reason); }
          const exif = img.exif;
          if (exif && exif.gps) report.privacy.push({ kind: 'gps', text: 'GPS location is stored in this photo. Anyone who receives the file can see where it was taken.' });
          if (img.xmpGps && !(exif && exif.gps)) report.privacy.push({ kind: 'gps', text: 'Location data is stored in this photo’s XMP metadata.' });
          if (exif && (exif.serial || exif.owner)) report.privacy.push({ kind: 'device', text: 'The camera’s serial number or owner name is stored in this photo.' });
          if (exif && exif.thumbnail) report.privacy.push({ kind: 'thumbnail', text: 'A small preview of the original picture is embedded. If you cropped the photo in an app that kept it, the preview may still show the uncropped picture.' });
          // A cleaned photo keeps one EXIF tag, its orientation, so it is not shown sideways. That is not personal data.
          img.orientationOnly = !!(exif && exif.tagCount === 1 && exif.orientation);
          if (exif && !img.orientationOnly) report.metadata.push(`EXIF (${exif.tagCount} tag${exif.tagCount === 1 ? '' : 's'})`);
          if (img.xmp) report.metadata.push('XMP');
          if (img.iptc) report.metadata.push('IPTC (Photoshop)');
          if (img.mpf) report.metadata.push('MPF (extra images)');
          if (img.jfxx) report.metadata.push('JFIF thumbnail');
          if (img.comments && img.comments.length) report.metadata.push(`Comment${img.comments.length === 1 ? '' : 's'}`);
          if (img.text && img.text.length) report.metadata.push(`Text chunks (${img.text.map(t => t.keyword).join(', ')})`);
          if (img.time) report.metadata.push('Last-modified time');
          if (img.otherApp && img.otherApp.length) report.metadata.push(`Other application data (${Array.from(new Set(img.otherApp)).join(', ')})`);
          if (img.exifPresent) report.metadata.push('EXIF (not read in HEIC files)');
          if (img.trailing) warn('info', `${sizes(img.trailing).kbText} of extra data follows the end of the image (often a motion-photo video or a second picture).`);
          if (img.components === 4) warn('warning', 'This JPEG uses CMYK print colours. Some portals reject it and some browsers show its colours wrongly; save it again as an RGB JPEG.');
          if (img.progressive) warn('info', 'This is a progressive JPEG. Almost every site accepts it; a very old upload form might not.');
          if (img.animated) warn('info', 'This image is animated. Forms take a still picture; convert it to JPEG first.');
          if (real.kind === 'heic') warn('warning', 'HEIC photos open on iPhones and Macs but most application forms and many browsers cannot open them. Convert the photo to JPEG first.');
          if (real.kind === 'tiff') warn('warning', 'Browsers cannot show TIFF images and most forms do not accept them. Convert it to JPEG or PDF first.');
          report.canStrip = (report.key === 'jpg' || report.key === 'png') && !img.damaged && (report.metadata.length > 0 || !!img.trailing);
        }
      } else if (report.deep && real.kind === 'pdf') {
        const b = reader.bytes || await reader.read(0, size);
        report.pdf = await inspectPdf(b, opts.PDFLib);
        const p = report.pdf;
        if (p.damaged && !p.needsPassword) { report.damaged = true; warn('error', p.reason); }
        if (p.needsPassword) warn('error', 'This PDF is protected with a password. Most application portals reject password-protected PDFs; save an unprotected copy from the program that made it.');
        else if (p.encrypted) warn('warning', 'This PDF is encrypted with permissions (it opens without a password, but printing or copying may be restricted). Some portals reject encrypted PDFs.');
        if (p.mixedSizes) warn('warning', `Pages have different sizes (${p.sizeGroups.length} sizes). Some portals and printers expect every page to be the same size.`);
        else if (p.mixedOrientation) warn('info', 'Some pages are portrait and some are landscape.');
        if (p.truncated && !p.damaged) warn('warning', 'The PDF end marker is missing near the end of the file. It may be incomplete; open it to check every page is there.');
        if (p.javascript) warn('warning', 'This PDF contains JavaScript. Some portals reject PDFs with scripts.');
        if (p.attachments) warn('info', 'This PDF has files attached inside it.');
        const m = p.metadata || {};
        if (m.author) report.privacy.push({ kind: 'author', text: `The author name “${m.author}” is stored in this PDF.` });
        if (Object.keys(m).length) report.metadata.push('Document information');
        if (p.xmpMetadata) report.metadata.push('XMP');
      } else if (real.kind === 'zip') {
        report.office = await inspectZip(reader);
        const o = report.office;
        report.key = o.key;
        report.real.label = o.label;
        if (o.damaged) { report.damaged = true; warn('error', o.reason); }
        if (o.macros) warn('warning', 'This document contains macros (small programs). Many portals and employers block files with macros; save it as a normal .docx, .xlsx or .pptx.');
        if (o.encryptedEntries) warn('warning', 'Some parts of this ZIP file are password-protected.');
        if (o.key === 'zip') warn('info', `A ZIP archive with ${o.files} file${o.files === 1 ? '' : 's'} (${sizes(o.uncompressed).kbText} unpacked). Forms that ask for a document usually do not accept ZIP files.`);
        if (o.propertiesError) warn(o.propertiesCode === 'NO_INFLATE' ? 'info' : 'warning', o.propertiesError);
        const pr = o.properties || {};
        if (pr.creator || pr.lastModifiedBy) report.privacy.push({ kind: 'author', text: `Names are stored in the document properties: ${[pr.creator, pr.lastModifiedBy].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).map(v => `“${v}”`).join(' and ')}.` });
        if (Object.keys(pr).length || Object.keys(o.app || {}).length) report.metadata.push('Document properties');
        if (o.app && o.app.company) report.privacy.push({ kind: 'company', text: `A company name, “${o.app.company}”, is stored in the document properties.` });
      } else if (real.kind === 'ole') {
        warn('warning', 'This is an older Office file (.doc, .xls, .ppt) or a password-protected Office file. Many portals ask for PDF; if the form accepts Word files, save it as .docx or PDF without a password.');
      } else if (real.kind === 'text') {
        report.text = { lines: null };
      } else if (real.kind === 'unknown') {
        warn('warning', 'The checker does not recognise this file type from its contents. If a form expects a photo, PDF or Word file, this file will probably be rejected.');
      }
    } catch (e) {
      report.damaged = true;
      warn('error', 'This file could not be read completely. It may be damaged.');
    }

    // Name and browser type against the real type
    const agrees = extensionAgrees(report.extension, report.key);
    report.extensionAgrees = agrees;
    if (agrees === false) {
      warn('warning', `The name ends in .${report.extension}, but the contents are ${describeReal(report)}. Renaming a file does not convert it; a portal that checks the contents will reject it.`);
    } else if (!report.extension && report.key !== 'empty') {
      warn('info', 'The file name has no extension (such as .jpg or .pdf). Many upload forms need one.');
    }
    const bt = browserTypeAgrees(browserType, report.key, report.real.mime);
    report.browserTypeAgrees = bt;
    if (bt === false && agrees !== false) warn('info', `Your browser reports this file as “${browserType}”, which does not match its contents. Browsers guess the type from the name, so a portal might too.`);
    return report;
  }

  /* ------------------------------------------------------------------ requirement check */
  const FORMAT_LABEL = { jpg: 'JPEG', png: 'PNG', webp: 'WebP', gif: 'GIF', pdf: 'PDF', docx: 'DOCX', doc: 'DOC' };

  /**
   * requirement: { formats: ['jpg','png','pdf','docx'...], minKB, maxKB, width, height, pixelMode: 'exact'|'min', maxPages }
   * Returns rows of { id, label, required, actual, pass (true|false|null for not applicable) }.
   */
  function checkRequirements(report, req) {
    const r = req || {};
    const rows = [];
    const formats = (r.formats || []).filter(Boolean);
    if (formats.length) {
      const key = report.key === 'ole' && report.extension === 'doc' ? 'doc' : report.key;
      const allowed = formats.includes(key);
      const nameOk = report.extensionAgrees !== false && !!report.extension;
      rows.push({
        id: 'format', label: 'Format', required: formats.map(f => FORMAT_LABEL[f] || f.toUpperCase()).join(' or '),
        actual: allowed && !nameOk ? `${report.real.label}, but the name ends in ${report.extension ? '.' + report.extension : 'no extension'}` : report.real.label,
        pass: allowed && nameOk
      });
    }
    const minKB = Number(r.minKB) || 0, maxKB = Number(r.maxKB) || 0;
    if (minKB || maxKB) {
      const kb = report.size.kb;
      const required = minKB && maxKB ? `${group(minKB)} to ${group(maxKB)} KB` : minKB ? `At least ${group(minKB)} KB` : `At most ${group(maxKB)} KB`;
      rows.push({ id: 'size', label: 'File size', required, actual: report.size.kbText, bytes: report.size.text, pass: (!minKB || report.size.bytes >= minKB * KB) && (!maxKB || report.size.bytes <= maxKB * KB) && report.size.bytes > 0 });
    }
    const W = Number(r.width) || 0, H = Number(r.height) || 0;
    if (W || H) {
      const exact = r.pixelMode !== 'min';
      const required = `${exact ? 'Exactly' : 'At least'} ${W ? group(W) : 'any'} × ${H ? group(H) : 'any'} px`;
      const img = report.image;
      if (!img || !img.width) rows.push({ id: 'pixels', label: 'Pixel size', required, actual: 'Not an image', pass: report.real.kind === 'image' ? false : null });
      else {
        const okW = !W || (exact ? img.width === W : img.width >= W);
        const okH = !H || (exact ? img.height === H : img.height >= H);
        rows.push({ id: 'pixels', label: 'Pixel size', required, actual: `${group(img.width)} × ${group(img.height)} px`, pass: okW && okH });
      }
    }
    const maxPages = Number(r.maxPages) || 0;
    if (maxPages) {
      const required = `At most ${group(maxPages)} page${maxPages === 1 ? '' : 's'}`;
      if (report.pdf && report.pdf.pages) rows.push({ id: 'pages', label: 'Pages', required, actual: `${group(report.pdf.pages)} page${report.pdf.pages === 1 ? '' : 's'}`, pass: report.pdf.pages <= maxPages });
      else if (report.office && report.office.app && report.office.app.pages) {
        const n = Number(report.office.app.pages);
        rows.push({ id: 'pages', label: 'Pages', required, actual: `${group(n)} page${n === 1 ? '' : 's'} (as last saved)`, pass: n <= maxPages });
      } else if (report.real.kind === 'image') rows.push({ id: 'pages', label: 'Pages', required, actual: '1 page (an image)', pass: maxPages >= 1 });
      else rows.push({ id: 'pages', label: 'Pages', required, actual: 'Not known for this file type', pass: null });
    }
    const applicable = rows.filter(x => x.pass !== null);
    return { rows, applicable: applicable.length, pass: applicable.length > 0 && applicable.every(x => x.pass) && !report.damaged && report.key !== 'empty' };
  }

  /* ------------------------------------------------------------------ remove metadata */
  /**
   * Remove metadata without re-encoding, so the pixels stay exactly the same.
   * JPEG: drops EXIF, XMP, IPTC, MPF, comments, JFIF thumbnails and other application segments, and data
   *       after the end of the image. Keeps the JFIF header (APP0), the colour profile (APP2 ICC_PROFILE)
   *       and the Adobe colour-transform marker (APP14), which decoders need to show the right colours.
   * PNG:  drops tEXt, iTXt, zTXt, eXIf and tIME chunks and data after IEND; every other chunk is copied
   *       byte for byte with its checksum.
   * Both: when the photo relies on an EXIF orientation (it would otherwise appear sideways), a minimal
   *       EXIF block with only the orientation is written back.
   */
  function stripMetadata(b, key) {
    const removed = [];
    const add = (what, n) => { const r = removed.find(x => x.what === what); if (r) r.bytes += n; else removed.push({ what, bytes: n }); };
    if (key === 'jpg') {
      const info = parseJpeg(b);
      if (info.damaged) throw new Error((info.reason || 'This JPEG is damaged.') + ' It was not changed.');
      const orientation = info.exif && info.exif.orientation > 1 ? info.exif.orientation : 0;
      const parts = [b.subarray(0, 2)];
      let wroteOrientation = !orientation;
      const writeOrientation = () => {
        if (wroteOrientation) return;
        const tiff = minimalTiff(orientation);
        const seg = new Uint8Array(4 + 6 + tiff.length);
        seg.set([0xFF, 0xE1, 0, 2 + 6 + tiff.length, 0x45, 0x78, 0x69, 0x66, 0, 0]);
        seg.set(tiff, 10);
        parts.push(seg);
        wroteOrientation = true;
      };
      let ended = 0;
      const res = walkJpeg(b, (m, start, end, p) => {
        const seg = b.subarray(start, end);
        if (m === 0xE0) {
          if (startsAscii(b, p, 'JFXX\0')) { add('JFIF thumbnail', end - start); return; }
          parts.push(seg); writeOrientation(); return;
        }
        if (m === 0xE2 && startsAscii(b, p, 'ICC_PROFILE\0')) { writeOrientation(); parts.push(seg); return; }
        if (m === 0xEE && startsAscii(b, p, 'Adobe')) { writeOrientation(); parts.push(seg); return; }
        if (m >= 0xE1 && m <= 0xEF) {
          const what = m === 0xE1 ? (startsAscii(b, p, 'Exif\0') ? 'EXIF' : startsAscii(b, p, 'http://ns.adobe.com/') ? 'XMP' : 'Application data') : m === 0xED ? 'IPTC (Photoshop)' : m === 0xE2 && startsAscii(b, p, 'MPF\0') ? 'MPF (extra images)' : 'Application data';
          add(what, end - start); return;
        }
        if (m === 0xFE) { add('Comments', end - start); return; }
        writeOrientation();
        parts.push(seg);
        if (m === 0xD9) ended = end;
      });
      if (res.damaged || !ended) throw new Error('This JPEG is damaged, so it was not changed.');
      if (ended < b.length) add('Extra data after the image', b.length - ended);
      return { bytes: concat(parts), removed, orientation };
    }
    if (key === 'png') {
      const info = parsePng(b);
      if (info.damaged) throw new Error((info.reason || 'This PNG is damaged.') + ' It was not changed.');
      const orientation = info.exif && info.exif.orientation > 1 ? info.exif.orientation : 0;
      const parts = [b.subarray(0, 8)];
      let end = 0;
      let wrote = !orientation;
      const LABEL = { tEXt: 'Text', iTXt: 'Text', zTXt: 'Text', eXIf: 'EXIF', tIME: 'Last-modified time' };
      walkPng(b, (type, start, stop) => {
        if (PNG_METADATA.has(type)) {
          add(LABEL[type], stop - start);
          if (type === 'eXIf' && !wrote) {
            const tiff = minimalTiff(orientation);
            const chunk = new Uint8Array(12 + tiff.length);
            chunk.set([0, 0, 0, tiff.length, 0x65, 0x58, 0x49, 0x66]);
            chunk.set(tiff, 8);
            const c = crc32(chunk, 4, 8 + tiff.length);
            chunk.set([c >>> 24, (c >>> 16) & 255, (c >>> 8) & 255, c & 255], 8 + tiff.length);
            parts.push(chunk);
            wrote = true;
          }
          return;
        }
        parts.push(b.subarray(start, stop));
        if (type === 'IEND') end = stop;
      });
      if (end && end < b.length) add('Extra data after the image', b.length - end);
      return { bytes: concat(parts), removed, orientation };
    }
    throw new Error('Only JPEG and PNG files can have their metadata removed here.');
  }

  return {
    inspect, checkRequirements, stripMetadata, sizes, group, extensionOf, extensionAgrees,
    parseJpeg, parsePng, parseWebp, parseGif, parseBmp, parseTiff, parseHeif, inspectPdf, inspectZip, zipEntries, readZipEntry,
    crc32, paperName, ORIENTATION, DEEP_LIMITS, KEY_LABEL
  };
});
