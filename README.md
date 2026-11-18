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
| Compress PDF (scanned PDFs) | `compress-pdf.html` | `js/compress-pdf.js` |

Every tool is listed in one registry, `scripts/lib/tools.js`, which generates the header menu, footer,
the tool directory (`tools.html`), the home page entry points and the site search index.

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

Requirements: Node.js 22 and npm; Python 3 with `fonttools` and `brotli` only to rebuild the icon subset.
Pages use root-relative paths, so serve the repository root over HTTP:

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
| `node scripts/build-pdf-pages.js` | The PDF tool pages (merge, split, organise, PDF to images, extract text, page numbers, watermark): their workspace, and with `--force` the whole page, including the questions and their structured data |
| `node scripts/build-sitemap.js` | `sitemap.xml` |
| `python3 scripts/build-icons.py` | The Font Awesome subset (`css/vendor/icons.min.css`, `css/webfonts/`) |
| `node scripts/new-page.js <path> "<Title>" "<Description>"` | A new page with the shared head and shell markers |

Each generator has a `--check` mode, and `npm test` fails when anything is out of date. The icon subset changes the
stylesheet, so run `node scripts/sync-shell.js` once more after `build-icons.py` to refresh the service worker's cache name.

## Testing

```bash
npm ci
npm test
```

`npm test` runs the unit suite, behaviour regressions and the content checks (metadata, links, sitemap,
offline cache, CSP, the single donation link, and guards that fail if advertising or the retired test-specific pages come back).

```bash
npm run test:browser
```

The browser suites drive every tool in Chromium with Playwright. Set `BROWSER_EXECUTABLE_PATH` to use a
locally installed Chromium or Chrome. CI (`.github/workflows/quality.yml`) runs both on every push and
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
