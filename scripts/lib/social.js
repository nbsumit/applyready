/* Social preview tags (Open Graph and Twitter cards), written from each page's own <title>, meta
   description and canonical URL, so a shared link always says what the page says.

   scripts/sync-shell.js rewrites the block on every page; scripts/new-page.js uses the same
   function, so a new page starts in sync. Pages without a canonical URL (404, offline) and noindex
   pages (redirect stubs) get no social tags: nobody shares them and their URL is not the page's. */
'use strict';

const SITE = 'https://applyready.in/';
const CARD = `${SITE}assets/social-card.png`;
// assets/social-card.png, described for people who cannot see it. Keep in step with the image.
const CARD_ALT = 'ApplyReady: free tools for job applications. Resume builder, photo and signature tools and PDF tools that run in your browser; nothing is uploaded.';
const BRAND_SUFFIX = / \| ApplyReady$/;

const attr = s => String(s).replace(/"/g, '&quot;');

/** The tag block for a page. `title` and `description` are HTML text as written in the page. */
function socialBlock({ url, title, description, type = 'website' }) {
  // og:site_name carries the brand, so the shared title is the page's own title without it.
  const t = attr(title.replace(BRAND_SUFFIX, ''));
  const d = attr(description);
  return [
    `<meta property="og:type" content="${type}">`,
    '<meta property="og:site_name" content="ApplyReady">',
    `<meta property="og:url" content="${url}">`,
    `<meta property="og:title" content="${t}">`,
    `<meta property="og:description" content="${d}">`,
    `<meta property="og:image" content="${CARD}">`,
    '<meta property="og:image:width" content="1200">',
    '<meta property="og:image:height" content="630">',
    `<meta property="og:image:alt" content="${attr(CARD_ALT)}">`,
    '<meta name="twitter:card" content="summary_large_image">',
    `<meta name="twitter:title" content="${t}">`,
    `<meta name="twitter:description" content="${d}">`,
    `<meta name="twitter:image" content="${CARD}">`
  ].map(line => '  ' + line).join('\n');
}

const SOCIAL_LINE = /^[ \t]*(?:<meta (?:property="og:|name="twitter:)[^>]*>|<!--\s*(?:Twitter Card|Open Graph[^>]*|Social[^>]*)\s*-->)[ \t]*\n/gm;

/** Rewrites the social tags of a whole page from its head. Returns the page unchanged if it has no head. */
function syncSocial(html) {
  const end = html.indexOf('</head>');
  if (end < 0) return html;
  let head = html.slice(0, end).replace(SOCIAL_LINE, '').replace(/\n{3,}/g, '\n\n');
  const title = (head.match(/<title>([\s\S]*?)<\/title>/) || [])[1];
  const description = (head.match(/<meta name="description" content="([^"]*)"/) || [])[1];
  const url = (head.match(/<link rel="canonical" href="([^"]*)"/) || [])[1];
  const noindex = /<meta name="robots" content="[^"]*noindex/i.test(head);
  if (title && description && url && !noindex) {
    const type = /"@type":\s*"Article"/.test(html) ? 'article' : 'website';
    head = head.replace(/(<link rel="canonical"[^>]*>)\n\n?/, `$1\n\n${socialBlock({ url, title: title.trim(), description, type })}\n\n`);
  }
  return head + html.slice(end);
}

module.exports = { socialBlock, syncSocial, CARD_ALT };
