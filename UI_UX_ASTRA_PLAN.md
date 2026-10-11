# ApplyReady UI/UX Astra Plan

Follows `UI_UX_ASTRA_AUDIT.md`. Presentation only. Issue ids (A01 and so on) refer to the audit.

## Principles

1. Repair first, redesign second. A01 to A03 are broken today; they ship before anything else.
2. One system, not another layer. Fix a rule at the layer that owns it. When a later layer fights an earlier one, delete the loser, do not out-specify it.
3. Native element under every custom control. Custom appearance, native semantics.
4. One primary action per context. Download wins once a result exists.
5. Content that is read (guides, legal) is typeset for reading, not laid out like a dashboard.
6. Nothing in the processing, export, template, data or routing code changes.

## Ownership of CSS after this work

| File | Owns | Rule |
|---|---|---|
| `design-system.css` | tokens (colour, space, radius, motion), dark theme | Remove component rules that `ux.css` replaces (custom select popup, duplicated inputs). Keep tokens. |
| `style.css` | base, tool layouts, resume sheet, print | Do not touch resume sheet or `@media print`. |
| `workspace.css` | page layouts | Fix the link-colour leak only. |
| `ux.css` | all screen chrome: controls, buttons, surfaces, page patterns | Reorganised into numbered sections (tokens, controls, buttons, surfaces, nav, tool pages, content pages, resume shell). Screen-only (`@media screen`). |

No new stylesheet is added and no library is added.

## Workstreams

### 1. Remove recent regressions (A01, A02, A03, A05, A06)
- Issues: invisible dropdowns, blank link-buttons, missing focus rings, legacy footer, unstyled segmented toggle.
- Files: `js/components.js` (popup show/hide only), `css/design-system.css`, `css/workspace.css`, `css/ux.css`, 4 HTML footers.
- Risk: medium for the select, low for the rest.
- Result: every dropdown opens visibly and works by mouse, touch and keyboard; every primary button has a readable label; every text field shows focus; the four tool pages share the footer.
- Tests: new browser checks that click the visible trigger, read the visible option list, pick with mouse and with ArrowDown plus Enter, press Escape and confirm focus return; a sweep asserting no `.btn` has text colour equal to its background on any page; a focus-indicator check on text inputs.

### 2. Design tokens and type scale (A20, A29)
- One type scale: page title 28/32, section title 20, subsection 16 semibold, body 16 (reading) and 15 (tools), label 13 semibold, helper 13, caption 12. Nothing below 12px.
- One spacing scale (4, 8, 12, 16, 24, 32, 48), one radius (8) plus small (6), control height 44, one focus ring, one motion timing (120ms, ease-out, reduced-motion respected).
- Files: `css/design-system.css` (tokens), `css/ux.css`.
- Risk: low. Tests: no overflow at 10 widths; axe on both themes.

### 3. Shared form system (A12, A24, A30)
- Text, number, date, textarea, select trigger, file, checkbox, radio, range, toggle: same height, border, radius, focus, disabled and invalid states. Inline `min-height` and font-size overrides on controls removed.
- Custom select keeps: trigger with selected value, arrow keys, Home/End, Enter and Space, Escape, type-ahead, viewport clamping and flip, internal scroll, disabled options skipped, selected tick, accessible name from the label.
- Files: `css/ux.css`, `js/components.js`, selected inline styles in HTML.
- Tests: preset, unit, format, crop ratio, background, resume font, page size, density by mouse; keyboard flow; validation state on custom trigger.

### 4. Buttons and actions (A19, A22, A24, A25)
- Primary, secondary, ghost, destructive (quiet until hover), icon, loading, disabled. Link-buttons and buttons identical. Small buttons are 44px high on touch, 36px on fine pointers.
- One primary per context. Download becomes the full-width primary once a result exists; "Edit crop" and "Start over" are secondary.
- Segmented control component (`.segmented`) used by Cleaned/Original, Result/Original, Edit/Preview, Fit/100%.
- Files: `css/ux.css`, class tweaks in HTML only where a class is missing.

### 5. Navigation and footer (A21, A26)
- Desktop and mobile menus unchanged in structure. Footer links get a 44px hit area; one footer on every page. Hindi/English switch sits on its own line under the breadcrumb on phones.
- Risk: low. Tests: existing nav/theme/Tools menu check on all pages stays green.

### 6. Main image workflow (A09, A10, A11, A12, A22)
- Header: eyebrow removed from the visual stack (kept in DOM for SEO text where it is content), one trust line, one step indicator, tool starts higher. Steps update from state as today.
- Empty state: dropzone dominates; the settings column is a quiet panel with preset plus size fields first and "More options" collapsed. After upload the settings expand (CSS state hook already exists).
- Result: a status line first, three metrics (file size, dimensions, format), the rest in a muted details grid; Download is the single primary; comparison switch becomes a clean segmented control. All result ids stay.
- Files: `index.html`, `css/ux.css`; exam/KB/Hindi pages inherit through CSS (their tool markup is the same).
- Risk: medium. Tests: upload, preset, crop, process, result, download byte size, retry, replace, remove, original-size, unit and DPI paths (existing 2968 assertions must keep passing).

### 7. Resume Builder (A13 to A17)
- Shell only: no template, export or print change.
- Entry cards: header row (title plus move, duplicate, delete icons with labels), Dates and Location paired, quieter delete.
- Template gallery: compact grid (thumbnail, name, tag), ring and check for the selected one, full description in the preview dialog.
- Validation: grouped by severity with text labels (Fix before sending / Worth checking / Suggestions), quiet jump link.
- Download tab: status, then export buttons, then job-description compare.
- Mobile: one view switch (Edit / Preview) and one tab set; "Review & download" folds into the Download tab link.
- Files: `resume.html`, `css/ux.css`, small presentation edits in `js/resume.js` render functions (class names and wrappers only).
- Risk: medium-high (largest file). Tests: import, every section, add/remove/reorder, templates, PDF/Word/text export text extraction, page-count agreement, draft, backup, print.

### 8. Secondary tools (A04, A05, A06, A07, A19)
- Compress PDF, image to PDF, passport sheet, signature cleaner: move from `article.guide-content` to the tool container, same header pattern as home, upload first, controls beside it, result with a primary Download. Empty status card removed from view until it has content. Page list rows fixed.
- Files: the four HTML pages (wrapper class, footer), `css/ux.css`. All element ids and JS untouched.
- Tests: real PDF compress, two-image PDF, passport sheet, signature cleaning with real files at 390 and 1440.

### 9. Content pages (A08, A18, A26, A27, A28)
- Reading width 68ch, 17px body, 1.65 line height; H1 28/32 semibold; H2 22; H3 18; no single wrapping card; tables scroll horizontally on phones and never break words; callouts have a left rule not a box. Guide index cards stay (they are real objects).
- Applies to about, privacy, terms, how-to-use, contact, guides, the content below tools on exam/KB pages, Hindi pages.
- Risk: low. SEO untouched (no heading text, order, or markup changes except wrapper classes).

### 10. Mobile (A07, A14, A15, A23)
- 16px gutters, bottom-safe toast, dialogs inside the viewport with internal scroll, sticky elements never cover the focused field (scroll-margin), preview on its own view.
- Tests: 320, 360, 375, 390, 430, 768 screenshots and overflow assertions for every tool state.

### 11. Accessibility (A03, A20, A21, A33)
- Focus-visible on every control, 44px targets, 12px text floor, live regions for processing and results, reduced motion, dialog focus trap and return, custom select ARIA.
- Tests: axe across tool states (not just first load); keyboard-only walk of the image flow and resume flow.

### 12. Final consistency pass (A29, A31, A32, A35 to A37)
- Remove leftover inline styles that conflict with tokens, replace UI-chrome em dashes with `|` or commas, bump asset cache query strings and the service worker cache name once.

## Order of work

1 (repair) then 2, 3, 4 (foundations) then 5, 9 (shared layout) then 6, 8 (tools) then 7 (resume) then 10, 11, 12.
Commits at milestones: repair, foundations and controls, navigation and layout, image workflow, secondary tools and content, resume, mobile and accessibility, final fixes.

## Regression checklist (run before every merge)

`npm test` (48 behaviour checks), `npm run test:browser` (2968 assertions), the new visible-control and blank-button tests, a 10-width overflow sweep over all 39 pages, resume PDF text extraction for all 15 templates, Word and text export, print path, keyboard walks, Chromium plus Firefox run, Edge via the Chromium engine.
