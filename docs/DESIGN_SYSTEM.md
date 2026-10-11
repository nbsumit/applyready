# ApplyReady Design System

## Overview
Polished, modern, Figma-quality design system for ApplyReady.in. Built for Indian job/exam applicants on mid-range Android phones and slow networks. Light theme required; dark theme via `prefers-color-scheme` + localStorage toggle (no flash). Self-hosted Inter + Noto Sans Devanagari. WCAG AA contrast. All tools 100% client-side.

## Tokens (`css/design-system.css`)

### Colour
| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--color-primary` | #2563eb | #3b82f6 | Primary actions |
| `--color-surface` | #ffffff | #0f172a | Cards, inputs |
| `--color-text` | #0f172a | #e2e8f0 | Body text |
| `--color-text-muted` | #475569 | #94a3b8 | Secondary text |
| `--color-border` | #e2e8f0 | #334155 | Borders |
| `--color-success` | #047857 | #34d399 | Success / within target |
| `--color-warning` | #b45309 | #fbbf24 | Warnings |
| `--color-error` | #b91c1c | #f87171 | Errors / out of range |

### Spacing (4/8px scale)
`--space-1` (4px) through `--space-16` (64px).

### Radius
`--radius-sm` 6px, `--radius-md` 10px, `--radius-lg` 14px, `--radius-full` 9999px.

### Shadows
`--shadow-sm`, `--shadow-md`, `--shadow-lg`, `--shadow-focus`.

### Typography
`--font-sans`: Inter. `--font-devanagari`: Noto Sans Devanagari. Scale: xs 0.75rem → 4xl 2.25rem.

### Motion
`--duration-fast` 120ms, `--duration-normal` 200ms, `--duration-slow` 320ms. Easing: `--ease-out`. Respects `prefers-reduced-motion`.

### Z-index
`--z-dropdown` 40, `--z-sticky` 50, `--z-modal` 60, `--z-toast` 70, `--z-tooltip` 80.

## Components
All built on native elements. Custom visual styling. Keyboard, screen readers, and mobile keyboards preserved.

- **Buttons**: `.btn .btn--primary | secondary | ghost | danger | icon`. Loading, disabled, pressed states. Min 44×44px touch targets.
- **Inputs**: `.field`, `.input`, suffixes (KB, px, cm), steppers, helper/error text, inline validation.
- **Custom select**: Accessible listbox pattern (arrow keys, type-ahead, Esc). Class `custom-select-source` on native `<select>`. Falls back to native on touch if preferred.
- **Checkbox / radio / toggle / segmented**: Custom visuals, native inputs underneath.
- **Range slider**: Value bubble.
- **Dropzone**: Drag & drop, click, paste, preview, validation.
- **Cards, accordion, modal (`<dialog>`), toast, progress, skeleton, badges, steps, result panel**.
- **Before/after result**: Dimensions, file size, % saved, "within target ✓ / out of range" status, prominent Download.

## Usage
Link `css/design-system.css` (imported by `style.css`) and `js/components.js` on every page. Theme set by `js/theme.js` before paint. Theme toggle in header. Language switch EN / हिन्दी.

## Accessibility
Visible focus rings, ARIA, keyboard support, 44px targets, reduced motion, contrast AA.

## Performance
No render-blocking bloat. New CSS/JS added to service worker precache (`applyready-v5`).
