#!/usr/bin/env node
/* Annotated screenshots of the ApplyReady tools for the guides and tutorials, taken from the local
   site with Playwright and saved as WebP in img/guides/. The inputs are the synthetic samples in
   img/samples/ (test-*.jpg) and img/samples/guide/ (made by scripts/make-sample-images.py and
   scripts/make-sample-pdfs.js), so every screenshot can be regenerated after a design change:

     python3 scripts/make-sample-images.py && node scripts/make-sample-pdfs.js
     BROWSER_EXECUTABLE_PATH=/path/to/chromium node scripts/guide-screenshots.js [--desktop | --phone] [name ...]

   Each shot loads a real page in a fresh browser profile, performs the task with the real
   interface, draws numbered callouts over real elements and captures the region that matters.

   Every shot is taken twice: once in a desktop window (img/guides/<name>.webp) and once in a phone
   window, 360 CSS px wide at 2x (img/guides/phone/<name>.webp), so a reader on a phone sees the
   layout they will actually use, at a size they can read. Pages show both through <picture>, and
   this script writes that markup. A shot whose steps need different elements in the phone layout
   gives them in `phone: { run }`; `phone: false` keeps only the desktop picture.
   --desktop or --phone takes only one of the two; --sync only rewrites that markup from the manifest.

   Width, height, bytes and alt text are recorded in img/guides/manifest.json; tests/guides_tests.js
   checks that every image a guide shows exists, matches the manifest and is used by a page. */
'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { execFileSync } = require('node:child_process');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const out = path.join(root, 'img', 'guides');
const outPhone = path.join(out, 'phone');
// The phone window: the narrowest common phone, at the pixel density of most phones. Pages switch to
// the phone picture below PHONE_MEDIA (tests/guides_tests.js checks the same media query).
const PHONE = { width: 360, height: 740, scale: 2 };
const PHONE_MEDIA = '(max-width: 640px)';
const ZOOM_HINT = '<span class="shot__zoom"><i class="fa-solid fa-magnifying-glass-plus" aria-hidden="true"></i> Open full size</span>';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.wasm': 'application/wasm', '.pdf': 'application/pdf' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(root, p);
  if (!f.startsWith(root)) { res.writeHead(403); return res.end(); }
  fs.readFile(f, (e, d) => { res.writeHead(e ? 404 : 200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(e ? '' : d); });
});
const sample = name => path.join(root, 'img', 'samples', name);
const guideSample = name => path.join(root, 'img', 'samples', 'guide', name);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ar-guide-shots-'));

// Numbered callouts drawn over real elements: [selector, label, side]. side: above, below, left, right,
// or corner: only the number, on the top right corner of the box, where there is no room for words
// (the figure caption then explains each number).
// The last callouts and region asked for on each page, so capture() can draw them again once the
// window has its final size (see there).
const drawn = new WeakMap();
async function annotate(page, notes) {
  drawn.set(page, { ...drawn.get(page), notes });
  await page.evaluate(notes => {
    const old = document.getElementById('guideNotes');
    if (old) old.remove();
    const layer = document.createElement('div');
    layer.id = 'guideNotes';
    // As wide as the page, so a label placed to the left of an element (CSS right) is measured from the page edge.
    const W = document.documentElement.clientWidth;
    layer.style.cssText = `position:absolute;left:0;top:0;width:${W}px;height:0;z-index:99999;pointer-events:none;font:600 14px/1.3 Inter,system-ui,sans-serif`;
    document.body.appendChild(layer);
    notes.forEach(([selector, label, side], i) => {
      const el = document.querySelector(selector);
      if (!el) throw new Error('annotate: no element ' + selector);
      const r = el.getBoundingClientRect(), x = r.left + scrollX, y = r.top + scrollY;
      if (!r.width || !r.height) throw new Error('annotate: element not visible ' + selector);
      const box = document.createElement('div');
      box.style.cssText = `position:absolute;left:${x - 4}px;top:${y - 4}px;width:${r.width + 8}px;height:${r.height + 8}px;border:3px solid #d9480f;border-radius:8px`;
      const tag = document.createElement('div');
      tag.textContent = side === 'corner' ? String(i + 1) : `${i + 1}  ${label}`;
      const pos = side === 'corner' ? `left:${x + r.width - 14}px;top:${y - 16}px` : side === 'below' ? `left:${x - 4}px;top:${y + r.height + 8}px` : side === 'left' ? `right:${W - x + 10}px;top:${y - 4}px` : side === 'right' ? `left:${x + r.width + 10}px;top:${y - 4}px` : `left:${x - 4}px;top:${y - 36}px`;
      tag.style.cssText = `position:absolute;${pos};background:#d9480f;color:#fff;padding:5px 9px;border-radius:6px;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,.25)`;
      layer.append(box, tag);
      // In a narrow (phone) window a label with words can run off the edge and be cut from the picture,
      // or land on the content next to it: show only the number on the box's corner, as for 'corner'
      // (the caption explains each number), kept inside the window.
      const t = tag.getBoundingClientRect();
      if (t.left < 4 || t.right > W - 4) {
        tag.textContent = String(i + 1);
        tag.style.cssText += `;right:auto;top:${y - 16}px;left:${Math.min(x + r.width - 14, W - 4 - tag.getBoundingClientRect().width)}px`;
      }
    });
  }, notes);
}

// Region of the page that contains every given element, with padding, in page coordinates.
// The callout layer is included, so a label drawn outside an element is not cut off.
async function regionOf(page, selectors, pad = 24) {
  drawn.set(page, { ...drawn.get(page), region: [selectors, pad] });
  return page.evaluate(([selectors, pad]) => {
    let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
    const add = x => { l = Math.min(l, x.left + scrollX); t = Math.min(t, x.top + scrollY); r = Math.max(r, x.right + scrollX); b = Math.max(b, x.bottom + scrollY); };
    for (const s of selectors) {
      const el = document.querySelector(s);
      if (!el) throw new Error('region: no element ' + s);
      add(el.getBoundingClientRect());
    }
    const layer = document.getElementById('guideNotes');
    if (layer) for (const tag of layer.children) add(tag.getBoundingClientRect());
    l = Math.max(0, l - pad); t = Math.max(0, t - pad);
    return { x: Math.round(l), y: Math.round(t), width: Math.round(Math.min(document.documentElement.scrollWidth, r + pad) - l), height: Math.round(b + pad - t) };
  }, [selectors, pad]);
}

const settle = (page, ms = 400) => page.waitForTimeout(ms);
const top = page => page.evaluate(() => scrollTo(0, 0));
// Page count of a PDF read independently with pdfinfo (poppler), or null when it is not installed.
function pdfPages(file) {
  try { return Number((execFileSync('pdfinfo', [file], { encoding: 'latin1' }).match(/^Pages:\s+(\d+)/m) || [])[1]); } catch (e) { return null; }
}

/* ------------------------------------------------------------------ image resizer */
async function resizerWith(page, origin, url, preset, file) {
  await page.goto(origin + url);
  if (preset) await page.click(`.choice[data-preset="${preset}"]`);
  await page.setInputFiles('#fileInput', file);
  await page.waitForFunction(() => document.getElementById('imageToCrop').cropper && !document.getElementById('btnProcess').disabled);
  await settle(page);
}
const openSettings = page => page.evaluate(() => { const b = document.querySelector('.ws-customize'); if (b.getAttribute('aria-expanded') !== 'true') b.click(); });

/* ------------------------------------------------------------------ resume builder */
async function resumePage(page, origin) {
  await page.goto(origin + '/resume.html');
  await page.waitForFunction(() => document.getElementById('resumeAppLayout').getAttribute('aria-busy') !== 'true');
  await page.waitForFunction(() => !/Opening/.test(document.getElementById('saveStatusText').textContent));
}
async function loadSample(page) {
  await page.click('#btnLoadSample');
  const ok = page.locator('.dialog--confirm [data-act="ok"]');
  if (await ok.count() && await ok.isVisible()) await ok.click();
  await settle(page);
}
async function openSection(page, key) {
  const head = page.locator(`#sec-${key} .accordion-header`);
  if (await head.getAttribute('aria-expanded') !== 'true') await head.click();
  await settle(page, 200);
}
const PERSON = { fullName: 'Priya Sharma', targetTitle: 'Junior Data Analyst', email: 'priya.sharma@example.com', phone: '+91 90000 12345', location: 'Pune, India' };
async function fillContact(page, person = PERSON) {
  for (const [id, value] of Object.entries(person)) await page.fill('#' + id, value);
}
async function fillExperience(page) {
  await openSection(page, 'experience');
  await page.click('#btnAddExperience');
  const entry = page.locator('#experienceList .entry, #experienceList [role="group"]').first();
  await entry.getByLabel('Job title').fill('Data Intern');
  await entry.getByLabel('Company or organization').fill('Sample Logistics Pvt Ltd');
  await entry.getByLabel('Dates').fill('Jan 2026 - Jun 2026');
  await entry.getByLabel('Responsibilities and results').fill('Built a weekly delivery report in Excel used by 4 regional managers\nCleaned 12,000 shipment records in SQL, cutting duplicate entries to zero');
}
const waitSaved = page => page.waitForFunction(() => /^Saved on this device/.test(document.getElementById('saveStatusText').textContent), null, { timeout: 10000 });
async function openLibrary(page) {
  await top(page);
  await page.click('#btnLibrary');
  await page.waitForSelector('#libraryDialog:not([hidden]) #libList li');
  await settle(page);
}
// Three saved resumes, made through the interface: one typed, one from the sample, one duplicate.
async function threeResumes(page, origin) {
  await resumePage(page, origin);
  await fillContact(page);
  await waitSaved(page);
  await openLibrary(page);
  await page.click('#libraryDialog [data-act="duplicate"][data-index="0"]');
  await page.waitForFunction(() => document.querySelectorAll('#libList [data-act="open"]').length === 2);
  await page.click('#libraryDialog [data-act="sample"]');
  await waitSaved(page);
  await openLibrary(page);
}

/* ------------------------------------------------------------------ batch images */
const setValue = (page, id, value) => page.evaluate(([id, value]) => {
  const e = document.getElementById(id);
  if (e.type === 'checkbox') e.checked = value; else e.value = value;
  e.dispatchEvent(new Event('input', { bubbles: true }));
  e.dispatchEvent(new Event('change', { bubbles: true }));
  return new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
}, [id, value]);
const batchIdle = page => page.waitForFunction(() => { const s = window.ApplyReadyBatchImage.summary(); return s.total > 0 && !s.queued && !s.processing; }, null, { timeout: 120000 });
// Copies of the sample photos under other names, so a batch looks like a real group of applicants.
function photoSet(n) {
  const dir = fs.mkdtempSync(path.join(tmp, 'photos-'));
  const files = [];
  for (let i = 0; i < n; i++) {
    const f = path.join(dir, `applicant-${String(i + 1).padStart(2, '0')}.jpg`);
    fs.copyFileSync(guideSample(`photo-applicant-${(i % 3) + 1}.jpg`), f);
    files.push(f);
  }
  return files;
}

/* ------------------------------------------------------------------ shots */
const SHOTS = {
  /* ---- shots used by the background guides (regenerated with the current interface) ---- */
  'resizer-result-table': {
    viewport: 720,
    alt: 'An ApplyReady result for a 350 by 450 pixel photo under a 50 KB limit: the Download button, a preview, and a table comparing the required file size, dimensions and format with the produced file.',
    async run(page, origin) {
      await resizerWith(page, origin, '/passport-photo-resizer.html', null, sample('test-portrait.jpg'));
      await page.click('#btnProcess');
      await page.waitForSelector('#resultArea:not(.hidden)');
      await settle(page, 600);
      await top(page);
      await annotate(page, [['.check-table tbody tr:nth-child(1)', 'Size in KB and exact bytes', 'corner'], ['.check-table tbody tr:nth-child(2)', 'Pixel size, read back from the file', 'corner'], ['#btnDownload', 'Download only after the ticks', 'corner']]);
      return regionOf(page, ['.ws-result__head', '.check-table']);
    }
  },
  'resizer-settings': {
    viewport: 720,
    alt: 'The Size, file limit and format panel of the ApplyReady resizer, showing width and height in pixels, the minimum and maximum KB fields and the file format menu.',
    async run(page, origin) {
      await resizerWith(page, origin, '/passport-photo-resizer.html', null, sample('test-portrait.jpg'));
      await openSettings(page);
      await settle(page, 300);
      await annotate(page, [['.ws-dims', 'Pixel size the form asks for', 'corner'], ['#customMinKB', 'Minimum KB, if the form has one', 'corner'], ['#customMaxKB', 'Maximum KB', 'corner'], ['#formatSelect', 'JPEG unless the form says otherwise', 'corner']]);
      return regionOf(page, ['#wsCustom']);
    }
  },
  'resizer-units-cm': {
    viewport: 720,
    alt: 'The ApplyReady resizer with the unit set to centimetres and 300 DPI, showing the width and height fields labelled in centimetres.',
    async run(page, origin) {
      await resizerWith(page, origin, '/image-resizer.html', 'custom', sample('test-portrait.jpg'));
      await openSettings(page);
      await page.selectOption('#unitSelect', 'cm');
      await settle(page, 300);
      await annotate(page, [['#unitSelect', 'Unit: centimetres', 'corner'], ['#dpiSelect', 'DPI turns cm into pixels', 'corner'], ['.ws-dims', 'Size in cm', 'corner']]);
      return regionOf(page, ['.ws-dims', '#unitSelect', '#dpiSelect']);
    }
  },
  'resizer-crop': {
    viewport: 720,
    alt: 'The ApplyReady crop frame over a test portrait, with the frame locked to the passport photo shape and the rotate and zoom buttons below it.',
    async run(page, origin) {
      await resizerWith(page, origin, '/passport-photo-resizer.html', null, sample('test-portrait.jpg'));
      await page.evaluate(() => document.getElementById('cropperActiveArea').scrollIntoView({ block: 'start' }));
      await annotate(page, [['.cropper-crop-box', 'Frame keeps the output shape', 'right'], ['.ws-toolbar__group', 'Rotate and zoom', 'corner']]);
      return regionOf(page, ['#cropperActiveArea .ws-step', '.cropper-container-wrapper', '.ws-toolbar']);
    }
  },
  'signature-cleaner': {
    alt: 'The ApplyReady signature cleaner with a phone photo of a signature on the left and the cleaned version, white paper and dark ink, on the right.',
    async run(page, origin) {
      await page.goto(origin + '/signature-cleaner.html');
      await page.setInputFiles('#cleanerFileInput', sample('test-signature.jpg'));
      await page.waitForFunction(() => (document.getElementById('btnCleanerDownload').getAttribute('href') || '').startsWith('blob:'));
      await settle(page);
      await annotate(page, [['#cleanerOriginalCanvas', 'Phone photo: grey, uneven paper', 'below'], ['#cleanerCanvas', 'Cleaned: white paper, dark ink', 'below']]);
      return regionOf(page, ['#cleanerOriginalCanvas', '#cleanerCanvas']);
    }
  },
  'passport-sheet': {
    viewport: 560,
    alt: 'The ApplyReady passport photo print preview: copies of one photo laid out on a 4 by 6 inch sheet with thin cutting lines.',
    async run(page, origin) {
      await page.goto(origin + '/passport-photo-print.html');
      await page.setInputFiles('#printFileInput', sample('test-portrait.jpg'));
      await page.waitForSelector('#printPreviewArea:not(.hidden)');
      await settle(page, 600);
      await annotate(page, [['#printPreviewArea .ws-preview', 'Whole sheet, to scale', 'below']]);
      return regionOf(page, ['#printPreviewArea']);
    }
  },
  'image-to-pdf': {
    alt: 'The ApplyReady image to PDF tool with two pages in order, each with a drag handle, rotate, move and delete buttons.',
    async run(page, origin) {
      await page.goto(origin + '/image-to-pdf.html');
      await page.setInputFiles('#imgPdfFileInput', [sample('test-portrait.jpg'), sample('test-signature.jpg')]);
      await page.locator('.page-row').nth(1).waitFor();
      await settle(page);
      await annotate(page, [['.page-row__num', 'Page order in the PDF', 'right'], ['.page-row__actions', 'Drag, rotate, move or remove', 'below']]);
      return regionOf(page, ['#pageOrderHint', '#imageListContainer']);
    }
  },
  'compress-pdf': {
    viewport: 720,
    alt: 'The ApplyReady PDF compressor showing the file size before and after compression and the maximum file size choices.',
    async run(page, origin) {
      await page.goto(origin + '/compress-pdf.html');
      await page.setInputFiles('#compressFileInput', sample('test-portrait.jpg'));
      await page.click('#btnStartCompress');
      await page.waitForSelector('#compressResultArea:not(.hidden)', { timeout: 60000 });
      await settle(page);
      await annotate(page, [['.size-compare', 'Before and after, in KB', 'above'], ['.target-grid', 'The portal limit you chose', 'above']]);
      return regionOf(page, ['.size-compare', '.target-grid']);
    }
  },
  'resume-review': {
    alt: 'The Review step of the ApplyReady resume builder listing what to fix before sending, each with the section it is in and a Fix button.',
    async run(page, origin) {
      await resumePage(page, origin);
      await page.click('#tabReview');
      await settle(page);
      await annotate(page, [['#reviewChecklist .review-item', 'What is missing, and where', 'above'], ['#reviewChecklist .review-jump-btn', 'Fix opens the exact field', 'corner']]);
      return regionOf(page, ['#reviewHeading', '#reviewChecklist']);
    }
  },
  'resume-job-match': {
    alt: 'The job description comparison in the ApplyReady resume builder, showing key terms from a pasted advert that the sample resume already uses and terms it does not.',
    async run(page, origin) {
      await resumePage(page, origin);
      await loadSample(page);
      await page.click('#tabReview');
      await page.fill('#jobDescriptionInput', 'We are hiring an Operations Coordinator to manage vendor contracts, improve on-time delivery, build Power BI dashboards, run SQL queries on logistics data and coordinate with procurement and finance teams. Experience with ERP systems, inventory planning and stakeholder communication is required.');
      await settle(page, 800);
      await page.evaluate(() => document.getElementById('jobDescriptionInput').scrollIntoView({ block: 'start' }));
      await annotate(page, [['#jobDescriptionInput', 'Paste the job advert', 'corner'], ['#keywordMatchResult', 'Terms found and missing', 'corner']]);
      return regionOf(page, ['#jobDescriptionInput', '#keywordMatchResult']);
    }
  },
  'resume-skills': {
    alt: 'The Skills section of the ApplyReady resume builder with labelled skill rows such as Core Competencies and Tools and Platforms.',
    async run(page, origin) {
      await resumePage(page, origin);
      await loadSample(page);
      await openSection(page, 'skills');
      await page.locator('#sec-skills').scrollIntoViewIfNeeded();
      await annotate(page, [['#sec-skills .skill-row-inputs', 'Label, then the skills on one line', 'corner']]);
      return regionOf(page, ['#sec-skills']);
    }
  },
  'resume-templates': {
    alt: 'The Style step of the ApplyReady resume builder: the live preview of a one-page resume in the chosen template, with its page count above it. On a wide screen the template list sits beside the preview.',
    maxHeight: 820,
    // On a phone the template list and the preview are separate views (Edit and Preview): show the
    // preview after choosing Style, with the same two callouts.
    phone: {
      maxHeight: 1000,
      async run(page, origin) {
        await resumePage(page, origin);
        await loadSample(page);
        await page.click('#tabDesign');
        await settle(page, 400);
        // The Edit / Preview bar is hidden in captures (it floats over the picture); press its button directly.
        await page.evaluate(() => document.getElementById('tabPreview').click());
        await settle(page, 700);
        await top(page);
        await annotate(page, [['.rb-pages', 'Page count', 'corner'], ['#previewWrapper', 'A single column of real text', 'corner']]);
        return regionOf(page, ['.rb-preview__bar', '#previewWrapper'], 12);
      }
    },
    async run(page, origin) {
      await resumePage(page, origin);
      await loadSample(page);
      await page.click('#tabDesign');
      await settle(page, 700);
      await top(page);
      await annotate(page, [['.rb-pages', 'Page count updates as you edit', 'below'], ['#templateGalleryGrid > :first-child', 'Every template is single-column', 'corner']]);
      return regionOf(page, ['.rb'], 12);
    }
  },
  'resume-download': {
    alt: 'The Download step of the ApplyReady resume builder offering PDF, Word and plain text versions of the same resume.',
    async run(page, origin) {
      await resumePage(page, origin);
      await page.click('#tabDownload');
      await settle(page);
      await annotate(page, [['.export-row--primary', 'PDF for portals and email', 'corner'], ['#btnDownloadText', 'Plain text for form fields', 'corner']]);
      return regionOf(page, ['.export-actions']);
    }
  },

  /* ---- tutorial: create a resume ---- */
  'tut-resume-contact': {
    alt: 'The Write step of the ApplyReady resume builder with Contact details filled in for a sample applicant, and the line under the title saying the resume is saved on this device.',
    async run(page, origin) {
      await resumePage(page, origin);
      await fillContact(page);
      await waitSaved(page);
      await page.evaluate(() => document.activeElement.blur());
      await top(page);
      await annotate(page, [['#saveStatus', 'Saves as you type', 'right'], ['#fullName', 'Only the name is required', 'corner'], ['#btnLoadSample', 'Or look at a sample first', 'left']]);
      return regionOf(page, ['#saveStatus', '#sec-personal']);
    }
  },
  'tut-resume-experience': {
    alt: 'A Work experience entry in the ApplyReady resume builder with job title, company, dates and two result bullets, one per line, and the Add work experience button below.',
    async run(page, origin) {
      await resumePage(page, origin);
      await fillContact(page);
      await fillExperience(page);
      await settle(page);
      await page.locator('#sec-experience').scrollIntoViewIfNeeded();
      await annotate(page, [['#experienceList .entry-actions, #experienceList [aria-label^="Move role 1 up"]', 'Move, copy or delete an entry', 'above'], ['#experienceList textarea', 'One bullet per line', 'right'], ['#btnAddExperience', 'Add the next role', 'corner']]);
      return regionOf(page, ['#sec-experience']);
    }
  },
  'tut-resume-review': {
    alt: 'The Review step for a resume written from blank: it is ready to download, with warnings that Education and Skills are still empty and a Fix button beside each.',
    async run(page, origin) {
      await resumePage(page, origin);
      await fillContact(page);
      await openSection(page, 'summary');
      await page.fill('#summaryText', 'Statistics graduate who cleans, checks and reports data in SQL and Excel.');
      await fillExperience(page);
      await page.click('#tabReview');
      await settle(page, 600);
      await top(page);
      await annotate(page, [['#reviewStatusText', 'Can download now', 'above'], ['#reviewChecklist .review-jump-btn', 'Fix opens that section', 'left'], ['#reviewPageEstimatePill', 'Page count', 'below']]);
      return regionOf(page, ['#reviewHeading', '#reviewChecklist']);
    }
  },

  /* ---- tutorial: edit a saved resume ---- */
  'tut-library': {
    alt: 'The My resumes window of the ApplyReady resume builder listing three resumes saved in this browser, each with when it was edited, its template, and Open, Rename, Duplicate, Export and Delete buttons.',
    async run(page, origin) {
      await threeResumes(page, origin);
      await annotate(page, [['#libList .rl-row.is-current', 'Open now: the resume on screen', 'right'], ['#libList .rl-row[data-row="1"] .rl-row__actions', 'Open, Rename, Duplicate, Export, Delete', 'right'], ['#libList .rl-row[data-row="1"] .rl-row__name', 'Made with Duplicate', 'corner']]);
      return regionOf(page, ['#libraryDialog .rl-dialog'], 16);
    }
  },
  'tut-library-rename': {
    alt: 'Renaming a resume in My resumes: the name has become a text box with Save name and Cancel buttons beside it.',
    async run(page, origin) {
      await threeResumes(page, origin);
      await page.click('#libraryDialog [data-act="rename"][data-index="1"]');
      await page.fill('#libList .rl-rename .input', 'Priya Sharma, analyst roles');
      await settle(page, 200);
      await annotate(page, [['#libList .rl-rename .input', 'Type the new name', 'above'], ['#libList .rl-rename button[type="submit"]', 'Save name, or press Enter', 'below']]);
      return regionOf(page, ['#libList'], 16);
    }
  },

  /* ---- tutorial: back up and restore ---- */
  'tut-keep-work': {
    alt: 'The Keep your work panel in the Download step of the ApplyReady resume builder, with the Save on this device switch, the save status, and the Download backup file, Import backup and My resumes buttons.',
    async run(page, origin) {
      await resumePage(page, origin);
      await fillContact(page);
      await waitSaved(page);
      await page.click('#tabDownload');
      await settle(page);
      await page.locator('#keepHeading').scrollIntoViewIfNeeded();
      await annotate(page, [['#btnExportJSON', 'This resume as a .json file', 'below'], ['#btnImportJSON', 'Bring a backup back', 'right']]);
      return regionOf(page, ['#keepHeading', '.rb-backup', '#btnOpenLibrary']);
    }
  },
  'tut-library-backup': {
    alt: 'The top of My resumes with the Import backup and Export all buttons, the list of saved resumes, the switch for saving on this device and the Delete all saved resumes button.',
    maxHeight: 820,
    async run(page, origin) {
      await threeResumes(page, origin);
      await annotate(page, [['#libraryDialog [data-act="export-all"]', 'Every resume in one file', 'right'], ['#libraryDialog [data-act="import"]', 'Import a backup', 'below'], ['#libList [data-act="export"][data-index="2"]', 'Just this one', 'below']]);
      return regionOf(page, ['#libraryDialog .rl-dialog'], 16);
    }
  },
  'tut-yourdata-resumes': {
    viewport: 720,
    alt: 'The Saved resumes section of the ApplyReady Your data page listing two resumes kept in this browser, with buttons to export them all, import a backup and delete them.',
    async run(page, origin) {
      await resumePage(page, origin);
      await fillContact(page);
      await waitSaved(page);
      await openLibrary(page);
      await page.click('#libraryDialog [data-act="sample"]');
      await waitSaved(page);
      await page.goto(origin + '/your-data.html');
      await page.waitForSelector('#resumesHeading, [aria-labelledby] h2');
      await settle(page, 800);
      const section = page.locator('section', { has: page.locator('h2', { hasText: 'Saved resumes' }) });
      const id = await section.evaluate(s => { s.id = s.id || 'guideResumes'; return s.id; });
      const exportId = await section.getByRole('button', { name: 'Download a backup of all resumes' }).evaluate(b => { b.id = b.id || 'guideExportAll'; return b.id; });
      const importId = await section.getByRole('button', { name: 'Import a backup' }).evaluate(b => { b.id = b.id || 'guideImport'; return b.id; });
      await annotate(page, [[`#${exportId}`, 'Every resume in one file', 'below'], [`#${importId}`, 'Restore from a file', 'below']]);
      return regionOf(page, [`#${id}`], 16);
    }
  },

  /* ---- tutorial: resize a photo ---- */
  'tut-resizer-requirement': {
    viewport: 720,
    alt: 'The first step of the ApplyReady image resizer, What are you preparing, with choices such as ID or passport photo, Signature, Profile photo and Custom size, each showing its pixel size and KB limit.',
    async run(page, origin) {
      await page.goto(origin + '/image-resizer.html');
      await settle(page);
      await annotate(page, [['#reqHeading', 'Pick what the form asks for', 'right'], ['.choice[data-preset="custom"]', 'Your form says something else', 'below']]);
      return regionOf(page, ['#reqPanel']);
    }
  },

  /* ---- tutorial: compress images ---- */
  'tut-compress-settings': {
    alt: 'The settings of the ApplyReady image compressor: the Maximum and Minimum fields in KB, the Quality slider, the Allow smaller dimensions to meet the limit switch and the Save as menu.',
    async run(page, origin) {
      await page.goto(origin + '/compress-image.html');
      await page.setInputFiles('#batchApp input[type=file]', [guideSample('photo-applicant-1.jpg')]);
      await page.waitForSelector('#batchList li');
      await setValue(page, 'bMaxKB', '50');
      await settle(page);
      await top(page);
      await annotate(page, [['#bMaxKB', 'The limit, in KB', 'left'], ['label[for="bAllowShrink"]', 'On: fewer pixels if needed', 'left'], ['#bFormat + .select, #bFormat ~ button, [data-select-for="bFormat"], .field:has(#bFormat) button', 'Keep JPEG for photos', 'left']]);
      return regionOf(page, ['.ws-side [data-section="limit"]', '#bFormatHint']);
    }
  },
  'tut-compress-results': {
    alt: 'Image compressor results for four files under a 50 KB limit: each row shows the original size, the result size in KB and exact bytes, and a note when quality was lowered or the photo was made smaller to fit.',
    phone: { maxHeight: 1200 },
    async run(page, origin, { phone } = {}) {
      await page.goto(origin + '/compress-image.html');
      await page.setInputFiles('#batchApp input[type=file]', [guideSample('photo-applicant-1.jpg'), guideSample('photo-applicant-2.jpg'), guideSample('document-page-1.jpg'), sample('test-signature-cleaned.jpg')]);
      await page.waitForFunction(() => document.querySelectorAll('#batchList li').length === 4);
      await setValue(page, 'bMaxKB', '50');
      await page.click('#btnBatchStart');
      await batchIdle(page);
      await settle(page, 600);
      await top(page);
      await annotate(page, [['#batchVerdictTitle', 'Every file checked', 'right'], ['#batchList li:nth-child(3) .file-row__notes', 'What changed, and why', 'corner'], ['#btnBatchZip', 'One ZIP for all', 'right']]);
      // On a phone the rows are tall: end the picture at the row the second callout is on.
      return regionOf(page, phone ? ['#batchResult', '#batchList li:nth-child(3)'] : ['#batchResult', '#batchList'], 16);
    }
  },

  /* ---- tutorial: signature ---- */
  'tut-signature-controls': {
    alt: 'The ApplyReady signature cleaner after a phone photo was added: the cleaned preview, the Paper whiteness and Ink darkness sliders, the file type menu and the Download signature button.',
    maxHeight: 860,
    phone: { maxHeight: 1100 },
    async run(page, origin) {
      await page.goto(origin + '/signature-cleaner.html');
      await page.setInputFiles('#cleanerFileInput', sample('test-signature.jpg'));
      await page.waitForFunction(() => (document.getElementById('btnCleanerDownload').getAttribute('href') || '').startsWith('blob:'));
      await settle(page);
      await page.locator('#cleanerCanvas').scrollIntoViewIfNeeded();
      const sliders = await page.locator('main input[type=range]').evaluateAll(rs => rs.map(r => r.id));
      await annotate(page, [[`#${sliders[0]}`, 'Grey paper? Raise this', 'left'], [`#${sliders[1]}`, 'Faint strokes? Raise this', 'left'], ['#btnCleanerDownload', 'Save the cleaned file', 'above']]);
      return regionOf(page, ['#cleanerCanvas', '#btnCleanerDownload', 'main a[href*="preset=signature"]', `#${sliders[0]}`]);
    }
  },
  'tut-signature-result': {
    viewport: 720,
    alt: 'The ApplyReady signature resizer result for a 300 by 100 pixel signature with a 10 to 20 KB range: the file was padded to 10.00 KB without changing the picture, and every row of the check table is met.',
    async run(page, origin) {
      await resizerWith(page, origin, '/signature-resizer.html', null, sample('test-signature-cleaned.jpg'));
      await openSettings(page);
      await page.fill('#customMinKB', '10');
      await page.fill('#customMaxKB', '20');
      await settle(page, 300);
      await page.click('#btnProcess');
      await page.waitForSelector('#resultArea:not(.hidden)');
      await settle(page, 600);
      await top(page);
      await annotate(page, [['.check-table tbody tr:nth-child(1)', 'Minimum reached with padding', 'corner'], ['#btnDownload', 'Then download', 'corner']]);
      return regionOf(page, ['.ws-result__head', '.check-table']);
    }
  },

  /* ---- tutorial: merge PDF ---- */
  'tut-merge-order': {
    alt: 'Merge PDF in ApplyReady with a cover letter, a two-page mark sheet and a photo of a document in order, each with a drag handle, up and down buttons and a remove button.',
    async run(page, origin) {
      await page.goto(origin + '/merge-pdf.html');
      await page.setInputFiles('#mergeDropInput', [guideSample('sample-cover-letter.pdf'), guideSample('sample-marksheet.pdf'), guideSample('document-page-2.jpg')]);
      await page.waitForFunction(() => document.querySelectorAll('main .ws li').length >= 3 && /3 files/.test(document.querySelector('main .ws').textContent));
      await settle(page, 600);
      await top(page);
      const list = page.getByRole('list', { name: 'Files to merge, in order' });
      const id = await list.evaluate(l => { l.id = l.id || 'guideMergeList'; return l.id; });
      await annotate(page, [[`#${id} li:nth-child(1) button[aria-label^="Move sample-cover-letter.pdf,"]`, 'Drag by the handle', 'above'], [`#${id} li:nth-child(1) button[aria-label="Move sample-cover-letter.pdf down"]`, 'Or move with the arrows', 'left'], [`#${id} li:nth-child(3)`, 'A photo becomes one A4 page', 'below']]);
      return regionOf(page, [`#${id}`], 16);
    }
  },
  'tut-merge-password': {
    alt: 'The password window in ApplyReady Merge PDF for a protected certificate, with a Password field, a Show password option and the note that the password stays in this browser tab.',
    async run(page, origin) {
      await page.goto(origin + '/merge-pdf.html');
      await page.setInputFiles('#mergeDropInput', [guideSample('sample-cover-letter.pdf'), guideSample('sample-certificate-locked.pdf')]);
      const dialog = page.getByRole('dialog', { name: 'This PDF needs a password' });
      await dialog.waitFor();
      await dialog.getByLabel('Password', { exact: true }).fill('sample');
      await settle(page);
      const id = await dialog.evaluate(d => { d.id = d.id || 'guidePwDialog'; return d.id; });
      const pwId = await dialog.getByLabel('Password', { exact: true }).evaluate(i => { i.id = i.id || 'guidePw'; i.blur(); return i.id; });
      await top(page);
      const noteId = await dialog.getByText('The password is used only in this browser tab').evaluate(p => { p.id = p.id || 'guidePwNote'; return p.id; });
      await annotate(page, [[`#${pwId}`, 'The password of that file', 'corner'], [`#${noteId}`, 'It stays in this tab', 'corner']]);
      return regionOf(page, [`#${id}`], 16);
    }
  },
  'tut-merge-result': {
    alt: 'The result of Merge PDF in ApplyReady: your merged PDF is ready, with the page count, the number of files joined, the file size and the Download PDF button.',
    async run(page, origin) {
      await page.goto(origin + '/merge-pdf.html');
      await page.setInputFiles('#mergeDropInput', [guideSample('sample-cover-letter.pdf'), guideSample('sample-marksheet.pdf'), guideSample('document-page-2.jpg')]);
      await page.waitForFunction(() => /3 files/.test(document.querySelector('main .ws').textContent));
      await page.getByRole('button', { name: 'Merge files' }).click();
      const ready = page.getByRole('heading', { name: 'Your merged PDF is ready' });
      await ready.waitFor({ timeout: 60000 });
      await settle(page, 500);
      // Check the file independently of the page: the merged PDF has 1 + 2 + 1 pages.
      const link = page.getByRole('link', { name: 'Download PDF' });
      const [dl] = await Promise.all([page.waitForEvent('download'), link.click()]);
      const file = path.join(tmp, 'merged.pdf');
      await dl.saveAs(file);
      const head = fs.readFileSync(file).subarray(0, 5).toString();
      if (head !== '%PDF-') throw new Error('merged file is not a PDF');
      const pages = pdfPages(file);
      if (pages !== null && pages !== 4) throw new Error(`merged PDF has ${pages} pages, expected 4`);
      await top(page);
      await annotate(page, [['#mergeStatPages', 'Pages: 1 + 2 + 1', 'right'], ['#mergeDownload', 'Save the joined file', 'right']]);
      return regionOf(page, ['#mergeResult'], 16);
    }
  },

  /* ---- tutorial: batch ---- */
  'tut-batch-preset': {
    viewport: 1000,
    phone: { maxHeight: 1400 },
    alt: 'The batch image processor with six photos added and the Passport photo preset chosen, which sets an exact 350 by 450 pixel size, JPEG and a 50 KB maximum for every image.',
    async run(page, origin) {
      await page.goto(origin + '/batch-image.html');
      await page.setInputFiles('#batchApp input[type=file]', photoSet(6));
      await page.waitForFunction(() => document.querySelectorAll('#batchList li').length === 6);
      await setValue(page, 'bPreset', 'passport');
      await settle(page);
      await top(page);
      await annotate(page, [['.field:has(#bPreset)', 'Preset', 'corner'], ['.field:has(#bResize)', 'Exact size', 'corner'], ['.input-unit:has(#bMaxKB)', 'Limit', 'corner']]);
      return regionOf(page, ['#batchBar', '.input-unit:has(#bMaxKB)']);
    }
  },
  'tut-batch-progress': {
    moving: true,
    alt: 'The batch image processor while it works: a progress bar with how many images are finished, an estimate of the time left and a Cancel button.',
    async run(page, origin) {
      await page.goto(origin + '/batch-image.html');
      await page.setInputFiles('#batchApp input[type=file]', photoSet(24));
      await page.waitForFunction(() => document.querySelectorAll('#batchList li').length === 24);
      await setValue(page, 'bPreset', 'passport');
      await page.click('#btnBatchStart');
      await page.waitForFunction(() => window.ApplyReadyBatchImage.summary().done >= 3, null, { timeout: 60000, polling: 50 });
      await top(page);
      await annotate(page, [['#batchProgressText', 'How many are finished', 'above'], ['#btnBatchCancel', 'Stop; finished files are kept', 'left']]);
      const clip = await regionOf(page, ['#batchProgress'], 16);
      return clip;
    }
  },
  'tut-batch-cancelled': {
    alt: 'The batch image processor after Cancel: finished photos are kept and listed as Done, the rest are marked Cancelled, and a button offers to retry the failed and cancelled images.',
    phone: { maxHeight: 1400 },
    async run(page, origin) {
      // The tutorial's caption describes four finished and two cancelled. Photos are processed in
      // parallel, so the last two can finish in the same instant as the fourth, leaving nothing to cancel;
      // the run is repeated until the picture matches the caption (never the other way round).
      let s = null;
      for (let attempt = 1; attempt <= 6; attempt++) {
        await page.goto(origin + '/batch-image.html');
        await page.setInputFiles('#batchApp input[type=file]', photoSet(6));
        await page.waitForFunction(() => document.querySelectorAll('#batchList li').length === 6);
        await setValue(page, 'bPreset', 'passport');
        await page.click('#btnBatchStart');
        // Cancel from inside the page as soon as four are done: a click from here can arrive after the rest
        // have finished (on the phone layout it first scrolls the button into view), leaving nothing to cancel.
        await page.waitForFunction(() => {
          if (window.ApplyReadyBatchImage.summary().done < 4) return false;
          // A pointer press (detail 1): a keyboard-style click (detail 0) right after Start is ignored on
          // purpose, so that Enter held down on Start cannot cancel the run it just began.
          document.getElementById('btnBatchCancel').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }));
          return true;
        }, null, { timeout: 60000, polling: 10 });
        await batchIdle(page);
        s = await page.evaluate(() => window.ApplyReadyBatchImage.summary());
        if (s.done === 4 && s.total - s.done === 2) break;
      }
      if (s.done !== 4 || s.total - s.done !== 2) throw new Error(`cancelled batch has ${s.done} done of ${s.total} after 6 attempts; the caption expects 4 of 6`);
      await settle(page, 600);
      await top(page);
      await annotate(page, [['#btnBatchZip', 'Finished ones are kept', 'corner'], ['#btnBatchRetry', 'Run the rest again', 'corner'], ['#batchList [data-status="cancelled"]', 'Not processed', 'corner']]);
      return regionOf(page, ['#batchResult', '#batchList'], 16);
    }
  },
  'tut-batch-names': {
    alt: 'Batch results where two photos had the same file name: the second result is named photo (2).jpg, and a damaged file is marked Failed with the reason in its row.',
    async run(page, origin) {
      const a = fs.mkdtempSync(path.join(tmp, 'a-')), b = fs.mkdtempSync(path.join(tmp, 'b-'));
      fs.copyFileSync(guideSample('photo-applicant-1.jpg'), path.join(a, 'photo.jpg'));
      fs.copyFileSync(guideSample('photo-applicant-2.jpg'), path.join(b, 'photo.jpg'));
      // A download cut short: the JPEG header is there, most of the picture is not.
      const broken = path.join(a, 'scan-cut-off.jpg');
      fs.writeFileSync(broken, fs.readFileSync(guideSample('photo-applicant-3.jpg')).subarray(0, 3000));
      await page.goto(origin + '/batch-image.html');
      await page.setInputFiles('#batchApp input[type=file]', [path.join(a, 'photo.jpg'), path.join(b, 'photo.jpg'), broken]);
      await page.waitForFunction(() => document.querySelectorAll('#batchList li').length >= 2);
      await setValue(page, 'bPreset', 'passport');
      await page.click('#btnBatchStart');
      await batchIdle(page);
      await settle(page, 600);
      await top(page);
      const notes = [['#batchList li:nth-child(2)', 'Same name: (2) is added', 'corner']];
      if (await page.locator('#batchList [data-status="error"]').count()) notes.push(['#batchList [data-status="error"]', 'Failed, with the reason', 'corner']);
      await annotate(page, notes);
      return regionOf(page, ['#batchResult', '#batchList'], 16);
    }
  },

  /* ---- tutorial: privacy on a shared computer ---- */
  'tut-privacy-saving-off': {
    alt: 'The Keep your work panel of the ApplyReady resume builder with Save on this device switched off and the status Not saved: saving is off on this device.',
    async run(page, origin) {
      await resumePage(page, origin);
      await page.click('#tabDownload');
      await settle(page, 300);
      await page.locator('#chkSaveDevice').click();
      await page.waitForFunction(() => /saving is off/.test(document.getElementById('saveDeviceStatus').textContent));
      await page.fill('#fullName', 'Priya Sharma').catch(() => {});
      await settle(page);
      await page.locator('#keepHeading').scrollIntoViewIfNeeded();
      await annotate(page, [['label[for="chkSaveDevice"]', 'Off before you type', 'right'], ['#saveDeviceStatus', 'Nothing is stored', 'right']]);
      return regionOf(page, ['#keepHeading', '.rb-backup']);
    }
  },
  'tut-yourdata-delete': {
    viewport: 720,
    alt: 'The Delete everything section of the ApplyReady Your data page, which removes saved resumes, settings, the recently used list and the offline copy from this browser.',
    async run(page, origin) {
      await page.goto(origin + '/your-data.html');
      await settle(page, 800);
      const section = page.locator('section', { has: page.locator('h2', { hasText: 'Delete everything' }) });
      const id = await section.evaluate(s => { s.id = s.id || 'guideDeleteAll'; return s.id; });
      await section.scrollIntoViewIfNeeded();
      await annotate(page, [[`#${id} button`, 'Asks first; cannot be undone', 'right']]);
      return regionOf(page, [`#${id}`], 16);
    }
  }
};

// One capture in a fresh browser profile. Writes the WebP and returns its pixel size and byte count.
async function capture(browser, origin, contextOptions, steps, maxHeight, file, phone = false, moving = false) {
  const context = await browser.newContext({ ...contextOptions, colorScheme: 'light', acceptDownloads: true });
  await context.route('**/*', r => (r.request().url().startsWith(origin) || /^(data|blob):/.test(r.request().url()) ? r.continue() : r.abort()));
  // Sticky bars would be painted mid-image in a full-page capture; keep them in the flow.
  // The skip link and the passing notification are not part of what a guide shows, and neither is the
  // resume builder's fixed phone bar (Edit, Preview, Download), which would float over the picture.
  await context.addInitScript(phone => document.addEventListener('DOMContentLoaded', () => {
    const st = document.createElement('style');
    st.textContent = '.site-header,.rb-steps,.rb-preview__bar,.ws-action{position:static!important}.skip-link,.task-notification{display:none!important}*{caret-color:transparent!important}' + (phone ? '.rb-bar{display:none!important}' : '');
    document.head.appendChild(st);
  }), phone);
  try {
  const page = await context.newPage();
  let clip = await steps(page, origin, { phone });
  // A full-page capture makes the window as tall as the page. Content that waits until it is in view
  // (PDF thumbnails, lazy images) then appears, and a late autosave or a growing text box can move what
  // is below it, so the callouts would no longer sit on their elements. Give the window the page's
  // height first, wait until the marked elements stop moving, then draw the callouts and measure the
  // region again.
  const { notes, region } = drawn.get(page) || {};
  const selectors = [...(notes || []).map(n => n[0]), ...(region ? region[0] : [])];
  const layout = () => page.evaluate(selectors => selectors.map(sel => {
    const el = document.querySelector(sel), r = el && el.getBoundingClientRect();
    return r ? [r.left + scrollX, r.top + scrollY, r.height].map(Math.round).join(',') : '-';
  }).join('|') + '|' + document.documentElement.scrollHeight, selectors);
  const vpWidth = page.viewportSize().width, minHeight = page.viewportSize().height;
  let before = null;
  // A shot of work in progress (moving: true) cannot wait: it is measured once, right away.
  for (let i = 0; i < (moving ? 1 : 8); i++) {
    const full = await page.evaluate(() => document.documentElement.scrollHeight);
    if (full !== page.viewportSize().height && full > minHeight) await page.setViewportSize({ width: vpWidth, height: full });
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    if (moving) break;
    await page.waitForTimeout(300);
    const now = await layout();
    if (now === before) break;
    before = now;
  }
  if (notes) await annotate(page, notes);
  if (region) clip = await regionOf(page, ...region);
  const fullHeight = clip.height;
  clip.height = Math.min(clip.height, maxHeight);
  // Every numbered callout must be in the picture, or the caption points at something the reader cannot see.
  const cut = await page.evaluate(clip => {
    const layer = document.getElementById('guideNotes');
    return layer ? [...layer.children].filter(el => {
      const r = el.getBoundingClientRect(), top = r.top + scrollY, left = r.left + scrollX;
      return top < clip.y - 1 || left < clip.x - 1 || top + r.height > clip.y + clip.height + 1 || left + r.width > clip.x + clip.width + 1;
    }).map(el => el.textContent || 'a highlight box') : [];
  }, clip);
  if (cut.length) throw new Error(`callout outside the picture (${cut.join('; ')}); the region is ${fullHeight} px tall and the limit is ${maxHeight} px: allow a taller picture (maxHeight) or choose a smaller region`);
  const png = await page.screenshot({ clip, fullPage: true, animations: 'disabled' });
  // Encode as WebP in the browser itself, so no image library is needed.
  const [b64, width, height] = await page.evaluate(async b64 => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
    c.getContext('2d').drawImage(img, 0, 0);
    return [c.toDataURL('image/webp', 0.8).split(',')[1], c.width, c.height];
  }, png.toString('base64'));
  const webp = Buffer.from(b64, 'base64');
  fs.writeFileSync(file, webp);
  return { width, height, bytes: webp.length };
  } finally { await context.close(); }
}

// Write the markup that shows each screenshot, wherever a page shows one:
// - the width and height from the manifest, so the layout reserves the right space, and its alt text;
// - a <picture> with the phone capture for narrow windows, when the shot has one. Its width and
//   height are in CSS pixels (the file is 2x), so it is shown at the size it was taken and stays sharp.
// tests/guides_tests.js checks that pages, manifest and files agree.
function syncPages(manifest) {
  const pages = [...fs.readdirSync(root).filter(f => f.endsWith('.html')), ...fs.readdirSync(path.join(root, 'guides')).filter(f => f.endsWith('.html')).map(f => 'guides/' + f)];
  // A screenshot that links to itself says so under the picture, so a reader knows it can be enlarged.
  const FULL = /<a class="shot__full" href="([^"]+)">(<picture>[\s\S]*?<\/picture>|<img\b[^>]*>)(?:<span class="shot__zoom">[\s\S]*?<\/span>)?<\/a>/g;
  const IMG = /(?:<picture><source\b[^>]*>)?(<img\b[^>]*\bsrc="((?:\.\.\/)?)img\/guides\/([a-z0-9-]+)\.webp"[^>]*>)(?:<\/picture>)?/g;
  for (const page of pages) {
    const file = path.join(root, page);
    const html = fs.readFileSync(file, 'utf8');
    const next = html.replace(IMG, (all, tag, prefix, name) => {
      const m = manifest[name];
      if (!m) return all;
      const img = tag.replace(/\bwidth="\d+"/, `width="${m.width}"`).replace(/\bheight="\d+"/, `height="${m.height}"`).replace(/\balt="[^"]*"/, `alt="${m.alt.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"`);
      if (!m.phone) return img;
      const p = m.phone;
      return `<picture><source media="${PHONE_MEDIA}" srcset="${prefix}${p.file}" width="${Math.round(p.width / p.scale)}" height="${Math.round(p.height / p.scale)}">${img}</picture>`;
    }).replace(FULL, (all, href, shown) => `<a class="shot__full" href="${href}">${shown}${ZOOM_HINT}</a>`);
    if (next !== html) { fs.writeFileSync(file, next); console.log(`updated screenshot markup in ${page}`); }
  }
}

(async () => {
  // --sync only rewrites the screenshot markup in the pages from the manifest; no browser is needed.
  if (process.argv.includes('--sync')) {
    syncPages(JSON.parse(fs.readFileSync(path.join(out, 'manifest.json'), 'utf8')));
    fs.rmSync(tmp, { recursive: true, force: true });
    return;
  }
  for (const f of ['photo-applicant-1.jpg', 'document-page-1.jpg', 'sample-marksheet.pdf', 'sample-certificate-locked.pdf']) {
    if (!fs.existsSync(guideSample(f))) throw new Error(`missing img/samples/guide/${f}: run python3 scripts/make-sample-images.py and node scripts/make-sample-pdfs.js`);
  }
  fs.mkdirSync(out, { recursive: true });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const exe = process.env.BROWSER_EXECUTABLE_PATH;
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'], ...(exe ? { executablePath: exe } : {}) });
  const args = process.argv.slice(2);
  const mode = args.includes('--phone') ? 'phone' : args.includes('--desktop') ? 'desktop' : 'both';
  const wanted = args.filter(a => !a.startsWith('--'));
  const unknown = wanted.filter(w => !SHOTS[w]);
  if (unknown.length) throw new Error(`unknown shot: ${unknown.join(', ')}`);
  const manifestFile = path.join(out, 'manifest.json');
  const manifest = fs.existsSync(manifestFile) ? JSON.parse(fs.readFileSync(manifestFile, 'utf8')) : {};
  for (const name of Object.keys(manifest)) if (!SHOTS[name]) delete manifest[name];
  // A phone picture whose shot is gone, or no longer has one, is removed with it.
  if (fs.existsSync(outPhone)) {
    for (const f of fs.readdirSync(outPhone)) {
      const shot = SHOTS[f.replace(/\.webp$/, '')];
      if (!shot || shot.phone === false) fs.rmSync(path.join(outPhone, f));
    }
    for (const [name, m] of Object.entries(manifest)) if (m.phone && SHOTS[name].phone === false) delete m.phone;
  }
  const writeManifest = () => {
    const sorted = Object.fromEntries(Object.keys(manifest).sort().map(k => [k, manifest[k]]));
    fs.writeFileSync(manifestFile, JSON.stringify(sorted, null, 1) + '\n');
  };
  const failed = [];
  for (const [name, shot] of Object.entries(SHOTS)) {
    if (wanted.length && !wanted.includes(name)) continue;
    const entry = manifest[name] || {};
    if (mode !== 'phone') {
      // A shot may use a narrower window (shot.viewport), so that a wide tool reflows into a picture that
      // fits the guide column without being scaled down until its text is unreadable.
      const img = await capture(browser, origin, { viewport: { width: shot.viewport || 1280, height: 900 }, deviceScaleFactor: 1 }, shot.run, shot.maxHeight || 900, path.join(out, name + '.webp'), false, shot.moving);
      Object.assign(entry, { file: `img/guides/${name}.webp`, width: img.width, height: img.height, alt: shot.alt, bytes: img.bytes });
      console.log(`${name}.webp ${img.width}x${img.height} ${(img.bytes / 1024).toFixed(1)} KB`);
    }
    if (mode !== 'desktop') {
      if (shot.phone === false) delete entry.phone;
      else {
        fs.mkdirSync(outPhone, { recursive: true });
        const steps = (shot.phone && shot.phone.run) || shot.run;
        const maxHeight = (shot.phone && shot.phone.maxHeight) || 1000;
        let img;
        try {
          img = await capture(browser, origin, { viewport: { width: PHONE.width, height: PHONE.height }, deviceScaleFactor: PHONE.scale, isMobile: true, hasTouch: true }, steps, maxHeight, path.join(outPhone, name + '.webp'), true, shot.moving);
        } catch (e) {
          // Keep going, so one run shows every shot whose steps do not work in the phone layout.
          failed.push(`${name} (phone): ${e.message.split('\n')[0]}`);
          console.error(`phone/${name}.webp failed: ${e.message.split('\n')[0]}`);
        }
        if (img) {
          entry.phone = { file: `img/guides/phone/${name}.webp`, width: img.width, height: img.height, scale: PHONE.scale, bytes: img.bytes };
          console.log(`phone/${name}.webp ${img.width}x${img.height} ${(img.bytes / 1024).toFixed(1)} KB`);
        }
      }
    }
    manifest[name] = entry;
    // Written after every shot, so a later failure never leaves the manifest behind the files.
    writeManifest();
  }
  syncPages(manifest);
  await browser.close();
  server.close();
  fs.rmSync(tmp, { recursive: true, force: true });
  if (failed.length) { console.error(`${failed.length} capture(s) failed:\n  ${failed.join('\n  ')}`); process.exit(1); }
})().catch(e => { console.error(e); fs.rmSync(tmp, { recursive: true, force: true }); process.exit(1); });
