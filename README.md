# ApplyReady.in

> **100% Client-Side Image Resizer, Strict Compressor and ATS Resume Builder**

ApplyReady is a fast, responsive, and privacy-first web utility suite built for professionals, job applicants, and students. It provides two essential in-browser tools:

1. **Image Resizer and Strict Compressor**: Crop to exact pixel dimensions, resize without distortion, preserve transparency in PNG and WebP, and compress strictly under target file sizes (20KB, 50KB, 100KB, custom).
2. **Single-Column ATS-Friendly Resume Builder**: Build clean, standard resumes with real-time preview, local draft persistence, JSON backup, and instant text-based vector PDF export with selectable text and clickable hyperlinks.

**Zero Server Uploads**: 100% of processing runs directly in your browser on your device using HTML5 Canvas, modern JavaScript, and direct client-side PDF generation. No photos, signatures, or resumes are ever transmitted to an external server.

---

## Key Features

### 1. General-Purpose Image Resizer and Compressor
- **Standard Presets and Custom Control**:
  - `Custom Dimensions`: Enter any width, height, and target KB limit with immediate input validation.
  - `Profile / Avatar`: 400 x 400 px, max 100 KB.
  - `ID / Passport Photo`: 350 x 450 px, max 50 KB.
  - `Signature / Stamp`: 300 x 100 px, max 30 KB.
  - `Social / Web Card`: 1200 x 630 px, max 300 KB.
  - `Document Scan`: 800 x 1000 px, max 200 KB.
- **Multiple Formats and Transparency**: Supports JPEG, PNG, and WebP. Transparent backgrounds are preserved in PNG and WebP, with configurable background fill (White / Black) when converting to JPEG.
- **Strict Byte-Level Verification**: Compression uses adaptive quality quantization. Never reports false success if an image remains oversized, and verifies output dimensions, MIME type, and exact byte size prior to download.
- **Distortion-Free Annotations**: Optional name and date strip for official identification. Automatically matches crop aspect ratio to the photo area above the strip, eliminating vertical stretching. Dynamically scales long and Unicode names.
- **Interactive Cropper**: Touch-friendly zoom, rotation (+90 / -90 degrees), and aspect ratio locking (Target, Original, 1:1, 4:3, 16:9, Free).

### 2. Single-Column ATS-Friendly Resume Builder
- **True Vector Text PDF Generation**: Built-in client-side vector engine creates standard PDF 1.4 documents with selectable, copy-pasteable, and searchable text, standard fonts (Times and Helvetica), and interactive hyperlinks for email, phone, and URLs.
- **Single-Column Hierarchy**: Recommended by recruiters and ATS parsers for reliable left-to-right reading order without table or multi-column parsing confusion.
- **Deliberate Pagination**: Computes vertical geometry on standard A4 (210 x 297 mm) with orphan protection to avoid isolated section headings and trailing blank pages.
- **Local Draft Persistence**: Optional browser-local draft saving (`localStorage`) with deletion controls for shared or public devices.
- **Versioned JSON Backup and Restore**: Download complete resume backups as `.json` files and restore them anytime with schema validation.
- **Responsive Fit-to-Width Preview**: Dynamically scales the A4 sheet to fit any screen size (from 320px mobile to 4K displays) without negative margins or clipped content.

### 3. Responsive Design and Accessible Themes
- **Light and Dark Themes**: System-driven with manual toggle, persisted in local storage with zero theme flash.
- **WCAG AA Compliance**: High-contrast status badges, buttons, and text meeting WCAG contrast criteria (contrast ratio >= 4.5:1).
- **Mobile First**: Clean split view on desktop and dedicated Edit / Preview tab navigation on mobile screens.

---

## Architecture and Tech Stack

- **Markup and Styling**: Semantic HTML5, CSS custom properties, responsive media queries, and print stylesheets.
- **Client-Side Logic**: Pure Vanilla JavaScript (ES6+). Zero backend server or database required.
- **Vector PDF Engine (`js/pdf-engine.js`)**: Standalone, zero-dependency PDF 1.4 stream builder.
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
|   `-- pdf-engine.js   # Client-side vector text PDF generator
|-- favicon/            # Brand favicons, touch icons, and webmanifest
|-- assets/             # Brand vector SVG assets
|-- guides/             # In-depth workflow optimization guides
`-- docs/
    `-- SEO_SETUP.md    # Google Search Console, Bing and IndexNow setup
```

---

## Testing and Verification

A Node.js test suite is included in `tests/run_tests.js` to verify:
- Vector PDF generation, valid PDF 1.4 headers, trailers, xref tables, and text streams.
- JSON backup schema validation and size restriction.
- Sitemap XML validity and canonical link consistency.
- Responsive styling and WCAG AA color contrast ratios.

To run the verification suite:
```bash
node tests/run_tests.js
```

---

## Support
ApplyReady is free, private, and open-source. If it helped you with your documents, consider buying a chai:
[https://razorpay.me/@nbsumit](https://razorpay.me/@nbsumit)
