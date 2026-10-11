#!/usr/bin/env node
/* Rewrites the tool section of every image resizer page (home, resize-to-KB, exam sizes, Hindi)
   with the shared workspace from scripts/lib/image-workspace.js. Page copy (headings, tables,
   FAQs) is left alone. Safe to re-run: it replaces the section between its own markers. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { renderWorkspace, PRESETS } = require('./lib/image-workspace');

const root = path.resolve(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const write = (f, s) => fs.writeFileSync(path.join(root, f), s);
const decode = s => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');

function balanced(html, from, tag) {
  const re = new RegExp(`<${tag}\\b|</${tag}>`, 'g');
  re.lastIndex = from;
  let depth = 0, m;
  while ((m = re.exec(html))) {
    if (m[0][1] !== '/') depth++;
    else if (--depth === 0) return m.index + m[0].length;
  }
  throw new Error(`unbalanced <${tag}>`);
}

const START = '<!-- tool:start -->';
const END = '<!-- tool:end -->';

function buildToolSection(page, html) {
  const lang = /<html lang="hi"/.test(html) ? 'hi' : 'en';
  let start, end;
  if (html.includes(START)) { start = html.indexOf(START); end = html.indexOf(END) + END.length; }
  else {
    start = html.search(/[ \t]*<section id="resize-tool"/);
    if (start < 0) throw new Error(`${page}: no #resize-tool section`);
    // The section ends after the preview panel. Four Hindi pages never closed the app container
    // or the section, so close it here instead of trusting the old markup.
    const previewAt = html.indexOf('<section class="preview-panel"', start);
    if (previewAt < 0) throw new Error(`${page}: no preview panel`);
    const previewEnd = balanced(html, previewAt, 'section');
    const closers = html.slice(previewEnd).match(/^\s*<\/div>\s*<\/section>/);
    end = previewEnd + (closers ? closers[0].length : 0);
  }
  const old = html.slice(start, end);
  const g = (re, i = 1) => { const m = old.match(re); return m ? m[i] : ''; };

  let heading = g(/<h2[^>]*>([\s\S]*?)<\/h2>/);
  let lede = g(/<p class="text-muted"[^>]*>([\s\S]*?)<\/p>/);
  const app = g(/id="resizerApp"([^>]*)>/);
  const preset = (app.match(/data-preset="([^"]+)"/) || [])[1];
  const maxKB = (app.match(/data-max-kb="([^"]+)"/) || [])[1];
  const select = g(/<select id="presetSelect"[\s\S]*?<\/select>/, 0);
  let options = [...select.matchAll(/<option value="([^"]+)"[^>]*>([\s\S]*?)<\/option>/g)].map(m => [m[1], decode(m[2].trim())]);
  if (lang === 'en') options = options.map(([v]) => [v, v === 'custom' ? 'Custom size' : (PRESETS[v] ? PRESETS[v].name : v)]);
  else options = options.map(([v, label]) => [v, v === 'custom' ? 'कस्टम साइज़' : label]);
  if (!preset || !options.length) throw new Error(`${page}: could not read preset setup`);
  let chips = [...g(/<div class="preset-choice">[\s\S]*?<\/div>/, 0).matchAll(/data-preset="([^"]+)"/g)].map(m => m[1]);
  if (!chips.length) chips = options.map(o => o[0]).filter(v => v !== 'custom').slice(0, 5);
  const workspace = renderWorkspace({ lang, preset, maxKB, options, chips, sample: false });
  return {
    start, end,
    markup: `${START}
      <section class="section" id="resize-tool" aria-labelledby="toolHeading">
        <h2 class="section-title" id="toolHeading">${heading}</h2>${lede ? `
        <p class="section-lede">${lede}</p>` : ''}
        ${workspace}
      </section>
      ${END}`
  };
}

const pages = fs.readdirSync(root).filter(f => /^(resize-image-to-\d+kb|[a-z]+-photo-signature-size)\.html$/.test(f))
  .concat(fs.readdirSync(path.join(root, 'hi')).filter(f => f.endsWith('.html')).map(f => 'hi/' + f));

for (const page of pages) {
  const html = read(page);
  const { start, end, markup } = buildToolSection(page, html);
  write(page, html.slice(0, start) + markup + html.slice(end));
  console.log('tool section rebuilt:', page);
}

/* Home page: new page head and workspace in place of the hero, preset bar and two-card grid. */
(function buildHome() {
  const page = 'index.html';
  let html = read(page);
  const markup = `${START}
    <header class="page-head">
      <h1 class="page-title">Resize Photo &amp; Signature to 20KB / 50KB for Online Forms</h1>
      <p class="page-lede">The right dimensions. The right file size. Ready to upload.</p>
      <p class="assurance"><i class="fa-solid fa-lock" aria-hidden="true"></i> Your files stay on your device. Free, no sign-up, works offline.</p>
    </header>

    ${renderWorkspace({
      lang: 'en', preset: 'custom', sample: true,
      options: ['custom', 'passport', 'signature', 'thumb', 'declaration', 'avatar', 'web-banner', 'document'].map(v => [v, v === 'custom' ? 'Custom size' : PRESETS[v].name]),
      chips: ['passport', 'signature', 'thumb', 'declaration', 'avatar', 'document']
    })}
    ${END}`;
  if (html.includes(START)) {
    html = html.slice(0, html.indexOf(START)) + markup + html.slice(html.indexOf(END) + END.length);
  } else {
    const headerAt = html.indexOf('<header class="hero-header workspace-hero">');
    const gridAt = html.indexOf('<div class="resizer-grid">');
    if (headerAt < 0 || gridAt < 0) throw new Error('home page layout not recognised');
    const gridEnd = balanced(html, gridAt, 'div');
    const lineStart = html.lastIndexOf('\n', headerAt) + 1;
    html = html.slice(0, lineStart) + '    ' + markup + html.slice(gridEnd);
  }
  write(page, html);
  console.log('tool section rebuilt:', page);
})();
