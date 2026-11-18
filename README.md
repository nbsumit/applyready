# ApplyReady

**Free. Open source. Forever.**

[ApplyReady](https://applyready.in) is a free set of tools for preparing job applications: a resume builder,
photo and signature resizers, and PDF tools. Everything runs in your browser. Files are never uploaded,
there are no accounts, no cookies, no analytics and no advertising, and every feature is free for everyone.

> Powerful tools for everyone. No subscriptions. No advertisements. No compromises.

## What it does

| Tool | Page | Main script |
|---|---|---|
| Resume builder: several resumes saved on the device with autosave (My resumes), templates, live preview, references and custom sections, PDF / Word / text export, JSON backups, review checks, job-description keyword match | `resume.html` | `js/resume.js` (+ `resume-library-ui.js`, `resume-library.js`, `resume-sections.js`, `resume-render.js`, `templates.js`, `pdf-engine.js`, `docx-engine.js`, `keywords.js`, `resume-schema.js`, `lib/store.js`) |
| Image resizer: exact pixels and KB limits, crop, rotate, format, minimum-size padding | `image-resizer.html`, `resize-image-to-*.html` | `js/resizer.js`, `js/presets.js` |
| Passport photo and signature resizers (the image resizer with a preset chosen) | `passport-photo-resizer.html`, `signature-resizer.html` | `js/resizer.js` |
| Batch image processor, image compressor, image converter: one engine, many files, per-file status, cancel, retry, ZIP | `batch-image.html`, `compress-image.html`, `convert-image.html` | `js/batch-image.js` (+ `js/lib/batch.js`, `image-ops.js`, `image-pool.js`, `js/workers/image-worker.js`) |
| Signature cleaner | `signature-cleaner.html` | `js/signature-cleaner.js` |
| Passport photo print sheet | `passport-photo-print.html` | `js/passport-photo-print.js` |
| Image to PDF | `image-to-pdf.html` | `js/image-to-pdf.js` |
| Compress PDF (scanned PDFs) | `compress-pdf.html` | `js/compress-pdf.js` (+ `lib/pdf-kit.js`, `lib/pdf-ui.js`) |
| PDF tools: merge, split, organise pages, PDF to images, extract text, add page numbers, watermark | `merge-pdf.html`, `split-pdf.html`, `organize-pdf.html`, `pdf-to-image.html`, `pdf-to-text.html`, `add-page-numbers.html`, `watermark-pdf.html` | One script per page with the same name (`js/merge-pdf.js`, `js/split-pdf.js`, `js/organize-pdf.js`, `js/pdf-to-image.js`, `js/pdf-to-text.js`, `js/add-page-numbers.js`, `js/watermark-pdf.js`), all on `lib/pdf-kit.js` (pdf-lib and pdf.js, loaded through `lib/pdf-kit-boot.js`) and `lib/pdf-ui.js` (shared interface) |
| File checker: real type, size, pixels, DPI, PDF pages, document properties, photo metadata removal | `file-checker.html` | `js/file-checker.js` (+ `lib/inspect.js`) |
| Text to PDF | `text-to-pdf.html` | `js/text-to-pdf.js` (+ `lib/text-pdf.js`) |
| Your data: everything stored on the device, resume backup and restore, delete | `your-data.html` | `js/your-data.js` |
| Applicant workspaces (cyber cafe mode): one temporary, memory-only space per applicant with one-click photo, signature, compress, convert, combine and merge actions, a ZIP per applicant, and a wipe on finish | `workspace.html` | `js/workspace.js` (+ `lib/applicants.js`, `lib/image-pool.js`, `lib/pdf-kit.js`) |

Every tool is listed in one registry, `scripts/lib/tools.js`, which generates the header menu, footer,
the tool directory (`tools.html`), the home page entry points and the site search index. `npm test`
fails if a tool in the registry is missing from the table above.

Contributing: see [`CONTRIBUTING.md`](CONTRIBUTING.md) and the [code of conduct](CODE_OF_CONDUCT.md).
The plan and its progress are in [`docs/ROADMAP.md`](docs/ROADMAP.md) and [`docs/PROGRESS.md`](docs/PROGRESS.md).

## Privacy model

- Files are read with the browser's File API and processed with Canvas, Web Workers and in-browser
  libraries. Nothing is sent to a server; there is no server.
- A Content Security Policy on every page allows scripts, styles, fonts, images and connections from
  this origin only, so the page cannot contact third parties.
- Data kept on the device: the theme preference and the list of recently used tools (`localStorage`),
  and saved resumes when the resume builder saves them (browser storage on the device).
- A service worker caches the site's own pages and assets for offline use. It never caches user files.

## Technology

- Plain HTML, CSS and JavaScript. No framework, no bundler, no backend, no environment variables.
- Static hosting on GitHub Pages from `main`, custom domain `applyready.in` (`CNAME`).
- Third-party code, all self-hosted (licences in `docs/licenses/`): Cropper.js, a Font Awesome Free icon
  subset, Inter and Noto Devanagari fonts, [`@cantoo/pdf-lib`](https://github.com/cantoo-scribe/pdf-lib)
  (MIT) and [pdf.js](https://github.com/mozilla/pdf.js) (Apache-2.0).

## Repository layout

```
*.html, guides/          Pages (shared header, footer and CSP are generated into them)
css/app.css              The whole interface: tokens, components, tools, resume builder
css/document.css         Resume paper and print layout (resume.html only)
js/                      One script per tool, plus site.js (shell), search.js, components.js
js/lib/                  Shared modules: files, zip, store (IndexedDB), batch queue, image ops, worker pool
js/workers/              Web Worker entry points
js/vendor/               Cropper.js, pdf-lib, pdf.js
scripts/                 Build and maintenance scripts (not loaded by pages)
tests/                   Node and Playwright test suites
docs/                    Roadmap, progress, design system, SEO setup, licences
```

## Local development

Requirements depend on what you run:

| To | You need |
|---|---|
| Open the site and run `npm test` | Node.js 22 and npm (`npm ci`) |
| Also check or rebuild the icon subset (`npm test` skips that check without it) | Python 3 with `pip install fonttools brotli` |
| Run `npm run test:browser` | Chromium for Playwright: `npx playwright install chromium`, or set `BROWSER_EXECUTABLE_PATH` to a local Chromium or Chrome; poppler-utils (`pdfinfo`, `pdftotext`), `unzip` and ImageMagick (`identify`, `convert`), which the suites use to check downloaded files; Python 3 with `pip install pillow`, which some suites use to make and check images |
| Regenerate the sample files and guide screenshots | Python 3 with Pillow and the same Chromium (`pdfinfo` is used to check the sample PDFs when it is installed) |

On Debian or Ubuntu: `sudo apt-get install poppler-utils unzip imagemagick`. On macOS with Homebrew:
`brew install poppler imagemagick`. CI (`.github/workflows/quality.yml`) installs exactly this list.

Serve the repository root over HTTP, at the root of the host (not `file://` and not a sub-path): the
service worker is registered at `/sw.js` and caches root paths, the 404 and offline pages and the font
preloads use root paths (such as `/css/app.css` and `/assets/fonts/`), and browsers block service workers, module scripts and
Web Workers on `file://` pages. Other pages use relative paths.

```bash
python3 -m http.server 8000
```

Open http://localhost:8000/. The service worker caches pages; use a private window or "Update on reload"
in DevTools while editing.

## Generated parts of pages

Edit the generator, not the generated markup:

| Command | Writes |
|---|---|
| `node scripts/sync-shell.js` | Header, footer, stylesheets, CSP and asset versions on every page; the search index `js/tool-index.js`; the service worker precache list and cache name in `sw.js` |
| `node scripts/build-directory.js` | Tool listings on the home page and `tools.html` |
| `node scripts/build-image-pages.js` | The resizer workspace on the image resizer pages, and the batch workspace on the batch, compressor and converter pages (`scripts/lib/batch-workspace.js`) |
| `node scripts/build-tool-pages.js` | The workspace of the signature cleaner, passport print, image to PDF and compress PDF pages |
| `node scripts/build-pdf-pages.js` | The PDF tool pages (merge, split, organise, PDF to images, extract text, page numbers, watermark): their workspace, and with `--force` the whole page, including the common requests, the questions and their structured data, and the guide cards |
| `node scripts/build-sitemap.js` | `sitemap.xml` |
| `python3 scripts/build-icons.py` | The Font Awesome subset (`css/vendor/icons.min.css`, `css/webfonts/`) |
| `node scripts/new-page.js <path> "<Title>" "<Description>"` | A new page with the shared head and shell markers |

Each generator has a `--check` mode that writes nothing and exits 1 if its output is out of date;
`npm test` runs every one of them, so a hand edit inside generated markup fails the tests. The icon subset changes the
stylesheet, so run `node scripts/sync-shell.js` once more after `build-icons.py` to refresh the service worker's cache name.

## Guide screenshots and sample files

Screenshots in the guides and step-by-step tutorials are taken from the running site, never mocked up.
The inputs are synthetic samples made by scripts (no real person or document), so every image can be
regenerated after an interface change:

```bash
python3 scripts/make-sample-images.py   # test photos and signature (img/samples/), tutorial photos (img/samples/guide/)
node scripts/make-sample-pdfs.js         # sample PDFs for the tutorials, one protected with the password "sample"
BROWSER_EXECUTABLE_PATH=/path/to/chrome node scripts/guide-screenshots.js [shot ...]
```

`guide-screenshots.js` drives each tool with Playwright, draws numbered callouts over real elements, saves
WebP files in `img/guides/`, records their size and alt text in `img/guides/manifest.json` and updates the
width, height and alt text of every `<img>` that shows them. Each shot is also taken in a 360 px phone
window at 2x (`img/guides/phone/`), and pages offer that capture to narrow screens through `<picture>`, so
a reader on a phone sees the layout they use at a size they can read. `--desktop` or `--phone` takes only
one of the two; `--sync` only rewrites the page markup from the manifest. `tests/guides_tests.js` (part of `npm test`) checks that
images, manifest and pages agree, and `tests/tutorial_tests.js` (part of `npm run test:browser`) follows each
tutorial in the tools and fails when a label, message or measurement quoted in a tutorial no longer matches.

## Testing

```bash
npm ci
npm test
```

`npm test` runs the unit suite, behaviour regressions, the content checks (metadata, links, sitemap,
offline cache, CSP, the single donation link, and guards that fail if advertising or the retired test-specific pages come back)
and the guide image checks.

```bash
npm run test:browser
```

The browser suites drive every tool in Chromium with Playwright and check the downloaded files with
independent tools, so they need the extra programs listed under [Local development](#local-development).
Set `BROWSER_EXECUTABLE_PATH` to use a locally installed Chromium or Chrome instead of
`npx playwright install chromium`. Each suite can also be run alone, for example
`node tests/pdf_tools_tests.js`. CI (`.github/workflows/quality.yml`) runs both on every push and
pull request to `main`.

## Deployment

GitHub Pages serves `main` as static files. There is nothing to configure: no build step, secrets or
environment variables. Run `node scripts/sync-shell.js` before committing so the service worker cache
name changes with the release.

## Support the project

ApplyReady is free and open source. If you find it useful and would like to support its continued
development, you can [contribute voluntarily](https://pages.razorpay.com/support-applyready). Your support
helps maintain and improve the platform. All features remain free, regardless of contributions.

## Licence

Copyright (C) 2026 Sumit Sengar and contributors.

ApplyReady is free software: you can redistribute it and/or modify it under the terms of the
[GNU Affero General Public License, version 3](LICENSE) (AGPL-3.0-only). In short: you may use, study,
change and share it; if you run a modified version as a public website, you must offer its source code
to its users under the same licence. That keeps ApplyReady and every derivative free and open.

Third-party components keep their own licences (MIT, BSD, Apache-2.0, OFL, CC BY; see
[`docs/DEPENDENCIES.md`](docs/DEPENDENCIES.md) and `docs/licenses/`).

## Contact

Questions: hello@nbsumit.com. Bugs and ideas: [GitHub issues](https://github.com/nbsumit/applyready/issues).
Security problems: see [`SECURITY.md`](SECURITY.md).
