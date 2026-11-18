# ApplyReady transformation: progress

Plan: [`ROADMAP.md`](ROADMAP.md). This file records what is done, how it was verified and what remains.
It is updated at the end of each phase.

## Current phase

Phase 1: cleanup and identity (in progress).

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
