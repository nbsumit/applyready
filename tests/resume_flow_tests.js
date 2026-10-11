/* Resume builder editing flow, end to end in a real browser (Chromium).
   Blank start, every kind of entry (add, edit, reorder, duplicate, delete), optional sections,
   section order, templates and design settings, review findings and Fix, undo and redo,
   backup export, start over and import, and the exports, then the phone Edit and Preview flow.
   The exported files are read back, so this checks what the user gets, not only what the page shows. */
'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const cp = require('node:child_process');
const { chromium } = require(path.join(__dirname, '..', 'node_modules', 'playwright'));

const root = path.resolve(__dirname, '..');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.webmanifest': 'application/json', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const f = path.resolve(root, '.' + (p === '/' ? '/index.html' : p));
  fs.readFile(f, (e, d) => { res.writeHead(e ? 404 : 200, { 'Content-Type': mime[path.extname(f)] || 'application/octet-stream' }); res.end(e ? 'nf' : d); });
});
let checks = 0;
const ok = (c, m) => { assert(c, m); checks++; };
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'resume-flow-'));

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const exe = process.env.BROWSER_EXECUTABLE_PATH;
  const browser = await chromium.launch({ headless: true, ...(exe ? { executablePath: exe } : {}), args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  await context.route('**/*', route => /^(http:\/\/127\.|blob:|data:)/.test(route.request().url()) ? route.continue() : route.abort());
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const dialog = page.locator('.dialog--confirm');
  const confirmIfAsked = async () => { if (await dialog.waitFor({ state: 'visible', timeout: 800 }).then(() => true, () => false)) await dialog.locator('[data-act="ok"]').click(); };
  const tab = id => page.locator(id).click();
  const save = async (button, name) => { const d = page.waitForEvent('download'); await page.locator(button).click(); const dl = await d; const file = path.join(out, name); await dl.saveAs(file); return file; };
  const has = (text, mark) => text.toLowerCase().includes(mark.toLowerCase());
  const settle = () => page.waitForTimeout(500); // the preview redraws shortly after typing
  const sheet = async () => { await settle(); return page.locator('#resumeSheet').textContent(); };
  const orderIn = async (container, marks) => { await settle(); return page.evaluate(([sel, marks]) => { const t = document.querySelector(sel).textContent; return marks.map(m => t.indexOf(m)); }, [container, marks]); };
  const openSection = async name => { const sec = page.locator('#sec-' + name); if (!/\bopen\b/.test(await sec.getAttribute('class'))) await sec.locator('.accordion-header').first().click(); };
  const names = sel => page.locator(sel).evaluateAll(els => els.map(e => e.textContent.trim()));

  await page.goto(`${origin}/resume.html`);
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();

  // 1. Blank start: a clear empty preview and a blocking review finding that points at the field
  ok(await page.locator('#fullName').inputValue() === '', 'A blank resume starts empty');
  await tab('#tabReview');
  ok(await page.locator('#reviewChecklist .review-item--error').count() >= 1, 'A blank resume reports a blocking finding');
  const fix = page.locator('#reviewChecklist .review-item--error .review-jump-btn').first();
  const where = await page.locator('#reviewChecklist .review-item--error .review-item__where').first().textContent().catch(() => '');
  ok(await fix.count() === 1, 'A blocking finding offers a Fix action' + (where ? ' (' + where.trim() + ')' : ''));
  const targetId = await fix.getAttribute('data-target');
  await fix.click();
  await page.waitForFunction(() => document.getElementById('viewContent') && !document.getElementById('viewContent').hidden);
  await page.waitForTimeout(400);
  const focused = await page.evaluate(() => { const a = document.activeElement; return { inForm: !!a.closest('#formPanel'), id: a.id, header: !!a.closest('.accordion-header') }; });
  ok(focused.inForm && (focused.id === targetId || focused.header), `Fix returns to the field that needs attention (${targetId} -> ${focused.id || 'section header'})`);

  // 2. Contact, summary, and live preview
  await page.locator('#fullName').fill('Riya Flow');
  await page.locator('#targetTitle').fill('Operations Analyst');
  await page.locator('#email').fill('riya.flow@example.com');
  await page.locator('#phone').fill('+91 98765 43210');
  await openSection('summary');
  await page.locator('#summaryText').fill('Analyst who automates weekly reporting and reduces turnaround time.');
  ok((await sheet()).toLowerCase().includes('riya flow'), 'The preview follows the name as it is typed');

  // 3. Experience: add, edit, reorder, duplicate, delete
  await openSection('experience');
  await page.locator('#btnAddExperience').click();
  await page.locator('#btnAddExperience').click();
  const exp = n => page.locator('#experienceList .dynamic-item').nth(n);
  ok(await page.locator('#experienceList .dynamic-item').count() === 2, 'Add experience creates one entry per click');
  await exp(0).locator('.item-role').fill('ROLE_ONE');
  await exp(0).locator('.item-company').fill('COMPANY_ONE');
  await exp(0).locator('.item-duration').fill('Jan 2022 - Present');
  await exp(0).locator('.item-bullets').fill('Cut report time by 30% with BULLET_A\nBuilt a tracker for BULLET_B');
  await exp(1).locator('.item-role').fill('ROLE_TWO');
  await exp(1).locator('.item-company').fill('COMPANY_TWO');
  await exp(1).locator('.item-duration').fill('2019 - 2021');
  await exp(1).locator('.item-bullets').fill('Supported BULLET_C');
  ok((await exp(0).locator('.entry__title').textContent()).includes('ROLE_ONE'), 'An entry title follows its job title');
  let [a, b] = await orderIn('#resumeSheet', ['ROLE_ONE', 'ROLE_TWO']);
  ok(a >= 0 && b > a, 'The preview lists experience in entry order');
  ok(await exp(0).locator('[data-action="move-up-exp"]').isDisabled(), 'The first entry cannot move up');
  await exp(1).locator('[data-action="move-up-exp"]').click();
  [a, b] = await orderIn('#resumeSheet', ['ROLE_ONE', 'ROLE_TWO']);
  ok(b >= 0 && a > b, 'Move up swaps the two entries in the preview');
  ok((await exp(0).locator('.item-role').inputValue()) === 'ROLE_TWO', 'Moving an entry keeps its text with it');
  await exp(0).locator('[data-action="move-down-exp"]').click();
  [a, b] = await orderIn('#resumeSheet', ['ROLE_ONE', 'ROLE_TWO']);
  ok(a >= 0 && b > a, 'Move down restores the order');
  await exp(0).locator('[data-action="duplicate-exp"]').click();
  ok(await page.locator('#experienceList .dynamic-item').count() === 3, 'Duplicate adds a copy');
  ok((await exp(1).locator('.item-role').inputValue()) === 'ROLE_ONE', 'A duplicate copies the entry content');
  await exp(1).locator('[data-action="remove-exp"]').click(); await confirmIfAsked();
  ok(await page.locator('#experienceList .dynamic-item').count() === 2, 'Delete removes the entry');
  ok(!(await sheet()).includes('ROLE_ONEROLE_ONE'), 'The preview drops a deleted entry');

  // 4. Education, projects, skills
  await openSection('education'); await openSection('projects'); await openSection('skills');
  await page.locator('#btnAddEducation').click();
  await page.locator('#educationList .item-degree').first().fill('DEGREE_ONE');
  await page.locator('#educationList .item-institution').first().fill('COLLEGE_ONE');
  await page.locator('#educationList .item-duration').first().fill('2015 - 2019');
  await page.locator('#btnAddProject').click();
  await page.locator('#projectsList .item-name').first().fill('PROJECT_ONE');
  await page.locator('#skillLanguages').fill('SKILL_LANG_ONE, SKILL_LANG_TWO');
  await page.locator('#skillTools').fill('SKILL_TOOL_ONE');
  for (const mark of ['DEGREE_ONE', 'COLLEGE_ONE', 'PROJECT_ONE', 'SKILL_LANG_TWO', 'SKILL_TOOL_ONE']) ok((await sheet()).includes(mark), `The preview includes ${mark}`);

  // 5. Optional sections: add on demand, fill, remove
  await page.locator('#optionalSectionSelect').selectOption('certifications');
  await page.locator('#btnAddOptionalSection').click();
  ok(await page.locator('#sec-certifications').isVisible(), 'An optional section appears when it is added');
  await page.locator('#btnAddCertification').click();
  await page.locator('#certificationsList input').first().fill('CERT_ONE');
  ok((await sheet()).includes('CERT_ONE'), 'Optional section content reaches the preview');
  await page.locator('#certificationsList [data-action="remove-cert"]').first().click(); await confirmIfAsked();
  ok(!(await sheet()).includes('CERT_ONE'), 'Removing an optional entry removes it from the preview');

  // 6. Undo and redo
  await openSection('summary');
  await page.locator('#summaryText').fill('SUMMARY_CHANGED');
  await page.locator('#btnUndo').click();
  ok(!(await sheet()).includes('SUMMARY_CHANGED'), 'Undo reverts the last edit');
  await page.locator('#btnRedo').click();
  ok((await sheet()).includes('SUMMARY_CHANGED'), 'Redo applies it again');
  await page.locator('#summaryText').fill('Analyst who automates weekly reporting and reduces turnaround time.');

  // 7. Style: template, type, paper, density, section order
  await tab('#tabDesign');
  await page.locator('#templateGalleryGrid .btn-select-template[data-template="modern-minimal"]').click();
  ok((await page.locator('#prevTemplateBadge').textContent()).includes('Modern Minimal'), 'Choosing a template updates the preview');
  ok(await page.locator('#templateGalleryGrid .btn-select-template[data-template="modern-minimal"]').getAttribute('aria-pressed') === 'true', 'The chosen template shows as selected');
  await page.locator('#pageSizeSelect').selectOption('letter');
  await page.locator('#densitySelect').selectOption('compact').catch(() => {});
  const rows = () => names('#sectionOrderContainer .section-order-row__name');
  const before = await rows();
  ok(before.length >= 4, 'Section order lists the visible sections');
  await page.locator('#sectionOrderContainer [data-action="order-down"]').first().click();
  const after = await rows();
  ok(after[0] === before[1] && after[1] === before[0], 'Moving a section down swaps it with the next one');
  await page.locator('#btnApplyRecommendedOrder').click();
  ok(JSON.stringify(await rows()) === JSON.stringify(before), 'Recommended order restores the default order');

  // 8. Review: a complete resume passes, findings are grouped
  await tab('#tabReview');
  ok(await page.locator('#reviewChecklist .review-item--error').count() === 0, 'A complete resume has no blocking findings');
  ok((await page.locator('#reviewStatusText').textContent()).trim().length > 0, 'The review summary says whether the resume is ready');

  // 9. Exports contain the edited content
  await tab('#tabDownload');
  const txt = fs.readFileSync(await save('#btnDownloadText', 'resume.txt'), 'utf8');
  for (const mark of ['Riya Flow', 'ROLE_ONE', 'COMPANY_ONE', 'BULLET_A', 'ROLE_TWO', 'DEGREE_ONE', 'PROJECT_ONE', 'SKILL_LANG_TWO']) ok(has(txt, mark), `The text download includes ${mark}`);
  ok(txt.toLowerCase().indexOf('role_one') < txt.toLowerCase().indexOf('role_two'), 'The text download keeps entry order');
  const docx = await save('#btnDownloadDOCX', 'resume.docx');
  const xml = cp.execFileSync('unzip', ['-p', docx, 'word/document.xml'], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
  for (const mark of ['Riya Flow', 'ROLE_ONE', 'ROLE_TWO', 'COMPANY_TWO']) ok(has(xml, mark), `The Word download includes ${mark}`);
  const pdf = await save('#btnDownloadPDF', 'resume.pdf');
  const pdfText = cp.execFileSync('pdftotext', ['-layout', pdf, '-'], { encoding: 'utf8' });
  for (const mark of ['Riya Flow', 'ROLE_ONE', 'COMPANY_TWO', 'DEGREE_ONE']) ok(has(pdfText, mark), `The PDF download includes ${mark}`);

  // 10. Backup, start over, import
  const backup = await save('#btnExportJSON', 'backup.json');
  const data = JSON.parse(fs.readFileSync(backup, 'utf8'));
  ok(JSON.stringify(data).includes('ROLE_TWO'), 'The backup file holds the entries');
  await tab('#tabContent');
  await page.locator('#btnClearForm').click(); await dialog.waitFor({ state: 'visible' });
  await dialog.locator('[data-act="cancel"]').click();
  ok(await page.locator('#fullName').inputValue() === 'Riya Flow', 'Cancelling Start over keeps the resume');
  await page.locator('#btnClearForm').click(); await dialog.waitFor({ state: 'visible' }); await dialog.locator('[data-act="ok"]').click();
  await page.waitForFunction(() => document.getElementById('fullName').value === '');
  ok(await page.locator('#experienceList .dynamic-item').count() === 0 || (await page.locator('#experienceList .item-role').evaluateAll(els => els.every(e => e.value === ''))), 'Start over empties the entries');
  await tab('#tabDownload');
  await page.locator('#fileImportInput').setInputFiles(backup); await confirmIfAsked();
  await page.waitForFunction(() => document.getElementById('fullName').value === 'Riya Flow');
  ok((await sheet()).includes('ROLE_TWO') && (await sheet()).includes('DEGREE_ONE'), 'Importing the backup restores the resume');
  ok(await page.locator('#viewContent').isVisible(), 'Importing returns to the Write step');

  // 11. Phone: Edit and Preview switch, nothing overflows
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, acceptDownloads: true });
  await phone.route('**/*', route => /^(http:\/\/127\.|blob:|data:)/.test(route.request().url()) ? route.continue() : route.abort());
  const p = await phone.newPage();
  p.on('pageerror', e => errors.push(e.message));
  await p.goto(`${origin}/resume.html`);
  await p.locator('#btnLoadSample').click(); await p.waitForFunction(() => document.getElementById('fullName').value !== '');
  const overflow = () => p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  ok(await overflow() <= 1, 'The phone editor does not overflow');
  ok(await p.locator('#resumePreviewOuter').isHidden(), 'On a phone the editor shows first');
  await p.locator('#tabPreview').click();
  ok(await p.locator('#resumePreviewOuter').isVisible() && await p.locator('#formPanel').isHidden(), 'The Preview switch shows the resume and hides the editor');
  ok(await overflow() <= 1, 'The phone preview does not overflow');
  const box = await p.locator('#resumeVisualPages .resume-visual-page').first().boundingBox();
  ok(box && box.x >= -1 && box.x + box.width <= 391, 'The paper fits inside the phone screen');
  await p.locator('#tabEdit').click();
  ok(await p.locator('#formPanel').isVisible(), 'The Edit switch returns to the editor');
  for (const id of ['#tabDesign', '#tabReview', '#tabDownload', '#tabContent']) { await p.locator(id).click(); ok(await overflow() <= 1, `${id} does not overflow on a phone`); }
  await p.close();

  ok(errors.length === 0, 'No page errors: ' + errors.join('; '));
  await browser.close(); server.close();
  console.log(`✓ Resume flow: blank start, entries (add, edit, reorder, duplicate, delete), optional sections, undo, templates, section order, review, exports, backup, import, phone (${checks} checks)`);
})().catch(e => { console.error(e); try { server.close(); } catch (_) {} process.exit(1); });
