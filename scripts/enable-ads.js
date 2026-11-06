#!/usr/bin/env node
/* Turns the reserved ad slots into live AdSense units, or back into placeholders.
   Run it only after AdSense has approved the site and you have created ad units.
   Do not enable Auto ads. Anchor, vignette and interstitial formats stay off.

     node scripts/enable-ads.js --slot 1234567890
     node scripts/enable-ads.js --slot 1234567890 --tool-slot 2345678901
     node scripts/enable-ads.js --off
     node scripts/enable-ads.js --check
*/
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const opt = name => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : null; };
const flag = name => args.includes('--' + name);

const list = (dir, base = '') => fs.existsSync(path.join(root, dir))
  ? fs.readdirSync(path.join(root, dir)).filter(f => f.endsWith('.html')).map(f => path.posix.join(base, f)) : [];
const pages = [...list('.'), ...list('guides', 'guides'), ...list('hi', 'hi'), ...list('author', 'author')];
const isTool = f => !f.startsWith('guides/') && !f.startsWith('author/');

const SLOT = /(<aside class="ad-slot-container"[^>]*>\s*<div class="ad-slot-inner">\s*<span class="ad-slot-label">Advertisements<\/span>)([\s\S]*?)(\s*<\/div>\s*<\/aside>)/g;
const LIVE = /<ins class="adsbygoogle"[\s\S]*?<\/ins>/;

const unit = (client, slot) => `\n        <ins class="adsbygoogle" data-ad-client="${client}" data-ad-slot="${slot}" data-ad-format="auto" data-full-width-responsive="true"></ins>`;

let live = 0, off = 0, touched = 0;
for (const f of pages) {
  const file = path.join(root, f);
  const html = fs.readFileSync(file, 'utf8');
  const client = (html.match(/google-adsense-account" content="(ca-pub-\d+)"/) || [])[1];
  if (!client || !/ad-slot-container/.test(html)) continue;
  const slot = isTool(f) ? (opt('tool-slot') || opt('slot')) : (opt('guide-slot') || opt('slot'));
  const out = html.replace(SLOT, (all, head, body, tail) => {
    if (flag('check')) { if (LIVE.test(body)) live++; else off++; return all; }
    if (flag('off')) { off++; return head + tail; }
    if (!slot) throw new Error('Pass --slot <ad unit id> (the number in data-ad-slot).');
    if (!/^\d{6,}$/.test(slot)) throw new Error('"' + slot + '" is not an ad unit id (digits only).');
    live++;
    return head + unit(client, slot) + tail;
  });
  if (out !== html) { fs.writeFileSync(file, out); touched++; }
}
console.log(flag('check') ? live + ' live slots, ' + off + ' placeholders' : flag('off') ? 'placeholders restored on ' + touched + ' pages' : live + ' slots are live on ' + touched + ' pages');
