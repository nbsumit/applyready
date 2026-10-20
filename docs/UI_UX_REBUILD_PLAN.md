# UI/UX rebuild plan

Status: implemented on this branch. This file records why the interface was rebuilt and what must not
break. `docs/DESIGN_SYSTEM.md` documents the system that the code now implements.

## 1. Problems found in the previous interface

| Area | Problem |
| --- | --- |
| Identity | Cool blue-grey neutrals with a stock `#1c4fd1` blue, soft card shadows on every container, pill tabs and pill nav. It read as a starter template rather than one product. |
| Hierarchy | Page titles at 22 px, almost all interface text at 13 to 14 px. The tool title, settings headings and helper text had nearly the same weight. |
| Tool pages | Exam and KB landing pages placed specification tables, notices and disclaimers between the person and the tool. On SSC the tool started below the first screen. |
| Workspace | A "1 Add image / 2 Adjust / 3 Download" wizard strip decorated every tool. Six preset chips competed with the drop zone. As soon as an image was added every setting (units, DPI, min/max KB, format, crop ratio) opened at once. |
| Presets | A preset and the custom fields were shown together, so it was unclear whether a preset was still in use after editing. Exam pages offered four near-identical chips. |
| Results | "Ready to download" header, a green bar, a second status line and a six-cell table, all with similar weight. Size was reported in three places. |
| Secondary tools | Image to PDF kept a stale download after pages were reordered and had no rotation. Compress PDF looked like the image editor. |
| Resume | Every section and every entry was a bordered box inside a bordered editor. Numbered wizard tabs implied a checkout. 15 template cards with two-line descriptions were hard to compare. Review "Fix" opened the section, not the field at fault. |
| Reading pages | Tables and callouts were drawn as shadowed cards; guide lists were card grids. |
| Documentation | `DESIGN_SYSTEM.md` described radii, shadows and components that the CSS no longer used. |

## 2. Information architecture

ApplyReady is presented as one product with five areas. The header and footer use the same grouping.

- **Image tools**: Image resizer (home), Signature cleaner, Passport photo print. File-size targets
  (10 to 200 KB) are entry points into the resizer, listed as one compact row, not as five features.
- **PDF tools**: Image to PDF, Compress PDF.
- **Resume**: Resume builder (direct header link).
- **Exam requirements**: SSC, UPSC, IBPS, NEET, RRB (English and Hindi). Each is the resizer with that
  exam's requirements preselected, followed by the reference content.
- **Guides**: editorial articles.

Landing pages keep their URLs, titles, descriptions, canonical tags, structured data and copy. Only the
order changes: page head, then the tool, then the reference content (tables, notices, FAQ).

## 3. Design principles

1. One dominant action per state. Everything else is secondary or hidden.
2. Requirement first, parameters second. People choose "SSC photo", not "350 x 450, 20 to 50 KB".
3. Progressive disclosure. Size, limits, format, crop ratio, units, DPI and the name strip stay folded
   until asked for, or until a value needs fixing.
4. Structure with space, rules and type before boxes. One container level per region.
5. Privacy is stated once per task, calmly, where the file is handled.
6. Everything visible on a phone, in a layout designed for a phone.

## 4. Visual system (summary; full detail in DESIGN_SYSTEM.md)

- Warm neutral "paper" greys, one accent: **ApplyReady ink** (`#3a3ab0` light, `#a3a4ff` dark), used for
  the primary action, selection, links and focus only. Status colours are semantic only.
- Dark theme is designed separately: neutral near-black surfaces, light ink accent with dark text on it.
- Type: local Inter and Noto Devanagari. A 10-step scale from 12 px metadata to a 40 px product title;
  interface text 15 px, reading text 17 px, inputs 16 px on touch devices (prevents iOS zoom).
- Radii 4 / 6 / 8 / 12 px. Shadows only for menus, dialogs, toasts and resume paper.
- Control heights 32 / 40 / 48 px (40 / 44 / 48 on touch).

## 5. Interaction model

**Tool workspace** (`.ws`, generated): a document bar (file name, size, Replace / Remove, status), a stage
(drop zone, editor, result) and a settings rail with a sticky action footer. `data-state` is
`empty | ready | done`; `data-busy` marks processing. The stage keeps its size while processing; the
action shows a spinner and is disabled.

- Empty: the drop zone owns the stage. The rail shows the requirement picker. On phones the drop zone
  comes first and the disabled action is hidden.
- Ready: image editor in the stage, requirement picker and folded "Size, file limit and format" in the
  rail, one primary action with a one-line output summary.
- Done: a conclusive result: verdict line, preview with Result / Original, the facts that matter
  (file size against the limit, dimensions, format), **Download** as the strongest action and
  "Adjust again" as secondary.
- Error: an inline error at the top of the stage, and field errors under their field.

**Requirement picker**: a vertical list of toggle buttons (`button[data-preset]`, `aria-pressed`) with the
requirement name and its spec. A "Custom size" row is pressed as soon as a value is edited, so the state
is never ambiguous. The native `<select id="presetSelect">` stays in the DOM as the value store.

**Resume builder**: an app bar (title, document status, Download), a stage switcher
(Write, Style, Review, Download) that never blocks movement, an outline-style editor and a sticky paper
preview. Entries are collapsible units with quiet controls; delete is separated. Templates are a
grouped, comparable list. Review items say what, where and how, with a Fix that focuses the exact field.
Phones get Edit / Preview / Download in a bottom bar.

## 6. Affected files

- `css/app.css` rewritten. `css/document.css` unchanged (hash-locked by `tests/content_tests.js`).
- `scripts/lib/shell.js` (header, menu, footer), `scripts/lib/image-workspace.js`,
  `scripts/build-image-pages.js`, `scripts/build-tool-pages.js`; all pages regenerated with
  `node scripts/build-image-pages.js && node scripts/build-tool-pages.js && node scripts/sync-shell.js`.
- `js/site.js`, `js/components.js` (UI behaviour only).
- `js/resume.js` (editor UI: entries, template list, review targets, mobile bar), `resume.html`.
- `js/image-to-pdf.js` (page rotation, stale result fix), `js/resizer.js` (settings reveal on error only).
- Page copy files only where blocks are reordered (tool moved above the reference content).

## 7. Behavioural contracts preserved

- Every element id used by `js/*.js`; `data-preset`, `data-kb`, `data-template(-id)`, `data-action`,
  `data-idx`, `data-goto-tab`; state classes `hidden`, `active`, `is-invalid`, `dragover`, `open`.
- `.ws` + `data-ws-file / data-ws-result / data-ws-busy` drive state detection in `components.js`.
- Custom select keeps the native `<select>` as the source of truth (value, change events).
- Compression, crop maths, PDF/DOCX engines, schema migration, template output, storage keys,
  service worker, metadata, structured data, sitemap: untouched.
- Ad slots stay outside the workspace and between content sections.

## 8. Test strategy

- Behaviour suites stay as they are: `npm test` (unit, regression, content) and `npm run test:browser`
  (exports, sizes, focus, overflow at 9 widths, axe in both themes).
- Presentation-only assertions (old class names, wizard steps, chip markup) are rewritten to assert
  the new behaviour: requirement picker state, settings disclosure, result verdict, tool order.
- New regression checks: tool appears before reference content on landing pages; editing a value
  moves the picker to Custom; Image to PDF rotation and stale-result reset; resume entry collapse;
  review Fix focuses the exact field; mobile Download shortcut.
- Manual review of Playwright screenshots at 320 to 1440 px in light and dark.
