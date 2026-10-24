#!/usr/bin/env node
/* Writes the shared shell (stylesheet links, header, footer, asset versions) into every HTML page.
   Run `node scripts/sync-shell.js` after changing scripts/lib/shell.js.
   `node scripts/sync-shell.js --check` exits 1 if any page differs, which tests/content_tests.js relies on. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { ASSET_VERSION, headerHTML, footerHTML, stylesheetLinks } = require('./lib/shell');

const root = path.resolve(__dirname, '..');
const check = process.argv.includes('--check');
const list = (dir, base = '') => fs.readdirSync(path.join(root, dir)).filter(f => f.endsWith('.html')).map(f => path.posix.join(base, f));
const pages = [...list('.'), ...list('guides', 'guides'), ...list('hi', 'hi'), ...list('author', 'author')];

const block = (name, body) => `  <!-- shell:${name}:start -->\n${body}\n  <!-- shell:${name}:end -->`;
const markers = name => new RegExp(`[ \\t]*<!-- shell:${name}:start -->[\\s\\S]*?<!-- shell:${name}:end -->`);

function sync(page, html) {
  const lang = (html.match(/<html lang="([a-z]+)"/) || [])[1] || 'en';
  const hadCropper = /cropper\.min\.css/.test(html) || /<!-- shell:styles:start -->[\s\S]*cropper\.min\.css/.test(html);
  const needsCropper = hadCropper;
  const needsDocument = page === 'resume.html';

  // 1. Stylesheets
  const styles = block('styles', stylesheetLinks(page, { cropper: needsCropper, document: needsDocument }));
  if (markers('styles').test(html)) html = html.replace(markers('styles'), styles);
  else {
    const re = /[ \t]*<link rel="stylesheet" href="[^"]*css\/(?:vendor\/icons\.min|vendor\/cropper\.min|style|workspace|app)\.css[^"]*">[ \t]*\r?\n?/g;
    let first = true;
    html = html.replace(re, () => { if (first) { first = false; return styles + '\n'; } return ''; });
    html = html.replace(/[ \t]*<!-- (?:Font Awesome Icons|Cropper\.js CSS|Custom Styles) -->[ \t]*\r?\n/g, '');
  }

  // 2. Header
  const header = block('header', headerHTML(page));
  if (markers('header').test(html)) html = html.replace(markers('header'), header);
  else {
    const start = html.search(/[ \t]*<a class="skip-link"/);
    const navStart = html.indexOf('<nav class="navbar"', start);
    const navEnd = html.indexOf('</nav>', navStart) + '</nav>'.length;
    if (start < 0 || navStart < 0) throw new Error(`${page}: header not found`);
    html = html.slice(0, start) + header + html.slice(navEnd);
  }

  // 3. Footer
  const footer = block('footer', footerHTML(page, lang));
  if (markers('footer').test(html)) html = html.replace(markers('footer'), footer);
  else {
    const fs_ = html.search(/[ \t]*<footer class="site-footer">/);
    const fe = html.indexOf('</footer>', fs_) + '</footer>'.length;
    if (fs_ < 0) throw new Error(`${page}: footer not found`);
    html = html.slice(0, fs_) + footer + html.slice(fe);
  }

  // 4. Asset versions on local scripts (root-relative pages must not use relative script paths)
  if (page === '404.html' || page === 'offline.html') html = html.replace(/src="js\//g, 'src="/js/');
  html = html.replace(/(src="(?:\.\.\/|\/)?js\/(?!vendor\/)[^"?]+\.js)(?:\?v=[^"]*)?"/g, `$1?v=${ASSET_VERSION}"`);
  return html;
}

let changed = 0;
for (const page of pages) {
  const file = path.join(root, page);
  const before = fs.readFileSync(file, 'utf8');
  const after = sync(page, before);
  if (after !== before) {
    changed++;
    if (check) console.error(`out of sync: ${page}`);
    else fs.writeFileSync(file, after);
  }
}
if (check) { if (changed) process.exit(1); console.log(`shell in sync on ${pages.length} pages`); }
else console.log(`shell written to ${changed} of ${pages.length} pages`);
