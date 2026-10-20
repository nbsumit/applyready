/* Image workflow regression test: drives the resizer through presets, units, DPI, aspect lock, crop ratios,
   rotate, zoom, reset, retry, formats, size limits, original size, annotations, drag and drop and invalid files,
   and checks every measured result against the values the engine produced before the interface was rebuilt.
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
  "dl": "Passport_Photo_350x450.jpg",
  "status": "Under the 50 KB limit, at the exact size requested.",
  "dims": "350 × 450 px, verified",
  "fmt": "JPEG",
  "limit": "Under 50 KB (51,200 bytes)",
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
  "dl": "Signature_300x100.jpg",
  "status": "Under the 30 KB limit, at the exact size requested.",
  "dims": "300 × 100 px, verified",
  "fmt": "JPEG",
  "limit": "Under 30 KB (30,720 bytes)",
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
  "dl": "Thumb_Impression_240x240.jpg",
  "status": "Within the 20–50 KB range, at the exact size requested.",
  "dims": "240 × 240 px, verified",
  "fmt": "JPEG",
  "limit": "20–50 KB (20,480 – 51,200 bytes)",
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
  "dl": "Declaration_800x400.jpg",
  "status": "Within the 50–100 KB range, at the exact size requested.",
  "dims": "800 × 400 px, verified",
  "fmt": "JPEG",
  "limit": "50–100 KB (51,200 – 102,400 bytes)",
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
  "dl": "Avatar_400x400.jpg",
  "status": "Under the 100 KB limit, at the exact size requested.",
  "dims": "400 × 400 px, verified",
  "fmt": "JPEG",
  "limit": "Under 100 KB (102,400 bytes)",
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
  "dl": "Banner_1200x630.jpg",
  "status": "Under the 300 KB limit, at the exact size requested.",
  "dims": "1200 × 630 px, verified",
  "fmt": "JPEG",
  "limit": "Under 300 KB (307,200 bytes)",
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
  "dl": "Document_1240x1754.jpg",
  "status": "Under the 500 KB limit, at the exact size requested.",
  "dims": "1240 × 1754 px, verified",
  "fmt": "JPEG",
  "limit": "Under 500 KB (512,000 bytes)",
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
  "h": 354,
  "type": "image/jpeg",
  "dl": "Custom_413x354.jpg",
  "status": "Under the 60 KB limit, at the exact size requested.",
  "dims": "413 × 354 px, verified",
  "fmt": "JPEG",
  "limit": "Under 60 KB (61,440 bytes)",
  "bytesOk": true
 },
 "unit:in:afterW": "0.01",
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
  "dl": "Custom_300x300.jpg",
  "status": "Under the 40 KB limit, at the exact size requested.",
  "dims": "300 × 300 px, verified",
  "fmt": "JPEG",
  "limit": "Under 40 KB (40,960 bytes)",
  "bytesOk": true
 },
 "unit:back:fields": {
  "w": "2",
  "h": "2",
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
  "dl": "Avatar_400x400.jpg",
  "status": "Under the 100 KB limit, at the exact size requested.",
  "dims": "400 × 400 px, verified",
  "fmt": "JPEG",
  "limit": "Under 100 KB (102,400 bytes)",
  "bytesOk": true
 },
 "retry:cropVisible": true,
 "retry:thumb:result": {
  "resultShown": true,
  "error": null,
  "w": 240,
  "h": 240,
  "type": "image/jpeg",
  "dl": "Thumb_Impression_240x240.jpg",
  "status": "Within the 20–50 KB range, at the exact size requested.",
  "dims": "240 × 240 px, verified",
  "fmt": "JPEG",
  "limit": "20–50 KB (20,480 – 51,200 bytes)",
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
  "dl": "Custom_400x400.png",
  "status": "Under the 20000 KB limit, at the exact size requested.",
  "dims": "400 × 400 px, verified",
  "fmt": "PNG",
  "limit": "Under 20000 KB (20,480,000 bytes)",
  "bytesOk": true
 },
 "format:webp:50": {
  "resultShown": true,
  "error": null,
  "w": 400,
  "h": 400,
  "type": "image/webp",
  "dl": "Custom_400x400.webp",
  "status": "Under the 50 KB limit, at the exact size requested.",
  "dims": "400 × 400 px, verified",
  "fmt": "WebP",
  "limit": "Under 50 KB (51,200 bytes)",
  "bytesOk": true
 },
 "minmax:30-60": {
  "resultShown": true,
  "error": null,
  "w": 400,
  "h": 400,
  "type": "image/jpeg",
  "dl": "Custom_400x400.jpg",
  "status": "Within the 30–60 KB range, at the exact size requested.",
  "dims": "400 × 400 px, verified",
  "fmt": "JPEG",
  "limit": "30–60 KB (30,720 – 61,440 bytes)",
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
  "dl": "Custom_900x1100.jpg",
  "status": "Under the 200 KB limit, at the exact size requested.",
  "dims": "900 × 1100 px, verified",
  "fmt": "JPEG",
  "limit": "Under 200 KB (204,800 bytes)",
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
  "dl": "Passport_Photo_Dated_350x450.jpg",
  "status": "Under the 50 KB limit, at the exact size requested.",
  "dims": "350 × 450 px, verified",
  "fmt": "JPEG",
  "limit": "Under 50 KB (51,200 bytes)",
  "bytesOk": true
 },
 "drop:loaded": {
  "name": "dropped.png (900 × 1100 px, 2165.3 KB) Replace Remove"
 },
 "remove:processDisabled": true,
 "invalidType": {
  "err": "Unsupported format. Please select a valid JPG, PNG, or WebP image.",
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
  await page.goto(`${origin}/index.html`);
  const setSel = (id, v) => page.evaluate(([id, v]) => { const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); el.dispatchEvent(new Event('input', { bubbles: true })); }, [id, v]);
  const setNum = (id, v) => page.evaluate(([id, v]) => { const el = document.getElementById(id); el.value = String(v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }, [id, v]);
  const val = id => page.evaluate(id => document.getElementById(id).value, id);
  const vis = id => page.evaluate(id => { const e = document.getElementById(id); if (!e) return null; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'; }, id);
  const load = async (name = 'src.png') => {
    await page.goto(`${origin}/index.html`);
    await page.locator('#fileInput').setInputFiles({ name, mimeType: 'image/png', buffer: png });
    await page.waitForFunction(() => document.getElementById('imageToCrop') && document.getElementById('imageToCrop').cropper && !document.getElementById('btnProcess').disabled, null, { timeout: 15000 });
    // Size, limit and format sit behind one disclosure; open it the way a person would.
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
  await runProc('unit:cm:result');
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
  await page.goto(`${origin}/index.html`);
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
  console.log('✓ Image workflow: presets, units, DPI, aspect lock, crop ratios, rotate, zoom, reset, retry, formats, limits, original size, annotations, drop, invalid files (' + checks + ' checks)');

})().catch(e => { console.error(e); process.exit(1); });
