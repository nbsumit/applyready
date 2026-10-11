/* UI regression checks that exercise what a person actually sees and touches.
   The older browser suite drives the hidden native <select>; these tests do not. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium, firefox } = require('playwright');
const AxeBuilder = require('@axe-core/playwright').default;
const engine = process.env.BROWSER === 'firefox' ? firefox : chromium;
const root = path.resolve(__dirname, '..');
const mime = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.png':'image/png', '.svg':'image/svg+xml', '.woff2':'font/woff2', '.txt':'text/plain', '.xml':'application/xml', '.webmanifest':'application/manifest+json' };
let checks = 0;
const ok = (condition, message) => { assert(condition, message); checks++; };

const walk = (dir, base = '') => fs.readdirSync(path.join(root, dir)).filter(f => f.endsWith('.html')).map(f => path.posix.join(base, f));
const pages = [...walk('.'), ...walk('guides', 'guides'), ...walk('hi', 'hi')].filter(f => f !== 'offline.html');

const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (error, data) => {
    res.writeHead(error ? 404 : 200, { 'Content-Type': error ? 'text/html' : mime[path.extname(file)] || 'application/octet-stream' });
    res.end(error ? fs.readFileSync(path.join(root, '404.html')) : data);
  });
});

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const exe = process.env.BROWSER_EXECUTABLE_PATH;
  const browser = await engine.launch(engine === chromium ? { headless: true, ...(exe ? { executablePath: exe } : {}), args: ['--no-sandbox', '--disable-dev-shm-usage'] } : { headless: true });
  const open = async (width, height) => {
    const context = await browser.newContext({ viewport: { width, height }, colorScheme: 'light' });
    await context.route('**/*', route => { const u = route.request().url(); return /^(http:\/\/127\.|blob:|data:)/.test(u) ? route.continue() : route.abort(); });
    return { context, page: await context.newPage() };
  };

  // 1. Every page: no button or link-button whose label has the same colour as its fill,
  //    no visible browser-default file input, no browser-default grey button, text floor.
  {
    const { context, page } = await open(1280, 900);
    for (const file of pages) {
      await page.goto(`${origin}/${file}`);
      const found = await page.evaluate(() => {
        const sheet = '.resume-source-sheet, .resume-visual-pages, #tmplModalPreviewSheet, .template-thumb, .template-card-thumb, .ats-resume-sheet';
        const blank = [], nativeFile = [], grey = [], tiny = [];
        document.querySelectorAll('a.btn, button.btn, [class*="btn-"]').forEach(e => {
          const cs = getComputedStyle(e);
          if (cs.color === cs.backgroundColor && cs.backgroundColor !== 'rgba(0, 0, 0, 0)') blank.push(e.id || e.textContent.trim().slice(0, 30));
        });
        document.querySelectorAll('input[type=file]').forEach(e => {
          const r = e.getBoundingClientRect(); const cs = getComputedStyle(e);
          if (cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 4 && r.height > 4 && cs.opacity !== '0') nativeFile.push(e.id);
        });
        document.querySelectorAll('button').forEach(e => {
          const cs = getComputedStyle(e); const r = e.getBoundingClientRect();
          if (r.width > 0 && cs.display !== 'none' && (cs.borderTopStyle === 'outset' || cs.backgroundColor === 'rgb(239, 239, 239)')) grey.push(e.id || e.className || e.textContent.trim().slice(0, 20));
        });
        document.querySelectorAll('body *').forEach(e => {
          if (e.closest(sheet) || e.closest('svg')) return;
          const own = [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
          if (!own) return;
          const cs = getComputedStyle(e); const r = e.getBoundingClientRect();
          if (cs.display === 'none' || cs.visibility === 'hidden' || r.width === 0) return;
          if (parseFloat(cs.fontSize) < 11.9) tiny.push((e.className || e.tagName) + ':' + cs.fontSize);
        });
        return { blank, nativeFile, grey, tiny: [...new Set(tiny)] };
      });
      ok(found.blank.length === 0, `${file}: buttons with an invisible label: ${found.blank}`);
      ok(found.nativeFile.length === 0, `${file}: a native file input is visible: ${found.nativeFile}`);
      ok(found.grey.length === 0, `${file}: browser-default buttons: ${found.grey}`);
      ok(found.tiny.length === 0, `${file}: text under 12px: ${found.tiny}`);
    }
    await context.close();
  }
  console.log(`✓ ${pages.length} pages: readable buttons, no native file input, no default buttons, 12px text floor`);

  // 1b. One scale for icons and controls on every page, on a desktop and a phone-sized viewport.
  //     Icons use five sizes. Fields and buttons use the control heights from css/app.css.
  {
    const ICONS = [12, 14, 16, 20, 24];
    for (const [width, height, fieldMax, fieldMin, btnSizes] of [[1280, 900, 37, 35, [32, 36, 44]], [390, 780, 45, 43, [40, 44, 48]]]) {
      const { context, page } = await open(width, height);
      for (const file of pages) {
        await page.goto(`${origin}/${file}`);
        if (file === 'resume.html') await page.evaluate(() => { document.querySelectorAll('.accordion-section').forEach(s => s.classList.add('open')); });
        const found = await page.evaluate(() => {
          const sheet = '.resume-source-sheet, .resume-visual-pages, #tmplModalPreviewSheet, .template-thumb, .template-card-thumb, .ats-resume-sheet, .cropper-container';
          const shown = e => { const cs = getComputedStyle(e), r = e.getBoundingClientRect(); return !e.closest(sheet) && cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 1 && r.height > 1; };
          const icons = [], fields = [], buttons = [];
          document.querySelectorAll('i[class*="fa-"]').forEach(e => { if (shown(e)) icons.push(Math.round(parseFloat(getComputedStyle(e).fontSize))); });
          document.querySelectorAll('input.form-control, select.form-select, select.form-control, .custom-select__button').forEach(e => {
            if (!shown(e) || ['range', 'file', 'checkbox', 'radio'].includes(e.type)) return;
            fields.push(Math.round(e.getBoundingClientRect().height));
          });
          document.querySelectorAll('.btn').forEach(e => {
            if (!shown(e) || e.closest('.comparison-view-toggle')) return;
            const h = Math.round(e.getBoundingClientRect().height);
            if (h <= 46) buttons.push(h);
          });
          return { icons: [...new Set(icons)], fields: [...new Set(fields)], buttons: [...new Set(buttons)] };
        });
        const stray = found.icons.filter(s => !ICONS.includes(s));
        ok(stray.length === 0, `${file} @${width}: icon sizes outside the scale ${ICONS}: ${stray}`);
        const badFields = found.fields.filter(h => h < fieldMin || h > fieldMax);
        ok(badFields.length === 0, `${file} @${width}: field heights outside ${fieldMin}-${fieldMax}px: ${badFields}`);
        const badButtons = found.buttons.filter(h => !btnSizes.some(s => Math.abs(h - s) <= 1));
        ok(badButtons.length === 0, `${file} @${width}: button heights outside ${btnSizes}: ${badButtons}`);
      }
      await context.close();
    }
  }
  console.log(`✓ ${pages.length} pages: icons use the 5-size scale; fields and buttons use the control heights (desktop and phone)`);

  // 2. Custom select with a mouse and with the keyboard, at phone and desktop sizes.
  for (const [width, height] of [[390, 780], [1280, 900]]) {
    const { context, page } = await open(width, height);
    await page.goto(`${origin}/index.html`);
    const trigger = page.locator('.custom-select__button').first();
    await trigger.scrollIntoViewIfNeeded();
    await trigger.click();
    const list = page.locator('.custom-select__list:not([hidden])');
    ok(await list.isVisible(), `${width}: opening the preset menu shows its options`);
    const box = await list.boundingBox();
    ok(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= width && box.y + box.height <= height, `${width}: menu stays inside the viewport`);
    ok(await list.locator('[role=option]').count() >= 7, `${width}: all presets are listed`);
    ok(await list.locator('[role=option][aria-selected=true]').count() === 1, `${width}: exactly one option is marked selected`);
    await list.locator('[role=option]', { hasText: 'ID / Passport' }).click();
    ok(await page.locator('#presetSelect').inputValue() === 'passport', `${width}: clicking an option changes the preset`);
    ok(await page.locator('.custom-select__list:not([hidden])').count() === 0, `${width}: menu closes after choosing`);
    ok(await trigger.evaluate(el => el === document.activeElement), `${width}: focus returns to the trigger`);
    ok((await trigger.textContent()).includes('Passport'), `${width}: trigger shows the chosen value`);
    ok(await page.locator('#customWidth').inputValue() === '350', `${width}: preset dimensions are applied`);
    // keyboard: open, move, choose, then escape
    await trigger.focus();
    await page.keyboard.press('ArrowDown');
    ok(await page.locator('.custom-select__list:not([hidden])').isVisible(), `${width}: ArrowDown opens the menu`);
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    ok(await page.locator('#presetSelect').inputValue() === 'signature', `${width}: arrow keys and Enter choose an option`);
    await page.keyboard.press('Space');
    ok(await page.locator('.custom-select__list:not([hidden])').isVisible(), `${width}: Space opens the menu`);
    await page.keyboard.press('Escape');
    ok(await page.locator('.custom-select__list:not([hidden])').count() === 0, `${width}: Escape closes the menu`);
    ok(await trigger.evaluate(el => el === document.activeElement), `${width}: Escape keeps focus on the trigger`);
    await page.keyboard.press('End'); await page.keyboard.press('Enter');
    ok(await page.locator('#presetSelect').inputValue() === 'document', `${width}: End jumps to the last option`);
    // Tab leaves the control without trapping focus
    await trigger.focus(); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Tab');
    ok(await page.locator('.custom-select__list:not([hidden])').count() === 0, `${width}: Tab closes the menu`);
    ok(await page.evaluate(() => document.activeElement !== document.body), `${width}: Tab keeps focus in the page`);
    await context.close();
  }
  // Resume font and paper menus use the same control
  {
    const { context, page } = await open(390, 780);
    await page.goto(`${origin}/resume.html`);
    await page.locator('#tabDesign').click();
    const font = page.locator('#fontSelect').locator('xpath=..').locator('.custom-select__button');
    await font.scrollIntoViewIfNeeded(); await font.click();
    ok(await page.locator('.custom-select__list:not([hidden])').isVisible(), 'Resume font menu opens on a phone');
    await page.locator('.custom-select__list:not([hidden]) [role=option]').nth(1).click();
    ok(await page.locator('#fontSelect').evaluate(el => el.selectedIndex) === 1, 'Resume font menu changes the font');
    await context.close();
  }
  console.log('✓ Custom select: mouse, touch-size viewport, arrows, Enter, Space, Escape, End, Tab, focus return');

  // 3. Text fields show where keyboard focus is.
  {
    const { context, page } = await open(1280, 900);
    const cases = [['index.html', '#customWidth'], ['resume.html', '#fullName'], ['resume.html', '#summaryText'], ['compress-pdf.html', '#targetKbInput'], ['contact.html', 'input[type=text], input[type=email], textarea']];
    for (const [file, selector] of cases) {
      await page.goto(`${origin}/${file}`);
      if (selector === '#summaryText') await page.locator('#sec-summary .accordion-header').click();
      const field = page.locator(selector).first();
      await field.focus();
      const ring = await field.evaluate(el => { const cs = getComputedStyle(el); return { shadow: cs.boxShadow, outline: cs.outlineStyle, outlineWidth: parseFloat(cs.outlineWidth), border: cs.borderTopColor }; });
      ok(ring.shadow !== 'none' || (ring.outline !== 'none' && ring.outlineWidth > 0), `${file} ${selector}: focus is visible`);
    }
    // Keyboard walk: nothing that takes focus is invisible
    for (const file of ['index.html', 'resume.html', 'compress-pdf.html', 'signature-cleaner.html']) {
      await page.goto(`${origin}/${file}`);
      for (let i = 0; i < 60; i++) {
        await page.keyboard.press('Tab');
        const state = await page.evaluate(() => {
          const el = document.activeElement; if (!el || el === document.body) return null;
          const cs = getComputedStyle(el); const r = el.getBoundingClientRect();
          const hostRing = el.closest('.custom-select, .range-wrap, .checkbox-label');
          const visible = (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || (cs.boxShadow && cs.boxShadow !== 'none') || !!hostRing;
          return { id: el.id || el.className || el.tagName, visible, tiny: r.width < 2 || r.height < 2 };
        });
        if (state && !state.tiny) ok(state.visible, `${file}: focus indicator missing on ${state.id}`);
      }
    }
    await context.close();
  }
  console.log('✓ Focus indicators on text fields and across a keyboard walk');

  // 4. Layout: no horizontal overflow on any page at the required widths.
  {
    const widths = [320, 360, 375, 390, 430, 768, 1024, 1280, 1440];
    for (const width of widths) {
      const { context, page } = await open(width, 800);
      for (const file of pages) {
        await page.goto(`${origin}/${file}`);
        const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
        ok(over <= 1, `${file} overflows by ${over}px at ${width}`);
      }
      await context.close();
    }
  }
  console.log(`✓ No horizontal overflow on ${pages.length} pages at 9 widths`);

  // 5. Accessibility rules on every page in both themes, and on result states.
  {
    const rules = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'];
    for (const scheme of ['light', 'dark']) {
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: scheme });
      await context.route('**/*', route => /^(http:\/\/127\.|blob:|data:)/.test(route.request().url()) ? route.continue() : route.abort());
      const page = await context.newPage();
      const setTheme = async () => { if (await page.evaluate(() => document.documentElement.dataset.theme) !== scheme) await page.locator('#themeToggle').click(); await page.waitForTimeout(200); };
      const scan = async label => {
        const result = await new AxeBuilder({ page }).withTags(rules).analyze();
        ok(result.violations.length === 0, `${scheme} ${label}: ${result.violations.map(v => v.id + ' ' + v.nodes[0].target.join(' ')).join('; ')}`);
      };
      for (const file of pages) { await page.goto(`${origin}/${file}`); await setTheme(); await scan(file); }
      const image = async () => Buffer.from(await page.evaluate(() => {
        const c = document.createElement('canvas'); c.width = 900; c.height = 1100; const x = c.getContext('2d');
        const g = x.createLinearGradient(0, 0, 900, 1100); g.addColorStop(0, '#456'); g.addColorStop(1, '#dba');
        x.fillStyle = g; x.fillRect(0, 0, 900, 1100); x.fillStyle = '#fff'; x.beginPath(); x.arc(450, 450, 250, 0, 7); x.fill();
        return c.toDataURL('image/png').split(',')[1];
      }), 'base64');
      for (const [file, input, action, result] of [['index.html', '#fileInput', '#btnProcess', '#resultArea'], ['ssc-photo-signature-size.html', '#fileInput', '#btnProcess', '#resultArea'], ['hi/ssc-photo-signature-size.html', '#fileInput', '#btnProcess', '#resultArea']]) {
        await page.goto(`${origin}/${file}`); await setTheme();
        await page.locator(input).setInputFiles({ name: 'p.png', mimeType: 'image/png', buffer: await image() });
        await page.locator(action).click();
        await page.locator(result).waitFor({ state: 'visible' });
        // Smooth scrolling to the result can still be running; scan the settled page.
        await page.evaluate(() => new Promise(done => { let last = -1, still = 0; const t = setInterval(() => { still = scrollY === last ? still + 1 : 0; last = scrollY; if (still >= 4) { clearInterval(t); done(); } }, 60); }));
        await scan(`${file} result`);
      }
      await context.close();
    }
  }
  console.log('✓ axe: no violations on every page in light and dark');

  // 6. Embedded tool on exam, KB and Hindi pages: order, language and result facts.
  {
    const { context, page } = await open(1280, 900);
    const canvasPng = async () => Buffer.from(await page.evaluate(() => {
      const c = document.createElement('canvas'); c.width = 900; c.height = 1100; const x = c.getContext('2d');
      x.fillStyle = '#789'; x.fillRect(0, 0, 900, 1100); x.fillStyle = '#fed'; x.beginPath(); x.arc(450, 450, 250, 0, 7); x.fill();
      return c.toDataURL('image/png').split(',')[1];
    }), 'base64');
    const embedded = pages.filter(f => /photo-signature-size\.html$|resize-image-to-\d+kb\.html$/.test(f));
    ok(embedded.length === 15, `found the 15 embedded tool pages (${embedded.length})`);
    // Errors must be visible on every embedded tool, not only on the home page.
    for (const file of embedded) {
      await page.goto(`${origin}/${file}`);
      await page.locator('#customWidth').fill('5');
      await page.locator('#customWidth').blur();
      await page.locator('#dimError').waitFor({ state: 'visible', timeout: 4000 });
      ok((await page.locator('#dimError').innerText()).trim().length > 5, `${file}: a too small width explains itself`);
      await page.goto(`${origin}/${file}`);
      await page.locator('#fileInput').setInputFiles({ name: 'broken.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('this is not an image') });
      await page.locator('#processErrorBox').waitFor({ state: 'visible', timeout: 4000 });
      ok((await page.locator('#processErrorMessage').innerText()).trim().length > 10, `${file}: a broken image explains what happened`);
    }
    for (const file of embedded) {
      await page.goto(`${origin}/${file}`);
      const hindi = file.startsWith('hi/');
      const label = (await page.locator('#btnProcess').innerText()).trim();
      await page.locator('#fileInput').setInputFiles({ name: 'p.png', mimeType: 'image/png', buffer: await canvasPng() });
      await page.locator('#cropperActiveArea').waitFor({ state: 'visible' });
      ok(await page.locator('.file-upload-wrapper').isHidden(), `${file}: the dropzone folds away once a file is chosen`);
      const before = await page.evaluate(() => { const i = document.getElementById('cropperActiveArea').getBoundingClientRect().top, b = document.getElementById('btnProcess').getBoundingClientRect().top; return i < b; });
      ok(before, `${file}: the image appears above the Resize button`);
      ok((await page.locator('#btnProcess').innerText()).trim() === label || !hindi, `${file}: button label is not replaced by another language`);
      await page.locator('#btnProcess').click();
      await page.locator('#resultArea').waitFor({ state: 'visible' });
      await page.waitForFunction(() => document.getElementById('resultFileSize') && document.getElementById('resultFileSize').textContent.trim().length > 2);
      ok((await page.locator('#resultDims').innerText()).trim().length > 3, `${file}: result shows dimensions`);
      ok((await page.locator('#resultFileSize').innerText()).includes('KB'), `${file}: result shows file size`);
      const top = await page.evaluate(() => ['resultArea', 'btnProcess'].map(id => document.getElementById(id).getBoundingClientRect().top));
      ok(top[0] < top[1], `${file}: the result sits above the settings and Resize button`);
      if (hindi) ok(/[\u0900-\u097F]/.test(await page.locator('#btnProcess').innerText()), `${file}: Resize button stays in Hindi after processing`);
    }
    await context.close();
  }
  console.log('✓ Exam, KB and Hindi tools: order, folded dropzone, Hindi label, result facts');
  // 7. Secondary tools explain a bad file in the page, never with a blocking browser dialog,
  //    and never leave the person wondering whether anything happened.
  {
    const { context, page } = await open(390, 800);
    let dialogs = 0; page.on('dialog', d => { dialogs++; d.dismiss(); });
    const cases = [['compress-pdf.html', '#compressFileInput', async () => { await page.locator('#btnStartCompress').click(); }], ['image-to-pdf.html', 'input[type=file]', null], ['passport-photo-print.html', 'input[type=file]', null], ['signature-cleaner.html', 'input[type=file]', null]];
    for (const [file, input, after] of cases) {
      for (const [name, type] of [['notes.txt', 'text/plain'], ['broken.jpg', 'image/jpeg']]) {
        await page.goto(`${origin}/${file}`);
        await page.locator(input).first().setInputFiles({ name, mimeType: type, buffer: Buffer.from('this is not an image') });
        if (after && type === 'image/jpeg') await after();
        await page.locator('#taskNotification.is-visible').waitFor({ state: 'visible', timeout: 6000 });
        const text = (await page.locator('#taskNotification').innerText()).trim();
        ok(/choose|try|check/i.test(text) && text.length > 25, `${file} ${name}: the message says what to do (${text})`);
      }
    }
    ok(dialogs === 0, `no blocking browser dialog was shown (${dialogs})`);
    await context.close();
  }
  console.log('✓ Secondary tools: errors are shown in the page and say what to do');

  // 8. The interface says what will happen and whether it worked.
  {
    const noisePng = async (page, w, h) => Buffer.from(await page.evaluate(([w, h]) => {
      const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
      const d = x.createImageData(w, h); for (let i = 0; i < d.data.length; i += 4) { d.data[i] = Math.random() * 255; d.data[i + 1] = Math.random() * 255; d.data[i + 2] = Math.random() * 255; d.data[i + 3] = 255; }
      x.putImageData(d, 0, 0); return c.toDataURL('image/png').split(',')[1];
    }, [w, h]), 'base64');

    // Output summary under the main action, and errors next to the field at fault
    const { context, page } = await open(390, 844);
    await page.goto(`${origin}/index.html`);
    await page.locator('#fileInput').setInputFiles({ name: 'p.png', mimeType: 'image/png', buffer: await noisePng(page, 600, 800) });
    await page.locator('#cropperActiveArea:not(.hidden)').waitFor();
    const summary = async () => (await page.locator('#processSummary').innerText()).replace(/\s+/g, ' ').trim();
    ok(/350 × 350 px/.test(await summary()) && /under 50 KB/.test(await summary()), `summary names the output before processing (${await summary()})`);
    await page.locator('.preset-shortcut[data-preset="passport"]').click();
    ok(/350 × 450 px/.test(await summary()), `summary follows the preset (${await summary()})`);
    await page.locator('#customWidth').fill('5');
    await page.locator('#customWidth').dispatchEvent('input');
    ok(await page.locator('#btnProcess').isDisabled(), 'an invalid width disables the action');
    ok(/Fix the setting/.test(await summary()), 'summary says why the action is disabled');
    const gap = await page.evaluate(() => document.getElementById('dimError').getBoundingClientRect().top - document.getElementById('customWidth').getBoundingClientRect().bottom);
    ok(gap >= 0 && gap < 40, `the width error sits right under the field (${Math.round(gap)} px)`);
    ok(await page.locator('#customWidth').evaluate(e => getComputedStyle(e).borderTopColor !== getComputedStyle(document.getElementById('customMaxKB')).borderTopColor), 'the invalid field is marked');
    await page.locator('#processSummary button').click();
    ok(await page.evaluate(() => document.activeElement && document.activeElement.id === 'customWidth'), '"Show me" moves focus to the field');

    // Phone: passport sheet and signature cleaner bring the result into view after upload
    for (const [file, input, area] of [['passport-photo-print.html', '#printFileInput', '#printPreviewArea'], ['signature-cleaner.html', '#cleanerFileInput', '#cleanerPreviewArea']]) {
      await page.goto(`${origin}/${file}`);
      await page.locator(input).setInputFiles({ name: 'p.png', mimeType: 'image/png', buffer: await noisePng(page, 500, 400) });
      await page.locator(`${area}:not(.hidden)`).waitFor();
      await page.waitForTimeout(900);
      const top = await page.evaluate(sel => document.querySelector(sel).getBoundingClientRect().top, area);
      ok(top >= 0 && top < 844 * 0.6, `${file}: the preview is on screen after upload on a phone (${Math.round(top)} px)`);
    }

    // Compress PDF: a target that cannot be met is said plainly
    for (const [target, expectWarning] of [['5', true], ['5000', false]]) {
      await page.goto(`${origin}/compress-pdf.html`);
      await page.locator('#compressFileInput').setInputFiles({ name: 'scan.png', mimeType: 'image/png', buffer: await noisePng(page, 900, 1200) });
      await page.locator('#targetKbInput').fill(target);
      await page.locator('#btnStartCompress').click();
      await page.locator('#compressResultArea:not(.hidden)').waitFor({ timeout: 30000 });
      const status = await page.locator('#compressStatus').innerText();
      const warned = await page.locator('#compressStatus').evaluate(e => e.classList.contains('is-warning'));
      ok(warned === expectWarning && (expectWarning ? /could not get under 5 KB/.test(status) : /Under 5000 KB/.test(status)), `compress ${target} KB: status says ${status}`);
    }

    // Exam page: the preset switch shows which preset is in use
    await page.goto(`${origin}/ssc-photo-signature-size.html`);
    ok(await page.locator('#btnPresetSSCPhoto').getAttribute('aria-pressed') === 'true', 'SSC photo preset is marked as selected on load');
    await page.locator('#btnPresetSSCSig').click();
    ok(await page.locator('#btnPresetSSCSig').getAttribute('aria-pressed') === 'true' && await page.locator('#btnPresetSSCPhoto').getAttribute('aria-pressed') === 'false', 'choosing the signature preset moves the selection');

    // Resume: example text never looks like a value
    await page.goto(`${origin}/resume.html`);
    const placeholders = await page.evaluate(() => ['fullName', 'targetTitle', 'email', 'phone', 'location', 'linkedin', 'github', 'website'].map(id => document.getElementById(id).placeholder));
    ok(placeholders.every(p => /^e\.g\. /.test(p)), `resume contact placeholders start with "e.g." (${placeholders.join(' | ')})`);
    await context.close();

    // Field edges are visible: at least 3:1 against the panel, in both themes
    for (const scheme of ['light', 'dark']) {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: scheme });
      await ctx.route('**/*', route => /^(http:\/\/127\.|blob:|data:)/.test(route.request().url()) ? route.continue() : route.abort());
      const p = await ctx.newPage();
      await p.goto(`${origin}/index.html`);
      await p.evaluate(s => document.documentElement.setAttribute('data-theme', s), scheme);
      const ratio = await p.evaluate(() => {
        const lum = c => { const [r, g, b] = c.match(/\d+/g).slice(0, 3).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
        const field = getComputedStyle(document.getElementById('customMaxKB')).borderTopColor;
        const panel = getComputedStyle(document.querySelector('.image-controls')).backgroundColor;
        const [a, b] = [lum(field), lum(panel)].sort((x, y) => y - x);
        return (a + 0.05) / (b + 0.05);
      });
      ok(ratio >= 3, `${scheme}: field edge contrast is ${ratio.toFixed(2)}:1`);
      // Tools menu: Escape closes it and gives focus back to its button
      await p.locator('.tools-menu > button').click();
      await p.keyboard.press('Tab');
      await p.keyboard.press('Escape');
      ok(await p.evaluate(() => !document.querySelector('.tools-menu').classList.contains('is-open') && document.activeElement === document.querySelector('.tools-menu > button')), `${scheme}: Escape closes the Tools menu and returns focus`);
      await ctx.close();
    }
  }
  console.log('✓ Output summary, inline errors, compress target status, phone reveal, preset state, placeholders, field contrast, menu focus');


  await browser.close();
  server.close();
  console.log(`\n${checks} UI assertions passed.`);
})().catch(error => { console.error(error); process.exit(1); });
