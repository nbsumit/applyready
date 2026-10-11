# ApplyReady UI/UX Fix Plan

Follows `docs/UI_UX_AUDIT.md`. Implementation is presentation only.

## Principles

- One system, not another skin.
- Hierarchy over decoration.
- Progressive disclosure without removing a feature.
- Native semantics stay. Custom appearance only.
- Do not touch processing, exports, presets, SEO, or the resume document.

## Workstream 1 | Tokens

Problems: four stylesheets, mixed space, radius, focus.
Files: `css/ux.css` (winning chrome layer). Do not rewrite `style.css` print rules.
Result: one space scale, one radius, one control height (44px), one focus ring, one motion timing.
Risk: low if scoped to chrome and `@media screen`.
Test: light/dark, no print regression.

## Workstream 2 | Typography

Problems: H1 competes with the tool. Helper text is tiny. Too many sizes.
Files: `css/ux.css`.
Result: H1 stays the page title but does not overpower the action. Labels 13px, body 16px on inputs, helpers readable, result values stronger than labels.
Risk: low.
Test: 320 and 1440, Hindi page still uses Devanagari.

## Workstream 3 | Shared inputs

Problems: custom select works; date/range/checkbox exist; a few states are uneven.
Files: `css/ux.css`, `js/components.js` only if a state class is missing.
Result: every closed control is 44px, same radius, same focus. Invalid state on the custom select button. Range thumb 24px. No new widget library.
Risk: medium. Native `<select>` must stay in the DOM for `selectOption` and change handlers. Do not put `aria-activedescendant` on the button.
Test: preset, format, unit, resume page size and font, keyboard on the listbox.

## Workstream 4 | Buttons and actions

Problems: several primaries, download not dominant, hover-lift.
Files: `css/ux.css`.
Result: one primary per context. Download is the success action. Destructive stays outline. No hover-lift. `cursor: pointer` on controls.
Risk: low.
Test: disabled, hover, focus, 44px targets.

## Workstream 5 | Navigation

Problems: current page unmarked. Mobile Tools list is long.
Files: `js/components.js`, `css/ux.css`.
Result: `aria-current="page"` on the matching link. Mobile Tools groups stay, with clearer group labels. Do not add a second menu listener (`site.js` owns it).
Risk: low.
Test: 390 menu open, Tools open, Escape, current page on `/`, `/resume.html`, an exam page.

## Workstream 6 | Image workflow

Problems: settings compete; download below fold on mobile; steps are decorative; presets truncate; 768px cramped.
Files: `css/ux.css`. Optional one jump link on exam/KB pages.
Result:
- Before image: upload leads, settings are quieter (`:has(#fileInfoBox.hidden)`).
- After image: workspace leads.
- After result: action group directly under the preview (CSS order). Stats remain below.
- Preset bar is one scrolling row under 640px.
- Resizer stacks through 960px.
- Steps get a clearer active state.
Risk: medium on the 960px stack. Resume layout must stay as it is.
Test: upload, preset, process, download, 390 and 768 and 1440.

## Workstream 7 | Resume builder

Problems: quiet selected template, two download doors, long mobile form.
Files: `css/ux.css` only. Do not edit `resume.js`, template CSS, or export engines.
Result: selected template card is obvious. Download tab and hero button stay (both are real actions). Editor sections stay grouped. No document restyle.
Risk: high if print or `.ats-resume-sheet` is touched. Do not touch them.
Test: sample, edit, preview, PDF/Word/text, sticky name field, 390 preview.

## Workstream 8 | Other tools

Problems: passport and image-to-PDF are settings walls. Signature is better. Compress is the model.
Files: `css/ux.css`.
Result: upload/dropzone is the visual lead on every tool. Secondary controls stay, at lower contrast and tighter grouping. No feature removed.
Risk: low.
Test: each tool empty state, then a real file through to the disabled/enabled action.

## Workstream 9 | Responsive

Problems: 760px cutoff, 320px truncation, edges.
Files: `css/ux.css`.
Result: stack tool layouts to 960px. 16px page padding minimum. No page-level horizontal scroll. Preset row scrolls inside itself.
Risk: medium.
Test: 320, 360, 375, 390, 430, 768, 1024, 1280, 1440.

## Workstream 10 | Accessibility

Problems: logo target, focus defined three ways, muted contrast.
Files: `css/ux.css`.
Result: single focus ring. Muted text darkened slightly if contrast is under 4.5:1. Interactive rows at least 40px where we control them. Do not shrink `scroll-padding-top`.
Risk: low.
Test: axe on home, resume, one exam, one tool. Keyboard through a select.

## Workstream 11 | Polish

Problems: card-in-card, repeated privacy, template eyebrows.
Files: `css/ux.css`.
Result: advanced disclosure is a separator, not a second card. Trust chips stay but do not shout. No new illustrations, gradients, or cards.
Risk: low.
Test: visual pass, light and dark.

## Out of scope

- Changing preset values, compression, crop math, exports, SEO, metadata, URLs.
- Replacing the date popup.
- Adding a framework or a new library.
- Restyling the generated resume.

## Order of work

1. Tokens and controls in `ux.css`.
2. Homepage hierarchy and result order.
3. Responsive stack and preset row.
4. Other tools and content pages.
5. Nav current page.
6. Cache bump.
7. Test.
8. Second audit.
9. Fix what the second audit finds.
10. Final tests, then merge.
