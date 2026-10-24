/* Site content checks that matter for search and ad-network review. No browser needed. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
let checks = 0;
const ok = (c, m) => { assert(c, m); checks++; };

const list = (dir, base = '') => fs.readdirSync(path.join(root, dir)).filter(f => f.endsWith('.html')).map(f => path.posix.join(base, f));
const pages = [...list('.'), ...list('guides', 'guides'), ...list('hi', 'hi'), ...list('author', 'author')];
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const textOf = s => (s.match(/<main[\s\S]*?<\/main>/) || [s])[0].replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<nav[\s\S]*?<\/nav>/g, ' ').replace(/<[^>]+>/g, ' ');
const words = s => (textOf(s).match(/[A-Za-z0-9ऀ-ॿ][\w'ऀ-ॿ-]*/g) || []).length;
const SITE = 'https://applyready.in';
const utility = new Set(['404.html', 'offline.html']);
// Redirect stubs (merged pages) carry a meta refresh and a canonical to the page that replaced them.
const isStub = s => /<meta http-equiv="refresh"/i.test(s);
const isNoindex = s => /<meta name="robots" content="[^"]*noindex/i.test(s);
const stubs = new Set(pages.filter(f => isStub(read(f))));
const indexable = new Set(pages.filter(f => !utility.has(f) && !isStub(read(f)) && !isNoindex(read(f))));

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
    if (stubs.has(f)) {
      const target = (canonical || '').replace(SITE + '/', '');
      ok(isNoindex(s) && indexable.has(target), `${f}: a redirect stub must be noindex with a canonical to an indexable page (${canonical})`);
      const refresh = (s.match(/<meta http-equiv="refresh" content="0;\s*url=([^"#]*)/i) || [])[1];
      ok(refresh && path.posix.normalize(path.posix.join(path.posix.dirname(f), refresh)) === target, `${f}: meta refresh should go to its canonical page`);
    } else ok(canonical === expected, `${f}: canonical ${canonical} should be ${expected}`);
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
  if (indexable.has(f)) ok(locs.includes(url), `${f}: missing from sitemap.xml`);
  else ok(!locs.includes(url), `${f}: noindex or redirect pages must not be in sitemap.xml`);
  if (f.startsWith('guides/') && !stubs.has(f)) ok(sw.includes(`'/${f}'`), `${f}: missing from the service worker precache`);
  if (stubs.has(f)) ok(!sw.includes(`'/${f}'`), `${f}: redirect stubs should not be precached`);
}
for (const l of locs) {
  const f = l === SITE + '/' ? 'index.html' : l.endsWith('/') ? l.replace(SITE + '/', '') + 'index.html' : l.replace(SITE + '/', '');
  ok(exists(f), `sitemap lists a page that does not exist: ${l}`);
  ok(indexable.has(f), `sitemap lists a page that is noindex or a redirect: ${l}`);
}
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
  // Ad units are placed by scripts/enable-ads.js after approval. Until then every slot is an empty placeholder;
  // afterwards a live unit is only allowed inside a labelled slot, with a real unit id, and never in a tool.
  const live = s.replace(/<!--[\s\S]*?-->/g, '').match(/<ins class="adsbygoogle"[^>]*>/g) || [];
  for (const unit of live) ok(/data-ad-slot="\d{6,}"/.test(unit) && !/1234567890/.test(unit), `${f}: ad unit without a real slot id`);
  const slots = (s.match(/<div class="ad-slot-container/g) || []).length;
  ok(slots <= 2, `${f}: ${slots} ad slots (keep ads clearly secondary to the content)`);
  ok(live.length <= slots, `${f}: ad unit outside a labelled slot`);
  ok(!utility.has(f) || slots === 0, `${f}: ad slot on a page without publisher content`);
  ok(f !== 'resume.html' || slots === 0, 'the resume builder carries no ad slots');
  for (const m of s.matchAll(/<div class="ad-slot-container[^"]*"([^>]*)>/g)) ok(/role="complementary"/.test(m[1]) && /aria-label="Advertisement"/.test(m[1]), `${f}: ad slot is not labelled`);
  ok(!/<section class="ws"[^>]*>(?:(?!<\/section>)[\s\S])*ad-slot-container/.test(s), `${f}: ad slot inside a tool workspace`);
  const body = textOf(s).toLowerCase();
  ok(!/click (on )?(the |our )?ads?\b|support us by clicking|please click/.test(body), `${f}: asks visitors to click ads`);
  if (!utility.has(f)) for (const link of ['privacy.html', 'terms.html', 'about.html', 'contact.html']) ok(s.includes(link), `${f}: footer link to ${link}`);
}

// 5. Depth of content: guides and landing pages are not thin
for (const f of pages) {
  if (stubs.has(f)) continue;
  const n = words(read(f));
  if (f.startsWith('guides/') && f !== 'guides/index.html') ok(n >= 600, `${f}: only ${n} words`);
  if (/^(resize-image-to-(\d+kb|kb-limit)|[a-z]+-photo-signature-size)\.html$/.test(f)) ok(n >= 600, `${f}: only ${n} words`);
  if (f.startsWith('hi/')) ok(n >= 600, `${f}: only ${n} words`);
}
const guides = pages.filter(f => f.startsWith('guides/') && f !== 'guides/index.html' && indexable.has(f));
ok(guides.length >= 20, `at least 20 indexable guides (found ${guides.length})`);

// 6. Guides: a visible byline linking the author page, dates that match the structured data,
//    an original visual, a Sources section with an outside link, and links to a tool and other guides.
const ldDate = (s, key) => ((s.match(new RegExp(`"${key}": "(\\d{4}-\\d{2}-\\d{2})`)) || [])[1]);
const bodyOf = s => (s.match(/<main[\s\S]*?<\/main>/) || [''])[0].replace(/<section class="related-guides-section"[\s\S]*?<\/section>/, '');
for (const f of guides) {
  const s = read(f);
  ok(s.includes('"@type": "Article"') && /"author": \{[^}]*"@id": "https:\/\/applyready\.in\/author\/sumit-sengar\.html#person"/.test(s), `${f}: Article structured data with the author's Person id`);
  ok(s.includes('"BreadcrumbList"') && s.includes('class="breadcrumb-nav"'), `${f}: breadcrumbs, visible and structured`);
  const meta = (s.match(/<p class="guide-meta">([\s\S]*?)<\/p>/) || [])[1] || '';
  ok(/By <a href="\.\.\/author\/sumit-sengar\.html" rel="author">Sumit Sengar<\/a>/.test(meta), `${f}: visible byline links the author page`);
  const times = [...meta.matchAll(/<time datetime="(\d{4}-\d{2}-\d{2})">/g)].map(m => m[1]);
  ok(times.length === 2 && times[0] === ldDate(s, 'datePublished') && times[1] === ldDate(s, 'dateModified'), `${f}: Published and Last updated dates match datePublished and dateModified (${times} vs ${ldDate(s, 'datePublished')}, ${ldDate(s, 'dateModified')})`);
  ok(times[0] <= times[1], `${f}: last updated is not before published`);
  const body = bodyOf(s);
  ok(/<figure class="shot">[\s\S]*?(<img [^>]*width="\d+" height="\d+" alt="[^"]{20,}" loading="lazy"|<svg [^>]*role="img")/.test(body), `${f}: at least one original visual with size and alt text`);
  const sources = (body.match(/<h2 id="sourcesHeading">Sources<\/h2>[\s\S]*?<\/section>/) || [''])[0];
  ok(/href="https:\/\/(?!applyready\.in)[^"]+"/.test(sources), `${f}: a Sources section with at least one outside source`);
  ok(/href="\.\.\/(index|signature-cleaner|passport-photo-print|image-to-pdf|compress-pdf|resume|resize-image-to-[a-z0-9-]+)\.html"/.test(body), `${f}: links its matching tool in the body`);
  const guideLinks = new Set([...body.matchAll(/href="([a-z0-9-]+\.html)"/g)].map(m => m[1]).filter(h => h !== path.posix.basename(f)));
  ok(guideLinks.size >= 2, `${f}: links at least two other guides in the body (${guideLinks.size})`);
  ok(/Report an error<\/a>/.test(body), `${f}: a Report an error link`);
}

// 6a. Every indexable page is linked from the body text of at least three other pages
//     (navigation, footer, breadcrumbs, related-link cards and the tool itself do not count).
{
  const inbound = new Map([...indexable].map(f => [f, new Set()]));
  for (const f of pages) {
    let body = (read(f).match(/<main[\s\S]*?<\/main>/) || [''])[0];
    body = body.replace(/<nav class="breadcrumb-nav"[\s\S]*?<\/nav>|<section class="related-guides-section"[\s\S]*?<\/section>|<!-- tool:start -->[\s\S]*?<!-- tool:end -->/g, '');
    const dir = path.posix.dirname(f);
    for (const m of body.matchAll(/href="([^"#?]+)/g)) {
      let h = m[1];
      if (/^(https?:|mailto:)/.test(h)) continue;
      let t = h === '/' ? 'index.html' : path.posix.normalize(path.posix.join(dir === '.' ? '' : dir, h));
      if (t === '.' || t === './' || t === '..') t = 'index.html';
      if (t.endsWith('/')) t += 'index.html';
      if (!t.endsWith('.html')) t = t + '/index.html';
      if (inbound.has(t) && t !== f) inbound.get(t).add(f);
    }
  }
  for (const [f, from] of inbound) ok(f === 'index.html' || from.size >= 3, `${f}: linked from the body of only ${from.size} other pages`);
}

// 6b. Exam pages say which notice they were last checked against, link a way to report an error, and cite sources.
for (const f of pages.filter(f => /^[a-z]+-photo-signature-size\.html$/.test(f))) {
  const s = read(f);
  ok(/<p class="checked-line"><strong>Last checked against:<\/strong>[^<]*\d{4}/.test(s) && /Report an error<\/a>/.test(s), `${f}: Last checked line with a report link`);
  ok(/<ul class="sources-list">[\s\S]*?href="https:\/\/(?!applyready)/.test(s), `${f}: sources list with official links`);
}

// 7. No leftover placeholder text on public pages
for (const f of pages) {
  const t = textOf(read(f));
  ok(!/lorem ipsum|TODO|FIXME|\[Company\]\b.*\[Role\]\b.*\[Name\]/i.test(t.replace(/\[Company\]|\[College\]|\[website\]|\[specific area\]|\[number\]|\[email\]/g, '')), `${f}: placeholder text`);
}

// 7b. Landing pages put the tool straight after the page head, before the reference content
for (const f of pages.filter(f => /(^|\/)(resize-image-to-(\d+kb|kb-limit)|[a-z]+-photo-signature-size)\.html$/.test(f) && !stubs.has(f))) {
  const s = read(f);
  const head = s.indexOf('</header>', s.indexOf('<header class="page-head">'));
  const tool = s.indexOf('<!-- tool:start -->');
  const prose = s.indexOf('class="section prose"');
  ok(head > 0 && tool > head && /^\s*$/.test(s.slice(head + '</header>'.length, tool)) && (prose < 0 || tool < prose), `${f}: the tool follows the page head, before the reference content`);
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
// Every page has balanced tags (a stray or missing closer silently changes the layout)
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr', 'param']);
for (const f of pages) {
  const html = read(f).replace(/<!--[\s\S]*?-->|<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, '');
  const stack = [];
  const problems = [];
  for (const m of html.matchAll(/<(\/?)([a-zA-Z][a-zA-Z0-9-]*)\b[^>]*?(\/?)>/g)) {
    const [, close, tag, self] = m; const name = tag.toLowerCase();
    if (VOID.has(name) || self) continue;
    if (!close) { stack.push(name); continue; }
    const at = stack.lastIndexOf(name);
    if (at < 0) problems.push(`stray </${name}>`); else { for (const open of stack.splice(at + 1)) problems.push(`unclosed <${open}>`); stack.pop(); }
  }
  problems.push(...stack.map(t => `unclosed <${t}>`));
  ok(problems.length === 0, `${f}: unbalanced markup (${problems.slice(0, 3).join(', ')})`);
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
