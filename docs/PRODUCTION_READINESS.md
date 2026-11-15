# Production readiness audit, 15 November 2026

Scope: the whole repository, every page and tool, the hosting setup, and the removal of Google AdSense. This file records what was found, what was changed, how it was verified, and what still needs someone with access to an outside account.

## 1. What the project is

- A static site: 57 HTML pages, vanilla JavaScript and CSS, served by GitHub Pages from `main` at `applyready.in` (the live site answers with `server: GitHub.com`; there is no Cloudflare or other proxy in front of it).
- All processing happens in the browser. There is **no backend, database, API, authentication, user accounts, sessions, file upload, Supabase, Cloudflare Worker or environment variable**. Audit items that assume those (login, registration, passwords, RLS, storage buckets, CORS, CSRF, SQL injection, rate limiting, service-role keys) do not apply. The equivalent questions were asked of the browser code instead: how imported files, typed text and URL parameters are handled.
- The one form, Contact, opens the visitor's email app (`mailto:`); nothing is sent from the page.
- CI: `.github/workflows/quality.yml` runs `npm test` and `npm run test:browser` on pushes and pull requests to `main`.

## 2. Google AdSense: removed completely

The site had gone from no ads (#10) to ads restored (#11 to #14). Everything added for AdSense is now gone:

| Removed | Where |
|---|---|
| `js/ads.js` (loaded `pagead2.googlesyndication.com/.../adsbygoogle.js?client=ca-pub-2713609207324356`) | 39 pages loaded it |
| `<meta name="google-adsense-account">` and its `shell:ads` block | 55 pages (all but 404 and offline) |
| 82 `<aside class="ad-slot-container">` "Advertisements" slots | tool pages, exam pages, guides, About, Editorial policy, Author, Hindi pages |
| `ads.txt` (publisher record) | site root |
| `User-agent: Mediapartners-Google` | `robots.txt` |
| `scripts/enable-ads.js`, `scripts/place-ad-slots.js` | developer tooling |
| `ADS_CLIENT`, `ADS_SRC`, `adsHead()` and the ad hosts in the CSP | `scripts/lib/shell.js`, `scripts/sync-shell.js` |
| `.ad-slot*`, `html.ad-preview` and `.adsbygoogle` rules | `css/app.css` |
| `/js/ads.js` in the offline cache | `sw.js` |
| AdSense cookie, personalised-ads, EEA consent and opt-out text | Privacy policy (section 3 rewritten), Terms (section 6 "Advertising" removed, later sections renumbered), About, Editorial policy, the "Staying safe" guide |
| Tests that required ads to be present | `tests/content_tests.js`, `tests/browser_tests.js` |
| AdSense references | README, `docs/UI_UX_REBUILD_PLAN.md`, `docs/content-quality/*` |

The slots were hidden in CSS while empty, so removing them does not move anything on screen. The leftover whitespace and broken indentation from the earlier insert/remove cycles was tidied.

**Guards so ads cannot come back unnoticed:** `tests/content_tests.js` fails if any page, script, stylesheet, `robots.txt`, `sw.js` or the shell generator contains an ad-network identifier, or if `ads.txt`, `js/ads.js` or the ad scripts exist. `tests/browser_tests.js` checks that pages contain no ad markup and that the CSP blocks third-party scripts, frames and inline scripts.

**Content Security Policy** (every page) is now: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' blob: data:; media-src 'self' blob: data:; worker-src 'self' blob:; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'`. Before, it allowed nine Google ad host patterns plus `'unsafe-inline'` and `'unsafe-eval'` for scripts. No page needs either: there are no inline scripts or inline event handlers.

Unrelated integrations: none existed (no Google Analytics, Search Console tag, OAuth or Google Fonts; fonts are self-hosted). Search Console verification is documented in `docs/SEO_SETUP.md` and was not touched.

## 3. Defects found and fixed

Each was reproduced in Chromium on the original code before the fix, and `tests/robustness_tests.js` (new) fails on the original code and passes now.

| Severity | Defect | Fix |
|---|---|---|
| High | **Compress PDF silently dropped pages.** Only embedded JPEG images became output pages, so a PDF with a scanned page and a text page came back as one page and was reported "ready to upload". | The page objects are counted; if they do not match the scanned images the tool refuses and explains why. Input capped at 50 MB; object URLs are released. |
| Medium | **Offline mode did not work.** Pages request `app.css?v=…`, the service worker precached `/css/app.css`; cached pages loaded with no styles or scripts. | The service worker falls back to a match that ignores the query (safe because the cache is renamed every release). Cache `applyready-v27`. |
| Medium | **Resizer locked up** if a new image was chosen while one was processing; only a reload helped. | The busy flag is always released when a run ends. |
| Medium | **Image to PDF and the signature cleaner drew phone photos at full size** (24 to 50 MP), beyond mobile canvas limits, ending in "Cannot read properties of null". | Image to PDF works at most 4000 px on the long side (over 300 DPI on A4) and reports an image that is still too large; the signature cleaner works at most 2400 px. |
| Low | Image to PDF ordered pages by load completion, not selection. | Pages keep the order chosen. |
| Low | File reads had no error handler in four tools, leaving the interface waiting. | `reader.onerror` added with a clear message. |
| Low | Importing a resume backup left the template gallery marking the old template. | Import refreshes the whole editor, and the backup is migrated before anything on screen changes. |
| Low | An entry id containing "disabled" disabled all of that entry's buttons; the first/last move buttons carried a duplicate `disabled` attribute. | Explicit boolean. |
| Low | Links written as `example.com:8080/path` lost their link in the preview, PDF and Word file. | `host:port` is no longer mistaken for a URL scheme; `javascript:`, `data:` and other schemes are still refused (unit-tested). |
| Low | JPEG padding (to reach a portal's minimum KB) was inserted before the JFIF header, which some validators expect first. | Padding goes after APP0 (unit-tested). |
| Low | Contact form accepted a blank message, had no length cap (long `mailto:` links fail silently) and gave no feedback. | Inline error, 1,500-character cap, a hint and a confirmation message. |

## 4. Cleanup

- **Deleted files:** `js/ads.js`, `scripts/enable-ads.js`, `scripts/place-ad-slots.js`, `ads.txt`, `scripts/build-content.js` (a one-time markup migration that skips every current page), `css/webfonts/fa-brands-400.woff2` (117 KB, no `@font-face` used it, yet every offline install downloaded it), `img/guides/resizer-requirement.webp` (shown on no page), `assets/icon.svg`, `favicon/about.txt`.
- **Dead code:** lookups of elements that no longer exist (`specDims`, `specSize`, `specFormat`, `examDateInput`, three empty-state ids), the unused `window.ApplyReadyResizer` global, an unreachable unsanitised fallback in `migrateResumeSchema`, two unused variables in the PDF engine, the leftover `console.error`, and `sync-shell.js` branches for markup no page has had for weeks (a page without shell markers now fails with a clear message instead).
- **CSS:** about 45 unused selectors removed from `css/app.css` (old aliases such as `.form-control`, `.toast`, `.radio`, `.badge--*`, `.spinner`) and two from `css/document.css` (exported resume unchanged; the pinned hash in the content test was updated).
- **Docs:** removed `docs/archive/` (13 superseded audits describing stylesheets that no longer exist), `docs/PRODUCT_UPGRADE.md` and `docs/UX_TASK_TESTS.md` (8 templates, support modals and ad slots that do not exist). README rewritten. They remain in Git history.
- **Owner notes moved out of public HTML:** four `TODO(Sumit)` comments were visible in the page source of the Author and Editorial policy pages; they are listed in section 8 instead.
- **Consistency:** card links now say "Read guide", "View requirements" or "Open tool" consistently; the Privacy card in a guide no longer says "Open tool".
- **Git:** the remote has only `main`; no stale branches to delete. `.gitignore` covers `node_modules/`, `test-results/` and `playwright-report/`. No secrets or `.env` files in the history; `npm audit` reports 0 vulnerabilities (dev dependencies only).

## 5. Security review (browser code)

Reviewed and found safe, no change needed: every `innerHTML` sink escapes user data (including file names); JSON backups and the saved draft pass a strict allow-list schema (string, entry and file-size limits; no prototype pollution); resume links allow only http(s), mailto and tel in the preview, PDF and Word file; PDF strings and Word XML are escaped and illegal characters stripped; URL parameters only fill inputs or select a known preset; every `localStorage` access is in try/catch; the service worker caches only same-origin `200` responses.

Cannot be fixed from the repository (GitHub Pages sets the headers): `Strict-Transport-Security`, `X-Content-Type-Options`, `Referrer-Policy` as a header (a meta tag is set), and `frame-ancestors`/`X-Frame-Options` (clickjacking protection does not work from a meta tag). The site has no logins or state-changing actions, so the practical risk is low. See section 8.

## 6. Performance, SEO, accessibility

- No third-party requests at all now. The offline cache shrank from 102 files / 3,167 KB to 99 files / 2,924 KB.
- Large images are processed at bounded sizes (above), lowering memory use on phones.
- SEO: titles, descriptions, canonicals, one `h1`, internal links and anchors, structured data, sitemap and robots are checked on every page by `tests/content_tests.js`. Redirect stubs are `noindex` with canonicals. `sitemap.xml` `lastmod` changed only for the five pages whose text changed; `robots.txt` keeps the sitemap line.
- Accessibility: axe runs on every page in the UI suite; the contact field's error is announced through `aria-describedby` and `aria-invalid`.

## 7. Verification

Run on 15 November 2026 in this repository with Node 22 and Chromium:

| Command | Result |
|---|---|
| `npm test` | 571 unit assertions, 50 regression checks, 5,630 content assertions: all passed |
| `npm run test:browser` | browser suite 2,942 assertions; image workflow 279; resume flow 66; UI suite 2,878 (32 widths, axe on every page, keyboard and focus); robustness 12; Chromium smoke 20 (real image, PDF, Word and text downloads read back with Poppler and unzip): all passed |
| `node scripts/sync-shell.js --check`, `node scripts/build-sitemap.js --check` | in sync |
| `npm audit` | 0 vulnerabilities |

The same browser suites passed on the original code before any change, so no regression was introduced. Firefox and physical phones were not tested in this run.

## 8. Manual steps that need outside access

1. **Merge to `main`.** GitHub Pages deploys only `main`; until then the live site still serves the AdSense code and `ads.txt`. CI runs on the pull request.
2. **AdSense account:** remove `applyready.in` from Sites in the AdSense dashboard (or close the account) so Google stops expecting the site. Nothing in the repository can do this.
3. **Security headers (optional):** to add HSTS and clickjacking protection, put the domain behind a proxy that can set headers (for example Cloudflare with a Transform Rule adding `Strict-Transport-Security`, `X-Content-Type-Options: nosniff` and `Content-Security-Policy: frame-ancestors 'none'`), or accept GitHub Pages' defaults. Enforce HTTPS in the repository's Pages settings if it is not already on.
4. **Search Console:** after deploying, request reindexing of the Privacy and Terms pages so search snippets stop mentioning ads.
5. **Owner content** (previously TODO comments in the HTML): add a 160 x 160 profile photo and two or three sentences of background with profile links (and the same links in the Person `sameAs`) on `author/sumit-sengar.html`; optionally a sentence on how AI-drafted text is reviewed in `editorial-policy.html#ai`.
6. Still open from the 6 November audit: add RRB photo and signature figures once a CEN can be opened from an Indian network (`docs/content-quality/research/rrb.md`).

## 9. What to watch after deploying

- Open a few pages with DevTools: the console should show no CSP violations, and the Network panel no request to any other domain.
- Returning visitors move to service worker cache `applyready-v27` and asset version `20261115` on their next visit; check one page offline after a normal visit.
- Search Console: coverage and any 404s, especially for the redirect stubs.
- Reports through the contact address about Compress PDF refusing files: the new refusal is deliberate for PDFs with text pages, and those are the files to look at if a fuller PDF compressor is ever wanted.
