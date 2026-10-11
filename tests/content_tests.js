/* Site content checks that matter for search and ad-network review. No browser needed. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
let checks = 0;
const ok = (c, m) => { assert(c, m); checks++; };

const list = (dir, base = '') => fs.readdirSync(path.join(root, dir)).filter(f => f.endsWith('.html')).map(f => path.posix.join(base, f));
const pages = [...list('.'), ...list('guides', 'guides'), ...list('hi', 'hi')];
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const textOf = s => (s.match(/<main[\s\S]*?<\/main>/) || [s])[0].replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<nav[\s\S]*?<\/nav>/g, ' ').replace(/<[^>]+>/g, ' ');
const words = s => (textOf(s).match(/[A-Za-z0-9ऀ-ॿ][\w'ऀ-ॿ-]*/g) || []).length;
const SITE = 'https://applyready.in';
const utility = new Set(['404.html', 'offline.html']);

// 1. Every page: language, title, description, canonical, one h1
const titles = new Map(), descriptions = new Map();
for (const f of pages) {
  const s = read(f);
  ok(/<html lang="(en|hi)"/.test(s), `${f}: html lang`);
  const title = (s.match(/<title>([\s\S]*?)<\/title>/) || [])[1];
  ok(title && title.trim().length >= 15 && title.length <= 110, `${f}: title length (${title && title.length})`);
  ok(!titles.has(title), `${f}: duplicate title with ${titles.get(title)}`); titles.set(title, f);
  if (!utility.has(f)) {
    const desc = (s.match(/<meta name="description" content="([^"]*)"/) || [])[1];
    ok(desc && desc.length >= 50 && desc.length <= 330, `${f}: description length (${desc && desc.length})`);
    ok(!descriptions.has(desc), `${f}: duplicate description with ${descriptions.get(desc)}`); descriptions.set(desc, f);
    const canonical = (s.match(/<link rel="canonical" href="([^"]*)"/) || [])[1];
    const expected = f === 'index.html' ? SITE + '/' : f === 'guides/index.html' ? SITE + '/guides/' : `${SITE}/${f}`;
    ok(canonical === expected, `${f}: canonical ${canonical} should be ${expected}`);
  }
  const h1s = (s.match(/<h1[\s>]/g) || []).length;
  ok(h1s === 1, `${f}: exactly one h1 (found ${h1s})`);
}

// 2. Internal links and assets resolve
const exists = p => fs.existsSync(path.join(root, p)) || fs.existsSync(path.join(root, p, 'index.html'));
for (const f of pages) {
  const s = read(f);
  const dir = path.posix.dirname(f);
  const ids = new Set([...s.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]));
  for (const m of s.matchAll(/(?:href|src)="([^"]+)"/g)) {
    let url = m[1];
    if (/^(https?:|mailto:|tel:|data:|blob:|javascript:|\/\/)/.test(url)) {
      if (url.startsWith(SITE)) url = url.slice(SITE.length) || '/';
      else continue;
    }
    if (url.startsWith('#')) { ok(ids.has(url.slice(1)) || url === '#', `${f}: missing anchor ${url}`); continue; }
    const [pathname, hash] = url.split('#');
    const clean = pathname.split('?')[0];
    const target = clean.startsWith('/') ? clean.slice(1) : path.posix.normalize(path.posix.join(dir === '.' ? '' : dir, clean));
    ok(target === '' || exists(target), `${f}: broken link ${url} (looked for ${target})`);
  }
}

// 3. Sitemap and offline cache list every public page
const sitemap = read('sitemap.xml');
const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
const sw = read('sw.js');
for (const f of pages) {
  if (utility.has(f)) continue;
  const url = f === 'index.html' ? SITE + '/' : f === 'guides/index.html' ? SITE + '/guides/' : `${SITE}/${f}`;
  ok(locs.includes(url), `${f}: missing from sitemap.xml`);
  if (f.startsWith('guides/')) ok(sw.includes(`'/${f}'`), `${f}: missing from the service worker precache`);
}
for (const l of locs) ok(exists(l.replace(SITE + '/', '')) || l === SITE + '/', `sitemap lists a page that does not exist: ${l}`);
ok(new Set(locs).size === locs.length, 'sitemap has duplicate URLs');

// 4. Ad network requirements
ok(/^google\.com, pub-\d+, DIRECT, f08c47fec0942fa0\s*$/m.test(read('ads.txt')), 'ads.txt has a valid DIRECT line');
for (const f of ['privacy.html', 'about.html', 'contact.html', 'terms.html']) ok(fs.existsSync(path.join(root, f)), `${f} exists`);
const privacy = textOf(read('privacy.html'));
for (const kw of ['AdSense', 'cookie', 'opt out', 'adssettings.google.com']) ok(privacy.includes(kw) || read('privacy.html').includes(kw), `privacy policy mentions ${kw}`);
for (const f of pages) {
  const s = read(f);
  const has = s.includes('pagead2.googlesyndication.com/pagead/js/adsbygoogle.js');
  ok(utility.has(f) ? !has : has, `${f}: AdSense loader should ${utility.has(f) ? 'not ' : ''}be present`);
  ok(!/<ins class="adsbygoogle"/.test(s.replace(/<!--[\s\S]*?-->/g, '')), `${f}: a live ad unit is present before approval`);
}

// 5. Depth of content: guides and landing pages are not thin
for (const f of pages) {
  const n = words(read(f));
  if (f.startsWith('guides/') && f !== 'guides/index.html') ok(n >= 600, `${f}: only ${n} words`);
  if (/^(resize-image-to-\d+kb|[a-z]+-photo-signature-size)\.html$/.test(f)) ok(n >= 600, `${f}: only ${n} words`);
  if (f.startsWith('hi/')) ok(n >= 600, `${f}: only ${n} words`);
}
const guideCount = pages.filter(f => f.startsWith('guides/') && f !== 'guides/index.html').length;
ok(guideCount >= 25, `at least 25 guides (found ${guideCount})`);

// 6. Guides carry author, review date and structured data
for (const f of pages.filter(f => f.startsWith('guides/') && f !== 'guides/index.html')) {
  const s = read(f);
  ok(s.includes('"@type": "Article"') && s.includes('"author"'), `${f}: Article structured data with author`);
  ok(s.includes('"BreadcrumbList"'), `${f}: breadcrumb structured data`);
}

// 7. No leftover placeholder text on public pages
for (const f of pages) {
  const t = textOf(read(f));
  ok(!/lorem ipsum|TODO|FIXME|\[Company\]\b.*\[Role\]\b.*\[Name\]/i.test(t.replace(/\[Company\]|\[College\]|\[website\]|\[specific area\]|\[number\]|\[email\]/g, '')), `${f}: placeholder text`);
}

// 8. One design system: shared stylesheet, generated shell in sync, no inline styling, no em dash in interface chrome
const { spawnSync } = require('node:child_process');
for (const f of pages) {
  const s = read(f);
  ok(/href="[^"]*css\/app\.css/.test(s), `${f}: loads css/app.css`);
  ok(!/css\/(style|workspace|design-system|ux|ui)\.css/.test(s), `${f}: references a retired stylesheet`);
  ok(f === 'resume.html' ? /css\/document\.css/.test(s) : !/css\/document\.css/.test(s), `${f}: css/document.css belongs to the resume builder only`);
  if (f !== 'resume.html') {
    const inline = (s.match(/ style="[^"]*"/g) || []).filter(x => !/^ style="(display: ?none;?|width: ?0%;?)"$/.test(x));
    ok(inline.length === 0, `${f}: inline styles other than script-controlled state (${inline[0]})`);
  }
  ok(/<header class="site-header"/.test(s) && /<footer class="site-footer"/.test(s), `${f}: shared header and footer`);
}
// The resume sheet, templates and print layout are the output format: change them on purpose, then update this hash.
ok(require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(root, 'css/document.css'))).digest('hex') === '8b569558fa22be9e9f0be8833bb6da023d6282930df6c23242d2f5b2279b388b', 'css/document.css (resume sheet and print layout) changed; confirm the exported resume is meant to change, then update the hash');
ok(!fs.existsSync(path.join(root, 'css/style.css')) && !fs.existsSync(path.join(root, 'css/workspace.css')), 'retired stylesheets are deleted');
const sync = spawnSync(process.execPath, [path.join(root, 'scripts/sync-shell.js'), '--check'], { encoding: 'utf8' });
ok(sync.status === 0, `shared header and footer are in sync on every page: ${sync.stdout}${sync.stderr}`);
for (const f of ['css/app.css', 'js/site.js', 'js/components.js', 'scripts/lib/shell.js', 'scripts/lib/image-workspace.js']) {
  ok(!read(f).includes('—'), `${f}: no em dash in interface code`);
}

console.log(`✓ ${pages.length} pages checked: titles, descriptions, canonicals, links, sitemap, offline cache, ad requirements, depth (${checks} assertions)`);
