# ApplyReady UI/UX final audit

Date: 2026-10-11. Audited commit: `be738fe` (the same code that is live on applyready.in; `ui.css?v=20261013-1` is served).

## How this was audited

- **History:** all UI commits since `d796a63` (the last version before the UI work started). I checked out `d796a63`, `b85d22e`, `3191708`, `822c1d3` and `be738fe` side by side and took the same screenshots of each (home before and after upload, resume builder with the sample) at 1440 and 390.
- **Pages:** all 53 public pages (23 root, 25 guides plus the guides index, 5 Hindi) were scanned at 320, 360, 390, 430, 768, 1024, 1280 and 1440. The scan covered overflow, text size, target size, native controls, field font size on phones, controls touching the screen edge, and the font sizes, radii, shadows and control heights in use.
- **Real files:** a 2400 × 3000 photo (577.9 KB), a 900 × 300 signature PNG, a two-page scanned PDF (206.5 KB), a 1200 × 1600 document PNG, a corrupt JPEG, a text file renamed as a PDF, and a malformed resume backup.
- **States:**
  - Image workflow: before upload, after upload, open dropdown, validation error, processing, result, and advanced settings open.
  - Resume builder: blank, sample, an expanded section with entries, the template gallery, the template preview dialog, review with errors, review clean, and the mobile preview.
  - Other tools: compress, image to PDF, passport sheet and signature cleaner, each before upload, after upload and with a result.
  - Other pages: an exam page, a KB page, a Hindi page, the guides index, a guide, About, 404, the mobile menu, the Tools menu, error notices and a failed import.
- **Browsers:** Chromium (the build Playwright ships) and Firefox 153 for the audit. Google Chrome 155 and Microsoft Edge 155 were then unpacked from the official packages so the test phase runs in all three browsers.
- **Existing suites, all passing at the start:**
  - `npm test`: 48 behaviour checks and 3,864 content assertions.
  - `npm run test:browser`: 2,968, 1,532 and 20 assertions.
  - `npm run test:firefox`: 1,535 and 20 assertions.

What the automated scan found: no horizontal overflow at any width, no native `<select>` visible anywhere, every phone field at 16 px, and no control touching the screen edge. The problems are in hierarchy, clarity and consistency, not in broken layout.

## Root cause

Five stylesheets now style the same components, and each recent pass added a layer instead of replacing one:

| File | Lines | Added by | `!important` |
|---|---|---|---|
| `css/style.css` | 2143 | original site (base, tools, resume sheet, print) | 45 |
| `css/workspace.css` | 491 | first redesign (tokens, fonts, layouts) | 53 |
| `css/design-system.css` | 591 | "UI/UX upgrade (#8)" `4ce4c4c` (a second token set and BEM components, mostly unused) | 3 |
| `css/ux.css` | 1419 | `589f727`, `0ebae77`, Astra `ee4d153`..`3836a90` | 37 |
| `css/ui.css` | 597 | Figma pass `be738fe` | 8 |

On top of that, the HTML carries 1,315 inline `style` attributes, 177 of which set `font-size`. Because of this, the main area of the pages uses 20 different font sizes at 1440 px (12, 12.5, 13, 13.1, 13.2, 13.6, 14, 14.4, 14.7, 15, 15.2, 16, 16.8, 17.6, 18.4, 19.5, 20, 21.6, 24 and 28 px). Each fix in one layer is undone or contradicted by another. One example: `design-system.css` still paints the signature-cleaner slider thumb blue until a later layer overrides it.

## Recent changes that made things worse

| Change | What got worse | Evidence |
|---|---|---|
| `be738fe` Figma pass: filled grey fields with a transparent border | Field edges disappear wherever a field sits on a grey surface: resume entries, the advanced settings box, the file bar. Fill against white is about 1.07:1, so the boundary has no usable contrast (WCAG 1.4.11). | Resume work-experience entries at 1440 and 390; "Printed date" box |
| `be738fe` grey placeholders on grey fills | An empty resume field looks filled: `alex.morgan@email.com`, `+1 (555) 234-5678` and `linkedin.com/in/alexmorgan` read as answers. | Blank resume at 1440 and 390 |
| `be738fe` 13 px fields, 12 px grey labels (`--text-muted`, weight 500) | Labels became the quietest text on the screen, and form scanning got slower. 12 px is now the most common text size in the tools (755 elements across the pages scanned). | Font-size histogram; Output settings |
| `be738fe` panel titles at 13 px next to a 24 px page title | The hierarchy collapsed to "big title, then everything small". "Output settings" has the same weight as a field label. | Home and tool pages at 1440 |
| `be738fe` another override file with an `!important` icon rule | Fixed icons, but added a fifth layer. The real problem (competing files) grew. | Table above |
| Astra `ee4d153`: hid `#presetSummaryBox` ("no repeated summary") | Nothing near the action says what you will get. On phones the settings sit below the "Resize & compress" button, so a first-time user can press it and get the default 350 × 350, 50 KB result without having seen it. | Home at 390 after upload |
| `4ce4c4c` design-system.css | It added a second token set (`--color-*`, `--space-*`) used by nothing outside the file, plus components that leak, such as the blue slider. | grep of token use |

Some recent changes are worth keeping:
- The custom select (portal list, keyboard, flip and clamp).
- `display: contents` ordering on the embedded exam tool.
- The process button moved under the crop area.
- The grouped resume review.
- Errors shown in the page instead of `alert()`.
- The five-step icon scale.
- The 16 px phone fields.
- The guard tests.

## Findings

Severity: **P0** broken, **P1** major usability, **P2** meaningful friction, **P3** inconsistency, **P4** polish.

### P0: broken

None. Every workflow completed with real files in Chromium and Firefox. The test suites pass, and resume print output matches the earlier version pixel for pixel.

### P1: major usability

| ID | Where | Problem |
|---|---|---|
| P1-1 | Passport sheet, signature cleaner, phones and 768 | After upload the preview and the Download button sit 968 px and 1,107 px below the top of the screen. The screen stays on the settings, so the user cannot see that anything happened or where the result is. |
| P1-2 | Compress PDF | When the target cannot be reached (a 20 KB target gave 70.2 KB), the result shows the size in green with "66% Saved" and never says the target was missed. The user uploads a file the portal will reject. |
| P1-3 | Home and embedded tools, all widths | When a dimension or size value is invalid, "Resize & compress" is disabled, but the message sits under the KB fields, not under the field at fault. The field gets `is-invalid`, but the red border never shows because the filled-field rule in `ui.css` (`input[type="number"].form-control`) out-ranks `.form-control.is-invalid`. On a phone the message is off screen, so the button is dead with no visible reason. |
| P1-4 | Resume entries, advanced image settings | Fields have no visible edge on grey surfaces (see the table above). Users cannot see where to click. |
| P1-5 | Resume contact fields | Example values without an "e.g." prefix look like real data in empty fields. |

### P2: meaningful friction

| ID | Where | Problem |
|---|---|---|
| P2-1 | Home and embedded tools | No one-line summary of the output (size, limit, format) next to the main action. |
| P2-2 | All tools | Body and field text at 13 px and labels at 12 px grey are too small and faint for long forms on ordinary laptop screens. |
| P2-3 | Tool pages on phones | The page header (title over 3 lines at 24 px plus a 5-line intro) takes 330 to 360 px before the tool starts. |
| P2-4 | Home result | Six equal stat boxes ("47,844 bytes (46.72 KB, 1 KB = 1024 B)", "350 × 350 px (Measured)" and others) compete with Download. The one fact that matters, "under 50 KB", is a sentence in a green box. |
| P2-5 | Resume entries on phones | Duration and Location share a row at 390 px, which cuts "Jun 2019 - Dec 2021" to "Jun 2019 - Dec". |
| P2-6 | Resume builder | The tabs read Content / Design / Download, but the third tab opens with checks. The mental model is Write, Style, Review, Download. |
| P2-7 | Home at 768 | The settings drop below the workspace, and the screen after upload shows no settings. |
| P2-8 | Image to PDF | Before upload there are two empty states (the dropzone and "No images uploaded yet"). After upload the large dropzone stays above the page list. |
| P2-9 | Resume entries | Each entry is a grey card inside a section card inside the tab panel: three nested boxes. |

### P3: inconsistency

| ID | Where | Problem |
|---|---|---|
| P3-1 | Site-wide | 20 font sizes in the main area (see Root cause). |
| P3-2 | Site-wide | Five stylesheets with overlapping rules, two token sets, and 1,315 inline styles. |
| P3-3 | Results | Home result labels are sentence case, while the compress, PDF, passport and signature results use uppercase small labels ("ORIGINAL SIZE"). |
| P3-4 | Labels | "Printed Date:" and "Background Fill:" have colons; every other label does not. "(Optional)" and "(optional)" both appear. |
| P3-5 | Advanced image settings | A grey box inside a disclosure inside a card, and the "Today" button is a different height from its field. |
| P3-6 | Rotate and zoom toolbar | A grey box around five buttons; on phones the two zoom buttons wrap to a second row of half-width buttons. |
| P3-7 | Template gallery | 15 cards, each with two full-width outline buttons ("Preview", "Use") that look the same. |
| P3-8 | Signature cleaner at 390 | "Live Preview" breaks over two lines beside the segmented control. |
| P3-9 | Exam and KB content | Tables, callouts and notes set their own font size, padding and colours inline, so each page looks slightly different. |

### P4: polish

| ID | Where | Problem |
|---|---|---|
| P4-1 | Mobile menu | The panel has no bottom edge, and page content shows under it cut mid-line. |
| P4-2 | Quick start bar at 1024 | The last chip is cut off with no sign that the bar scrolls. |
| P4-3 | Checkboxes | 18 px boxes. The labels are clickable, so the real target is larger, but the box itself is small on phones. |
| P4-4 | "Use original size" | Shown disabled before upload with no hint why. |

## What a first-time user experiences today

1. **Home on a laptop:** the upload area is clear and the action is obvious. After upload the crop and "Resize & compress" are visible, but the settings that decide the result are in small grey text to the side.
2. **Home on a phone:** after upload the user sees the crop and "Resize & compress". If they press it without scrolling, they get whatever the default was, and the result screen does not say what was asked for, only what was produced.
3. **Passport sheet or signature cleaner on a phone:** after upload nothing visibly changes on screen. The result is a long scroll away.
4. **Compress PDF:** a missed target looks like a success.
5. **Resume builder:** the blank form looks half filled. Inside the sections, the fields of each entry are hard to see.
