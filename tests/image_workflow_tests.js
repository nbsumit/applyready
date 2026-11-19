/* Image workflow regression test: drives the resizer through presets, units, DPI, aspect lock, crop ratios,
   rotate, zoom, reset, retry, formats, size limits, original size, annotations, drag and drop and invalid files,
   and checks every measured result against the values the engine produced before the interface was rebuilt.
   Then the checks every single-image tool makes on a picked file (truncated, oversized, tiny, SVG), the
   recorded DPI, size from the address, keyboard focus, the signature cleaner's paper and ink, the print
   sheet's copy count, Image to PDF's intake and Compress PDF's photo intake.
   It uses element ids and sets selects through the DOM; the only layout step is opening the settings disclosure. Chromium only. */
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), crypto = require('node:crypto');
const repo = path.resolve(__dirname, '..');
const { chromium } = require(path.join(repo, 'node_modules/playwright'));
const site = repo;
const assert = require('node:assert/strict');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.webmanifest': 'application/json', '.json': 'application/json' };
const server = http.createServer((req, res) => { const p = decodeURIComponent(new URL(req.url, 'http://x').pathname); const f = path.resolve(site, '.' + (p === '/' ? '/index.html' : p)); fs.readFile(f, (e, d) => { res.writeHead(e ? 404 : 200, { 'Content-Type': mime[path.extname(f)] || 'application/octet-stream' }); res.end(e ? 'nf' : d); }); });
const rec = {};
const EXPECTED = {
 "preset:passport:fields": {
  "w": "350",
  "h": "450",
  "min": "",
  "max": "50",
  "fmt": "image/jpeg",
  "unit": "px"
 },
 "preset:passport:result": {
  "resultShown": true,
  "error": null,
  "w": 350,
  "h": 450,
  "type": "image/jpeg",
  "dl": "src_Passport_Photo_350x450.jpg",
  "status": "Under the 50 KB limit, at the exact size requested.",
  "dims": "350 × 450 px, verified",
  "fmt": "JPEG",
  "limit": "Under 50 KB (50,000 bytes)",
  "bytesOk": true
 },
 "preset:signature:fields": {
  "w": "300",
  "h": "100",
  "min": "",
  "max": "30",
  "fmt": "image/jpeg",
  "unit": "px"
 },
 "preset:signature:result": {
  "resultShown": true,
  "error": null,
  "w": 300,
  "h": 100,
  "type": "image/jpeg",
  "dl": "src_Signature_300x100.jpg",
  "status": "Under the 30 KB limit, at the exact size requested.",
  "dims": "300 × 100 px, verified",
  "fmt": "JPEG",
  "limit": "Under 30 KB (30,000 bytes)",
  "bytesOk": true
 },
 "preset:thumb:fields": {
  "w": "240",
  "h": "240",
  "min": "20",
  "max": "50",
  "fmt": "image/jpeg",
  "unit": "px"
 },
 "preset:thumb:result": {
  "resultShown": true,
  "error": null,
  "w": 240,
  "h": 240,
  "type": "image/jpeg",
  "dl": "src_Thumb_Impression_240x240.jpg",
  "status": "Within the 20–50 KB range, at the exact size requested.",
  "dims": "240 × 240 px, verified",
  "fmt": "JPEG",
  "limit": "20–50 KB (20,480 – 50,000 bytes)",
  "bytesOk": true
 },
 "preset:declaration:fields": {
  "w": "800",
  "h": "400",
  "min": "50",
  "max": "100",
  "fmt": "image/jpeg",
  "unit": "px"
 },
 "preset:declaration:result": {
  "resultShown": true,
  "error": null,
  "w": 800,
  "h": 400,
  "type": "image/jpeg",
  "dl": "src_Declaration_800x400.jpg",
  "status": "Within the 50–100 KB range, at the exact size requested.",
  "dims": "800 × 400 px, verified",
  "fmt": "JPEG",
  "limit": "50–100 KB (51,200 – 100,000 bytes)",
  "bytesOk": true
 },
 "preset:avatar:fields": {
  "w": "400",
  "h": "400",
  "min": "",
  "max": "100",
  "fmt": "image/jpeg",
  "unit": "px"
 },
 "preset:avatar:result": {
  "resultShown": true,
  "error": null,
  "w": 400,
  "h": 400,
  "type": "image/jpeg",
  "dl": "src_Avatar_400x400.jpg",
  "status": "Under the 100 KB limit, at the exact size requested.",
  "dims": "400 × 400 px, verified",
  "fmt": "JPEG",
  "limit": "Under 100 KB (100,000 bytes)",
  "bytesOk": true
 },
 "preset:web-banner:fields": {
  "w": "1200",
  "h": "630",
  "min": "",
  "max": "300",
  "fmt": "image/jpeg",
  "unit": "px"
 },
 "preset:web-banner:result": {
  "resultShown": true,
  "error": null,
  "w": 1200,
  "h": 630,
  "type": "image/jpeg",
  "dl": "src_Banner_1200x630.jpg",
  "status": "Under the 300 KB limit, at the exact size requested.",
  "dims": "1200 × 630 px, verified",
  "fmt": "JPEG",
  "limit": "Under 300 KB (300,000 bytes)",
  "bytesOk": true
 },
 "preset:document:fields": {
  "w": "1240",
  "h": "1754",
  "min": "",
  "max": "500",
  "fmt": "image/jpeg",
  "unit": "px"
 },
 "preset:document:result": {
  "resultShown": true,
  "error": null,
  "w": 1240,
  "h": 1754,
  "type": "image/jpeg",
  "dl": "src_Document_1240x1754.jpg",
  "status": "Under the 500 KB limit, at the exact size requested.",
  "dims": "1240 × 1754 px, verified",
  "fmt": "JPEG",
  "limit": "Under 500 KB (500,000 bytes)",
  "bytesOk": true
 },
 "unit:cm:dpiVisible": true,
 "unit:cm:labels": [
  "Width (cm)",
  "Height (cm)"
 ],
 "unit:cm:fields": {
  "w": "3.5",
  "h": "3.0"
 },
 "unit:cm:result": {
  "resultShown": true,
  "error": null,
  "w": 413,
  "h": 350,
  "type": "image/jpeg",
  "dl": "src_Custom_413x350.jpg",
  "status": "Under the 60 KB limit, at the exact size requested.",
  "dims": "413 × 350 px, verified",
  "fmt": "JPEG",
  "limit": "Under 60 KB (60,000 bytes)",
  "bytesOk": true
 },
 "unit:cm:label": "413 × 350 px (3.5 × 2.96 cm at 300 DPI)",
 "unit:in:afterW": "1.17",
 "unit:in:fields": {
  "w": "2",
  "h": "2",
  "dpi": "150"
 },
 "unit:in:result": {
  "resultShown": true,
  "error": null,
  "w": 300,
  "h": 300,
  "type": "image/jpeg",
  "dl": "src_Custom_300x300.jpg",
  "status": "Under the 40 KB limit, at the exact size requested.",
  "dims": "300 × 300 px, verified",
  "fmt": "JPEG",
  "limit": "Under 40 KB (40,000 bytes)",
  "bytesOk": true
 },
 "unit:back:fields": {
  "w": "300",
  "h": "300",
  "dpiVisible": false
 },
 "lock:on:h": "350",
 "lock:off:fields": {
  "w": "300",
  "h": "100"
 },
 "ratio:original": {
  "rot": 0
 },
 "ratio:1:1": {
  "rot": 0
 },
 "ratio:4:3": {
  "rot": 0
 },
 "ratio:16:9": {
  "rot": 0
 },
 "ratio:free": {
  "rot": 0
 },
 "ratio:target": {
  "rot": 0
 },
 "crop:initial": {
  "rot": 0
 },
 "crop:rotR": {
  "rot": 90
 },
 "crop:rotL2": {
  "rot": -90
 },
 "crop:rotBack": {
  "rot": 0
 },
 "crop:zoomIn": {
  "rot": 0
 },
 "crop:zoomOut": {
  "rot": 0
 },
 "crop:reset": {
  "rot": 0
 },
 "crop:rotated:result": {
  "resultShown": true,
  "error": null,
  "w": 400,
  "h": 400,
  "type": "image/jpeg",
  "dl": "src_Avatar_400x400.jpg",
  "status": "Under the 100 KB limit, at the exact size requested.",
  "dims": "400 × 400 px, verified",
  "fmt": "JPEG",
  "limit": "Under 100 KB (100,000 bytes)",
  "bytesOk": true
 },
 "retry:cropVisible": true,
 "retry:thumb:result": {
  "resultShown": true,
  "error": null,
  "w": 240,
  "h": 240,
  "type": "image/jpeg",
  "dl": "src_Thumb_Impression_240x240.jpg",
  "status": "Within the 20–50 KB range, at the exact size requested.",
  "dims": "240 × 240 px, verified",
  "fmt": "JPEG",
  "limit": "20–50 KB (20,480 – 50,000 bytes)",
  "bytesOk": true
 },
 "format:png:5kb": {
  "resultShown": false,
  "error": "PNG needs 322.9 KB at this size. Increase the file limit, reduce dimensions, or choose WebP or JPEG.",
  "bytesOk": true
 },
 "format:png:big": {
  "resultShown": true,
  "error": null,
  "w": 400,
  "h": 400,
  "type": "image/png",
  "dl": "src_Custom_400x400.png",
  "status": "Under the 20000 KB limit, at the exact size requested.",
  "dims": "400 × 400 px, verified",
  "fmt": "PNG",
  "limit": "Under 20000 KB (20,000,000 bytes)",
  "bytesOk": true
 },
 "format:webp:50": {
  "resultShown": true,
  "error": null,
  "w": 400,
  "h": 400,
  "type": "image/webp",
  "dl": "src_Custom_400x400.webp",
  "status": "Under the 50 KB limit, at the exact size requested.",
  "dims": "400 × 400 px, verified",
  "fmt": "WebP",
  "limit": "Under 50 KB (50,000 bytes)",
  "bytesOk": true
 },
 "minmax:30-60": {
  "resultShown": true,
  "error": null,
  "w": 400,
  "h": 400,
  "type": "image/jpeg",
  "dl": "src_Custom_400x400.jpg",
  "status": "Within the 30–60 KB range, at the exact size requested.",
  "dims": "400 × 400 px, verified",
  "fmt": "JPEG",
  "limit": "30–60 KB (30,720 – 60,000 bytes)",
  "bytesOk": true
 },
 "minmax:invalid": {
  "disabled": true,
  "err": "Min file size must be less than max file size."
 },
 "dims:invalid": {
  "disabled": true,
  "err": "Width must be an integer between 20 and 8,000 px."
 },
 "orig:fields": {
  "w": "900",
  "h": "1100"
 },
 "orig:result": {
  "resultShown": true,
  "error": null,
  "w": 900,
  "h": 1100,
  "type": "image/jpeg",
  "dl": "src_Custom_900x1100.jpg",
  "status": "Under the 200 KB limit, at the exact size requested.",
  "dims": "900 × 1100 px, verified",
  "fmt": "JPEG",
  "limit": "Under 200 KB (200,000 bytes)",
  "bytesOk": true
 },
 "annot:crop": {
  "rot": 0
 },
 "annot:result": {
  "resultShown": true,
  "error": null,
  "w": 350,
  "h": 450,
  "type": "image/jpeg",
  "dl": "src_Passport_Photo_Dated_350x450.jpg",
  "status": "Under the 50 KB limit, at the exact size requested.",
  "dims": "350 × 450 px, verified",
  "fmt": "JPEG",
  "limit": "Under 50 KB (50,000 bytes)",
  "bytesOk": true
 },
 "drop:loaded": {
  "name": "dropped.png (900 × 1100 px, 2165.3 KB) Replace Remove"
 },
 "remove:processDisabled": true,
 "invalidType": {
  "err": "doc.txt is a plain text file. This tool needs an image (JPEG, PNG, WebP, GIF, BMP or AVIF); choose a file of that type instead.",
  "hasCropper": false
 }
};
(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE_PATH, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  await ctx.route('**/*', r => /^(http:\/\/127\.|blob:|data:)/.test(r.request().url()) ? r.continue() : r.abort());
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const png = Buffer.from(await page.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 900; c.height = 1100; const x = c.getContext('2d'), d = x.createImageData(900, 1100); let s = 7;
    for (let i = 0; i < d.data.length; i += 4) { s = (s * 1664525 + 1013904223) >>> 0; const px = (i / 4) % 900, py = Math.floor(i / 4 / 900); d.data[i] = (px * 255 / 900) ^ (s >> 28); d.data[i + 1] = (py * 255 / 1100) ^ ((s >> 24) & 15); d.data[i + 2] = ((px + py) & 255) ^ ((s >> 20) & 15); d.data[i + 3] = 255; }
    x.putImageData(d, 0, 0); x.fillStyle = '#fff'; x.beginPath(); x.arc(450, 420, 230, 0, 7); x.fill(); return c.toDataURL('image/png').split(',')[1];
  }), 'base64');
  await page.goto(`${origin}/image-resizer.html`);
  const setSel = (id, v) => page.evaluate(([id, v]) => { const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); el.dispatchEvent(new Event('input', { bubbles: true })); }, [id, v]);
  const setNum = (id, v) => page.evaluate(([id, v]) => { const el = document.getElementById(id); el.value = String(v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }, [id, v]);
  const val = id => page.evaluate(id => document.getElementById(id).value, id);
  const vis = id => page.evaluate(id => { const e = document.getElementById(id); if (!e) return null; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'; }, id);
  const load = async (name = 'src.png') => {
    await page.goto(`${origin}/image-resizer.html`);
    // The home page asks what is being prepared; "Custom size" opens size, limit and format.
    await page.locator('.choice[data-preset="custom"]').click();
    await page.locator('#fileInput').setInputFiles({ name, mimeType: 'image/png', buffer: png });
    await page.waitForFunction(() => document.getElementById('imageToCrop') && document.getElementById('imageToCrop').cropper && !document.getElementById('btnProcess').disabled, null, { timeout: 15000 });
    const toggle = page.locator('.ws-customize');
    if (await toggle.getAttribute('aria-expanded') !== 'true') await toggle.click();
  };
  const crop = () => page.evaluate(() => { const c = document.getElementById('imageToCrop').cropper; const d = c.getData(true); const b = c.getCropBoxData(); const cv = c.getCanvasData(); return { x: d.x, y: d.y, w: d.width, h: d.height, rot: d.rotate, canvasW: Math.round(cv.width), box: [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)] }; });
  const runProc = async name => {
    await page.locator('#btnProcess').click();
    await Promise.race([page.locator('#resultArea').waitFor({ state: 'visible', timeout: 20000 }), page.locator('#processErrorBox').waitFor({ state: 'visible', timeout: 20000 })]);
    const resultShown = await vis('resultArea');
    const out = { resultShown, error: resultShown ? null : (await page.locator('#processErrorBox').textContent()).trim().replace(/\s+/g, ' ') };
    if (resultShown) {
      Object.assign(out, await page.evaluate(async () => {
        const a = document.getElementById('btnDownload'); const blob = await fetch(a.href).then(r => r.blob()); const bm = await createImageBitmap(blob); const buf = new Uint8Array(await blob.arrayBuffer()); let h = 5381; for (const b of buf) h = ((h * 33) ^ b) >>> 0;
        const t = id => (document.getElementById(id) || {}).textContent.trim().replace(/\s+/g, ' ');
        return { w: bm.width, h: bm.height, bytes: blob.size, type: blob.type, hash: h, dl: a.getAttribute('download'), status: t('resultStatus'), dims: t('resultDims'), fmt: t('resultFormat'), fileSize: t('resultFileSize'), limit: t('resultTargetSize') };
      }));
    }
    rec[name] = out;
  };
  const again = async () => { if (await vis('btnCropAgain')) await page.locator('#btnCropAgain').click(); await page.locator('#cropperActiveArea').waitFor({ state: 'visible' }); };

  // 1. presets
  for (const p of ['passport', 'signature', 'thumb', 'declaration', 'avatar', 'web-banner', 'document']) {
    await load(); await setSel('presetSelect', p);
    rec[`preset:${p}:fields`] = { w: await val('customWidth'), h: await val('customHeight'), min: await val('customMinKB'), max: await val('customMaxKB'), fmt: await val('formatSelect'), unit: await val('unitSelect') };
    await runProc(`preset:${p}:result`);
  }
  // 2. units and DPI
  await load(); await setSel('presetSelect', 'custom'); await setSel('unitSelect', 'cm');
  rec['unit:cm:dpiVisible'] = await vis('dpiSelect') || await vis('dpiGroup');
  rec['unit:cm:labels'] = [await page.locator('#customWidthLabel').textContent(), await page.locator('#customHeightLabel').textContent()].map(s => s.trim());
  await setSel('dpiSelect', '300'); await setNum('customWidth', 3.5); await setNum('customMaxKB', 60);
  rec['unit:cm:fields'] = { w: await val('customWidth'), h: await val('customHeight') };
  // The height was not typed: it shows 350 px as 3.0 cm and keeps its 350 px (2.96 cm), not 354.
  await runProc('unit:cm:result');
  rec['unit:cm:label'] = (await page.locator('#resultTargetDims').textContent()).trim();
  await again(); await setSel('unitSelect', 'inch'); await setSel('dpiSelect', '150'); await setNum('customWidth', 2); rec['unit:in:afterW'] = await val('customHeight'); await setNum('customHeight', 2); await setNum('customMaxKB', 40);
  rec['unit:in:fields'] = { w: await val('customWidth'), h: await val('customHeight'), dpi: await val('dpiSelect') };
  await runProc('unit:in:result');
  await again(); await setSel('unitSelect', 'px'); rec['unit:back:fields'] = { w: await val('customWidth'), h: await val('customHeight'), dpiVisible: await vis('dpiSelect') };
  // 3. aspect lock, ratio choices
  await load(); await setSel('presetSelect', 'custom'); await setNum('customWidth', 400);
  rec['lock:on:h'] = await val('customHeight');
  await page.locator('#btnLockAspect').click(); await setNum('customHeight', 100); await setNum('customWidth', 300);
  rec['lock:off:fields'] = { w: await val('customWidth'), h: await val('customHeight') };
  for (const r of ['original', '1:1', '4:3', '16:9', 'free', 'target']) { await setSel('aspectRatioSelect', r); await page.waitForTimeout(150); rec[`ratio:${r}`] = await crop(); }
  // 4. crop controls
  await load(); await setSel('presetSelect', 'avatar'); await page.waitForTimeout(200);
  rec['crop:initial'] = await crop();
  await page.locator('#btnRotateRight').click(); await page.waitForTimeout(150); rec['crop:rotR'] = await crop();
  await page.locator('#btnRotateLeft').click(); await page.locator('#btnRotateLeft').click(); await page.waitForTimeout(150); rec['crop:rotL2'] = await crop();
  await page.locator('#btnRotateRight').click(); await page.waitForTimeout(150); rec['crop:rotBack'] = await crop();
  await page.locator('#btnZoomIn').click(); await page.locator('#btnZoomIn').click(); await page.waitForTimeout(150); rec['crop:zoomIn'] = await crop();
  await page.locator('#btnZoomOut').click(); await page.waitForTimeout(150); rec['crop:zoomOut'] = await crop();
  await page.locator('#btnResetCrop').click(); await page.waitForTimeout(200); rec['crop:reset'] = await crop();
  await page.locator('#btnRotateRight').click(); await page.waitForTimeout(150); await runProc('crop:rotated:result');
  // 5. retry after result, settings change keeps working
  await again(); rec['retry:cropVisible'] = await vis('cropperActiveArea'); await setSel('presetSelect', 'thumb'); await runProc('retry:thumb:result');
  // 6. formats and limits
  await again(); await setSel('presetSelect', 'custom'); await setNum('customMinKB', ''); await setNum('customWidth', 400); await setNum('customHeight', 400);
  await setSel('formatSelect', 'image/png'); await setNum('customMaxKB', 5); await runProc('format:png:5kb');
  await setNum('customMaxKB', 20000); await runProc('format:png:big');
  await again(); await setSel('formatSelect', 'image/webp'); await setNum('customMaxKB', 50); await runProc('format:webp:50');
  await again(); await setSel('formatSelect', 'image/jpeg'); await setNum('customMinKB', 30); await setNum('customMaxKB', 60); await runProc('minmax:30-60');
  await again(); await setNum('customMinKB', 80); await setNum('customMaxKB', 60); rec['minmax:invalid'] = { disabled: await page.locator('#btnProcess').isDisabled(), err: (await page.locator('#sizeError').textContent()).trim() };
  await setNum('customMinKB', ''); await setNum('customWidth', 999999); rec['dims:invalid'] = { disabled: await page.locator('#btnProcess').isDisabled(), err: (await page.locator('#dimError').textContent()).trim() };
  // 7. original size
  await load(); if (await vis('btnOriginalSize')) { await page.locator('#btnOriginalSize').click(); rec['orig:fields'] = { w: await val('customWidth'), h: await val('customHeight') }; await setNum('customMaxKB', 200); await runProc('orig:result'); }
  // 8. annotations
  await load(); await setSel('presetSelect', 'passport');
  await page.evaluate(() => { const e = document.getElementById('addDateCheckbox'); for (let a = e.parentElement; a; a = a.parentElement) if (a.tagName === 'DETAILS') a.open = true; e.checked = true; e.dispatchEvent(new Event('change', { bubbles: true })); const n = document.getElementById('candidateNameInput'); n.value = 'Sumit Test'; n.dispatchEvent(new Event('input', { bubbles: true })); });
  rec['annot:crop'] = await crop(); await runProc('annot:result');
  // 9. drag and drop
  await page.goto(`${origin}/image-resizer.html`);
  await page.evaluate(async b64 => {
    const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0)); const file = new File([bin], 'dropped.png', { type: 'image/png' });
    const dt = new DataTransfer(); dt.items.add(file);
    const zone = document.getElementById('dropZone') || document.querySelector('.dropzone');
    for (const t of ['dragenter', 'dragover', 'drop']) zone.dispatchEvent(new DragEvent(t, { dataTransfer: dt, bubbles: true, cancelable: true }));
  }, png.toString('base64'));
  await page.waitForFunction(() => document.getElementById('imageToCrop') && document.getElementById('imageToCrop').cropper, null, { timeout: 15000 });
  rec['drop:loaded'] = { name: (await page.locator('#fileName, #fileInfoName, #fileInfoBox').first().textContent()).trim().replace(/\s+/g, ' ').slice(0, 60), crop: await crop() };
  // 10. remove and replace, invalid file
  await page.locator('#btnRemoveFile').click(); rec['remove:processDisabled'] = await page.locator('#btnProcess').isDisabled();
  await page.locator('#fileInput').setInputFiles({ name: 'doc.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') });
  await page.waitForTimeout(500); rec['invalidType'] = { err: await vis('processErrorBox') ? (await page.locator('#processErrorBox').textContent()).trim().replace(/\s+/g, ' ') : null, hasCropper: await page.evaluate(() => !!(document.getElementById('imageToCrop') && document.getElementById('imageToCrop').cropper)) };

  // 11. One customer after another: the printed name and date never carry over, and every
  //     download is named after its own photo.
  let extra = 0;
  const yes = (c, m) => { assert(c, m); extra++; };
  // A new file is checked before it replaces the one on screen, so wait for its name too.
  const ready = name => page.waitForFunction(n => document.getElementById('imageToCrop').cropper && !document.getElementById('btnProcess').disabled && (!n || document.getElementById('fileInfoText').textContent.includes(n)), name, { timeout: 15000 });
  const strip = () => page.evaluate(() => ({ on: document.getElementById('addDateCheckbox').checked, name: document.getElementById('candidateNameInput').value }));
  const setStrip = name => page.evaluate(n => {
    const e = document.getElementById('addDateCheckbox'); for (let a = e.parentElement; a; a = a.parentElement) if (a.tagName === 'DETAILS') a.open = true;
    e.checked = true; e.dispatchEvent(new Event('change', { bubbles: true }));
    const i = document.getElementById('candidateNameInput'); i.value = n; i.dispatchEvent(new Event('input', { bubbles: true }));
  }, name);
  await page.goto(`${origin}/passport-photo-resizer.html`);
  await setStrip('Asha Verma');
  await page.locator('#fileInput').setInputFiles({ name: 'asha-photo.png', mimeType: 'image/png', buffer: png });
  await ready();
  yes(JSON.stringify(await strip()) === '{"on":true,"name":"Asha Verma"}', 'a name typed before the first photo is kept for it');
  await runProc('customer1');
  yes(rec.customer1.dl === 'asha-photo_Passport_Photo_Dated_350x450.jpg', `the download is named after the photo (${rec.customer1.dl})`);
  await page.locator('#btnRemoveFile').click();
  yes(JSON.stringify(await strip()) === '{"on":false,"name":""}', 'Remove switches the name strip off and clears the name');
  yes(/printed name and date were cleared/.test(await page.locator('#taskNotification').textContent()), 'a notice says the printed name and date were cleared');
  await page.locator('#fileInput').setInputFiles({ name: 'ravi-photo.png', mimeType: 'image/png', buffer: png });
  await ready('ravi-photo.png');
  await runProc('customer2');
  yes(rec.customer2.dl === 'ravi-photo_Passport_Photo_350x450.jpg', `the next customer's photo has no strip and its own name (${rec.customer2.dl})`);
  await again(); await setStrip('Ravi Kumar');
  await page.locator('#fileInput').setInputFiles({ name: 'priya-photo.png', mimeType: 'image/png', buffer: png });   // Replace
  await ready('priya-photo.png');
  yes(JSON.stringify(await strip()) === '{"on":false,"name":""}', 'Replace also clears the strip, so a new photo never carries the last name');
  // "Try a sample" keeps the requirement chosen and does not enlarge the sample.
  for (const [preset, kind] of [['passport', 'photo'], ['signature', 'signature'], ['document', 'document']]) {
    await page.goto(`${origin}/image-resizer.html`);
    await page.locator(`.choice[data-preset="${preset}"]`).click();
    const spec = (await page.locator('#reqSummarySpec').textContent()).trim();
    await page.locator('#btnTryExample').click();
    await ready();
    yes((await page.locator('#reqSummarySpec').textContent()).trim() === spec && await val('presetSelect') === preset, `the sample keeps the ${preset} requirement (${spec})`);
    await runProc(`sample:${preset}`);
    const s = rec[`sample:${preset}`];
    const src = await page.evaluate(() => document.getElementById('fileInfoText').textContent);
    const m = /\((\d+) × (\d+) px/.exec(src);
    yes(s.resultShown && s.dl.startsWith(`ApplyReady_sample_${kind}_`) && m && Number(m[1]) >= s.w && Number(m[2]) >= s.h, `the ${kind} sample is at least as large as the ${s.w} × ${s.h} px result (${src.trim()})`);
  }
  // 12. Files the single-image tools must refuse, the same way the batch tools do: a truncated JPEG
  //     (an <img> shows it with the missing part blank), a PNG that declares 400 megapixels (refused
  //     from its header, before decoding), a 1 × 1 px picture, and an SVG.
  const made = await page.evaluate(async () => {
    const enc = (c, type, q) => new Promise(r => c.toBlob(b => b.arrayBuffer().then(a => r(Array.from(new Uint8Array(a)))), type, q));
    const canvas = (w, h, paint) => { const c = document.createElement('canvas'); c.width = w; c.height = h; paint(c.getContext('2d'), w, h); return c; };
    const photo = canvas(640, 480, (x, w, h) => { const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#2a6f97'); g.addColorStop(1, '#f4a261'); x.fillStyle = g; x.fillRect(0, 0, w, h); x.fillStyle = '#fff'; x.beginPath(); x.arc(320, 200, 120, 0, 7); x.fill(); });
    const jpeg = await enc(photo, 'image/jpeg', 0.9);
    const small = await enc(canvas(24, 24, x => { x.fillStyle = '#334455'; x.fillRect(0, 0, 24, 24); }), 'image/png');
    // 20 × 20 px (the smallest picture accepted) and 40 × 40 px: crops that are not whole pixels.
    const small20 = await enc(canvas(20, 20, x => { x.fillStyle = '#334455'; x.fillRect(0, 0, 20, 20); }), 'image/png');
    const small40 = await enc(canvas(40, 40, x => { x.fillStyle = '#334455'; x.fillRect(0, 0, 40, 40); }), 'image/png');
    const tiny = await enc(canvas(1, 1, x => { x.fillStyle = '#334455'; x.fillRect(0, 0, 1, 1); }), 'image/png');
    // A signature photographed indoors: grey paper getting darker to the right (a shadow), navy ink,
    // and one faint pencil-like stroke that must survive the default settings.
    const sig = canvas(900, 360, (x, w, h) => {
      const g = x.createLinearGradient(0, 0, w, 0); g.addColorStop(0, 'rgb(192,188,178)'); g.addColorStop(1, 'rgb(138,135,128)');
      x.fillStyle = g; x.fillRect(0, 0, w, h);
      const d = x.getImageData(0, 0, w, h); let s = 11;
      for (let i = 0; i < d.data.length; i += 4) { s = (s * 1664525 + 1013904223) >>> 0; const n = ((s >>> 24) % 13) - 6; d.data[i] += n; d.data[i + 1] += n; d.data[i + 2] += n; }
      x.putImageData(d, 0, 0);
      x.strokeStyle = 'rgb(30,40,120)'; x.lineWidth = 7; x.lineCap = 'round';
      x.beginPath(); x.moveTo(80, 220); x.bezierCurveTo(200, 60, 300, 300, 420, 140); x.bezierCurveTo(520, 40, 640, 280, 820, 120); x.stroke();
      x.strokeStyle = 'rgba(60,60,90,0.35)'; x.lineWidth = 3;
      x.beginPath(); x.moveTo(100, 300); x.lineTo(400, 300); x.stroke();
    });
    return { jpeg, truncated: jpeg.slice(0, Math.floor(jpeg.length / 3)), small, small20, small40, tiny, sig: await enc(sig, 'image/jpeg', 0.92) };
  });
  const buf = a => Buffer.from(a);
  // A PNG whose header says 20000 × 20000 px; nothing past the header is needed to refuse it.
  const bomb = Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 13]), Buffer.from('IHDR'), Buffer.from([0, 0, 0x4E, 0x20, 0, 0, 0x4E, 0x20, 8, 0, 0, 0, 0, 0, 0, 0, 0]), Buffer.from([0, 0, 0, 0]), Buffer.from('IEND'), Buffer.from([0xAE, 0x42, 0x60, 0x82])]);
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" onload="alert(1)"><rect width="100" height="100"/></svg>');
  const refusedBy = {
    truncated: [{ name: 'cut.jpg', mimeType: 'image/jpeg', buffer: buf(made.truncated) }, /cut\.jpg could not be opened\. It may be damaged or only partly downloaded/],
    bomb: [{ name: 'huge.png', mimeType: 'image/png', buffer: bomb }, /huge\.png is 400 megapixels \(20000 × 20000 px\), more than the 50 MP/],
    tiny: [{ name: 'dot.png', mimeType: 'image/png', buffer: buf(made.tiny) }, /dot\.png is only 1 × 1 px, too small/],
    svg: [{ name: 'logo.svg', mimeType: 'image/svg+xml', buffer: svg }, /logo\.svg is a plain text file/]
  };
  const procError = () => page.evaluate(() => { const b = document.getElementById('processErrorBox'); return b.classList.contains('hidden') ? '' : b.textContent.trim().replace(/\s+/g, ' '); });
  for (const [kind, [file, want]] of Object.entries(refusedBy)) {
    await page.goto(`${origin}/passport-photo-resizer.html`);
    await page.locator('#fileInput').setInputFiles(file);
    await page.waitForFunction(() => !document.getElementById('processErrorBox').classList.contains('hidden'), null, { timeout: 15000 });
    const text = await procError();
    yes(want.test(text) && !/drawImage|canvas element/.test(text), `resizer refuses the ${kind} file with a plain message (${text})`);
    yes(!(await page.evaluate(() => !!document.getElementById('imageToCrop').cropper)) && await page.locator('#btnProcess').isDisabled(), `resizer: nothing can be processed from the ${kind} file`);
  }
  // A refused file leaves the photo already on screen usable.
  await page.locator('#fileInput').setInputFiles({ name: 'good.jpg', mimeType: 'image/jpeg', buffer: buf(made.jpeg) });
  await ready('good.jpg');
  await page.locator('#fileInput').setInputFiles(refusedBy.truncated[0]);
  await page.waitForFunction(() => !document.getElementById('processErrorBox').classList.contains('hidden'), null, { timeout: 15000 });
  yes(await page.evaluate(() => document.getElementById('fileInfoText').textContent.includes('good.jpg')) && await page.locator('#btnProcess').isEnabled(), 'resizer: after a refused file the previous photo is still there and can be processed');

  // A very small picture is enlarged only with a warning, and fills the output without white bars,
  // also when the selection is not a whole number of pixels (20 × 20 px for a 35:45 photo is a
  // 15.6 × 20 px selection; 40 × 40 px for a 3:1 signature is 40 × 13.3 px).
  for (const [pageName, file, bytes, w, h] of [['passport-photo-resizer', 'small.png', made.small, 350, 450], ['passport-photo-resizer', 'small20.png', made.small20, 350, 450], ['signature-resizer', 'small40.png', made.small40, 300, 100]]) {
    await page.goto(`${origin}/${pageName}.html`);
    await page.locator('#fileInput').setInputFiles({ name: file, mimeType: 'image/png', buffer: buf(bytes) });
    await ready(file);
    await runProc(file + ':result');
    const smallOut = await page.evaluate(async () => {
      const bm = await createImageBitmap(await fetch(document.getElementById('btnDownload').href).then(r => r.blob()));
      const c = document.createElement('canvas'); c.width = bm.width; c.height = bm.height; const x = c.getContext('2d'); x.drawImage(bm, 0, 0);
      const edge = (sx, sy, w, h) => { const d = x.getImageData(sx, sy, w, h).data; let white = 0; for (let i = 0; i < d.length; i += 4) if (d[i] > 240 && d[i + 1] > 240 && d[i + 2] > 240) white++; return white; };
      const w = document.getElementById('resultWarning');
      return { whiteEdges: edge(0, 0, 2, bm.height) + edge(bm.width - 2, 0, 2, bm.height) + edge(0, 0, bm.width, 2) + edge(0, bm.height - 2, bm.width, 2), warning: w.classList.contains('hidden') ? '' : w.textContent.trim().replace(/\s+/g, ' ') };
    });
    const out = rec[file + ':result'];
    yes(out.w === w && out.h === h, `${file} still gives the requested ${w} × ${h} px (${out.w} × ${out.h})`);
    yes(new RegExp(`enlarged [\\d.]+ times to make ${w} × ${h} px\\. It will look blurred or blocky`).test(smallOut.warning), `the result says ${file} was enlarged (${smallOut.warning})`);
    yes(smallOut.whiteEdges === 0, `${file}: the enlarged picture fills the output with no white bars (${smallOut.whiteEdges} white edge pixels)`);
  }
  await page.goto(`${origin}/passport-photo-resizer.html`);
  await page.locator('#fileInput').setInputFiles({ name: 'good.jpg', mimeType: 'image/jpeg', buffer: buf(made.jpeg) });
  await ready('good.jpg');
  await runProc('noenlarge:result');
  yes(await page.locator('#resultWarning').isHidden(), 'a photo larger than the output shows no enlargement warning');

  // 13. Custom size: a form's width and height typed one after the other give exactly that size.
  await page.goto(`${origin}/image-resizer.html`);
  await page.locator('.choice[data-preset="custom"]').click();
  await page.locator('#fileInput').setInputFiles({ name: 'form.jpg', mimeType: 'image/jpeg', buffer: buf(made.jpeg) });
  await ready('form.jpg');
  if (await page.locator('.ws-customize').getAttribute('aria-expanded') !== 'true') await page.locator('.ws-customize').click();
  yes(await page.locator('#btnLockAspect').getAttribute('aria-pressed') === 'true', 'the aspect ratio lock starts on');
  const typeInto = async (id, text) => { await page.locator('#' + id).click({ clickCount: 3 }); await page.keyboard.type(text); };
  await typeInto('customWidth', '300');
  yes(await val('customHeight') === '300', `typing only the width fills in the height at the locked ratio (${await val('customHeight')})`);
  await typeInto('customHeight', '200');
  yes(await val('customWidth') === '300' && await val('customHeight') === '200' && /^300 × 200 px/.test(await page.locator('#reqSummarySpec').textContent()), 'with the lock on, typing 300 then 200 keeps both numbers (the second never changes the first)');
  await runProc('typed:result');
  yes(rec['typed:result'].w === 300 && rec['typed:result'].h === 200, `the file is 300 × 200 px (${rec['typed:result'].w} × ${rec['typed:result'].h})`);
  await again();
  await page.locator('#btnLockAspect').click();
  yes(await page.locator('#btnLockAspect').getAttribute('aria-pressed') === 'false', 'the lock can be turned off');
  await page.locator('#btnLockAspect').click();
  await typeInto('customWidth', '600');
  yes(await val('customHeight') === '400', `with the lock on, the height follows the 3:2 shape (${await val('customHeight')})`);
  // In centimetres the lock works with decimals, and changing the unit keeps the size.
  await setSel('dpiSelect', '300'); await setSel('unitSelect', 'cm');
  yes(await val('customWidth') === '5.1' && await val('customHeight') === '3.4', `600 × 400 px at 300 DPI shows as 5.1 × 3.4 cm (${await val('customWidth')} × ${await val('customHeight')})`);
  await typeInto('customWidth', '6');
  yes(await val('customHeight') === '4', `in cm the lock keeps the shape (${await val('customHeight')})`);
  await setSel('unitSelect', 'inch');
  yes(await val('customWidth') === '2.36' && await val('customHeight') === '1.57', `cm to inches converts the size (${await val('customWidth')} × ${await val('customHeight')})`);
  await setSel('unitSelect', 'px');
  // 6 × 4 cm at 300 DPI is 708.7 × 472.4 px: converted from the exact size, not from the rounded 2.36 × 1.57 in.
  yes(await val('customWidth') === '709' && await val('customHeight') === '472', `inches back to pixels converts the size (${await val('customWidth')} × ${await val('customHeight')})`);

  // 14. A size in cm or inches is recorded in the file at the chosen DPI (JPEG JFIF density, PNG pHYs).
  await page.locator('#btnLockAspect').click();
  await setSel('unitSelect', 'cm'); await setSel('dpiSelect', '300');
  await typeInto('customWidth', '3.5'); await typeInto('customHeight', '4.5'); await setNum('customMaxKB', 100);
  await runProc('cm:dpi');
  const head = () => page.evaluate(async () => Array.from(new Uint8Array(await (await fetch(document.getElementById('btnDownload').href).then(r => r.blob())).slice(0, 64).arrayBuffer())));
  let h = await head();
  yes(rec['cm:dpi'].w === 413 && rec['cm:dpi'].h === 531 && h[13] === 1 && ((h[14] << 8) | h[15]) === 300 && ((h[16] << 8) | h[17]) === 300, `3.5 × 4.5 cm at 300 DPI: 413 × 531 px with 300 DPI in the JPEG header (unit ${h[13]}, ${(h[14] << 8) | h[15]} DPI)`);
  yes(/3\.5 × 4\.5 cm at 300 DPI/.test(await page.locator('#resultTargetDims').textContent()), 'the result names the size in cm and the DPI');
  await again(); await setSel('formatSelect', 'image/png'); await setNum('customMaxKB', 2000);
  await runProc('cm:png');
  h = await head();
  const phys = Buffer.from(h).indexOf('pHYs');
  const ppm = phys > 0 ? Buffer.from(h).readUInt32BE(phys + 4) : 0;
  yes(rec['cm:png'].resultShown && phys === 37 && ppm === 11811 && h[phys + 12] === 1, `PNG: a pHYs chunk after IHDR records 300 DPI (${ppm} px per metre)`);
  await again(); await setSel('formatSelect', 'image/jpeg'); await setSel('unitSelect', 'px'); await setNum('customMaxKB', 100);
  await runProc('px:nodpi');
  h = await head();
  yes(h[13] === 0, 'a size in pixels records no DPI');
  // Changing the unit never drifts: 3.5 × 4.5 cm shows as 1.38 × 1.77 in but stays 413 × 531 px,
  // in the file made in inches and back in pixels and centimetres.
  await again();
  await setSel('unitSelect', 'cm'); await setSel('dpiSelect', '300');
  await typeInto('customWidth', '3.5'); await typeInto('customHeight', '4.5');
  await setSel('unitSelect', 'inch');
  yes(await val('customWidth') === '1.38' && await val('customHeight') === '1.77', `3.5 × 4.5 cm shows as 1.38 × 1.77 in (${await val('customWidth')} × ${await val('customHeight')})`);
  await runProc('inch:exact');
  yes(rec['inch:exact'].w === 413 && rec['inch:exact'].h === 531 && /1\.38 × 1\.77 in at 300 DPI/.test(await page.locator('#resultTargetDims').textContent()), `made in inches after cm, the file is still 413 × 531 px (${rec['inch:exact'].w} × ${rec['inch:exact'].h})`);
  await again();
  await setSel('unitSelect', 'px');
  yes(await val('customWidth') === '413' && await val('customHeight') === '531', `cm → in → px keeps 413 × 531 px (${await val('customWidth')} × ${await val('customHeight')})`);
  await setSel('unitSelect', 'cm');
  yes(await val('customWidth') === '3.5' && await val('customHeight') === '4.5', `and back in cm it is 3.5 × 4.5 again (${await val('customWidth')} × ${await val('customHeight')})`);
  // A PNG's DPI chunk adds 21 bytes; that room is kept under the limit. The PNG encoder is made to give
  // a file exactly 21 bytes, then 10 bytes, under a 2,000 KB limit.
  await setSel('formatSelect', 'image/png'); await setNum('customMaxKB', 2000);
  await page.evaluate(() => {
    const crc32 = bytes => { let c = -1; for (const b of bytes) { c ^= b; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); } return (c ^ -1) >>> 0; };
    const toBlob = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (done, type, quality) {
      toBlob.call(this, async blob => {
        if (!blob || type !== 'image/png' || !window.__padPngTo) return done(blob);
        const bytes = new Uint8Array(await blob.arrayBuffer());
        const len = window.__padPngTo - bytes.length - 12;
        if (len < 8) return done(blob);
        const chunk = new Uint8Array(12 + len), view = new DataView(chunk.buffer);
        view.setUint32(0, len); chunk.set([0x74, 0x45, 0x58, 0x74], 4); chunk.set([0x43, 0x6F, 0x6D, 0x6D, 0x65, 0x6E, 0x74, 0], 8); chunk.fill(0x20, 16, 8 + len);
        view.setUint32(8 + len, crc32(chunk.subarray(4, 8 + len)));
        done(new Blob([bytes.subarray(0, bytes.length - 12), chunk, bytes.subarray(bytes.length - 12)], { type: 'image/png' }));
      }, type, quality);
    };
    window.__padPngTo = 2000 * 1000 - 21;
  });
  await runProc('png:dpiRoom');
  yes(rec['png:dpiRoom'].resultShown && rec['png:dpiRoom'].bytes === 2000 * 1000, `a PNG 21 bytes under the limit, with its DPI chunk, is exactly at the limit (${rec['png:dpiRoom'].bytes} bytes, ${rec['png:dpiRoom'].error})`);
  await again();
  await page.evaluate(() => { window.__padPngTo = 2000 * 1000 - 10; });
  await runProc('png:dpiOver');
  yes(!rec['png:dpiOver'].resultShown && /PNG needs 2000\.1 KB at this size\. Increase the file limit/.test(rec['png:dpiOver'].error) && !/exceeds limit/.test(rec['png:dpiOver'].error), `a PNG that would go over the limit with its DPI chunk is explained, not failed on the final check (${rec['png:dpiOver'].error})`);
  await page.evaluate(() => { window.__padPngTo = 0; });

  // 15. Size and limit from the address: shared and bookmarked links open with their numbers.
  await page.goto(`${origin}/resize-image-to-kb-limit.html?targetKB=15&width=300&height=400`);
  yes(await val('customWidth') === '300' && await val('customHeight') === '400' && await val('customMaxKB') === '15' && /^300 × 400 px · under 15 KB/.test(await page.locator('#reqSummarySpec').textContent()), `?targetKB=15&width=300&height=400 is applied (${await page.locator('#reqSummarySpec').textContent()})`);
  await page.locator('#fileInput').setInputFiles({ name: 'link.jpg', mimeType: 'image/jpeg', buffer: buf(made.jpeg) });
  await ready('link.jpg');
  await runProc('url:result');
  yes(rec['url:result'].w === 300 && rec['url:result'].h === 400 && rec['url:result'].bytes <= 15 * 1000, `the file follows the link (${rec['url:result'].w} × ${rec['url:result'].h}, ${rec['url:result'].bytes} bytes)`);
  await page.goto(`${origin}/resize-image-to-20kb.html?targetKB=12`);
  yes(await val('customMaxKB') === '12' && await val('customWidth') === '350', 'a limit in the link replaces the page preset limit and keeps its size');
  await page.goto(`${origin}/resize-image-to-kb-limit.html?width=abc&targetKB=-5`);
  yes(await val('customWidth') === '350' && await val('customMaxKB') === '50', 'numbers that are not whole numbers are ignored');

  // 16. Keyboard: after a photo is chosen from the hidden drop zone, focus moves to the crop area.
  await page.goto(`${origin}/image-resizer.html`);
  await page.locator('.choice[data-preset="passport"]').click();
  // The file chooser is watched for before the key is pressed: started together, the key could open
  // the chooser before Playwright was ready to catch it (an intermittent 30 s timeout).
  const chooserOpened = page.waitForEvent('filechooser');
  await page.locator('#btnBrowse').focus();
  await page.keyboard.press('Enter');
  const chooser = await chooserOpened;
  await chooser.setFiles({ name: 'kb.jpg', mimeType: 'image/jpeg', buffer: buf(made.jpeg) });
  await ready('kb.jpg');
  await page.waitForFunction(() => document.activeElement && document.activeElement.classList.contains('cropper-container-wrapper'), null, { timeout: 5000 }).catch(() => {});
  yes(await page.evaluate(() => document.activeElement && document.activeElement.classList.contains('cropper-container-wrapper')), `focus moves to the crop area, not the page body (${await page.evaluate(() => document.activeElement.tagName + '.' + document.activeElement.className)})`);

  // 17. Signature cleaner: grey, shadowed paper turns white at the default setting; "Paper whiteness"
  //     works the way its hint says (higher is whiter); the faint stroke survives; blue ink stays blue.
  await page.goto(`${origin}/signature-cleaner.html`);
  await page.locator('#cleanerFileInput').setInputFiles({ name: 'sig.jpg', mimeType: 'image/jpeg', buffer: buf(made.sig) });
  await page.waitForFunction(() => (document.getElementById('btnCleanerDownload').getAttribute('href') || '').startsWith('blob:'), null, { timeout: 15000 });
  yes(await page.evaluate(() => document.activeElement && document.activeElement.id === 'btnCleanerReplace'), 'cleaner: focus moves to Replace when the drop zone hides');
  const cleaned = async (whiteness, ink) => {
    const before = await page.getAttribute('#btnCleanerDownload', 'href');
    await page.evaluate(([w, ink]) => {
      const s = document.getElementById('inkColorSelect'); s.value = ink; s.dispatchEvent(new Event('change', { bubbles: true }));
      const r = document.getElementById('whitenessInput'); r.value = String(w); r.dispatchEvent(new Event('input', { bubbles: true }));
    }, [whiteness, ink]);
    await page.waitForFunction(h => document.getElementById('btnCleanerDownload').getAttribute('href') !== h, before, { timeout: 10000 }).catch(() => {});
    return page.evaluate(() => {
      const c = document.getElementById('cleanerCanvas'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; const W = c.width;
      const lum = i => 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      let paper = 0, n = 0; for (let y = 5; y < 40; y++) for (let x = 0; x < W; x++) { paper += lum((y * W + x) * 4); n++; }
      let faint = 255; for (let y = 296; y < 305; y++) for (let x = 130; x < 370; x++) faint = Math.min(faint, lum((y * W + x) * 4));
      let white = 0; for (let i = 0; i < d.length; i += 4) if (d[i] === 255 && d[i + 1] === 255 && d[i + 2] === 255) white++;
      const ink = [0, 0, 0]; let k = 0; for (let i = 0; i < d.length; i += 4) if (lum(i) < 120) { ink[0] += d[i]; ink[1] += d[i + 1]; ink[2] += d[i + 2]; k++; }
      return { paper: paper / n, faint, white: white / (d.length / 4), ink: ink.map(v => Math.round(v / Math.max(1, k))) };
    });
  };
  const w20 = await cleaned(20, 'original'), w70 = await cleaned(70, 'original'), w100 = await cleaned(100, 'original');
  yes(w70.paper >= 250 && w100.paper >= 250, `grey, shadowed paper is white at the default and at the top (${w70.paper.toFixed(1)}, ${w100.paper.toFixed(1)})`);
  yes(w20.white <= w70.white && w70.white <= w100.white && w20.paper <= w100.paper, `raising Paper whiteness makes more of the paper white (${[w20, w70, w100].map(r => (r.white * 100).toFixed(1) + '%')})`);
  yes(w70.faint < 215, `the faint stroke is kept at the default setting (darkest ${Math.round(w70.faint)})`);
  yes(w70.ink[2] > w70.ink[0] + 30 && w70.ink[2] > w70.ink[1] + 25, `"Keep original ink" keeps blue ink blue (${w70.ink})`);
  const black = await cleaned(70, 'black');
  yes(black.ink[2] - black.ink[0] < 5 && Math.abs(w70.ink[2] - black.ink[2]) > 30, `"Pure black" differs from the original ink (${black.ink} vs ${w70.ink})`);
  for (const kind of ['truncated', 'bomb']) {
    await page.goto(`${origin}/signature-cleaner.html`);
    await page.locator('#cleanerFileInput').setInputFiles(refusedBy[kind][0]);
    await page.locator('#taskNotification.is-visible').waitFor({ timeout: 10000 });
    yes(refusedBy[kind][1].test(await page.locator('#taskNotification').innerText()) && await page.locator('#cleanerPreviewArea').isHidden(), `cleaner refuses the ${kind} file and shows nothing to download`);
  }

  // 18. Passport print sheet: damaged and oversized files refused; a copy count that does not fit is explained.
  for (const kind of ['truncated', 'bomb']) {
    await page.goto(`${origin}/passport-photo-print.html`);
    await page.locator('#printFileInput').setInputFiles(refusedBy[kind][0]);
    await page.locator('#taskNotification.is-visible').waitFor({ timeout: 10000 });
    yes(refusedBy[kind][1].test(await page.locator('#taskNotification').innerText()) && await page.locator('#printPreviewArea').isHidden(), `print sheet refuses the ${kind} file`);
  }
  await page.goto(`${origin}/passport-photo-print.html`);
  await page.locator('#printFileInput').setInputFiles({ name: 'face.jpg', mimeType: 'image/jpeg', buffer: buf(made.jpeg) });
  await page.waitForFunction(() => /^blob:/.test(document.getElementById('btnDownloadPrintJpg').getAttribute('href') || ''), null, { timeout: 15000 });
  const hint = () => page.evaluate(() => { const p = document.getElementById('photoCountSelectHint'); return { text: p.textContent.trim(), warn: p.classList.contains('is-warning'), live: p.getAttribute('aria-live'), described: document.getElementById('photoCountSelect').getAttribute('aria-describedby') }; });
  let hc = await hint();
  yes(hc.text === '6 photos of this size fit on 4 × 6 inch paper.' && !hc.warn && hc.live === 'polite' && hc.described === 'photoCountSelectHint', `Copies says how many fit (${hc.text})`);
  await page.locator('#photoCountSelect').selectOption('8');
  hc = await hint();
  yes(/^Only 6 photos of this size fit on 4 × 6 inch paper, so the sheet has 6, not 8\. Choose an A4 sheet for more/.test(hc.text) && hc.warn, `8 copies on 4 × 6 paper is explained next to the control (${hc.text})`);
  yes(/^6 Photos/.test(await page.locator('#statPrintCount').textContent()), 'the sheet itself has the 6 that fit');
  await page.locator('#paperSizeSelect').selectOption('a4');
  hc = await hint();
  yes(/fit on an A4 sheet\.$/.test(hc.text) && !hc.warn, `on A4 the 8 copies fit and the warning goes (${hc.text})`);
  await page.waitForFunction(() => /^blob:/.test(document.getElementById('btnDownloadPrintJpg').getAttribute('href') || ''), null, { timeout: 15000 });
  const sheetHead = await page.evaluate(async () => Array.from(new Uint8Array(await (await fetch(document.getElementById('btnDownloadPrintJpg').href).then(r => r.blob())).slice(0, 20).arrayBuffer())));
  yes(sheetHead[13] === 1 && ((sheetHead[14] << 8) | sheetHead[15]) === 300, 'the print sheet JPEG still records 300 DPI');

  // 19. Image to PDF identifies files by content and opens them like the other tools.
  await page.goto(`${origin}/image-to-pdf.html`);
  await page.locator('#imgPdfFileInput').setInputFiles([refusedBy.svg[0], { name: 'page.jpg', mimeType: 'image/jpeg', buffer: buf(made.jpeg) }, refusedBy.truncated[0], refusedBy.bomb[0], { name: 'page2.png', mimeType: 'image/png', buffer: buf(made.small) }]);
  await page.waitForFunction(() => document.querySelectorAll('.page-row').length === 2 && document.getElementById('imgPdfSkipped'), null, { timeout: 15000 });
  const i2p = await page.evaluate(() => ({ names: [...document.querySelectorAll('.page-row__name')].map(n => n.textContent), notice: document.getElementById('imgPdfSkipped').textContent.replace(/\s+/g, ' '), thumbs: [...document.querySelectorAll('.page-row__thumb')].map(i => i.getAttribute('src').slice(0, 5)), attrs: [...document.querySelectorAll('.page-row__thumb')].map(i => i.getAttributeNames().join(' ') + ' alt=' + JSON.stringify(i.getAttribute('alt'))) }));
  yes(i2p.names.join() === 'page.jpg,page2.png', `only the real, complete images become pages, in order (${i2p.names})`);
  yes(/3 files were not added/.test(i2p.notice) && /logo\.svg is a plain text file/.test(i2p.notice) && /cut\.jpg could not be opened/.test(i2p.notice) && /huge\.png is 400 megapixels/.test(i2p.notice), `the notice gives each file's reason (${i2p.notice})`);
  // Each reason says what to choose; no second, narrower list of types is added after them.
  yes(!/Choose JPG, PNG or WebP/.test(i2p.notice) && (i2p.notice.match(/choose a file of that type instead/g) || []).length === 1, `the notice does not contradict the reasons with another list of types (${i2p.notice})`);
  yes(i2p.thumbs.every(s => s === 'blob:'), 'page thumbnails use object URLs, not copies of the file in the page');
  yes(i2p.attrs.every(a => a === 'class src alt style alt=""'), `page thumbnails have well-formed markup with an empty alt (${i2p.attrs.join('; ')})`);
  await page.locator('#btnConvertToPdf').click();
  await page.locator('#pdfResultArea:not(.hidden)').waitFor({ timeout: 20000 });
  yes(/^2 Pages/.test(await page.locator('#statPdfPages').textContent()), 'the PDF has the two good pages');
  // One refused file on its own: the notification and the notice give its reason once, without a second list of types.
  await page.goto(`${origin}/image-to-pdf.html`);
  await page.locator('#imgPdfFileInput').setInputFiles(refusedBy.svg[0]);
  await page.waitForSelector('#imgPdfSkipped', { timeout: 10000 });
  const onlySvg = (await page.locator('#imgPdfSkipped').textContent()).replace(/\s+/g, ' ').trim();
  yes(/^logo\.svg is a plain text file\. This tool needs an image \(JPEG, PNG, WebP, GIF, BMP or AVIF\); choose a file of that type instead\.$/.test(onlySvg), `a single refused file is explained once (${onlySvg})`);

  // 20. Compress PDF refuses an oversized or damaged photo when it is chosen, not after Start.
  for (const kind of ['truncated', 'bomb']) {
    await page.goto(`${origin}/compress-pdf.html`);
    await page.locator('#compressFileInput').setInputFiles(refusedBy[kind][0]);
    await page.waitForSelector('#compressError:not([hidden])', { timeout: 10000 });
    yes(refusedBy[kind][1].test(await page.locator('#compressError').textContent()) && await page.locator('#btnStartCompress').isDisabled(), `compress PDF refuses the ${kind} photo when it is chosen`);
  }

  // 21. setDensity on its own: JFIF density, and a PNG pHYs chunk with a correct CRC that replaces an old one.
  {
    const Ops = require(path.join(repo, 'js/lib/image-ops.js'));
    const zlib = require('node:zlib');
    const jfif = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0, 16, 0x4A, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xFF, 0xD9]);
    const j = Buffer.from(await (await Ops.setDensity(new Blob([jfif], { type: 'image/jpeg' }), 200)).arrayBuffer());
    yes(j.length === jfif.length && j[13] === 1 && j.readUInt16BE(14) === 200 && j.readUInt16BE(16) === 200, 'JPEG: density set to 200 DPI, length unchanged');
    const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(td)); return Buffer.concat([len, td, crc]); };
    const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(10, 0); ihdr.writeUInt32BE(10, 4); ihdr[8] = 8; ihdr[9] = 2;
    const oldPhys = Buffer.alloc(9); oldPhys.writeUInt32BE(2835, 0); oldPhys.writeUInt32BE(2835, 4); oldPhys[8] = 1;
    const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), chunk('IHDR', ihdr), chunk('pHYs', oldPhys), chunk('IDAT', zlib.deflateSync(Buffer.alloc(10 * 31))), chunk('IEND', Buffer.alloc(0))]);
    const out = Buffer.from(await (await Ops.setDensity(new Blob([png], { type: 'image/png' }), 300)).arrayBuffer());
    const chunks = []; for (let i = 8; i < out.length;) { const len = out.readUInt32BE(i); const type = out.toString('latin1', i + 4, i + 8); chunks.push({ type, data: out.subarray(i + 8, i + 8 + len), crcOk: out.readUInt32BE(i + 8 + len) === zlib.crc32(out.subarray(i + 4, i + 8 + len)) }); i += 12 + len; }
    yes(chunks.map(c => c.type).join() === 'IHDR,pHYs,IDAT,IEND' && chunks.every(c => c.crcOk), `PNG: one pHYs after IHDR, every CRC valid (${chunks.map(c => c.type)})`);
    yes(chunks[1].data.readUInt32BE(0) === 11811 && chunks[1].data.readUInt32BE(4) === 11811 && chunks[1].data[8] === 1, 'PNG: 300 DPI is 11811 pixels per metre');
    const webp = new Blob([Buffer.from('RIFF\0\0\0\0WEBPVP8 ')], { type: 'image/webp' });
    yes(await Ops.setDensity(webp, 300) === webp, 'other types are returned unchanged');
  }
  await browser.close(); server.close();
  assert.deepEqual(errors, [], 'page errors during the image workflow');
  let checks = 0;
  for (const [key, want] of Object.entries(EXPECTED)) {
    const got = rec[key];
    assert(got !== undefined, key + ': scenario did not run');
    if (want && typeof want === 'object' && !Array.isArray(want)) {
      for (const [field, value] of Object.entries(want)) {
        if (field === 'bytesOk') { if (got.resultShown) assert(got.bytes > 0, key + ': empty output'); checks++; continue; }
        assert.deepEqual(got[field], value, key + '.' + field + ': ' + JSON.stringify(got[field]) + ' should be ' + JSON.stringify(value)); checks++;
      }
    } else { assert.deepEqual(got, want, key + ': ' + JSON.stringify(got) + ' should be ' + JSON.stringify(want)); checks++; }
  }
  const same = (a, b, name) => { assert(Math.abs(a.x - b.x) <= 1 && Math.abs(a.y - b.y) <= 1 && Math.abs(a.w - b.w) <= 1 && Math.abs(a.h - b.h) <= 1, name + ': crop ' + JSON.stringify(a) + ' vs ' + JSON.stringify(b)); checks++; };
  same(rec['crop:reset'], rec['crop:initial'], 'Reset restores the initial crop');
  same(rec['crop:rotBack'], rec['crop:initial'], 'Rotating right, left twice and right again returns to the start');
  assert(rec['crop:zoomIn'].w < rec['crop:initial'].w && rec['crop:zoomOut'].w > rec['crop:zoomIn'].w, 'Zoom in shrinks the source area and zoom out grows it'); checks++;
  for (const [k, v] of Object.entries(rec)) {
    if (!v || !v.resultShown) continue;
    const inside = /\(([^)]*)bytes\)/.exec(v.limit);
    const nums = inside ? inside[1].match(/[\d,]+/g).map(n => Number(n.replace(/,/g, ''))) : [];
    assert(nums.length, k + ': limit text has no byte range: ' + v.limit);
    assert(v.bytes <= nums[nums.length - 1] && v.bytes >= (nums.length > 1 ? nums[0] : 0), k + ': ' + v.bytes + ' bytes is outside ' + v.limit); checks++;
  }
  console.log('✓ Image workflow: presets, units, DPI, aspect lock, crop ratios, rotate, zoom, reset, retry, formats, limits, original size, annotations, drop, invalid files, one customer after another, samples, damaged/oversized/tiny files in every single-image tool, recorded DPI, link parameters, focus, signature paper and ink, print copies, image to PDF intake (' + (checks + extra) + ' checks)');

})().catch(e => { console.error(e); process.exit(1); });
