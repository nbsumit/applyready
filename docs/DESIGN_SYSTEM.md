# ApplyReady design system

The interface was rebuilt from scratch as one system. Every page uses the same tokens, the same controls and the same page patterns. The engines underneath (image processing, PDF and Word generation, resume data and templates, storage) were not touched.

## Files

| File | Owns |
|---|---|
| `css/app.css` | The whole interface: tokens, base, layout, header and footer, buttons and fields, choice controls, menus and tabs, feedback, dialogs, data and prose, page patterns, the tool workspace, the resume builder shell, responsive rules, print resets and reduced motion. |
| `css/document.css` | The resume sheet, its templates and the print layout. Loaded on `resume.html` only. It exists so the exported and printed resume stays byte-for-byte identical. Do not edit it for interface work. |
| `css/vendor/icons.min.css`, `css/vendor/cropper.min.css` | Icon subset and the cropper (the cropper is restyled in `app.css`). |

If you change a size, colour or spacing value, change its token in `css/app.css` section 0. Do not add override files and do not add inline styles to page markup. Bump `CACHE_NAME` in `sw.js` and the `?v=` query on the stylesheet links when CSS changes.

| Script | Owns |
|---|---|
| `js/site.js` | Header, navigation (desktop menu and phone sheet), theme toggle, toasts (`ApplyReadyUI.notify`), `ApplyReadyUI.reveal`, and the confirm dialog (`ApplyReadyUI.confirm`). |
| `js/components.js` | Custom select, range, segmented control and the tool workspace state machine. |

Shared markup (header, footer, skip link) is generated. Run `node scripts/sync-shell.js` after editing `scripts/lib/shell.js`, and `node scripts/sync-shell.js --check` in CI. The tool pages are generated from `scripts/lib/image-workspace.js` by `scripts/build-image-pages.js` and `scripts/build-tool-pages.js`. Hand edits between `<!-- tool:start -->` and `<!-- tool:end -->` are overwritten.

## Tokens (`css/app.css`, section 0)

| Group | Values |
|---|---|
| Colour | Neutrals `--c-bg`, `--c-surface`, `--c-surface-2`, `--c-surface-3`, `--c-line`, `--c-line-strong`, `--c-field-line`, `--c-text` to `--c-text-4`. One accent `--c-accent` (hover, press, soft, line, on-accent). Status `--c-success`, `--c-warning`, `--c-danger` with soft and line variants. Status colours are never decoration. |
| Type | Inter with a Devanagari companion. `--fs-xs` 12 caption, `--fs-sm` 13 label and helper, `--fs-md` 14 interface, `--fs-lg` 16 reading and panel title, `--fs-xl` 18, `--fs-2xl` 22 section and tool title, `--fs-3xl` 28 reading title. Weights 400, 500, 600. Line heights `--lh-tight`, `--lh-ui`, `--lh-read`. |
| Space | 4 point scale: `--s-1` to `--s-8` = 4, 8, 12, 16, 24, 32, 48, 64. |
| Controls | `--h-sm` 32, `--h-md` 40, `--h-lg` 48 (the main action). On touch screens (`pointer: coarse`) small and medium grow to 40 and 44. `--h-header` 56. |
| Icons | Four sizes only, set through `--icon` on the container: 12 beside small text, 16 default, 20 feature marks, 28 drop targets. |
| Shape | `--r-sm` 6 controls, `--r-md` 8 panels, menus and dialogs, `--r-full` badges. One 1 px border width. |
| Depth | Shadows only on menus, dropdowns, dialogs, toasts and the resume paper (`--sh-pop`, `--sh-dialog`, `--sh-paper`). Panels have a border, not a shadow. |
| Layout | Page widths `--w-read` 720, `--w-app` 1120, `--w-wide` 1360. Gutter 16, 24 at 640, 32 at 1100. |
| Motion | `--ease`, `--t-fast` 120 ms, `--t-base` 180 ms. Motion is functional only (state changes, menu open, progress) and is removed under `prefers-reduced-motion`. |
| Stacking | `--z-sticky`, `--z-header`, `--z-pop`, `--z-dialog`, `--z-toast`. |
| Breakpoints | 560 (phone), 640 (gutter), 860 (tool workspace stacks), 1000 (resume builder shows editor and preview side by side), 1360 (wide). Behaviour checked at 320, 360, 375, 390, 430, 768, 1024, 1280 and 1440. |

The dark theme uses the same tokens under `[data-theme='dark']`. Text and field edges meet WCAG contrast in both themes (`tests/ui_tests.js` checks the field edge at 3:1).

### Interaction states

Every control defines the same states from the same tokens: rest, hover (`--c-surface-2` or the accent hover), pressed, keyboard focus (a 2 px `--c-focus` outline with a soft ring, never removed), selected (`aria-pressed`, `aria-selected`, `aria-checked`, `.is-current`), disabled (`--c-text-4`, no pointer events), invalid (`aria-invalid` plus `.field-error` text under the field), success and warning (`.notice--*`, `.badge--*`, `.result-status`).

## Components

- **Buttons:** `.btn` is the secondary button. `.btn-primary` is the one obvious action of a context. Also `.btn-ghost`, `.btn-danger` (outline), `.btn-danger-solid` (confirmations only), `.btn-icon` (icon only, needs an `aria-label`), `.btn-link`, sizes `.btn-sm` and `.btn-lg`, `.btn-block`. A loading button keeps its width and shows `.spinner`. Delete never shares the visual weight of Add or Edit.
- **Fields:** `.field` wraps `.field-label`, the control (`.input`, `.textarea`, `.select`), `.field-hint` and `.field-error`. Optional fields carry `<span class="optional">(optional)</span>`. Placeholders are examples ("e.g. ..."), never labels. `.input-unit` adds a unit beside a number, `.field-row` lays fields side by side and collapses on phones.
- **Choice controls:** checkboxes (`.check`), radios (`.radio`) and switches (`.switch`) are native inputs drawn by CSS. The custom select is built by `js/components.js` from any `<select>`: the native element stays in the DOM, `value`, `selectedIndex` and `change` keep working, and the list is a keyboard-accessible listbox (arrows, Home, End, Enter, Space, Escape, type-ahead). Ranges get a live value (`.range-head`, `.range-value`). Segmented controls (`.segmented`) use `aria-pressed`.
- **Navigation:** `.site-header` with `.site-nav`. The Tools entry is a menu (`.menu`) on desktop and a grouped sheet on phones. `.tabs` and `.tab` for in-page views, `.disclosure` for progressive disclosure (`<details>`).
- **Page patterns:** `.page` (app width), `.page--read` (reading width), `.page--wide` (resume builder), `.page-head` with `.eyebrow`, `.page-title`, `.page-lede`. Reading content uses `.prose`, `.section`, `.table-wrap`, `.faq-*`, `.guide-card-grid`.
- **Tool workspace (`.ws`):** every tool shares Input, Configure, Execute, Result. The script only shows and hides its own elements; `initWorkspace()` reads them (`data-ws-file`, `data-ws-result`, `data-ws-busy`) and sets `data-state="empty|ready|done"`. CSS decides what is shown in each state. On phones a sticky action bar carries the primary action, and settings fold away once a result exists. `data-settings="open|closed"` is toggled by `[data-ws-toggle]`.
- **Results:** `.result-status` says whether the result meets the requirement, the Download button comes next, then `.meta-stats` (size, dimensions, format) as a plain list. `#processSummary` states what Process will produce, or why it is unavailable.
- **Notices:** `.notice` with `--error`, `--warning`, `--info`, `--success` for messages tied to the task. Errors say what happened and what to do. `ApplyReadyUI.notify()` shows a toast for confirmations. `ApplyReadyUI.confirm()` is a dialog that replaces `window.confirm`.
- **Dialogs:** `.dialog` inside `.dialog-backdrop`: focus trap, Escape closes, focus returns to the opener, always inside the visual viewport (including with the on-screen keyboard).
- **Empty states:** `.empty` with `.empty__title`, one sentence and the next action.
- **Resume builder (`.rb`):** four steps (Write, Style, Review, Download) as `.rb-steps`. Entries are coherent objects (`.entry`) with a numbered header, title, move up, move down and a quiet delete; optional sections are added from `.rb-add-section`. Desktop shows editor and live preview side by side, phones switch between them with a bar (`.rb-bar`). Review findings are grouped as blocking error, warning, recommendation and success (`.review-item--*`), each with where and how to fix, and a Fix button that jumps to the field.

## Rules that prevent regressions

- Never size an icon directly; set `--icon` on its container and use only 12, 16, 20 or 28.
- Never use literal control heights; use `--h-sm`, `--h-md` or `--h-lg`.
- Never put a card inside a card. Group with space and dividers; a card is for an independent object (a template, a page in a PDF, a guide link).
- No gradients, glass effects or decorative shadows. No inline `style` in page markup.
- No em dash in interface text. Use a comma, colon or full stop. Title separators use `|`.
- Keep text at 12 px or more and touch targets at 40 px or more.
- JS and markup share a contract through ids and state classes (`hidden`, `active`, `is-invalid`, `dragover`, `status-ok`, `is-warning`, `.dynamic-item`, `data-action`). Change the markup freely, but keep those hooks.

## Tests that guard this

- `tests/ui_tests.js`: icon sizes, control heights, text floor, no native file inputs, no horizontal overflow at nine widths, axe in light and dark on every page and in result states, focus visibility, custom select keyboard behaviour, output summary, inline errors, compress target status, phone reveal, preset state, Tools menu focus.
- `tests/browser_tests.js`: responsive layouts, image processing with real files, resume draft, import, all fifteen templates, PDF, Word and text downloads, dialogs, mobile navigation.
- `tests/browser_smoke.js`: end to end on every tool.
- `tests/content_tests.js`: markup, SEO, one stylesheet per page, generated shell in sync, no inline styling, no em dash in interface code, and a hash of `css/document.css` so the exported resume cannot change by accident.
- `tests/regression_tests.js`, `tests/run_tests.js`: presets, engines and exports.

Run `npm test` and `npm run test:browser`. To use an installed browser, set `BROWSER_EXECUTABLE_PATH`. `npm run test:firefox` runs the UI and smoke suites in Firefox.
