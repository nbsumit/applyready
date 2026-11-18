/* Byte-level fixture builders for the document tools tests: TIFF/EXIF blocks, JPEG segments, PNG
   chunks and ZIP (Office) files. Built by hand so each test knows exactly what a file contains. */
'use strict';
const zlib = require('node:zlib');

let table = null;
function crc32(buf) {
  if (!table) { table = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; table[n] = c >>> 0; } }
  let c = 0xFFFFFFFF;
  for (const b of buf) c = table[(c ^ b) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

/**
 * Little TIFF writer (big-endian). ifd0 / exif / gps are arrays of [tag, type, value]:
 * type 2 ASCII (string), 3 SHORT (number), 4 LONG (number), 5 RATIONAL ([[num, den], ...]).
 */
function makeTiff({ ifd0 = [], exif = null, gps = null, thumbnail = false }) {
  const parts = [];
  const header = Buffer.from([0x4D, 0x4D, 0x00, 0x2A, 0, 0, 0, 8]);
  // Layout: header | IFD0 | exif IFD | gps IFD | ifd1 | data area
  const ifds = [{ entries: ifd0.slice() }];
  if (exif) ifds.push({ entries: exif, key: 'exif' });
  if (gps) ifds.push({ entries: gps, key: 'gps' });
  if (thumbnail) ifds.push({ entries: [[0x0103, 3, 6]], key: 'ifd1' });
  if (exif) ifds[0].entries.push([0x8769, 4, 0]);
  if (gps) ifds[0].entries.push([0x8825, 4, 0]);
  const ifdSize = e => 2 + e.length * 12 + 4;
  let offset = 8;
  for (const ifd of ifds) { ifd.offset = offset; offset += ifdSize(ifd.entries); }
  let dataOffset = offset;
  const data = [];
  const byKey = k => ifds.find(i => i.key === k);
  const out = [header];
  ifds.forEach((ifd, idx) => {
    ifd.entries.sort((a, b) => a[0] - b[0]);
    const b = Buffer.alloc(ifdSize(ifd.entries));
    b.writeUInt16BE(ifd.entries.length, 0);
    ifd.entries.forEach(([tag, type, value], i) => {
      const e = 2 + i * 12;
      b.writeUInt16BE(tag, e); b.writeUInt16BE(type, e + 2);
      if (tag === 0x8769) value = byKey('exif').offset;
      if (tag === 0x8825) value = byKey('gps').offset;
      if (type === 2) {
        const s = Buffer.from(value + '\0', 'latin1');
        b.writeUInt32BE(s.length, e + 4);
        if (s.length <= 4) s.copy(b, e + 8); else { b.writeUInt32BE(dataOffset, e + 8); data.push(s); dataOffset += s.length; }
      } else if (type === 3) { b.writeUInt32BE(1, e + 4); b.writeUInt16BE(value, e + 8); }
      else if (type === 4) { b.writeUInt32BE(1, e + 4); b.writeUInt32BE(value, e + 8); }
      else if (type === 5) {
        const r = Buffer.alloc(value.length * 8);
        value.forEach(([n, d], k) => { r.writeUInt32BE(n, k * 8); r.writeUInt32BE(d, k * 8 + 4); });
        b.writeUInt32BE(value.length, e + 4); b.writeUInt32BE(dataOffset, e + 8); data.push(r); dataOffset += r.length;
      }
    });
    const next = idx === 0 && thumbnail ? byKey('ifd1').offset : 0;
    b.writeUInt32BE(next, 2 + ifd.entries.length * 12);
    out.push(b);
  });
  return Buffer.concat([...out, ...data]);
}

/** EXIF block for a phone photo taken at a known place (New Delhi), rotated 90\u00B0 clockwise. */
function phoneExif({ orientation = 6, gps = true } = {}) {
  return makeTiff({
    ifd0: [[0x010F, 2, 'TestCam'], [0x0110, 2, 'Model X1'], [0x0112, 3, orientation], [0x011A, 5, [[300, 1]]], [0x011B, 5, [[300, 1]]], [0x0128, 3, 2], [0x0132, 2, '2026:11:01 10:20:30']],
    exif: [[0x9003, 2, '2026:11:01 10:20:30'], [0xA431, 2, 'SN12345']],
    gps: gps ? [[1, 2, 'N'], [2, 5, [[28, 1], [36, 1], [5004, 100]]], [3, 2, 'E'], [4, 5, [[77, 1], [12, 1], [3240, 100]]]] : null,
    thumbnail: true
  });
}

/** Insert segments right after a JPEG's SOI marker. */
function jpegWithSegments(jpeg, segments) {
  return Buffer.concat([jpeg.subarray(0, 2), ...segments, jpeg.subarray(2)]);
}
function jpegSegment(marker, payload) {
  const h = Buffer.from([0xFF, marker, 0, 0]);
  h.writeUInt16BE(payload.length + 2, 2);
  return Buffer.concat([h, payload]);
}
const exifSegment = tiff => jpegSegment(0xE1, Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), tiff]));
const xmpSegment = xml => jpegSegment(0xE1, Buffer.concat([Buffer.from('http://ns.adobe.com/xap/1.0/\0', 'latin1'), Buffer.from(xml)]));
const commentSegment = text => jpegSegment(0xFE, Buffer.from(text, 'latin1'));
const iccSegment = () => jpegSegment(0xE2, Buffer.concat([Buffer.from('ICC_PROFILE\0', 'latin1'), Buffer.from([1, 1]), Buffer.alloc(128, 7)]));

function pngChunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** A small RGBA PNG with a known pattern. extra: chunks to put before IDAT. */
function makePng({ width = 4, height = 3, alpha = true, extra = [] } = {}) {
  const ch = alpha ? 4 : 3;
  const raw = Buffer.alloc((width * ch + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * ch + 1)] = 0;
    for (let x = 0; x < width; x++) {
      const o = y * (width * ch + 1) + 1 + x * ch;
      raw[o] = (x * 60) & 255; raw[o + 1] = (y * 80) & 255; raw[o + 2] = 128;
      if (alpha) raw[o + 3] = x === 0 ? 0 : 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = alpha ? 6 : 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), pngChunk('IHDR', ihdr), ...extra, pngChunk('IDAT', zlib.deflateSync(raw)), pngChunk('IEND', Buffer.alloc(0))]);
}
function physChunk(dpi) {
  const b = Buffer.alloc(9); const ppm = Math.round(dpi / 0.0254);
  b.writeUInt32BE(ppm, 0); b.writeUInt32BE(ppm, 4); b[8] = 1;
  return pngChunk('pHYs', b);
}
const textChunk = (k, v) => pngChunk('tEXt', Buffer.from(`${k}\0${v}`, 'latin1'));
const itxtChunk = (k, v) => pngChunk('iTXt', Buffer.concat([Buffer.from(`${k}\0\0\0\0\0`, 'latin1'), Buffer.from(v, 'utf8')]));
function timeChunk() { return pngChunk('tIME', Buffer.from([0x07, 0xEA, 11, 18, 10, 0, 0])); }

/** A ZIP file; entries: [{ name, data (Buffer|string), store }]. Deflated unless store is true. */
function makeZip(entries) {
  const locals = [], central = [];
  let offset = 0;
  for (const e of entries) {
    const data = Buffer.isBuffer(e.data) ? e.data : Buffer.from(e.data, 'utf8');
    const comp = e.store ? data : zlib.deflateRawSync(data);
    const name = Buffer.from(e.name, 'utf8');
    const method = e.store ? 0 : 8;
    const crc = crc32(data);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034B50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x800, 6); lh.writeUInt16LE(method, 8);
    lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(data.length, 22); lh.writeUInt16LE(name.length, 26);
    locals.push(lh, name, comp);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014B50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x800, 8); ch.writeUInt16LE(method, 10);
    ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(comp.length, 20); ch.writeUInt32LE(data.length, 24); ch.writeUInt16LE(name.length, 28); ch.writeUInt32LE(offset, 42);
    central.push(ch, name);
    offset += 30 + name.length + comp.length;
  }
  const cd = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054B50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
}

/** A minimal but valid DOCX that Word, LibreOffice and the checker can open. */
function makeDocx({ title = 'Cover letter', creator = 'Asha Verma', lastModifiedBy = 'Asha V', pages = 2, words = 345, macros = false } = {}) {
  const files = [
    { name: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>' },
    { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>' },
    { name: 'word/document.xml', data: '<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Dear hiring manager</w:t></w:r></w:p></w:body></w:document>' },
    { name: 'docProps/core.xml', data: `<?xml version="1.0" encoding="UTF-8"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${title}</dc:title><dc:creator>${creator}</dc:creator><cp:lastModifiedBy>${lastModifiedBy}</cp:lastModifiedBy><cp:revision>3</cp:revision><dcterms:created xsi:type="dcterms:W3CDTF">2026-10-01T09:00:00Z</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">2026-11-02T18:30:00Z</dcterms:modified></cp:coreProperties>` },
    { name: 'docProps/app.xml', data: `<?xml version="1.0" encoding="UTF-8"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Microsoft Office Word</Application><Pages>${pages}</Pages><Words>${words}</Words><Company>Example &amp; Co</Company><TitlesOfParts><vt:vector xmlns:vt="x"><vt:lpstr>Doc</vt:lpstr></vt:vector></TitlesOfParts></Properties>` }
  ];
  if (macros) files.push({ name: 'word/vbaProject.bin', data: Buffer.alloc(64, 1) });
  return makeZip(files);
}

module.exports = { crc32, makeTiff, phoneExif, jpegWithSegments, jpegSegment, exifSegment, xmpSegment, commentSegment, iccSegment, pngChunk, makePng, physChunk, textChunk, itxtChunk, timeChunk, makeZip, makeDocx };
