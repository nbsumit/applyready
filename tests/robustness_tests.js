/* Failure paths that once went wrong silently: offline reloads, a PDF with pages the compressor
   cannot keep, a new file chosen while the resizer is busy, page order in image to PDF, and the
   contact form's empty message. Each check failed before its fix. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
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

  // 2. Compress PDF refuses a PDF whose text page it would drop.
  await page.goto(origin + '/compress-pdf.html');
  await page.setInputFiles('#compressFileInput', { name: 'mixed.pdf', mimeType: 'application/pdf', buffer: mixedPdf(sample('test-portrait.jpg')) });
  await page.fill('#targetKbInput', '100');
  await page.click('#btnStartCompress');
  await page.waitForFunction(() => /2 pages but 1 scanned image/.test((document.getElementById('taskNotification') || {}).textContent || ''), null, { timeout: 15000 });
  ok(await page.locator('#compressResultArea').evaluate(n => n.classList.contains('hidden')), 'no result is offered for a PDF that would lose a page');
  ok(!(await page.locator('#btnStartCompress').isDisabled()), 'the compress button is usable again after the refusal');
  console.log('✓ Compress PDF refuses a PDF with a text page instead of dropping it');

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

  // 5. The contact form explains an empty message instead of opening a blank email.
  await page.goto(origin + '/contact.html');
  await page.fill('#contactMessage', '   ');
  await page.click('#contactForm button[type=submit]');
  const contact = await page.evaluate(() => ({ text: document.getElementById('contactMessageError').textContent, shown: !document.getElementById('contactMessageError').hidden, invalid: document.getElementById('contactMessage').getAttribute('aria-invalid'), focused: document.activeElement.id }));
  ok(contact.shown && contact.text && contact.invalid === 'true' && contact.focused === 'contactMessage', `empty contact message is explained at the field (${JSON.stringify(contact)})`);
  ok(await page.locator('#contactMessage').getAttribute('maxlength') === '1500', 'the message is capped so the mailto link stays short enough');
  console.log('✓ Contact form validates an empty message');

  ok(errors.length === 0, `page errors: ${errors.join('; ')}`);
  await browser.close();
  server.close();
  console.log(`\n${checks} robustness checks passed.`);
})().catch(e => { console.error(e); server.close(); process.exit(1); });
