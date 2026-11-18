/* Resume library, end to end in a real browser (Chromium): saved resumes, autosave, My resumes,
   backups, damaged records, saving switched off, IndexedDB unavailable, cross-tab safety, the
   home page card and the new sections (references, custom sections, publications).

   The journey: create a resume and fill every main section, reload and confirm every field came
   back, edit, duplicate, rename, export, delete the original, import the backup and confirm every
   field again. Exported files are read back and checked independently (JSON parse with the frozen
   version 2 importer, pdftotext, unzip). Run with BROWSER_EXECUTABLE_PATH set to a Chromium binary. */
'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const cp = require('node:child_process');
const { chromium } = require('playwright');
const AxeBuilder = require('@axe-core/playwright').default;
const oldSchema = require('./fixtures/resume-schema-v2.js');
const schema = require('../js/resume-schema.js');

const root = path.resolve(__dirname, '..');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.webmanifest': 'application/json', '.json': 'application/json', '.webp': 'image/webp', '.ico': 'image/x-icon' };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const f = path.resolve(root, '.' + (p === '/' ? '/index.html' : p));
  if (!f.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
  fs.readFile(f, (e, d) => { res.writeHead(e ? 404 : 200, { 'Content-Type': mime[path.extname(f)] || 'application/octet-stream' }); res.end(e ? 'not found' : d); });
});
let checks = 0;
const ok = (c, m) => { assert(c, m); checks++; };
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'resume-library-'));

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const exe = process.env.BROWSER_EXECUTABLE_PATH;
  const browser = await chromium.launch({ headless: true, ...(exe ? { executablePath: exe } : {}), args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const errors = [];
  const newContext = async (options = {}) => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true, ...options });
    await context.route('**/*', route => /^(http:\/\/127\.|blob:|data:)/.test(route.request().url()) ? route.continue() : route.abort());
    return context;
  };
  const watch = page => {
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (/Content Security Policy|Refused to/.test(m.text())) errors.push(m.text()); });
    return page;
  };
  // Waits through a navigation as well: on the page being left the layout is simply not there yet.
  const ready = p => p.waitForFunction(() => { const el = document.getElementById('resumeAppLayout'); return !!el && !el.hasAttribute('aria-busy'); });
  const statusText = p => p.locator('#saveStatusText').textContent();
  const waitSaved = p => p.waitForFunction(() => /^Saved on this device/.test(document.getElementById('saveStatusText').textContent), null, { timeout: 8000 });
  const records = p => p.evaluate(async () => window.ApplyReadyStore.getAll('resumes'));
  const meta = (p, key) => p.evaluate(async k => { const row = await window.ApplyReadyStore.get('meta', k); return row ? row.value : undefined; }, key);
  const openSection = async (p, name) => { const sec = p.locator('#sec-' + name); if (!/\bopen\b/.test(await sec.getAttribute('class'))) await sec.locator('.accordion-header').first().click(); };
  const addSection = async (p, value) => { await p.locator('#optionalSectionSelect').selectOption(value); await p.locator('#btnAddOptionalSection').click(); };
  const openLibrary = async p => { await p.locator('#btnLibrary').click(); await p.locator('#libraryDialog').waitFor({ state: 'visible' }); await p.waitForFunction(() => document.querySelectorAll('#libList > li').length > 0); };
  const closeLibrary = async p => { await p.keyboard.press('Escape'); await p.locator('#libraryDialog').waitFor({ state: 'hidden' }); };
  const rowNames = p => p.locator('#libList .rl-row__name').allTextContents();
  const confirmDialog = p => p.locator('.dialog--confirm');
  const save = async (p, trigger, name) => { const d = p.waitForEvent('download'); await trigger(); const dl = await d; const file = path.join(out, name); await dl.saveAs(file); return file; };
  // Every text field of the Write step, by id: what the person typed, wherever it is.
  const snapshot = p => p.evaluate(() => Object.fromEntries([...document.querySelectorAll('#viewContent input[type="text"], #viewContent input[type="email"], #viewContent input[type="tel"], #viewContent textarea')]
    .filter(el => el.id).map(el => [el.id, el.value])));
  const sameFields = (a, b) => { const keys = new Set([...Object.keys(a), ...Object.keys(b)]); return [...keys].filter(k => a[k] !== b[k]); };
  const preview = p => p.locator('#resumeVisualPages').textContent();
  const audit = async (p, label) => {
    await p.waitForTimeout(200);
    const result = await new AxeBuilder({ page: p }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    ok(result.violations.length === 0, `${label}: accessibility violations: ${result.violations.map(v => `${v.id} (${v.nodes.map(n => n.target.join(' ')).slice(0, 3).join('; ')})`).join(', ')}`);
  };

  /* ---------------------------------------------------------------- 1. Create and fill a resume */
  const context = await newContext();
  const page = watch(await context.newPage());
  await page.goto(`${origin}/resume.html`);
  await ready(page);
  ok(/^New resume/.test(await statusText(page)), 'A first visit starts a new resume and says it saves as you type');
  ok((await records(page)).length === 0, 'Opening the builder does not write an empty resume');
  await page.waitForTimeout(900);
  ok((await records(page)).length === 0, 'An untouched blank resume is still not saved after the autosave delay');

  const personal = { fullName: 'Meera Krishnan', targetTitle: 'Data Analyst', email: 'meera.k@example.com', phone: '+91 98450 12345', location: 'Kochi, India', linkedin: 'linkedin.com/in/meerak', github: 'github.com/meerak', website: 'meerak.example.com' };
  for (const [id, value] of Object.entries(personal)) await page.locator('#' + id).fill(value);
  ok(/^Saving/.test(await statusText(page)), 'The status says Saving… while typing');
  const typedAt = Date.now();
  await waitSaved(page);
  const saveDelay = Date.now() - typedAt;
  ok(saveDelay >= 400 && saveDelay < 4000, `The resume is saved shortly after typing stops (${saveDelay} ms)`);
  ok((await records(page)).length === 1, 'The first change creates one saved resume');
  ok(/[?&]id=r_[A-Za-z0-9_-]+/.test(page.url()), 'The address bar carries the saved resume id');
  ok(await meta(page, 'persistAsked') === true, 'Persistent storage is requested once after the first save');
  ok((await page.locator('#resumeName').textContent()) === 'Meera Krishnan, Data Analyst', 'The new resume is named after the person and role');

  await openSection(page, 'summary');
  await page.locator('#summaryText').fill('Analyst who turns messy operational data into weekly decisions. SUMMARY_MARKER');
  await openSection(page, 'experience');
  await page.locator('#btnAddExperience').click();
  await page.locator('#btnAddExperience').click();
  const exp = n => page.locator('#experienceList .dynamic-item').nth(n);
  const expData = [['EXP_ROLE_ONE', 'EXP_COMPANY_ONE', 'Jan 2023 - Present', 'Kochi', 'Built a demand dashboard used by 40 stores\nCut report time by 30%'], ['EXP_ROLE_TWO', 'EXP_COMPANY_TWO', '2021 - 2022', 'Remote', 'Cleaned 2 million rows of sales data']];
  for (let i = 0; i < 2; i++) {
    const [role, company, duration, location, bullets] = expData[i];
    await exp(i).locator('.item-role').fill(role); await exp(i).locator('.item-company').fill(company);
    await exp(i).locator('.item-duration').fill(duration); await exp(i).locator('.item-location').fill(location);
    await exp(i).locator('.item-bullets').fill(bullets);
  }
  await openSection(page, 'education');
  await page.locator('#btnAddEducation').click();
  const edu = page.locator('#educationList .dynamic-item').first();
  await edu.locator('.item-degree').fill('EDU_DEGREE_MARKER'); await edu.locator('.item-institution').fill('Cochin University');
  await edu.locator('.item-duration').fill('2017 - 2021'); await edu.locator('.item-location').fill('Kochi'); await edu.locator('.item-score').fill('CGPA 8.6 / 10');
  await openSection(page, 'projects');
  await page.locator('#btnAddProject').click();
  const proj = page.locator('#projectsList .dynamic-item').first();
  await proj.locator('.item-name').fill('PROJECT_MARKER'); await proj.locator('.item-tech').fill('Python, SQL');
  await proj.locator('.item-link').fill('github.com/meerak/forecast'); await proj.locator('.item-bullets').fill('Forecast weekly demand within 8% error');
  await openSection(page, 'skills');
  await page.locator('#skillLanguages').fill('SQL, Python, Statistics'); await page.locator('#skillFrameworks').fill('pandas, dbt');
  await page.locator('#skillTools').fill('Power BI, Excel'); await page.locator('#skillOther').fill('Stakeholder communication');
  // New sections: publications, references and two custom sections
  await addSection(page, 'publications');
  await page.locator('#publicationsList textarea').first().fill('PUBLICATION_MARKER. Krishnan, M. Retail demand at small stores. Journal of Retail Analytics, 2024.');
  await addSection(page, 'references');
  ok(await page.locator('#sec-references').isVisible(), 'The References section appears when it is added');
  const ref = page.locator('#referencesList .dynamic-item').first();
  await ref.locator('[data-key="name"]').fill('REFEREE_MARKER Priya Nair'); await ref.locator('[data-key="title"]').fill('Head of Analytics, my manager');
  await ref.locator('[data-key="organization"]').fill('Example Retail'); await ref.locator('[data-key="contact"]').fill('priya.nair@example.com');
  await addSection(page, 'custom');
  const custom1 = page.locator('#customSectionsArea .custom-section').nth(0);
  ok(await custom1.locator('.cs-title').evaluate(el => el === document.activeElement), 'A new custom section puts focus on its heading field');
  await custom1.locator('.cs-title').fill('Courses');
  await custom1.locator('[data-key="title"]').first().fill('CUSTOM_ENTRY_MARKER Data Visualisation');
  await custom1.locator('[data-key="subtitle"]').first().fill('Coursera');
  await custom1.locator('[data-key="date"]').first().fill('2024');
  await custom1.locator('[data-key="bulletsText"]').first().fill('Built five dashboards for practice');
  await addSection(page, 'custom');
  const custom2 = page.locator('#customSectionsArea .custom-section').nth(1);
  await custom2.locator('.cs-title').fill('Interests');
  await custom2.locator('[data-act="mode"][data-mode="text"]').click();
  ok(await custom2.locator('[data-act="mode"][data-mode="text"]').getAttribute('aria-pressed') === 'true', 'A custom section switches to a text block and says so');
  await custom2.locator('.cs-text').fill('CUSTOM_TEXT_MARKER Long-distance running and teaching spreadsheets at a local library.');
  await waitSaved(page);
  await page.waitForFunction(() => document.getElementById('resumeVisualPages').textContent.includes('CUSTOM_TEXT_MARKER'));
  const shown = await preview(page);
  for (const mark of ['REFEREE_MARKER', 'CUSTOM_ENTRY_MARKER', 'CUSTOM_TEXT_MARKER', 'PUBLICATION_MARKER', 'COURSES', 'INTERESTS', 'REFERENCES']) ok(shown.includes(mark), `The preview shows ${mark}`);
  // The new sections take part in section order and visibility.
  await page.locator('#tabDesign').click();
  const orderNames = await page.locator('#sectionOrderContainer .section-order-row__name').allTextContents();
  ok(['References', 'Courses', 'Interests', 'Publications'].every(n => orderNames.includes(n)), `Section order lists references, publications and custom sections (${orderNames.join(', ')})`);
  const interestsRow = page.locator('#sectionOrderContainer .section-order-row').filter({ hasText: 'Interests' });
  await interestsRow.locator('[data-action="order-up"]').click();
  await page.waitForTimeout(100);
  const afterUp = await page.locator('#sectionOrderContainer .section-order-row__name').allTextContents();
  ok(afterUp.indexOf('Interests') < afterUp.indexOf('Courses'), 'A custom section moves up in the order with the keyboard-operable buttons');
  ok((await preview(page)).indexOf('INTERESTS') < (await preview(page)).indexOf('COURSES'), 'The preview follows the new order');
  await page.locator('#sectionOrderContainer .section-order-row').filter({ hasText: 'Interests' }).locator('.chk-section-vis').uncheck();
  ok(!(await preview(page)).includes('CUSTOM_TEXT_MARKER'), 'Hiding a custom section removes it from the preview');
  await page.locator('#sectionOrderContainer .section-order-row').filter({ hasText: 'Interests' }).locator('.chk-section-vis').check();
  ok((await preview(page)).includes('CUSTOM_TEXT_MARKER'), 'Showing it again brings it back');
  await page.locator('#tabContent').click();
  await waitSaved(page);
  const filled = await snapshot(page);
  ok(Object.values(filled).filter(Boolean).length >= 40, `The snapshot covers the filled form (${Object.values(filled).filter(Boolean).length} fields)`);

  // Exports carry the new sections (read back independently).
  await page.locator('#tabDownload').click();
  const pdfFile = await save(page, () => page.locator('#btnDownloadPDF').click(), 'journey.pdf');
  const pdfText = cp.execFileSync('pdftotext', ['-layout', pdfFile, '-'], { encoding: 'utf8' });
  for (const mark of ['Meera Krishnan', 'REFEREE_MARKER', 'CUSTOM_ENTRY_MARKER', 'CUSTOM_TEXT_MARKER', 'PUBLICATION_MARKER', 'EXP_ROLE_TWO', 'PROJECT_MARKER']) ok(pdfText.toUpperCase().includes(mark.toUpperCase()), `The PDF contains ${mark}`);
  ok(/Pages:\s+\d+/.test(cp.execFileSync('pdfinfo', [pdfFile], { encoding: 'utf8' })), 'pdfinfo reads the PDF');
  const docxFile = await save(page, () => page.locator('#btnDownloadDOCX').click(), 'journey.docx');
  cp.execFileSync('unzip', ['-t', docxFile], { stdio: 'pipe' });
  const docXml = cp.execFileSync('unzip', ['-p', docxFile, 'word/document.xml'], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
  for (const mark of ['REFEREE_MARKER', 'CUSTOM_ENTRY_MARKER', 'CUSTOM_TEXT_MARKER', 'PUBLICATION_MARKER']) ok(docXml.includes(mark), `The Word file contains ${mark}`);
  const txt = fs.readFileSync(await save(page, () => page.locator('#btnDownloadText').click(), 'journey.txt'), 'utf8');
  for (const mark of ['REFEREE_MARKER', 'CUSTOM_ENTRY_MARKER', 'CUSTOM_TEXT_MARKER', 'PUBLICATION_MARKER', 'COURSES']) ok(txt.includes(mark), `The text file contains ${mark}`);
  await page.locator('#tabContent').click();

  /* ---------------------------------------------------------------- 2. Reload: every field returns */
  const firstId = new URL(page.url()).searchParams.get('id');
  await page.reload();
  await ready(page);
  await page.waitForFunction(() => document.getElementById('fullName').value === 'Meera Krishnan');
  const restored = await snapshot(page);
  const diff = sameFields(filled, restored);
  ok(diff.length === 0, `After a reload every field is back as typed (differences: ${diff.join(', ')})`);
  ok(/^Saved on this device/.test(await statusText(page)), 'The status after reopening says it is saved on this device');
  ok(await page.locator('#btnUndo').isDisabled(), 'A reopened resume starts with an empty undo history');

  // Plain reload without ?id reopens the last resume too.
  await page.goto(`${origin}/resume.html`);
  await ready(page);
  ok(await page.locator('#fullName').inputValue() === 'Meera Krishnan', 'Returning to the builder reopens the last resume');

  /* ---------------------------------------------------------------- 3. Edit */
  const before = (await records(page))[0].updatedAt;
  await openSection(page, 'summary');
  await page.locator('#summaryText').fill('Analyst who turns messy operational data into weekly decisions for 40 stores. SUMMARY_EDITED');
  await waitSaved(page);
  const edited = (await records(page)).find(r => r.id === firstId);
  ok(edited.data.summary.includes('SUMMARY_EDITED') && edited.updatedAt > before, 'An edit is saved and moves the last-edited time forward');
  const afterEdit = await snapshot(page);

  /* ---------------------------------------------------------------- 4. My resumes: duplicate, rename */
  await openLibrary(page);
  ok(await page.locator('#libraryDialog [role="dialog"]').getAttribute('aria-modal') === 'true', 'My resumes is a modal dialog');
  ok(await page.locator('#mainContent').evaluate(el => el.inert), 'The page behind My resumes is inert');
  const row0 = page.locator('#libList .rl-row').first();
  ok((await row0.textContent()).includes('Open now') && (await row0.textContent()).includes('Classic Professional'), 'The list shows which resume is open and its template');
  ok(/Edited just now|Edited \d+ min ago/.test(await row0.locator('time').textContent()) && (await row0.locator('time').getAttribute('title')).length > 8, 'Each resume shows when it was last edited, with the full date on hover');
  await audit(page, 'library dialog (light)');
  await row0.locator('[data-act="duplicate"]').click();
  await page.waitForFunction(() => document.querySelectorAll('#libList .rl-row').length === 2);
  ok((await rowNames(page)).includes('Copy of Meera Krishnan, Data Analyst'), 'Duplicate adds a copy with a clear name');
  ok((await records(page)).length === 2, 'The copy is saved');
  const copyRow = page.locator('#libList .rl-row').filter({ hasText: 'Copy of Meera' });
  await copyRow.locator('[data-act="rename"]').click();
  const renameInput = page.locator('#libList .rl-rename .input');
  ok(await renameInput.evaluate(el => el === document.activeElement), 'Rename puts focus in a labelled field');
  ok((await page.locator(`label[for="${await renameInput.getAttribute('id')}"]`).textContent()).includes('New name for'), 'The rename field has a label');
  await renameInput.press('Escape');
  ok(await page.locator('#libraryDialog').isVisible() && await page.locator('#libList .rl-rename').count() === 0, 'Escape cancels renaming without closing the dialog');
  await copyRow.locator('[data-act="rename"]').click();
  // An empty name is refused with a message under the field, linked to it.
  await page.locator('#libList .rl-rename .input').fill('   ');
  await page.locator('#libList .rl-rename .input').press('Enter');
  const emptyName = await page.locator('#libList .rl-rename .input').evaluate(el => ({ invalid: el.getAttribute('aria-invalid'), error: (document.getElementById(el.getAttribute('aria-describedby') || 'none') || {}).textContent, focused: el === document.activeElement }));
  ok(emptyName.invalid === 'true' && emptyName.error === 'Enter a name for this resume.' && emptyName.focused, 'An empty name is explained under the field');
  await page.locator('#libList .rl-rename .input').fill('  Analyst  version   for retail ');
  ok(await page.locator('#libRenameError').count() === 0, 'Typing a name clears the message');
  await page.locator('#libList .rl-rename .input').press('Enter');
  await page.waitForFunction(() => [...document.querySelectorAll('#libList .rl-row__name')].some(n => n.textContent === 'Analyst version for retail'));
  ok((await records(page)).some(r => r.name === 'Analyst version for retail'), 'Rename is saved with tidy spacing');
  ok(await page.locator('#libList [data-act="rename"]').evaluateAll(btns => btns.some(b => b === document.activeElement)), 'Focus returns to a Rename button after renaming');
  // Focus stays in the dialog and Escape returns to the button that opened it.
  for (let i = 0; i < 25; i++) await page.keyboard.press('Tab');
  ok(await page.evaluate(() => !!document.activeElement.closest('#libraryDialog')), 'Tab keeps focus inside My resumes');
  await closeLibrary(page);
  ok(await page.locator('#btnLibrary').evaluate(el => el === document.activeElement), 'Closing My resumes returns focus to its button');

  /* ---------------------------------------------------------------- 5. Export, delete the original, import */
  await openLibrary(page);
  const originalRow = page.locator('#libList .rl-row').filter({ hasText: 'Meera Krishnan, Data Analyst' }).filter({ hasNotText: 'Copy' });
  const backupFile = await save(page, () => originalRow.locator('[data-act="export"]').click(), 'backup-single.json');
  const backup = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
  ok(backup.app === 'ApplyReady' && backup.version === 2 && typeof backup.exportedAt === 'string' && backup.data, 'The single backup uses the documented envelope');
  ok(oldSchema.validate(backup), 'The importer of the previous release accepts the single backup');
  const oldView = oldSchema.migrate(backup);
  ok(oldView.personal.fullName === 'Meera Krishnan' && oldView.experience.length === 2 && oldView.academic.publications.length === 1, 'The previous release would keep the main content and the publications');
  ok(schema.validate(backup) && schema.migrate(backup).references[0].name.startsWith('REFEREE_MARKER'), 'This release reads the backup with references');

  const allFile = await save(page, () => page.locator('#libraryDialog [data-act="export-all"]').click(), 'backup-all.json');
  const all = JSON.parse(fs.readFileSync(allFile, 'utf8'));
  ok(all.app === 'ApplyReady' && all.kind === 'resume-library' && all.version === 1 && all.resumes.length === 2 && all.resumes.every(r => r.name && r.data && typeof r.updatedAt === 'number'), 'Export all writes the library format with both resumes');

  await originalRow.locator('[data-act="delete"]').click();
  await confirmDialog(page).waitFor({ state: 'visible' });
  ok((await confirmDialog(page).locator('.dialog__title').textContent()).includes('Meera Krishnan, Data Analyst'), 'Delete asks for confirmation and names the resume');
  ok(await confirmDialog(page).locator('[data-act="cancel"]').evaluate(el => el === document.activeElement), 'The safe choice has focus in the delete confirmation');
  await confirmDialog(page).locator('[data-act="cancel"]').click();
  ok((await records(page)).length === 2, 'Cancelling keeps the resume');
  await originalRow.locator('[data-act="delete"]').click();
  await confirmDialog(page).locator('[data-act="ok"]').click();
  await page.waitForFunction(() => document.querySelectorAll('#libList .rl-row').length === 1);
  ok((await records(page)).length === 1 && (await records(page))[0].name === 'Analyst version for retail', 'Delete removes only that resume');
  ok((await page.locator('#resumeName').textContent()) === 'Analyst version for retail', 'Deleting the open resume opens the remaining one');

  await page.locator('#libImportInput').setInputFiles(backupFile);
  await page.locator('#libraryDialog').waitFor({ state: 'hidden' });
  await page.waitForFunction(() => document.getElementById('resumeName').textContent === 'Meera Krishnan, Data Analyst');
  ok((await records(page)).length === 2, 'Import adds the backup as a new resume');
  const importedId = new URL(page.url()).searchParams.get('id');
  ok(importedId && importedId !== firstId, 'The imported resume gets a new id');
  const afterImport = await snapshot(page);
  const importDiff = sameFields(afterEdit, afterImport);
  ok(importDiff.length === 0, `Every field is restored from the backup (differences: ${importDiff.join(', ')})`);
  ok(await page.locator('#fullName').evaluate(el => el === document.activeElement), 'After import the restored contact details have focus');
  await page.waitForFunction(() => document.getElementById('resumeVisualPages').textContent.includes('REFEREE_MARKER'));
  ok((await preview(page)).includes('CUSTOM_ENTRY_MARKER'), 'The imported resume previews with its custom sections');

  /* ---------------------------------------------------------------- 6. Bad backups are refused calmly */
  const libCount = (await records(page)).length;
  const badFiles = [
    ['broken.json', '{"app":"ApplyReady", "version": 2, "data": {', /not valid JSON/],
    ['other.json', JSON.stringify({ app: 'SomeOtherApp', version: 2, data: { personal: {}, experience: [], education: [], projects: [] } }), /different app/],
    ['newer.json', JSON.stringify({ app: 'ApplyReady', version: 7, data: { personal: {}, experience: [], education: [], projects: [] } }), /newer version/],
    ['damaged.json', JSON.stringify({ app: 'ApplyReady', version: 2, data: { personal: { fullName: ['x'] }, experience: [], education: [], projects: [] } }), /not an ApplyReady resume backup/],
    ['empty.json', '', /empty/]
  ];
  await openLibrary(page);
  for (const [name, body, pattern] of badFiles) {
    await page.locator('#libImportInput').setInputFiles({ name, mimeType: 'application/json', buffer: Buffer.from(body) });
    await page.locator('#libError [role="alert"]').waitFor();
    ok(pattern.test(await page.locator('#libError [role="alert"]').textContent()), `${name} is refused with a plain message`);
  }
  await page.locator('#libImportInput').setInputFiles({ name: 'huge.json', mimeType: 'application/json', buffer: Buffer.alloc(5 * 1024 * 1024 + 10, 32) });
  await page.waitForFunction(() => /larger than 5 MB/.test(document.getElementById('libError').textContent));
  ok(true, 'A file over 5 MB is refused before it is read');
  ok((await records(page)).length === libCount, 'Refused files leave the saved resumes unchanged');
  await audit(page, 'library dialog with an import error');
  await closeLibrary(page);

  // Old backups: version 2 with publications inside Academic, and version 1 without an app marker.
  const v2Backup = { version: 2, app: 'ApplyReady', exportedAt: '2026-10-01T10:00:00.000Z', data: { version: 2, template: 'academic-cv', personal: { fullName: 'Old Two' }, experience: [], education: [{ id: 'e1', degree: 'PhD', institution: 'IISc' }], projects: [], sectionVisibility: { academic: true }, academic: { publications: [{ title: 'OLD_PUBLICATION_MARKER' }], teaching: [{ role: 'OLD_TEACHING_MARKER', institution: 'IISc', term: '2022' }], presentations: [], grants: [] } } };
  await page.locator('#tabDownload').click();
  await page.locator('#fileImportInput').setInputFiles({ name: 'old-v2.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(v2Backup)) });
  await page.waitForFunction(() => document.getElementById('fullName').value === 'Old Two');
  await page.waitForFunction(() => document.getElementById('resumeVisualPages').textContent.includes('OLD_PUBLICATION_MARKER'));
  ok(await page.locator('#sec-publications').isVisible() && (await page.locator('#publicationsList textarea').first().inputValue()) === 'OLD_PUBLICATION_MARKER', 'A version 2 backup opens with its publications in the Publications section');
  ok((await preview(page)).includes('OLD_TEACHING_MARKER') && (await page.locator('#prevTemplateBadge').textContent()) === 'Academic / Research CV', 'Teaching and the template come across too');
  await page.locator('#tabDownload').click();
  await page.locator('#fileImportInput').setInputFiles({ name: 'old-v1.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ version: 1, data: { personal: { fullName: 'Old One' }, experience: [{ role: 'V1_ROLE_MARKER' }], education: [], projects: [] } })) });
  await page.waitForFunction(() => document.getElementById('fullName').value === 'Old One');
  ok((await records(page)).length === libCount + 2, 'Old version 1 and 2 backups each become a new saved resume');

  /* ---------------------------------------------------------------- 7. Damaged records */
  await page.evaluate(async () => {
    await window.ApplyReadyStore.put('resumes', { id: 'r_damaged_one', name: 'Broken <b>one</b>', createdAt: 1, updatedAt: 2, schemaVersion: 3, data: { personal: 'not an object' } });
    await window.ApplyReadyStore.put('resumes', { id: 'bad id" onclick="x', name: 'Bad id', createdAt: 1, updatedAt: 3, schemaVersion: 3, data: {} });
  });
  await page.goto(`${origin}/resume.html?id=r_damaged_one`);
  await ready(page);
  ok(await page.locator('#saveNotice').filter({ hasText: 'damaged and cannot be opened' }).isVisible(), 'A link to a damaged resume explains that it cannot be opened');
  ok(await page.locator('#fullName').inputValue() === '', 'A damaged resume is never loaded into the editor');
  await openLibrary(page);
  ok(await page.locator('#libList .rl-row.is-damaged').count() === 2, 'Damaged records are listed as damaged');
  ok((await page.locator('#libList .rl-row.is-damaged').first().textContent()).includes('Damaged'), 'Damaged rows say so in words');
  ok(await page.locator('#libList b').count() === 0 && await page.locator('#libList [onclick]').count() === 0, 'Names and ids from damaged records cannot inject markup');
  const rawFile = await save(page, () => page.locator('#libList .rl-row.is-damaged').filter({ hasText: 'Broken' }).locator('[data-act="export-raw"]').click(), 'damaged.json');
  ok(JSON.parse(fs.readFileSync(rawFile, 'utf8')).record.data.personal === 'not an object', 'Export raw downloads the record exactly as stored');
  await page.locator('#libList .rl-row.is-damaged').filter({ hasText: 'Broken' }).locator('[data-act="delete-damaged"]').click();
  await confirmDialog(page).locator('[data-act="ok"]').click();
  await page.waitForFunction(() => document.querySelectorAll('#libList .rl-row.is-damaged').length === 1);
  await page.locator('#libList .rl-row.is-damaged [data-act="delete-damaged"]').click();
  await confirmDialog(page).locator('[data-act="ok"]').click();
  await page.waitForFunction(() => document.querySelectorAll('#libList .rl-row.is-damaged').length === 0);
  ok(!(await records(page)).some(r => r.id === 'r_damaged_one' || r.id.startsWith('bad id')), 'Damaged records can be deleted');
  await closeLibrary(page);
  await page.goto(`${origin}/resume.html?id=r_never_saved_here`);
  await ready(page);
  ok(await page.locator('#saveNotice').filter({ hasText: 'not saved in this browser' }).isVisible(), 'A link to a resume from another device says where saved resumes live');
  await audit(page, 'builder with a notice (light)');

  /* ---------------------------------------------------------------- 8. Home page card and ?id= */
  await page.goto(`${origin}/index.html`);
  await page.locator('#homeResumes').waitFor({ state: 'visible' });
  const cards = await page.locator('#homeResumes .tool-card__name').allTextContents();
  ok(cards.length >= 1 && cards.length <= 3 && cards.every(c => c.startsWith('Continue editing ')), `The home page offers to continue saved resumes (${cards.join(' | ')})`);
  ok(/Edited (just now|\d+ min ago)/.test(await page.locator('#homeResumes .tool-card__desc').first().textContent()), 'Each card says when the resume was edited');
  const newest = (await records(page)).sort((a, b) => b.updatedAt - a.updatedAt);
  ok(cards[0] === `Continue editing ${newest[0].name}` && cards.length === Math.min(3, newest.length), 'The cards list the most recently edited resumes first');
  const target = page.locator('#homeResumes a').nth(1);
  ok(/resume\.html\?id=r_/.test(await target.getAttribute('href')), 'The card links to resume.html with the resume id');
  await target.click();
  await ready(page);
  ok((await page.locator('#resumeName').textContent()) === newest[1].name, 'resume.html opens the resume named in ?id=');
  await page.goto(`${origin}/index.html`);
  await audit(page, 'home page with saved resumes');

  /* ---------------------------------------------------------------- 9. Two tabs on the same resume */
  await page.goto(`${origin}/resume.html`);
  await ready(page);
  const sharedId = new URL(page.url()).searchParams.get('id') || (await records(page)).sort((a, b) => b.updatedAt - a.updatedAt)[0].id;
  await page.goto(`${origin}/resume.html?id=${sharedId}`);
  await ready(page);
  const other = watch(await context.newPage());
  await other.goto(`${origin}/resume.html?id=${sharedId}`);
  await ready(other);
  // With nothing unsaved in the first tab, the newer version simply appears there: nothing to choose.
  await other.locator('#targetTitle').fill('QUIET_UPDATE_TITLE');
  await waitSaved(other);
  await page.waitForFunction(() => document.getElementById('targetTitle').value === 'QUIET_UPDATE_TITLE', null, { timeout: 5000 });
  ok(await page.locator('#saveNotice').isHidden() && /^Saved on this device/.test(await statusText(page)), 'A tab with no unsaved changes takes the version saved in another tab without asking');
  // With an unsaved edit here, a save from another tab pauses saving and asks.
  await page.locator('#targetTitle').fill('FIRST_TAB_TITLE');
  await other.evaluate(async id => {
    const rec = await window.ApplyReadyStore.get('resumes', id);
    rec.data.personal.targetTitle = 'OTHER_TAB_TITLE';
    rec.updatedAt = Date.now() + 5;
    await window.ApplyReadyStore.put('resumes', rec);
    const channel = new BroadcastChannel('applyready-resumes');
    channel.postMessage({ from: 'another-tab', type: 'saved', id, updatedAt: rec.updatedAt });
    channel.close();
  }, sharedId);
  await page.locator('#saveNotice').filter({ hasText: 'changed in another tab' }).waitFor({ timeout: 5000 });
  ok(true, 'The first tab is told that another tab changed the same resume while it had unsaved changes');
  await page.waitForTimeout(1200);
  ok((await records(page)).find(r => r.id === sharedId).data.personal.targetTitle === 'OTHER_TAB_TITLE', 'The first tab does not silently overwrite the other tab');
  ok(/changed in another tab/.test(await statusText(page)), 'The status says saving is paused');
  await page.locator('#saveNotice [data-notice="reload"]').click();
  await page.waitForFunction(() => document.getElementById('targetTitle').value === 'OTHER_TAB_TITLE');
  ok(await page.locator('#saveNotice').isHidden(), 'Loading the other version clears the notice');
  await openSection(page, 'summary');
  await page.locator('#summaryText').fill('Back in control SUMMARY_FIRST_TAB');
  await waitSaved(page);
  ok((await records(page)).find(r => r.id === sharedId).data.summary.includes('SUMMARY_FIRST_TAB'), 'Saving resumes after the choice');
  await other.close();

  /* ---------------------------------------------------------------- 10. Undo stays with its resume */
  const beforeNew = (await records(page)).length;
  await openLibrary(page);
  await page.locator('#libraryDialog [data-act="new"]').dblclick();
  await page.locator('#libraryDialog').waitFor({ state: 'hidden' });
  await page.waitForTimeout(900);
  ok((await records(page)).length === beforeNew, 'New resume, even double-clicked, stores no blank entry until something is typed');
  ok(await page.locator('#fullName').inputValue() === '' && await page.locator('#btnUndo').isDisabled(), 'A new resume starts empty with no undo history');
  ok((await page.locator('#resumeName').textContent()) === 'Untitled resume', 'A new resume is called Untitled resume until it has a name');
  await page.locator('#fullName').fill('Beta Person');
  ok(await page.locator('#btnUndo').isEnabled(), 'Typing in the new resume can be undone');
  await waitSaved(page);
  ok((await records(page)).length === beforeNew + 1, 'Typing into the new resume stores it once');
  ok((await page.locator('#resumeName').textContent()) === 'Beta Person', 'The new resume takes its name from the person once saved');
  await openLibrary(page);
  await page.locator('#libList .rl-row').filter({ hasText: 'Analyst version for retail' }).locator('[data-act="open"]').click();
  await page.waitForFunction(() => document.getElementById('resumeName').textContent === 'Analyst version for retail');
  ok(await page.locator('#btnUndo').isDisabled(), 'Switching resumes clears the undo history');
  await page.locator('#fullName').fill('Meera K');
  await page.locator('#btnUndo').click();
  ok(await page.locator('#fullName').inputValue() === 'Meera Krishnan', 'Undo in this resume never brings back text from the other one');
  await waitSaved(page);

  /* ---------------------------------------------------------------- 11. Phone width and dark theme */
  await page.setViewportSize({ width: 320, height: 720 });
  await openLibrary(page);
  ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'My resumes fits a 320 px screen without sideways scrolling');
  ok(await page.locator('#libraryDialog .rl-dialog').evaluate(el => el.scrollWidth <= el.clientWidth + 1), 'The dialog content fits its width at 320 px');
  await closeLibrary(page);
  await page.locator('#themeToggle').click();
  await openLibrary(page);
  await audit(page, 'library dialog (dark)');
  await closeLibrary(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await context.close();

  /* ---------------------------------------------------------------- 12. Saving switched off writes nothing */
  {
    const ctx = await newContext();
    const p = watch(await ctx.newPage());
    await p.goto(`${origin}/resume.html`);
    await ready(p);
    await p.locator('#tabDownload').click();
    await p.locator('#chkSaveDevice').uncheck();
    await p.locator('#tabContent').click();
    await p.locator('#fullName').fill('Cafe Visitor');
    await p.locator('#email').fill('visitor@example.com');
    await p.waitForTimeout(1500);
    ok((await records(p)).length === 0, 'With saving off, nothing about the resume is written');
    ok(await meta(p, 'resumeSaving') === 'off' && await meta(p, 'lastResumeId') === undefined, 'Only the choice itself is remembered');
    ok(await p.evaluate(() => !JSON.stringify(localStorage).includes('Cafe Visitor')), 'Nothing is written to localStorage either');
    ok(/saving is off/.test(await statusText(p)), 'The status says saving is off');
    ok(await p.locator('#saveNotice').filter({ hasText: 'lost when you close the tab' }).isVisible(), 'A note explains that work is lost when the tab closes');
    await audit(p, 'builder with saving off');
    const backupOff = await save(p, () => p.locator('#saveNotice [data-notice="backup"]').click(), 'off-backup.json');
    ok(JSON.parse(fs.readFileSync(backupOff, 'utf8')).data.personal.fullName === 'Cafe Visitor', 'A backup can still be downloaded with saving off');
    await openLibrary(p);
    ok(!(await p.locator('#libSaveSwitch').isChecked()), 'My resumes shows saving as off');
    await closeLibrary(p);
    let warned = false;
    p.on('dialog', d => { if (d.type() === 'beforeunload') warned = true; return d.accept(); });
    await p.close({ runBeforeUnload: true });
    await new Promise(r => setTimeout(r, 300));
    ok(warned, 'Leaving with unsaved changes asks for confirmation when saving is off');
    const again = watch(await ctx.newPage());
    await again.goto(`${origin}/resume.html`);
    await ready(again);
    ok(await again.locator('#fullName').inputValue() === '' && !(await again.locator('#chkSaveDevice').isChecked()), 'The next visit starts empty and saving stays off');
    await again.locator('#tabDownload').click();
    await again.locator('#chkSaveDevice').check();
    await again.locator('#tabContent').click();
    await again.locator('#fullName').fill('Now Saved');
    await waitSaved(again);
    ok((await records(again)).length === 1, 'Turning saving back on saves the open resume');
    // Switching off again on a shared computer: the note says what is still stored and where to delete it.
    await again.locator('#tabDownload').click();
    await again.locator('#chkSaveDevice').uncheck();
    await again.locator('#saveNotice').filter({ hasText: '1 resume saved earlier is still in this browser' }).waitFor();
    await again.locator('#saveNotice [data-notice="library"]').click();
    await again.locator('#libraryDialog').waitFor({ state: 'visible' });
    await again.locator('#libraryDialog [data-act="delete-all"]').click();
    ok(/Delete all 1 saved resume/.test(await confirmDialog(again).textContent()), 'Delete all asks first and says how many resumes it removes');
    await confirmDialog(again).locator('[data-act="ok"]').click();
    await again.waitForFunction(() => document.querySelectorAll('#libList [data-act="delete"]').length === 0);
    ok(await again.locator('#libraryDialog [data-act="delete-all"]').isDisabled(), 'Delete all is unavailable once nothing is saved');
    await closeLibrary(again);
    ok((await records(again)).length === 0 && !(await again.locator('#saveNotice').textContent()).includes('saved earlier'), 'After Delete all, nothing is left and the note no longer mentions saved resumes');
    await ctx.close();
  }

  /* ---------------------------------------------------------------- 13. The old localStorage draft moves into the library */
  {
    const ctx = await newContext();
    const p = watch(await ctx.newPage());
    await p.goto(`${origin}/index.html`);
    await p.evaluate(() => {
      localStorage.setItem('applyready_draft_enabled', 'true');
      localStorage.setItem('applyready_resume_draft', JSON.stringify({ version: 2, app: 'ApplyReady', savedAt: '2026-11-10T08:00:00.000Z', data: { personal: { fullName: 'Legacy Draft Person' }, experience: [{ id: 'exp-1', role: 'LEGACY_ROLE' }], education: [], projects: [] } }));
    });
    await p.goto(`${origin}/resume.html`);
    await ready(p);
    ok(await p.locator('#fullName').inputValue() === 'Legacy Draft Person', 'The draft saved by the earlier version opens automatically');
    const migrated = await records(p);
    ok(migrated.length === 1 && migrated[0].data.experience[0].role === 'LEGACY_ROLE' && migrated[0].updatedAt === Date.parse('2026-11-10T08:00:00.000Z'), 'The draft becomes a saved resume, keeping its date');
    ok(await p.evaluate(() => localStorage.getItem('applyready_resume_draft') === null && localStorage.getItem('applyready_draft_enabled') === null), 'The old draft keys are removed after the move');
    await p.reload();
    await ready(p);
    ok((await records(p)).length === 1, 'The move happens only once');
    await ctx.close();
  }

  /* ---------------------------------------------------------------- 14. IndexedDB unavailable */
  {
    const ctx = await newContext();
    await ctx.addInitScript(() => { IDBFactory.prototype.open = function () { throw new Error('IndexedDB disabled for this test'); }; });
    const p = watch(await ctx.newPage());
    await p.goto(`${origin}/resume.html`);
    await ready(p);
    ok(await p.locator('#saveNotice').filter({ hasText: 'not keeping data' }).isVisible(), 'Without IndexedDB a warning says the work is kept in memory only');
    await p.locator('#fullName').fill('Memory Only');
    await p.waitForTimeout(1000);
    ok(/not keeping data/.test(await statusText(p)), 'The status never claims the resume is saved on this device');
    await audit(p, 'builder without IndexedDB');
    let warned = false;
    p.on('dialog', d => { if (d.type() === 'beforeunload') warned = true; return d.accept(); });
    await p.close({ runBeforeUnload: true });
    await new Promise(r => setTimeout(r, 300));
    ok(warned, 'Leaving asks for confirmation when nothing can be stored');
    await ctx.close();
  }

  /* ---------------------------------------------------------------- 15. Limits: what is saved always reopens */
  {
    const ctx = await newContext();
    const p = watch(await ctx.newPage());
    await p.goto(`${origin}/resume.html`);
    await ready(p);
    await p.locator('#fullName').fill('Limit Tester');
    await openSection(p, 'summary');
    // An old CV pasted into one box: 52,000 characters. The box keeps 50,000 and says the rest was left out.
    const para = 'Experienced coordinator who managed schedules, vendors and budgets for regional events and trained new staff. ';
    await p.locator('#summaryText').focus();
    await p.keyboard.insertText(para.repeat(Math.ceil(52000 / para.length)).slice(0, 52000));
    ok((await p.locator('#summaryText').inputValue()).length === schema.MAX_TEXT, 'A box stops at the 50,000 characters a saved resume can hold');
    const limitNote = p.locator('#summaryText + .rb-limit-note');
    ok(/50,000 characters, so the end of the pasted text was left out/.test(await limitNote.textContent()), 'Pasting past the limit says under the box that the end was left out');
    ok((await p.locator('#summaryText').getAttribute('aria-describedby')).includes(await limitNote.getAttribute('id')), 'The note is read with the box');
    await waitSaved(p);
    ok(await limitNote.isVisible(), 'The note stays after the save message');
    await p.locator('#summaryText').press('End');
    await p.locator('#summaryText').press('Backspace');
    ok(await limitNote.count() === 0, 'The note goes once the box is under the limit again');
    await p.locator('#summaryText').press('x');
    await p.waitForTimeout(800);
    await p.reload();
    await ready(p);
    ok(await p.locator('#fullName').inputValue() === 'Limit Tester', 'A resume with a full box reopens after reload');
    ok((await p.locator('#summaryText').inputValue()).length === schema.MAX_TEXT, 'The full box comes back whole');
    await p.locator('#tabDownload').click();
    const fullBackup = await save(p, () => p.locator('#btnExportJSON').click(), 'limit-backup.json');
    await p.locator('#tabContent').click();
    ok(JSON.parse(fs.readFileSync(fullBackup, 'utf8')).data.summary.length === schema.MAX_TEXT, 'The backup holds every character of the box');
    await openLibrary(p);
    ok(await p.locator('#libList .rl-row.is-damaged').count() === 0, 'A resume at the limits is never listed as damaged');
    await closeLibrary(p);

    // Lists stop at 150 entries, for Add and for Duplicate, with a message.
    await p.evaluate(n => {
      const ed = window.ApplyReadyResumeEditor;
      const d = JSON.parse(JSON.stringify(ed.getData()));
      d.experience = Array.from({ length: n }, (_, i) => ({ id: 'exp-' + i, role: 'Role ' + i, company: '', duration: '', location: '', bulletsText: '' }));
      ed.setResume(d);
    }, schema.MAX_ENTRIES - 1);
    await openSection(p, 'experience');
    await p.locator('#btnAddExperience').click();
    const expCount = () => p.evaluate(() => window.ApplyReadyResumeEditor.getData().experience.length);
    ok(await expCount() === schema.MAX_ENTRIES, 'Add role works up to 150 roles');
    await p.locator('#btnAddExperience').click();
    ok(await expCount() === schema.MAX_ENTRIES, 'Add role stops at 150 roles');
    await p.waitForFunction(() => /up to 150 entries/.test(document.body.textContent));
    await p.locator('#experienceList [data-action="duplicate-exp"]').first().click();
    ok(await expCount() === schema.MAX_ENTRIES, 'Duplicate stops at 150 roles too');
    await waitSaved(p);

    // Defence in depth: data over the limit that reached the editor anyway is not stored and the status says so.
    await p.evaluate(() => { window.ApplyReadyResumeEditor.getData().summary = 'x'.repeat(50001); });
    await p.locator('#targetTitle').fill('Coordinator');
    await p.waitForFunction(() => /too long to store/.test(document.getElementById('saveStatusText').textContent), null, { timeout: 8000 });
    ok(await p.locator('#saveNotice').filter({ hasText: 'Shorten it' }).isVisible(), 'A resume over the limits says what to do instead of claiming it is saved');
    ok(!(await records(p)).some(r => r.data.summary.length > schema.MAX_TEXT), 'A resume over the limits is never written');
    await p.evaluate(() => { window.ApplyReadyResumeEditor.getData().summary = 'Back to a normal summary.'; });
    await p.locator('#targetTitle').fill('Coordinator II');
    await waitSaved(p);
    ok((await records(p)).some(r => r.data.summary === 'Back to a normal summary.'), 'Saving resumes once the text is short enough');

    // A record saved by an earlier release with more than the limits opens shortened, says so, and
    // keeps the stored original until the resume is changed.
    await p.evaluate(async () => {
      await window.ApplyReadyStore.put('resumes', { id: 'r_over_limits', name: 'Over Limits', createdAt: 5, updatedAt: Date.now() + 5000, schemaVersion: 3, data: {
        personal: { fullName: 'Over Limits' }, summary: 'y'.repeat(60000), education: [], projects: [],
        experience: Array.from({ length: 160 }, (_, i) => ({ id: 'e' + i, role: 'Role ' + i, bulletsText: '' }))
      } });
    });
    await p.goto(`${origin}/resume.html?id=r_over_limits`);
    await ready(p);
    ok(await p.locator('#fullName').inputValue() === 'Over Limits', 'A record over the limits from an earlier release opens instead of being damaged');
    ok((await p.locator('#summaryText').inputValue()).length === schema.MAX_TEXT && await expCount() === schema.MAX_ENTRIES, 'It opens shortened to the limits');
    ok(await p.locator('#saveNotice').filter({ hasText: 'too long to open in full' }).isVisible(), 'A notice says that part of it was too long to open');
    const original = await save(p, () => p.locator('#saveNotice [data-notice="original"]').click(), 'original.json');
    const originalRecord = JSON.parse(fs.readFileSync(original, 'utf8')).record;
    ok(originalRecord.data.summary.length === 60000 && originalRecord.data.experience.length === 160, 'Download the original saves the full stored text');
    ok((await records(p)).find(r => r.id === 'r_over_limits').data.summary.length === 60000, 'Opening it does not overwrite the stored original');
    await openLibrary(p);
    ok(await p.locator('#libList .rl-row.is-damaged').count() === 0, 'It is not listed as damaged');
    await save(p, () => p.locator('#libraryDialog [data-act="export-all"]').click(), 'all-limits.json');
    await p.waitForFunction(() => /shortened in the backup/.test(document.body.textContent));
    ok(true, 'Export all says which resumes it holds shortened');
    await closeLibrary(p);
    await p.locator('#targetTitle').fill('Edited');
    await waitSaved(p);
    ok(await p.locator('#saveNotice').filter({ hasText: 'too long to open in full' }).count() === 0, 'The notice goes once the shortened resume is saved');
    const stored = (await records(p)).find(r => r.id === 'r_over_limits');
    ok(schema.validate({ data: stored.data }), 'What is saved after editing passes the strict check, so it always reopens');
    await audit(p, 'builder at the limits');
    await ctx.close();
  }

  /* ---------------------------------------------------------------- 16. Quitting the browser right after typing */
  {
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'resume-quit-'));
    const exePath = process.env.BROWSER_EXECUTABLE_PATH;
    const launchProfile = () => chromium.launchPersistentContext(profile, { headless: true, ...(exePath ? { executablePath: exePath } : {}), args: ['--no-sandbox', '--disable-dev-shm-usage'], viewport: { width: 1280, height: 900 } });
    let ctx = await launchProfile();
    let p = watch(ctx.pages()[0] || await ctx.newPage());
    await p.goto(`${origin}/resume.html`);
    await ready(p);
    await p.locator('#fullName').fill('Quick Quitter');
    await waitSaved(p);
    await openSection(p, 'summary');
    await p.locator('#summaryText').fill('Typed just before quitting.');
    await ctx.close(); // the whole browser, at once, while the save would still be waiting
    ctx = await launchProfile();
    p = watch(ctx.pages()[0] || await ctx.newPage());
    await p.goto(`${origin}/resume.html`);
    await ready(p);
    ok(await p.locator('#fullName').inputValue() === 'Quick Quitter', 'The resume reopens after the browser was quit');
    ok(await p.locator('#summaryText').inputValue() === 'Typed just before quitting.', 'The last edit before quitting the browser is kept');
    ok(await p.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('applyready_resume_unsaved:')).length) === 0, 'The temporary copy is removed once the save is finished');
    ok((await records(p)).length === 1, 'Finishing the cut-short save adds no extra resume');
    await ctx.close();
    fs.rmSync(profile, { recursive: true, force: true });
  }

  ok(errors.length === 0, 'No page errors: ' + errors.join(' | '));
  await browser.close();
  server.close();
  console.log(`✓ Resume library: create, autosave, reopen, edit, duplicate, rename, export, delete, import, bad files, old backups, damaged records, home card, two tabs, separate undo, saving off, old draft, no IndexedDB, new sections in every export (${checks} checks)`);
})().catch(e => { console.error(e); try { server.close(); } catch (_) {} process.exit(1); });
