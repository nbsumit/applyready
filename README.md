# ApplyReady.in

> **100% Client-Side Image Resizer, Strict Compressor and ATS Resume Builder**

ApplyReady is a fast, responsive, and privacy-first web utility suite built for professionals, job applicants, and students. It provides two essential in-browser tools:

1. **Image Resizer and Strict Compressor**: Crop to exact pixel dimensions, resize without distortion, lock aspect ratios, preserve transparency in PNG and WebP, compare before and after results, and compress strictly under target file sizes (20KB, 50KB, 100KB, custom).
2. **Single-Column ATS-Friendly Resume Builder**: Build clean, standard resumes across 15 ATS-friendly templates with real-time preview, local draft persistence, JSON backup, transparent diagnostic review, and instant client-side exports to Vector PDF, editable DOCX, and formatted Plain Text.

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
- **Editable Quick Presets**: Start with a photo, signature, profile or document preset, then edit any dimension or size limit. Switching to custom keeps the current proportions.
- **Original-Size Compression**: Select the full image at its original dimensions, reset rotation and remove the text strip with one button. Output limits are still validated before processing.
- **Local Sample Document**: Try the complete workflow without providing a personal file. The demonstration image is generated in the browser.
- **Before and After Visual Comparison**: Toggle between original source and processed output with real-time file size indicators.
- **Multiple Formats and Transparency**: Supports JPEG, PNG, and WebP. Transparent backgrounds are preserved in PNG and WebP, with configurable background fill (White / Black) when converting to JPEG.
- **Strict Byte-Level Verification**: Compression uses adaptive quality quantization. Never reports false success if an image remains oversized, and verifies output dimensions, MIME type, and exact byte size prior to download.
- **Distortion-Free Annotations**: Optional name and date strip for official identification. Automatically matches crop aspect ratio to the photo area above the strip, eliminating vertical stretching. Dynamically scales long and Unicode names.
- **Interactive Cropper**: Touch-friendly zoom, rotation (+90 / -90 degrees), and aspect ratio locking (Target, Original, 1:1, 4:3, 16:9, Free).

### 2. Single-Column ATS-Friendly Resume Builder
- **15 ATS-Friendly Templates** (all single-column, standard fonts, real selectable text), filterable by audience:
  - *General*: `Classic Professional` (serif, centred, default), `Modern Minimal`, `Compact Professional`, `Career Transition` (skills before history), and `ATS Plain (Maximum Compatibility)` (no lines, no colour, dates on their own line for older portals, government and bank job sites).
  - *Students & freshers*: `Campus Placement / Fresher` (education with CGPA first, projects, internships, certifications, positions of responsibility), `Graduate / Early Career`, and `Ivy Classic` (university career-office format).
  - *Tech*: `Software Engineer` (technical skills under the summary) and `Project Focused`.
  - *Senior & executive*: `Executive Impact` (selected achievements before experience) and `Experienced Professional`.
  - *Specialist roles*: `Healthcare & Licensed Roles` (licences near the top), `Finance & Consulting` (dense one-page serif), and `Academic / Research CV` (publications, teaching, presentations, grants).
- **One Style Definition per Template**: Each template declares its alignment, rules, heading colour, date placement and wording once in `js/templates.js`; the PDF (and the live preview drawn from it), Word, plain-text and print renderers all read the same definition.
- **Editable Headings and Labels**: Rename section headings (for example *Internships* instead of *Work Experience*) and skill row labels; untouched headings follow the selected template's wording.
- **Accessible Template Gallery**: Full preview modal with demonstration data and focus management before applying templates.
- **Multi-Format Document Exports**:
  - `Vector PDF`: Selectable, searchable text, standard fonts (Times and Helvetica), clickable hyperlinks, and deliberate pagination (A4 and US Letter). Text outside WinAnsi uses the browser's **Save as PDF** dialog to preserve the characters.
  - `Vector PDF` files also carry title, author, subject and keyword metadata.
  - `Editable DOCX`: Pure client-side Open Packaging Conventions (OPC) OOXML generator with real Word bullet lists, right-aligned date tab stops, Heading styles, document properties, and removal of control characters that Word rejects.
  - `Plain Text (.txt)`: Clean formatted text for application form text-areas.
- **Transparent Review Panel**: Explainable checks for contact details, missing dates and job titles, measurable results, passive openers ("Responsible for"), first-person wording, bullet length and count, empty skills, placeholders and page count. Zero fake ATS scores or arbitrary percentages.
- **Job Description Comparison**: Paste a job advert in the Download tab to see which of its key terms (including multi-word names such as *Power BI* or *Lean Six Sigma*) already appear in your resume and which are missing. Matching handles word forms (*reports* / *reporting*), runs entirely on the device, and the advert is never stored.
- **Unsaved-Work Protection**: With device saving off, the page asks before closing or reloading over edits that have not been downloaded or backed up.
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
- **Template Catalogue (`js/templates.js`)**: Metadata, visual style definitions, section and skill labels, audience groups, and SVG thumbnails for all 15 templates.
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
|   |-- templates.js    # 15 template styles, labels and SVG thumbnails
|   |-- pdf-engine.js   # Client-side vector text PDF generator
|   |-- docx-engine.js  # Pure client-side OOXML DOCX document generator
|   |-- keywords.js     # On-device job description keyword matching
|   `-- resume-schema.js # Backup validation and lossless migration
|-- favicon/            # Brand favicons, touch icons, and webmanifest
|-- assets/             # Brand vector SVG assets
|-- guides/             # In-depth workflow optimization guides
|-- docs/
|   |-- PRODUCT_UPGRADE.md  # Architectural specification and upgrade details
|   |-- UX_TASK_TESTS.md    # End-to-end task tests and verification records
|   `-- SEO_SETUP.md        # Google Search Console, Bing and IndexNow setup
`-- tests/
    |-- run_tests.js         # Node.js unit suite (438 assertions)
    |-- regression_tests.js  # Behaviour regression checks (46)
    `-- browser_tests.js     # Playwright end-to-end, accessibility and download checks (2,500+)
```

---

## Testing and Verification

The unit suite in `tests/run_tests.js` covers 14 test suites and 438 assertions, and `tests/regression_tests.js` adds 46 behaviour checks:
- Vector PDF stream generation, valid PDF 1.4 headers, trailers, xref tables, and text streams.
- Client-side DOCX Open Packaging Conventions structure and styles.
- All 15 resume templates: configuration, rendering parity, template wording, and long-document pagination.
- JSON backup schema validation, v1 to v2 migration, and draft resilience.
- Transparent review engine diagnostic checks.
- Image resizer dimension validation, aspect-ratio lock, and strict byte-size enforcement.
- Strict prohibition of support popups, modals, nags, and timed overlays across all files.
- Sitemap XML validity, canonical link consistency, and robots.txt rules.
- Responsive styling, focus preservation, and WCAG AA color contrast ratios.

For the workspace changes and current verification workflow, see [docs/WORKSPACE_REFRESH.md](docs/WORKSPACE_REFRESH.md) and [docs/PROFESSIONAL_WORKSPACE.md](docs/PROFESSIONAL_WORKSPACE.md). The additional behavior and browser suites validate actual exports, draft recovery, responsive layouts, editable presets, original-size compression, and accessibility.

Run the complete checks with `npm ci`, `npm test`, `npx playwright install chromium`, and `npm run test:browser`. Browser verification requires Poppler (`pdftotext`, `pdfinfo`) and `unzip`; CI installs these and retains screenshots and exported documents. This includes 60 long PDF cases across all templates, paper sizes, and font families. If Playwright's bundled browser is not installed, set `BROWSER_EXECUTABLE_PATH` to a local Chromium.

To run the original verification suite:
```bash
node tests/run_tests.js
```

---

## Support
ApplyReady is free, private, and open-source. If it helped you with your documents, consider buying a chai:
[https://razorpay.me/@nbsumit](https://razorpay.me/@nbsumit)
