#!/usr/bin/env node
/* One-time conversion of the page copy (breadcrumbs, headings, guides, FAQs, tables, related links)
   from the previous markup to the current design system. Wording is never changed; the script
   checks that the visible text of every page is identical before and after.
   Pages that already carry <main class="page"> are skipped, so it is safe to re-run. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const list = (dir, base = '') => fs.readdirSync(path.join(root, dir)).filter(f => f.endsWith('.html')).map(f => path.posix.join(base, f));
const pages = [...list('.'), ...list('guides', 'guides'), ...list('hi', 'hi')].filter(f => !['resume.html', '404.html', 'offline.html'].includes(f));

const READ_PAGES = new Set(['about.html', 'privacy.html', 'terms.html', 'contact.html', 'how-to-use.html', '404.html', 'offline.html']);
const isReading = f => READ_PAGES.has(f) || (f.startsWith('guides/') && f !== 'guides/index.html');

const visibleText = html => html
  .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<!--[\s\S]*?-->/g, ' ')
  .replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&amp;/g, ' ').replace(/[^\p{L}\p{N}\p{M}]+/gu, ' ').trim();

function balanced(html, from, tag) {
  const re = new RegExp(`<${tag}\\b|</${tag}>`, 'g');
  re.lastIndex = from;
  let depth = 0, m;
  while ((m = re.exec(html))) { if (m[0][1] !== '/') depth++; else if (--depth === 0) return m.index + m[0].length; }
  throw new Error(`unbalanced <${tag}>`);
}

function pageHead(inner) {
  const g = re => { const m = inner.match(re); return m ? m[1].trim() : ''; };
  const eyebrow = g(/<span class="eyebrow"[^>]*>([\s\S]*?)<\/span>/);
  const h1 = g(/<h1[^>]*>([\s\S]*?)<\/h1>/);
  const lede = g(/<p class="hero-subtitle"[^>]*>([\s\S]*?)<\/p>/);
  const meta = g(/<p class="guide-meta"[^>]*>([\s\S]*?)<\/p>/);
  const jump = g(/<p class="tool-jump">([\s\S]*?)<\/p>/);
  const assure = inner.match(/<div class="workspace-assurance">[\s\S]*?<strong>([\s\S]*?)<\/strong>\s*<span>([\s\S]*?)<\/span>/);
  const punct = s => (/[.!?।]$/.test(s) ? s : s + '.');
  return `<header class="page-head">${eyebrow ? `
        <span class="eyebrow">${eyebrow}</span>` : ''}
        <h1 class="page-title">${h1}</h1>${lede ? `
        <p class="page-lede">${lede}</p>` : ''}${meta ? `
        <p class="guide-meta">${meta}</p>` : ''}${jump ? `
        <p class="tool-jump">${jump}</p>` : ''}${assure ? `
        <p class="assurance"><i class="fa-solid fa-lock" aria-hidden="true"></i> <span><strong>${punct(assure[1])}</strong> ${assure[2]}</span></p>` : ''}
      </header>`;
}

function modernize(s, page) {
  // Page head
  s = s.replace(/<header(?![^>]*page-head)[^>]*>[\s\S]*?<\/header>/g, h => (/hero-export/.test(h) ? h : pageHead(h)));
  s = s.replace(/<!-- Hero Header -->\s*/g, '');

  // Cards that are really prose blocks become prose; cards inside a card grid stay cards.
  for (let at = s.indexOf('<div class="guide-card-grid"'); at >= 0; at = s.indexOf('<div class="guide-card-grid"', at + 1)) {
    const end = balanced(s, at, 'div');
    s = s.slice(0, at) + s.slice(at, end).replace(/class="app-card"/g, 'class="guide-card"') + s.slice(end);
  }
  s = s.replace(/<section class="app-card"([^>]*)>/g, '<section class="section prose"$1>');
  s = s.replace(/<section(?: style="[^"]*")?>/g, '<section class="section prose">');

  // Related tools block (four tool pages)
  s = s.replace(/<section class="related-tools-section"[^>]*>([\s\S]*?)<\/section>/g, (all, inner) => {
    const title = (inner.match(/<h2>([\s\S]*?)<\/h2>/) || [])[1] || 'Related tools';
    const cards = [...inner.matchAll(/<a href="([^"]+)" class="app-card"[^>]*>\s*<h3>(?:<i[^>]*><\/i>\s*)?([\s\S]*?)<\/h3>\s*<p[^>]*>([\s\S]*?)<\/p>\s*<\/a>/g)]
      .map(m => `          <a href="${m[1]}" class="guide-card"><strong>${m[2].trim()}</strong><p>${m[3].trim()}</p></a>`).join('\n');
    return `<section class="section related-tools" aria-labelledby="relatedToolsHeading">
        <h2 class="section-title" id="relatedToolsHeading">${title}</h2>
        <div class="guide-card-grid">
${cards}
        </div>
      </section>`;
  });

  // Tables scroll inside their own wrapper
  s = s.replace(/<div style="overflow-x: ?auto[^"]*">\s*(<table[\s\S]*?<\/table>)\s*<\/div>/g, '<div class="table-wrap">$1</div>');
  s = s.replace(/(<div class="table-wrap">\s*)?<table([^>]*)>([\s\S]*?)<\/table>(\s*<\/div>)?/g, (all, open, attrs, body) =>
    `<div class="table-wrap"><table${attrs.replace(/\s*class="[^"]*"/, '').replace(/\s*style="[^"]*"/, '')}>${body}</table></div>`);

  // Utility and legacy classes
  s = s.replace(/class="hero-title"/g, 'class="page-title"').replace(/class="hero-subtitle"/g, 'class="page-lede"');
  s = s.replace(/ class="(text-muted) mt-[12]"/g, ' class="$1"').replace(/ class="mt-[12]"/g, '');
  s = s.replace(/btn btn-outline-primary/g, 'btn').replace(/btn btn-success/g, 'btn btn-primary');
  s = s.replace(/<article class="guide-content">/g, '<article class="article">');

  // Inline styles are never part of the design system.
  s = s.replace(/ style="[^"]*"/g, '');
  return s;
}

module.exports = { modernize };

if (require.main === module) {
  const READ_CLASS = 'page page--read';
  let converted = 0;
  for (const page of pages) {
    const file = path.join(root, page);
    const html = fs.readFileSync(file, 'utf8');
    const m = html.match(/<main id="mainContent" class="([^"]*)">([\s\S]*?)<\/main>/);
    if (!m) throw new Error(`${page}: no <main>`);
    if (/^page\b/.test(m[1])) continue;
    const inner = m[2];
    // Workspaces are generated elsewhere and left untouched here.
    const parts = inner.split(/(<!-- tool:start -->[\s\S]*?<!-- tool:end -->)/);
    const out = parts.map(p => (p.startsWith('<!-- tool:start -->') ? p : modernize(p, page))).join('');
    const before = visibleText(inner.replace(/<!-- tool:start -->[\s\S]*?<!-- tool:end -->/, ''));
    const after = visibleText(out.replace(/<!-- tool:start -->[\s\S]*?<!-- tool:end -->/, ''));
    if (before !== after) {
      const a = before.split(' '), b = after.split(' ');
      let i = 0; while (i < a.length && a[i] === b[i]) i++;
      throw new Error(`${page}: visible text changed near "${a.slice(Math.max(0, i - 4), i + 6).join(' ')}" vs "${b.slice(Math.max(0, i - 4), i + 6).join(' ')}"`);
    }
    const mainClass = isReading(page) ? READ_CLASS : 'page';
    fs.writeFileSync(file, html.replace(m[0], `<main id="mainContent" class="${mainClass}">${out}</main>`));
    converted++;
  }
  console.log(`content converted on ${converted} pages`);
}
