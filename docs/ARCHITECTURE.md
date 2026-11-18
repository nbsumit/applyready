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
  │               js/lib/pdf-kit.js    lazy loader and helpers for pdf-lib and pdf.js
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
| `scripts/build-tool-pages.js` | the workspace of the older single-file tools |
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
any storage. Closing the tab removes them.

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

### Backup files

Single resume (unchanged from earlier versions, still importable):

```json
{ "app": "ApplyReady", "version": 2, "exportedAt": "2026-11-18T10:00:00.000Z", "data": { } }
```

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

Importing never overwrites: each imported resume becomes a new library entry. Files over 5 MB, with an
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
- **PDF**: pdf-lib for structure (merge, split, rotate, reorder, page numbers, watermark, image to PDF);
  pdf.js (in its own worker) for rendering, thumbnails and text. Encrypted PDFs are detected and
  explained. Output is reopened and checked (page count) before it is offered.
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
