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
  const swSource = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  const offlineShell = swSource.match(/OFFLINE_SHELL = \[([^\]]*)\]/)[1].match(/'[^']+'/g).map(x => x.slice(1, -1));
  // The offline page, shown for a page that was never kept: which buttons and kept pages it offers,
  // and whether its icons drew (the regular-weight icon font once failed offline).
  const offlinePage = async p => {
    await page.goto(origin + p);
    await page.waitForFunction(() => !document.getElementById('offlineStatus').hidden, null, { timeout: 10000 });
    await page.evaluate(() => document.fonts.ready);
    return page.evaluate(async () => ({
      // Both icon weights, drawn or not: loading one that is not kept fails offline.
      fontsLoaded: await Promise.all(['400', '900'].map(w => document.fonts.load(`${w} 16px "Font Awesome 6 Free"`, '\uf15c').then(f => f.length, () => 0))),
      title: document.title,
      lede: document.querySelector('.page-lede').textContent,
      buttons: [...document.querySelectorAll('#offlineActions a')].filter(a => !a.hidden && a.offsetParent).map(a => a.getAttribute('href')),
      primary: [...document.querySelectorAll('#offlineActions a.btn-primary')].filter(a => !a.hidden).map(a => a.getAttribute('href')),
      saved: document.getElementById('offlineSavedBox').hidden ? [] : [...document.querySelectorAll('#offlineSaved a')].map(a => a.getAttribute('href')),
      status: document.getElementById('offlineStatus').textContent,
      fontErrors: [...document.fonts].filter(f => /Font Awesome/.test(f.family) && f.status === 'error').map(f => f.weight)
    }));
  };
  served.bytes = 0; served.paths = [];
  await page.goto(origin + '/');
  const pagePaths = served.paths.length;
  await page.evaluate(() => navigator.serviceWorker.ready);
  await until(async () => {
    const keys = (await (await caches.open('applyready-files')).keys()).map(r => new URL(r.url).pathname);
    return ['/', '/css/app.css', '/css/vendor/icons.min.css', '/js/site.js', '/js/home.js', '/offline.html', '/assets/fonts/inter-latin.woff2', '/js/offline.js', '/css/webfonts/fa-regular-400.woff2'].every(p => keys.includes(p));
  }, 'the first page and its files are kept');
  await page.waitForTimeout(500);
  const extraPaths = served.paths.slice(pagePaths).filter(p => p !== '/sw.js' && !p.startsWith('/favicon/')); // the browser asks for the icon itself
  // Counted without sw.js and the favicon, which the browser fetches for itself.
  const extraBytes = extraPaths.reduce((n, p) => n + fs.statSync(path.join(root, p)).size, 0);
  ok(extraBytes < 60 * 1024 && extraPaths.every(p => p === '/offline.html' || offlineShell.includes(p)), `first visit: the offline service downloaded only the offline page, its script and icon fonts (${Math.round(extraBytes / 1024)} KB: ${extraPaths.join(', ')})`);
  let keys = await cachedPaths();
  ok(keys.length < 40, `first visit: only the page's own files are kept (${keys.length})`);
  ok(keys.every(u => !/[?&]v=/.test(u)) && new Set(keys.map(u => new URL(u).pathname)).size === keys.length, 'each file is cached once, under its path and content hash, not once per ?v= query');
  await context.setOffline(true);
  await offlineCheck('/', true);
  await offlineCheck('/compress-pdf.html', false);
  await offlineCheck('/a-page-that-was-never-cached.html', false);
  // The offline page offers only what is kept (here the home page), never a page that would show it
  // again, and does not promise that every tool is kept; its icons draw from the cache.
  let off = await offlinePage('/compress-pdf.html');
  ok(off.buttons.join() === '/' && off.primary.join() === '/' && !off.saved.length, `offline page after one visit: only the home page is offered (${JSON.stringify(off)})`);
  ok(!/first visit|every tool/i.test(off.lede) && /opened before/.test(off.lede), `offline page: the text describes what is kept (${off.lede})`);
  ok(!off.fontErrors.length && off.fontsLoaded.every(n => n > 0), `offline page: both icon fonts load offline (loaded ${off.fontsLoaded}, errors ${JSON.stringify(off.fontErrors)})`);
  await context.setOffline(false);

  // A page opened online (the service worker now in control) is kept as it loads.
  await page.goto(origin + '/resume.html');
  await page.waitForFunction(() => window.ApplyReadyUI);
  await page.waitForTimeout(1500);
  await context.setOffline(true);
  await offlineCheck('/resume.html', true);
  await offlineCheck('/guides/ats-friendly-resume-guide.html', false);
  off = await offlinePage('/guides/ats-friendly-resume-guide.html');
  ok(off.buttons.join() === '/,/resume.html' && !off.saved.length, `offline page: the resume builder, opened before, is offered too (${JSON.stringify(off)})`);
  await page.click('#offlineActions a[href="/resume.html"]');
  await page.waitForURL(/\/resume\.html$/);
  ok(!/Offline/.test(await page.title()), 'offline page: its resume builder button opens the resume builder');
  await context.setOffline(false);
  // A tool opened online appears in the list of other kept pages.
  await page.goto(origin + '/merge-pdf.html');
  await page.waitForFunction(() => window.ApplyReadyUI);
  await page.waitForTimeout(1500);
  await context.setOffline(true);
  off = await offlinePage('/split-pdf.html');
  ok(off.saved.includes('/merge-pdf.html') && !off.saved.includes('/split-pdf.html') && !off.saved.includes('/tools.html'), `offline page: other kept tools are listed (${JSON.stringify(off.saved)})`);
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
  const vendorKept = await page.evaluate(async () => {
    const name = (await caches.keys()).find(k => k.startsWith('applyready-vendor-'));
    return name ? (await (await caches.open(name)).keys()).map(r => new URL(r.url).pathname) : [];
  });
  ok(['/js/vendor/pdf-lib.min.js', '/js/vendor/pdfjs/pdf.min.mjs', '/js/vendor/pdfjs/pdf.worker.min.mjs'].every(p => vendorKept.includes(p)), `your data: saving every tool keeps the PDF libraries (${vendorKept.length} files)`);
  await context.setOffline(true);
  for (const p of ['/compress-pdf.html', '/guides/ats-friendly-resume-guide.html', '/merge-pdf.html']) await offlineCheck(p, true);
  await offlineCheck('/a-page-that-was-never-cached.html', false);
  off = await offlinePage('/a-page-that-was-never-cached.html');
  ok(off.buttons.length === 5 && off.saved.length > 10, `offline page after saving every tool: every button and the kept tools are offered (${off.buttons.length} buttons, ${off.saved.length} pages)`);
  // A PDF tool that was never used online works offline after "Save every tool".
  await page.goto(origin + '/compress-pdf.html');
  await page.setInputFiles('#compressFileInput', { name: 'mixed.pdf', mimeType: 'application/pdf', buffer: mixedPdf(sample('test-portrait.jpg')) });
  await page.waitForSelector('#compressFileInfoBox:not(.hidden)', { timeout: 15000 });
  await page.fill('#targetKbInput', '100');
  await page.click('#btnStartCompress');
  await page.waitForSelector('#compressResultArea:not(.hidden)', { timeout: 60000 });
  ok(true, 'offline after saving every tool: Compress PDF compresses a PDF');
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
  // A mistyped address offers the pages that match all of its words as plain links in the page,
  // never as an open dropdown that would sit over the buttons; a loose match offers nothing.
  const offered = async p => {
    await page.goto(origin + p);
    await page.waitForLoadState('load');
    return page.evaluate(() => ({
      h1: document.querySelector('h1').textContent,
      links: document.getElementById('notFoundMoved').hidden ? [] : [...document.querySelectorAll('#notFoundMoved a')].map(a => a.getAttribute('href')),
      q: document.querySelector('[data-search-inline] input').value,
      dropdown: [...document.querySelectorAll('[data-search-inline] .search-result')].some(r => r.offsetParent)
    }));
  };
  const merge = await offered('/merge-pdfs.html');
  ok(merge.h1 === 'Page not found' && merge.links[0] === '/merge-pdf.html' && !merge.q && !merge.dropdown, `a mistyped address links the page it names, with no dropdown open (${JSON.stringify(merge)})`);
  const contactUs = await offered('/contact-us.html');
  ok(contactUs.links.length === 1 && contactUs.links[0] === '/contact.html' && !contactUs.dropdown, `/contact-us.html links the contact page (${JSON.stringify(contactUs)})`);
  for (const p of ['/guides/nope/deep.html', '/resize-image-to-30kb.html', '/no/such/page.html']) {
    const r = await offered(p);
    ok(r.h1 === 'Page not found' && !r.links.length && !r.dropdown, `${p}: a loose match is not offered as a guess (${JSON.stringify(r)})`);
  }
  // Every button, clicked with the mouse where a person would click it, opens its own page.
  for (const width of [1280, 360]) {
    await page.setViewportSize({ width, height: 800 });
    for (const p of ['/merge-pdfs.html', '/guides/nope/deep.html', '/contact-us.html']) {
      await page.goto(origin + p);
      await page.waitForLoadState('load');
      const hrefs = await page.evaluate(() => [...document.querySelectorAll('.status-page .actions a')].map(a => a.getAttribute('href')));
      for (const [i, href] of hrefs.entries()) {
        if (i) { await page.goto(origin + p); await page.waitForLoadState('load'); }
        const btn = page.locator('.status-page .actions a').nth(i);
        await btn.scrollIntoViewIfNeeded();
        const box = await btn.boundingBox();
        const atPoint = await page.evaluate(([x, y]) => { const el = document.elementFromPoint(x, y); const a = el && el.closest('a'); return a ? a.getAttribute('href') : String(el && el.className); }, [box.x + box.width / 2, box.y + box.height / 2]);
        ok(atPoint === href, `${p} at ${width}px: nothing covers the "${href}" button (found ${atPoint})`);
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        await page.waitForURL(u => new URL(u).pathname === href, { timeout: 10000 });
      }
    }
  }
  await page.setViewportSize({ width: 1280, height: 900 });
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
