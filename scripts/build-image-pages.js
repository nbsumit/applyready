#!/usr/bin/env node
/* Rewrites the tool section of every image resizer page (home, resize-to-KB, exam sizes, Hindi)
   with the shared workspace from scripts/lib/image-workspace.js. Page copy (headings, tables,
   FAQs) is left alone. Safe to re-run: it replaces the section between its own markers. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { renderWorkspace, choiceFor, PRESETS } = require('./lib/image-workspace');

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

// What each exam page offers, when it is not simply that exam's photo and signature.
// SSC captures the photo live in its application module, so only the signature is a file.
// No RRB notice could be opened and checked, so the RRB page offers only a custom size.
const PAGE_CHOICES = {
  'ssc-photo-signature-size.html': ['ssc-signature'],
  'ibps-photo-signature-size.html': ['ibps-photo', 'ibps-signature', 'thumb', 'declaration'],
  'rrb-photo-signature-size.html': []
};

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

  const heading = g(/<h2[^>]*>([\s\S]*?)<\/h2>/);
  const lede = g(/<p class="(?:text-muted|section-lede)"[^>]*>([\s\S]*?)<\/p>/);
  const app = g(/id="resizerApp"([^>]*)>/);
  const preset = (app.match(/data-preset="([^"]+)"/) || [])[1];
  const maxKB = (app.match(/data-max-kb="([^"]+)"/) || [])[1];
  const select = g(/<select id="presetSelect"[\s\S]*?<\/select>/, 0);
  let options = [...select.matchAll(/<option value="([^"]+)"[^>]*>([\s\S]*?)<\/option>/g)].map(m => [m[1], decode(m[2].trim())]);
  if (lang === 'en') options = options.map(([v]) => [v, v === 'custom' ? 'Custom size' : (PRESETS[v] ? PRESETS[v].name : v)]);
  else options = options.map(([v, label]) => [v, v === 'custom' ? 'कस्टम साइज़' : label]);
  if (!preset || !options.length) throw new Error(`${page}: could not read preset setup`);
  // An exam page offers that exam's photo and signature; a size page offers its target and the two common uploads.
  let choices = options.map(o => o[0]).filter(v => v !== 'custom');
  const exam = choices.filter(v => /^(ssc|upsc|ibps|neet|rrb)-/.test(v));
  if (exam.length) choices = exam;
  // Some exam pages offer a different set than the old markup: see PAGE_CHOICES.
  const override = PAGE_CHOICES[page.replace(/^hi\//, '')];
  let first = preset;
  if (override) {
    const labels = new Map(options);
    choices = override;
    options = [...override, 'custom'].map(v => [v, v === 'custom' ? (lang === 'hi' ? 'कस्टम साइज़' : 'Custom size') : (lang === 'hi' && labels.has(v) ? labels.get(v) : PRESETS[v].name)]);
    first = override[0] || 'custom';
  }
  // Hindi labels are written from the presets too, so a changed limit never leaves an old figure behind.
  if (lang === 'hi') options = options.map(([v, label]) => { const c = v !== 'custom' && choiceFor(v, 'hi'); return [v, c ? `${c.label} (${c.spec})` : label]; });
  // The shared KB page offers several targets, so it asks which one instead of preselecting.
  const multi = page === 'resize-image-to-kb-limit.html';
  if (multi) choices = choices.filter(v => /^kb-/.test(v));
  const workspace = renderWorkspace({ lang, preset: multi ? 'custom' : first, maxKB: multi ? undefined : maxKB, options, choices, sample: false, requireChoice: multi });
  const markup = `${START}
      <section class="section tool-section" id="resize-tool" aria-labelledby="toolHeading">
        <h2 class="section-title" id="toolHeading">${heading}</h2>${lede ? `
        <p class="section-lede">${lede}</p>` : ''}
        ${workspace}
      </section>
      ${END}`;

  // The tool comes straight after the page head; reference content follows it.
  let rest = html.slice(0, start) + html.slice(end);
  rest = rest.replace(/[ \t]*<!-- Interactive Resizer Tool[^>]*-->\s*\n?/g, '');
  rest = rest.replace(/\s*<p class="tool-jump">[\s\S]*?<\/p>/, '');
  const headAt = rest.indexOf('<header class="page-head">');
  if (headAt < 0) throw new Error(`${page}: no page head`);
  const headEnd = rest.indexOf('</header>', headAt) + '</header>'.length;
  return rest.slice(0, headEnd) + '\n      ' + markup + rest.slice(headEnd);
}

// Redirect stubs (pages merged into another one) have no tool and are skipped.
const isStub = f => /<meta http-equiv="refresh"/.test(read(f));
const pages = fs.readdirSync(root).filter(f => /^(resize-image-to-(\d+kb|kb-limit)|[a-z]+-photo-signature-size)\.html$/.test(f))
  .concat(fs.readdirSync(path.join(root, 'hi')).filter(f => f.endsWith('.html')).map(f => 'hi/' + f))
  .filter(f => !isStub(f));

for (const page of pages) {
  write(page, buildToolSection(page, read(page)));
  console.log('tool section rebuilt:', page);
}

/* Home page: a compact introduction, the workspace, then the rest of the product. */
const FAMILY = [
  ['signature-cleaner.html', 'fa-signature', 'Signature cleaner', 'White paper, dark ink, no shadows'],
  ['passport-photo-print.html', 'fa-print', 'Passport photo print', 'A sheet of copies to print'],
  ['image-to-pdf.html', 'fa-file-pdf', 'Image to PDF', 'Combine photos and scans'],
  ['compress-pdf.html', 'fa-compress', 'Compress PDF', 'Fit a portal size limit'],
  ['resume.html', 'fa-file-lines', 'Resume builder', 'ATS-friendly, PDF and Word']
];
(function buildHome() {
  const page = 'index.html';
  let html = read(page);
  const family = FAMILY.map(([href, icon, name, desc]) => `        <li><a href="${href}"><i class="fa-solid ${icon}" aria-hidden="true"></i><span class="toolset__name">${name}</span><span class="toolset__desc">${desc}</span></a></li>`).join('\n');
  const markup = `${START}
    <header class="page-head page-head--home">
      <h1 class="page-title">Resize Photo &amp; Signature to 20KB / 50KB for Online Forms</h1>
      <p class="page-lede">Choose what your form asks for, add your photo or signature, and download a file with the exact pixel size and KB limit. Free, with no sign-up.</p>
    </header>

    ${renderWorkspace({
      lang: 'en', preset: 'custom', sample: true, level: 2, requireChoice: true,
      options: ['custom', 'passport', 'signature', 'thumb', 'declaration', 'avatar', 'web-banner', 'document'].map(v => [v, v === 'custom' ? 'Custom size' : PRESETS[v].name]),
      choices: ['passport', 'signature', 'thumb', 'declaration', 'avatar', 'document', 'web-banner']
    })}

    <section class="toolset" aria-labelledby="toolsetHeading">
      <h2 class="toolset__title" id="toolsetHeading">More for your application</h2>
      <ul class="toolset__list">
${family}
      </ul>
    </section>
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
