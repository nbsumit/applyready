# Professional workspace refresh

The image and resume tools use a shared neutral palette, restrained green accent, readable controls and compact page headers. Decorative empty-state artwork has been removed. All processing remains local to the visitor's browser.

## Image workflow

- Desktop shows output settings beside a central upload/crop/result workspace.
- Mobile puts the upload workspace first, with a link from the active crop to output settings.
- Quick photo, signature, profile and document presets update the actual controls. Preset values remain editable and editing them switches the selection to custom.
- Custom dimensions preserve the current aspect ratio when switching away from a preset. Oversized proportional dimensions produce a validation error instead of a silently distorted result.
- Use original size restores the full source crop, original dimensions and orientation, and removes the optional name/date strip. It retains the chosen file size limit and validates the output memory limits.
- A locally generated, clearly labelled sample document can exercise the complete tool without personal files or external requests.
- The crop workspace accepts replacement files by drag and drop. Status text reflects loading, editing, processing, errors and completed output.

## Resume workflow

The editor retains eight templates, draft consent, backup and restore, undo/redo and PDF/Word/text exports. Fit-to-width now measures the preview container's actual padding instead of assuming a fixed value, so responsive layout changes cannot clip the paper.

## Verification

`npm test` runs the existing 382 assertions and 26 behavior regression checks. `npm run test:browser` exercises both themes at 320, 360, 390, 768, 1024, 1366, 1440 and 1920 pixel widths, accessibility, real exported documents, image byte limits, transparency, cancellation, corrupt files, preset editing and full-image compression. GitHub Actions runs these checks on main and retains test artifacts.

Presets are generic starting points, not an authority's certified application requirements. Unsupported direct-PDF characters continue to use browser printing to preserve text. No automated suite guarantees that every possible device, file or third-party application form will behave identically.
