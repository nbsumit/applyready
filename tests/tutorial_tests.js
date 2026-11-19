/* The step-by-step tutorials (guides/how-to-*.html) quote exact labels, messages, file names and
   measurements. This suite follows each tutorial in the real tools, in Chromium, with the same sample
   inputs the screenshots use (img/samples/), and checks that what the tool shows matches what the
   tutorial says. The downloaded files are verified independently: pdfinfo and pdftotext for PDFs,
   unzip -t for ZIP files, and the image header (or ImageMagick's identify) for pixel sizes.
   When a check here fails after a deliberate interface change, update the tutorial text, then
   regenerate the screenshots with scripts/guide-screenshots.js. */
'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { execFileSync, spawnSync } = require('node:child_process');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.wasm': 'application/wasm', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.pdf': 'application/pdf' };
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const file = path.resolve(root, '.' + (pathname.endsWith('/') ? pathname + 'index.html' : pathname));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (e, d) => { res.writeHead(e ? 404 : 200, { 'Content-Type': e ? 'text/html' : mime[path.extname(file)] || 'application/octet-stream' }); res.end(e ? '' : d); });
});
const sample = name => path.join(root, 'img/samples', name);
const guideSample = name => path.join(root, 'img/samples/guide', name);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ar-tutorials-'));
const has = cmd => spawnSync('which', [cmd]).status === 0;
let checks = 0;
let stage = '';
const ok = (c, m) => { assert(c, m); checks++; };
const squash = s => s.replace(/\s+/g, ' ').replace(/[“”]/g, '"').trim();
// The visible text of a tutorial, with curly quotes made straight, to look for quoted strings.
const tutorial = name => squash(fs.readFileSync(path.join(root, 'guides', name), 'utf8').match(/<main[\s\S]*?<\/main>/)[0].replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&'));
const says = (name, text) => ok(tutorial(name).includes(squash(text)), `${name} says "${text}"`);

function jpegSize(file) {
  const b = fs.readFileSync(file);
  for (let i = 2; i < b.length - 9;) {
    if (b[i] !== 0xff) { i++; continue; }
    const marker = b[i + 1];
    if (marker >= 0xc0 && marker <= 0xc3) return { width: b.readUInt16BE(i + 7), height: b.readUInt16BE(i + 5) };
    i += 2 + b.readUInt16BE(i + 2);
  }
  return null;
}
const pdfPages = file => Number((execFileSync('pdfinfo', [file], { encoding: 'latin1' }).match(/^Pages:\s+(\d+)/m) || [])[1]);
const pdfText = file => execFileSync('pdftotext', [file, '-'], { encoding: 'latin1' });
async function save(download, name) { const f = path.join(tmp, name || download.suggestedFilename()); await download.saveAs(f); return f; }
const toast = page => page.evaluate(() => (document.getElementById('taskNotification') || {}).textContent || '');
const statusText = page => page.evaluate(() => document.getElementById('saveStatusText').textContent);

async function resumePage(page, origin) {
  await page.goto(origin + '/resume.html');
  await page.waitForFunction(() => document.getElementById('resumeAppLayout').getAttribute('aria-busy') !== 'true');
  await page.waitForFunction(() => !/Opening/.test(document.getElementById('saveStatusText').textContent));
}
const waitSaved = page => page.waitForFunction(() => /^Saved on this device/.test(document.getElementById('saveStatusText').textContent), null, { timeout: 10000 });
const setValue = (page, id, value) => page.evaluate(([id, value]) => {
  const e = document.getElementById(id);
  if (e.type === 'checkbox') e.checked = value; else e.value = value;
  e.dispatchEvent(new Event('input', { bubbles: true }));
  e.dispatchEvent(new Event('change', { bubbles: true }));
}, [id, value]);
const batchIdle = page => page.waitForFunction(() => { const s = window.ApplyReadyBatchImage.summary(); return s.total > 0 && !s.queued && !s.processing; }, null, { timeout: 120000 });

(async () => {
  for (const cmd of ['pdfinfo', 'pdftotext', 'unzip']) if (!has(cmd)) throw new Error(`${cmd} is needed (poppler-utils, unzip)`);
  if (!fs.existsSync(guideSample('sample-marksheet.pdf'))) throw new Error('run python3 scripts/make-sample-images.py and node scripts/make-sample-pdfs.js first');
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const exe = process.env.BROWSER_EXECUTABLE_PATH;
  const browser = await chromium.launch({ headless: true, ...(exe ? { executablePath: exe } : {}), args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const errors = [];
  const fresh = async () => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
    await context.route('**/*', r => /^(http:\/\/127\.|blob:|data:)/.test(r.request().url()) ? r.continue() : r.abort());
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(`${page.url()}: ${e.message}`));
    return { context, page };
  };

  /* ---------------------------------------------------------------- create a resume */
  {
    stage = 'create a resume';
    const T = 'how-to-create-a-resume.html';
    const { context, page } = await fresh();
    await resumePage(page, origin);
    ok(squash(await page.textContent('.rb-doc')).includes('Untitled resume New resume. It saves on this device as you type.'), 'a blank builder shows the new-resume line the tutorial quotes');
    says(T, 'New resume. It saves on this device as you type.');
    await page.click('#tabDownload');
    await page.click('#btnDownloadPDF');
    await page.waitForFunction(() => /Add your name/.test((document.getElementById('taskNotification') || {}).textContent || ''));
    ok(await toast(page) === 'Add your name in Contact details before downloading.', 'downloading without a name explains why');
    says(T, '"Add your name in Contact details before downloading."');
    ok(await page.getAttribute('#tabContent', 'aria-selected') === 'true', 'and goes back to the Write step');
    for (const [id, v] of [['fullName', 'Priya Sharma'], ['targetTitle', 'Junior Data Analyst'], ['email', 'priya.sharma@example.com'], ['phone', '+91 90000 12345']]) await page.fill('#' + id, v);
    await waitSaved(page);
    ok(squash(await page.textContent('.rb-doc')).startsWith('Priya Sharma, Junior Data Analyst Saved on this device · just now'), 'the resume takes its name from name and headline, and says it is saved');
    says(T, 'Saved on this device · just now');
    says(T, 'Priya Sharma, Junior Data Analyst');
    // Experience card fields, as listed
    await page.click('#sec-experience .accordion-header');
    await page.click('#btnAddExperience');
    for (const label of ['Job title', 'Company or organization', 'Dates', 'Responsibilities and results']) ok(await page.locator('#experienceList').getByLabel(label, { exact: true }).count() === 1, `a role card has "${label}"`);
    await page.locator('#experienceList').getByLabel('Job title', { exact: true }).fill('Data Intern');
    await page.locator('#experienceList').getByLabel('Responsibilities and results', { exact: true }).fill('Built a weekly delivery report\nCleaned 12,000 shipment records');
    await page.click('#sec-education .accordion-header');
    await page.click('#btnAddEducation');
    for (const label of ['Degree or field of study', 'School or university', 'Years']) ok(await page.locator('#educationList').getByLabel(label, { exact: true }).count() === 1, `an education card has "${label}"`);
    // Skills labels of the default template
    const skillLabels = await page.locator('#sec-skills .field-label[id^="skill-label-"]').allTextContents();
    ok(['Core Competencies', 'Tools & Platforms', 'Technical & Data Skills', 'Professional Skills'].every(l => skillLabels.map(s => s.trim()).includes(l)), `default skill labels are as listed (${skillLabels})`);
    // Style options
    await page.click('#tabDesign');
    const filters = await page.locator('#templateFilterBar button').allTextContents();
    for (const f of ['All', 'General', 'Students & freshers', 'Tech', 'Senior & executive', 'Specialist roles']) ok(filters.some(x => x.trim().startsWith(f)), `template filter "${f}" exists`);
    ok((await page.locator('#pageSizeSelect option').allTextContents()).join('|').includes('US Letter'), 'paper size offers A4 and US Letter');
    // Review and download
    await page.click('#tabReview');
    ok(await page.locator('#reviewChecklist .review-jump-btn').count() > 0 && /Fix/.test(await page.locator('#reviewChecklist .review-jump-btn').first().textContent()), 'review items have a Fix button');
    await page.click('#tabDownload');
    const [pdf] = await Promise.all([page.waitForEvent('download'), page.click('#btnDownloadPDF')]);
    ok(pdf.suggestedFilename() === 'Priya_Sharma_Junior_Data_Analyst_Resume.pdf', `the PDF is named as the tutorial says (${pdf.suggestedFilename()})`);
    says(T, 'Priya_Sharma_Junior_Data_Analyst_Resume.pdf');
    const pdfFile = await save(pdf);
    ok(pdfPages(pdfFile) === 1 && /Priya Sharma/i.test(pdfText(pdfFile)) && /Data Intern/.test(pdfText(pdfFile)), 'the PDF is one page of real text with the name and the role (pdftotext)');
    const [docx] = await Promise.all([page.waitForEvent('download'), page.click('#btnDownloadDOCX')]);
    const docxFile = await save(docx);
    ok(docx.suggestedFilename().endsWith('.docx') && spawnSync('unzip', ['-t', docxFile]).status === 0, 'the Word file is a valid .docx (unzip -t)');
    await context.close();
  }

  /* ---------------------------------------------------------------- edit, back up, restore */
  let backupFile;
  {
    const E = 'how-to-edit-a-saved-resume.html', B = 'how-to-back-up-and-restore-resumes.html';
    const { context, page } = await fresh();
    await resumePage(page, origin);
    await page.fill('#fullName', 'Priya Sharma');
    await page.fill('#targetTitle', 'Junior Data Analyst');
    await waitSaved(page);
    await page.click('#tabDownload');
    const [backup] = await Promise.all([page.waitForEvent('download'), page.click('#btnExportJSON')]);
    ok(backup.suggestedFilename() === 'Priya_Sharma_Junior_Data_Analyst_resume_backup.json', `single backup name (${backup.suggestedFilename()})`);
    says(B, 'Priya_Sharma_Junior_Data_Analyst_resume_backup.json');
    ok(squash(await toast(page)) === 'Backup of "Priya Sharma, Junior Data Analyst" downloaded. Keep the file somewhere safe; import it to restore the resume.', 'backup message as quoted');
    says(B, 'Backup of "Priya Sharma, Junior Data Analyst" downloaded. Keep the file somewhere safe; import it to restore the resume.');
    backupFile = await save(backup);
    ok(JSON.parse(fs.readFileSync(backupFile, 'utf8')).app === 'ApplyReady', 'the backup is an ApplyReady JSON file');
    // My resumes
    await page.evaluate(() => scrollTo(0, 0));
    await page.click('#btnLibrary');
    await page.waitForSelector('#libraryDialog:not([hidden]) #libList li');
    ok(squash(await page.textContent('#libIntro')) === 'Resumes saved in this browser on this device. They are not uploaded anywhere.', 'My resumes intro as quoted');
    says(E, 'Resumes saved in this browser on this device. They are not uploaded anywhere.');
    for (const b of ['New resume', 'New from sample', 'Import backup', 'Export all']) ok((await page.locator('#libraryDialog .rl-actions button').allTextContents()).some(t => t.trim() === b), `My resumes has "${b}"`);
    ok(/Open now/.test(await page.textContent('#libList .rl-row.is-current')) && /Continue/.test(await page.textContent('#libList .rl-row.is-current')), 'the open resume says Open now and Continue');
    await page.click('#libraryDialog [data-act="duplicate"][data-index="0"]');
    await page.waitForFunction(() => document.querySelectorAll('#libList [data-act="open"]').length === 2);
    ok(squash(await toast(page)) === 'Created "Copy of Priya Sharma, Junior Data Analyst".', 'duplicate message');
    says(E, 'Copy of');
    await page.click('#libraryDialog [data-act="rename"][data-index="0"]');
    ok(await page.locator('#libList .rl-rename button[type="submit"]').textContent() === 'Save name', 'rename shows Save name');
    await page.fill('#libList .rl-rename .input', 'Analyst version');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => /Renamed to/.test((document.getElementById('taskNotification') || {}).textContent));
    ok(squash(await toast(page)) === 'Renamed to "Analyst version".', 'rename message');
    await page.locator('#libList .rl-row', { hasText: 'Analyst version' }).locator('[data-act="open"]').click();
    await page.waitForFunction(() => /Opened/.test((document.getElementById('taskNotification') || {}).textContent));
    ok(squash(await toast(page)) === 'Opened "Analyst version".', 'open message as quoted');
    says(E, 'Opened "Analyst version".');
    ok(squash(await page.textContent('.rb-doc')).startsWith('Analyst version Saved on this device'), 'the header follows the opened resume');
    // Export all
    await page.click('#btnLibrary');
    await page.waitForSelector('#libraryDialog:not([hidden]) #libList li');
    const [all] = await Promise.all([page.waitForEvent('download'), page.click('#libraryDialog [data-act="export-all"]')]);
    ok(/^ApplyReady_resumes_backup_\d{4}-\d{2}-\d{2}\.json$/.test(all.suggestedFilename()), `export all name (${all.suggestedFilename()})`);
    says(B, 'ApplyReady_resumes_backup_2026-11-18.json');
    const allFile = await save(all);
    ok(JSON.parse(fs.readFileSync(allFile, 'utf8')).resumes.length === 2, 'export all holds both resumes');
    await context.close();
  }
  {
    const B = 'how-to-back-up-and-restore-resumes.html';
    const { context, page } = await fresh();
    await resumePage(page, origin);
    await page.click('#tabDownload');
    await page.setInputFiles('#fileImportInput', backupFile);
    await page.waitForFunction(() => /Imported/.test((document.getElementById('taskNotification') || {}).textContent));
    ok(squash(await toast(page)) === 'Imported 1 resume and opened "Priya Sharma, Junior Data Analyst".', 'import message');
    says(B, 'Imported 1 resume and opened');
    ok(/^Saved on this device/.test(await statusText(page)), 'an imported resume is saved on this device');
    // Importing the same file again adds nothing: that resume is already here exactly as it is.
    await page.setInputFiles('#fileImportInput', backupFile);
    await page.waitForFunction(() => /already saved/.test((document.getElementById('taskNotification') || {}).textContent));
    says(B, 'importing the same file twice does not give you two copies');
    await page.evaluate(() => scrollTo(0, 0));
    await page.click('#btnLibrary');
    await page.waitForSelector('#libraryDialog:not([hidden]) #libList li');
    ok(await page.locator('#libList [data-act="open"]').count() === 1, 'importing the same file twice keeps one copy');
    await page.keyboard.press('Escape');
    // After an edit, the backup is an older version: it is imported beside the edited one, marked restored.
    await page.click('#tabContent');
    await page.fill('#targetTitle', 'Data Analyst');
    await page.waitForFunction(() => /^Saved on this device/.test(document.getElementById('saveStatusText').textContent));
    await page.click('#tabDownload');
    await page.setInputFiles('#fileImportInput', backupFile);
    await page.waitForFunction(() => /Imported/.test((document.getElementById('taskNotification') || {}).textContent));
    ok(/\(restored \d{1,2} \w{3}\)|\(restored \w{3} \d{1,2}\)/.test(await page.locator('#resumeName').textContent()), 'the older copy from the backup is marked restored');
    says(B, 'the imported one is marked restored with the date');
    await page.click('#btnLibrary');
    await page.waitForSelector('#libraryDialog:not([hidden]) #libList li');
    ok(await page.locator('#libList [data-act="open"]').count() === 2, 'the edited version and the restored one are both kept');
    await page.keyboard.press('Escape');
    const bad = path.join(tmp, 'not-a-backup.json');
    fs.writeFileSync(bad, '{"hello":1}');
    await page.setInputFiles('#fileImportInput', bad);
    await page.waitForFunction(() => /not an ApplyReady/.test((document.getElementById('taskNotification') || {}).textContent));
    ok(squash(await toast(page)).startsWith('This file is not an ApplyReady resume backup, or it is damaged.'), 'a wrong file is refused as quoted');
    says(B, '"This file is not an ApplyReady resume backup, or it is damaged."');
    await context.close();
  }

  /* ---------------------------------------------------------------- privacy on a shared computer */
  {
    stage = 'privacy on a shared computer';
    const P = 'how-to-protect-your-privacy-on-a-shared-computer.html';
    const { context, page } = await fresh();
    await resumePage(page, origin);
    await page.fill('#fullName', 'Priya Sharma');
    await waitSaved(page);
    await page.click('#tabDownload');
    await page.locator('#chkSaveDevice').click();
    await page.waitForFunction(() => /saving is off/.test(document.getElementById('saveStatusText').textContent));
    ok(await statusText(page) === 'Not saved: saving is off on this device', 'status with saving off');
    says(P, 'Not saved: saving is off on this device');
    ok(await toast(page) === 'Saving on this device is off. Nothing new is stored in this browser.', 'saving-off message');
    says(P, 'Saving on this device is off. Nothing new is stored in this browser.');
    ok(/1 resume saved earlier is still in this browser/.test(await page.textContent('#saveNotice')), 'the notice counts resumes saved earlier');
    // The choice is remembered on the next visit.
    await page.reload();
    await page.waitForFunction(() => document.getElementById('resumeAppLayout').getAttribute('aria-busy') !== 'true');
    await page.waitForFunction(() => !/Opening/.test(document.getElementById('saveStatusText').textContent));
    ok(!(await page.locator('#chkSaveDevice').isChecked()), 'saving stays off on the next visit');
    // Delete everything
    await page.goto(origin + '/your-data.html');
    await page.waitForSelector('#ydDeleteAll');
    await page.waitForTimeout(500);
    await page.click('#ydDeleteAll');
    const confirm = page.locator('.dialog--confirm');
    await confirm.waitFor();
    ok(squash(await confirm.locator('h2, .dialog__title').first().textContent()) === 'Delete everything ApplyReady stored?', 'Delete everything asks first, as quoted');
    says(P, 'Delete everything ApplyReady stored?');
    await confirm.locator('[data-act="ok"]').click();
    await page.waitForSelector('#ydDone:not([hidden])', { timeout: 15000 });
    ok(/Nothing ApplyReady stored is left in this browser\./.test(await page.textContent('#ydDoneText')), `Delete everything confirms nothing is left (${await page.textContent('#ydDoneText')})`);
    says(P, 'Nothing ApplyReady stored is left in this browser.');
    const left = await page.evaluate(() => new Promise(r => { const q = indexedDB.open('applyready'); q.onsuccess = () => { const db = q.result; const n = db.objectStoreNames.contains('resumes') ? 1 : 0; db.close(); r(n); }; q.onerror = () => r(-1); }));
    ok(left === 0, 'the resume database is gone after Delete everything');
    await context.close();
  }

  /* ---------------------------------------------------------------- resize a photo */
  {
    stage = 'resize a photo';
    const T = 'how-to-resize-a-photo-for-an-application.html';
    const { context, page } = await fresh();
    await page.goto(origin + '/image-resizer.html');
    const choices = (await page.locator('#reqGrid .choice__name').allTextContents()).map(s => s.trim());
    ok(choices.join('|') === 'ID / passport photo|Signature|Profile photo|Thumb impression|Handwritten declaration|Document scan|Social or web card|Custom size', `the eight choices, in order (${choices})`);
    await page.goto(origin + '/passport-photo-resizer.html');
    await page.setInputFiles('#fileInput', sample('test-portrait.jpg'));
    await page.waitForFunction(() => document.getElementById('imageToCrop').cropper && !document.getElementById('btnProcess').disabled);
    ok(squash(await page.textContent('#fileInfoText')) === 'test-portrait.jpg (1200 × 1600 px, 428.9 KB)', 'file bar as quoted');
    says(T, 'test-portrait.jpg (1200 × 1600 px, 428.9 KB)');
    await page.click('#btnProcess');
    await page.waitForSelector('#resultArea:not(.hidden)');
    ok(squash(await page.textContent('#resultStatus')) === 'Under the 50 KB limit, at the exact size requested.', 'result sentence as quoted');
    says(T, 'Under the 50 KB limit, at the exact size requested.');
    const size = squash(await page.textContent('#resultFileSize'));
    ok(size === '26.48 KB (27,120 bytes)', `measured size (${size})`);
    says(T, '26.48 KB (27,120 bytes)');
    const [img] = await Promise.all([page.waitForEvent('download'), page.click('#btnDownload')]);
    ok(img.suggestedFilename() === 'test-portrait_Passport_Photo_350x450.jpg', `file name (${img.suggestedFilename()})`);
    says(T, 'test-portrait_Passport_Photo_350x450.jpg');
    const imgFile = await save(img);
    const dims = jpegSize(imgFile);
    ok(dims && dims.width === 350 && dims.height === 450 && fs.statSync(imgFile).size <= 51200, `the file is 350 × 450 px and at most 51,200 bytes (${JSON.stringify(dims)}, ${fs.statSync(imgFile).size})`);
    // PNG at a tight limit gives the message the tutorial quotes.
    await page.click('#btnCropAgain');
    await page.evaluate(() => { const b = document.querySelector('.ws-customize'); if (b.getAttribute('aria-expanded') !== 'true') b.click(); });
    await page.selectOption('#formatSelect', 'image/png');
    await page.fill('#customMaxKB', '10');
    await page.click('#btnProcess');
    await page.waitForSelector('#processErrorBox:not(.hidden)');
    ok(/^PNG needs 196\.5 KB at this size\./.test(squash(await page.textContent('#processErrorMessage'))), 'PNG message as quoted');
    says(T, '"PNG needs 196.5 KB at this size."');
    await context.close();
  }

  /* ---------------------------------------------------------------- signature */
  {
    stage = 'signature';
    const T = 'how-to-resize-a-signature.html';
    const { context, page } = await fresh();
    await page.goto(origin + '/signature-cleaner.html');
    await page.setInputFiles('#cleanerFileInput', sample('test-signature.jpg'));
    await page.waitForFunction(() => (document.getElementById('btnCleanerDownload').getAttribute('href') || '').startsWith('blob:'));
    ok(await page.getAttribute('#btnCleanerDownload', 'download') === 'Cleaned_test-signature.jpg', 'cleaned file name as quoted');
    says(T, 'Cleaned_test-signature.jpg');
    ok(await page.inputValue('#whitenessInput') === '70' && await page.inputValue('#contrastInput') === '80', 'slider start values 70 and 80');
    await page.goto(origin + '/signature-resizer.html');
    await page.setInputFiles('#fileInput', sample('test-signature-cleaned.jpg'));
    await page.waitForFunction(() => document.getElementById('imageToCrop').cropper && !document.getElementById('btnProcess').disabled);
    await page.evaluate(() => { const b = document.querySelector('.ws-customize'); if (b.getAttribute('aria-expanded') !== 'true') b.click(); });
    await page.fill('#customMinKB', '10');
    await page.fill('#customMaxKB', '20');
    await page.click('#btnProcess');
    await page.waitForSelector('#resultArea:not(.hidden)');
    ok(squash(await page.textContent('#resultStatus')) === 'Within the 10–20 KB range, at the exact size requested.', 'range sentence as quoted');
    says(T, 'Within the 10–20 KB range, at the exact size requested.');
    ok(squash(await page.textContent('#resultFileSize')) === '10.00 KB (10,244 bytes)', 'padded size as quoted');
    says(T, '10.00 KB (10,244 bytes)');
    const [sig] = await Promise.all([page.waitForEvent('download'), page.click('#btnDownload')]);
    const sigFile = await save(sig);
    const d = jpegSize(sigFile);
    ok(d && d.width === 300 && d.height === 100 && fs.statSync(sigFile).size >= 10240 && fs.statSync(sigFile).size <= 20480, 'the signature file is 300 × 100 px and inside 10 to 20 KB');
    await context.close();
  }

  /* ---------------------------------------------------------------- compress */
  {
    stage = 'compress';
    const T = 'how-to-compress-an-image.html';
    const { context, page } = await fresh();
    await page.goto(origin + '/compress-image.html');
    ok(await page.inputValue('#bMaxKB') === '100' && await page.isChecked('#bAllowShrink'), 'the compressor starts at 100 KB with smaller dimensions allowed');
    await page.setInputFiles('#batchApp input[type=file]', [guideSample('photo-applicant-1.jpg'), guideSample('photo-applicant-2.jpg'), guideSample('document-page-1.jpg'), sample('test-signature-cleaned.jpg')]);
    await page.waitForFunction(() => document.querySelectorAll('#batchList li').length === 4);
    ok(squash(await page.textContent('#batchCounts')) === '4 images · 1.2 MB', `the bar counts the images as quoted (${squash(await page.textContent('#batchCounts'))})`);
    says(T, '4 images · 1.2 MB');
    await setValue(page, 'bMaxKB', '50');
    ok(/Compress 4 images/.test(await page.textContent('#btnBatchStart')), 'the start button names the job');
    await page.click('#btnBatchStart');
    await batchIdle(page);
    const rows = await page.locator('#batchList li').allInnerTexts();
    ok(rows[0].includes('Quality was lowered to 51% to fit under 50 KB.'), `quality note as quoted (${rows[0]})`);
    says(T, 'Quality was lowered to 51% to fit under 50 KB.');
    ok(rows[2].includes('The pixel size was reduced to meet the 50 KB limit.') && rows[2].includes('1036 × 1465 px'), 'pixel size note and size as quoted');
    says(T, 'The pixel size was reduced to meet the 50 KB limit.');
    says(T, '1036 × 1465 px');
    ok(rows[2].includes('Quality was lowered to 52% to fit under 50 KB.'), `the scanned page also has the quality note (${rows[2]})`);
    says(T, 'quality was lowered to 52%');
    ok(!/Quality was lowered|pixel size was reduced/.test(rows[3]) && rows[3].includes('37 KB'), 'the small signature has no note');
    ok(squash(await page.textContent('#batchVerdictTitle')) === '4 images compressed' && squash(await page.textContent('#batchVerdictText')) === '183 KB in total, from 1.2 MB.', 'totals as quoted');
    says(T, '183 KB in total, from 1.2 MB.');
    const [zip] = await Promise.all([page.waitForEvent('download'), page.click('#btnBatchZip')]);
    ok(zip.suggestedFilename() === 'compressed-images.zip', 'ZIP name as quoted');
    says(T, 'compressed-images.zip');
    const zipFile = await save(zip);
    ok(spawnSync('unzip', ['-t', zipFile]).status === 0, 'the ZIP is valid (unzip -t)');
    ok(execFileSync('unzip', ['-Z1', zipFile], { encoding: 'utf8' }).trim().split('\n').length === 4, 'the ZIP holds four images');
    await context.close();
  }

  /* ---------------------------------------------------------------- merge PDF */
  {
    stage = 'merge PDF';
    const T = 'how-to-merge-pdf-files.html';
    const { context, page } = await fresh();
    await page.goto(origin + '/merge-pdf.html');
    await page.setInputFiles('#mergeDropInput', [guideSample('sample-cover-letter.pdf'), guideSample('sample-marksheet.pdf'), guideSample('document-page-2.jpg')]);
    await page.waitForFunction(() => /3 files/.test(document.getElementById('mergeCounts').textContent));
    ok(squash(await page.textContent('#mergeCounts')) === '3 files · 4 pages · 383 KB', `the bar counts files, pages and size as quoted (${squash(await page.textContent('#mergeCounts'))})`);
    says(T, '3 files · 4 pages · 383 KB');
    ok(squash(await page.textContent('main')).includes('4 pages from 3 files will be joined in the order shown.'), 'the line above the button as quoted');
    says(T, '4 pages from 3 files will be joined in the order shown.');
    const listText = squash(await page.getByRole('list', { name: 'Files to merge, in order' }).innerText());
    ok(listText.includes('2 pages · starts A4 portrait') && listText.includes('Image, becomes 1 A4 page'), 'rows describe pages as quoted');
    says(T, '2 pages · starts A4 portrait');
    says(T, 'Image, becomes 1 A4 page');
    await page.setInputFiles('#mergeDropInput', [guideSample('sample-certificate-locked.pdf')]);
    const dialog = page.getByRole('dialog', { name: 'This PDF needs a password' });
    await dialog.waitFor();
    await dialog.getByLabel('Password', { exact: true }).fill('wrong');
    await dialog.getByRole('button', { name: 'Open PDF' }).click();
    await dialog.getByRole('alert').waitFor();
    ok(squash(await dialog.getByRole('alert').textContent()).includes('That password is not right. Check it and try again; passwords are case sensitive.'), 'wrong password message as quoted');
    says(T, 'Check it and try again; passwords are case sensitive.');
    await dialog.getByLabel('Password', { exact: true }).fill('sample');
    await dialog.getByRole('button', { name: 'Open PDF' }).click();
    await page.waitForFunction(() => /4 files/.test(document.getElementById('mergeCounts').textContent));
    ok(/password given/.test(await page.getByRole('list', { name: 'Files to merge, in order' }).innerText()), 'the protected file says password given');
    // Remove it again so the result matches the tutorial's three files.
    await page.getByRole('button', { name: 'Remove sample-certificate-locked.pdf' }).click();
    await page.waitForFunction(() => /3 files/.test(document.getElementById('mergeCounts').textContent));
    ok(await page.inputValue('main input[type=text]') === 'merged', 'the file name starts as merged');
    await page.fill('main input[type=text]', 'priya-sharma-certificates');
    await page.getByRole('button', { name: 'Merge files' }).click();
    await page.getByRole('heading', { name: 'Your merged PDF is ready' }).waitFor({ timeout: 60000 });
    ok(squash(await page.textContent('#mergeResultText')) === '4 pages in the order shown, checked after saving.', 'result line as quoted');
    says(T, '4 pages in the order shown, checked after saving.');
    const [out] = await Promise.all([page.waitForEvent('download'), page.click('#mergeDownload')]);
    ok(out.suggestedFilename() === 'priya-sharma-certificates.pdf', 'the download uses the typed file name');
    const outFile = await save(out);
    const text = pdfText(outFile);
    ok(pdfPages(outFile) === 4, 'the merged PDF has 4 pages (pdfinfo)');
    ok(text.indexOf('Cover letter') < text.indexOf('Statement of marks (sample), page 1') && text.includes('page 2'), 'pages are in order and the PDF pages keep their text (pdftotext)');
    ok(!/Encrypted:\s+yes/.test(execFileSync('pdfinfo', [outFile], { encoding: 'latin1' })), 'the merged PDF has no password');
    await context.close();
  }

  /* ---------------------------------------------------------------- many photos at once */
  {
    stage = 'many photos at once';
    const T = 'how-to-process-many-photos-at-once.html';
    const { context, page } = await fresh();
    await page.goto(origin + '/batch-image.html');
    const presets = await page.locator('#bPreset option').allTextContents();
    for (const p of ['Custom settings', 'Passport photo: 350 × 450 px, under 50 KB', 'Signature: 300 × 100 px, under 30 KB', 'Profile photo: 400 × 400 px, under 100 KB', 'Document scan: within 1240 × 1754 px, under 500 KB']) {
      ok(presets.includes(p), `preset "${p}" exists`);
      says(T, p);
    }
    const a = fs.mkdtempSync(path.join(tmp, 'a-')), b = fs.mkdtempSync(path.join(tmp, 'b-'));
    fs.copyFileSync(guideSample('photo-applicant-1.jpg'), path.join(a, 'photo.jpg'));
    fs.copyFileSync(guideSample('photo-applicant-2.jpg'), path.join(b, 'photo.jpg'));
    const cut = path.join(a, 'scan-cut-off.jpg');
    fs.writeFileSync(cut, fs.readFileSync(guideSample('photo-applicant-3.jpg')).subarray(0, 3000));
    await page.setInputFiles('#batchApp input[type=file]', [path.join(a, 'photo.jpg'), path.join(b, 'photo.jpg'), cut]);
    await page.waitForFunction(() => document.querySelectorAll('#batchList li').length === 3);
    await setValue(page, 'bPreset', 'passport');
    ok(await page.inputValue('#bResize') === 'fill' && await page.inputValue('#bMaxKB') === '50', 'the passport preset sets an exact size and 50 KB');
    await page.click('#btnBatchStart');
    await batchIdle(page);
    const rows = await page.locator('#batchList li').allInnerTexts();
    ok(rows[1].includes('Result: photo (2).jpg'), `a repeated name gets (2) (${rows[1]})`);
    says(T, 'photo (2).jpg');
    ok(rows[2].includes('Failed') && rows[2].includes('This image could not be opened. It may be damaged, or in a format this browser cannot read.'), 'the damaged file fails with the quoted reason');
    says(T, 'This image could not be opened. It may be damaged, or in a format this browser cannot read.');
    ok(/Retry 1 failed image/.test(await page.textContent('#btnBatchRetry')), 'retry names the failed image');
    const [zip] = await Promise.all([page.waitForEvent('download'), page.click('#btnBatchZip')]);
    ok(zip.suggestedFilename() === 'applyready-images.zip', 'ZIP name as quoted');
    says(T, 'applyready-images.zip');
    const zipFile = await save(zip);
    ok(spawnSync('unzip', ['-t', zipFile]).status === 0, 'the ZIP is valid (unzip -t)');
    const names = execFileSync('unzip', ['-Z1', zipFile], { encoding: 'utf8' }).trim().split('\n').sort();
    ok(names.join('|') === 'photo (2).jpg|photo.jpg', `the ZIP holds both photos under unique names (${names})`);
    const outDir = fs.mkdtempSync(path.join(tmp, 'zip-'));
    execFileSync('unzip', ['-q', zipFile, '-d', outDir]);
    for (const n of names) {
      const dd = jpegSize(path.join(outDir, n));
      ok(dd && dd.width === 350 && dd.height === 450 && fs.statSync(path.join(outDir, n)).size <= 51200, `${n} is 350 × 450 px under 50 KB`);
    }
    // Cancel keeps finished images and offers to retry the rest.
    await page.goto(origin + '/batch-image.html');
    const dir = fs.mkdtempSync(path.join(tmp, 'many-'));
    const files = [];
    for (let i = 0; i < 12; i++) { const f = path.join(dir, `applicant-${i + 1}.jpg`); fs.copyFileSync(guideSample(`photo-applicant-${(i % 3) + 1}.jpg`), f); files.push(f); }
    await page.setInputFiles('#batchApp input[type=file]', files);
    await page.waitForFunction(() => document.querySelectorAll('#batchList li').length === 12);
    await setValue(page, 'bPreset', 'passport');
    await page.click('#btnBatchStart');
    await page.waitForFunction(() => window.ApplyReadyBatchImage.summary().done >= 2, null, { timeout: 60000, polling: 10 });
    await page.click('#btnBatchCancel');
    await batchIdle(page);
    const s = await page.evaluate(() => window.ApplyReadyBatchImage.summary());
    ok(s.done >= 2 && s.cancelled > 0, `cancel keeps finished images (${JSON.stringify(s)})`);
    ok(/Retry \d+ failed and cancelled images?/.test(await page.textContent('#btnBatchRetry')), 'retry offers the failed and cancelled images');
    says(T, 'Retry 2 failed and cancelled images');
    await page.click('#btnBatchRetry');
    await batchIdle(page);
    ok((await page.evaluate(() => window.ApplyReadyBatchImage.summary())).done === 12, 'retry finishes the rest');
    await context.close();
  }

  /* ---------------------------------------------------------------- screenshots on a phone */
  // A phone shows the phone capture at (close to) the size it was taken, not a desktop capture shrunk
  // until its text is a few pixels tall; "Open full size" is visible and opens the picture shown; a
  // desktop window shows the desktop capture; and when the phone capture cannot load (offline, not yet
  // seen), the desktop capture appears instead of a broken image.
  {
    stage = 'screenshots on a phone';
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'img/guides/manifest.json'), 'utf8'));
    // Load every screenshot (they are lazy), then read what is shown.
    const shots = async page => {
      await page.evaluate(() => document.querySelectorAll('main .shot img').forEach(img => { img.loading = 'eager'; }));
      await page.waitForFunction(() => [...document.querySelectorAll('main .shot picture > img')].every(img => img.complete && img.naturalWidth > 0), null, { timeout: 10000 });
      await page.waitForTimeout(100);
      return page.evaluate(() => [...document.querySelectorAll('main .shot picture > img')].map(img => {
        const link = img.closest('.shot__full'), hint = link && link.querySelector('.shot__zoom');
        return { name: (img.getAttribute('src').match(/([a-z0-9-]+)\.webp$/) || [])[1], current: img.currentSrc, natural: img.naturalWidth, shown: img.getBoundingClientRect().width, href: link && link.href, hint: hint ? hint.getBoundingClientRect().height > 0 && getComputedStyle(hint).visibility === 'visible' && hint.textContent.trim() : null };
      }));
    };
    for (const name of ['how-to-create-a-resume.html', 'how-to-merge-pdf-files.html', 'how-to-process-many-photos-at-once.html']) {
      const context = await browser.newContext({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
      await context.route('**/*', r => /^(http:\/\/127\.|blob:|data:)/.test(r.request().url()) ? r.continue() : r.abort());
      const page = await context.newPage();
      page.on('pageerror', e => errors.push(`${page.url()}: ${e.message}`));
      await page.goto(`${origin}/guides/${name}`);
      const list = await shots(page);
      ok(list.length >= 2, `${name}: screenshots are offered with a phone capture (${list.length})`);
      for (const s of list) {
        const p = manifest[s.name].phone;
        ok(s.current.endsWith(`/${p.file}`), `${name}: a 360 px phone shows the phone capture of ${s.name} (${s.current})`);
        // Shown at no less than 85% of the size it was taken (a 328 px column for a capture up to 360 px wide).
        ok(s.natural === p.width && s.shown >= 0.85 * p.width / p.scale, `${name}: ${s.name} is shown ${Math.round(s.shown)} px wide on the phone, for a capture ${p.width / p.scale} px wide`);
        if (s.href !== null) {
          ok(s.hint === 'Open full size', `${name}: ${s.name} says "Open full size" under the picture`);
          ok(s.href === s.current, `${name}: "Open full size" opens the phone capture of ${s.name} (${s.href})`);
        }
      }
      await context.close();
    }
    // A desktop window keeps the desktop capture and the link to it.
    {
      const { context, page } = await fresh();
      await page.goto(`${origin}/guides/how-to-merge-pdf-files.html`);
      for (const s of await shots(page)) {
        ok(s.current.endsWith(`/img/guides/${s.name}.webp`), `desktop shows the desktop capture of ${s.name}`);
        if (s.href !== null) ok(s.href === s.current && s.hint === 'Open full size', `desktop: "Open full size" opens ${s.name}.webp`);
      }
      await context.close();
    }
    // The phone capture is missing (as when offline before it was ever seen): the desktop capture is shown.
    {
      const context = await browser.newContext({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
      await context.route('**/*', r => /\/img\/guides\/phone\//.test(r.request().url()) ? r.abort() : /^(http:\/\/127\.|blob:|data:)/.test(r.request().url()) ? r.continue() : r.abort());
      const page = await context.newPage();
      page.on('pageerror', e => errors.push(`${page.url()}: ${e.message}`));
      await page.goto(`${origin}/guides/how-to-merge-pdf-files.html`);
      for (const s of await shots(page)) {
        ok(s.current.endsWith(`/img/guides/${s.name}.webp`) && s.natural === manifest[s.name].width, `without the phone capture, ${s.name} falls back to the desktop capture (${s.current})`);
        if (s.href !== null) ok(s.href === s.current, `and "Open full size" opens it (${s.href})`);
      }
      await context.close();
    }
  }

  ok(errors.length === 0, `no page errors: ${errors.join(' | ')}`);
  await browser.close();
  server.close();
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`✓ tutorials followed in the real tools: ${checks} checks`);
})().catch(e => { console.error(`✗ ${stage}: ${e.message}`); fs.rmSync(tmp, { recursive: true, force: true }); process.exit(1); });
