# ApplyReady architecture

ApplyReady is a static site. There is no server application, database, account system or API: every
page is an HTML file served by GitHub Pages, and every tool runs in the visitor's browser. This
document explains how the pieces fit, and the contracts that modules must keep.

## 1. Layers

```
Pages (*.html, guides/)          Hand-written content + generated shell and tool markup
  │
  ├─ Shell        js/site.js       theme, header menu, mobile sheet, search loader, toasts, confirm dialog, recent tools
  │               js/components.js custom select, ranges, workspace state machine (.ws data-state)
  │               js/search.js     site search (dialog and inline), uses js/tool-index.js
  │
  ├─ Tool scripts js/<tool>.js     one per tool page: interface only; no processing maths
  │
  ├─ Shared lib   js/lib/files.js      type detection by magic bytes, safe names, sizes, download
  │               js/lib/file-kit.js   drop zone, thumbnails, ZIP download, unload guard, announcements
  │               js/lib/zip.js        ZIP writer (stored entries, UTF-8 names, unique names)
  │               js/lib/batch.js      queue: concurrency, per-item status, cancel, retry
  │               js/lib/image-ops.js  worker-safe resize/crop/convert/size-target/JPEG padding
  │               js/lib/image-pool.js Web Worker pool for image-ops (main-thread fallback)
  │               js/lib/store.js      IndexedDB wrapper with memory fallback and storage status
  │               js/lib/pdf-kit.js    lazy loader and helpers for pdf-lib and pdf.js (structure, drawing, text, compression)
  │               js/lib/pdf-kit-boot.js  module script that imports pdf.js; injected by pdf-kit.js on first use
  │               js/lib/pdf-ui.js     shared PDF tool interface: one-PDF intake, password dialog, progress and cancel,
  │                                    drag to reorder, lazy page thumbnails
  │               js/lib/inspect.js    file checker parsers: real type, image/PDF/Office details, requirement check, lossless metadata removal
  │               js/lib/text-pdf.js   text to PDF: WinAnsi character check, word wrap, pagination, PDF writing (pdf-lib standard fonts)
  │               js/lib/applicants.js applicant workspaces: memory-only session of isolated applicants (files, results,
  │                                    jobs, object URLs), job delivery guard, wipe on finish; no DOM, unit-tested in Node
  │
  ├─ Workers      js/workers/image-worker.js
  │
  └─ Vendor       js/vendor/cropper.min.js, js/vendor/pdf-lib.min.js (@cantoo/pdf-lib), js/vendor/pdfjs/
```

Rules:

- **Interface, processing and storage are separate.** A tool script reads the form, calls shared
  modules, and renders results. Processing (images, PDFs, ZIP) lives in `js/lib/` and is testable in
  Node or a worker. Only `js/lib/store.js` touches IndexedDB.
- **Modules are plain scripts** that define one global (`window.ApplyReadyX`) and, where useful, a
  CommonJS export for Node tests (UMD pattern, see `js/lib/zip.js`). No bundler, no ES module graph,
  except pdf.js, which ships as ES modules and is loaded with dynamic `import()` by `pdf-kit.js`.
- **Untrusted input.** Every file is identified by its first bytes (`ApplyReadyFiles.validate`),
  size-limited per tool, and decoded in a way that fails safely. User text is inserted with
  `textContent` or escaped before `innerHTML`. File names are cleaned before reuse.

## 2. Generated markup and the tool registry

`scripts/lib/tools.js` is the single list of tools (id, name, path, category, icon, summary, search
keywords, `live`). Generators read it:

| Generator | Output |
|---|---|
| `scripts/sync-shell.js` | header (Tools menu by category), footer, stylesheet links, CSP and `applyready-tool` meta on every page; calls `build-tool-index.js` (→ `js/tool-index.js`) and `build-sw.js` (→ `sw.js` precache list and content-hash cache names) |
| `scripts/build-directory.js` | category cards and "most used" on `index.html`; the full directory on `tools.html` |
| `scripts/build-image-pages.js` | the resizer workspace on each resizer page (`PAGES` table) |
| `scripts/build-tool-pages.js` | the workspace of the older single-file tools (signature cleaner, image to PDF, compress PDF, print sheet) |
| `scripts/build-pdf-pages.js` | the PDF tool pages: workspace, and with `--force` the whole page (questions and FAQPage data come from one list) |
| `scripts/build-sitemap.js` | `sitemap.xml` |
| `scripts/build-icons.py` | the Font Awesome subset |

A tool with `live: false` is hidden everywhere and must not be linked from any page (a content test
enforces this). New pages are created with `node scripts/new-page.js` (or `createPage()` from it), which
writes the shared head in the right order: CSP meta first, then everything else.

## 3. Browser storage

Everything stays on the device. Nothing below is ever sent anywhere.

| Where | Key / store | Contents | Written by |
|---|---|---|---|
| `localStorage` | `applyready_theme` | `light` or `dark`, only after the visitor picks one | `js/site.js` |
| `localStorage` | `applyready_recent_tools` | up to six tool ids, e.g. `["merge-pdf","resume"]` | `js/site.js` |
| `localStorage` | `applyready_recent_off` | `1` when the visitor turned recent tools off | Your data page |
| IndexedDB `applyready` v1 | `resumes` (keyPath `id`, index `updatedAt`) | saved resumes, see below | resume builder |
| IndexedDB `applyready` v1 | `meta` (keyPath `key`) | small app records, e.g. `{ key: 'lastResumeId', value }`, `{ key: 'resumeSaving', value: 'off' }` | resume builder |
| Cache Storage | `applyready-<hash>`, `applyready-vendor-<hash>` | the site's own pages and code for offline use | `sw.js` |

Applicant workspaces (cyber cafe mode) keep files **in memory only**; nothing about them is written to
any storage. Closing the tab removes them. Each applicant is an object from `js/lib/applicants.js` that owns
its files, results, running jobs and every object URL made for it (thumbnails, result links, its ZIP). A job
keeps a reference to the applicant that started it and delivers its result there, never to whoever is on
screen; `endJob` returns false once the job was cancelled or the applicant finished, and the result is
dropped. Finishing an applicant aborts its jobs (image workers are terminated), revokes its URLs and drops
every reference; the page then rebuilds the panel from the next applicant. Leaving the page (`pagehide`)
ends the session too. Names typed for applicants use `autocomplete="off"` and `spellcheck="false"` so they
do not reach the browser's form history or online spellcheck, and toasts and announcements never carry
names. `tests/workspace_tests.js` checks the DOM, the blob URLs and every storage after finishing.

### Resume record (IndexedDB `resumes`)

```js
{
  id: 'r_<random>',            // stable id, [A-Za-z0-9_-]{1,80}
  name: 'Resume for analyst roles',
  createdAt: 1763452800000,    // ms since epoch
  updatedAt: 1763456400000,
  schemaVersion: 3,            // version of `data`, see js/resume-schema.js
  data: { ... }                // the resume itself, always passed through ApplyReadySchema.migrate()
}
```

Every read goes through `ApplyReadySchema.migrate()` before it reaches the editor: it rebuilds the
object from an allow-list, so a damaged or hostile record cannot inject markup (the editor relies on
entry ids matching `^[A-Za-z0-9_-]{1,80}$`). A record that fails validation is listed as damaged,
never opened silently, and can be exported raw or deleted.

Resume data version 3 (`js/resume-schema.js`) adds `references` (name, title, organization, contact),
`referencesOnRequest`, `customSections` (`{ id, title, mode: 'entries' | 'text', visible, text,
entries: [{ id, title, subtitle, date, bulletsText }] }`, at most 20) and a top-level `publications`
list (versions 1 and 2 kept publications in `academic.publications`; migration moves them and keeps
their visibility). Section order holds the fixed section keys plus `custom:<id>` for each custom
section. Migration from versions 1 and 2 is lossless, and `validate()` accepts versions 1 to 3.

Resume modules: `js/resume-library.js` (record and backup formats, no interface, unit-tested in Node),
`js/resume-library-ui.js` (autosave, status, My resumes, import and export, cross-tab safety),
`js/resume-sections.js` (references and custom sections editor), `js/resume-render.js` (HTML
document) and `js/resume.js` (the editor, exposed to the others as `window.ApplyReadyResumeEditor`).
Autosave writes about 600 ms after typing stops and at once on `visibilitychange` (hidden) and
`pagehide`. Before each write the stored `updatedAt` is compared with the version this tab last read,
and tabs announce saves on the `BroadcastChannel` named `applyready-resumes`. A tab with nothing
unsaved simply shows the newer version; a tab with unsaved changes pauses saving and asks which
version to keep. Library actions (new, open, import, duplicate, delete) run one at a time, and a new
blank resume is stored only once something is typed into it.

### Backup files

Single resume (unchanged from earlier versions, still importable):

```json
{ "app": "ApplyReady", "version": 2, "exportedAt": "2026-11-18T10:00:00.000Z", "data": { } }
```

So that earlier releases can still import it, `data` carries `version: 2`, a section order made only
of the version 2 sections and a copy of the publications in `academic.publications`; the full order
travels in `data.design.sectionOrderV3` and `data.schemaVersion` is 3. The file may also carry the
resume's `name`, `createdAt` and `updatedAt`, which older importers ignore.

All resumes (Your data page and the resume library):

```json
{
  "app": "ApplyReady",
  "kind": "resume-library",
  "version": 1,
  "exportedAt": "2026-11-18T10:00:00.000Z",
  "resumes": [ { "name": "…", "createdAt": 0, "updatedAt": 0, "data": { } } ]
}
```

The Your data page reads, exports and imports resumes with the same `js/resume-library.js` functions as the
resume builder, refuses an import when saving is switched off or browser storage is unavailable, and
posts `deleted` and `saved` messages on the `applyready-resumes` channel so open builder tabs follow.

Importing never overwrites: each imported resume becomes a new library entry, keeping the edit
dates from the file (never later than the import). Files over 5 MB, with an
unknown `app`, or with a newer version than the code understands are refused with a message.

## 4. Processing

- **Images**: `image-ops.js` decodes with `createImageBitmap` (EXIF orientation applied), draws with
  stepped downscaling, and encodes with a quality search to meet a KB limit. When shrinking is allowed,
  quality stops at 50% and the largest pixel size that fits is found by bisection instead; otherwise
  quality may go down to 5% and the pixel size never changes. Re-encoding drops EXIF, GPS and other metadata. Before decoding it reads the pixel size and
  EXIF orientation from the file header and refuses images over 50 megapixels; after encoding it decodes
  the result again and checks type, pixel size and byte limit (`verified: true`). `image-pool.js` runs it
  in workers, forwards per-item progress, and terminates the worker on cancel; if the worker script
  cannot start, jobs run on the main thread instead.
- **Batches**: `batch.js` runs at most N jobs at once (default 2), so memory stays bounded; results are
  Blobs released when an item is removed or the list is cleared.
- **PDF**: pdf-lib for structure (merge, split, rotate, reorder, page numbers, watermark, images as pages);
  pdf.js (in its own worker) for rendering, thumbnails and text. Every PDF is checked before a library
  sees it (header, a missing end of file means a truncated download). Password-protected PDFs open after
  an accessible password dialog; the password stays in the tab, the file is decrypted in memory and
  outputs are saved without encryption. Output is reopened and checked (page count, and page sizes for
  the compressor) before it is offered. Compress PDF draws each page with pdf.js and saves it as a JPEG
  whose quality is searched to fit the page's share of the limit (resolution lowered only when needed,
  down to 50 DPI), then rebuilds the document with the same page count, order, sizes and rotation; the
  pages become images. Limits: 100 MB per PDF, 500 MB per merge, 300 pages for the compressor, 500 for
  PDF to images, 1,500 for organise, canvases under 16 million pixels.
- **pdf.js and the CSP**: pdf.js loads as an ES module from a same-origin URL and runs in a module
  worker. Its WebAssembly decoders (JPEG 2000, JBIG2, colour profiles) run inside that worker, which
  takes no policy from the page's CSP meta tag; `tests/pdf_tools_tests.js` decodes a JPEG 2000 image to
  confirm it works under the site CSP in Chromium.
- **ZIP**: stored entries; no ZIP64, so archives stop at 4 GB with a clear message.

## 5. Offline

`sw.js` precaches pages, styles, scripts, fonts and guide images, under a cache name derived from a hash
of their content, so every release reaches returning visitors without a manual version bump. Vendored
libraries are cached on first use in a separate cache that survives releases until a vendored file
changes. Pages are network-first; assets are stale-while-revalidate.

## 6. Security boundaries

- CSP meta on every page: `default-src 'self'; script-src 'self'; connect-src 'self' blob: data:;
  worker-src 'self' blob:; frame-src 'none'; object-src 'none'` and related directives. No inline
  scripts, no `eval`. GitHub Pages cannot send headers, so `frame-ancestors` and HSTS are not set.
- No third-party requests. The only external links are the source repository and the donation page.
- See `SECURITY.md` for reporting vulnerabilities.
