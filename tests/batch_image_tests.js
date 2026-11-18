/* Batch image engine, image compressor and converter, passport and signature resizer pages, and
   the image privacy fixes, tested end to end with real files. Outputs are checked independently of
   the page: ImageMagick `identify` for pixel size, `unzip -t` for the ZIP, Python with PIL for
   metadata, orientation and pixel colours.

   Run: BROWSER_EXECUTABLE_PATH=/path/to/chrome node tests/batch_image_tests.js */
'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { chromium } = require('playwright');
const AxeBuilder = require('@axe-core/playwright').default;

const root = path.resolve(__dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ar-batch-'));
let checks = 0;
const ok = (c, m) => { assert(c, m); checks++; };
const sh = (cmd, args, opts) => {
  const r = spawnSync(cmd, args, Object.assign({ encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }, opts));
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')} failed: ${r.stderr || r.stdout}`);
  return r.stdout;
};
const py = (code, ...args) => sh('python3', ['-I', '-c', code, ...args]);
const identify = file => { const [w, h] = sh('identify', ['-format', '%w %h', file + '[0]']).trim().split(' ').map(Number); return { w, h }; };

/* ------------------------------------------------------------------ 1. Unit checks in Node */
{
  const Ops = require('../js/lib/image-ops.js');
  const p = (w, h, o) => { const r = Ops.plan(w, h, o); return [r.width, r.height]; };
  assert.deepEqual(p(4000, 3000, { resize: 'fit', width: 1200, height: 1200 }), [1200, 900]); checks++;
  assert.deepEqual(p(4000, 3000, { resize: 'fit', height: 600 }), [800, 600], 'fit with only a height'); checks++;
  assert.deepEqual(p(4000, 3000, { resize: 'fit', width: 1000, height: '' }), [1000, 750], 'fit with only a width'); checks++;
  assert.deepEqual(p(300, 200, { resize: 'fit', width: 1200, height: 1200 }), [300, 200], 'fit never enlarges'); checks++;
  assert.deepEqual(p(4000, 3000, { resize: 'fill', width: 350, height: 450 }), [350, 450]); checks++;
  const fill = Ops.plan(4000, 3000, { resize: 'fill', width: 350, height: 450 });
  ok(Math.abs(fill.src.sw / fill.src.sh - 350 / 450) < 1e-6 && Math.abs(fill.src.sx - (4000 - fill.src.sw) / 2) < 1e-6, 'fill crops the centre at the target shape');
  const pad = Ops.plan(1000, 200, { resize: 'pad', width: 300, height: 100 });
  ok(pad.width === 300 && pad.height === 100 && pad.dst.dw === 300 && pad.dst.dh === 60 && pad.dst.dy === 20, 'pad fits inside and centres');
  assert.deepEqual(p(1000, 500, { resize: 'scale', scale: 25 }), [250, 125]); checks++;
  assert.deepEqual(p(30000, 1000, { resize: 'none' }), [12000, 400], 'oversized sides shrink proportionally, never distort'); checks++;
  ok(Ops.outputMime('keep', 'image/gif') === 'image/jpeg' && Ops.outputMime('keep', 'image/png') === 'image/png' && Ops.outputMime('image/webp', 'image/png') === 'image/webp', 'output format rules');

  // Headers from real files made by PIL
  py(`
import sys
from PIL import Image
d = sys.argv[1]
im = Image.new('RGB', (640, 480), (10, 120, 200))
ex = Image.Exif(); ex[0x0112] = 6
im.save(d + '/h6.jpg', quality=90, exif=ex.tobytes())
im.save(d + '/h.png'); im.save(d + '/h.gif'); im.save(d + '/h.bmp')
im.save(d + '/h.webp', quality=80); im.save(d + '/hl.webp', lossless=True)
`, tmp);
  const head = f => Ops.readHeader(new Uint8Array(fs.readFileSync(path.join(tmp, f))));
  assert.deepEqual(head('h6.jpg'), { width: 480, height: 640, orientation: 6, format: 'jpeg' }, 'JPEG with EXIF orientation 6 reads as portrait'); checks++;
  for (const f of ['h.png', 'h.gif', 'h.bmp', 'h.webp', 'hl.webp']) { const h = head(f); ok(h && h.width === 640 && h.height === 480, `${f}: header size ${JSON.stringify(h)}`); }
  ok(Ops.readHeader(new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0, 4, 1, 2])) === null && Ops.readHeader(new Uint8Array(0)) === null, 'truncated or empty input reads as unknown, without throwing');

  // The queue: cancel keeps finished results, retry runs the rest, removing frees a late result
  const Batch = require('../js/lib/batch.js');
  (async () => {
    const released = [];
    const q = Batch.createQueue({ concurrency: 2, release: r => released.push(r), process: (item, { signal }) => new Promise((res, rej) => {
      const t = setTimeout(() => res({ v: item.name }), item.name === 'slow' ? 200 : 5);
      signal.addEventListener('abort', () => { clearTimeout(t); rej(new DOMException('x', 'AbortError')); });
    }) });
    q.add(['a', 'b', 'slow', 'c', 'd'].map(name => ({ name, size: 1 })));
    const run = q.start();
    await new Promise(r => setTimeout(r, 40));
    q.cancel();
    const s = await run;
    ok(s.done >= 2 && s.cancelled >= 1 && s.queued === 0 && s.processing === 0, `cancel: ${JSON.stringify(s)}`);
    q.retry();
    const s2 = await q.start();
    ok(s2.done === 5 && s2.cancelled === 0, 'retry finishes the cancelled items');
    q.requeueAll(item => item.name === 'a');
    ok(q.summary().queued === 1 && released.length === 1, 'filtered requeue releases only the chosen result');
  })().catch(e => { console.error(e); process.exit(1); });

  // The page script and the markup generator agree on the presets
  const ws = require('../scripts/lib/batch-workspace.js');
  const src = fs.readFileSync(path.join(root, 'js/batch-image.js'), 'utf8');
  const table = Function(`return ${src.match(/const PRESETS = (\{[\s\S]*?\n {2}\});/)[1]}`)();
  for (const [k, v] of Object.entries(ws.PRESETS)) {
    if (k === 'custom') { ok(table.custom === null, 'custom preset'); continue; }
    for (const f of ['resize', 'width', 'height', 'format', 'maxKB', 'quality', 'allowShrink']) ok(String(table[k][f]) === String(v[f]), `preset ${k}.${f} matches the generator`);
  }
}

/* ------------------------------------------------------------------ 2. Fixtures */
const FIX = path.join(tmp, 'fix');
fs.mkdirSync(FIX);
py(`
import sys, random, struct
from PIL import Image, ImageDraw
d = sys.argv[1]
random.seed(7)
def photo(w, h, seed):
    random.seed(seed)
    im = Image.new('RGB', (w, h), (random.randint(0, 255), random.randint(0, 255), random.randint(0, 255)))
    dr = ImageDraw.Draw(im)
    for _ in range(300):
        x, y = random.randint(0, w), random.randint(0, h)
        dr.ellipse([x, y, x + random.randint(4, w // 3), y + random.randint(4, h // 3)], fill=(random.randint(0, 255), random.randint(0, 255), random.randint(0, 255)))
    noise = Image.effect_noise((w, h), 40).convert('RGB')
    return Image.blend(im, noise, 0.25)
sizes = [(2400, 1800), (1800, 2400), (1200, 900), (640, 480), (3000, 2000), (900, 1200), (500, 500), (2000, 3000)]
for i in range(40):
    w, h = sizes[i % len(sizes)]
    photo(w, h, i).save(f'{d}/photo_{i:02d}.jpg', quality=90)
for i in range(3):
    im = Image.new('RGBA', (800, 600), (0, 0, 0, 0))
    ImageDraw.Draw(im).ellipse([100, 100, 700, 500], fill=(30, 90 + i * 40, 200, 255))
    im.save(f'{d}/logo_{i}.png')
photo(1000, 800, 99).save(f'{d}/scan.webp', quality=85)
# Displayed as portrait 600 x 800: top half red, bottom half blue. Stored sideways with orientation 6 and GPS.
disp = Image.new('RGB', (600, 800), (220, 0, 0)); disp.paste((0, 0, 220), (0, 400, 600, 800))
stored = disp.rotate(90, expand=True)
ex = Image.Exif(); ex[0x0112] = 6; ex[0x010F] = 'TestCam'; ex[0x0110] = 'Model X'
gps = {1: 'N', 2: (28.0, 36.0, 50.0), 3: 'E', 4: (77.0, 12.0, 30.0)}
ex[0x8825] = gps
stored.save(f'{d}/exif_gps.jpg', quality=92, exif=ex.tobytes())
photo(1600, 1200, 201).save(f'{d}/dupe_a.jpg', quality=90)
photo(1400, 1400, 202).save(f'{d}/dupe_b.jpg', quality=90)
open(f'{d}/broken.jpg', 'wb').write(b'\\xff\\xd8\\xff\\xe0\\x00\\x10JFIF\\x00' + bytes(random.getrandbits(8) for _ in range(5000)))
open(f'{d}/iphone.heic', 'wb').write(struct.pack('>I', 24) + b'ftypheic' + b'\\x00' * 4 + b'mif1heic' + b'\\x00' * 200)
open(f'{d}/notes.txt', 'w').write('Not an image, just some notes.\\n' * 10)
Image.new('L', (10000, 6000), 200).save(f'{d}/huge_60mp.png')
im = Image.new('RGBA', (400, 300), (0, 0, 0, 0)); ImageDraw.Draw(im).rectangle([100, 75, 300, 225], fill=(0, 160, 0, 255)); im.save(f'{d}/transparent.png')
photo(1200, 1600, 300).save(f'{d}/portrait.jpg', quality=92)
sig = Image.new('RGB', (1500, 500), (250, 250, 248)); dr = ImageDraw.Draw(sig)
for k in range(12): dr.line([(150 + k * 90, 380 - (k % 3) * 80), (240 + k * 90, 140 + (k % 4) * 60)], fill=(10, 20, 90), width=9)
sig.save(f'{d}/signature.jpg', quality=92)
photo(2400, 1600, 400).convert('RGB').save(f'{d}/photo_as_png.png')
`, FIX);
const fix = f => path.join(FIX, f);
const payload = (file, name, mimeType) => ({ name: name || path.basename(file), mimeType: mimeType || 'application/octet-stream', buffer: fs.readFileSync(file) });

/* ------------------------------------------------------------------ 3. Browser */
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon' };
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const file = path.resolve(root, '.' + (pathname.endsWith('/') ? pathname + 'index.html' : pathname));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (e, d) => { res.writeHead(e ? 404 : 200, { 'Content-Type': e ? 'text/html' : MIME[path.extname(file)] || 'application/octet-stream' }); res.end(e ? '' : d); });
});

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const exe = process.env.BROWSER_EXECUTABLE_PATH;
  const browser = await chromium.launch({ headless: true, ...(exe ? { executablePath: exe } : {}), args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const errors = [];
  async function open(url, opts = {}) {
    const context = await browser.newContext(Object.assign({ viewport: { width: 1280, height: 900 }, acceptDownloads: true }, opts));
    await context.route('**/*', r => (/^(http:\/\/127\.|blob:|data:)/.test(r.request().url()) ? r.continue() : r.abort()));
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(`${url}: ${e.message}`));
    page.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errors.push(`${url}: console ${m.text()}`); });
    await page.goto(origin + '/' + url);
    return { context, page };
  }
  const setValue = (page, id, value) => page.evaluate(([id, value]) => {
    const e = document.getElementById(id);
    if (e.type === 'checkbox') e.checked = value; else e.value = value;
    e.dispatchEvent(new Event('input', { bubbles: true }));
    e.dispatchEvent(new Event('change', { bubbles: true }));
    return new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  }, [id, value]);
  const summary = page => page.evaluate(() => window.ApplyReadyBatchImage.summary());
  const waitIdle = (page, timeout = 180000) => page.waitForFunction(() => { const s = window.ApplyReadyBatchImage.summary(); return !s.running && s.queued === 0 && s.processing === 0; }, null, { timeout, polling: 100 });
  const saveDownload = async (page, click, name) => {
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), click()]);
    const file = path.join(tmp, name || dl.suggestedFilename());
    await dl.saveAs(file);
    return { file, suggested: dl.suggestedFilename() };
  };
  const noOverflow = page => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  const axe = async (page, label) => {
    for (const theme of ['light', 'dark']) {
      await page.evaluate(t => document.documentElement.setAttribute('data-theme', t), theme);
      await page.waitForTimeout(400);
      const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
      ok(r.violations.length === 0, `${label} (${theme}): axe ${r.violations.map(v => `${v.id}: ${v.nodes.map(n => n.target.join(' ')).slice(0, 3).join(', ')}`).join('; ')}`);
    }
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
  };

  /* ---------- 3a. Batch processor: 50 files, passport preset, cancel midway, retry, downloads */
  {
    const { context, page } = await open('batch-image.html');
    ok(await page.locator('#batchDrop').isVisible() && !(await page.locator('#btnBatchStart').isVisible()), 'empty: the drop zone is the only strong action');
    // A timer that measures how long the main thread is ever blocked.
    await page.evaluate(() => { window.__maxGap = 0; let last = performance.now(); setInterval(() => { const now = performance.now(); window.__maxGap = Math.max(window.__maxGap, now - last); last = now; }, 50); });

    const files = [];
    for (let i = 0; i < 40; i++) files.push(payload(fix(`photo_${String(i).padStart(2, '0')}.jpg`), null, 'image/jpeg'));
    for (let i = 0; i < 3; i++) files.push(payload(fix(`logo_${i}.png`), null, 'image/png'));
    files.push(payload(fix('scan.webp'), null, 'image/webp'));
    files.push(payload(fix('exif_gps.jpg'), null, 'image/jpeg'));
    files.push(payload(fix('dupe_a.jpg'), 'photo.jpg', 'image/jpeg'), payload(fix('dupe_b.jpg'), 'photo.jpg', 'image/jpeg'));
    files.push(payload(fix('broken.jpg'), null, 'image/jpeg'));
    files.push(payload(fix('iphone.heic'), null, 'image/heic'));
    files.push(payload(fix('notes.txt'), 'notes.jpg', 'image/jpeg'));   // wrong extension: content decides
    ok(files.length === 50, 'fifty files offered');
    await page.setInputFiles('#batchDropInput', files);
    await page.waitForFunction(() => document.querySelectorAll('#batchList .file-row').length === 48);
    const errText = (await page.locator('#batchError').textContent()).replace(/\s+/g, ' ');
    ok(await page.locator('#batchError').isVisible() && /2 files were not added/.test(errText), `rejections listed: ${errText}`);
    ok(/iphone\.heic is an HEIC photo/.test(errText) && /Most Compatible/.test(errText), 'HEIC refused with the iPhone tip');
    ok(/notes\.jpg is a plain text file/.test(errText), 'a text file named .jpg refused by content');
    ok(/needs an image \(JPEG, PNG, WebP, GIF, BMP or AVIF\)/.test(errText), 'the refusal names every accepted image type, as the drop zone does');
    ok(await page.locator('#batchError').getAttribute('role') === 'alert', 'rejections are announced as an alert');
    ok(/48/.test(await page.locator('#batchCounts').textContent()), 'counts show 48 images');
    await page.waitForFunction(() => document.querySelectorAll('#batchList .file-row__thumb img').length >= 3, null, { timeout: 15000 });
    ok(/2400 × 1800 px/.test(await page.locator('#batchList .file-row').first().textContent()), 'original pixel size shown from the header');
    ok(/600 × 800 px/.test(await page.locator('.file-row', { hasText: 'exif_gps.jpg' }).textContent()), 'EXIF orientation applied to the listed size');

    await setValue(page, 'bPreset', 'passport');
    ok(await page.inputValue('#bWidth') === '350' && await page.inputValue('#bHeight') === '450' && await page.inputValue('#bMaxKB') === '50' && await page.inputValue('#bResize') === 'fill', 'passport preset fills the settings');
    ok(/Process 48 images/.test(await page.locator('#btnBatchStart').textContent()), 'start button names the count');
    // Invalid value: start is disabled and the error is under the field
    await setValue(page, 'bWidth', '5');
    await page.waitForFunction(() => document.getElementById('btnBatchStart').disabled, null, { timeout: 3000 }).catch(() => {});
    ok(await page.locator('#btnBatchStart').isDisabled() && await page.locator('#bWidthError').isVisible() && await page.inputValue('#bPreset') === 'custom', 'invalid width blocks start, shows the error, preset becomes custom');
    await setValue(page, 'bPreset', 'passport');
    await page.waitForFunction(() => !document.getElementById('btnBatchStart').disabled, null, { timeout: 3000 }).catch(() => {});
    ok(await page.locator('#btnBatchStart').isEnabled(), 'preset restores valid settings');

    const gapBeforeStart = await page.evaluate(() => { const g = window.__maxGap; window.__maxGap = 0; return g; });
    // (Adding is dominated by the test harness pushing 50 files into the page, so only processing is timed.)
    void gapBeforeStart;
    await page.click('#btnBatchStart');
    await page.waitForFunction(() => window.ApplyReadyBatchImage.summary().done >= 4, null, { timeout: 60000, polling: 50 });
    ok(await page.locator('#batchProgress').isVisible() && /finished/.test(await page.locator('#batchProgressText').textContent()), 'progress panel while running');
    ok(Number(await page.locator('#batchProgressMeter').getAttribute('aria-valuenow')) > 0, 'progress bar advances');
    await page.click('#btnBatchCancel');
    await waitIdle(page);
    let s = await summary(page);
    ok(s.done >= 4 && s.cancelled > 0 && s.done + s.cancelled + s.error === 48, `after cancel: ${JSON.stringify(s)}`);
    const keptBefore = s.done;
    ok(await page.locator('.file-row[data-status="cancelled"]').count() === s.cancelled && /Cancelled/.test(await page.locator('.file-row[data-status="cancelled"]').first().textContent()), 'cancelled rows say so in words');
    ok(await page.locator('#btnBatchRetry').isVisible(), 'retry offered after cancel');
    await page.click('#btnBatchRetry');
    await waitIdle(page);
    s = await summary(page);
    ok(s.done === 47 && s.error === 1 && s.cancelled === 0, `after retry: ${JSON.stringify(s)}`);
    ok(s.done >= keptBefore, 'finished results were kept through cancel and retry');
    const broken = page.locator('.file-row', { hasText: 'broken.jpg' });
    ok(await broken.getAttribute('data-status') === 'error' && /could not be opened/.test(await broken.textContent()), 'corrupt file fails with a plain reason');
    const gap = await page.evaluate(() => window.__maxGap);
    ok(gap < 500, `the page stayed responsive while processing (longest main-thread gap ${Math.round(gap)} ms)`);
    ok(await page.evaluate(() => window.ApplyReadyBatchImage.usesWorkers()), 'processing ran in Web Workers');
    ok(/47 of 48 images ready/.test(await page.locator('#batchVerdictTitle').textContent()), 'verdict counts the result');

    // One download
    const first = await saveDownload(page, () => page.locator('.file-row[data-status="done"] [data-action="download"]').first().click(), 'single.jpg');
    const d1 = identify(first.file);
    ok(d1.w === 350 && d1.h === 450 && fs.statSync(first.file).size <= 50 * 1024, `single download is 350 × 450 under 50 KB (${JSON.stringify(d1)}, ${fs.statSync(first.file).size})`);
    ok(first.suggested === 'photo_00.jpg', `single download keeps the name (${first.suggested})`);

    // ZIP of everything
    const zip = await saveDownload(page, () => page.click('#btnBatchZip'), 'all.zip');
    ok(/No errors detected in compressed data/.test(sh('unzip', ['-t', zip.file])), 'unzip -t reports no errors');
    const out = path.join(tmp, 'zip-out');
    sh('unzip', ['-q', '-o', zip.file, '-d', out]);
    const names = fs.readdirSync(out).sort();
    ok(names.length === 47, `47 files in the ZIP (${names.length})`);
    ok(names.includes('photo.jpg') && names.includes('photo (2).jpg'), 'duplicate names made unique');
    ok(names.includes('logo_0.jpg') && names.includes('scan.jpg'), 'PNG and WebP saved as JPEG with the new extension');
    for (const n of names) {
      const f = path.join(out, n);
      const d = identify(f);
      ok(d.w === 350 && d.h === 450, `${n}: 350 × 450 (got ${d.w} × ${d.h})`);
      ok(fs.statSync(f).size <= 50 * 1024, `${n}: under 50 KB (${fs.statSync(f).size})`);
    }
    const meta = JSON.parse(py(`
import sys, json
from PIL import Image
im = Image.open(sys.argv[1]); ex = im.getexif()
px = im.convert('RGB')
print(json.dumps({'exif': len(ex), 'gps': 0x8825 in ex, 'top': px.getpixel((175, 20)), 'bottom': px.getpixel((175, 430)), 'fmt': im.format}))
`, path.join(out, 'exif_gps.jpg')));
    ok(meta.exif === 0 && !meta.gps, `EXIF and GPS removed (${JSON.stringify(meta)})`);
    ok(meta.top[0] > 150 && meta.top[2] < 80 && meta.bottom[2] > 150 && meta.bottom[0] < 80, `EXIF orientation applied: red on top, blue below (${JSON.stringify(meta)})`);
    ok(meta.fmt === 'JPEG', 'output is JPEG');

    // Settings changed after processing: results are marked stale and can be processed again
    await setValue(page, 'bMaxKB', '30');
    await page.waitForFunction(() => !document.getElementById('batchStale').classList.contains('hidden'), null, { timeout: 3000 }).catch(() => {});
    ok(await page.locator('#batchStale').isVisible() && /47 finished images still use the old settings/.test(await page.locator('#batchStaleText').textContent()), 'stale results flagged');
    ok(await page.locator('.file-row.is-stale').count() === 47, 'stale rows marked');
    await setValue(page, 'bNaming', 'sequence');
    ok(await page.locator('.file-row.is-stale').count() === 47, 'renaming alone does not make results stale');
    await page.click('#btnBatchRerun');
    await waitIdle(page);
    s = await summary(page);
    ok(s.done === 47 && !(await page.locator('#batchStale').isVisible()), `processed again: ${JSON.stringify(s)}`);
    const sizes = await page.evaluate(() => window.ApplyReadyBatchImage.items.filter(i => i.result).map(i => i.result.bytes));
    ok(sizes.every(b => b <= 30 * 1024), 'new limit applied to every result');
    const seqNames = await page.evaluate(() => [...window.ApplyReadyBatchImage.outputNames().values()]);
    ok(seqNames[0] === 'image-001.jpg' && seqNames.every(n => /^image-\d{3}\.jpg$/.test(n)), `numbered names (${seqNames.slice(0, 3)})`);

    // Remove one row, then Clear all (asks first: these results were not downloaded)
    const before = await page.locator('#batchList .file-row').count();
    await page.locator('.file-row', { hasText: 'broken.jpg' }).locator('[data-action="remove"]').click();
    ok(await page.locator('#batchList .file-row').count() === before - 1, 'remove takes one row out');
    ok(await page.evaluate(() => document.activeElement && document.activeElement.dataset.action === 'remove'), 'focus moves to the next row after removing');
    const thumbs = await page.evaluate(() => [...document.querySelectorAll('#batchList img')].map(i => i.src));
    await page.click('#btnBatchClear');
    await page.waitForSelector('.dialog--confirm');
    ok(/have not been downloaded/.test(await page.locator('.dialog--confirm').textContent()), 'clear all warns about undownloaded results');
    await page.click('.dialog--confirm [data-act="cancel"]');
    ok(await page.locator('#batchList .file-row').count() === before - 1, 'cancelling the dialog keeps everything');
    await page.click('#btnBatchClear');
    await page.click('.dialog--confirm [data-act="ok"]');
    await page.waitForFunction(() => document.querySelectorAll('#batchList .file-row').length === 0);
    await page.waitForFunction(() => document.getElementById('batchApp').dataset.state === 'empty', null, { timeout: 3000 }).catch(() => {});
    ok(await page.locator('#batchDrop').isVisible() && await page.evaluate(() => document.getElementById('batchApp').dataset.state) === 'empty', 'cleared: back to the empty state');
    const revoked = await page.evaluate(async urls => { const res = await Promise.all(urls.map(u => fetch(u).then(() => false, () => true))); return res.every(Boolean); }, thumbs);
    ok(thumbs.length > 0 && revoked, 'thumbnail object URLs released on clear');
    await context.close();
  }

  /* ---------- 3b. Batch processor: phone width, signature preset, axe on results, unload guard */
  {
    const { context, page } = await open('batch-image.html', { viewport: { width: 320, height: 720 }, hasTouch: true, isMobile: true });
    ok(!(await page.locator('#batchDrop .dropzone__drag').isVisible()) && await page.locator('#batchDrop [data-browse]').isVisible(), 'touch screen: no "Drag them here" line, only the Choose button');
    await setValue(page, 'bPreset', 'signature');
    await page.setInputFiles('#batchDropInput', [fix('signature.jpg'), fix('transparent.png'), fix('portrait.jpg')]);
    await page.click('#btnBatchStart');
    await waitIdle(page);
    ok((await summary(page)).done === 3, 'signature preset: all done');
    await page.waitForTimeout(800);
    const zipLabels = await page.evaluate(() => Array.from(document.querySelectorAll('button')).filter(b => b.getClientRects().length && /Download all 3 as ZIP/.test(b.textContent)).length);
    ok(zipLabels === 1, `one "Download all 3 as ZIP" button on screen, not two (${zipLabels})`);
    const zipSpot = await page.evaluate(() => { const r = document.getElementById('btnBatchZip').getBoundingClientRect(); const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { top: r.top, bottom: r.bottom, hit: hit && hit.closest('#btnBatchZip') !== null, vh: innerHeight }; });
    ok(zipSpot.hit && zipSpot.top >= 56 && zipSpot.bottom <= zipSpot.vh, `the ZIP button is in view and nothing covers it (${JSON.stringify(zipSpot)})`);
    const dims = await page.evaluate(() => window.ApplyReadyBatchImage.items.map(i => [i.result.width, i.result.height, i.result.bytes]));
    ok(dims.every(([w, h, b]) => w === 300 && h === 100 && b <= 30 * 1024), `signatures padded to 300 × 100 under 30 KB (${JSON.stringify(dims)})`);
    ok(await noOverflow(page), 'no sideways scrolling at 320 px with results');
    await axe(page, 'batch results at 320 px');
    let dialogType = null;
    page.on('dialog', d => { dialogType = d.type(); d.accept(); });
    await page.close({ runBeforeUnload: true });
    await new Promise(r => setTimeout(r, 500));
    ok(dialogType === 'beforeunload', 'leaving with undownloaded results asks first');
    await context.close();
  }

  /* ---------- 3c. Image compressor */
  {
    const { context, page } = await open('compress-image.html');
    ok(await page.inputValue('#bMaxKB') === '100' && await page.inputValue('#bResize') === 'none' && await page.inputValue('#bFormat') === 'keep', 'compressor opens with a 100 KB limit, original size, same format');
    // Too large, empty and over 50 megapixels
    const big = Buffer.alloc(51 * 1024 * 1024); big.set([0xFF, 0xD8, 0xFF, 0xE0]);
    fs.writeFileSync(path.join(FIX, 'huge.jpg'), big);
    fs.writeFileSync(path.join(FIX, 'empty.jpg'), Buffer.alloc(0));
    await page.setInputFiles('#batchDropInput', [fix('huge.jpg'), fix('empty.jpg')]);
    await page.waitForSelector('#batchError:not([hidden])');
    const t = (await page.locator('#batchError').textContent()).replace(/\s+/g, ' ');
    ok(/huge\.jpg is 51 MB\. The limit for this tool is 50 MB/.test(t) && /empty\.jpg is empty/.test(t), `oversized and empty files refused: ${t}`);
    ok(await page.locator('#batchList .file-row').count() === 0 && !(await page.locator('#btnBatchStart').isVisible()), 'nothing added, nothing to start');
    await page.setInputFiles('#batchDropInput', [fix('photo_04.jpg'), fix('photo_00.jpg'), fix('photo_as_png.png'), fix('huge_60mp.png')]);
    await page.waitForFunction(() => document.querySelectorAll('#batchList .file-row').length === 4);
    ok(await page.locator('#batchError').isHidden(), 'a clean add clears the old message');
    await page.waitForFunction(() => /Compress 4 images/.test(document.getElementById('btnBatchStart').textContent), null, { timeout: 3000 }).catch(() => {});
    ok(/Compress 4 images/.test(await page.locator('#btnBatchStart').textContent()), 'compressor wording');
    await page.click('#btnBatchStart');
    await waitIdle(page);
    const items = await page.evaluate(() => window.ApplyReadyBatchImage.items.map(i => ({ name: i.name, status: i.status, error: i.error, r: i.result && { w: i.result.width, h: i.result.height, b: i.result.bytes, mime: i.result.mime, notes: i.result.notes } })));
    const by = n => items.find(i => i.name === n);
    // Allow smaller dimensions is on: quality is never taken below 50%; the photo gets fewer pixels
    // instead, and as many as fit (the size search stops within 5% of the largest that fits).
    const q04 = by('photo_04.jpg').r;
    const lowered = (q04.notes.join(' ').match(/Quality was lowered to (\d+)%/) || [])[1];
    ok(q04.b <= 102400 && (!lowered || Number(lowered) >= 50) && Math.abs(q04.w / q04.h - 1.5) < 0.01, `JPEG under 100 KB, quality at least 50%, proportions kept (${JSON.stringify(q04)})`);
    ok(q04.w === 3000 || (q04.w >= 1200 && q04.notes.some(n => /pixel size was reduced/.test(n))), `pixel size reduced only as far as needed (${q04.w} px)`);
    ok(by('photo_04.jpg').r.notes.some(n => /Quality was lowered to \d+%/.test(n)) || by('photo_04.jpg').r.notes.some(n => /pixel size was reduced/.test(n)), 'notes say what was changed');
    ok(by('photo_as_png.png').r.mime === 'image/png' && by('photo_as_png.png').r.b <= 102400 && by('photo_as_png.png').r.w < 2400 && by('photo_as_png.png').r.notes.some(n => /pixel size was reduced/.test(n)), 'PNG kept as PNG: pixel size reduced and said so');
    ok(by('huge_60mp.png').status === 'error' && /60 megapixels/.test(by('huge_60mp.png').error), `60 MP image refused before decoding: ${by('huge_60mp.png').error}`);
    ok(by('photo_as_png.png').r.notes.some(n => /saving as JPEG keeps many more pixels/.test(n)), 'a PNG that had to shrink suggests JPEG');
    const zip = await saveDownload(page, () => page.click('#btnBatchZip'), 'compressed.zip');
    ok(zip.suggested === 'compressed-images.zip' && /No errors detected/.test(sh('unzip', ['-t', zip.file])), 'compressor ZIP name and integrity');
    // With the switch off the pixel size never changes; quality goes as low as needed.
    await setValue(page, 'bAllowShrink', false);
    await page.waitForFunction(() => /Process again/.test(document.getElementById('btnBatchStart').textContent), null, { timeout: 3000 }).catch(() => {});
    await page.click('#btnBatchStart');
    await waitIdle(page);
    const fixed = await page.evaluate(() => { const i = window.ApplyReadyBatchImage.items.find(x => x.name === 'photo_04.jpg'); return { w: i.result.width, h: i.result.height, b: i.result.bytes, notes: i.result.notes }; });
    ok(fixed.w === 3000 && fixed.h === 2000 && fixed.b <= 102400 && fixed.notes.some(n => /Quality was lowered/.test(n)), `switch off: full size kept under 100 KB (${JSON.stringify(fixed)})`);
    const fixedFile = await saveDownload(page, () => page.locator('#batchList .file-row').first().locator('[data-action="download"]').click(), 'fixed-size.jpg');
    const idf = identify(fixedFile.file);
    ok(idf.w === 3000 && idf.h === 2000 && fs.statSync(fixedFile.file).size <= 102400, `identify confirms the full-size download (${idf.w} × ${idf.h}, ${fs.statSync(fixedFile.file).size} bytes)`);
    await axe(page, 'compressor results');
    await context.close();
  }

  /* ---------- 3c2. Keyboard and one-file use: focus never falls to the page body, one result
     downloads as the file itself, the next step sits in the sticky bar */
  {
    const { context, page } = await open('compress-image.html', { viewport: { width: 1366, height: 768 } });
    const focusId = () => page.evaluate(() => (document.activeElement && document.activeElement.id) || document.activeElement.tagName);
    const browse = page.locator('#batchDrop [data-browse]');
    const box = await browse.boundingBox();
    ok(box && box.y + box.height <= 768, `empty state: the choose button is visible without scrolling (y ${box && Math.round(box.y)})`);
    await browse.focus();
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.keyboard.press('Enter')]);
    await chooser.setFiles([fix('photo_05.jpg')]);
    await page.waitForFunction(() => document.activeElement && document.activeElement.id === 'btnBatchStart', null, { timeout: 3000 }).catch(() => {});
    ok(await focusId() === 'btnBatchStart', 'after choosing files by keyboard, focus moves to the start button (the hidden choose button would drop it)');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');   // a quick second press neither starts again nor cancels
    await waitIdle(page);
    await page.waitForTimeout(300);
    ok((await summary(page)).done === 1 && (await summary(page)).cancelled === 0, 'a quick second Enter does not cancel the run');
    ok(await focusId() === 'batchVerdictTitle', `when the run ends, focus moves to the result (${await focusId()})`);
    ok(!(await page.locator('#btnBatchStart').isVisible()) && /download it from the result/.test(await page.locator('#batchSettingsSummary').textContent()), 'the sticky bar does not repeat the download; it says where it is');
    ok((await page.evaluate(() => window.ApplyReadyBatchImage.items[0].attempts)) === 1, 'pressing Start twice runs the image once');
    ok(/Download the image/.test(await page.locator('#btnBatchZip').textContent()), 'one result: no ZIP in the result panel either');
    await page.keyboard.press('Tab');
    ok(await focusId() === 'btnBatchZip', 'the download is the next stop after the result heading');
    const one = await saveDownload(page, () => page.keyboard.press('Enter'), 'one-result.jpg');
    const idOne = identify(one.file);
    ok(one.suggested === 'photo_05.jpg' && fs.statSync(one.file).size <= 102400 && idOne.w > 0, `one result downloads as the image itself (${one.suggested}, ${idOne.w} × ${idOne.h})`);
    await page.waitForTimeout(200);
    ok(await focusId() === 'btnBatchZip', 'after the download focus stays on the download button');
    // Cancel by keyboard: the Cancel button disappears, focus goes to the result.
    const more = [];
    for (let i = 6; i < 18; i++) more.push(fix(`photo_${String(i).padStart(2, '0')}.jpg`));
    await page.setInputFiles('#batchDropInput', more);
    await page.waitForFunction(() => /Compress 12 images/.test(document.getElementById('btnBatchStart').textContent), null, { timeout: 3000 });
    await page.click('#btnBatchStart');
    await page.waitForSelector('#batchProgress:not(.hidden)');
    await page.focus('#btnBatchCancel');
    await page.keyboard.press('Enter');
    await waitIdle(page);
    await page.waitForTimeout(200);
    ok(await focusId() === 'batchVerdictTitle', `after Cancel, focus moves to the result (${await focusId()})`);
    await context.close();
  }

  /* ---------- 3c3. Keyboard: starting moves focus to Cancel, which then stops the run; a quick
     second Enter meant for Start is ignored. Names, hints and text spacing. */
  {
    const { context, page } = await open('batch-image.html');
    const focusId = () => page.evaluate(() => (document.activeElement && document.activeElement.id) || document.activeElement.tagName);
    const many = [];
    for (let i = 0; i < 40; i++) many.push(fix(`photo_${String(i).padStart(2, '0')}.jpg`));
    await page.setInputFiles('#batchDropInput', many);
    await page.waitForFunction(() => document.querySelectorAll('#batchList .file-row').length === 40);
    ok(await page.locator('#batchDrop .dropzone__text').innerText() === 'Drag them here', 'the compact drop zone hides its button, so its line does not end in "or"');
    await setValue(page, 'bPreset', 'passport');
    await page.focus('#btnBatchStart');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.activeElement && document.activeElement.id === 'btnBatchCancel', null, { timeout: 5000 }).catch(() => {});
    ok(await focusId() === 'btnBatchCancel', `starting by keyboard moves focus to Cancel (${await focusId()})`);
    await page.keyboard.press('Enter');   // the same person pressing Enter twice
    await page.waitForTimeout(150);
    ok(await page.locator('#batchProgress').isVisible() && (await summary(page)).cancelled === 0, 'an immediate second Enter does not cancel');
    await page.waitForTimeout(500);
    await page.keyboard.press('Enter');
    await waitIdle(page);
    await page.waitForTimeout(300);
    const after = await summary(page);
    ok(after.cancelled > 0 && after.done < 40, `a deliberate Enter on Cancel stops the run (${after.done} done, ${after.cancelled} cancelled)`);
    ok(await focusId() === 'batchVerdictTitle', `after Cancel, focus moves to the result (${await focusId()})`);
    // Select hints are read with the custom select buttons.
    const described = await page.evaluate(() => ['bPreset', 'bResize', 'bFormat', 'bNaming'].map(id => { const b = document.getElementById(id + '-button'); const d = b && b.getAttribute('aria-describedby'); return d && document.getElementById(d) ? 'ok' : id; }));
    ok(described.every(x => x === 'ok'), `select buttons are described by their hints (${described})`);
    // The ZIP takes the name typed for this batch.
    await page.click('#btnBatchRetry');
    await waitIdle(page);
    await page.evaluate(() => { document.getElementById('batchMore').open = true; });
    await page.fill('#bZipName', 'BCA 2026 roll.zip');
    const named = await saveDownload(page, () => page.click('#btnBatchZip'), 'named.zip');
    ok(named.suggested === 'BCA 2026 roll.zip', `the ZIP uses the typed name (${named.suggested})`);
    // A slash or backslash in the name is kept as a hyphen, not read as a folder that cuts the name short.
    await page.fill('#bZipName', 'BCA 2026/27 roll');
    const year = await saveDownload(page, () => page.click('#btnBatchZip'), 'year.zip');
    ok(year.suggested === 'BCA 2026-27 roll.zip', `a slash in the ZIP name becomes a hyphen (${year.suggested})`);
    await page.fill('#bZipName', 'Class 10\\A');
    const back = await saveDownload(page, () => page.click('#btnBatchZip'), 'back.zip');
    ok(back.suggested === 'Class 10-A.zip', `a backslash in the ZIP name becomes a hyphen (${back.suggested})`);
    await page.fill('#bZipName', '');
    const plain = await saveDownload(page, () => page.click('#btnBatchZip'), 'plain.zip');
    ok(plain.suggested === 'applyready-images.zip', `an empty ZIP name uses the page's default (${plain.suggested})`);
    // WCAG 1.4.12: with larger text spacing the chosen value of a select wraps instead of being cut off.
    await page.addStyleTag({ content: '* { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; } p { margin-bottom: 2em !important; }' });
    const clipped = await page.evaluate(() => Array.from(document.querySelectorAll('.select-value')).filter(v => v.getClientRects().length && v.scrollWidth > v.clientWidth + 1).map(v => v.textContent));
    ok(clipped.length === 0, `no select value is cut off with text spacing (${clipped})`);
    await context.close();
  }

  /* ---------- 3d. Image converter, and the main-thread fallback when the worker cannot load */
  {
    const { context, page } = await open('convert-image.html');
    ok(await page.inputValue('#bFormat') === 'image/jpeg' && await page.locator('#heic').count() === 1, 'converter opens on JPEG and explains HEIC');
    await page.setInputFiles('#batchDropInput', [fix('transparent.png')]);
    await page.click('#btnBatchStart');
    await waitIdle(page);
    let r = await saveDownload(page, () => page.locator('[data-action="download"]').first().click(), 'conv-white.jpg');
    const px = f => JSON.parse(py(`
import sys, json
from PIL import Image
im = Image.open(sys.argv[1]); print(json.dumps({'fmt': im.format, 'size': im.size, 'mode': im.mode, 'corner': im.convert('RGBA').getpixel((2, 2)), 'centre': im.convert('RGBA').getpixel((200, 150))}))
`, f));
    let info = px(r.file);
    ok(info.fmt === 'JPEG' && info.size[0] === 400 && info.size[1] === 300 && info.corner[0] > 245 && info.corner[1] > 245 && info.corner[2] > 245, `transparent PNG to JPEG: white background (${JSON.stringify(info)})`);
    ok(r.suggested === 'transparent.jpg', 'new extension');
    await setValue(page, 'bBackground', '#ff0000');
    await page.waitForFunction(() => /Process again/.test(document.getElementById('btnBatchStart').textContent), null, { timeout: 3000 }).catch(() => {});
    ok(/Process again/.test(await page.locator('#btnBatchStart').textContent()), 'a new background colour makes the result stale');
    await page.click('#btnBatchStart');
    await waitIdle(page);
    r = await saveDownload(page, () => page.locator('[data-action="download"]').first().click(), 'conv-red.jpg');
    info = px(r.file);
    ok(info.corner[0] > 200 && info.corner[1] < 60 && info.centre[1] > 120, `chosen background colour fills transparency (${JSON.stringify(info)})`);
    await setValue(page, 'bFormat', 'image/png');
    await page.click('#btnBatchStart');
    await waitIdle(page);
    r = await saveDownload(page, () => page.locator('[data-action="download"]').first().click(), 'conv.png');
    info = px(r.file);
    ok(info.fmt === 'PNG' && info.corner[3] === 0 && info.centre[3] === 255, `PNG keeps transparency (${JSON.stringify(info)})`);
    await setValue(page, 'bFormat', 'image/webp');
    await page.click('#btnBatchStart');
    await waitIdle(page);
    r = await saveDownload(page, () => page.locator('[data-action="download"]').first().click(), 'conv.webp');
    const head = fs.readFileSync(r.file).subarray(0, 12).toString('latin1');
    ok(head.startsWith('RIFF') && head.endsWith('WEBP'), 'WebP output is a real WebP file');
    await context.close();

    // Worker script blocked: the pool falls back to the main thread and still converts.
    const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
    await ctx2.route('**/*', rt => (/image-worker\.js/.test(rt.request().url()) ? rt.abort() : /^(http:\/\/127\.|blob:|data:)/.test(rt.request().url()) ? rt.continue() : rt.abort()));
    const p2 = await ctx2.newPage();
    p2.on('pageerror', e => errors.push(`fallback: ${e.message}`));
    await p2.goto(origin + '/convert-image.html');
    await p2.setInputFiles('#batchDropInput', [fix('photo_02.jpg'), fix('logo_1.png'), fix('photo_03.jpg')]);
    await p2.click('#btnBatchStart');
    await waitIdle(p2);
    const s2 = await summary(p2);
    ok(s2.done === 3 && !(await p2.evaluate(() => window.ApplyReadyBatchImage.usesWorkers())), `worker unavailable: main-thread fallback converted all (${JSON.stringify(s2)})`);
    // Per-item progress reaches the caller, from workers and from the main thread
    const prog = await p2.evaluate(async () => {
      const blob = await (await fetch('/img/guides/signature-cleaner.webp')).blob();
      const seen = [];
      const pool = window.ApplyReadyImagePool.create({ mainThread: true });
      const r = await pool.run(blob, { resize: 'fit', width: 400, height: 400, format: 'image/jpeg', maxBytes: 8000 }, null, v => seen.push(v));
      return { seen, verified: r.verified, w: r.width };
    });
    ok(prog.seen.length >= 3 && prog.seen.some(v => v > 0 && v < 1) && prog.seen.every((v, i) => i === 0 || v >= prog.seen[i - 1]) && prog.verified, `progress is reported in order (${prog.seen.map(v => v.toFixed(2))})`);
    await ctx2.close();
    const { context: c3, page: p3 } = await open('convert-image.html');
    const prog2 = await p3.evaluate(async () => {
      const blob = await (await fetch('/img/guides/signature-cleaner.webp')).blob();
      const seen = [];
      const pool = window.ApplyReadyImagePool.create({ size: 1 });
      const ac = new AbortController();
      const r = await pool.run(blob, { resize: 'scale', scale: 50, format: 'image/png' }, null, v => seen.push(v));
      const cancelled = pool.run(blob, { resize: 'scale', scale: 200, format: 'image/png' }, ac.signal).then(() => 'finished', e => e.name);
      ac.abort();
      return { seen, verified: r.verified, cancelled: await cancelled, workers: pool.usesWorkers };
    });
    ok(prog2.workers && prog2.verified && prog2.seen.length >= 2 && prog2.cancelled === 'AbortError', `worker progress and cancel (${JSON.stringify(prog2)})`);
    await c3.close();
  }

  /* ---------- 3e. Passport and signature resizer pages */
  for (const [pageName, preset, file, w, h, kb] of [['passport-photo-resizer.html', 'passport', 'portrait.jpg', 350, 450, 50], ['signature-resizer.html', 'signature', 'signature.jpg', 300, 100, 30]]) {
    const { context, page } = await open(pageName);
    ok(await page.locator(`.choice[data-preset="${preset}"]`).getAttribute('aria-pressed') === 'true', `${pageName}: ${preset} requirement chosen on arrival`);
    await page.setInputFiles('#fileInput', fix(file));
    await page.waitForSelector('#btnProcess:not([disabled])', { timeout: 20000 });
    await page.click('#btnProcess');
    await page.waitForSelector('#resultArea:not(.hidden)', { timeout: 30000 });
    const dl = await saveDownload(page, () => page.click('#btnDownload'), `${preset}-result.jpg`);
    const d = identify(dl.file);
    ok(d.w === w && d.h === h && fs.statSync(dl.file).size <= kb * 1024, `${pageName}: ${w} × ${h} under ${kb} KB (${JSON.stringify(d)}, ${fs.statSync(dl.file).size} bytes)`);
    await context.close();
  }

  /* ---------- 3f. Resizer: "Use original size" keeps EXIF orientation and manual rotation */
  for (const rotate of [false, true]) {
    const { context, page } = await open('passport-photo-resizer.html');
    await page.setInputFiles('#fileInput', fix('exif_gps.jpg'));
    await page.waitForSelector('#btnOriginalSize:not([disabled])', { state: 'attached', timeout: 20000 });
    if (await page.locator('.ws-customize').getAttribute('aria-expanded') !== 'true') await page.click('.ws-customize');
    if (rotate) await page.click('#btnRotateRight');
    await page.click('#btnOriginalSize');
    await setValue(page, 'customMaxKB', '200');
    await page.click('#btnProcess');
    await page.waitForSelector('#resultArea:not(.hidden)', { timeout: 30000 });
    const dl = await saveDownload(page, () => page.click('#btnDownload'), `orig-${rotate}.jpg`);
    const m = JSON.parse(py(`
import sys, json
from PIL import Image
im = Image.open(sys.argv[1]).convert('RGB'); w, h = im.size
print(json.dumps({'w': w, 'h': h, 'top': im.getpixel((w // 2, 10)), 'bottom': im.getpixel((w // 2, h - 10)), 'left': im.getpixel((10, h // 2)), 'right': im.getpixel((w - 10, h // 2))}))
`, dl.file));
    if (!rotate) ok(m.w === 600 && m.h === 800 && m.top[0] > 150 && m.bottom[2] > 150, `original size of an orientation-6 photo stays upright (${JSON.stringify(m)})`);
    else ok(m.w === 800 && m.h === 600 && m.left[2] > 150 && m.right[0] > 150, `original size keeps a manual rotation (${JSON.stringify(m)})`);
    await context.close();
  }

  /* ---------- 3g. Resizer refuses files by content */
  {
    const { context, page } = await open('passport-photo-resizer.html');
    await page.setInputFiles('#fileInput', { name: 'photo.jpg', mimeType: 'image/jpeg', buffer: fs.readFileSync(fix('notes.txt')) });
    await page.waitForSelector('#processErrorBox:not(.hidden)');
    ok(/photo\.jpg is a plain text file/.test(await page.locator('#processErrorBox').textContent()), 'resizer: a text file named .jpg is refused by content');
    await page.setInputFiles('#fileInput', { name: 'IMG_0001.HEIC', mimeType: '', buffer: fs.readFileSync(fix('iphone.heic')) });
    await page.waitForFunction(() => /HEIC/.test(document.getElementById('processErrorBox').textContent));
    ok(true, 'resizer: HEIC refused with an explanation');
    await context.close();
  }

  /* ---------- 3h. Passport print sheet: Remove leaves nothing exportable */
  {
    const { context, page } = await open('passport-photo-print.html');
    await page.setInputFiles('#printFileInput', fix('portrait.jpg'));
    await page.waitForFunction(() => /^blob:/.test(document.getElementById('btnDownloadPrintJpg').getAttribute('href') || ''), null, { timeout: 20000 });
    ok(await page.evaluate(() => document.getElementById('printFileInput').value === ''), 'print: the file input is cleared, so the same photo can be chosen again');
    const pdf = await saveDownload(page, () => page.click('#btnDownloadPrintPdf'), 'sheet.pdf');
    ok(/Pages:\s+1/.test(sh('pdfinfo', [pdf.file])), 'print: the PDF opens with one page');
    const oldHref = await page.getAttribute('#btnDownloadPrintJpg', 'href');
    await page.click('#btnPrintRemove');
    const state = await page.evaluate(() => ({ w: document.getElementById('sheetCanvas').width, h: document.getElementById('sheetCanvas').height, href: document.getElementById('btnDownloadPrintJpg').getAttribute('href') }));
    ok(state.w === 0 && state.h === 0 && state.href === '#', `print: Remove clears the sheet and the JPEG link (${JSON.stringify(state)})`);
    ok(await page.evaluate(async u => fetch(u).then(() => false, () => true), oldHref), 'print: the old JPEG object URL is released');
    let downloaded = false;
    page.on('download', () => { downloaded = true; });
    await page.evaluate(() => { document.getElementById('btnDownloadPrintPdf').click(); document.getElementById('btnDownloadPrintJpg').click(); });
    await page.waitForTimeout(1500);
    ok(!downloaded, 'print: after Remove neither the PDF nor the JPEG button exports the previous photo');
    await page.setInputFiles('#printFileInput', fix('portrait.jpg'));
    await page.waitForFunction(() => document.getElementById('sheetCanvas').width > 0);
    ok(true, 'print: the same photo can be added again after Remove');
    await page.setInputFiles('#printFileInput', { name: 'x.png', mimeType: 'image/png', buffer: Buffer.from('not a picture at all') });
    await page.waitForFunction(() => /plain text file/.test((document.getElementById('taskNotification') || {}).textContent || ''));
    ok(true, 'print: a fake image is refused by content');
    await context.close();
  }

  /* ---------- 3i. Signature cleaner: Remove clears both canvases and the download */
  {
    const { context, page } = await open('signature-cleaner.html');
    await page.setInputFiles('#cleanerFileInput', fix('signature.jpg'));
    await page.waitForFunction(() => /^blob:/.test(document.getElementById('btnCleanerDownload').getAttribute('href') || ''), null, { timeout: 20000 });
    ok(await page.evaluate(() => document.getElementById('cleanerFileInput').value === ''), 'cleaner: the file input is cleared after choosing');
    const oldHref = await page.getAttribute('#btnCleanerDownload', 'href');
    await page.click('#btnCleanerRemove');
    const st = await page.evaluate(() => ({ a: document.getElementById('cleanerCanvas').width, b: document.getElementById('cleanerOriginalCanvas').width, href: document.getElementById('btnCleanerDownload').getAttribute('href') }));
    ok(st.a === 0 && st.b === 0 && st.href === '#', `cleaner: Remove clears both canvases and the link (${JSON.stringify(st)})`);
    ok(await page.evaluate(async u => fetch(u).then(() => false, () => true), oldHref), 'cleaner: the old object URL is released');
    let downloaded = false;
    page.on('download', () => { downloaded = true; });
    await page.evaluate(() => document.getElementById('btnCleanerDownload').click());
    await page.waitForTimeout(800);
    ok(!downloaded, 'cleaner: nothing downloads after Remove');
    await page.setInputFiles('#cleanerFileInput', fix('signature.jpg'));
    await page.waitForFunction(() => document.getElementById('cleanerCanvas').width > 0);
    ok(true, 'cleaner: the same file works again after Remove');
    await page.setInputFiles('#cleanerFileInput', { name: 'sig.jpg', mimeType: 'image/jpeg', buffer: fs.readFileSync(fix('notes.txt')) });
    await page.waitForFunction(() => /plain text file/.test((document.getElementById('taskNotification') || {}).textContent || ''));
    ok(true, 'cleaner: a fake image is refused by content');
    await context.close();
  }

  /* ---------- 3j. Page content: visible FAQ matches the structured data; links */
  for (const f of ['batch-image.html', 'compress-image.html', 'convert-image.html', 'passport-photo-resizer.html', 'signature-resizer.html']) {
    const html = fs.readFileSync(path.join(root, f), 'utf8');
    const ld = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
    const faq = ld['@graph'].find(x => x['@type'] === 'FAQPage').mainEntity.map(q => [q.name, q.acceptedAnswer.text]);
    const decode = s => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').trim();
    const visible = [...html.matchAll(/<summary class="faq-question"><span>([\s\S]*?)<\/span>[\s\S]*?<div class="faq-answer"><p>([\s\S]*?)<\/p><\/div>/g)].map(m => [decode(m[1]), decode(m[2])]);
    assert.deepEqual(visible, faq, `${f}: visible FAQ matches FAQPage JSON-LD`); checks++;
    ok(/class="breadcrumb-nav"/.test(html) && /<p class="tool-privacy">/.test(html), `${f}: breadcrumb and privacy line`);
    ok(!/—/.test(html.match(/<main[\s\S]*<\/main>/)[0]), `${f}: no em dash in the page body`);
  }

  await browser.close();
  server.close();
  assert.deepEqual(errors, [], 'no page errors');
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`✓ Batch images: 50-file batch with cancel and retry, ZIP and single downloads verified with identify, unzip -t and PIL, compressor, converter, worker fallback, resizer pages, orientation, privacy fixes (${checks} checks)`);
})().catch(e => { console.error(e); server.close(); process.exit(1); });
