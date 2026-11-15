# ApplyReady

[applyready.in](https://applyready.in) prepares the files that Indian exam and job portals ask for: photos and signatures at an exact pixel size and KB range, PDFs under a size limit, printable passport-photo sheets, and an ATS-friendly resume.

Everything runs in the visitor's browser. Files are never uploaded, there are no accounts, no cookies, no analytics and no advertising.

## What the site does

| Tool | Page | Script |
|---|---|---|
| Image resizer and strict compressor (exam presets, KB limits, crop, rotate, name/date strip) | `index.html`, `resize-image-to-*.html`, `*-photo-signature-size.html`, `hi/*.html` | `js/resizer.js`, `js/presets.js` |
| Signature cleaner | `signature-cleaner.html` | `js/signature-cleaner.js` |
| Passport photo print sheet | `passport-photo-print.html` | `js/passport-photo-print.js` |
| Image to PDF | `image-to-pdf.html` | `js/image-to-pdf.js` |
| Compress PDF (scanned / image PDFs) | `compress-pdf.html` | `js/compress-pdf.js` |
| Resume builder: 15 single-column templates, live preview, PDF / Word / text export, JSON backup, review checks, job-description keyword match | `resume.html` | `js/resume.js`, `js/templates.js`, `js/pdf-engine.js`, `js/docx-engine.js`, `js/keywords.js`, `js/resume-schema.js` |

Around the tools: 22 guides (`guides/`), five exam requirement pages with Hindi versions, and the About, Editorial policy, Author, Contact, Privacy and Terms pages.

## Technology

- Plain HTML, CSS and JavaScript. No framework, no bundler, no runtime dependencies.
- Hosted as static files on **GitHub Pages** from the `main` branch, custom domain `applyready.in` (`CNAME`).
- Only third-party code: Cropper.js (`js/vendor/`), a Font Awesome icon subset (`css/vendor/`), Inter and Noto Devanagari fonts (`assets/fonts/`). All are self-hosted; licences are in `docs/licenses/`.
- No backend, database, authentication, API keys or environment variables. Nothing to configure for deployment.
- A service worker (`sw.js`) caches the pages and assets so the tools work offline.
- Every page carries a Content Security Policy (meta tag, because GitHub Pages cannot set headers) that allows scripts, styles, fonts and images from this origin only.

## Repository layout

```
*.html, guides/, hi/, author/   Pages (57, of which 43 are indexable and listed in sitemap.xml)
css/app.css                     The whole interface: tokens, shell, controls, tools, reading pages, resume builder
css/document.css                Resume sheet and print layout (resume.html only)
js/                             One script per tool, plus site.js (header, theme, notifications, dialogs),
                                components.js (custom select, ranges, segmented controls) and theme.js
js/vendor/, css/vendor/         Cropper.js and the icon subset
assets/, favicon/, img/         Fonts, social card, icons, guide screenshots and sample images
scripts/                        Developer tooling (not served to visitors; disallowed in robots.txt)
tests/                          Node and Playwright test suites
docs/                           Design system, SEO setup, research notes and measurements behind page figures
sw.js, robots.txt, sitemap.xml, 404.html, offline.html
```

## Local development

Requirements: Node.js 22 and npm. The pages use root-relative paths, so serve the repository root over HTTP:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000/. The service worker caches aggressively; use a private window or "Update on reload" in DevTools while editing.

## Generated parts of pages

Shared markup is written into the pages by scripts, between marker comments. Edit the generator, not the page:

| Script | Writes |
|---|---|
| `node scripts/sync-shell.js` | Header, footer, stylesheet links, CSP and asset version (`<!-- shell:*:start -->` markers) on every page, from `scripts/lib/shell.js`. `--check` fails if any page is out of sync. |
| `node scripts/build-image-pages.js` | The resizer workspace on the image pages, from `scripts/lib/image-workspace.js` |
| `node scripts/build-tool-pages.js` | The workspace of the four single-file tools (`<!-- tool:start -->` markers) |
| `node scripts/build-sitemap.js` | `sitemap.xml` from the indexable pages; `--check` verifies it |
| `node scripts/guide-screenshots.js` | The annotated screenshots in `img/guides/` |
| `python3 scripts/make-sample-images.py` | The sample images in `img/samples/` |

A new page must contain the four `shell:*` marker pairs (copy them from an existing page).

## Releasing a change

1. Bump `ASSET_VERSION` in `scripts/lib/shell.js` and run `node scripts/sync-shell.js`, so browsers fetch the new CSS and JS.
2. Bump `CACHE_NAME` in `sw.js`, so the service worker replaces its cache. Add any new page or asset to `STATIC_ASSETS`.
3. Run `node scripts/build-sitemap.js` if page text changed.
4. Run the tests (below), then merge to `main`. GitHub Pages deploys `main` automatically.

## Testing

```bash
npm ci
npm test
```

`npm test` runs the unit suite (`tests/run_tests.js`: PDF and DOCX engines, templates, schema migration, review checks, resizer validation), behaviour regressions (`tests/regression_tests.js`) and the content checks (`tests/content_tests.js`: titles, descriptions, canonicals, links and anchors, sitemap, offline cache, CSP, structured data, and a guard that fails if any ad-network code reappears).

```bash
npx playwright install chromium
npm run test:browser
```

The browser suites drive every tool and page in Chromium: exports read back with Poppler (`pdftotext`, `pdfinfo`) and `unzip`, responsive layouts at 32 widths, keyboard and focus checks, axe accessibility scans, and the CSP. Set `BROWSER_EXECUTABLE_PATH` to use a locally installed Chromium, Chrome or Edge. `npm run test:firefox` runs the UI and smoke suites in Firefox.

CI (`.github/workflows/quality.yml`) runs both commands on every push and pull request to `main`.

## Further documentation

- `docs/DESIGN_SYSTEM.md`: tokens, components, states and the rules the tests enforce.
- `docs/SEO_SETUP.md`: Search Console, Bing and IndexNow.
- `docs/PRODUCTION_READINESS.md`: the latest full audit, what changed, and the manual steps that remain.
- `docs/content-quality/`: how the exam pages were researched, with the official sources; `docs/measurements/` holds the measured tool outputs quoted on the pages.

## Licence and contact

The code is public at [github.com/nbsumit/applyready](https://github.com/nbsumit/applyready). Third-party licences are in `docs/licenses/`. Questions and corrections: hello@nbsumit.com (also via `contact.html`).
