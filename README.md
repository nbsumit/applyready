# ApplyReady.in

> **100% Client-Side Image Resizer, Strict Compressor and ATS Resume Builder**

ApplyReady is a fast, responsive, and privacy-first web utility suite built for professionals, job applicants, and students. It provides two essential in-browser tools:

1. **Image Resizer and Strict Compressor**: Crop to exact pixel dimensions, resize without distortion, lock aspect ratios, preserve transparency in PNG and WebP, compare before and after results, and compress strictly under target file sizes (20KB, 50KB, 100KB, custom).
2. **Single-Column ATS-Friendly Resume Builder**: Build clean, standard resumes across 8 distinct ATS templates with real-time preview, local draft persistence, JSON backup, transparent diagnostic review, and instant client-side exports to Vector PDF, editable DOCX, and formatted Plain Text.

**Zero Server Uploads**: 100% of processing runs directly in your browser on your device using HTML5 Canvas, modern JavaScript, and direct client-side document generators. No photos, signatures, or resumes are ever transmitted to an external server.

---

## Key Features

### 1. General-Purpose Image Resizer and Compressor
- **Standard Presets and Custom Control**:
  - `Custom Dimensions`: Enter any width, height, and target KB limit with immediate input validation and aspect-ratio locking.
  - `Profile / Avatar`: 400 x 400 px, max 100 KB.
  - `ID / Passport Photo`: 350 x 450 px, max 50 KB.
  - `Signature / Stamp`: 300 x 100 px, max 30 KB.
  - `Social / Web Card`: 1200 x 630 px, max 300 KB.
  - `Document Scan`: 800 x 1000 px, max 200 KB.
- **Aspect-Ratio Lock and File Replacement**: Lock aspect ratio while entering custom dimensions to prevent distortion; swap source files in one click with the Replace action.
- **Before and After Visual Comparison**: Toggle between original source and processed output with real-time file size indicators.
- **Multiple Formats and Transparency**: Supports JPEG, PNG, and WebP. Transparent backgrounds are preserved in PNG and WebP, with configurable background fill (White / Black) when converting to JPEG.
- **Strict Byte-Level Verification**: Compression uses adaptive quality quantization. Never reports false success if an image remains oversized, and verifies output dimensions, MIME type, and exact byte size prior to download.
- **Distortion-Free Annotations**: Optional name and date strip for official identification. Automatically matches crop aspect ratio to the photo area above the strip, eliminating vertical stretching. Dynamically scales long and Unicode names.
- **Interactive Cropper**: Touch-friendly zoom, rotation (+90 / -90 degrees), and aspect ratio locking (Target, Original, 1:1, 4:3, 16:9, Free).

### 2. Single-Column ATS-Friendly Resume Builder
- **8 Distinct ATS Templates**:
  - `Classic Professional`: Broad corporate applications, restrained serif typography, clear section rules.
  - `Modern Minimal`: Clean sans-serif typography, open spacing, clear hierarchy.
  - `Graduate / Early Career`: Prominent education, internships, and projects.
  - `Experienced Professional`: Experience and achievements prominent, multi-page layout.
  - `Project Focused`: Projects and case studies prominent, readable links.
  - `Career Transition`: Summary and relevant skills above work chronology.
  - `Compact Professional`: Shorter resumes with dense, readable content.
  - `Academic / Research CV`: Optional research, publications, teaching, and presentations for longer CVs.
- **Accessible Template Gallery**: Full preview modal with demonstration data and focus management before applying templates.
- **Multi-Format Document Exports**:
  - `Vector PDF`: Selectable, searchable text, standard fonts (Times and Helvetica), clickable hyperlinks, and deliberate pagination (A4 and US Letter). Text outside WinAnsi uses the browser's **Save as PDF** dialog to preserve the characters.
  - `Editable DOCX`: Pure client-side Open Packaging Conventions (OPC) OOXML document generator with template-specific margins and heading alignments.
  - `Plain Text (.txt)`: Clean formatted text for application form text-areas.
- **Transparent Review Panel**: Real diagnostic checks evaluating contact completeness, role clarity, action verbs, quantifiable metrics, and bullet balance. Zero fake ATS scores or arbitrary percentages.
- **Structured 3-Tab Editor**: Content editing, Design & Templates, and Review & Export tabs with bounded undo/redo (up to 30 states) and focus restoration.
- **Draft Persistence and JSON Backup**: Local device saving (`localStorage`) with deletion controls and versioned JSON backup and restore with schema migration.

### 3. Responsive Design and Accessible Themes
- **Light and Dark Themes**: System-driven with manual toggle, persisted in local storage with zero theme flash.
- **Accessibility**: High-contrast themes, visible focus, keyboard controls, and automated WCAG accessibility checks. Physical-device and assistive-technology testing remain useful.
- **Mobile First**: Clean split view on desktop and dedicated Edit / Preview tab navigation on mobile screens.

---

## Architecture and Tech Stack

- **Markup and Styling**: Semantic HTML5, CSS custom properties, responsive media queries, and print stylesheets.
- **Client-Side Logic**: Pure Vanilla JavaScript (ES6+). Zero backend server or database required.
- **Vector PDF Engine (`js/pdf-engine.js`)**: Standalone, zero-dependency PDF 1.4 stream builder.
- **DOCX Engine (`js/docx-engine.js`)**: Pure client-side Open Packaging Conventions OOXML generator.
- **Template Catalogue (`js/templates.js`)**: Reusable configuration, metadata, and SVG previews for 8 ATS templates.
- **Image Manipulation (`js/resizer.js`)**: HTML5 Canvas 2D context and Cropper.js for touch manipulation.
- **Deployment**: Static hosting on GitHub Pages with custom domain `applyready.in` and HTTPS via Cloudflare/GitHub.

---

## Repository Structure

```
/
|-- index.html          # Image Resizer and Compressor
|-- resume.html         # ATS-Friendly Resume Builder
|-- 404.html            # Custom 404 Error Page
|-- about.html          # About ApplyReady and Technical Overview
|-- privacy.html        # Comprehensive Client-Side Privacy Policy
|-- how-to-use.html     # User Documentation and Step-by-Step Guides
|-- robots.txt          # Crawler Directives and Sitemap Reference
|-- sitemap.xml         # Canonical Public URL Index
|-- CNAME               # Custom Domain: applyready.in
|-- css/
|   `-- style.css       # Design system, light/dark themes, print styles
|-- js/
|   |-- resizer.js      # Image cropping, canvas scaling and strict compression
|   |-- resume.js       # Form state, live preview and draft management
|   |-- templates.js    # 8 ATS templates configuration and SVG thumbnails
|   |-- pdf-engine.js   # Client-side vector text PDF generator
|   `-- docx-engine.js  # Pure client-side OOXML DOCX document generator
|-- favicon/            # Brand favicons, touch icons, and webmanifest
|-- assets/             # Brand vector SVG assets
|-- guides/             # In-depth workflow optimization guides
|-- docs/
|   |-- PRODUCT_UPGRADE.md  # Architectural specification and upgrade details
|   |-- UX_TASK_TESTS.md    # End-to-end task tests and verification records
|   `-- SEO_SETUP.md        # Google Search Console, Bing and IndexNow setup
`-- tests/
    `-- run_tests.js    # Comprehensive Node.js regression suite (382 tests)
```

---

## Testing and Verification

A comprehensive test suite is included in `tests/run_tests.js` covering 14 test suites and 382 assertions:
- Vector PDF stream generation, valid PDF 1.4 headers, trailers, xref tables, and text streams.
- Client-side DOCX Open Packaging Conventions structure and styles.
- 8 distinct resume templates configuration and rendering parity.
- JSON backup schema validation, v1 to v2 migration, and draft resilience.
- Transparent review engine diagnostic checks.
- Image resizer dimension validation, aspect-ratio lock, and strict byte-size enforcement.
- Strict prohibition of support popups, modals, nags, and timed overlays across all files.
- Sitemap XML validity, canonical link consistency, and robots.txt rules.
- Responsive styling, focus preservation, and WCAG AA color contrast ratios.

For the workspace changes and current verification workflow, see [docs/WORKSPACE_REFRESH.md](docs/WORKSPACE_REFRESH.md). The additional behavior and browser suites validate actual exports, draft recovery, responsive layouts, and accessibility.

Run the complete checks with `npm ci`, `npm test`, `npx playwright install chromium`, and `npm run test:browser`. Browser verification requires Poppler (`pdftotext`, `pdfinfo`) and `unzip`; CI installs these and retains screenshots and exported documents. This includes 32 long PDF cases across all templates, paper sizes, and font families.

To run the original verification suite:
```bash
node tests/run_tests.js
```

---

## Support
ApplyReady is free, private, and open-source. If it helped you with your documents, consider buying a chai:
[https://razorpay.me/@nbsumit](https://razorpay.me/@nbsumit)
