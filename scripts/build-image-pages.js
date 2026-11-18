#!/usr/bin/env node
/* Writes the image resizer workspace into every page that hosts it, from
   scripts/lib/image-workspace.js, and the batch image workspace (scripts/lib/batch-workspace.js)
   into the batch processor, image compressor and image converter. Only the markup between <!-- tool:start --> and
   <!-- tool:end --> is replaced; page copy (headings, explanations, FAQs) is left alone.
   Safe to re-run. `--check` exits 1 if any page would change. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { renderWorkspace, PRESETS } = require('./lib/image-workspace');
const { renderBatchWorkspace } = require('./lib/batch-workspace');

const root = path.resolve(__dirname, '..');
const check = process.argv.includes('--check');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');

const START = '<!-- tool:start -->';
const END = '<!-- tool:end -->';

const GENERAL = ['passport', 'signature', 'avatar', 'thumb', 'declaration', 'document', 'web-banner'];
const optionsFor = keys => ['custom', ...keys].map(v => [v, v === 'custom' ? 'Custom size' : PRESETS[v].name]);

/* Each page that hosts the resizer and how it starts.
   heading/lede: a section heading above the workspace (pages whose h1 is about the topic, not the tool).
   level: heading level of the workspace's own step titles. */
const PAGES = {
  'image-resizer.html': { preset: 'custom', requireChoice: true, sample: true, level: 2, choices: GENERAL },
  'passport-photo-resizer.html': { preset: 'passport', level: 2, choices: ['passport', 'avatar'] },
  'signature-resizer.html': { preset: 'signature', level: 2, choices: ['signature', 'thumb', 'declaration'] },
  'resize-image-to-20kb.html': { preset: 'kb-20', maxKB: 20, choices: ['kb-20', 'passport', 'signature'], level: 2 },
  'resize-image-to-50kb.html': { preset: 'kb-50', maxKB: 50, choices: ['kb-50', 'passport', 'signature'], level: 2 },
  'resize-image-to-kb-limit.html': { preset: 'custom', requireChoice: true, choices: ['kb-10', 'kb-20', 'kb-50', 'kb-100', 'kb-200'], level: 2 }
};

function section(cfg) {
  const workspace = renderWorkspace({
    preset: cfg.preset, maxKB: cfg.maxKB, options: optionsFor(cfg.choices), choices: cfg.choices,
    sample: !!cfg.sample, requireChoice: !!cfg.requireChoice, level: cfg.heading ? 3 : (cfg.level || 2)
  });
  if (!cfg.heading) return `${START}\n    <section class="tool-section" id="resize-tool" aria-label="Image resizer">\n    ${workspace}\n    </section>\n    ${END}`;
  return `${START}
      <section class="section tool-section" id="resize-tool" aria-labelledby="toolHeading">
        <h2 class="section-title" id="toolHeading">${cfg.heading}</h2>
        <p class="section-lede">${cfg.lede}</p>
        ${workspace}
      </section>
      ${END}`;
}

/* The batch image engine (js/batch-image.js): one workspace, three pages with their own defaults
   and copy (scripts/lib/batch-workspace.js). */
const BATCH_PAGES = {
  'batch-image.html': 'batch',
  'compress-image.html': 'compress',
  'convert-image.html': 'convert'
};

const batchSection = mode => `${START}\n    <section class="tool-section" id="batch-tool" aria-label="Image tool">\n    ${renderBatchWorkspace(mode)}\n    </section>\n    ${END}`;

const jobs = [
  ...Object.entries(PAGES).map(([page, cfg]) => [page, () => section(cfg)]),
  ...Object.entries(BATCH_PAGES).map(([page, mode]) => [page, () => batchSection(mode)])
];

let changed = 0;
for (const [page, render] of jobs) {
  const file = path.join(root, page);
  if (!fs.existsSync(file)) continue; // pages are created by hand (scripts/new-page.js), then filled here
  const html = read(page);
  if (!html.includes(START) || !html.includes(END)) throw new Error(`${page}: missing ${START} / ${END} markers`);
  const next = html.slice(0, html.indexOf(START)) + render() + html.slice(html.indexOf(END) + END.length);
  if (next !== html) {
    changed++;
    if (check) console.error(`out of date: ${page}`);
    else { fs.writeFileSync(file, next); console.log('tool section rebuilt:', page); }
  }
}
if (check && changed) process.exit(1);
if (check) console.log('image tool sections in sync');

module.exports = { PAGES, BATCH_PAGES };
