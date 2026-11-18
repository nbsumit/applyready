# ApplyReady transformation: progress

Plan: [`ROADMAP.md`](ROADMAP.md). This file records what is done, how it was verified and what remains.
It is updated at the end of each phase.

## Current phase

Phases 2 to 4 (resume library, PDF tools, batch images, document tools) are being built in parallel
branches, each followed by an independent review. Phase 6 and 7 work that does not depend on them
(trust pages, open-source files) is under way on the main branch.

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

1. **Licence.** The repository has no LICENSE file, so it is not yet legally open source. The owner must choose
   one (for example MIT or AGPL-3.0); see ROADMAP.md and the final report.
2. **Donation page (Razorpay).** Its text matches the philosophy. Suggested changes in the Razorpay dashboard:
   page title (currently the default "Pay for Support ApplyReady ❤️ by Sumit Sengar"); consider removing the
   personal phone number; show ApplyReady's logo and name rather than the personal "nb" logo; optionally add
   suggested amounts. The page disables pinch-zoom, which is Razorpay's template and cannot be changed here.
3. **AdSense account** (from the 15 Nov audit): remove applyready.in from the AdSense dashboard.
