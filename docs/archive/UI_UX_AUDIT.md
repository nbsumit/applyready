# ApplyReady UI/UX Audit

Date: 2026-10-11
Scope: live site https://applyready.in and local `main` at `b85d22e`
Method: page inventory, Playwright walkthrough at 320 / 360 / 390 / 768 / 1280 / 1440, light and dark, real upload and process, resume sample, mobile menu, custom select. No UI code was changed during this audit.

## Executive Summary

The tools work. A person can upload, crop, compress, and download. The resume builder can be filled, styled, and exported. Nothing in this audit is a broken algorithm.

The interface still makes people think about the interface.

The last redesign added a fourth visual layer (`css/ux.css`) on top of `style.css`, `workspace.css`, and `design-system.css`. Those layers do not agree. The result is a product that looks related, but not like one system. Settings, upload, presets, and download often have the same visual weight. On a phone, the successful image result is on screen, but the Download button is below the fold. At 768px the homepage is still a squeezed two-column desktop layout because the mobile cutoff is 760px.

The fix is not another skin. It is hierarchy, one control system, and progressive disclosure. Features stay. The order of attention changes.

## Site Inventory

### Tools
- `/` homepage image resizer and compressor
- `/resume.html` ATS resume builder
- `/signature-cleaner.html`
- `/image-to-pdf.html`
- `/compress-pdf.html`
- `/passport-photo-print.html`

### Exam spec pages (English and Hindi)
- `/ssc-photo-signature-size.html`, `/hi/ssc-photo-signature-size.html`
- `/upsc-photo-signature-size.html`, `/hi/upsc-photo-signature-size.html`
- `/ibps-photo-signature-size.html`, `/hi/ibps-photo-signature-size.html`
- `/neet-photo-signature-size.html`, `/hi/neet-photo-signature-size.html`
- `/rrb-photo-signature-size.html`, `/hi/rrb-photo-signature-size.html`

### Resize-to-KB pages
- `/resize-image-to-10kb.html`
- `/resize-image-to-20kb.html`
- `/resize-image-to-50kb.html`
- `/resize-image-to-100kb.html`
- `/resize-image-to-200kb.html`

### Guides
- `/guides/`
- `/guides/ats-friendly-resume-guide.html`
- `/guides/compression-targets-guide.html`
- `/guides/image-dimensions-vs-file-size.html`
- `/guides/image-formats-guide.html`
- `/guides/aadhaar-pan-passport-photo-specifications.html`
- `/guides/why-was-my-photo-rejected-online-applications.html`
- `/guides/fresher-resume-examples-by-role.html`
- `/guides/resume-summary-examples-indian-freshers.html`
- `/guides/cv-vs-resume-india-job-applications.html`
- `/guides/campus-placement-interview-prep-guide.html`

### Other
- `/how-to-use.html`
- `/about.html`
- `/privacy.html`
- `/terms.html`
- `/contact.html`
- `/404.html`
- `/offline.html`

### Shared chrome
- Sticky header, Tools menu, theme toggle, mobile menu
- Footer
- Custom select listbox (all single selects)
- Custom checkbox, radio, range, date field chrome
- Reserved ad slots
- FAQ accordions
- Toasts / task notifications

## Design System Problems

Four stylesheets define the look:

| File | Role | Conflict |
|---|---|---|
| `style.css` | Original tokens, cards, forms | Blue primary `#2563EB`, older radii |
| `workspace.css` | Real product skin | Green `#17634d`, overrides almost everything |
| `design-system.css` | Unused parallel tokens | Blue `#2563eb`, `.btn--primary` that pages do not use |
| `ux.css` | Last-loaded visual layer | Partial overrides, not a system |

Problems:

- Two token names for the same idea (`--primary` vs `--color-primary`).
- Spacing is ad hoc: 0.45rem, 0.65rem, 0.75rem, 0.85rem, 1.1rem, 1.25rem.
- Radius jumps between 6px, 8px, 10px, 14px, 16px, 20px.
- `.btn` and `.btn--*` both exist. Pages use `.btn`.
- Cards, disclosures, and meta-stat boxes all use bordered rounded rectangles. Card inside card is common.
- Focus is defined in three files (outline, box-shadow, both).
- Motion: workspace still lifts buttons on hover (`translateY(-1px)`). ux.css tries to cancel it.

Controls are mostly custom already. Native `<select>` is visually hidden and a listbox is shown. Checkboxes, radios, and ranges are appearance-none. Date fields have custom chrome; the picker popup stays native, which is correct. File inputs are hidden behind dropzones. This is the right model. The remaining problem is consistency and a few states, not a missing custom widget.

## Page-by-Page Audit

### Homepage `/`

Task: Upload, Adjust, Process, Download.

What the eye sees first on desktop: a long H1, then a row of six preset chips, then two equal cards. The left card is a full settings form. The right card is the upload. They compete.

What the eye sees first on mobile (390): the H1 (four lines), trust chips, then preset chips, then the upload. That order is better. Settings are below the fold, which is correct.

Controls visible before an image exists, all at similar weight:

- preset select
- width, height, aspect lock, unit, DPI
- min KB, max KB
- format, crop ratio
- background and name/date (inside disclosure, good)
- target spec summary

After upload the crop workspace and "Resize & compress" are clear. Status correctly becomes "Ready to edit".

After process:

- Status becomes "Ready to download".
- Result heading, comparison toggle, preview, then seven stat rows, then Download.
- On 390x844, result top is about 170px and Download is about 907px. The success state is visible. The primary action is not.
- On 1440x900 Download is near the bottom of the viewport (about 769px). Easy to miss.

Other:

- Steps (Upload / Adjust / Download) are small and not tied to the panels.
- Privacy is said three times: trust chips, assurance box, workspace footnote.
- Preset chips at 320px truncate ("Declar...", "Docume...") and wrap into an uneven grid.
- At 768px the layout is still two columns because the cutoff is 760px. Settings column is about 320px. Workspace is cramped. This is a tablet failure.
- Advanced disclosure is a bordered box inside an already bordered card.

### Resume builder `/resume.html`

Mental model that exists: Content | Design | Download, plus Edit | Preview on small screens. This is the right model.

Empty state is honest: the paper says to start with a name. Undo/Redo are disabled. "Use sample" is available. Good.

After sample data, preview updates. Accordion sections group the form. Entries are objects with their own actions. Destructive actions are outline, not filled. Good.

Problems:

- Hero "Review & download" and the Download tab are two doors to the same task. Not broken, but the first-time path is unclear.
- Design tab is a dense gallery. Selected state exists (border) but is easy to miss in a grid of similar cards.
- Mobile editor is a long form. Tabs help. There is no sense of "you are in contact, next is experience" beyond the accordion.
- Preview on mobile is a separate mode. That is correct. Zoom controls are small.
- Draft / backup / import live in a disclosure. Fine.

Do not restyle the resume document itself.

### Signature cleaner

Clear upload on the right, sliders on the left. Whiteness and contrast are custom ranges. "Choose signature photo" is the obvious action. Cleaner than the homepage because there are fewer controls. Still shows every slider before an image exists.

### Image to PDF

Upload is obvious. Page size, orientation, margin, and quality are all visible before any image. "Create PDF" is correctly disabled. Same pattern as the homepage: settings wall beside the task.

### PDF compressor

Best of the tool pages. One upload, one segmented choice (Low / Medium / High), one disabled primary action. This is the hierarchy the other tools should approach.

### Passport photo print

Worst cognitive load. Before upload the left column shows photo size, paper size, copies, guide lines, border, and margin controls, all at once. The upload is clear, but the page asks for a decision the user cannot make yet.

### Exam pages (SSC, UPSC, IBPS, NEET, RRB, English and Hindi)

These are articles with an embedded resizer. The spec table is first. The tool is below the first viewport on desktop. That matches search intent (people land for the spec) but hides the task for people who came to resize.

Hindi pages keep Devanagari. Layout matches the English exam pages. Footer and nav are the shared chrome.

### Resize-to-KB pages

Same pattern as exam pages: article first, tool later. The H1 promises a resize. The first screen is explanation.

### Guides

Readable. One column, heading hierarchy, links. The content sits in a card, which is slightly dashboard-like for an article, but not harmful. Line length is acceptable. Do not turn these into tool pages.

### About, Privacy, Terms, Contact, How to use, 404, Offline

Reading pages. Hierarchy is fine. Contact is short. No tool controls. Keep them as documents.

## Mobile Audit

Viewports used: 320, 360, 390, 768, plus desktop 1280 and 1440.

| Viewport | Finding |
|---|---|
| 320 | Preset labels truncate. Trust chips wrap. H1 is four lines. Upload is first, which is good. Edges are close but not clipped. |
| 360 / 390 | Same as 320 with slightly more room. Menu works. Tools submenu is a long in-flow list. |
| 768 | Homepage still two-column. Cramped. This is the main responsive bug. |
| 390 result | Download below the fold. |
| Resume 390 | Edit/Preview switch works. Preview paper fits. Editor is long but usable. |

Mobile menu:

- Opens and closes.
- Tools expands inside the menu (correct for a phone).
- Fifteen-plus links with only small group labels. No current-page mark.
- Touch targets on nav links are adequate. Brand logo is about 28px tall.

No horizontal page overflow was measured on the audited pages.

## Accessibility Audit

- Skip link exists.
- Focus rings exist.
- Custom select keeps a real `<select>` for value, change events, and `selectOption`. Button is the tab stop. Listbox supports arrows, Home/End, type-ahead, Enter, Space, Escape.
- `aria-activedescendant` is on the listbox, not the button.
- Checkboxes and radios keep native semantics.
- Date value stays `YYYY-MM-DD`.
- Labels are present on primary fields.
- Contrast of body text on the light background is acceptable. Muted text is the risk; `#5c6970` on white is near the edge.
- Brand logo and some text links are under 44px. axe `target-size` can flag the logo when it overlaps other controls.
- Reduced motion is respected in ux.css.
- Resume sticky-header clearance is covered by `scroll-padding-top` and `scroll-margin` on fields. Do not reduce those.

## Interaction Audit

- Theme toggle works. No flash (theme.js).
- Mobile menu owned by `site.js`. Do not add a second listener.
- Dropzones are visual-only in `components.js`. Tool pages own file assignment. Do not assign files in the shared layer (that doubled files before).
- Custom select list is `position: fixed` on `document.body`, so it is not clipped.
- Escape closes the select and also the mobile menu. Select handler stops propagation while open.
- Processing disables the action. Status text updates. No fake spinner was required for the audit.
- Errors on the resizer appear in `#processErrorBox` and field errors. They are near the work. Wording is plain.
- Empty states: homepage dropzone says what to do. Resume paper says start with a name. PDF tools say choose a file. Good.
- Success states are weak because the next action is not dominant.

## Priority Matrix

### P0 | Broken / prevents task
None found. Workflows complete.

### P1 | Serious usability
1. Homepage and most tools show every setting at the same weight as the task.
2. After a successful resize on a phone, Download is below the fold.
3. 768px uses the desktop two-column layout (cutoff is 760px).
4. Passport print (and image-to-PDF) is a settings wall before upload.
5. Exam and KB pages hide the resizer below an article.
6. Four CSS systems disagree. Inconsistencies are structural.
7. Current page is not marked in the nav.
8. Small-screen preset chips truncate and wrap unevenly.

### P2 | Significant friction
1. Privacy is repeated three times on the homepage.
2. Steps are decorative, not tied to the panels.
3. Result is a stat wall. Success is a heading, not an action.
4. Card inside card (advanced box, spec blocks, guide card).
5. Resume has two download doors.
6. Resume template selected state is quiet.
7. Helper text repeats what the control already says.
8. Min size, unit, DPI, and crop ratio look primary.
9. Tools do not share one step language.
10. Mobile Tools menu is a long flat list.
11. Footer on the homepage is a dense link cloud.
12. Custom select has no visible hint that typing filters.

### P3 | Visual inconsistency
1. All-caps eyebrows feel like a template.
2. Mixed radii and shadows.
3. Unused `.btn--*` system beside `.btn`.
4. Guide pages boxed like dashboards.
5. Spacing not on one scale.
6. Focus ring defined three ways.
7. Hover-lift still in workspace.css.
8. Dark theme is fine but inherits the same hierarchy issues.
9. Hindi pages match English exam pages; no extra visual bugs found.
10. Comparison toggle is fine but not clearly a segment control.

### P4 | Minor
1. Brand logo under 44px.
2. Some footer links are small.
3. Trust marks are plain text.
4. Date picker popup is native (keep it).
5. Number spinners are hidden (keep it; typing is enough).
6. Ad slots are reserved. Do not touch.

## Proposed Changes

### P1-1 Settings compete with the task
Current: full form beside upload.
Problem: user must parse settings before they have an image.
Proposed: before an image, upload and presets lead. Settings stay available but visually secondary. After upload, crop and process lead. After success, result and Download lead.
Risk: low if done with CSS `:has()` and order. Do not move fields in the DOM (JS reads them by id).

### P1-2 Download below the fold
Current: stats, then Download.
Problem: success without the next action.
Proposed: CSS order so the action group sits directly under the preview. Stats remain, below the button.
Risk: low. Ids and handlers unchanged.

### P1-3 768px layout
Current: mobile rules at `max-width: 760px`.
Proposed: stack the resizer (and similar tool grids) through 960px.
Risk: medium. Must not break the resume split, which already stacks under 950px. Test 768 and 1024.

### P1-4 / P1-5 Tool buried or overloaded
Proposed: same visual priority rules on signature, image-to-PDF, compress, passport. On exam and KB pages, make the embedded tool section read as the action, and add a quiet "Resize now" jump near the spec table if an anchor exists. Do not rewrite the article.
Risk: low if HTML additions are a single in-page link.

### P1-6 One visual system
Proposed: `ux.css` becomes the winning layer for chrome: space, type, radius, control height, focus, buttons. Do not delete the other files (print and document CSS live there).
Risk: medium. Must not touch `.ats-resume-sheet`, print `@page`, or resume pagination CSS.

### P1-7 Current page
Proposed: presentation JS sets `aria-current="page"` on the matching nav link. CSS styles it.
Risk: low.

### P1-8 Preset chips
Proposed: one horizontally scrolling row on small screens. Full labels. No truncation.
Risk: low. `overflow-x: auto` on the bar, not the page.

## What must not change

Algorithms, compression, crop math, presets, preset values, formats, file-size rules, resume data, PDF/Word/text generation, template output, print output, ATS behavior, storage, privacy, APIs, routes, URLs, metadata, SEO.
