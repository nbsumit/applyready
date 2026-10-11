/* Cross-browser smoke test: real image processing and real resume exports.
   Run with BROWSER=firefox (default chromium). */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium, firefox } = require('playwright');
const { resumeFixture } = require('./fixtures');
const root = path.resolve(__dirname, '..');
const out = path.resolve(process.env.QA_OUTPUT_DIR || path.join(root, 'test-results', 'smoke'));
fs.mkdirSync(out, { recursive: true });
const mime = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.png':'image/png', '.svg':'image/svg+xml', '.woff2':'font/woff2', '.json':'application/json', '.webmanifest':'application/manifest+json' };
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (e, d) => { res.writeHead(e ? 404 : 200, { 'Content-Type': e ? 'text/html' : mime[path.extname(file)] || 'application/octet-stream' }); res.end(e ? fs.readFileSync(path.join(root, '404.html')) : d); });
});
// A real 1200x1500 photo-like PNG made without extra dependencies
function png(w, h) {
  const zlib = require('node:zlib');
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; for (let x = 0; x < w; x++) { const o = y * (w * 3 + 1) + 1 + x * 3; raw[o] = (x * 7 + y * 3) % 256; raw[o + 1] = (x * 2 + y * 5) % 256; raw[o + 2] = (x ^ y) % 256; } }
  const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = b => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
let checks = 0; const ok = (c, m) => { assert(c, m); checks++; };
(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const type = process.env.BROWSER === 'firefox' ? firefox : chromium;
  const exe = process.env.BROWSER_EXECUTABLE_PATH;
  const browser = await type.launch(type === chromium ? { headless: true, ...(exe ? { executablePath: exe } : {}), args: ['--no-sandbox'] } : { headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  await context.route('**/*', r => /^(http:\/\/127\.|blob:|data:)/.test(r.request().url()) ? r.continue() : r.abort());
  const page = await context.newPage(); const errors = [];
  page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());

  // Image: upload, preset by mouse on the custom select, process, download
  await page.goto(`${origin}/index.html`);
  await page.locator('#fileInput').setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: png(1200, 1500) });
  await page.locator('#cropperActiveArea').waitFor({ state: 'visible' });
  const trigger = page.locator('#presetSelect').locator('xpath=..').locator('.custom-select__button');
  await trigger.scrollIntoViewIfNeeded(); await trigger.click();
  await page.locator('.custom-select__list:not([hidden]) [role=option]', { hasText: 'ID / Passport' }).click();
  ok(await page.locator('#customWidth').inputValue() === '350', 'preset chosen through the visible menu');
  await page.locator('#btnProcess').click();
  await page.locator('#resultArea').waitFor({ state: 'visible' });
  const dl = page.waitForEvent('download'); await page.locator('#btnDownload').click();
  const file = path.join(out, 'image.jpg'); await (await dl).saveAs(file);
  ok(fs.statSync(file).size > 1000 && fs.statSync(file).size <= 50 * 1024, 'downloaded image is within the 50 KB limit');
  ok((await page.locator('#resultStatus').textContent()).toLowerCase().includes('50'), 'result states the limit it satisfies');

  // Exam page tool
  await page.goto(`${origin}/ssc-photo-signature-size.html`);
  await page.locator('#fileInput').setInputFiles({ name: 'p.png', mimeType: 'image/png', buffer: png(900, 1100) });
  await page.locator('#btnProcess').click();
  await page.locator('#resultArea').waitFor({ state: 'visible' });
  ok(await page.locator('#btnDownload').isVisible() && (await page.locator('#btnDownload').innerText()).trim().length > 3, 'exam page Download is visible and labelled');
  const colors = await page.locator('#btnDownload').evaluate(e => { const c = getComputedStyle(e); return [c.color, c.backgroundColor]; });
  ok(colors[0] !== colors[1], 'exam page Download label is not hidden by its own fill');

  // Secondary tools with real files: compress, image to PDF, passport sheet, signature cleaner
  const saveDownload = async (locator, name) => { const d = page.waitForEvent('download'); await locator.click(); const f = path.join(out, name); await (await d).saveAs(f); return fs.readFileSync(f); };
  await page.goto(`${origin}/compress-pdf.html`);
  await page.locator('#compressFileInput').setInputFiles({ name: 'scan.png', mimeType: 'image/png', buffer: png(1000, 1300) });
  await page.locator('#btnStartCompress').click();
  await page.locator('#compressResultArea').waitFor({ state: 'visible' });
  let pdf = await saveDownload(page.locator('#btnDownloadCompressedPdf'), 'compressed.pdf');
  ok(pdf.subarray(0, 4).toString('latin1') === '%PDF', 'compress tool downloads a PDF');
  ok(await page.locator('#btnDownloadCompressedPdf').evaluate(e => getComputedStyle(e).color !== getComputedStyle(e).backgroundColor), 'compress Download label is readable');

  await page.goto(`${origin}/image-to-pdf.html`);
  await page.locator('input[type=file]').first().setInputFiles([{ name: 'a.png', mimeType: 'image/png', buffer: png(800, 1000) }, { name: 'b.png', mimeType: 'image/png', buffer: png(700, 900) }]);
  await page.locator('.page-row').nth(1).waitFor();
  ok(await page.locator('.page-row').count() === 2, 'two pages are listed as rows');
  await page.locator('#btnConvertToPdf').click();
  await page.locator('#btnDownloadPdf').waitFor({ state: 'visible' });
  pdf = await saveDownload(page.locator('#btnDownloadPdf'), 'combined.pdf');
  ok(pdf.subarray(0, 4).toString('latin1') === '%PDF' && (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length === 2, 'image to PDF downloads a two page PDF');

  await page.goto(`${origin}/passport-photo-print.html`);
  await page.locator('input[type=file]').first().setInputFiles({ name: 'p.png', mimeType: 'image/png', buffer: png(900, 1100) });
  await page.locator('#btnDownloadPrintJpg').waitFor({ state: 'visible' });
  const sheet = await saveDownload(page.locator('#btnDownloadPrintJpg'), 'sheet.jpg');
  ok(sheet[0] === 0xff && sheet[1] === 0xd8 && sheet.length > 5000, 'passport sheet downloads a JPEG');
  pdf = await saveDownload(page.locator('#btnDownloadPrintPdf'), 'sheet.pdf');
  ok(pdf.subarray(0, 4).toString('latin1') === '%PDF', 'passport sheet downloads a PDF');

  await page.goto(`${origin}/signature-cleaner.html`);
  await page.locator('input[type=file]').first().setInputFiles({ name: 's.png', mimeType: 'image/png', buffer: png(900, 300) });
  await page.locator('#btnCleanerDownload').waitFor({ state: 'visible' });
  await page.locator('#btnViewOriginal').click();
  ok(await page.locator('#btnViewOriginal').getAttribute('aria-pressed') === 'true', 'Cleaned/Original toggle switches view');
  const sig = await saveDownload(page.locator('#btnCleanerDownload'), 'signature.jpg');
  ok(sig[0] === 0xff && sig[1] === 0xd8, 'signature cleaner downloads a JPEG');

  // Resume: import, export every format
  await page.goto(`${origin}/resume.html`);
  await page.locator('.draft-options > summary').click();
  await page.locator('#fileImportInput').setInputFiles({ name: 'resume.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ version: 2, app: 'ApplyReady', data: resumeFixture() })) });
  await page.waitForFunction(() => document.getElementById('resumeSheet').textContent.includes('GRANT_MARKER'));
  for (const [button, ext, magic] of [['#btnQuickPDF', 'pdf', '%PDF'], ['#btnDownloadDOCX', 'docx', 'PK'], ['#btnDownloadText', 'txt', null]]) {
    if (button !== '#btnQuickPDF') await page.locator('#tabReview').click();
    const d = page.waitForEvent('download'); await page.locator(button).click();
    const f = path.join(out, `resume.${ext}`); await (await d).saveAs(f);
    const bytes = fs.readFileSync(f);
    ok(bytes.length > 500, `${ext} export has content`);
    if (magic) ok(bytes.subarray(0, magic.length).toString('latin1') === magic, `${ext} export has the right file signature`);
    else ok(bytes.toString('utf8').includes('GRANT_MARKER'), 'text export keeps optional sections');
  }
  ok(errors.length === 0, `page errors: ${errors.join(' | ')}`);
  await browser.close(); server.close();
  console.log(`✓ ${process.env.BROWSER || 'chromium'} smoke: ${checks} checks`);
})().catch(e => { console.error(e); process.exit(1); });
