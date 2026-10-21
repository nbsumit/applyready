# ApplyReady UI/UX final plan

Read with `UI_UX_FINAL_AUDIT.md`. Finding IDs (P1-1 and so on) refer to that file.

## Principles for this pass

1. **Recover, do not redesign.** Keep the layout, flow and features people already use. Undo the parts of recent passes that hurt clarity, and finish the parts that were half done.
2. **One system, one file.** Visual decisions live in one stylesheet with one set of tokens. Old files lose their say over chrome.
3. **The task is the interface.** Each screen has one obvious next step. The result says plainly whether it meets what was asked.
4. **Out of scope:** algorithms, crop logic, PDF or Word output, templates, data, storage, routes, SEO text and presets. JavaScript changes are limited to messages, scrolling and summaries that present existing state.

## 1. Architecture: from five layers to three

| File | After this pass |
|---|---|
| `css/style.css` | Unchanged. Base, resume sheet, print and `@page` (resume output must stay identical). |
| `css/workspace.css` | Unchanged. Fonts, brand colour, page layouts. |
| `css/design-system.css` | **Removed.** Its few live rules (custom select list, Tools menu panel, toast, steps, slider, sr-only, Devanagari font, reduced motion) move to `app.css`. Its second token set and unused BEM components go. |
| `css/ux.css` + `css/ui.css` | **Merged into `css/app.css`**, the one file that owns screen chrome. Layout rules (embedded tool order, result grid, review groups) are kept. Visual values use only the tokens below. |

Every page loads `style.css`, `workspace.css`, `app.css` (plus the vendor icon and cropper CSS). The service worker cache list and cache name are updated.

## 2. The system

### Tokens

| Group | Values |
|---|---|
| Text sizes | 12 caption, 13 help and secondary, 14 interface (labels, fields, buttons, table text), 16 reading, panel titles and phone fields, 18 lead and h3, 22 section heading, 24 tool page title (22 on phones), 30 reading page title (24 on phones). Final values; the first draft of this plan said 18 for panel titles and 28 for reading titles. |
| Weights | 400 text, 500 buttons and tabs, 600 labels, titles and headings |
| Control height | 36 default, 32 small, 44 primary action; on phones and touch 44 / 40 / 48 |
| Radius | 6 controls, 8 panels, dialogs and menus, 999 pills |
| Space | 4 px grid: 4, 8, 12, 16, 24, 32, 48 |
| Surfaces | page `#f6f7f8`, panel white with a `#e1e5e8` border, subtle `#f3f5f6`; no shadow except menus, dropdowns, dialogs and toasts |
| Field | white fill, 1 px `#848f97` border (3.3:1 on white, so the edge is visible), hover darker, focus green border and 3 px ring, invalid red border and message under the field, disabled subtle fill |
| Icons | 12 / 14 / 16 / 20 / 24 by context, set once |
| Dark theme | the same structure with dark values; field border `#68757d` on `#171c20` (3.6:1) |

### Components (one variant each)

- **Buttons:**
  - Primary: filled green, one per context.
  - Secondary: white with a border.
  - Quiet: text only, for "Preview", "Go to section" and "Remove".
  - Danger: red text.
  - Sizes: default, small, large (main action).
- **Fields:** label above (14 px, weight 600, heading colour), field, help (13 px, muted), error (13 px, red, under the field). "(optional)" is lowercase and muted. No colons in labels.
- **Choice controls:** the custom select (kept), checkboxes and radios (18 px box inside a 44 px label row on phones), slider (4 px track, 16 px thumb), segmented control (grey track, white pill), tabs (underline).
- **Panels:** one level. Groups inside a panel are separated by space or a divider, never by another bordered box.
- **Results:**
  - A status line first: a check icon and "Under 50 KB", or a warning and the reason.
  - Then the Download button.
  - Then the facts as a plain two-column list, in sentence case.
- **Notices:** an in-page error box for errors tied to a task, a toast for confirmations.

## 3. Workflows

### Image tools (Upload, Adjust, Process, Download)

| Fix | Finding | How |
|---|---|---|
| Output summary next to the action: "350 × 450 px · JPEG · under 50 KB · Change" | P2-1, P1-3 | A `#processSummary` line under "Resize & compress" on the home and all 15 embedded pages. `resizer.js` writes the same strings it already computes for `#specDims`, `#specSize` and `#specFormat`. "Change" jumps to the settings. When the settings are invalid, it shows the reason and a link to the field. |
| Errors under the field at fault | P1-3 | Move `#dimError` under the width and height row and `#sizeError` under the KB row (HTML only). Fix the specificity so `.is-invalid` shows. |
| Result first, details second | P2-4 | CSS: status line, preview, Download, Edit crop, then a quiet two-column fact list instead of six boxes. All facts stay. |
| Toolbar | P3-6 | One row of five equal buttons, no grey box. |
| Passport sheet and signature cleaner on phones | P1-1 | After a successful upload, scroll the preview into view when the layout is one column (`matchMedia`), respecting reduced motion. |
| Compress PDF target missed | P1-2 | Remember the target at start. The result shows "Under 200 KB" or a warning: "This PDF could not get under 20 KB. The smallest readable version is 70.2 KB. Try a higher limit or fewer pages." Size colour follows the status. |
| Image to PDF empty states | P2-8 | Hide the second empty state while the dropzone is shown. Once pages are added, the dropzone shrinks to a compact "Add images" bar. |
| Tool page header on phones | P2-3 | Title 22 px, intro 14 px, trust box below the intro. |
| Home at 768 | P2-7 | Two columns from 768 px (workspace and settings), one column below. |
| Advanced settings | P3-5 | No inner box; "Today" matches its field height; labels lose colons. |

### Resume builder (Write, Style, Review, Download)

| Fix | Finding | How |
|---|---|---|
| Tab names follow the task | P2-6 | "Write", "Style", "Review & download". IDs, order and behaviour stay. |
| Visible field edges, entry layout | P1-4, P2-9 | Entries become white blocks with a single border and a header row (title, move up, move down, duplicate, delete). Fields have real borders. |
| Placeholders | P1-5 | Every example starts with "e.g.", and placeholders are lighter than entered text. |
| Duration and location on phones | P2-5 | Stack below 520 px. |
| Template gallery | P3-7 | "Use" is the clear action and "Preview" a quiet button, side by side under the name. |
| Optional markers | P3-4 | "(optional)" everywhere, the same style. |

### Site-wide

| Fix | Finding |
|---|---|
| Result labels in sentence case on every tool | P3-3 |
| Content tables, callouts and notes on exam, KB, Hindi and guide pages use the system styles. Inline font sizes, paddings and colours on `table`, `th`, `td` and callout boxes are removed and replaced by classes. | P3-1, P3-9 |
| Mobile menu gets an edge and spacing, and the Quick start bar shows that it scrolls | P4-1, P4-2 |
| Checkbox rows are 44 px tall on phones | P4-3 |
| "Use original size" says "Available after you add an image" while disabled | P4-4 |

## 4. Accessibility checklist (kept or added)

- Focus is visible on every control (2 px outline or border plus ring), and nothing removes it.
- Keyboard:
  - The custom select supports arrows, Home, End, Enter, Space, Escape and Tab.
  - Dialogs trap focus and Escape closes them.
  - Menus close with Escape and return focus.
- Labels on every field; errors linked with `aria-describedby` and announced.
- Contrast: AA text, and 3:1 for field edges, checkbox borders and focus rings.
- Targets: 24 px minimum everywhere, 44 px on touch.
- `prefers-reduced-motion` turns off smooth scrolling and transitions.

## 5. Tests and checks

1. **Existing suites** in Chromium, Chrome 155, Edge 155 and Firefox: `npm test`, `test:browser`, and the UI and smoke tests.
2. **Guard tests updated** to the new scale:
   - Field heights 36 on desktop and 44 on phones.
   - Buttons 32, 36 or 44 on desktop, and 40, 44 or 48 on phones.
   - Five icon sizes.
   - Field border contrast of at least 3:1 against the surface behind it.
3. **New tests:**
   - The output summary updates when a preset changes and names the problem when a value is invalid.
   - The width error appears next to the width field.
   - Compress PDF says when the target is missed.
   - The passport and signature previews scroll into view on a phone after upload.
   - Every resume placeholder starts with "e.g.".
4. **Resume print:** all 15 templates printed before and after are pixel-identical.
5. **Visual diff:** every page at 390 and 1440, before and after, reviewed by eye for breakage.
6. **Real-file workflows** in every tool, as in the audit.

## 6. Order of work

1. Build `app.css`, switch all pages over, remove the three old files, and confirm no visual breakage page by page.
2. Apply the system values and component variants.
3. Make the HTML and JS fixes for the image workflow, compress, passport and signature, then for the resume builder.
4. Clean up the content pages (inline styles).
5. Write the tests, then run the suites in four browsers and the print comparison.
6. Write `UI_UX_FINAL_POST_AUDIT.md`, fix P0 to P3, re-test, merge `main` and push.
