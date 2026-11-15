#!/usr/bin/env node
/* Writes the shared shell (stylesheet links, header, footer, asset versions) into every HTML page.
   Run `node scripts/sync-shell.js` after changing scripts/lib/shell.js.
   `node scripts/sync-shell.js --check` exits 1 if any page differs, which tests/content_tests.js relies on. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { ASSET_VERSION, headerHTML, footerHTML, stylesheetLinks, cspMeta } = require('./lib/shell');

const root = path.resolve(__dirname, '..');
const check = process.argv.includes('--check');
const list = (dir, base = '') => fs.existsSync(path.join(root, dir)) ? fs.readdirSync(path.join(root, dir)).filter(f => f.endsWith('.html')).map(f => path.posix.join(base, f)) : [];
const pages = [...list('.'), ...list('guides', 'guides'), ...list('hi', 'hi'), ...list('author', 'author')];

const block = (name, body) => `  <!-- shell:${name}:start -->\n${body}\n  <!-- shell:${name}:end -->`;
const markers = name => new RegExp(`[ \\t]*<!-- shell:${name}:start -->[\\s\\S]*?<!-- shell:${name}:end -->`);

function sync(page, html) {
  const lang = (html.match(/<html lang="([a-z]+)"/) || [])[1] || 'en';
  const parts = {
    styles: stylesheetLinks(page, { cropper: /cropper\.min\.css/.test(html), document: page === 'resume.html' }),
    header: headerHTML(page),
    footer: footerHTML(page, lang),
    csp: cspMeta()
  };
  for (const [name, body] of Object.entries(parts)) {
    // Every page carries the four marker pairs. A new page copies them from an existing one.
    if (!markers(name).test(html)) throw new Error(`${page}: missing <!-- shell:${name}:start --> / <!-- shell:${name}:end --> markers`);
    html = html.replace(markers(name), block(name, body));
  }

  // Asset versions on local scripts (root-relative pages must not use relative script paths)
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
