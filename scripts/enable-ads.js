#!/usr/bin/env node
/* Turns the reserved ad slots into live AdSense units, or back into placeholders.
   Run it only after AdSense has approved the site and you have created ad units.

     node scripts/enable-ads.js --slot 1234567890            one unit id for every slot
     node scripts/enable-ads.js --slot 1234567890 --tool-slot 2345678901
                                                              a different unit for tool and exam pages
     node scripts/enable-ads.js --off                         back to placeholders (undo)
     node scripts/enable-ads.js --check                       list what is live and where

   Slots live only on guides, exam pages, KB pages and the tool landing pages, always between content
   sections and never next to a button. The client id is read from the AdSense loader already on the page. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const opt = name => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : null; };
const flag = name => args.includes('--' + name);

const list = (dir, base = '') => fs.readdirSync(path.join(root, dir)).filter(f => f.endsWith('.html')).map(f => path.posix.join(base, f));
const pages = [...list('.'), ...list('guides', 'guides'), ...list('hi', 'hi')];
const isTool = f => !f.startsWith('guides/');

const SLOT = /(<div class="ad-slot-container[^"]*"[^>]*>\s*<div class="ad-slot-inner">\s*<span class="ad-slot-label">Advertisement<\/span>\s*)([\s\S]*?)(\s*<\/div>\s*<\/div>)/g;
const LIVE = /<ins class="adsbygoogle"[\s\S]*?<\/ins>\s*<script>\(adsbygoogle = window\.adsbygoogle \|\| \[\]\)\.push\(\{\}\);<\/script>/;

const unit = (client, slot) => `<ins class="adsbygoogle" data-ad-client="${client}" data-ad-slot="${slot}" data-ad-format="auto" data-full-width-responsive="true"></ins>
          <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>`;

let live = 0, off = 0, touched = 0;
for (const f of pages) {
  const file = path.join(root, f);
  const html = fs.readFileSync(file, 'utf8');
  const client = (html.match(/google-adsense-account" content="(ca-pub-\d+)"/) || [])[1];
  if (!client || !/ad-slot-container/.test(html)) continue;
  const slot = isTool(f) ? (opt('tool-slot') || opt('slot')) : (opt('guide-slot') || opt('slot'));
  const out = html.replace(SLOT, (all, head, body, tail) => {
    if (flag('check')) { if (LIVE.test(body)) live++; else off++; return all; }
    if (flag('off')) { off++; return head + '<!-- AdSense Unit: In-Article -->' + tail; }
    if (!slot) throw new Error('Pass --slot <ad unit id> (the number in data-ad-slot).');
    if (!/^\d{6,}$/.test(slot)) throw new Error(`"${slot}" is not an ad unit id (digits only).`);
    live++;
    return head + unit(client, slot) + tail;
  });
  if (out !== html) { fs.writeFileSync(file, out); touched++; }
}
console.log(flag('check') ? `${live} live slots, ${off} placeholders` : flag('off') ? `placeholders restored on ${touched} pages` : `${live} slots are live on ${touched} pages`);
