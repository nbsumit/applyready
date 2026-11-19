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

  // Encrypted PDFs: a password-protected file is counted but not read; one whose information pdf-lib
  // cannot decrypt is marked unreadable instead of reported as having none; an incomplete one says so.
  {
    const locked = await PDFLib.PDFDocument.create(); locked.addPage(); locked.setAuthor('A'); locked.encrypt({ userPassword: 'pw', ownerPassword: 'o' });
    const r1 = await Inspect.inspectPdf(await locked.save(), PDFLib);
    ok(r1.encrypted && r1.needsPassword && r1.pages === 1 && !Object.keys(r1.metadata).length, 'password PDF: pages counted, details not read');
    const perm = await PDFLib.PDFDocument.create(); perm.addPage(); perm.setAuthor('A'); perm.encrypt({ userPassword: '', ownerPassword: 'o' });
    const r2 = await Inspect.inspectPdf(await perm.save(), PDFLib);
    ok(r2.encrypted && !r2.needsPassword && (r2.metadata.author === 'A' || r2.infoUnreadable === true), 'permissions-only PDF: author read, or marked unreadable');
    const plain = await PDFLib.PDFDocument.create(); plain.addPage();
    const bytes = await plain.save();
    const cut = await Inspect.inspect(bytes.subarray(0, Math.floor(bytes.length / 2)), { name: 'cut.pdf', PDFLib });
    ok(cut.pdf.truncated && cut.warnings.some(w => w.level !== 'info' && /incomplete/.test(w.text)), 'cut-off PDF: called incomplete (pdf-lib may still recover its pages)');
  }

  // A PDF whose page list is fine but whose pages' content is missing or garbled is damaged (its
  // pages show blank); sound files, blank pages and permissions-only encrypted files are not flagged.
  {
    const make = async encrypt => {
      const d = await PDFLib.PDFDocument.create();
      const font = await d.embedFont(PDFLib.StandardFonts.Helvetica);
      for (let i = 0; i < 3; i++) d.addPage([300, 400]).drawText(`Page ${i + 1}`, { x: 40, y: 300, size: 20, font });
      d.addPage([300, 400]); // blank by design: no content at all
      if (encrypt) d.encrypt(encrypt);
      return d;
    };
    const sound = await Inspect.inspect(await (await make()).save(), { name: 'sound.pdf', PDFLib });
    ok(!sound.damaged && !sound.pdf.unreadablePages, 'sound PDF with a blank page: not flagged as damaged');
    const perm = await Inspect.inspect(await (await make({ userPassword: '', ownerPassword: 'o' })).save(), { name: 'perm.pdf', PDFLib });
    ok(!perm.pdf.unreadablePages, 'permissions-only encrypted PDF: its encrypted content is not mistaken for damage');
    const d = await PDFLib.PDFDocument.load(await (await make()).save({ useObjectStreams: false }));
    const contents = PDFLib.PDFName.of('Contents');
    const garbled = d.context.lookup(d.getPage(1).node.get(contents));
    const first = garbled instanceof PDFLib.PDFArray ? d.context.lookup(garbled.get(garbled.size() - 1)) : garbled;
    first.contents.fill(0x41); // still Flate-labelled, no longer Flate data
    d.getPage(2).node.set(contents, PDFLib.PDFRef.of(9999));
    const bad = await Inspect.inspect(await d.save({ useObjectStreams: false }), { name: 'bad.pdf', PDFLib });
    ok(bad.damaged && bad.pdf.unreadablePages.join() === '2,3' && bad.warnings.some(w => w.level === 'error' && /pages 2-3 is missing or broken/.test(w.text)), `damaged page content: pages named, reported as an error (${bad.pdf.unreadablePages}; ${bad.warnings.map(w => w.text).join(' | ')})`);
    const Kit = require('../js/lib/pdf-kit.js');
    ok((await Kit.unreadablePages(await Kit.openLib(await d.save()))).join() === '1,2', 'the PDF tools find the same damaged pages (0-based)');

    // A Flate stream with only its end cut off still shows most of the page in PDF readers (pdf.js,
    // poppler), so the page is partly damaged, not unreadable: a warning, not "shows blank".
    const zlib = require('zlib');
    let ops = '';
    for (let i = 0; i < 60; i++) ops += `BT /F1 12 Tf 50 ${800 - i * 12} Td (Line ${i} of the page) Tj ET\n`;
    const full = zlib.deflateSync(Buffer.from(ops));
    const onePage = async data => {
      const doc = await PDFLib.PDFDocument.create();
      const f = await doc.embedFont(PDFLib.StandardFonts.Helvetica);
      const pg = doc.addPage([595, 842]);
      pg.node.set(contents, doc.context.register(PDFLib.PDFRawStream.of(doc.context.obj({ Filter: 'FlateDecode', Length: data.length }), new Uint8Array(data))));
      pg.node.set(PDFLib.PDFName.of('Resources'), doc.context.obj({ Font: { F1: f.ref } }));
      return doc.save();
    };
    const cutBytes = await onePage(full.subarray(0, full.length - 10));
    const cutReport = await Inspect.inspect(cutBytes, { name: 'cut-stream.pdf', PDFLib });
    ok(!cutReport.damaged && !cutReport.pdf.unreadablePages && cutReport.pdf.incompletePages.join() === '1'
      && cutReport.warnings.some(w => w.level === 'warning' && /partly damaged: some of the content of its page is cut off or broken\. PDF readers still show the rest/.test(w.text))
      && !cutReport.warnings.some(w => w.level === 'error' || /blank/.test(w.text)), `file checker: a page whose content stream lost its last bytes is partly damaged, not blank (${cutReport.warnings.map(w => `${w.level}: ${w.text}`).join(' | ')})`);
    const cutDamage = await Kit.pageDamage(await Kit.openLib(cutBytes));
    ok(cutDamage.unreadable.length === 0 && cutDamage.incomplete.join() === '0', `PDF tools: the same page is partly damaged, not unreadable (${JSON.stringify(cutDamage)})`);
    const noChecksum = await Kit.pageDamage(await Kit.openLib(await onePage(full.subarray(0, full.length - 4))));
    ok(!noChecksum.unreadable.length && !noChecksum.incomplete.length, 'PDF tools: a stream missing only its checksum is sound');
    const raw = await Kit.pageDamage(await Kit.openLib(await onePage(zlib.deflateRawSync(Buffer.from(ops)))));
    const headerOnly = await Kit.pageDamage(await Kit.openLib(await onePage(full.subarray(0, 2))));
    ok(raw.unreadable.join() === '0' && headerOnly.unreadable.join() === '0', 'PDF tools: Flate data that gives nothing at all (no zlib header, or only a header) is still unreadable');
    // TOOL-2 (PDF): an empty Flate stream (0 bytes) or an empty /Contents array is a blank page by
    // design, like a page with no /Contents; poppler and pdf.js read both without an error.
    const emptyFlate = await onePage(new Uint8Array(0));
    const emptyArray = await (async () => {
      const doc = await PDFLib.PDFDocument.create();
      doc.addPage([300, 400]).node.set(contents, doc.context.obj([]));
      return doc.save();
    })();
    for (const [label, bytes] of [['empty Flate stream', emptyFlate], ['empty /Contents array', emptyArray]]) {
      const tools = await Kit.pageDamage(await Kit.openLib(bytes));
      const report = await Inspect.inspect(bytes, { name: 'blank.pdf', PDFLib });
      ok(!tools.unreadable.length && !tools.incomplete.length && !report.damaged && !report.pdf.unreadablePages && !report.pdf.incompletePages, `${label}: a blank page, not damaged (${JSON.stringify(tools)})`);
    }
  }

  // ------------------------------------------------------------------ names that hide what a file is
  {
    const jpeg = new Uint8Array(F.jpegWithSegments(Buffer.from(sample('test-portrait.jpg')), [F.exifSegment(F.phoneExif({ orientation: 1 }))]));
    for (const name of ['photo.exe', 'photo.jpg.scr', 'photo.xyz']) {
      const r = await Inspect.inspect(jpeg, { name, type: '' });
      ok(r.extensionAgrees === false && r.warnings.some(w => w.level === 'warning' && /name ends in \.[a-z]+, but the contents are a JPEG image\. Renaming a file does not convert it/.test(w.text)), `${name}: JPEG contents under another extension is a mismatch`);
      const req = Inspect.checkRequirements(r, { formats: ['jpg'] });
      ok(!req.pass && req.rows[0].pass === false, `${name}: fails a JPEG-only requirement`);
    }
    ok((await Inspect.inspect(jpeg, { name: 'photo.exe' })).warnings.some(w => /\.exe are treated as programs/.test(w.text)), '.exe: program warning');
    ok(!(await Inspect.inspect(jpeg, { name: 'photo.xyz' })).warnings.some(w => /treated as programs/.test(w.text)), '.xyz: no program warning');
    ok((await Inspect.inspect(new TextEncoder().encode('Notes\nline two\n'), { name: 'notes.log' })).extensionAgrees === null, 'plain text under an unknown extension: no opinion');
    ok((await Inspect.inspect(jpeg, { name: 'photo' })).extensionAgrees === null, 'no extension: no opinion (a separate note says so)');

    const Files = require('../js/lib/files.js');
    ok(Files.withoutHiddenDirection('invoice\u202efdp.exe') === 'invoicefdp.exe' && Files.withoutHiddenDirection('resume\u202excod.jpg') === 'resumexcod.jpg', 'hidden direction characters are removed from a displayed name');
    ok(Files.withoutHiddenDirection('a\u200eb\u200fc\u061cd\u2066e\u2069f\u202ag') === 'abcdefg' && Files.withoutHiddenDirection('Ana\u200d\u0915\u094d\u0937') === 'Ana\u200d\u0915\u094d\u0937', 'every direction control goes; joiners used by real scripts stay');
    ok(Files.safeFileName('invoice\u202efdp.exe') === 'invoice_fdp.exe' && Files.safeFileName('x\u200fy.jpg') === 'x_y.jpg', 'download names never keep a direction character');
  }

  // ------------------------------------------------------------------ PNG chunks that are not about the picture
  {
    const secret = 'author=Jane Doe, device serial 1234, gps 28.6,77.2';
    const png = new Uint8Array(F.makePng({ extra: [F.physChunk(72), F.pngChunk('caBX', Buffer.from(secret)), F.pngChunk('prVt', Buffer.from('private app data')), F.pngChunk('sRGB', Buffer.from([0]))] }));
    const r = await Inspect.inspect(png, { name: 'credentials.png', type: 'image/png' });
    ok(r.image.metadataBytes > 0 && r.metadata.some(m => /Other application data \(C2PA content credentials, prVt\)/.test(m)) && r.canStrip, `PNG: content credentials and private chunks are reported (${r.metadata})`);
    const cleaned = Inspect.stripMetadata(png, 'png');
    const text = Buffer.from(cleaned.bytes).toString('latin1');
    ok(!text.includes('Jane Doe') && !text.includes('prVt') && cleaned.removed.some(x => /C2PA/.test(x.what)), 'cleaned PNG: content credentials and private chunks removed');
    const after = Inspect.parsePng(cleaned.bytes);
    ok(!after.damaged && after.crcErrors === 0 && after.density.x === 72 && text.includes('sRGB') && !after.otherApp.length && !after.metadataBytes, 'cleaned PNG: display chunks (pHYs, sRGB) kept, checksums intact, nothing left to report');
  }

  // ------------------------------------------------------------------ PDF kit: photos without metadata, page limits
  {
    const Kit = require('../js/lib/pdf-kit.js');
    const base = Buffer.from(sample('test-portrait.jpg'));
    // A phone photo with EXIF (camera, serial number, GPS), XMP location, a comment, a colour
    // profile, an APP11 (C2PA) segment and a motion-photo video after the end of the image.
    const withTrailer = Buffer.concat([Buffer.from(F.jpegWithSegments(base, [F.exifSegment(F.phoneExif({ orientation: 1 })), F.xmpSegment('<x:xmpmeta><exif:GPSLatitude>28,36N</exif:GPSLatitude></x:xmpmeta>'), F.commentSegment('Taken at home'), F.iccSegment(), F.jpegSegment(0xEB, Buffer.from('JPC2PA manifest'))])), Buffer.from('motion photo video')]);
    ok(Kit.jpegOrientation(withTrailer) === 1, 'test photo is upright, so it would be embedded without redrawing');
    const clean = Kit.jpegWithoutMetadata(new Uint8Array(withTrailer));
    const info = Inspect.parseJpeg(clean);
    const text = Buffer.from(clean).toString('latin1');
    ok(clean && !info.damaged && !info.exif && !info.xmp && !info.comments.length && !info.otherApp.length && !info.metadataBytes && !info.trailing, 'JPEG for a PDF: EXIF, XMP, comments, APP11 and trailing data removed');
    ok(!text.includes('Exif') && !text.includes('TestCam') && !text.includes('SN12345') && !text.includes('GPSLatitude') && !text.includes('motion photo'), 'JPEG for a PDF: no camera, serial number or location bytes left');
    ok(info.icc && info.width === Inspect.parseJpeg(new Uint8Array(base)).width, 'JPEG for a PDF: colour profile and size kept');
    const scan = b => { const at = Buffer.from(b).indexOf(Buffer.from([0xFF, 0xDA])); return Buffer.from(b).subarray(at); };
    ok(scan(clean).equals(scan(base)), 'JPEG for a PDF: image data copied byte for byte');
    ok(Kit.jpegWithoutMetadata(new Uint8Array(base.subarray(0, base.length / 2))) === null && Kit.jpegWithoutMetadata(new Uint8Array([1, 2, 3])) === null, 'a cut-off or non-JPEG file is not passed through (it is redrawn instead)');
    const doc = await PDFLib.PDFDocument.create();
    const img = await doc.embedJpg(clean);
    doc.addPage().drawImage(img, { x: 0, y: 0, width: 100, height: 100 });
    ok(!Buffer.from(await doc.save()).toString('latin1').includes('Exif'), 'a PDF made from the cleaned photo carries no EXIF');

    // A small crafted PDF whose page tree names one page 200,000 times is refused before copying.
    const n = 200000;
    const kids = Array(n).fill('3 0 R').join(' ');
    const objs = ['<< /Type /Catalog /Pages 2 0 R >>', `<< /Type /Pages /Kids [${kids}] /Count ${n} >>`, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] >>'];
    let pdf = '%PDF-1.7\n';
    const offsets = objs.map((o, i) => { const at = pdf.length; pdf += `${i + 1} 0 obj\n${o}\nendobj\n`; return at; });
    const xref = pdf.length;
    pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('')}trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    const bomb = new Uint8Array(Buffer.from(pdf, 'latin1'));
    const facts = await Kit.inspect(bomb, 'bomb.pdf');
    ok(facts.pageCount === n, `page-tree bomb: claims ${facts.pageCount} pages`);
    const bombDoc = await Kit.openLib(bomb, { name: 'bomb.pdf' });
    const small = await PDFLib.PDFDocument.create(); small.addPage();
    const started = Date.now();
    let refused = null;
    try { await Kit.merge([{ doc: small }, { doc: bombDoc }]); } catch (e) { refused = e; }
    ok(refused && refused.code === 'toolarge' && /2,00,001 pages\. Up to 2,000 pages/.test(refused.message) && Date.now() - started < 2000, `merge refuses more than ${Kit.LIMITS.pages} pages at once, quickly (${refused && refused.message}, ${Date.now() - started} ms)`);
    let extractRefused = null;
    try { await Kit.extract(bombDoc, Array.from({ length: Kit.LIMITS.pages + 1 }, () => 0)); } catch (e) { extractRefused = e; }
    ok(extractRefused && extractRefused.code === 'toolarge', 'extract refuses more than the page limit');
    const fine = await Kit.merge([{ doc: small }, { doc: small }]);
    ok(fine.getPageCount() === 2, 'merging within the limit still works');
    // Page-limit advice: Split PDF is suggested only for a file it can open itself.
    ok(Kit.grouped(2000) === '2,000' && Kit.grouped(200000) === '2,00,000', `page counts are grouped like the rest of the site (${Kit.grouped(2000)}, ${Kit.grouped(200000)})`);
    ok(/with Split PDF first, then compress each part/.test(Kit.splitFirst(400, 'compress each part')), 'a file Split PDF can open is sent to Split PDF');
    const tooLong = Kit.splitFirst(Kit.LIMITS.pages + 1, 'use this tool on each part');
    ok(!/with Split PDF first/.test(tooLong) && /Split PDF also works on up to 2,000 pages/.test(tooLong) && /desktop PDF program/.test(tooLong), `a file Split PDF would refuse is not sent there (${tooLong})`);
    ok(/with Split PDF first/.test(Kit.compressAdvice(500)) && !/with Split PDF first/.test(Kit.compressAdvice(200000)), 'the compressor only suggests splitting when splitting can help');
  }

  console.log(`\u2713 document tools unit tests: ${checks} checks passed`);
})().catch(e => { console.error(e); process.exit(1); });
