#!/usr/bin/env node
/* Draws assets/social-card.png, the 1200 × 630 preview image that links to ApplyReady show when
   they are shared. It is drawn by the browser from the site's own stylesheet, fonts and icons, so it
   matches the site. Every page uses this one image; its text description is CARD_ALT in
   scripts/lib/social.js, so change both together. No counts or claims that can go out of date.

     BROWSER_EXECUTABLE_PATH=/path/to/chromium node scripts/make-social-card.js

   Needs the Playwright dev dependency (npm ci). Nothing is fetched from the network. */
'use strict';
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const OUT = path.join(root, 'assets/social-card.png');
const MIME = { '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.html': 'text/html' };

const tile = (icon, name, text) => `<div class="tile"><span class="tile__icon"><i class="fa-solid fa-${icon}" aria-hidden="true"></i></span><span><strong>${name}</strong><span>${text}</span></span></div>`;

const CARD = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<link rel="stylesheet" href="/css/vendor/icons.min.css"><link rel="stylesheet" href="/css/app.css">
<style>
  html, body { margin: 0; width: 1200px; height: 630px; overflow: hidden; background: var(--c-bg); }
  .card { box-sizing: border-box; width: 1200px; height: 630px; padding: 56px 64px; display: flex; flex-direction: column; font-family: Inter, sans-serif; color: var(--c-text); }
  .top { display: flex; align-items: center; justify-content: space-between; }
  .brand { display: flex; align-items: center; }
  .brand img { display: block; width: auto; height: 48px; }
  .site { font-size: 22px; color: var(--c-text-3); }
  h1 { margin: 48px 0 0; font-size: 72px; line-height: 1.05; letter-spacing: -0.035em; font-weight: 750; }
  h1 em { font-style: normal; color: var(--c-accent); }
  .lede { margin: 20px 0 0; font-size: 28px; line-height: 1.4; color: var(--c-text-2); }
  .tiles { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-top: auto; }
  .tile { display: flex; flex-direction: column; align-items: flex-start; gap: 16px; padding: 22px 24px; background: var(--c-surface); border: 1px solid var(--c-line-strong); border-radius: 14px; }
  .tile__icon { flex: none; display: grid; place-items: center; width: 52px; height: 52px; border-radius: 12px; background: var(--c-accent-soft); color: var(--c-accent); }
  .tile__icon .fa-solid { font-size: 24px; }
  .tile strong { display: block; font-size: 23px; font-weight: 650; }
  .tile span span { display: block; margin-top: 2px; font-size: 18px; color: var(--c-text-3); }
</style></head>
<body><div class="card">
  <div class="top"><div class="brand"><img src="/img/brand/applyready-logo-black.svg" alt="ApplyReady"></div><div class="site">applyready.in</div></div>
  <h1>Free tools for <em>job applications</em></h1>
  <p class="lede">Everything runs in your browser. Your files are never uploaded.<br>No sign-up, no ads, open source.</p>
  <div class="tiles">
    ${tile('file-lines', 'Resume builder', 'PDF and Word downloads')}
    ${tile('crop-simple', 'Photos and signatures', 'Exact pixels and KB limit')}
    ${tile('file-pdf', 'PDF tools', 'Merge, split, compress')}
  </div>
</div></body></html>`;

const server = http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/__card.html') { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(CARD); return; }
  const file = path.join(root, p);
  if (!file.startsWith(root) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const exe = process.env.BROWSER_EXECUTABLE_PATH;
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'], ...(exe ? { executablePath: exe } : {}) });
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1, colorScheme: 'light' });
    // Font loading is "optional" on the site; here the card waits for Inter so the image never uses the fallback.
    await page.goto(`http://127.0.0.1:${server.address().port}/__card.html`);
    await page.evaluate(() => document.fonts.load('700 72px Inter').then(() => document.fonts.ready));
    const inter = await page.evaluate(() => document.fonts.check('700 72px Inter'));
    if (!inter) throw new Error('Inter did not load; the card would use a fallback font');
    await page.screenshot({ path: OUT, clip: { x: 0, y: 0, width: 1200, height: 630 } });
    console.log(`written ${path.relative(root, OUT)} (${fs.statSync(OUT).size} bytes)`);
  } finally {
    await browser.close();
    server.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
