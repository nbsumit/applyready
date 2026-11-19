/* Browser tests for the document tools: File checker, Text to PDF and Your data.
   Real files are made in the test (Python PIL for photos, pdf-lib for PDFs, a hand-built DOCX) and
   every output is verified independently: PIL for pixels and metadata, pdfinfo and pdftotext for PDFs,
   the resume schema for backups. Run with BROWSER_EXECUTABLE_PATH set to a local Chromium. */
'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { chromium } = require('playwright');
const AxeBuilder = require('@axe-core/playwright').default;
const PDFLib = require('../js/vendor/pdf-lib.min.js');
const Schema = require('../js/resume-schema.js');
const F = require('./doc_fixtures.js');
const { resumeFixture } = require('./fixtures.js');

const root = path.resolve(__dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'doc-tools-'));
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const file = path.resolve(root, '.' + (pathname.endsWith('/') ? pathname + 'index.html' : pathname));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (e, d) => { res.writeHead(e ? 404 : 200, { 'Content-Type': e ? 'text/html' : mime[path.extname(file)] || 'application/octet-stream' }); res.end(e ? fs.readFileSync(path.join(root, '404.html')) : d); });
});
let checks = 0;
const ok = (c, m) => { assert(c, m); checks++; };
const py = code => execFileSync('python3', ['-c', code], { encoding: 'utf8' }).trim();
const run = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8' });

/* ------------------------------------------------------------------ fixtures */
function makeFixtures() {
  py(`
from PIL import Image, PngImagePlugin
w, h = 640, 480
im = Image.new('RGB', (w, h))
px = im.load()
for y in range(h):
    for x in range(w):
        px[x, y] = ((x * 7) % 256, (y * 5) % 256, (x * y) % 256)
ex = Image.Exif()
ex[0x010F] = 'TestCam'; ex[0x0110] = 'Model X1'; ex[0x0112] = 6; ex[0x0131] = 'PhoneOS 1'
ex[0x8825] = {1: 'N', 2: (28.0, 36.0, 50.04), 3: 'E', 4: (77.0, 12.0, 32.4)}
im.save(${JSON.stringify(path.join(tmp, 'gps.jpg'))}, quality=90, exif=ex.tobytes(), dpi=(300, 300))
info = PngImagePlugin.PngInfo()
info.add_text('Author', 'Asha Verma')
info.add_text('Comment', 'Scanned at home')
rgba = im.convert('RGBA').resize((200, 150))
rgba.save(${JSON.stringify(path.join(tmp, 'info.png'))}, pnginfo=info, dpi=(300, 300))
Image.new('RGB', (120, 80), (200, 30, 30)).save(${JSON.stringify(path.join(tmp, 'renamed.png'))})
`);
}
async function makePdf() {
  const doc = await PDFLib.PDFDocument.create();
  doc.setTitle('Degree certificate'); doc.setAuthor('Asha Verma'); doc.setCreator('Scanner app'); doc.setProducer('Test producer');
  doc.addPage([595.28, 841.89]); doc.addPage([612, 792]); doc.addPage([595.28, 841.89]);
  return Buffer.from(await doc.save());
}

(async () => {
  makeFixtures();
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const exe = process.env.BROWSER_EXECUTABLE_PATH;
  const browser = await chromium.launch({ headless: true, ...(exe ? { executablePath: exe } : {}), args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const newContext = async (opts) => {
    const context = await browser.newContext(Object.assign({ viewport: { width: 1280, height: 900 }, acceptDownloads: true }, opts || {}));
    await context.route('**/*', r => /^(http:\/\/127\.|blob:|data:)/.test(r.request().url()) ? r.continue() : r.abort());
    return context;
  };
  const errors = [];
  const watch = page => {
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (/Content Security Policy|Refused to/.test(m.text())) errors.push(m.text()); });
  };
  const download = async (page, click) => {
    const [d] = await Promise.all([page.waitForEvent('download'), click()]);
    const file = path.join(tmp, `${Date.now()}-${d.suggestedFilename()}`);
    await d.saveAs(file);
    return { file, name: d.suggestedFilename() };
  };
  const axe = async (page, label) => {
    for (const scheme of ['light', 'dark']) {
      await page.evaluate(s => { document.documentElement.dataset.theme = s; }, scheme);
      await page.waitForTimeout(400); // let colour transitions finish before measuring contrast
      const result = await new AxeBuilder({ page }).analyze();
      ok(result.violations.length === 0, `${label} (${scheme}): axe violations ${result.violations.map(v => `${v.id}: ${v.nodes.slice(0, 3).map(n => n.target.join(' ')).join(', ')}`).join('; ')}`);
    }
    await page.evaluate(() => { document.documentElement.dataset.theme = 'light'; });
  };
  const noOverflow = async (page, label) => {
    const w = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    ok(w <= 0, `${label}: no horizontal scroll (${w}px)`);
  };

  /* ================================================================== 1. File checker */
  {
    const context = await newContext();
    const page = await context.newPage();
    watch(page);
    await page.goto(origin + '/file-checker.html');
    const card = name => page.locator('.fc-item', { has: page.locator('.fc-card__name', { hasText: name }) });
    const pdf = await makePdf();
    const unknown = Buffer.alloc(2048); for (let i = 0; i < unknown.length; i++) unknown[i] = (i * 37 + 11) & 255;
    const truncated = fs.readFileSync(path.join(tmp, 'gps.jpg')).subarray(0, 4000);
    await page.setInputFiles('#fcDropInput', [
      { name: 'gps.jpg', mimeType: 'image/jpeg', buffer: fs.readFileSync(path.join(tmp, 'gps.jpg')) },
      { name: 'info.png', mimeType: 'image/png', buffer: fs.readFileSync(path.join(tmp, 'info.png')) },
      { name: 'renamed.jpg', mimeType: 'image/jpeg', buffer: fs.readFileSync(path.join(tmp, 'renamed.png')) },
      { name: 'certificate.pdf', mimeType: 'application/pdf', buffer: pdf },
      { name: 'cover-letter.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: F.makeDocx() },
      { name: 'empty.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(0) },
      { name: 'data.bin', mimeType: 'application/octet-stream', buffer: unknown },
      { name: 'cut.jpg', mimeType: 'image/jpeg', buffer: truncated }
    ]);
    await page.waitForFunction(() => document.querySelectorAll('.fc-item[data-status="done"]').length === 8, null, { timeout: 30000 });
    ok(await page.locator('#checkerApp').getAttribute('data-state') === 'ready', 'file checker: workspace is ready once files are added');
    ok(/8 files: 8 checked/.test(await page.locator('#fcCounts').innerText()), 'file checker: counts');

    const jpg = await card('gps.jpg').innerText();
    ok(/JPEG image/.test(jpg) && /640 \u00D7 480 px/.test(jpg) && /300 DPI/.test(jpg), 'JPEG: type, pixels and DPI');
    ok(/Yes: 28\.6139\d, 77\.2090\d/.test(jpg) && /GPS location is stored in this photo/.test(jpg), 'JPEG: GPS location shown with a privacy warning');
    ok(/TestCam Model X1/.test(jpg) && /Rotated 90\u00B0 clockwise/.test(jpg) && /PhoneOS 1/.test(jpg), 'JPEG: camera, orientation and software');
    ok(await card('gps.jpg').locator('.fc-risk').count() >= 1, 'JPEG: GPS row highlighted');
    const png = await card('info.png').innerText();
    ok(/200 \u00D7 150 px/.test(png) && /300 DPI/.test(png) && /Author: Asha Verma/.test(png) && /Colour with transparency/.test(png), 'PNG: pixels, pHYs DPI, text chunks, transparency');
    const renamed = await card('renamed.jpg').innerText();
    ok(/name ends in \.jpg, but the contents are a PNG image/.test(renamed) && /Does not match the name/.test(renamed), 'PNG renamed .jpg: mismatch explained');
    const cert = await card('certificate.pdf').innerText();
    ok(/PDF version\s+1\.\d/.test(cert) && /Pages\s+3/.test(cert), 'PDF: version and page count');
    ok(/Pages 1, 3\s+210 \u00D7 297 mm/.test(cert) && /216 \u00D7 279 mm/.test(cert) && /8\.5 \u00D7 11 in/.test(cert) && /different sizes/.test(cert), 'PDF: page sizes in mm and inches, mixed sizes flagged');
    ok(/Degree certificate/.test(cert) && /Asha Verma/.test(cert) && /Scanner app/.test(cert) && /Test producer/.test(cert) && /Encrypted\s+No/.test(cert), 'PDF: metadata and encryption');
    const docx = await card('cover-letter.docx').innerText();
    ok(/Word document \(DOCX\)/.test(docx) && /Cover letter/.test(docx) && /Asha Verma/.test(docx) && /Asha V\b/.test(docx) && /Pages\s+2/.test(docx) && /Words\s+345/.test(docx), 'DOCX: core and app properties');
    ok(/1 Oct 2026/.test(docx) || /2 Nov 2026/.test(docx), 'DOCX: dates shown readably');
    ok(/empty \(0 bytes\)/.test(await card('empty.pdf').innerText()), 'empty file reported');
    ok(/does not recognise this file type/.test(await card('data.bin').innerText()), 'unknown binary reported');
    ok(/incomplete|could not open/.test(await card('cut.jpg').innerText()) && await card('cut.jpg').locator('[data-action="clean"]').count() === 0, 'truncated JPEG reported as damaged and not offered for cleaning');
    ok(await card('certificate.pdf').locator('[data-action="clean"]').count() === 0 && /only inspected here/.test(cert), 'PDF: read-only, explained');
    await axe(page, 'file checker with reports');
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 800 });
      await noOverflow(page, `file checker with reports at ${width}px`);
    }
    await page.setViewportSize({ width: 1280, height: 900 });

    // Requirement check
    await page.click('#fcReq summary');
    await page.check('#fcReq input[value="jpg"]');
    await page.check('#fcReq input[value="png"]');
    await page.fill('#fcMaxKB', '500');
    await page.fill('#fcWidth', '640');
    await page.fill('#fcHeight', '480');
    await page.waitForTimeout(400);
    ok(/Meets the requirement/.test(await card('gps.jpg').locator('.fc-card__head').innerText()), 'requirement: matching JPEG passes');
    ok(/Does not meet it/.test(await card('info.png').locator('.fc-card__head').innerText()), 'requirement: PNG of the wrong pixel size fails');
    ok(/Does not meet it/.test(await card('renamed.jpg').locator('.fc-card__head').innerText()), 'requirement: PNG named .jpg fails');
    const table = await card('info.png').locator('.fc-check').innerText();
    ok(/Pixel size/.test(table) && /Exactly 640 \u00D7 480 px/.test(table) && /200 \u00D7 150 px/.test(table) && /Does not/.test(table), 'requirement: table shows required against actual');
    ok(/1 meets the requirement, 7 do not/.test(await page.locator('#fcCounts').innerText()), 'requirement: summary counts');
    await page.click('#fcReq [data-mode="min"]');
    await page.fill('#fcMinKB', '600');
    await page.waitForTimeout(400);
    ok(await page.locator('#fcReqError').isVisible() && /larger than the maximum/.test(await page.locator('#fcReqError').innerText()), 'requirement: min above max is an error');
    ok(await page.getAttribute('#fcMinKB', 'aria-describedby') === 'fcReqError' && await page.getAttribute('#fcMaxKB', 'aria-describedby') === 'fcReqError' && await page.getAttribute('#fcWidth', 'aria-describedby') === null, 'requirement: the invalid fields point to the error message');
    await page.click('#fcReqClear');
    ok(await page.getAttribute('#fcMinKB', 'aria-describedby') === null && await page.getAttribute('#fcMinKB', 'aria-invalid') === 'false', 'requirement: fixed fields no longer point to an error');
    ok(await page.locator('.fc-badge').count() === 0 && /Optional/.test(await page.locator('#fcReqState').innerText()), 'requirement cleared');
    await axe(page, 'file checker with the requirement open');

    // Remove metadata, verify with PIL
    for (const [name, ext] of [['gps.jpg', 'jpg'], ['info.png', 'png']]) {
      await card(name).locator('[data-action="clean"]').click();
      await card(name).locator('[data-action="download"]').waitFor({ timeout: 15000 });
      const text = await card(name).locator('.fc-clean').innerText();
      ok(/Metadata removed/.test(text) && /pixels identical to the original/.test(text), `${name}: cleaned, verified in the page`);
      const { file, name: dl } = await download(page, () => card(name).locator('[data-action="download"]').click());
      ok(dl === name.replace(/\.(\w+)$/, `-clean.${ext}`), `${name}: download name ${dl}`);
      const orig = path.join(tmp, name);
      const verdict = py(`
from PIL import Image
a = Image.open(${JSON.stringify(orig)}); b = Image.open(${JSON.stringify(file)})
ea, eb = a.getexif(), b.getexif()
print('|'.join([str(a.size == b.size), str(a.mode == b.mode), str(a.tobytes() == b.tobytes()), str(dict(eb)), str(bool(eb.get_ifd(0x8825))), str('Author' in b.info or 'Comment' in b.info), str(b.info.get('dpi'))]))`);
      const [sameSize, sameMode, samePixels, exifLeft, gpsLeft, textLeft, dpi] = verdict.split('|');
      ok(sameSize === 'True' && sameMode === 'True' && samePixels === 'True', `${name}: PIL decodes identical pixels (${verdict})`);
      ok(gpsLeft === 'False' && textLeft === 'False', `${name}: GPS and text metadata gone (${verdict})`);
      if (ext === 'jpg') ok(exifLeft === '{274: 6}', `JPEG: only the orientation is left in EXIF (${exifLeft})`);
      else ok(exifLeft === '{}' && /\(299\.99|\(300/.test(dpi), `PNG: no EXIF, DPI kept (${exifLeft}, ${dpi})`);
    }
    ok(await page.locator('#fcZip').isVisible(), 'two cleaned copies: ZIP button shown');
    const zip = await download(page, () => page.click('#fcZip'));
    run('unzip', ['-t', zip.file]);
    ok(/gps-clean\.jpg/.test(run('unzip', ['-l', zip.file])), 'ZIP of cleaned copies passes unzip -t');
    await axe(page, 'file checker after cleaning');

    // Remove one, clear the list (cleaned copies were downloaded, so no confirmation)
    await card('data.bin').locator('[data-action="remove"]').click();
    ok(await card('data.bin').count() === 0, 'one file removed from the list');
    await page.click('#fcClear');
    ok(await page.locator('.fc-item').count() === 0 && await page.locator('#checkerApp').getAttribute('data-state') === 'empty', 'list cleared, back to empty');

    // Oversized: only type and size
    const big = Buffer.alloc(51 * 1024 * 1024); big.set([0xFF, 0xD8, 0xFF, 0xE0]);
    fs.writeFileSync(path.join(tmp, 'huge.jpg'), big);
    await page.setInputFiles('#fcDropInput', path.join(tmp, 'huge.jpg'));
    await page.waitForFunction(() => document.querySelector('.fc-item[data-status="done"]'), null, { timeout: 30000 });
    ok(/larger than the 50 MB/.test(await card('huge.jpg').innerText()) && /53\.48 MB|53,477\.4 KB/.test(await card('huge.jpg').innerText()), 'file over the inspection limit: type and size only, explained');
    // PF-9: the headline gives the size as every other tool does (Files.formatBytes), not always in KB.
    const bigSub = await card('huge.jpg').locator('.fc-card__sub').innerText();
    ok(bigSub.includes('53.48 MB') && !/53,477\.4 KB/.test(bigSub), `file checker: a file over 1 MB is headed in MB, as in every tool (${bigSub})`);
    await page.click('#fcClear');

    // Names that disguise the extension, program extensions, and a picture too large to open safely
    {
      const gpsBytes = fs.readFileSync(path.join(tmp, 'gps.jpg'));
      const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(20000, 0); ihdr.writeUInt32BE(20000, 4); ihdr[8] = 8; ihdr[9] = 0;
      const bombPng = Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), F.pngChunk('IHDR', ihdr), F.pngChunk('IDAT', require('node:zlib').deflateSync(Buffer.alloc(20001))), F.pngChunk('IEND', Buffer.alloc(0))]);
      await page.setInputFiles('#fcDropInput', [
        { name: 'invoice\u202Efdp.exe', mimeType: 'image/jpeg', buffer: gpsBytes },
        { name: 'photo.exe', mimeType: 'application/octet-stream', buffer: gpsBytes },
        { name: 'bomb.png', mimeType: 'image/png', buffer: bombPng }
      ]);
      await page.waitForFunction(() => document.querySelectorAll('.fc-item[data-status="done"]').length === 3, null, { timeout: 30000 });
      const names = await page.locator('.fc-card__name').allInnerTexts();
      ok(names.includes('invoicefdp.exe') && !names.some(n => /\u202E/.test(n)), `a name with a right-to-left override is shown as it really is (${names})`);
      const rlo = await card('invoicefdp.exe').innerText();
      ok(/hidden characters that reverse the direction of text/.test(rlo) && /really ends in \.exe/.test(rlo) && /Does not match the name/.test(rlo) && /\.exe are treated as programs/.test(rlo), 'disguised name: warned, real extension shown, mismatch and program warnings');
      const exe = await card('photo.exe').innerText();
      ok(/name ends in \.exe, but the contents are a JPEG image/.test(exe) && /Does not match the name/.test(exe), 'a JPEG named .exe is a mismatch');
      const bomb = await card('bomb.png').innerText();
      ok(/400 megapixels/.test(bomb) && /too large to open safely/.test(bomb) && /Not tested/.test(bomb) && !/Opens in this browser\s+Yes/.test(bomb) && await card('bomb.png').locator('.file-row__thumb img').count() === 0, 'a picture over 50 megapixels is not decoded or reported as opening');
      await page.evaluate(() => { document.getElementById('fcReq').open = true; });
      await page.check('#fcReq input[value="jpg"]');
      await page.waitForTimeout(400);
      ok(/Does not meet it/.test(await card('photo.exe').locator('.fc-card__head').innerText()) && /Does not meet it/.test(await card('invoicefdp.exe').locator('.fc-card__head').innerText()), 'a JPEG under a program extension fails a JPEG requirement');
      await page.click('#fcReqClear');
      await axe(page, 'file checker with disguised and oversized files');
      await page.click('#fcClear');
      if (await page.locator('.dialog [data-act="ok"]').count()) await page.click('.dialog [data-act="ok"]');
    }

    // More than 50 files, cancel and retry
    const many = Array.from({ length: 52 }, (_, i) => ({ name: `doc-${i + 1}.pdf`, mimeType: 'application/pdf', buffer: pdf }));
    await page.setInputFiles('#fcDropInput', many);
    ok(/Only 50 files can be in the list at once, so 2 were not added/.test(await page.locator('#fcError').innerText()), 'more than 50 files: refused with a message');
    await page.locator('#fcCancel').click({ timeout: 5000 });
    await page.waitForFunction(() => !document.querySelector('.fc-item[data-status="processing"], .fc-item[data-status="queued"]'), null, { timeout: 30000 });
    const cancelled = await page.locator('.fc-item[data-status="cancelled"]').count();
    ok(cancelled > 0 && /not checked/.test(await page.locator('#fcCounts').innerText()), `stop: ${cancelled} files left unchecked`);
    const first = page.locator('.fc-item[data-status="cancelled"]').first();
    const id = await first.getAttribute('data-id');
    await first.locator('[data-action="retry"]').click();
    await page.waitForFunction(i => document.querySelector(`.fc-item[data-id="${i}"]`).dataset.status === 'done', id, { timeout: 15000 });
    ok(true, 'retry checks a stopped file');
    if (cancelled > 2) {
      ok(await page.locator('#fcResume').isVisible(), 'stop: Check the rest is offered');
      await page.click('#fcResume');
      await page.waitForFunction(() => document.querySelectorAll('.fc-item[data-status="done"]').length === 50, null, { timeout: 60000 });
      ok(await page.locator('#fcResume').isHidden() && /50 checked/.test(await page.locator('#fcCounts').innerText()), 'Check the rest checks every stopped file');
    }
    await page.click('#fcClear');
    // Protected and incomplete PDFs, and a file removed while its metadata is being removed
    await page.goto(origin + '/file-checker.html');
    const encDoc = await PDFLib.PDFDocument.create(); encDoc.addPage(); encDoc.addPage(); encDoc.setAuthor('Hidden Author');
    encDoc.encrypt({ userPassword: 'secret', ownerPassword: 'owner' });
    const permDoc = await PDFLib.PDFDocument.create(); permDoc.addPage(); permDoc.setAuthor('Permissions Author');
    permDoc.encrypt({ userPassword: '', ownerPassword: 'owner', permissions: { printing: false } });
    await page.setInputFiles('#fcDropInput', [
      { name: 'locked.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await encDoc.save()) },
      { name: 'restricted.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await permDoc.save()) },
      { name: 'half.pdf', mimeType: 'application/pdf', buffer: pdf.subarray(0, Math.floor(pdf.length / 2)) },
      { name: 'gps.jpg', mimeType: 'image/jpeg', buffer: fs.readFileSync(path.join(tmp, 'gps.jpg')) }
    ]);
    await page.waitForFunction(() => document.querySelectorAll('.fc-item[data-status="done"]').length === 4, null, { timeout: 30000 });
    const locked = await card('locked.pdf').innerText();
    ok(/protected with a password/.test(locked) && /Pages\s+2/.test(locked) && /needs a password to open/.test(locked) && !/Hidden Author/.test(locked), 'password-protected PDF: explained, pages counted, nothing else claimed');
    const restricted = await card('restricted.pdf').innerText();
    ok(/encrypted with permissions/.test(restricted) && /opens without a password/.test(restricted) && /Pages\s+1/.test(restricted) && (/Permissions Author/.test(restricted) || /Could not be read in this encrypted file/.test(restricted)), 'permissions-only PDF: opened; its author is shown or the page says it could not be read');
    ok(/incomplete/.test(await card('half.pdf').innerText()), 'cut-off PDF: reported as incomplete');
    await card('gps.jpg').locator('[data-action="clean"]').click();
    await card('gps.jpg').locator('[data-action="remove"]').click();
    await page.waitForTimeout(1500);
    ok(await card('gps.jpg').count() === 0 && await page.locator('.fc-item').count() === 3, 'removing a file while it is being cleaned drops it for good');

    ok(errors.length === 0, `file checker: no page errors (${errors.join(' | ')})`);
    await context.close();
    console.log('\u2713 File checker: real files, mismatches, PDFs, DOCX, requirement, lossless cleaning verified with PIL, limits, cancel and retry');
  }

  /* ================================================================== 2. Text to PDF */
  {
    const context = await newContext();
    const page = await context.newPage();
    watch(page);
    await page.goto(origin + '/text-to-pdf.html');
    await page.click('#ttpCreate');
    ok(await page.locator('#ttpTextError').isVisible() && /Type or paste some text/.test(await page.locator('#ttpTextError').innerText()), 'empty text: field error');

    const long = 'Supercalifragilisticexpialidociousandthensomemorelettersthatneverend'.repeat(3);
    const lines = [];
    for (let i = 1; i <= 160; i++) lines.push(`Line ${i}:\tThe quick brown fox jumps over the lazy dog, then keeps running across the field until the line wraps.`);
    lines.splice(10, 0, '', '', long, '');
    const text = lines.join('\n');
    await page.fill('#ttpText', text);
    await page.fill('#ttpTitle', 'Statement of purpose');
    await page.waitForFunction(() => /\d+ pages? on A4/.test(document.getElementById('ttpSummary').textContent), null, { timeout: 10000 });
    const planned = Number((await page.locator('#ttpSummary').innerText()).match(/(\d+) pages?/)[1]);
    ok(planned >= 4, `live page count (${planned})`);
    ok(await page.locator('#ttpChars').isHidden(), 'plain English text: no unsupported characters');
    await page.click('#ttpCreate');
    await page.locator('#ttpResult').waitFor({ state: 'visible', timeout: 20000 });
    ok(new RegExp(`^${planned} \\(checked`).test(await page.locator('#ttpResPages').innerText()), 'result: page count verified by reopening');
    await axe(page, 'text to PDF result');
    const out = await download(page, () => page.click('#ttpDownload'));
    ok(out.name === 'Statement of purpose.pdf', `download name ${out.name}`);
    const info = run('pdfinfo', [out.file]);
    ok(new RegExp(`Pages:\\s+${planned}\\b`).test(info) && /Title:\s+Statement of purpose/.test(info) && /595\.\d* x 841\.\d* pts \(A4\)/.test(info), `pdfinfo: ${planned} A4 pages and the title`);
    const txt = run('pdftotext', ['-layout', out.file, '-']);
    ok(/Statement of purpose/.test(txt) && /Line 1:\s+The quick brown fox/.test(txt) && /Line 160:/.test(txt) && new RegExp(`Page ${planned} of ${planned}`).test(txt), 'pdftotext: title, first and last line, page numbers');
    ok(/Supercalifragilistic/.test(txt) && txt.split('\n').every(l => l.length < 140), 'pdftotext: the long word wraps instead of running off the page');
    const pageLines = run('pdftotext', ['-f', '1', '-l', '1', out.file, '-']);
    ok(/Line 1:/.test(pageLines) && /\n\n/.test(pageLines), 'blank lines kept');

    // Letter, Courier, no page numbers
    await page.click('#ttpEdit');
    await page.click('#ttpPaper [data-value="letter"]');
    await page.selectOption('#ttpFont', 'courier');
    await page.uncheck('#ttpNumbers');
    await page.waitForTimeout(400);
    await page.click('#ttpCreate');
    await page.locator('#ttpResult').waitFor({ state: 'visible', timeout: 20000 });
    const letter = await download(page, () => page.click('#ttpDownload'));
    const li = run('pdfinfo', [letter.file]);
    ok(/612 x 792 pts \(letter\)/.test(li) && !/Page 1 of/.test(run('pdftotext', [letter.file, '-'])), 'US Letter, Courier, without page numbers');

    // Unsupported characters
    await page.click('#ttpEdit');
    await page.fill('#ttpTitle', '');
    await page.fill('#ttpText', 'Expected salary: \u20B9 5 lakh \u2212 negotiable.\nName in Hindi: \u0928\u092E\u0938\u094D\u0924\u0947 \u{1F600}');
    await page.locator('#ttpChars').waitFor({ state: 'visible' });
    const chars = await page.locator('#ttpChars').innerText();
    ok(/Indian rupee sign/.test(chars) && /becomes Rs\./.test(chars) && /Devanagari/.test(chars) && /emoji/.test(chars), 'unsupported characters listed with names');
    await axe(page, 'text to PDF with the character warning');
    await page.click('#ttpCreate');
    ok(/cannot be shown/.test(await page.locator('#ttpError').innerText()) && await page.locator('#ttpResult').isHidden(), 'Create is refused while unsupported characters remain');
    await page.evaluate(() => { window.__printed = null; window.print = () => { window.__printed = { cls: document.body.className, text: document.querySelector('.ttp-print').textContent }; }; });
    await page.click('#ttpPrint');
    const printed = await page.evaluate(() => window.__printed);
    ok(printed && /ttp-printing/.test(printed.cls) && /\u0928\u092E\u0938\u094D\u0924\u0947/.test(printed.text), 'print view holds the original text, Hindi included');
    await page.click('#ttpReplace');
    ok(/Rs\. 5 lakh - negotiable/.test(await page.inputValue('#ttpText')), 'common characters replaced');
    await page.click('#ttpUndo');
    ok(/\u20B9/.test(await page.inputValue('#ttpText')), 'undo restores the text');
    await page.click('#ttpReplace');
    await page.click('#ttpRemove');
    await page.click('.dialog [data-act="ok"]');
    ok(!/[\u0900-\u097F]/.test(await page.inputValue('#ttpText')), 'remaining characters removed after confirmation');
    await page.waitForTimeout(400);
    await page.click('#ttpCreate');
    await page.locator('#ttpResult').waitFor({ state: 'visible', timeout: 20000 });
    const rs = await download(page, () => page.click('#ttpDownload'));
    ok(/Rs\. 5 lakh - negotiable/.test(run('pdftotext', [rs.file, '-'])), 'PDF contains the replaced text');

    // Opening files: UTF-16 with BOM, too large, not text
    await page.click('#ttpEdit');
    const utf16 = Buffer.concat([Buffer.from([0xFF, 0xFE]), Buffer.from('Caf\u00E9 letter\nSecond line', 'utf16le')]);
    page.once('dialog', d => d.accept());
    await page.setInputFiles('#ttpDropInput', { name: 'notepad.txt', mimeType: 'text/plain', buffer: utf16 });
    await page.locator('.dialog [data-act="ok"]').click();
    await page.waitForFunction(() => /Caf\u00E9 letter/.test(document.getElementById('ttpText').value));
    ok(true, 'UTF-16 text file (Notepad "Unicode") opens');
    // 5.2 MB as the site counts sizes (1 MB = 1,000,000 bytes), though under 5 x 1,024 x 1,024 bytes (PF-8).
    await page.setInputFiles('#ttpDropInput', { name: 'big.txt', mimeType: 'text/plain', buffer: Buffer.alloc(5200000, 97) });
    ok(/big\.txt is 5\.2 MB\. Text files up to 5 MB/.test(await page.locator('#ttpError').innerText()), `text file of 5.2 MB refused as over 5 MB (${await page.locator('#ttpError').innerText()})`);
    await page.setInputFiles('#ttpDropInput', { name: 'photo.txt', mimeType: 'text/plain', buffer: fs.readFileSync(path.join(tmp, 'gps.jpg')) });
    await page.waitForFunction(() => /not plain text/.test(document.getElementById('ttpError').textContent));
    ok(/JPEG image, not plain text/.test(await page.locator('#ttpError').innerText()), 'a JPEG named .txt is refused');

    // Cancel a long job, then make it again
    await page.evaluate(() => { const t = document.getElementById('ttpText'); t.value = Array.from({ length: 60000 }, (_, i) => `Row ${i + 1}`).join('\n'); t.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.selectOption('#ttpSpacing', '2');
    await page.waitForTimeout(800);
    await page.click('#ttpCreate');
    await page.locator('#ttpProgress').waitFor({ state: 'visible' });
    await page.click('#ttpCancel');
    await page.locator('#ttpProgress').waitFor({ state: 'hidden', timeout: 30000 });
    ok(await page.locator('#ttpResult').isHidden(), 'cancel: no PDF offered');
    await page.selectOption('#ttpSpacing', '1');
    await page.evaluate(() => { const t = document.getElementById('ttpText'); t.value = t.value.split('\n').slice(0, 3000).join('\n'); t.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.waitForTimeout(500);
    await page.click('#ttpCreate');
    await page.locator('#ttpResult').waitFor({ state: 'visible', timeout: 60000 });
    const again = await download(page, () => page.click('#ttpDownload'));
    const pagesAgain = Number(run('pdfinfo', [again.file]).match(/Pages:\s+(\d+)/)[1]);
    ok(pagesAgain > 40 && /Row 3000/.test(run('pdftotext', ['-f', String(pagesAgain), '-l', String(pagesAgain), again.file, '-'])), `after cancelling, a new PDF is made (${pagesAgain} pages, last row on the last page)`);
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 800 });
      if (await page.locator('#ttpEdit').isVisible()) await page.click('#ttpEdit');
      await noOverflow(page, `text to PDF at ${width}px`);
    }
    ok(errors.length === 0, `text to PDF: no page errors (${errors.join(' | ')})`);
    await context.close();
    console.log('\u2713 Text to PDF: wrapping, pagination, page numbers, Letter/Courier, unsupported characters, print fallback, file opening, cancel (pdfinfo and pdftotext)');
  }

  /* ================================================================== 3. Your data */
  {
    const context = await newContext();
    const page = await context.newPage();
    watch(page);
    // Zero resumes first
    await page.goto(origin + '/your-data.html');
    await page.waitForFunction(() => document.getElementById('ydResumeCount').textContent !== 'Checking\u2026');
    ok(await page.locator('#ydResumeCount').innerText() === 'None' && await page.locator('#ydResumeEmpty').isVisible() && await page.locator('#ydExport').isHidden(), 'your data: zero resumes shown gracefully');
    await page.waitForTimeout(500);
    ok(await page.evaluate(async () => !(await indexedDB.databases()).some(d => d.name === 'applyready')), 'your data: looking at the page creates no database');
    await axe(page, 'your data, empty');

    // A readable draft left in localStorage by a release before the resume library is listed,
    // downloadable as an importable backup, and deletable, even with saving off in the builder.
    await page.evaluate(d => localStorage.setItem('applyready_resume_draft', JSON.stringify({ app: 'ApplyReady', version: 2, savedAt: '2026-06-01T10:00:00Z', data: Object.assign({}, d, { personal: Object.assign({}, d.personal, { fullName: 'Previous Person' }) }) })), resumeFixture());
    await page.reload();
    await page.waitForFunction(() => /earlier draft/.test(document.getElementById('ydResumeCount').textContent));
    ok(await page.locator('#ydResumeCount').innerText() === '1 earlier draft' && await page.locator('#ydResumeEmpty').isHidden(), 'your data: an earlier draft is counted');
    const draftRow = await page.locator('#ydResumeList [data-legacy]').innerText();
    ok(/Draft from an earlier version: Previous Person/.test(draftRow) && /1 Jun 2026/.test(draftRow), `your data: the earlier draft is listed with its name and date (${draftRow})`);
    // On a phone the name wraps instead of being cut off: it is how a shared-computer user tells whose draft it is.
    const wideView = page.viewportSize();
    await page.setViewportSize({ width: 360, height: 740 });
    const draftName = await page.locator('#ydResumeList [data-legacy] .file-row__name').evaluate(el => ({ fits: el.scrollWidth <= el.clientWidth + 1, text: el.textContent, pageFits: document.documentElement.scrollWidth <= 360 }));
    ok(draftName.fits && draftName.pageFits && /: Previous Person/.test(draftName.text), `your data at 360px: the earlier draft's name is shown in full, not cut off (${JSON.stringify(draftName)})`);
    await page.setViewportSize(wideView);
    await axe(page, 'your data, earlier draft');
    const draftFile = await download(page, () => page.click('[data-act="legacy-download"]'));
    const draftBody = JSON.parse(fs.readFileSync(draftFile.file, 'utf8'));
    ok(draftBody.app === 'ApplyReady' && draftBody.data && draftBody.data.personal.fullName === 'Previous Person' && Schema.validate(draftBody), 'your data: the earlier draft downloads as an importable backup');
    await page.click('[data-act="legacy-delete"]');
    await page.click('.dialog [data-act="ok"]');
    await page.waitForFunction(() => document.getElementById('ydResumeCount').textContent === 'None');
    ok(await page.evaluate(() => localStorage.getItem('applyready_resume_draft') === null), 'your data: the earlier draft is deleted');

    // Seed resumes in the ARCHITECTURE.md record format and localStorage keys
    const data = resumeFixture();
    const now = Date.now();
    await page.evaluate(async ({ data, now }) => {
      const S = window.ApplyReadyStore;
      await S.put('resumes', { id: 'r_analyst01', name: 'Resume for analyst roles', createdAt: now - 86400000, updatedAt: now - 3600000, schemaVersion: 3, data });
      await S.put('resumes', { id: 'r_ops02', name: 'Operations resume', createdAt: now - 7200000, updatedAt: now - 60000, schemaVersion: 3, data: Object.assign({}, data, { personal: Object.assign({}, data.personal, { fullName: 'Second Person' }) }) });
      await S.put('resumes', { id: 'r_broken3', name: 'Broken one', createdAt: 1000, updatedAt: 1000, schemaVersion: 3, data: { personal: 'not an object' } });
      await S.put('meta', { key: 'lastResumeId', value: 'r_ops02' });
      localStorage.setItem('applyready_theme', 'dark');
      localStorage.setItem('applyready_recent_tools', JSON.stringify(['file-checker', 'resume', 'not-a-tool']));
      localStorage.setItem('applyready_resume_draft', '{"old":true}');
    }, { data, now });
    await page.reload();
    await page.waitForFunction(() => /resumes/.test(document.getElementById('ydResumeCount').textContent));
    ok(await page.locator('#ydResumeCount').innerText() === '3 resumes, 1 damaged, 1 earlier draft', 'your data: count with damaged records and the unreadable earlier draft');
    const rows = await page.locator('#ydResumeList .file-row').allInnerTexts();
    ok(/Operations resume/.test(rows[0]) && /Resume for analyst roles/.test(rows[1]) && /Damaged/.test(rows[2]) && /earlier version/.test(rows[3]) && /cannot be read/.test(rows[3]), 'resumes listed by last edited, damaged one marked, earlier draft last');
    ok(await page.locator('#ydResumeList a[href="resume.html?id=r_ops02"]').count() === 1 && await page.locator('[data-id="r_broken3"] a').count() === 0, 'valid resumes link to the builder; the damaged one cannot be opened');
    ok(/File checker/.test(await page.locator('#ydRecentList').innerText()) && await page.locator('#ydRecentList li').count() === 2, 'recent tools shown by name (unknown ids skipped)');
    ok(/^Dark, chosen/.test(await page.locator('#ydThemeText').innerText()), 'theme preference shown');
    await axe(page, 'your data, with resumes');

    // Export
    const backup = await download(page, () => page.click('#ydExport'));
    const lib = JSON.parse(fs.readFileSync(backup.file, 'utf8'));
    ok(lib.app === 'ApplyReady' && lib.kind === 'resume-library' && lib.version === 1 && !isNaN(Date.parse(lib.exportedAt)), 'export: resume-library format');
    ok(lib.resumes.length === 2 && lib.resumes.every(r => Schema.validate({ data: r.data }) && r.name && r.createdAt && r.updatedAt) && lib.resumes.some(r => r.data.personal.fullName === 'Second Person'), 'export: valid resumes only, each passes the schema');
    ok(/damaged record was not included/.test(await page.locator('#ydDoneText').innerText()), 'export: the damaged record is explained');
    const raw = await download(page, () => page.locator('[data-id="r_broken3"] [data-act="raw"]').click());
    const rawBody = JSON.parse(fs.readFileSync(raw.file, 'utf8'));
    ok(rawBody.kind === 'damaged-resume-record' && rawBody.record.id === 'r_broken3' && rawBody.reason, 'damaged record can be downloaded raw, in the resume builder\'s envelope');

    // Import: good, then bad files
    await page.setInputFiles('#ydImportInput', backup.file);
    await page.waitForFunction(() => /Added 2 resumes/.test(document.getElementById('ydImportResult').textContent));
    ok(await page.locator('#ydResumeCount').innerText() === '5 resumes, 1 damaged, 1 earlier draft', 'import adds every resume as new');
    const ids = await page.evaluate(async () => (await window.ApplyReadyStore.getAll('resumes')).map(r => r.id));
    ok(new Set(ids).size === 5 && ids.filter(i => /^r_[a-z0-9]{6,38}$/.test(i) && !['r_analyst01', 'r_ops02', 'r_broken3'].includes(i)).length === 2, 'imported resumes get new ids');
    const single = { app: 'ApplyReady', version: 2, exportedAt: new Date().toISOString(), data };
    const bad = [
      ['notjson.json', 'this is { not json', /not valid JSON/],
      ['other.json', JSON.stringify({ app: 'OtherApp', data }), /different app, not ApplyReady/],
      ['newer.json', JSON.stringify({ app: 'ApplyReady', kind: 'resume-library', version: 9, resumes: [] }), /newer version/],
      ['newer-single.json', JSON.stringify({ app: 'ApplyReady', version: 7, data }), /newer version/],
      ['broken.json', JSON.stringify({ app: 'ApplyReady', kind: 'resume-library', version: 1, resumes: [{ name: 'x', data: { personal: 5 } }] }), /None of the resumes in this file could be read/]
    ];
    for (const [name, body, re] of bad) {
      await page.setInputFiles('#ydImportInput', { name, mimeType: 'application/json', buffer: Buffer.from(body) });
      await page.waitForFunction(() => !document.getElementById('ydResumeError').hidden);
      ok(re.test(await page.locator('#ydResumeError').innerText()), `import refused: ${name}`);
    }
    // 5.2 MB as the site counts sizes (1 MB = 1,000,000 bytes), though under 5 x 1,024 x 1,024 bytes.
    await page.setInputFiles('#ydImportInput', { name: 'huge.json', mimeType: 'application/json', buffer: Buffer.alloc(5200000, 32) });
    ok(/huge\.json is 5\.2 MB\. Backups up to 5 MB/.test(await page.locator('#ydResumeError').innerText()), 'import refused: 5.2 MB is over 5 MB');
    await page.setInputFiles('#ydImportInput', { name: 'single.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(single)) });
    await page.waitForFunction(() => /Added 1 resume /.test(document.getElementById('ydImportResult').textContent));
    ok(await page.locator('#ydResumeCount').innerText() === '6 resumes, 1 damaged, 1 earlier draft', 'single-resume backup (version 2) imports');

    // Recent tools off, theme reset
    await page.uncheck('#ydRecentOn');
    ok(await page.evaluate(() => localStorage.getItem('applyready_recent_off') === '1' && localStorage.getItem('applyready_recent_tools') === null), 'recent tools turned off and cleared');
    await page.goto(origin + '/file-checker.html');
    ok(await page.evaluate(() => localStorage.getItem('applyready_recent_tools') === null), 'with recents off, opening a tool is not remembered');
    await page.goto(origin + '/your-data.html');
    await page.check('#ydRecentOn');
    ok(await page.evaluate(() => localStorage.getItem('applyready_recent_off') === null), 'recent tools turned on again');
    await page.click('#ydThemeReset');
    ok(await page.evaluate(() => localStorage.getItem('applyready_theme') === null) && /Follows your device/.test(await page.locator('#ydThemeText').innerText()), 'theme reset to the device setting');

    // Delete all resumes
    await page.waitForFunction(() => /resumes/.test(document.getElementById('ydResumeCount').textContent));
    await page.click('#ydDeleteResumes');
    await page.click('.dialog [data-act="ok"]');
    await page.waitForFunction(() => document.getElementById('ydResumeCount').textContent === 'None');
    ok(await page.evaluate(async () => (await window.ApplyReadyStore.getAll('resumes')).length === 0 && !(await window.ApplyReadyStore.get('meta', 'lastResumeId'))), 'delete all resumes empties the store and forgets the last resume');
    ok(await page.evaluate(() => localStorage.getItem('applyready_resume_draft') === null), 'delete all resumes also removes the earlier draft');
    await page.evaluate(() => localStorage.setItem('applyready_resume_draft', '{"old":true}'));

    // Works with the real resume builder: what it saves is listed (not damaged), and deleting here
    // stops an open builder tab from saving the deleted resume again.
    const builder = await context.newPage();
    watch(builder);
    await builder.goto(origin + '/resume.html');
    await builder.fill('#fullName', 'Builder Person');
    await builder.waitForFunction(() => /^Saved on this device/.test(document.getElementById('saveStatusText').textContent), null, { timeout: 8000 });
    await page.reload();
    // The builder also moved the unreadable old-format draft seeded above into the library, as a damaged entry.
    await page.waitForFunction(() => document.getElementById('ydResumeCount').textContent === '2 resumes, 1 damaged');
    ok(/Builder Person/.test(await page.locator('#ydResumeList .file-row:not([data-status="error"])').innerText()), 'a resume saved by the resume builder is listed as readable');
    ok(/earlier version/.test(await page.locator('#ydResumeList [data-status="error"]').innerText()), 'the old draft the builder could not read is listed as damaged, not opened');
    await page.click('#ydDeleteResumes');
    await page.click('.dialog [data-act="ok"]');
    await page.waitForFunction(() => document.getElementById('ydResumeCount').textContent === 'None');
    await builder.waitForFunction(() => /deleted in another tab/.test(document.body.innerText), null, { timeout: 5000 });
    await builder.fill('#fullName', 'Builder Person typing on');
    await builder.waitForTimeout(1500);
    ok(await page.evaluate(async () => (await window.ApplyReadyStore.getAll('resumes')).length === 0), 'the open builder tab is told and does not save the deleted resume again');
    await builder.close();

    // Saving switched off in the builder (a shared computer): the page says so and import stores nothing.
    await page.evaluate(() => window.ApplyReadyStore.put('meta', { key: 'resumeSaving', value: 'off' }));
    await page.reload();
    await page.waitForFunction(() => document.getElementById('ydResumeCount').textContent === 'None');
    ok(await page.locator('#ydSavingOff').isVisible(), 'saving switched off in the builder is shown');
    await page.setInputFiles('#ydImportInput', backup.file);
    await page.waitForFunction(() => !document.getElementById('ydResumeError').hidden);
    ok(/turned off/.test(await page.locator('#ydResumeError').innerText()) && await page.evaluate(async () => (await window.ApplyReadyStore.getAll('resumes')).length === 0), 'import respects saving switched off');
    await page.evaluate(() => window.ApplyReadyStore.remove('meta', 'resumeSaving'));

    // Delete everything, with the offline copy and service worker in place
    await page.evaluate(async ({ data }) => { await window.ApplyReadyStore.put('resumes', { id: 'r_again', name: 'Again', createdAt: 1, updatedAt: 2, schemaVersion: 3, data }); localStorage.setItem('applyready_theme', 'light'); localStorage.setItem('applyready_recent_tools', '["resume"]');
      // A copy of unsaved changes left by a browser that closed mid-save (the resume builder's UNSAVED_PREFIX).
      localStorage.setItem('applyready_resume_unsaved:r_left', JSON.stringify({ id: 'r_left', name: 'Ravi Kumar', createdAt: 1, baseUpdatedAt: 0, savedAt: Date.now(), json: JSON.stringify(data) })); }, { data });
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForFunction(() => caches.keys().then(k => k.some(n => n.startsWith('applyready-'))), null, { timeout: 30000 });
    await page.waitForTimeout(1500);
    await page.reload();
    await page.waitForFunction(() => /resume/.test(document.getElementById('ydResumeCount').textContent) && !/Checking/.test(document.getElementById('ydOfflineSize').textContent));
    ok(/files?, /.test(await page.locator('#ydOfflineSize').innerText()), 'offline copy size shown');
    // RESU-2 / SECU-3 / COPY-7: the leftover copy is listed with the resumes, not hidden or called a setting.
    ok(/unsaved changes of 1 resume/.test(await page.locator('#ydResumeCount').innerText()) && /Unsaved changes: Ravi Kumar/.test(await page.locator('#ydResumeList').innerText()) && await page.locator('#ydDeleteResumes').isVisible(), `your data: unsaved changes are listed with the resumes (${await page.locator('#ydResumeCount').innerText()})`);
    await page.click('#ydDeleteAll');
    const confirmText = await page.locator('.dialog').innerText();
    ok(/1 saved resume/.test(confirmText) && /the unsaved changes of 1 resume/.test(confirmText) && /2 settings/.test(confirmText), `delete everything: the confirmation says what will go, unsaved changes with the resumes (${confirmText.replace(/\s+/g, ' ')})`);
    await page.click('.dialog [data-act="ok"]');
    await page.locator('#ydDone').waitFor({ state: 'visible' });
    const summary = await page.locator('#ydDoneText').innerText();
    ok(/1 saved resume and the resume database/.test(summary) && /setting/.test(summary) && /offline copy/.test(summary) && /offline service/.test(summary), `delete everything: final confirmation lists what was removed (${summary})`);
    ok(/the unsaved changes of 1 resume/.test(summary) && !/unsaved:r/.test(summary), 'delete everything: the unsaved changes are named in plain words, not as a setting');
    const left = await page.evaluate(async () => ({
      dbs: indexedDB.databases ? (await indexedDB.databases()).map(d => d.name) : null,
      keys: Object.keys(localStorage).filter(k => k.startsWith('applyready')),
      caches: (await caches.keys()).filter(k => k.startsWith('applyready-')),
      workers: (await navigator.serviceWorker.getRegistrations()).length
    }));
    ok(left.dbs && !left.dbs.includes('applyready'), `IndexedDB database deleted (${left.dbs})`);
    ok(left.keys.length === 0 && left.caches.length === 0 && left.workers === 0, `nothing left: ${JSON.stringify(left)}`);
    ok(await page.locator('#ydResumeCount').innerText() === 'None' && await page.locator('#ydOfflineSize').innerText() === 'None', 'the page shows everything gone');
    await axe(page, 'your data after deleting everything');
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 800 });
      await noOverflow(page, `your data at ${width}px`);
    }
    // Browser storage blocked (some private windows): the page says so and an import is not faked in memory.
    {
      const blocked = await newContext();
      await blocked.addInitScript(() => { Object.defineProperty(window, 'indexedDB', { get() { throw new Error('blocked'); } }); });
      const p2 = await blocked.newPage();
      watch(p2);
      await p2.goto(origin + '/your-data.html');
      await p2.locator('#ydStorageWarning').waitFor({ state: 'visible' });
      ok(/not letting ApplyReady save/.test(await p2.locator('#ydStorageWarningText').innerText()) && await p2.locator('#ydResumeCount').innerText() === 'None', 'storage blocked: explained, no resumes');
      await p2.setInputFiles('#ydImportInput', backup.file);
      await p2.waitForFunction(() => !document.getElementById('ydResumeError').hidden);
      ok(/could not be stored here/.test(await p2.locator('#ydResumeError').innerText()) && await p2.locator('#ydResumeCount').innerText() === 'None', 'storage blocked: import refused instead of kept in memory');
      await blocked.close();
    }
    ok(errors.length === 0, `your data: no page errors (${errors.join(' | ')})`);
    await context.close();
    console.log('\u2713 Your data: seeded resumes and settings, export, import (valid and refused), recent tools, theme, delete all, delete everything');
  }

  // Visible FAQ and FAQPage structured data match exactly on the three pages.
  for (const f of ['file-checker.html', 'text-to-pdf.html', 'your-data.html']) {
    const html = fs.readFileSync(path.join(root, f), 'utf8');
    const ld = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
    const faq = ld['@graph'].find(x => x['@type'] === 'FAQPage').mainEntity.map(q => [q.name, q.acceptedAnswer.text]);
    const decode = s => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').trim();
    const visible = [...html.matchAll(/<summary class="faq-question"><span>([\s\S]*?)<\/span>[\s\S]*?<div class="faq-answer"><p>([\s\S]*?)<\/p><\/div>/g)].map(m => [decode(m[1]), decode(m[2])]);
    ok(JSON.stringify(faq) === JSON.stringify(visible) && faq.length >= 5, `${f}: visible FAQ matches FAQPage data (${faq.length} questions)`);
  }

  await browser.close();
  server.close();
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`\u2713 document tools browser tests: ${checks} checks passed`);
})().catch(e => { console.error(e); server.close(); process.exit(1); });
