/* The site shell: header, footer and the head links every page shares.
   scripts/sync-shell.js writes these into every HTML page and tests/content_tests.js
   checks that no page has drifted, so all pages look and behave like one product.
   The list of tools comes from scripts/lib/tools.js. */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { CATEGORIES, TOOLS, liveTools, toolsIn } = require('./tools');

const ASSET_VERSION = '20261118';
const ROOT = path.resolve(__dirname, '..', '..');

const DONATE_URL = 'https://pages.razorpay.com/support-applyready';
const SOURCE_URL = 'https://github.com/nbsumit/applyready';

const TAGLINE = 'Free tools for job applications: resumes, photos, signatures and PDFs. Everything runs in your browser, and your files are never uploaded.';

// Footer "ApplyReady" column. A link is shown only once its page exists, so the footer never
// points at a page that has not been written yet.
const PROJECT_LINKS = [
  ['About', 'about.html'], ['Our philosophy', 'philosophy.html'], ['Privacy', 'privacy.html'], ['Terms of use', 'terms.html'],
  ['Your data', 'your-data.html'], ['Contact and support', 'contact.html'], ['Feedback', 'feedback.html'],
  ['Changelog', 'changelog.html'], ['Contribute', 'contribute.html']
];
const HELP_LINKS = [['All tools', 'tools.html'], ['Guides', 'guides/'], ['How to use', 'how-to-use.html']];

// 404.html is served at any depth and offline.html from the cache, so both use root-relative paths.
const ROOT_RELATIVE = new Set(['404.html', 'offline.html']);
const prefixFor = page => (ROOT_RELATIVE.has(page) ? '/' : '../'.repeat(page.split('/').length - 1));

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const exists = p => p === '' || fs.existsSync(path.join(ROOT, p.endsWith('/') ? p + 'index.html' : p));

// href for a site path ('' = home) given the page's prefix ('', '../' or '/').
function href(p, prefix) {
  if (p === '') return prefix === '../' ? '../' : '/';
  return prefix + p;
}

function isCurrent(p, page) {
  if (p === '') return page === 'index.html';
  if (p.endsWith('/')) return page.startsWith(p);
  return page === p;
}

/** The tool a page belongs to, for "recently used" (null for non-tool pages). */
function toolFor(page) {
  const t = TOOLS.find(x => x.path === page && x.live !== false);
  return t ? t.id : null;
}

// Header menu columns, read left to right in the same category order as the home page and the
// directory (CATEGORIES). Each category lists the same tools as there (toolsIn).
const MENU_COLUMNS = [
  ['resume', 'image'],
  ['pdf'],
  ['document', 'batch', 'cafe']
];

// On a desktop each category is a heading over its tools. In the phone menu sheet each category is
// a button that shows or hides its tools, so the sheet starts as one short list; the category of
// the page being viewed starts open. A category with a single tool (Resume, Cyber cafe) shows that
// tool as a plain link instead: a button that only reveals one link costs a tap for nothing.
function menuGroup(cat, page, rel, openCat) {
  const tools = toolsIn(cat.id);
  if (!tools.length) return '';
  const cur = p => (isCurrent(p, page) ? ' aria-current="page"' : '');
  const single = tools.length === 1;
  const open = !single && cat.id === openCat;
  const toggle = single ? '' : `
                  <button type="button" class="menu__toggle" aria-expanded="${open}" aria-controls="menuList-${cat.id}">${esc(cat.name)} <span class="menu__count">${tools.length}<span class="sr-only"> tools</span></span><i class="fa-solid fa-chevron-down" aria-hidden="true"></i></button>`;
  return `                <div class="menu__cat${single ? ' menu__cat--single' : ''}"${open ? ' data-open' : ''}>
                  <p class="menu__title"><a href="${rel('tools.html')}#${cat.id}">${esc(cat.name)}</a></p>${toggle}
                  <ul class="menu__list" id="menuList-${cat.id}">
${tools.map(t => `                    <li><a class="menu__item" href="${rel(t.path)}"${cur(t.path)}><i class="fa-solid fa-${t.icon} menu__icon" aria-hidden="true"></i><span class="menu__text"><span class="menu__name">${esc(t.name)}</span><span class="menu__desc">${esc(t.summary)}</span></span></a></li>`).join('\n')}
                  </ul>
                </div>`;
}

function headerHTML(page) {
  const prefix = prefixFor(page);
  const rel = p => href(p, prefix);
  const cur = p => (isCurrent(p, page) ? ' aria-current="page"' : '');
  // The page's own category starts open in the phone menu (a preset page opens its parent's).
  const own = TOOLS.find(t => t.path === page && t.live !== false);
  const openCat = own ? (own.presetOf ? TOOLS.find(t => t.id === own.presetOf) : own).category : null;
  const columnList = MENU_COLUMNS.map(ids => {
    const groups = ids.map(id => menuGroup(CATEGORIES.find(c => c.id === id), page, rel, openCat)).filter(Boolean);
    return groups.length ? `              <div class="menu__group">\n${groups.join('\n')}\n              </div>` : '';
  }).filter(Boolean);
  const columns = columnList.join('\n');
  const toolsPage = exists('tools.html') ? `\n              <div class="menu__foot"><a class="menu__all" href="${rel('tools.html')}">All tools <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></a><span class="menu__hint">Press <kbd>/</kbd> to search</span></div>` : '';
  const guidesCur = page.startsWith('guides/') ? ' aria-current="page"' : '';
  // DOM order is the order on screen at every width. In the phone sheet: search, the categories,
  // All tools, Guides (the Resume builder link is hidden there: the Resume category holds it).
  return `  <a class="skip-link" href="#mainContent">Skip to content</a>
  <header class="site-header" id="siteHeader">
    <div class="site-header__inner">
      <a class="brand" href="${rel('')}" aria-label="ApplyReady home">
        <img class="brand__mark" src="${prefix}favicon/android-chrome-192x192.png" alt="" width="28" height="28">
        <span class="brand__name">ApplyReady</span>
      </a>
      <nav class="site-nav" id="siteNav" aria-label="Main">
        <ul class="site-nav__list">
          <li class="site-nav__search"><button type="button" class="site-nav__search-btn" id="navSearch"><i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i> Search tools</button></li>
          <li class="site-nav__item">
            <button type="button" class="site-nav__link" id="toolsMenuButton" aria-expanded="false" aria-controls="toolsMenu">Tools <i class="fa-solid fa-chevron-down" aria-hidden="true"></i></button>
            <div class="menu" id="toolsMenu" hidden>
              <div class="menu__cols menu__cols--${columnList.length}">
${columns}
              </div>${toolsPage}
            </div>
          </li>
          <li class="site-nav__resume"><a class="site-nav__link" href="${rel('resume.html')}"${cur('resume.html')}>Resume builder</a></li>
          <li><a class="site-nav__link" href="${rel('guides/')}"${guidesCur}>Guides</a></li>
        </ul>
      </nav>
      <div class="site-header__tools">
        <button type="button" id="searchOpen" class="search-trigger" aria-haspopup="dialog" aria-keyshortcuts="/ Control+K" aria-label="Search tools"><i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i><span class="search-trigger__label" aria-hidden="true">Search tools</span><kbd class="search-trigger__key" aria-hidden="true">/</kbd></button>
        <button type="button" id="themeToggle" class="btn btn-ghost btn-icon" aria-label="Switch to dark theme"><i class="fa-solid fa-circle-half-stroke" aria-hidden="true"></i></button>
        <button type="button" id="navMenuToggle" class="btn btn-ghost btn-icon nav-toggle" aria-label="Open menu" aria-expanded="false" aria-controls="siteNav"><i class="fa-solid fa-bars" aria-hidden="true"></i></button>
      </div>
    </div>
  </header>`;
}

function footerHTML(page) {
  const prefix = prefixFor(page);
  const rel = p => href(p, prefix);
  // A site index: each tool once, under its own category (the menu and directory show the
  // categories in full).
  const toolLinks = ids => ids.flatMap(id => toolsIn(id).filter(t => t.category === id)).map(t => [t.name, t.path]);
  const columns = [
    { title: 'Resume and images', links: toolLinks(['resume', 'image']) },
    { title: 'PDF and documents', links: toolLinks(['pdf', 'document']) },
    { title: 'Batch and help', links: [...toolLinks(['batch', 'cafe']), ...HELP_LINKS].filter(([, p]) => exists(p)) },
    { title: 'ApplyReady', links: PROJECT_LINKS.filter(([, p]) => exists(p)) }
  ];
  // One hidden heading for the footer; the column titles are labels, not headings, so every page's
  // outline ends with "Site links" instead of four generic headings.
  const cols = columns.map((c, i) => `      <div class="site-footer__col">
        <p class="site-footer__title" id="footerLinks${i + 1}">${esc(c.title)}</p>
        <ul class="site-footer__list" aria-labelledby="footerLinks${i + 1}">
${c.links.map(([label, p]) => `          <li><a href="${rel(p)}">${esc(label)}</a></li>`).join('\n')}
        </ul>
      </div>`).join('\n');
  return `  <footer class="site-footer">
    <div class="site-footer__inner">
      <h2 class="sr-only">Site links</h2>
      <div class="site-footer__brand">
        <a class="brand" href="${rel('')}"><img class="brand__mark" src="${prefix}favicon/android-chrome-192x192.png" alt="" width="28" height="28"><span class="brand__name">ApplyReady</span></a>
        <p>${esc(TAGLINE)}</p>
        <p class="site-footer__motto">Free. Open source. Forever.</p>
      </div>
${cols}
    </div>
    <div class="site-footer__base">
      <span>No sign-up, no ads, no watermarks. Every feature is free for everyone.</span>
      <span class="site-footer__ext"><a href="${SOURCE_URL}" rel="noopener" target="_blank">Source code<span class="sr-only"> (opens in a new tab)</span></a><a class="site-footer__support" href="${DONATE_URL}" rel="noopener" target="_blank"><i class="fa-solid fa-heart" aria-hidden="true"></i> Support ApplyReady<span class="sr-only"> (voluntary contribution, opens in a new tab)</span></a></span>
    </div>
  </footer>`;
}

// GitHub Pages cannot set response headers, so the policy is a meta tag.
// Every script, style, font and image is served from this origin; nothing is loaded from a third party.
// style-src keeps 'unsafe-inline' for style attributes the tools set while cropping and previewing.
// blob: and data: cover generated previews and downloads, which never leave the browser.
// The tool meta lets js/site.js remember recently used tools (tool ids only, never file names).
function cspMeta(page) {
  const policy = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self' blob: data:",
    "media-src 'self' blob: data:",
    "worker-src 'self' blob:",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; ');
  const tool = page ? toolFor(page) : null;
  return `  <meta http-equiv="Content-Security-Policy" content="${policy}">` + (tool ? `\n  <meta name="applyready-tool" content="${tool}">` : '');
}

function stylesheetLinks(page, { cropper, document: doc }) {
  const up = prefixFor(page);
  const v = `?v=${ASSET_VERSION}`;
  return [
    `  <link rel="preload" href="/assets/fonts/inter-latin.woff2" as="font" type="font/woff2" crossorigin>`,
    `  <link rel="stylesheet" href="${up}css/vendor/icons.min.css${v}">`,
    cropper ? `  <link rel="stylesheet" href="${up}css/vendor/cropper.min.css">` : null,
    `  <link rel="stylesheet" href="${up}css/app.css${v}">`,
    doc ? `  <link rel="stylesheet" href="${up}css/document.css${v}">` : null
  ].filter(Boolean).join('\n');
}

module.exports = { ASSET_VERSION, DONATE_URL, SOURCE_URL, TAGLINE, headerHTML, footerHTML, stylesheetLinks, cspMeta, href, prefixFor, toolFor, liveTools };
