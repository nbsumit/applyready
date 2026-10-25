#!/usr/bin/env node
/* Annotated screenshots of the ApplyReady tools for the guides, taken from the local site with
   Playwright and saved as WebP in img/guides/. The inputs are the synthetic test images in
   img/samples/, so every screenshot can be regenerated after a design change:

     BROWSER_EXECUTABLE_PATH=/path/to/chromium node scripts/guide-screenshots.js [name ...]

   Each shot loads a page, performs the task, draws numbered callouts over real elements and
   captures the region that matters. Sizes and alt text are listed in img/guides/manifest.json. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const out = path.join(root, 'img', 'guides');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(root, p);
  if (!f.startsWith(root)) { res.writeHead(403); return res.end(); }
  fs.readFile(f, (e, d) => { res.writeHead(e ? 404 : 200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(e ? '' : d); });
});
const sample = name => path.join(root, 'img', 'samples', name);

// Numbered callouts drawn over real elements: [selector, label, side]
async function annotate(page, notes) {
  await page.evaluate(notes => {
    const layer = document.createElement('div');
    layer.id = 'guideNotes';
    layer.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0;z-index:99999;pointer-events:none;font:600 14px/1.3 Inter,system-ui,sans-serif';
    document.body.appendChild(layer);
    notes.forEach(([selector, label, side], i) => {
      const el = document.querySelector(selector);
      if (!el) throw new Error('annotate: no element ' + selector);
      const r = el.getBoundingClientRect(), x = r.left + scrollX, y = r.top + scrollY;
      const box = document.createElement('div');
      box.style.cssText = `position:absolute;left:${x - 4}px;top:${y - 4}px;width:${r.width + 8}px;height:${r.height + 8}px;border:3px solid #d9480f;border-radius:8px`;
      const tag = document.createElement('div');
      tag.textContent = `${i + 1}  ${label}`;
      const pos = side === 'below' ? `left:${x - 4}px;top:${y + r.height + 8}px` : side === 'left' ? `right:${document.documentElement.clientWidth - x + 10}px;top:${y - 4}px` : side === 'right' ? `left:${x + r.width + 10}px;top:${y - 4}px` : `left:${x - 4}px;top:${y - 36}px`;
      tag.style.cssText = `position:absolute;${pos};background:#d9480f;color:#fff;padding:5px 9px;border-radius:6px;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,.25)`;
      layer.append(box, tag);
    });
  }, notes);
}

// Region of the page that contains every given element, with padding, in page coordinates.
async function regionOf(page, selectors, pad = 24) {
  return page.evaluate(([selectors, pad]) => {
    let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
    for (const s of selectors) {
      const el = document.querySelector(s);
      if (!el) throw new Error('region: no element ' + s);
      const x = el.getBoundingClientRect();
      l = Math.min(l, x.left + scrollX); t = Math.min(t, x.top + scrollY); r = Math.max(r, x.right + scrollX); b = Math.max(b, x.bottom + scrollY);
    }
    l = Math.max(0, l - pad); t = Math.max(0, t - pad - 40);
    return { x: Math.round(l), y: Math.round(t), width: Math.round(Math.min(document.documentElement.scrollWidth, r + pad) - l), height: Math.round(b + pad - t) };
  }, [selectors, pad]);
}

async function resizerWith(page, origin, preset, file) {
  await page.goto(origin + '/index.html');
  await page.click(`.choice[data-preset="${preset}"]`);
  await page.setInputFiles('#fileInput', sample(file));
  await page.waitForFunction(() => document.getElementById('imageToCrop').cropper && !document.getElementById('btnProcess').disabled);
  await page.waitForTimeout(400);
}

const SHOTS = {
  'resizer-requirement': {
    alt: 'The ApplyReady image resizer asking what you are preparing, with requirement cards that show each pixel size and KB limit, above the drop zone.',
    async run(page, origin) {
      await page.goto(origin + '/index.html');
      await annotate(page, [['#reqGrid', 'Pick the requirement from your form', 'above'], ['#dropzone', 'Then add the photo or signature', 'above']]);
      return regionOf(page, ['#reqPanel', '#dropzone']);
    }
  },
  'resizer-result-table': {
    alt: 'An ApplyReady result for a 350 by 450 pixel photo under a 50 KB limit: the Download button, a preview, and a table comparing the required file size, dimensions and format with the produced file.',
    async run(page, origin) {
      await resizerWith(page, origin, 'passport', 'test-portrait.jpg');
      await page.click('#btnProcess');
      await page.waitForSelector('#resultArea:not(.hidden)');
      await page.waitForTimeout(600);
      await page.evaluate(() => scrollTo(0, 0));
      await annotate(page, [['.check-table tbody tr:nth-child(1)', 'Size in KB and exact bytes', 'left'], ['.check-table tbody tr:nth-child(2)', 'Pixel size, read back from the file', 'left'], ['#btnDownload', 'Download only after the ticks', 'left']]);
      return regionOf(page, ['.ws-result__head', '.check-table']);
    }
  },
  'resizer-settings': {
    alt: 'The Size, file limit and format panel of the ApplyReady resizer, showing width and height in pixels, the minimum and maximum KB fields and the file format menu.',
    async run(page, origin) {
      await resizerWith(page, origin, 'custom', 'test-portrait.jpg');
      await page.evaluate(() => { const b = document.querySelector('.ws-customize'); if (b.getAttribute('aria-expanded') !== 'true') b.click(); });
      await page.waitForTimeout(300);
      await annotate(page, [['.ws-dims', 'Pixel size the form asks for', 'above'], ['#customMinKB', 'Minimum KB, if the form has one', 'above'], ['#customMaxKB', 'Maximum KB', 'below'], ['#formatSelect', 'JPEG unless the form says otherwise', 'below']]);
      return regionOf(page, ['#wsCustom']);
    }
  },
  'resizer-units-cm': {
    alt: 'The ApplyReady resizer with the unit set to centimetres and 300 DPI, showing the width and height fields labelled in centimetres.',
    async run(page, origin) {
      await resizerWith(page, origin, 'custom', 'test-portrait.jpg');
      await page.evaluate(() => { const b = document.querySelector('.ws-customize'); if (b.getAttribute('aria-expanded') !== 'true') b.click(); });
      await page.selectOption('#unitSelect', 'cm');
      await page.waitForTimeout(300);
      await annotate(page, [['#unitSelect', 'Unit: centimetres', 'below'], ['#dpiSelect', 'DPI turns cm into pixels', 'below'], ['.ws-dims', 'Size in cm', 'above']]);
      return regionOf(page, ['.ws-dims', '#unitSelect', '#dpiSelect']);
    }
  },
  'resizer-crop': {
    alt: 'The ApplyReady crop frame over a test portrait, with the frame locked to the passport photo shape and the rotate and zoom buttons below it.',
    async run(page, origin) {
      await resizerWith(page, origin, 'passport', 'test-portrait.jpg');
      await page.evaluate(() => document.getElementById('cropperActiveArea').scrollIntoView({ block: 'start' }));
      await annotate(page, [['.cropper-crop-box', 'Frame keeps the output shape', 'right'], ['.ws-toolbar__group', 'Rotate and zoom', 'below']]);
      return regionOf(page, ['.cropper-container-wrapper', '.ws-toolbar']);
    }
  },
  'signature-cleaner': {
    alt: 'The ApplyReady signature cleaner with a phone photo of a signature on the left and the cleaned version, white paper and dark ink, on the right.',
    async run(page, origin) {
      await page.goto(origin + '/signature-cleaner.html');
      await page.setInputFiles('#cleanerFileInput', sample('test-signature.jpg'));
      await page.waitForFunction(() => (document.getElementById('btnCleanerDownload').getAttribute('href') || '').startsWith('blob:'));
      await page.waitForTimeout(400);
      await annotate(page, [['#cleanerOriginalCanvas', 'Phone photo: grey, uneven paper', 'above'], ['#cleanerCanvas', 'Cleaned: white paper, dark ink', 'above']]);
      return regionOf(page, ['#cleanerOriginalCanvas', '#cleanerCanvas']);
    }
  },
  'passport-sheet': {
    alt: 'The ApplyReady passport photo print preview: copies of one photo laid out on a 4 by 6 inch sheet with thin cutting lines.',
    async run(page, origin) {
      await page.goto(origin + '/passport-photo-print.html');
      await page.setInputFiles('#printFileInput', sample('test-portrait.jpg'));
      await page.waitForSelector('#printPreviewArea:not(.hidden)');
      await page.waitForTimeout(600);
      await annotate(page, [['#printPreviewArea .ws-preview', 'Whole sheet, to scale', 'above']]);
      return regionOf(page, ['#printPreviewArea']);
    }
  },
  'image-to-pdf': {
    alt: 'The ApplyReady image to PDF tool with two pages in order, each with a drag handle, rotate, move and delete buttons.',
    async run(page, origin) {
      await page.goto(origin + '/image-to-pdf.html');
      await page.setInputFiles('#imgPdfFileInput', [sample('test-portrait.jpg'), sample('test-signature.jpg')]);
      await page.locator('.page-row').nth(1).waitFor();
      await page.waitForTimeout(400);
      await annotate(page, [['.page-row__num', 'Page order in the PDF', 'above'], ['.page-row__handle', 'Drag to reorder', 'below'], ['.page-row .btn-rotate', 'Rotate a sideways scan', 'below']]);
      return regionOf(page, ['#imageListContainer']);
    }
  },
  'compress-pdf': {
    alt: 'The ApplyReady PDF compressor showing the file size before and after compression and the maximum file size choices.',
    async run(page, origin) {
      await page.goto(origin + '/compress-pdf.html');
      await page.setInputFiles('#compressFileInput', sample('test-portrait.jpg'));
      await page.click('#btnStartCompress');
      await page.waitForSelector('#compressResultArea:not(.hidden)', { timeout: 30000 });
      await page.waitForTimeout(400);
      await annotate(page, [['.size-compare', 'Before and after, in KB', 'above'], ['.target-grid', 'The portal limit you chose', 'above']]);
      return regionOf(page, ['.size-compare', '.target-grid']);
    }
  },
  'resume-review': {
    alt: 'The Review step of the ApplyReady resume builder listing what to fix before sending, each with the section it is in and a Fix button.',
    async run(page, origin) {
      await page.goto(origin + '/resume.html');
      await page.click('#tabReview');
      await page.waitForTimeout(400);
      await annotate(page, [['#reviewChecklist .review-item', 'What is missing, and where', 'above'], ['#reviewChecklist .review-jump-btn', 'Fix opens the exact field', 'left']]);
      return regionOf(page, ['#reviewHeading', '#reviewChecklist']);
    }
  },
  'resume-job-match': {
    alt: 'The job description comparison in the ApplyReady resume builder, showing key terms from a pasted advert that the sample resume already uses and terms it does not.',
    async run(page, origin) {
      await page.goto(origin + '/resume.html');
      await page.click('#btnLoadSample');
      const ok = page.locator('.dialog--confirm [data-act="ok"]');
      if (await ok.count()) await ok.click();
      await page.click('#tabReview');
      await page.fill('#jobDescriptionInput', 'We are hiring an Operations Coordinator to manage vendor contracts, improve on-time delivery, build Power BI dashboards, run SQL queries on logistics data and coordinate with procurement and finance teams. Experience with ERP systems, inventory planning and stakeholder communication is required.');
      await page.waitForTimeout(800);
      await page.evaluate(() => document.getElementById('jobDescriptionInput').scrollIntoView({ block: 'start' }));
      await annotate(page, [['#jobDescriptionInput', 'Paste the job advert', 'above'], ['#keywordMatchResult', 'Terms found and missing', 'above']]);
      return regionOf(page, ['#jobDescriptionInput', '#keywordMatchResult']);
    }
  },
  'resume-skills': {
    alt: 'The Skills section of the ApplyReady resume builder with labelled skill rows such as Core Competencies and Tools and Platforms.',
    async run(page, origin) {
      await page.goto(origin + '/resume.html');
      await page.click('#btnLoadSample');
      const ok = page.locator('.dialog--confirm [data-act="ok"]');
      if (await ok.count()) await ok.click();
      await page.waitForTimeout(400);
      const head = page.locator('#sec-skills .accordion-header');
      await head.scrollIntoViewIfNeeded();
      await head.click();
      await page.waitForTimeout(400);
      await annotate(page, [['#sec-skills .skill-row-inputs', 'Label, then the skills on one line', 'above']]);
      return regionOf(page, ['#sec-skills']);
    }
  },
  'resume-templates': {
    alt: 'The Style step of the ApplyReady resume builder with the template list and the live preview of a one-page resume beside it.',
    async run(page, origin) {
      await page.goto(origin + '/resume.html');
      await page.click('#btnLoadSample');
      const ok = page.locator('.dialog--confirm [data-act="ok"]');
      if (await ok.count()) await ok.click();
      await page.click('#tabDesign');
      await page.waitForTimeout(700);
      await page.evaluate(() => scrollTo(0, 0));
      await annotate(page, [['.rb-pages', 'Page count updates as you edit', 'below'], ['.template-gallery-grid', 'Single-column templates', 'above']]);
      return regionOf(page, ['.rb']);
    }
  },
  'resume-download': {
    alt: 'The Download step of the ApplyReady resume builder offering PDF, Word and plain text versions of the same resume.',
    async run(page, origin) {
      await page.goto(origin + '/resume.html');
      await page.click('#tabDownload');
      await page.waitForTimeout(400);
      await annotate(page, [['.export-row--primary', 'PDF for portals and email', 'above'], ['#btnDownloadText', 'Plain text for form fields', 'left']]);
      return regionOf(page, ['.export-actions']);
    }
  }
};

(async () => {
  fs.mkdirSync(out, { recursive: true });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const exe = process.env.BROWSER_EXECUTABLE_PATH;
  const browser = await chromium.launch({ headless: true, ...(exe ? { executablePath: exe } : {}) });
  const wanted = process.argv.slice(2);
  const manifestFile = path.join(out, 'manifest.json');
  const manifest = fs.existsSync(manifestFile) ? JSON.parse(fs.readFileSync(manifestFile, 'utf8')) : {};
  for (const [name, shot] of Object.entries(SHOTS)) {
    if (wanted.length && !wanted.includes(name)) continue;
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: 'light', deviceScaleFactor: 1 });
    await context.route('**/*', r => (r.request().url().startsWith(origin) || /^(data|blob):/.test(r.request().url()) ? r.continue() : r.abort()));
    // Sticky bars would be painted mid-image in a full-page capture; keep them in the flow.
    await context.addInitScript(() => document.addEventListener('DOMContentLoaded', () => {
      const st = document.createElement('style');
      st.textContent = '.site-header,.rb-steps,.rb-preview__bar,.ws-action{position:static!important}';
      document.head.appendChild(st);
    }));
    const page = await context.newPage();
    const clip = await shot.run(page, origin);
    clip.height = Math.min(clip.height, shot.maxHeight || 900);
    const png = await page.screenshot({ clip, fullPage: true });
    // Encode as WebP in the browser itself, so no image library is needed.
    const webp = Buffer.from(await page.evaluate(async b64 => {
      const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
      const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
      c.getContext('2d').drawImage(img, 0, 0);
      return c.toDataURL('image/webp', 0.82).split(',')[1];
    }, png.toString('base64')), 'base64');
    fs.writeFileSync(path.join(out, name + '.webp'), webp);
    manifest[name] = { file: `img/guides/${name}.webp`, width: clip.width, height: clip.height, alt: shot.alt, bytes: webp.length };
    console.log(`${name}.webp ${clip.width}x${clip.height} ${(webp.length / 1024).toFixed(1)} KB`);
    await context.close();
  }
  fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 1) + '\n');
  await browser.close();
  server.close();
})().catch(e => { console.error(e); process.exit(1); });
