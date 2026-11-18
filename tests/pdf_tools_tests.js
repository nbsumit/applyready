/* PDF tools, end to end: merge, split, organise, PDF to images, extract text, page numbers,
   watermark and compress, driven in Chromium with real PDF files, and every output checked
   independently with poppler (pdfinfo, pdftotext), unzip -t and ImageMagick identify.

   Fixtures are made here with pdf-lib in Node: multi-page text PDFs with different page sizes and
   rotations, a page that inherits its size and rotation from the page tree, password-protected
   PDFs (AES-256 and, when Python's pypdf is installed, RC4-128), a damaged (truncated) PDF, a
   non-PDF renamed .pdf, an empty file, an oversized file, a scanned (image-only) PDF and a PDF
   with a JPEG 2000 image (made with ImageMagick).

   BROWSER_EXECUTABLE_PATH=/path/to/chrome node tests/pdf_tools_tests.js */
'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { execFileSync, spawnSync } = require('node:child_process');
const { chromium } = require('playwright');
const AxeBuilder = require('@axe-core/playwright').default;

const root = path.resolve(__dirname, '..');
const P = require('../js/vendor/pdf-lib.min.js');
const Kit = require('../js/lib/pdf-kit.js');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ar-pdf-'));
let checks = 0;
const ok = (c, m) => { assert(c, m); checks++; };
const sh = (cmd, args) => execFileSync(cmd, args, { encoding: 'latin1', maxBuffer: 64 * 1024 * 1024 });
const has = cmd => spawnSync('which', [cmd]).status === 0;

/* ------------------------------------------------------------------ independent checks */
function pdfInfo(file) {
  const out = sh('pdfinfo', ['-f', '1', '-l', '9999', file]);
  const pages = Number((out.match(/^Pages:\s+(\d+)/m) || [])[1]);
  const sizes = [...out.matchAll(/^Page\s+(\d+) size:\s+([\d.]+) x ([\d.]+)/gm)].map(m => [Number(m[2]), Number(m[3])]);
  const rots = [...out.matchAll(/^Page\s+\d+ rot:\s+(\d+)/gm)].map(m => Number(m[1]));
  return { pages, sizes, rots, encrypted: /^Encrypted:\s+yes/m.test(out) };
}
const pageText = (file, n) => sh('pdftotext', ['-f', String(n), '-l', String(n), '-layout', file, '-']);
const markers = file => (sh('pdftotext', [file, '-']).match(/[A-Z]+-\d+/g) || []);
const near = (a, b, tol = 0.6) => Math.abs(a - b) <= tol;

/* ------------------------------------------------------------------ fixtures */
const SIZES = [[595.28, 841.89, 0], [612, 792, 90], [841.89, 595.28, 0], [595.28, 841.89, 180], [419.53, 595.28, 270], [595.28, 841.89, 0]];
async function textPdf(prefix, sizes, opts = {}) {
  const d = await P.PDFDocument.create();
  const f = await d.embedFont(P.StandardFonts.Helvetica);
  const photo = opts.photoOnFirst ? await d.embedJpg(fs.readFileSync(path.join(root, 'img/samples/test-portrait.jpg'))) : null;
  sizes.forEach(([w, h, r], i) => {
    const p = d.addPage([w, h]);
    if (photo && i === 0) p.drawImage(photo, { x: 40, y: 40, width: w - 80, height: h - 200 });
    p.drawText(`${prefix}-${i + 1}`, { x: 50, y: h - 90, size: 22, font: f });
    p.drawText('Body text that can be selected.', { x: 50, y: h - 130, size: 12, font: f });
    if (r) p.setRotation(P.degrees(r));
  });
  if (opts.encrypt) await d.encrypt(opts.encrypt);
  return Buffer.from(await d.save());
}

function rawPdf(objects) {
  const parts = [Buffer.from('%PDF-1.5\n')];
  let length = parts[0].length;
  const offsets = objects.map((o, i) => {
    const at = length;
    const b = Array.isArray(o)
      ? Buffer.concat([Buffer.from(`${i + 1} 0 obj\n${o[0]}\nstream\n`), o[1], Buffer.from('\nendstream\nendobj\n')])
      : Buffer.from(`${i + 1} 0 obj\n${o}\nendobj\n`);
    parts.push(b); length += b.length;
    return at;
  });
  parts.push(Buffer.from(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('')}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${length}\n%%EOF\n`));
  return Buffer.concat(parts);
}

async function scanPdf(pages) {
  const jpeg = fs.readFileSync(path.join(root, 'img/samples/test-portrait.jpg'));
  const d = await P.PDFDocument.create();
  const img = await d.embedJpg(jpeg);
  for (let i = 0; i < pages; i++) {
    const p = d.addPage([595.28, 841.89]);
    p.drawImage(img, { x: 0, y: 0, width: 595.28, height: 841.89 });
  }
  return Buffer.from(await d.save());
}

async function fixtures() {
  const F = {};
  const put = (name, buf) => { const f = path.join(tmp, name); fs.writeFileSync(f, buf); F[name] = f; return f; };
  put('text.pdf', await textPdf('MARKER', SIZES));
  put('mixed.pdf', await textPdf('MIXED', SIZES, { photoOnFirst: true }));
  put('second.pdf', await textPdf('SECOND', [[595.28, 841.89, 0], [595.28, 841.89, 90]]));
  put('enc.pdf', await textPdf('SECRET', [[595.28, 841.89, 0], [595.28, 841.89, 0], [612, 792, 0]], { encrypt: { userPassword: 'open sesame', ownerPassword: 'owner', permissions: {} } }));
  put('owner-only.pdf', await textPdf('OWNER', [[595.28, 841.89, 0]], { encrypt: { userPassword: '', ownerPassword: 'owner', permissions: { printing: 'highResolution' } } }));
  const text = fs.readFileSync(F['text.pdf']);
  put('damaged.pdf', text.subarray(0, Math.floor(text.length * 0.6)));
  put('not-a-pdf.pdf', fs.readFileSync(path.join(root, 'img/samples/test-signature.jpg')));
  put('notes.pdf', Buffer.from('These are notes saved as text, then renamed to .pdf.\n'));
  put('empty.pdf', Buffer.alloc(0));
  put('scan.pdf', await scanPdf(3));
  put('scan-12.pdf', await scanPdf(12));
  // A page that takes its size and rotation from the page tree node, as some scanners write them.
  put('inherit.pdf', rawPdf([
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 /MediaBox [0 0 400 600] /Rotate 90 /Resources << /Font << /F1 4 0 R >> >> >>',
    '<< /Type /Page /Parent 2 0 R /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    [`<< /Length 46 >>`, Buffer.from('BT /F1 20 Tf 40 500 Td (INHERIT-1) Tj ET     ')]
  ]));
  // JPEG 2000: decoded by pdf.js with WebAssembly (or its JavaScript fallback).
  if (has('convert')) {
    const jp2 = path.join(tmp, 'red.jp2');
    sh('convert', ['-size', '200x150', 'xc:#d01010', jp2]);
    const data = fs.readFileSync(jp2);
    const draw = Buffer.from('q 400 0 0 300 98 271 cm /Im1 Do Q');
    put('jpx.pdf', rawPdf([
      '<< /Type /Catalog /Pages 2 0 R >>',
      '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Im1 4 0 R >> >> /Contents 5 0 R >>',
      [`<< /Type /XObject /Subtype /Image /Width 200 /Height 150 /BitsPerComponent 8 /Filter /JPXDecode /Length ${data.length} >>`, data],
      [`<< /Length ${draw.length} >>`, draw]
    ]));
  }
  // RC4-128, the most common older encryption, made by a different library when available.
  const py = spawnSync('python3', ['-I', '-c', [
    'import sys', 'from pypdf import PdfReader, PdfWriter', 'r = PdfReader(sys.argv[1]); w = PdfWriter()',
    'for p in r.pages: w.add_page(p)', "w.encrypt(user_password='abc', owner_password='own', algorithm='RC4-128')", "w.write(sys.argv[2])"
  ].join('\n'), F['second.pdf'], path.join(tmp, 'rc4.pdf')]);
  if (py.status === 0) F['rc4.pdf'] = path.join(tmp, 'rc4.pdf');
  return F;
}

/* ------------------------------------------------------------------ unit checks (Node) */
async function units() {
  const r = Kit.parseRanges('1-3, 5, 8-', 10);
  ok(r.ok && JSON.stringify(r.ranges) === '[[1,3],[5,5],[8,10]]' && r.pages.join() === '0,1,2,4,7,8,9', 'ranges: 1-3, 5, 8- against 10 pages');
  ok(Kit.parseRanges('5, 1-2', 9).pages.join() === '4,0,1', 'ranges keep the typed order');
  ok(Kit.parseRanges('2 to 4', 9).pages.join() === '1,2,3' && Kit.parseRanges('last', 7).pages.join() === '6', 'ranges: "to" and "last"');
  ok(/highest page number is 10/.test(Kit.parseRanges('12', 10).error), 'ranges: past the end is explained');
  ok(/smaller one, for example 1-3/.test(Kit.parseRanges('3-1', 10).error), 'ranges: reversed range is explained');
  ok(/not a page or a range/.test(Kit.parseRanges('1, abc', 10).error) && /start at 1/.test(Kit.parseRanges('0-2', 10).error), 'ranges: junk and page 0 are explained');
  ok(!Kit.parseRanges('', 3).ok, 'ranges: empty input is refused');
  ok(Kit.formatRanges([7, 0, 1, 2, 4, 8]) === '1-3, 5, 8-9', 'formatRanges groups consecutive pages');
  ok(Kit.winAnsiProblems('Café Self-attested 2026 “ok” €').length === 0, 'WinAnsi: accented Latin, quotes and euro are allowed');
  ok(Kit.winAnsiProblems('₹ प्रति').length >= 2, 'WinAnsi: rupee sign and Devanagari are reported');
  ok([0, 1, 2, 3].map(i => Kit.pageNumberLabel(i, 4, { format: 'page-of', skipFirst: true })).join('|') === '|Page 1 of 3|Page 2 of 3|Page 3 of 3', 'page labels skip the cover and count numbered pages');
  ok(Kit.pageNumberLabel(0, 3, { format: 'slash', start: 5 }) === '5 / 7', 'page labels honour the first number');
  ok(Kit.joinTextItems([{ str: 'Hello', transform: [1, 0, 0, 12, 10, 700], width: 30, height: 12 }, { str: 'world', transform: [1, 0, 0, 12, 45, 700], width: 30, height: 12 }, { str: 'Next line', transform: [1, 0, 0, 12, 10, 684], width: 50, height: 12 }, { str: 'New paragraph', transform: [1, 0, 0, 12, 10, 640], width: 50, height: 12 }]) === 'Hello world\nNext line\n\nNew paragraph', 'text items become words, lines and paragraphs');
  // Structure operations in Node, checked with poppler.
  const src = new Uint8Array(fs.readFileSync(path.join(tmp, 'text.pdf')));
  const docA = await Kit.openLib(src);
  const asm = await Kit.assemble([{ doc: docA, index: 1, turn: 90 }, { doc: docA, index: 0, turn: -90 }]);
  const f = path.join(tmp, 'unit-asm.pdf');
  fs.writeFileSync(f, await Kit.save(asm));
  const info = pdfInfo(f);
  ok(info.pages === 2 && info.rots.join() === '180,270' && markers(f).join() === 'MARKER-2,MARKER-1', `assemble adds rotation to the existing one (${info.rots})`);
  try { await Kit.inspect(new Uint8Array(fs.readFileSync(path.join(tmp, 'damaged.pdf')))); ok(false, 'a truncated PDF is refused'); }
  catch (e) { ok(e.code === 'damaged' && /incomplete/.test(e.message), 'a truncated PDF is refused as incomplete'); }
  try { await Kit.openLib(new Uint8Array(fs.readFileSync(path.join(tmp, 'enc.pdf'))), { password: 'wrong' }); ok(false, 'wrong password'); }
  catch (e) { ok(e.code === 'password', 'a wrong password is reported as such'); }
  console.log('✓ Unit checks: ranges, standard-font text, page labels, text lines, assemble, damaged and encrypted files');
}

/* ------------------------------------------------------------------ browser */
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.wasm': 'application/wasm', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon' };
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const file = path.resolve(root, '.' + (pathname.endsWith('/') ? pathname + 'index.html' : pathname));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (e, d) => { res.writeHead(e ? 404 : 200, { 'Content-Type': e ? 'text/html' : mime[path.extname(file)] || 'application/octet-stream' }); res.end(e ? 'not found' : d); });
});

(async () => {
  const F = await fixtures();
  await units();
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const exe = process.env.BROWSER_EXECUTABLE_PATH;
  const browser = await chromium.launch({ headless: true, ...(exe ? { executablePath: exe } : {}), args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const errors = [];
  async function open(file, opts = {}) {
    const context = await browser.newContext({ viewport: opts.viewport || { width: 1280, height: 900 }, acceptDownloads: true, colorScheme: opts.scheme || 'light' });
    await context.route('**/*', r => /^(http:\/\/127\.|blob:|data:)/.test(r.request().url()) ? r.continue() : r.abort());
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(`${file}: ${e.message}`));
    page.on('console', m => { if (/Content Security Policy|Refused to/.test(m.text())) errors.push(`${file}: ${m.text()}`); });
    await page.goto(`${origin}/${file}`);
    return { context, page };
  }
  const save = async (page, trigger, name) => {
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), trigger()]);
    const out = path.join(tmp, name || dl.suggestedFilename());
    await dl.saveAs(out);
    return { file: out, name: dl.suggestedFilename() };
  };
  const errorText = async (page, sel) => (await page.locator(sel).innerText()).trim();
  const waitShown = (page, sel, timeout = 60000) => page.locator(sel).first().waitFor({ state: 'visible', timeout });
  async function axe(page, label) {
    for (const scheme of ['light', 'dark']) {
      await page.evaluate(s => document.documentElement.setAttribute('data-theme', s), scheme);
      await page.waitForTimeout(450); // colours change with a short transition
      const r = await new AxeBuilder({ page }).include('main').analyze();
      ok(r.violations.length === 0, `${label} (${scheme}): axe violations ${r.violations.map(v => `${v.id}: ${v.nodes.map(n => n.target.join(' ')).slice(0, 3).join(', ')}`).join('; ')}`);
    }
    await page.evaluate(() => document.documentElement.removeAttribute('data-theme'));
  }

  /* ---------------------------------------------------------------- 1. Merge */
  {
    const { context, page } = await open('merge-pdf.html');
    ok(await page.locator('#mergeRun').isHidden() || await page.locator('#mergeRun').isDisabled(), 'merge: nothing to run before files are added');
    await page.setInputFiles('#mergeDropInput', [F['text.pdf'], F['second.pdf'], path.join(root, 'img/samples/test-signature.jpg'), F['inherit.pdf']]);
    await page.waitForFunction(() => document.querySelectorAll('.merge-row').length === 4, null, { timeout: 30000 });
    const names = () => page.evaluate(() => [...document.querySelectorAll('.merge-row .file-row__name')].map(n => n.textContent.replace(/^\d+\.\s*/, '')));
    ok((await names()).join() === 'text.pdf,second.pdf,test-signature.jpg,inherit.pdf', 'merge: files listed in the order chosen');
    ok(/4 files · 10 pages/.test(await page.locator('#mergeCounts').innerText()), `merge: counts files and pages (${await page.locator('#mergeCounts').innerText()})`);
    // Reorder with the buttons and the keyboard.
    await page.locator('.merge-row').nth(1).locator('.merge-up').click();
    ok((await names()).join() === 'second.pdf,text.pdf,test-signature.jpg,inherit.pdf', 'merge: move up');
    ok(/moved to position 1/.test(await page.locator('#mergeOrderStatus').textContent()), 'merge: the move is announced');
    await page.locator('.merge-row').nth(3).locator('.merge-row__handle').focus();
    await page.keyboard.press('Home');
    ok((await names()).join() === 'inherit.pdf,second.pdf,text.pdf,test-signature.jpg', 'merge: Home on the handle moves a file to the top');
    ok(await page.evaluate(() => document.activeElement.classList.contains('merge-row__handle') && document.activeElement.closest('.merge-row').textContent.includes('inherit.pdf')), 'merge: focus follows the moved file');
    // Drag with a pointer: the image to second place.
    const handle = page.locator('.merge-row').nth(3).locator('.merge-row__handle');
    const target = page.locator('.merge-row').nth(1);
    const hb = await handle.boundingBox(), tb = await target.boundingBox();
    await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
    await page.mouse.down();
    await page.mouse.move(hb.x + 10, tb.y + tb.height / 2, { steps: 8 });
    await page.mouse.up();
    ok((await names()).join() === 'inherit.pdf,test-signature.jpg,second.pdf,text.pdf', `merge: drag to reorder (${await names()})`);
    await page.fill('#mergeName', 'bundle');
    await page.click('#mergeRun');
    await waitShown(page, '#mergeResult');
    await axe(page, 'merge result');
    const out = await save(page, () => page.click('#mergeDownload'));
    ok(out.name === 'bundle.pdf', `merge: download is named from the field (${out.name})`);
    const info = pdfInfo(out.file);
    ok(info.pages === 10, `merge: 1 + 1 + 2 + 6 pages (${info.pages})`);
    ok(markers(out.file).join() === 'INHERIT-1,SECOND-1,SECOND-2,MARKER-1,MARKER-2,MARKER-3,MARKER-4,MARKER-5,MARKER-6', `merge: page order follows the list (${markers(out.file)})`);
    ok(near(info.sizes[0][0], 400) && near(info.sizes[0][1], 600) && info.rots[0] === 90, `merge: inherited page size and rotation are kept (${info.sizes[0]}, ${info.rots[0]})`);
    ok(near(info.sizes[1][0], 841.89) && near(info.sizes[1][1], 595.28), `merge: a wide signature image becomes an A4 landscape page (${info.sizes[1]})`);
    ok(info.rots.slice(2).join() === '0,90,' + SIZES.map(s => s[2]).join(), `merge: rotations kept (${info.rots})`);
    SIZES.forEach(([w, h], i) => ok(near(info.sizes[4 + i][0], w) && near(info.sizes[4 + i][1], h), `merge: page size kept for MARKER-${i + 1}`));
    // Remove a file; the result is invalidated.
    await page.locator('.merge-row').nth(1).locator('.merge-remove').click();
    ok(await page.locator('#mergeResult').isHidden() && (await names()).length === 3, 'merge: removing a file hides the stale result');
    // Bad files are explained and leave the list alone.
    await page.setInputFiles('#mergeDropInput', [F['notes.pdf'], F['damaged.pdf'], F['empty.pdf']]);
    await page.waitForFunction(() => !document.getElementById('mergeError').hidden && /incomplete/.test(document.getElementById('mergeError').textContent), null, { timeout: 15000 });
    const msg = await errorText(page, '#mergeError');
    ok(/notes\.pdf is a plain text file.*needs a PDF or an image/i.test(msg) && /empty/.test(msg) && /damaged\.pdf seems to be incomplete/.test(msg), `merge: wrong, empty and truncated files are explained (${msg})`);
    ok((await names()).length === 3, 'merge: bad files are not added');
    // A password-protected PDF: wrong password first, then the right one.
    await page.setInputFiles('#mergeDropInput', F['enc.pdf']);
    await waitShown(page, '.pdf-password');
    ok(await page.evaluate(() => document.activeElement.type === 'password'), 'password: the field has focus');
    ok(await page.evaluate(() => document.querySelector('main').inert), 'password: the page behind is inert');
    await page.fill('.pdf-password input[type=password]', 'nope');
    await page.click('.pdf-password [data-act=ok]');
    await page.waitForFunction(() => !document.querySelector('.pdf-password .field-error').hidden, null, { timeout: 15000 });
    ok(/not right/.test(await page.locator('.pdf-password .field-error').innerText()), 'password: a wrong password is explained in the dialog');
    const ax = await new AxeBuilder({ page }).include('.pdf-password').analyze();
    ok(ax.violations.length === 0, `password dialog: axe (${ax.violations.map(v => v.id)})`);
    await page.fill('.pdf-password input[type=password]', 'open sesame');
    await page.click('.pdf-password [data-act=ok]');
    await page.waitForFunction(() => document.querySelectorAll('.merge-row').length === 4, null, { timeout: 30000 });
    ok(await page.locator('.pdf-password').count() === 0, 'password: the dialog closes when the password is right');
    await page.click('#mergeRun');
    await waitShown(page, '#mergeResult');
    const out2 = await save(page, () => page.click('#mergeDownload'), 'merge-enc.pdf');
    const info2 = pdfInfo(out2.file);
    ok(info2.pages === 12 && !info2.encrypted && markers(out2.file).slice(-3).join() === 'SECRET-1,SECRET-2,SECRET-3', `merge: the protected file's pages are added, without a password (${info2.pages}, ${markers(out2.file).slice(-3)})`);
    // Cancelling the dialog leaves the list as it was.
    await page.setInputFiles('#mergeDropInput', F['enc.pdf']);
    await waitShown(page, '.pdf-password');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => /no password was given/.test(document.getElementById('mergeError').textContent), null, { timeout: 10000 });
    ok(await page.locator('.merge-row').count() === 4, 'password: Escape cancels and nothing is added');
    // The next person never gets the last person's file name: emptying the list resets it.
    await page.fill('#mergeName', 'Ravi Kumar documents');
    await page.click('#mergeClear');
    await page.click('.dialog [data-act="ok"]');
    ok(await page.inputValue('#mergeName') === 'merged', `merge: Remove all puts the file name back to "merged" (${await page.inputValue('#mergeName')})`);
    await page.setInputFiles('#mergeDropInput', [F['text.pdf'], F['second.pdf']]);
    await page.waitForFunction(() => document.querySelectorAll('.merge-row').length === 2, null, { timeout: 30000 });
    await page.fill('#mergeName', 'Priya Sharma documents');
    await page.locator('.merge-row').first().locator('.merge-remove').click();
    ok(await page.inputValue('#mergeName') === 'Priya Sharma documents', 'merge: the name stays while files are left');
    await page.locator('.merge-row').first().locator('.merge-remove').click();
    ok(await page.inputValue('#mergeName') === 'merged', 'merge: removing the last file one by one also resets the name');
    await context.close();
    console.log('✓ Merge: order by buttons, keyboard and drag; sizes, rotations and inherited boxes kept; images as A4; bad and protected files');
  }

  /* ---------------------------------------------------------------- 2. Split */
  {
    const { context, page } = await open('split-pdf.html');
    await page.setInputFiles('#splitDropInput', F['text.pdf']);
    await waitShown(page, '#splitGrid .page-tile');
    ok(await page.locator('#splitGrid .page-tile').count() === 6, 'split: one tile per page');
    await page.waitForFunction(() => document.querySelectorAll('#splitGrid img').length >= 6, null, { timeout: 20000 });
    ok(true, 'split: thumbnails are drawn');
    // Selecting tiles fills in the page list.
    await page.locator('#splitGrid .page-tile__body').nth(4).click();
    await page.locator('#splitGrid .page-tile__body').nth(0).click();
    await page.locator('#splitGrid .page-tile__body').nth(1).click();
    ok(await page.inputValue('#splitRanges') === '1-2, 5', `split: selection becomes a page list (${await page.inputValue('#splitRanges')})`);
    await page.fill('#splitRanges', '5, 1-3');
    await page.click('#splitRun');
    await waitShown(page, '#splitResult');
    await axe(page, 'split result');
    let out = await save(page, () => page.locator('#splitOutputs a').first().click());
    ok(markers(out.file).join() === 'MARKER-5,MARKER-1,MARKER-2,MARKER-3', `split: extract keeps the typed order (${markers(out.file)})`);
    ok(pdfInfo(out.file).rots.join() === '270,0,90,0', `split: rotations kept (${pdfInfo(out.file).rots})`);
    // Errors in the page list.
    await page.fill('#splitRanges', '2-9');
    await page.locator('#splitRanges').blur();
    ok(/highest page number is 6/.test(await page.locator('#splitRangesError').innerText()) && await page.locator('#splitRanges').getAttribute('aria-invalid') === 'true', 'split: a page past the end is explained at the field');
    // One PDF per range, then ZIP.
    await page.click('#splitMode [data-value=ranges]');
    await page.fill('#splitRanges', '1-2, 3-6');
    await page.click('#splitRun');
    await waitShown(page, '#splitResult');
    ok(await page.locator('#splitOutputs li').count() === 2, 'split: two ranges give two files');
    out = await save(page, () => page.click('#splitZip'), 'split.zip');
    ok(/No errors detected/.test(sh('unzip', ['-t', out.file])), 'split: the ZIP passes unzip -t');
    const list = sh('unzip', ['-Z1', out.file]).trim().split('\n');
    ok(list.join() === 'text-pages-1-2.pdf,text-pages-3-6.pdf', `split: ZIP entries are named by range (${list})`);
    const dir = path.join(tmp, 'split-zip'); fs.mkdirSync(dir);
    sh('unzip', ['-q', out.file, '-d', dir]);
    ok(pdfInfo(path.join(dir, 'text-pages-3-6.pdf')).pages === 4 && markers(path.join(dir, 'text-pages-3-6.pdf'))[0] === 'MARKER-3', 'split: the second part has pages 3 to 6');
    // Every page, and equal parts.
    await page.click('#splitMode [data-value=every]');
    await page.click('#splitRun');
    await waitShown(page, '#splitResult');
    ok(await page.locator('#splitOutputs li').count() === 6, 'split: every page gives six files');
    await page.click('#splitMode [data-value=chunks]');
    await page.fill('#splitChunk', '4');
    await page.click('#splitRun');
    await waitShown(page, '#splitResult');
    const metas = await page.locator('#splitOutputs .file-row__meta').allInnerTexts();
    ok(metas.length === 2 && /^4 pages/.test(metas[0]) && /^2 pages/.test(metas[1]), `split: parts of 4 give 4 + 2 pages (${metas})`);
    await page.fill('#splitChunk', '6');
    ok(/would give one file/.test(await page.locator('#splitChunkError').innerText()), 'split: a part as large as the file is explained');
    // Not a PDF, and an oversized file.
    await page.click('#splitRemove');
    await page.setInputFiles('#splitDropInput', F['not-a-pdf.pdf']);
    await page.waitForFunction(() => !document.getElementById('splitError').hidden, null, { timeout: 10000 });
    ok(/JPEG image.*needs a PDF/.test(await errorText(page, '#splitError')), 'split: a JPEG renamed .pdf is refused by its content');
    const huge = path.join(tmp, 'huge.pdf');
    const fd = fs.openSync(huge, 'w'); fs.writeSync(fd, '%PDF-1.4\n'); fs.ftruncateSync(fd, 101 * 1024 * 1024); fs.closeSync(fd);
    await page.setInputFiles('#splitDropInput', huge);
    await page.waitForFunction(() => /limit for this tool is 100 MB/.test(document.getElementById('splitError').textContent), null, { timeout: 30000 });
    ok(true, 'split: a file over 100 MB is refused with the limit');
    await context.close();
    console.log('✓ Split: extract in typed order, per range with ZIP, every page, equal parts, range errors, wrong and oversized files');
  }

  /* ---------------------------------------------------------------- 3. Organise */
  {
    const { context, page } = await open('organize-pdf.html');
    await page.setInputFiles('#orgDropInput', F['text.pdf']);
    await waitShown(page, '#orgGrid .org-tile');
    const tile = i => page.locator('#orgGrid .org-tile').nth(i);
    await tile(0).locator('[data-act=right]').click();          // MARKER-1: 0 -> 90
    await tile(1).locator('[data-act=delete]').click();         // delete MARKER-2
    ok(await tile(1).evaluate(n => n.classList.contains('is-deleted')) && /Restore/.test(await tile(1).locator('[data-act=delete]').getAttribute('aria-label')), 'organise: a deleted page stays with a Restore button');
    const restoreIcon = await tile(1).locator('[data-act=delete] i').evaluate(i => ({ content: getComputedStyle(i, '::before').content, w: i.getBoundingClientRect().width }));
    ok(restoreIcon.content !== 'none' && restoreIcon.content !== 'normal' && restoreIcon.w > 0, `organise: the Restore button shows its icon (${JSON.stringify(restoreIcon)})`);
    await tile(2).locator('[data-act=earlier]').click();        // MARKER-3 before MARKER-2
    await tile(1).locator('[data-act=earlier]').click();        // MARKER-3 first
    await tile(3).locator('[data-act=left]').click();           // MARKER-4: 180 -> 90
    await page.locator('#orgGrid .org-tile').nth(5).locator('.org-tile__handle').focus();
    await page.keyboard.press('ArrowLeft');                     // MARKER-6 before MARKER-5
    ok(/position 5 of 6/.test(await page.locator('#orgStatus').textContent()), 'organise: keyboard move is announced');
    await page.click('#orgInsert');
    await page.setInputFiles('#orgInsertInput', F['second.pdf']);
    await page.waitForFunction(() => document.querySelectorAll('#orgGrid .org-tile').length === 8, null, { timeout: 20000 });
    ok(/reordered/.test(await page.locator('#orgChanges').innerText()) && /1 page deleted/.test(await page.locator('#orgChanges').innerText()) && /2 pages inserted/.test(await page.locator('#orgChanges').innerText()), `organise: the changes are summarised (${await page.locator('#orgChanges').innerText()})`);
    await page.click('#orgRun');
    await waitShown(page, '#orgResult');
    await axe(page, 'organise result');
    const out = await save(page, () => page.click('#orgDownload'));
    const info = pdfInfo(out.file);
    ok(info.pages === 7, `organise: 6 - 1 deleted + 2 inserted pages (${info.pages})`);
    ok(markers(out.file).join() === 'MARKER-3,MARKER-1,MARKER-4,MARKER-6,MARKER-5,SECOND-1,SECOND-2', `organise: new order (${markers(out.file)})`);
    ok(info.rots.join() === '0,90,90,0,270,0,90', `organise: rotation added to the existing rotation (${info.rots})`);
    ok(near(info.sizes[3][0], 595.28) && near(info.sizes[4][0], 419.53), 'organise: page sizes kept');
    // Undo, and deleting everything.
    await page.click('#orgReset');
    ok(await page.locator('#orgGrid .org-tile').count() === 6 && /No changes/.test(await page.locator('#orgChanges').innerText()), 'organise: undo all changes restores the file as it was');
    for (let i = 0; i < 6; i++) await tile(i).locator('[data-act=delete]').click();
    ok(await page.locator('#orgRun').isDisabled() && /Restore at least one/.test(await page.locator('#orgSummary').innerText()), 'organise: saving with every page deleted is prevented');
    await context.close();
    console.log('✓ Organise: rotate, delete, restore, reorder by button and keyboard, insert, undo; output checked with pdfinfo');
  }

  /* ---------------------------------------------------------------- 4. PDF to images */
  {
    const { context, page } = await open('pdf-to-image.html');
    await page.setInputFiles('#imgDropInput', F['text.pdf']);
    await waitShown(page, '#imgGrid .page-tile');
    ok(/1240 × 1753 pixels/.test(await page.locator('#imgEstimate').innerText()), `pdf to image: estimate for A4 at 150 DPI (${await page.locator('#imgEstimate').innerText()})`);
    await page.fill('#imgRanges', '1-2');
    await page.click('#imgRun');
    await waitShown(page, '#imgResult');
    await axe(page, 'pdf to image result');
    const zip = await save(page, () => page.click('#imgZip'), 'images.zip');
    ok(/No errors detected/.test(sh('unzip', ['-t', zip.file])), 'pdf to image: the ZIP passes unzip -t');
    const dir = path.join(tmp, 'img-zip'); fs.mkdirSync(dir);
    sh('unzip', ['-q', zip.file, '-d', dir]);
    const files = fs.readdirSync(dir).sort();
    ok(files.join() === 'text-page-01.jpg,text-page-02.jpg', `pdf to image: names like file-page-01.jpg (${files})`);
    const dims = files.map(f => sh('identify', ['-format', '%m %w %h', path.join(dir, f)]).trim());
    ok(dims[0] === 'JPEG 1240 1753' && dims[1] === 'JPEG 1650 1275', `pdf to image: A4 and turned Letter at 150 DPI (${dims})`);
    // PNG at 300 DPI, one page: a single download.
    await page.click('#imgFormat [data-value=png]');
    await page.selectOption('#imgDpi', '300');
    await page.fill('#imgRanges', '5');
    ok(/1240 × 1753/.test(await page.locator('#imgEstimate').innerText()) === false, 'pdf to image: the estimate follows the resolution');
    await page.click('#imgRun');
    await waitShown(page, '#imgResult');
    const one = await save(page, () => page.click('#imgZip'));
    ok(one.name === 'text-page-05.png' && sh('identify', ['-format', '%m %w %h', one.file]).trim() === 'PNG 2480 1748', `pdf to image: A5 turned page as PNG at 300 DPI (${one.name}, ${sh('identify', ['-format', '%m %w %h', one.file])})`);
    // Cancel a long job, then run it again.
    await page.selectOption('#imgDpi', '300');
    await page.fill('#imgRanges', '');
    await page.click('#imgRun');
    await page.waitForFunction(() => /Drawing page/.test(document.getElementById('imgProgressText').textContent), null, { timeout: 15000 });
    await page.click('#imgCancel');
    await page.waitForFunction(() => document.getElementById('imgProgress').classList.contains('hidden'), null, { timeout: 20000 });
    ok(await page.locator('#imgResult').isHidden(), 'pdf to image: cancel leaves no result');
    await page.click('#imgFormat [data-value=jpg]');
    await page.selectOption('#imgDpi', '72');
    await page.click('#imgRun');
    await waitShown(page, '#imgResult');
    ok(await page.locator('#imgOutputs li').count() === 6, 'pdf to image: after cancelling, the run can be repeated');
    // JPEG 2000 decoding under the site's Content Security Policy.
    if (F['jpx.pdf']) {
      const decoders = [];
      context.on('request', r => { if (/openjpeg/.test(r.url())) decoders.push(path.basename(new URL(r.url()).pathname)); });
      await page.click('#imgRemove');
      await page.setInputFiles('#imgDropInput', F['jpx.pdf']);
      await waitShown(page, '#imgGrid .page-tile');
      await page.click('#imgRun');
      await waitShown(page, '#imgResult');
      const jpx = await save(page, () => page.click('#imgZip'));
      const px = sh('convert', [jpx.file, '-crop', '1x1+297+421', '-format', '%[fx:int(255*r)] %[fx:int(255*g)] %[fx:int(255*b)]', 'info:']).trim().split(' ').map(Number);
      ok(px[0] > 150 && px[1] < 80 && px[2] < 80, `JPEG 2000 image decoded by pdf.js under the CSP (centre pixel ${px})`);
      ok(decoders.length > 0, 'JPEG 2000: pdf.js fetched its OpenJPEG decoder from this site');
      console.log(`  JPEG 2000 decoder used: ${[...new Set(decoders)].join(', ')}`);
    }
    await context.close();
    console.log('✓ PDF to images: estimate, JPG ZIP and PNG at chosen DPI (identify), names, cancel and retry, JPEG 2000');
  }

  /* ---------------------------------------------------------------- 5. Extract text */
  {
    const { context, page } = await open('pdf-to-text.html');
    await page.setInputFiles('#textDropInput', F['text.pdf']);
    await waitShown(page, '#textResult');
    const text = await page.inputValue('#textOut');
    ok((text.match(/MARKER-\d/g) || []).join() === 'MARKER-1,MARKER-2,MARKER-3,MARKER-4,MARKER-5,MARKER-6', 'text: every page in order');
    ok(/^Page 1\n\nMARKER-1\nBody text that can be selected\./.test(text), `text: page markers and line breaks (${JSON.stringify(text.slice(0, 60))})`);
    await page.uncheck('#textMarkers');
    ok(!/^Page 1/.test(await page.inputValue('#textOut')), 'text: page markers can be turned off');
    await axe(page, 'text result');
    const txt = await save(page, () => page.click('#textDownload'));
    ok(txt.name === 'text.txt' && /MARKER-6/.test(fs.readFileSync(txt.file, 'utf8')), 'text: .txt download');
    await page.fill('#textRanges', '2-3');
    await page.click('#textRun');
    await page.waitForFunction(() => /MARKER-2[\s\S]*MARKER-3/.test(document.getElementById('textOut').value) && !/MARKER-1/.test(document.getElementById('textOut').value), null, { timeout: 15000 });
    ok(true, 'text: a page range reads only those pages');
    // A scanned PDF has no text, and says so.
    await page.click('#textRemove');
    await page.setInputFiles('#textDropInput', F['scan.pdf']);
    await page.waitForFunction(() => /No text found/.test(document.getElementById('textResultTitle').textContent), null, { timeout: 20000 });
    ok(/Pages 1-3 have no text/.test(await page.locator('#textEmptyBody').innerText()) && /OCR/.test(await page.locator('#textEmptyBody').innerText()), 'text: scanned pages are named and OCR is explained');
    // Protected PDF through pdf.js.
    await page.click('#textRemove');
    await page.setInputFiles('#textDropInput', F['enc.pdf']);
    await waitShown(page, '.pdf-password');
    await page.fill('.pdf-password input[type=password]', 'open sesame');
    await page.click('.pdf-password [data-act=ok]');
    await page.waitForFunction(() => /SECRET-3/.test(document.getElementById('textOut').value), null, { timeout: 20000 });
    ok(true, 'text: a password-protected PDF is read after the password');
    await context.close();
    console.log('✓ Extract text: order, lines, markers, ranges, .txt, scanned pages explained, protected file');
  }

  /* ---------------------------------------------------------------- 6. Page numbers */
  {
    const { context, page } = await open('add-page-numbers.html');
    await page.setInputFiles('#pnDropInput', F['text.pdf']);
    await waitShown(page, '#pnPreviewBox');
    ok(/Preview of page 1, showing "1"/.test(await page.locator('#pnPreviewCaption').innerText()), 'numbers: preview of page 1');
    await page.selectOption('#pnFormat', 'page-of');
    await page.check('#pnSkipFirst');
    await page.click('#pnPosition [data-value=bottom-right]');
    await page.waitForFunction(() => /page 2, showing "Page 1 of 5"/.test(document.getElementById('pnPreviewCaption').textContent), null, { timeout: 10000 });
    ok(/from "Page 1 of 5" to "Page 5 of 5"/.test(await page.locator('#pnSummary').innerText()), 'numbers: summary names the first and last labels');
    await page.fill('#pnStart', '-3');
    ok(await page.locator('#pnRun').isDisabled() && /whole number/.test(await page.locator('#pnStartError').innerText()), 'numbers: an invalid first number is explained');
    await page.fill('#pnStart', '1');
    await page.click('#pnRun');
    await waitShown(page, '#pnResult');
    await axe(page, 'numbers result');
    const out = await save(page, () => page.click('#pnDownload'));
    ok(!/Page \d+ of/.test(pageText(out.file, 1)), 'numbers: the cover has no number');
    for (let n = 2; n <= 6; n++) ok(new RegExp(`Page ${n - 1} of 5`).test(pageText(out.file, n)), `numbers: page ${n} shows "Page ${n - 1} of 5"`);
    const info = pdfInfo(out.file);
    ok(info.pages === 6 && info.rots.join() === SIZES.map(s => s[2]).join(), 'numbers: page count and rotations unchanged');
    // The number sits bottom right as the page is seen, on a turned page too (page 2 is Letter turned 90).
    const bbox = sh('pdftotext', ['-f', '2', '-l', '2', '-bbox', out.file, '-']);
    const word = bbox.match(/<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">of<\/word>/);
    ok(word && Number(word[1]) > 792 * 0.6 && Number(word[4]) > 612 * 0.85, `numbers: bottom right of a turned page (${word && word.slice(1).join(',')})`);
    // A protected file: numbered copy has no password.
    await page.click('#pnRemove');
    await page.setInputFiles('#pnDropInput', F['enc.pdf']);
    await waitShown(page, '.pdf-password');
    await page.fill('.pdf-password input[type=password]', 'open sesame');
    await page.click('.pdf-password [data-act=ok]');
    await waitShown(page, '#pnFile');
    await page.click('#pnRun');
    await waitShown(page, '#pnResult');
    const enc = await save(page, () => page.click('#pnDownload'), 'pn-enc.pdf');
    const ei = pdfInfo(enc.file);
    ok(!ei.encrypted && ei.pages === 3 && /SECRET-3[\s\S]*Page 2 of 2/.test(pageText(enc.file, 3)), 'numbers: a protected file is numbered and saved without a password');
    // Owner-only protection opens without asking.
    await page.click('#pnRemove');
    await page.setInputFiles('#pnDropInput', F['owner-only.pdf']);
    await waitShown(page, '#pnFile');
    ok(await page.locator('.pdf-password').count() === 0 && /password protected/.test(await page.locator('#pnFileName').innerText()), 'numbers: a PDF with only an owner password opens without a dialog');
    if (F['rc4.pdf']) {
      await page.click('#pnRemove');
      await page.setInputFiles('#pnDropInput', F['rc4.pdf']);
      await waitShown(page, '.pdf-password');
      await page.fill('.pdf-password input[type=password]', 'abc');
      await page.click('.pdf-password [data-act=ok]');
      await waitShown(page, '#pnFile');
      await page.click('#pnRun');
      await waitShown(page, '#pnResult');
      const rc4 = await save(page, () => page.click('#pnDownload'), 'pn-rc4.pdf');
      ok(!pdfInfo(rc4.file).encrypted && /SECOND-2/.test(pageText(rc4.file, 2)), 'numbers: an RC4-128 file (made by pypdf) opens with its password');
    }
    await context.close();
    console.log('✓ Page numbers: preview, formats, cover skipped, positions on turned pages, protected files');
  }

  /* ---------------------------------------------------------------- 7. Watermark */
  {
    const { context, page } = await open('watermark-pdf.html');
    await page.setInputFiles('#wmDropInput', F['text.pdf']);
    await waitShown(page, '#wmPreviewBox');
    await page.fill('#wmText', 'Copy ₹ नमस्ते');
    ok(await page.locator('#wmRun').isDisabled() && /"₹"/.test(await page.locator('#wmTextError').innerText()), `watermark: characters the font cannot write are named (${await page.locator('#wmTextError').innerText()})`);
    await page.click('#wmQuick [data-text="For verification only"]');
    ok(await page.inputValue('#wmText') === 'For verification only' && await page.locator('#wmQuick [data-text="For verification only"]').getAttribute('aria-pressed') === 'true', 'watermark: a common text fills the field');
    await page.selectOption('#wmLayout', 'tiled');
    await page.selectOption('#wmAngle', '0'); // level text reads back reliably with pdftotext
    await page.click('#wmRun');
    await waitShown(page, '#wmResult');
    await axe(page, 'watermark result');
    const out = await save(page, () => page.click('#wmDownload'));
    for (let n = 1; n <= 6; n++) {
      const t = sh('pdftotext', ['-f', String(n), '-l', String(n), '-raw', out.file, '-']);
      ok(/verification/.test(t) && new RegExp(`MARKER-${n}`).test(t), `watermark: page ${n} carries the watermark and keeps its text`);
    }
    ok(pdfInfo(out.file).pages === 6, 'watermark: page count unchanged');
    await context.close();
    console.log('✓ Watermark: font check, common texts, tiled stamp on every page');
  }

  /* ---------------------------------------------------------------- 8. Compress */
  {
    const { context, page } = await open('compress-pdf.html');
    // Scanned pages: under the limit, same pages and sizes.
    await page.setInputFiles('#compressFileInput', F['scan.pdf']);
    await waitShown(page, '#compressFileInfoBox');
    await page.fill('#targetKbInput', '120');
    await page.click('#btnStartCompress');
    await waitShown(page, '#compressResultArea', 90000);
    await axe(page, 'compress result');
    let out = await save(page, () => page.click('#btnDownloadCompressedPdf'));
    let info = pdfInfo(out.file);
    const size = fs.statSync(out.file).size;
    ok(info.pages === 3 && info.sizes.every(s => near(s[0], 595.28) && near(s[1], 841.89)), `compress: 3 A4 pages kept (${info.pages})`);
    ok(size <= 120 * 1024 && /Under 120 KB/.test(await page.locator('#compressStatus').innerText()), `compress: under the 120 KB target (${size} bytes)`);
    const mergeLink = page.locator('#compressResultArea a[href="merge-pdf.html"]');
    ok(/Open Merge PDF/.test(await mergeLink.innerText()) && /download it first/.test(await page.locator('#' + await mergeLink.getAttribute('aria-describedby')).innerText()), 'compress: the Merge PDF link says it opens the tool and that the file must be downloaded first');
    // A scan followed by text pages, some turned: every page is kept with its size and rotation
    // (an older version dropped pages that held text).
    await page.click('#btnCompressRemove');
    await page.setInputFiles('#compressFileInput', F['mixed.pdf']);
    await waitShown(page, '#compressFileInfoBox');
    await page.fill('#targetKbInput', '150');
    await page.click('#btnStartCompress');
    await waitShown(page, '#compressResultArea', 90000);
    out = await save(page, () => page.click('#btnDownloadCompressedPdf'), 'compressed-mixed.pdf');
    info = pdfInfo(out.file);
    ok(info.pages === 6 && fs.statSync(out.file).size <= 150 * 1024, `compress: every page of a mixed PDF is kept, under 150 KB (${info.pages}, ${fs.statSync(out.file).size} bytes)`);
    ok(info.rots.join() === SIZES.map(s => s[2]).join(), `compress: rotations kept (${info.rots})`);
    SIZES.forEach(([w, h], i) => ok(near(info.sizes[i][0], w) && near(info.sizes[i][1], h), `compress: size of page ${i + 1} kept`));
    await page.click('#btnCompressRemove');
    await page.setInputFiles('#compressFileInput', F['text.pdf']);
    await waitShown(page, '#compressFileInfoBox');
    // Already under the limit: original kept.
    await page.fill('#targetKbInput', '500');
    await page.click('#btnStartCompress');
    await page.waitForFunction(() => /kept unchanged/.test(document.getElementById('compressStatus').textContent), null, { timeout: 20000 });
    out = await save(page, () => page.click('#btnDownloadCompressedPdf'), 'kept.pdf');
    ok(fs.readFileSync(out.file).equals(fs.readFileSync(F['text.pdf'])), 'compress: a PDF already under the limit is offered byte for byte');
    // An impossible target is said plainly; then cancel and retry.
    await page.click('#btnCompressRemove');
    await page.setInputFiles('#compressFileInput', F['scan-12.pdf']);
    await waitShown(page, '#compressFileInfoBox');
    await page.fill('#targetKbInput', '20');
    await page.click('#btnStartCompress');
    await waitShown(page, '#compressResultArea', 90000);
    ok(/could not get under 20 KB/.test(await page.locator('#compressStatus').innerText()) && await page.locator('#compressStatus').evaluate(e => e.classList.contains('is-warning')), 'compress: an impossible target is a warning with the smallest size');
    await page.selectOption('#compressDpi', '200');
    await page.fill('#targetKbInput', '300');
    await page.click('#btnStartCompress');
    await page.waitForFunction(() => /Compressing page/.test(document.getElementById('compressProgressText').textContent), null, { timeout: 15000 });
    await page.click('#compressCancel');
    await page.waitForFunction(() => document.getElementById('compressProgressBox').classList.contains('hidden'), null, { timeout: 30000 });
    ok(await page.locator('#compressResultArea').isHidden(), 'compress: cancel leaves no result');
    await page.click('#btnStartCompress');
    await waitShown(page, '#compressResultArea', 90000);
    ok(/Under 300 KB/.test(await page.locator('#compressStatus').innerText()) && await page.locator('#statCompPages').innerText() === '12', `compress: works again after cancelling (${await page.locator('#compressStatus').innerText()})`);
    // A damaged file and an encrypted one.
    await page.click('#btnCompressRemove');
    await page.setInputFiles('#compressFileInput', F['damaged.pdf']);
    await page.waitForFunction(() => !document.getElementById('compressError').hidden, null, { timeout: 10000 });
    ok(/incomplete/.test(await errorText(page, '#compressError')), 'compress: a truncated PDF is explained');
    await page.setInputFiles('#compressFileInput', F['enc.pdf']);
    await waitShown(page, '.pdf-password');
    await page.fill('.pdf-password input[type=password]', 'open sesame');
    await page.click('.pdf-password [data-act=ok]');
    await waitShown(page, '#compressFileInfoBox');
    ok(/3 pages, password protected/.test(await page.locator('#compressFileInfoText').innerText()), 'compress: a protected PDF opens with its password');
    await context.close();
    console.log('✓ Compress: target met with pages and sizes kept, text pages kept, original kept when it fits, honest failure, cancel and retry');
  }

  /* ---------------------------------------------------------------- 9. Phone width and loaded states */
  {
    for (const file of ['merge-pdf.html', 'split-pdf.html', 'organize-pdf.html', 'pdf-to-image.html', 'pdf-to-text.html', 'add-page-numbers.html', 'watermark-pdf.html', 'compress-pdf.html']) {
      const { context, page } = await open(file, { viewport: { width: 320, height: 720 } });
      await page.locator('input[type=file]').first().setInputFiles(F['text.pdf']);
      await page.waitForFunction(() => document.querySelector('.ws').dataset.state !== 'empty', null, { timeout: 30000 });
      await page.waitForTimeout(400);
      const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      ok(over <= 0, `${file}: no sideways scrolling at 320 px with a file open (${over} px)`);
      await axe(page, `${file} with a file open`);
      await context.close();
    }
    console.log('✓ Every PDF tool at 320 px with a file open: no sideways scrolling, no axe violations');
  }

  /* ---------------------------------------------------------------- 9b. Phone: the finished result's download is in view */
  {
    // After a job the focused download button must be on screen and not under the sticky header or
    // the tool's sticky action bar (WCAG 2.4.11), including after scrolling down to the settings first.
    const cases = [
      ['merge-pdf.html', async page => { await page.setInputFiles('#mergeDropInput', [F['text.pdf'], F['second.pdf'], path.join(root, 'img/samples/test-signature.jpg')]); await page.waitForFunction(() => document.querySelectorAll('.merge-row').length === 3, null, { timeout: 30000 }); }, '#mergeRun', '#mergeDownload'],
      ['compress-pdf.html', async page => { await page.setInputFiles('#compressFileInput', F['second.pdf']); await waitShown(page, '#compressFileInfoBox'); }, '#btnStartCompress', '#btnDownloadCompressedPdf'],
      ['add-page-numbers.html', async page => { await page.setInputFiles('#pnApp .dropzone input', F['text.pdf']); await waitShown(page, '#pnFile'); }, '#pnRun', '#pnDownload'],
      ['watermark-pdf.html', async page => { await page.setInputFiles('#wmApp .dropzone input', F['text.pdf']); await waitShown(page, '#wmFile'); await page.fill('#wmText', 'COPY'); }, '#wmRun', '#wmDownload']
    ];
    for (const [width, height] of [[360, 740], [390, 844]]) {
      for (const [file, load, run, download] of cases) {
        for (const scrolled of [false, true]) {
          const { context, page } = await open(file, { viewport: { width, height } });
          await load(page);
          if (scrolled) await page.evaluate(() => window.scrollTo(0, document.querySelector('.ws-side, .ws-settings, .ws-rail').getBoundingClientRect().top + window.scrollY));
          await page.locator(run).click();
          await waitShown(page, download, 90000);
          await page.waitForTimeout(1200);
          const spot = await page.evaluate(sel => {
            const b = document.querySelector(sel).getBoundingClientRect();
            const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
            const head = document.getElementById('siteHeader').getBoundingClientRect().bottom;
            return { top: Math.round(b.top), bottom: Math.round(b.bottom), head: Math.round(head), vh: innerHeight, free: !!hit && hit.closest(sel) !== null, focused: document.activeElement === document.querySelector(sel) };
          }, download);
          ok(spot.focused && spot.free && spot.top >= spot.head && spot.bottom <= spot.vh, `${file} at ${width} px${scrolled ? ', started from the settings' : ''}: the focused download is in view and uncovered (${JSON.stringify(spot)})`);
          await context.close();
        }
      }
    }
    console.log('✓ Phone: every finished download is in view, clear of the sticky header and action bar');
  }

  /* ---------------------------------------------------------------- 10. Review: ids, thumbnails, focus, busy guard, limits */
  {
    const PAGES = ['merge-pdf.html', 'split-pdf.html', 'organize-pdf.html', 'pdf-to-image.html', 'pdf-to-text.html', 'add-page-numbers.html', 'watermark-pdf.html', 'compress-pdf.html'];
    for (const file of PAGES) {
      const html = fs.readFileSync(path.join(root, file), 'utf8');
      const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
      const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
      ok(dup.length === 0, `${file}: every id is unique (${dup.join(', ')})`);
    }
    // The main button of every drop zone opens the file picker (Compress once lost its binding).
    for (const file of PAGES) {
      const { context, page } = await open(file);
      const chooser = page.waitForEvent('filechooser', { timeout: 5000 }).then(() => true, () => false);
      await page.locator('.ws .dropzone button').first().click();
      ok(await chooser, `${file}: the Choose button opens the file picker`);
      await context.close();
    }
    // Thumbnails of every page shape sit inside their box, in the selectable grid and in Organise, desktop and phone.
    for (const [file, input, grid, width] of [['split-pdf.html', '#splitApp .dropzone input', '#splitGrid', 1280], ['organize-pdf.html', '#orgDropInput', '#orgGrid', 1280], ['organize-pdf.html', '#orgDropInput', '#orgGrid', 390]]) {
      const { context, page } = await open(file, { viewport: { width, height: 900 } });
      await page.setInputFiles(input, F['text.pdf']);
      await page.waitForFunction(g => document.querySelectorAll(`${g} .page-tile__img img`).length >= 6, grid, { timeout: 30000 });
      await page.waitForTimeout(400);
      const outside = await page.evaluate(g => [...document.querySelectorAll(`${g} .page-tile__img`)].filter(box => {
        const b = box.getBoundingClientRect(), i = box.querySelector('img').getBoundingClientRect();
        return i.left < b.left - 0.5 || i.right > b.right + 0.5 || i.top < b.top - 0.5 || i.bottom > b.bottom + 0.5;
      }).length, grid);
      ok(outside === 0, `${file} at ${width} px: every thumbnail fits inside its box (${outside} do not)`);
      // The drop zone folds away once the file is open; keyboard focus lands on the file's name, not the top of the page.
      await context.close();
    }
    for (const [file, button, nameSel] of [['add-page-numbers.html', '#pnApp [data-browse]', '#pnFileName'], ['compress-pdf.html', '#btnCompressBrowse', '#compressFileInfoText']]) {
      const { context, page } = await open(file);
      await page.locator(button).focus();
      const chooserPromise = page.waitForEvent('filechooser', { timeout: 15000 });
      await page.waitForTimeout(300); // file chooser interception is switched on asynchronously
      await page.keyboard.press('Enter');
      const chooser = await chooserPromise;
      await chooser.setFiles(F['text.pdf']);
      await page.waitForFunction(sel => document.activeElement === document.querySelector(sel), nameSel, { timeout: 30000 });
      await page.keyboard.press('Tab');
      ok(/Replace|different/i.test(await page.evaluate(() => document.activeElement.textContent + ' ' + (document.activeElement.getAttribute('aria-label') || ''))), `${file}: after opening a file with the keyboard, focus is on its name and Tab reaches Replace`);
      await context.close();
    }
    // A file pasted while a job runs must not replace the open document mid-job.
    {
      const { context, page } = await open('pdf-to-image.html');
      await page.setInputFiles('#imgApp .dropzone input', F['scan-12.pdf']);
      await waitShown(page, '#imgPages');
      await page.selectOption('#imgDpi', '300').catch(() => page.evaluate(() => { const s = document.getElementById('imgDpi'); s.value = '300'; s.dispatchEvent(new Event('change')); }));
      await page.click('#imgRun');
      await waitShown(page, '#imgProgress');
      const second = fs.readFileSync(F['second.pdf']).toString('base64');
      await page.evaluate(b64 => {
        const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
        const dt = new DataTransfer();
        dt.items.add(new File([bytes], 'second.pdf', { type: 'application/pdf' }));
        document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true }));
      }, second);
      await page.click('#imgRemove');
      await page.waitForTimeout(500);
      ok(await page.locator('#imgProgress').isVisible() && await page.locator('#imgFile').isVisible() && /scan-12\.pdf/.test(await page.locator('#imgFileName').innerText()), 'pdf-to-image: while the job runs, a pasted file and Remove leave the open file in place');
      await waitShown(page, '#imgResult', 120000);
      ok(await page.locator('#imgFile').isVisible() && /scan-12\.pdf/.test(await page.locator('#imgFileName').innerText()) && await page.locator('#imgOutputs li').count() === 12, 'pdf-to-image: a paste or Remove during a job waits; the job finishes with the original file');
      await context.close();
    }
    // Split refuses a plan over the output limit before it starts.
    {
      const many = path.join(tmp, 'many.pdf');
      fs.writeFileSync(many, await textPdf('MANY', Array.from({ length: Kit.LIMITS.outputs + 1 }, () => [300, 400, 0])));
      const { context, page } = await open('split-pdf.html');
      await page.setInputFiles('#splitApp .dropzone input', many);
      await waitShown(page, '#splitPages');
      await page.click('#splitMode [data-value="every"]');
      ok(await page.locator('#splitRun').isDisabled() && /limit is 500/.test(await page.locator('#splitSummary').innerText()), 'split: every page of a 501-page PDF is refused before starting, with the limit named');
      await context.close();
    }
    console.log('✓ Review checks: unique ids, thumbnails inside their boxes, focus after opening, no file change mid-job, split limit');
  }

  ok(errors.length === 0, `page errors or CSP violations: ${errors.join(' | ')}`);
  await browser.close();
  server.close();
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`\n${checks} PDF tool checks passed.`);
})().catch(e => { console.error(e); server.close(); process.exit(1); });
