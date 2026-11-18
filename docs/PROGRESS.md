# ApplyReady transformation: progress

Plan: [`ROADMAP.md`](ROADMAP.md). This file records what is done, how it was verified and what remains.
It is updated at the end of each phase.

## Current state (18 Nov 2026)

All nine phases of the roadmap are implemented, reviewed and merged on the development branch. Nothing
has been deployed: publishing is an owner decision (see "Owner actions" below). Known limitations are
listed at the end of this file.

## Phase 9: final review by persona, and fixes (complete, 18 Nov 2026)

Eight independent reviewers used the whole site as a first-time visitor, a job seeker, a cyber cafe
operator, a phone user, a keyboard and screen-reader user, and as SEO, security/privacy and
documentation/open-source reviewers. They reported 105 findings (9 high, 43 medium, 53 low). A second
agent reproduced every high and medium finding before any work started; one was rejected as a feature
request (saving workspace settings, which workspaces deliberately do not keep).

The findings were fixed in six packages, each on its own branch. Each package was then checked by a
separate verifier, who replayed the original scenarios at 1280 px and 360 px and reviewed the diff.
Every issue the verifiers raised (16 in all, including one new keyboard trap and a 404 search panel
covering its own buttons) was fixed before merging. Highlights:

- **Search and navigation:** the directory filter shows exactly the cards it counts, and the KB pages
  appear as presets of the image resizer. Search understands conversions ("word to pdf" leads to help
  on exporting from Office, not to the resume builder), swapped-letter typos, and tool popularity. The
  phone menu is grouped by category, starts with search, fits one screen and traps focus while open.
  Menu, home page and directory use the same category order. Each tool is listed once in the footer,
  and every footer page can be found by search.
- **Older pages and SEO:** registry names, sentence case and correct breadcrumbs on every tool page,
  titles of at most 65 characters, descriptions of at most 160, complete Open Graph tags on every page
  (generated, and checked by the content tests), and a new social card. The 404 page sends moved
  pages to their new address, explains removed ones, and offers a search. About and the changelog are current, and Font Awesome is credited.
- **Resume builder:** templates apply their promised section order (unless the order was set by
  hand); skill labels no longer change with the template; a rupee sign, arrow or tick is named with the
  field that holds it and can be replaced in one click (₹ becomes "Rs."); page breaks never split a bullet; re-importing a backup skips
  identical resumes and marks restored copies; download names include the resume's name; keyboard focus is kept when moving
  entries; and errors are shown next to the field. The Word engine loads only when it is needed.
- **Image and cyber cafe tools:** nothing carries over from one customer to the next (name strip,
  label, merged file name). Downloads are named after the source file. Names such as "Ravi S/O Ramesh"
  survive in ZIP names. The Organise PDF Restore icon is fixed. On phones the result's Download button
  is scrolled into view, and every batch ZIP can be named.
- **Security and privacy:** photos merged into a PDF no longer carry their EXIF block (GPS, camera,
  date). PDFs have a 2,000-page limit, and images are checked for decompression bombs before a
  thumbnail is drawn. Hidden direction characters are shown in file names instead of disguising the
  extension. The file checker warns about executable and unknown extensions. Your data lists a resume
  draft left by an older version. The service worker no longer downloads the whole site on the first
  visit: a full offline copy is the visitor's choice on Your data, and Save-Data is respected.
- **Docs and guides:** tutorial screenshots now have phone captures, so text is readable on a phone,
  and every PDF tool page links its guide. README, CONTRIBUTING and Contribute list every tool and
  every test prerequisite. `build-tool-pages.js` gained the `--check` mode the README promised.

## Verification of the final tree (18 Nov 2026)

- `npm test`: 646 unit, 64 regression, 119 document-tool and 56 workspace-model checks; 10,722 content
  assertions on 70 pages (titles, descriptions, canonicals, Open Graph, links, sitemap, offline cache,
  no ads or exam content, one donation link, registry and every generator's `--check`, stylesheet
  braces); 994 guide and tutorial assertions; 239 navigation and search checks. All pass.
- `npm run test:browser` (Chromium, suites run one after another): browser tests 2,833 assertions,
  image workflow 296, resume flow 96, resume library 144, UI suite 3,571 (every page at 32 widths,
  axe in light and dark), robustness 81, PDF tools 222, batch images 283, document tools 153,
  applicant workspaces 137, tutorials followed in the real tools 208, smoke 20. All pass.
- Tutorial screenshots were retaken from the merged interface (35 desktop and 35 phone captures) and
  checked by eye.
- Not run here: the Firefox suites (`npm run test:firefox`, no Firefox in this environment), Safari
  (no WebKit test), and the GitHub Actions workflow itself (nothing has been pushed to a pull request).

Page weight, first visit with no cache, measured in Chromium at 360 px on a throttled "slow 4G" link
(1.6 Mbps, 150 ms latency). The test server did not compress, so the times are pessimistic; GitHub
Pages serves the text files gzipped (the gzip column).

| Page | Requests | Raw KB | Gzip KB | First paint | Load |
|---|---|---|---|---|---|
| Home | 14 | 356 | 128 | 2.2 s | 2.4 s |
| All tools | 12 | 345 | 122 | 2.1 s | 2.3 s |
| Image resizer | 15 | 478 | 193 | 2.5 s | 2.9 s |
| Resume builder | 22 | 734 | 226 | 3.7 s | 4.0 s |
| Merge PDF | 15 | 431 | 153 | 2.5 s | 2.7 s |
| Compress PDF | 14 | 414 | 147 | 1.8 s | 3.2 s |
| Batch images | 16 | 412 | 147 | 2.4 s | 2.6 s |
| Applicant workspaces | 18 | 506 | 175 | 2.9 s | 3.1 s |
| File checker | 16 | 455 | 161 | 2.7 s | 2.8 s |
| A tutorial | 10 | 328 | 143 | 1.8 s | 2.2 s |
| About | 9 | 289 | 108 | 1.8 s | 2.0 s |

pdf.js and pdf-lib (about 2.4 MB uncompressed, with the pdf.js worker) load only when a PDF is opened, and are then cached. After the first
visit, the service worker serves every file it has seen from this device.

## Known limitations (honest list)

- **Resume PDF fonts:** the built-in PDF writer uses standard fonts. A ₹ sign, arrows, ticks or text in
  an Indian script cannot be written; the builder names the character and field, offers a one-click
  replacement where one exists, and otherwise uses the browser's Save as PDF.
- **Compress PDF** turns pages into images to reach a size, so text in the result is not selectable
  (the page says so). Word, Excel and PowerPoint files are not converted; a help section explains how
  to export a PDF from Office, Google Docs or LibreOffice.
- **HEIC photos** cannot be opened by most browsers; the tools explain how to get a JPEG instead.
- **Per-job limits that protect the browser tab:** 500 images per batch, 50 files and 500 MB per merge,
  100 MB per PDF, 50 MB and 50 megapixels per image, 2,000 pages per PDF job. Each tool states its own.
- **Performance:** one stylesheet (161 KB, about 29 KB gzipped) is loaded by every page, and the
  resume builder loads its PDF engine on page load because the live preview uses it. Both are
  candidates for splitting.
- **Applicant workspaces** keep nothing after "End session", including the size settings; an operator
  enters them again for each session. This is deliberate.
- **Phones:** inside the full-height My resumes dialog a message can briefly cover the text under the
  save switch.
- **A resume draft from a release before the resume library** is listed on Your data, where it can be
  downloaded or deleted, but it is not deleted automatically when saving is switched off.
- **Browsers:** tested automatically in Chromium only in this environment; Firefox suites exist but were
  not run here, and Safari/iOS has not been tested.

## Phases 5 to 8 (complete, 18 Nov 2026)

- **Phase 5, applicant workspaces (cyber cafe mode):** a separate, memory-only workspace per applicant,
  with passport photo, signature, documents and a combined PDF. Each applicant gets a ZIP named after
  them, and "End session" leaves nothing behind. It was reviewed in the same way as the earlier phases;
  the review caught a password dialog opening for the wrong applicant, among other defects.
- **Phase 6, documentation and tutorials:** nine step-by-step tutorials with genuine screenshots taken
  from the real tools by `scripts/guide-screenshots.js`, rebuilt whenever the interface changes. The
  About, Philosophy, Privacy (with a storage table), Terms, Contact, Feedback, Changelog and Contribute
  pages are rewritten.
- **Phase 7, open source:** AGPL-3.0 licence, README, CONTRIBUTING, Code of Conduct, SECURITY, issue
  and pull request templates, architecture, design system and dependency licence documents, and a CI
  workflow (`.github/workflows/quality.yml`) that runs every node and browser suite.
- **Phase 8, SEO and performance:** see the Phase 9 fixes above for titles, descriptions, social tags,
  breadcrumbs and internal links. Measured page weights are in the "Verification" section below.

## Phases 2 to 4: resume library, PDF tools, batch images, document tools (complete, 18 Nov 2026)

Each feature was built on its own branch and then reviewed by a second, independent engineer who
used it as real people would, tried to break it, verified outputs with outside tools and fixed what
they found. Reviews caught real defects that the builders' own tests missed, among them: double clicks
creating duplicate resumes; Compress PDF's main button doing nothing; files swapped mid-job mixing
results; the image compressor sending 12 MP photos at 8% quality instead of shrinking them; deleted
resumes being written back by an open builder tab; keyboard focus lost after actions.

- **Resume builder (Phase 2):** IndexedDB library with autosave (debounced, flushed on tab hide/close),
  save status, multiple resumes (open, rename, duplicate, delete, delete all), last-opened and `?id=`
  reopening, one-time migration of the old draft, JSON export of one or all and import of both formats
  and old backups, damaged-record handling, cross-tab conflict handling, "Save on this device" switch
  for shared computers, memory-only warning. Schema v3 with References, Custom sections and a separate
  Publications section, in preview, PDF, Word and text. All 15 templates render differently; unverified
  ATS claims removed. Home page "Continue editing" cards.
- **PDF tools (Phase 3):** Merge, Split (4 modes), Organise (reorder, rotate, delete, insert), PDF to
  images, Extract text, Add page numbers, Watermark; Compress PDF rebuilt on page rendering (keeps
  every page, order, size and rotation; says pages become images). Password-protected PDFs open with
  the password in an accessible dialog. Every output is reopened and checked before download.
- **Images and batch (Phases 3 and 4):** one batch engine behind the batch image processor, image
  compressor and image converter: Web Worker pool, per-file status and progress, cancel, retry,
  stale-result detection, individual or ZIP download, duplicate names, 500-file cap, unload guard.
  Passport photo and signature resizer pages. Privacy fixes in passport print and signature cleaner;
  EXIF rotation fix in the resizer.
- **Document tools:** File checker (real type, sizes, image DPI/EXIF/GPS, PDF and Office metadata,
  requirement check, lossless metadata removal verified pixel by pixel), Text to PDF (WinAnsi
  character check with replacements and a print fallback), Your data (everything stored, export,
  import, delete all, persistence, offline copy).

Integration: four merges, with conflicts only in generated files (regenerated) and CSS section
boundaries. Two merges dropped a closing brace at a section seam, nesting later sections inside a
media query; caught by tests, fixed, and a stylesheet brace-balance check added to the content tests.

Verification on the merged tree (18 Nov): `npm test` 635 unit, 55 regression, 88 document-tool and
7,955 content assertions; browser suites: browser tests, image workflow 279, resume flow 67, resume
library 142, UI suite (55 pages at 32 widths, axe light and dark), robustness 14, PDF tools 191,
batch images, document tools 135, smoke: all pass.

## Phase 1: cleanup and identity (complete, 18 Nov 2026)

- Removed: 5 exam pages, 5 Hindi exam pages, the author page, the editorial policy, 7 exam presets
  (and their duplicate copy in the resizer), Hindi interface strings, 6 obsolete or off-topic guides,
  the exam research archive. 19 guides and all tool pages rewritten for job applications, then reviewed
  (the reviewer removed four false "measured with our tools" claims and softened unsupported
  generalisations about portals).
- New identity: home page (`index.html`) with a search box, a "start with a task" panel, category entry
  points, most-used tools and the privacy promise; the resizer moved to `image-resizer.html`; full
  directory at `tools.html` with instant filtering; header Tools menu by category; footer with the single
  donation link; Philosophy, Feedback and Contribute pages; About and Contact rewritten.
- Navigation and search: one registry (`scripts/lib/tools.js`) generates the menu, footer, directory,
  home listings, search index and sitemap. Search understands synonyms ("photo size", "join pdf", "cv")
  and small typing mistakes, opens with `/` or `Ctrl K`, works offline and is a keyboard combobox.
  Recently used tools (ids only) appear in search and on the home page.
- Platform: CSP meta now precedes every script; `theme-color` follows the tokens; toasts announce
  through persistent live regions; placeholder contrast raised to AA; breadcrumb targets meet WCAG 2.2
  target size; service worker precache and cache names generated from content hashes; pdf.js and pdf-lib
  cached on first use only; shared file kit and CSS for multi-file tools.
- Open-source files: CONTRIBUTING, CODE_OF_CONDUCT, SECURITY, issue and pull request templates,
  `docs/ARCHITECTURE.md`, `docs/DEPENDENCIES.md` (licence audit). Vendored files restored to upstream bytes.
- Tests: content checks report every failure at once and now guard against exam content or ads
  returning, check the single donation link, the registry against real pages, and every generator's
  `--check`. Browser suites updated for the moved resizer and removed pages.

Verification (18 Nov): `npm test` 567 unit + 50 regression + 4,253 content assertions pass;
`npm run test:browser`: browser 2,831 assertions, image workflow 279, resume flow 66, UI suite (40 pages
at 32 widths, axe light and dark), robustness 12, smoke 20: all pass.

Page weight after Phase 1 (uncompressed bytes, uncached): About 476 → 226 KB, guides index 485 → 235 KB,
resume builder 873 → 602 KB, home 256 KB, image resizer 387 KB.

## Phase 0: discovery (complete, 18 Nov 2026)

- Full audit of the repository, the live site (identical to `main`) and the donation page; findings in ROADMAP.md section 1.
- Baseline: `npm test` 571 + 50 + 5,630 assertions pass; `npm run test:browser` passes in 4 min 25 s.
  Page weight 476 to 873 KB uncached (Font Awesome 153 KB and the Devanagari font 118 KB on every page).
- Shared libraries added in `js/lib/` (files, zip, store, batch, image-ops, image-pool) and `js/workers/image-worker.js`.
  Smoke-tested in Node (ZIP verified with `unzip -t`, CRC-32 check value) and in Chromium under the site CSP
  (pdf.js render and text, pdf-lib write, worker resize, padding, conversion and cancellation).
- Vendored `@cantoo/pdf-lib` 2.11.1 (MIT) and pdf.js 6.5.438 legacy build (Apache-2.0).
- Icon subset build (`scripts/build-icons.py`): 156 KB of icon fonts reduced to 5 KB.

## Owner actions (need someone with account access)

1. **Licence: decided.** The owner chose the GNU AGPL-3.0 on 18 Nov 2026; `LICENSE` holds the official text
   (gnu.org, SHA-256 0d96a4ff…abcb0) and `package.json` declares `AGPL-3.0-only`. If "or later" is preferred,
   change the SPDX id and the README wording.
2. **Donation page (Razorpay).** Its text matches the philosophy. Suggested changes in the Razorpay dashboard:
   page title (currently the default "Pay for Support ApplyReady ❤️ by Sumit Sengar"); consider removing the
   personal phone number; show ApplyReady's logo and name rather than the personal "nb" logo; optionally add
   suggested amounts. The page disables pinch-zoom, which is Razorpay's template and cannot be changed here.
3. **AdSense account** (from the 15 Nov audit): remove applyready.in from the AdSense dashboard.
4. **Logo.** The header and social card still use the personal "nb" mark. A designed ApplyReady mark is
   an identity decision for the owner; replace `favicon/` and the header logo when one exists.
5. **Publishing.** All of this is on the development branch. Review it, let the GitHub Actions workflow
   run on a pull request, test on a real iPhone/Safari, then merge to `main` to publish on GitHub Pages.
