# ApplyReady transformation roadmap

ApplyReady — Free. Open Source. Forever.

This is the working plan for turning ApplyReady from an exam-photo utility into a free, open-source,
privacy-first toolkit for job applications. Progress against it is recorded in `docs/PROGRESS.md`.
The plan was written after a full audit on 18 November 2026 (section 1); decisions are explained so
that a contributor can disagree with them on the merits.

## 0. Principles that decide trade-offs

1. **Quality over feature count.** A tool ships only when it handles real files, bad files and large
   files, verifies its own output and works on a phone. A tool that cannot be made reliable in a
   browser is documented as a limitation, not shipped half-working.
2. **Nothing leaves the device.** No uploads, accounts, analytics, ads or third-party requests. The
   Content Security Policy enforces this (`connect-src 'self'`).
3. **Static and boring.** Plain HTML, CSS and JavaScript on GitHub Pages. No framework, bundler or
   backend. Generators in `scripts/` keep shared markup consistent.
4. **Find it in seconds.** Every tool has its own URL, is reachable from the header in two clicks or
   less, and is found by search under the words people actually use.
5. **Honest copy.** No claim the code does not back (for example "ATS-proof"), no fake screenshots.

## 1. Audit findings (baseline, 18 Nov 2026)

| Area | Finding |
|---|---|
| Stack | 57 static pages, vanilla JS (≈17k lines incl. tests), GitHub Pages, CSP meta tag, service worker. Live site equals `main`. |
| Tests | `npm test`: 571 unit + 50 regression + 5,630 content assertions pass. `npm run test:browser`: 6 Playwright suites (≈6,200 checks) pass in 4 min 25 s with `BROWSER_EXECUTABLE_PATH` set. |
| Page weight | 476–873 KB per page uncached. 153 KB is the full Font Awesome solid font (47 glyphs used of 1,391); 118 KB is the Devanagari font, downloaded on every page only because the header's "हिन्दी" link contains Devanagari text. |
| Identity | Built around Indian exam portals: 5 exam pages, 5 Hindi exam pages, exam presets, exam FAQs on tool pages, an editorial policy about exam sources, author bylines on every guide. AdSense was already removed (15 Nov). No paid plans exist. |
| Resume builder | Strong engine: 15 templates (≈12 visually distinct), vector PDF engine, DOCX, TXT, JSON backup, review checks, keyword match. **Saving is opt-in and off by default**, a single draft in `localStorage`, written on every keystroke with no debounce. No multiple resumes, no references or custom sections. Undo history would leak across documents if documents were switched. |
| Image tools | Precise single-image resizer (crop, exact pixels, KB search, JPEG padding). Logic is tied to globals and Cropper; no batch mode, no worker. Passport-print "Remove" leaves the previous photo exportable (privacy bug for shared PCs). |
| PDF tools | Image to PDF and a heuristic "compress PDF" that scans bytes for JPEGs. No PDF parser: merge, split, rotate, reorder, page numbers, PDF→image and text extraction are impossible with current code. Compress PDF can silently drop text pages in PDF 1.5+ files. |
| Accessibility | axe runs on every page in both themes; keyboard and focus tests exist. Good base. |
| Security | Every `innerHTML` sink escapes; strict CSP; no third parties. GitHub Pages cannot send HSTS or frame-ancestors headers. |
| Open source | Code is public but there is **no LICENSE file**, so it is not legally open source yet. |
| Donation page | Content matches the philosophy (voluntary, no perks, all features free). Issues for the owner: Razorpay default title "Pay for Support ApplyReady ❤️ by Sumit Sengar", personal phone number published, merchant shown as a person with an "nb" logo rather than ApplyReady, no suggested amounts, and the page disables pinch-zoom (Razorpay template). See `docs/PROGRESS.md` → "Owner actions". |

## 2. Information architecture

### Categories and tools (each tool has its own URL)

| Category | Tools |
|---|---|
| Resume | Resume builder with saved resumes (`resume.html`) |
| Image | Image resizer (`image-resizer.html`), Passport photo resizer, Signature resizer, Image compressor, Image converter, Signature cleaner, Passport photo print sheet, Resize to 20 KB / 50 KB / any KB |
| PDF | Merge PDF, Split PDF, Organize pages (reorder, rotate, delete), Image to PDF, Compress PDF, PDF to images, Extract text, Add page numbers, Watermark PDF |
| Document | Text to PDF, File checker (type, size, dimensions, metadata; remove photo metadata) |
| Batch processing | Batch image processor (resize, compress, convert many photos and signatures, ZIP); multi-file modes of the PDF tools |
| Cyber cafe | Applicant workspaces (temporary, one per applicant, ZIP per applicant, wipe on finish) |

Word-to-PDF is **not** offered: faithful DOCX layout needs a layout engine (Word or LibreOffice); a
browser version would silently lose tables, headers and fonts. The File checker and FAQ explain how to
export PDF from Word, Google Docs or LibreOffice instead.

### Navigation

- **One registry** (`scripts/lib/tools.js`) lists every tool: id, URL, category, icon, one-line
  purpose and search synonyms. It generates the header menu, footer, tool directory, search index
  (`js/tool-index.js`), category sections, related-tool links and sitemap entries, so they never drift.
- **Header**: brand · Tools (mega menu by category, progressive disclosure) · Resume builder ·
  Guides · Search (button and `/` or `Ctrl K`) · theme. Mobile: search first, categories as a sheet.
- **Global search**: a combobox dialog, instant, ranked by name, synonyms and category, typo tolerant,
  fully keyboard operable, works offline (index is a static script). Synonyms cover the words people
  type: "photo size", "kb", "reduce", "shrink", "join pdf", "combine", "cv", "sign"...
- **Tool directory** (`tools.html`): every tool by category with a filter box; categories are anchor
  sections with stable URLs (`tools.html#pdf`).
- **Homepage**: what ApplyReady is (one sentence), search, the six category entry points, the five most
  used tools, "continue your resume" when a saved resume exists, the privacy promise in four short
  points. No exhaustive catalogue.
- **Recently used tools**: tool ids only, in `localStorage`, shown in search and on the home page,
  cleared from "Your data". Never file names or content.
- **Breadcrumbs** on tool pages (Home › Category › Tool) and **related tools** under each tool.

## 3. Architecture

```
scripts/lib/tools.js         tool registry (single source of truth for navigation and search)
scripts/lib/shell.js         header, footer, CSP, styles (generated into every page)
js/site.js                   shell behaviour, toast, confirm dialog, search dialog, recent tools
js/lib/files.js              type detection by magic bytes, safe file names, sizes, download
js/lib/zip.js                ZIP writer (stored entries, UTF-8 names, unique names)
js/lib/store.js              IndexedDB wrapper with in-memory fallback and storage status
js/lib/batch.js              batch queue: concurrency, per-item status, cancel, retry
js/lib/image-ops.js          worker-safe resize / crop / convert / size-target encode / JPEG padding
js/lib/image-pool.js         Web Worker pool for image-ops, main-thread fallback, abort = terminate
js/workers/image-worker.js   worker entry
js/lib/pdf-kit.js            lazy loader and helpers around pdf-lib (structure) and pdf.js (render, text)
js/vendor/                   Cropper.js, @cantoo/pdf-lib 2.11.1 (MIT), pdf.js 6.5.438 legacy (Apache-2.0)
```

Dependencies were chosen for reliability and maintenance: `@cantoo/pdf-lib` is the maintained MIT fork
of pdf-lib (2026 releases, encrypted-file support, no `eval`); pdf.js is Mozilla's renderer, the legacy
build for older browsers in cyber cafes. Both run under the existing CSP without `unsafe-eval`
(verified in Chromium). They load only on PDF pages.

Storage: IndexedDB database `applyready` (v1): `resumes`, `meta`. `localStorage` only for the theme
and the recent-tools list. Applicant workspaces are memory-only by design.

## 4. Phases and acceptance criteria

| Phase | Scope | Done when |
|---|---|---|
| 0 Discovery | Audit, baseline, this plan | Baseline recorded; plan committed |
| 1 Cleanup and identity | Remove exam pages, Hindi pages, exam presets and copy, author/editorial pages; icon subset; registry-driven navigation; search; new home and tool directory | No exam references outside history; all pages pass content, UI and axe tests; search finds every tool |
| 2 Resume | IndexedDB library: autosave (debounced), multiple resumes, rename, duplicate, delete with confirm, timestamps, save status, JSON export/import (single or all), version migration, corrupted-record handling, storage controls; references and custom sections; template set reviewed | End-to-end test: create, fill, refresh, reopen, edit, duplicate, export, import, verify every field |
| 3 Document utilities | PDF suite on pdf-lib/pdf.js; compressor rebuilt on render+rebuild; image compressor and converter; file checker; text to PDF | Each tool tested with real, invalid, encrypted and large files; outputs verified (pdfinfo, pdftotext, decode) |
| 4 Batch | Batch image processor on the queue and worker pool: drag-drop, previews, per-file status, overall progress, cancel, retry, individual and ZIP downloads, duplicate names, memory limits | 50-file batch test with cancel and retry; ZIP verified with `unzip -t` |
| 5 Cyber cafe | Applicant workspaces | Switching never shows another applicant's files; wipe verified; warnings before clearing and on tab close |
| 6 Docs and trust | Practical guides with genuine screenshots; About, Philosophy, Privacy, Terms, Contact, Feedback, Changelog, Contribute | Every guide describes shipped behaviour; screenshots generated from the running app |
| 7 Open source | LICENSE (owner's choice), README, CONTRIBUTING, CODE_OF_CONDUCT, SECURITY, templates, ARCHITECTURE, dependency licences | Licence decision recorded; all files present |
| 8 SEO and performance | Metadata, sitemap, structured data, landing pages, page weight | Content tests pass; page weight measured against baseline |
| 9 Release readiness | Full review as each persona, tests, CI | All suites green; remaining imperfections listed honestly |
