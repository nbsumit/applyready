# ApplyReady UI/UX final post-audit

Date: 2026-10-11. Read with `UI_UX_FINAL_AUDIT.md` (findings P1-1 and so on) and `UI_UX_FINAL_PLAN.md`.

## What changed

- **Five stylesheets became three.** `design-system.css`, `ux.css` and `ui.css` were replaced by one file, `css/app.css`, with one token set. `style.css` (base, resume sheet, print) and `workspace.css` (fonts, brand colour, layouts) stayed. Six `!important` rules in `workspace.css` that fought the interface were made ordinary rules.
- **The over-compact pass was recovered.**
  - Controls went from 32 px to 36 px (44 px on phones), with interface text at 14 px.
  - Labels are 14 px and dark.
  - Fields are white with an edge you can see (3.3:1).
  - Panel titles are 16 px.
  - The five-step icon scale was kept.
- **Task flows:**
  - Output summary under the main image action.
  - Errors sit under the field at fault, and invalid fields are marked again.
  - A plain status line when Compress PDF misses its target.
  - The preview comes into view after upload on phones.
  - The exam pages' preset switch shows which preset is in use.
  - Quieter result facts.
  - Write / Style / Review & download tabs in the resume builder.
- **Markup:**
  - 775 inline styles were removed, along with every inline font size outside the resume sheet.
  - Labels are sentence case without colons, and optional fields are marked one way.
  - Placeholders start with "e.g.".
  - Review messages are in plain language.

## Measurements, before and after

| Measure | Before (`be738fe`) | After |
|---|---|---|
| Stylesheets that style the interface | 5 (5,241 lines) | 3, of which one owns the interface (`app.css`, 1,904 lines; 4,537 lines in total) |
| Font sizes in the main area at 1440 px | 20 (12, 12.5, 13, 13.1, 13.2, 13.6, 14, 14.4, 14.7, 15, 15.2, 16, 16.8, 17.6, 18.4, 19.5, 20, 21.6, 24, 28) | 8 (12, 13, 14, 16, 18, 22, 24, 30) |
| Inline `style` attributes in HTML | 1,315 (177 set a font size) | 540 (1 sets a font size, inside the resume sheet preview) |
| Field edge contrast against its panel | about 1.07:1 (grey fill, no border) | 3.3:1 light, 3.6:1 dark (tested) |
| Field height, desktop and phone | 32 / 40 px | 36 / 44 px (tested on every page) |
| Horizontal overflow, 53 pages at 320 to 1440 px | none | none |
| axe violations, light and dark, including result states | none | none |
| Resume print output, 15 templates | baseline | pixel-identical |

## Audit findings: status

| ID | Status | How |
|---|---|---|
| P1-1 preview off screen after upload on phones | Fixed | `ApplyReadyUI.reveal()` scrolls the preview section in when it is below the fold. Tested: the preview top is at 173 px and 226 px of an 844 px screen. |
| P1-2 Compress PDF hides a missed target | Fixed | `#compressStatus`: "Under 200 KB. Ready to upload." or a warning with the smallest size reached. The size turns amber. Tested both ways. |
| P1-3 dead button with an invisible reason | Fixed | `.is-invalid` shows again. The error moved under the width and height row (home and all 15 embedded tools). The summary under the button says "Fix the setting marked in red to continue" and offers "Show me", which focuses the field. Tested. |
| P1-4 field edges invisible on grey surfaces | Fixed | White fields with a 3:1 edge, and resume entries are white blocks. Tested for contrast in both themes. |
| P1-5 example text looks like data | Fixed | Every resume contact placeholder starts with "e.g." and uses a lighter colour. Tested. |
| P2-1 no summary of the output | Fixed | `#processSummary`: "Output: 350 × 450 px · JPEG · 20 to 50 KB · Change". Hindi pages get Hindi strings. |
| P2-2 text too small and faint | Fixed | 14 px interface text, 14 px dark labels, 13 px help text. |
| P2-3 tall tool headers on phones | Improved | Title 22 px, intro 14 px, privacy note hidden on phones. The intro text is unchanged (it is page content). |
| P2-4 heavy result boxes | Fixed | Download comes straight after the preview. The facts are a quiet list without boxes, and the size check is a green line. |
| P2-5 dates cut off on phones | Fixed | Duration and location stack below 520 px. |
| P2-6 tab names | Fixed | Write, Style, Review & download. On a 360 px screen the third tab reads "Review". |
| P2-7 home at 768 px | Fixed | Two columns from 768 px. |
| P2-8 image-to-PDF empty states | Fixed | One empty state. After pages are added, the drop area shrinks to a one-line bar, and pages show as one list. |
| P2-9 nested cards in resume entries | Fixed | Sections are one grouped list, and entries are single white blocks. The section order is one list. |
| P3-1 / P3-9 font sizes and inline styles | Fixed | See Measurements. |
| P3-2 overlapping stylesheets | Fixed | One interface stylesheet. |
| P3-3 result label case | Fixed | Sentence case everywhere. |
| P3-4 label colons and optional markers | Fixed | |
| P3-5 advanced settings box | Fixed | No inner box. "Today" matches its field. |
| P3-6 toolbar | Fixed | One row of equal buttons, no grey box. |
| P3-7 template card buttons | Fixed | "Preview" is quiet and "Use" is the outlined action, side by side. |
| P3-8 "Live Preview" wrapping | Fixed | Renamed "Preview". |
| P4-1 mobile menu edge | Fixed | Bottom edge, dividers, 48 px rows. |
| P4-2 Quick start scroll hint | Fixed | The bar fades at the right edge. |
| P4-3 small checkboxes | Kept | The 18 px box sits in a 44 px label row on phones, and the whole row is clickable. |
| P4-4 disabled "Use original size" | Fixed | The help text says it is available once an image is added. |

## Second audit: what it found in the new UI, and the fixes

I reviewed every page at 390 and 1440 px, both themes, at 768 and 1024 px, and through every tool state with real files. An independent review agent was also started, but it stopped early on a service rate limit and returned no findings, so this audit is my own.

| Severity | Finding | Fix |
|---|---|---|
| P1 | After the switch, the four tool pages were squeezed to 760 px wide (the reading-page width won the cascade). | The tool-page rule now matches the reading rule's specificity. |
| P2 | On exam pages, the Photo / Signature preset buttons never showed which one was selected; "Photo" stayed filled after choosing "Signature". This was a pre-existing bug. | The buttons now use `data-preset` and `aria-pressed`, the same logic as the home presets. Tested. |
| P2 | On the 50 KB, NEET and UPSC tools, the optional name and date strip appeared above the drop area. This was a pre-existing bug. | It is now ordered with the settings. |
| P2 | Hindi pages set `body` to a Devanagari font that is not loaded (`design-system.css`), so the self-hosted font was skipped. | The rule is gone with the file. Hindi pages use the self-hosted font. |
| P2 | `404.html` and `offline.html` linked three stylesheets by relative path, which breaks on a nested missing URL. | Absolute paths. |
| P3 | Notes in some exam-page tables were at 11.7 px. | `small` is 13 px. |
| P3 | Compress PDF limit buttons and long exam preset labels wrapped to two lines at 390 px. | One column below 440 px. Labels wrap only below 400 px. |
| P3 | The Hindi width / height / unit row truncated "Pixel" at 390 px. | The unit gets its own row on phones. |
| P3 | The "Review & download" tab wrapped in the narrow editor column. | No wrapping, icons hidden when tight, shorter label at 360 px. |
| P3 | FAQ titles at 21.6 px and guide headings at 18.4 px came from old rules. | Mapped to 22 px and 18 px. |
| P4 | `<code>` in guides had a 7 px radius. | 4 px. |
| P4 | The Tools menu closed on Escape but left focus inside the closed menu. | Focus returns to the Tools button. Tested. |
| P4 | The template dialog's footer wrapped "Close Preview" and "Use This Template" on phones. | "Close" and "Use this template". |

## Testing

| Suite | Chromium (Playwright) | Google Chrome 155 | Microsoft Edge 155 | Firefox 153 |
|---|---|---|---|---|
| `npm test` (48 behaviour checks, 3,756 content assertions) | pass | n/a | n/a | n/a |
| `tests/browser_tests.js` (2,968 assertions: presets, compression, drafts, imports, all 15 templates, PDF, Word and text downloads, embedded tools) | pass | pass | pass | not run (Chromium suite) |
| `tests/ui_tests.js` (1,550 assertions) | pass | pass | pass | pass |
| `tests/browser_smoke.js` (20 real workflows) | pass | pass | pass | pass |
| Resume print comparison, 15 templates | identical | n/a | n/a | n/a |

Chrome and Edge are the official Linux builds, unpacked from Google's and Microsoft's packages for this test run. In Edge, one new check failed on its first run because it read a border colour while its 0.12 s transition was still running. The check now waits for the settled state, and it passes in all four browsers. Safari (WebKit) could not be run in this environment.

Real files used: a 2400 × 3000 photo, a signature PNG, a two-page scanned PDF, two images for image-to-PDF, a corrupt JPEG, a text file named as a PDF and a malformed resume backup. Each tool completed upload, adjust, process and download. Resume: blank, sample, add entries, remove and reorder entries, templates, preview dialog, review, draft, backup and import, PDF, Word, text and print.

## Known items not changed

- **Tool page intros on phones** are still three to five lines. The text is page content (and search text), so only its size changed.
- **The Hindi result line** reads "350 × 450 px (Measured)". The word "Measured" comes from the shared resizer script, which has no Hindi string for it. Translating it means a script change for one word, so it was left for a content pass.
- **Breadcrumbs with a long final item** wrap onto a second line on 320 to 390 px screens. They stay readable.
