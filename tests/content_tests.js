/* Site content checks: metadata, links, sitemap, offline cache, structure and the no-ads guarantee. No browser needed. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
let checks = 0;
// Every failure is collected and reported together, so one run shows everything that needs fixing.
const failures = [];
const ok = (c, m) => { checks++; if (!c) failures.push(m); };

const list = (dir, base = '') => fs.readdirSync(path.join(root, dir)).filter(f => f.endsWith('.html')).map(f => path.posix.join(base, f));
// Same directories as scripts/sync-shell.js (PAGE_DIRS).
const pages = [...list('.'), ...list('guides', 'guides')];
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const textOf = s => (s.match(/<main[\s\S]*?<\/main>/) || [s])[0].replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<nav[\s\S]*?<\/nav>/g, ' ').replace(/<[^>]+>/g, ' ');
const words = s => (textOf(s).match(/[A-Za-z0-9][\w'-]*/g) || []).length;
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
  ok(/<html lang="en"/.test(s), `${f}: html lang`);
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
  if (f.startsWith('guides/') && !stubs.has(f)) ok(sw.includes(`'/${f.replace(/index\.html$/, '')}'`), `${f}: missing from the service worker precache`);
  if (stubs.has(f)) ok(!sw.includes(`'/${f}'`), `${f}: redirect stubs should not be precached`);
}
for (const l of locs) {
  const f = l === SITE + '/' ? 'index.html' : l.endsWith('/') ? l.replace(SITE + '/', '') + 'index.html' : l.replace(SITE + '/', '');
  ok(exists(f), `sitemap lists a page that does not exist: ${l}`);
  ok(indexable.has(f), `sitemap lists a page that is noindex or a redirect: ${l}`);
}
ok(new Set(locs).size === locs.length, 'sitemap has duplicate URLs');

// 4. No advertising: no ad network script, tag, slot, record or crawler rule anywhere in what the site ships.
const AD_MARKERS = /adsbygoogle|googlesyndication|google-adsense|ca-pub-\d|pub-\d{10,}|doubleclick|googleadservices|googletagservices|adservice\.google|adtrafficquality|fundingchoices|Mediapartners-Google|ad-slot|ads\.js/i;
const jsIn = dir => fs.existsSync(path.join(root, dir)) ? fs.readdirSync(path.join(root, dir)).filter(f => f.endsWith('.js')).map(f => `${dir}/${f}`) : [];
const ownCode = [...jsIn('js'), ...jsIn('js/lib'), ...jsIn('js/workers'),
  ...fs.readdirSync(path.join(root, 'css')).filter(f => f.endsWith('.css')).map(f => 'css/' + f),
  ...jsIn('scripts'), ...jsIn('scripts/lib')];
const shipped = [...pages, 'robots.txt', 'sw.js', 'favicon/site.webmanifest', ...ownCode];
for (const f of shipped) {
  const m = read(f).match(AD_MARKERS);
  ok(!m, `${f}: no advertising code (found "${m && m[0]}")`);
}
for (const f of ['ads.txt', 'app-ads.txt', 'js/ads.js', 'scripts/enable-ads.js', 'scripts/place-ad-slots.js']) ok(!fs.existsSync(path.join(root, f)), `${f} is not shipped`);
for (const f of ['privacy.html', 'about.html', 'contact.html', 'terms.html']) ok(fs.existsSync(path.join(root, f)), `${f} exists`);
const privacyHtml = read('privacy.html');
const privacy = textOf(privacyHtml);
ok(/<h2 id="cookies">/.test(privacyHtml), 'privacy policy has a cookies heading');
ok(/shows no advertisements/.test(privacy) && /sets no cookies/.test(privacy), 'privacy policy says there are no ads and no cookies');
for (const f of ['privacy.html', 'terms.html', 'about.html']) ok(!/AdSense|advertising cookies|personalised ads/i.test(textOf(read(f))), `${f}: no advertising disclosure left over`);
ok(/local storage/i.test(privacy) && /[Ss]ervice [Ww]orker/.test(privacy), 'privacy policy still covers local storage and the service worker');
ok(/not use Google Analytics/.test(privacy), 'privacy policy still says there is no analytics');
const css = read('css/app.css');
const flatCss = css.replace(/\s+/g, '');
ok(/#resize-tool\{min-height:540px/.test(flatCss) && /#resize-tool\{min-height:640px/.test(flatCss), 'the resizer reserves its settled height');
ok(/href="\/assets\/fonts\/inter-latin\.woff2" as="font"/.test(read('index.html')) && /href="\/assets\/fonts\/inter-latin\.woff2" as="font"/.test(read('guides/index.html')) && /href="\/assets\/fonts\/inter-latin\.woff2" as="font"/.test(read('404.html')), 'Inter is preloaded from the site root');
{
  // ApplyReady is a job-application toolkit: no exam presets, pages or copy (removed in November 2026).
  const { PRESETS } = require('../js/presets.js');
  ok(Object.keys(PRESETS).every(k => !/^(ssc|upsc|ibps|neet|rrb|gate)-/.test(k)), 'no exam presets');
  ok(PRESETS.passport && PRESETS.signature, 'generic photo and signature presets exist');
  const EXAM = /\b(SSC|UPSC|IBPS|NEET|RRB|NTA|CGL|CHSL)\b|\bexams?\b|admit card|sarkari|हिन्दी/i;
  for (const f of [...pages, 'sw.js', 'robots.txt', 'sitemap.xml', 'README.md', ...ownCode].filter(f => fs.existsSync(path.join(root, f)))) {
    const m = read(f).match(EXAM);
    ok(!m, `${f}: exam-specific content is gone (found "${m && m[0]}")`);
  }
  for (const f of ['hi', 'author', 'editorial-policy.html', 'ssc-photo-signature-size.html', 'upsc-photo-signature-size.html']) ok(!fs.existsSync(path.join(root, f)), `${f} is removed`);
}
for (const f of pages) {
  const visible = read(f).replace(/<!--[\s\S]*?-->/g, ' ').replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ');
  ok(!/\bTODO\b|\[\.\.\.\]/.test(visible), `${f}: visible TODO or placeholder brackets`);
}
const swText = read('sw.js');
ok(!/applyready-v2[1-7]'/.test(swText), 'service worker cache is bumped past the exam-era versions');
ok(!/pdfjs\//.test((swText.match(/STATIC_ASSETS = \[[\s\S]*?\];/) || [''])[0]), 'pdf.js is cached at runtime on PDF pages, not precached for every visitor');
for (const f of [...jsIn('js'), ...jsIn('js/lib'), ...jsIn('js/workers')]) ok(swText.includes(`'/${f}'`), `${f}: precached for offline use`);
ok(!swText.includes("Precache failed"), 'a failed precache rejects install');
ok(swText.includes('Response.error()'), 'an uncached offline asset gets an error response');
ok(swText.includes("'/css/webfonts/fa-solid-900.woff2'") && swText.includes("'/css/webfonts/fa-regular-400.woff2'") && swText.includes("'/img/guides/signature-cleaner.webp'"), 'guide images and the icon fonts are precached');
for (const m of read('css/vendor/icons.min.css').matchAll(/url\("\.\.\/webfonts\/([^"]+)"\)/g)) ok(swText.includes(`'/css/webfonts/${m[1]}'`), `${m[1]} is precached`);
for (const asset of [...((swText.match(/STATIC_ASSETS = \[[\s\S]*?\];/) || [''])[0]).matchAll(/'\/[^']+'/g)].map(m => m[0].slice(2, -1))) {
  const rel = asset.endsWith('/') ? asset + 'index.html' : asset;
  ok(fs.existsSync(path.join(root, rel)), `precache entry exists: /${asset}`);
}
for (const f of pages) {
  const s = read(f);
  if (!utility.has(f)) for (const link of ['privacy.html', 'terms.html', 'about.html', 'contact.html']) ok(s.includes(link), `${f}: footer link to ${link}`);
  // Exactly one optional donation link, the same everywhere; no other payment or checkout host.
  const donations = s.match(/https:\/\/pages\.razorpay\.com\/[a-z-]+/g) || [];
  ok(donations.length >= 1 && donations.every(d => d === 'https://pages.razorpay.com/support-applyready'), `${f}: the footer carries the one donation link`);
  ok(!/checkout\.razorpay|paypal\.|buymeacoffee|ko-fi|patreon|stripe\.com|upi:\/\//i.test(s), `${f}: no other payment links or scripts`);
  const csp = (s.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/) || [])[1] || '';
  ok(/(?:^|; )script-src 'self'(?:;|$)/.test(csp) && /default-src 'self'/.test(csp) && /object-src 'none'/.test(csp) && /frame-src 'none'/.test(csp) && !/https?:/.test(csp) && !/unsafe-eval/.test(csp), `${f}: CSP allows only this origin's scripts, no frames and no third-party hosts (${csp})`);
}

// 5. Depth of content: guides and landing pages are not thin
for (const f of pages) {
  if (stubs.has(f)) continue;
  const n = words(read(f));
  if (f.startsWith('guides/') && f !== 'guides/index.html') ok(n >= 600, `${f}: only ${n} words`);
  if (/^resize-image-to-(\d+kb|kb-limit)\.html$/.test(f)) ok(n >= 600, `${f}: only ${n} words`);
}
const guides = pages.filter(f => f.startsWith('guides/') && f !== 'guides/index.html' && indexable.has(f));
ok(guides.length >= 12, `at least 12 indexable guides (found ${guides.length})`);

// 5b. The tool registry and the pages agree: every live tool has its page, and every page names its tool.
{
  const { TOOLS, liveTools } = require('../scripts/lib/tools.js');
  for (const t of liveTools()) {
    ok(fs.existsSync(path.join(root, t.path)), `registry: ${t.id} points at ${t.path}, which exists`);
    ok(read(t.path).includes(`<meta name="applyready-tool" content="${t.id}">`), `${t.path}: names its tool id for "recently used"`);
    ok(t.keywords && t.keywords.length >= 3, `registry: ${t.id} has search keywords`);
  }
  ok(new Set(TOOLS.map(t => t.id)).size === TOOLS.length, 'registry: tool ids are unique');
  for (const t of TOOLS.filter(t => t.live === false)) ok(!pages.some(f => read(f).includes(`href="${t.path}"`) || read(f).includes(`href="../${t.path}"`)), `no page links to ${t.path} before that tool is live`);
}

// 6. Guides: a visible byline linking the about page, dates that match the structured data,
//    an original visual, a Sources section with an outside link, and links to a tool and other guides.
const ldDate = (s, key) => ((s.match(new RegExp(`"${key}": "(\\d{4}-\\d{2}-\\d{2})`)) || [])[1]);
const bodyOf = s => (s.match(/<main[\s\S]*?<\/main>/) || [''])[0].replace(/<section class="related-guides-section"[\s\S]*?<\/section>/, '');
for (const f of guides) {
  const s = read(f);
  ok(s.includes('"@type": "Article"') && /"author": \{[^}]*"@type": "Organization"[^}]*"name": "ApplyReady"/.test(s), `${f}: Article structured data authored by ApplyReady`);
  ok(s.includes('"BreadcrumbList"') && s.includes('class="breadcrumb-nav"'), `${f}: breadcrumbs, visible and structured`);
  const meta = (s.match(/<p class="guide-meta">([\s\S]*?)<\/p>/) || [])[1] || '';
  ok(/ApplyReady guide/.test(meta), `${f}: byline names ApplyReady`);
  const times = [...meta.matchAll(/<time datetime="(\d{4}-\d{2}-\d{2})">/g)].map(m => m[1]);
  ok(times.length === 2 && times[0] === ldDate(s, 'datePublished') && times[1] === ldDate(s, 'dateModified'), `${f}: Published and Last updated dates match datePublished and dateModified (${times} vs ${ldDate(s, 'datePublished')}, ${ldDate(s, 'dateModified')})`);
  ok(times[0] <= times[1], `${f}: last updated is not before published`);
  const body = bodyOf(s);
  ok(/<figure class="shot">[\s\S]*?(<img [^>]*width="\d+" height="\d+" alt="[^"]{20,}" loading="lazy"|<svg [^>]*role="img")/.test(body), `${f}: at least one original visual with size and alt text`);
  const sources = (body.match(/<h2 id="sourcesHeading">Sources<\/h2>[\s\S]*?<\/section>/) || [''])[0];
  ok(/href="https:\/\/(?!applyready\.in)[^"]+"/.test(sources), `${f}: a Sources section with at least one outside source`);
  const toolPaths = require('../scripts/lib/tools.js').liveTools().map(t => t.path);
  ok(toolPaths.some(p => body.includes(`href="../${p}"`)), `${f}: links its matching tool in the body`);
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

// 7. No leftover placeholder text on public pages
for (const f of pages) {
  const t = textOf(read(f));
  ok(!/lorem ipsum|TODO|FIXME|\[Company\]\b.*\[Role\]\b.*\[Name\]/i.test(t.replace(/\[Company\]|\[College\]|\[website\]|\[specific area\]|\[number\]|\[email\]/g, '')), `${f}: placeholder text`);
}

// 7b. Landing pages put the tool straight after the page head, before the reference content
for (const f of pages.filter(f => /^(resize-image-to-(\d+kb|kb-limit)|image-resizer|passport-photo-resizer|signature-resizer)\.html$/.test(f) && !stubs.has(f))) {
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
ok(require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(root, 'css/document.css'))).digest('hex') === '3c8498458a76e604f88736b6b98a31d0468d77ef1d07af44970661ea153eb6bd', 'css/document.css (resume sheet and print layout) changed; confirm the exported resume is meant to change, then update the hash');
ok(!fs.existsSync(path.join(root, 'css/style.css')) && !fs.existsSync(path.join(root, 'css/workspace.css')), 'retired stylesheets are deleted');
// Generated markup is in sync with its generator (shell, search index, tool listings, image workspaces).
for (const script of ['sync-shell.js', 'build-directory.js', 'build-image-pages.js', 'build-sitemap.js']) {
  const run = spawnSync(process.execPath, [path.join(root, 'scripts', script), '--check'], { encoding: 'utf8' });
  ok(run.status === 0, `${script} --check: ${run.stdout}${run.stderr}`);
}
// The icon subset matches the icons in use (needs Python with fonttools; CI installs it).
{
  const py = spawnSync('python3', ['-c', 'import fontTools'], { encoding: 'utf8' });
  if (py.status === 0) {
    const run = spawnSync('python3', [path.join(root, 'scripts/build-icons.py'), '--check'], { encoding: 'utf8' });
    ok(run.status === 0, `build-icons.py --check: ${run.stdout}${run.stderr}`);
  } else console.log('  (icon subset check skipped: pip install fonttools brotli)');
}
for (const f of ['css/app.css', 'js/site.js', 'js/components.js', 'js/search.js', 'scripts/lib/shell.js', 'scripts/lib/tools.js', 'scripts/lib/image-workspace.js']) {
  ok(!read(f).includes('—'), `${f}: no em dash in interface code`);
}

if (failures.length) {
  console.error(`✗ ${failures.length} of ${checks} content checks failed:`);
  for (const m of failures.slice(0, 200)) console.error('  - ' + m);
  if (failures.length > 200) console.error(`  ... and ${failures.length - 200} more`);
  process.exit(1);
}
console.log(`✓ ${pages.length} pages checked: titles, descriptions, canonicals, links, sitemap, offline cache, no ads, depth (${checks} assertions)`);
