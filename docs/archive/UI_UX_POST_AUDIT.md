# ApplyReady UI/UX Post-Audit

Date: 2026-10-11
Compared against `docs/UI_UX_AUDIT.md` after the hierarchy pass.
Method: same pages, 320 / 390 / 768 / 1440, upload and process, overflow check. Browser suite had already passed 2968 assertions before this pass.

## What improved

- Homepage: the image workspace leads. Settings are a side panel, not a competing form.
- 768px: the tool stacks. The cramped two-column layout is gone.
- After process on a phone: Download sits under the preview (about 655px in an 844px viewport). Stats follow the action.
- Preset chips on small screens scroll in one row. Labels are not cut off.
- Passport, signature, image-to-PDF, and compress use the same lead-with-the-task layout.
- Exam and KB pages have a "Resize now" jump to the tool. Hindi uses "अभी रिसाइज करें".
- Current page is marked with `aria-current="page"` in the nav, Tools menu, and footer.
- Advanced options are a disclosure, not a card inside a card.
- Template selected state uses an inset primary ring.
- No page-level horizontal overflow at 320, 375, 390, 430, 768, 1024, 1280, 1440 on the major pages.

## Remaining issues

### P0
None.

### P1
None that still block a task.

### P2
1. Homepage settings panel is still dense (width, height, unit, min, max, format, crop). It is secondary now, which is the right rank. Collapsing it further would hide features people need after upload. Left as is.
2. Exam and KB pages still open on the spec table. The jump link is the fix. Moving the tool above the spec would fight the reason those pages rank. Left as is.

### P3
1. Privacy is still said in the trust chips and the assurance box. Both are short. Removing one would delete trust copy. Left as is.
2. Resume still has a hero "Review & download" and a Download tab. Both are real actions. Left as is.
3. Guide pages still sit in a card. Readable. Not worth a structural rewrite.

### P4
1. Brand logo is under 44px. Enlarging it crowds 320px. Left as is.
2. Date popup is still the operating system picker. Correct.

## Fixes applied from this pass

- "Resize now" is a real action (border, height, hover), not body text.

## Intentionally unchanged

- Algorithms, presets, exports, resume document CSS, print `@page`, SEO metadata, URLs.
- Native date picker.
- Ad slots.
