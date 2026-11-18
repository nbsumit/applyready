/* Failure paths that once went wrong silently: offline reloads, a PDF whose text page an older
   compressor dropped, a new file chosen while the resizer is busy, page order in image to PDF, and the
   contact form's empty message. Each check failed before its fix. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.wasm': 'application/wasm', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
// Served like GitHub Pages (cacheable for 10 minutes), counting what is sent so the tests can check
// how much the offline service downloads. swOverride replaces sw.js to simulate a new release.
const served = { bytes: 0, paths: [] };
let swOverride = null;
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const file = path.resolve(root, '.' + (pathname.endsWith('/') ? pathname + 'index.html' : pathname));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (e, d) => {
    if (!e && pathname === '/sw.js' && swOverride) d = Buffer.from(swOverride);
    const body = e ? fs.readFileSync(path.join(root, '404.html')) : d;
    served.bytes += body.length; served.paths.push(pathname);
    res.writeHead(e ? 404 : 200, { 'Content-Type': e ? 'text/html' : mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'max-age=600' });
    res.end(body);
  });
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

  // 1. Offline. Opening a page keeps that page and its files for offline use, copied from the HTTP
  //    cache, without downloading the rest of the site (a first visit once fetched all 171 files,
  //    5 MB). Pages are kept as they are opened; every tool only after "Save every tool for offline use".
  //    Its own context without request routing: Playwright turns the HTTP cache off when routing is on,
  //    and the site makes no outside requests anyway.
  {
  const context = await browser.newContext({ viewport: { width: 360, height: 740 } });
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(e.message));
  const offlineCheck = async (p, expectPage) => {
    await page.goto(origin + p);
    const s = await page.evaluate(() => ({ styled: getComputedStyle(document.body).fontFamily.includes('Inter'), scripts: !!window.ApplyReadyUI, title: document.title }));
    ok(s.styled && s.scripts, `offline ${p}: styles and scripts load from the cache (${JSON.stringify(s)})`);
    ok(expectPage ? !/Offline/.test(s.title) : /Offline/.test(s.title), `offline ${p}: ${expectPage ? 'the page itself' : 'the offline page'} is shown (${s.title})`);
  };
  // Poll a condition that needs await in the page (waitForFunction does not wait for a promise here).
  const until = async (fn, label, timeout = 30000) => {
    const end = Date.now() + timeout;
    while (Date.now() < end) { if (await page.evaluate(fn)) return; await page.waitForTimeout(150); }
    throw new Error(`timed out: ${label}`);
  };
  const cachedPaths = () => page.evaluate(async () => (await (await caches.open('applyready-files')).keys()).map(r => r.url));
  served.bytes = 0; served.paths = [];
  await page.goto(origin + '/');
  const pageBytes = served.bytes, pagePaths = served.paths.length;
  await page.evaluate(() => navigator.serviceWorker.ready);
  await until(async () => {
    const keys = (await (await caches.open('applyready-files')).keys()).map(r => new URL(r.url).pathname);
    return ['/', '/css/app.css', '/css/vendor/icons.min.css', '/js/site.js', '/js/home.js', '/offline.html', '/assets/fonts/inter-latin.woff2'].every(p => keys.includes(p));
  }, 'the first page and its files are kept');
  await page.waitForTimeout(500);
  const extraPaths = served.paths.slice(pagePaths).filter(p => p !== '/sw.js' && !p.startsWith('/favicon/')); // the browser asks for the icon itself
  ok(served.bytes - pageBytes < 60 * 1024 && extraPaths.every(p => p === '/offline.html'), `first visit: the offline service downloaded only the offline page (${Math.round((served.bytes - pageBytes) / 1024)} KB: ${extraPaths.join(', ')})`);
  let keys = await cachedPaths();
  ok(keys.length < 40, `first visit: only the page's own files are kept (${keys.length})`);
  ok(keys.every(u => !/[?&]v=/.test(u)) && new Set(keys.map(u => new URL(u).pathname)).size === keys.length, 'each file is cached once, under its path and content hash, not once per ?v= query');
  await context.setOffline(true);
  await offlineCheck('/', true);
  await offlineCheck('/compress-pdf.html', false);
  await offlineCheck('/a-page-that-was-never-cached.html', false);
  await context.setOffline(false);

  // A page opened online (the service worker now in control) is kept as it loads.
  await page.goto(origin + '/resume.html');
  await page.waitForFunction(() => window.ApplyReadyUI);
  await page.waitForTimeout(1500);
  await context.setOffline(true);
  await offlineCheck('/resume.html', true);
  await offlineCheck('/guides/ats-friendly-resume-guide.html', false);
  await context.setOffline(false);
  keys = await cachedPaths();
  ok(keys.every(u => !/[?&]v=/.test(u)) && new Set(keys.map(u => new URL(u).pathname)).size === keys.length, 'still one entry per file after browsing');

  // Your data: the visitor can save every tool, and is told the size first.
  await page.goto(origin + '/your-data.html');
  await page.locator('#ydOfflineAll').waitFor({ state: 'visible', timeout: 15000 });
  const note = await page.locator('#ydOfflineAllNote').innerText();
  ok(/^\d+ of the site’s \d+ files are saved\. Saving every tool and guide downloads up to about [\d.]+ (MB|KB)/.test(note), `your data: the full copy's size is stated before saving (${note})`);
  await page.click('#ydOfflineAll');
  await page.waitForFunction(() => !document.getElementById('ydDone').hidden && /saved for offline use/.test(document.getElementById('ydDoneText').textContent), null, { timeout: 60000 });
  ok(/Every tool and guide is saved for offline use/.test(await page.locator('#ydDoneText').innerText()) && await page.locator('#ydOfflineAll').isHidden(), `your data: every tool saved (${await page.locator('#ydDoneText').innerText()})`);
  await context.setOffline(true);
  for (const p of ['/compress-pdf.html', '/guides/ats-friendly-resume-guide.html', '/merge-pdf.html']) await offlineCheck(p, true);
  await offlineCheck('/a-page-that-was-never-cached.html', false);
  await context.setOffline(false);

  // A new release: only the files that changed are downloaded again, and the old copies go.
  const swText = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  const list = swText.match(/STATIC_ASSETS = \[([\s\S]*?)\];/)[1].match(/'[^']+'/g).map(x => x.slice(1, -1));
  const hashes = swText.match(/ASSET_HASHES = '([^']+)'/)[1].split(' ');
  const at = list.indexOf('/css/app.css');
  const oldHash = hashes[at];
  hashes[at] = 'deadbeef';
  swOverride = swText.replace(/ASSET_HASHES = '[^']+'/, `ASSET_HASHES = '${hashes.join(' ')}'`);
  served.paths = [];
  await page.evaluate(async () => { const reg = await navigator.serviceWorker.getRegistration(); await reg.update(); });
  await until(async () => {
    const urls = (await (await caches.open('applyready-files')).keys()).map(r => r.url);
    return urls.some(u => u.endsWith('/css/app.css?sw=deadbeef')) && !urls.some(u => /\/css\/app\.css\?sw=(?!deadbeef)/.test(u));
  }, 'the new release takes over');
  const fetched = [...new Set(served.paths)].filter(p => p !== '/sw.js');
  ok(fetched.every(p => p === '/css/app.css' || p === '/offline.html') && fetched.includes('/css/app.css'), `new release: only the changed file is fetched again (${fetched.join(', ')}, old hash ${oldHash})`);
  const afterRelease = (await cachedPaths()).map(u => new URL(u).pathname.replace(/index\.html$/, ''));
  const missing = list.filter(p => !afterRelease.includes(p));
  ok(!missing.length, `new release: every other file is kept (missing: ${missing.join(', ')}; extra: ${afterRelease.filter(p => !list.includes(p)).join(', ')})`);
  swOverride = null;
  await context.close();
  }
  console.log('✓ Offline: a first visit keeps only its own files, pages are kept as they open, every tool on request, a release refetches only what changed');

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
