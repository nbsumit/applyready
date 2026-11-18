/* ApplyReady ZIP writer.
   Builds a standard ZIP archive in the browser without uploading anything.
   Entries are stored (no compression): photos and PDFs are already compressed, so deflating
   them again would cost time and memory for almost no saving. File names are written as UTF-8
   (general purpose flag bit 11) and made unique inside the archive.
   Limits: no ZIP64, so the archive must stay under 4 GB and 65,535 entries; createZip
   refuses anything larger with a clear error instead of writing a corrupt file. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ApplyReadyZip = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const MAX_ENTRIES = 65535;
  const MAX_BYTES = 0xFFFFFFFF - 1024 * 1024; // leave room for headers inside the 32-bit offsets

  let CRC_TABLE = null;
  function crcTable() {
    if (CRC_TABLE) return CRC_TABLE;
    CRC_TABLE = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      CRC_TABLE[n] = c >>> 0;
    }
    return CRC_TABLE;
  }

  function crc32(bytes, crc) {
    const table = crcTable();
    let c = (crc === undefined ? 0 : crc) ^ 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) c = table[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  function dosDateTime(date) {
    const d = date instanceof Date && !isNaN(date) ? date : new Date();
    const year = Math.min(Math.max(d.getFullYear(), 1980), 2107);
    return {
      time: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
      date: ((year - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()
    };
  }

  // Archive paths: forward slashes only, no absolute paths, no "..", no control characters.
  function cleanPath(name) {
    const parts = String(name || '').replace(/\\/g, '/').split('/')
      .map(part => part.replace(/[\u0000-\u001f\u007f<>:"|?*]/g, '_').trim())
      .filter(part => part && part !== '.' && part !== '..');
    const joined = parts.join('/');
    return joined || 'file';
  }

  // "photo.jpg" -> "photo (2).jpg" when the name is already used (case-insensitive, as on Windows).
  function uniqueName(name, used) {
    const clean = cleanPath(name);
    const key = s => s.toLowerCase();
    if (!used.has(key(clean))) { used.add(key(clean)); return clean; }
    const slash = clean.lastIndexOf('/');
    const dir = slash >= 0 ? clean.slice(0, slash + 1) : '';
    const base = clean.slice(slash + 1);
    const dot = base.lastIndexOf('.');
    const stem = dot > 0 ? base.slice(0, dot) : base;
    const ext = dot > 0 ? base.slice(dot) : '';
    for (let i = 2; ; i++) {
      const candidate = `${dir}${stem} (${i})${ext}`;
      if (!used.has(key(candidate))) { used.add(key(candidate)); return candidate; }
    }
  }

  async function toBytes(data) {
    if (data instanceof Uint8Array) return data;
    if (data instanceof ArrayBuffer) return new Uint8Array(data);
    if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    if (typeof data === 'string') return new TextEncoder().encode(data);
    if (data && typeof data.arrayBuffer === 'function') return new Uint8Array(await data.arrayBuffer());
    throw new TypeError('Unsupported ZIP entry data');
  }

  /**
   * entries: [{ name, data: Blob | Uint8Array | ArrayBuffer | string, date? }]
   * options: { signal?: AbortSignal, onProgress?: (done, total) => void }
   * Resolves to a Blob (application/zip) in browsers, or a Uint8Array when Blob is unavailable (Node tests).
   */
  async function createZip(entries, options) {
    const opts = options || {};
    if (!Array.isArray(entries) || !entries.length) throw new Error('Nothing to put in the ZIP file.');
    if (entries.length > MAX_ENTRIES) throw new Error(`A ZIP file can hold at most ${MAX_ENTRIES} files.`);
    const encoder = new TextEncoder();
    const used = new Set();
    const parts = [];
    const central = [];
    let offset = 0;
    for (let i = 0; i < entries.length; i++) {
      if (opts.signal && opts.signal.aborted) throw new DOMException('ZIP cancelled', 'AbortError');
      const entry = entries[i];
      const name = uniqueName(entry.name, used);
      const nameBytes = encoder.encode(name);
      const bytes = await toBytes(entry.data);
      if (offset + bytes.length + 30 + nameBytes.length > MAX_BYTES) {
        throw new Error('These files add up to more than 4 GB, too large for one ZIP file. Download them in smaller groups.');
      }
      const crc = crc32(bytes);
      const { time, date } = dosDateTime(entry.date);
      const local = new DataView(new ArrayBuffer(30));
      local.setUint32(0, 0x04034b50, true);
      local.setUint16(4, 20, true);          // version needed
      local.setUint16(6, 0x0800, true);      // UTF-8 names
      local.setUint16(8, 0, true);           // stored
      local.setUint16(10, time, true);
      local.setUint16(12, date, true);
      local.setUint32(14, crc, true);
      local.setUint32(18, bytes.length, true);
      local.setUint32(22, bytes.length, true);
      local.setUint16(26, nameBytes.length, true);
      local.setUint16(28, 0, true);
      parts.push(new Uint8Array(local.buffer), nameBytes, bytes);

      const cen = new DataView(new ArrayBuffer(46));
      cen.setUint32(0, 0x02014b50, true);
      cen.setUint16(4, 20, true);            // version made by
      cen.setUint16(6, 20, true);
      cen.setUint16(8, 0x0800, true);
      cen.setUint16(10, 0, true);
      cen.setUint16(12, time, true);
      cen.setUint16(14, date, true);
      cen.setUint32(16, crc, true);
      cen.setUint32(20, bytes.length, true);
      cen.setUint32(24, bytes.length, true);
      cen.setUint16(28, nameBytes.length, true);
      cen.setUint16(30, 0, true);
      cen.setUint16(32, 0, true);
      cen.setUint16(34, 0, true);
      cen.setUint16(36, 0, true);
      cen.setUint32(38, 0, true);
      cen.setUint32(42, offset, true);
      central.push(new Uint8Array(cen.buffer), nameBytes);
      offset += 30 + nameBytes.length + bytes.length;
      if (opts.onProgress) opts.onProgress(i + 1, entries.length);
    }
    const centralSize = central.reduce((sum, part) => sum + part.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(8, entries.length, true);
    end.setUint16(10, entries.length, true);
    end.setUint32(12, centralSize, true);
    end.setUint32(16, offset, true);
    end.setUint16(20, 0, true);
    const all = parts.concat(central, [new Uint8Array(end.buffer)]);
    if (typeof Blob !== 'undefined') return new Blob(all, { type: 'application/zip' });
    const out = new Uint8Array(all.reduce((sum, part) => sum + part.length, 0));
    let pos = 0;
    for (const part of all) { out.set(part, pos); pos += part.length; }
    return out;
  }

  return { createZip, crc32, uniqueName, cleanPath, MAX_ENTRIES };
});
