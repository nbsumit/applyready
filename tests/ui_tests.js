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
const mime = { '.html':'text/html', '.js':'text/javascript', '.mjs':'text/javascript', '.wasm':'application/wasm', '.css':'text/css', '.png':'image/png', '.svg':'image/svg+xml', '.woff2':'font/woff2', '.txt':'text/plain', '.xml':'application/xml', '.webmanifest':'application/manifest+json' };
let checks = 0;
const ok = (condition, message) => { assert(condition, message); checks++; };

const walk = (dir, base = '') => fs.existsSync(path.join(root, dir)) ? fs.readdirSync(path.join(root, dir)).filter(f => f.endsWith('.html')).map(f => path.posix.join(base, f)) : [];
const pages = [...walk('.'), ...walk('guides', 'guides')].filter(f => f !== 'offline.html' && !/<meta http-equiv="refresh"/i.test(fs.readFileSync(path.join(root, f), 'utf8')));

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
  const open = async (width, height, touch = false) => {
    const context = await browser.newContext({ viewport: { width, height }, colorScheme: 'light', ...(touch ? { hasTouch: true, isMobile: engine === chromium } : {}) });
    await context.route('**/*', route => { const u = route.request().url(); return /^(http:\/\/127\.|blob:|data:)/.test(u) ? route.continue() : route.abort(); });
    const page = await context.newPage();
    page.on('console', msg => { if (/Content Security Policy/.test(msg.text())) throw new Error(msg.text()); });
    return { context, page };
  };
  // The resizer asks for the requirement first; its list folds into a summary once one is chosen.
  const choose = async (page, key) => {
    const change = page.locator('#btnChangeReq');
    if (await change.isVisible() && await change.getAttribute('aria-expanded') !== 'true') await change.click();
    await page.locator(`.choice[data-preset="${key}"]`).click();
  };
  // Detailed settings: the disclosure once it is shown, otherwise choosing "Custom size" opens them.
  const openSettings = async page => {
    const toggle = page.locator('.ws-customize');
    if (await toggle.isVisible()) { if (await toggle.getAttribute('aria-expanded') !== 'true') await toggle.click(); return; }
    await choose(page, 'custom');
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
  //     Icons use four sizes. Fields and buttons use the control heights from css/app.css
  //     (40 on a pointer, 44 on touch; buttons 32/40/48 or 40/44/48).
  {
    const ICONS = [12, 16, 20, 28];
    for (const [width, height, fieldMax, fieldMin, btnSizes, touch] of [[1280, 900, 41, 39, [32, 40, 48], false], [390, 780, 45, 43, [40, 44, 48], true]]) {
      const { context, page } = await open(width, height, touch);
      for (const file of pages) {
        await page.goto(`${origin}/${file}`);
        if (file === 'resume.html') await page.evaluate(() => { document.querySelectorAll('.accordion-section').forEach(s => s.classList.add('open')); });
        if (file !== 'resume.html') await page.evaluate(() => document.querySelectorAll('.ws').forEach(ws => { ws.dataset.settings = 'open'; }));
        const found = await page.evaluate(() => {
          const sheet = '.resume-source-sheet, .resume-visual-pages, #tmplModalPreviewSheet, .template-thumb, .template-card-thumb, .ats-resume-sheet, .cropper-container';
          const shown = e => { const cs = getComputedStyle(e), r = e.getBoundingClientRect(); return !e.closest(sheet) && cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 1 && r.height > 1; };
          const icons = [], fields = [], buttons = [];
          document.querySelectorAll('i[class*="fa-"]').forEach(e => { if (shown(e)) icons.push(Math.round(parseFloat(getComputedStyle(e).fontSize))); });
          document.querySelectorAll('input.input, .select-btn').forEach(e => {
            if (!shown(e) || ['range', 'file', 'checkbox', 'radio'].includes(e.type)) return;
            fields.push(Math.round(e.getBoundingClientRect().height));
          });
          document.querySelectorAll('.btn').forEach(e => {
            if (!shown(e) || e.closest('.segmented, .tabs')) return;
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
  console.log(`✓ ${pages.length} pages: icons use the 4-size scale; fields and buttons use the control heights (desktop and phone)`);

  // 2. Custom select with a mouse and with the keyboard, at phone and desktop sizes.
  //    The crop-shape menu is the longest select in the image settings.
  for (const [width, height] of [[390, 780], [1280, 900]]) {
    const { context, page } = await open(width, height);
    await page.goto(`${origin}/image-resizer.html`);
    await openSettings(page);
    const trigger = page.locator('#aspectRatioSelect').locator('xpath=..').locator('.select-btn');
    await trigger.scrollIntoViewIfNeeded();
    await trigger.click();
    const list = page.locator('.select-list:not([hidden])');
    ok(await list.isVisible(), `${width}: opening the crop menu shows its options`);
    const box = await list.boundingBox();
    ok(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= width && box.y + box.height <= height, `${width}: menu stays inside the viewport`);
    ok(await list.locator('[role=option]').count() === 6, `${width}: all crop shapes are listed`);
    ok(await list.locator('[role=option][aria-selected=true]').count() === 1, `${width}: exactly one option is marked selected`);
    await list.locator('[role=option]', { hasText: 'Square (1:1)' }).click();
    ok(await page.locator('#aspectRatioSelect').inputValue() === '1:1', `${width}: clicking an option changes the value`);
    ok(await page.locator('.select-list:not([hidden])').count() === 0, `${width}: menu closes after choosing`);
    ok(await trigger.evaluate(el => el === document.activeElement), `${width}: focus returns to the trigger`);
    ok((await trigger.textContent()).includes('Square'), `${width}: trigger shows the chosen value`);
    // keyboard: open, move, choose, then escape
    await trigger.focus();
    await page.keyboard.press('ArrowDown');
    ok(await page.locator('.select-list:not([hidden])').isVisible(), `${width}: ArrowDown opens the menu`);
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    ok(await page.locator('#aspectRatioSelect').inputValue() === '4:3', `${width}: arrow keys and Enter choose an option`);
    await page.keyboard.press('Space');
    ok(await page.locator('.select-list:not([hidden])').isVisible(), `${width}: Space opens the menu`);
    await page.keyboard.press('Escape');
    ok(await page.locator('.select-list:not([hidden])').count() === 0, `${width}: Escape closes the menu`);
    ok(await trigger.evaluate(el => el === document.activeElement), `${width}: Escape keeps focus on the trigger`);
    await page.keyboard.press('End'); await page.keyboard.press('Enter');
    ok(await page.locator('#aspectRatioSelect').inputValue() === 'free', `${width}: End jumps to the last option`);
    // Tab leaves the control without trapping focus
    await trigger.focus(); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Tab');
    ok(await page.locator('.select-list:not([hidden])').count() === 0, `${width}: Tab closes the menu`);
    ok(await page.evaluate(() => document.activeElement !== document.body), `${width}: Tab keeps focus in the page`);
    // The requirement list is a set of toggle buttons; choosing one applies its values and is announced.
    const passport = page.locator('.choice[data-preset="passport"]');
    await choose(page, 'passport');
    ok(await page.locator('#presetSelect').inputValue() === 'passport' && await passport.getAttribute('aria-pressed') === 'true', `${width}: choosing a requirement selects it`);
    ok(await page.locator('#customWidth').inputValue() === '350' && await page.locator('#customHeight').inputValue() === '450', `${width}: requirement dimensions are applied`);
    ok(await page.locator('.choice[aria-pressed="true"]').count() === 1, `${width}: exactly one requirement is pressed`);
    await context.close();
  }
  // Resume font and paper menus use the same control
  {
    const { context, page } = await open(390, 780);
    await page.goto(`${origin}/resume.html`);
    await page.locator('#tabDesign').click();
    const font = page.locator('#fontSelect').locator('xpath=..').locator('.select-btn');
    await font.scrollIntoViewIfNeeded(); await font.click();
    ok(await page.locator('.select-list:not([hidden])').isVisible(), 'Resume font menu opens on a phone');
    await page.locator('.select-list:not([hidden]) [role=option]').nth(1).click();
    ok(await page.locator('#fontSelect').evaluate(el => el.selectedIndex) === 1, 'Resume font menu changes the font');
    await context.close();
  }
  console.log('✓ Custom select: mouse, touch-size viewport, arrows, Enter, Space, Escape, End, Tab, focus return');

  // 3. Text fields show where keyboard focus is.
  {
    const { context, page } = await open(1280, 900);
    const cases = [['image-resizer.html', '#customWidth'], ['resume.html', '#fullName'], ['resume.html', '#summaryText'], ['compress-pdf.html', '#targetKbInput'], ['contact.html', 'input[type=text], input[type=email], textarea']];
    for (const [file, selector] of cases) {
      await page.goto(`${origin}/${file}`);
      if (selector === '#summaryText') await page.locator('#sec-summary .accordion-header').click();
      if (selector === '#customWidth') await openSettings(page);
      const field = page.locator(selector).first();
      await field.focus();
      const ring = await field.evaluate(el => { const cs = getComputedStyle(el); return { shadow: cs.boxShadow, outline: cs.outlineStyle, outlineWidth: parseFloat(cs.outlineWidth), border: cs.borderTopColor }; });
      ok(ring.shadow !== 'none' || (ring.outline !== 'none' && ring.outlineWidth > 0), `${file} ${selector}: focus is visible`);
    }
    // Keyboard walk: nothing that takes focus is invisible
    for (const file of ['image-resizer.html', 'resume.html', 'compress-pdf.html', 'signature-cleaner.html']) {
      await page.goto(`${origin}/${file}`);
      for (let i = 0; i < 60; i++) {
        await page.keyboard.press('Tab');
        const state = await page.evaluate(() => {
          const el = document.activeElement; if (!el || el === document.body) return null;
          const cs = getComputedStyle(el); const r = el.getBoundingClientRect();
          const hostRing = el.closest('.select') || (el.type === 'range' ? el : null);
          const visible = (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || (cs.boxShadow && cs.boxShadow !== 'none') || !!hostRing;
          return { id: el.id || el.className || el.tagName, visible, tiny: r.width < 2 || r.height < 2 };
        });
        if (state && !state.tiny) ok(state.visible, `${file}: focus indicator missing on ${state.id}`);
      }
    }
    await context.close();
  }
  console.log('✓ Focus indicators on text fields and across a keyboard walk');

  // 4. Layout: no horizontal overflow on any page at the required widths, both sides of every breakpoint.
  const overflowWidths = [320, 360, 375, 390, 430, 480, 560, 600, 639, 640, 641, 700, 768, 820, 840, 859, 860, 861, 880, 900, 999, 1000, 1001, 1024, 1099, 1100, 1101, 1200, 1280, 1366, 1440, 1600];
  {
    const { context, page } = await open(1280, 800);
    for (const file of pages) {
      await page.goto(`${origin}/${file}`);
      for (const width of overflowWidths) {
        await page.setViewportSize({ width, height: 800 });
        const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
        ok(over <= 1, `${file} overflows by ${over}px at ${width}`);
      }
    }
    await context.close();
  }
  console.log(`✓ No horizontal overflow on ${pages.length} pages at ${overflowWidths.length} widths`);

  // 4b. Layout modes. Each breakpoint is a deliberate change of layout, checked on both sides of it:
  //     desktop (1000px and wider), tablet (640 to 999px), phone (under 640px).
  {
    const mode = w => (w >= 1000 ? 'desktop' : w >= 640 ? 'tablet' : 'phone');
    const tiny = await (async () => { const { context, page } = await open(400, 400); const b = Buffer.from(await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 600; c.height = 800; const x = c.getContext('2d'); x.fillStyle = '#9ab'; x.fillRect(0, 0, 600, 800); return c.toDataURL('image/png').split(',')[1]; }), 'base64'); await context.close(); return b; })();
    // The requirement grid: fixed column count per mode, every label whole, task order kept.
    const grid = page => page.evaluate(() => {
      const g = document.getElementById('reqGrid');
      const cards = [...g.querySelectorAll('.choice')];
      const rects = cards.map(c => c.getBoundingClientRect());
      const cls = g.className;
      const clipped = [...g.querySelectorAll('.choice__name, .choice__spec')].filter(el => { const r = el.getBoundingClientRect(), card = el.closest('.choice').getBoundingClientRect(); return el.scrollWidth > el.clientWidth + 1 || r.width === 0 || r.height === 0 || r.right > card.right + 0.5 || r.bottom > card.bottom + 0.5; }).map(el => el.textContent);
      const visualOrder = cards.map((c, i) => ({ i, top: Math.round(rects[i].top), left: Math.round(rects[i].left) })).sort((a, b) => a.top - b.top || a.left - b.left).map(x => x.i);
      const scrollers = [...document.querySelectorAll('#resizerApp, #resizerApp *')].filter(el => { const cs = getComputedStyle(el); return /(auto|scroll)/.test(cs.overflowX) && el.scrollWidth > el.clientWidth + 1; }).length;
      return {
        cols: getComputedStyle(g).gridTemplateColumns.split(' ').length,
        d: Number((/req-grid--d(\d)/.exec(cls) || [])[1]), t: Number((/req-grid--t(\d)/.exec(cls) || [])[1]),
        count: cards.length, widths: [...new Set(rects.map(r => Math.round(r.width)))], heights: [...new Set(rects.map(r => Math.round(r.height)))],
        clipped, inOrder: visualOrder.every((v, i) => v === i), overflow: g.scrollWidth > g.clientWidth + 1, scrollers,
        pageOverflow: document.documentElement.scrollWidth > innerWidth + 1
      };
    });
    const widths = [320, 360, 390, 430, 639, 640, 641, 768, 999, 1000, 1001, 1280, 1440];
    for (const width of widths) {
      const { context, page } = await open(width, 720);
      await page.goto(`${origin}/image-resizer.html`);
      const g = await grid(page);
      const want = mode(width) === 'desktop' ? g.d : mode(width) === 'tablet' ? g.t : 1;
      ok(g.cols === want, `resizer @${width}: requirement grid has ${want} columns in ${mode(width)} mode (${g.cols})`);
      ok(g.widths.length === 1 && g.heights.length === 1, `resizer @${width}: requirement cards share one size (${g.widths} x ${g.heights})`);
      ok(g.clipped.length === 0, `resizer @${width}: no requirement label is clipped or hidden (${g.clipped})`);
      ok(g.inOrder, `resizer @${width}: requirements read in the same order on screen as in the page`);
      ok(!g.overflow && g.scrollers === 0 && !g.pageOverflow, `resizer @${width}: no sideways scrolling, in the grid or the page`);
      // Choose, fold to a summary, then reopen: the choice is kept and shown
      await page.locator('.choice[data-preset="passport"]').click();
      ok(await page.locator('#reqGrid').isHidden() && /350 × 450 px/.test(await page.locator('#reqSummarySpec').innerText()), `resizer @${width}: a choice folds into its summary`);
      const change = await page.locator('#btnChangeReq').boundingBox();
      ok(change && change.x >= 0 && change.x + change.width <= width, `resizer @${width}: Change is on screen`);
      await page.locator('#btnChangeReq').click();
      ok(await page.locator('.choice[data-preset="passport"]').getAttribute('aria-pressed') === 'true', `resizer @${width}: reopening shows the chosen requirement selected`);
      await page.keyboard.press('Escape');
      ok(await page.locator('#reqGrid').isHidden(), `resizer @${width}: Escape folds the list again`);
      // A file: task order top to bottom, the primary action on screen, nothing sideways
      await page.locator('#fileInput').setInputFiles({ name: 'p.png', mimeType: 'image/png', buffer: tiny });
      await page.waitForFunction(() => !document.getElementById('btnProcess').disabled);
      const order = await page.evaluate(() => ['reqPanel', 'fileInfoBox', 'cropperActiveArea', 'wsCustom'].map(id => { const el = document.getElementById(id); return el ? (el.id === 'wsCustom' ? el.previousElementSibling : el).getBoundingClientRect().top : -1; }));
      ok(order.every((v, i) => i === 0 || v > order[i - 1]), `resizer @${width}: requirement, file, editor, settings run top to bottom (${order.map(Math.round)})`);
      const action = await page.evaluate(() => { const r = document.getElementById('btnProcess').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth; });
      ok(action, `resizer @${width}: the primary action is on screen with a photo loaded`);
      ok(!await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), `resizer @${width}: no page overflow with a photo loaded`);
      // Crossing a breakpoint keeps the choice
      const across = width === 641 ? 639 : width === 1001 ? 999 : width === 639 ? 641 : width === 999 ? 1001 : null;
      if (across) {
        await page.setViewportSize({ width: across, height: 720 });
        ok(await page.locator('#presetSelect').inputValue() === 'passport' && /350 × 450 px/.test(await page.locator('#reqSummarySpec').innerText()), `resizer ${width}→${across}: the chosen requirement survives the layout change`);
      }
      // Header: a menu button on phones, the Tools menu inside the screen elsewhere
      await page.setViewportSize({ width, height: 720 });
      if (mode(width) === 'phone') {
        ok(await page.locator('#navMenuToggle').isVisible() && await page.locator('#toolsMenuButton').isHidden(), `@${width}: phones get the menu button`);
        await page.locator('#navMenuToggle').click();
        ok(await page.locator('#siteNav .menu__toggle').first().isVisible() && await page.locator('#menuList-image .menu__item').first().isVisible(), `@${width}: the menu sheet lists the categories, with this page's category open`);
        ok(!await page.evaluate(() => { const n = document.getElementById('siteNav'); return n.scrollWidth > n.clientWidth + 1; }), `@${width}: the menu sheet does not scroll sideways`);
        await page.locator('#navMenuToggle').click();
      } else {
        ok(await page.locator('#navMenuToggle').isHidden(), `@${width}: no menu button above phone width`);
        await page.locator('#toolsMenuButton').click();
        const box = await page.locator('#toolsMenu').boundingBox();
        ok(box && box.x >= 0 && box.x + box.width <= width + 0.5, `@${width}: the Tools menu fits the screen`);
        await page.keyboard.press('Escape');
      }
      await context.close();
    }
    // Result state at phone, tablet and desktop: one verdict, Download first and on screen, facts whole
    for (const width of [360, 390, 768, 1280]) {
      const { context, page } = await open(width, 800);
      await page.goto(`${origin}/image-resizer.html`);
      await page.locator('.choice[data-preset="signature"]').click();
      await page.locator('#fileInput').setInputFiles({ name: 'p.png', mimeType: 'image/png', buffer: tiny });
      await page.waitForFunction(() => !document.getElementById('btnProcess').disabled);
      await page.locator('#btnProcess').click();
      await page.locator('#resultArea:not(.hidden)').waitFor();
      await page.waitForTimeout(500);
      const r = await page.evaluate(() => {
        const dl = document.getElementById('btnDownload').getBoundingClientRect();
        const cells = [...document.querySelectorAll('.check-table th, .check-table td')].filter(c => c.offsetParent);
        return {
          onScreen: dl.top >= 0 && dl.bottom <= innerHeight && dl.left >= 0 && dl.right <= innerWidth,
          first: document.querySelector('.ws-result__actions > .btn, .ws-result__actions > a').id,
          primary: document.querySelectorAll('#resultArea .btn-primary').length,
          clipped: cells.filter(c => c.scrollWidth > c.clientWidth + 1).length,
          rows: document.querySelectorAll('.check-table tbody tr').length,
          overflow: document.documentElement.scrollWidth > innerWidth + 1
        };
      });
      ok(r.onScreen && r.first === 'btnDownload' && r.primary === 1, `result @${width}: Download is the one primary action, first and on screen`);
      ok(r.rows === 3 && r.clipped === 0 && !r.overflow, `result @${width}: size, dimensions and format are shown whole`);
      await context.close();
    }
    // Secondary tools and the resume builder change arrangement at 1000px, never squeeze
    for (const width of [999, 1000]) {
      const { context, page } = await open(width, 900);
      await page.goto(`${origin}/signature-cleaner.html`);
      await page.locator('#cleanerFileInput').setInputFiles({ name: 'p.png', mimeType: 'image/png', buffer: tiny });
      await page.locator('#cleanerPreviewArea:not(.hidden)').waitFor();
      const beside = await page.evaluate(() => document.querySelector('.ws-side').getBoundingClientRect().left > document.querySelector('.ws-stage').getBoundingClientRect().left + 100);
      ok(beside === (width >= 1000), `signature cleaner @${width}: settings ${width >= 1000 ? 'beside' : 'below'} the stage`);
      await page.goto(`${origin}/resume.html`);
      const rb = await page.evaluate(() => { const e = document.querySelector('.rb-editor').getBoundingClientRect(), p = document.querySelector('.rb-preview').getBoundingClientRect(); return { both: e.width > 0 && p.width > 0, editor: e.width, bar: getComputedStyle(document.querySelector('.rb-bar')).display !== 'none' }; });
      if (width >= 1000) ok(rb.both && rb.editor >= 460 && !rb.bar, `resume @${width}: editor (${Math.round(rb.editor)}px) and preview side by side`);
      else ok(rb.bar && await page.locator('.rb-preview').isHidden(), `resume @${width}: Edit and Preview are switched, not squeezed`);
      await context.close();
    }
  }
  console.log('✓ Layout modes: requirement grid, task order, primary action, header, result and resume on both sides of 640 and 1000px');

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
      // Guide charts scroll sideways inside their frame on a phone: the frame then takes keyboard
      // focus, named by the chart, and passes axe; on a desktop, where it fits, it is not a tab stop.
      const chartGuides = pages.filter(f => f.startsWith('guides/') && /<figure class="shot">\s*<svg/.test(fs.readFileSync(path.join(root, f), 'utf8')));
      ok(chartGuides.length >= 8, `guides with charts found (${chartGuides.length})`);
      for (const file of chartGuides) {
        await page.setViewportSize({ width: 360, height: 740 });
        await page.goto(`${origin}/${file}`); await setTheme();
        const frame = await page.evaluate(() => { const f = [...document.querySelectorAll('.shot')].find(x => x.querySelector(':scope > svg')); return { scrolls: f.scrollWidth > f.clientWidth, tab: f.tabIndex, name: f.getAttribute('aria-labelledby'), title: f.querySelector('svg > title') && f.querySelector('svg > title').id }; });
        ok(frame.scrolls && frame.tab === 0 && frame.name && frame.name === frame.title, `${scheme} ${file} @360: the scrolling chart frame takes focus and is named by its chart (${JSON.stringify(frame)})`);
        const result = await new AxeBuilder({ page }).include('main').withTags(rules).analyze();
        ok(result.violations.length === 0, `${scheme} ${file} @360: ${result.violations.map(v => v.id + ' ' + v.nodes[0].target.join(' ')).join('; ')}`);
        await page.setViewportSize({ width: 1280, height: 900 });
        await page.waitForTimeout(250);
        ok(await page.evaluate(() => [...document.querySelectorAll('.shot')].every(f => !f.hasAttribute('tabindex'))), `${scheme} ${file} @1280: a chart that fits is not a tab stop`);
      }
      const image = async () => Buffer.from(await page.evaluate(() => {
        const c = document.createElement('canvas'); c.width = 900; c.height = 1100; const x = c.getContext('2d');
        const g = x.createLinearGradient(0, 0, 900, 1100); g.addColorStop(0, '#456'); g.addColorStop(1, '#dba');
        x.fillStyle = g; x.fillRect(0, 0, 900, 1100); x.fillStyle = '#fff'; x.beginPath(); x.arc(450, 450, 250, 0, 7); x.fill();
        return c.toDataURL('image/png').split(',')[1];
      }), 'base64');
      for (const [file, input, action, result] of [['image-resizer.html', '#fileInput', '#btnProcess', '#resultArea'], ['resize-image-to-20kb.html', '#fileInput', '#btnProcess', '#resultArea']]) {
        await page.goto(`${origin}/${file}`); await setTheme();
        if (file === 'image-resizer.html') await choose(page, 'passport');
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

  // 6. Embedded resizer on every page that hosts it: order and result facts.
  {
    const { context, page } = await open(1280, 900);
    const canvasPng = async () => Buffer.from(await page.evaluate(() => {
      const c = document.createElement('canvas'); c.width = 900; c.height = 1100; const x = c.getContext('2d');
      x.fillStyle = '#789'; x.fillRect(0, 0, 900, 1100); x.fillStyle = '#fed'; x.beginPath(); x.arc(450, 450, 250, 0, 7); x.fill();
      return c.toDataURL('image/png').split(',')[1];
    }), 'base64');
    const embedded = pages.filter(f => /id="resizerApp"/.test(fs.readFileSync(path.join(root, f), 'utf8')));
    const { PAGES: RESIZER_PAGES } = require('../scripts/build-image-pages.js');
    const expected = Object.keys(RESIZER_PAGES).filter(f => fs.existsSync(path.join(root, f)));
    ok(embedded.length === expected.length && expected.length >= 4, `every resizer page from build-image-pages.js hosts the tool (${embedded.length} of ${expected.length})`);
    // Errors must be visible on every embedded tool, not only on the image resizer.
    for (const file of embedded) {
      await page.goto(`${origin}/${file}`);
      await openSettings(page);
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
      const label = (await page.locator('#btnProcess').textContent()).trim();
      await page.locator('#fileInput').setInputFiles({ name: 'p.png', mimeType: 'image/png', buffer: await canvasPng() });
      await page.locator('#cropperActiveArea').waitFor({ state: 'visible' });
      ok(await page.locator('#dropzone').isHidden(), `${file}: the dropzone folds away once a file is chosen`);
      const before = await page.evaluate(() => { const i = document.getElementById('cropperActiveArea').getBoundingClientRect().top, b = document.getElementById('btnProcess').getBoundingClientRect().top; return i <= b; });
      ok(before, `${file}: the image appears above the Resize button`);
      ok((await page.locator('#btnProcess').textContent()).trim() === label, `${file}: the button keeps its label`);
      // The multi-target KB page asks which limit first, like the image resizer.
      if (await page.locator('#btnProcess').isDisabled()) await choose(page, await page.locator('.choice[data-preset="kb-100"]').count() ? 'kb-100' : 'passport');
      await page.locator('#btnProcess').click();
      await page.locator('#resultArea').waitFor({ state: 'visible' });
      await page.waitForFunction(() => document.getElementById('resultFileSize') && document.getElementById('resultFileSize').textContent.trim().length > 2);
      ok((await page.locator('#resultDims').innerText()).trim().length > 3, `${file}: result shows dimensions`);
      ok((await page.locator('#resultFileSize').innerText()).includes('KB'), `${file}: result shows file size`);
      ok(await page.locator('#btnProcess').isHidden() && await page.locator('#btnDownload').isVisible(), `${file}: once finished, Download replaces the Resize button`);
    }
    await context.close();
  }
  console.log('✓ Resizer pages: order, folded dropzone, result facts');
  // 7. Secondary tools explain a bad file in the page, never with a blocking browser dialog,
  //    and never leave the person wondering whether anything happened.
  {
    const { context, page } = await open(390, 800);
    let dialogs = 0; page.on('dialog', d => { dialogs++; d.dismiss(); });
    const cases = [['compress-pdf.html', '#compressFileInput', async () => { if (await page.locator('#btnStartCompress').isVisible()) await page.locator('#btnStartCompress').click(); }], ['image-to-pdf.html', 'input[type=file]', null], ['passport-photo-print.html', 'input[type=file]', null], ['signature-cleaner.html', 'input[type=file]', null]];
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

    // The image resizer asks what is being prepared before it will process, and says so under the action
    const { context, page } = await open(390, 844);
    await page.goto(`${origin}/image-resizer.html`);
    await page.locator('#fileInput').setInputFiles({ name: 'p.png', mimeType: 'image/png', buffer: await noisePng(page, 600, 800) });
    await page.locator('#cropperActiveArea:not(.hidden)').waitFor();
    const summary = async () => (await page.locator('#processSummary').innerText()).replace(/\s+/g, ' ').trim();
    ok(await page.locator('#btnProcess').isDisabled() && /Choose what you are preparing/.test(await summary()), `nothing is processed before a requirement is chosen (${await summary()})`);
    ok(await page.locator('.choice[aria-pressed="true"]').count() === 0, 'no requirement is preselected on the image resizer');
    await page.locator('#processSummary button').click();
    ok(await page.evaluate(() => document.activeElement && document.activeElement.matches('.choice')), '"Show me" takes focus to the requirement list');
    await choose(page, 'passport');
    ok(await page.locator('#btnProcess').isEnabled(), 'choosing a requirement enables the action');
    ok(/350 × 450 px/.test(await page.locator('#reqSummarySpec').innerText()) && await page.locator('#reqGrid').isHidden(), 'the chosen requirement folds into a summary with its numbers');
    ok(await page.locator('#resizerApp').getAttribute('data-settings') === 'closed', 'a chosen requirement keeps the detailed settings folded');
    await openSettings(page);
    await page.locator('#customWidth').fill('5');
    await page.locator('#customWidth').dispatchEvent('input');
    ok(await page.locator('#btnProcess').isDisabled(), 'an invalid width disables the action');
    ok(await page.locator('.choice[data-preset="custom"]').getAttribute('aria-pressed') === 'true' && await page.locator('.choice[data-preset="passport"]').getAttribute('aria-pressed') === 'false', 'editing a value moves the requirement to Custom size');
    ok(/Fix the setting/.test(await summary()), 'summary says why the action is disabled');
    const gap = await page.evaluate(() => document.getElementById('dimError').getBoundingClientRect().top - document.getElementById('customWidth').getBoundingClientRect().bottom);
    ok(gap >= 0 && gap < 40, `the width error sits right under the field (${Math.round(gap)} px)`);
    // Border colours animate, so wait for the marked state instead of sampling mid-transition
    ok(await page.waitForFunction(() => { const w = document.getElementById('customWidth'); return w.getAttribute('aria-invalid') === 'true' && getComputedStyle(w).borderTopColor !== getComputedStyle(document.getElementById('customMaxKB')).borderTopColor; }, null, { timeout: 3000 }).then(() => true, () => false), 'the invalid field is marked');
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
    // Compress PDF never hands back a larger file: a PDF already under the target is kept as it is,
    // and a compressed result is never bigger than the PDF it came from.
    {
      // A real one-page scan (the compressor opens the file before it decides anything).
      const PDFLib = require('../js/vendor/pdf-lib.min.js');
      const scan = await PDFLib.PDFDocument.create();
      const img = await scan.embedJpg(fs.readFileSync(path.join(root, 'img/samples/test-signature-cleaned.jpg')));
      scan.addPage([595.28, 841.89]).drawImage(img, { x: 36, y: 300, width: 523, height: 294 });
      const pdf = Buffer.from(await scan.save());
      for (const [target, expectKept] of [['200', true], ['30', false]]) {
        await page.goto(`${origin}/compress-pdf.html`);
        await page.locator('#compressFileInput').setInputFiles({ name: 'scan.pdf', mimeType: 'application/pdf', buffer: pdf });
        await page.locator('#compressFileInfoBox:not(.hidden)').waitFor({ timeout: 15000 });
        await page.locator('#targetKbInput').fill(target);
        await page.locator('#btnStartCompress').click();
        await page.locator('#compressResultArea:not(.hidden)').waitFor({ timeout: 30000 });
        const out = await page.evaluate(async () => (await fetch(document.getElementById('btnDownloadCompressedPdf').href).then(r => r.blob())).size);
        const status = await page.locator('#compressStatus').innerText();
        ok(out <= pdf.length, `compress ${target} KB: the result (${out} bytes) is not larger than the input (${pdf.length} bytes)`);
        if (expectKept) ok(out === pdf.length && /kept unchanged/.test(status), `compress ${target} KB: a PDF already under the limit is kept (${status})`);
      }
    }

    // Compress PDF keeps the page geometry: an A4 scan whose camera JPEG carries an EXIF thumbnail
    // (whose first FF D9 marker is inside the EXIF segment) comes back as one A4 page under the target.
    {
      const main = fs.readFileSync(path.join(root, 'img/samples/test-signature-cleaned.jpg'));
      const thumbB64 = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 24; c.height = 16; c.getContext('2d').fillRect(4, 4, 12, 8); return c.toDataURL('image/jpeg', 0.5).split(',')[1]; });
      const thumb = Buffer.from(thumbB64, 'base64');
      const be16 = n => Buffer.from([(n >> 8) & 255, n & 255]), be32 = n => Buffer.from([(n >>> 24) & 255, (n >> 16) & 255, (n >> 8) & 255, n & 255]);
      const ifd0 = Buffer.concat([be16(1), be16(0x0112), be16(3), be32(1), Buffer.from([0, 1, 0, 0]), be32(8 + 2 + 12 + 4)]);
      const thumbOff = 8 + ifd0.length + 2 + 24 + 4;
      const ifd1 = Buffer.concat([be16(2), be16(0x0201), be16(4), be32(1), be32(thumbOff), be16(0x0202), be16(4), be32(1), be32(thumb.length), be32(0)]);
      const exif = Buffer.concat([Buffer.from('Exif\0\0'), Buffer.from('MM\0\x2a\0\0\0\x08', 'latin1'), ifd0, ifd1, thumb]);
      const jpeg = Buffer.concat([main.subarray(0, 2), Buffer.from([0xFF, 0xE1]), be16(exif.length + 2), exif, main.subarray(2)]);
      const content = Buffer.from('q 523.28 0 0 294.35 36 511.54 cm /Im1 Do Q');
      const objs = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
        '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Contents 4 0 R /Resources << /XObject << /Im1 5 0 R >> >> >>',
        Buffer.concat([Buffer.from(`<< /Length ${content.length} >>\nstream\n`), content, Buffer.from('\nendstream')]),
        Buffer.concat([Buffer.from(`<< /Type /XObject /Subtype /Image /Width 1600 /Height 900 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`), jpeg, Buffer.from('\nendstream')])];
      const parts = [Buffer.from('%PDF-1.4\n')]; const offs = []; let len = parts[0].length;
      objs.forEach((o, i) => { offs.push(len); const b = Buffer.concat([Buffer.from(`${i + 1} 0 obj\n`), Buffer.isBuffer(o) ? o : Buffer.from(o), Buffer.from('\nendobj\n')]); parts.push(b); len += b.length; });
      parts.push(Buffer.from(`xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offs.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('')}trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${len}\n%%EOF\n`));
      const pdf = Buffer.concat(parts);
      await page.goto(`${origin}/compress-pdf.html`);
      await page.locator('#compressFileInput').setInputFiles({ name: 'camera-scan.pdf', mimeType: 'application/pdf', buffer: pdf });
      await page.locator('#compressFileInfoBox:not(.hidden)').waitFor({ timeout: 15000 });
      await page.locator('#targetKbInput').fill('30');
      await page.locator('#btnStartCompress').click();
      await page.locator('#compressResultArea:not(.hidden)').waitFor({ timeout: 30000 });
      const out = await page.evaluate(async () => { const b = await fetch(document.getElementById('btnDownloadCompressedPdf').href).then(r => r.blob()); let t = ''; new Uint8Array(await b.arrayBuffer()).forEach(c => { t += String.fromCharCode(c); }); return { size: b.size, b64: btoa(t) }; });
      const PDFLib = require('../js/vendor/pdf-lib.min.js');
      const outDoc = await PDFLib.PDFDocument.load(Buffer.from(out.b64, 'base64'));
      const box = outDoc.getPage(0).getMediaBox();
      ok(outDoc.getPageCount() === 1 && Math.abs(box.width - 595.28) < 0.1 && Math.abs(box.height - 841.89) < 0.1, `compress: an A4 page with an EXIF-thumbnail JPEG comes back as one A4 page (${outDoc.getPageCount()}, ${box.width} x ${box.height})`);
      ok(out.size <= 30 * 1024 && out.size < pdf.length, `compress: the result (${out.size} bytes) is under 30 KB and smaller than the input (${pdf.length} bytes)`);
    }

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
      await p.goto(`${origin}/image-resizer.html`);
      await p.evaluate(s => document.documentElement.setAttribute('data-theme', s), scheme);
      const ratio = await p.evaluate(() => {
        const lum = c => { const [r, g, b] = c.match(/\d+/g).slice(0, 3).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
        const field = getComputedStyle(document.getElementById('customMaxKB')).borderTopColor;
        const panel = getComputedStyle(document.querySelector('.ws')).backgroundColor;
        const [a, b] = [lum(field), lum(panel)].sort((x, y) => y - x);
        return (a + 0.05) / (b + 0.05);
      });
      ok(ratio >= 3, `${scheme}: field edge contrast is ${ratio.toFixed(2)}:1`);
      // Tools menu: Escape closes it and gives focus back to its button
      await p.locator('#toolsMenuButton').click();
      await p.keyboard.press('Tab');
      await p.keyboard.press('Escape');
      ok(await p.evaluate(() => document.getElementById('toolsMenuButton').getAttribute('aria-expanded') === 'false' && document.activeElement === document.getElementById('toolsMenuButton')), `${scheme}: Escape closes the Tools menu and returns focus`);
      await ctx.close();
    }
  }
  console.log('✓ Output summary, inline errors, compress target status, phone reveal, preset state, placeholders, field contrast, menu focus');


  // 9. Interactions introduced by the interface rebuild.
  {
    const { context, page } = await open(1280, 900);
    const pngOf = async (w, h) => Buffer.from(await page.evaluate(([w, h]) => {
      const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
      x.fillStyle = '#345'; x.fillRect(0, 0, w, h); x.fillStyle = '#fc0'; x.fillRect(10, 10, w / 3, h / 3);
      return c.toDataURL('image/png').split(',')[1];
    }, [w, h]), 'base64');
    await page.goto(`${origin}/image-to-pdf.html`);
    await page.locator('#imgPdfFileInput').setInputFiles([{ name: 'wide.png', mimeType: 'image/png', buffer: await pngOf(1200, 600) }, { name: 'tall.png', mimeType: 'image/png', buffer: await pngOf(600, 900) }]);
    await page.locator('.page-row').nth(1).waitFor();
    const mediaBoxes = async () => page.evaluate(async () => { const t = await fetch(document.getElementById('btnDownloadPdf').href).then(r => r.text()); return [...t.matchAll(/\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/g)].map(m => Number(m[1]) > Number(m[2]) ? 'landscape' : 'portrait'); });
    await page.locator('#btnConvertToPdf').click();
    await page.locator('#pdfResultArea:not(.hidden)').waitFor();
    ok(JSON.stringify(await mediaBoxes()) === '["landscape","portrait"]', 'image to PDF: pages follow each image by default');
    await page.locator('.page-row').first().locator('.btn-rotate').click();
    ok(await page.locator('#pdfResultArea').isHidden(), 'image to PDF: changing a page hides the stale PDF');
    ok(await page.evaluate(() => document.activeElement && document.activeElement.classList.contains('btn-rotate')), 'image to PDF: focus stays on the rotate button');
    await page.locator('.page-row').first().locator('.btn-move-down').click();
    ok((await page.locator('.page-row__name').first().textContent()).includes('tall'), 'image to PDF: moving a page reorders the list');
    ok(await page.evaluate(() => document.activeElement && document.activeElement.closest('.page-row') === document.querySelectorAll('.page-row')[1]), 'image to PDF: focus follows the moved page');
    await page.locator('#btnConvertToPdf').click();
    await page.locator('#pdfResultArea:not(.hidden)').waitFor();
    ok(JSON.stringify(await mediaBoxes()) === '["portrait","portrait"]', 'image to PDF: a rotated landscape image becomes a portrait page');
    await page.locator('#pageSizeSelect').selectOption('letter');
    ok(await page.locator('#pdfResultArea').isHidden(), 'image to PDF: changing page setup hides the stale PDF');

    // Drag a page by its handle (pointer events cover mouse, pen and touch), and move it with arrow keys
    const names = () => page.locator('.page-row__name').allTextContents();
    const firstBefore = (await names())[0];
    // Let the smooth scroll to the earlier result finish first: measuring while the page still moves
    // puts the pointer somewhere else by the time it presses. Then start clear of the screen edges,
    // where dragging scrolls the page on purpose.
    const scrollSettled = () => page.evaluate(() => new Promise(done => { let y = scrollY, still = 0; const tick = () => { if (scrollY === y) { if (++still > 8) return done(); } else { y = scrollY; still = 0; } requestAnimationFrame(tick); }; requestAnimationFrame(tick); }));
    await scrollSettled();
    await page.locator('.page-row').first().evaluate(el => el.scrollIntoView({ block: 'center' }));
    await scrollSettled();
    const handle = page.locator('.page-row').first().locator('.page-row__handle');
    const hb = await handle.boundingBox(), target = await page.locator('.page-row').nth(1).boundingBox();
    await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
    await page.mouse.down();
    await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 8 });
    await page.mouse.up();
    ok((await names())[1] === firstBefore, 'image to PDF: dragging a page by its handle reorders it');
    ok(await page.evaluate(() => document.activeElement && document.activeElement.classList.contains('page-row__handle') && document.activeElement.closest('.page-row') === document.querySelectorAll('.page-row')[1]), 'image to PDF: focus stays on the dragged page');
    await page.keyboard.press('ArrowLeft');
    ok((await names())[0] === firstBefore, 'image to PDF: arrow keys on the handle move the page');
    ok(/position 1 of 2/.test(await page.locator('#pageOrderStatus').textContent()), 'image to PDF: the new position is announced');

    // Signature cleaner: before and after side by side, and the download follows every setting
    await page.goto(`${origin}/signature-cleaner.html`);
    await page.locator('#cleanerFileInput').setInputFiles({ name: 's.png', mimeType: 'image/png', buffer: await pngOf(600, 240) });
    await page.waitForFunction(() => (document.getElementById('btnCleanerDownload').getAttribute('href') || '').startsWith('blob:'));
    const [orig, clean] = await Promise.all([page.locator('#cleanerOriginalCanvas').boundingBox(), page.locator('#cleanerCanvas').boundingBox()]);
    ok(orig && clean && Math.abs(orig.y - clean.y) < 2 && orig.x < clean.x, 'signature: original and cleaned are shown side by side on a desktop');
    const hrefBefore = await page.locator('#btnCleanerDownload').getAttribute('href');
    await page.locator('#inkColorSelect').selectOption('blue');
    await page.waitForFunction(h => document.getElementById('btnCleanerDownload').getAttribute('href') !== h, hrefBefore);
    ok(true, 'signature: changing a setting refreshes the download');

    // Resizer, every setting open: the page scrolls normally (no inner scroll region), the sticky action
    // stays on screen, and the last setting can be scrolled clear of it.
    await page.goto(`${origin}/image-resizer.html`);
    await choose(page, 'passport');
    await page.locator('#fileInput').setInputFiles({ name: 'p.png', mimeType: 'image/png', buffer: await pngOf(700, 900) });
    await page.waitForFunction(() => !document.getElementById('btnProcess').disabled);
    await openSettings(page);
    await page.evaluate(() => { document.querySelector('.ws-advanced').open = true; });
    const inner = await page.evaluate(() => [...document.querySelectorAll('#resizerApp, #resizerApp *')].filter(el => { const cs = getComputedStyle(el); return /(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 1 && !el.closest('.cropper-container-wrapper'); }).map(el => el.id || el.className));
    ok(inner.length === 0, `the resizer has no inner scroll region (${inner})`);
    for (const y of [0, 400]) {
      await page.evaluate(y => scrollTo(0, y), y);
      await page.waitForTimeout(100);
      const visible = await page.evaluate(() => { const b = document.getElementById('btnProcess').getBoundingClientRect(); return b.top >= 0 && b.bottom <= innerHeight; });
      ok(visible, `resizer at scroll ${y}: the main action is on screen`);
    }
    await page.evaluate(() => { const ws = document.getElementById('resizerApp').getBoundingClientRect(); scrollTo(0, scrollY + ws.bottom - innerHeight + 8); });
    await page.waitForTimeout(100);
    const clear = await page.evaluate(() => document.querySelector('.ws-advanced').getBoundingClientRect().bottom <= document.querySelector('#resizerApp .ws-action').getBoundingClientRect().top + 1);
    ok(clear, 'resizer: the last setting scrolls clear of the sticky action');

    // Secondary tool rail (desktop): settings and action beside the stage, no inner scroll region
    await page.goto(`${origin}/signature-cleaner.html`);
    await page.locator('#cleanerFileInput').setInputFiles({ name: 'p.png', mimeType: 'image/png', buffer: await pngOf(700, 400) });
    await page.locator('#cleanerPreviewArea:not(.hidden)').waitFor();
    const rail = await page.evaluate(() => { const r = document.querySelector('.ws-rail'), cs = getComputedStyle(r), a = document.getElementById('btnCleanerDownload').getBoundingClientRect(); return { scroll: /(auto|scroll)/.test(cs.overflowY), maxH: cs.maxHeight, side: r.getBoundingClientRect().left > document.querySelector('.ws-stage').getBoundingClientRect().left, onScreen: a.top >= 0 && a.bottom <= innerHeight }; });
    ok(!rail.scroll && rail.maxH === 'none', 'signature cleaner: the rail scrolls with the page');
    ok(rail.side, 'signature cleaner: settings sit beside the stage on a desktop');
    ok(rail.onScreen, 'signature cleaner: Download is on screen after upload');

    // Landing pages: the tool comes before the reference content
    for (const file of ['image-resizer.html', 'resize-image-to-20kb.html', 'resize-image-to-50kb.html']) {
      await page.goto(`${origin}/${file}`);
      const before = await page.evaluate(() => { const ws = document.getElementById('resizerApp').getBoundingClientRect().top; const prose = document.querySelector('main .prose'); return !prose || ws < prose.getBoundingClientRect().top; });
      ok(before, `${file}: the tool appears before the reference content`);
    }

    // Resume: fold an entry, Fix focuses the exact field even inside a folded entry
    await page.goto(`${origin}/resume.html`);
    // Start from an empty library: saved resumes live in IndexedDB, not only localStorage.
    await page.evaluate(() => new Promise(done => { try { localStorage.clear(); } catch (e) {} const r = indexedDB.deleteDatabase('applyready'); r.onsuccess = r.onerror = r.onblocked = () => done(); }));
    await page.reload();
    await page.locator('#sec-experience .accordion-header').click();
    await page.locator('#btnAddExperience').click();
    const entry = page.locator('#experienceList .entry').first();
    await entry.locator('.item-company').fill('Fold Test Ltd');
    await entry.locator('.entry__toggle').click();
    ok(await entry.locator('.entry__body').isHidden() && await entry.locator('.entry__toggle').getAttribute('aria-expanded') === 'false', 'resume: an entry folds to its title');
    ok((await page.locator('#sec-experience .accordion-meta').textContent()).includes('1 role'), 'resume: the section header counts its entries');
    await page.locator('#tabReview').click();
    ok(await page.locator('#reviewTabCount').isVisible(), 'resume: the Review tab shows how many findings are open');
    const fix = page.locator('#reviewChecklist .review-jump-btn[data-target^="exp-role-"]').first();
    ok(await fix.count() === 1, 'resume: a missing job title points at that entry');
    await fix.click();
    await page.waitForTimeout(400);
    ok(await page.evaluate(() => document.activeElement && /^exp-role-/.test(document.activeElement.id)), 'resume: Fix focuses the job title field of the entry');
    ok(await entry.locator('.entry__body').isVisible(), 'resume: Fix unfolds the entry it points at');
    await context.close();

    // Phone: Download is one tap away from the editor
    const phone = await open(390, 844, true);
    await phone.page.goto(`${origin}/resume.html`);
    await phone.page.locator('#tabPreview').click();
    await phone.page.locator('#btnMobileDownload').click();
    ok(await phone.page.locator('#viewDownload').isVisible() && await phone.page.locator('#btnDownloadPDF').isVisible(), 'resume on a phone: Download opens the download step');
    await phone.context.close();
  }
  console.log('✓ Rebuild interactions: PDF rotation, drag and keyboard reorder, stale results, focus, signature compare, no inner scrolling, tool order, entry folding, exact-field Fix, phone Download');

  // 10. Navigation and search: the phone menu sheet, the search dialog and the directory filter.
  {
    // Phone menu sheet: short, search first, focus moves in and stays in while it is open.
    const { context, page } = await open(360, 740, true);
    await page.goto(`${origin}/index.html`);
    const toggle = page.locator('#navMenuToggle');
    await toggle.click();
    ok(await toggle.getAttribute('aria-expanded') === 'true', 'phone menu: opens');
    ok(await page.evaluate(() => document.activeElement.id) === 'navSearch', 'phone menu: focus moves to Search tools, the first item of the sheet');
    ok(await page.evaluate(() => { const n = document.getElementById('siteNav'); return n.scrollHeight <= n.clientHeight + 1; }), 'phone menu: with the categories closed the sheet fits a 360 × 740 screen');
    // Tab order: sheet top to bottom, then the header buttons, then round again; never out of the header.
    const seen = [];
    for (let i = 0; i < 16; i++) {
      seen.push(await page.evaluate(() => { const a = document.activeElement; const r = a.getBoundingClientRect(); return { id: a.id || a.textContent.trim().slice(0, 24), inHeader: !!a.closest('#siteHeader'), inSheet: !!a.closest('#siteNav'), top: r.top }; }));
      await page.keyboard.press('Tab');
    }
    ok(seen.every(s => s.inHeader), `phone menu: Tab stays in the header and sheet while open (${seen.filter(s => !s.inHeader).map(s => s.id)})`);
    const sheet = seen.slice(0, seen.findIndex(s => !s.inSheet));
    ok(sheet.length >= 8 && sheet.every((s, i) => i === 0 || s.top > sheet[i - 1].top), `phone menu: the sheet is reached top to bottom, in the order it is drawn (${sheet.map(s => s.id + '@' + Math.round(s.top))})`);
    ok(sheet[0].id === 'navSearch' && /Resume/.test(sheet[1].id), 'phone menu: Search tools, then the categories from Resume');
    await page.locator('.site-header .brand').focus();
    await page.keyboard.press('Shift+Tab');
    ok(await page.evaluate(() => document.activeElement.id) === 'navMenuToggle', 'phone menu: Shift+Tab from the first item in the header goes round to the menu button');
    // Categories open and close. A category with one tool has no toggle: Resume builder is a row of
    // the sheet, one tap after opening the menu (it once took three), and is listed once.
    ok(await page.locator('.menu__toggle[aria-controls="menuList-resume"], .menu__toggle[aria-controls="menuList-cafe"]').count() === 0, 'phone menu: no toggle for a category with a single tool');
    ok(await page.locator('#menuList-resume a').isVisible() && await page.locator('#menuList-cafe a').isVisible(), 'phone menu: Resume builder and Applicant workspaces are shown directly');
    ok(await page.locator('#siteNav a:visible', { hasText: 'Resume builder' }).count() === 1, 'phone menu: Resume builder is listed once');
    const images = page.locator('.menu__toggle[aria-controls="menuList-image"]');
    await images.click();
    ok(await images.getAttribute('aria-expanded') === 'true' && await page.locator('#menuList-image a').first().isVisible(), 'phone menu: a category opens to show its tools');
    await images.click();
    ok(await page.locator('#menuList-image').isHidden(), 'phone menu: and closes again');
    await page.keyboard.press('Escape');
    ok(await toggle.getAttribute('aria-expanded') === 'false' && await page.evaluate(() => document.activeElement.id) === 'navMenuToggle', 'phone menu: Escape closes it and returns focus to the menu button');
    // Search from the sheet: the sheet closes, the dialog opens, and closing it returns to the menu button.
    await toggle.click();
    await page.locator('#navSearch').click();
    await page.locator('.search-dialog input').waitFor();
    ok(await toggle.getAttribute('aria-expanded') === 'false' && await page.evaluate(() => document.activeElement.closest('.search-dialog') !== null), 'phone menu: Search tools opens the search dialog');
    await page.keyboard.press('Escape');
    ok(await page.evaluate(() => document.activeElement.id) === 'navMenuToggle', 'phone menu: closing the search returns focus to the menu button');
    // On a tool page its own category starts open.
    await page.goto(`${origin}/merge-pdf.html`);
    await toggle.click();
    ok(await page.locator('#menuList-pdf a[aria-current="page"]').isVisible() && await page.locator('#menuList-image').isHidden(), 'phone menu: on Merge PDF the PDF tools are open and the rest closed');
    await context.close();
  }
  {
    // Search dialog: results are options without links inside, open by Enter or click, pass axe in both themes.
    for (const scheme of ['light', 'dark']) {
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: scheme });
      await context.route('**/*', route => /^(http:\/\/127\.|blob:|data:)/.test(route.request().url()) ? route.continue() : route.abort());
      const page = await context.newPage();
      const scan = async label => {
        // The dialog fades in; contrast is measured once it has settled.
        await page.waitForFunction(() => document.getAnimations().every(a => a.playState !== 'running'));
        const result = await new AxeBuilder({ page }).include('.search-dialog').withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
        ok(result.violations.length === 0, `search ${scheme} ${label}: ${result.violations.map(v => v.id + ' ' + v.nodes[0].target.join(' ')).join('; ')}`);
      };
      await page.goto(`${origin}/merge-pdf.html`);
      await page.keyboard.press('Control+K');
      const input = page.locator('.search-dialog input');
      await input.waitFor();
      await scan('popular tools');
      await input.fill('merge');
      ok(await page.locator('.search-dialog [role="option"]').count() > 0 && await page.locator('.search-dialog [role="option"] a, .search-dialog [role="option"] button').count() === 0, `search ${scheme}: options hold no links or buttons`);
      await scan('results');
      await input.fill('zzqqxx');
      const link = page.locator('.search-results__empty a');
      ok(await link.isVisible() && /underline/.test(await link.evaluate(a => getComputedStyle(a).textDecorationLine)), `search ${scheme}: the "browse all tools" link is underlined`);
      await scan('no results');
      // Tab goes round the field, Close and (only while it shows) the "browse all tools" link.
      const tabRound = async (shift) => {
        const seen = [];
        await input.focus();
        for (let i = 0; i < 4; i++) {
          await page.keyboard.press(shift ? 'Shift+Tab' : 'Tab');
          seen.push(await page.evaluate(() => { const a = document.activeElement; return a.tagName + (a.closest('.search-dialog') ? '' : ':outside'); }));
        }
        return seen.join();
      };
      ok(await tabRound(false) === 'BUTTON,A,INPUT,BUTTON', `search ${scheme}: Tab reaches the "browse all tools" link when nothing matches (${await tabRound(false)})`);
      await input.fill('merge');
      ok(await page.locator('.search-results__empty').isHidden(), `search ${scheme}: results hide the empty message`);
      ok(await tabRound(false) === 'BUTTON,INPUT,BUTTON,INPUT', `search ${scheme}: Tab goes round the field and Close after a no-results query, skipping the hidden link (${await tabRound(false)})`);
      ok(await tabRound(true) === 'BUTTON,INPUT,BUTTON,INPUT', `search ${scheme}: Shift+Tab goes round the same way (${await tabRound(true)})`);
      if (scheme === 'light') {
        await input.fill('mrege pdf');
        await page.keyboard.press('Enter');
        await page.waitForURL(/merge-pdf\.html$/, { waitUntil: 'domcontentloaded' });
        ok(true, 'search: Enter opens the first result of a misspelt query');
        await page.goto(`${origin}/index.html`, { waitUntil: 'domcontentloaded' });
        await page.keyboard.press('/');
        await page.locator('.search-dialog input').fill('word to pdf');
        ok(await page.locator('.search-dialog [role="option"]').count() === 1, 'search: "word to pdf" offers one answer, the export help');
        await page.locator('.search-dialog [role="option"]').first().click();
        await page.waitForURL(/file-checker\.html#word-to-pdf$/);
        ok(await page.locator('#word-to-pdf').isVisible(), 'search: a click on a result opens it; the Word to PDF help is on the page');
      }
      await context.close();
    }
  }
  {
    // Directory filter: counts what it shows, shows each tool once, says when nothing matches.
    const { context, page } = await open(1280, 900);
    await page.goto(`${origin}/tools.html?q=50kb`);
    const visible = () => page.locator('.tool-card:not([hidden])').evaluateAll(cards => cards.filter(c => c.offsetParent !== null).map(c => c.dataset.tool));
    let shown = await visible();
    ok(shown.join() === 'image-resizer' && (await page.locator('#toolFilterStatus').textContent()) === '1 tool matches “50kb”', `directory: "50kb" shows the image resizer with its 50 KB link (${shown})`);
    ok(await page.locator('.tool-card[data-tool="image-resizer"] a[data-tool="resize-50kb"]').isVisible(), 'directory: the 50 KB page is one click away');
    for (const q of ['20kb', '100kb', 'photo under 50 kb', 'join pdf', 'compress', 'text to pdf', 'batch']) {
      await page.locator('#toolFilter').fill(q);
      shown = await visible();
      const status = await page.locator('#toolFilterStatus').textContent();
      ok(shown.length > 0 && new Set(shown).size === shown.length, `directory: "${q}" shows each tool once (${shown})`);
      ok(status.startsWith(`${shown.length} tool${shown.length === 1 ? ' matches' : 's match'}`), `directory: "${q}" counts the cards it shows (${status}; ${shown.length})`);
      ok(await page.locator('#toolFilterEmpty').isHidden(), `directory: "${q}" does not show the empty message`);
    }
    await page.locator('#toolFilter').fill('zzqq');
    ok((await visible()).length === 0 && await page.locator('#toolFilterEmpty').isVisible() && /No tool matches/.test(await page.locator('#toolFilterStatus').textContent()), 'directory: no match says so');
    await page.locator('#toolFilter').fill('word to pdf');
    ok(await page.locator('#toolFilterEmpty a[href="file-checker.html#word-to-pdf"]').isVisible(), 'directory: "word to pdf" points to the export help');
    await page.locator('#toolFilter').fill('');
    ok((await visible()).length === await page.locator('.tool-card').count(), 'directory: clearing the filter shows every card again');
    await context.close();
  }
  console.log('✓ Navigation: phone menu sheet order, focus and categories; search dialog options and axe; directory filter counts');

  await browser.close();
  server.close();
  console.log(`\n${checks} UI assertions passed.`);
})().catch(error => { console.error(error); process.exit(1); });
