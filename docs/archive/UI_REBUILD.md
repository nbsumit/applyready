# Interface rebuild

The whole interface was replaced with one design system. The software underneath was not changed.

## What was rebuilt

| Area | Result |
|---|---|
| Design system | One stylesheet, `css/app.css`, with tokens for colour, type, space, control heights, radius, depth, layout, motion and stacking. See `DESIGN_SYSTEM.md`. |
| Shell | One header, one footer, one mobile navigation, generated into every page by `scripts/sync-shell.js`. The Tools entry is a menu on desktop and a grouped sheet on phones. |
| Controls | Custom select, range, segmented control, switch, checkbox, radio, tabs, menus, dialogs and toasts on top of semantic HTML. The confirm dialog replaces `window.confirm`. |
| Image tools | Add, Adjust, Download. The drop zone dominates until a file is chosen. After processing the result shows status, size, dimensions and a prominent Download. Advanced options are folded away. The same workspace serves the resizer, the KB pages, the exam pages and the Hindi pages. |
| Other tools | Signature cleaner, image to PDF, compress PDF and passport sheet use the same Add, Adjust, Download workspace and the same result and error patterns. |
| Resume builder | Write, Style, Review, Download. Editor and live preview side by side from 1000px, an Edit and Preview switch below that. Entries are editable objects with move, duplicate and delete. Optional sections are added on demand. A filterable template gallery with full previews. Review findings are grouped by severity with a Fix action. |
| Reading pages | Guides, about, privacy, terms, how-to, contact, 404 and offline share one reading layout. Copy and metadata are unchanged (a script verified that the visible text is identical). |

## What did not change

Image processing, resizing, compression, crop maths, PDF and Word generation, resume data, templates and output, ATS review logic, validation, presets and their values, supported formats, storage, backup and import, privacy and offline behaviour, routes, URLs, titles, descriptions, canonicals, structured data and the service worker strategy.

`js/resizer.js`, `js/pdf-engine.js`, `js/docx-engine.js`, `js/templates.js`, `js/resume-schema.js`, `js/keywords.js`, `js/presets.js`, `js/compress-pdf.js`, `js/signature-cleaner.js` and `js/passport-photo-print.js` are byte-for-byte identical. `js/image-to-pdf.js` changed class names and one ellipsis character. `js/resume.js` changed how entries, tabs, template cards and review items are drawn, not how data is stored or exported.

The resume sheet, its templates and the print layout moved unchanged into `css/document.css`. `tests/content_tests.js` holds a hash of that file.

## How it was verified

- **Resume output:** the original and the rebuilt site were compared for every template, paper size, font and density: computed style and geometry of the paginated preview, rasterised browser print output, and the PDF, Word and text downloads (hashed). 43 comparisons, 0 differences.
- **Image output:** the same script drove both sites through presets, units, DPI, aspect lock, crop ratios, rotate, zoom, reset, retry, formats, size limits, original size, annotations, drag and drop and invalid files. The 39 value and output records (field values, output dimensions, MIME types, byte counts and content hashes, status text, limits and error messages) are identical. The other 15 are crop readings, which differ only in the on-screen size of the crop box and by at most 1 px in the source rectangle, because the layout is different. `tests/image_workflow_tests.js` keeps that record as a regression test.
- **Resume editing:** `tests/resume_flow_tests.js` edits a resume through the real UI, reads the exports back (text, Word, PDF) and round-trips a backup.
- **Accessibility:** axe finds no violations on any of the 53 pages, in light and dark, and in result states. Keyboard, focus, dialog and menu behaviour are tested. Field edges meet 3:1, text meets WCAG AA, text is never under 12px, and touch targets are 40px or more on touch screens.
- **Layout:** no horizontal overflow on any page at 320, 360, 375, 390, 430, 768, 1024, 1280 and 1440.
- **Browsers:** Chromium (the engine behind Chrome and Edge) runs every suite. Firefox runs the UI and smoke suites. Microsoft Edge itself and physical devices were not available.

## Rules for future work

See "Rules that prevent regressions" in `DESIGN_SYSTEM.md`. In short: change tokens, not literals; no card in a card; no inline styles; no em dash; keep ids and state classes that the scripts read; run `node scripts/sync-shell.js --check` and `npm test`.
