#!/usr/bin/env node
/* Writes sitemap.xml from the pages on disk.

   - Only indexable, canonical pages are listed: pages with <meta name="robots" content="noindex">,
     redirect stubs (<meta http-equiv="refresh">) and the utility pages are left out.
   - lastmod is the date of the last commit that changed what a reader sees on the page: the text
     inside <main>. Header, footer, asset versions and head tags do not count, so a site-wide shell
     change does not make every page look freshly updated. A page whose visible text differs from
     the last commit (an uncommitted edit) gets today's date.
   - changefreq and priority are kept from the existing sitemap; new pages get a default.

   Run: node scripts/build-sitemap.js        (writes sitemap.xml)
        node scripts/build-sitemap.js --check (exits 1 if sitemap.xml is out of date) */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const SITE = 'https://applyready.in';
const UTILITY = new Set(['404.html', 'offline.html']);
const check = process.argv.includes('--check');

const list = (dir, base = '') => fs.existsSync(path.join(root, dir))
  ? fs.readdirSync(path.join(root, dir)).filter(f => f.endsWith('.html')).map(f => path.posix.join(base, f)) : [];
const pages = [...list('.'), ...list('guides', 'guides'), ...list('hi', 'hi'), ...list('author', 'author')];

const isIndexable = html => !/<meta name="robots" content="[^"]*noindex/i.test(html) && !/<meta http-equiv="refresh"/i.test(html);
const urlFor = f => f === 'index.html' ? SITE + '/' : f.endsWith('/index.html') ? `${SITE}/${f.slice(0, -'index.html'.length)}` : `${SITE}/${f}`;

// What a reader sees: the text inside <main>, without scripts, markup or asset versions.
const visible = html => {
  if (!html) return '';
  const main = (html.match(/<main[\s\S]*?<\/main>/) || [''])[0];
  return main.replace(/<script[\s\S]*?<\/script>|<!--[\s\S]*?-->/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
};
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const show = (rev, f) => { try { return git('show', `${rev}:${f}`); } catch (e) { return null; } };

function lastContentChange(f) {
  const current = visible(fs.readFileSync(path.join(root, f), 'utf8'));
  const today = new Date().toISOString().slice(0, 10);
  let commits = [];
  try { commits = git('log', '--format=%H %cs', '--follow', '--', f).trim().split('\n').filter(Boolean).map(l => l.split(' ')); } catch (e) { /* not tracked yet */ }
  if (!commits.length) return today;
  if (visible(show(commits[0][0], f)) !== current) return today;
  // Walk back to the newest commit whose version differs from its parent's.
  for (let i = 0; i < commits.length; i++) {
    const [sha, date] = commits[i];
    const before = commits[i + 1] ? show(commits[i + 1][0], f) : null;
    if (visible(show(sha, f)) !== visible(before)) return date;
  }
  return commits[commits.length - 1][1];
}

const old = fs.existsSync(path.join(root, 'sitemap.xml')) ? fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8') : '';
const kept = new Map([...old.matchAll(/<url>\s*<loc>([^<]+)<\/loc>[\s\S]*?<changefreq>([^<]+)<\/changefreq>\s*<priority>([^<]+)<\/priority>\s*<\/url>/g)].map(m => [m[1], [m[2], m[3]]]));
const defaults = f => f === 'index.html' ? ['weekly', '1.0'] : f.startsWith('guides/') ? ['monthly', '0.7'] : f.startsWith('author/') || /(about|contact|editorial-policy|privacy|terms)\.html$/.test(f) ? ['yearly', '0.5'] : ['monthly', '0.8'];

const order = f => f === 'index.html' ? 0 : f.startsWith('guides/') ? 3 : f.startsWith('author/') ? 4 : /(about|contact|editorial-policy|privacy|terms|how-to-use)\.html$/.test(f) ? 5 : 1;
const entries = pages
  .filter(f => !UTILITY.has(f) && isIndexable(fs.readFileSync(path.join(root, f), 'utf8')))
  .sort((a, b) => order(a) - order(b) || a.localeCompare(b))
  .map(f => {
    const loc = urlFor(f);
    const [changefreq, priority] = kept.get(loc) || defaults(f);
    return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastContentChange(f)}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;
  });

const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join('\n')}\n</urlset>\n`;
if (check) {
  const strip = s => s.replace(/<lastmod>[^<]*<\/lastmod>/g, '');
  if (strip(xml) !== strip(old)) { console.error('sitemap.xml does not list the indexable pages; run node scripts/build-sitemap.js'); process.exit(1); }
  console.log(`sitemap lists ${entries.length} indexable pages`);
} else {
  fs.writeFileSync(path.join(root, 'sitemap.xml'), xml);
  console.log(`sitemap.xml written with ${entries.length} pages`);
}
