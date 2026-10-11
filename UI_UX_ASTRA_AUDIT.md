# ApplyReady UI/UX Astra Audit

Date: 2026-10-11
Baseline: `main` at `3191708` (identical to production, same `ux.css?v=20261011-8`).
Status: written before any implementation change.

## 1. Method

- Read the repository history for the last three UI passes and rendered the pre-redesign commit `d796a63` next to current `main` (same pages, same viewports) to separate old problems from new ones.
- Used the real app in headless Chromium (Playwright) with real files: a 2400x3000 JPEG photo, a PNG signature, a 2-page PDF, two document images, and a realistic resume (3 jobs, 2 degrees, 2 projects, skills, certifications, achievements, volunteering, languages, academic items).
- Viewports: 320, 360, 375, 390, 430, 768, 1024, 1280, 1440, 2560. A scripted sweep over every page measured horizontal overflow, text under 12px, targets under 40px, un-styled native controls, and keyboard focus indicators.
- Workflows exercised: image upload, preset, crop view, process, result, download button state; compress PDF; image to PDF; passport sheet; signature cleaner; resume import, every tab, template modal, validation with bad data; custom select by mouse and keyboard; navigation menus; production URL probe.
- Existing suites were run first as a baseline: 48 behaviour checks and 2968 browser assertions all pass. **They pass while the two worst bugs below exist**, because they drive hidden native `<select>` elements and never read button text colour.

## 2. Pages discovered (39)

Root (23): `index`, `resume`, `compress-pdf`, `image-to-pdf`, `passport-photo-print`, `signature-cleaner`, `resize-image-to-10kb/20kb/50kb/100kb/200kb`, `ssc/upsc/ibps/neet/rrb-photo-signature-size`, `how-to-use`, `about`, `contact`, `privacy`, `terms`, `404`, `offline`.
Guides (11): index plus 10 articles. Hindi (5): `hi/ssc, upsc, ibps, neet, rrb`.
Shared UI: header, Tools menu, mobile menu, footer (two variants), dropdowns, dialogs (template preview, import/replace confirms), toast, accordions, FAQ, dropzones, range sliders, segmented toggles, result panels, validation list.

## 3. History findings: what the last passes did

| Commit | What it did | Verdict |
|---|---|---|
| `6693c76` (Sep 30) and `workspace.css` | Workspace layout, `.guide-content a { color: var(--primary) }` | Introduced the blank green-on-green link buttons (still present). Pre-dates the redesign. |
| `4ce4c4c` UI/UX upgrade (#8) | Added `design-system.css` (tokens, dark theme, custom select, toggles), headers, Hindi links, trust chips, steps | Tokens and dark theme are good. Added a parallel set of component rules that conflict with `style.css`. |
| `589f727` + `c778f5a` | Added `ux.css`, rewrote `components.js` custom select (menu moved to `<body>`) | **Broke every custom dropdown.** Menu is portalled to `body`, but `design-system.css` only shows it under `.custom-select.is-open .custom-select__list`. Also overrode focus styles by specificity and removed focus rings on text inputs. |
| `0ebae77` | "Task first" pass: stacked trust chips, step list, assurance box above the tool | Added repeated messaging (trust said three times, steps said twice). Pushes the workspace down. |
| `f2412ce` | Wrote audit docs under `docs/` claiming the secondary tools match the main tool layout | Not true: compress, image-to-PDF, passport and signature still sit in a 760px reading container. |

Root cause: **four stylesheets layered by specificity** (`design-system.css`, `style.css`, `workspace.css`, `ux.css`), each patching the last. About 1,300 inline `style=""` attributes in the static HTML (142 present at runtime on `resume.html` alone) add a fifth layer. Fixes in one layer silently lose to another.

Kept: tokens and dark theme, native-element-under-custom-control approach, `aria-current` navigation, quick-start chips, resume Content/Design/Download tabs, template filter bar, validation severity bars.
Replace: custom select popup display, focus rule, link-button colour rule, secondary-tool layout, footer variant.

## 4. Issues

Severity: P0 broken or prevents completion. P1 major usability failure. P2 meaningful friction. P3 inconsistency or polish. P4 minor.
Each entry: **page / component / viewport**, current behaviour, problem and why it matters, fix, regression risk.

### P0

**A01. Every custom dropdown opens invisibly.**
All pages with a `<select>` (home, exam, KB, Hindi, resume Design tab, image-to-PDF, passport, signature, compress, contact). All viewports, confirmed on live production.
Click: trigger shows open state and chevron flips, `list.hidden=false`, but computed `display:none`. Focus moves into an invisible option.
Problem: users cannot change preset, unit, DPI, format, crop ratio, background, font, paper size, density, or any other option with a mouse or finger. Keyboard users select blind.
Fix: own the popup display with the `hidden` attribute (and a single rule set), keep native `<select>` as the source of truth, add `aria-activedescendant` correctness, skip disabled options, keep Escape/arrows/Home/End/type-ahead, close on scroll of unrelated containers, mobile safe max-height and viewport clamping.
Risk: medium. Native `<select>` must keep firing `change`; browser tests use `selectOption` and must keep passing. Add real mouse and keyboard tests on the visible control.

**A02. Primary link-buttons are green text on green fill (label invisible).**
30 buttons on 29 pages: every exam, KB and Hindi page `#btnDownload`, `compress-pdf` download, `image-to-pdf` download, `passport-photo-print` download, `signature-cleaner` download, `contact` email button, and the CTA at the bottom of each of the 10 guides. All viewports.
Cause: `.guide-content a { color: var(--primary) }` (specificity 0,1,1) beats `.btn-primary` colour. Home page is unaffected because its tool is not inside `.guide-content`.
Problem: the main action of nearly every tool page reads as an empty green bar. After a successful result the user sees "success" and a button with no words.
Fix: link colour rule must exclude `.btn` (single selector change plus a regression test that no `.btn` has text colour equal to its background).
Risk: low.

### P1

**A03. No visible keyboard focus on text inputs.** Home width/height/min/max, whole resume Content form, compress target KB, contact, every `input.form-control` and `textarea.form-control`. All viewports.
`input[type=text].form-control {border; box-shadow:none}` (0,2,1) beats `.form-control:focus` (0,2,0), and the focus rule also sets `outline:none`. axe does not catch this. WCAG 2.4.7 failure on the primary data-entry controls.
Fix: one focus token applied with `:focus-visible` and never removed by control rules. Risk: low.

**A04. Four tools live inside a 760px article.** `compress-pdf`, `image-to-pdf`, `passport-photo-print`, `signature-cleaner`, 1024px and wider.
Tool is wrapped in `article.guide-content` (reading width), so the two-column workspace is squeezed to about 380px per card, the page does not match the home tool, the H1 is a giant 40px with tight tracking, the trust box floats left, and a status card is rendered empty above the upload (compress shows an empty "Compression Status" card first).
Fix: give these pages a tool-width container and the same task-first header and workspace pattern (upload first, settings as supporting panel, results where the work is). Keep every id and JS hook. Risk: medium (layout only).

**A05. Four pages use an un-styled legacy footer.** same four pages. `<footer class="footer">` has no CSS: links stack as a raw list flush against the viewport edge, 0 padding, mismatched brand lock-up. Fix: use the shared `site-footer` markup. Risk: low.

**A06. Signature Cleaner "Cleaned / Original" toggle is browser-default.** `signature-cleaner`, all viewports. Buttons use `.btn-toggle`, CSS targets `.comparison-view-toggle .btn`. Visible grey default buttons with outset border. Fix: shared segmented-control style. Risk: low (class and CSS only).

**A07. Image to PDF page list breaks at 390px.** Each row shows filename as "d...", and dimension text wraps one word per line, because the row is a narrow flex with a fixed thumbnail and four action buttons. Fix: two-line row layout with wrapping actions. Risk: low.

**A08. Tables break words mid-word on phones.** Exam spec tables (English and Hindi), compress limits table at 320 to 430px ("Doc/um/ent", "Commissio/n)"). Fix: horizontal scroll container with a sensible `min-width`, no `word-break` on cells. Risk: low.

### P2

**A09. Image result panel repeats itself.** Home and exam/KB pages after processing: seven boxes (original dimensions, target dimensions, measured output, target limit, exact bytes with "1 KB = 1024 B", format, verification) plus Result/Original size chips. Eye order is unclear. Fix: one status line ("Within 50 KB, 350x450 px"), three metrics (size, dimensions, format), details behind a disclosure; keep all values in the DOM. Risk: medium (JS writes these ids; keep ids).

**A10. Home header stacks six things before the tool.** Eyebrow, H1, subtitle, three-step list, four trust chips, trust box, then quick start. Trust is stated three times (chips, box, workspace footer) and steps twice (header and workspace footer). Fix: remove duplicates, one trust line, one step indicator, tool starts higher. Risk: low (preserve SEO H1 and text).

**A11. Settings panel dominates before an image exists.** Home 1024+: the settings column is taller than the empty dropzone and draws the first look; on phones it follows the dropzone with every field expanded. Fix: before upload, collapse to preset plus the two numbers that matter, with the rest in "More options"; after upload expand relevant controls. Nothing removed. Risk: medium.

**A12. Settings detail issues.** "Min size (KB, optional)" wraps to two lines and pushes the field down; crop ratio select truncates ("Match out..."); lock button sits off-baseline between width and height; target summary boxes duplicate the inputs just above. Fix: label shortening ("Min KB (optional)"), full-width crop ratio, aligned lock, remove the summary box (values stay in the live summary text). P3 for the lock and truncation.

**A13. Template gallery cannot be compared.** Resume Design tab: 15 tall cards (about 700px each when stacked) in a 420px panel; the selected card has a heavy green fill, every card has two buttons, descriptions are long. Fix: compact grid with thumbnail, name and tag only; selected state is a ring and a check; long description moves to the preview dialog. Risk: medium (JS renders cards; keep `data-template-id`, `btn-select-template` and accessible names).

**A14. Resume entries are long, flat forms.** Experience entries are about 600px each on a phone (6 stacked fields, 4 icon-only buttons directly under the title, unclear which row they belong to). Fix: title row shows "Role at Company" with actions on the right, pair Dates and Location, keep destructive (delete) quiet. Risk: medium.

**A15. Resume mobile has three navigation layers.** Hero "Review & download", Edit/Preview switch, then Content/Design/Download tabs. Fix: one primary action per context and a visually distinct view switch. Risk: low.

**A16. Validation list is flat and un-labelled.** Review tab: blocking, warning, recommendation items are interleaved in field order, severity is shown only by a thin coloured bar and a tiny icon, and every row repeats an equal "Go to Section" button. Fix: group (Fix before sending, Worth checking, Suggestions) with a visible label, quieter jump link. Risk: medium (list is built in `resume.js`; change presentation only).

**A17. Download is far down the resume Download tab.** With many warnings the PDF button is about 1,400px down on a phone, below the job-description tool. Fix: keep export actions directly after the status, job-description compare below. Risk: low.

**A18. Content pages: weak heading hierarchy.** About, Privacy, Terms, How to use, guides: one huge H1 (48px, 800), then card headings the same size as body text (17px). Whole document in a single card. Fix: reading-optimised scale, H2 that actually reads as H2, no card around long text. Risk: low.

**A19. Secondary-tool action layout.** Passport, signature, compress results place Download as an equal-weight button beside a secondary button, and result stats come before it. Fix: Download is full-width and first. Risk: low.

**A20. Tiny text.** 9.6px (eyebrow), 10.2 to 10.6px (dropzone help, some spans), 11.5 to 11.7px (small buttons, resource links, hints). Fix: 12px floor, 13px for helper text. Risk: low.

### P3

**A21.** Footer links are 32px tall, brand logo 28px. Raise to 44px hit area without larger text.
**A22.** Result/Original chips render as "Result ( 47.94 KB )" with stray spaces; they look like stats but are view toggles.
**A23.** Toast sits over the content, has no dismiss, and covers form fields on phones.
**A24.** Disabled Undo/Redo and "Use original size" look like empty outlines; contrast too low to read the label.
**A25.** Rotate/zoom icon-only buttons: zoom in and zoom out icons are near-identical magnifiers.
**A26.** Hindi switch link wraps ("हिन्दी संस्करण" / "English Version") and collides with the breadcrumb on phones.
**A27.** Card headings in secondary tools sit at different baselines across paired cards (left card title 32px higher than right).
**A28.** 404 H1 "404 - Page Not Found" is oversized for a phone card.
**A29.** Inline styles: about 1,300 attributes override tokens (draft panel, skill rows, optional-section select, Delete Draft button at 28px).
**A30.** Two native select appearances still exist in the optional-section picker and unit selects because inline `min-height` overrides the control height.
**A31.** Existing em dashes in UI strings (template modal title, a few headings). Content text is left as is (SEO and meaning), UI chrome strings are replaced.
**A32.** Dark theme toggle is an unlabelled half-circle; brief wants a professional light theme. Dark mode is kept (not removed, to preserve behaviour) but light stays the default.

### P4

**A33.** Custom select list has no type-ahead timeout reset indicator; Tab inside the list closes without moving focus predictably.
**A34.** Native date picker stays operating-system styled (correct for mobile); the surrounding field is styled to match.
**A35.** `title` tooltips on icon buttons duplicate `aria-label` text.
**A36.** The home page keeps both "Quick start" label chips and the preset select; the relationship is not stated.
**A37.** Range slider thumb is 18px visually; target is larger via padding, but the bubble is 11px.

## 5. Per-lens summary

- Information architecture: image tool is clear after upload; the four secondary tools do not look like part of the same product. Resume mental model is Content, Design, Download. "Review" lives under "Download", which is acceptable once the page says so.
- Visual hierarchy (home, empty): first the H1, then the quick-start row, then the dropzone. Intended order is dropzone first. After result: Download is dominant (good), but seven stat boxes compete.
- Cognitive load: home settings, resume entries, validation list, template gallery.
- Interaction consistency: three select styles (native, custom, broken custom), two toggle styles (one unstyled), two footers.
- Forms: labels are permanent everywhere (good). Helper text is long in places; placeholders are not used as labels.
- Accessibility: focus (A03), small targets (A21), text size (A20). axe is clean on the pages tested. Contrast of muted text passes AA in light; the disabled controls are the exception.
- Mobile: no overflow at any of 10 widths on any of 39 pages. Problems are layout quality, not overflow: A07, A08, A15, A14.
- Performance: four CSS files (about 125 KB) plus inline style duplication. No new libraries will be added.

## 6. Counts

| Severity | Count |
|---|---|
| P0 | 2 |
| P1 | 6 |
| P2 | 12 |
| P3 | 12 |
| P4 | 5 |

Biggest problems: A01 (dropdowns unusable), A02 (30 blank primary buttons), A03 (no focus on text fields), A04/A05 (four tools off-system), the fact that four stylesheets fight each other and the tests cannot see it.

## 7. Not in scope and not changing

Image, resize, compression and crop algorithms, PDF and Word generation, resume templates and print CSS, data model, local storage, backup and import, routes, URLs, presets and their values, accepted file types, size limits, SEO metadata and structured data, service worker strategy (only the cache version string is bumped on deploy).
