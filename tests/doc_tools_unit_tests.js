/* Unit tests for the document tools' processing modules (no browser):
   js/lib/inspect.js (file checker parsers, requirement check, lossless metadata removal) and
   js/lib/text-pdf.js (text to PDF layout, unsupported characters, PDF output). */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const os = require('node:os');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const Inspect = require('../js/lib/inspect.js');
const TextPdf = require('../js/lib/text-pdf.js');
const PDFLib = require('../js/vendor/pdf-lib.min.js');
const F = require('./doc_fixtures.js');

let checks = 0;
const ok = (c, m) => { assert(c, m); checks++; };
const sample = name => new Uint8Array(fs.readFileSync(path.join(root, 'img/samples', name)));
const has = cmd => { try { execFileSync('which', [cmd], { stdio: 'ignore' }); return true; } catch (e) { return false; } };

(async () => {
  // ------------------------------------------------------------------ JPEG
  {
    const base = Buffer.from(sample('test-portrait.jpg'));
    const plain = Inspect.parseJpeg(new Uint8Array(base));
    ok(plain.width > 0 && plain.height > 0 && !plain.damaged, `sample JPEG parses (${plain.width} x ${plain.height})`);

    const jpeg = new Uint8Array(F.jpegWithSegments(base, [F.exifSegment(F.phoneExif()), F.xmpSegment('<x:xmpmeta><exif:GPSLatitude>28,36N</exif:GPSLatitude></x:xmpmeta>'), F.commentSegment('Taken at home'), F.iccSegment()]));
    const r = await Inspect.inspect(jpeg, { name: 'photo.jpg', type: 'image/jpeg' });
    ok(r.key === 'jpg' && r.image.width === plain.width && r.image.height === plain.height, 'JPEG: real type and pixel size');
    ok(r.image.exif.make === 'TestCam' && r.image.exif.model === 'Model X1', 'JPEG: camera make and model from EXIF');
    ok(r.image.exif.orientation === 6, 'JPEG: orientation tag read');
    ok(Math.abs(r.image.exif.gps.latitude - 28.6139) < 0.001 && Math.abs(r.image.exif.gps.longitude - 77.209) < 0.001, `JPEG: GPS coordinates (${r.image.exif.gps.latitude}, ${r.image.exif.gps.longitude})`);
    ok(r.privacy.some(p => p.kind === 'gps') && r.privacy.some(p => p.kind === 'device') && r.privacy.some(p => p.kind === 'thumbnail'), 'JPEG: GPS, serial number and embedded preview flagged as privacy risks');
    ok(r.image.xmp && r.image.xmpGps && r.image.icc && r.image.comments[0] === 'Taken at home', 'JPEG: XMP (with location), ICC profile and comment found');
    ok(r.canStrip, 'JPEG with metadata can be cleaned');
    ok(r.extensionAgrees === true && r.browserTypeAgrees === true && !r.warnings.some(w => w.level === 'error'), 'JPEG: name and browser type agree');

    const cleaned = Inspect.stripMetadata(jpeg, 'jpg');
    const after = Inspect.parseJpeg(cleaned.bytes);
    ok(!after.xmp && !after.comments.length && after.icc, 'cleaned JPEG: XMP and comments gone, colour profile kept');
    ok(after.exif && after.exif.orientation === 6 && !after.exif.gps && !after.exif.make && !after.exif.thumbnail && after.exif.tagCount === 1, 'cleaned JPEG: only the orientation is left in EXIF');
    ok(after.width === plain.width && after.height === plain.height && !after.damaged, 'cleaned JPEG: same size, not damaged');
    // The entropy-coded image data is copied byte for byte.
    const sos = b => { let i = 2; for (;;) { const m = b[i + 1]; const len = (b[i + 2] << 8) | b[i + 3]; if (m === 0xDA) return Buffer.from(b.subarray(i)); i += 2 + len; } };
    ok(sos(cleaned.bytes).equals(sos(jpeg)), 'cleaned JPEG: image data identical from the first scan to the end');
    ok(cleaned.removed.some(x => x.what === 'EXIF') && cleaned.removed.some(x => x.what === 'XMP') && cleaned.removed.some(x => x.what === 'Comments'), 'cleaned JPEG: removal is itemised');
    const r2 = await Inspect.inspect(cleaned.bytes, { name: 'photo.jpg' });
    ok(!r2.privacy.length && !r2.canStrip, 'cleaned JPEG re-checks clean');

    // No orientation: no EXIF written back at all
    const noOrient = Inspect.stripMetadata(new Uint8Array(F.jpegWithSegments(base, [F.exifSegment(F.phoneExif({ orientation: 1 }))])), 'jpg');
    ok(!Inspect.parseJpeg(noOrient.bytes).exif, 'cleaned JPEG with normal orientation has no EXIF at all');

    // Trailing data after EOI (motion photos) is removed
    const trailing = new Uint8Array(Buffer.concat([base, Buffer.from('ftypmp42 fake video data')]));
    const rt = await Inspect.inspect(trailing, { name: 't.jpg' });
    ok(rt.image.trailing === 24 && rt.canStrip, 'data after the JPEG end is reported');
    ok(Inspect.stripMetadata(trailing, 'jpg').bytes.length === base.length, 'data after the JPEG end is removed');

    // Truncated JPEG
    const cut = new Uint8Array(base.subarray(0, Math.floor(base.length / 2)));
    const rc = await Inspect.inspect(cut, { name: 'cut.jpg' });
    ok(rc.damaged && rc.warnings.some(w => w.level === 'error' && /incomplete/.test(w.text)), 'truncated JPEG reported as incomplete');
    assert.throws(() => Inspect.stripMetadata(cut, 'jpg'), /incomplete|damaged/);
    checks++;

    // JFIF density
    const jfif = Inspect.parseJpeg(sample('test-signature.jpg'));
    ok(jfif.width > 0, 'second sample JPEG parses');
  }

  // ------------------------------------------------------------------ PNG
  {
    const png = new Uint8Array(F.makePng({ extra: [F.physChunk(300), F.textChunk('Author', 'Asha Verma'), F.itxtChunk('Comment', 'na\u00EFve text'), F.timeChunk()] }));
    const r = await Inspect.inspect(png, { name: 'sign.png', type: 'image/png' });
    ok(r.key === 'png' && r.image.width === 4 && r.image.height === 3, 'PNG: size');
    ok(r.image.density && r.image.density.x === 300 && r.image.density.source === 'pHYs', 'PNG: 300 DPI from pHYs');
    ok(r.image.alpha && /transparency/.test(r.image.colour), 'PNG: alpha channel reported');
    ok(r.image.text.length === 2 && r.image.text[0].keyword === 'Author' && r.image.text[0].value === 'Asha Verma' && r.image.text[1].value === 'na\u00EFve text', 'PNG: text chunks read (tEXt and iTXt)');
    ok(r.image.time === '2026-11-18 10:00', 'PNG: tIME read');
    ok(r.canStrip && r.image.crcErrors === 0, 'PNG: checksums valid, can be cleaned');
    const cleaned = Inspect.stripMetadata(png, 'png');
    const after = Inspect.parsePng(cleaned.bytes);
    ok(!after.text.length && !after.time && after.density.x === 300 && after.crcErrors === 0 && !after.damaged, 'cleaned PNG: text and time gone, DPI kept, checksums intact');
    ok(cleaned.bytes.length === png.length - cleaned.removed.reduce((n, x) => n + x.bytes, 0), 'cleaned PNG: exactly the metadata chunks were removed');
    // Orientation in eXIf survives as a minimal block
    const exifPng = new Uint8Array(F.makePng({ extra: [F.pngChunk('eXIf', F.phoneExif({ orientation: 8 }))] }));
    const rex = await Inspect.inspect(exifPng, { name: 'x.png' });
    ok(rex.image.exif.gps && rex.privacy.some(p => p.kind === 'gps'), 'PNG eXIf with GPS flagged');
    const cex = Inspect.parsePng(Inspect.stripMetadata(exifPng, 'png').bytes);
    ok(cex.exif && cex.exif.orientation === 8 && !cex.exif.gps && cex.crcErrors === 0, 'cleaned PNG keeps only the orientation, with a valid checksum');
    // Corrupt checksum
    const bad = new Uint8Array(png); bad[40] ^= 0xFF;
    const rb = await Inspect.inspect(bad, { name: 'bad.png' });
    ok(rb.damaged, 'PNG with a broken checksum is reported as damaged');
  }

  // ------------------------------------------------------------------ renamed file, empty, unknown
  {
    const png = new Uint8Array(F.makePng());
    const r = await Inspect.inspect(png, { name: 'photo.jpg', type: 'image/jpeg' });
    ok(r.key === 'png' && r.extensionAgrees === false && r.warnings.some(w => /name ends in \.jpg, but the contents are a PNG image/.test(w.text)), 'PNG renamed .jpg: mismatch explained');
    const req = Inspect.checkRequirements(r, { formats: ['jpg'] });
    ok(req.rows[0].pass === false && !req.pass, 'PNG renamed .jpg fails a JPEG-only requirement');
    const req2 = Inspect.checkRequirements(r, { formats: ['png'] });
    ok(req2.rows[0].pass === false && /name ends in \.jpg/.test(req2.rows[0].actual), 'real PNG named .jpg still fails a PNG requirement until renamed');

    const empty = await Inspect.inspect(new Uint8Array(0), { name: 'empty.pdf' });
    ok(empty.key === 'empty' && empty.warnings[0].level === 'error', 'empty file reported');
    ok(!Inspect.checkRequirements(empty, { maxKB: 100 }).pass, 'empty file never passes');

    const unknown = new Uint8Array(512); for (let i = 0; i < unknown.length; i++) unknown[i] = (i * 37 + 11) & 255;
    const ru = await Inspect.inspect(unknown, { name: 'data.bin' });
    ok(ru.key === 'unknown' && ru.warnings.some(w => /does not recognise/.test(w.text)), 'unknown binary reported');
    const ru2 = await Inspect.inspect(unknown, { name: 'resume.pdf', type: 'application/pdf' });
    ok(ru2.warnings.some(w => /name ends in \.pdf, but the contents are not a recognised file type/.test(w.text)), 'unknown bytes named .pdf: mismatch explained');
  }

  // ------------------------------------------------------------------ requirements
  {
    const r = await Inspect.inspect(sample('test-portrait.jpg'), { name: 'p.jpg' });
    const kb = r.size.kb;
    const pass = Inspect.checkRequirements(r, { formats: ['jpg', 'png'], minKB: Math.floor(kb) - 1, maxKB: Math.ceil(kb) + 1, width: r.image.width, height: r.image.height, pixelMode: 'exact' });
    ok(pass.pass && pass.rows.length === 3 && pass.rows.every(x => x.pass), 'requirement met: format, size and exact pixels');
    const fail = Inspect.checkRequirements(r, { maxKB: 50, width: r.image.width + 1, pixelMode: 'min', maxPages: 1 });
    ok(!fail.pass && fail.rows.find(x => x.id === 'size').pass === false && fail.rows.find(x => x.id === 'pixels').pass === false && fail.rows.find(x => x.id === 'pages').pass === true, 'requirement failed: size and minimum pixels; an image counts as one page');
    ok(Inspect.checkRequirements(r, {}).rows.length === 0, 'no requirement, no rows');
    ok(Inspect.sizes(245760).kbText === '240.0 KB' && Inspect.sizes(245760).text === '245,760 bytes' && Inspect.sizes(1048576).mbText === '1.00 MB', 'sizes in bytes, KB (1,024) and MB');
  }

  // ------------------------------------------------------------------ PDF
  {
    const doc = await PDFLib.PDFDocument.create();
    doc.setTitle('Marksheet'); doc.setAuthor('Asha Verma'); doc.setCreator('Scanner app'); doc.setProducer('Test producer');
    doc.addPage([595.28, 841.89]); doc.addPage([612, 792]); doc.addPage([841.89, 595.28]);
    const bytes = await doc.save();
    const r = await Inspect.inspect(bytes, { name: 'marks.pdf', type: 'application/pdf', PDFLib });
    ok(r.key === 'pdf' && r.pdf.pages === 3 && /^1\.\d$/.test(r.pdf.version), `PDF: version ${r.pdf.version}, 3 pages`);
    ok(r.pdf.mixedSizes && r.pdf.sizeGroups.length === 2 && r.pdf.mixedOrientation, 'PDF: mixed sizes and orientation flagged');
    const a4 = r.pdf.sizeGroups.find(g => g.paper === 'A4');
    ok(a4 && a4.pages.join() === '1,3' && a4.widthMm === 210 && a4.heightMm === 297 && r.pdf.sizeGroups.find(g => g.paper === 'US Letter').widthIn === 8.5, 'PDF: page sizes in mm and inches, named');
    ok(r.pdf.metadata.title === 'Marksheet' && r.pdf.metadata.author === 'Asha Verma' && r.pdf.metadata.creator === 'Scanner app' && r.pdf.metadata.producer === 'Test producer' && r.pdf.metadata.created, 'PDF: document information read');
    ok(r.privacy.some(p => p.kind === 'author') && !r.pdf.encrypted, 'PDF: author flagged, not encrypted');
    ok(Inspect.checkRequirements(r, { maxPages: 2 }).rows[0].pass === false && Inspect.checkRequirements(r, { maxPages: 3 }).pass, 'PDF: page limit checked');

    const enc = await PDFLib.PDFDocument.create(); enc.addPage(); enc.addPage();
    enc.encrypt({ userPassword: 'secret', ownerPassword: 'owner', permissions: {} });
    const re = await Inspect.inspect(await enc.save(), { name: 'locked.pdf', PDFLib });
    ok(re.pdf.encrypted && re.pdf.needsPassword && re.pdf.pages === 2 && re.warnings.some(w => /password/.test(w.text)), 'PDF with a password: detected, pages still counted');
    const own = await PDFLib.PDFDocument.create(); own.addPage();
    own.encrypt({ userPassword: '', ownerPassword: 'owner', permissions: { printing: 'highResolution' } });
    const ro = await Inspect.inspect(await own.save(), { name: 'restricted.pdf', PDFLib });
    ok(ro.pdf.encrypted && !ro.pdf.needsPassword && ro.warnings.some(w => /permissions/.test(w.text)), 'PDF with permissions only: opens, flagged');

    const broken = new Uint8Array(Buffer.from('%PDF-1.7\n1 0 obj << /Type /Catalog >> garbage'));
    const rb = await Inspect.inspect(broken, { name: 'broken.pdf', PDFLib });
    ok(rb.key === 'pdf' && (rb.damaged || rb.pdf.pages === 0 || rb.pdf.truncated), 'damaged PDF reported');
  }

  // ------------------------------------------------------------------ Office
  {
    const docx = new Uint8Array(F.makeDocx());
    const r = await Inspect.inspect(docx, { name: 'cover-letter.docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    ok(r.key === 'docx' && r.real.label === 'Word document (DOCX)', 'DOCX recognised from its parts');
    const p = r.office.properties, a = r.office.app;
    ok(p.title === 'Cover letter' && p.creator === 'Asha Verma' && p.lastModifiedBy === 'Asha V' && p.created === '2026-10-01T09:00:00Z' && p.modified === '2026-11-02T18:30:00Z', 'DOCX: core properties read');
    ok(a.pages === '2' && a.words === '345' && a.company === 'Example & Co' && a.application === 'Microsoft Office Word', 'DOCX: pages, words, company (entities decoded)');
    ok(r.privacy.some(x => x.kind === 'author') && r.privacy.some(x => x.kind === 'company'), 'DOCX: names and company flagged');
    ok(r.extensionAgrees && r.browserTypeAgrees, 'DOCX: name and type agree');
    ok(Inspect.checkRequirements(r, { formats: ['pdf', 'docx'], maxPages: 2 }).pass, 'DOCX: requirement with pages from app.xml');
    const macro = await Inspect.inspect(new Uint8Array(F.makeDocx({ macros: true })), { name: 'm.docx' });
    ok(macro.office.macros && macro.warnings.some(w => /macros/.test(w.text)), 'macros flagged');
    const zip = await Inspect.inspect(new Uint8Array(F.makeZip([{ name: 'a.txt', data: 'hello' }, { name: 'b.txt', data: 'world', store: true }])), { name: 'files.zip' });
    ok(zip.key === 'zip' && zip.office.files === 2 && zip.warnings.some(w => /ZIP archive with 2 files/.test(w.text)), 'plain ZIP described');
    const asDocx = await Inspect.inspect(new Uint8Array(F.makeZip([{ name: 'a.txt', data: 'hello' }])), { name: 'resume.docx' });
    ok(asDocx.extensionAgrees === false, 'a ZIP named .docx is flagged');
    const cut = docx.subarray(0, docx.length - 30);
    const rc = await Inspect.inspect(cut, { name: 'cut.docx' });
    ok(rc.damaged && /incomplete|damaged/.test(rc.warnings[0].text), 'truncated DOCX reported');
    // Zip bomb guard: a huge core.xml is not inflated
    const bomb = F.makeZip([{ name: 'word/document.xml', data: '<w/>' }, { name: 'docProps/core.xml', data: '<a>' + ' '.repeat(3 * 1024 * 1024) + '</a>' }]);
    const rbomb = await Inspect.inspect(new Uint8Array(bomb), { name: 'big.docx' });
    ok(rbomb.office.propertiesError && /unusually large/.test(rbomb.office.propertiesError), 'oversized document part is not unpacked');
  }

  // ------------------------------------------------------------------ text to PDF
  {
    ok(TextPdf.normalize('a\r\nb\rc\u200Bd\u00ADe') === 'a\nb\ncde', 'normalize: newlines unified, invisible characters removed');
    const bad = TextPdf.findUnsupported('Salary \u20B9 5 lakh \u0928\u092E\u0938\u094D\u0924\u0947 \u{1F600} \u201Cquoted\u201D \u2013 caf\u00E9 \u015Ar\u012B');
    const chars = bad.map(b => b.char);
    ok(chars.includes('\u20B9') && chars.includes('\u0928') && chars.includes('\u{1F600}') && !chars.includes('\u201C') && !chars.includes('\u2013') && !chars.includes('\u00E9'), 'unsupported: rupee, Devanagari, emoji; smart quotes, dashes and accents are fine');
    ok(bad.find(b => b.char === '\u20B9').replacement === 'Rs.' && bad.find(b => b.char === '\u015A').replacement === 'S' && bad.find(b => b.char === '\u0928').replacement === null, 'replacements offered only where faithful');
    ok(/Devanagari/.test(bad.find(b => b.char === '\u0928').name) && bad.find(b => b.char === '\u{1F600}').code === 'U+1F600', 'unsupported characters are named');
    const rep = TextPdf.replaceCommon('Pay \u20B9500 \u2212 tax \u2192 ok \uFB01le');
    ok(rep.text === 'Pay Rs.500 - tax -> ok file' && rep.count === 4, `replaceCommon: ${rep.text}`);
    ok(TextPdf.expandTabs('a\tb', 4) === 'a   b' && TextPdf.expandTabs('abcd\te', 4) === 'abcd    e', 'tabs expand to the next stop');

    const w = s => s.length * 10; // 10 points per character
    const lines = TextPdf.wrap('one two three four five\n\n  indented line\nsuperlongwordthatcannotfit end', w, 100, 4);
    ok(lines[0] === 'one two' && lines[1] === 'three four' && lines[2] === 'five', `wrap: words fill lines (${JSON.stringify(lines.slice(0, 3))})`);
    ok(lines[3] === '' && lines[4].startsWith('  indented'), 'wrap: blank line and indentation kept');
    const long = lines.slice(lines.findIndex(l => l.startsWith('superlong')));
    ok(long[0] === 'superlongw' && long[1] === 'ordthatcan' && long.some(l => l.endsWith('end')), `wrap: long word broken by characters (${JSON.stringify(long)})`);
    ok(lines.every(l => w(l) <= 100), 'wrap: no line wider than the limit');
    ok(TextPdf.wrap('a  b', w, 100)[0] === 'a  b', 'wrap: runs of spaces inside a line kept');

    const text = Array.from({ length: 200 }, (_, i) => `Line ${i + 1}: The quick brown fox jumps over the lazy dog, again and again, until the line has to wrap onto the next one.`).join('\n');
    const planned = await TextPdf.plan(text, { fontSize: 11, lineSpacing: 1.15 }, PDFLib);
    const built = await TextPdf.build(PDFLib, text, { fontSize: 11, lineSpacing: 1.15, title: 'Statement of purpose', pageNumbers: true });
    ok(built.pageCount === planned.pageCount && built.pageCount > 3, `build: page count matches the live plan (${built.pageCount})`);
    const reopened = await PDFLib.PDFDocument.load(built.bytes);
    ok(reopened.getPageCount() === built.pageCount && reopened.getTitle() === 'Statement of purpose', 'build: reopened PDF has the same pages and the title');
    const s = reopened.getPage(0).getSize();
    ok(Math.round(s.width) === 595 && Math.round(s.height) === 842, 'build: A4 pages');
    const letter = await TextPdf.build(PDFLib, 'Hello', { pageSize: 'letter', font: 'courier' });
    const ls = (await PDFLib.PDFDocument.load(letter.bytes)).getPage(0).getSize();
    ok(ls.width === 612 && ls.height === 792 && letter.pageCount === 1, 'build: Letter pages, Courier');
    await assert.rejects(() => TextPdf.build(PDFLib, 'Price \u20B9 100'), e => e.code === 'UNSUPPORTED' && e.characters[0].char === '\u20B9');
    checks++;
    await assert.rejects(() => TextPdf.build(PDFLib, 'ok', { title: 'Name \u0928' }), e => e.code === 'UNSUPPORTED');
    checks++;
    const big = await TextPdf.plan('x\n'.repeat(5000), { fontSize: 10, lineSpacing: 1 }, PDFLib);
    ok(big.pageCount === Math.ceil(5000 / big.perPage), 'plan: pagination of 5,000 lines');
    ok((await TextPdf.plan('', {}, PDFLib)).pageCount === 1, 'plan: empty text is one page');
    ok((await TextPdf.plan('a\n\n\n\n', {}, PDFLib)).lines.length === 1, 'plan: trailing blank lines do not add lines');

    if (has('pdftotext') && has('pdfinfo')) {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ttp-'));
      const file = path.join(dir, 'out.pdf');
      fs.writeFileSync(file, built.bytes);
      const info = execFileSync('pdfinfo', [file], { encoding: 'utf8' });
      ok(new RegExp(`Pages:\\s+${built.pageCount}\\b`).test(info) && /Title:\s+Statement of purpose/.test(info), 'pdfinfo agrees on pages and title');
      const txt = execFileSync('pdftotext', ['-layout', file, '-'], { encoding: 'utf8' });
      ok(/Line 1: The quick brown fox/.test(txt) && /Line 200:/.test(txt) && /Page 1 of/.test(txt), 'pdftotext finds the first and last lines and page numbers');
      fs.rmSync(dir, { recursive: true, force: true });
    } else console.log('  (pdfinfo/pdftotext not installed; skipped)');
  }

  console.log(`\u2713 document tools unit tests: ${checks} checks passed`);
})().catch(e => { console.error(e); process.exit(1); });
