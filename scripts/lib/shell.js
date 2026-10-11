/* The site shell: header, footer and the head links every page shares.
   scripts/sync-shell.js writes these into every HTML page and tests/content_tests.js
   checks that no page has drifted, so all pages look and behave like one product. */
'use strict';

const ASSET_VERSION = '20261101-1';

const TOOLS = [
  { title: 'Image tools', links: [
    ['Image resizer', ''], ['Signature cleaner', 'signature-cleaner.html'], ['Image to PDF', 'image-to-pdf.html'],
    ['Compress PDF', 'compress-pdf.html'], ['Passport photo print', 'passport-photo-print.html']] },
  { title: 'Exam sizes', links: [
    ['SSC', 'ssc-photo-signature-size.html'], ['UPSC', 'upsc-photo-signature-size.html'], ['IBPS', 'ibps-photo-signature-size.html'],
    ['NEET', 'neet-photo-signature-size.html'], ['RRB', 'rrb-photo-signature-size.html']] },
  { title: 'Resize to KB', links: [
    ['10 KB', 'resize-image-to-10kb.html'], ['20 KB', 'resize-image-to-20kb.html'], ['50 KB', 'resize-image-to-50kb.html'],
    ['100 KB', 'resize-image-to-100kb.html'], ['200 KB', 'resize-image-to-200kb.html']] }
];

const FOOTER_COLUMNS = [
  { title: 'Tools', links: [['Image resizer', ''], ['Signature cleaner', 'signature-cleaner.html'], ['Image to PDF', 'image-to-pdf.html'], ['Compress PDF', 'compress-pdf.html'], ['Passport photo print', 'passport-photo-print.html'], ['Resume builder', 'resume.html']] },
  { title: 'Exam sizes', links: [['SSC', 'ssc-photo-signature-size.html'], ['UPSC', 'upsc-photo-signature-size.html'], ['IBPS', 'ibps-photo-signature-size.html'], ['NEET', 'neet-photo-signature-size.html'], ['RRB', 'rrb-photo-signature-size.html'], ['Resize to 20KB', 'resize-image-to-20kb.html'], ['Resize to 50KB', 'resize-image-to-50kb.html']] },
  { title: 'ApplyReady', links: [['Guides', 'guides/'], ['How to use', 'how-to-use.html'], ['About', 'about.html'], ['Privacy', 'privacy.html'], ['Terms', 'terms.html'], ['Contact', 'contact.html']] }
];

const TAGLINE = {
  en: 'Small tools. A smoother next step.<br>Free to use. Your files stay on your device.',
  hi: 'छोटे टूल्स। अगली सीढ़ी आसान।<br>निःशुल्क उपयोग। आपकी फाइलें आपके डिवाइस पर ही रहती हैं।'
};

// 404.html is served at any depth and offline.html from the cache, so both use root-relative paths.
const ROOT_RELATIVE = new Set(['404.html', 'offline.html']);
const prefixFor = page => (ROOT_RELATIVE.has(page) ? '/' : '../'.repeat(page.split('/').length - 1));

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// href for a site path ('' = home) given the page's prefix ('', '../' or '/').
function href(path, prefix) {
  if (path === '') return prefix === '../' ? '../' : '/';
  return prefix + path;
}

function isCurrent(path, page) {
  if (path === '') return page === 'index.html';
  if (path.endsWith('/')) return page.startsWith(path);
  return page === path;
}

function headerHTML(page) {
  const prefix = prefixFor(page);
  const rel = p => href(p, prefix);
  const cur = p => (isCurrent(p, page) ? ' aria-current="page"' : '');
  const groups = TOOLS.map(g => `            <div class="menu__group">
              <h2 class="menu__title">${esc(g.title)}</h2>
              <ul class="menu__list">
${g.links.map(([label, p]) => `                <li><a href="${rel(p)}"${cur(p)}>${esc(label)}</a></li>`).join('\n')}
              </ul>
            </div>`).join('\n');
  const resumeCur = cur('resume.html');
  const guidesCur = page.startsWith('guides/') ? ' aria-current="page"' : '';
  return `  <a class="skip-link" href="#mainContent">Skip to content</a>
  <header class="site-header" id="siteHeader">
    <div class="site-header__inner">
      <a class="brand" href="${rel('')}" aria-label="ApplyReady home">
        <img class="brand__mark" src="${prefix}favicon/android-chrome-192x192.png" alt="" width="28" height="28">
        <span>ApplyReady</span>
      </a>
      <nav class="site-nav" id="siteNav" aria-label="Main">
        <ul class="site-nav__list">
          <li class="site-nav__item">
            <button type="button" class="site-nav__link" id="toolsMenuButton" aria-expanded="false" aria-controls="toolsMenu">Tools <i class="fa-solid fa-chevron-down" aria-hidden="true"></i></button>
            <div class="menu" id="toolsMenu" hidden>
${groups}
            </div>
          </li>
          <li><a class="site-nav__link" href="${rel('resume.html')}"${resumeCur}>Resume builder</a></li>
          <li><a class="site-nav__link" href="${rel('guides/')}"${guidesCur}>Guides</a></li>
          <li><a class="site-nav__link" href="${rel('hi/ssc-photo-signature-size.html')}" lang="hi" hreflang="hi"${page.startsWith('hi/') ? ' aria-current="page"' : ''}>हिन्दी</a></li>
        </ul>
      </nav>
      <div class="site-header__tools">
        <button type="button" id="themeToggle" class="btn btn-ghost btn-icon" aria-label="Switch to dark theme"><i class="fa-solid fa-circle-half-stroke" aria-hidden="true"></i></button>
        <button type="button" id="navMenuToggle" class="btn btn-ghost btn-icon nav-toggle" aria-label="Open menu" aria-expanded="false" aria-controls="siteNav"><i class="fa-solid fa-bars" aria-hidden="true"></i></button>
      </div>
    </div>
  </header>`;
}

function footerHTML(page, lang) {
  const prefix = prefixFor(page);
  const rel = p => href(p, prefix);
  const cols = FOOTER_COLUMNS.map(c => `      <div>
        <h2 class="site-footer__title">${esc(c.title)}</h2>
        <ul class="site-footer__list">
${c.links.map(([label, p]) => `          <li><a href="${rel(p)}">${esc(label)}</a></li>`).join('\n')}
        </ul>
      </div>`).join('\n');
  return `  <footer class="site-footer">
    <div class="site-footer__inner">
      <div class="site-footer__brand">
        <a class="brand" href="${rel('')}"><img class="brand__mark" src="${prefix}favicon/android-chrome-192x192.png" alt="" width="28" height="28"><span>ApplyReady</span></a>
        <p>${TAGLINE[lang] || TAGLINE.en}</p>
      </div>
${cols}
    </div>
    <div class="site-footer__base"><span>Built for your everyday paperwork.</span><span>No sign-up. No watermarks.</span></div>
  </footer>`;
}

function stylesheetLinks(page, { cropper, document: doc }) {
  const up = prefixFor(page);
  const v = `?v=${ASSET_VERSION}`;
  return [
    `  <link rel="stylesheet" href="${up}css/vendor/icons.min.css">`,
    cropper ? `  <link rel="stylesheet" href="${up}css/vendor/cropper.min.css">` : null,
    `  <link rel="stylesheet" href="${up}css/app.css${v}">`,
    doc ? `  <link rel="stylesheet" href="${up}css/document.css${v}">` : null
  ].filter(Boolean).join('\n');
}

module.exports = { ASSET_VERSION, TOOLS, FOOTER_COLUMNS, headerHTML, footerHTML, stylesheetLinks, href };
