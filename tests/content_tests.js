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
{
  // The full site is downloaded only when the visitor asks (Your data); install fetches the offline page alone.
  const list = (swText.match(/STATIC_ASSETS = \[[\s\S]*?\];/) || [''])[0];
  const install = (swText.match(/addEventListener\('install'[\s\S]*?\n\}\);/) || [''])[0];
  ok(install && !/STATIC_ASSETS|addAll/.test(install) && /offline\.html|OFFLINE_PAGE/.test(install), 'the service worker does not precache the whole site on install');
  ok(/saveData/.test(swText) && /'save-site'/.test(swText) && /'cache-page'/.test(read('js/site.js')) && /'save-site'/.test(read('js/your-data.js')), 'the full offline copy is the visitor’s choice, and Save-Data is respected');
  ok(!/devanagari/.test(list), 'the Devanagari font, which no page shows, is not part of the offline copy');
  const hashes = (swText.match(/ASSET_HASHES = '([0-9a-f ]+)'/) || [])[1] || '';
  ok(hashes.split(' ').length === (list.match(/'\/[^']*'/g) || []).length, 'every file of the offline copy has a content hash');
  ok(/function keyFor/.test(swText) && !/ignoreSearch/.test(swText), 'files are cached once, under one key per path, not once per query string');
  // The offline page's own script and both icon fonts are cached with it at install (a page that
  // never drew a regular-weight icon never fetched that font, so the offline page showed a blank icon).
  const shell = ((swText.match(/OFFLINE_SHELL = \[([^\]]*)\]/) || [])[1] || '').match(/'[^']+'/g) || [];
  ok(['/js/offline.js', '/css/webfonts/fa-solid-900.woff2', '/css/webfonts/fa-regular-400.woff2'].every(p => shell.includes(`'${p}'`)) && shell.every(p => list.includes(p)), `the offline page's script and icon fonts are cached with it (${shell})`);
  ok(/keepOfflineShell\(\)/.test(install), 'install caches the offline page’s script and icon fonts');
  // "Save every tool" includes the PDF libraries, so the PDF tools work offline after it.
  const vendorList = (swText.match(/VENDOR_ASSETS = \[[\s\S]*?\];/) || [''])[0];
  for (const f of ['/js/vendor/pdf-lib.min.js', '/js/vendor/pdfjs/pdf.min.mjs', '/js/vendor/pdfjs/pdf.worker.min.mjs', '/js/vendor/pdfjs/wasm/openjpeg.wasm', '/js/vendor/pdfjs/wasm/jbig2.wasm']) ok(vendorList.includes(`'${f}'`), `the full offline copy includes ${f}`);
  for (const m of vendorList.matchAll(/'\/([^']+)'/g)) ok(fs.existsSync(path.join(root, m[1])), `${m[1]}: listed for the offline copy and present`);
  const saveFn = (swText.match(/async function missingFiles[\s\S]*?\n\}/) || [''])[0];
  ok(/VENDOR_ASSETS/.test(saveFn) && /missingFiles\(\)/.test((swText.match(/async function saveSite[\s\S]*?\n\}/) || [''])[0]) && /missingFiles\(\)/.test((swText.match(/async function siteInfo[\s\S]*?\n\}/) || [''])[0]), 'saving every tool fetches the PDF libraries, and the saved count includes them');
}
// The offline page and the help pages describe the real offline behaviour: pages that were opened,
// or every tool once saved on Your data. Nothing is downloaded on a first visit.
{
  const offline = read('offline.html');
  const lede = (offline.match(/<p class="page-lede">([\s\S]*?)<\/p>/) || [])[1] || '';
  ok(lede && !/first visit|every tool|should still open/i.test(lede), `offline.html: the lede does not promise pages that were never opened (${lede})`);
  ok(/href="\/your-data\.html#offline"/.test(offline) && /Save every tool for offline use/.test(offline), 'offline.html: points to Save every tool on Your data');
  ok(/<script src="\/js\/offline\.js\?v=[^"]+" defer><\/script>/.test(offline) && /id="offlineActions"/.test(offline), 'offline.html: loads the script that shows only kept pages');
  for (const f of pages) {
    const text = read(f).replace(/<[^>]+>/g, ' ');
    ok(!/after (your|a) first visit,? offline|offline after a first visit|keeps every tool and guide on this device/i.test(text), `${f}: does not promise offline use after a first visit`);
    // A PDF tool opened but never used online does not work offline: its PDF library is kept on first use.
    for (const m of text.matchAll(/[^.]*\btools? (?:that )?you (?:have )?(?:opened|visited)[^.]*\b(?:work|works|working|available) offline[^.]*\./gi)) ok(/PDF/.test(m[0]), `${f}: an offline promise about opened tools mentions the PDF library (${m[0].trim()})`);
  }
  ok(!/Two links lead elsewhere/.test(read('privacy.html')), 'privacy.html: does not count the outbound links (guides cite many official pages)');
  // Using a PDF tool online keeps only the parts of the library that tool used; the character maps for
  // Chinese, Japanese and Korean text are not kept even by Save every tool (PF-6).
  const privacy = read('privacy.html').replace(/<[^>]+>/g, ' ');
  ok(!/library, which is kept on this device once you have used a PDF tool online/.test(privacy) && /character maps for Chinese, Japanese and Korean text/.test(privacy), 'privacy.html: does not claim the whole PDF library is kept after one use, and names what Save every tool leaves out');
}
// A page that shows image previews loads the pixel-size check (js/lib/image-ops.js) used by Kit.thumbnail.
{
  const previewing = [...jsIn('js'), ...jsIn('js/lib')].filter(f => f !== 'js/lib/file-kit.js' && /\bKit\.thumbnail\(/.test(read(f))).map(f => f.replace(/^js\//, ''));
  for (const f of pages) {
    const html = read(f);
    if (previewing.some(s => html.includes(`js/${s}?v=`) || html.includes(`js/${s}"`))) ok(/js\/lib\/image-ops\.js/.test(html), `${f}: loads js/lib/image-ops.js for its image previews`);
  }
}
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
  // 'wasm-unsafe-eval' lets the pdf.js worker compile its WebAssembly decoders; JavaScript eval stays blocked.
  ok(/(?:^|; )script-src 'self' 'wasm-unsafe-eval'(?:;|$)/.test(csp) && /default-src 'self'/.test(csp) && /object-src 'none'/.test(csp) && /frame-src 'none'/.test(csp) && !/https?:/.test(csp) && !/'unsafe-eval'/.test(csp) && !/script-src[^;]*'unsafe-inline'/.test(csp), `${f}: CSP allows only this origin's scripts, no frames and no third-party hosts (${csp})`);
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

// 6b. Search and social metadata: short titles and descriptions, the same brand everywhere, social
//     tags that repeat the page's own title and description, and names that match the tool registry.
{
  const { TOOLS, CATEGORIES, liveTools } = require('../scripts/lib/tools.js');
  const { CARD_ALT } = require('../scripts/lib/social.js');
  const decode = t => t.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  const textIn = t => decode(t.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
  const meta = (s, attr, name) => (s.match(new RegExp(`<meta ${attr}="${name}" content="([^"]*)">`)) || [])[1];
  for (const f of pages) {
    const s = read(f);
    const title = (s.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '';
    ok(!/ApplyReady\.in/.test(title), `${f}: title uses the brand "ApplyReady", not "ApplyReady.in" (${title})`);
    // The home page leads with the brand; every other page ends with it.
    ok(f === 'index.html' ? /^ApplyReady\b/.test(title) : / \| ApplyReady$/.test(title), `${f}: title ends with "| ApplyReady" (the home page starts with it) (${title})`);
    if (!indexable.has(f)) {
      ok(!/<meta (property="og:|name="twitter:)/.test(s), `${f}: noindex, redirect and utility pages carry no social tags`);
      continue;
    }
    const desc = meta(s, 'name', 'description') || '';
    ok(decode(title).length <= 65, `${f}: title is ${decode(title).length} characters; keep it to 65 so results show all of it (${title})`);
    ok(decode(desc).length <= 160, `${f}: description is ${decode(desc).length} characters; keep it to 160 so results show all of it`);
    const shared = title.replace(/ \| ApplyReady$/, '');
    ok(meta(s, 'property', 'og:title') === shared && meta(s, 'name', 'twitter:title') === shared, `${f}: og:title and twitter:title repeat the page title`);
    ok(meta(s, 'property', 'og:description') === desc && meta(s, 'name', 'twitter:description') === desc, `${f}: og:description and twitter:description repeat the meta description`);
    ok(meta(s, 'property', 'og:url') === (s.match(/<link rel="canonical" href="([^"]*)"/) || [])[1], `${f}: og:url is the canonical URL`);
    ok(meta(s, 'property', 'og:site_name') === 'ApplyReady' && decode(meta(s, 'property', 'og:image:alt') || '') === CARD_ALT, `${f}: og:site_name and the one accurate image description`);
    ok(meta(s, 'property', 'og:type') === (/"@type":\s*"Article"/.test(s) ? 'article' : 'website'), `${f}: og:type is article for guides and website elsewhere`);
  }

  // Tool pages: Home / category / tool, the same in the visible breadcrumb and the structured data.
  for (const t of liveTools()) {
    const s = read(t.path);
    const cat = CATEGORIES.find(c => c.id === t.category);
    const crumbs = [...((s.match(/<ol class="breadcrumb-list">([\s\S]*?)<\/ol>/) || [])[1] || '').matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map(m => [textIn(m[1]), (m[1].match(/href="([^"]*)"/) || [])[1]]);
    ok(JSON.stringify(crumbs) === JSON.stringify([['Home', '/'], [cat.name, `tools.html#${cat.id}`], [t.name, undefined]]), `${t.path}: breadcrumb is Home / ${cat.name} / ${t.name} (${JSON.stringify(crumbs)})`);
    const graph = [...s.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].flatMap(m => { const j = JSON.parse(m[1]); return j['@graph'] || [j]; });
    const list = graph.find(n => n['@type'] === 'BreadcrumbList');
    ok(list && JSON.stringify(list.itemListElement.map(i => i.name)) === JSON.stringify(crumbs.map(c => c[0])), `${t.path}: structured breadcrumbs match the visible ones`);
    ok(graph.some(n => n['@type'] === 'WebApplication' && String(n.name).toLowerCase() === `applyready ${t.name}`.toLowerCase()), `${t.path}: WebApplication structured data named after the tool`);
    const h1 = textIn((s.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || '');
    ok(h1 === t.name, `${t.path}: the heading is the tool's name "${t.name}" (says "${h1}"); keep search phrases for the title`);
  }

  // Cards and buttons call a tool by its registry name; cards on top-level pages call a guide by its title.
  const h1Of = f => textIn((read(f).match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || '');
  for (const f of pages) {
    const s = read(f);
    const dir = path.posix.dirname(f);
    const target = href => { const t = href.startsWith('/') ? href.slice(1) : path.posix.normalize(path.posix.join(dir === '.' ? '' : dir, href)); return t.endsWith('/') || t === '.' ? t.replace(/\.$/, '') + 'index.html' : t; };
    for (const m of s.matchAll(/<a href="([^"#]+)(?:#[^"]*)?" class="guide-card[^"]*">\s*<strong>([\s\S]*?)<\/strong>/g)) {
      const t = target(m[1]);
      const tool = TOOLS.find(x => x.path === t);
      if (tool) ok(textIn(m[2]) === tool.name, `${f}: the card for ${t} should say "${tool.name}" (says "${textIn(m[2])}")`);
      else if (dir === '.' && t.startsWith('guides/') && fs.existsSync(path.join(root, t))) ok(textIn(m[2]) === h1Of(t), `${f}: the card for ${t} should use the guide's title "${h1Of(t)}" (says "${textIn(m[2])}")`);
    }
    for (const m of s.matchAll(/<a href="([^"]+)"[^>]*>(?:\s*<i [^>]*><\/i>)?\s*Open the ([^<]+)<\/a>/g)) {
      const tool = TOOLS.find(x => x.name.toLowerCase() === m[2].trim().toLowerCase());
      if (tool) ok(target(m[1].split('#')[0]) === tool.path, `${f}: "Open the ${m[2].trim()}" goes to ${m[1]}, not ${tool.path}`);
    }
  }

  // Credits: Font Awesome's CC BY 4.0 licence asks for attribution where the icons are used.
  const about = read('about.html');
  ok(/Font Awesome/.test(textOf(about)) && about.includes('https://creativecommons.org/licenses/by/4.0/') && /pdf\.js/.test(textOf(about)) && /pdf-lib/.test(textOf(about)), 'about.html credits Font Awesome (CC BY 4.0), pdf.js and pdf-lib');
  ok(/^\/\*! Font Awesome Free [\d.]+ .*License - https:\/\/fontawesome\.com\/license\/free \(Icons: CC BY 4\.0/.test(read('css/vendor/icons.min.css')), 'icons.min.css keeps the upstream licence line');
  for (const c of CATEGORIES) ok(about.includes(`href="tools.html#${c.id}"`), `about.html describes the ${c.name} category`);
  const manifest = JSON.parse(read('favicon/site.webmanifest'));
  ok(!/100%|ATS/.test(manifest.description) && manifest.theme_color === '#ffffff', 'the web app manifest has the current description and the light theme colour');
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
// Every stylesheet has balanced braces: one missing "}" silently nests everything after it in a media query.
for (const f of fs.readdirSync(path.join(root, 'css')).filter(x => x.endsWith('.css')).map(x => 'css/' + x)) {
  const t = read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/"[^"]*"|'[^']*'/g, '');
  let depth = 0, negative = false;
  for (const ch of t) { if (ch === '{') depth++; else if (ch === '}') { depth--; if (depth < 0) negative = true; } }
  ok(depth === 0 && !negative, `${f}: unbalanced braces (depth ${depth})`);
}
// The resume sheet, templates and print layout are the output format: change them on purpose, then update this hash.
ok(require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(root, 'css/document.css'))).digest('hex') === '3c8498458a76e604f88736b6b98a31d0468d77ef1d07af44970661ea153eb6bd', 'css/document.css (resume sheet and print layout) changed; confirm the exported resume is meant to change, then update the hash');
ok(!fs.existsSync(path.join(root, 'css/style.css')) && !fs.existsSync(path.join(root, 'css/workspace.css')), 'retired stylesheets are deleted');
// Generated markup is in sync with its generator (shell, search index, tool listings, image, PDF and
// single-file tool workspaces, sitemap). Every generator that writes pages must be in this list.
{
  const generators = ['sync-shell.js', 'build-directory.js', 'build-image-pages.js', 'build-pdf-pages.js', 'build-tool-pages.js', 'build-sitemap.js'];
  for (const script of generators) {
    const run = spawnSync(process.execPath, [path.join(root, 'scripts', script), '--check'], { encoding: 'utf8' });
    ok(run.status === 0, `${script} --check: ${run.stdout}${run.stderr}`);
  }
  // build-sw.js and build-tool-index.js are run (and checked) by sync-shell.js.
  const viaShell = ['build-sw.js', 'build-tool-index.js'];
  for (const f of fs.readdirSync(path.join(root, 'scripts')).filter(x => /^build-.*\.js$/.test(x))) {
    ok(generators.includes(f) || viaShell.includes(f), `scripts/${f}: a page generator that npm test does not check; add it to the --check list in tests/content_tests.js`);
    ok(read('scripts/' + f).includes("'--check'"), `scripts/${f}: has no --check mode`);
  }
}
// Every PDF and document tool page leads to the guides that help with it, and the PDF tool pages
// answer common requests with worked steps (they had neither, unlike the image tool pages).
{
  const { PAGES: pdfPages } = require('../scripts/build-pdf-pages');
  for (const f of [...pdfPages.map(p => p.page), 'text-to-pdf.html']) {
    const main = (read(f).match(/<main[\s\S]*?<\/main>/) || [''])[0];
    const guideLinks = [...main.matchAll(/<a href="guides\/([a-z0-9-]+\.html)" class="guide-card">/g)].map(m => m[1]);
    ok(guideLinks.length >= 3 && guideLinks.every(g => fs.existsSync(path.join(root, 'guides', g))), `${f}: links to at least three existing guides in "Guides that help with this tool" (${guideLinks.join(', ')})`);
    if (f !== 'text-to-pdf.html') ok((main.match(/<h2 id="examplesHeading">Common requests<\/h2>[\s\S]*?<\/section>/) || [''])[0].split('<h3>').length - 1 >= 2, `${f}: a "Common requests" section with at least two worked requests`);
  }
}
// Contributor docs agree with the code: the README's tool table names every live tool page in the
// registry, and the setup notes name everything CI installs to run the tests.
{
  const readme = read('README.md');
  const table = (readme.match(/## What it does[\s\S]*?\n\n([\s\S]*?)\n\n/) || [])[1] || '';
  const tablePages = (table.match(/`[^`]+\.html`/g) || []).map(x => x.slice(1, -1));
  const listed = p => tablePages.some(t => t === p || (t.includes('*') && new RegExp('^' + t.replace(/[.]/g, '\\.').replace(/\*/g, '[^/]+') + '$').test(p)));
  for (const t of require('../scripts/lib/tools').liveTools()) ok(listed(t.path), `README.md "What it does" table does not list ${t.path} (${t.name})`);
  const ci = read('.github/workflows/quality.yml');
  const needs = [...(ci.match(/pip install ([^#\n]+)/) || ['', ''])[1].trim().split(/\s+/), ...(ci.match(/apt-get install -y ([^#\n]+)/) || ['', ''])[1].trim().split(/\s+/)];
  ok(needs.length >= 6 && /playwright install/.test(ci), 'quality.yml: could not read the packages CI installs');
  for (const doc of ['README.md', 'CONTRIBUTING.md']) {
    const s = read(doc).toLowerCase();
    for (const n of needs) ok(s.includes(n.toLowerCase()), `${doc}: does not mention ${n}, which CI installs to run the tests`);
    ok(s.includes('npx playwright install chromium') && s.includes('browser_executable_path'), `${doc}: does not say how to get Chromium for the browser tests`);
  }
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
