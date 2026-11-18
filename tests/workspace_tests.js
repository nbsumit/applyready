/* Browser tests for applicant workspaces (workspace.html).
   Two applicants with their own generated files go through the operator's journey: photo, signature,
   combined scans, PDF compression and merging, downloads and ZIP, switching back and forth (also while
   a job runs), finishing one applicant with results not yet downloaded, and ending the session.
   Outputs are verified independently (identify, pdfinfo, unzip -t). Privacy checks: after finishing,
   nothing of that applicant is left in the DOM, their blob URLs no longer fetch, and no workspace data
   is in localStorage, sessionStorage, IndexedDB or Cache Storage. Also 320 px layout and axe in both
   themes. Run with BROWSER_EXECUTABLE_PATH set to a local Chromium. */
'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { chromium } = require('playwright');
const AxeBuilder = require('@axe-core/playwright').default;
const PDFLib = require('../js/vendor/pdf-lib.min.js');

const root = path.resolve(__dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'workspace-'));
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.wasm': 'application/wasm', '.bcmap': 'application/octet-stream' };
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const file = path.resolve(root, '.' + (pathname.endsWith('/') ? pathname + 'index.html' : pathname));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (e, d) => { res.writeHead(e ? 404 : 200, { 'Content-Type': e ? 'text/html' : mime[path.extname(file)] || 'application/octet-stream' }); res.end(e ? fs.readFileSync(path.join(root, '404.html')) : d); });
});
let checks = 0;
const ok = (c, m) => { assert(c, m); checks++; };
const run = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8' });
const fx = name => path.join(tmp, name);

// Applicant names and file names that appear nowhere on the page itself, so their absence is meaningful.
const A = { name: 'Ishaan Mehra', files: ['ishaan-photo.jpg', 'ishaan-sign.png', 'ishaan-cert-1.jpg', 'ishaan-cert-2.jpg', 'ishaan-cert-3.jpg'] };
const B = { name: 'Noor Fatima', files: ['noor-photo.png', 'noor-scan.pdf', 'noor-marks.pdf', 'noor-id.pdf'] };

/* ------------------------------------------------------------------ fixtures */
async function makeFixtures() {
  execFileSync('python3', ['-c', `
import random
from PIL import Image, ImageDraw
im = Image.new('RGB', (1200, 1600), (196, 172, 150)); d = ImageDraw.Draw(im); d.ellipse((380, 300, 820, 860), fill=(110, 76, 58)); d.rectangle((300, 900, 900, 1600), fill=(40, 60, 120))
im.save(${JSON.stringify(fx('ishaan-photo.jpg'))}, quality=92)
s = Image.new('RGBA', (900, 400), (0, 0, 0, 0)); d = ImageDraw.Draw(s); d.line((60, 300, 840, 90), fill=(10, 10, 70, 255), width=14); d.line((100, 120, 500, 330), fill=(10, 10, 70, 255), width=10)
s.save(${JSON.stringify(fx('ishaan-sign.png'))})
for i in range(3):
    random.seed(i)
    c = Image.new('RGB', (2480, 3508), (252, 252, 248)); d = ImageDraw.Draw(c)
    for k in range(500):
        x = random.randint(0, 2300); y = random.randint(0, 3300)
        d.rectangle((x, y, x + random.randint(10, 180), y + random.randint(10, 200)), outline=(random.randint(0, 255), random.randint(0, 90), 0), width=3)
    c.save(${JSON.stringify(tmp)} + '/ishaan-cert-%d.jpg' % (i + 1), quality=90)
p = Image.new('RGB', (800, 1000)); px = p.load()
for y in range(1000):
    for x in range(800):
        px[x, y] = ((x * 3 + y) % 256, (y * 7) % 256, (x * y) % 256)
p.save(${JSON.stringify(fx('noor-photo.png'))})
`]);
  // A scanned-looking PDF over 500 KB (one big picture per page), a two-page text PDF and a one-page one.
  const scan = await PDFLib.PDFDocument.create();
  const jpg = await scan.embedJpg(fs.readFileSync(fx('ishaan-cert-1.jpg')));
  for (let i = 0; i < 2; i++) { const p = scan.addPage([595.28, 841.89]); p.drawImage(jpg, { x: 0, y: 0, width: 595.28, height: 841.89 }); }
  fs.writeFileSync(fx('noor-scan.pdf'), await scan.save());
  const marks = await PDFLib.PDFDocument.create();
  for (let i = 0; i < 2; i++) marks.addPage([595.28, 841.89]).drawText(`Marksheet page ${i + 1}`, { x: 60, y: 760, size: 22 });
  fs.writeFileSync(fx('noor-marks.pdf'), await marks.save());
  const id = await PDFLib.PDFDocument.create();
  id.addPage([612, 792]).drawText('Identity card', { x: 60, y: 700, size: 22 });
  fs.writeFileSync(fx('noor-id.pdf'), await id.save());
  const locked = await PDFLib.PDFDocument.create();
  locked.addPage([595.28, 841.89]).drawText('Protected certificate', { x: 60, y: 760, size: 22 });
  await locked.encrypt({ userPassword: 'open sesame', ownerPassword: 'owner', permissions: {} });
  fs.writeFileSync(fx('tara-locked.pdf'), await locked.save());
  fs.writeFileSync(fx('notes.txt'), 'This is a plain text file, not a picture.\n');
  fs.writeFileSync(fx('broken.pdf'), fs.readFileSync(fx('noor-marks.pdf')).subarray(0, 300));
}

(async () => {
  await makeFixtures();
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const exe = process.env.BROWSER_EXECUTABLE_PATH;
  const browser = await chromium.launch({ headless: true, ...(exe ? { executablePath: exe } : {}), args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const newContext = async (opts) => {
    const context = await browser.newContext(Object.assign({ viewport: { width: 1280, height: 900 }, acceptDownloads: true }, opts || {}));
    await context.route('**/*', r => /^(http:\/\/127\.|blob:|data:)/.test(r.request().url()) ? r.continue() : r.abort());
    return context;
  };
  const errors = [];
  const watch = page => {
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (/Content Security Policy|Refused to/.test(m.text())) errors.push(m.text()); });
  };
  const download = async (page, click) => {
    const [d] = await Promise.all([page.waitForEvent('download'), click()]);
    const file = path.join(tmp, `${Date.now()}-${d.suggestedFilename()}`);
    await d.saveAs(file);
    return { file, name: d.suggestedFilename() };
  };
  const axe = async (page, label) => {
    for (const scheme of ['light', 'dark']) {
      await page.evaluate(s => { document.documentElement.dataset.theme = s; }, scheme);
      await page.waitForTimeout(400);
      const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
      ok(result.violations.length === 0, `${label} (${scheme}): axe violations ${result.violations.map(v => `${v.id}: ${v.nodes.slice(0, 3).map(n => n.target.join(' ')).join(', ')}`).join('; ')}`);
    }
    await page.evaluate(() => { document.documentElement.dataset.theme = 'light'; });
  };
  const noOverflow = async (page, label) => {
    const w = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    ok(w <= 0, `${label}: no horizontal scroll (${w}px)`);
  };
  const state = page => page.evaluate(() => window.ApplyReadyWorkspace.state);
  const waitState = (page, fn, arg, timeout) => page.waitForFunction(new Function('arg', `const s = window.ApplyReadyWorkspace.state; return (${fn})(s, arg);`), arg, { timeout: timeout || 90000 });
  const row = (page, name) => page.locator('#wkFiles .wk-file', { has: page.locator('.file-row__name', { hasText: name }) });
  const resultRow = (page, name) => page.locator('#wkResults .wk-result', { has: page.locator('.file-row__name', { hasText: name }) });
  const unloadWarns = page => page.evaluate(() => { const e = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(e); return e.defaultPrevented; });
  // Everything a person or script could find in the page: markup, visible text and form values.
  const pageDump = page => page.evaluate(() => document.documentElement.outerHTML + '\n' + document.body.innerText + '\n' +
    Array.from(document.querySelectorAll('input, textarea, select')).map(x => x.value).join('\n'));
  const blobUrls = page => page.evaluate(() => Array.from(document.querySelectorAll('[src^="blob:"], [href^="blob:"]')).map(x => x.getAttribute('src') || x.getAttribute('href')));
  const fetchable = (page, urls) => page.evaluate(async list => Promise.all(list.map(u => fetch(u).then(r => r.ok, () => false))), urls);
  const today = () => { const d = new Date(); const t = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${t(d.getMonth() + 1)}-${t(d.getDate())}`; };
  const kb = file => fs.statSync(file).size / 1024;
  const identify = file => run('identify', ['-format', '%m %w %h', file]).trim();
  const pdfPages = file => Number((run('pdfinfo', [file]).match(/Pages:\s+(\d+)/) || [])[1]);

  /* ================================================================== page content */
  {
    const html = fs.readFileSync(path.join(root, 'workspace.html'), 'utf8');
    for (const n of [A.name, B.name, 'ishaan', 'noor']) ok(!html.toLowerCase().includes(n.toLowerCase()), `the page itself never contains the test name ${n}`);
    const ld = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
    const faq = ld['@graph'].find(x => x['@type'] === 'FAQPage').mainEntity.map(q => [q.name, q.acceptedAnswer.text]);
    const context = await newContext();
    const page = await context.newPage();
    await page.goto(origin + '/workspace.html');
    const visible = await page.$$eval('.faq-item', items => items.map(i => [i.querySelector('.faq-question span').textContent.trim(), i.querySelector('.faq-answer').textContent.trim()]));
    ok(JSON.stringify(visible) === JSON.stringify(faq) && faq.length >= 5, `visible FAQ matches FAQPage data (${faq.length} questions)`);
    const crumbs = await page.$$eval('.breadcrumb-item', li => li.map(x => x.textContent.trim()));
    ok(JSON.stringify(crumbs) === JSON.stringify(['Home', 'Cyber cafe tools', 'Applicant workspaces']), `breadcrumb ${crumbs}`);
    await context.close();
  }

  /* ================================================================== the operator's journey */
  {
    const context = await newContext();
    const page = await context.newPage();
    watch(page);
    await page.goto(origin + '/workspace.html');

    // Start screen
    const banner = (await page.locator('#wkBanner').innerText()).replace(/\s+/g, ' ').trim();
    ok(banner === 'Temporary workspace: nothing is saved. Closing or reloading this tab erases every applicant’s files.', `privacy banner: ${banner}`);
    ok(await page.locator('#wkStart').isVisible() && !(await page.locator('#wkSession').isVisible()), 'start screen first');
    ok(!(await page.locator('#wkSettings').evaluate(d => d.open)), 'session settings start collapsed');
    ok(/Photo 350 × 450 px, 50 KB · Signature 300 × 100 px, 30 KB · PDF 500 KB/.test(await page.locator('#wkSettingsSummary').innerText()), 'settings summary shows the defaults');
    ok(!(await unloadWarns(page)), 'no reload warning before any file is added');
    await axe(page, 'start screen');
    await page.locator('#wkSettings summary').click();
    await axe(page, 'start screen with settings open');
    await page.locator('#wkSettings summary').click();

    // Applicant 1
    await page.click('#wkStartBtn');
    ok(await page.locator('#wkSession').isVisible(), 'the session opens');
    ok(await page.evaluate(() => document.activeElement.id) === 'wkName', 'focus goes to the name field');
    ok(await page.locator('[role="tab"][aria-selected="true"] .wk-tab__name').innerText() === 'Applicant 1', 'the first applicant is called Applicant 1');
    await page.fill('#wkName', A.name);
    ok(await page.locator('[role="tab"][aria-selected="true"] .wk-tab__name').innerText() === A.name, 'the tab follows the typed name');
    ok(await page.getAttribute('#wkName', 'autocomplete') === 'off' && await page.getAttribute('#wkName', 'spellcheck') === 'false', 'the name field does not feed autofill history or spellcheck services');
    await page.setInputFiles('#wkDropInput', A.files.map(fx));
    await waitState(page, s => s.applicants[0].files === 5);
    await page.waitForFunction(() => document.querySelectorAll('#wkFiles .file-row__thumb img').length === 5);
    ok(/1200 × 1600 px/.test(await row(page, 'ishaan-photo.jpg').locator('.file-row__meta').innerText()), 'file rows show pixel size');
    ok(await unloadWarns(page), 'reload warning once files are present');

    // Invalid settings stop an action and point at the field
    await page.locator('#wkSettings summary').click();
    await page.fill('#wkPhotoW', '5');
    await page.locator('#wkSettings summary').click();
    await row(page, 'ishaan-photo.jpg').locator('[data-act="run:photo"]').click();
    ok(await page.locator('#wkSettings').evaluate(d => d.open) && await page.evaluate(() => document.activeElement.id) === 'wkPhotoW', 'an invalid setting opens the settings and focuses the field');
    ok(/from 16 to/.test(await page.locator('#wkPhotoWError').innerText()) && (await state(page)).applicants[0].running === 0, 'the field says what is wrong and no job starts');
    await page.fill('#wkPhotoW', '350');
    await page.locator('#wkSettings summary').click();

    // Wrong file types are refused inline, a damaged PDF is listed with its problem
    await page.setInputFiles('#wkDropInput', [fx('notes.txt'), fx('broken.pdf')]);
    await page.waitForFunction(() => !document.getElementById('wkErrors').hidden);
    ok(/notes\.txt is a plain text file/.test(await page.locator('#wkErrors').innerText()), 'a text file is refused with the reason');
    await page.waitForFunction(() => /incomplete|damaged/.test(document.getElementById('wkFiles').innerText));
    ok(await row(page, 'broken.pdf').locator('[data-act^="run:"]').count() === 0, 'a damaged PDF offers no actions');
    await row(page, 'broken.pdf').locator('[data-act="remove"]').click();
    await page.click('#wkErrorClose');
    ok(await page.locator('#wkErrors').isHidden() && (await state(page)).applicants[0].files === 5, 'errors dismissed and the damaged file removed');

    // Photo, signature and three scans combined into one PDF under 500 KB
    await row(page, 'ishaan-photo.jpg').locator('[data-act="run:photo"]').click();
    await row(page, 'ishaan-sign.png').locator('[data-act="run:signature"]').click();
    for (const n of ['ishaan-cert-1.jpg', 'ishaan-cert-2.jpg', 'ishaan-cert-3.jpg']) await row(page, n).locator('[data-act="select"]').check();
    ok(/3 selected/.test(await page.locator('#wkSelText').innerText()) && await page.locator('#wkCombineLabel').innerText() === 'Combine into one PDF', 'selecting pictures offers Combine into one PDF');
    await page.click('#wkCombine');
    await page.waitForSelector('#wkJobs .wk-job');
    ok(await page.locator('#wkJobs .progress[role="progressbar"]').count() >= 1, 'running jobs show progress bars');

    // Switch while the combine job runs: its result must land with applicant 1 only
    await waitState(page, s => s.applicants[0].running >= 1, null, 5000);
    await page.click('#wkNew');
    ok(await page.locator('[role="tab"]').count() === 2, 'a second applicant tab');
    ok(await page.locator('#wkFiles .wk-file').count() === 0 && await page.locator('#wkResults .wk-result').count() === 0 && await page.locator('#wkJobs .wk-job').count() === 0, 'the new applicant starts with nothing on screen');
    ok(await page.inputValue('#wkName') === '', 'the name field is empty for the new applicant');
    await page.fill('#wkName', B.name);
    await page.setInputFiles('#wkDropInput', B.files.map(fx));
    await waitState(page, s => s.applicants[1].files === 4);
    await page.waitForFunction(() => !/counting pages/.test(document.getElementById('wkFiles').innerText));
    await waitState(page, s => s.applicants[0].running === 0 && s.applicants[0].results === 3);
    let st = await state(page);
    ok(st.applicants[1].results === 0, 'a job finishing for applicant 1 adds nothing to applicant 2');
    let dump = await page.locator('#wkPanel').evaluate(p => p.innerText + p.innerHTML);
    ok(!/ishaan/i.test(dump) && !dump.includes(A.name), 'applicant 2’s panel never shows applicant 1’s names or files');
    ok(await page.locator(`#wkTab-${st.applicants[0].id} .wk-tab__meta`).innerText() === '5 files · Ready', 'applicant 1’s tab shows it is ready');
    ok(/2 pages/.test(await row(page, 'noor-marks.pdf').locator('.file-row__meta').innerText()), 'PDF rows show the page count');

    // Applicant 2: compress a PDF to the limit, merge two PDFs, compress a picture to 100 KB
    await row(page, 'noor-scan.pdf').locator('[data-act="run:pdf"]').click();
    await row(page, 'noor-photo.png').locator('[data-act="run:compress"]').click();
    await row(page, 'noor-marks.pdf').locator('[data-act="select"]').check();
    await row(page, 'noor-id.pdf').locator('[data-act="select"]').check();
    ok(await page.locator('#wkCombineLabel').innerText() === 'Merge PDFs', 'selecting PDFs offers Merge PDFs');
    await page.click('#wkCombine');
    await waitState(page, s => s.applicants[1].running === 0 && s.applicants[1].results === 3);
    st = await state(page);
    ok(st.applicants[0].results === 3 && st.applicants[1].results === 3, 'each applicant has exactly its own three results');
    ok(/0 of 3 results downloaded/.test(await page.locator('#wkTally').innerText()), 'completion shows 0 of 3');
    ok(await page.locator('#wkZip').evaluate(b => b.classList.contains('btn-primary')) && !(await page.locator('#wkFinish').evaluate(b => b.classList.contains('btn-primary'))), 'the ZIP is the primary action while results wait');
    await axe(page, 'applicant with files, jobs done and results');

    // ZIP for applicant 2, named from the pattern
    const zip = await download(page, () => page.click('#wkZip'));
    ok(zip.name === `Noor-Fatima-${today()}.zip`, `ZIP named from the pattern (${zip.name})`);
    ok(/No errors detected/.test(run('unzip', ['-t', zip.file])), 'the ZIP passes unzip -t');
    const listed = run('unzip', ['-Z1', zip.file]).trim().split('\n').sort();
    ok(JSON.stringify(listed) === JSON.stringify(['noor-marks-merged.pdf', 'noor-photo-100kb.png', 'noor-scan-500kb.pdf']), `ZIP holds applicant 2’s results only: ${listed}`);
    const out = path.join(tmp, 'zip-out');
    run('unzip', ['-o', '-q', zip.file, '-d', out]);
    ok(pdfPages(path.join(out, 'noor-scan-500kb.pdf')) === 2 && kb(path.join(out, 'noor-scan-500kb.pdf')) <= 500, `compressed PDF keeps 2 pages and is under 500 KB (${kb(path.join(out, 'noor-scan-500kb.pdf')).toFixed(1)} KB)`);
    ok(pdfPages(path.join(out, 'noor-marks-merged.pdf')) === 3 && /Marksheet page 1[\s\S]*Identity card/.test(run('pdftotext', [path.join(out, 'noor-marks-merged.pdf'), '-'])), 'merged PDF has 3 pages in list order with its text intact');
    const png = identify(path.join(out, 'noor-photo-100kb.png')).split(' ');
    ok(png[0] === 'PNG' && kb(path.join(out, 'noor-photo-100kb.png')) <= 100, `compressed picture keeps its format and is under 100 KB (${png.join(' ')}, ${kb(path.join(out, 'noor-photo-100kb.png')).toFixed(1)} KB)`);
    await page.waitForFunction(() => /All 3 results downloaded/.test(document.getElementById('wkTally').innerText));
    ok(await page.locator('#wkFinish').evaluate(b => b.classList.contains('btn-primary')), 'Finish becomes the primary action once everything is downloaded');
    ok(await page.locator('#wkResults .wk-result__status[data-downloaded="true"]').count() === 3, 'every result is marked downloaded');

    // Back to applicant 1 with one click: only applicant 1's work is shown
    st = await state(page);
    const aId = st.applicants[0].id, bId = st.applicants[1].id;
    await page.click(`#wkTab-${aId}`);
    ok(await page.inputValue('#wkName') === A.name, 'switching back restores applicant 1’s name');
    dump = await page.locator('#wkPanel').evaluate(p => p.innerText + p.innerHTML);
    ok(!/noor/i.test(dump) && !dump.includes(B.name), 'applicant 1’s panel never shows applicant 2’s names or files');
    ok(await page.locator('#wkFiles .wk-file').count() === 5 && await page.locator('#wkResults .wk-result').count() === 3, 'applicant 1’s five files and three results');
    // Keyboard: arrow keys move between applicants
    await page.focus(`#wkTab-${aId}`);
    await page.keyboard.press('ArrowRight');
    ok(await page.evaluate(() => document.activeElement.id) === `wkTab-${bId}` && await page.inputValue('#wkName') === B.name, 'arrow keys switch applicants');
    await page.keyboard.press('ArrowLeft');
    ok(await page.inputValue('#wkName') === A.name, 'and back');

    // Verify applicant 1's outputs: photo and combined PDF downloaded one by one, signature read from its link
    const photo = await download(page, () => resultRow(page, 'ishaan-photo-photo.jpg').locator('[data-act="download"]').click());
    ok(identify(photo.file) === 'JPEG 350 450' && kb(photo.file) <= 50, `passport photo is 350 × 450 JPEG under 50 KB (${identify(photo.file)}, ${kb(photo.file).toFixed(1)} KB)`);
    const combined = await download(page, () => resultRow(page, 'ishaan-cert-1-combined.pdf').locator('[data-act="download"]').click());
    ok(pdfPages(combined.file) === 3 && kb(combined.file) <= 500, `combined scans: 3 pages under 500 KB (${kb(combined.file).toFixed(1)} KB)`);
    ok(/595\.\d* x 841\.\d* pts \(A4\)/.test(run('pdfinfo', [combined.file])), 'combined scans are on A4 pages');
    const sigHref = await resultRow(page, 'ishaan-sign-signature.jpg').locator('[data-act="download"]').getAttribute('href');
    const sigBytes = await page.evaluate(async u => Array.from(new Uint8Array(await (await fetch(u)).arrayBuffer())), sigHref);
    fs.writeFileSync(fx('sig-out.jpg'), Buffer.from(sigBytes));
    ok(identify(fx('sig-out.jpg')) === 'JPEG 300 100' && kb(fx('sig-out.jpg')) <= 30, `signature is 300 × 100 JPEG under 30 KB (${identify(fx('sig-out.jpg'))})`);
    ok(/2 of 3 results downloaded/.test(await page.locator('#wkTally').innerText()), 'completion shows 2 of 3');
    ok(await page.locator('#wkZipLabel').innerText() === `Download all for ${A.name} (ZIP)`, 'the ZIP button names the applicant');

    // Cancel a running job: nothing is added
    for (const n of ['ishaan-cert-1.jpg', 'ishaan-cert-2.jpg', 'ishaan-cert-3.jpg']) await row(page, n).locator('[data-act="select"]').check();
    await page.click('#wkCombine');
    await page.locator('#wkJobs [data-act="cancel"]').click();
    await waitState(page, s => s.applicants[0].running === 0, null, 30000);
    ok((await state(page)).applicants[0].results === 3, 'a cancelled job adds no result');

    // Finish applicant 1 with a result not downloaded: a danger confirmation naming the count
    const aUrls = await blobUrls(page);
    ok(aUrls.length >= 8, `applicant 1 has thumbnails and result links on screen (${aUrls.length})`);
    ok((await fetchable(page, aUrls)).every(Boolean), 'applicant 1’s blob URLs work before finishing');
    await page.click('#wkFinish');
    const dialog = page.locator('.dialog--confirm');
    await dialog.waitFor();
    const dialogText = await dialog.innerText();
    ok(/1 of 3 results/.test(dialogText) && dialogText.includes(A.name), `the confirmation names the count and the applicant: ${dialogText.replace(/\s+/g, ' ')}`);
    ok(await dialog.locator('[data-act="ok"]').evaluate(b => b.classList.contains('btn-danger-solid')) && await page.evaluate(() => document.activeElement.dataset.act) === 'cancel', 'it is a danger confirmation with Cancel focused');
    await page.keyboard.press('Escape');
    ok((await state(page)).applicants.length === 2, 'cancelling keeps the applicant');
    await page.click('#wkFinish');
    await page.locator('.dialog--confirm [data-act="ok"]').click();
    await page.waitForFunction(() => window.ApplyReadyWorkspace.state.applicants.length === 1);
    await page.waitForTimeout(300);
    st = await state(page);
    ok(st.applicants[0].id === bId && await page.inputValue('#wkName') === B.name, 'the next applicant is shown after finishing');
    dump = await pageDump(page);
    for (const needle of [A.name, 'Ishaan', 'ishaan', 'Mehra']) ok(!dump.includes(needle), `nothing of the finished applicant is left in the page (${needle})`);
    const remaining = await blobUrls(page);
    ok(aUrls.every(u => !remaining.includes(u)), 'none of the finished applicant’s blob URLs is still on the page');
    ok((await fetchable(page, aUrls)).every(x => x === false), 'the finished applicant’s blob URLs no longer fetch');
    ok(/finished/i.test(await page.locator('#taskNotification').innerText()), 'a neutral confirmation without the name');

    // Storage: only the recently used tool id may be written, nothing about applicants
    const storage = await page.evaluate(async () => {
      const local = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); local[k] = localStorage.getItem(k); }
      const session = {}; for (let i = 0; i < sessionStorage.length; i++) { const k = sessionStorage.key(i); session[k] = sessionStorage.getItem(k); }
      const dbs = indexedDB.databases ? (await indexedDB.databases()).map(d => d.name) : [];
      const cached = [];
      if (self.caches) for (const name of await caches.keys()) { const c = await caches.open(name); (await c.keys()).forEach(r => cached.push(r.url)); }
      return { local, session, dbs, cached };
    });
    const allowedLocal = ['applyready_recent_tools', 'applyready_theme'];
    ok(Object.keys(storage.local).every(k => allowedLocal.includes(k)), `localStorage holds only site preferences (${Object.keys(storage.local)})`);
    ok(JSON.parse(storage.local.applyready_recent_tools || '[]').includes('workspace'), 'the tool id is recorded in recently used tools');
    const keyValue = JSON.stringify([storage.local, storage.session, storage.dbs]);
    for (const needle of ['Ishaan', 'ishaan', 'Noor', 'noor', 'Fatima', 'Applicant', '.jpg', '.png', '.pdf', 'blob:']) ok(!keyValue.includes(needle), `no workspace data in localStorage, sessionStorage or IndexedDB (${needle})`);
    const cachedText = storage.cached.join('\n');
    for (const needle of ['ishaan', 'noor', 'blob:']) ok(!cachedText.toLowerCase().includes(needle), `no applicant file in Cache Storage (${needle})`);
    ok(Object.keys(storage.session).length === 0, 'sessionStorage is empty');
    ok(storage.dbs.length === 0, `no IndexedDB database (${storage.dbs})`);
    ok(storage.cached.every(u => u.startsWith(origin)), 'Cache Storage holds only the site’s own files');

    // End session wipes everything and resets the settings
    await page.locator('#wkSettings summary').click();
    await page.fill('#wkPdfKB', '300');
    await page.locator('#wkSettings summary').click();
    const bUrls = await blobUrls(page);
    ok(bUrls.length >= 4, 'applicant 2 has blob URLs on screen');
    await page.click('#wkEnd');
    await page.locator('.dialog--confirm [data-act="ok"]').click();
    await page.waitForSelector('#wkStart:not([hidden])');
    ok((await state(page)).applicants.length === 0 && (await state(page)).view === 'start', 'End session returns to the start screen with no applicants');
    dump = await pageDump(page);
    for (const needle of [B.name, 'Noor', 'noor']) ok(!dump.includes(needle), `nothing of applicant 2 is left after ending the session (${needle})`);
    ok((await fetchable(page, bUrls)).every(x => x === false), 'applicant 2’s blob URLs no longer fetch');
    ok(await page.inputValue('#wkPdfKB') === '500', 'session settings are back to their defaults');
    ok(!(await unloadWarns(page)), 'no reload warning once the session has ended');

    // A new session numbers from 1 again
    await page.click('#wkStartBtn');
    ok(await page.locator('[role="tab"][aria-selected="true"] .wk-tab__name').innerText() === 'Applicant 1', 'a new session starts at Applicant 1');
    ok(errors.length === 0, `no page errors: ${errors.join(' | ')}`);
    await context.close();
  }

  /* ================================================================== passwords, ZIP as a task, workers, focus */
  {
    const context = await newContext();
    const page = await context.newPage();
    watch(page);
    await page.goto(origin + '/workspace.html');
    const prose = await page.$$eval('.prose a[href$=".html"]', l => l.map(a => [a.getAttribute('href'), a.target, a.rel, a.textContent]));
    ok(prose.length >= 4 && prose.every(([, target, rel, text]) => target === '_blank' && /noopener/.test(rel) && /opens in a new tab/.test(text)), `links to other tools in the text open in a new tab, so the session is kept (${prose.map(x => x[0])})`);
    await page.click('#wkStartBtn');
    await page.fill('#wkName', 'Tara Singh');
    await page.setInputFiles('#wkDropInput', [fx('ishaan-photo.jpg'), fx('tara-locked.pdf')]);
    await page.waitForFunction(() => document.querySelectorAll('#wkFiles .file-row__thumb img').length === 1 && /password protected/.test(document.getElementById('wkFiles').innerText));

    // Focus returns to an action button once its file is no longer busy
    await row(page, 'ishaan-photo.jpg').locator('[data-act="run:photo"]').focus();
    await page.keyboard.press('Enter');
    await waitState(page, s => s.applicants[0].results === 1 && s.applicants[0].running === 0);
    await page.waitForTimeout(100);
    ok(await page.evaluate(() => document.activeElement.dataset.act) === 'run:photo', 'focus returns to Passport photo when the task is done');
    const toast = await page.locator('#taskNotification').innerText();
    ok(/^Passport photo ready to download: 350 × 450 px/.test(toast) && !/ishaan|Tara/i.test(toast), `a visible message says the result is ready, without names (${toast})`);
    const notDownloaded = await page.evaluate(() => {
      const probe = document.createElement('span'); probe.style.color = 'var(--c-success)'; document.body.appendChild(probe);
      const success = getComputedStyle(probe).color; probe.remove();
      return [getComputedStyle(document.querySelector('.wk-result__status[data-downloaded="false"]')).color, success];
    });
    ok(notDownloaded[0] !== notDownloaded[1], `“Not downloaded” is not shown in the success colour (${notDownloaded})`);

    // A protected PDF's password is asked before the task starts, while its applicant is on screen
    await row(page, 'ishaan-photo.jpg').locator('[data-act="select"]').check();
    await row(page, 'tara-locked.pdf').locator('[data-act="select"]').check();
    await page.click('#wkCombine');
    await page.waitForSelector('.pdf-password');
    ok((await state(page)).applicants[0].running === 0, 'the password is asked before the combine task starts');
    await page.fill('.pdf-password input[type="password"]', 'open sesame');
    await page.click('.pdf-password [data-act="ok"]');
    await waitState(page, s => s.applicants[0].results === 2 && s.applicants[0].running === 0);
    const combined = await download(page, () => resultRow(page, 'ishaan-photo-combined.pdf').locator('[data-act="download"]').click());
    ok(pdfPages(combined.file) === 2 && /Protected certificate/.test(run('pdftotext', [combined.file, '-'])) && !/Encrypted:\s+yes/.test(run('pdfinfo', [combined.file])), 'the combined PDF holds the protected page, without a password');

    // The ZIP is a task: it shows progress, can be cancelled, and finishing the applicant stops it
    await page.evaluate(() => {
      const make = window.ApplyReadyZip.createZip;
      window.ApplyReadyZip.createZip = async (entries, opts) => {
        for (let i = 0; i < entries.length; i++) {
          await new Promise(r => setTimeout(r, 400));
          if (opts.signal && opts.signal.aborted) throw new DOMException('ZIP cancelled', 'AbortError');
          opts.onProgress(i + 1, entries.length);
        }
        return make(entries, opts);
      };
    });
    const downloads = [];
    page.on('download', d => downloads.push(d.suggestedFilename()));
    await page.click('#wkZip');
    await page.waitForSelector('#wkJobs .wk-job');
    ok(/Preparing the ZIP/.test(await page.locator('#wkJobs .wk-job__text').innerText()) && await page.locator('#wkZip').isDisabled(), 'the ZIP shows its progress and the button waits');
    await page.locator('#wkJobs [data-act="cancel"]').click();
    await waitState(page, s => s.applicants[0].running === 0, null, 10000);
    await page.waitForTimeout(1200);
    ok(downloads.length === 0 && /1 of 2 results downloaded/.test(await page.locator("#wkTally").innerText()), 'a cancelled ZIP downloads nothing and marks nothing downloaded');
    await page.click('#wkZip');
    await page.waitForSelector('#wkJobs .wk-job');
    await page.click('#wkFinish');
    ok(/1 running task will be stopped/.test(await page.locator('.dialog--confirm').innerText()), 'finishing during the ZIP says the task will be stopped');
    await page.click('.dialog--confirm [data-act="ok"]');
    await page.waitForTimeout(1500);
    ok(downloads.length === 0, 'no ZIP is saved for an applicant finished while it was being made');
    ok(page.workers().every(w => !/image-worker/.test(w.url())), 'image workers are closed once the finished applicant’s work is gone');
    ok(await page.evaluate(() => document.activeElement.id) === 'wkNoneNew', 'after the last applicant, focus is on Add next applicant');
    ok(!/Tara|ishaan|tara-locked/.test(await pageDump(page)), 'nothing of the finished applicant is left in the page');

    // Two applicants with the same name are pointed out
    await page.click('#wkNoneNew');
    await page.fill('#wkName', 'Ravi');
    await page.click('#wkNew');
    await page.fill('#wkName', 'ravi ');
    ok(/same name/.test(await page.locator('#wkNameHint').innerText()), 'a second applicant with the same name gets a warning');
    await page.fill('#wkName', 'Ravi K');
    ok(!/same name/.test(await page.locator('#wkNameHint').innerText()), 'the warning goes once the names differ');
    ok(errors.length === 0, `no page errors: ${errors.join(' | ')}`);
    await context.close();
  }

  /* ================================================================== phone (320 px) */
  {
    const context = await newContext({ viewport: { width: 320, height: 720 }, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    watch(page);
    await page.goto(origin + '/workspace.html');
    await noOverflow(page, '320 px start');
    await page.click('#wkStartBtn');
    await page.fill('#wkName', A.name);
    await page.setInputFiles('#wkDropInput', [fx('ishaan-photo.jpg'), fx('noor-marks.pdf')]);
    await waitState(page, s => s.applicants[0].files === 2);
    await page.waitForFunction(() => !/counting pages/.test(document.getElementById('wkFiles').innerText));
    await row(page, 'ishaan-photo.jpg').locator('[data-act="run:photo"]').click();
    ok(await page.evaluate(() => !!(document.activeElement && document.activeElement.closest('.wk-file'))), 'focus stays in the file row while its buttons are busy');
    await waitState(page, s => s.applicants[0].results === 1 && s.applicants[0].running === 0);
    ok(await page.locator('#wkTabs').isHidden() && await page.locator('.wk-switch').isVisible(), 'phones use the applicant select instead of tabs');
    await noOverflow(page, '320 px applicant with files and a result');
    const tiny = await page.evaluate(() => Array.from(document.querySelectorAll('#wkPanel button, #wkPanel a.btn, .wk-nav button')).filter(b => b.offsetParent && b.getBoundingClientRect().height < 40).map(b => b.textContent.trim() || b.getAttribute('aria-label')));
    ok(tiny.length === 0, `touch targets are at least 40 px tall on phones (${tiny.slice(0, 4)})`);
    await page.click('#wkNew');
    await page.fill('#wkName', B.name);
    await page.locator('.wk-switch .select-btn').click();
    await page.locator('.select-opt', { hasText: A.name }).click();
    ok(await page.inputValue('#wkName') === A.name && await page.locator('#wkResults .wk-result').count() === 1, 'the select switches applicants on phones');
    await axe(page, '320 px applicant');
    ok(errors.length === 0, `no page errors on phones: ${errors.join(' | ')}`);
    await context.close();
  }

  await browser.close();
  server.close();
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`✓ applicant workspaces: ${checks} checks passed`);
})().catch(e => { console.error('✗', e && e.stack || e); server.close(); process.exit(1); });
