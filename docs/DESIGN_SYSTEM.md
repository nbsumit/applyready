# ApplyReady design system

This document describes what `css/app.css`, the page generators and `js/components.js` implement
today. The code is the source of truth: if this file and the CSS disagree, the CSS wins and this file
is wrong. Why the interface looks this way is recorded in `docs/UI_UX_REBUILD_PLAN.md`.

## Character

Calm, precise, document-grade. Warm neutral "paper" greys, one ink accent, confident type, and
structure made from spacing and rules rather than boxes. A tool should read as "give me the
requirement and I will get the file right", not as a list of features.

## Files

| File | Owns |
|---|---|
| `css/app.css` | The whole interface, in 17 numbered sections: tokens, base, layout, header, footer, buttons and fields, choice controls, tabs and disclosure, feedback, dialogs and toasts, reading content, page patterns, tool workspace, tool specifics, resume builder, responsive, print and motion. |
| `css/document.css` | The resume paper, its templates and its print layout (resume.html only). It is the output format, not interface, and `tests/content_tests.js` pins its hash. Do not edit it for interface work. |
| `css/vendor/icons.min.css`, `css/vendor/cropper.min.css` | Icon subset (only the classes listed in it exist) and the cropper, restyled in `app.css`. |
| `js/site.js` | Theme, header menu and phone sheet, on-screen keyboard state, phone layout of reference tables, `ApplyReadyUI.notify` (toast), `ApplyReadyUI.reveal`, `ApplyReadyUI.confirm` (dialog). |
| `js/components.js` | Custom select, range fill, segmented-control sync, and the workspace state machine. |
| `scripts/lib/shell.js` | Header, Tools menu, footer and stylesheet links for every page (`node scripts/sync-shell.js`). |
| `scripts/lib/image-workspace.js` | The image resizer workspace (home, KB pages, exam pages, Hindi pages; `node scripts/build-image-pages.js`). |
| `scripts/build-tool-pages.js` | Signature cleaner, Image to PDF, Compress PDF and Passport photo print workspaces. |

Markup between `<!-- tool:start -->` and `<!-- tool:end -->`, and between the `shell:` markers, is
generated. Edit the generator and re-run it; hand edits are overwritten. After CSS or JS changes bump
`ASSET_VERSION` in `scripts/lib/shell.js` (then sync) and `CACHE_NAME` in `sw.js`.

## Tokens (section 0)

### Colour

| Token | Light | Dark | Use |
|---|---|---|---|
| `--c-bg` | `#f6f6f4` | `#111111` | Page background |
| `--c-surface` | `#ffffff` | `#1a1a19` | Panels, header, fields |
| `--c-surface-2` | `#f1f1ee` | `#222221` | Workspace stage, hover, entry blocks |
| `--c-surface-3` | `#e6e6e1` | `#2d2d2b` | Pressed, tracks, counters |
| `--c-desk` | `#e9e9e4` | `#0c0c0c` | Behind paper (resume preview, print preview) |
| `--c-line` / `--c-line-strong` | `#e4e4df` / `#cfcfc8` | `#2c2c2a` / `#3e3e3b` | Dividers / container edges |
| `--c-field-line` | `#8a8a82` | `#77776f` | Field edges, at least 3:1 on bg, surface and surface-2 |
| `--c-text`, `-2`, `-3` | `#191917`, `#3b3b36`, `#5f5f58` | `#ededea`, `#c8c8c2`, `#9d9d96` | Headings and values, body, secondary (all 4.5:1 or better) |
| `--c-text-4` | `#9a9a92` | `#66665f` | Disabled only |
| `--c-accent` (+ `-hover`, `-press`, `-soft`, `-line`) | `#3a3ab0` | `#a3a4ff` | ApplyReady ink: the primary action, selection, links, focus |
| `--c-on-accent` | `#ffffff` | `#15153a` | Text on the accent (dark text on the light dark-theme accent) |
| `--c-success`, `--c-warning`, `--c-danger` (+ `-soft`, `-line`) | `#1d6b3a`, `#835000`, `#b3261e` | `#73d39b`, `#eabb52`, `#ff938a` | Status only, never decoration |

The dark theme is its own palette (neutral near-black, not a blue inversion). Every text, field and
status pairing is contrast-checked from the stylesheet by `tests/run_tests.js` (suite 7).

### Type

Local Inter with a local Noto Devanagari companion; no network fonts.

| Token | Size | Role |
|---|---|---|
| `--fs-xs` | 12 | Metadata, counters, captions |
| `--fs-sm` | 13 | Helper text, footnotes |
| `--fs-label` | 14 | Field labels, menus, compact controls, section titles inside a rail |
| `--fs-md` | 15 | Interface text, buttons, inputs (16 on touch through `--field-fs`, which stops iOS zoom) |
| `--fs-lg` | 16 | Lead interface text, large buttons, FAQ questions |
| `--fs-read` | 17 | Long-form reading (16 on phones) |
| `--fs-xl` | 19 | Panel, result and dropzone headings; page ledes |
| `--fs-2xl` | 23 | Section headings |
| `--fs-3xl` | 30 | Page and tool titles (26 on phones) |
| `--fs-4xl` | 38 | Product title on the home page (28 on phones) |

Weights 400, 500, 600. Line heights `--lh-tight` 1.2, `--lh-ui` 1.45, `--lh-read` 1.7. Titles of 23 px
and up use `--ls-title` (-0.018em) and `text-wrap: balance`.

### Space, controls, shape, depth, layout, motion, stacking

| Group | Tokens |
|---|---|
| Space | `--s-1`..`--s-8` = 4, 8, 12, 16, 24, 32, 48, 64 |
| Controls | `--h-sm` 32, `--h-md` 40, `--h-lg` 48 (40 / 44 / 48 on `pointer: coarse`); `--h-header` 56 |
| Radius | `--r-xs` 4 (tags, segments, checkboxes), `--r-sm` 6 (buttons, fields), `--r-md` 8 (panels, lists, menus), `--r-lg` 12 (dialogs), `--r-full` (switches, round markers) |
| Elevation | `--sh-pop` (menus, select lists, toasts), `--sh-dialog`, `--sh-paper` (resume pages, printed sheets, result images). Nothing else has a shadow. |
| Layout | `--w-read` 700, `--w-app` 1200, `--w-wide` 1440, `--w-rail` 340, `--gutter` 16 / 24 at 640 / 32 at 1000 |
| Motion | `--ease`, `--t-fast` 120 ms, `--t-base` 180 ms; removed under `prefers-reduced-motion` |
| Stacking | `--z-sticky` 30, `--z-header` 40, `--z-pop` 60, `--z-dialog` 80, `--z-toast` 90 |
| Icons | `--icon` 16. Four sizes exist: 12, 16, 20, 28 (`tests/ui_tests.js` rejects others). |

Layout modes. There are two breakpoints, and each one changes the layout, not just a size:

| Mode | Width | What changes |
|---|---|---|
| Desktop | 1000 px and wider | Tool settings rail beside the stage; resume editor (460 to 560 px) beside the preview; result preview beside its facts; gutter 32 |
| Tablet | 640 to 999 px | One column: stage, settings, sticky action. Resume Edit and Preview are switched with a bottom bar, never squeezed; gutter 24 |
| Phone | under 640 px | Header becomes a menu sheet; fields stack; actions are full width; reference tables become one block per row; gutter 16 |

Nothing else uses a media query (apart from `pointer: coarse` for touch control heights, print and
reduced motion), and no grid uses `auto-fit`, except the Image to PDF page tiles, which are a gallery of
fixed-size tiles. Every page is checked for overflow at 32 widths from 320 to 1600, including both
sides of every former and current breakpoint.

## Patterns

### Shell
- **Header** (`.site-header`): brand, Tools menu, Resume builder, Guides, हिन्दी, theme. The current
  page gets a 2 px ink underline. Below 640 px the nav becomes a full-height sheet; on tablets the
  Tools menu spans the header.
- **Tools menu** (`.menu`): what you can do, not a site map. The left column lists the five tools with
  an icon, name and one-line purpose (`.menu__item`), grouped as Image tools and PDF tools; the right
  column lists the five exams with what each covers. File-size pages are reached from the footer and
  the resizer itself. Arrow keys, Home, End and Escape work.
- **Footer** (`.site-footer`): brand statement and four link columns (Tools, Resize to a file size, Exam
  requirements, ApplyReady), so it divides evenly in every mode (4, 4 under the brand, 2 by 2).

### Page heads
`.page-head` holds an optional `.breadcrumb-nav`, `.eyebrow`, `.page-title`, `.page-lede` and on the
resume builder `.assurance`. The home head adds `.page-head--home` (title and one lede; privacy is said
once, in the drop zone). On tool and
landing pages the workspace comes straight after the head (`.tool-section`); reference content
(tables, notices, FAQ, related guides) follows the tool.

### Tool workspace (`.ws`)
One frame for every tool:

| Region | Class | Content |
|---|---|---|
| Requirement (resizer) | `.ws-req` | Step 1: the requirement grid, folding to a one-line summary with Change |
| Document bar | `.ws-head` | `.filebar` (name, size, Replace, Remove) once a file exists; `.ws-status` on the resizer |
| Stage | `.ws-stage` | `.dropzone`, the editor (`.ws-crop`) or preview, and the result (`.ws-result`) |
| Rail | `.ws-rail` > `.ws-side` | `.ws-section` blocks of settings |
| Action | `.ws-rail` > `.ws-action` | The one primary button and `#processSummary` |

Two arrangements, neither with an inner scroll region; the page scrolls normally and only the small
action bar (`.ws-action`) is sticky, at the bottom of the screen:

- `.ws` (secondary tools): on desktops the rail sits beside the stage and its action sticks to the
  bottom of the screen while the rail is longer than the screen. On tablets and phones the rail uses
  `display: contents`: settings follow the stage and the action is a sticky bar.
- `.ws--linear` (image resizer): one column in task order at every width: 1 requirement, file bar,
  2 drop zone or 3 editor, settings disclosure, action. Only the requirement grid's column count and
  field arrangement change between modes. While the on-screen keyboard is open (`body.is-typing`,
  set by `site.js`) the action bar stops being sticky so it never covers the field.

`components.js` sets `data-state` from what the tool script shows: `empty` (no file), `ready` (file,
not processed), `done` (result visible), plus `data-busy` while a `data-ws-busy` element is visible.
CSS decides the layout of each state:

- **Empty**: the drop zone owns the stage; the primary action is hidden (`#btnProcess`,
  `#btnStartCompress`), so choosing a file is the only strong action. Tools without settings before
  a file (`data-simple-empty`) hide the rail.
- **Ready**: editor or preview in the stage, settings in the rail, one primary action.
- **Processing**: the action shows a spinner and `aria-busy`; the image editor is dimmed in place
  so nothing jumps.
- **Done**: `.verdict` (icon, title and the requirement it meets) with Download as the only primary
  action and "Adjust again" beside it, then the preview (Result / Original) and a `.check-table`:
  Required against Your file for file size (with exact bytes), dimensions and format, each met value
  ticked, and the original's size underneath. On phones each table row becomes a block with the two
  values side by side. Tools that keep their settings after a result (`data-keep`) demote their run
  button to secondary.
- **Error**: `.notice--error` at the top of the stage; field errors (`.field-error`) under the field.
- **Warning**: `.result-status.is-warning` (Compress PDF when the limit cannot be met).

Variants: `data-compact-drop` folds the drop zone into a one-line strip once files exist (Image to
PDF). After a file loads, the resizer scrolls the editor into view when most of it is below the screen
(phones and short laptops).

Language: Hindi pages carry their own wording. Generated labels come from `L.hi` in
`scripts/lib/image-workspace.js`; sentences written by `js/resizer.js` come from `data-*` attributes
(process summary, result status and limit) and from its `HINDI_MESSAGES` table (validation and file
errors), applied when `<html lang="hi">`.

### Requirement (image resizer)
Step 1 of the resizer, in its own band (`.ws-req#reqPanel`) above the file, never inside a rail.

- Grid: `.req-grid#reqGrid` of `button.choice[data-preset]` cards (`aria-pressed`), each with
  `.choice__name` and `.choice__spec` (pixels and KB), always both visible. The column count is fixed
  per mode by classes the generator chooses from the number of options: `req-grid--d{2,3,4}` on
  desktops, `req-grid--t{2,3}` on tablets, one column on phones. Cards in a grid share one size, so
  there are no orphans or partial rows (8 options: 4 x 2, 2 x 4, 1 x 8; 3 options: 3, 3, 1).
- Choice: the home page has no default (`data-require-choice`, `data-req="pending"`); processing waits
  for a choice and the action line says so, with "Show me". Exam and file-size pages, and links with
  `?preset=` or `?targetKB=`, arrive with their requirement chosen.
- Summary: once chosen the grid folds to `.req-summary` (name, pixels, KB, format) with a Change
  button (`aria-expanded`, Escape folds it again). It stays visible in every state.
- "Custom size" is always last; it is pressed as soon as any value is edited and then shows the custom
  values. The native `<select id="presetSelect" data-native>` stays hidden as the value store.
- Detailed settings sit behind `.ws-customize` (`data-ws-toggle`, `data-settings="open|closed"`), which
  opens by itself when Custom size is chosen or a value needs fixing (`ws:reveal-settings` event). Open,
  the groups sit in three columns on desktops, size across the top on tablets, stacked on phones.

### Tool specifics
- **Image to PDF**: `.pagelist` of `.page-row` tiles (3:4 thumbnail, page number, name, reorder handle,
  rotate, move earlier, move later, remove). Rows on phones. The handle (`.page-row__handle`,
  `touch-action: none`) drags with mouse, pen or touch and moves with arrow keys; the new position
  is announced in `#pageOrderStatus` and focus follows the moved page. Any change hides a stale PDF.
- **Compress PDF**: `.target-grid` of limit choices plus a typed limit; the result is `.size-compare`
  (Before, After, reduction, pages) under a `.result-status` verdict.
- **Signature cleaner**: `.compare-pair` shows the original and the cleaned result side by side from
  640 px (stacked on phones); the cleaned pane is outlined in ink.
- **Print sheet**: preview on `.ws-preview--desk`, facts in a `.meta-stats--row`, and a reminder to
  print at 100%.

### Controls
- **Buttons**: `.btn` (secondary), `.btn-primary` (one per context), `.btn-ghost`, `.btn-link`,
  `.btn-danger` (outline), `.btn-danger-ghost` (quiet delete, red only on hover or focus),
  `.btn-danger-solid` (confirm dialogs only), `.btn-icon` (needs `aria-label`), sizes `.btn-sm`,
  `.btn-lg`, `.btn-block`.
- **Fields**: `.field` > `.field-label` (+ `.optional`), control (`.input`, `.textarea`, custom select),
  `.field-hint`, `.field-error`. Invalid fields get a danger border and tint. `.input-unit`,
  `.input-group`, `.field-row`, `.field-row--3`.
- **Choice**: `.check`, `.radio`, `.switch` (native inputs drawn in CSS), the custom select (listbox with
  arrows, Home, End, Enter, Space, Escape, type-ahead; native `<select>` keeps value and events),
  ranges with `.range-head`, `.segmented` (`aria-pressed`) for 2 to 4 views, `.chip` for filters only.
- **Disclosure**: `.disclosure` (`<details>`), `.ws-customize`, accordion sections in the resume.
- **Tabs**: `.tabs` / `.tab` with an ink underline and optional `.tab-count`.

### Feedback (one language)
| State | Pattern |
|---|---|
| Success | `.verdict` or `.result-status` with a check icon and words |
| Warning | `.result-status.is-warning`, `.notice--warning`, review "Worth checking" |
| Error | `.notice--error` near what failed, `.field-error` under the field, error toast for file problems |
| Info | `.notice--info`, review "Suggestions" |
| Loading / processing | Button spinner plus `aria-busy`, `.progress` for long jobs, dimmed editor |
| Disabled | `--c-text-4`, no pointer events |
| Empty | Drop zone, `.entries:empty` message, `.empty` |
| Selected | `aria-pressed` / `aria-selected` with an ink marker and weight, never colour alone |
| Saving / saved | Resume `#draftStatusText` (`role="status"`) |
| Offline | `offline.html` served by the service worker |
| Temporary confirmation | Toast (`ApplyReadyUI.notify`) |

Notices are tinted blocks with a 3 px status rule, not cards. Severity is always named in text.

### Reading content
`.page--read` (700 px measure) with `.prose` at 17 px / 1.7. Tables are ruled, not boxed. On phones
`site.js` labels each cell with its column name and a `.table-wrap[data-stack]` table becomes one block
per row (without script it scrolls sideways instead). `.callout` is a ruled aside (ink rule; `.is-warning` uses the
warning rule). Related guides (`.guide-card-grid`, `.related-guides-grid`) are divided link rows in
two columns, not cards. FAQ is a ruled `<details>` list. `.toolset` lists the product family after
the home tool. Ad slots (`.ad-slot-container`) stay invisible until an ad unit exists, sit between
content sections, never inside a workspace, and are labelled "Advertisement".

### Resume builder (`.rb`)
- App bar (`.rb-head`): title, one-line lede, privacy line, "Review and download".
- Editor (`.rb-editor`): sticky stage tabs Write, Style, Review, Download (free navigation; Review
  shows a count of open findings, red when something blocks). Write is an outline of
  `.accordion-section`s with a status line per section (`.accordion-meta`: name, word count, number of
  roles). Entries (`.entry`) are tinted blocks with a fold toggle (`.entry__toggle`), number, live
  title, move, duplicate and a separated quiet delete.
- Style: grouped template list (`.template-card` rows with thumbnail, name, badge, description,
  "In use", full preview button), audience filters (two columns of buttons on phones, never a sideways
  strip), type and page, section order.
- Review: status line, then findings grouped as Fix before sending, Worth checking, Suggestions; each
  says what, where and why, and Fix opens the section and entry and focuses the exact field.
- Download: one row per format (PDF recommended, Word, plain text) with what it is for, then print,
  then Keep your work (device draft, backup file).
- Preview (`.rb-preview`): sticky paper on `--c-desk` with template name, page count, zoom and PDF. On
  desktops it is the one contained scroll region in the product: it stays beside a long editor, so
  multi-page resumes scroll inside it.
- Phones: `.rb-bar` with Edit / Preview tabs and a Download button; hidden while typing.

## Rules

- Change tokens, not literals. Colours, sizes, radii and shadows come from section 0 (cropper
  internals and the workspace's dark editor background are the documented exceptions).
- One container level per region. Group with space and rules; a bordered block is for an
  independent object (a workspace, an entry, a page tile, a list of choices).
- One primary button per state. Delete never has the weight of Add.
- No gradients, glass, glows or decorative shadows. No inline `style` in page markup.
- No em dash in interface code. Text at 12 px or more, touch targets 40 px or more.
- Icons from the subset only, at 12, 16, 20 or 28 px.
- Keep the hooks the scripts read: element ids, `data-preset`, `data-kb`, `data-template(-id)`,
  `data-action`, `data-idx`, `data-goto-tab`, `data-ws-*`, and the state classes `hidden`, `active`,
  `is-invalid`, `dragover`, `open`, `status-ok`, `is-warning`.

## Tests that guard this

- `tests/run_tests.js` suite 7: token contrast in both themes, read from `app.css`.
- `tests/ui_tests.js`: readable buttons, 12 px floor, icon scale, control heights, custom select,
  requirement state, focus visibility, overflow at 32 widths, layout modes on both sides of 640 and
  1000 (requirement grid columns, equal cards, whole labels, order, no sideways scrolling, task order,
  primary action on screen, header and Tools menu, result facts, resume arrangement), axe in both
  themes (including result states), inline errors, compress status, phone reveal, menu focus.
- `tests/browser_tests.js`, `tests/image_workflow_tests.js`, `tests/resume_flow_tests.js`,
  `tests/browser_smoke.js`: real files, exact sizes, downloads, all templates, exports, resume
  editing, mobile navigation.
- `tests/content_tests.js`: metadata, links, generated shell in sync, no inline styles, no em dash in
  interface code, `document.css` hash.
