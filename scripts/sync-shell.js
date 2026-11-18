#!/usr/bin/env node
/* Writes the shared shell (stylesheet links, header, footer, social tags, asset versions) into every HTML page.
   Run `node scripts/sync-shell.js` after changing scripts/lib/shell.js.
   `node scripts/sync-shell.js --check` exits 1 if any page differs, which tests/content_tests.js relies on. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { ASSET_VERSION, headerHTML, footerHTML, stylesheetLinks, cspMeta } = require('./lib/shell');
const { syncSocial } = require('./lib/social');

const root = path.resolve(__dirname, '..');
const check = process.argv.includes('--check');
const list = (dir, base = '') => fs.existsSync(path.join(root, dir)) ? fs.readdirSync(path.join(root, dir)).filter(f => f.endsWith('.html')).map(f => path.posix.join(base, f)) : [];
// Every directory that holds pages. A new directory must be added here, in build-sitemap.js and in the tests.
const PAGE_DIRS = ['.', 'guides'];
const pages = PAGE_DIRS.flatMap(dir => list(dir, dir === '.' ? '' : dir));

const block = (name, body) => `  <!-- shell:${name}:start -->\n${body}\n  <!-- shell:${name}:end -->`;
const markers = name => new RegExp(`[ \\t]*<!-- shell:${name}:start -->[\\s\\S]*?<!-- shell:${name}:end -->`);

// The CSP meta only governs what comes after it, so it must precede every script and stylesheet.
function placeCspFirst(html) {
  const re = markers('csp');
  const m = html.match(re);
  if (!m) return html;
  const firstScript = html.search(/<script\b|<link rel="stylesheet"/);
  if (firstScript < 0 || html.indexOf(m[0]) < firstScript) return html;
  html = html.replace(re, '').replace(/\n[ \t]*\n([ \t]*\n)+/g, '\n\n');
  return html.replace(/(<meta name="viewport"[^>]*>)/, `$1\n${block('csp', '')}`);
}

// Browser UI colour follows the theme tokens (--c-surface), light and dark.
const THEME_COLOR = '<meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)">\n  <meta name="theme-color" content="#1a1a19" media="(prefers-color-scheme: dark)">';

function sync(page, html) {
  html = placeCspFirst(html);
  // Social preview tags follow the page's own title, description and canonical URL.
  html = syncSocial(html);
  html = html.replace(/<meta name="theme-color"[^>]*>(\s*<meta name="theme-color"[^>]*>)?/, THEME_COLOR);
  const parts = {
    styles: stylesheetLinks(page, { cropper: /cropper\.min\.(css|js)/.test(html), document: page === 'resume.html' }),
    header: headerHTML(page),
    footer: footerHTML(page),
    csp: cspMeta(page)
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

// The search index lists tools and guides, so it is rebuilt whenever the shell is.
const indexChanged = require('./build-tool-index').run(check);
let changed = indexChanged ? 1 : 0;
if (check && indexChanged) console.error('out of sync: js/tool-index.js');
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
// The service worker's precache list and cache name come last: they hash the pages just written.
if (require('./build-sw').run(check)) { changed++; if (check) console.error('out of sync: sw.js'); }
if (check) { if (changed) process.exit(1); console.log(`shell in sync on ${pages.length} pages`); }
else console.log(`shell written to ${changed} of ${pages.length} pages`);
