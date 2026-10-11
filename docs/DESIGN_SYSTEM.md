# ApplyReady design system

One stylesheet owns how the interface looks: `css/app.css`. If you change a size, colour or spacing value, change its token there. Do not add a new override file.

## Files

| File | Owns |
|---|---|
| `css/style.css` | Base styles, the resume sheet, print and `@page`. Do not edit the sheet or `@media print` for interface work: resume output must stay identical. |
| `css/workspace.css` | Self-hosted fonts, the brand colour (`--primary`, `--button-primary`) and page layouts. |
| `css/app.css` | All screen chrome: tokens, controls, panels, tools, the resume builder shell, reading pages, responsive rules and reduced motion. It loads last. |

Every page loads the three files in that order, after `css/vendor/icons.min.css` (and `css/vendor/cropper.min.css` on pages with a cropper). The service worker precaches `app.css`. Bump `CACHE_NAME` in `sw.js` and the `?v=` query on the links whenever CSS changes.

`design-system.css`, `ux.css` and `ui.css` were removed in the final recovery pass (see `UI_UX_FINAL_AUDIT.md`). They competed with each other and caused most of the earlier inconsistencies.

## Tokens (`css/app.css`, section 0)

| Group | Values |
|---|---|
| Text | `--fs-12` caption, `--fs-13` help and secondary, `--fs-14` interface (labels, fields, buttons, tables), `--fs-16` reading and panel titles, `--fs-18` lead and h3, `--fs-22` h2, `--fs-24` tool page title, `--fs-30` reading page title (24 on phones) |
| Weight | 400 text, 500 buttons and tabs, 600 labels and headings |
| Controls | `--ctl-sm` 32, `--ctl` 36, `--ctl-lg` 44 (main action). On phones and touch screens: 40, 44 and 48. |
| Radius | `--r-ctl` 6 (controls), `--r-panel` 8 (panels, dialogs, menus), `--r-pill` 999 |
| Space | `--sp-1` to `--sp-7`: 4, 8, 12, 16, 24, 32, 48 |
| Icons | `--icon` set by the container: 12 next to small text, 14 in controls, 16 in navigation and titles, 20 feature marks, 24 drop targets |
| Surfaces | page `--bg-page`, panel `--bg-card` with a 1 px `--border-color`, subtle `--bg-card-subtle`. Shadows only on menus, dropdowns, dialogs and toasts. |
| Fields | white fill, `--input-border` edge with at least 3:1 contrast (checked by a test), green border and ring on focus, red border and a message under the field when invalid |

Dark theme uses the same tokens with dark values under `[data-theme="dark"]`.

## Components

- **Buttons:**
  - Primary (`.btn-primary`, `.btn-success`): one per context.
  - Secondary (`.btn-secondary`, `.btn-outline-primary`).
  - Quiet (`.btn-text`).
  - Danger text (`.btn-outline-danger`, `.btn-text.danger`).
  - Sizes: `.btn-sm`, default, and large for the main action of each tool.
- **Fields:**
  - `.form-label` or `.control-label` above the field, then the field, then `.form-hint` and `.field-error`.
  - Optional fields carry `<span class="optional">(optional)</span>`.
  - Labels have no colons.
  - Example placeholders start with "e.g.".
- **Choice controls:**
  - Custom select: add `custom-select-source` to the native `<select>`. `js/components.js` builds an accessible listbox and keeps the native select in the DOM.
  - Checkboxes and radios are native inputs drawn by CSS.
  - Slider inside `.range-wrap`.
  - Segmented control `.comparison-view-toggle`.
  - Preset switches with `data-preset` and `aria-pressed`.
- **Panels:**
  - One level: `.app-card` with a `.card-title`, or a `.panel-head` row when the title needs a control beside it.
  - Groups inside a panel are separated by space or a divider, never by another bordered box.
  - Lists such as image-to-PDF pages and section order are one bordered list with dividers.
- **Results:**
  - `.result-status` (green, or `.is-warning`) says whether the result meets the limit.
  - The Download button comes next.
  - The facts follow as a plain `.meta-stats` list in sentence case.
- **Output summary:** `#processSummary` under the main image action. `js/resizer.js` fills it with the size, format and limit, or with the reason the action is disabled. Strings can be overridden with `data-*` attributes (the Hindi pages do this).
- **Notices:** an in-page `.alert-box` for errors tied to the task, and `ApplyReadyUI.notify()` for confirmations. `ApplyReadyUI.reveal(el)` scrolls a result into view when it is below the fold.

## Rules that prevent regressions

- Never style an icon's size directly. Set `--icon` on its container.
- Never use pixel literals for control heights; use `--ctl-sm`, `--ctl` or `--ctl-lg`.
- A field's focus and invalid rules must out-rank its base rule. They list the same typed selectors.
- No inline `style` for font size, colour or padding in page markup. Use a class.
- Popups moved to `<body>` (the custom select list) are styled and shown by their own `[hidden]` state.
- Keep text at 12 px or more.

## Tests that guard this

`tests/ui_tests.js` checks the following on every page:
- Only the five icon sizes are used.
- Field heights are 36 px on desktop and 44 px on phones.
- Buttons use the control heights.
- Field edges have 3:1 contrast.
- Text is never under 12 px.
- There is no horizontal overflow at nine widths.
- axe finds no violations in light and dark.
- Keyboard focus is visible, and the custom select works with mouse and keyboard.
- The output summary, inline errors, compress target status, phone reveal, preset state and Tools menu focus behave correctly.

Run `npm test`, `npm run test:browser` and `npm run test:firefox`. To run the browser suites in Chrome or Edge, set `BROWSER_EXECUTABLE_PATH`.
