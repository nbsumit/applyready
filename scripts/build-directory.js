#!/usr/bin/env node
/* Writes the tool listings on the home page (index.html) and the tool directory (tools.html)
   from scripts/lib/tools.js, between <!-- directory:NAME:start --> / <!-- directory:NAME:end -->
   markers. Page copy around the markers is hand-written. `--check` exits 1 when out of date. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { CATEGORIES, liveTools, toolsIn, presetsOf } = require('./lib/tools');

const root = path.resolve(__dirname, '..');
const check = process.argv.includes('--check');
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// A tool card. In the directory, a tool with preset pages (the image resizer and its 20 KB, 50 KB
// and any-KB pages) lists them under the card, so every page is one click from tools.html and the
// filter can find them (each link carries its own data-tool).
function toolCard(t, headingLevel, { presets = false } = {}) {
  const h = `h${headingLevel}`;
  const extra = presets ? presetsOf(t.id) : [];
  // The link reads "20 KB" on screen and "Resize image to 20 KB" to a screen reader.
  const lead = p => (p.name.toLowerCase().endsWith(p.preset.toLowerCase()) ? p.name.slice(0, -p.preset.length).trim() : p.name);
  const row = extra.length ? `
            <p class="tool-card__presets"><span class="tool-card__presets-label">Common limits:</span> ${extra.map(p => `<a href="${p.path}" data-tool="${p.id}"><span class="sr-only">${esc(lead(p))} </span>${esc(p.preset)}</a>`).join(' ')}</p>` : '';
  return `          <li class="tool-card${extra.length ? ' tool-card--presets' : ''}" data-tool="${t.id}">
            <a class="tool-card__link" href="${t.path}">
              <span class="tool-card__icon" aria-hidden="true"><i class="fa-solid fa-${t.icon}"></i></span>
              <span class="tool-card__body"><${h} class="tool-card__name">${esc(t.name)}</${h}><span class="tool-card__desc">${esc(t.summary)}</span></span>
            </a>${row}
          </li>`;
}

// Home: one entry point per category with its first tools, so nothing needs a long scroll.
function homeCategories() {
  const cards = CATEGORIES.map(c => {
    const tools = toolsIn(c.id);
    if (!tools.length) return '';
    const shown = tools.slice(0, 4);
    const more = tools.length - shown.length;
    return `        <li class="cat-card" id="home-${c.id}">
          <h3 class="cat-card__title"><span class="cat-card__icon" aria-hidden="true"><i class="fa-solid fa-${c.icon}"></i></span><a href="tools.html#${c.id}">${esc(c.name)}</a></h3>
          <p class="cat-card__summary">${esc(c.summary)}</p>
          <ul class="cat-card__tools">
${shown.map(t => `            <li><a href="${t.path}">${esc(t.name)}</a></li>`).join('\n')}
          </ul>${more > 0 ? `
          <a class="cat-card__more" href="tools.html#${c.id}">${more} more <span class="sr-only">${esc(c.name.toLowerCase())}</span><i class="fa-solid fa-arrow-right" aria-hidden="true"></i></a>` : ''}
        </li>`;
  }).filter(Boolean).join('\n');
  return `      <ul class="cat-grid">\n${cards}\n      </ul>`;
}

function homePopular() {
  const tools = liveTools().filter(t => t.popular).sort((a, b) => a.popular - b.popular).slice(0, 6);
  return `        <ul class="tool-grid tool-grid--compact" id="popularTools">\n${tools.map(t => toolCard(t, 3)).join('\n')}\n        </ul>`;
}

// Directory: every category with every tool; a tool listed under two categories appears in both
// (the filter shows it once, in its own category).
function directory() {
  return CATEGORIES.map(c => {
    const tools = toolsIn(c.id);
    if (!tools.length) return '';
    return `      <section class="dir-section" id="${c.id}" aria-labelledby="dir-${c.id}">
        <div class="dir-section__head">
          <h2 class="dir-section__title" id="dir-${c.id}"><i class="fa-solid fa-${c.icon}" aria-hidden="true"></i> ${esc(c.name)}</h2>
          <p class="dir-section__summary">${esc(c.summary)}</p>
        </div>
        <ul class="tool-grid">
${tools.map(t => toolCard(t, 3, { presets: t.category === c.id })).join('\n')}
        </ul>
      </section>`;
  }).filter(Boolean).join('\n');
}

function categoryNav() {
  return `      <nav class="dir-nav" aria-label="Categories">\n        <ul>\n${CATEGORIES.filter(c => toolsIn(c.id).length).map(c => `          <li><a href="#${c.id}">${esc(c.name)} <span class="dir-nav__count">${toolsIn(c.id).length}</span></a></li>`).join('\n')}\n        </ul>\n      </nav>`;
}

const BLOCKS = {
  'index.html': { 'home-categories': homeCategories, 'home-popular': homePopular },
  'tools.html': { 'categories-nav': categoryNav, 'all-tools': directory }
};

let changed = 0;
for (const [page, blocks] of Object.entries(BLOCKS)) {
  const file = path.join(root, page);
  if (!fs.existsSync(file)) continue;
  const before = fs.readFileSync(file, 'utf8');
  let html = before;
  for (const [name, fn] of Object.entries(blocks)) {
    const re = new RegExp(`(<!-- directory:${name}:start -->)[\\s\\S]*?(\\s*<!-- directory:${name}:end -->)`);
    if (!re.test(html)) throw new Error(`${page}: missing <!-- directory:${name}:start/end --> markers`);
    html = html.replace(re, (m, a, b) => `${a}\n${fn()}${b}`);
  }
  if (html !== before) {
    changed++;
    if (check) console.error(`out of date: ${page}`);
    else { fs.writeFileSync(file, html); console.log('directory written:', page); }
  }
}
if (check && changed) process.exit(1);
if (check) console.log('tool listings in sync');
