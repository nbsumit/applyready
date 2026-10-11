# ApplyReady UI/UX Astra Post-Audit

Date: 2026-10-11
Scope: a second, adversarial pass over the implemented work, compared against `UI_UX_ASTRA_AUDIT.md`. The aim was to find what the implementation got wrong or missed, not to confirm it.

## 1. How this pass was done

- Rebuilt the full screenshot matrix after implementation: home (empty, image loaded, result), resume (blank, imported, Content, Design, Download, mobile preview), exam page, compress result, guides index, contact, at 320, 768, 1024, 1440 and 2560, plus 390 for the tool states. Dark theme for the tool, resume and compress pages.
- Re-ran the scripted sweeps: horizontal overflow at 10 widths on all pages, targets under 40px, text under 12px, native controls, focus indicators.
- Ran axe on every page in light and dark, and on the result state of the main tool, an exam page and a Hindi page.
- Drove the custom select by tap events under mobile emulation, by mouse, and by keyboard.
- Completed real workflows with generated files in Chromium and Firefox: image resize and download, exam tool, compress, image to PDF (two pages), passport sheet (JPEG and PDF), signature cleaner, resume import and PDF, Word and text export.
- Compared resume print output of the old `main` and the new build for all 15 templates (PDF text and rendered pixels).

## 2. What the second audit found, and what was done

| # | Sev | Finding | Cause | Status |
|---|---|---|---|---|
| S01 | P1 | Hindi exam pages showed the Resize button above everything, a placeholder that never hid, no dimensions or size in the result, and the button label flipped to English after processing | The Hindi markup used different ids and wrappers than the English tool, so my ordering rules did not apply; the result ids were never populated (pre-existing); the label was hard-coded in the script | Fixed. Hindi tool markup now mirrors the English tool (labelled fields, rotate and reset, result metrics). One presentation line in `resizer.js` keeps the page's own button label |
| S02 | P1 | Four dropzones were `role="button"` containing a real button (axe: nested interactive) | Pre-existing markup | Fixed (`role="group"`) |
| S03 | P2 | Red text in guides was below AA in light (4.35) and dark (3.3) | Hard-coded `#dc2626` | Fixed with the themed danger token |
| S04 | P2 | Result/Original toggle was clipped at 320px | My toggle did not shrink | Fixed (full width, icons dropped at 420px and below) |
| S05 | P2 | File name on compress, passport and signature showed as "d.." at 320 to 390 | Inline `nowrap` plus two buttons | Fixed (name wraps, row wraps) |
| S06 | P2 | Tables, after the mid-word break was removed, crushed columns at 320 | Fixed layout with no minimum | Cells keep a 5.5rem minimum, the table scrolls |
| S07 | P2 | The duplicated SSC notice remained | Pre-existing | Removed |
| S08 | P2 | "Go to section" buttons looked like equal secondary buttons on every validation row | My first grouping reused `.btn` | Quiet text buttons |
| S09 | P3 | Quick start chips left "Document" alone on a second row at 768 and 1024 | Wrap breakpoint too low | One scrolling row up to 1100px |
| S10 | P3 | Resume privacy line sat alone on the right at tablet width | Hero layout not reset when the button hides | Placed under the subtitle |
| S11 | P3 | Breadcrumb links were 23px tall on phones | Pre-existing | 36px, 44px on touch |
| S12 | P3 | Job description card touched the export note | Missing margin | Spaced |
| S13 | P1 | `ApplyReadyUI.notify` did not exist on compress, image to PDF, passport and signature pages, so nothing could be announced there | `components.js` (deferred) replaced the object `site.js` had already created; introduced with the redesign's component script | Fixed: both scripts merge into one object |
| S14 | P1 | On all 15 exam, KB and Hindi pages a width of 5 px, a min above the max, or a corrupt image showed nothing (the English page even said "Check the error below") | The error elements (`dimError`, `sizeError`, `processErrorBox`) exist only on the home page | Fixed: elements added to all 15 pages; width and broken-image cases are tested |
| S15 | P1 | The four secondary tools reported problems with the browser's own `alert()`, stayed silent on an image that could not be decoded, and the compress tool sat on a progress bar forever with a broken image | Pre-existing error handling | Fixed: messages go through the site notification and say what to do; decode failures end with a message (error paths only, success paths unchanged) |

S13 to S15 were found only by driving error states on purpose (bad files, bad numbers), which the old suites never did. Every item above is covered by a test that fails on the old behaviour (section 5).

## 3. Original audit items: final status

Fixed: A01, A02, A03, A04, A05, A06, A07, A08, A09, A10, A12, A13, A16, A17, A18, A19, A20, A21, A22, A26, A27, A28, A30, A33, A38, A39, A40, A41.

Partly addressed, on purpose:
- **A11 (home settings dominate before upload).** The panel is quieter and shorter (duplicate summary removed, labels shortened, crop ratio stacked) and sits beside the dropzone, but every field is still visible. Hiding fields behind a disclosure would hide controls people need and break keyboard and test flows. Left as is.
- **A14 (resume entries).** Each entry has a clear header with actions, Dates and Location are paired, delete is quiet. Entries are not collapsible: that needs new editor state in `resume.js`, which this task forbids. Recommended later.
- **A15 (resume on phones).** The hero button is hidden below 950px so there is one Edit/Preview switch and one tab set. Two levels remain because the product needs both.
- **A29 (inline styles).** The tool headers, draft panel and add-section row no longer use them. About 1,250 remain in content markup; they do not affect layout or consistency.
- **A31 (em dashes).** UI chrome that was changed contains none. Existing em dashes in editorial text (about, guides, specs) and in generated resume output (education separator in the PDF, Word and preview) are untouched on purpose.

Not changed:
- **A23** toast has no manual dismiss (auto-hides in 4.5s, never blocks input).
- **A24** disabled Undo/Redo stay faint (disabled controls are exempt from contrast and are meant to look inactive).
- **A25** zoom in and out icons are still near-identical magnifiers (both have accessible names and titles).
- **A32** dark theme kept; light is the default.
- **A34 to A37** accepted as is.

## 4. Hostile review questions

| Question | Answer |
|---|---|
| Inconsistencies I introduced | Hindi ordering (S01), segmented toggle at 320 (S04). Both fixed. |
| Excessive cards | Result panel and embedded tool are one card each; reading pages have no card around prose; tool pages use two cards. Tool cards inside cards: none. |
| Bad hierarchy | After result, Download is full width and first; status, three numbers, then quiet details. Before upload the dropzone is the largest object. |
| Clipped dropdowns | Menu clamps to the viewport, flips up, scrolls inside, and follows its trigger on scroll; verified at 320, 390, 1280 and with touch. |
| Mixed native and custom controls | Selects, checkboxes, radios, range, date and file are custom in appearance with native elements underneath. The date picker popup is the operating system's (kept on purpose). No visible native file input remains (tested on all 38 pages). |
| Keyboard regressions | Tab walk of home, resume, compress and signature pages shows a focus indicator on every stop; menu supports arrows, Home, End, Enter, Space, Escape, type-ahead, Tab. |
| Weak focus | Text fields had none before; now a 3px ring plus border change, tested. |
| Bad empty, error and loading states | Empty compress status card hidden until it has content; empty tool placeholders hidden because the dropzone says the same thing; busy state keeps its language; every tool now shows an explanation for a bad file or bad number, and none can sit on a loader. |
| Hidden primary action | None found; the Resize button follows the settings it uses, Download leads the result. |
| Unnecessary text | Removed repeated trust chips, repeated steps, the result-panel duplicate summary and the SSC duplicate notice. |
| Duplicate patterns | One footer, one header pattern for tools, one segmented control, one button set. |

## 5. Evidence

- `npm test`: 48 behaviour checks pass.
- `npm run test:browser`: 2,968 existing browser assertions pass; plus `tests/ui_tests.js` (989 assertions) and `tests/browser_smoke.js` (20 checks).
- The new UI suite fails on the old `main` at the first page (blank button label), and on the dropdown test after that.
- `BROWSER=firefox` UI suite (992) and smoke (20) pass in Firefox 153.
- axe (WCAG 2.2 AA): zero violations on 38 pages in light and dark and on three result states.
- Overflow: zero on 38 pages at 320, 360, 375, 390, 430, 768, 1024, 1280, 1440 (and 2560 in the scripted sweep).
- Resume print: 15 of 15 templates identical to the old build in PDF text and in rendered pixels.
- Not run: WebKit (the sandbox lacks its system libraries) and Microsoft Edge (not installed; Edge uses the Chromium engine tested here). Patterns avoided for Safari: no `dvh` units, no `:focus-visible`-only text field focus, no container queries; `:has()` needs Safari 15.4 or newer, and every use is progressive (the fallback is the previous, still usable layout).

## 6. Final product test

| Screen | Understandable without help | Anything making the user think | Anything only fashionable |
|---|---|---|---|
| Home image tool | Yes: drop zone, then settings, then Resize, then Download | Settings list is long before upload (A11) | No |
| Exam, KB, Hindi tools | Yes: file bar, image, settings, action, result with status; errors appear at the top | Error sentences come from the shared script and are in English on the Hindi pages | No |
| Compress, passport, signature, image to PDF | Yes: same header, upload first, one primary download | None found | No |
| Resume builder | Yes: Content, Design, Download; sections open one at a time | Long entry forms (A14) | No |
| Validation | Yes: named groups, quiet jump links | None | No |
| Guides, legal, about | Yes: document layout, readable width | Wide tables scroll on phones without a visual hint | No |

Left to do later: collapsible resume entries, a scroll hint on wide tables, localised error sentences in the shared image script, a WebKit run.
