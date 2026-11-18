/* Guide images and step-by-step tutorials. No browser needed.

   - Every <img> on a guide page points at a file that exists, has width, height and alt text, and
     loads lazily; a screenshot from img/guides/ has the width and height recorded in the manifest.
   - Every page that shows a screenshot from img/guides/ (tool pages too) uses the manifest's size.
   - Every screenshot in img/guides/manifest.json exists, is a WebP whose real pixel size and byte
     count match the manifest, stays within the size budget, and is shown by at least one page;
     every WebP in img/guides/ is listed in the manifest.
   - Every step-by-step tutorial has the sections a reader relies on and is listed in the guides hub.
   Screenshots are made by scripts/guide-screenshots.js, which also writes the manifest. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
let checks = 0;
const failures = [];
const ok = (c, m) => { checks++; if (!c) failures.push(m); };

const list = (dir, base = '') => fs.readdirSync(path.join(root, dir)).filter(f => f.endsWith('.html')).map(f => path.posix.join(base, f));
const pages = [...list('.'), ...list('guides', 'guides')];
const guides = list('guides', 'guides');
const manifest = JSON.parse(read('img/guides/manifest.json'));
const attr = (tag, name) => (tag.match(new RegExp(`\\s${name}="([^"]*)"`)) || [])[1];

/* Pixel size from a WebP file's header (lossy VP8, lossless VP8L or extended VP8X). */
function webpSize(buf) {
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WEBP') return null;
  const chunk = buf.toString('ascii', 12, 16);
  if (chunk === 'VP8 ') return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
  if (chunk === 'VP8L') { const b = buf.readUInt32LE(21); return { width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 }; }
  if (chunk === 'VP8X') return { width: buf.readUIntLE(24, 3) + 1, height: buf.readUIntLE(27, 3) + 1 };
  return null;
}

// 1. Images on guide pages
for (const f of guides) {
  const html = read(f);
  for (const tag of html.match(/<img\b[^>]*>/g) || []) {
    const src = attr(tag, 'src') || '';
    if (/^(https?:|data:)/.test(src)) { ok(false, `${f}: images come from this site (${src.slice(0, 40)})`); continue; }
    const target = path.posix.normalize(path.posix.join('guides', src));
    if (target.startsWith('favicon/')) continue; // the brand mark in the shared header and footer
    ok(fs.existsSync(path.join(root, target)), `${f}: image ${src} exists`);
    ok(/^\d+$/.test(attr(tag, 'width') || '') && /^\d+$/.test(attr(tag, 'height') || ''), `${f}: ${src} has width and height`);
    ok((attr(tag, 'alt') || '').length >= 20, `${f}: ${src} has descriptive alt text`);
    ok(attr(tag, 'loading') === 'lazy', `${f}: ${src} loads lazily`);
  }
}

// 2. Every page that shows a screenshot uses the size in the manifest
const shown = new Map();
for (const f of pages) {
  const html = read(f);
  for (const tag of html.match(/<img\b[^>]*\bsrc="(?:\.\.\/)?img\/guides\/[^"]+"[^>]*>/g) || []) {
    const name = (attr(tag, 'src').match(/img\/guides\/([a-z0-9-]+)\.webp$/) || [])[1];
    const m = name && manifest[name];
    ok(!!m, `${f}: ${attr(tag, 'src')} is listed in img/guides/manifest.json`);
    if (!m) continue;
    if (!shown.has(name)) shown.set(name, []);
    shown.get(name).push(f);
    ok(Number(attr(tag, 'width')) === m.width && Number(attr(tag, 'height')) === m.height, `${f}: ${name}.webp is shown at ${attr(tag, 'width')} × ${attr(tag, 'height')}, the manifest says ${m.width} × ${m.height} (run scripts/guide-screenshots.js, which updates pages)`);
  }
}

// 3. The manifest matches the files, and every screenshot is used
const BUDGET = 120 * 1024; // most are far smaller; a full builder view with the preview is the largest
for (const [name, m] of Object.entries(manifest)) {
  const file = path.join(root, m.file || '');
  ok(m.file === `img/guides/${name}.webp`, `manifest: ${name} points at img/guides/${name}.webp`);
  if (!fs.existsSync(file)) { ok(false, `manifest: ${m.file} exists`); continue; }
  const buf = fs.readFileSync(file);
  const size = webpSize(buf);
  ok(size && size.width === m.width && size.height === m.height, `${m.file}: real size ${size && `${size.width} × ${size.height}`} matches the manifest (${m.width} × ${m.height})`);
  ok(buf.length === m.bytes, `${m.file}: ${buf.length} bytes, the manifest says ${m.bytes}`);
  ok(buf.length <= BUDGET, `${m.file}: ${(buf.length / 1024).toFixed(1)} KB is within the ${BUDGET / 1024} KB budget`);
  ok(typeof m.alt === 'string' && m.alt.length >= 20, `manifest: ${name} has alt text`);
  ok(shown.has(name), `${m.file}: shown by at least one page (it is in the manifest but no page uses it)`);
}
for (const f of fs.readdirSync(path.join(root, 'img/guides')).filter(f => f.endsWith('.webp'))) {
  ok(!!manifest[f.replace(/\.webp$/, '')], `img/guides/${f}: listed in the manifest`);
}

// 4. Step-by-step tutorials: the parts a reader relies on, and a place in the hub
const hub = read('guides/index.html');
const tutorialsGroup = (hub.match(/<h2 id="tutorialsHeading">[\s\S]*?<\/section>/) || [''])[0];
const tutorials = guides.filter(f => /<span class="eyebrow">Step-by-step tutorial<\/span>/.test(read(f)));
ok(tutorials.length >= 9, `at least nine step-by-step tutorials (found ${tutorials.length})`);
for (const f of tutorials) {
  const html = read(f);
  const main = (html.match(/<main[\s\S]*?<\/main>/) || [''])[0];
  for (const heading of ['Before you start', 'What you get', 'If something goes wrong']) ok(main.includes(`<h2>${heading}</h2>`), `${f}: has a "${heading}" section`);
  ok(/<h2>Step 1: /.test(main) && /<h2>Step 2: /.test(main), `${f}: numbered steps`);
  ok((main.match(/<figure class="shot">\s*(?:<a class="shot__full" href="\.\.\/img\/guides\/[^"]+">)?<img src="\.\.\/img\/guides\//g) || []).length >= 2, `${f}: at least two screenshots from the tools`);
  for (const m of main.matchAll(/<a class="shot__full" href="([^"]+)"><img src="([^"]+)"/g)) ok(m[1] === m[2], `${f}: the full-size link opens the same image (${m[1]})`);
  ok(tutorialsGroup.includes(`href="${path.posix.basename(f)}"`), `${f}: listed under Step-by-step tutorials in guides/index.html`);
}

if (failures.length) {
  console.error(`✗ ${failures.length} of ${checks} guide checks failed:`);
  for (const m of failures) console.error('  - ' + m);
  process.exit(1);
}
console.log(`✓ guide images and tutorials: ${Object.keys(manifest).length} screenshots, ${tutorials.length} tutorials (${checks} assertions)`);
