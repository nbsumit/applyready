# ApplyReady workspace refresh

The tools keep the existing static, client-only architecture and public URLs. No account or server upload is required.

## Product changes

- A consistent navigation, compact tool controls, clearer empty states, and a larger crop workspace.
- Shared light/dark themes, responsive mobile navigation, visible focus, and keyboard-operated tab lists.
- Branding uses the owner's existing `favicon/` artwork throughout the site.
- Eight resume templates remain available. Draft, backup, and writing options are secondary to the contact form.
- Voluntary Support links appear only in navigation and the footer. Exports have no support dialogs or interruptions.
- The cropper, icons, and font are served locally. Third-party asset outages cannot prevent ordinary editing.

## Correctness changes

- Image-setting revisions invalidate downloads and cancel pending results. A canceled task leaves a usable process button.
- Corrupt images and unavailable decoders never become processable. Intermediate crop canvases have bounded dimensions.
- JPEG/WebP quality is searched for the highest quality that actually meets the requested byte limit. Oversized PNG output is rejected honestly. PNG/WebP retain transparency by default.
- One resume renderer covers the live document and template previews, including volunteering, languages, publications, teaching, presentations, and grants. It follows the saved section order and visibility.
- Recommended orders are completed with every remaining section, preventing optional content from disappearing during export.
- Backup validation checks field types and collection limits. Migration creates safe, unique IDs, retains legacy text entries, and normalizes design settings. Invalid imports preserve the open document.
- Typing can be undone/redone. Restored design controls, template badges, and paper sizes agree with the saved draft.
- PDF/Word body sizes are 11 pt standard, 12 pt comfortable, and 10 pt compact. Long headers, roles, project links, contacts and optional text wrap instead of clipping. Normal, bold and italic PDF wrapping use their actual standard-font advances. The page count comes from the PDF layout engine.
- The direct PDF renderer uses standard WinAnsi fonts. Unsupported characters trigger browser printing rather than silent deletion or transliteration. Choose **Save as PDF** in that dialog. Word and plain-text exports also retain Unicode.
- Template dialogs contain focus, make the background inert, fit narrow screens, and restore their trigger on close. Review links reveal the corresponding accordion.

## Verification

Run `npm ci`, `npm test`, `npx playwright install chromium`, and `npm run test:browser`. Browser checks also require `pdftotext`, `pdfinfo` (Poppler), and `unzip`. On Debian/Ubuntu install `poppler-utils unzip`.

`test-results/` contains screenshots, accessibility findings, and real exported files. It is ignored by Git. CI runs the checks on pushes to `main` and retains these artifacts.

The browser suite uses synthetic data. It checks mobile/desktop layouts and both themes, actual image dimensions/bytes/transparency, corrupted files, canceled encoding, draft recovery, malformed backups, template preservation, PDF text extraction, Word archive validity, Unicode browser PDF, keyboard focus, deep 404 routes, and external requests. It also extracts text and glyph bounds from 32 long resumes across all templates, both paper sizes, and both font families. It does not certify compatibility with every employer's ATS or replace testing on physical devices.
