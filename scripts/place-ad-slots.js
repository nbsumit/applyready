#!/usr/bin/env node
/* Inserts the manual ad slots. Safe to re-run: existing slots are replaced.
   At most three per page: below the tool, about 40% through the article, and before the FAQ or footer.
   None on 404, offline, privacy, terms, contact, redirect stubs or noindex pages.
   None on the resume page: the whole page is the editor. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { ASSET_VERSION } = require('./lib/shell');

const root = path.resolve(__dirname, '..');
const list = (dir, base = '') => fs.existsSync(path.join(root, dir))
  ? fs.readdirSync(path.join(root, dir)).filter(f => f.endsWith('.html')).map(f => path.posix.join(base, f)) : [];
const pages = [...list('.'), ...list('guides', 'guides'), ...list('hi', 'hi'), ...list('author', 'author')];

const NO_SLOTS = new Set(['404.html', 'offline.html', 'privacy.html', 'terms.html', 'contact.html', 'resume.html']);
const plain = s => s.replace(/<script[\s\S]*?<\/script>|<!--[\s\S]*?-->/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

function slot(position, n) {
  return [
    '    <aside class="ad-slot-container" data-ad-position="' + position + '" role="complementary" aria-label="Advertisements ' + n + '">',
    '      <div class="ad-slot-inner">',
    '        <span class="ad-slot-label">Advertisements</span>',
    '      </div>',
    '    </aside>'
  ].join('\n');
}

function strip(html) {
  return html
    .replace(/\n?[ \t]*<aside class="ad-slot-container"[\s\S]*?<\/aside>/g, '')
    .replace(/\n?[ \t]*<script src="(?:\.\.\/|\/)?js\/ads\.js(?:\?v=[^"]*)?" defer><\/script>/g, '');
}

function sectionEnds(html, start, end) {
  const re = /<section\b|<\/section>/g;
  re.lastIndex = start;
  let depth = 0, m, ends = [];
  while ((m = re.exec(html)) && m.index < end) {
    if (m[0][1] !== '/') depth++;
    else if (--depth === 0) ends.push(m.index + m[0].length);
  }
  return ends;
}

function midPoint(html, start, end) {
  const total = plain(html.slice(start, end)).length;
  if (total < 500) return -1;
  const target = total * 0.4;
  const pick = pos => {
    const n = plain(html.slice(start, pos)).length;
    return n >= target && n <= total * 0.8;
  };
  for (const pos of sectionEnds(html, start, end)) if (pick(pos)) return pos;
  const re = /<h2\b/g;
  re.lastIndex = start;
  let m, first = true;
  while ((m = re.exec(html)) && m.index < end) {
    if (first) { first = false; continue; }
    if (pick(m.index)) return m.index;
  }
  return -1;
}

function pointsFor(file, html) {
  if (NO_SLOTS.has(file)) return [];
  if (/<meta http-equiv="refresh"/i.test(html) || /<meta name="robots" content="[^"]*noindex/i.test(html)) return [];
  if (file === 'resume.html') return [];
  const mainEnd = html.indexOf('</main>');
  if (mainEnd < 0) return [];
  const toolAt = html.indexOf('<!-- tool:end -->');
  let start;
  if (toolAt >= 0) start = toolAt + '<!-- tool:end -->'.length;
  else {
    const head = html.indexOf('class="page-head"');
    const close = head >= 0 ? html.indexOf('</header>', head) : -1;
    start = close >= 0 ? close + '</header>'.length : html.indexOf('<main');
  }
  const faq = html.indexOf('<section class="faq-section"', start);
  const related = html.indexOf('<section class="related-guides-section"', start);
  let end = mainEnd;
  let endName = 'before-footer';
  if (faq >= 0 && faq < end) { end = faq; endName = 'before-faq'; }
  else if (related >= 0 && related < end) end = related;
  // The slot below a tool comes after the first block of prose, not against the
  // download or process button, and not in the first screen of a short tool.
  const points = [];
  let belowAt = -1;
  if (toolAt >= 0) {
    const first = sectionEnds(html, start, end).find(pos => pos > start + 80 && pos < end - 120);
    if (first) { points.push({ pos: first, position: 'below-tool' }); belowAt = first; }
  }
  const mid = midPoint(html, start, end);
  if (mid > start + 80 && mid < end - 80 && (belowAt < 0 || Math.abs(mid - belowAt) > 120)) points.push({ pos: mid, position: 'mid-article' });
  if (plain(html.slice(start, end)).length > 200) points.push({ pos: end, position: endName });
  return points.slice(0, 3);
}

function scriptTag(file) {
  const depth = file.split('/').length - 1;
  const prefix = depth > 0 ? '../'.repeat(depth) : '';
  return '  <script src="' + prefix + 'js/ads.js?v=' + ASSET_VERSION + '" defer></script>';
}

let changed = 0;
for (const file of pages) {
  const abs = path.join(root, file);
  let html = strip(fs.readFileSync(abs, 'utf8'));
  const points = pointsFor(file, html).sort((a, b) => b.pos - a.pos);
  points.forEach((p, i) => { html = html.slice(0, p.pos) + '\n' + slot(p.position, points.length - i) + '\n' + html.slice(p.pos); });
  if (points.length) html = html.replace(/<\/body>/, scriptTag(file) + '\n</body>');
  if (html !== fs.readFileSync(abs, 'utf8')) { fs.writeFileSync(abs, html); changed++; }
  const names = pointsFor(file, strip(html)).map(p => p.position);
  // positions were computed on the stripped html; report those
  console.log(file + ': ' + (points.slice().reverse().map(p => p.position).join(', ') || '(none)'));
  void names;
}
console.log('updated ' + changed + ' pages');
