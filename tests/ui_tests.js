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
        await page.waitForTimeout(250);
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

  await browser.close();
  server.close();
  console.log(`\n${checks} UI assertions passed.`);
})().catch(error => { console.error(error); process.exit(1); });
