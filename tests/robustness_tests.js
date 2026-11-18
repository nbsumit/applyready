/* Failure paths that once went wrong silently: offline reloads, a PDF whose text page an older
   compressor dropped, a new file chosen while the resizer is busy, page order in image to PDF, a PDF
   chosen in image to PDF, the contact form's empty message, and old or mistyped addresses on the 404
   page. Each check failed before its fix. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.wasm': 'application/wasm', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const file = path.resolve(root, '.' + (pathname.endsWith('/') ? pathname + 'index.html' : pathname));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (e, d) => { res.writeHead(e ? 404 : 200, { 'Content-Type': e ? 'text/html' : mime[path.extname(file)] || 'application/octet-stream' }); res.end(e ? fs.readFileSync(path.join(root, '404.html')) : d); });
});
const sample = name => fs.readFileSync(path.join(root, 'img/samples', name));
let checks = 0; const ok = (c, m) => { assert(c, m); checks++; };

// Two A4 pages: page 1 is a scanned JPEG, page 2 is text only.
function mixedPdf(jpeg) {
  const draw = 'q 500 0 0 700 50 100 cm /Im1 Do Q';
  const text = 'BT /F1 24 Tf 72 700 Td (Marks statement, page 2) Tj ET';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R 6 0 R] /Count 2 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Im1 4 0 R >> >> /Contents 5 0 R >>',
    [`<< /Type /XObject /Subtype /Image /Width 600 /Height 800 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>`, jpeg],
    [`<< /Length ${draw.length} >>`, Buffer.from(draw)],
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 7 0 R >> >> /Contents 8 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    [`<< /Length ${text.length} >>`, Buffer.from(text)]
  ];
  const parts = [Buffer.from('%PDF-1.4\n')];
  let length = parts[0].length;
  const push = b => { parts.push(b); length += b.length; };
  const offsets = objects.map((o, i) => {
    const at = length;
    if (Array.isArray(o)) { push(Buffer.from(`${i + 1} 0 obj\n${o[0]}\nstream\n`)); push(o[1]); push(Buffer.from('\nendstream\nendobj\n')); }
    else push(Buffer.from(`${i + 1} 0 obj\n${o}\nendobj\n`));
    return at;
  });
  push(Buffer.from(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('')}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${length}\n%%EOF\n`));
  return Buffer.concat(parts);
}

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const exe = process.env.BROWSER_EXECUTABLE_PATH;
  const browser = await chromium.launch({ headless: true, ...(exe ? { executablePath: exe } : {}), args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.route('**/*', r => /^(http:\/\/127\.|blob:|data:)/.test(r.request().url()) ? r.continue() : r.abort());
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));

  // 1. Offline: after one online visit, other pages reload with their styles and scripts.
  await page.goto(origin + '/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => caches.keys().then(k => k.length > 0));
  await page.waitForTimeout(1000);
  await context.setOffline(true);
  for (const p of ['/resume.html', '/compress-pdf.html', '/guides/ats-friendly-resume-guide.html', '/a-page-that-was-never-cached.html']) {
    await page.goto(origin + p);
    const s = await page.evaluate(() => ({ styled: getComputedStyle(document.body).fontFamily.includes('Inter'), scripts: !!window.ApplyReadyUI, title: document.title }));
    ok(s.styled && s.scripts, `offline ${p}: styles and scripts load from the cache (${JSON.stringify(s)})`);
    if (p.startsWith('/a-page')) ok(/Offline/.test(s.title), `offline ${p}: the offline page is shown (${s.title})`);
  }
  await context.setOffline(false);
  console.log('✓ Offline reloads keep styles and scripts; unknown pages fall back to the offline page');

  // 2. Compress PDF keeps every page of a PDF that mixes a scanned page and a text page. An older
  //    version refused such files (and before that dropped the text page); pages are now redrawn.
  await page.goto(origin + '/compress-pdf.html');
  const mixed = mixedPdf(sample('test-portrait.jpg'));
  await page.setInputFiles('#compressFileInput', { name: 'mixed.pdf', mimeType: 'application/pdf', buffer: mixed });
  await page.waitForSelector('#compressFileInfoBox:not(.hidden)', { timeout: 15000 });
  await page.fill('#targetKbInput', '100');
  await page.click('#btnStartCompress');
  await page.waitForSelector('#compressResultArea:not(.hidden)', { timeout: 60000 });
  const compressed = Buffer.from(await page.evaluate(async () => { const b = new Uint8Array(await (await fetch(document.getElementById('btnDownloadCompressedPdf').href)).arrayBuffer()); let s = ''; b.forEach(c => { s += String.fromCharCode(c); }); return btoa(s); }), 'base64');
  const PDFLib = require('../js/vendor/pdf-lib.min.js');
  const out = await PDFLib.PDFDocument.load(compressed);
  ok(out.getPageCount() === 2, `both pages are kept (${out.getPageCount()})`);
  ok(out.getPages().every(p => Math.abs(p.getWidth() - 595) < 1 && Math.abs(p.getHeight() - 842) < 1), 'page sizes are kept');
  ok(compressed.length <= 100 * 1024, `the result is under 100 KB (${compressed.length} bytes)`);
  ok(await page.locator('#statCompPages').innerText() === '2', 'the result reports two pages');
  console.log('✓ Compress PDF keeps a text page next to a scanned page');

  // 3. Choosing another image while the resizer is busy leaves it usable.
  await page.goto(origin + '/resize-image-to-50kb.html');
  await page.setInputFiles('#fileInput', { name: 'first.jpg', mimeType: 'image/jpeg', buffer: sample('test-portrait.jpg') });
  await page.waitForFunction(() => !document.getElementById('btnProcess').disabled, null, { timeout: 15000 });
  await page.click('#btnProcess');
  await page.setInputFiles('#fileInput', { name: 'second.jpg', mimeType: 'image/jpeg', buffer: sample('test-signature.jpg') });
  await page.waitForFunction(() => { const b = document.getElementById('btnProcess'); return !b.disabled && !b.hasAttribute('aria-busy'); }, null, { timeout: 15000 });
  await page.click('#btnProcess');
  await page.waitForSelector('#resultArea:not(.hidden)', { timeout: 30000 });
  ok(true, 'the second image processes');
  console.log('✓ Resizer stays usable when a new image is chosen mid-process');

  // 4. Image to PDF lists pages in the order they were chosen, whichever loads first.
  await page.goto(origin + '/image-to-pdf.html');
  await page.setInputFiles('#imgPdfFileInput', [
    { name: '1-large.jpg', mimeType: 'image/jpeg', buffer: sample('test-portrait.jpg') },
    { name: '2-small.jpg', mimeType: 'image/jpeg', buffer: sample('test-signature-cleaned.jpg') },
    { name: '3-medium.jpg', mimeType: 'image/jpeg', buffer: sample('test-signature.jpg') }
  ]);
  await page.waitForFunction(() => document.querySelectorAll('.page-row__text').length === 3, null, { timeout: 15000 });
  const order = await page.evaluate(() => [...document.querySelectorAll('.page-row__text')].map(n => n.textContent.trim().split(/\s+/)[0]));
  ok(order.join() === '1-large.jpg,2-small.jpg,3-medium.jpg', `pages keep the chosen order (${order})`);
  console.log('✓ Image to PDF keeps the chosen page order');

  // 4b. A PDF chosen with the photos is not dropped silently: a notice names it and points to Merge PDF.
  await page.setInputFiles('#addMoreFileInput', [
    { name: 'certificate.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n%%EOF\n') },
    { name: '4-extra.jpg', mimeType: 'image/jpeg', buffer: sample('test-signature.jpg') }
  ]);
  await page.waitForFunction(() => document.querySelectorAll('.page-row__text').length === 4, null, { timeout: 15000 });
  const skipped = await page.evaluate(() => { const n = document.getElementById('imgPdfSkipped'); return n && { text: n.textContent, role: n.getAttribute('role'), link: (n.querySelector('a') || {}).getAttribute && n.querySelector('a').getAttribute('href'), visible: !!n.offsetParent }; });
  ok(skipped && skipped.visible && /certificate\.pdf/.test(skipped.text) && /not added/.test(skipped.text) && skipped.link === 'merge-pdf.html' && skipped.role === 'alert', `a skipped PDF is named, with a link to Merge PDF (${JSON.stringify(skipped)})`);
  await page.setInputFiles('#addMoreFileInput', [{ name: '5-more.jpg', mimeType: 'image/jpeg', buffer: sample('test-signature.jpg') }]);
  await page.waitForFunction(() => document.querySelectorAll('.page-row__text').length === 5, null, { timeout: 15000 });
  ok(!(await page.$('#imgPdfSkipped')), 'the notice goes away when only images are added');
  await page.goto(origin + '/image-to-pdf.html');
  await page.setInputFiles('#imgPdfFileInput', [{ name: 'only.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n%%EOF\n') }, { name: 'notes.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: Buffer.from('PK') }]);
  const onlyPdf = await page.evaluate(() => { const n = document.getElementById('imgPdfSkipped'); return n && { text: n.textContent, visible: !!n.offsetParent }; });
  ok(onlyPdf && onlyPdf.visible && /only\.pdf/.test(onlyPdf.text) && /notes\.docx/.test(onlyPdf.text) && /JPG, PNG or WebP/.test(onlyPdf.text), `with no image chosen, the notice still explains every file (${JSON.stringify(onlyPdf)})`);
  await page.locator('#taskNotification.is-visible').waitFor({ state: 'visible', timeout: 6000 });
  ok(/Merge PDF/.test(await page.locator('#taskNotification').innerText()), 'with no image chosen, the notification says so and names Merge PDF');
  console.log('✓ Image to PDF names skipped PDFs and points to Merge PDF');

  // 5. The contact form explains an empty message instead of opening a blank email.
  await page.goto(origin + '/contact.html');
  await page.fill('#contactMessage', '   ');
  await page.click('#contactForm button[type=submit]');
  const contact = await page.evaluate(() => ({ text: document.getElementById('contactMessageError').textContent, shown: !document.getElementById('contactMessageError').hidden, invalid: document.getElementById('contactMessage').getAttribute('aria-invalid'), focused: document.activeElement.id }));
  ok(contact.shown && contact.text && contact.invalid === 'true' && contact.focused === 'contactMessage', `empty contact message is explained at the field (${JSON.stringify(contact)})`);
  ok(await page.locator('#contactMessage').getAttribute('maxlength') === '1500', 'the message is capped so the mailto link stays short enough');
  console.log('✓ Contact form validates an empty message');

  // 6. Missing pages: an old address that moved goes to its new page, a removed page says where its
  //    content went, a mistyped one searches for its words, and the main buttons open the real tools.
  await page.goto(origin + '/guides/image-dimensions-vs-file-size.html');
  await page.waitForURL(/pixels-cm-inches-dpi-explained\.html$/, { timeout: 10000 });
  ok(true, 'a moved guide opens its new address');
  await page.goto(origin + '/ssc-photo-signature-size.html');
  const removed = await page.evaluate(() => ({ h1: document.querySelector('h1').textContent, links: [...document.querySelectorAll('#notFoundMoved a')].map(a => a.getAttribute('href')), shown: !document.getElementById('notFoundMoved').hidden }));
  ok(removed.h1 === 'This page was removed' && removed.shown && removed.links.includes('/passport-photo-resizer.html') && removed.links.includes('/signature-resizer.html'), `a removed page explains itself and links its replacements (${JSON.stringify(removed)})`);
  await page.goto(origin + '/merge-pdfs.html');
  await page.waitForFunction(() => document.querySelector('[data-search-inline] .search-result'), null, { timeout: 10000 });
  const guess = await page.evaluate(() => ({ q: document.querySelector('[data-search-inline] input').value, first: document.querySelector('[data-search-inline] .search-result').getAttribute('href'), h1: document.querySelector('h1').textContent }));
  ok(guess.h1 === 'Page not found' && guess.q === 'merge pdfs' && guess.first === '/merge-pdf.html', `a mistyped address searches for its words (${JSON.stringify(guess)})`);
  for (const p of ['/no/such/page.html', '/offline.html']) {
    await page.goto(origin + p);
    const buttons = await page.evaluate(() => [...document.querySelectorAll('.status-page .actions a')].map(a => [a.textContent.trim(), a.getAttribute('href')]));
    const resizer = buttons.find(([t]) => /image resizer/i.test(t));
    ok(resizer && resizer[1] === '/image-resizer.html', `${p}: the image resizer button opens the resizer (${JSON.stringify(buttons)})`);
    ok(buttons.some(([, h]) => h === '/tools.html'), `${p}: a button lists every tool`);
  }
  await page.goto(origin + '/no/such/page.html');
  await page.click('.status-page .actions a[href="/image-resizer.html"]');
  await page.waitForURL(/\/image-resizer\.html$/);
  ok((await page.locator('h1').textContent()).trim() === 'Image resizer', 'following the 404 button lands on the resizer');
  console.log('✓ Missing pages redirect, explain or search, and their buttons open the real tools');

  ok(errors.length === 0, `page errors: ${errors.join('; ')}`);
  await browser.close();
  server.close();
  console.log(`\n${checks} robustness checks passed.`);
})().catch(e => { console.error(e); server.close(); process.exit(1); });
