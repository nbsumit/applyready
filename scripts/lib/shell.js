/* The site shell: header, footer and the head links every page shares.
   scripts/sync-shell.js writes these into every HTML page and tests/content_tests.js
   checks that no page has drifted, so all pages look and behave like one product. */
'use strict';

const ASSET_VERSION = '20261024-2';

// The product map. The header menu, the mobile sheet and the footer all read from here,
// so every page presents the same five areas: image tools, PDF tools, resume, exam requirements, guides.
const TOOLS = [
  { title: 'Image tools', links: [
    ['Image resizer', '', 'fa-crop-simple', 'Exact pixels and KB limits'],
    ['Signature cleaner', 'signature-cleaner.html', 'fa-signature', 'White paper, dark ink'],
    ['Passport photo print', 'passport-photo-print.html', 'fa-print', 'A printable sheet of copies']] },
  { title: 'PDF tools', links: [
    ['Image to PDF', 'image-to-pdf.html', 'fa-file-pdf', 'Combine photos and scans'],
    ['Compress PDF', 'compress-pdf.html', 'fa-compress', 'Fit a portal size limit']] }
];
const EXAMS = [['SSC', 'ssc-photo-signature-size.html', 'CGL, CHSL, MTS, GD'], ['UPSC', 'upsc-photo-signature-size.html', 'Civil services, NDA, CDS'],
  ['IBPS', 'ibps-photo-signature-size.html', 'Bank PO and clerk'], ['NEET', 'neet-photo-signature-size.html', 'Medical entrance'],
  ['RRB', 'rrb-photo-signature-size.html', 'Railway recruitment']];
const SIZES = [['20 KB', 'resize-image-to-20kb.html'], ['50 KB', 'resize-image-to-50kb.html'], ['10, 100 or 200 KB', 'resize-image-to-kb-limit.html']];

// Four columns, so the footer divides evenly in every layout mode (4, then 4 under the brand, then 2 by 2).
const FOOTER_COLUMNS = [
  { title: 'Tools', links: [['Image resizer', ''], ['Signature cleaner', 'signature-cleaner.html'], ['Passport photo print', 'passport-photo-print.html'], ['Image to PDF', 'image-to-pdf.html'], ['Compress PDF', 'compress-pdf.html'], ['Resume builder', 'resume.html']] },
  { title: 'Resize to a file size', links: SIZES.map(([label, p]) => [label, p]) },
  { title: 'Exam requirements', links: EXAMS.map(([label, p]) => [label, p]) },
  { title: 'ApplyReady', links: [['Guides', 'guides/'], ['How to use', 'how-to-use.html'], ['About', 'about.html'], ['Author', 'author/sumit-sengar.html'], ['Editorial policy', 'editorial-policy.html'], ['Contact', 'contact.html'], ['Privacy', 'privacy.html'], ['Terms', 'terms.html']] }
];

const TAGLINE = {
  en: 'Photos, signatures, PDFs and resumes, prepared to the exact requirement. Everything runs in your browser. Files are never uploaded.',
  hi: 'फोटो, सिग्नेचर, PDF और रिज़्यूमे, सही आवश्यकता के अनुसार तैयार। सब कुछ आपके ब्राउज़र में चलता है। फाइलें कभी अपलोड नहीं होतीं।'
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
  const toolGroups = TOOLS.map(g => `              <p class="menu__title">${esc(g.title)}</p>
              <ul class="menu__list">
${g.links.map(([label, p, icon, desc]) => `                <li><a class="menu__item" href="${rel(p)}"${cur(p)}><i class="fa-solid ${icon} menu__icon" aria-hidden="true"></i><span class="menu__text"><span class="menu__name">${esc(label)}</span><span class="menu__desc">${esc(desc)}</span></span></a></li>`).join('\n')}
              </ul>`).join('\n');
  const resumeCur = cur('resume.html');
  const guidesCur = page.startsWith('guides/') ? ' aria-current="page"' : '';
  const hindi = page.startsWith('hi/') ? ' aria-current="page"' : '';
  return `  <a class="skip-link" href="#mainContent">Skip to content</a>
  <header class="site-header" id="siteHeader">
    <div class="site-header__inner">
      <a class="brand" href="${rel('')}" aria-label="ApplyReady home">
        <img class="brand__mark" src="${prefix}favicon/android-chrome-192x192.png" alt="" width="28" height="28">
        <span class="brand__name">ApplyReady</span>
      </a>
      <nav class="site-nav" id="siteNav" aria-label="Main">
        <ul class="site-nav__list">
          <li class="site-nav__item">
            <button type="button" class="site-nav__link" id="toolsMenuButton" aria-expanded="false" aria-controls="toolsMenu">Tools <i class="fa-solid fa-chevron-down" aria-hidden="true"></i></button>
            <div class="menu" id="toolsMenu" hidden>
              <div class="menu__group menu__group--tools">
${toolGroups}
              </div>
              <div class="menu__group menu__group--refs">
              <p class="menu__title">Exam photo and signature</p>
              <ul class="menu__list">
${EXAMS.map(([label, p, desc]) => `                <li><a class="menu__item menu__item--plain" href="${rel(p)}"${cur(p)}><span class="menu__text"><span class="menu__name">${esc(label)}</span><span class="menu__desc">${esc(desc)}</span></span></a></li>`).join('\n')}
              </ul>
              </div>
            </div>
          </li>
          <li><a class="site-nav__link" href="${rel('resume.html')}"${resumeCur}>Resume builder</a></li>
          <li><a class="site-nav__link" href="${rel('guides/')}"${guidesCur}>Guides</a></li>
          <li class="site-nav__lang"><a class="site-nav__link" href="${rel('hi/ssc-photo-signature-size.html')}" lang="hi"${hindi}>हिन्दी</a></li>
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
  const cols = FOOTER_COLUMNS.map(c => `      <div class="site-footer__col">
        <h2 class="site-footer__title">${esc(c.title)}</h2>
        <ul class="site-footer__list">
${c.links.map(([label, p]) => `          <li><a href="${rel(p)}">${esc(label)}</a></li>`).join('\n')}
        </ul>
      </div>`).join('\n');
  return `  <footer class="site-footer">
    <div class="site-footer__inner">
      <div class="site-footer__brand">
        <a class="brand" href="${rel('')}"><img class="brand__mark" src="${prefix}favicon/android-chrome-192x192.png" alt="" width="28" height="28"><span class="brand__name">ApplyReady</span></a>
        <p>${TAGLINE[lang] || TAGLINE.en}</p>
      </div>
${cols}
    </div>
    <div class="site-footer__base"><span>Free to use. No sign-up, no watermarks.</span></div>
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

module.exports = { ASSET_VERSION, TOOLS, EXAMS, SIZES, FOOTER_COLUMNS, headerHTML, footerHTML, stylesheetLinks, href };
