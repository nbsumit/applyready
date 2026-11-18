#!/usr/bin/env node
/* Navigation and search, without a browser:
   - site search finds the right page for the words people type (js/search.js on js/tool-index.js),
   - the header menu, home page and directory list the same categories with the same tools,
   - the footer lists each tool once, and every page is reachable from tools.html or the footer. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
let checks = 0;
const ok = (condition, message) => { assert(condition, message); checks++; };

// Load the generated index and the search code as the browser would.
const sandbox = { document: { readyState: 'complete', querySelectorAll: () => [] }, localStorage: { getItem: () => null } };
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(read('js/tool-index.js'), sandbox);
vm.runInContext(read('js/search.js'), sandbox);
const search = (q, n) => sandbox.ApplyReadySearch.search(q, n).map(i => i.id);
const rank = (q, id) => search(q, 50).indexOf(id);

const { CATEGORIES, TOOLS, PAGES, liveTools, toolsIn, presetsOf } = require('../scripts/lib/tools.js');

/* ---------------------------------------------------------------- Search */
// Every tool and page is found first by its own name.
for (const t of liveTools()) ok(search(t.name)[0] === t.id, `search: "${t.name}" finds ${t.id} first (got ${search(t.name)})`);
for (const p of PAGES) ok(search(p.name)[0] === 'page:' + p.id, `search: "${p.name}" finds the ${p.id} page first (got ${search(p.name)})`);

// Footer pages people look for by name.
for (const [q, id] of [['changelog', 'page:changelog'], ['your data', 'page:your-data'], ['delete my data', 'page:your-data'], ['how to use', 'page:how-to-use'],
  ['terms', 'page:terms'], ['feedback', 'page:feedback'], ['contribute', 'page:contribute'], ['philosophy', 'page:philosophy']]) {
  ok(search(q)[0] === id, `search: "${q}" finds ${id} first (got ${search(q)})`);
}

// "add" is not a synonym of merge: Add page numbers is not offered for joining files.
for (const q of ['join pdf', 'merge', 'merge pdf', 'combine pdf', 'combine certificates']) ok(!search(q).includes('page-numbers'), `search: "${q}" does not offer Add page numbers (${search(q)})`);
ok(search('combine certificates').slice(0, 2).sort().join() === 'image-to-pdf,merge-pdf', `search: "combine certificates" offers Merge PDF and Image to PDF first (${search('combine certificates')})`);
ok(search('add page numbers')[0] === 'page-numbers', 'search: "add page numbers" still finds the tool');

// "X to Y" asks for one direction of conversion.
for (const q of ['word to pdf', 'docx to pdf', 'doc to pdf', 'convert word to pdf']) {
  ok(search(q)[0] === 'page:word-to-pdf', `search: "${q}" explains how to export from Word first (${search(q)})`);
  ok(!search(q).includes('resume'), `search: "${q}" does not suggest the resume builder converts Word files`);
}
// A conversion nothing here does still gets the nearest honest answer, not an empty list.
for (const q of ['pdf to word', 'pdf to docx', 'convert pdf to word']) ok(search(q)[0] === 'pdf-to-text', `search: "${q}" offers Extract text from PDF (${search(q)})`);
for (const q of ['excel to pdf', 'xlsx to pdf', 'powerpoint to pdf', 'ppt to pdf']) ok(search(q)[0] === 'page:word-to-pdf', `search: "${q}" explains how to export a PDF (${search(q)})`);
ok(search('pdf to jpg').join() === 'pdf-to-image', `search: "pdf to jpg" offers PDF to images only, not Image to PDF or File checker (${search('pdf to jpg')})`);
ok(search('jpg to pdf')[0] === 'image-to-pdf' && !search('jpg to pdf').includes('pdf-to-image'), `search: "jpg to pdf" offers Image to PDF (${search('jpg to pdf')})`);
ok(search('png to jpg')[0] === 'convert-image', 'search: "png to jpg" offers the image converter');
ok(search('text to pdf')[0] === 'text-to-pdf' && search('pdf to text')[0] === 'pdf-to-text', 'search: text to PDF and PDF to text go to opposite tools');
ok(search('how to resize photo').includes('image-resizer'), 'search: "how to" is not read as a conversion');

// Typing mistakes, including two letters swapped.
for (const [q, id] of [['mrege pdf', 'merge-pdf'], ['resise image', 'image-resizer'], ['compres pdf', 'compress-pdf'], ['sigature', 'signature-cleaner'], ['pasport photo', 'passport-photo'], ['wtaermark', 'watermark-pdf']]) {
  ok(search(q)[0] === id, `search: "${q}" finds ${id} first (got ${search(q)})`);
}
ok(search('merg')[0] === 'merge-pdf', 'search: a word still being typed matches as a prefix');

// Broad words put the everyday tool near the top, and closer names first.
ok(search('photo')[0] === 'image-resizer' && search('image')[0] === 'image-resizer', `search: "photo" and "image" list the image resizer first (${search('photo')})`);
ok(search('pdf')[0] === 'merge-pdf', `search: "pdf" lists the most used PDF tool first (${search('pdf')})`);
ok(rank('photo', 'passport-photo') < rank('photo', 'passport-print'), 'search: "photo" ranks the passport photo resizer above the print sheet');
ok(search('photo size')[0] === 'image-resizer' && rank('photo size', 'passport-photo') < rank('photo size', 'passport-print'), `search: "photo size" ranks the resizers first (${search('photo size')})`);
ok(search('cv')[0] === 'resume' && search('resume')[0] === 'resume', 'search: "cv" and "resume" open the resume builder first');

// KB limits: the preset page first, and the directory can map it to its parent card.
for (const [q, id] of [['50kb', 'resize-50kb'], ['50 kb', 'resize-50kb'], ['20 kb', 'resize-20kb'], ['photo under 50 kb', 'resize-50kb'], ['10kb', 'resize-kb']]) ok(search(q)[0] === id, `search: "${q}" finds ${id} first (got ${search(q)})`);
// A size limit typed with the file type is a search for the tool that makes files smaller, not for
// the most popular tool of that type ("pdf 300kb" once opened Merge PDF on Enter).
for (const [q, id] of [['pdf 300kb', 'compress-pdf'], ['pdf 2 mb', 'compress-pdf'], ['200kb pdf', 'compress-pdf'], ['pdf 100 kb', 'compress-pdf'], ['pdf under 1.5mb', 'compress-pdf'],
  ['signature 10kb', 'signature-resizer'], ['signature 15 kb', 'signature-resizer']]) ok(search(q)[0] === id, `search: "${q}" finds ${id} first (got ${search(q)})`);
for (const q of ['photo 30kb', 'photo 40 kb', 'image 75kb']) ok(['image-resizer', 'compress-image', 'resize-kb'].includes(search(q)[0]), `search: "${q}" offers a tool that reaches a KB limit first (got ${search(q)})`);
ok(search('photo under 50 kb')[0] === 'resize-50kb', 'search: a size that has its own page still finds that page first');
// Common Hinglish words, and a few words typed in Devanagari.
for (const [q, id] of [['pdf chota karna', 'compress-pdf'], ['pdf ko chota', 'compress-pdf'], ['pdf size kam karna', 'compress-pdf'], ['pdf jodna', 'merge-pdf'], ['pdf milana', 'merge-pdf'],
  ['photo chhota karna', 'compress-image'], ['पीडीएफ छोटा', 'compress-pdf'], ['फोटो', 'image-resizer']]) ok(search(q)[0] === id, `search: "${q}" finds ${id} first (got ${search(q)})`);
ok(!search('pdf jodna').includes('resume') && search('pdf jodna').length <= 6, `search: "pdf jodna" offers the merging tools, not every PDF tool (${search('pdf jodna')})`);
// Words applicants type for things the site does, and no confident wrong guess for things it does not.
for (const [q, id] of [['thumb impression', 'signature-resizer'], ['left thumb', 'signature-resizer'], ['backup', 'page:your-data'], ['offline', 'page:your-data'], ['clear history', 'page:your-data']]) ok(search(q)[0] === id, `search: "${q}" finds ${id} first (got ${search(q)})`);
ok(search('backup').includes('guide:how-to-back-up-and-restore-resumes'), 'search: "backup" also offers the backup guide');
for (const q of ['marksheet', 'aadhaar']) ok(['image-to-pdf', 'compress-pdf'].includes(search(q)[0]), `search: "${q}" offers a PDF tool (${search(q)})`);
for (const q of ['dark mode', 'mode']) ok(!search(q).includes('organize-pdf'), `search: "${q}" is not corrected to "move" (${search(q)})`);
// The home row and the empty search dialog do not suggest that use is measured.
ok(/id="homePopularTitle">Common tasks</.test(read('index.html')) && !/Popular tools|Most used/.test(read('index.html') + read('js/search.js')), 'home and search: the hand-picked list is not called "most used" or "popular"');
const index = sandbox.APPLYREADY_TOOL_INDEX.items;
for (const t of TOOLS.filter(t => t.presetOf)) ok(index.find(i => i.id === t.id).presetOf === t.presetOf, `index: ${t.id} names its parent tool`);

// Every icon search draws is in the icon subset.
const iconCss = read('css/vendor/icons.min.css');
for (const i of [...CATEGORIES, ...index]) if (i.icon) ok(iconCss.includes(`.fa-${i.icon}:before`), `icon subset includes fa-${i.icon} for ${i.id || i.name}`);

/* ------------------------------------------------------- Tool listings */
const between = (html, a, b) => { const i = html.indexOf(a); return i < 0 ? '' : html.slice(i, html.indexOf(b, i)); };
const home = read('index.html');
const dir = read('tools.html');
const header = between(read('merge-pdf.html'), '<header class="site-header"', '</header>');
const footer = between(read('merge-pdf.html'), '<footer class="site-footer"', '</footer>');
const listed = CATEGORIES.filter(c => toolsIn(c.id).length);

// Same category order everywhere.
const order = (html, re) => [...html.matchAll(re)].map(m => m[1]);
const ids = listed.map(c => c.id).join();
ok(order(header, /<ul class="menu__list" id="menuList-([a-z]+)"/g).join() === ids, `menu: categories in registry order (${order(header, /<ul class="menu__list" id="menuList-([a-z]+)"/g)})`);
ok(order(home, /<li class="cat-card" id="home-([a-z]+)"/g).join() === ids, 'home: categories in registry order');
ok(order(dir, /<section class="dir-section" id="([a-z]+)"/g).join() === ids, 'directory: categories in registry order');

// Same tools in each category, in the same order (home shows the first four).
for (const c of listed) {
  const want = toolsIn(c.id).map(t => t.path);
  const inMenu = [...between(header, `id="menuList-${c.id}"`, '</ul>').matchAll(/class="menu__item" href="\.?\.?\/?([^"]+)"/g)].map(m => m[1]);
  const inDir = [...between(dir, `<section class="dir-section" id="${c.id}"`, '</section>').matchAll(/<a class="tool-card__link" href="([^"]+)"/g)].map(m => m[1]);
  const card = home.slice(home.indexOf(`id="home-${c.id}"`));
  const inHome = [...between(card, '<ul class="cat-card__tools">', '</ul>').matchAll(/<li><a href="([^"]+)">/g)].map(m => m[1]);
  ok(inMenu.join() === want.join(), `menu: ${c.name} lists ${want} (got ${inMenu})`);
  ok(inDir.join() === want.join(), `directory: ${c.name} lists ${want} (got ${inDir})`);
  ok(inHome.join() === want.slice(0, 4).join(), `home: ${c.name} starts with ${want.slice(0, 4)} (got ${inHome})`);
}
// Every live tool is in the directory: a tool as a card, a preset page as a link on its parent's card.
for (const t of liveTools()) {
  if (t.presetOf) ok(between(dir, `data-tool="${t.presetOf}"`, '</li>').includes(`href="${t.path}" data-tool="${t.id}"`), `directory: ${t.path} is linked on the ${t.presetOf} card`);
  else ok(dir.includes(`<li class="tool-card" data-tool="${t.id}">`) || dir.includes(`<li class="tool-card tool-card--presets" data-tool="${t.id}">`), `directory: ${t.id} has a card`);
}
ok(presetsOf('image-resizer').length === 3, 'registry: the image resizer has its three KB pages');
// The KB pages are linked from the tools people use for KB limits.
for (const f of ['image-resizer.html', 'compress-image.html', 'passport-photo-resizer.html', 'signature-resizer.html']) {
  const main = between(read(f), '<main', '</main>');
  ok(main.includes('href="resize-image-to-50kb.html"') && main.includes('href="resize-image-to-kb-limit.html"'), `${f}: links the KB limit pages in its text`);
}

// Footer: each tool once, under its own category; one hidden heading instead of four.
const footerLinks = [...footer.matchAll(/<li><a href="([^"]+)">/g)].map(m => m[1].replace(/^\.\.\//, ''));
for (const t of liveTools().filter(t => !t.presetOf)) ok(footerLinks.filter(p => p === t.path).length === 1, `footer: ${t.name} is listed once`);
ok((footer.match(/<h2/g) || []).length === 1 && footer.includes('<h2 class="sr-only">Site links</h2>'), 'footer: one visually hidden heading, column titles are not headings');

// Phone menu: the Resume builder link is not shown twice, and the page's own category starts open.
ok(/<li class="site-nav__resume">/.test(header), 'menu: the top-level Resume builder link is marked so the phone sheet can hide it');
ok(/<div class="menu__cat" data-open>\s*<p class="menu__title"><a href="tools\.html#pdf">/.test(header), 'menu: on a PDF tool the PDF category starts open in the phone sheet');
ok(!/data-open/.test(between(home, '<header class="site-header"', '</header>')), 'menu: on the home page every category starts closed');
// A category with one tool is a direct link in the phone sheet, not a toggle that reveals one link.
for (const c of listed) {
  const single = toolsIn(c.id).length === 1;
  ok(header.includes(`aria-controls="menuList-${c.id}"`) === !single, `menu: ${c.name} ${single ? 'has no toggle (one tool)' : 'opens with a toggle'}`);
  if (single) ok(new RegExp(`<div class="menu__cat menu__cat--single">\\s*<p class="menu__title"><a href="tools\\.html#${c.id}">`).test(header), `menu: ${c.name} is marked as a single-tool category`);
}
ok(/\.menu__cat\.menu__cat--single \.menu__list \{ display: block;/.test(read('css/app.css')), 'menu: the phone sheet shows a single-tool category’s link without a tap');
// On the resume builder no category starts open (Resume has no toggle).
ok(!/data-open/.test(between(read('resume.html'), '<header class="site-header"', '</header>')), 'menu: on the resume builder no category is forced open');
// DOM order of the header: brand, then the sheet (search first), then the header buttons.
ok(header.indexOf('id="navSearch"') < header.indexOf('id="toolsMenuButton"') && header.indexOf('id="toolsMenuButton"') < header.indexOf('id="searchOpen"'), 'menu: the sheet starts with Search tools');

console.log(`✓ navigation and search: ${checks} checks passed`);
