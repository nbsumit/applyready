# ApplyReady Product Upgrade Specification

## Executive Overview
ApplyReady (https://applyready.in) is a private, client-side document and image preparation utility. This upgrade elevates ApplyReady from a basic conversion tool into a production-grade utility interface featuring:
1. **Calm, Utility-First Design System:** Eliminated oversized heroes, decorative marketing banners, trust banners, and all popup/modal interruptions. Voluntary financial support appears strictly as an understated navbar button and footer link.
2. **8 Distinct ATS Resume Templates:** True applicant-tracking-system compliant templates with distinct typography, spacing, header arrangements, and precomputed SVG previews.
3. **Structured 3-Tab Resume Editor:** Intuitive workflow segmented into Content, Design & Templates, and Review & Export, featuring bounded undo/redo (up to 30 states), dynamic entry controls (add/edit/duplicate/reorder/delete), and optional career sections.
4. **Three Native Client-Side Export Formats:**
   - **Vector PDF:** Searchable, selectable ISO 32000 / PDF 1.4 document engine with exact A4 and US Letter pagination and zero server uploads.
   - **Editable DOCX:** Pure client-side Open Packaging Conventions (OPC) OOXML `.docx` generator implemented with zero external dependencies.
   - **Plain-Text (.txt):** Clean ASCII text representation with consistent section headers and bullet formatting for online application portals.
5. **Actionable, Transparent Review Checklist:** Real diagnostic checks evaluating contact completeness, role clarity, action-verb usage, quantifiable metric density, and bullet balance—with zero fake "ATS scores" or arbitrary percentages.
6. **Direct 4-Step Progressive Image Flow:** (1) Select Image -> (2) Output Settings -> (3) Crop & Adjust -> (4) Preview & Download, with transparency checkerboard backgrounds, JPEG margin fill selection, and collapsible advanced options.

---

## 1. Design System & Support Model

### 1.1 Aesthetic & Structural Overhaul
- **Typography:** Inter sans-serif system font stack for application UI; clean Georgia / Times serif or Inter / Helvetica sans-serif pairings within resume document renderers.
- **Color Architecture:** High-contrast accessible palette conforming to WCAG AA guidelines.
  - Light Mode: Canvas `#F8FAFC`, Cards `#FFFFFF`, Text `#0F172A`, Primary `#2563EB`, Success `#047857` (contrast 5.48:1).
  - Dark Mode: Canvas `#0B1120`, Cards `#131C2E`, Borders `#24324D`, Accent Green `#047857`.
- **Elimination of Marketing Clutter:** Removed the redundant full-width trust banner, reduced hero heights, and positioned tools directly in the primary viewport fold.

### 1.2 Strict Prohibition of Support Modals & Nags
- **Zero Interruption Policy:** All modals (`.modal-overlay`, `.modal-card`, `.modal-close-btn`, `.btn-chai`), timed popups, exit-intent overlays, and post-export donation triggers have been completely purged from the codebase.
- **Support Discovery:** Voluntary creator support (`https://razorpay.me/@nbsumit`) is integrated solely through:
  - An understated navbar button (`.nav-support-link`) present across all 10 pages.
  - A subtle link in the footer (`.footer-link`).
  - No popups, no audio, no animations, and zero blocking flows.

---

## 2. ATS Resume Template Catalogue

ApplyReady provides 8 engineered templates designed to satisfy corporate and institutional Applicant Tracking Systems (Workday, Taleo, Greenhouse, Lever, iCIMS).

| Template ID | Name | Focus / Best For | Typography | Header & Accent |
| :--- | :--- | :--- | :--- | :--- |
| `classic-professional` | Classic Professional | Broad Corporate, Finance, Law | Serif (Times-Roman) | Centered header, subtle bottom-rule accents |
| `modern-minimal` | Modern Minimal | Tech, Startups, Product | Sans-Serif (Helvetica) | Clean left-aligned, spacious line hierarchy |
| `graduate-early-career` | Graduate / Early Career | New Grads, Entry-Level, Interns | Sans-Serif (Helvetica) | Education placed first, coursework emphasis |
| `experienced-professional` | Experienced Professional | Senior Leadership, Executives | Serif (Times-Roman) | Authoritative centered header, double rule, deep history |
| `project-focused` | Project Focused | Software Engineers, Freelancers | Sans-Serif (Helvetica) | Prominent projects section, tech stack chips |
| `career-transition` | Career Transition | Industry Switchers, Pivots | Sans-Serif (Helvetica) | Summary & competencies above work chronology |
| `compact-professional` | Compact Professional | Dense 1-Page Summaries | Serif (Times-Roman) | Tight leading, compact padding, 2-column skills |
| `academic-cv` | Academic / Research CV | PhDs, Postdocs, Faculty, R&D | Serif (Times-Roman) | Multi-page pagination, publications, teaching, grants |

Each template features:
- Precomputed, zero-dependency inline SVG thumbnails rendered in the gallery.
- Dedicated CSS classes applied dynamically to `.ats-resume-sheet`.
- Recommended section orders and visibility presets configured in `js/templates.js`.

---

## 3. Rebuilt Resume Editor Architecture

### 3.1 Three-Tab Progressive Workflow
1. **Content Tab:** Structured input fields for Contact Details, Professional Summary, Experience, Education, Projects, Skills, and Optional Sections (Certifications, Achievements, Volunteering, Languages, Academic CV).
   - Dynamic list items support Add, Edit, Duplicate, Move Up, Move Down, and Delete.
   - Interactive writing hints provide real-time guidance on action verbs, metrics, and bullet structure.
2. **Design & Templates Tab:** Visual template gallery with 8 template cards, Font Family selector (Serif vs Sans-Serif), Paper Size (ISO A4 vs US Letter), Density (Compact vs Standard), and interactive Section Reorder & Visibility controls.
3. **Review & Export Tab:** Real actionable diagnostic checks, followed by direct export actions (Download Vector PDF, Download Editable DOCX, Download Plain Text, and Consented JSON Backup/Restore).

### 3.2 Bounded Undo/Redo Engine
- In-memory circular history stack storing up to 30 deep-cloned immutable snapshots.
- Accessible keyboard shortcuts (`Ctrl+Z` / `Cmd+Z` for Undo, `Ctrl+Y` / `Ctrl+Shift+Z` / `Cmd+Shift+Z` for Redo).
- Undo and Redo buttons with live disabled/enabled states reflecting stack availability.

### 3.3 Transparent Review Panel (No Fake ATS Scores)
The review system evaluates 6 real quality dimensions:
- **Contact Completeness:** Verifies name, phone, email, and location.
- **Target Clarity:** Asserts presence of target role title.
- **Executive Summary:** Checks for concise, non-cliché overview (40-400 words).
- **Quantifiable Metrics:** Scans work experience bullets for numbers, percentages, currency, and measurable metrics (`\d+%`, `\$\d+`, `\d+\+`).
- **Action-Verb Strength:** Verifies sentences begin with active verbs rather than passive pronouns ("I", "Responsible for").
- **Section Completeness:** Confirms education and core competencies are populated.

---

## 4. Multi-Format Export Engines

### 4.1 Native Vector PDF Engine (`js/pdf-engine.js`)
- Emits standard ISO 32000-1 / PDF 1.4 text-stream documents.
- True vector text: 100% searchable, selectable, and copy-pasteable. Zero canvas rasterization or blurry screenshots.
- Page geometry support:
  - ISO A4: `595.28 × 841.89 pt` (`210 × 297 mm`)
  - US Letter: `612.00 × 792.00 pt` (`8.5 × 11 in`)
- Intelligent multi-page pagination with section-break prevention and widow/orphan control.
- PDF hyperlinks for email (`mailto:`) and verified URLs (`URI` dictionary).

### 4.2 Pure Client-Side OOXML DOCX Engine (`js/docx-engine.js`)
- Implemented from scratch without third-party libraries (e.g., no docx.js, no JSZip).
- In-memory `SimpleZip` archiver generating valid PKZip packages (Store method, CRC-32 integrity validation, 32-bit local file headers and Central Directory headers).
- Standards-compliant WordprocessingML structure:
  - `[Content_Types].xml` with explicit overrides.
  - `_rels/.rels` package relationships.
  - `word/styles.xml` defining `Normal`, `Heading1`, `Heading2`, `ListBullet`, and document defaults.
  - `word/document.xml` formatting paragraphs, runs, bold/italic, lists, bullet indentation, margins, and page sizes.
  - `word/_rels/document.xml.rels` mapping external hyperlinks and style sheets.

### 4.3 Formatted Plain Text (`.txt`) Export
- Clean monospace text layout formatted with clear uppercase section delimiters and bullet indentations.
- Zero markdown or HTML artifacts. Ideal for legacy corporate text-area inputs.

---

## 5. Image Resizer & Compressor UX

### 5.1 Direct 4-Step Flow
1. **1. Select Image:** Immediate drag-and-drop zone with clear file browse button. Displays file name and size metadata with instant removal button.
2. **2. Output Dimensions & Target Size:**
   - Dimension presets (Avatar, Passport, Signature, Web Card, Document Scan, Custom).
   - Custom pixel inputs (width, height, max KB) with live validation (20px to 8000px, under 32 Megapixels, 5KB to 20,000KB).
   - Output format selection: JPEG, PNG, WebP.
   - Crop aspect ratio locking (Target ratio, Original ratio, 1:1, 4:3, 16:9, Free).
   - Target specification pill summarizing planned output.
   - **Advanced Options Disclosure (`<details>`):** Background fill selector (White, Black, Transparent) and optional Date / Name annotation strip.
3. **3. Crop, Adjust & Export:** Cropper container with dark/light checkerboard transparency background, 90-degree rotate controls, zoom controls, and "Process & Compress Image" action.
4. **4. Result Preview & Download:** Measured output preview with checkerboard background, exact byte-size verification, and direct download button.

---

## 6. Privacy & Data Governance

1. **Zero Server Uploads:** All PDF generation, DOCX serialization, image resizing, and compression occur entirely in browser memory on the user's CPU/GPU.
2. **Local Draft Persistence:** Resume draft data is stored strictly in `localStorage` under key `applyready_resume_v2` with explicit "Clear Draft" and "Export Backup" controls.
3. **CNAME & SEO Integrity:** Preserved custom domain (`applyready.in`), complete favicon suite, sitemap with 9 canonical entries, and robots.txt.
