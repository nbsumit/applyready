#!/usr/bin/env node
/* Scaffold a new page with the shared head, shell markers and metadata.

   node scripts/new-page.js <path> "<Title>" "<Meta description, 50-330 characters>" [--cropper] [--force]

   The file is written once; edit its <main> by hand afterwards. Run `node scripts/sync-shell.js`
   to fill in the header, footer, stylesheets and Content Security Policy.
   Exported as a function so other build scripts can create pages the same way. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { socialBlock } = require('./lib/social');

const ROOT = path.resolve(__dirname, '..');
const SITE = 'https://applyready.in/';
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Full HTML for a page. `main` is the inner HTML of <main>; `scripts` are paths relative to the root. */
function pageHTML({ page, title, description, main = '', scripts = [], jsonld = null, bodyClass = '', robots, moduleScripts = [] }) {
  const depth = page.split('/').length - 1;
  const up = '../'.repeat(depth);
  const url = SITE + (page === 'index.html' ? '' : page.replace(/(^|\/)index\.html$/, '$1'));
  const ld = jsonld ? `\n  <script type="application/ld+json">\n${JSON.stringify(jsonld, null, 2).replace(/^/gm, '  ')}\n  </script>` : '';
  const scriptTags = [`js/components.js`, `js/site.js`, ...scripts].map(s => `  <script defer src="${up}${s}"></script>`).join('\n');
  const moduleTags = moduleScripts.map(s => `\n  <script type="module" src="${up}${s}"></script>`).join('');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <!-- shell:csp:start -->
  <!-- shell:csp:end -->
  <meta name="referrer" content="strict-origin-when-cross-origin">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">${robots ? `\n  <meta name="robots" content="${robots}">` : ''}
  <link rel="canonical" href="${url}">

${robots && /noindex/.test(robots) ? '' : socialBlock({ url, title: esc(title), description: esc(description) }) + '\n'}
  <link rel="icon" type="image/x-icon" href="${up}favicon/favicon.ico">
  <link rel="icon" type="image/svg+xml" href="${up}favicon/favicon.svg">
  <link rel="icon" type="image/png" sizes="32x32" href="${up}favicon/favicon-32x32.png">
  <link rel="icon" type="image/png" sizes="16x16" href="${up}favicon/favicon-16x16.png">
  <link rel="apple-touch-icon" sizes="180x180" href="${up}favicon/apple-touch-icon.png">
  <link rel="manifest" href="${up}favicon/site.webmanifest">
  <meta name="theme-color" content="#ffffff">

  <script src="${up}js/theme.js"></script>

  <!-- shell:styles:start -->
  <!-- shell:styles:end -->${ld}
</head>
<body${bodyClass ? ` class="${bodyClass}"` : ''}>
  <!-- shell:header:start -->
  <!-- shell:header:end -->

  <main id="mainContent" class="page">
${main}
  </main>

  <!-- shell:footer:start -->
  <!-- shell:footer:end -->

${scriptTags}${moduleTags}
</body>
</html>
`;
}

function createPage(opts) {
  const file = path.join(ROOT, opts.page);
  if (fs.existsSync(file) && !opts.force) throw new Error(`${opts.page} already exists (use --force to overwrite)`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, pageHTML(opts));
  return file;
}

if (require.main === module) {
  const [page, title, description] = process.argv.slice(2).filter(a => !a.startsWith('--'));
  if (!page || !title || !description) {
    console.error('Usage: node scripts/new-page.js <path> "<Title>" "<Description>" [--force]');
    process.exit(1);
  }
  const main = `    <header class="page-head">\n      <h1 class="page-title">${esc(title.replace(/\s*\|.*$/, ''))}</h1>\n      <p class="page-lede"></p>\n    </header>`;
  createPage({ page, title, description, main, force: process.argv.includes('--force') });
  console.log(`created ${page}; now run node scripts/sync-shell.js`);
}

module.exports = { pageHTML, createPage };
