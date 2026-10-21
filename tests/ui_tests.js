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
  const open = async (width, height, touch = false) => {
    const context = await browser.newContext({ viewport: { width, height }, colorScheme: 'light', ...(touch ? { hasTouch: true, isMobile: engine === chromium } : {}) });
    await context.route('**/*', route => { const u = route.request().url(); return /^(http:\/\/127\.|blob:|data:)/.test(u) ? route.continue() : route.abort(); });
    return { context, page: await context.newPage() };
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
    await page.goto(`${origin}/index.html`);
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
    const cases = [['index.html', '#customWidth'], ['resume.html', '#fullName'], ['resume.html', '#summaryText'], ['compress-pdf.html', '#targetKbInput'], ['contact.html', 'input[type=text], input[type=email], textarea']];
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
    for (const file of ['index.html', 'resume.html', 'compress-pdf.html', 'signature-cleaner.html']) {
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
      await page.goto(`${origin}/index.html`);
      const g = await grid(page);
      const want = mode(width) === 'desktop' ? g.d : mode(width) === 'tablet' ? g.t : 1;
      ok(g.cols === want, `home @${width}: requirement grid has ${want} columns in ${mode(width)} mode (${g.cols})`);
      ok(g.widths.length === 1 && g.heights.length === 1, `home @${width}: requirement cards share one size (${g.widths} x ${g.heights})`);
      ok(g.clipped.length === 0, `home @${width}: no requirement label is clipped or hidden (${g.clipped})`);
      ok(g.inOrder, `home @${width}: requirements read in the same order on screen as in the page`);
      ok(!g.overflow && g.scrollers === 0 && !g.pageOverflow, `home @${width}: no sideways scrolling, in the grid or the page`);
      // Choose, fold to a summary, then reopen: the choice is kept and shown
      await page.locator('.choice[data-preset="passport"]').click();
      ok(await page.locator('#reqGrid').isHidden() && /350 × 450 px/.test(await page.locator('#reqSummarySpec').innerText()), `home @${width}: a choice folds into its summary`);
      const change = await page.locator('#btnChangeReq').boundingBox();
      ok(change && change.x >= 0 && change.x + change.width <= width, `home @${width}: Change is on screen`);
      await page.locator('#btnChangeReq').click();
      ok(await page.locator('.choice[data-preset="passport"]').getAttribute('aria-pressed') === 'true', `home @${width}: reopening shows the chosen requirement selected`);
      await page.keyboard.press('Escape');
      ok(await page.locator('#reqGrid').isHidden(), `home @${width}: Escape folds the list again`);
      // A file: task order top to bottom, the primary action on screen, nothing sideways
      await page.locator('#fileInput').setInputFiles({ name: 'p.png', mimeType: 'image/png', buffer: tiny });
      await page.waitForFunction(() => !document.getElementById('btnProcess').disabled);
      const order = await page.evaluate(() => ['reqPanel', 'fileInfoBox', 'cropperActiveArea', 'wsCustom'].map(id => { const el = document.getElementById(id); return el ? (el.id === 'wsCustom' ? el.previousElementSibling : el).getBoundingClientRect().top : -1; }));
      ok(order.every((v, i) => i === 0 || v > order[i - 1]), `home @${width}: requirement, file, editor, settings run top to bottom (${order.map(Math.round)})`);
      const action = await page.evaluate(() => { const r = document.getElementById('btnProcess').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth; });
      ok(action, `home @${width}: the primary action is on screen with a photo loaded`);
      ok(!await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), `home @${width}: no page overflow with a photo loaded`);
      // Crossing a breakpoint keeps the choice
      const across = width === 641 ? 639 : width === 1001 ? 999 : width === 639 ? 641 : width === 999 ? 1001 : null;
      if (across) {
        await page.setViewportSize({ width: across, height: 720 });
        ok(await page.locator('#presetSelect').inputValue() === 'passport' && /350 × 450 px/.test(await page.locator('#reqSummarySpec').innerText()), `home ${width}→${across}: the chosen requirement survives the layout change`);
      }
      // Header: a menu button on phones, the Tools menu inside the screen elsewhere
      await page.setViewportSize({ width, height: 720 });
      if (mode(width) === 'phone') {
        ok(await page.locator('#navMenuToggle').isVisible() && await page.locator('#toolsMenuButton').isHidden(), `@${width}: phones get the menu button`);
        await page.locator('#navMenuToggle').click();
        ok(await page.locator('#siteNav .menu__item').first().isVisible(), `@${width}: the menu sheet lists the tools`);
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
      await page.goto(`${origin}/index.html`);
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
      const image = async () => Buffer.from(await page.evaluate(() => {
        const c = document.createElement('canvas'); c.width = 900; c.height = 1100; const x = c.getContext('2d');
        const g = x.createLinearGradient(0, 0, 900, 1100); g.addColorStop(0, '#456'); g.addColorStop(1, '#dba');
        x.fillStyle = g; x.fillRect(0, 0, 900, 1100); x.fillStyle = '#fff'; x.beginPath(); x.arc(450, 450, 250, 0, 7); x.fill();
        return c.toDataURL('image/png').split(',')[1];
      }), 'base64');
      for (const [file, input, action, result] of [['index.html', '#fileInput', '#btnProcess', '#resultArea'], ['ssc-photo-signature-size.html', '#fileInput', '#btnProcess', '#resultArea'], ['hi/ssc-photo-signature-size.html', '#fileInput', '#btnProcess', '#resultArea']]) {
        await page.goto(`${origin}/${file}`); await setTheme();
        if (file === 'index.html') await choose(page, 'passport');
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
      const hindi = file.startsWith('hi/');
      const label = (await page.locator('#btnProcess').textContent()).trim();
      await page.locator('#fileInput').setInputFiles({ name: 'p.png', mimeType: 'image/png', buffer: await canvasPng() });
      await page.locator('#cropperActiveArea').waitFor({ state: 'visible' });
      ok(await page.locator('#dropzone').isHidden(), `${file}: the dropzone folds away once a file is chosen`);
      const before = await page.evaluate(() => { const i = document.getElementById('cropperActiveArea').getBoundingClientRect().top, b = document.getElementById('btnProcess').getBoundingClientRect().top; return i <= b; });
      ok(before, `${file}: the image appears above the Resize button`);
      ok((await page.locator('#btnProcess').textContent()).trim() === label || !hindi, `${file}: button label is not replaced by another language`);
      await page.locator('#btnProcess').click();
      await page.locator('#resultArea').waitFor({ state: 'visible' });
      await page.waitForFunction(() => document.getElementById('resultFileSize') && document.getElementById('resultFileSize').textContent.trim().length > 2);
      ok((await page.locator('#resultDims').innerText()).trim().length > 3, `${file}: result shows dimensions`);
      ok((await page.locator('#resultFileSize').innerText()).includes('KB'), `${file}: result shows file size`);
      ok(await page.locator('#btnProcess').isHidden() && await page.locator('#btnDownload').isVisible(), `${file}: once finished, Download replaces the Resize button`);
      if (hindi) ok(/[\u0900-\u097F]/.test(await page.locator('#btnProcess').textContent()), `${file}: Resize button stays in Hindi after processing`);
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

    // The home page asks what is being prepared before it will process, and says so under the action
    const { context, page } = await open(390, 844);
    await page.goto(`${origin}/index.html`);
    await page.locator('#fileInput').setInputFiles({ name: 'p.png', mimeType: 'image/png', buffer: await noisePng(page, 600, 800) });
    await page.locator('#cropperActiveArea:not(.hidden)').waitFor();
    const summary = async () => (await page.locator('#processSummary').innerText()).replace(/\s+/g, ' ').trim();
    ok(await page.locator('#btnProcess').isDisabled() && /Choose what you are preparing/.test(await summary()), `nothing is processed before a requirement is chosen (${await summary()})`);
    ok(await page.locator('.choice[aria-pressed="true"]').count() === 0, 'no requirement is preselected on the home page');
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

    // Exam page: the preset switch shows which preset is in use
    await page.goto(`${origin}/ssc-photo-signature-size.html`);
    ok(await page.locator('.choice[data-preset="ssc-photo"]').getAttribute('aria-pressed') === 'true', 'SSC photo preset is marked as selected on load');
    ok(/SSC photo/.test(await page.locator('#reqSummaryName').innerText()) && await page.locator('#reqGrid').isHidden(), 'the exam requirement arrives chosen, shown as a summary');
    await choose(page, 'ssc-signature');
    ok(await page.locator('.choice[data-preset="ssc-signature"]').getAttribute('aria-pressed') === 'true' && await page.locator('.choice[data-preset="ssc-photo"]').getAttribute('aria-pressed') === 'false', 'choosing the signature preset moves the selection');
    ok(await page.locator('.choice').count() === 3, 'an exam page offers only that exam\'s photo, signature and a custom size');

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
    // Start the drag clear of the screen edges, where dragging scrolls the page on purpose.
    await page.locator('.page-row').first().evaluate(el => el.scrollIntoView({ block: 'center' }));
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

    // Hindi pages: the result sentences are in Hindi
    await page.goto(`${origin}/hi/ssc-photo-signature-size.html`);
    await page.locator('#fileInput').setInputFiles({ name: 'p.png', mimeType: 'image/png', buffer: await pngOf(700, 900) });
    await page.waitForFunction(() => !document.getElementById('btnProcess').disabled);
    await page.locator('#btnProcess').click();
    await page.locator('#resultArea:not(.hidden)').waitFor();
    ok(/[\u0900-\u097F]/.test(await page.locator('#resultStatus').textContent()) && /[\u0900-\u097F]/.test(await page.locator('#resultTargetSize').textContent()), 'Hindi page: result status and limit are written in Hindi');
    await page.goto(`${origin}/hi/ssc-photo-signature-size.html`);
    await openSettings(page);
    await page.locator('#customWidth').fill('5');
    await page.locator('#customWidth').blur();
    await page.locator('#dimError').waitFor({ state: 'visible' });
    ok(/[\u0900-\u097F]/.test(await page.locator('#dimError').textContent()), 'Hindi page: a validation error is written in Hindi');
    await page.goto(`${origin}/hi/ssc-photo-signature-size.html`);
    await page.locator('#fileInput').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('not an image') });
    await page.locator('#processErrorBox').waitFor({ state: 'visible' });
    ok(/[\u0900-\u097F]/.test(await page.locator('#processErrorMessage').textContent()), 'Hindi page: a file error is written in Hindi');

    // Resizer, every setting open: the page scrolls normally (no inner scroll region), the sticky action
    // stays on screen, and the last setting can be scrolled clear of it.
    await page.goto(`${origin}/index.html`);
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
    for (const file of ['ssc-photo-signature-size.html', 'resize-image-to-20kb.html', 'hi/ibps-photo-signature-size.html']) {
      await page.goto(`${origin}/${file}`);
      const before = await page.evaluate(() => { const ws = document.getElementById('resizerApp').getBoundingClientRect().top; const prose = document.querySelector('main .prose'); return !prose || ws < prose.getBoundingClientRect().top; });
      ok(before, `${file}: the tool appears before the reference content`);
    }

    // Resume: fold an entry, Fix focuses the exact field even inside a folded entry
    await page.goto(`${origin}/resume.html`);
    await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
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
  console.log('✓ Rebuild interactions: PDF rotation, drag and keyboard reorder, stale results, focus, signature compare, Hindi results, no inner scrolling, tool order, entry folding, exact-field Fix, phone Download');

  await browser.close();
  server.close();
  console.log(`\n${checks} UI assertions passed.`);
})().catch(error => { console.error(error); process.exit(1); });
