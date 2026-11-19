# ApplyReady post-push audit

Independent post-push audit of ApplyReady, the free, open-source, privacy-first job-application toolkit at https://applyready.in, carried out on 18 November 2026 against the commit that was live in production.

This file records what was tested, what was found, what was fixed in the audit-fix round, and what is still open. Every defect in section 7 was found by one auditing agent and then reproduced by a second, independent agent before it was counted. Suggestions and unverified concerns are kept apart from defects (sections 14 and 15), so the defect count is not inflated and nothing is reported as broken that was not shown to be broken.

## Contents

- 1. Audited commit, branch, CI and deployment
- 2. Release-readiness verdict
- 3. Method and limits of this audit
- 4. Complete feature inventory
- 5. Features tested
- 6. Features that failed or partly failed
- 7. Verified defects
- 8. Navigation and usability
- 9. Security and privacy
- 10. Performance and compatibility
- 11. Accessibility
- 12. SEO
- 13. Documentation
- 14. Suggestions (not defects)
- 15. Unverified concerns and rejected findings
- 16. Fixes made in this round and regression results
- 17. Outstanding limitations

## 1. Audited commit, branch, CI and deployment

| Item | Status | Evidence |
|---|---|---|
| Audited commit | `92f7ef0` on `main`, the merge of [nbsumit/applyready#16](https://github.com/nbsumit/applyready/pull/16). Its tree is identical to `2e54419`, the last commit of the reviewed development branch. | `git log`, `git diff 2e54419 92f7ef0` (empty) |
| Branch and remote | `main` on `origin` (github.com/nbsumit/applyready) at `92f7ef0`. The audit-fix branch `claude/blissful-bardeen-qwl1nu` started at `92f7ef0` and is separate from `main`. | `git rev-parse origin/main`, `git status` |
| CI | "Quality checks" run 44361782481 on `92f7ef0`: success (`npm test` plus `npm run test:browser` in Chromium). | GitHub Actions |
| Deployment | GitHub Pages "pages build and deployment" run 44361773786 for `92f7ef0`: success. | GitHub Actions |
| Live site matches the commit | All 226 deployed files fetched from https://applyready.in are byte-identical to the checkout at `92f7ef0`. Three auditors checked this separately (226, 130 and 70 files). | `cmp` of each file |
| Donation link | Exactly one destination, https://pages.razorpay.com/support-applyready. It opens in a new tab with `rel="noopener"`, loads (HTTP 200 on GET), and is only contacted when clicked. Its wording on the site matches "free, open source, voluntary". The Razorpay page itself was left unchanged at the owner's request. | live sweep, network log |

## 2. Release-readiness verdict

**Production as audited (commit 92f7ef0): READY AFTER FIXES.** The live site worked well in most of what was tested:
- every page loaded with no errors, no third-party requests and no data leaving the browser;
- no XSS was possible;
- accessibility automation passed apart from two minor items.

But it had 61 verified defects: none critical, 3 high, 15 medium, 41 low and 2 informational. The high ones:
- a resume could become unopenable after a very long paste;
- pages deleted in Organise or Split could stay hidden inside the output PDF;
- the PDF tools leaked a worker and memory for every PDF opened.

**The audit-fix branch, with all fixes merged: ready for real use in Chromium-based browsers (Chrome, Edge, Android Chrome).**
- Every verified defect is fixed, apart from the 2 partly fixed and 1 declined item explained in section 17.
- The 32 further problems found when the fixes were reviewed together are fixed, apart from one known limitation (offline CJK text).
- The full test suite passes.

It is **not marked READY FOR RELEASE without qualification**, because real Firefox, real Safari (including iPhone Safari), real phones and real screen readers could not be tested in this environment. A short manual check on an iPhone and in Firefox (resize a photo, merge two PDFs, export a resume) is the remaining step before calling it fully released.

Per the owner's instruction, the audit-fix branch is merged into `main` once CI passes on the pull request.

## 3. Method and limits of this audit

Ten auditing agents each took one area and used the live site the way a person would: they opened the pages, added real files (photos from 1x1 px to 60 MP, PNGs with transparency and 16-bit depth, HEIC, truncated and corrupt files, decompression bombs, PDFs with rotation, forms, links, bookmarks, encryption and Hindi text, DOCX files and zip bombs), downloaded the results, and inspected them with independent tools: `pdfinfo`, `pdftotext`, `pdftoppm`, `pypdf`, `python-docx`, LibreOffice, ImageMagick `identify`, PIL and `unzip`. Each area then had a second agent that tried to reproduce every reported defect from scratch, using its own scripts, before the defect was accepted. In total: 20 agents, about 1,150 tool calls, about 2.7 hours of browser work.

Browsers and devices: Chromium 1243 through Playwright, at 1280x800, 768, 1024, 360x740 and 320 px, plus Pixel 7 and iPhone 13 emulation (touch and user agent), 4x CPU throttling and a "slow 4G" network profile.

Limits, stated plainly:
- **Only Chromium was run.** Firefox and WebKit/Safari are not installed in the audit environment, so real Firefox and Safari, including iPhone Safari, were not tested. Section 10 lists the code-level risks found by reading the source.
- **iPhone and Android results are emulation**, not real devices.
- **Screen reader** behaviour was checked from roles, names and live regions (axe-core and manual inspection of the accessibility tree), not with NVDA, JAWS, VoiceOver or TalkBack.
- **Linting and type checking:** the project has no linter or type checker (it is plain JavaScript with no build step). Instead, every JS file was checked with `node --check`, every page was scanned for duplicate ids, and the generators' `--check` modes were run.
- **Three external GitHub links**, the library repositories, could not be loaded from the sandbox; see LIVE-07.

Paths beginning with `scratchpad/` in the evidence refer to the auditors' working files (scripts, inputs, outputs and screenshots), which were kept outside the repository.

## 4. Complete feature inventory

ApplyReady has 21 tools, plus 3 preset pages that open a tool with a requirement already chosen. All of them run entirely in the browser; no file is uploaded. The registry in scripts/lib/tools.js is the single source for this list, the menus, the directory and the sitemap.

| Category | Tool | Page | Audited by |
|---|---|---|---|
| Resume | Resume builder | resume.html | Resume, live sweep, navigation, accessibility |
| Image tools | Image resizer | image-resizer.html | Image, live sweep, navigation, accessibility |
| Image tools | Passport photo resizer | passport-photo-resizer.html | Image, live sweep, navigation, accessibility |
| Image tools | Signature resizer | signature-resizer.html | Image, live sweep, navigation, accessibility |
| Image tools | Image compressor | compress-image.html | Image, live sweep, navigation, accessibility |
| Image tools | Image converter | convert-image.html | Image, live sweep, navigation, accessibility |
| Image tools | Signature cleaner | signature-cleaner.html | Image, live sweep, navigation, accessibility |
| Image tools | Passport photo print sheet | passport-photo-print.html | Image, live sweep, navigation, accessibility |
| Image tools | Resize image to 20 KB (preset of Image resizer) | resize-image-to-20kb.html | Image, live sweep, navigation, accessibility |
| Image tools | Resize image to 50 KB (preset of Image resizer) | resize-image-to-50kb.html | Image, live sweep, navigation, accessibility |
| Image tools | Resize image to a KB limit (preset of Image resizer) | resize-image-to-kb-limit.html | Image, live sweep, navigation, accessibility |
| PDF tools | Merge PDF | merge-pdf.html | PDF, live sweep, navigation, accessibility |
| PDF tools | Split PDF | split-pdf.html | PDF, live sweep, navigation, accessibility |
| PDF tools | Organise PDF pages | organize-pdf.html | PDF, live sweep, navigation, accessibility |
| PDF tools | Image to PDF | image-to-pdf.html | PDF, live sweep, navigation, accessibility |
| PDF tools | Compress PDF | compress-pdf.html | PDF, live sweep, navigation, accessibility |
| PDF tools | PDF to images | pdf-to-image.html | PDF, live sweep, navigation, accessibility |
| PDF tools | Extract text from PDF | pdf-to-text.html | PDF, live sweep, navigation, accessibility |
| PDF tools | Add page numbers | add-page-numbers.html | PDF, live sweep, navigation, accessibility |
| PDF tools | Watermark PDF | watermark-pdf.html | PDF, live sweep, navigation, accessibility |
| Document tools | Text to PDF | text-to-pdf.html | PDF, privacy, live sweep, navigation, accessibility |
| Document tools | File checker | file-checker.html | PDF, privacy, live sweep, navigation, accessibility |
| Batch processing | Batch image processor | batch-image.html | Batch, live sweep, navigation, accessibility |
| Cyber cafe tools | Applicant workspaces | workspace.html | Cafe, live sweep, navigation, accessibility |

Other features that are not tools in the registry but were audited:

- **Site search** (header, "/" and Ctrl+K), the **tool directory** (tools.html) with filter, the **home page** and "pick up where you left off" (recently used tools, which can be switched off).
- **Resume library** (My resumes: new, from sample, open, rename, duplicate, delete, import and export JSON), autosave to IndexedDB, undo/redo, the ATS check and job-description keyword match, and 15 templates exported to PDF, DOCX and TXT.
- **Your data** (lists and deletes everything stored, and the optional whole-site offline copy), the **service worker** and **offline page**.
- **Guides and tutorials** (28 guides, 9 step-by-step tutorials with real screenshots), trust and help pages (about, privacy, terms, philosophy, contribute, changelog, how to use, contact, feedback), the **404 page** with redirects for moved and removed pages, and the **theme toggle**.
- **The donation link** (the only one; it goes to the Razorpay page).

## 5. Features tested

Every row below was exercised on the live site (https://applyready.in, commit 92f7ef0) with real files, and the outputs were opened and inspected. "Partial" means the feature works but a defect or untested corner was found; the defect is listed in section 7.

### Live site sweep

I swept the live site at https://applyready.in. Every live HTML page, sw.js, app.css and theme.js matched the checkout at 92f7ef0 byte for byte. I visited 68 pages directly by URL at 1280px and at 360px (138 loads), plus 320px overflow checks: the 65 sitemap URLs, /index.html, /guides/index.html, /404.html and /offline.html. The core of the site works well. Every page returned 200 and had exactly one visible h1. There were no page errors and no console errors or warnings, apart from the one Playwright makes itself when service workers are blocked. No request failed or got a 4xx/5xx. None of the 1,596 requests went to any origin other than applyready.in. No page scrolls sideways at 320, 360 or 1280px. Every Font Awesome icon (6,936 instances) rendered a glyph, and no image was broken. All 96 internal link targets return 200, and all 87 #anchor links point to an id that exists. All 197 static asset references (img, source, link, script) return 200. On all 68 pages the phone menu opened (focus moved to search, the page behind became inert, the icon changed to an X) and closed by tap and by Escape. On every page the theme toggle switched theme and kept it after a reload, and the desktop Tools menu opened with 33 links and closed on Escape. The theme choice also carried across 7 other pages, whether the system setting was light or dark. Old and mistyped addresses behave well: removed exam pages (also under /hi/), /author/ and /editorial-policy.html explain what was removed and link to the replacement. The old 10/100/200 KB pages redirect to the right section of the KB-limit page. Moved guides redirect. Mistyped addresses suggest matching tools. External links: 43 of 46 load (some only answer GET, not HEAD); three GitHub library repository links could not be checked because this sandbox's proxy blocks them. The service worker registers on the live site with no errors and takes control from the second page. Pages already visited open offline, and pages never opened show /offline.html. Defects found: the offline page promises that every tool and guide works offline after the first visit, but all four of its buttons lead back to the offline page (medium). One icon on the offline page is blank (low). The Support link appears twice on three pages (low). The Privacy page says two links lead elsewhere, but there are 46 external URLs (low). Two info notes: an address like /upsc-photo-size.html gets the generic not-found text, and the Razorpay page has wording points for the owner. The Razorpay page loads (200), opens in a new tab with no opener and no popups, and its wording matches "free, open source, voluntary".

| Feature | Result | Evidence (abridged) |
|---|---|---|
| Live deployment matches the checkout at 92f7ef0 | pass | Fetched every *.html and guides/*.html, plus sw.js, css/app.css and js/theme.js, from https://applyready.in and compared each with cmp against /home/user/applyready: all returned 200 and all are identical. The live sitemap.xml is also identical to the repository copy. |
| sitemap.xml and robots.txt | pass | robots.txt returns 200, allows / and disallows /offline.html, /docs/, /tests/, /scripts/ and *.md, and names the sitemap. sitemap.xml returns 200 with 65 URLs (26 tools/pages, 29 guides including /guides/, 10 trust/help pages). The list is saved at scratchpad/audit/live-sweep/sitemap_urls.txt. Every internal HTML page linked from the header, footer, tools.html, the guides and 404 is in the sitemap. The only… |
| Every page at 1280px and 360px: HTTP status, console, page errors, failed or 4xx/5xx requests | pass | Script scripts/sweep.js; results in scratchpad/audit/live-sweep/sweep1.json and sweep1.log. All 138 loads returned 200, with 0 page errors, 0 failed requests, 0 responses >= 400 and 0 console errors. The only console warning was the Playwright SW-block message, which does not appear with service workers allowed (checked with scripts/one.js on / and /compress-pdf.html). |
| No requests to other origins (privacy) | pass | Every request on all 138 loads was recorded: 1,596 requests, 0 to any host other than applyready.in (the 'foreign' arrays in sweep1.json are all empty). The service worker run was also all same-origin. |
| h1 present on every page | pass | Every load in sweep1.json has exactly one visible h1. Examples: 404.html 'Page not found', offline.html 'You are offline'. |
| Horizontal overflow at 320px, 360px and 1280px | pass | documentElement.scrollWidth equals clientWidth on every page at 320, 360 and 1280 (overflow320, overflow360 and overflow1280 in sweep1.json). Top-of-page screenshots are in scratchpad/audit/live-sweep/shots/, e.g. tools_320.png. |
| Icons render a glyph (no empty boxes), images and fonts load | pass | Checked all 6,936 fa- icon elements: each has ::before content and a visible width; screenshots confirm it. A static check (scripts/icons_static.py) found every fa- class used in the HTML and JS is defined in css/vendor/icons.min.css and its glyph exists in the woff2 subset. No complete image had naturalWidth 0, except the deliberately empty src="" result previews on the resizer pages, which are hidden. 197 img,… |
| Internal links and #anchors | pass | Collected every a[href] from all pages (links.json): 179 distinct internal hrefs and 96 distinct targets, all 200 by curl. All 87 links with a #fragment match an id on the rendered target page. |
| External links | partial | Checked 46 distinct external URLs with HEAD and then GET, using a browser user agent (ext_status.txt). 43 load. pages.razorpay.com answers HEAD with 406 and GET with 200. support.google.com answers HEAD with 404 and GET with 200. nationalcareers.service.gov.uk loops on HEAD redirects but GET returns 200. MDN image-orientation redirects to its new URL. The GitHub issues/new links redirect to login, as they do for… |
| Removed exam pages and other old URLs | pass | scripts/oldurls.js; output in oldurls/oldurls.json, screenshots in oldurls/. /ssc-, /upsc-, /gate-photo-signature-size.html and /hi/ssc-photo-signature-size.html return 404 and show 'This page was removed', with links to the passport photo resizer and the signature resizer. /author/, /author/someone.html and /editorial-policy.html show 'This page was removed' with a link to /about.html.… |
| Old KB pages /resize-image-to-10kb.html, /100kb, /200kb | pass | Each returns 200 (a noindex stub with a canonical link) and immediately sends the visitor to resize-image-to-kb-limit.html#10kb, #100kb or #200kb. The section exists and is scrolled into view (oldurls/m_resize-image-to-10kb.html.png shows the '10 KB: small signatures...' section). |
| Random and mistyped URLs | pass | /qwertyzz-nonexistent.html, /reszie-imgae-to-50kb.html, /Tools.html and /guides/nope.html show 'Page not found' with search, Browse all tools, image resizer, resume builder and guides. /merge-pdfs.html suggests Merge PDF and the merge guide. /pdf-compress.html suggests Compress PDF. /resume-builder.html suggests the Resume builder. /image-resize.html suggests the image resizer, batch processor and signature… |
| Phone menu opens and closes on every page | pass | scripts/shell.js; results in shell/shell.json and shell.log. On all 68 pages (65 sitemap URLs, 404, offline and a random missing URL) at 360px with touch: tapping the toggle set data-open=true and aria-expanded=true, showed the sheet, moved focus to #navSearch, made the main content inert and changed the icon to fa-xmark. A category button showed its tools. Tapping again closed the sheet and removed inert. Escape… |
| Theme toggle works and persists | pass | On all 68 pages the toggle changed data-theme, wrote applyready_theme to localStorage, changed the background (rgb(17,17,17) in dark) and the aria-label, and the theme survived a reload. scripts/theme_nav.js: a theme chosen on / carried to /merge-pdf.html, /guides/, a guide, a 404 URL, /offline.html, /resume.html and /your-data.html, both from system light and from system dark. Screenshots: shell/dark_*.png. |
| Desktop header Tools menu | pass | At 1280 on all 68 pages, the Tools button opened #toolsMenu with 33 visible links and Escape closed it. The phone menu toggle is hidden at 1280. |
| Footer links | pass | Every footer link (33 internal, the GitHub source link and the Razorpay link) appears in the internal and external link checks above, and all resolve. The footer is identical on all pages, including 404 and offline. |
| Donation link: count, no popups, Razorpay page loads | partial | Exactly one link to https://pages.razorpay.com/support-applyready on 64 of 67 HTML pages in the checkout, including 404, offline and the redirect stubs. about.html, contribute.html and philosophy.html have two (LIVE-03). Clicking the footer link on /about.html (scripts/razorpay.js) opened one new tab with window.opener null and no dialogs or popups before or after. The Razorpay page loads with 200 and the title… |
| Service worker registers on the live site | pass | scripts/sw.js with service workers allowed, at 360px: navigator.serviceWorker.ready resolved with scope https://applyready.in/ and script /sw.js, and no console errors while online. Cache 'applyready-files' held /offline.html plus 15 files from the first page. The second page was controlled by the service worker, and the cache then held 23 entries. |
| Offline behaviour and /offline.html | partial | Online, /offline.html returns 200 with h1 'You are offline'. Offline: the visited pages / and /merge-pdf.html loaded from cache with CSS, fonts and icons, and pages never visited showed the offline page (sw/offline_*.png). However, all four buttons on the offline page lead back to the offline page (LIVE-01), and the resume-builder icon on it is blank (LIVE-02). |

Measurements: Pages swept: 68 unique URLs (65 from the sitemap plus /index.html, /guides/index.html, /404.html, /offline.html) x 2 viewports = 138 loads. Overflow re-checked at 320px for each phone load and at 1280px for each desktop load. Requests: 1,596 in total, 0 to other origins, 0 failed, 0 with status >= 400. Console: 0 errors, 0 warnings (excluding the Playwright 'Service Worker registration blocked' message). Page errors: 0. Icons: 6,936 fa- elements checked, 0 with no ::before content or zero width. Fonts: 'Font Awesome 6 Free 900' and 'Inter' loaded on all 138 loads; 'Font Awesome 6 Free 400' is loaded only on the 6 loads (3 pages) that use a regular icon. Internal links: 179 distinct hrefs, 96 distinct targets all 200, 87 anchor links all resolved. Static asset references: 197, all 200. External links: 46 distinct URLs; 43 load (HEAD then GET), 3 not checkable here (GitHub repos blocked by the sandbox proxy). Shell tests: 68/68 pages pass the phone menu, theme toggle with reload, and desktop Tools menu checks (33 links). Service worker: registered, scope https://applyready.in/; after the first page the cache held 16 entries (offline.html, /, CSS, JS, fonts); after a second page 23 entries, 3 of them HTML. Donation link: 1 per page on 64 of 67 checkout HTML pages; 2 on about.html, contribute.html and philosophy.html.

### Resume builder

I audited the resume builder at https://applyready.in/resume.html end to end in Chromium (desktop 1366x900, 360x740, Pixel 7, iPhone 13) using Playwright. The live files are byte-identical to the checkout (resume.html, resume.js, resume-library-ui.js, pdf-engine.js, docx-engine.js compared with cmp).

Most of it works well:
- All 95 canary values typed through the UI into every section (personal, summary, experience, education, projects, skills, certifications, achievements, volunteering, languages, publications, academic, references, two custom sections) were in the editor data. The stored copy matched. It survived reload and a full browser restart.
- My resumes (create, open, rename, duplicate, delete, delete all), ?id= and last-opened restoring, two-tab conflict handling, undo/redo with autosave, the shared-computer switch and the phone Edit/Preview/Download bar all behaved correctly.
- The JSON backup round trip (export one and all, import into fresh profiles) gave identical data, and re-importing the same file was de-duplicated.
- 20 malformed or hostile JSON files were all rejected with clear messages or imported inertly: no script ran, no javascript:/data: links were created, no prototype pollution.
- PDF, DOCX and TXT for all 15 templates (a 3-4 page resume) contained every visible field in the right order, had no '?' replacement glyphs and kept text inside the margins. The page count shown in the preview matched the real PDF for all 15 templates. Section order and hidden sections carried through to all three formats. Letter, sans, comfortable and compact options were applied in both PDF and DOCX.
- No request left applyready.in, and there were no console errors in any run.

Main defect (high): the editor accepts more than 50,000 characters in a field, or more than 150 entries in a list, and says "Saved on this device". After a reload the whole resume shows as "Damaged: cannot be opened". The JSON backup the app recommends silently empties that field, and Export all leaves the damaged resume out.

Other defects:
- Medium: in the PDF a referee's contact line can end up alone on the next page, away from the referee's name.
- Low: the Compact Professional PDF can split a 2-line bullet across pages, leaving one line at the top of the next page.
- Low: in DOCX, a long project link runs straight into the tech text with no space or separator.
- Low: the keyword match lists generic words such as "know" as key terms.

| Feature | Result | Evidence (abridged) |
|---|---|---|
| Blank start and every section edited through the UI (personal, summary, experience x2, education x2, projects x2, skills, certifications, achievements, volunteering, languages, publications, academic teaching/presentations/grants, references x2, custom section in entries mode with 2 entries, custom section in text mode) | pass | Script scripts/fill.js filled 95 visible inputs/textareas with unique canary values. Missing in editor data: none. IndexedDB record equals editor data. The 5 section-heading inputs sit in closed <details> and were skipped. Data saved to out/fill_data.json; screenshot shots/fill_full.png. |
| Autosave: type, wait, reload | pass | fill.js: status 'Saved on this device · just now'. URL updated to ?id=r_…. After reload the content is identical; the only differences are migration normalisation, e.g. achievements strings become {title,text} and empty citation/date keys are added (out/fill_after_restart.json). |
| Browser restart with launchPersistentContext (close the whole browser, relaunch, reopen resume.html) | pass | fill.js: after restart, all 95 canaries present and title 'Cn1x, Cn2x'. library.js: after a restart with no ?id, the last-opened resume (Asha) reopened with its latest summary. |
| Leaving immediately after typing (no wait) | partial | scripts/quickclose.js: reload, navigate away and tab close with beforeunload all KEPT the edit. A forced Playwright browser close 0 ms or 300 ms after the last keystroke LOST it; at 1000 ms it was kept (see RES-07, unverified for real users). |
| My resumes: New, New from sample, Open, Rename (including HTML in the name and an empty name), Duplicate, Delete current, Delete all | pass | scripts/library.js: rows listed correctly. Rename to 'Asha – Google <b>version</b>' was shown escaped. An empty name shows 'Enter a name for this resume.'. Duplicate is independent of later edits to the original. Deleting the open resume opens the next one. Delete all leaves IDB resumes=[] and meta only persistAsked. |
| Restore from ?id= (valid, unknown, script-like) and last-opened | pass | library.js: ?id=B opened B. ?id=r_doesnotexist shows the notice 'The resume in this link is not saved in this browser…' with an empty editor. ?id=<script> was ignored. Plain URL opened the last-opened resume. |
| JSON backup: export one and export all, import into fresh browser profiles, compare | pass | scripts/roundtrip.js: the library backup ApplyReady_resumes_backup_2026-11-18.json was imported into a fresh browser. Both resumes (the canary all-sections one and the multipage one) were IDENTICAL to the stored data. The single backup round trip was IDENTICAL. Re-importing the same file said 'already saved… nothing was imported' and the count stayed 2. Files: dl/rt_one.json, dl/rt_all.json. |
| Malformed and hostile JSON import (truncated, empty, array, null, HTML/script in every field, javascript:/data: links, wrong types, 50,000/50,001-char strings, 150/151 entries, __proto__, newer version, 200k-deep nesting, 6 MB file, 205-resume library, other app, BOM, 3,000-char name) | pass | scripts/hostile.js and hostile2.js with inputs/hostile/*.json. Every bad file got a specific message, and the existing resumes were unchanged. window.__xss stayed undefined after import, the Review step, My resumes and the Style step. There were 0 injected img/script elements and 0 javascript:/data: hrefs. The PDF /URI list and DOCX hyperlink relationships contain only https/mailto/tel. ({}).polluted is… |
| PDF export, all 15 templates, 3-4 page resume | pass | scripts/export.js and check.py on dl/mp_<template>.pdf. All visible text is present, case-insensitive with whitespace ignored. The only '?' comes from a URL query string. pdftoppm montages are render/montage_mp_*.png and were inspected (classic, modern-minimal, executive-impact): clean margins and alignment, no overlap. No entry title or section heading was left at a page bottom (page-boundary scan of all 15). |
| PDF page breaks (orphans, split entries) | partial | There are no orphaned headings. But mp_compact-professional.pdf p1→p2 leaves a one-line widow (render/compact_break.png). In long_compact-professional.pdf p4→p5 a referee's contact is separated from the name (render/long_compact_ref_break.png). See RES-02 and RES-03. |
| Long text: 34 roles, a 3,000-char name, an 80-char headline, URLs without spaces, a 300-char token, a 1,400-word bullet, a 1,500-word text section | pass | dl/long_*.pdf and dl/huge_classic-professional.pdf. Long tokens wrap inside the margins. The name wraps over 2 centred lines. Every Word/Para/Sum token is present in the 10-page PDF (out/huge.txt). One 21-line bullet is moved whole to page 2, leaving page 1 at y≤579 of 803 (render/montage_long_cp.png, RES-06). |
| DOCX export (15 templates) opened with python-docx and rendered with LibreOffice | partial | All 15 dl/mp_*.docx pass unzip -t and open in python-docx with all text present. LibreOffice renders of classic, modern-minimal, finance-consulting and executive-impact (render/montage_dx_*.png) look correct, except that a long project link runs into the tech text (render/dxhi_exec_proj.png, RES-04). |
| TXT export | pass | dl/mp_*.txt: UTF-8, all visible fields present, headings underlined, '*' bullets, references and custom sections included, ₹ and Devanagari kept (dl/unicode.txt). |
| Section reorder, hide and entry reorder in the Style and Write steps | pass | scripts/order.js: Skills moved to the top, Interests moved up 3, Publications hidden, experience 2 moved to first, education 3 moved to first. The order survived a template switch (orderCustom=true) and a reload. Headings in dl/order.pdf, order.txt and order.docx (Heading 1 styles) were all in the same new order, with Publications omitted. |
| Page size, font, size and density options | pass | scripts/design.js: Letter+sans+comfortable gives a 612x792 PDF, button 'Download PDF (Letter)', DOCX pgSz 12240x15840, Arial, sz 24/22. A4+serif+compact+compact gives a 595x842 PDF, DOCX Times New Roman, sz 20/18, margins 720. |
| Undo/Redo (buttons and Ctrl+Z outside inputs), and autosave of the undone state | pass | scripts/features.js and undo2.js: undo restored a deleted role, then its text, then back to an empty resume in 6 steps; redo re-applied all 6. Ctrl+Z reverted a template change. The undone summary was saved (IDB summary '' after undo) and survived reload. Undo after 'Clear resume' restored the name and saved it (scripts/clear.js). |
| 'Save on this device' switched off (shared computer) | pass | features.js: the switch turns off, with the status 'Not saved: saving is off on this device' and a notice naming the 2 resumes still stored. No IDB writes while off. Stored meta: lastResumeId, persistAsked, resumeSaving=off. localStorage holds only applyready_recent_tools. Reload showed a beforeunload prompt and the typed text was gone, as warned. |
| Two tabs editing the same resume | pass | features.js: tab 2 quietly picked up tab 1's saved change ('This resume now shows the changes saved in another tab.'). With edits in both tabs at once, tab 2 paused with 'Saving paused: changed in another tab' and offered Load/Copy/Overwrite. Nothing was silently overwritten. 'Save mine as a copy' created 'Uma Undo (copy)'. |
| Review step and ATS check | pass | scripts/review.js: an empty resume gets 1 required fix and 4 warnings. The sample gets 'Ready to download'. A bad email or LinkedIn URL gives '2 things to fix'. Unsupported ₹ → ✓ ≥ are listed with a working Replace button (scripts/unicode.js), and the PDF falls back to print for Devanagari/emoji as documented. |
| Job-description keyword match | partial | review.js: JD1 gives 20 of 21 (Python missing, correct). JD2 handles C++, C#, Node.js, CI/CD, .NET and REST APIs correctly after adding them to skills (12 of 19). But generic words 'know', 'unit' and 'juniors' are counted as key terms (RES-05). The JD is not stored in IDB or localStorage. |
| Phone layout at 360x740, Pixel 7 and iPhone 13: Edit/Preview/Download bar, preview, download, My resumes, Style | pass | scripts/phone.js: no horizontal overflow (scrollWidth equals clientWidth) in any view. The fixed bar is 65 px tall with Edit/Preview 42 px high and Download 48 px. Preview fits the width. Download opens the Download step and the PDF downloads (dl/phone_*.pdf). Screenshots: shots/phone_*_*.png and render/phone_montage.png. |
| Privacy: network and storage | pass | h.watch logged every request outside applyready.in, blob: and data: across all scripts: none. Storage is limited to the IndexedDB 'applyready' (resumes, meta), the localStorage key applyready_recent_tools and the 'applyready-files' cache from sw.js (site files). |
| Fields over the schema limits (over 50,000 chars per field, over 150 entries) | fail | scripts/limits.js summary/bullets/entries and scripts/limits2.js: each shows 'Saved on this device', then after reload the resume is 'Damaged: cannot be opened' (shots/limits_summary_library.png). The app's own backup has summary length 0 (dl/overlimit_backup.json). See RES-01. |

Measurements: Page ready (IndexedDB loaded) about 1.25 s on desktop. 3-page A4 PDF: 27,155 bytes, PDF 1.4, standard Type 1 fonts (Times/Helvetica, WinAnsi, not embedded), selectable text, metadata Title/Author/Keywords filled. Multipage test resume (8 roles, 26 bullets, 4 projects, all optional sections) gave 3 pages in classic-professional, experienced-professional, compact-professional, ivy-classic and finance-consulting, and 4 pages in the other 10 templates. The pill count equalled the pdfinfo count in 15/15 templates. Text bbox per page: y from 33 to 809 of 842 pt and x from 32 to 563 of 595 pt at worst (finance-consulting), so nothing is cut. Long test: 34 roles plus a 3,000-char token gave 5 pages. A 1,400-word bullet, a 1,500-word text section and a 1,200-word summary gave 10 pages with 100% of the words present. TXT is UTF-8 with LF line ends, about 8 KB. DOCX opens in python-docx, passes unzip -t and renders in LibreOffice at 3-4 pages. Page settings: A4 11906x16838 twips, Letter 12240x15840 twips, margins 720 (compact) / 1080 (standard) twips. Import of a 205-resume library: 200 imported, with the cap message. Files over 5 MB are rejected before parsing. The schema rejects text over 50,000 chars per field and lists over 150 entries (references over 20). Autosave delay is 600 ms. Reload, navigate and tab close straight after typing kept the edit. A forced Playwright browser close at 0 ms and 300 ms lost it, and at 1000 ms kept it. External requests across all runs: 0.

### Image tools

I audited all ten single-image tools on the live site (https://applyready.in, commit 92f7ef0), using 30+ generated inputs and checking every output file with identify, PIL and pdfinfo/pdftoppm, plus visual montages. The core resizer pipeline is solid:
- Every resizer output had exactly the requested pixel size and was at or under the KB limit.
- KB ranges were met exactly (240x240 thumb output 20,484 bytes for a 20–50 KB range).
- EXIF orientation 6 was handled correctly in every tool.
- Transparency became white in JPEG and stayed transparent in PNG/WebP.
- No output had any EXIF or GPS.
- cm and inch at a chosen DPI gave the right pixel counts.
- Name/date strip, rotate, zoom, mouse drag and keyboard crop all worked.
- HEIC (including HEIC renamed .jpg), text files and 0-byte files got clear messages, and the page recovered.
- Download names were sanitised (reserved characters, RTL override, CON, paths, long names).
- No network request carried image data.
- The passport print sheet came out at exact physical size (4x6 = 1200x1800 px at 300 DPI, PDF 288x432 pt; 35x45 mm tiles about 413x531 px).
- Every tool worked end to end at 360 px with no horizontal scroll.

Defects found:
- High: on the signature cleaner the 'Paper whiteness' slider works backwards from its own hint, and the default leaves dim indoor paper grey.
- Medium: in Custom size, width and height are locked to the old shape by default, so typing a form's 300 x 200 gives 200 x 200.
- Medium: truncated JPEGs are accepted and output as 'verified' with most of the photo blank (resizer, signature cleaner, print sheet). The batch tools reject the same file.
- Medium: the signature cleaner's 'Keep original ink' turns blue ink pure black.
- Low: a 1x1 image crashes the resizer with a raw drawImage error. Other tiny images are enlarged and padded with no warning.
- Low: cm/inch outputs carry no DPI.
- Low: the targetKB/width/height URL parameters are ignored on resize-image-to-kb-limit.html.
- Low: requesting more copies than fit on a print sheet is silently capped.
- Low: images over 50 MP are queued in compress/convert and fail only after you click Start.

| Feature | Result | Evidence (abridged) |
|---|---|---|
| Passport photo resizer with JPEG 640x480, 4000x3000, 8000x6000, 60 MP inputs | pass | Outputs in scratchpad/audit/image/out/resizer1/: all exactly 350x450 (identify/PIL) and <= 51,200 bytes (22,897; 50,815; 16,902; 1,717). The 60 MP (9000x6667) image was accepted and processed in 1.3 s. Montage: shots/resizer1_montage.png |
| Format coverage in resizer: PNG with alpha, 16-bit RGB and grey PNG, grayscale JPEG, CMYK JPEG, GIF, BMP, WebP, AVIF | pass | All decoded and output as 350x450 RGB JPEG under 50 KB. CMYK colours match the RGB source visually; transparent areas became white in JPEG (shots/resizer1_montage.png) |
| EXIF orientation 6 (portrait phone photo) in all 10 tools | pass | phone_portrait_exif6.jpg (stored 4032x3024, orientation 6): resizer output portrait with red marker top-left; 'Use original size' gave 3024x4032. Compressor output 1664x2219 with TL pixel (228,19,22) red and BR blue. Convert to PNG 3024x4032. Signature cleaner sig_exif6.jpg came out 1200x500 landscape. Print sheet tiles upright (shots/print_montage.png) |
| EXIF/GPS removal from outputs | pass | Inputs carried GPS (12 58 30 N, 77 35 40 E), Make and Model. Every downloaded JPEG, PNG and WebP in out/resizer1, resizer2, batch1, batch2, sig and print had an empty EXIF and no GPS IFD (scripts/inspect.py) |
| Resizer presets: 20 KB, 50 KB, signature, thumb (20–50 KB), declaration (50–100 KB), ?preset=signature link | pass | 350x350 16,607 B; 400x500 29,664 B; 300x100 8,757 B; thumb 240x240 20,484 B (padded with COM segments, decodes fine); declaration 800x400 95,618 B; image-resizer.html?preset=signature gave 300x100 (out/resizer2/presetQuery) |
| Custom dimensions in cm and inches with DPI | partial | 3.5x4.5 cm @300 -> 413x531 (correct), 2x2 in @200 -> 400x400 (correct). The file has no DPI (JFIF units 0, density 1:1); see IMG-06 |
| Custom width/height in px entered in order (width then height) | fail | Custom size on image-resizer.html: typing 300 in width and 200 in height produced 200 x 200 (out/resizer2/pngTransparent, webp 800x600 -> 600x600, kbLimitPlain 200x150 -> 150x150); see IMG-02 |
| Output formats: PNG (alpha kept), WebP, black fill, letterbox with 'Original proportions' | pass | transparent_Custom_200x200.png RGBA, corner alpha 0; WebP 600x600 34,558 B under 40 KB; black-fill letterbox 400x400 visible in shots/resizer2_montage.png |
| Name/date strip | pass | out/resizer2/nameStrip/photo_640x480_Passport_Photo_Dated_350x450.jpg: 350x450, 49,953 B, strip reads 'ASHA EXAMPLE KUMARI / DATE: 18-11-2026' |
| Rotate, zoom, mouse drag, keyboard arrows and Tab+Enter on rotate | pass | Rotate right gave a 90° CW result (red at top-right). Shift+ArrowLeft x20 moved the crop box from translateX 382 to 227 px (wrapper tabindex=0). Mouse drag moved the crop box 200 px; Tab to btnRotateRight then Enter rotated 90°. Outputs in out/resizer2/keyboard, out/resizer2/rotateRight, out/mouse |
| Impossible limits (PNG too big, 4000x3000 under 5 KB) | pass | Clear messages: 'PNG needs 4375.2 KB at this size...' and 'The smallest result is 55.7 KB. Increase the file limit...' |
| Invalid files in resizer: 0-byte, text renamed .jpg, fake HEIC, HEIC named .jpg, 72 MP; recovery afterwards | pass | Clear messages, e.g. 'text_renamed.jpg is a plain text file...', the HEIC message with iPhone advice, '...72.0 MP. Please select an image under 64 Megapixels'. The previous image was kept; choosing a valid file next processed normally (scripts/errors2.js) |
| Truncated/corrupt JPEG | fail | Resizer, signature cleaner and print sheet accept truncated.jpg and output a mostly blank image (shots/errors_montage.png). Compressor and converter correctly fail it with 'This image could not be opened'; see IMG-03 |
| Tiny images (1x1, 2x2, 5x5, 10x10, 20x20) | partial | 1x1 PNG/JPG fail with a raw drawImage error. 2x2 to 50x50 are upscaled to 350x450 with white bands and no warning; see IMG-05 |
| Download file names (spaces, Devanagari/CJK/Cyrillic, <>"&', RTL override, CON, .hidden, backslash path, 250-char) | pass | Resizer: 'my photo with spaces_Passport_Photo_350x450.jpg', 'फोटो_写真_фото_Passport_Photo_350x450.jpg', '_b__x_&'y'_...', 'evil_gpj_...', 'image_CON_...', 'hidden_...', 'c_...', stem cut to 60 chars. Signature cleaner: 'Cleaned__a__b__c_.jpg', 'Cleaned_evil_gpj.jpg'. (Unicode names need a UTF-8 locale in the test browser; that is an environment issue, not a site issue) |
| resize-image-to-kb-limit.html preset choices and ?targetKB= URL | partial | Choices 10/20/50/100/200 KB and custom work (custom 10 KB gave 7,265 B). The URL ?targetKB=15&width=300&height=400 was ignored and gave 350x350 under 50 KB; see IMG-07 |
| Compress image (single file): limit search, allow-shrink on/off, min KB padding, quality, PNG→JPEG background, presets | pass | Outputs in out/batch1 and out/batch2 all under the limit with exact byte counts on screen. No-shrink 30 KB fails with clear advice. Min 150 KB gives exactly 153,600 B. Red background fills transparent areas with (254,0,0). Passport preset gives 350x450 |
| Convert image (single file): JPG↔PNG/WebP, BMP/GIF/WebP/AVIF/16-bit to JPEG, fill/pad/scale/fit, quality 40 vs 100 | pass | Correct sizes: fill 350x450, pad 300x100 with white bars, scale 10% 400x300, fit 1000 -> 1000x750. q40 14,823 B vs q100 315,648 B. Transparent PNG to JPEG has white corners; to WebP keeps alpha |
| Compress/convert invalid inputs | partial | 0-byte, text and HEIC are refused at add time with clear messages. The 72 MP image is added as 'Waiting' and fails only after Start; see IMG-09 |
| Signature cleaner: white paper and dark ink | fail | Bright paper becomes pure white (paper lum 255). Dim (lum 180) and shadowed paper stay grey at the default, and raising 'Paper whiteness' as the hint says makes them darker (226.9 -> 191.7). See IMG-01 and shots/sig_montage.png |
| Signature cleaner ink colour, transparent PNG, invalid files | partial | Black and Deep blue options work. Transparent PNG has 97.5% alpha=0. Text, HEIC and empty files show clear toasts (shots/sig_text.png). 'Keep original ink' turns blue ink black (IMG-04) |
| Passport print sheet physical size, DPI, PDF and photo count | pass | 4x6 JPEG 1200x1800 at 300x300 PixelsPerInch; PDF page 288x432 pt; A4 2480x3508 / 595.28x841.89 pt; 5x7 1500x2100 / 360x504 pt. Tiles about 413x531 px (35x45 mm). Counts: 4x6=6, A4=30, A4 with 16 requested=16, 5x7 stamp=16. Transparent input printed on white (shots/print_montage.png) |
| Passport print requested copies above capacity | partial | Choosing '8 photos' on 4x6 silently yields 6 (shots/print_req8_4x6.png); see IMG-08 |
| Privacy: network during upload and processing | pass | Only request after page load during upload, crop and process: GET https://applyready.in/css/webfonts/fa-regular-400.woff2 (scripts/mouse.js) |
| Phone 360x740 (touch, Pixel 7 UA) end to end for all 10 tools | pass | Each resizer page: upload, tap 'Resize and compress' (button at 33,680 294x48), result 'verified', tap Download. Compress and convert produced downloads; signature cleaner and print sheet downloaded JPG and PDF. scrollWidth=360 on every page; screenshots shots/mobile_*.png and shots/mob2_3000.png |

Measurements: Resizer outputs (bytes / limit): passport 4000x3000 22,897/51,200; 640x480 50,815/51,200; AVIF 50,630/51,200; 20KB page 16,607/20,480; 50KB page 29,664/51,200; signature 8,757/30,720; thumb (20-50KB) 20,484 (min 20,480); declaration 95,618 (50-100 KB); cm 3.5x4.5@300 -> 413x531; inch 2x2@200 -> 400x400; original size from EXIF-6 phone photo -> 3024x4032, 3,040,721/3,072,000. Processing time per image 0.2-1.6 s (8000x6000 1.6 s). Compressor default 100 KB: 4000x3000 -> 2235x1676 99,402 B (q51%, allow-shrink); 8000x6000 -> 3222x2416 96,201 B in 3.0 s; noshrink 30 KB correctly fails with message. Convert JPG->PNG 640x480 = 706,366 B (RGBA); EXIF-6 3024x4032 -> PNG 25,327,297 B in 1.0 s. Print sheet: 4x6 1200x1800 @300 DPI JFIF, PDF 288x432 pt, 6 tiles about 413-415 x 531-534 px; A4 2480x3508, 30 tiles, PDF 595.28x841.89 pt; 5x7 1500x2100, 16 stamp tiles; US visa 2x2 on 4x6 = 2 tiles. Signature cleaner, mean paper luminance after cleaning (255 = white): bright paper (lum 237) 255.0; dim paper (lum 180) 226.9 at default 70, 191.7 at 100, 255.0 at 20; shadowed paper 206.4 at default, 171.3 at 100, 253.9 at 20. Ink mean RGB in (33,40,118) -> out (1,1,1) in 'Keep original ink'. Mobile 360x740: scrollWidth=clientWidth=360 on all 10 pages, before and after processing.

### PDF tools

I tested all 11 PDF tools on https://applyready.in (commit 92f7ef0) in Chromium, on desktop and on phones (360x740, Pixel 7, iPhone 13). I made about 30 test PDFs and checked every output with pdfinfo, pdftotext, pdftoppm renders and pypdf. I found no network uploads: all requests went to applyready.in and none used POST. Most core functions work. Merge, split (all four modes and every edge input), organize, compress, PDF to image, text to PDF and image to PDF all gave the right page counts, order, page sizes and /Rotate values. Password files open with the right password, show an error for a wrong one, and owner-password-only files open without asking. Results are reopened and checked before download. Phone merge and split worked end to end with no sideways scrolling. Large jobs were fast and the page stayed responsive: an 800-page split took 0.6 s, an 80 MB merge 0.7 s and fourteen 300 DPI PNGs 3.8 s.

I reproduced 5 defects:
1. (high, privacy) When Organize deletes a page, or Split leaves one out, the page is still inside the output file as a hidden object if a kept page links to it. I recovered the full text of a deleted page from the saved file. The same cause breaks internal links after Merge and adds hidden duplicate pages.
2. (medium) Add page numbers and Watermark make files grow with the square of the page count when pages share one font dictionary, which ReportLab and LibreOffice both produce. 300 pages grew from 263 KB to 3.0 MB, 800 pages from 688 KB to 20.7 MB, and 2,000 pages from 1 MB to 125 MB.
3. (medium) A damaged PDF whose pages cannot be drawn is accepted. The tool blames the browser, says "The tool still works", and gives blank pages as a successful, "checked" result. File checker reports no problem for the same file.
4. (medium) PDF to text corrupts Hindi: it drops the ि vowel sign and writes a NUL control character into the .txt file.
5. (low) Watermark text is not fitted to the page, so long text is cut off at the page edges, in the preview and in the saved file.

I also logged one unconfirmed concern and three suggestions.

| Feature | Result | Evidence (abridged) |
|---|---|---|
| Merge PDF desktop: 9 inputs (A4, Letter, landscape, /Rotate 0/90/180/270, mixed sizes, JPEG, forms+bookmarks, Hindi, AES-256 encrypted), reordered with Up buttons | pass | out/merge_desktop.pdf has 29 pages in the order shown. Each page has the right MediaBox and /Rotate (90/180/270 kept), text is selectable and the Hindi pages extract. Wrong password shows 'That password is not right'; the right one opens the file. No external requests and no POST. Render: shots/merge_montage.png |
| Merge: drag handle, keyboard End key, name sanitising, EXIF-rotated photo and WebP | pass | Pointer drag moved row 3 to 1; End key moved it to last and the status line said so. The name '../../evil<name>:?' downloaded as evil_name___.pdf. EXIF orientation 6 photo is upright (shots/merge_exif.png) and the camera make/serial are not in out/merge_exif.pdf |
| Merge: bookmarks, form fields, links | partial | Bookmarks and AcroForm were dropped (documented). The internal link on page 27 of out/merge_desktop.pdf points to orphan object 77, not page 26 (see PDF-01) |
| Merge with bad files (truncated, text renamed .pdf, garbled, empty) | partial | Truncated, not-PDF and empty files were refused with clear messages. garbled.pdf was accepted with no warning (see PDF-03) |
| Split PDF: extract, ranges, every page, chunks; edge inputs | pass | Inputs '1', 'last', '3-', '-2', '2 to 4', '1;3', '01' were accepted. '0', '5-2', 'abc', '6' (past last page), '1-3-5', '1.5' gave exact error messages. '5, 1-2, 2' gave pages 5,1,2,2 (out/split_extract.pdf). Ranges '1-2, 3, 4-last' gave 3 correct files. Every page gave 5 files; chunks of 2 gave 2+2+1. Chunk 0/-1/2.5/5/7 were refused. Duplicate ranges were renamed '(2)' in the ZIP. The 4 /Rotate values were kept… |
| Split: encrypted inputs | pass | Owner-password-only file opened without a prompt and gave out/split_owner_only.pdf (unencrypted, pages 2-3). RC4 file: Cancel kept the previous file open with a clear notice; the right password gave out/split_rc4_p4.pdf with page 4 |
| Phone 360px / iPhone 13 / Pixel 7: merge and split end to end | pass | Taps added, moved and merged 3 files, and Download worked (out/phone_360_merge.pdf, 8 pages in the right order). Tapping thumbnails 2 and 4 filled '2, 4'; extract and every-page ZIP downloads worked. scrollWidth always equalled viewport width. Screenshots: shots/phone_360_combo.png and phone_*_*.png |
| Organize: reorder, rotate, delete, restore, insert, rotate all, undo all, delete all | pass | out/org_a4.pdf = [5,1,2(rot90),3,LAND1(rot270),LAND2], exactly as set. Rotate all right on rotated.pdf gave 90/180/270/0. Undo all restored 5 pages. With every page deleted, Save was disabled with a message |
| Organize/Split: deleted or excluded pages removed from the file | fail | out/org_deleted_p1.pdf and out/split_forms_p2.pdf still contain the deleted page 1 as orphan page object 5, and its text was recovered (out/recovered_deleted_page.pdf). See PDF-01 |
| Compress PDF: size targets, readability, rotation, page sizes, CropBox, already-small and impossible targets, photo input, cancel, target validation | pass | Every result met the target within 1024-byte KB. Pages stayed readable at 53 DPI (shots/compress_100kb_crop.png). /Rotate 90/0/270 were kept (shots/compress_rot_compare.png). Already-small and would-not-shrink files kept the original with a clear message. An impossible target gave a warning plus the smallest size. Cancel at page 45/300 left no result and the tool reusable. Targets of 4, 10001, 'abc' and -5 were… |
| PDF to image: count, pixel size, rotation, page range, password, limits | partial | Mixed sizes at 150 DPI gave the exact pixel size for each page (A4 1240x1753, Legal 1275x2100). Rotated pages came out landscape. '2' at 300 DPI gave 2480x3507. 'last' on the AES file gave page 5, and a wrong-case password was rejected. 800 pages was refused (500 limit). The images carry no DPI value (identify reports 72x72, units undefined); see PDF-08 |
| PDF to text: order, completeness, markers, ranges, scans, Hindi | partial | 800 pages: 800 page headings in order and 24,000/24,000 lines. Range 3-4 gives only pages 3-4. Scans are named as having no text. Hindi output out/txt_hindi.txt contains U+0000 and loses ि (see PDF-04) |
| Add page numbers: position on rotated, landscape, mixed and CropBox pages; formats; skip first; start validation | pass | A render-diff (scripts/diffpos.py) found the number upright at the chosen corner on every /Rotate page (bottom-right), on mixed sizes (top-left), inside the CropBox and at bottom-centre on rotated scans. Skip-first left page 1 blank. Start values -1, 1.5, 100000 and empty were refused. 800/800 pages carry their own number |
| Watermark: layouts and angles on rotated/mixed/CropBox pages, all pages, character check | partial | Centred, tiled, top and bottom placements were correct and see-through, with content still readable (shots/wm_check.png). 800/800 pages carry the text. '₹' and Hindi were refused with a clear message. Long text was cut off (PDF-05) |
| Page numbers and watermark output size | fail | See PDF-02: p300 263 KB->3.0 MB, p800 688 KB->20.7 MB, p2000 1 MB->125 MB |
| Image to PDF: A4/Letter/fit, auto/portrait orientation, margins, EXIF, WebP, metadata | pass | out/i2p_auto.pdf: landscape/portrait pages as expected, EXIF-6 photo upright (shots/i2p_auto.png), no camera strings in the PDF. Letter/portrait gave 612x792. Fit gave page size = image px x 0.5 |
| Text to PDF: 150 paragraphs, Letter, page numbers, title, long word, unsupported characters | pass | out/ttp_letter.pdf has 8 Letter pages, title set, 'Page n of 8' on every page, 150/150 paragraphs, the long word broken across lines, and the end marker present. ₹, Hindi, emoji and arrows are listed with replacements; Replace turned ₹->Rs., ->, Yes; Create stays blocked until everything is resolved |
| File checker: PDF metadata, encryption, JS, attachments, forms, mixed sizes, renamed files | partial | Correctly reported author/title/creator, JavaScript, attachments, fillable fields, 4 page sizes, owner-only vs user-password encryption, and text/PNG renamed .pdf. Missed damaged content (garbled.pdf reported clean; PDF-03). truncated.pdf is shown as a 5-page 'Check' while the PDF tools refuse it as incomplete |
| Corrupt / non-PDF / empty inputs across 7 single-file tools | partial | Truncated, text, PNG-renamed and empty files got clear messages on every tool. garbled.pdf is refused by pdf.js tools but accepted by Split/Organize/Watermark/Page numbers with a misleading message (PDF-03) |
| Privacy: network during all jobs | pass | Request logs during every run showed only https://applyready.in/ GETs, with no third-party hosts and no POSTs |

Measurements: Compress (target / time / result): scanned 4.4 MB 3pp -> 500 KB: 0.83 s, 504,832 B (128 DPI); ->100 KB: 0.82 s, 99,995 B (53 DPI, readable); ->20 KB: 78.1 KB with honest 'could not get under' warning; big40 38.5 MB 14pp -> 2000 KB: 3.2 s, 2,006,714 B; p300 -> 200 KB: 22.0 s, original kept (would not shrink). Large docs (p800, 688 KB): open 0.1-0.7 s; split all 0.64 s; page numbers 1.65 s (8 long tasks, max 65 ms); watermark 1.9 s (max 75 ms); text 2.8 s (2 long tasks, max 326 ms, 4 frame gaps >200 ms); organize save 0.66 s; merge 2x800 1.05 s; JS heap <= 42 MB used, performance.memory <= 78 MB. p2000 page numbers 6.0 s (21 long tasks, max 191 ms, total 3.2 s), heap 221 MB. big40 x2 merge 0.71 s, performance.memory 353 MB, output 80.7 MB. PDF to image big40 14pp PNG 300 DPI 3.8 s, 77 MB, ZIP 80.4 MB, 0 long tasks. Output growth: page numbers p300 263 KB->3.03 MB, p800 688 KB->20.7 MB, p2000 1.07 MB->125.1 MB; watermark p300 ->3.50 MB, p800 ->23.95 MB, p2000 ->145.3 MB; LibreOffice 94 pages 1.12 MB->0.54 MB (95 font keys per page). Merge 9 mixed inputs = 29 pages, 97,322 B, 0 external requests, 0 POST requests.

### Batch processing

I tested batch processing on the live site (https://applyready.in/batch-image.html, plus the multi-file modes of compress-image.html and convert-image.html) in headless Chromium 1243. The core engine holds up under real use. In batches of 11, 20, 100 and 300 images (252 MB of input, including twenty 12 MP photos), every requested output was produced. Every ZIP passed unzip -t. Every entry inside matched the requested pixel size, format and KB limit when checked with identify and byte counts. EXIF rotation and transparency came out right. Rejected files were listed with clear reasons. Duplicate names got unique (2)/(3) suffixes. Mouse Cancel stopped a 300-image run in 66 ms, kept the 108 finished images, and Retry completed the remaining 192. The progress bar stayed within 1 point of the real finished count and the time estimate was accurate. The page stayed responsive: 61 fps while scrolling mid-run, longest long task 152 ms (at page load). The 20-image phone run at 360 px worked end to end with no sideways scrolling. The page warned before leaving mid-run and with undownloaded results, and a second batch never mixed in old results. Memory came back after Clear all: blob storage went from 106.6 MB to 0, and the browser's memory use returned to about its starting level. I found no network request to any other site.

Defects found:
- Medium: on a phone, the settings sit below the whole file list (33,101 px down with 300 images).
- Medium: "Download all as ZIP" includes results made with old settings without saying so; the ZIP mixed old JPEGs with new PNGs.
- Low: output names can change after a row is removed or processed again, which contradicts the FAQ's promise that single and ZIP names match.
- Low: a 50.47 MB file is refused with "is 50 MB. The limit … is 50 MB".
- Low: the compressor can make files larger than the originals and still puts them in the ZIP (a per-row note says so).
- Low: after a pure Cancel, the button says "Retry 192 failed and cancelled images" when none failed.
- Two info suggestions: sequence numbers skip failed rows, and KB means 1024 bytes.
- One unverified concern: a ZIP download the browser blocks fails silently and the page still announces success.

Two results here came from the test machine, not the site:
- Non-ASCII ZIP names were saved as "download". This only happened because the container had no UTF-8 locale; with UTF-8, Hindi, Tamil, Bengali and Chinese names saved correctly.
- After 10 single downloads, headless Chromium dropped the 11th (the ZIP), because it has no prompt to allow multiple downloads.

| Feature | Result | Evidence (abridged) |
|---|---|---|
| Multiple file selection via file input with mixed formats (JPEG, PNG with alpha, WebP, GIF, BMP, AVIF, corrupt JPEG, .txt, 0-byte, fake HEIC, PDF renamed .jpg, EXIF orientation 6, 3x photo.jpg from different folders) | pass | 15 files via setInputFiles on batch-image.html. 4 were refused with correct reasons (plain text file, empty (0 bytes), HEIC advice, 'is a PDF document'). 11 were queued. 10 finished and corrupt.jpg failed with 'This image could not be opened. It may be damaged…'. Log: scratchpad/audit/batch/out/t1.log |
| Duplicate file names get unique output names (single downloads and ZIP) | pass | photo.avif became photo.jpg, and the three photo.jpg inputs became photo (2).jpg, photo (3).jpg, photo (4).jpg, the same in the rows, the single downloads and the ZIP. Files: scratchpad/audit/batch/out/t1/single/ and scratchpad/audit/batch/out/t1b/unz/ |
| Output integrity: EXIF orientation, transparency, background colour, metadata stripped | pass | rotated.jpg (stored 1200x800, orientation 6) came out 800x1200 and upright (red marker top-right as expected): scratchpad/audit/batch/out/t1_montage.png. PNG output kept alpha: pixel (0,0)=(0,0,0,0) and the semi-transparent area stayed at alpha 128. JPEG with background #ff0000 gave (254,0,0) in transparent areas (convert test, scratchpad/audit/batch/out/t9/report.json). No EXIF Orientation or GPS tags in any output. |
| Drag and drop with real DataTransfer drop events | pass | Dropped 6 files: the zone gets class 'dragover' during the drag and the drop is preventDefault-ed. 4 were added and 2 refused with reasons. A second drop on the compact zone added 2 more. A drop on the file list (outside the zone) added nothing and the page did not navigate. ZIP had 6 valid entries. Log: scratchpad/audit/batch/out/t3.log |
| Presets: passport, signature, profile, document | pass | 11 mixed inputs each, including two 12 MP photos. Every ZIP entry was checked with identify and byte size: passport 350x450 and at most 51,200 B; signature 300x100 and at most 30,720 B (padded); profile 400x400 and at most 102,400 B; document within 1240x1754 and at most 512,000 B. Every ZIP passed unzip -t. Results: scratchpad/audit/batch/out/t2/results.json |
| Custom modes: fit with min and max KB, scale to PNG, pad to WebP, keep size with max KB, fill without Allow smaller dimensions at 10 KB | pass | fit 800 wide, 20 to 40 KB: all entries between 20,480 and 40,858 B, and small files were padded to 20,480. Scale 25% PNG: exact quarter sizes and alpha kept. Pad 600x600 WebP under 60 KB: all 600x600 WEBP. Keep size, 100 KB: all at most 102,382 B; PNG shrank to 203x270 with a note explaining why. Fill 1000x1000 at 10 KB: all 1000x1000 at most 10,192 B, quality down to 6% with a warning note.… |
| convert-image.html multi-file (default JPEG 92, PNG, WebP, JPEG on a red background) | pass | 13 files in: 2 refused, 10 converted, corrupt file failed with a reason. Each ZIP had 10 entries of the right format and the original dimensions, and passed unzip -t. scratchpad/audit/batch/out/t9/report.json |
| compress-image.html multi-file (default: keep format, 100 KB; and JPEG 20 KB) | partial | All outputs were at or under the limit (at most 102,382 B and at most 20,478 B), and PNG stayed PNG. But 4 of 10 outputs were larger than their originals (alpha.png 4.7 KB became 14 KB, among others) and were still put in the ZIP; see BAT-05. scratchpad/audit/batch/out/t9/report.json |
| Batch of 10/11 images | pass | Every preset and mode above ran on 11 images in 0.6 to 1.9 s, and every ZIP was verified entry by entry. |
| Batch of 100 images (compress-image.html) | pass | 100 done in 18.1 s, ZIP compressed-images.zip with 100 entries, unzip -t OK, all at most 102,400 B, and every entry decoded cleanly (identify -regard-warnings). scratchpad/audit/batch/out/t4_c100/report.json |
| Batch of 300 images with 12 MP photos, ZIP verification | pass | 300 done, ZIP with 300 entries, unzip -t OK, all names from outputNames() present, all JPEG within 1600 px and at most 204,800 B, and all decoded cleanly. scratchpad/audit/batch/out/t4_b300/report.json |
| Progress indicator accuracy and time estimate | pass | Sampled every 2 s over the 300-image run: bar width within 1 point of the real finished share, text count within 1 of the real count, and the 2 s estimate (30 s) close to the actual 32.6 s. Samples in scratchpad/audit/batch/out/t4_b300/report.json |
| Cancel mid-run by mouse, then Retry by mouse | pass | Mouse click on Cancel at 36% stopped processing in 66 ms; 108 done were kept and 192 marked Cancelled (row text 'Cancelled'). Retry re-queued the 192 and the run finished with 300 done. Screenshot: scratchpad/audit/batch/out/t4_b300/after_cancel.png |
| Keyboard Start and Cancel safeguards | pass | Enter on Start moves focus to Cancel. A second Enter 100 ms later did not cancel; an Enter 1.5 s later did (33 cancelled, 27 kept). Focus then went to the verdict heading. scratchpad/audit/batch/out/t10.json |
| Browser responsiveness during a run | pass | 61 fps measured with rAF mid-run, a 1,500 px wheel scroll took effect in under 452 ms, longest long task 152 ms (at page load), and none over 200 ms. |
| Memory over a 300-image batch and after Clear all | pass | Blob storage 106.6 MB when done, 0 MB after Clear all. Memory for this browser's processes: 1,051 MB when done, 866 MB after Clear, 846 MB a minute later (812 at load). All 22 thumbnail object URLs revoked. scratchpad/audit/batch/out/t7_mem_300.log |
| Failed files listed with reasons, single-row Retry, over 50 MP, over 50 MB, 500-image cap | partial | The 56 MP JPEG failed with 'This image is 56 megapixels (8000 × 7000 px)…'. Row Retry on failed files works and keeps the reason. 300+300 files were capped at 500 with 'Only 200 more images fit…', and the warning above 300 MB showed (418 MB). The 52,920,054-byte BMP was refused, but the message rounds its size down to the limit (BAT-04). scratchpad/audit/batch/out/t10.json |
| Adding and removing files while a run is in progress | pass | 5 files added mid-run were picked up ('Processing: 25 of 29 finished'). Removing a waiting row mid-run left the totals consistent (28 total, 26 done, 2 failed). scratchpad/audit/batch/out/t10.json |
| ZIP file name field | pass | 'BCA 2026/27 roll' saved as 'BCA 2026-27 roll.zip'; 'my-batch.zip' as 'my-batch.zip'; empty or spaces as 'applyready-images.zip'; 'con' as 'images_con.zip'; 'a:b*c?d' as 'a_b_c_d.zip'; '..' as 'zip.zip'; 60 characters kept. With a UTF-8 locale, Hindi, Tamil, Bengali and Chinese names were kept. Without one, the test container saved them as 'download', which comes from the environment, not the site.… |
| Naming modes (keep, add a word, number in order) | partial | Add a word gives photo1_final.png and photo_final (2).png. Number in order gives roll-001 to roll-005. When a row failed, numbers skip (image-002.jpg, image-004.jpg) and names shift after removals; see BAT-03 and BAT-07. scratchpad/audit/batch/out/t5/report.json, scratchpad/audit/batch/out/t12/report.json |
| Leaving the page mid-batch or with undownloaded results (beforeunload) | pass | A beforeunload dialog appeared when clicking the home link while 17 images were queued and 2 processing, and again with undownloaded results; dismissing it kept the page. No dialog appeared after everything had been downloaded. scratchpad/audit/batch/out/t5/report.json, scratchpad/audit/batch/out/t12/report.json |
| Clearing the list (confirm dialog, clear while running) | pass | Clear with undownloaded results shows 'Clear all images? 1 finished image has not been downloaded…' and Escape keeps the items. Clear while running stops the work: 0 items left and the progress panel hidden. scratchpad/audit/batch/out/t5/clear_confirm.png, scratchpad/audit/batch/out/t12/report.json |
| Second batch after the first (no stale results) | pass | After Clear all, the result panel and old-settings notice were hidden, and the second ZIP held only the 2 new files (alpha.png, photo.png). The same held after clearing a running batch. scratchpad/audit/batch/out/t5/second/ |
| Settings changed after processing (old-settings notice, Process again) | partial | Rows show 'Done, old settings' and the notice appears; Process again re-made all 5 as PNG. But the ZIP offered meanwhile mixed old JPEG results with new PNG ones without a warning (BAT-02). |
| Individual downloads | pass | Single downloads of all 10 done rows had the expected names and bytes. The failed row shows no download button. scratchpad/audit/batch/out/t1/single/ |
| Phone 360px: 20-image batch to ZIP end to end | pass | Pixel 7 emulation at 360x740, using taps: the file chooser allows multiple files; 20 added; Profile preset; Process; Cancel visible during the run; 20 ready; ZIP tapped; ZIP has 20 entries, all JPEG 400x400 and under 100 KB, unzip -t OK; page width 360 at every stage. scratchpad/audit/batch/out/t8_phone_Pixel7/report.json, scratchpad/audit/batch/out/t8_phone_montage.png |
| Privacy: no requests to other sites during processing | pass | Every request recorded during the mixed-format run went to https://applyready.in/ (or blob:/data:); no console errors. |

Measurements: 300-image batch on batch-image.html (252 MB input, 20 of them 12 MP; fit 1600x1600, JPEG, max 200 KB; 2 workers on 4 CPUs): files added in 0.55 s; whole run including Cancel and Retry 32.6 s; Cancel stopped work 66 ms after the mouse click (108 done kept, 192 cancelled); ZIP of 300 entries / 59.8 MB built in 0.62 s; entries 187,604 to 204,761 bytes (all at most 204,800); long tasks 3 in total, longest 152 ms (at page load, none during processing); 61 fps and a 1,500 px wheel scroll in 452 ms mid-run. Progress bar vs real finished share: 6% vs 5.7%, 32% vs 31.3%, 70% vs 69.3%, 100% vs 100%. Time estimate at 2 s: "About 30 seconds left"; actual total 32.6 s. Memory for the same 300-image batch (only this browser's processes): total memory in use 812 MB at load, 869 after adding, 1,051 when done, 866 after Clear all, 846 a minute later. Blob storage: 581 entries / 106.6 MB when done, 311 / 57 MB once the ZIP link expired, 0 / 0 MB after Clear all. Second identical batch: 94.8 MB when done, 42.1 MB 1.5 s after Clear (garbage still waiting for the workers' memory clean-up). JS heap 0.9 MB at load to 2.9 MB at peak to 2.6 MB after Clear. Object URLs: 22 thumbnail URLs created (only for visible rows), all 22 revoked by Clear all. 100-image compress-image.html run (83 MB input, keep format, max 100 KB): 18.1 s; entries 97,453 to 102,382 bytes (all at most 102,400); longest long task 54 ms. Phone (Pixel 7 emulation at 360x740), 20 images with the Profile preset: page width stayed 360 px at every stage; ZIP had 20 entries, all 400x400 and under 100 KB (about 22 to 25 KB). Phone layout: with 20 images the Preset field is at y=2,695 px; with 300 images at y=33,101 px (the list runs from 435 to 33,014 px).

### Cyber cafe workspaces

I audited cyber cafe mode (https://applyready.in/workspace.html, from commit 92f7ef0; the live workspace.js matches the checkout byte for byte) in real Chromium against the live site, playing an operator serving several applicants in a row. Each applicant's work stays separate. In every test, files, results, jobs, ZIPs, combined PDFs and download names went only to the applicant who owned them. That held through 60 fast tab switches while 5 tasks ran, a drop or paste followed at once by a switch, a password-protected PDF, a ZIP made while another applicant was on screen, and Finish while a task or a ZIP was running. After Finish, End session and reload I checked localStorage, sessionStorage, IndexedDB, Cache Storage, cookies, the DOM and the heap. None held applicant data, and every old blob: URL failed to fetch. One exception: the screen-reader message region kept a finished applicant's file name. The only network requests were same-origin GETs and blob: URLs, and outputs had no EXIF or GPS data. Photo and signature outputs matched the session size and KB settings (checked with identify and byte counts). Combined and merged PDFs were correct (pdfinfo and pdftoppm), and every ZIP passed unzip -t. The ZIP name handled 'Ravi S/O Ramesh', names with < > ", 'CON' and unicode safely. The reload, close and navigate-away warnings, and clearing the page on Back, all worked. A whole applicant could be completed on 360px, Pixel 7, iPhone 13, and 768px and 1024px tablet widths, with no horizontal scroll and no tap targets under 24px. I found 6 problems, all reproduced. Medium: (1) the hidden screen-reader message region keeps the last failure message, including the file name, after Finish and End session; (2) single-file downloads carry nothing that says whose they are, so two applicants' files get the same name, the mix-up the page itself warns about. Low: (3) a download that is cancelled still counts as downloaded, and Finish then deletes everything without asking; (4) adding more files than the 50-file limit shows two messages that contradict each other. Info: (5) pasting a picture while the cursor is in the name box does nothing, with no message; (6) the Finish confirmation can be out of date if a ZIP finishes while it is open. Notes that are not defects: non-ASCII ZIP names arrived as 'download' only because this test machine had no UTF-8 locale; with LANG=C.UTF-8 Chromium kept them. A heap snapshot after Finish still held one string with the ZIP's name, from a detached download link referenced inside Chromium's own soft-navigation tracking. The page's own data no longer held the name, and the password was gone from the heap.

| Feature | Result | Evidence (abridged) |
|---|---|---|
| Create several applicants, name them, switch with tabs (desktop) and select (phone) | pass | t1/t3/t6: 3 applicants created (Ravi S/O Ramesh, Priya <b>"Q"</b> Sharma, रवि कुमार Ñúñez). The name is shown as text, not HTML: 0 <b> elements were injected into #workspaceApp, and the tab HTML is escaped (out/t1/report.json). On narrow screens #wkSwitch shows (360, Pixel 7, iPhone 13) and on tablets the #wkTabs (768/1024). |
| Add photos, signatures, scans and PDFs; a non-image is refused | pass | t1: notimage.jpg was refused with 'is a plain text file...'. JPEG, PNG and PDF were listed with pixel size and page count. Password protected flagged for locked_B.pdf. Screenshot shots/t1-a-results-crop.png. |
| Passport photo, Signature, Compress to KB and Convert to JPEG match the session settings | pass | identify: A_photo_A-photo.jpg 350x450 50,341 B; sig 300x100 4,191 B; scan 710x1005 101,086 B (out/t1). Custom 200x230/20 KB gave 20,108 B; signature 140x60 as PNG gave 2,782 B (out/t8). Too small a limit (5 KB at 3000x3000) shows a clear message pointing to Session settings. A setting out of range (width 5) is blocked with a field error. |
| Combine an applicant's images and PDF into one PDF; merge PDFs | pass | pdfinfo A_photo_A-combined.pdf: 4 pages, A4, 303,504 B. pdftoppm montage shots/t1-pdfs-montage.png shows PHOTO-A, SCAN-A and PDF-A pages only. B merged 4 pages, not encrypted, PDF-B pages only. |
| Compress PDF to limit (rasterised) and 'already under limit' path | pass | big_C-500kb.pdf: 3 pages, 500,344 B ≤ 512,000 B. doc_A.pdf kept unchanged at 90,200 B, with a note saying so. |
| Password-protected PDF goes to the right applicant (combine and single compress; cancel and wrong password) | pass | t1/t8: the dialog names the file of the active applicant. A wrong password shows 'That password is not right'. Cancel gives the error on that applicant's file row. The 2nd applicant with the same locked file is asked for the password again (pwAskedAgainForSecondApplicant=true). After Finish, 'secret123' is not in the heap (out/t9). |
| Single-file downloads and per-applicant ZIP; names made safe | pass | ZIP names: 'Ravi-S-O-Ramesh-2026-11-18.zip', 'Priya-b-Q-b-Sharma-2026-11-18.zip', '<>"' gives 'Applicant-1', 'CON' gives 'BCA 2 CON 1905.zip'. Pattern '{n} {applicant} {time}' works; 'a:b*c' is rejected. unzip -t passes for every ZIP (out/t1, t3, t6, t8). The duplicate-name warning works ('con' vs 'CON'). |
| Unicode applicant name in the ZIP name | pass | zipName gives 'रवि-कुमार-Ñúñez-2026-11-18.zip'. Chromium kept that name when launched with LANG=C.UTF-8 (scripts/t_dlname.js). The earlier 'download' fallback (out/t1 zipNameC) came from this test machine having no UTF-8 locale, not from the site. |
| Separation while switching quickly during processing | pass | t3: 5 tasks across A and B and 60 switches at 50 ms. switchLeaks=[]. Results A = photo_A/big_C/scan_A, B = photo_B/scan_B. Average colour of the ZIP JPEGs: A red (183,68,67), B green (67,154,67) (out/t3). |
| Drop and paste a file while another workspace is or becomes active | pass | t3: a drop on A followed at once by a switch to B put the file in A only. Paste with B active went to B. Paste then an immediate switch to A put doc_B.pdf in B only (out/t3/report.json). |
| ZIP made for B while A is on screen; Finish during ZIP; Cancel ZIP | pass | t3: zipBNameWhileOnA='Beta-Two-...zip' with B content only. t5 (ZIP slowed by wrapping createZip in the test): Cancel led to no download. Finish during the ZIP shows a confirm ('1 running task will be stopped'), then no download and state empty (out/t5). |
| Finish applicant / End session confirmations (download-before-delete safeguard) | partial | Shown correctly for 'not downloaded', 'files but no results' and 'task running' (out/t2, t4, t5). Finish with everything downloaded deletes with no prompt, and a cancelled download still counts as downloaded (CAF-03). |
| Reload, close tab, navigate away, Back/bfcache | pass | t4: beforeunload appears on reload, page.close({runBeforeUnload}) and a footer link. Dismissing it keeps the data. After accepting navigation and pressing Back: view=start, applicants=[], name not in the DOM (shots/t4-after-back.png). |
| Storage after End session and reload: localStorage, sessionStorage, all IndexedDB, Cache Storage, cookies | pass | t2 dumpAll: only applyready_recent_tools=["workspace"]. No IndexedDB databases, no cookies. Cache Storage holds only site assets (21 + pdf-lib). storageHits=[] for every name, file name and the password (out/t2/report.json). |
| Object URLs revoked after Finish and End session | pass | Every createObjectURL was recorded. After End, 0 of 8 fetch (TypeError). After Finish (not End), 0 of 6 fetch. After reload, 0 (out/t2, out/t8). |
| DOM and live regions after Finish and End session | fail | Tabs, list, select, name input and dialogs are all cleared (domHits=[] in t2). But the hidden screen-reader message region still holds 'Compress PDF to 500 KB did not work: kappa_heaplook_locked.pdf ...' 8 s after Finish and after End session (out/t10/report.json). See CAF-01. |
| JS heap after Finish and End | partial | After Finish, no strings with the file names or the password remain (out/t9). One string with the ZIP's download name stays, held inside Chromium's own soft-navigation tracking by a detached link. The page's code cannot reach it. Not counted as a site defect. |
| Undo in the name field after Finish/End | pass | Ctrl+Z in the next applicant's empty name field gives '' (out/t2). |
| Metadata stripping and network silence | pass | t11: a JPEG with GPS and Make/Model EXIF went through all 4 image actions and combine. No GPS or EXIF in any output. Requests during work were only same-origin GETs and blob:. |
| Whole applicant at 360px, Pixel 7, iPhone 13, 768 and 1024 tablet (touch taps) | pass | t6: add, name, files, 3 actions, select+combine, single download, ZIP, 2nd applicant, switch, Finish and End all worked. scrollWidth equals the viewport everywhere, smallTargets=[] (shots/t6-*.png, out/t6/report-all.json). |
| 50-file per-applicant cap | partial | Added 52 files to an applicant who already had 1. Count is 50 (correct), but the two messages shown contradict each other (CAF-04). |
| No third-party requests | pass | t1 requestsNonSelf=[] over the whole 3-applicant run. |

Measurements: Default passport photo 350x450 at 50 KB limit: 50,341 / 50,292 / 50,405 bytes (shown as 49.2 KB, under 51,200 bytes). Default signature 300x100 at 30 KB: 4,191 bytes. Compress scan to 100 KB: 710x1005, 101,086 bytes (limit 102,400). Custom settings: photo 200x230 at 20 KB gave 20,108 bytes; signature 140x60 as PNG at 10 KB gave 2,782 bytes. big_C.pdf (2.34 MB, 3 pages) compressed to 500 KB gave 500,344 bytes, 3 pages, A4. Combined PDF for applicant A: 4 pages, 303,504 bytes. Merging doc_B with the password-protected locked_B gave 4 pages, 179,878 bytes, not encrypted. Separation: 0 leaks in 60 tab switches while 5 tasks ran. After End session: 0 of 8 old blob: URLs could be fetched (after Finish: 0 of 6). Storage before, during and after: localStorage only {applyready_recent_tools:["workspace"]}; sessionStorage, IndexedDB and cookies empty. The service-worker cache held 21 + 1 site assets and no applicant entries. Requests during processing: only same-origin GET and blob:, none to other hosts. The page at 360px is about 6,884 CSS px tall with 4 files; widest element is 360px, no horizontal scroll.

### Navigation and usability

I tested navigation, search and usability on the live site https://applyready.in at 1280x800 and at 360x740 (touch emulation in Chromium). The core navigation works well. From the home page every requested task is reachable in 1–3 clicks. Breadcrumbs on all 24 tool pages name the right category and link to it. The 71 internal links I checked in main content all return 200, and all 9 anchors exist. Category order is the same in the header menu, the phone menu, the home page and tools.html. Search is fast (median 1 ms per query) and the combobox and keyboard behaviour is correct: arrow keys, Enter, Escape and focus return all work, and "/" is ignored while typing. Recently used tools appear on the home page and can be switched off.

The real problems are in search relevance. Queries that give a file size as a number ("pdf 300kb", "pdf 2 mb", "200kb pdf") and Hinglish verbs ("pdf chota karna", "pdf milana") are not understood. The ranking then falls back to popularity, so Merge PDF comes first and Enter opens the wrong tool. "signature 10kb" puts Signature cleaner first (an alphabetical tie-break), and "photo 30kb" puts Passport photo tools first. Several common Indian application words (aadhaar, marksheet, thumb impression, backup, offline) return no results. Some unsupported requests return unrelated tools: "dark mode" gives Organise PDF pages, "clear history" gives Changelog, and "unlock pdf" gives Merge PDF.

Smaller problems:
- Privacy and "Your data" (where you delete data) are not in the header or the phone menu. Reaching them by browsing on a phone takes about 3,100–4,650 px of scrolling.
- On phones, Resume builder sits inside a one-item accordion, so it takes 3 taps from any page.
- The labels "Most used" and "Popular tools" sit oddly on a site that says it has no analytics.
- A trailing-slash tool URL (/merge-pdf/) gives a 404 page with no suggestion.
- Tools listed under two categories inflate the counts (26 menu entries for 21 tools).

The home page is not a giant catalogue: 2,364 px at 1280 (every category within 173 px of scrolling) and 5,185 px at 360, about 7 screens, with some repeated listings.

| Feature | Result | Evidence (abridged) |
|---|---|---|
| Home page size and catalogue check (1280 and 360) | pass | scrollHeight is 2,364 px at 1280 and 5,185 px at 360, with no horizontal overflow. At 1280 all 6 category cards are within 173 px of scrolling. At 360 the last category (Cyber cafe) is at y=2297. The home page is not a giant catalogue, though the phone repeats tools in the hero, the categories, Most used and the footer. Screenshots: shots/home-desk-full.png, shots/home-phone-full.png, shots/home-phone-fold.png. |
| Find Resume builder from home | pass | 1280: header 'Resume builder' link, 1 click, 0 px. 360: hero 'Create or edit a resume' at y=522, 1 tap, 0 px, 289 ms. From other pages on a phone it takes 3 taps (see NAV-04). out/task-paths.json |
| Find Image resizer | pass | Hero 'Resize a photo or signature' goes to image-resizer.html: 1 click, 0 px at both widths (193 ms / 175 ms). |
| Find Image compressor | pass | 1280: Tools menu, then Image compressor: 2 clicks, 0 px, 844 ms (or the home card link with 37 px of scrolling). 360: menu, then Image tools, then Image compressor: 3 taps, 1,462 ms (or 625 px of scrolling). |
| Find Signature resizer | pass | 1280: home Image tools card, 1 click (0–210 px). 360: 3 menu taps, or 585 px of scrolling plus 1 tap. |
| Find Merge PDF | pass | 1280: home PDF card, 1 click (0–109 px). 360: 3 menu taps, or 833 px of scrolling. |
| Find Batch processing | pass | 1280: Tools menu, 2 clicks, or the home Batch card with 260 px of scrolling. 360: 3 menu taps, or 1,319–1,427 px of scrolling. |
| Find passport photo tool | pass | 1280: home card, 1 click. 360: 3 menu taps. Search 'passport', 'pasport photo' and 'photo 35x45' all rank Passport photo resizer first. |
| Find a tool to make a photo under 50 KB | partial | Browsing: All tools, then the '50 KB' chip on the Image resizer card: 2 clicks (85 px at 1280, 292 px at 360). The home page and both menus have no direct entry. Search 'photo 50kb' and 'photo under 50 kb' rank 'Resize image to 50 KB' first, but other numbers fail: 'photo 30kb' and 'photo 40 kb' rank Passport photo resizer first (NAV-01). |
| Find a tool to combine certificates into one PDF | pass | Hero 'Turn scans into one PDF – Photos of certificates, in order' goes to image-to-pdf.html in 1 click. Search 'combine certificates' gives Merge PDF then Image to PDF; 'certificate pdf' gives Image to PDF then Merge PDF. Both are relevant. |
| Find Applicant workspaces | pass | 1280: Tools menu, 2 clicks. 360: menu, then Cyber cafe tools, then Applicant workspaces, 3 taps. Search 'cyber cafe', 'workspace' and 'shared computer' rank it first. |
| Find privacy information | partial | Not in the header or the phone menu. Home link 'How your data is handled' needs 976–1,298 px of scrolling at 1280 and 3,119–3,619 px at 360. Search 'privacy' and 'is it safe' rank Privacy first. See NAV-03. |
| Find how to delete my data | partial | The only browse path is the footer 'Your data' link: 1,280–1,601 px of scrolling at 1280 and 4,147–4,647 px at 360. Alternatively, privacy.html section 3 links to Your data (y=3952 at 360). Search 'delete my data' ranks Your data first. your-data.html has 'Delete everything' at y=1366 (1280) / 2099 (360). See NAV-03. |
| Global search: 81 realistic queries in the live dialog, plus 55 more against the identical local search.js | partial | Good results: 'cv', 'biodata', 'resume banana', 'resme', 'signatre', 'mrege pdf', 'merge', 'jpg to pdf', 'pdf to jpg' (PDF to images only), 'word to pdf' (an honest page explaining there is no Office conversion), 'excel to pdf', 'compress pdf 100kb', 'photo 35x45', 'scan', 'delete my data', 'signature 20kb', 'cyber cafe', '4x6', 'rotate pdf', 'delete pdf page', 'pdf to word' (Extract text). Wrong first result:… |
| Search latency | pass | Live dialog, 81 queries: median 1.0 ms, max 10.7 ms. Opening the dialog with lazy-load on split-pdf.html: 109–110 ms (2 runs). Results 37 ms after typing. Enter to destination loaded: 119–126 ms. |
| Search keyboard: / and Ctrl+K, arrows, Enter, Escape, focus return | pass | '/' on home opens the dialog with focus in the combobox. ArrowDown/ArrowUp move aria-activedescendant through Merge PDF, then the guide, then Image to PDF, and wrap around. Escape closes the dialog. Closing returns focus to #searchOpen when opened from that button, and to #navMenuToggle when opened from the phone menu's 'Search tools'. Ctrl+K inside the home inline box opens the dialog, and Escape returns focus… |
| Search screen-reader semantics | pass | The input has role=combobox, aria-autocomplete=list and aria-controls pointing to a ul role=listbox, which is labelled 'Results', 'Popular tools' or 'Recently used'. Each li has role=option and aria-selected. aria-expanded is true when there are results and false when there are none. A polite live region announces '8 results' or 'No results'. The dialog has role=dialog, aria-modal and a label, and the page behind… |
| No-results behaviour | pass | 'aadhaar' shows 'No tool matches “aadhaar”. Try fewer words, or browse all tools.' with a link, and the live region says 'No results' (shots/home-inline-noresult-desk.png). On tools.html, 'word to pdf' shows 'These pages may help: Word to PDF' (shots/dir-filter-wordtopdf-phone.png). |
| Tool directory (tools.html) filter and categories | partial | Six sections in registry order. ?q=merge pre-fills the filter (2 tools match). Escape clears it. A typo ('mrege') still finds Merge PDF. Weak spots: 'pdf jodna' shows all 12 PDF-related cards including Resume builder and File checker, and 'photo size kam karna' shows 8 cards, so the Hinglish word is ignored. Tools appear under two categories each (see NAV-05). |
| Category order across header menu, phone menu, home, directory and footer | pass | Resume, Image tools, PDF tools, Document tools, Batch processing, Cyber cafe tools: identical in #toolsMenu, the phone accordion, the home cat-grid and the tools.html dir-nav. The footer groups them the same way. shots/tools-menu-desk.png, shots/phone-menu-open.png. |
| Desktop Tools menu keyboard | pass | Tab order: Skip to content, logo, Tools, Resume builder, Guides, Search. Enter opens the menu. ArrowDown moves through the links and End goes to All tools. Escape closes the menu and returns focus to the Tools button. ArrowDown on the button opens the menu and focuses the first link. |
| Breadcrumbs on every tool page | pass | All 24 tool pages (including 3 preset pages) follow Home(/) > <registry category>(tools.html#<cat>) > <tool>, and the category matches the registry every time. All tools.html#cat anchors exist. Info pages show Home > <page>. offline.html has no breadcrumb, which is fine for an offline fallback. out/crawl.json |
| Related tools and guides sections | pass | Every tool page links to relevant guides. Four pages (signature-cleaner, passport-photo-print, image-to-pdf, compress-pdf) have a 'Related tools' block with sensible picks, e.g. image-to-pdf lists Merge, Compress and Organise. The other tool pages link related tools inline, e.g. merge-pdf links compress, image-to-pdf, organize and split. Resume builder has no links to other tools. All 71 checked internal links… |
| Direct tool URLs | partial | /merge-pdf and /tools (no extension) return 200. /guides redirects 301 to /guides/. Old /resize-image-to-10kb.html, /resize-image-to-100kb.html and /resize-image-to-200kb.html redirect to the KB-limit page. On the 404 page, /resume-builder, /passport-photo and /Merge-PDF.html all get correct suggestions. /merge-pdf/ (trailing slash) gets a 404 with no suggestion (NAV-06). shots/nf-*.png |
| Recently used tools: appears and can be turned off | pass | After visiting compress-pdf, signature-resizer and workspace, the home page shows 'Pick up where you left off' with those 3 tools, and the empty search dialog shows 'Recently used'. Switching off 'Remember the tools I use' on your-data.html removes the localStorage key and sets applyready_recent_off=1. After the next tool visit the home section stays hidden and nothing is recorded. The home section has no link to… |
| Phone menu and search dialog at 360px | pass | The menu sheet shows Search tools, 6 category accordions with counts, All tools and Guides, and fits in 684 px. The search dialog fills the screen (360x740) with a Close button and 8 results visible (shots/phone-search-dialog-compress.png). With the keyboard simulated by shrinking the viewport to 420 px, the inline home box scrolls into view and 2 results stay fully visible (shots/phone-inline-keyboard-open.png). |

Measurements: Home height: 2,364 px at 1280x800, 5,185 px at 360x740 (scrollWidth 360, so no sideways scrolling). Scroll needed to reach each home category heading at 1280: Resume, Image and PDF 0 px; Document, Batch and Cyber cafe 173 px. At 360: Resume 940→200 px, Image 1108→368, PDF 1455→715, Document 1783→1043, Batch 2030→1290, Cyber cafe 2297→1557 (y→scroll needed).  Task paths from home, run on the live site with real clicks (out/task-paths.json): - At 1280:   - Resume builder: 1 click via the header (0 px).   - Image resizer: 1 click, 0 px, 193 ms.   - Image compressor: 2 clicks via the Tools menu, 0 px, 844 ms (or 1 click plus 37 px).   - Signature resizer: 1 click, about 0–210 px.   - Merge PDF: 1 click, about 0–109 px.   - Batch: 2 clicks via the menu (or 1 click plus 260 px).   - Passport photo: 1 click, about 0–278 px.   - Photo under 50 KB: 2 clicks (All tools, then the 50 KB chip), 85 px, 455 ms.   - Combine certificates: 1 click on the hero "Turn scans into one PDF", 0 px.   - Workspaces: 2 clicks via the menu (or 1 click plus 281 px).   - Privacy: 1 click plus 976–1,298 px.   - Delete data: 1 click on the footer "Your data" plus 1,280–1,601 px. - At 360:   - Resume and Image resizer: 1 tap on a hero task, 0 px.   - Compressor, Signature, Merge, Batch, Passport and Workspaces: 3 taps each via the menu (menu, category, tool), 0 px, about 1.4 s each.   - 50 KB: 2 taps plus 292 px.   - Certificates: 1 tap plus 10 px.   - Privacy: 1 tap plus 3,119–3,619 px.   - Delete data: 1 tap plus 4,147–4,647 px. Not in the menu.  Search: - Latency per query in the live dialog: 81 queries, median 1.0 ms, max 10.7 ms (the first, cold query). - Opening the dialog with "/" on a tool page, including lazy-loading the index: 109–110 ms (two runs). - Typing to results: 37 ms. Enter to destination loaded: 119–126 ms. - Opening with "/" on home: 42 ms.  Other sizes: - Desktop Tools menu: 476 px tall, 32 tool links for 21 distinct tools. - tools.html height: 2,855 px at 1280, 5,366 px at 360. - Search index: 65 items (24 tools, 13 pages, 28 guides).

### Privacy and security

Privacy and security audit of https://applyready.in at commit 92f7ef0. I fetched 130 HTML, JS and CSS files from the live site and all were byte-identical to the checkout. I used every listed tool with real files in Chromium (desktop, plus Pixel 7 and iPhone 13 emulation) and recorded every request three ways: Playwright context events, which include service-worker and worker requests, CDP, and a full Chromium net-log (29 runs). Page-initiated traffic was 2,611 GET requests, all to applyready.in, apart from 2 deliberate probes of my own. There was no POST or PUT, no file bytes and no user data in any request. No third-party origin was contacted, and the Razorpay link was only reached when clicked. All 67 pages carry the same strict CSP meta tag, with no inline scripts or handlers, no cookies, and noopener on every target=_blank link. Browser storage matches the privacy.html table exactly. 'Delete everything' removed the database, settings, caches and the service worker. With saving turned off, nothing typed was stored. The service worker caches only site files keyed by content hash, never user files or blob/data URLs. I tried more than 100 XSS payloads (in file names, 55 resume fields, imported JSON, EXIF, PDF and DOCX metadata, workspace names, text to PDF, search, URL parameters, hash and 404 paths) and none was injected or executed. Zip bombs, path-traversal entries, nested PDFs and 400-megapixel / 3,600-megapixel PNGs were handled without hangs in the file checker, resizer, batch tool, merge, workspace and compress-PDF (PDF input). Vendored libraries are current (pdf.js 6.5.438, which is past the CVE-2024-4367 fix, and it uses no eval). npm audit reports 0 vulnerabilities and licence files are present. Defects found: (1) medium: the meta CSP does not cover Web Workers, and from inside both the pdf.js worker and the image worker a fetch to another site went out, so privacy.html's 'its security policy blocks it' is stronger than what is enforced. (2) medium: Image to PDF, the passport print sheet, the signature cleaner and Compress PDF's image input do not enforce the documented 50-megapixel cap; one 380 KB PNG pushed browser memory up by about 2 GB. Several low and info items cover Windows reserved names in ZIP entries, PDF phone links, Image to PDF type checking, framing, stale display in open tabs, and missing headers.

| Feature | Result | Evidence (abridged) |
|---|---|---|
| Live site equals the audited commit | pass | curl of 130 tracked html/js/css files from https://applyready.in compared by md5 with /home/user/applyready: 0 differences. |
| CSP meta on every page (script-src, connect-src, frame-src, object-src, base-uri, form-action) | pass | crawl.js visited all 67 pages (sitemap plus 404, offline, feedback, your-data). One identical policy: default-src 'self'; script-src 'self'; connect-src 'self' blob: data:; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'; style-src allows 'unsafe-inline'. The meta tag comes before any script, link or style on every page. 0 inline scripts other than JSON-LD and 0 inline on* handlers.… |
| No third-party requests and no cookies while browsing every page | pass | crawl.json summary: 1,097 requests, all to https://applyready.in, all GET. document.cookie and context.cookies() empty on every page. |
| Network while using tools with real files (resume type and export, image resizer, batch, merge, compress PDF, file checker, workspace, text to PDF, image to PDF, PDF to image, signature cleaner, passport print) | pass | Playwright context request log (includes service-worker and worker requests) plus Chromium net-log in out/netlog-*.json, tallied in out/netlog-summary.txt: every page-initiated request was a GET to applyready.in. No POST or PUT, and no query strings except ?v=/?sw= cache keys and the URLs I typed myself. Same result under Pixel 7 and iPhone 13 emulation (out/mobile.json). |
| Razorpay donation link | pass | razor.js: 0 external requests before the click. On click a GET to pages.razorpay.com with Referer https://applyready.in/ (origin only, no resume id). target=_blank rel=noopener, and window.opener is null in the new tab. |
| External links: rel=noopener and https only | pass | crawl.json: 0 target=_blank links without noopener and 0 http:// links on 67 pages. 49 distinct external targets, all https. Links generated in the resume preview carry rel='noopener noreferrer'. |
| GitHub Pages response headers | partial | out/headers.txt: http→https 301 and www→apex 301 work. No Strict-Transport-Security, X-Content-Type-Options, X-Frame-Options, CSP header or Permissions-Policy. access-control-allow-origin: * on everything. Referrer policy is set by meta (strict-origin-when-cross-origin) on all 70 HTML files. See SEC-07. |
| Storage matches privacy.html table | pass | storage.js snapshots after each tool (out/storage.json): only applyready_theme (only after the toggle), applyready_recent_tools, applyready_recent_off (only after turning the list off), IndexedDB 'applyready' (meta: lastResumeId, persistAsked, resumeSaving; resumes), caches applyready-files and applyready-vendor-*. No sessionStorage, no cookies. Workspace names, file-checker files and text-to-PDF text are never… |
| Resume saving turned off (shared computer) | pass | storage.js: after unchecking #chkSaveDevice and typing SAVINGOFFMARKER, IndexedDB held only meta.resumeSaving='off'. The marker was absent from all storage and the form was empty after reload. |
| Your data lists and deletes everything | pass | storage.js: listing showed the resume, the legacy draft, 6 recent tools, theme, storage use and the offline copy (174 files, 3.4 MB). After 'Delete everything': localStorage had only an unrelated non-applyready key, sessionStorage applyready_* was removed, there was no IndexedDB and no caches, and service-worker registrations went from 1 to 0. Screenshots shots/yd-before.png and shots/yd-after.png. |
| Delete everything while a resume tab is open | pass | multitab.js: tab A showed 'This resume was deleted in another tab. What you see here is not saved.' Further typing in tab A wrote nothing (IndexedDB stayed empty). An already-open home-page tab still displayed the deleted resume name (SEC-08). |
| Service worker caching | pass | sw.js handles only same-origin GET and stores under path+content hash, so query strings like ?id= are not kept. In every snapshot, every cache key matched /?sw=[0-9a-f]{8}$/ or /js/vendor/, so no blob:, data: or user file was ever cached. fetchInto refuses other origins, and the 'cache-page' message accepts only site files. |
| XSS through resume fields typed in the builder | pass | resume1.js: payloads in name, title, summary and skills were shown as text. Website 'javascript:alert(document.domain)' and linkedin 'data:text/html,…' were not linked in the preview, PDF (/URI only mailto) or DOCX rels. 0 [data-xss] elements, 0 dialogs, 0 /xss-probe requests. Export names sanitised. shots/resume-typed.png |
| XSS through imported resume JSON (55 fields, ids, template ids, javascript:/vbscript: links, custom sections) | pass | resume2.js with inputs/evil-resume.json: 0 injected elements on resume.html (all tabs, job match, My resumes), home and your-data. Preview hrefs were limited to tel:, mailto: and https. evil-resume.docx opens in python-docx with 0 hyperlink rels to javascript. shots/resume-evil-import.png |
| XSS through file names (resizer, batch, merge, compress, text to PDF, file checker, workspace) | pass | tools.js, fc.js and ws.js with names like '<img src=/xss-probe-fn1 data-xss=fn1 onerror=alert(1)>.jpg' and '"><svg data-xss=fn2 onload=alert(1)>.pdf': 0 injected elements, 0 dialogs, 0 CSP violations, 0 probe requests (out/tools-*.json, out/fc.json, out/ws.json). |
| XSS through PDF, DOCX and EXIF metadata in the file checker | pass | fc.js: xss-meta.pdf (HTML in Title, Author, Subject, Creator, Producer), sample.docx (HTML in title and author) and photo.jpg (HTML in EXIF Make, Artist, Description) all shown as literal text. out/fc.json, shots/fc-all.png |
| XSS through workspace applicant name and ZIP name template | pass | ws.js: name shown as text in tabs and the switcher. ZIP name sanitised to 'Priya-Sample-img-src=-xss-probe-wkname-…-2026-11-18.zip'. 0 injections. |
| XSS through text to PDF content and title | pass | tools.js ttp step: payloads were kept as literal text in the textarea and in the PDF (pdftotext out/downloads/ttp.pdf). Unsupported-character list rendered through esc(). 0 injections. |
| XSS through search, URL parameters, #hash and 404 paths | pass | urlx.js: tools.html?q=, guides/?q=, resume.html?id= and #hash, image-resizer ?preset=constructor / __proto__ / targetKB=<payload>, your-data, workspace and file-checker with payloads, 404 paths containing HTML. Also the search dialog with a typed payload. 0 injected elements, 0 page errors. GitHub returns 400 for malformed %-escapes before the page runs. out/urlx.json |
| MIME sniffing vs extension (HTML/SVG/PDF named .jpg, real SVG) | partial | sniff.js and sniff2.js: resizer, batch, merge, compress, workspace and signature cleaner reject by content ('is a plain text file', 'is a PDF document'). The file checker reports the real type and the mismatch. Image to PDF checks the browser MIME only and accepts an SVG (rasterised, no script runs) (SEC-03). out/sniff.json |
| Zip bombs and path traversal in the file checker | pass | bombs2.js: bomb.docx (1 GB entry) → properties read, no hang. bomb-core.docx (300 MB core.xml) → 'A part of this document is unusually large and was not read'. many-entries.docx (70,000 entries) handled. traversal.docx entries are never extracted. All 8 files finished in 0.3 s. out/bombs2.json |
| Deeply nested PDFs (100k nested arrays and 50k nested dicts) | pass | bombs.js: merge and compress show '…has no pages that can be read'. The file checker shows 'Pages: Could not be counted'. Ping at most 4 ms, no crash. out/bombs-all.json |
| Decompression-bomb PNG (20000x20000 valid, 60000x60000 declared) | partial | Resizer, batch, workspace, merge and file checker refuse with a clear megapixel message (no memory spike). Image to PDF, passport print, signature cleaner and Compress PDF (image input) decode it, and browser memory rises by up to +2.1 GB (SEC-02). out/bombs-all.json, out/bombs-*.json |
| JavaScript inside PDFs | pass | js.pdf (OpenAction JS): the file checker warns 'This PDF contains JavaScript'. In merge output (out/downloads/merged.pdf), pdfinfo shows JavaScript: no and the Catalog has no /Names or /OpenAction. No dialog fired. |
| Safe download names (path traversal, CON, long, RTL override) | partial | Suggested names in tools.js output: '../../../etc/passwd.jpg'→'passwd.jpg', 'CON.jpg'→'image_CON.jpg', 240-char name cut to 120, RTL U+202E replaced by '_' (download) or removed (ZIP). 'con.backup.jpg' is kept unchanged in batch.zip (SEC-04). out/downloads/batch.zip |
| Metadata removal in the file checker | pass | fc2.js: gps.jpg and gps.png with GPS, Artist, Make, XMP creator and JPEG comment → cleaned copies (out/downloads/clean-0.jpg, clean-1.png) have an empty EXIF, and strings shows 0 markers. Merge and compress outputs drop the source PDF's Author and Title (out/downloads/meta-*.pdf). |
| Workspace privacy (memory only, End session) | pass | ws.js: storage during and after the session held only applyready_recent_tools. After End session the name was gone from the page and all 8 blob: URLs failed to fetch (revoked). Live regions held 'Session ended…' and '4 files added.' with no name. |
| Web Workers covered by the security policy | fail | workercsp.js: fetch('https://example.com/?probe=1') was blocked in the page, but succeeded (type=opaque) from inside pdf.worker.min.mjs and image-worker.js. Net-log shows 2 GETs to example.com initiated by https://applyready.in (SEC-01). |
| pdf.js WASM decoders (JPEG 2000) under CSP | pass | jpx.js: a PDF with a JPXDecode image rendered correctly in PDF to images (out/downloads/jpx-page.png), and openjpeg.wasm was loaded from the same origin. |
| Vendored dependency versions and known CVEs | pass | pdf.min.mjs pdfjsVersion = 6.5.438 (newer than 4.2.67, so CVE-2024-4367 is fixed; no isEvalSupported or new Function eval in the bundles). Cropper.js 1.6.1 and @cantoo/pdf-lib 2.11.1 (per docs/DEPENDENCIES.md): no CVEs known to me. 'npm audit --json' in the checkout (read-only): 0 vulnerabilities. |
| Licence compatibility with AGPL-3.0 | pass | docs/licenses has CROPPER, FONT_AWESOME, INTER, NOTO, PDFJS and PDF_LIB licences. js/vendor/pdfjs ships LICENSE, LICENSE_FOXIT, LICENSE_LIBERATION and the wasm LICENSE_* files next to the code. All are permissive or OFL/CC-BY, plus GPL-2.0+font-exception Liberation fonts as separate files, consistent with DEPENDENCIES.md. |
| Clickjacking / framing | partial | frame.js: a local http://127.0.0.1 page loaded https://applyready.in/your-data.html in an iframe, and the frame exposed #ydDeleteAll (shots/framed-your-data.png). See SEC-06. |

Measurements: Live vs checkout: 130/130 files md5-identical. Crawl: 67 pages, 1,097 requests, 1 CSP variant, 0 inline scripts, 0 iframes, 0 cookies, 0 target=_blank without noopener, 0 http:// links. Net-log over 29 browser runs: page-initiated URL_REQUEST_START_JOB = 2,611 GET (2,609 to applyready.in, 2 to example.com = my worker probe), 0 POST/PUT. Chromium-internal (initiator 'not an origin') went to android.clients.google.com, accounts.google.com and 127.0.0.1:9 (Playwright's component updater). Storage after using all tools: localStorage {applyready_theme, applyready_recent_tools}; IndexedDB applyready {meta: lastResumeId, persistAsked | resumeSaving; resumes}; caches applyready-files (up to 174 entries) + applyready-vendor-ab3b187c79 (3); 0 cache keys that are not site files. After Delete everything: 0 applyready_* keys, no IndexedDB, no caches, 0 service-worker registrations (unrelated_site_key left alone). Decompression bombs (peak RSS of the whole browser process tree, baseline about 795 MB): image-to-pdf with a 20000x20000 PNG of 380 KB reached 2,927 MB, passport print sheet 2,779 MB, compress-pdf (image) 1,349 MB, signature cleaner 1,098 MB; control photo.jpg in image-to-pdf 832 MB. Resizer, batch, workspace, merge and file checker reject the same files in under 6 s with a peak of 823 to 941 MB. Page responsiveness (evaluate round trip) never above 193 ms. File checker on 8 hostile files (1 GB zip bomb, 300 MB core.xml, 70,000 entries, 100k-deep nested PDF): all finished in 0.3 s. npm audit: 0 vulnerabilities (6 dev dependencies).

### Performance, compatibility and accessibility

Perf/compat/a11y audit of the live site https://applyready.in (commit 92f7ef0), measured with Chromium 1243 via Playwright and CDP. Everything is saved under scratchpad/audit/perf-a11y/ (perf/, a11y/, offline/, out/, shots/, inputs/).

Page loads are very good. Cold loads move 117-235 KB compressed in 10-24 requests, with no third-party requests. FCP is about 0.5 s on broadband, and 1.2-1.8 s on 360px slow 4G (2.0 s for resume with 4x CPU). LCP equals FCP (a text paragraph). CLS is 0.008 or less, and there are at most 2 long tasks (max 129 ms). Processing is fast:
- one 12 MP photo resizes to a passport photo in about 0.25 s to decode and 0.09 s to process (0.9 s and 0.67 s on Pixel 7 with 4x CPU)
- merging 10 PDFs takes 0.12 s
- compressing a 20-page, 8 MB scan takes 4.4 s (9 s at 4x CPU)
- a batch of 50 photos takes 2.3 s (3.9 s at 4x CPU)
The image tools keep heap and object URLs stable over 10 repeats.

The main defect (PA-01, high): every PDF that a PDF tool opens with pdf.js starts a new pdf.js Web Worker that is never shut down. The cause is that ApplyReadyPdf.closeJs calls doc.destroy(), which pdf.js 6.5 no longer has, and the error is swallowed. Adding 50 PDFs to Merge (the allowed maximum) leaves 51 workers and uses 1.5 GB of renderer memory. Repeated use keeps growing the memory (2.7 GB after 15 add-and-clear cycles), and leaving the page frees about half of it. The applicant workspace also keeps a worker with the applicant's parsed PDF after Finish applicant, which contradicts ARCHITECTURE.md.

Offline: pages you visited, and the image tools, work offline. A page never visited shows offline.html. But 'Save every tool for offline use' (171 files, 2.5 MB, about 3 s) does not save pdf-lib or pdf.js, while it says 'Every tool and guide is saved for offline use'. As a result, Compress and Merge PDF fail offline afterwards (PA-02). offline.html also wrongly says every tool is kept after the first visit (PA-03).

Accessibility: axe (WCAG 2.0/2.1/2.2 A and AA plus best practice) ran on all 67 pages in light and dark at 1280 and 360px (268 runs). The only violations were scrollable-region-focusable on 8 guide charts at 360px. Axe on 16 tool states in both themes and widths (dialogs, results, workspace) found only a target-size miss on the 'Show password' checkbox. The other target-size hits were scroll artefacts under the sticky header. Keyboard walkthroughs passed for:
- search, with focus returned to the trigger
- merge, including reordering, the confirm dialog and the password dialog (focus trapped, wrong password announced)
- batch with Cancel
- the workspace applicant flow
- resume from create to PDF download
In the image resizer, focus drops to BODY after an image is chosen with the keyboard (PA-05). Reduced motion is respected, and 200% zoom, 320px reflow, 1.4.12 text spacing and landscape phones all pass. Font sizes are set in px, so the browser's text-size setting has no effect (PA-08, a suggestion). Real Safari and Firefox were not tested, so compatibility risks are listed as unverified.

| Feature | Result | Evidence (abridged) |
|---|---|---|
| Cold-load performance, 10 pages x 4 profiles (desktop broadband; desktop 4x CPU; 360px slow 4G; 360px slow 4G 4x CPU) | pass | Script scratchpad/audit/perf-a11y/perf/load.js. Results in perf/load-*.json and perf/log-*.txt. Worst case: resume at 360px slow 4G + 4x CPU, FCP/LCP 2024 ms, 235 KB, 24 requests. CLS 0.008 or less everywhere, no horizontal scroll, no third-party requests. |
| Resize one 12 MP photo, repeated 10 times, heap and object URLs tracked | pass | perf/proc-resize.js and perf/proc-resize.json: decode 142-228 ms, process 79-183 ms, heap after GC 2.4 to 2.7 MB, URLs created 20 and revoked 20. Output out/resized-passport.jpg is 350x450, 22,654 B. |
| Merge 10 PDFs, repeated 10 times (speed and memory) | fail | Speed passes: about 120 ms per merge, out/merged10.pdf has 30 pages. Memory fails: renderer RSS and the pdf.js worker count grow every cycle (perf/merge-diag.js, perf/proc-merge.json). See PA-01. |
| Compress a 20-page scanned PDF | partial | perf/proc-pdf.js and perf/proc-compress.json: 4.4 s, output out/scan20-compressed.pdf with 20 A4 pages, 1,014,934 B (under the 1000 KB target). Each run leaks one pdf.js worker and about 190 MB (PA-01). |
| Batch 50 photos, repeated 3 times, plus ZIP | pass | perf/proc-batch.js and perf/proc-batch.json: 2.3 s for 50 images; out/batch50.zip passes unzip -t (50 files of 1200x900, at most 67 KB each); heap and workers stable after Clear all. |
| Phone emulation (Pixel 7, iPhone 13) with taps and 4x CPU: resize, merge, compress, batch, menu, search | pass | perf/phones.js and perf/phones.json; screenshots shots/phone-*-resizer-result.png, shots/phone-*-merge-result.png, shots/phone-*-search.png. No horizontal scroll; every flow finished and downloaded. |
| Offline: visited and unvisited pages after setting the context offline | pass | offline/offline.js. Visited /, /image-resizer.html and /merge-pdf.html render styled (offline/off-visited-*.png). Unvisited pages show offline.html (offline/off-unvisited-*.png). The image resizer works offline. |
| Offline: PDF tool used once online, then used offline | pass | offline/vendor-after-use.js: after one online compress, the cache applyready-vendor-ab3b187c79 holds pdf-lib, pdf.min.mjs and pdf.worker.min.mjs, and the offline compress succeeded. |
| Your data: 'Save every tool for offline use' | fail | offline/saveall.js: 171 files saved in about 3 s and the page says 'Every tool and guide is saved for offline use', but no vendor PDF library is cached. Offline, Compress PDF and Merge PDF fail with 'A part of the PDF tool could not load' (offline/off-saved-compress-attempt.png, offline/off-saved-merge-attempt.png). See PA-02. |
| axe-core on all 67 pages, light and dark, 1280 and 360 (268 runs) | partial | a11y/axe-pages.js, a11y/axe-pages.json, a11y/axe-pages.log. 0 violations at 1280px. At 360px, 8 guides x 2 themes have scrollable-region-focusable on figure.shot (PA-07). The 272 incomplete colour-contrast nodes are SVG diagram text; checked visually as readable (a11y/svg-dark.png). |
| axe-core on tool states and open dialogs (search, My resumes, merge list, password dialog, wrong password, merge result, confirm dialog, compress result, batch list and done, file checker result, workspace applicant, processed and end confirm, Your data delete-all confirm), both themes, 1280 and 360 | partial | a11y/axe-states.js, a11y/axe-states-1280.json, a11y/axe-states-360.json, screenshots a11y/state-*.png. The only real hit is target-size on the 18x18 'Show password' checkbox (PA-06). Target-size hits on the compress breadcrumb and workspace tabs come from the sticky header covering content scrolled under it (a11y/state-1280-compress_result.png), not from keyboard focus. |
| Keyboard: search dialog | pass | a11y/kb-walk.js search and a11y/kb-search2.js. '/' opens the dialog with focus in the input. Results use the combobox pattern with aria-activedescendant, and the result count is announced ('4 results'). Tab cycles Close and input (trapped). Escape returns focus to #searchOpen. Enter opens the highlighted result. Screenshot a11y/kb-search-dialog.png. |
| Keyboard: image resizer from choosing the requirement to download | partial | a11y/kb-walk.js resizer. The flow completes and downloads photo12mp_Passport_Photo_350x450.jpg. All stops have a visible ring. Focus moves to Download when the result appears. The wrong-type error is in role=alert. But focus is lost to BODY after the image loads (PA-05). |
| Keyboard: merge PDF (add, reorder with handle and ArrowUp, merge, download, confirm dialog, password dialog) | pass | a11y/kb-merge.log and a11y/kb-merge-1280.json. Moves are announced ('moved to position 2 of 3') and focus follows the moved file. Focus lands on Download after the result. The confirm dialog traps focus and returns it to 'Remove all' after Escape. The password dialog is role=dialog with aria-modal; a wrong password sets aria-invalid and an alert. After Cancel, focus goes back to 'Add files' and the error is in… |
| Keyboard: batch image with Cancel | pass | a11y/kb-batch.log and a11y/kb-batch2.js. Focus moves to Cancel on start. Enter on Cancel after 700 ms cancelled the batch (14 done, 36 cancelled), announced as 'Cancelled. 14 finished images kept.', with focus on the result heading. Enter within 450 ms of start is ignored on purpose (PA-09). The focus rings on the KB fields and the quality slider are visible (a11y/kb-batch-maxkb-focus.png,… |
| Keyboard: workspace applicant flow | pass | a11y/kb-workspace.log. Start moves focus to the name field. Files are added with focus kept on Choose files and announced. Passport photo runs and is announced; the ZIP downloads (Test-Person-2026-11-18.zip). Finish moves focus to 'Add next applicant', and the wipe is announced. |
| Keyboard: resume create and PDF download | pass | a11y/kb-resume2.js. The fields are reached in 15 tabs. The accordion opens with Enter. The Next buttons move focus to the step tab, and ArrowLeft works on the tabs. Download PDF produces a11y/kb-resume.pdf; pdftotext shows TEST CANDIDATE, the email and the summary. |
| Headings, landmarks, lang, skip link (11 pages plus offline, 404 and guides index) | pass | a11y/layout-checks.json 'outline': exactly one h1 per page, no skipped heading levels, one banner, one main, one contentinfo, lang=en, a skip link on every page. |
| prefers-reduced-motion | pass | a11y/layout-checks.json 'reduced': with reduce, 0 elements have a transition or animation (13 without reduce). The JS smooth-scroll calls check matchMedia (js/resizer.js:284, js/resume.js:1963). |
| 200% zoom, 320px reflow (400%), 1.4.12 text spacing, landscape Pixel 7 and iPhone 13 | pass | a11y/layout-checks.json and a11y/layout-checks.log: no horizontal scroll and no clipped text (the one hit, .rb-head .page-lede on resume, is sr-only on purpose). Screenshots a11y/spacing-360-_workspace_html.png and a11y/landscape-*-resume.png. |
| Text-only resize (root font-size 200%) | partial | a11y/text200-1280-_resume_html.png and a11y/text200-360-_image_resizer_html.png: text does not grow, because all font sizes are px tokens (css/app.css:58-61). Browser zoom works. See PA-08. |
| Colour contrast in both themes | pass | axe color-contrast found 0 violations across 268 page runs and all state runs. The incomplete SVG nodes were checked visually (a11y/svg-dark.png). |
| Source review for Safari and Firefox API risks | partial | Fallbacks exist for createImageBitmap options (try/catch, js/lib/file-kit.js:139, js/lib/image-ops.js:179), OffscreenCanvas in workers (feature test with main-thread fallback, js/lib/image-pool.js:16), crypto.randomUUID, and IndexedDB (memory fallback in store.js). pdf.js is the legacy build with core-js polyfills. There is no structuredClone, <dialog> or File System Access use. CSS :has is used without fallbacks… |

Measurements: COLD LOAD (no cache; transferred KB = compressed encodedDataLength; FCP/LCP in ms; CLS): desktop broadband: home 134KB/15 req/JS 33KB FCP 500 CLS .002; tools 128/13/27 FCP 520; resume 235/24/115 FCP 492; image-resizer 189/17/47 FCP 496; merge-pdf 160/16/57 FCP 468; compress-pdf 154/16/48 FCP 540; batch-image 154/18/48 FCP 476 CLS .008; workspace 183/20/77 FCP 484; file-checker 168/19/64 FCP 576; guide how-to-create-a-resume 146/11/12 FCP 504; 0 long tasks. desktop + 4x CPU: FCP 540-752, at most 1 long task (resume 81 ms, batch 71 ms). 360px slow 4G (150 ms, 1.6 Mbps): FCP=LCP 1176 (compress) to 1820 (resume); 0 long tasks; CLS 0. 360px slow 4G + 4x CPU: FCP 1364-2024 (resume); long tasks 0-2, max 129 ms (batch); TBT max 79 ms. First PDF action on slow 4G (service worker blocked): 4.8-5.0 s, 402 KB (pdf-lib 247 KB, pdf.min.mjs 155 KB), plus the pdf.js worker (about 390 KB gzip).  PROCESSING (desktop / Pixel 7 at 4x CPU): - resize 12 MP JPEG to passport: decode 142-228 ms, process 79-183 ms / 865-901 ms, 663-675 ms; output 350x450, 22.6 KB - merge 10 PDFs (30 pages): add 0.87-1.38 s, merge 118-126 ms / add 2.0-2.4 s, merge 324-357 ms; output 1.2 MB, 30 pages - compress 20-page 8.1 MB scan to 1000 KB: 4.36-4.40 s / 9.0-9.4 s; output 1,014,934 B, 20 pages - batch 50 x 6.75 MP (fit 1200, 200 KB max): 2.28-2.30 s / 3.87-3.90 s; ZIP 3.0 MB in 90 ms; workers used  MEMORY: - resizer x10: heap after GC 2.4 to 2.7 MB; object URLs all revoked (created 20, revoked 20) - batch x3: heap 2.4 to 2.6 MB, renderer about 300 MB stable, 3 workers stable - merge x10 cycles of 10 PDFs: JSEventListeners 99 to 279 (+20 per cycle); renderer RSS 526 to 2,776 MB over 15 cycles; worker targets 11 to 151; after leaving the page 1,388 MB - merge 50 PDFs at once: 51 workers, renderer 221 to 1,505 MB - compress x4: +1 worker and about +190 MB each run  OFFLINE: Save every tool took about 3 s and saved 171 files, about 2.5 MB transferred, 0 vendor PDF libraries.

### SEO and documentation

SEO and documentation on https://applyready.in are in good shape overall. All 70 HTML pages are byte-identical to commit 92f7ef0 and return 200. The 65 sitemap URLs exactly match the indexable pages. Titles (25-65 chars) and descriptions (128-160 chars) are unique, canonicals are absolute https and self-referencing, OG/Twitter tags are complete, og:image (1200x630) is reachable, and every JSON-LD block parses with no fake ratings. The visible FAQ text matches its FAQPage data (149/149 items) and visible breadcrumbs match BreadcrumbList data on all 55 pages that have it. There are no orphan pages, no broken internal links and no hreflang leftovers, and missing pages return a real 404. LICENSE is the official AGPL-3.0 text. Following the README literally works: npm ci, npm test and npm run test:browser with BROWSER_EXECUTABLE_PATH all pass, every generator is idempotent, and python3 -m http.server serves a working site with a service worker. All 9 step-by-step tutorials were followed on the live site (208 checks pass). All 35 desktop and 35 phone tutorial screenshots were regenerated from the live site and match the committed images; only timing-dependent pixels differ. Guide measurements were reproduced exactly on the live resizer, for example 46.13/48.68/48.07 KB and WebP 18.49 KB. The leftover search found no ad, analytics, exam or paid-plan code, and every hit is a legitimate guard or 'no ads' statement. Defects found: (1) medium: the offline fallback page and several pages say every tool and guide is kept after the first visit. That is false, so all four links the offline page offers lead back to the offline page. (2) low: the 404 redirect map ignores extensionless old URLs. (3) low: old 'ApplyReady.in' branding is still in resume PDF and DOCX metadata. (4) low: docs/PROGRESS.md still says the site is not deployed. (5) low: the regular icon font is not cached for offline use. Five info-level suggestions follow.

| Feature | Result | Evidence (abridged) |
|---|---|---|
| Live site matches audited commit | pass | Fetched all 70 git-tracked HTML pages from https://applyready.in with curl; all returned 200 and are byte-identical to /home/user/applyready (cmp). Saved under scratchpad/audit/seo-docs/live/pages/. |
| Titles and meta descriptions (unique, length) | pass | scripts/check.py over all 70 pages (seo-check.log): 0 duplicate titles and 0 duplicate descriptions. Titles are 25-65 chars and descriptions 128-160 chars. Only 404.html and offline.html (noindex) and the 3 redirect stubs lack OG tags, which is expected. |
| Canonical URLs | pass | Every indexable page has exactly one absolute https canonical equal to its own URL (/guides/ for guides/index.html). The 3 redirect stubs (resize-image-to-10kb/100kb/200kb.html) point to resize-image-to-kb-limit.html and carry noindex. /index.html serves 200 with canonical /. http:// and www. both 301 to https://applyready.in/. |
| Robots meta and robots.txt | pass | robots.txt has Allow: / and Sitemap: https://applyready.in/sitemap.xml, and disallows /offline.html, /docs/, /tests/, /scripts/ and *.md. Indexable pages have no robots meta; 404.html is noindex,follow; offline.html is noindex,nofollow; the stubs are noindex,follow. |
| sitemap.xml vs real pages | pass | 65 <loc> entries, identical to the indexable page set: none missing, none extra, all 200. lastmod is 2026-11-18 everywhere, which is consistent with the commit history and with each Article's dateModified. scripts/build-sitemap.js --check passes. |
| Structured data (JSON-LD) | pass | Every block parses. The types are sensible (WebApplication with a free Offer, FAQPage, BreadcrumbList, Article with an Organization author/publisher, WebSite, CollectionPage). There are no aggregateRating or review entries. All 149 FAQ Q&As appear verbatim in the visible page. Article datePublished/dateModified match the visible dates on all 28 guides. All 137 URLs referenced are reachable (200). |
| Breadcrumbs vs JSON-LD | pass | scripts/crumbs.py (crumbs-check.log): on the 55 pages with BreadcrumbList, names, order and URLs match the visible breadcrumb exactly, and the tools.html#pdf-style anchors exist. 9 trust pages have a visible breadcrumb but no BreadcrumbList (see SEO-09, info). |
| Open Graph and Twitter tags | pass | On all 65 indexable pages: og:title, description, url, image, type and site_name are present, og:url equals the canonical, and twitter:card is summary_large_image. assets/social-card.png returns 200, is 1200x630 and was checked visually. og:title is a shorter form of <title> by design. |
| Internal linking / orphan pages | pass | Built the link graph from every page's <a href>. Every sitemap page has at least 3 inbound internal links; only 404, offline and the 3 noindex stubs have none, as intended. 0 broken internal links. |
| Duplicate content (KB pages, resizer, how-to-use vs guides index) | pass | 5-word shingle Jaccard on <main> text: highest pair is 0.24 (compress-image vs convert-image). resize-image-to-20kb/50kb/kb-limit vs image-resizer is 0.10-0.13. how-to-use vs guides/index is not in the top 25. 10/100/200 KB are noindex stubs that redirect to resize-image-to-kb-limit.html#10kb/#100kb/#200kb, and those anchors exist. |
| hreflang / Hindi leftovers | pass | git grep finds no hreflang and no lang="hi"; all 70 pages have lang="en". /hi/ and /hi/index.html return 404. Old /hi/*-photo-signature-size.html shows a 'This page was removed' message linking to the photo and signature resizers (notfound-check.log). The remaining Hindi mentions are legitimate: font support, the text-to-PDF script limitation and the changelog. |
| 404 handling | partial | Missing pages return HTTP 404 (/nope.html, /guides/nope.html, /hi/). The 404 page uses only root-relative assets, suggests matching pages (/merge-pdfs.html offers Merge PDF and its tutorial), redirects moved guides with .html (compression-targets-guide.html goes to how-to-reduce-photo-to-50kb-without-blur.html) and explains removed pages. Extensionless moved URLs are not redirected (SEO-02). |
| Tutorials followed step by step on the live site (all 9 guides/how-to-*.html) | pass | Ran the project's tutorial follow-along against https://applyready.in instead of localhost (repo/tests/tutorial_live.js, only the origin and route filter changed): 208 checks pass (tutorial-live.log). They cover quoted labels, messages, file names (e.g. test-portrait_Passport_Photo_350x450.jpg, compressed-images.zip, applyready-images.zip), sizes (26.47 KB / 27,109 bytes, padded signature 10.00 KB) and page… |
| Tutorial screenshots match the current interface | pass | Ran scripts/guide-screenshots.js against the live origin in a clone (repo2) for desktop (35) and phone (35). All 70 have the same dimensions as the committed images and differ in under 0.5% of pixels, except the tut-batch-progress progress counter (8 vs 11 of 24 finished, timing). Side-by-side images are in shotdiff/ and shotdiff/phone/. |
| Guide numbers plausible and reproducible | pass | scripts/measure.js on the live passport resizer with test-portrait.jpg under 50 KB: 350x450 26.47 KB, 600x800 46.13 KB, 900x1200 48.68 KB, 1200x1600 48.07 KB, WebP 18.49 KB. These match how-to-reduce-photo-to-50kb-without-blur.html (26.5/46.1/48.7/48.1 KB) and image-formats-guide (18.5 KB WebP). PNG 196 KB is confirmed by the tutorial suite. Other claims also check out: 15 templates (js/templates.js has 15 ids),… |
| README local development and tests, followed literally | pass | Ran git clone, then npm ci (5 packages, 0 vulnerabilities) and npm test (exit 0, 4.5 s). BROWSER_EXECUTABLE_PATH=... npm run test:browser exited 0 with every suite passing (npm-test-browser.log). python3 -m http.server 8765 serves the site: the service worker registers, .mjs is served as text/javascript, and merge-pdf merged 2 sample PDFs into a 3-page PDF (dl/localdev-merged.pdf, pdfinfo). npm test also passes… |
| README generator commands | pass | In clone repo3, ran sync-shell.js, build-directory.js, build-image-pages.js, build-tool-pages.js, build-pdf-pages.js (also --force), build-sitemap.js and python3 scripts/build-icons.py. git status shows no changes, so every generator is idempotent. The sample-image and sample-PDF scripts reproduce their files; only the encrypted PDF differs, because of its random IV. |
| LICENSE is the official AGPL-3.0 | pass | Downloaded https://www.gnu.org/licenses/agpl-3.0.txt: same md5 (eb1e647870add0502f8f010b19de32af), and the SHA-256 is the 0d96a4ff…abcb0 that docs/PROGRESS.md states. package.json says AGPL-3.0-only, and the GitHub API reports the repo as public with license agpl-3.0. |
| CONTRIBUTING.md, SECURITY.md, CODE_OF_CONDUCT.md | partial | Setup and test commands work as written. The donation link appears once per page in the footer and twice on about, philosophy and contribute, as stated. SECURITY's CSP description matches the live meta CSP, and the live response has no HSTS or frame-ancestors header, as documented. One small doc nit: 'no inline style attributes' (SEO-10, info). |
| docs/*.md accuracy | partial | ARCHITECTURE's storage table matches the code (localStorage keys applyready_theme, applyready_recent_tools and applyready_recent_off; IndexedDB 'applyready' v1 with resumes and meta; caches applyready-files and applyready-vendor-<hash>). DEPENDENCIES matches the vendored files (Cropper 1.6.1, pdf.js 6.5.438, and the wasm and Liberation files present). PROGRESS's test counts match my runs exactly. PROGRESS's… |
| privacy.html storage table vs code | pass | Every localStorage key in js/ (git grep) appears in the table. The legacy draft keys are read and removed but never written, as the page says. The IndexedDB and Cache Storage names match js/lib/store.js and sw.js, and sessionStorage is only cleared. The 'no cookies/analytics' claims are consistent with the CSP and the code. |
| about, philosophy, contribute, terms, changelog, how-to-use accuracy | partial | Tool lists, the 15 templates, the licence, contact details and limits are consistent with the tools. The offline claims are not: 'after your first visit, offline' (how-to-use), 'work offline once a page has loaded' (philosophy), 'work offline after a first visit' (changelog) and offline.html's 'keeps every tool and guide' overstate the opt-in caching design (SEO-01). |
| Leftover search: ads/analytics | pass | git grep for adsense, adsbygoogle, ca-pub, googlesyndication, doubleclick, gtag, ga( and analytics finds only guards (tests/content_tests.js AD_MARKERS, tests/browser_tests.js), 'no ads/analytics' statements, resume sample content ('Google Analytics' as a marketing skill) and an owner to-do in docs/PROGRESS.md (remove the domain from the AdSense dashboard). /ads.txt is 404. |
| Leftover search: exam names, sarkari | pass | GATE/SSC/UPSC/IBPS/NEET/RRB/JEE/CUET/sarkari appear only in the tests/content_tests.js guard regex. 'exam' appears only in docs history (ROADMAP/PROGRESS), the changelog's 'Removed' section and the 404 removed-page text. |
| Leftover search: paid/premium/subscribe/upgrade/pricing/trial/limit reached | pass | Hits are only 'no premium/paid/subscription' statements (about, philosophy, index, terms, CONTRIBUTING, PR template) and IndexedDB onupgradeneeded in js/lib/store.js. There are no paywall or upgrade UI strings. |
| Leftover search: old domain / 'ApplyReady.in' branding | fail | 'ApplyReady.in' appears in js/pdf-engine.js:436 (PDF Creator/Producer), js/docx-engine.js:311 (DOCX Application), in file header comments of five JS files and in the docs/SEO_SETUP.md title. Confirmed in live downloads under dl/ (SEO-03). There is no other old domain. |
| Leftover search: TODO/FIXME/placeholder/lorem | pass | No TODO, FIXME or lorem ipsum in shipped content. The hits are the resume review's placeholder detector (js/resume.js:1685), a variable named 'todo' in sw.js, test guards, and 'XXXXX' as an example token in docs/SEO_SETUP.md. |
| Offline claims in documentation | fail | Visited only the home page on the live site (SW controlling), then went offline. /merge-pdf.html, /image-resizer.html, /guides/... and all four buttons on the offline page (tools, image resizer, resume builder, guides) load 'You Are Offline'. The cache held only '/' and '/offline.html' (offline-check.log, shots/offline-merge-after-home-visit.png). A visited tool (passport-photo-resizer) does work offline… |
| Publicly served repository files | pass | /README.md, /docs/ROADMAP.md, /tests/run_tests.js, /package.json and /CNAME are served with 200 (/.github/ returns 404). robots.txt disallows them, nothing secret is exposed, and the repository is public anyway. |

Measurements: Live vs checkout: 70/70 HTML pages HTTP 200 and byte-identical (cmp); sitemap.xml identical to checkout. Sitemap: 65 URLs, all lastmod 2026-11-18 (sane: all commits are on that date), 0 missing/0 extra vs indexable pages. Title length 25-65 chars, description 128-160 chars, 0 duplicate titles/descriptions. JSON-LD types: BreadcrumbList 55, FAQPage 25 (149 Q&A, 149 visible verbatim), Article 28 (dates match visible Published/Last updated), WebApplication 24 (Offer price 0 INR), Organization, WebSite, CollectionPage; 0 parse errors; 0 aggregateRating/review. 137 distinct URLs in JSON-LD/OG: all 200. og:image 1200x630 PNG 64,089 B. Max near-duplicate Jaccard (5-word shingles of <main>) 0.24 (compress-image vs convert-image); KB pages vs image-resizer 0.10-0.13. Inbound internal links: min 3 (guides/cv-vs-resume-india-job-applications.html), all sitemap pages >=3; 0 broken internal links. External links: 111 unique; 2 Indian gov URLs timed out and 5 github.com sub-URLs returned 403 through the sandbox proxy (unverified, environment). npm test: 646+64+119+56 checks, 10,722 content assertions, 994 guide assertions, 239 navigation checks, all pass in 4.5 s. npm run test:browser: all 12 suites pass (browser 2,833; image workflow 296; resume flow 96; resume library 144; PDF tools 222; batch 283; doc tools 153; workspaces 137; tutorials 208; smoke 20). Live tutorial follow-along: 208 checks pass. Screenshot regeneration from live: 35 desktop images with identical dimensions and 0.00% pixels differing by more than 40, except tut-batch-progress 1.33% (progress counter timing) and tut-yourdata-resumes 0.08%. 35 phone images match; 3 have 0.3-0.4% background or timing differences. Resizer measurements on live (test-portrait.jpg, 50 KB cap): 350x450 26.47 KB, 600x800 46.13 KB, 900x1200 48.68 KB, 1200x1600 48.07 KB, WebP 350x450 18.49 KB, all matching the guide's numbers. LICENSE: 34,523 B, md5 eb1e647870add0502f8f010b19de32af, identical to gnu.org agpl-3.0.txt. SHA-256 0d96a4ff…abcb0, as docs/PROGRESS.md states. Icon fonts now: fa-solid 8,532 B + fa-regular 3,840 B + icons.min.css 5,042 B.

## 6. Features that failed or partly failed

| Area | Feature | Result |
|---|---|---|
| Live site sweep | External links | partial |
| Live site sweep | Donation link: count, no popups, Razorpay page loads | partial |
| Live site sweep | Offline behaviour and /offline.html | partial |
| Resume builder | Leaving immediately after typing (no wait) | partial |
| Resume builder | PDF page breaks (orphans, split entries) | partial |
| Resume builder | DOCX export (15 templates) opened with python-docx and rendered with LibreOffice | partial |
| Resume builder | Job-description keyword match | partial |
| Resume builder | Fields over the schema limits (over 50,000 chars per field, over 150 entries) | fail |
| Image tools | Custom dimensions in cm and inches with DPI | partial |
| Image tools | Custom width/height in px entered in order (width then height) | fail |
| Image tools | Truncated/corrupt JPEG | fail |
| Image tools | Tiny images (1x1, 2x2, 5x5, 10x10, 20x20) | partial |
| Image tools | resize-image-to-kb-limit.html preset choices and ?targetKB= URL | partial |
| Image tools | Compress/convert invalid inputs | partial |
| Image tools | Signature cleaner: white paper and dark ink | fail |
| Image tools | Signature cleaner ink colour, transparent PNG, invalid files | partial |
| Image tools | Passport print requested copies above capacity | partial |
| PDF tools | Merge: bookmarks, form fields, links | partial |
| PDF tools | Merge with bad files (truncated, text renamed .pdf, garbled, empty) | partial |
| PDF tools | Organize/Split: deleted or excluded pages removed from the file | fail |
| PDF tools | PDF to image: count, pixel size, rotation, page range, password, limits | partial |
| PDF tools | PDF to text: order, completeness, markers, ranges, scans, Hindi | partial |
| PDF tools | Watermark: layouts and angles on rotated/mixed/CropBox pages, all pages, character check | partial |
| PDF tools | Page numbers and watermark output size | fail |
| PDF tools | File checker: PDF metadata, encryption, JS, attachments, forms, mixed sizes, renamed files | partial |
| PDF tools | Corrupt / non-PDF / empty inputs across 7 single-file tools | partial |
| Batch processing | compress-image.html multi-file (default: keep format, 100 KB; and JPEG 20 KB) | partial |
| Batch processing | Failed files listed with reasons, single-row Retry, over 50 MP, over 50 MB, 500-image cap | partial |
| Batch processing | Naming modes (keep, add a word, number in order) | partial |
| Batch processing | Settings changed after processing (old-settings notice, Process again) | partial |
| Cyber cafe workspaces | Finish applicant / End session confirmations (download-before-delete safeguard) | partial |
| Cyber cafe workspaces | DOM and live regions after Finish and End session | fail |
| Cyber cafe workspaces | JS heap after Finish and End | partial |
| Cyber cafe workspaces | 50-file per-applicant cap | partial |
| Navigation and usability | Find a tool to make a photo under 50 KB | partial |
| Navigation and usability | Find privacy information | partial |
| Navigation and usability | Find how to delete my data | partial |
| Navigation and usability | Global search: 81 realistic queries in the live dialog, plus 55 more against the identical local search.js | partial |
| Navigation and usability | Tool directory (tools.html) filter and categories | partial |
| Navigation and usability | Direct tool URLs | partial |
| Privacy and security | GitHub Pages response headers | partial |
| Privacy and security | MIME sniffing vs extension (HTML/SVG/PDF named .jpg, real SVG) | partial |
| Privacy and security | Decompression-bomb PNG (20000x20000 valid, 60000x60000 declared) | partial |
| Privacy and security | Safe download names (path traversal, CON, long, RTL override) | partial |
| Privacy and security | Web Workers covered by the security policy | fail |
| Privacy and security | Clickjacking / framing | partial |
| Performance, compatibility and accessibility | Merge 10 PDFs, repeated 10 times (speed and memory) | fail |
| Performance, compatibility and accessibility | Compress a 20-page scanned PDF | partial |
| Performance, compatibility and accessibility | Your data: 'Save every tool for offline use' | fail |
| Performance, compatibility and accessibility | axe-core on all 67 pages, light and dark, 1280 and 360 (268 runs) | partial |
| Performance, compatibility and accessibility | axe-core on tool states and open dialogs (search, My resumes, merge list, password dialog, wrong password, merge result, confirm dialog, compress result, batch list and done, file checker result, workspace applicant, processed and end confirm, Your data delete-all confirm), both themes, 1280 and 360 | partial |
| Performance, compatibility and accessibility | Keyboard: image resizer from choosing the requirement to download | partial |
| Performance, compatibility and accessibility | Text-only resize (root font-size 200%) | partial |
| Performance, compatibility and accessibility | Source review for Safari and Firefox API risks | partial |
| SEO and documentation | 404 handling | partial |
| SEO and documentation | CONTRIBUTING.md, SECURITY.md, CODE_OF_CONDUCT.md | partial |
| SEO and documentation | docs/*.md accuracy | partial |
| SEO and documentation | about, philosophy, contribute, terms, changelog, how-to-use accuracy | partial |
| SEO and documentation | Leftover search: old domain / 'ApplyReady.in' branding | fail |
| SEO and documentation | Offline claims in documentation | fail |

## 7. Verified defects

Each defect below was found by one auditor and then reproduced independently by a second agent on the live site before it was counted. Where the second agent judged the severity differently, the verified severity is used and the original is noted. Severity scale: CRITICAL (data loss or security breach for many users, no workaround), HIGH (a core task fails or loses work), MEDIUM (a task gives a wrong or misleading result, or a significant barrier), LOW (minor wrong behaviour with an easy workaround), INFORMATIONAL (wording or polish).

| Severity | Verified defects |
|---|---|
| CRITICAL | 0 |
| HIGH | 3 |
| MEDIUM | 15 |
| LOW | 41 |
| INFORMATIONAL | 2 |
| Total | 61 |

| ID | Severity | Title | Status after this round |
|---|---|---|---|
| [PA-01](#pa-01) | HIGH | Every PDF opened by a PDF tool starts a pdf.js worker that is never shut down, so memory grows without limit (1.5 GB for 50 PDFs in Merge) | Fixed |
| [PDF-01](#pdf-01) | HIGH | Deleted or excluded pages stay hidden inside Organize/Split/Merge output when another page links to them | Fixed |
| [RES-01](#res-01) | HIGH | Long text (over 50,000 chars in a field) or over 150 entries is shown as saved, then the whole resume becomes 'Damaged: cannot be opened'; the backup silently drops that text | Fixed |
| [BAT-01](#bat-01) | MEDIUM | On phones the settings are below the whole file list (33,000 px down with 300 images) | Fixed |
| [IMG-01](#img-01) | MEDIUM | Signature cleaner 'Paper whiteness' slider works backwards from its hint; default leaves dim paper grey | Fixed |
| [IMG-02](#img-02) | MEDIUM | Custom size keeps width and height locked to the previous shape, so typing a form's W x H gives the wrong size | Fixed |
| [IMG-03](#img-03) | MEDIUM | Truncated or corrupt JPEG is accepted and output as 'verified' with most of the picture blank | Fixed |
| [IMG-04](#img-04) | MEDIUM | Signature cleaner 'Keep original ink' turns blue ink pure black | Fixed |
| [LIVE-01](#live-01) | MEDIUM | Offline page says every tool and guide works after the first visit, but its buttons lead back to the offline page | Fixed |
| [NAV-01](#nav-01) | MEDIUM | Search ignores numeric file sizes, so 'pdf 300kb' opens Merge PDF and 'signature 10kb' puts Signature cleaner first | Fixed |
| [PA-02](#pa-02) | MEDIUM | 'Save every tool for offline use' says every tool is saved but leaves out the PDF libraries, so the PDF tools fail offline | Fixed |
| [PDF-02](#pdf-02) | MEDIUM | Add page numbers and Watermark grow the file with the square of the page count when pages share a font dictionary | Fixed |
| [PDF-03](#pdf-03) | MEDIUM | Damaged PDF gives blank pages reported as success, the message blames the browser, and File checker reports no problem | Fixed |
| [PDF-04](#pdf-04) | MEDIUM | PDF to text corrupts Hindi: drops the ि vowel sign and writes NUL characters into the .txt | Fixed |
| [RES-02](#res-02) | MEDIUM | PDF: a referee's contact line can be pushed alone onto the next page, away from the referee's name | Fixed |
| [SEC-01](#sec-01) | MEDIUM | Content Security Policy does not apply to Web Workers; the pdf.js and image workers can send data to any site | Fixed |
| [SEC-02](#sec-02) | MEDIUM | Image to PDF, passport print sheet, signature cleaner and Compress PDF (image input) fully decode huge images; memory spikes by up to 2 GB | Fixed |
| [SEO-01](#seo-01) | MEDIUM | Offline page and site copy promise that every tool and guide works offline after the first visit; it does not | Fixed |
| [BAT-02](#bat-02) | LOW | 'Download all as ZIP' mixes in results made with old settings without warning | Fixed |
| [BAT-03](#bat-03) | LOW | Output names change after a removal or Process again, so single and ZIP names no longer match | Fixed |
| [BAT-04](#bat-04) | LOW | Oversize message says a 50.47 MB file 'is 50 MB' with a limit of 50 MB | Fixed |
| [BAT-05](#bat-05) | LOW | Image compressor can produce larger files and still put them in the ZIP | Fixed |
| [BAT-06](#bat-06) | LOW | Retry button says 'failed and cancelled images' when nothing failed | Fixed |
| [BAT-09](#bat-09) | LOW | A ZIP download the browser blocks fails silently and success is still announced | Partly fixed |
| [CAF-01](#caf-01) | LOW | Finished applicant's file name stays in the page's hidden message region after Finish and End session | Fixed |
| [CAF-02](#caf-02) | LOW | Single-file downloads have nothing to say whose they are; two applicants' files download under the same name | Fixed |
| [CAF-03](#caf-03) | LOW | A cancelled or failed download counts as 'Downloaded'; Finish then deletes the results without asking | Fixed |
| [CAF-04](#caf-04) | LOW | Adding more than 50 files shows two messages that contradict each other | Fixed |
| [IMG-05](#img-05) | LOW | Very small images: 1x1 crashes with a raw browser error; others are enlarged and padded without warning | Fixed |
| [IMG-06](#img-06) | LOW | Sizes entered in cm/inches at a DPI produce files with no DPI recorded | Fixed |
| [IMG-07](#img-07) | LOW | resize-image-to-kb-limit.html ignores targetKB/width/height URL parameters | Fixed |
| [IMG-08](#img-08) | LOW | Passport print sheet silently prints fewer copies than requested | Fixed |
| [IMG-09](#img-09) | LOW | Compress/convert queue images over 50 MP as 'Waiting' and fail them only after Start | Fixed |
| [LIVE-02](#live-02) | LOW | Resume-builder icon is blank on the offline page | Fixed |
| [LIVE-04](#live-04) | LOW | Privacy page says 'Two links lead elsewhere', but the site links to 46 external URLs | Fixed |
| [NAV-02](#nav-02) | LOW | Hinglish task verbs (chota, kam, jodna, milana) are ignored, so 'pdf chota karna' opens Merge PDF | Fixed |
| [NAV-04](#nav-04) | LOW | On phones, Resume builder sits inside a one-item 'Resume' accordion, so the flagship tool needs 3 taps from any page | Fixed |
| [NAV-05](#nav-05) | LOW | Common application words return nothing, and some unsupported requests return unrelated tools | Partly fixed |
| [NAV-06](#nav-06) | LOW | A trailing-slash tool URL (/merge-pdf/) shows a 404 page with no suggestion | Fixed |
| [PA-03](#pa-03) | LOW | The offline page claims every tool and guide is kept after the first visit; its links lead back to the offline page | Fixed |
| [PA-04](#pa-04) | LOW | The Merge PDF error repeats the same sentence once per file with no file name | Fixed |
| [PA-05](#pa-05) | LOW | Image resizer: focus drops to the page body after an image is chosen with the keyboard | Fixed |
| [PA-07](#pa-07) | LOW | Guide charts scroll sideways at 360px in a figure that cannot take keyboard focus | Fixed |
| [PDF-05](#pdf-05) | LOW | Long watermark text runs off the page and is cut off; no size fitting or warning | Fixed |
| [PDF-06](#pdf-06) | LOW | Extract mode silently duplicates pages for overlapping ranges | Fixed |
| [PDF-07](#pdf-07) | LOW | Compressed size is measured in 1024-byte KB; a '500 KB' result can be over a 500,000-byte portal limit | Fixed |
| [RES-03](#res-03) | LOW | Compact density PDF splits a two-line bullet across pages, leaving a one-line widow | Fixed |
| [RES-04](#res-04) | LOW | Word export: a long project link runs into the tech text with no separator ('Power BIgithub.com/…') | Fixed |
| [RES-05](#res-05) | LOW | Keyword match counts generic words ('know', 'unit', 'juniors') as key terms and splits 'unit tests' | Fixed |
| [RES-07](#res-07) | LOW | Closing the whole browser within about 300 ms of the last keystroke may lose that edit (Playwright forced close only) | Fixed |
| [RES-09](#res-09) | LOW | Job-description keyword match drops short technology names (Go, R, C) and turns '.NET' into 'NET', which is then counted as covered by the ordinary word 'net' (e.g. 'net revenue') | Fixed |
| [SEC-03](#sec-03) | LOW | Image to PDF trusts the browser-reported type instead of the file contents (accepts SVG) | Fixed |
| [SEC-04](#sec-04) | LOW | Windows reserved device names with more than one dot are not neutralised in ZIP entry names | Fixed |
| [SEC-05](#sec-05) | LOW | Resume PDF link sanitiser treats tel:<digits> as host:port (phone links dropped or turned into https://tel:NNNNN/) | Fixed |
| [SEC-08](#sec-08) | LOW | Already-open home page tab keeps showing a resume name after 'Delete everything' | Fixed |
| [SEO-02](#seo-02) | LOW | 404 redirect map does not redirect extensionless URLs of moved guides | Fixed |
| [SEO-03](#seo-03) | LOW | Old 'ApplyReady.in' branding left in resume PDF/DOCX metadata, code headers and SEO doc | Fixed |
| [SEO-04](#seo-04) | LOW | docs/PROGRESS.md says nothing has been deployed although the site is live from this commit | Fixed |
| [SEO-05](#seo-05) | LOW | Regular icon font is not cached for offline use, so regular-style icons disappear offline | Fixed |
| [LIVE-03](#live-03) | INFORMATIONAL | Donation link appears twice on About, Contribute and Philosophy | Declined |
| [NAV-07](#nav-07) | INFORMATIONAL | 'Most used' and 'Popular tools' labels suggest usage tracking on a site that says it has no analytics | Fixed |

### PA-01

**Every PDF opened by a PDF tool starts a pdf.js worker that is never shut down, so memory grows without limit (1.5 GB for 50 PDFs in Merge)**

- **Severity:** HIGH
- **Verification:** reproduced independently on the live site (confirmed)
- **Where:** https://applyready.in/merge-pdf.html (also compress-pdf.html, workspace.html and every tool that uses ApplyReadyPdf.openJs/closeJs)
- **Description:** ApplyReadyPdf.closeJs(doc) calls doc.destroy(). pdf.js 6.5.438's PDFDocumentProxy has no destroy(), so nothing is released, and the try/catch hides this. Each openJs() call uses a new PDFWorker, which therefore stays alive with its parsed document. Merge opens every added PDF for a thumbnail, so each file leaves a dedicated worker behind. 'Remove all', clearing the list, and running the tool again do not free them. In the applicant workspace the pdf.js worker that compressed an applicant's PDF is still alive after 'Finish applicant'. That contradicts docs/ARCHITECTURE.md ('every document opened in it is destroyed when its job ends') and keeps that applicant's document in memory on a shared computer until the tab closes.
- **Reproduction:** 1) Open https://applyready.in/merge-pdf.html. 2) Add 50 small PDFs, the tool's maximum (generated by scratchpad/audit/perf-a11y/perf/merge50.js). 3) Count the worker targets with CDP Target.getTargets and measure renderer RSS. Or run perf/merge-diag.js, which adds 10 PDFs and then does 'Remove all', 15 times.
- **Expected:** One shared pdf.js worker (or one per running job, terminated afterwards), with memory going back to its baseline after a document is closed or the list is cleared.
- **Actual:** Adding 50 PDFs leaves 51 workers, and renderer RSS goes from 221 to 1,505 MB. Over 15 add-and-clear cycles of 10 PDFs, workers go from 11 to 151, renderer RSS from 526 to 2,776 MB, and JSEventListeners rise by 20 per cycle (99 to 379). The JS heap stays at about 5 MB. Each compress run adds one worker and about 190 MB. In the workspace, pdf.worker.min.mjs is still alive after Finish applicant (perf/ws-workers2.js). In the page, typeof doc.destroy === 'undefined', and doc.loadingTask._worker.destroyed is false after closeJs (perf/pdfjs-worker-diag.js, perf/pdfjs-worker-diag2.js).
- **Root cause:** js/lib/pdf-kit.js:270: `async function closeJs(doc) { if (doc && doc.destroy) { try { await doc.destroy(); } catch (e) {} } }`. PDFDocumentProxy.destroy() does not exist in the vendored pdf.js 6.5, so the guard skips the call. The release API is doc.loadingTask.destroy(). openJs (pdf-kit.js:246) also never passes a shared `worker`, so each getDocument creates its own PDFWorker.
- **Recommended fix:** In closeJs call `await (doc.loadingTask ? doc.loadingTask.destroy() : doc.destroy && doc.destroy())`. Better, create one `new lib.PDFWorker()` in pdfjs() and pass it as `worker` to every getDocument, so a single worker is reused and each document is still freed by loadingTask.destroy(). Add a browser test that opens and closes 20 PDFs and checks that only 1 worker target remains.
- **Verification method:** Rerun perf/merge-diag.js and perf/merge50.js: worker targets should stay at 1 or 2, and renderer RSS should go back to about 300 MB after Remove all. perf/ws-workers2.js should show no pdf.js worker holding a document after Finish applicant.
- **Resolution in this round:** Fixed. Root cause: closeJs called PDFDocumentProxy.destroy(), which pdf.js 6.5 does not have, so no document was ever closed and no worker was ever stopped. closeJs now closes the document through doc.loadingTask.destroy(), which frees the parsed document and stops its worker. openJs now destroys the loading task when a document fails to open (wrong password, damaged file). singleTool now closes the pdf.js document of a file it refuses for its page count. The result is one worker per open document, stopped when that document closes. In my reproduction on the original code, three add-and-clear cycles of 10 PDFs in Merge left 11, then 21, then 31 workers; after the fix 0 PDF workers remain (only the service worker). Workspace jobs use the same closeJs, so 'Finish applicant' stops the worker as well. After an independent check: Two causes, both fixed. (1) pdfjs()/openJs now use one shared lib.PDFWorker per page, passed as `worker` to every getDocument. closeJs/loadingTask.destroy still frees each document, and the worker keeps running. A worker that never started (fake-worker or worker-failed errors) is dropped and replaced on the next open. One that was only told to drop a single document is kept, because other open files use it. (2) With the shared worker alone, memory still grew about 24 MB per round of 10 scanned PDFs. I traced this to pdf.js handing JPEGs to Chrome's ImageDecoder (WebCodecs): open-only and blank-canvas loops stayed flat, page rendering grew about 2.4 MB per render, and isImageDecoderSupported:false made it flat. openJs now passes isImageDecoderSupported:false, so pdf.js uses its own JPEG decoder. Measured with the verifier's pa01c method (merge-pdf.html, 10 PDFs added then Remove all, 12 rounds): renderer memory was 214 MB at start, 319 after round 1, then 288-291 MB for every later round. Before: 327 to 646 MB over 8 rounds.
- **Regression test:** tests/pdf_tools_tests.js section 11. Merge with 8 PDFs: 0 pdf workers after the thumbnails, and 0 after merging and Remove all. PDF to text: after a wrong password, Remove, and replacing the file three times, at most 1 worker. I also ran a diagnostic script before and after the fix (scratchpad pdfx/pa01.js).
- **Fix verified by:** an independent verifier re-ran the original reproduction against the fixed build (pdf package); the verifier raised a follow-up issue, which was then repaired

### PDF-01

**Deleted or excluded pages stay hidden inside Organize/Split/Merge output when another page links to them**

- **Severity:** HIGH
- **Verification:** reproduced independently on the live site (confirmed)
- **Where:** https://applyready.in/organize-pdf.html (also split-pdf.html, merge-pdf.html)
- **Description:** pdf-lib copyPages copies every object a page references. A kept page's link annotation /Dest (or an annotation /P) points at another page object, so that whole page, with its content stream, is copied into the new file as an unreferenced page object. A page the user deleted in Organize, or left out in Split, is therefore still inside the downloaded file and can be recovered. Merge has the same effect: internal links point at a hidden duplicate instead of the real page, so they break and the file grows. Explicit /Dest arrays are normal in Word or LibreOffice files with a table of contents or cross-references.
- **Reproduction:** 1) Make a 2-page PDF where page 2 has a link to page 1 (in/forms_bookmarks_links.pdf, made with ReportLab linkAbsolute). 2) On organize-pdf.html, open it, delete page 1, Save PDF, download (out/org_deleted_p1.pdf). 3) python3 scripts/orphans.py out/org_deleted_p1.pdf 'FORM PAGE 1' prints 'orphan page objects [5]; streams containing FORM PAGE 1: [18]'. 4) Rebuild a page from that object with pypdf: the text 'FORM PAGE 1: Name field below / LINK to example.com' comes back (out/recovered_deleted_page.pdf, shots/recovered_deleted_page-1.png). Split extract '2' gives the same result (out/split_forms_p2.pdf, 5.6 KB instead of about 1.5 KB). In out/merge_desktop.pdf the link on page 27 points to orphan object 77, not page 26.
- **Expected:** The output holds only the pages the user kept. Links to removed pages are dropped, and links between kept pages point at the kept copies.
- **Actual:** Removed pages are still in the file as hidden page objects with full content. Internal links point at those hidden copies.
- **Root cause:** js/lib/pdf-kit.js extract() (line ~416), assemble() (~425) and merge() (~396) call out.copyPages(), and pdf-lib's PDFObjectCopier follows /Annots -> /Dest [pageRef ...] or /A /D and annotation /P into other page dictionaries. Nothing removes annotation page references afterwards.
- **Recommended fix:** After copying, check each kept page's /Annots. Map /Dest or /A /D page refs (and /P) to the matching copied page when it is kept; otherwise remove the link annotation, or strip /Dest and /P, before saving. Another option is to drop /Annots entries that refer to page objects outside the output. Add a test that greps the saved bytes for text from a deleted page.
- **Verification method:** Repeat steps 1-3: orphans.py must report no orphan page objects and no stream containing 'FORM PAGE 1'. In a merge of a self-linking file, the link /Dest must resolve to an output page.
- **Resolution in this round:** Fixed. merge, extract and assemble no longer call pdf-lib copyPages. They use copyInto(), which fills the pdf-lib copier's map before copying: each kept source page points to its copy in the new file, and every other source page points to a 'dead' reference that is never written. unlinkDropped() then removes link annotations whose /Dest or GoTo /D leads to a dropped page, and deletes or nulls any other reference to one (such as an annotation's /P). Deleted or left-out pages are no longer copied as hidden page objects, and in Merge, links point to the merged pages. On the auditor's forms_bookmarks_links.pdf, orphans.py now reports no orphan page objects and no stream containing 'FORM PAGE 1'.
- **Regression test:** Unit checks in tests/pdf_tools_tests.js (auditUnits). For extract and assemble: the left-out page's text is not in the saved bytes, the file has exactly 1 page object, the link to the removed page is dropped and the link to the kept page still resolves. For a merge of a self-linking file: 4 page objects, and every link leads to the matching merged page.
- **Fix verified by:** an independent verifier re-ran the original reproduction against the fixed build (pdf package)

### RES-01

**Long text (over 50,000 chars in a field) or over 150 entries is shown as saved, then the whole resume becomes 'Damaged: cannot be opened'; the backup silently drops that text**

- **Severity:** HIGH
- **Verification:** reproduced independently on the live site (confirmed)
- **Where:** https://applyready.in/resume.html
- **Description:** The editor sets no length or count limit on the summary, bullet textareas, custom text or entry lists. The storage schema (js/resume-schema.js) only accepts strings of 50,000 characters or fewer and lists of 150 entries or fewer. Autosave writes the record anyway, and the status says 'Saved on this device · just now'. On the next load LIB.inspect() fails validation, so the whole resume (every section, not just the long field) is listed as damaged and cannot be opened; only 'Export raw' is offered. The safety nets fail too. 'Download backup' runs the data through migrate(), which silently replaces the over-long field with an empty string (or cuts the list to 150). 'Export all' only includes readable records, so it silently leaves the damaged resume out while saying 'Backup of N resumes downloaded'. A person who pastes an old CV or a long publication list into one box loses access to the resume and gets no warning.
- **Reproduction:** 1. Open https://applyready.in/resume.html in a fresh profile and type 'Limit Tester' as Full name. 2. Open Professional summary and paste a 52,000-character text (for example an old resume). 3. Wait 2 s: the status reads 'Saved on this device · just now'. 4. Click Download > 'Download backup': the downloaded JSON has data.summary = '' (length 0). 5. Reload the page. The editor is empty, with the notice 'The resume in this link is damaged and cannot be opened'. My resumes lists 'Limit Tester: Damaged: cannot be opened. The saved data is not a resume this version can read.' The same happens with one experience bullets box over 51,000 characters, or after clicking 'Add role' 151 times.
- **Expected:** Either the editor stops input at the limit and explains it, or storage and backups accept what the editor accepts. A resume that was reported as saved must reopen, and a backup must contain everything on screen or say what it left out.
- **Actual:** The status said Saved. After reload the whole resume could not be opened. The app's own backup had summary length 0 (silent loss), and Export all omits the damaged resume.
- **Root cause:** js/resume-schema.js: text = x => typeof x === 'string' && x.length <= 50000, and arrayValid requires array.length <= MAX_ENTRIES (150), inside validate(). LIB.inspect() (js/resume-library.js) requires validate() to pass before opening a stored record. flush() in js/resume-library-ui.js writes editorJSON() without validating it. migrate() (used by singleBackup and toLegacyCompatible) does `text(src.summary) ? src.summary : ''` and list(...).slice(0, MAX_ENTRIES), which drops data silently. The editor inputs (resume.html summaryText, the item-bullets textareas, cs-text) have no maxlength, and btnAddExperience and the other add buttons have no 150 cap (only custom-section entries are capped, in resume-sections.js:244).
- **Recommended fix:** Enforce the same limits at input time: maxlength=50000 on textareas and inputs, and disable the Add buttons at 150 with a message. Also validate in flush() before writing and show an error state instead of 'Saved'. In inspect(), open records that fail only on size by truncating with a visible warning instead of marking them damaged. In singleBackup/libraryBackup, never drop text silently: export the raw editor data, or warn. Include damaged records in Export all, or say they were excluded.
- **Verification method:** Run scripts/limits.js summary|bullets|entries and scripts/limits2.js under scratchpad/audit/resume/scripts/. After a fix the resume must reopen after reload (or input must stop at the limit with a message), and the backup's summary length must equal the editor's.
- **Resolution in this round:** Fixed. Write-step boxes now stop at 50,000 characters (maxlength is set when a box gets focus; a capture-phase input guard catches anything that gets past it). When text is cut, a note appears under the box (field-error, linked with aria-describedby) and a toast is shown. The note stays until the box is under the limit again. Add and Duplicate stop at 150 entries and say why (roomForEntry). flush() validates the data before writing: data over the limits is never stored, and the status shows 'Not saved: too long to store' with a notice saying what to shorten. migrate() now shortens over-long text (without splitting a surrogate pair) instead of emptying it. validate() takes { lenient: true }, which inspect() uses so that records saved by older releases over the limits open shortened and are marked trimmed instead of 'Damaged'. That resume then shows a notice with a 'Download the original' button that downloads the raw stored record; the original stays stored until the resume is changed. Export all in My resumes (and on Your data) now says which damaged entries it left out and which resumes it holds shortened. leaveCurrent() now asks before dropping unsaved changes when a save fails, instead of losing them silently.
- **Regression test:** resume_library_tests section 15: paste 52,000 characters, then check the note, reload, backup length, the 150-entry cap on Add and Duplicate, refused oversize save, and an over-limit record from an older release (opens, notice, original download, Export all message, edit then strict-valid save, axe audit). run_tests suite 17 adds checks for lenient validation, clipping, surrogates and the inspect trimmed flag. Also re-ran the auditor's limits.js summary|bullets|entries against the fixed build: all three reopen with no damaged entry.
- **Fix verified by:** an independent verifier re-ran the original reproduction against the fixed build (resume package)

### BAT-01

**On phones the settings are below the whole file list (33,000 px down with 300 images)**

- **Severity:** MEDIUM
- **Verification:** reproduced independently on the live site (confirmed)
- **Where:** https://applyready.in/batch-image.html (same layout on compress-image.html and convert-image.html)
- **Description:** At phone width the workspace puts the file list ('stage') above the settings ('side'). Once images are added, Preset, Resize, KB limit and Format move below every row. To change a setting after adding files (for example after the 'You changed the settings' notice, or to fix a KB limit), the user has to scroll past the whole list. Only the sticky Start button stays in reach, and nothing links to the settings.
- **Reproduction:** Open https://applyready.in/batch-image.html at 360x740 (Pixel 7 emulation). Before adding files, Preset is at y=760. Add 20 images: the list runs from 435 to 2,608 px and Preset is at 2,695 px. Add 300 images: the list runs from 435 to 33,014 px and Preset is at y=33,101 (page height 39,466 px), about 45 screens down.
- **Expected:** Settings reachable without scrolling past every file on a phone: for example settings above the list, a 'Settings' jump link or button in the sticky bar or batch bar, or a collapsed list.
- **Actual:** With 20 images the settings are 2,695 px down; with 300 images, 33,101 px.
- **Root cause:** css/app.css, mobile media query (about line 1244): .ws { grid-template-areas: 'head' 'stage' 'side' 'action'; } with .ws-rail { display: contents; }. #batchList sits inside .ws-stage, so its height pushes .ws-side (the settings) down.
- **Recommended fix:** For .ws--batch on small screens, put 'side' before the list (or move #batchList after .ws-side). Or add a 'Settings' button in the batch bar or sticky action bar that scrolls to and focuses #bPreset. Or cap the list height with internal scrolling on phones.
- **Verification method:** At 360x740, add 300 images and check that #bPreset is reachable within one screen, or with one tap from a visible control.
- **Resolution in this round:** Fixed. Root cause: on screens under 1000px the file list sat inside .ws-stage, which came before the settings ('side'). #batchList now has its own wrapper (.batch-files) after .ws-rail in the markup, with grid area 'files'. On desktops it sits under the stage beside the rail ('head head' 'stage rail' 'files rail'), so desktops look the same as before. Under 1000px the order is head, stage, side, files, action, and the sticky Start bar is kept. On phones, a stage with nothing visible (the compact drop zone is hidden there) is now hidden too, so no empty grey strip is left. Measured at 360px with 300 images: Preset moved from y=33,101 to y=490. The list now starts after the settings. This applies to all three pages built from the batch workspace. CSS was added inside section 20.
- **Regression test:** tests/batch_image_tests.js block 3d2. At 360px with 60 images: Preset and Format come before the list, and Preset is within one screen of the tool's top. The empty stage is hidden. In the done state the order is result, then settings, then list. No sideways scroll, and axe passes in both themes. On desktop the list is under the drop zone and beside the settings. All of these checks fail on 92f7ef0.
- **Fix verified by:** an independent verifier re-ran the original reproduction against the fixed build (batch-cafe package)

### IMG-01

**Signature cleaner 'Paper whiteness' slider works backwards from its hint; default leaves dim paper grey**

- **Severity:** MEDIUM (auditor rated HIGH)
- **Verification:** reproduced independently on the live site (confirmed-different-severity)
- **Where:** https://applyready.in/signature-cleaner.html
- **Description:** The hint under 'Paper whiteness' says 'Raise it if the paper still looks grey or yellow.' In the code, raising the slider raises the brightness threshold a pixel needs to be turned white. So raising it turns more paper into 'ink' and makes the background greyer. At the default (70, threshold about 200), paper photographed indoors or in shade (luminance about 160–200, which is common for phone photos) stays grey. A user who follows the on-screen advice gets a worse result. The only fix is to move the slider down, which nothing on the page suggests.
- **Reproduction:** 1) Open https://applyready.in/signature-cleaner.html. 2) Choose a signature photo with dim paper (test file in/sig_dim.jpg, paper luminance median 180). 3) Download at the default setting: the paper is light grey (mean luminance 226.9). 4) Raise 'Paper whiteness' to 100 as the hint says and download again: the paper is darker grey (mean 191.7). 5) Lower it to 20: the paper becomes pure white (255.0). The shadowed-paper sample (in/sig_shadow.jpg) behaves the same: 206.4 at default, 171.3 at 100, 253.9 at 20.
- **Expected:** Raising 'Paper whiteness' makes the paper whiter, and the default produces white paper for ordinary indoor phone photos.
- **Actual:** Raising the slider makes the paper greyer, and the default leaves dim or shadowed paper grey, so the 'white paper' output fails for typical photos.
- **Root cause:** js/signature-cleaner.js processSignature(): `const threshold = 120 + (whiteness / 100) * 115;` and pixels are whitened only when `lum >= threshold`, so a higher whiteness means fewer pixels whitened. The hint text in signature-cleaner.html (line 315) describes the opposite. The fixed default of 70 gives threshold 200.5, which ignores the photo's actual paper brightness.
- **Recommended fix:** Invert the mapping, e.g. `threshold = 235 - (whiteness/100) * 115`, so higher means whiter, or relabel the control and its hint. Better: estimate the paper level from the image (e.g. a high percentile of luminance, or local background normalisation to remove shading) and set the default threshold relative to it.
- **Verification method:** Run in/sig_dim.jpg and in/sig_shadow.jpg at default and at max whiteness. The paper region (top 100 rows) should have mean luminance >= 250 and increase, not decrease, as the slider rises, while the faint stroke at rows 415–425 is kept.
- **Resolution in this round:** Fixed. The root cause was that a higher whiteness raised the brightness a pixel needed to turn white. The fix measures the paper's brightness across the photo: the 90th percentile in each block, then the median of neighbouring blocks, floored at half the whole photo's paper level and interpolated between blocks. Each pixel is compared with that level, and the threshold is 260 - 0.6*whiteness, so a higher setting turns more of the paper white, as the hint and guides say. Grey indoor paper and shadows now come out white at the default. I re-measured every figure quoted on the page and in three guides with the sample and regenerated the cleaned sample image. Quoted figures now: 44.1 KB JPEG, 151.7 KB PNG, 161.2 KB transparent PNG, 6.4 KB at 300x100, 17.7 KB at 709x236. The compress tutorial figures also changed: 37 KB and 183 KB total.
- **Regression test:** image_workflow_tests section 17 uses a synthetic signature on grey, shadowed paper with navy ink and a faint stroke. It checks that the paper mean is at least 250 at whiteness 70 and 100, that the share of white paper rises from 20 to 70 to 100, and that the faint stroke is kept at the default.
- **Fix verified by:** an independent verifier re-ran the original reproduction against the fixed build (image package)

### IMG-02

**Custom size keeps width and height locked to the previous shape, so typing a form's W x H gives the wrong size**

- **Severity:** MEDIUM
- **Verification:** reproduced independently on the live site (confirmed)
- **Where:** https://applyready.in/image-resizer.html (also resize-image-to-kb-limit.html)
- **Description:** When 'Custom size' is chosen, 'Keep aspect ratio' is on by default with the previous ratio (1:1 from 350x350). Typing the width changes the height, and then typing the height changes the width back. A user entering a form's requirement of 300 x 200 px gets 200 x 200 px. The result screen reports 200 x 200 as 'verified', so the wrong file is ready to upload. The lock is also inconsistent: in cm or inch mode with decimal values it silently does nothing.
- **Reproduction:** 1) Open https://applyready.in/image-resizer.html and choose 'Custom size'. 2) Add photo_640x480.jpg. 3) Open 'Size, file limit and format'. 4) Type 300 in Width, then 200 in Height. 5) The fields now read 200 and 200 and the summary says '200 × 200 px · under 50 KB · JPEG'. 6) Resize: the output is 200 x 200. Same for 800x600 -> 600x600 and 200x150 -> 150x150.
- **Expected:** Entering both a width and a height produces exactly that width and height. The lock should be off for Custom, or follow the image's ratio and only fill the other field when it is empty.
- **Actual:** The second value typed overwrites the first through the 1:1 lock; the output has the wrong pixel size and is labelled verified.
- **Root cause:** js/resizer.js: `let isAspectLocked = true; let lockedRatio = 1.0;`. The input handlers on customWidth and customHeight both call scaleLockedDimension and write the other field whenever the lock is on. applyPreset keeps lockedRatio from the previous preset. scaleLockedDimension returns null for non-integers, so the lock is a no-op in cm and inch.
- **Recommended fix:** Default the lock to off for Custom size (forms specify both sides), or lock only while the other field has not been edited. At least, highlight the auto-changed field and say so in the summary.
- **Verification method:** Choose Custom, type 300 then 200: the fields should read 300 and 200 and the downloaded file should be 300x200 (identify).
- **Resolution in this round:** Fixed. The lock is still on by default, but it now fills in the other side only until the person types that side too. Typing 300 then 200 gives 300x200, while editing one side of a preset still keeps its shape (tests/browser_tests.js expects this). The ratio and the typed record reset whenever the tool fills the fields: a preset, a unit change, the original size, or turning the lock on. scaleLockedDimension now takes a unit, so the lock works with decimals in cm and inches. Related bugs fixed: changing cm to inches or cm to px used to read the cm value as pixels (3.5 cm became 4 px), and Use original size now switches the fields to px first. After an independent check: After a unit change, each field shows the rounded value but keeps the exact value (in the field's unit) in exactFields. fieldNumber() returns that exact value while the field still shows exactly what the tool wrote. The exact value is used by the next unit change, by getActiveSpecs (cm/in to px) and by the lock ratio. It is dropped when the person types in the field, when the lock fills the field, and when presets, the original size or link values fill the fields. The result's '(… cm at 300 DPI)' label is now worked out from the final whole pixels, so it states the size the file really prints at.
- **Regression test:** Section 13 types with the real keyboard. Typing only the width fills in the height. Typing 300 then 200 keeps both numbers, and the output is 300x200. Turning the lock off and on, then typing 600, gives 400. In cm the lock works with decimals, and cm to inches to px conversions are checked. The EXPECTED values in section 2 that recorded the old wrong unit conversion were corrected: 1.18 in, and 300x300 px.
- **Fix verified by:** an independent verifier re-ran the original reproduction against the fixed build (image package); the verifier raised a follow-up issue, which was then repaired

### IMG-03

**Truncated or corrupt JPEG is accepted and output as 'verified' with most of the picture blank**

- **Severity:** MEDIUM
- **Verification:** reproduced independently on the live site (confirmed)
- **Where:** https://applyready.in/passport-photo-resizer.html (all resizer pages), signature-cleaner.html, passport-photo-print.html
- **Description:** A JPEG cut off at one third (a typical broken download or interrupted transfer) loads without any warning. The resizer produces a 350x450 file whose bottom 70% is blank white and labels it 'Ready to upload', 'verified'. The signature cleaner and passport print sheet also accept it (the sheet prints six half-blank photos). The compressor and converter correctly reject the same file with 'This image could not be opened. It may be damaged...'.
- **Reproduction:** 1) Make a truncated JPEG (first third of photo_640x480.jpg: in/truncated.jpg). 2) Open https://applyready.in/passport-photo-resizer.html and choose it. 3) Status reads 'Ready to edit'; press Resize and compress. 4) The result says '350 × 450 px, verified' and the download is mostly blank. 5) Repeat on signature-cleaner.html and passport-photo-print.html: both accept it and produce outputs.
- **Expected:** Damaged images are refused with a clear message (as the batch tools do), or at least flagged before an upload-ready file is offered.
- **Actual:** Silently accepted; the output is partly blank but presented as verified.
- **Root cause:** js/resizer.js handleFileSelect, signature-cleaner.js handleFile and passport-photo-print.js handleFile decode with `new Image()` from a data URL. Chromium fires onload for a partially decodable JPEG, and the only checks are naturalWidth/naturalHeight > 0. js/lib/image-ops.js (batch tools) decodes with createImageBitmap, which fails on the incomplete stream.
- **Recommended fix:** Decode with createImageBitmap (or `img.decode()` plus a check for an EOI marker 0xFFD9 near the end of JPEGs) in all three tools, and show the batch tools' 'may be damaged' message on failure.
- **Verification method:** Load in/truncated.jpg in each of the three tools: an error message should appear and no download should be offered.
- **Resolution in this round:** Fixed. New ApplyReadyImageOps.openImage(). It refuses a picture over 50 MP from the header before decoding, decodes with createImageBitmap and never falls back to an <img> (an <img> accepts a truncated JPEG and shows the missing part blank), and can enforce a minimum size. It throws a plain message with a code. The resizer, signature cleaner, print sheet, Image to PDF and Compress PDF (image input) all use it. decode() also no longer falls back to <img> when createImageBitmap exists, so the batch main-thread fallback treats damaged files the same as the worker does. In the resizer, a refused file leaves the previous photo usable, and Process is disabled while a new file is being checked.
- **Regression test:** Section 12 checks the resizer, section 17 the cleaner, section 18 the print sheet, section 19 Image to PDF and section 20 Compress PDF. Each loads a JPEG truncated to one third and must refuse it with a message and offer no download.
- **Fix verified by:** an independent verifier re-ran the original reproduction against the fixed build (image package)

### IMG-04

**Signature cleaner 'Keep original ink' turns blue ink pure black**

- **Severity:** MEDIUM
- **Verification:** reproduced independently on the live site (confirmed)
- **Where:** https://applyready.in/signature-cleaner.html
- **Description:** The default ink option is 'Keep original ink (cleaned)', but a signature in blue ink comes out pure black (RGB 1,1,1). Many application forms ask for a signature in blue or black ink specifically, so a user who keeps the default expecting blue gets black. The separate 'Deep blue' option does produce blue.
- **Reproduction:** 1) Open https://applyready.in/signature-cleaner.html. 2) Choose in/sig_bright.jpg (navy ink, mean RGB 33,40,118). 3) Leave 'Keep original ink (cleaned)' and download. 4) The ink pixels average RGB (1,1,1); the 'Pure black' output is identical.
- **Expected:** Ink hue is preserved (navy stays navy, only darker and cleaner).
- **Actual:** Ink becomes black, the same as 'Pure black'.
- **Root cause:** js/signature-cleaner.js, original-ink branch: `dst[i] = Math.max(0, Math.round(r - (255 - r) * (darkenAmount - 1)))`. With the default contrast 80, darkenAmount = strokeStrength x 2.44 is about 2.44 for solid strokes, so every channel becomes negative and is clamped to 0. Faint strokes with darkenAmount < 1 are instead lightened.
- **Recommended fix:** Darken in a hue-preserving way, e.g. scale luminance while keeping chroma (convert to HSL/Lab, reduce L by the contrast factor, keep a/b), or blend each pixel toward a darkened copy of the stroke's own colour rather than subtracting (255-r).
- **Verification method:** Process in/sig_bright.jpg with the default option: mean ink colour should keep B clearly greater than R and G (blue), and differ from the 'Pure black' output.
- **Resolution in this round:** Fixed. Keep original ink now divides out the paper's cast, then darkens all three channels by the same factor, 1/(1+0.3*(contrast-1)*strength), so the hue stays: blue stays blue. Stroke edges blend into white by coverage. A transparent PNG now uses ink colour with coverage as opacity, so there is no white fringe. All three ink modes use the same coverage model.
- **Regression test:** Section 17: with the default ink option, the mean ink colour has B more than 30 above R and more than 25 above G, and it differs clearly from the Pure black output.
- **Fix verified by:** an independent verifier re-ran the original reproduction against the fixed build (image package)

### LIVE-01

**Offline page says every tool and guide works after the first visit, but its buttons lead back to the offline page**

- **Severity:** MEDIUM
- **Verification:** reproduced independently on the live site (confirmed)
- **Where:** https://applyready.in/offline.html (shown for any page never opened while offline)
- **Description:** The offline page tells visitors: 'ApplyReady runs in your browser, and after your first visit it keeps every tool and guide on this device, so the pages below should still open.' The service worker deliberately does not do this. It keeps only the pages this browser has opened; the whole site is cached only when the visitor asks for it on Your data. So a visitor who has opened only the home page, then loses connection, follows Browse all tools, Open the image resizer, Open the resume builder or Browse the guides and lands on the same 'You are offline' page each time. The sentence also contradicts itself: it opens with 'This page is not saved on this device yet'.
- **Reproduction:** 1) In a fresh Chromium context (service workers allowed) open https://applyready.in/ and reload once, so the page is controlled by the service worker. 2) Go offline. 3) Open https://applyready.in/about.html: the offline page appears. 4) Click each of the four buttons. Script: scratchpad/audit/live-sweep/scripts/offline_click.js.
- **Expected:** The buttons open working pages after a first visit, as the text promises. Otherwise the text says only pages already opened on this device (or the whole site, if saved on Your data) work offline, and points to Your data to save the site.
- **Actual:** All four buttons lead to the offline page: tools.html, image-resizer.html, resume.html and guides/ each show 'You Are Offline | ApplyReady'. Screenshot: scratchpad/audit/live-sweep/sw/offline_buttons_1280.png. The header 'Search tools' also needs js/tool-index.js and js/search.js; if they are not cached it falls back to tools.html, which is again the offline page.
- **Root cause:** offline.html line 140 (page-lede) describes caching the whole site on the first visit. sw.js (header comment and STATIC_ASSETS handling) caches only pages that were opened, plus offline.html at install; the full precache runs only on request from your-data.html. The copy was not updated when that design was chosen.
- **Recommended fix:** Reword offline.html to match the real behaviour, e.g. 'Pages you have already opened on this device still work. To use every tool offline, save the whole site from Your data while you are online.' Link to /your-data.html. Optionally show only links whose pages are in the cache (caches.match) or mark the others.
- **Verification method:** Repeat the reproduction: either the text no longer promises unvisited pages, or (after saving the site on Your data) every button on the offline page opens a working page.
- **Resolution in this round:** Fixed. offline.html no longer promises that every tool is kept after a first visit. The new lede describes what is really kept. The new js/offline.js reads Cache Storage (caches.match with ignoreSearch) and shows only the buttons whose pages are cached; it does this when the page is served in place of another page, or when it is opened directly while offline. The first button left visible becomes the primary one. It also adds a list of the other kept tools, taken from the footer links, and a status line. The page now points to Your data > Save every tool for offline use (#offline). A Home button was added. The page explains that the PDF tools need the PDF library. The same over-promise was reworded in how-to-use.html, changelog.html, about.html and philosophy.html. After an independent check: The list of other kept pages now comes from the 'applyready-files' cache itself instead of the footer links. Every cached HTML page is listed except offline.html, 404.html, the page that was asked for, and the pages already shown as buttons. Footer pages keep their short footer names and order. Other pages (KB presets, guides) follow, named by the <h1> read from their cached copy as text, so nothing in it runs or loads. When no button is visible the heading reads 'Pages kept on this device'. The no-pages status line can now only appear when the cache really holds no other page. CSS (inside section 11, Status pages): the status line keeps a gap from the list and the note when the buttons are hidden. The margins collapse, so spacing is unchanged when the buttons show.
- **Regression test:** robustness_tests.js: after visiting only the home page and going offline, the offline page offers only '/'. After the resume builder is opened, it offers '/' and '/resume.html', and clicking that button opens the builder offline. A Merge PDF page opened online shows up in the kept-pages list. After Save every tool, all 5 buttons and more than 10 kept pages are offered. content_tests.js checks the lede, the Your data link and the script, and that no page promises offline use after a first visit. Screenshots checked at 360 and 1280 px, light and dark, with no horizontal scroll.
- **Fix verified by:** an independent verifier re-ran the original reproduction against the fixed build (site package); the verifier raised a follow-up issue, which was then repaired

### NAV-01

**Search ignores numeric file sizes, so 'pdf 300kb' opens Merge PDF and 'signature 10kb' puts Signature cleaner first**

- **Severity:** MEDIUM
- **Verification:** reproduced independently on the live site (confirmed)
- **Where:** https://applyready.in/ (inline search), and the header search dialog on every page
- **Description:** Applicants usually search with the limit from the form, e.g. 'pdf 300kb', 'pdf 2 mb', 'photo 30kb' or 'signature 10kb'. When the number is not one of the few hard-coded preset keywords (10kb, 20kb, 50kb, 100kb, 200kb), the number-plus-unit token matches nothing. Ranking then falls back to popularity or alphabetical order. In the live dialog and inline box, 'pdf 300kb' gives Merge PDF, Compress PDF, Split PDF, Watermark PDF, and pressing Enter opens Merge PDF. 'pdf 2 mb' and '200kb pdf' also put Merge PDF first. 'signature 10kb' puts Signature cleaner above Signature resizer. 'photo 30kb' and 'photo 40 kb' give Passport photo resizer and Passport photo print sheet first, and Resize image to a KB limit is not in the top 4. A person who types their portal's limit and presses Enter lands on the wrong tool.
- **Reproduction:** 1. Open https://applyready.in/ at 360x740.
2. Type 'pdf 300kb' in the home search box.
3. The first, pre-selected result is Merge PDF. Press Enter and you land on merge-pdf.html.
4. In the dialog (press /), also try 'signature 10kb', 'photo 30kb' and 'pdf 2 mb'.
- **Expected:** 'pdf 300kb', 'pdf 2 mb' and '200kb pdf' rank Compress PDF first. 'signature 10kb' ranks Signature resizer first. 'photo 30kb' ranks Image compressor or Resize image to a KB limit first.
- **Actual:** Merge PDF first for the PDF size queries, Signature cleaner first for 'signature 10kb', and Passport photo resizer first for 'photo 30kb' and 'photo 40 kb'. Evidence: shots/phone-inline-pdf_300kb.png, shots/phone-inline-signature_10kb.png, shots/phone-inline-photo_30kb.png, out/search-extra-local.txt.
- **Root cause:** js/search.js norm() deliberately joins number and unit ('300 kb' becomes '300kb'). tokenScore() only does exact or prefix matching against keyword words, so '300kb' never matches the unit 'kb' or 'mb', which belong to the compress synonym group. correct() also skips tokens containing digits. The size token stays unmatched, the score is multiplied by matched/total*0.6, and the order is decided by `popular` (Merge PDF popular=4 beats Compress PDF popular=6) or, for the two signature tools, by name.localeCompare ('Signature cleaner' < 'Signature resizer').
- **Recommended fix:** In search(), split a token matching /^(\d+(\.\d+)?)(kb|mb)$/ into a size intent. Score it as the unit word 'kb' or 'mb' (which maps to the compress group), and add a boost for 'Resize image to a KB limit' on image queries and for Compress PDF when 'pdf' is present. Break ties within a single-word match by `popular` before the name, and give Signature resizer a popular rank above Signature cleaner.
- **Verification method:** In the live dialog, check that 'pdf 300kb', 'pdf 2 mb' and '200kb pdf' show Compress PDF first; 'signature 10kb' and 'signature 15 kb' show Signature resizer first; 'photo 30kb' shows a KB-limit or compressor tool first. Add these cases to the search unit tests.
- **Resolution in this round:** Fixed. In js/search.js, a token like 300kb or 2mb is read as a size. It matches the preset page for that exact size when one exists, and otherwise counts as the unit (kb/mb, which maps to the compress group). The unit reading has half weight, counts only for name or keyword matches, and is excluded from the name-closeness and popularity bonus. A page made for exactly that size gets a bonus in multi-word queries. Results now: 'pdf 300kb', 'pdf 2 mb', '200kb pdf' and 'pdf 100kb' give Compress PDF first; 'signature 10kb' gives Signature resizer; 'photo 30kb' gives Image resizer (which does KB limits) then Image compressor; '50kb' still gives only the 50 KB page. After an independent check: Root cause: the exact-size +10 bonus went to any item whose keyWords held the size token, and Signature resizer's keyword 'signature 20kb' qualified it. Now only a preset page (item.presetOf, already in the tool index) or a page whose name carries the size gets the bonus. Results: 'image 20kb', 'photo 20kb' and 'resize photo 20kb' now give resize-20kb first. 'signature 20kb' still gives Signature resizer first, and 'signature 10kb', 'photo under 50 kb' and 'pdf 300kb' are unchanged.
- **Regression test:** navigation_tests.js: new cases for PDF, signature and photo size queries, and 'photo under 50 kb' still finds the 50 KB page first. The ui_tests directory filter test ('50kb' shows only the image resizer) still passes.
- **Fix verified by:** an independent verifier re-ran the original reproduction against the fixed build (site package); the verifier raised a follow-up issue, which was then repaired

### PA-02

**'Save every tool for offline use' says every tool is saved but leaves out the PDF libraries, so the PDF tools fail offline**

- **Severity:** MEDIUM
- **Verification:** reproduced independently on the live site (confirmed)
- **Where:** https://applyready.in/your-data.html#offline
- **Description:** The service worker's saveSite() downloads only STATIC_ASSETS. That list leaves out /js/vendor/pdf-lib.min.js and /js/vendor/pdfjs/* (they are cached only when a PDF tool is first used online). After saving, Your data says 'Every tool and guide is saved for offline use.' and hides the button. Offline, every PDF tool that the visitor never used online then fails.
- **Reproduction:** 1) In a fresh profile, open https://applyready.in/your-data.html and select 'Save every tool for offline use'. Wait for it to finish (about 3 s, 171 files). 2) Go offline. 3) Open /compress-pdf.html (it loads from the cache) and choose any PDF. 4) Open /merge-pdf.html and add 2 PDFs.
- **Expected:** Every tool works offline after 'Save every tool', or the page says plainly that the PDF tools need to be opened once online.
- **Actual:** Compress PDF shows 'A part of the PDF tool could not load. Check your connection and reload the page. Choose another file.' Merge PDF adds 0 files and shows the same error. The caches hold no pdf-lib or pdf.js entries ({"applyready-files":{"n":171,"vendor":[icons.min.css, cropper.min.css, cropper.min.js]}}).
- **Root cause:** sw.js saveSite() iterates only STATIC_ASSETS (generated by scripts/build-sw.js), which skips the vendor folder (isVendor files go to VENDOR_CACHE on first fetch only). js/your-data.js:413 then reports 'Every tool and guide is saved' when saved >= STATIC_ASSETS.length.
- **Recommended fix:** Have scripts/build-sw.js add a VENDOR_ASSETS list (pdf-lib.min.js, pdfjs/pdf.min.mjs, pdfjs/pdf.worker.min.mjs, plus the wasm and standard_fonts files that pdf-kit requests), and have saveSite() also fetch it into VENDOR_CACHE. Count it in siteInfo() and SITE_TRANSFER, which grows by about 650 KB gzip.
- **Verification method:** Rerun offline/saveall.js: the vendor cache should list pdf-lib and pdf.js, and the offline compress and merge should finish.
- **Resolution in this round:** Fixed. scripts/build-sw.js now generates VENDOR_ASSETS. It lists pdf-lib, pdf.min.mjs, pdf.worker.min.mjs, the wasm decoders, the ICC profile and the standard fonts; the CJK cmaps (1.7 MB) are left out and documented. In sw.js, saveSite() and siteInfo() use a shared missingFiles() helper that covers STATIC_ASSETS plus VENDOR_ASSETS, so 'Every tool and guide is saved' is now true for the PDF tools. SITE_BYTES and SITE_TRANSFER include the vendor files (.mjs counted gzipped), so Your data states the larger download before saving: about 4.7 MB transfer and 9.3 MB stored. refreshKept() also fetches again the vendor files kept under an old vendor cache name after a release that changes them (not under Save-Data).
- **Regression test:** robustness_tests.js: after Save every tool, the vendor cache holds pdf-lib, pdf.min.mjs and the worker. Then, offline, Compress PDF compresses a PDF on a context that never used a PDF tool online. content_tests.js checks the VENDOR_ASSETS entries exist and that saveSite and siteInfo include them.
- **Fix verified by:** an independent verifier re-ran the original reproduction against the fixed build (site package)

### PDF-02

**Add page numbers and Watermark grow the file with the square of the page count when pages share a font dictionary**

- **Severity:** MEDIUM
- **Verification:** reproduced independently on the live site (confirmed)
- **Where:** https://applyready.in/add-page-numbers.html, https://applyready.in/watermark-pdf.html
- **Description:** Many generators, including ReportLab and LibreOffice (checked: in/lo94.pdf), give every page the same indirect /Font dictionary. pdf-lib's drawText adds a new random font key (Helvetica-XXXXXXXX) to that shared dictionary for each page, then writes the dictionary inline on every page. Every page ends up carrying N+2 font entries. The output grows with N squared and may exceed portal upload limits.
- **Reproduction:** Open in/p300.pdf (263 KB) on add-page-numbers.html with defaults, Add numbers, download: 3,025,039 B. in/p800.pdf (688 KB) gives 20,663,699 B, and in/p2000.pdf (1.07 MB) gives 125,091,359 B in 6 s. Watermark gives 3.50 MB, 23.95 MB and 145.3 MB for the same files. pypdf shows len(page['/Resources']['/Font']) == 302 on every page of out/size_ad_p300.pdf, and 95 on the 94-page LibreOffice file.
- **Expected:** Output size about the input size plus one font object and a small content stream per page, for example under 1 MB for p800.
- **Actual:** Size grows with the square of the page count: 11x at 300 pages, 30x at 800 pages, 117x at 2,000 pages.
- **Root cause:** js/lib/pdf-kit.js addPageNumbers() and addWatermark() call pages[i].drawText(..., { font }) on pages whose /Resources /Font is a shared indirect dict. pdf-lib's PDFPageLeaf.normalize() resolves it and sets the same dict object directly into each page's Resources. newFontDictionary() then adds a new unique key per page to that one object, which is written in full inside every page.
- **Recommended fix:** Before drawing, give each page its own copy of its resource dictionaries (clone /Resources and its /Font and /ExtGState dicts per page). Or register the embedded font under one fixed key, added once, and write the text operators with that key yourself.
- **Verification method:** Run page numbers and watermark on in/p800.pdf and in/p2000.pdf: output should stay within about 2x the input, and each page's /Font dict should have 3 entries.
- **Resolution in this round:** Fixed. Before drawing on a page, ownResources() gives it its own shallow copy of /Resources and of its Font, ExtGState and XObject dictionaries. The original fonts and images stay shared by reference. The watermark now sets its font once per page and uses one see-through ExtGState for the whole file, added once per page, instead of pdf-lib adding a new font key and graphics state for every stamp (up to 400 on a tiled page). Output sizes: p2000.pdf (1.07 MB) went from 125 MB to 1.6 MB with page numbers, 1.8 MB with a centred watermark and 2.1 MB with a tiled one. p300.pdf went from 3.0 MB to 0.34 MB. Each page now carries 3 font entries.
- **Regression test:** Unit check on a 150-page PDF whose pages share one Resources dict, for page numbers, watermark and tiled watermark: growth under 2,000 bytes per page, 2 fonts and at most 1 graphics state per page, and pdftotext shows the page text and the stamp on the first and last pages.
- **Fix verified by:** an independent verifier re-ran the original reproduction against the fixed build (pdf package)

### PDF-03

**Damaged PDF gives blank pages reported as success, the message blames the browser, and File checker reports no problem**

- **Severity:** MEDIUM
- **Verification:** reproduced independently on the live site (confirmed)
- **Where:** https://applyready.in/split-pdf.html (also organize-pdf.html, watermark-pdf.html, add-page-numbers.html, merge-pdf.html, file-checker.html)
- **Description:** A PDF whose content streams are corrupt still has a readable page tree. pdf-lib opens it, pdf.js cannot. The single-file tools then say 'This PDF opened, but this browser could not draw its pages, so previews are not shown. The tool still works.' and produce output whose pages are all blank. The output is labelled 'Each file was opened again and its pages counted after saving.' Merge accepts the file with no warning. File checker lists it as 5 A4 pages with no problem, while PDF to text, PDF to image and Compress reject the same file as damaged.
- **Reproduction:** in/garbled.pdf = in/a4_text.pdf with 3,000 random bytes at offset 1772. Poppler renders 5 blank pages and pdftotext finds no text. Open it on split-pdf.html, type 'all', Split, download out/garbled_split.pdf: all 5 pages render blank (render/garb-*.png have 0 non-white pixels). file-checker.html shows no Problem or Check for it.
- **Expected:** The file is reported as damaged (or 'pages could not be read') rather than as a browser problem. Tools do not offer blank output as a checked success. File checker flags it.
- **Actual:** The message blames the browser and says the tool still works. Output is blank pages marked as checked. File checker gives the file a clean result.
- **Root cause:** js/lib/pdf-ui.js openPdf() tryOpen(): when pdf.js fails with code 'damaged' but pdf-lib succeeded, it sets previewError and continues. singleTool shows that previewError message. K.verify() only counts pages. js/lib/inspect.js inspectPdf() only parses structure with pdf-lib and never checks content streams.
- **Recommended fix:** Only fall back to 'no previews' when pdf.js is unsupported (code 'unsupported'). When pdf.js reports damage, show the damaged-file message and either block the job or warn clearly that pages may come out blank. In File checker, try to parse the first page with pdf.js, or decode content streams, and warn when that fails.
- **Verification method:** Load in/garbled.pdf in Split and File checker. Both should report it as damaged, and Split should not offer a blank result as successful.
- **Resolution in this round:** Fixed. New unreadablePages() in pdf-kit and the same check in inspect.js. A page is reported when its /Contents names a missing object or something that is not a stream, or when a Flate stream does not decompress (checked up to 16 MB in all). A page with no /Contents is blank by design and is not reported. openPdf records these pages. A file in which no page can be read is refused with a damaged-file message. Otherwise singleTool shows damageNotice: it names the file as damaged and says which pages, instead of the old 'this browser could not draw its pages'. The result texts in Split, Organise, Watermark, Page numbers and Merge now add a note that those pages are blank (only for pages actually in the output). Merge adds such a file with a warning. File checker shows a Problem: 'This PDF is damaged: the content of ... is missing or broken'. On garbled.pdf, Split now refuses the file and File checker reports it as damaged.
- **Regression test:** Unit checks for unreadablePages and Inspect in tests/pdf_tools_tests.js and tests/doc_tools_unit_tests.js: damaged pages are found, and sound, blank and permissions-only encrypted files are not flagged. Browser checks: the Split damaged message and the result note, refusal of a file with no readable page, the Merge warning and result note, and the File checker flag.
- **Fix verified by:** an independent verifier re-ran the original reproduction against the fixed build (pdf package)

### PDF-04

**PDF to text corrupts Hindi: drops the ि vowel sign and writes NUL characters into the .txt**

- **Severity:** MEDIUM
- **Verification:** reproduced independently on the live site (confirmed)
- **Where:** https://applyready.in/pdf-to-text.html
- **Description:** For a Chromium-made Hindi PDF, 'प्रति' comes out as 'प्र\u0000त'. The pre-base vowel sign is lost and replaced by a U+0000 control character. The NUL is in the copied and downloaded text, which can break pasting into forms. poppler's pdftotext gets the same file right. This is not covered by the documented limitation, which is about writing ₹ and Indian scripts, not reading them.
- **Reproduction:** Open in/unicode_hindi.pdf (made by Chromium page.pdf with Noto Sans Devanagari) on pdf-to-text.html, Extract, Download. Line 4 of out/txt_hindi.txt is 'वेतन: ₹ 45,000 प्र त माह' with code points ... 092A 094D 0930 0000 0924. pdftotext gives 'प्रति' (U+0924 U+093F). On the live page, pdf.js 6.5.438 getTextContent returns the item '\u0000त' (scripts/pdfjs_raw.js).
- **Expected:** 'प्रति' or close to it, and never control characters in the output text.
- **Actual:** Matra lost and U+0000 written into the text.
- **Root cause:** pdf.js (js/vendor/pdfjs, v6.5.438) maps the reordered matra glyph to U+0000. js/lib/pdf-kit.js joinTextItems() passes item strings through unchanged.
- **Recommended fix:** At minimum, remove U+0000 and other C0 control characters (except \n and \t) in joinTextItems. Consider trying pdf.js's normalisation options (disableNormalization:false, includeMarkedContent), and add a note that text from Indian scripts may need checking. Report the issue upstream to pdf.js.
- **Verification method:** Extract in/unicode_hindi.pdf: the output must contain no U+0000; 'प्रति' should come out correctly, or the page should note that it may not be exact.
- **Resolution in this round:** Fixed. joinTextItems now removes C0 control characters (keeping tab and line breaks) and counts them through an optional info argument, which pageText passes through. PDF to text says how many characters were left out. When the text includes Indian-script characters, it also notes that vowel signs can be missing or out of place. The page's Limits section and FAQ explain this. pdf.js's disableNormalization option does not change the output (tested), so the missing ि itself cannot be restored safely. The output now reads 'प्रत' with no NUL instead of 'प्र\u0000त'. Reporting the bug upstream to pdf.js is left to the maintainer. After an independent check: Reworded the Limits paragraph, the FAQ answer (and its JSON-LD copy, which is generated) and the result line. They now say that vowel signs (ि), nasal marks (ं) and joined letters (क्ष, द्य) can be missing or out of place, and that the reader should check those words and type them again where they are wrong. The claim that the tool 'reads the letters' is gone; the FAQ now opens with 'Only partly'.
- **Regression test:** Unit check: joinTextItems with a '\u0000त' item gives 'वेतन: प्रत माह', contains no control characters, and reports dropped === 1. I also ran a browser diagnostic on unicode_hindi.pdf.
- **Fix verified by:** an independent verifier re-ran the original reproduction against the fixed build (pdf package); the verifier raised a follow-up issue, which was then repaired

### RES-02

**PDF: a referee's contact line can be pushed alone onto the next page, away from the referee's name**

- **Severity:** MEDIUM
- **Verification:** reproduced independently on the live site (confirmed)
- **Where:** https://applyready.in/resume.html (Download PDF)
- **Description:** In the References section only the referee's name line is checked for room before it is drawn. The title/organisation line and the contact line are drawn line by line, so a page break can fall inside one referee. The next page then starts with an email or phone number that has no name above it. A recruiter reading the printed resume cannot tell whose contact it is.
- **Reproduction:** Import inputs/multipage.json, modified to 34 experience entries (inputs/long.json), choose the Compact Professional template and click Download PDF. Page 4 ends with 'A. Example / Head of Operations, my manager 2019–2024, Northwind Traders', and page 5 starts with 'a.example@example.com'.
- **Expected:** Each referee (name, title/organisation, contact) stays together on one page.
- **Actual:** In dl/long_compact-professional.pdf the referee's name and title are at the bottom of page 4 and the contact email is alone at the top of page 5.
- **Root cause:** js/pdf-engine.js renderReferences(): `ensureSpace(isCompact ? 20 : 26); renderEntryHeading(ref.name…); if (ref.details) drawWrapped(…); if (ref.contact) drawWrapped(…)`. It reserves space for the heading only, instead of keepTogether() over the whole block. drawWrapped() breaks per line.
- **Recommended fix:** Measure the referee block (heading plus wrapped details and contact lines) and call keepTogether(blockHeight) before drawing it, as renderEntries() does for experience.
- **Verification method:** Re-export inputs/long.json in Compact Professional and run the page-boundary scan used in this audit (pdftotext -layout, last line of each page against the first line of the next). No page should start with a referee contact line.
- **Resolution in this round:** Fixed. renderReferences() now measures each referee block (name heading plus wrapped details and contact lines) and calls keepTogether on the whole block. The References heading reserves room for the first referee. The DOCX output already used keepNext.
- **Regression test:** New regression check: shifts page-break positions (0 to 30 education entries) for 3 templates in both densities and asserts that name, details and contact are on the same page and the heading is with the first referee. Fails on the old engine, passes now.
- **Fix verified by:** an independent verifier re-ran the original reproduction against the fixed build (resume package)

### SEC-01

**Content Security Policy does not apply to Web Workers; the pdf.js and image workers can send data to any site**

- **Severity:** MEDIUM
- **Verification:** reproduced independently on the live site (confirmed)
- **Where:** https://applyready.in/pdf-to-image.html (any PDF tool), https://applyready.in/batch-image.html (any image tool using workers)
- **Description:** The CSP is delivered only as a <meta http-equiv> tag in each HTML page. A meta CSP governs the document only. Dedicated workers created from a same-origin URL take their policy from the worker script's HTTP response headers, and GitHub Pages sends none. So the pdf.js worker, which parses untrusted PDFs and is the code most exposed to a parser bug, and the image worker run with no CSP at all. Network requests to any origin are allowed from them. privacy.html states 'The site cannot contact other websites: its security policy blocks it' and that the CSP 'stops the browser from … sending data to, any other site'; that holds for pages but not for workers. No first-party code abuses this (no fetch/XHR/sendBeacon in js/ outside the service worker), so this is a defence-in-depth gap and a claim mismatch, not active leakage.
- **Reproduction:** 1. Open https://applyready.in/pdf-to-image.html and choose any PDF (inputs/a.pdf), so pdf.worker.min.mjs starts. 2. In the page context run fetch('https://example.com/?probe=1',{mode:'no-cors'}): it fails (blocked by connect-src 'self'). 3. In the worker context (DevTools, or Playwright page.workers()[0].evaluate) run the same fetch: it succeeds with an opaque response. 4. Repeat on batch-image.html after Start for js/workers/image-worker.js: it also succeeds. Script: scripts/workercsp.js. Net-log out/netlog-workercsp.json shows 2 GETs to example.com with initiator https://applyready.in.
- **Expected:** Workers are bound by the same connect-src 'self' policy as pages, as the privacy policy says.
- **Actual:** Workers have no CSP. fetch to https://example.com from both workers was sent (type=opaque), while the same call from the page was blocked.
- **Root cause:** CSP only in <meta> (all 70 HTML files, shell:csp block). Workers are created from URLs: js/lib/pdf-kit.js:135 (GlobalWorkerOptions.workerSrc = 'js/vendor/pdfjs/pdf.worker.min.mjs') and js/lib/image-pool.js:43 (new Worker(BASE + 'workers/image-worker.js')). GitHub Pages cannot add a Content-Security-Policy response header.
- **Recommended fix:** Start workers from blob: bootstrap URLs, which inherit the creating document's policy container and so its CSP (worker-src already allows blob:). For example, new Worker(URL.createObjectURL(new Blob([`importScripts('${absUrl}')`], {type:'text/javascript'}))) for the image worker. For pdf.js, a module worker from a blob containing `import '${absUrl}';`, passed via GlobalWorkerOptions.workerPort. Alternatively serve the site from a host that can send a CSP header (e.g. a _headers file on Cloudflare Pages or Netlify). Until then, narrow the privacy.html wording.
- **Verification method:** Re-run scripts/workercsp.js: the fetch from each worker must fail with a CSP violation, and the net-log must show 0 requests to example.com. Check that PDF rendering and the batch image tool still work.
- **Resolution in this round:** Fixed. Both workers now start from one-line blob: scripts, so they inherit the page's CSP. pdf.js gets GlobalWorkerOptions.workerSrc set to a blob module that imports the real worker file. The image pool uses a blob classic script that runs importScripts on image-ops.js and image-worker.js; image-worker.js (image package) now skips its own relative importScripts when ApplyReadyImageOps is already loaded. With the CSP inherited, WebAssembly compilation in the pdf.js worker would be blocked, so I added 'wasm-unsafe-eval' to script-src to keep the JPEG 2000, JBIG2 and colour-profile decoders. JavaScript eval stays blocked. The content test's CSP check now requires "script-src 'self' 'wasm-unsafe-eval'" and forbids 'unsafe-eval' and 'unsafe-inline' in script-src. This is narrower than the old substring check, not weaker. All pages were regenerated. Checked offline: with the service worker in control, the blob workers still load and Merge thumbnails and the batch tool work.
- **Regression test:** tests/pdf_tools_tests.js section 11. In both the pdf.js worker (pdf-to-image) and the image worker (batch-image), a fetch to another origin is refused, a securitypolicyviolation for connect-src fires inside the worker, and the worker URL is blob:. The pdf.js worker can still compile WebAssembly, and the JPEG 2000 test reports that openjpeg.wasm was used.
- **Fix verified by:** an independent verifier re-ran the original reproduction against the fixed build (pdf package)

### SEC-02

**Image to PDF, passport print sheet, signature cleaner and Compress PDF (image input) fully decode huge images; memory spikes by up to 2 GB**

- **Severity:** MEDIUM
- **Verification:** reproduced independently on the live site (confirmed)
- **Where:** https://applyready.in/image-to-pdf.html, /passport-photo-print.html, /signature-cleaner.html, /compress-pdf.html
- **Description:** A 380 KB greyscale PNG declaring 20000x20000 px (400 MP) is refused with a clear message by the resizer, batch tool, workspace, merge and file checker. Four tools accept it and decode it at full size, which goes past the documented '50 MB and 50 MP per image' cap. On this desktop the tab survived. Phones with 3 to 4 GB of RAM (the site's target users) are likely to kill the tab, losing whatever else is in it. 200-megapixel camera photos already exist, so this is not purely hostile input.
- **Reproduction:** Run scripts/bombs-b.js with CASES2=1 using inputs/bomb-full.png (made by scripts/mkinputs.py). For example: open https://applyready.in/image-to-pdf.html, choose bomb-full.png, click Create PDF (#btnConvertToPdf), and watch browser memory. Do the same on passport-photo-print.html (just choose the file), signature-cleaner.html, and compress-pdf.html (choose the PNG, click Start).
- **Expected:** Every image tool rejects images above 50 MP before decoding, with the same message the batch and workspace tools use ('…more than the 50 MP this tool can handle safely').
- **Actual:** Image to PDF built a 93 KB PDF from the 400 MP image, with peak browser RSS 2,927 MB against a 795 MB baseline (control photo: 832 MB). Passport print sheet: 2,779 MB. Compress PDF: 1,349 MB. Signature cleaner: 1,098 MB. Page ping rose to 135 to 193 ms. No error shown in any of them.
- **Root cause:** js/image-to-pdf.js handleFiles (lines 166-212) accepts files by f.type and decodes via FileReader.readAsDataURL plus new Image() with no pixel or size check. passport-photo-print.js, signature-cleaner.js and the image path of compress-pdf.js likewise skip the header check that other tools get from js/lib/file-kit.js:126 / js/lib/image-ops.js:37 (MAX_PIXELS = 50e6). js/resizer.js:1256 uses its own 64 MP limit.
- **Recommended fix:** Route every image input through ApplyReadyFiles.validate plus the header-based megapixel check in file-kit.js (Ops.MAX_PIXELS) before any decode. Use one limit everywhere (50 MP as documented, including the resizer's 64 MP check).
- **Verification method:** Re-run CASES2=1 node scripts/bombs-b.js: each tool must show the 50 MP message within a few seconds, and maxRSS must stay within about 100 MB of baseline.
- **Resolution in this round:** Fixed. Every image input now goes through openImage, which checks the header against 50 MP before decoding. js/lib/image-ops.js is now loaded on all these pages. The resizer's 64 MP limit is now the same 50 MP. Image to PDF keeps files plus object URLs instead of data URLs, and decodes each image only while its page is drawn, which also lowers its memory use for long lists. I did not repeat the auditor's RSS measurement. The 400 MP PNG is refused from its header in about 40 ms, before anything is decoded.
- **Regression test:** Section 12 refuses a PNG header declaring 20000x20000 in the resizer, and sections 17 to 20 do the same in the cleaner, print sheet, Image to PDF and Compress PDF, with the message '... is 400 megapixels (20000 x 20000 px), more than the 50 MP...'.
- **Fix verified by:** an independent verifier re-ran the original reproduction against the fixed build (image package)

### SEO-01

**Offline page and site copy promise that every tool and guide works offline after the first visit; it does not**

- **Severity:** MEDIUM
- **Verification:** reproduced independently on the live site (confirmed)
- **Where:** https://applyready.in/offline.html (served for any uncached page while offline); also how-to-use.html, philosophy.html, changelog.html, about.html
- **Description:** offline.html tells the visitor: 'ApplyReady runs in your browser, and after your first visit it keeps every tool and guide on this device, so the pages below should still open.' It then offers four buttons: Browse all tools, Open the image resizer, Open the resume builder and Browse the guides. Since the service-worker redesign, the site caches only the pages a visitor has opened, or the whole site if they choose 'Save every tool for offline use' on Your data. So a first-time visitor who went offline after the home page finds that all four suggested pages fail, and each one shows the same offline page again: a dead end. how-to-use.html ('the tools also work on a slow connection and, after your first visit, offline'), philosophy.html ('They work offline once a page has loaded') and changelog.html ('work offline after a first visit') make the same broad promise. A cyber-cafe or phone user who reads this and relies on it is stranded.
- **Reproduction:** 1) In Chromium with a clean profile, open https://applyready.in/ and wait until the service worker controls the page (reload once). 2) Go offline (DevTools or context.setOffline(true)). 3) Open https://applyready.in/merge-pdf.html: the 'You are offline' page appears and says every tool and guide is kept. 4) Click each of its four buttons: every one loads 'You Are Offline | ApplyReady' again. Script: scratchpad/audit/seo-docs/scripts/offline2.js. It was run twice with the same result.
- **Expected:** The offline page and the docs should describe the real behaviour: only pages opened before, unless the visitor saved every tool on Your data. The offline page should only suggest pages that are actually cached, or point to Your data's 'Save every tool for offline use'.
- **Actual:** Cache 'applyready-files' contains only ['/offline.html', '/'] after the home-page visit. /tools.html, /image-resizer.html, /resume.html and /guides/ all fail offline while the page claims they 'should still open'. A tool that was visited (passport-photo-resizer.html) does reload and process a photo offline.
- **Root cause:** The copy was written for the old service worker, which precached the whole site on install. sw.js now caches only /offline.html on install and fetched pages afterwards; the full STATIC_ASSETS download is opt-in (docs/ARCHITECTURE.md section 5, README 'Privacy model'). The text in offline.html line 140 and the phrases in how-to-use.html:168, philosophy.html:176, changelog.html:178 and about.html:193 were not updated. The offline page's links are static (offline.html lines 143-146) and are not filtered by what is in the cache.
- **Recommended fix:** Reword offline.html, for example: 'This page has not been opened on this device yet. Pages you opened before still work offline; to keep every tool, use Save every tool for offline use on Your data while online.' Have the page (or sw.js) list only links that are present in caches.match(), or hide links that are not. Change the how-to-use, philosophy, changelog and about wording to 'pages you have opened work offline; Your data can save every tool'. Add a test that offline.html does not claim a full precache.
- **Verification method:** Repeat the reproduction: after visiting only the home page and going offline, the offline page must not promise pages that are not cached, and every link it shows must open offline. Grep the HTML for 'after your first visit' and 'once a page has loaded' and confirm the wording matches the opt-in design.
- **Resolution in this round:** Fixed. Same root cause and fix as LIVE-01. The offline page and the wording on how-to-use, changelog, about and philosophy now say: pages you have opened work offline, and Your data can save every tool. The offline page's links are filtered by what is in the cache. After an independent check: philosophy.html now reads: 'A page you have opened keeps working offline; the PDF tools need their PDF library too, which is kept once you have used one of them online, or when you choose Save every tool on Your data.'
- **Regression test:** Same as LIVE-01, plus a content_tests.js scan of every page for phrases like 'after your first visit, offline'.
- **Fix verified by:** an independent verifier re-ran the original reproduction against the fixed build (site package); the verifier raised a follow-up issue, which was then repaired

### BAT-02

**'Download all as ZIP' mixes in results made with old settings without warning**

- **Severity:** LOW (auditor rated MEDIUM)
- **Verification:** reproduced independently on the live site (confirmed-different-severity)
- **Where:** https://applyready.in/batch-image.html
- **Description:** After the settings change, earlier results are marked 'Done, old settings' and a notice offers 'Process again'. If the user instead adds or processes more files and clicks the ZIP button (labelled 'Download all 5 as ZIP'), the ZIP holds both the old-settings files and the new ones, with nothing said at download time. A cyber-cafe operator who lowered the KB limit or changed format can end up uploading files that no longer match the portal's rule.
- **Reproduction:** 1. Add photo1.jpg, a/photo.jpg and pic.webp; process with the defaults (JPEG). 2. Set 'Save as' to PNG (rows now show 'Done, old settings'). 3. Add b/photo.jpg and bitmap.bmp and click 'Process 2 images'. 4. Click 'Download all 5 as ZIP'.
- **Expected:** The ZIP contains only results that match the current settings, or the button and a confirmation say that N files use the old settings (offering 'Process again first').
- **Actual:** The ZIP contains photo1.jpg, photo.jpg and pic.jpg (JPEG, old settings) together with photo.png and bitmap.png (PNG, new settings).
- **Root cause:** js/batch-image.js downloadAll(): const done = queue.items.filter(i => i.status === 'done' && i.result). It never compares i.result.key with currentKey, and render() labels the ZIP button with done.length without mentioning old-settings results.
- **Recommended fix:** When some done items have result.key !== currentKey, label the button with that fact (for example 'Download 5 as ZIP (3 with old settings)'), or ask for confirmation. Or offer two actions: 'Process again first' and 'Download anyway'.
- **Verification method:** Repeat the reproduction: the ZIP button or a confirmation must flag the 3 old-settings files before the download, or the ZIP must contain only current-setting files.
- **Resolution in this round:** Fixed. The ZIP button now counts results made with the old settings: 'Download all 5 as ZIP (4 with old settings)', or '(old settings)' when all of them are old. downloadAll() also asks for confirmation first ('4 of the 5 images were made before you changed the settings...'), with Download anyway or Go back. The same applies when only one image is done.
- **Regression test:** Block 3d2 checks the label, that the dialog wording is right, that Go back downloads nothing, and that Download anyway saves all 5 files.
- **Fix verified by:** an independent verifier re-ran the original reproduction against the fixed build (batch-cafe package)

### BAT-03

**Output names change after a removal or Process again, so single and ZIP names no longer match**

- **Severity:** LOW
- **Verification:** reproduced independently on the live site (confirmed)
- **Where:** https://applyready.in/batch-image.html
- **Description:** Names are recalculated from the current list order every time. A file already downloaded on its own as 'photo (3).jpg' shows up in the later ZIP as 'photo (2).jpg' after an earlier row is removed. Likewise b/photo.jpg was 'photo.png' in one ZIP and 'photo (2).png' after Process again. The FAQ says 'The names are the same in single downloads and in the ZIP file', which only holds at a single moment.
- **Reproduction:** Add a/photo.jpg, b/photo.jpg and c/photo.jpg; process. Download row 3 on its own (saved as 'photo (3).jpg', 147,934 bytes). Remove row 1. Download the ZIP.
- **Expected:** A result keeps the name it was shown or downloaded under; or the FAQ explains that names follow the current list.
- **Actual:** The ZIP has 'photo (2).jpg' with 147,934 bytes (the same file that was saved as 'photo (3).jpg') and 'photo.jpg'.
- **Root cause:** js/batch-image.js outputNames() assigns names on every call by walking queue.items in order over done items only, so removals, retries and re-processing reshuffle the (n) suffixes.
- **Recommended fix:** Fix each item's output name when its result is first produced (store it in item.result), and only add a new suffix when a clash would occur. Or reword the FAQ.
- **Verification method:** Repeat the reproduction: the ZIP entry with 147,934 bytes should still be named 'photo (3).jpg'.
- **Resolution in this round:** Fixed. outputNames() now settles a name once it has been shown with the run finished, or once the file is downloaded. Settled names are stored in item.meta.pinned and reserved first. Other rows are named in list order around them. A settled name stays as long as the naming settings and the output format stay the same, so removing a row, retrying or using Process again no longer renumbers the others. In sequence naming, a clash moves to the next free number. The FAQ line 'the names are the same in single downloads and in the ZIP file' is now true.
- **Regression test:** Block 3d2: three files named photo.jpg are processed and row 3 is saved as 'photo (3).jpg'. Row 1 is then removed. The ZIP still names that file 'photo (3).jpg' and its bytes match the single download. Names are also unchanged after Process again.
- **Fix verified by:** an independent verifier re-ran the original reproduction against the fixed build (batch-cafe package)

### BAT-04

**Oversize message says a 50.47 MB file 'is 50 MB' with a limit of 50 MB**

- **Severity:** LOW
- **Verification:** reproduced independently on the live site (confirmed)
- **Where:** https://applyready.in/batch-image.html
- **Description:** A file slightly over the 50 MB limit is refused with a message that rounds its size down to the limit itself, so the reason makes no sense to the user.
- **Reproduction:** Add a 52,920,054-byte BMP (4200x4200) to batch-image.html.
- **Expected:** For example 'big51mb.bmp is 50.5 MB. The limit for this tool is 50 MB…'
- **Actual:** 'big51mb.bmp is 50 MB. The limit for this tool is 50 MB, to keep your browser responsive.'
- **Root cause:** js/lib/files.js formatBytes() uses toFixed(0) for sizes of 10 MB and up, and validate() builds the message from formatBytes(file.size).
- **Recommended fix:** In the limit message, show one decimal (or never round down to the limit), e.g. formatBytes with one decimal when the size is within 10% of the limit.
- **Verification method:** Add the same 52,920,054-byte file: the message must show a size above 50 MB.
- **Resolution in this round:** Fixed. New formatOver(n, limit) adds decimals until the size reads as more than the limit, or says 'just over 50 MB'. validate() uses it, so the limit message is fixed for every tool that uses this check.
- **Regression test:** Unit checks in tests/workspace_unit_tests.js (50.5 MB, 50.005 MB, 'just over'). Browser check in block 3d2: a 52,920,054-byte file reads 'is 50.5 MB. The limit for this tool is 50 MB'.
- **Fix verified by:** an independent verifier re-ran the original reproduction against the fixed build (batch-cafe package)

### BAT-05

**Image compressor can produce larger files and still put them in the ZIP**

- **Severity:** LOW
- **Verification:** reproduced independently on the live site (confirmed)
- **Where:** https://applyready.in/compress-image.html
- **Description:** With the compressor's defaults (keep format, under 100 KB), images already under the limit are re-encoded, sometimes larger than the original. They are listed as 'Done' and included in 'Download all as ZIP'. Each row has an honest note ('The original … is smaller than this copy. You can upload the original instead'), but the ZIP gives no choice to keep the smaller original.
- **Reproduction:** On compress-image.html with the default settings, add alpha.png (4.7 KB), pic.webp (50 KB), anim.gif (1.3 KB) and photo.avif (77 KB) together with larger photos; compress; download the ZIP.
- **Expected:** A compressor never makes a file bigger: when the result is larger and the original already meets the limit and format, the original is kept (or the user can choose that), at least for the ZIP.
- **Actual:** alpha.png becomes 14,370 B (from 4.7 KB), pic.webp 53,286 B (from 50 KB), anim.gif becomes anim.jpg at 2,123 B (from 1.3 KB), and photo.avif becomes photo.jpg at 101,412 B (from 77 KB). All of them are in compressed-images.zip, and the verdict reads 'compressed'.
- **Root cause:** js/batch-image.js runJob() only adds a note when result.bytes >= item.size (and only for resize none plus keep format); the larger result is still stored as item.result and used by downloadAll().
- **Recommended fix:** In compress mode, when the original is a JPEG/PNG/WebP that already meets the limit and the result is not smaller, keep the original bytes as the result (and say so in the row). Or offer a 'use originals when smaller' switch that the ZIP respects.
- **Verification method:** Run the same 4 files on compress-image.html: no ZIP entry may be larger than its source when the source already met the limit.
- **Resolution in this round:** Fixed. When the new copy is no smaller, keepOriginal() checks whether the original can be used instead. It must have the same format, resize must be off, the pixel size must match and it must be within the min/max KB. New Files.plainStill() checks that the file has no EXIF, XMP, IPTC, comments or animation (JPEG, PNG and WebP are parsed). If all of that holds, the original bytes become the result, and the row and verdict say so. If only hidden details stand in the way, the clean copy is kept (a new copy is promised to drop GPS) and the row explains that the original is smaller but carries camera or location details. I did not use the plain 'always keep the original' approach because it would put GPS data back into files. I updated one 'Good to know' line on compress-image.html and one paragraph of the compress guide; both files belong to other packages. After an independent check: Root cause: plainStill() returned only true or false, so the row note could not know why an original was held back and always said 'camera or location data'. There is now a new Files.hiddenParts(bytes). It returns a sorted list of what a JPEG, PNG or WebP holds besides one still picture: animation, camera (EXIF), description (XMP or IPTC), text (PNG text chunks and JPEG comments), date (PNG tIME) and other. It returns null when the file is not recognised or cannot be read to the end. plainStill() is now built on it. It is also slightly stricter: a JPEG APP2 segment that is not a colour profile (for example MPF, which adds extra pictures) counts as 'other'. In batch-image.js, keepOriginal returns { hidden }, and the new hiddenNote() words the note by cause. For an animation it says: 'it is animated, and this copy is a still picture of its first frame ... only if the place you are sending it to accepts animated pictures.' Hidden details are listed by kind, for example 'text notes or comments, such as the program that made it'. A file that could not be read gets its own wording. The suggested title change is also done: the verdict title, the sticky-bar note and the 'Finished' announcement count kept originals on their own in compress and convert modes, for example '6 images compressed, 5 kept as they were' or '5 images kept as they were'. Batch mode keeps 'N images ready', which is true of kept originals too. The page copy and the compressor guide now mention animation, and the guide says kept originals are counted on their own.
- **Regression test:** Block 3d2 on compress-image.html: a small PNG and JPEG with no metadata are never larger than their source, and the JPEG is in the ZIP byte for byte. A JPEG with EXIF is not kept, its ZIP copy has no EXIF, and the note explains why. The verdict reports the kept count. Unit tests for plainStill use hand-built JPEG, PNG and WebP bytes.
- **Fix verified by:** an independent verifier re-ran the original reproduction against the fixed build (batch-cafe package); the verifier raised a follow-up issue, which was then repaired

### BAT-06

**Retry button says 'failed and cancelled images' when nothing failed**

- **Severity:** LOW
- **Verification:** reproduced independently on the live site (confirmed)
- **Where:** https://applyready.in/batch-image.html
- **Description:** After a plain Cancel (0 failures), the button reads 'Retry 192 failed and cancelled images', which suggests some images failed.
- **Reproduction:** Start a 300-image batch and click Cancel at about 30%.
- **Expected:** 'Retry 192 cancelled images' (and 'failed images' or 'failed and cancelled' only when that is true).
- **Actual:** 'Retry 192 failed and cancelled images', while the verdict says '192 images cancelled' and 0 failed.
- **Root cause:** js/batch-image.js render(): el.retry.innerHTML uses plural(failed, 'failed image', 'failed and cancelled images'), where failed = summary.error + summary.cancelled, so the plural form always says 'failed and cancelled'.
- **Recommended fix:** Build the label from summary.error and summary.cancelled separately.
- **Verification method:** Cancel a run with 0 errors: the label should say only 'cancelled'.
- **Resolution in this round:** Fixed. The Retry label is now built from the error and cancelled counts separately: 'Retry N cancelled images', 'Retry 1 failed image', or 'Retry N failed and cancelled images' only when both happened. The singular case is right too. I updated the tutorial sentence, its tutorial test, the screenshot alt text and the desktop screenshot. After an independent check: Root cause: on a phone the batch layout now puts all the settings between the result panel and the file list, so the shared desktop region (result plus list) was about 2800 CSS px tall and the phone shots could not be retaken. They still showed the old layout and the old Retry label. guide-screenshots.js has a new partsOf(page, groups, pad). It captures several real regions of the page and stacks them in one picture with a clearly marked gap band (grey, dashed line, three dots), so the picture never suggests the parts sit next to each other. Each part holds only the callouts that overlap it. capture() checks that every callout is whole inside a part and that the total height is within maxHeight. A group can set top and bottom space to 0 so a part starts or ends exactly at a list row. Phone runs: tut-batch-cancelled shows the result panel (now 'Retry 2 cancelled images'), the gap, then rows 3 to 6 (two Done, two Cancelled) with callouts 1, 2 and 3. tut-compress-results shows the result panel, the gap, then rows 1 to 3 with callouts 1, 2 and 3. tut-batch-names shows the list only, where both callouts are. Desktop shots and captions are unchanged. All three phone shots were retaken and viewed, and the manifest and <picture> markup were re-synced by the script.
- **Regression test:** tests/batch_image_tests.js 3a now checks the exact label after Cancel and after the retry ('Retry 1 failed image'). tests/tutorial_tests.js checks 'Retry N cancelled images'.
- **Fix verified by:** an independent verifier re-ran the original reproduction against the fixed build (batch-cafe package); the verifier raised a follow-up issue, which was then repaired

### BAT-09

**A ZIP download the browser blocks fails silently and success is still announced**

- **Severity:** LOW
- **Verification:** reproduced independently on the live site (confirmed)
- **Where:** https://applyready.in/batch-image.html
- **Description:** The ZIP is saved by a programmatic a.click() after asynchronous ZIP building. In my run, after 10 single downloads, Chromium's limit on multiple downloads dropped the 11th (the ZIP): no download happened, the button went back to normal, nothing was shown, and the code still announces 'ZIP file with N files downloaded'. Headless Chromium has no prompt to allow more downloads; in normal Chrome the user would see an 'allow multiple downloads' prompt, so impact for real users is unconfirmed.
- **Reproduction:** Process 10 images, download each one with its row button, then click 'Download all 10 as ZIP' (headless Chromium 1243).
- **Expected:** If the download cannot start, some visible feedback; at minimum no screen-reader 'downloaded' announcement unless the download really started.
- **Actual:** Files.download was called (with user activation still active) but no download event fired within 60 s. The button text never changed visibly and no error was shown.
- **Root cause:** js/lib/file-kit.js downloadZip() calls Files().download(zip, name) and then announce(...) unconditionally; the browser can block the download, and the page cannot detect that.
- **Recommended fix:** Word the announcement as 'ZIP ready: N files' and, after the click, keep a visible fallback link ('If the download did not start, tap here') for a few seconds.
- **Verification method:** In desktop Chrome with automatic multiple downloads set to Block, click the ZIP after several single downloads and check for visible feedback.
- **Resolution in this round:** Partly fixed. Kit.downloadZip no longer announces 'ZIP file with N files downloaded'. It shows a visible message, which screen readers also hear: 'ZIP file with N files ready: name.zip. If no download starts, allow downloads for this site in your browser and try again.' The applicant workspace ZIP message has the same wording, without the ZIP name because that name contains the applicant's name. A page cannot detect a download the browser blocked, so only the false claim and the missing hint were fixable.
- **Regression test:** Block 3d2 checks that the visible notification says 'ready: applyready-images.zip' and does not say 'downloaded'.
- **Fix verified by:** an independent verifier re-ran the original reproduction against the fixed build (batch-cafe package)

### CAF-01

**Finished applicant's file name stays in the page's hidden message region after Finish and End session**

- **Severity:** LOW (auditor rated MEDIUM)
- **Verification:** reproduced independently on the live site (confirmed-different-severity)
- **Where:** https://applyready.in/workspace.html
- **Description:** When a task fails, its message (which includes the file name) is announced through a hidden aria-live region. That region is never cleared, so the message stays in the page's DOM after the applicant is finished and after End session, until another announcement replaces it. File names often contain the customer's name (e.g. ravi_aadhaar.pdf). This goes against the page's promise that finishing 'removes every reference to them from the page', and against the code comment that 'nothing of a finished applicant lingers in the page's live regions'.
- **Reproduction:** 1. Open https://applyready.in/workspace.html and click Add first applicant. 2. Add kappa_heaplook_locked.pdf (a password-protected PDF). 3. Click 'Compress PDF to 500 KB' and press Cancel in the password dialog. 4. Click Finish applicant and confirm (or End session and confirm). 5. Wait 8 s and inspect document.querySelectorAll('[aria-live]').
- **Expected:** After Finish or End session, no live region or other DOM node contains the applicant's file names.
- **Actual:** div.sr-only[aria-live=polite] still reads 'Compress PDF to 500 KB did not work: kappa_heaplook_locked.pdf was not opened because no password was given.' 8 s after Finish and after End session. document.documentElement.outerHTML.includes('heaplook') is true (out/t10/report.json). A screen-reader user at the next session can read it, and so can anyone who opens DevTools.
- **Root cause:** js/workspace.js:643 failJob() calls announce(text), where text comes from failReason(e) and so carries the engine's message, which includes f.name (e.g. js/lib/pdf-ui.js:159 `${name} was not opened because no password was given.`). js/lib/file-kit.js:201-210 announce() writes into a single persistent sr-only div appended to body and never clears it. The Finish and End session handlers (js/workspace.js ~1030-1075) only call notify() (the toast) and never reset Kit's live node.
- **Recommended fix:** In the Finish and End session handlers (and endSession on pagehide), clear Kit's live region, for example with an announce('') variant that empties it, or announce a generic 'Applicant finished.' through Kit.announce so it replaces the old text. Better still, keep file names out of announced failure messages (say 'Compress PDF did not work: the password was not given') and leave names to the visible row, which is cleared.
- **Verification method:** Run scripts/t10_live.js: after Finish and after End session, no [aria-live] text and no outerHTML may contain 'heaplook'.
- **Resolution in this round:** Fixed. failJob() now announces the message with every file and result name of the applicant replaced by 'the file'. The visible row keeps the full text. Finish and End session (including on pagehide) call Kit.announce(''), which now empties the live region and cancels any message still waiting to be written.
- **Regression test:** New block in tests/workspace_tests.js: a locked PDF with the password dialog cancelled. The row shows the file name and the announcement does not. After Finish, no aria-live node and no page markup contains the file or applicant name. Fails on 92f7ef0.
- **Fix verified by:** an independent verifier re-ran the original reproduction against the fixed build (batch-cafe package)

### CAF-02

**Single-file downloads have nothing to say whose they are; two applicants' files download under the same name**

- **Severity:** LOW (auditor rated MEDIUM)
- **Verification:** reproduced independently on the live site (confirmed-different-severity)
- **Where:** https://applyready.in/workspace.html
- **Description:** Only the ZIP name carries the applicant's name. Single results are named only from the source file name (photo-photo.jpg, aadhaar-500kb.pdf). Customers often bring files with the same generic names (photo.jpg, sign.jpg, aadhaar.pdf), so files from different people land in the Downloads folder as 'photo-photo.jpg' and 'photo-photo (1).jpg'. The operator then picks a file from Downloads to upload to the portal. The page itself names this mix-up as 'the biggest risk', and single-file download is the main path for portal uploads.
- **Reproduction:** 1. Add applicant '<>"' (shown as Applicant 1) with photo_A.jpg and locked_B.pdf; run Passport photo and Compress PDF; click each Download. 2. New applicant 'CON' with the same photo_A.jpg and locked_B.pdf; run the same actions; click each Download. 3. Compare download.suggestedFilename().
- **Expected:** Downloads from different applicants have different names, for example a {applicant} or {n} prefix as the ZIP pattern already offers, so a file in Downloads can be traced to one person.
- **Actual:** Applicant 1 got ['photo_A-photo.jpg','sig_A-signature.png','locked_B-500kb.pdf']. Applicant 2 got ['photo_A-photo.jpg','locked_B-500kb.pdf'], the same names (out/t8/report.json dl1/dl2). Files inside the ZIPs are also named without the applicant.
- **Root cause:** js/workspace.js:667 imageName() and the PDF result names in runPdfCompress/runCombine build names only from stemOf(f.name). js/workspace.js resultRow() sets dl.download = Files.safeFileName(r.name). Model.zipName's applicant label is used only for the ZIP.
- **Recommended fix:** Add an optional session setting (default on) that prefixes single downloads and ZIP entries with the applicant label or number, using the same safe label as zipName (e.g. 'Ravi-S-O-Ramesh_photo_A-photo.jpg'). At least use the applicant label as the download name prefix when the name is set.
- **Verification method:** Repeat the steps: suggestedFilename for the two applicants must differ and contain each applicant's label or number.
- **Resolution in this round:** Fixed. Single downloads are now named '<label>_<result name>', using the same label as the ZIP ('Asha-S-O-Test_photo-photo.jpg', or 'Applicant-2_...' when no name is set). The link's download attribute, title and aria-label follow the name while it is typed. The visible row name and the names inside the ZIP are unchanged, since the ZIP itself is already named after the applicant. I did not add a separate on/off setting. The page text now explains the naming.
- **Regression test:** New workspace block: an unnamed applicant gets 'Applicant-1_ishaan-photo-photo.jpg'. Typing 'Asha S/O Test' updates the link at once and the download uses it. The next applicant's file is 'Applicant-2_...'.
- **Fix verified by:** an independent verifier re-ran the original reproduction against the fixed build (batch-cafe package)

### CAF-03

**A cancelled or failed download counts as 'Downloaded'; Finish then deletes the results without asking**

- **Severity:** LOW
- **Verification:** reproduced independently on the live site (confirmed)
- **Where:** https://applyready.in/workspace.html
- **Description:** The download-before-delete safeguard depends on a per-result 'downloaded' flag. That flag is set as soon as the Download link (or the ZIP) is clicked, whether or not the browser saved the file. With Chrome's 'Ask where to save each file' (common on shared PCs), pressing Cancel in the save dialog, or a blocked or failed download, still marks the result Downloaded. Finish applicant then wipes everything with one click and no confirmation. The source files usually stay with the customer, so the work can be redone, but only if the customer has not left yet.
- **Reproduction:** 1. Add an applicant with photo_A.jpg and run Passport photo. 2. Click Download and cancel the download (Playwright download.cancel(); failure()='canceled'). 3. Look at the result row and the tally. 4. Click Finish applicant.
- **Expected:** Either the result stays 'Not downloaded' when the save did not complete, or Finish always asks for confirmation while results exist (e.g. 'Did you save or upload everything?').
- **Actual:** Row shows 'Downloaded' and the tally reads '1 of 1 result downloaded'. Finish removed the applicant at once with no dialog (confirmShown=0, applicants=[]) (out/t12/report.json).
- **Root cause:** js/workspace.js:949 marks the result downloaded on the link click (setTimeout(() => a.markDownloaded([r.id]),0)), and js/workspace.js:897 marks ZIP entries downloaded right after saveURL(). The Finish handler (js/workspace.js:1033) asks only when c.waiting, c.running, or files without results. A page cannot see whether a download was saved.
- **Recommended fix:** Keep the Finish confirmation whenever the applicant has results (a light, non-danger confirm when all are marked downloaded). Or label the state 'Download started' and add an 'Undo finish' grace period of a few seconds before wiping.
- **Verification method:** Run scripts/t12_cancelled_dl.js: after the cancelled download, Finish must show a confirmation (or the row must not read 'Downloaded').
- **Resolution in this round:** Fixed. Finish now asks every time the applicant has results, even when all are marked downloaded. This is a light, non-danger confirmation with Finish focused, so Enter confirms: 'The result was downloaded. Check that it is in the Downloads folder or already uploaded...'. The page cannot see whether the browser saved a file. The existing danger confirmations are unchanged. The page text explains this.
- **Regression test:** New workspace block: after a download, Finish shows the light dialog with OK focused. Escape keeps the applicant and Enter finishes.
- **Fix verified by:** an independent verifier re-ran the original reproduction against the fixed build (batch-cafe package)

### CAF-04

**Adding more than 50 files shows two messages that contradict each other**

- **Severity:** LOW
- **Verification:** reproduced independently on the live site (confirmed)
- **Where:** https://applyready.in/workspace.html
- **Description:** When files added at once go over the 50-file limit for an applicant who already has files, the error box shows both 'Only the first 50 files were added' and 'Only 49 more files could be added'. Only 49 were added.
- **Reproduction:** 1. Add an applicant with 1 file (photo_C.jpg). 2. Choose 52 files at once (sig_C.png x52) with Choose files. 3. Read the error box and the file count.
- **Expected:** One accurate message: '49 files were added; an applicant can have up to 50 files. 3 were left out.'
- **Actual:** #wkFileCount = 50. #wkErrorList shows 'Only the first 50 files were added. Process these, then add the rest.' and 'Only 49 more files could be added: an applicant can have up to 50 files. The rest were left out.' (out/t8/report.json capErr).
- **Root cause:** js/workspace.js:616 passes maxFiles: Model.MAX_FILES to Kit.dropzone. js/lib/file-kit.js:62-64 cuts each pick to 50 and reports 'Only the first 50 files were added' without knowing the applicant's current count. js/workspace.js addFiles() then applies the real room and adds its own message.
- **Recommended fix:** Pass maxFiles: Infinity (or a function of the active applicant's room) to the drop zone and let addFiles() write the single message. Or drop the drop zone's message when the context will apply its own limit.
- **Verification method:** Repeat with 1 existing file + 52 picked: exactly one message, which states that 49 were added.
- **Resolution in this round:** Fixed. Kit.dropzone's maxFiles can now be a function of the context (the room left), with an optional tooMany(room, offered) message. The workspace passes the active applicant's room, so only one accurate message appears: 'Only 49 more files could be added: an applicant can have up to 50 files. The other 3 were left out.' The batch tool had the same contradiction against its 500-image limit and is fixed the same way. Its error title now reads 'Not every file was added:' rather than counting messages as files.
- **Regression test:** New workspace block: an applicant with 1 file is offered 52 more. They end with 50 files and exactly one message with the right counts. Fails on 92f7ef0 (two messages).
- **Fix verified by:** an independent verifier re-ran the original reproduction against the fixed build (batch-cafe package)

### IMG-05

**Very small images: 1x1 crashes with a raw browser error; others are enlarged and padded without warning**

- **Severity:** LOW
- **Verification:** reproduced independently on the live site (confirmed)
- **Where:** https://applyready.in/passport-photo-resizer.html (all resizer pages)
- **Description:** A 1x1 PNG or JPEG is accepted, but Resize shows the raw message 'Failed to execute 'drawImage' on 'CanvasRenderingContext2D': The image argument is a canvas element with a width or height of 0.' Images of 2–50 px are silently enlarged to 350x450. The 2x2 result has large white bands top and bottom because the crop cannot match the target shape. An enlarged tiny image will be rejected by any reviewer.
- **Reproduction:** 1) Open passport-photo-resizer.html, choose in/tiny_1x1.png and press Resize: the raw drawImage error appears. 2) Choose in/small_2x2.png: the output is 350x450 'verified' with white bands. 3) small_20x20.png: thin white side bars, no warning about enlargement.
- **Expected:** A clear message such as 'This image is only 1 × 1 px, too small to make a 350 × 450 photo', and a warning when the source is much smaller than the target.
- **Actual:** A technical error for 1x1; silent heavy upscaling and letterboxing for others.
- **Root cause:** js/resizer.js generateTargetCanvas: cropper.getCroppedCanvas returns a 0-height canvas for a 1x1 source with a non-square crop ratio, and the error message is passed straight to showProcessError. There is no minimum source size check and no upscaling warning.
- **Recommended fix:** In handleFileSelect, refuse images under about 20 px per side with a plain message. Guard the croppedCanvas width/height for 0. Show a warning when the crop region is smaller than the target (enlargement).
- **Verification method:** Load tiny_1x1.png: a friendly message appears and no raw drawImage text. Load small_20x20.png: an enlargement warning is shown.
- **Resolution in this round:** Fixed. Images under 20 px on a side are refused with a plain message (openImage minSide 20), and an empty cropped canvas gets a friendly error instead of the raw drawImage text. When the selection is enlarged 1.5 times or more, the result shows a warning (new #resultWarning notice, ws-result is-warning) giving the selection size and the enlargement factor. A crop whose shape is within 3% of the output now fills it, trimming a sliver, instead of leaving thin white bars. Crop shapes chosen on purpose are still fitted inside. After an independent check: Root cause: Cropper 1.6.1's getCroppedCanvas floors the fractional source rectangle (and the destination rectangle) to whole pixels, so the bars were baked into the canvas it returned, where drawCropped's 3% shape check could not see them. getCroppedCanvas is no longer used. drawCropped(ctx, boxW, boxH, picture) now draws straight from an ImageBitmap copy of cropper.image. It uses cropper.getData() unrounded, plus the rotation and flips (rotate/scaleX/scaleY about the turned picture's centre), and clips to the integer box. The 3% fill and fit-inside rules now run on the exact selection. The bitmap is closed as soon as the output is drawn. I tested the ImageBitmap source against drawing from the <img>: from the <img>, shrunk outputs came out slightly softer and the PNG size changed. The bitmap gives the same quality as Cropper's own canvas path, and a 1:1 copy is now pixel-exact (before, a 1:1 copy with a fractional crop came out shifted and resampled). A selection under 1 px still gives the old 'too small' message.
- **Regression test:** Section 12: a 1x1 PNG gets a 'too small' message with no drawImage text. A 24x24 PNG gives 350x450 with the enlargement warning and no white edge pixels. A 640x480 photo shows no warning.
- **Fix verified by:** an independent verifier re-ran the original reproduction against the fixed build (image package); the verifier raised a follow-up issue, which was then repaired

### IMG-06

**Sizes entered in cm/inches at a DPI produce files with no DPI recorded**

- **Severity:** LOW
- **Verification:** reproduced independently on the live site (confirmed)
- **Where:** https://applyready.in/image-resizer.html
- **Description:** When the unit is cm or inches with a DPI (e.g. 3.5 x 4.5 cm at 300 DPI), the pixel size is right (413x531), but the JPEG says units=0, density 1:1. Printing or opening it in Word or a photo viewer then shows the wrong physical size (typically 96 or 72 DPI, so about 11 x 14 cm). The passport print tool already writes 300 DPI into its JFIF header, so the helper exists.
- **Reproduction:** Custom size, Unit = Centimetres, DPI = 300, Width 3.5, Height 4.5, Max 100 KB, Resize, Download. Run `identify -format '%x %y %U'` or PIL info on the file: jfif_unit 0, jfif_density (1,1).
- **Expected:** JFIF density set to the chosen DPI (units = dots per inch), so the file prints at 3.5 x 4.5 cm.
- **Actual:** No DPI in the file.
- **Root cause:** js/resizer.js processImage encodes with canvas.toBlob and never patches the JFIF APP0 density. passport-photo-print.js has withJfifDensity() for this purpose.
- **Recommended fix:** When unit is cm or inch (or always for JPEG), patch APP0 bytes 13–17 with the chosen DPI, as in withJfifDensity; for PNG, add a pHYs chunk.
- **Verification method:** Repeat the cm case: identify should report 300x300 PixelsPerInch.
- **Resolution in this round:** Fixed. New ApplyReadyImageOps.setDensity(blob, dpi). For JPEG it sets the JFIF density. For PNG it writes a pHYs chunk after IHDR with a proper CRC, replacing any existing one. Other types come back unchanged. The resizer records the chosen DPI when the size is given in cm or inches, and the result names the size, for example '413 x 531 px (3.5 x 4.5 cm at 300 DPI)'. The print sheet now uses this shared helper instead of its own copy. After an independent check: processImage now works out up front whether the DPI will be recorded. For PNG it passes a 21-byte reserve (the pHYs chunk) to compressStrictly, which searches against maxKB*1024 - reserve. A PNG that cannot fit gets the usual 'PNG needs N KB' message, rounded up to 0.1 KB with the reserve included, instead of the final check's raw 'Output file size … exceeds limit'. JPEG and WebP reserve nothing, because setDensity does not grow them. The misleading comment is corrected, and the steps are renumbered 1-4.
- **Regression test:** Section 14: 3.5x4.5 cm at 300 DPI gives JFIF unit 1 and 300/300 DPI, a PNG gets pHYs at offset 37 with 11811 px/m, and px mode records no DPI. Section 21 runs node-side checks with zlib.crc32: chunk order, valid CRCs, replacement of an existing pHYs, and other types returned unchanged. The print sheet still records 300 DPI (section 18).
- **Fix verified by:** an independent verifier re-ran the original reproduction against the fixed build (image package); the verifier raised a follow-up issue, which was then repaired

### IMG-07

**resize-image-to-kb-limit.html ignores targetKB/width/height URL parameters**

- **Severity:** LOW
- **Verification:** reproduced independently on the live site (confirmed)
- **Where:** https://applyready.in/resize-image-to-kb-limit.html?targetKB=15&width=300&height=400
- **Description:** resizer.js reads targetKB, maxKB, width and height from the URL, but on pages whose markup sets data-preset="custom" those values are never applied. The page opens with 350x350 and a 50 KB limit. Anyone using a bookmarked or shared link gets the wrong limit. No internal link uses these parameters, so the impact is limited.
- **Reproduction:** Open https://applyready.in/resize-image-to-kb-limit.html?targetKB=15&width=300&height=400, add photo_4000x3000.jpg and Resize: the result is 350 × 350 px 'Under the 50 KB limit' (16,607 B).
- **Expected:** 300 × 400 px under 15 KB.
- **Actual:** 350 × 350 px under 50 KB.
- **Root cause:** js/resizer.js init(): `if (targetPreset && PRESETS[targetPreset]) { applyPreset(targetPreset) } else if (targetKB) {...}`. targetPreset falls back to appEl.dataset.preset = 'custom', which exists in PRESETS, so the targetKB branch never runs.
- **Recommended fix:** Apply the targetKB/width/height branch when the preset is 'custom' (or when any of those params are present), after applyPreset.
- **Verification method:** Load the URL above: the summary should read '300 × 400 px · under 15 KB' and the output should match.
- **Resolution in this round:** Fixed. URL targetKB/maxKB, width and height (whole numbers only) are now applied on top of any preset, and the requirement switches to Custom. They used to be ignored whenever the page's data-preset existed, including 'custom'.
- **Regression test:** Section 15: resize-image-to-kb-limit.html?targetKB=15&width=300&height=400 shows those values and produces 300x400 under 15 KB. ?targetKB=12 on the 20 KB page replaces its limit. Values that are not whole numbers are ignored.
- **Fix verified by:** an independent verifier re-ran the original reproduction against the fixed build (image package)

### IMG-08

**Passport print sheet silently prints fewer copies than requested**

- **Severity:** LOW
- **Verification:** reproduced independently on the live site (confirmed)
- **Where:** https://applyready.in/passport-photo-print.html
- **Description:** The Copies menu offers 8, 12 and 16, but on 4x6 paper only 6 Indian-passport photos fit. Choosing '8 photos' gives 6 with no message next to the control. The only hint is a stat line elsewhere and the download name 'Passport_Photos_6_Copies'.
- **Reproduction:** Add a 350x450 photo, keep 4x6 paper, set Copies to '8 photos'. The sheet and the JPEG show 6 photos; the control still reads '8 photos'.
- **Expected:** Say that only 6 fit on 4 × 6 paper and suggest A4, or disable options that cannot fit.
- **Actual:** Silently capped at 6.
- **Root cause:** js/passport-photo-print.js renderSheet: `targetCount = Math.min(requested, maxCapacity)` with no user notice.
- **Recommended fix:** When requested > maxCapacity, show an inline note under Copies (and announce it), or disable options above capacity for the chosen paper and photo size.
- **Verification method:** Choose 8 on 4x6: a visible note appears saying 6 fit.
- **Resolution in this round:** Fixed. Copies now has a polite live hint linked with aria-describedby. It always says how many photos of this size fit on the chosen paper. When more are asked for, it says 'Only 6 ... so the sheet has 6, not 8' and suggests A4 or printing twice, in warning style. I added a .field-hint.is-warning rule inside the fields section of app.css (design tokens only).
- **Regression test:** Section 18 checks the hint text for auto, for 8 copies on 4x6 (warning shown) and on A4 (warning gone), and the stat still reads 6.
- **Fix verified by:** an independent verifier re-ran the original reproduction against the fixed build (image package)

### IMG-09

**Compress/convert queue images over 50 MP as 'Waiting' and fail them only after Start**

- **Severity:** LOW
- **Verification:** reproduced independently on the live site (confirmed)
- **Where:** https://applyready.in/compress-image.html, https://applyready.in/convert-image.html
- **Description:** The row already shows '9000 × 8000 px' when the file is added, so the size is known. The 50 MP limit is still only applied when the job runs, so the user presses Compress and then sees 'No images could be processed'.
- **Reproduction:** Add in/huge_72mp.jpg (9000x8000) on compress-image.html: the row shows 'Waiting' and the button 'Compress 1 image'. Press it: the row turns 'Failed – This image is 72 megapixels ... more than the 50 MP this tool can handle'.
- **Expected:** Refused at add time with the same message, like 0-byte, text and HEIC files.
- **Actual:** Accepted into the queue and failed later.
- **Root cause:** The header size from ApplyReadyImageOps.readHeader is used for display, but the MAX_PIXELS check runs only inside process().
- **Recommended fix:** Check header width x height against MAX_PIXELS when adding files and list the file in the 'not added' error box.
- **Verification method:** Add huge_72mp.jpg: it should appear in 'One file was not added' and the Start button should stay disabled.
- **Resolution in this round:** Fixed. Kit.dropzone has a new opt-in checkPixels option that refuses images over 50 MP from their header at add time, in the 'not added' box. The batch tools (compressor, converter, batch) turn it on. The batch FAQ that listed 'a photo above 50 megapixels' as a reason for a failed row was corrected.
- **Regression test:** In batch_image_tests 3c, huge_60mp.png added on its own now appears in 'One file was not added' with its 60 MP reason, never enters the list, and the button counts 3 images. This replaces the old assertion that it failed after Start.
- **Fix verified by:** an independent verifier re-ran the original reproduction against the fixed build (image package)

### LIVE-02

**Resume-builder icon is blank on the offline page**

- **Severity:** LOW
- **Verification:** reproduced independently on the live site (confirmed)
- **Where:** https://applyready.in/offline.html (offline)
- **Description:** Offline, the 'Open the resume builder' button on the offline page has no icon; the other three buttons show theirs. That button uses fa-regular fa-file-lines, which needs css/webfonts/fa-regular-400.woff2. The service worker caches that font only if a page that used a regular-weight icon was visited, and only the offline page precached at install uses one.
- **Reproduction:** Fresh context with service workers allowed: open https://applyready.in/, reload, go offline, open https://applyready.in/about.html. Script: scripts/sw.js and scripts/offline_click.js under scratchpad/audit/live-sweep/.
- **Expected:** All four buttons show an icon.
- **Actual:** document.fonts reports 'Font Awesome 6 Free 400 error' and the console logs net::ERR_FAILED for the font. The button shows a gap where the icon should be. Screenshots: scratchpad/audit/live-sweep/sw/offline_about.html.png (360px) and sw/offline_buttons_1280.png.
- **Root cause:** sw.js install precaches only /offline.html. The files that page needs are cached only when a page loads them: the regular-weight icon font is loaded only by pages with a regular-weight icon (e.g. 404, offline, resume). offline.html line ~145 uses fa-regular fa-file-lines.
- **Recommended fix:** Use the solid fa-file-lines on offline.html (the solid font is always cached, because every page uses solid icons), or add /css/webfonts/fa-regular-400.woff2 to what sw.js caches together with offline.html at install.
- **Verification method:** Fresh profile: visit only /, go offline, open any unvisited page; all four button icons render and document.fonts shows no 'error' entry.
- **Resolution in this round:** Fixed. Same fix as SEO-05: the regular-weight icon font is cached with offline.html at install.
- **Regression test:** Same as SEO-05.
- **Fix verified by:** an independent verifier re-ran the original reproduction against the fixed build (site package)

### LIVE-04

**Privacy page says 'Two links lead elsewhere', but the site links to 46 external URLs**

- **Severity:** LOW
- **Verification:** reproduced independently on the live site (confirmed)
- **Where:** https://applyready.in/privacy.html
- **Description:** privacy.html line 216 says: 'The site loads nothing from third parties. Two links lead elsewhere... the source code on GitHub, and the optional donation page hosted by Razorpay.' The first half is true: 0 requests to other origins in 1,596 requests. But the pages link out to 46 distinct external URLs, including MDN, loc.gov, w3.org, cca.gov.in, digilocker.gov.in, passportindia.gov.in, csk.gov.in, nationalcareers.service.gov.uk, support.google.com, fontawesome.com and creativecommons.org. The closing clause mentions only 'job or application portals in guides'. It is a small accuracy problem on a page meant to build trust.
- **Reproduction:** Open /privacy.html and read the 'Third parties' paragraph. Compare with the external list in scratchpad/audit/live-sweep/links.json (key 'external', 46 URLs) and ext.txt.
- **Expected:** Privacy text that matches the site: nothing is loaded from third parties, and links to other sites (references in guides and about pages, GitHub, the donation page) are followed only if you click them.
- **Actual:** The text names only two outbound links.
- **Root cause:** privacy.html line 216 copy.
- **Recommended fix:** Reword, e.g. 'The site loads nothing from other websites. Some pages link to other sites (the source code on GitHub, the optional donation page on Razorpay, and official or reference pages cited in guides); those open only if you follow them and are governed by their own policies.'
- **Verification method:** Re-read privacy.html; the text no longer gives a count that conflicts with the link inventory.
- **Resolution in this round:** Fixed. The 'Third parties' paragraph in privacy.html no longer says 'Two links lead elsewhere'. It says nothing is loaded from other sites, and that some pages link to GitHub, the Razorpay donation page, and official or reference pages cited in guides. Those open only if followed and are governed by their own policies. The Razorpay wording was not changed.
- **Regression test:** content_tests.js asserts the old count sentence is gone.
- **Fix verified by:** an independent verifier re-ran the original reproduction against the fixed build (site package)

### NAV-02

**Hinglish task verbs (chota, kam, jodna, milana) are ignored, so 'pdf chota karna' opens Merge PDF**

- **Severity:** LOW
- **Verification:** reproduced independently on the live site (confirmed)
- **Where:** https://applyready.in/ search (dialog and inline), tools.html filter
- **Description:** The site targets Indian applicants, but the search vocabulary has no Hindi or Hinglish verbs. Some queries only work because of a lucky tie-break or an English word in the query: 'pdf jodna' gives Merge PDF purely because Merge PDF has the best popularity rank among PDF tools, and 'pdf size kam karna' works only because of 'size'. 'pdf chota karna' and 'pdf ko chota' ('make the PDF small') give Merge PDF first, and Enter opens it. 'pdf milana' ('combine') gives the same generic order. On tools.html, 'pdf jodna' does not filter at all: it shows all 12 PDF-related cards including Resume builder and File checker. A Devanagari query ('फोटो') is stripped to nothing and returns 'No tool matches'.
- **Reproduction:** Open https://applyready.in/, press /, and type 'pdf chota karna'. The first result is Merge PDF, and Enter opens merge-pdf.html. On https://applyready.in/tools.html type 'pdf jodna' in the filter: 12 tools match.
- **Expected:** 'pdf chota karna' and 'pdf ko chota' give Compress PDF first. 'pdf jodna' and 'pdf milana' give Merge PDF first because the words are understood. 'photo chhota karna' gives Image compressor first.
- **Actual:** Merge PDF first for 'pdf chota karna' and 'pdf ko chota'. For 'pdf jodna' and 'pdf milana' the order is the popularity order of all PDF tools. shots/phone-inline-pdf_chota_karna.png, out/search-results.json.
- **Root cause:** js/search.js SYNONYMS contains only English words. Unmatched words are dropped from scoring and the order falls back to `popular`.
- **Recommended fix:** Add common Hinglish words to SYNONYMS: 'chota', 'chhota', 'kam', 'ghatana' in the compress group; 'jodna', 'jodo', 'milana', 'ek' in the merge group; 'banana', 'banao' as stop words or in the create group; 'badlo' and 'badalna' in the convert group. Consider mapping a few Devanagari words (फोटो, साइज, पीडीएफ) too.
- **Verification method:** Re-run the query list in out/search-results.json and confirm that 'pdf chota karna' gives Compress PDF first and 'pdf milana' gives Merge PDF first, while the English queries keep their current top result.
- **Resolution in this round:** Fixed. Added common Hinglish words: chota/chhota/choti/kam/ghatana join the compress group; jodna/jodo/jod/milana/milao join merge; badlo/badalna join convert; tasveer/foto join photo. karna, karo, kaise, ko, ka, ki, ke, hai, mein, banana and banao are stop words. A small Devanagari map (फोटो, पीडीएफ, साइज, छोटा, जोड़ना, मिलाना, हस्ताक्षर, रिज्यूमे...) is applied before normalisation. The tools.html filter for 'pdf jodna' now shows only the merging tools.
- **Regression test:** navigation_tests.js: 'pdf chota karna', 'pdf ko chota', 'pdf size kam karna', 'पीडीएफ छोटा' give Compress PDF; 'pdf jodna' and 'pdf milana' give Merge PDF; 'photo chhota karna' gives Image compressor; 'फोटो' gives Image resizer. The English queries keep their top results.
- **Fix verified by:** an independent verifier re-ran the original reproduction against the fixed build (site package)

### NAV-04

**On phones, Resume builder sits inside a one-item 'Resume' accordion, so the flagship tool needs 3 taps from any page**

- **Severity:** LOW
- **Verification:** reproduced independently on the live site (confirmed)
- **Where:** Phone menu on every page (360px)
- **Description:** Desktop has a direct 'Resume builder' link in the header. On phones that link is hidden by CSS, and the menu shows a 'Resume 1' accordion that must be expanded to reveal its single link. A person who has just resized their photo and wants to return to their resume needs menu, then Resume, then Resume builder: 3 taps. Desktop needs 1 click.
- **Reproduction:** At 360x740 open https://applyready.in/merge-pdf.html, tap ☰, then tap 'Resume 1', then tap 'Resume builder'.
- **Expected:** One tap after opening the menu (a direct link), the same as desktop.
- **Actual:** 3 taps. shots/phone-menu-open.png shows 'Resume 1' as an accordion.
- **Root cause:** css/app.css:1286 contains `.site-nav__item > .site-nav__link, .site-nav__resume { display: none; }` at max-width 639px, and the phone sheet renders every category, including the single-tool Resume category, as a .menu__toggle accordion.
- **Recommended fix:** Show the .site-nav__resume link in the phone sheet, or render a category with one tool as a direct link instead of an accordion.
- **Verification method:** At 360 px, from a tool page, menu then Resume builder reaches resume.html in 2 taps.
- **Resolution in this round:** Fixed. In scripts/lib/shell.js menuGroup, a category with a single tool (Resume, Cyber cafe) renders no toggle and gets a menu__cat--single class. The phone CSS shows its link directly as a full-size sheet row. Resume builder is now one tap after opening the menu. Desktop is unchanged, and all pages were regenerated.
- **Regression test:** navigation_tests.js: single-tool categories have no toggle and carry the class, and the CSS rule exists. ui_tests.js at 360 px: no toggle for Resume or Cafe, both links visible right after opening, Resume builder listed once, the Image category still opens and closes, and the sheet still fits 360x740. Screenshot checked.
- **Fix verified by:** an independent verifier re-ran the original reproduction against the fixed build (site package)

### NAV-05

**Common application words return nothing, and some unsupported requests return unrelated tools**

- **Severity:** LOW
- **Verification:** reproduced independently on the live site (confirmed)
- **Where:** Search dialog / home inline search
- **Description:** These queries return 'No tool matches': 'aadhaar', 'marksheet', 'thumb impression' and 'left thumb' (SSC and IBPS ask for a thumb impression, which Signature resizer handles), 'backup' (a guide 'How to Back Up and Restore Your Resumes' exists), and 'offline' (the site works offline and has offline.html). Other queries return confidently wrong pages: 'dark mode' gives Organise PDF pages (via a typo correction of 'mode' to 'move'), 'clear history' gives Changelog, 'install app' gives Applicant workspaces, 'unlock pdf' and 'pdf password' give Merge PDF, and 'photo background change' gives Image converter. A user may think the site can do something it cannot, or may give up.
- **Reproduction:** Press / on https://applyready.in/ and type each of the queries above.
- **Expected:** Synonyms are mapped (thumb, then Signature resizer; marksheet, then Merge or Compress PDF; backup, then the backup guide; offline, then a How to use or offline section). Unsupported requests (unlock, background removal, dark mode) show 'ApplyReady does not do X' or no result rather than an unrelated tool.
- **Actual:** See out/search-results.json and out/search-extra-local.txt; shots/phone-inline-dark_mode.png, shots/phone-inline-marksheet.png.
- **Root cause:** scripts/lib/tools.js keywords lack these terms. js/search.js correct() treats any word one edit away as a match ('mode' becomes 'move'), and the 'change' synonym pulls in Image converter.
- **Recommended fix:** Add keywords for thumb, marksheet, backup, offline and aadhaar (e.g. aadhaar pdf goes to Compress PDF; aadhaar alone goes to the document checklist guide). Add a 'not supported' page entry like the existing Word to PDF one for unlock, password and background removal. Skip typo correction for 4-letter words.
- **Verification method:** Re-run the listed queries and confirm relevant results or an honest 'not supported' entry.
- **Resolution in this round:** Partly fixed. Fixed: 'thumb impression' and 'left thumb' now go to Signature resizer. 'marksheet' and 'aadhaar' go to Image to PDF or Compress PDF. 'backup' goes to Your data, then the backup guide (new backup/back synonym). 'offline' and 'clear history' go to Your data. Typo correction now skips four-letter words, so 'dark mode' and 'mode' no longer offer Organise PDF pages. Not done: there is no 'ApplyReady does not do X' entry for unlocking a PDF, removing a password or changing a photo background. Such an entry needs an explanatory page section, and none exists to link to. So 'unlock pdf' still lists the PDF tools, 'pdf password' gives the merge guide and Merge PDF (both accurate: merging removes a known password), 'photo background change' still lists Image converter first, and 'install app' still matches Applicant workspaces by prefix. After an independent check: Four-letter words are typo-corrected again, but only when a letter is missing (the candidate has 5 letters) or two neighbouring letters are swapped. A changed letter is never corrected, so 'mode' is still not read as 'move'. Results: 'mrge' gives merge-pdf, 'splt' gives split-pdf, 'sgin' gives signature-resizer, and 'dark mode' and 'mode' give nothing. I compared about 290 common English 4-letter words with the previous version. Three now return results where they returned none: 'mail' (Contact, via 'email'), 'sale' (image tools, via 'scale') and 'bank' (a resume guide, via 'blank'). This is still far fewer spurious corrections than base 92f7ef0, which allowed changed letters.
- **Regression test:** navigation_tests.js: cases for thumb, backup (including the guide), offline, clear history, marksheet and aadhaar, and checks that 'dark mode' and 'mode' do not include organize-pdf.
- **Fix verified by:** an independent verifier re-ran the original reproduction against the fixed build (site package); the verifier raised a follow-up issue, which was then repaired

### NAV-06

**A trailing-slash tool URL (/merge-pdf/) shows a 404 page with no suggestion**

- **Severity:** LOW
- **Verification:** reproduced independently on the live site (confirmed)
- **Where:** https://applyready.in/merge-pdf/
- **Description:** /merge-pdf works, but /merge-pdf/ (as some link shorteners, chat apps or users produce) returns 404. Unlike /Merge-PDF.html or /passport-photo, the 404 page offers no 'did you mean Merge PDF' link, only generic buttons (image resizer, resume builder). /compress-pdf-100kb.html likewise gets no suggestion.
- **Reproduction:** Open https://applyready.in/merge-pdf/ on a phone.
- **Expected:** Either a redirect to /merge-pdf.html, or the 404 page suggests Merge PDF.
- **Actual:** 'This address does not lead anywhere. The page may have moved or been removed.' with generic buttons only. shots/nf-merge_pdf_.png
- **Root cause:** js/not-found.js takes `path.split('/').pop()`, which is an empty string for a path ending in '/', so there are no tokens and no suggestion. Tokens containing numbers ('100kb') fail the strict every-word coverage check.
- **Recommended fix:** Strip trailing slashes before taking the last segment (`path.replace(/\/+$/, '')`), and redirect when the remaining slug exactly equals a tool path without .html. Allow size tokens to be ignored in the coverage check.
- **Verification method:** /merge-pdf/ lands on, or links to, merge-pdf.html. /compress-pdf-100kb.html suggests Compress PDF.
- **Resolution in this round:** Fixed. An address with a trailing slash that names an existing page in the search index (for example /merge-pdf/ or /guides/how-to-merge-pdf-files/) now redirects to that page. Size tokens such as 100kb no longer have to match a page's own words, but are still searched. So /compress-pdf-100kb.html offers Compress PDF, and /resize-image-to-30kb.html now offers the image resizer; that test expectation was changed on purpose, per the finding, and replaced with another loose case (/resize-photo-for-ssc.html), which still offers nothing.
- **Regression test:** robustness_tests.js: /merge-pdf/ and /guides/how-to-merge-pdf-files/ open their pages. /compress-pdf-100kb.html offers /compress-pdf.html and /resize-image-to-30kb.html offers /image-resizer.html. Loose matches are still not offered.
- **Fix verified by:** an independent verifier re-ran the original reproduction against the fixed build (site package)

### PA-03

**The offline page claims every tool and guide is kept after the first visit; its links lead back to the offline page**

- **Severity:** LOW
- **Verification:** reproduced independently on the live site (confirmed)
- **Where:** https://applyready.in/offline.html (shown for any page that was never visited, while offline)
- **Description:** offline.html says 'ApplyReady runs in your browser, and after your first visit it keeps every tool and guide on this device, so the pages below should still open.' The service worker keeps only the pages that were opened. Its 'Browse all tools', 'Open the resume builder' and 'Browse the guides' links lead to pages that are not cached unless they were visited, so the visitor lands on the same offline page again. While offline, the resume-builder button also shows a blank gap where its fa-regular icon should be, because the regular icon font is not cached.
- **Reproduction:** In a fresh profile, visit only /, /image-resizer.html and /merge-pdf.html. Go offline and open /compress-pdf.html. Read the text and follow 'Open the resume builder'.
- **Expected:** The text matches the behaviour (for example: 'Only pages you opened while online are kept; save every tool on Your data'), and the links point to cached pages or are marked as needing a connection.
- **Actual:** The text promises every tool. /resume.html, /tools.html and /guides/ show offline.html again. The resume button has an empty icon gap.
- **Root cause:** offline.html:140 wording, which does not match the sw.js header comment ('without downloading the whole site uninvited'). offline.html:145 uses fa-regular, whose font (css/webfonts/fa-regular-400.woff2) is not fetched by pages that use only fa-solid.
- **Recommended fix:** Reword the line to describe 'pages you opened' and point to Your data > Save every tool. Use an fa-solid icon, or make sure the icon fonts are kept with offline.html when the service worker installs.
- **Verification method:** Open an unvisited page offline and read the text; take a screenshot to confirm the icon renders.
- **Resolution in this round:** Fixed. The wording is fixed as in LIVE-01. The blank regular-weight icon is fixed as in SEO-05: both icon fonts are now cached with offline.html at install.
- **Regression test:** robustness_tests.js offline page: document.fonts.load succeeds offline for weights 400 and 900, and no Font Awesome face is in the error state.
- **Fix verified by:** an independent verifier re-ran the original reproduction against the fixed build (site package)

### PA-04

**The Merge PDF error repeats the same sentence once per file with no file name**

- **Severity:** LOW
- **Verification:** reproduced independently on the live site (confirmed)
- **Where:** https://applyready.in/merge-pdf.html
- **Description:** When the PDF library cannot load (offline, or a flaky connection), each added file pushes the same generic message, so the error box shows 'A part of the PDF tool could not load. Check your connection and reload the page.' twice for 2 files, or 50 times for 50.
- **Reproduction:** Visit /merge-pdf.html online without using it, go offline, reload, and add 2 PDFs.
- **Expected:** One message, or one message per file that names the file.
- **Actual:** 'A part of the PDF tool could not load. Check your connection and reload the page. A part of the PDF tool could not load. Check your connection and reload the page.'
- **Root cause:** js/merge-pdf.js addFiles(): `problems.push(e.message)` for each file. PdfError 'unsupported' from pdf-kit injectScript (pdf-kit.js:95) has no file name, and the loop does not stop on a library-load failure the way it does for 'toolarge'.
- **Recommended fix:** Break the loop, or de-duplicate the problems, when e.code === 'unsupported'.
- **Verification method:** Repeat the reproduction: the error should be shown once.
- **Resolution in this round:** Fixed. injectScript failures now carry detail 'load' and remove the failed script tag. When the library cannot load, Merge stops the loop, adds 'None of the other N files could be added either', and removes duplicate messages.
- **Regression test:** Browser check with pdf-lib.min.js blocked: with 3 PDFs added, 'could not load' appears exactly once, followed by the 'None of the other 2 files' sentence.
- **Fix verified by:** an independent verifier re-ran the original reproduction against the fixed build (pdf package)

### PA-05

**Image resizer: focus drops to the page body after an image is chosen with the keyboard**

- **Severity:** LOW
- **Verification:** reproduced independently on the live site (confirmed)
- **Where:** https://applyready.in/image-resizer.html
- **Description:** A keyboard user presses 'Choose image' (#btnBrowse) and picks a file. The drop zone, together with the focused button, is then hidden and nothing receives focus, so document.activeElement becomes BODY. Screen-reader users get no context, and in browsers that restart sequential navigation at the top of the page, the next Tab goes to the skip link. Merge PDF and Batch move focus to 'Add files' or Start in the same situation (WCAG 2.4.3 Focus Order).
- **Reproduction:** Using only the keyboard: Tab 10 times to 'ID / passport photo', press Space, Tab to 'Choose image', press Enter and pick a photo. Check document.activeElement once the cropper has loaded.
- **Expected:** Focus moves to a meaningful element in the next step, such as the crop area (.cropper-container-wrapper) or 'Resize and compress'.
- **Actual:** activeElement is BODY ('focus after file loaded {"d":"BODY"}'). In Chromium the next Tab happens to land on the crop area.
- **Root cause:** js/resizer.js never moves focus after a successful load. Its only .focus() calls are at lines 362/364 (requirement), 797/810 (validation) and 1833 (download). The other tools use ApplyReadyPdfUI.keepFocus (js/lib/pdf-ui.js:538).
- **Recommended fix:** After the file loads, if the focused element was inside the drop zone that has just been hidden, focus .cropper-container-wrapper (it has an aria-label and arrow-key help) or the file bar's Replace button.
- **Verification method:** Rerun `node a11y/kb-walk.js resizer`: 'focus after file loaded' should not be BODY.
- **Resolution in this round:** Fixed. When the cropper is ready, the resizer focuses the crop area (.cropper-container-wrapper, which has an aria-label) if focus was on the body or inside the now-hidden placeholder. The signature cleaner and print sheet had the same problem: they now focus the file bar's Replace button, deferred until components.js has shown the file bar.
- **Regression test:** Section 16 opens the file chooser with the keyboard on #btnBrowse and checks that activeElement is the crop area. Section 17 checks the cleaner focuses #btnCleanerReplace. I also checked the print sheet manually with a Playwright script.
- **Fix verified by:** an independent verifier re-ran the original reproduction against the fixed build (image package)

### PA-07

**Guide charts scroll sideways at 360px in a figure that cannot take keyboard focus**

- **Severity:** LOW
- **Verification:** reproduced independently on the live site (confirmed)
- **Where:** 8 guides, for example https://applyready.in/guides/image-formats-guide.html and /guides/document-checklist-before-online-application.html
- **Description:** At 600px wide or less, .shot > svg gets min-width: 560px inside a figure with overflow-x: auto. The figure has no tabindex, role or label, so keyboard users in browsers that do not make scroll containers focusable (Safari) cannot scroll to the right part of the chart. axe scrollable-region-focusable is serious and fails in both themes. The SVG's <title> still gives screen readers the data.
- **Reproduction:** Open /guides/image-formats-guide.html at a 360x740 viewport and run axe, or try to Tab to the chart.
- **Expected:** Either the chart fits the width, or the scroll region has tabindex=0 with an accessible name.
- **Actual:** 16 violations (8 guides x 2 themes) of scrollable-region-focusable on figure.shot at 360px.
- **Root cause:** css/app.css:591-592 `.shot:has(> svg) { overflow-x: auto; }` and `@media (max-width: 600px) { .shot > svg { min-width: 560px; } }`, with no focusable wrapper in the guide markup.
- **Recommended fix:** Add tabindex="0" and aria-labelledby (pointing to the SVG title or the figcaption) to these figures, or let the SVGs scale down to 320px.
- **Verification method:** Run axe-pages.js at 360px: 0 scrollable-region-focusable violations.
- **Resolution in this round:** Fixed. js/site.js finds the guide chart frames (.shot with an svg child). When a frame scrolls sideways (at 600 px and below), it gets tabindex=0 and aria-labelledby pointing to the chart's own <title>. A frame that fits loses both, so it is not a tab stop on desktop; this is re-checked on resize. Arrow keys scroll the focused frame. The existing CSS (readable text size, scrolling inside the frame) is kept.
- **Regression test:** ui_tests.js: for all 8 chart guides in light and dark at 360 px, the frame scrolls, has tabIndex 0 and is named by the svg title, and axe on main reports no violations. At 1280 px no chart frame has a tabindex. Checked manually: ArrowRight scrolls the frame (scrollLeft 80).
- **Fix verified by:** an independent verifier re-ran the original reproduction against the fixed build (site package)

### PDF-05

**Long watermark text runs off the page and is cut off; no size fitting or warning**

- **Severity:** LOW
- **Verification:** reproduced independently on the live site (confirmed)
- **Where:** https://applyready.in/watermark-pdf.html
- **Description:** The tool allows 60 characters and sizes up to 96 pt, but never scales the text to fit the page. A 53-character watermark at the default Medium 48 pt, diagonal, is cut off at both ends on A4. At Large it is worse, and the preview shows the cut-off text with no warning.
- **Reproduction:** Open in/a4_text.pdf, set the text to 'A very long watermark text that goes on and on and on', keep Medium/Diagonal/Centre, Add watermark, download out/wm_a4_text.pdf and render page 1 (shots/wm_longtext-1.png): 'A very lo' and 'on and on' are off the page. The preview at Large is in shots/wm_preview_longtext.png.
- **Expected:** Text shrinks to fit inside the visible page (rotated bounding box within the page minus a margin), or the user is warned.
- **Actual:** The text is cut off, so the visible words do not match what the user typed.
- **Root cause:** js/lib/pdf-kit.js addWatermark(): tw is computed from o.size and never compared with W/H; there is no fitting step.
- **Recommended fix:** For non-tiled layouts, compute the rotated extent (tw*|cos|+cap*|sin|) and lower the size until it fits within about 90% of the page width and height. Show 'size reduced to fit' in the summary.
- **Verification method:** Stamp the long text at Large on A4 and A5: the whole string must be visible in the render.
- **Resolution in this round:** Fixed. addWatermark computes the stamp's turned bounding box for each page and makes the size smaller until the box fits within 90% of the page width and the page height (less the top and bottom padding). This applies to every layout, including each tile. It fills an optional report ({fitted, smallest}). The preview caption and the result text say the text was made smaller, with the size used and the size chosen. I checked renders of A4 and landscape pages at Large and Extra large, centre, top and bottom, at 0°, 45° and 90°: the whole string is visible.
- **Regression test:** Unit checks: a 53-character text at 96/72 pt (centre and top, 0°) has every word inside the page according to pdftotext -bbox. The report shows the text was made smaller, and a short text keeps its size. Browser check: the preview caption and the result text mention the smaller size.
- **Fix verified by:** an independent verifier re-ran the original reproduction against the fixed build (pdf package)

### PDF-06

**Extract mode silently duplicates pages for overlapping ranges**

- **Severity:** LOW
- **Verification:** reproduced independently on the live site (confirmed)
- **Where:** https://applyready.in/split-pdf.html
- **Description:** Typing overlapping ranges in Extract pages, for example '1-3, 2-4', makes a 6-page file with pages 2 and 3 twice. The thumbnail grid shows only 4 pages selected. The summary says 'Creates 1 PDF with 6 pages', but nothing points out the duplicates. The help text documents typed order but not repetition. Someone sending a page selection to a portal could upload duplicated pages by mistake.
- **Reproduction:** Open in/mixed.pdf, Extract, type '5, 1-2, 2', Split, download out/split_extract.pdf: the pages are MIX 5, 1, 2, 2.
- **Expected:** Either remove duplicates, or say so: 'pages 2 is included twice'.
- **Actual:** Pages are repeated silently.
- **Root cause:** js/lib/pdf-kit.js parseRanges() keeps repeats by design ("may repeat"), and js/split-pdf.js plan() uses parsed.pages as-is for extract.
- **Recommended fix:** Show a note in #splitSummary when parsed.pages contains duplicates, or remove duplicates while keeping first-seen order.
- **Verification method:** Type '1-3, 2-4': the summary should mention repeated pages, or create 4 pages.
- **Resolution in this round:** Fixed. Pages typed more than once are kept, because typed order and repeats are intentional. In Extract mode the summary now says, for example, 'Creates 1 PDF with 6 pages. Pages 2-3 are in the list more than once, so they appear more than once in the file.' The how-to text mentions it too.
- **Regression test:** Browser check: '1-3, 2-4' gives the note, and '1-4' gives none.
- **Fix verified by:** an independent verifier re-ran the original reproduction against the fixed build (pdf package)

### PDF-07

**Compressed size is measured in 1024-byte KB; a '500 KB' result can be over a 500,000-byte portal limit**

- **Severity:** LOW
- **Verification:** reproduced independently on the live site (confirmed)
- **Where:** https://applyready.in/compress-pdf.html
- **Description:** Target 500 KB produced 504,832 bytes, and target 100 KB produced 99,995 bytes. These are correct in 1024-byte units. Portals that count 1 KB = 1000 bytes would reject the first file. I did not confirm how any specific portal counts.
- **Reproduction:** Compress in/scanned.pdf to 500 KB: out/cmp_scanned_500.pdf is 504,832 B, and the UI says 'Under 500 KB'.
- **Expected:** Leave a safety margin, or aim under both 500x1000 and 500x1024 bytes.
- **Actual:** Can land between 500,000 and 512,000 bytes.
- **Root cause:** js/compress-pdf.js: target = Math.floor(targetKB()*1024).
- **Recommended fix:** Aim at targetKB*1000 (or about 2% below the 1024-based target) so files pass either way of counting. Show the byte count next to the KB figure.
- **Verification method:** Compress to 500 KB: the output should be at most 500,000 bytes.
- **Resolution in this round:** Fixed. The target is now Math.floor(KB*1000), which is under the limit whether a portal counts 1 KB as 1,000 or 1,024 bytes. The status gives the exact byte count, for example 'Under 120 KB (1,19,532 bytes, under 120 KB however the portal counts a KB)'. A file between 500,000 and 512,000 bytes is no longer kept as already under a 500 KB limit. After an independent check: Added ApplyReadyPdf.limitKB/limitSize (KB = 1,000 bytes, rounded up, so a size can never read as under a limit it is over) and compressResult(bytes, kb, kept), which builds the result text. The failure and 'kept' messages now give the exact byte count and the rounded-up KB. When the size is over kb×1000 but not over kb×1024, they also say that a portal counting 1,024-byte KB would accept the file and one counting 1,000 bytes would not. The Before and After stats use the same unit. compress-pdf.js no longer uses /1024 anywhere. Example: 505,000 bytes with a 500 KB limit now reads 'could not get under 500 KB. The smallest readable version is 5,05,000 bytes, 505.0 KB. A portal that counts 1 KB as 1,024 bytes would accept it (up to 5,12,000 bytes)...'.
- **Regression test:** Existing compress checks tightened: the output must be at most 120*1000 and 150*1000 bytes, and the status must state the byte count.
- **Fix verified by:** an independent verifier re-ran the original reproduction against the fixed build (pdf package); the verifier raised a follow-up issue, which was then repaired

### RES-03

**Compact density PDF splits a two-line bullet across pages, leaving a one-line widow**

- **Severity:** LOW
- **Verification:** reproduced independently on the live site (confirmed)
- **Where:** https://applyready.in/resume.html (Compact Professional or Density: Compact)
- **Description:** The code says bullets are never split across pages, but with compact density a 2-line bullet near the bottom of a page has its last line moved to the next page. The page then starts with a fragment such as 'office (Q1 review).'.
- **Reproduction:** Import inputs/multipage.json, select the Compact Professional template and Download PDF. At the bottom of page 1, the bullet '• Built a vendor onboarding workflow, improving accuracy from 935% to 99%; reported results to the COO's' continues at the top of page 2 with 'office (Q1 review).'.
- **Expected:** A bullet is moved whole to the next page when it does not fit, as in the standard-density templates.
- **Actual:** dl/mp_compact-professional.pdf page 1 to page 2 has a one-line widow (render/compact_break.png).
- **Root cause:** js/pdf-engine.js renderBullets(): keepTogether(bulletNeed()) reserves lines × bulletLineHeight, where bulletLineHeight = baseFontSize + 3 in compact. But each line then calls ensureSpace(baseFontSize + 4), which needs 1 pt more than was reserved, so the last line can trigger a page break inside the bullet.
- **Recommended fix:** Use the same height in both places: ensureSpace(bulletLineHeight) inside renderBullets, or reserve with baseFontSize + 4.
- **Verification method:** Re-export inputs/multipage.json in Compact Professional and with density Compact. Check with pdftotext that no page begins with a bullet continuation line.
- **Resolution in this round:** Fixed. Inside renderBullets, ensureSpace now uses bulletLineHeight, the same height bulletNeed() reserved, instead of baseFontSize+4. A compact-density bullet's last line can no longer spill onto the next page.
- **Regression test:** New regression check: shifts across 25 education counts x 13 summary lengths for 3 templates in both densities and asserts that no page starts with a bullet continuation line. Fails on the old engine (compact-professional compact shift 3+4), passes now.
- **Fix verified by:** an independent verifier re-ran the original reproduction against the fixed build (resume package)

### RES-04

**Word export: a long project link runs into the tech text with no separator ('Power BIgithub.com/…')**

- **Severity:** LOW
- **Verification:** reproduced independently on the live site (confirmed)
- **Where:** https://applyready.in/resume.html (Download Word)
- **Description:** In the DOCX, the project heading is 'Name | tech', then a right-aligned tab, then the link. When the link does not fit on the rest of the line, the tab has zero width and the link is glued to the tech list, e.g. 'Python, Pandas, Power BIgithub.com/example-user/warehouse-capacity-…'. The education line's date and location meta wraps awkwardly for the same reason. Reproduced in the LibreOffice rendering; Word handles overflowing right tabs in a similar way.
- **Reproduction:** Import inputs/multipage.json (a project link of about 95 characters), choose Executive Impact (or Classic Professional), Download Word, then render with libreoffice --headless --convert-to pdf.
- **Expected:** The link starts on its own line, or after a visible separator, when it does not fit to the right of the title.
- **Actual:** render/dxhi_exec_proj.png shows 'Power BIgithub.com/example-user/warehouse-capacity-planner-…' run together.
- **Root cause:** js/docx-engine.js line 562: `<w:tabs><w:tab w:val="right" w:pos="${textWidth}"/></w:tabs>…${titleRuns}<w:r><w:tab/></w:r>${linkRun(link…)}`. A right tab with overflowing text gives no gap. Line 457 does the same for entry meta.
- **Recommended fix:** When the title, tech and link together exceed the line width, put the link in its own paragraph (or add ' | ' before it) instead of using a right tab.
- **Verification method:** Re-export the multipage resume to DOCX, convert with LibreOffice and look at the Projects heading lines.
- **Resolution in this round:** Fixed. The DOCX engine measures title plus details (dates or a project link) with the PDF engine's AFM metrics (Arial and Times New Roman match Helvetica and Times), with a 24pt margin. When they don't fit, the details go on their own paragraph instead of an overflowing right tab. As in the PDF, the choice is made once per section (experience, education, custom entries, project links). Verified by rendering the auditor's multipage.json with LibreOffice for 4 templates: the link now sits on its own line, and short headings keep their right-aligned dates.
- **Regression test:** New regression check reads document.xml for 3 templates: a long link and a long education heading are not tab-joined, and short experience dates stay inline. Fails on the old engine.
- **Fix verified by:** an independent verifier re-ran the original reproduction against the fixed build (resume package)

### RES-05

**Keyword match counts generic words ('know', 'unit', 'juniors') as key terms and splits 'unit tests'**

- **Severity:** LOW
- **Verification:** reproduced independently on the live site (confirmed)
- **Where:** https://applyready.in/resume.html (Review > job description)
- **Description:** For a typical backend job advert, 3 of the 19 'key terms' are generic words: 'know' from 'Must know', 'unit' from 'unit tests', and 'juniors'. They appear under 'Not in your resume yet', which lowers the match score and prompts the user to add meaningless words. 'tests' alone was counted as covered because the sample mentions 'testing'.
- **Reproduction:** Load the sample. In the Review step paste: 'Software Engineer (Backend). Must know C++, C#, Node.js, React, AWS, Kubernetes, Docker, CI/CD, REST APIs and PostgreSQL. Experience with .NET and Go is a plus. You will design microservices, write unit tests and mentor juniors.'
- **Expected:** Only skill or role terms are listed, e.g. 'unit tests' as one phrase, with no 'know'.
- **Actual:** 'Not in your resume yet: … juniors, know, …, unit'; 'Already covered: … tests'.
- **Root cause:** js/keywords.js STOPWORDS (line 9) does not include common verbs such as 'know', and phrase detection does not keep 'unit tests' together.
- **Recommended fix:** Add common job-ad verbs and fillers (know, mentor, juniors, ability, etc.) to the stop list, and treat frequent two-word phrases (unit tests, problem solving) as one term.
- **Verification method:** Rerun scripts/review.js and check that the JD2 output has no 'know' or 'unit'.
- **Resolution in this round:** Fixed. Added job-ad verbs and filler words to the stop words: know, include, bonus, running, juniors, nice, want, offer, expect, exposure, e.g, i.e and others. Added a conservative list of two-word skills whose single words mean little on their own (unit tests, integration tests, a/b tests, version control, problem solving, machine learning, supply chain, customer service, ...). These count as a phrase even when they appear once and are compared by stem, so 'unit testing' in a resume matches 'unit tests'. 'mentor' is deliberately kept as a key term because it is a real skill.
- **Regression test:** New regression check runs the auditor's two adverts: no know/juniors/unit/tests/bonus/include/running terms, 'unit tests' is one term and is matched by 'unit testing'. Fails on the old code. The existing keyword checks still pass.
- **Fix verified by:** an independent verifier re-ran the original reproduction against the fixed build (resume package)

### RES-07

**Closing the whole browser within about 300 ms of the last keystroke may lose that edit (Playwright forced close only)**

- **Severity:** LOW
- **Verification:** reproduced independently on the live site (confirmed)
- **Where:** https://applyready.in/resume.html
- **Description:** Autosave waits 600 ms and also saves on pagehide/visibilitychange. Reload, navigation and tab close straight after typing all kept the text. But a forced close of the whole persistent browser context 0 ms or 300 ms after typing lost the last edit (kept at 1000 ms). Playwright's context close may not fire pagehide the way a user closing the window does, so this may not affect real users.
- **Reproduction:** scripts/quickclose.js: launchPersistentContext, type the summary, call ctx.close() at once, relaunch and open resume.html.
- **Expected:** The last edit survives closing the browser window.
- **Actual:** The summary was '' after relaunch at 0 ms and 300 ms delay, and kept at 1000 ms.
- **Root cause:** The IndexedDB write in flush() is asynchronous. A browser shutdown before the transaction commits drops it.
- **Recommended fix:** Optionally mirror unsaved changes synchronously to sessionStorage/localStorage on input and recover them on the next load, or shorten the debounce.
- **Verification method:** Close a real Chrome window with the X button right after typing, reopen and check the field.
- **Resolution in this round:** Fixed. On pagehide and visibilitychange-hidden, unsaved changes are now copied synchronously to localStorage under applyready_resume_unsaved:<id> just before the async IndexedDB save starts. The copy is removed as soon as the save completes. Nothing is copied while saving is off, while there is a conflict, or in a non-persistent session. On the next visit, recoverUnsaved() handles any copy left behind: if the stored record hasn't changed since the copy was made, the copy is written back; if a new resume was never stored, it is created; if the resume changed elsewhere, the copy is kept as a separate resume named '(unsaved changes)'. A copy of a resume that was deleted is dropped. Copies less than 3 s old are given time to clear in case another tab is still saving them. Other tabs are notified over BroadcastChannel. The new key is listed in privacy.html and docs/ARCHITECTURE.md.
- **Regression test:** resume_library_tests section 16: persistent profile, type, close the whole context immediately, relaunch. The last edit is kept, the copy is removed and no extra resume appears. With stashing disabled the same test fails ('The last edit before quitting the browser is kept').
- **Fix verified by:** an independent verifier re-ran the original reproduction against the fixed build (resume package)

### RES-09

**Job-description keyword match drops short technology names (Go, R, C) and turns '.NET' into 'NET', which is then counted as covered by the ordinary word 'net' (e.g. 'net revenue')**

- **Severity:** LOW
- **Verification:** reproduced independently on the live site (confirmed)
- **Where:** 
- **Description:** 
- **Reproduction:** On https://applyready.in/resume.html, call window.ApplyReadyKeywords.matchKeywords('Backend developer. Must have .NET, Go and R experience.', 'Grew net revenue by 12% in Excel.') in the live page (scripts/v05b.js). Alternatively, load the sample and paste the backend advert ('…Experience with .NET and Go is a plus…') in Review > job description (scripts/v05.js).
- **Expected:** '.NET', 'Go' and 'R' are kept as key terms when they appear in an advert, and '.NET' matches only '.NET' in the resume, not the word 'net'. A missing required skill should not be shown as covered.
- **Actual:** keywords = ['backend','developer','NET'] and found = ['NET']: '.NET' is reported as already in the resume because the resume says 'net revenue', and 'Go' and 'R' are not listed at all. In the live UI for the backend advert, 'Go' is missing from both lists and '.NET' appears as 'NET'.
- **Root cause:** 
- **Recommended fix:** 
- **Verification method:** 
- **Resolution in this round:** Fixed. The tokenizer now keeps a leading dot, so '.NET' stays '.NET'. It is matched only by .NET or a name ending in it (ASP.NET), never by 'net'. R, C, Go (only when not at the start of a sentence) and two-letter capital acronyms (AI, ML, QA, UX; not PM, UK, OK, EU and similar, and not stop words) are kept as terms. These short terms are matched case-sensitively in the resume, also inside slash groups such as C/C++, so 'go live' does not count as Go. After an independent check: Reproduced the problem: CV, HR and DL came out as key terms and were listed as missing. The cause was the RES-09 rule, which kept every two-letter capitalised word unless it was on a short stop list (eg, eu, ie, ok, pm, uk, vs). A stop list like that can never cover everything. I swapped it for an allowlist, SHORT_SKILLS: AI, ML, QA, QC, UI, UX, BI, AR, VR, CI, CD, JS, TS, RF. R, C and Go are handled the same way as before, and Go at the start of a sentence is still read as a verb. These capitalised words are still matched only when the resume uses the same capitals. Degree and qualification abbreviations (BA, MA, CA, CS) are left out on purpose, in line with the existing rule that degree words are not key terms. Results for the verifier's adverts: 'Send your CV to HR. Valid ID required...' gives Accounts Executive, MS Office, Valid ID, CTC, filing, GST, norms, send, tally (no CV or HR). The WhatsApp advert and the DL advert no longer give CV or DL. 'UI and UX ... QA, BI ... CI ... AI and ML' still keeps all seven acronyms. sw.js was regenerated because its content hash changed.
- **Regression test:** New regression check: the auditor's call keeps .NET/Go/R/AI/ML and lists .NET, Go and R as missing against 'net revenue ... go live'. They are found against 'ASP.NET Core and Go; analysis in R; C/C++'. 'Go to client sites' is not a term, and PM/UK/OK are not terms.
- **Fix verified by:** an independent verifier re-ran the original reproduction against the fixed build (resume package); the verifier raised a follow-up issue, which was then repaired

### SEC-03

**Image to PDF trusts the browser-reported type instead of the file contents (accepts SVG)**

- **Severity:** LOW
- **Verification:** reproduced independently on the live site (confirmed)
- **Where:** https://applyready.in/image-to-pdf.html
- **Description:** Every other tool identifies files by content (ApplyReadyFiles.sniff). Image to PDF filters on f.type.startsWith('image/'), which the browser derives from the extension. An .svg file (image/svg+xml) is accepted and rasterised into the PDF. A text file named .jpg gets only a generic 'could not be read as an image' message instead of 'is a plain text file'. No script ran, because the SVG is loaded via <img> from a data: URL, so this is a consistency and robustness issue, not code execution.
- **Reproduction:** On https://applyready.in/image-to-pdf.html choose inputs/evil.svg (an SVG with onload and a script). It is listed as a page, and Create PDF produces 'Document_1_Pages.pdf' (out/downloads/svg-to.pdf, 1,542 bytes). Choose inputs/html-as.jpg: the message is '"html-as.jpg" could not be read as an image…'. Script: scripts/sniff2.js and scripts/bomb3.js.
- **Expected:** Same content-based validation and messages as the other image tools (SVG and disguised files rejected by content).
- **Actual:** SVG accepted and converted. Disguised files rejected only after a failed decode, with a generic message.
- **Root cause:** js/image-to-pdf.js:168-169 filters by f.type rather than ApplyReadyFiles.validate(file, ['image']).
- **Recommended fix:** Validate each file with ApplyReadyFiles.validate (content sniffing, size and megapixel limits) as merge-pdf and batch do.
- **Verification method:** Re-run scripts/sniff2.js: evil.svg must be refused with 'is a plain text file' (or an SVG-specific message), and no page row must be created.
- **Resolution in this round:** Fixed. Image to PDF identifies files by content with ApplyReadyFiles.validate, then opens them with openImage. SVG and disguised files are refused, and the notice lists each file's reason ('logo.svg is a plain text file...'). PDFs are still pointed to Merge PDF. Files are checked in order, one choice after another, so page order is kept. Because intake is now async, robustness_tests.js got one waitForSelector before reading the notice. After an independent check: When the notice lists reasons, the trailing 'Choose JPG, PNG or WebP images.' is no longer added. Every reason source already says what to choose: ApplyReadyFiles.validate, the openImage damaged/too-large/too-small messages, and the measure fallback. Files without a known reason still get the general advice. In the single-file case the toast and the notice now both give just the one reason.
- **Regression test:** Section 19: SVG, truncated JPEG and bomb PNG are refused with reasons, only the two good images become pages and keep their order, and the PDF has 2 pages. The robustness_tests page-order and Merge PDF notice checks still pass.
- **Fix verified by:** an independent verifier re-ran the original reproduction against the fixed build (image package); the verifier raised a follow-up issue, which was then repaired

### SEC-04

**Windows reserved device names with more than one dot are not neutralised in ZIP entry names**

- **Severity:** LOW
- **Verification:** reproduced independently on the live site (confirmed)
- **Where:** https://applyready.in/batch-image.html (and other ZIP downloads using safeFileName)
- **Description:** safeFileName renames 'CON.jpg' to 'image_CON.jpg', but 'con.backup.jpg' stays unchanged in the batch ZIP. On Windows, a reserved name followed by any extension chain (CON.tar.gz, NUL.txt) refers to the device, so Explorer and older Windows versions fail to extract or create that entry. The browser sanitises top-level download names itself; entries inside a ZIP get no such protection.
- **Reproduction:** On https://applyready.in/batch-image.html add photo.jpg under the names 'CON.jpg' and 'con.backup.jpg' (scripts/tools.js batch step), Start, then Download all. unzip -l shows 'image_CON.jpg' and 'con.backup.jpg'.
- **Expected:** Any name whose part before the first dot is a reserved device name (CON, PRN, AUX, NUL, COM1-9, LPT1-9, including superscript digit variants) is prefixed, like CON.jpg.
- **Actual:** out/downloads/batch.zip contains the entry 'con.backup.jpg'.
- **Root cause:** js/lib/files.js:60 and 79: RESERVED is tested against the whole stem ('con.backup') instead of the segment before the first dot.
- **Recommended fix:** Test RESERVED against stem.split('.')[0].trim() (and add COM¹²³ / LPT¹²³ variants).
- **Verification method:** Re-run the batch step of scripts/tools.js and list the ZIP: 'con.backup.jpg' must become 'image_con.backup.jpg'.
- **Resolution in this round:** Fixed. safeFileName now tests RESERVED against the part before the first dot (trimmed) and covers the superscript forms COM¹²³ and LPT¹²³. So con.backup.jpg becomes image_con.backup.jpg, and NUL.tar.gz becomes image_NUL.tar.gz. Names like console.jpg and photo.con.jpg are unchanged.
- **Regression test:** Unit checks in tests/workspace_unit_tests.js. Block 3d2 also checks that the ZIP contains image_con.backup.jpg and image_NUL.tar.jpg.
- **Fix verified by:** an independent verifier re-ran the original reproduction against the fixed build (batch-cafe package)

### SEC-05

**Resume PDF link sanitiser treats tel:<digits> as host:port (phone links dropped or turned into https://tel:NNNNN/)**

- **Severity:** LOW
- **Verification:** reproduced independently on the live site (confirmed)
- **Where:** https://applyready.in/resume.html (Download PDF)
- **Description:** The PDF engine's sanitizeUrl treats any 'scheme:digits' value as host:port. 'tel:' followed by digits only (a phone number typed without '+') therefore becomes https://tel:<digits>/. If the number is above 65535 the URL is invalid and the link is silently dropped. If it is 5 digits or fewer, the PDF contains a clickable https://tel:NNNNN/ link to a non-existent host. The on-screen preview links the same numbers correctly as tel:.
- **Reproduction:** Import a valid backup with personal.phone '98765 43210' (scripts/tel.js, based on out/downloads/resume-export.json) and Download PDF: the PDF has only /URI (mailto:…), with no tel link. With '+91 98765 43210' the PDF has /URI (tel:+919876543210). In resume2.js, a phone value whose digits were '33331' produced /URI (https://tel:33331/) in out/downloads/evil-resume.pdf.
- **Expected:** tel: links in the PDF exactly as in the preview (tel:9876543210).
- **Actual:** No phone link for numbers without '+'. 'https://tel:33331/' for short numbers.
- **Root cause:** js/pdf-engine.js:265: the host:port regex /^[a-z][a-z0-9+.-]*:\d+(?:[/?#]|$)/ also matches 'tel:9876543210'. The phone URL is built at js/pdf-engine.js:722.
- **Recommended fix:** In sanitizeUrl, check for known schemes (mailto:, tel:) before the host:port heuristic, or skip sanitizeUrl for the URL built from the phone field.
- **Verification method:** Re-run scripts/tel.js: all three phone formats must yield /URI (tel:…) in the PDF, and no https://tel: URI may appear.
- **Resolution in this round:** Fixed. mailto: and tel: are now recognised as schemes before the host:port heuristic in the PDF sanitizeUrl, the preview's sanitizeHref and the DOCX registerHyperlink, so tel:9876543210 and tel:33331 are kept as tel: links. Unsafe schemes are still refused, and host:port websites still get https://. The Word export does not link phone numbers at all, which is unchanged existing behaviour; the test only checks that it never produces https://tel.
- **Regression test:** New regression check: both sanitisers return tel:/mailto: unchanged, and the PDF /URI list contains tel:<digits> for '98765 43210', '33331' and '+91 98765 43210' with no https://tel. Fails on the old engine.
- **Fix verified by:** an independent verifier re-ran the original reproduction against the fixed build (resume package)

### SEC-08

**Already-open home page tab keeps showing a resume name after 'Delete everything'**

- **Severity:** LOW
- **Verification:** reproduced independently on the live site (confirmed)
- **Where:** https://applyready.in/ (home) with https://applyready.in/your-data.html in another tab
- **Description:** After 'Delete everything' in one tab, an already-open home-page tab still lists the deleted resume by name until it is reloaded. The resume builder tab handles this and says the resume was deleted. Storage itself is fully cleared, so this is a stale display on shared computers, not retained data.
- **Reproduction:** scripts/multitab.js: tab A resume.html with name 'Tab A Person TABAMARKER', tab C home page, tab B your-data.html → Delete everything. Tab C's body text still contains TABAMARKER.
- **Expected:** Open ApplyReady tabs that show saved resumes (home 'continue' list) clear them when the deletion broadcast arrives.
- **Actual:** homeText: true after deletion (out/multitab.json).
- **Root cause:** js/home.js renders saved resumes once and does not subscribe to the deletion message that your-data.js sends (postDeleted) to resume builder tabs.
- **Recommended fix:** Have home.js listen on the same BroadcastChannel and re-render, or clear the list, on 'deleted'.
- **Verification method:** Re-run scripts/multitab.js: homeText must be false after deletion.
- **Resolution in this round:** Fixed. js/home.js now listens on BroadcastChannel 'applyready-resumes'. On 'deleted' it removes the card at once without opening IndexedDB, so it cannot hold up Your data's deleteDatabase. 'saved' and 'renamed' messages trigger a debounced re-read. A storage event re-renders the recently used list when it is cleared or switched off in another tab. Rendering was refactored so an empty result clears the list.
- **Regression test:** robustness_tests.js section 7: a home tab lists the seeded resume and a recent tool; a rename in another tab shows the new name; after Delete everything on Your data in another tab, no name or recent tool is left and the section is hidden. With the old home.js the rename step times out.
- **Fix verified by:** an independent verifier re-ran the original reproduction against the fixed build (site package)

### SEO-02

**404 redirect map does not redirect extensionless URLs of moved guides**

- **Severity:** LOW
- **Verification:** reproduced independently on the live site (confirmed)
- **Where:** https://applyready.in/guides/image-dimensions-vs-file-size (and the other two MOVED entries without .html)
- **Description:** GitHub Pages serves foo.html at /foo, so old links and shares often have no extension. js/not-found.js tries to support that with MOVED[path.replace(/\.html$/, '')], but every MOVED key ends in '.html', so the second lookup can never match. An old extensionless link to a moved guide shows a generic 'Page not found' instead of going to the new guide. The same happens with the REMOVED patterns, which all require '.html'.
- **Reproduction:** Open https://applyready.in/guides/image-dimensions-vs-file-size in Chromium. Compare with https://applyready.in/guides/image-dimensions-vs-file-size.html, which redirects to /guides/pixels-cm-inches-dpi-explained.html. Script: scripts/notfound.js; output in notfound-check.log.
- **Expected:** The extensionless old address redirects to /guides/pixels-cm-inches-dpi-explained.html like the .html form does.
- **Actual:** Status 404; the page stays at /guides/image-dimensions-vs-file-size with the title 'Page not found' and no suggestion links.
- **Root cause:** js/not-found.js line 46: `const movedTo = MOVED[path] || MOVED[path.replace(/\.html$/, '')];` strips '.html' from the path instead of adding it, while the keys include '.html'. REMOVED regexes such as /^guides\/aadhaar-pan-passport-photo-specifications\.html$/ also require the extension.
- **Recommended fix:** Normalise once: `const key = /\.html?$/.test(path) || path.endsWith('/') ? path.replace(/\.htm$/, '.html') : path + '.html';` then look up MOVED[key] and test REMOVED against key. Add test cases for extensionless forms in tests/navigation_tests.js.
- **Verification method:** Open /guides/image-dimensions-vs-file-size, /guides/compression-targets-guide and /editorial-policy without .html: the first two must land on their new guides and the last must show 'This page was removed'.
- **Resolution in this round:** Fixed. js/not-found.js now turns the address into a .html key: trailing slashes are stripped, .htm becomes .html, and .html is added when there is no extension. MOVED is looked up with that key, and REMOVED is tested against both the key and the original path.
- **Regression test:** robustness_tests.js: /guides/image-dimensions-vs-file-size and /guides/compression-targets-guide/ redirect to their new guides. /editorial-policy and /guides/aadhaar-pan-passport-photo-specifications show their removed-page messages.
- **Fix verified by:** an independent verifier re-ran the original reproduction against the fixed build (site package)

### SEO-03

**Old 'ApplyReady.in' branding left in resume PDF/DOCX metadata, code headers and SEO doc**

- **Severity:** LOW
- **Verification:** reproduced independently on the live site (confirmed)
- **Where:** https://applyready.in/resume.html (downloads)
- **Description:** The site brand is 'ApplyReady' everywhere visible, and other tools write 'ApplyReady (pdf-lib)' or 'ApplyReady Text to PDF' into their PDFs. The resume builder's downloads still carry the old 'ApplyReady.in' branding in file properties that recruiters and ATS software can see. The same old name is in the header comments of js/docx-engine.js, js/pdf-engine.js, js/passport-photo-print.js, js/presets.js and js/resizer.js, and in the title of docs/SEO_SETUP.md ('# ApplyReady.in - SEO & Search Console Setup Guide').
- **Reproduction:** On https://applyready.in/resume.html type a name and a headline, open Download and download the PDF and Word files. Run `pdfinfo Test_Applicant_Clerk_Resume.pdf` and `unzip -p Test_Applicant_Clerk_Resume.docx docProps/app.xml`. Script: scripts/resumemeta.js.
- **Expected:** Creator/Producer/Application should read 'ApplyReady Resume Builder' / 'ApplyReady', the same as the other tools.
- **Actual:** PDF: 'Creator: ApplyReady.in Resume Builder', 'Producer: ApplyReady.in'. DOCX app.xml: '<Application>ApplyReady.in Resume Builder'.
- **Root cause:** Hard-coded strings in js/pdf-engine.js:436 and js/docx-engine.js:311 were not updated in the rebranding. tests/content_tests.js looks at page HTML only, not at engine strings.
- **Recommended fix:** Replace them with 'ApplyReady Resume Builder' / 'ApplyReady'. Update the header comments and the docs/SEO_SETUP.md title. Optionally add a content test that fails on 'ApplyReady.in' outside URLs.
- **Verification method:** Download the resume PDF and DOCX again and check them with pdfinfo and unzip -p docProps/app.xml. `git grep -n 'ApplyReady\.in'` should return only URLs.
- **Resolution in this round:** Fixed. PDF Creator and Producer now read 'ApplyReady Resume Builder' and 'ApplyReady'. DOCX app.xml Application now reads 'ApplyReady Resume Builder'. Removed the 'ApplyReady.in' header comment line from the engines, the four image scripts and run_tests.js, and from the docs/SEO_SETUP.md title.
- **Regression test:** run_tests suite 17 checks the PDF info strings and the DOCX app.xml, and fails if 'ApplyReady.in' (except in the content test's own regex and message) appears in any js, scripts, docs or tests file.
- **Fix verified by:** an independent verifier re-ran the original reproduction against the fixed build (resume package)

### SEO-04

**docs/PROGRESS.md says nothing has been deployed although the site is live from this commit**

- **Severity:** LOW
- **Verification:** reproduced independently on the live site (confirmed)
- **Where:** docs/PROGRESS.md (also served at https://applyready.in/docs/PROGRESS.md)
- **Description:** The 'Current state (18 Nov 2026)' section says 'Nothing has been deployed: publishing is an owner decision'. 'Verification' says the GitHub Actions workflow was not run ('nothing has been pushed to a pull request'), and Owner action 5 says 'All of this is on the development branch ... then merge to main to publish'. In fact commit 92f7ef0 was merged as PR #16 and is what https://applyready.in serves. Contributors and the owner are misled about the project's state. Smaller stale figures are also there: Phase 0 says the icon fonts were reduced to 5 KB, but they are now 12.4 KB (fa-solid 8,532 B + fa-regular 3,840 B).
- **Reproduction:** Read docs/PROGRESS.md lines 6-10, 61-63 and 220-222. Then compare with `git log -1` (92f7ef0 '... (#16)') and with the live pages, which are byte-identical to the checkout.
- **Expected:** PROGRESS.md records that the work was merged and deployed, and that CI runs on main.
- **Actual:** It says nothing is deployed, CI has never run on a PR, and publishing is pending.
- **Root cause:** The progress file was written on the development branch before the merge and was not updated afterwards.
- **Recommended fix:** Update 'Current state' and 'Owner actions' (mark item 5 done; the licence, AdSense and logo items remain). Refresh the measured figures, or date them explicitly.
- **Verification method:** Re-read docs/PROGRESS.md after the edit and check it is consistent with git history and the live site.
- **Resolution in this round:** Fixed. docs/PROGRESS.md now records the merge as #16 (commit 92f7ef0) and the publication on applyready.in. It notes that the workflow runs on pull requests and on main, without claiming a result I could not see. Owner action 5 is marked done, with a note that a real iPhone/Safari test is still worth doing. The 5 KB icon figure is dated, and the size at release (12.4 KB) is added. docs/ARCHITECTURE.md section 5 now describes the offline shell and VENDOR_ASSETS.
- **Regression test:** Re-read against git log and the workflow triggers in .github/workflows/quality.yml.
- **Fix verified by:** an independent verifier re-ran the original reproduction against the fixed build (site package)

### SEO-05

**Regular icon font is not cached for offline use, so regular-style icons disappear offline**

- **Severity:** LOW
- **Verification:** reproduced independently on the live site (confirmed)
- **Where:** https://applyready.in/offline.html and any visited tool page used offline (e.g. passport-photo-resizer.html)
- **Description:** css/webfonts/fa-regular-400.woff2 is requested only when a regular-style icon is first painted. On the offline fallback page, and on a visited tool page after you add a file (the file bar uses fa-regular), that font has not been cached, so the request fails offline and the icon is blank. For example, the 'Open the resume builder' button on the offline page has no icon.
- **Reproduction:** Visit https://applyready.in/passport-photo-resizer.html (or only the home page) online, go offline and reload. Add a photo, or open any uncached URL to get offline.html. The console shows 'FAILED https://applyready.in/css/webfonts/fa-regular-400.woff2 net::ERR_FAILED'. Scripts: scripts/offline3.js and scripts/offline.js.
- **Expected:** Fonts that the shell stylesheet needs are cached with the page, so icons render offline.
- **Actual:** fa-regular-400.woff2 fails offline, and the icon before 'Open the resume builder' on the offline page is missing.
- **Root cause:** sw.js caches on install only /offline.html. Pages are cached as they are fetched, and the first page posts its loaded resources. A lazily requested webfont (only fetched when a glyph is painted) is never among them.
- **Recommended fix:** Add /css/webfonts/fa-regular-400.woff2 and fa-solid-900.woff2 (12 KB in total) to the install-time cache with /offline.html, or preload both fonts in the shell so the first page's resource list includes them.
- **Verification method:** Repeat the offline reproduction. No failed woff2 request should appear, and the offline page should show all four button icons.
- **Resolution in this round:** Fixed. An OFFLINE_SHELL list (js/offline.js, fa-solid-900.woff2, fa-regular-400.woff2, about 15 KB) is generated into sw.js. keepOfflineShell() caches it at install, and again when the offline page is re-fetched after the offline copy is removed. It is optional and does not fail install. build-sw.js fails the build if a shell file is not part of the site's files. Visited tool pages now get the regular font from the cache offline too.
- **Regression test:** robustness_tests.js: the first visit downloads only offline.html plus the shell (under 60 KB, path list asserted), the shell is in the cache, and both icon fonts load offline.
- **Fix verified by:** an independent verifier re-ran the original reproduction against the fixed build (site package)

### LIVE-03

**Donation link appears twice on About, Contribute and Philosophy**

- **Severity:** INFORMATIONAL (auditor rated LOW)
- **Verification:** reproduced independently on the live site (confirmed-different-severity)
- **Where:** https://applyready.in/about.html, https://applyready.in/contribute.html, https://applyready.in/philosophy.html
- **Description:** The audit brief requires exactly one link to https://pages.razorpay.com/support-applyready per page. Three pages carry two: the footer 'Support ApplyReady' link and a 'contribute voluntarily' link in the page text. README.md also speaks of 'the single donation link'. CONTRIBUTING.md lines 13-14 do say the link lives in the footer, About, Philosophy and Contribute, so this appears intended by the project, but it does not meet the 'one per page' rule. The in-text links also open in the same tab (no target=_blank), unlike the footer link.
- **Reproduction:** grep -c 'pages.razorpay.com/support-applyready' on about.html, contribute.html and philosophy.html returns 2. In the sweep, data.razorpay in scratchpad/audit/live-sweep/sweep1.json lists 2 entries for these pages and 1 for every other page.
- **Expected:** Exactly one donation link per page, as the brief requires.
- **Actual:** Two on each of these three pages. No popups or dialogs anywhere: the click test opened one tab and fired no dialogs.
- **Root cause:** about.html line 188, contribute.html line 187 and philosophy.html line 179 add an inline link on top of the shared footer link.
- **Recommended fix:** The owner should decide which rule applies. To meet 'one per page', change the inline sentences to point to the footer link (or to philosophy.html#funding) instead of repeating the Razorpay URL. Otherwise, update the brief and README to say 'footer plus About, Philosophy and Contribute'.
- **Verification method:** Count Razorpay links per page in the built HTML (grep -c) and in the rendered DOM; every page shows 1.
- **Resolution in this round:** Declined. Declined: this is intended and documented. CONTRIBUTING.md says the single donation link (one destination URL) appears in the footer and on the About, Philosophy and Contribute pages, and the verifier rated it info. The task rules also say the donation link and its wording must not be changed. Removing the in-text links would silently remove a documented feature. Making them open in a new tab is cosmetic and was left alone.
- **Fix verified by:** an independent verifier re-ran the original reproduction against the fixed build (site package)

### NAV-07

**'Most used' and 'Popular tools' labels suggest usage tracking on a site that says it has no analytics**

- **Severity:** INFORMATIONAL (auditor rated LOW)
- **Verification:** reproduced independently on the live site (confirmed-different-severity)
- **Where:** https://applyready.in/ ('Most used' section) and the empty search dialog ('Popular tools')
- **Description:** The home page shows a 'Most used' list and the empty search dialog says 'Popular tools'. The site promises 'No ads, no tracking … no analytics'. A privacy-conscious first-time visitor may reasonably ask how ApplyReady knows what is most used. In fact the list is a fixed editorial order (the `popular` field in scripts/lib/tools.js), so the label is misleading and undermines the trust message a few hundred pixels below it ('Built to be trusted').
- **Reproduction:** Open https://applyready.in/ and read the 'Most used' heading (y≈1229 at 1280). Press / and see 'Popular tools'.
- **Expected:** A label that does not imply measurement, e.g. 'Common tasks' or 'Start here'.
- **Actual:** 'Most used' / 'Popular tools'. index.html:255 and js/search.js render() heading.
- **Root cause:** Hard-coded headings in index.html (homePopularTitle) and js/search.js ('Popular tools'), backed by a static `popular` rank.
- **Recommended fix:** Rename both to 'Common tasks' (or similar), or add a note that the order is chosen by the maintainers, not measured.
- **Verification method:** Check the home page and the empty dialog headings.
- **Resolution in this round:** Fixed. The home heading 'Most used' and the empty search dialog's 'Popular tools' both now read 'Common tasks'. The registry and search comments say the order is chosen by hand and nothing is measured.
- **Regression test:** navigation_tests.js checks the heading text and that 'Popular tools' and 'Most used' are gone.
- **Fix verified by:** an independent verifier re-ran the original reproduction against the fixed build (site package)

## 8. Navigation and usability

**What works.** Every task tried (resume, resizer, compressor, signature, merge, batch, passport photo, "photo under 50 KB", "combine certificates", workspaces) is reachable from the home page in 1 to 3 clicks or taps. Breadcrumbs on all 24 tool pages name the right category. Category order is the same in the header menu, the phone menu, the home page, the directory and the footer. Search answers in about 1 ms per query, and its combobox works fully from the keyboard ("/" and Ctrl+K open it, arrows move, Enter opens, Escape closes and returns focus). The home page is not a giant catalogue: 2,364 px tall at 1280 px wide, with every category heading within 173 px of scrolling. No page scrolls sideways at 320, 360 or 1280 px.

**Problems found, and their impact:**

| ID | Problem | Impact on a real person |
|---|---|---|
| NAV-01 | Search ignored numbers with units ("pdf 300kb", "signature 10kb"). | Enter opened Merge PDF or Signature cleaner instead of the compressor or resizer the person needed. |
| NAV-02 | Hinglish verbs ("chota karna", "jodna", "milana") were ignored. | People who search in Hinglish landed on the wrong tool. |
| NAV-05 | Common words (aadhaar, marksheet, thumb impression) found nothing, and unsupported requests ("unlock pdf", "dark mode") returned unrelated tools. | Dead ends or misleading results. |
| NAV-04 | On phones, Resume builder sat inside a one-item accordion. | The main tool took 3 taps from any page. |
| NAV-06 | A trailing-slash URL (/merge-pdf/) gave a bare 404. | Shared or mistyped links failed with no suggestion. |
| NAV-07 | "Most used" and "Popular tools" labels. | They suggest usage tracking on a site that has no analytics. |
| NAV-03 (suggestion) | Privacy and Your data are only in the footer: 3,100 to 4,650 px down on a phone. | Finding how to delete data takes long scrolling. Left as a suggestion. |

## 9. Security and privacy

**Verified safe on the live site:**
- No file or typed data leaves the browser. A Chromium net-log over 29 runs that used every tool with real files recorded 2,611 page-initiated requests: all GET, all to applyready.in (apart from the auditor's own two probes), none carrying file bytes or user data. No POST or PUT, no cookies, and no third-party origin contacted. Razorpay is reached only when its link is clicked.
- All 67 pages carry the same strict Content Security Policy meta tag. There are no inline scripts or handlers, and every `target="_blank"` link has `noopener`.
- Browser storage matches the table on privacy.html exactly. "Delete everything" on Your data removes the database, settings, caches and the service worker. With resume saving turned off, nothing typed is stored.
- More than 100 XSS payloads, in file names, 55 resume fields, imported JSON, EXIF, PDF and DOCX metadata, workspace names, text to PDF, search, URL parameters, the hash and 404 paths: none was injected or executed.
- Zip bombs (1 GB), 70,000-entry archives, path-traversal entries, 100,000-deep nested PDFs and JavaScript inside PDFs were handled safely, the file checker finishing in 0.3 s.
- Vendored libraries are current: pdf.js 6.5.438, past the CVE-2024-4367 fix, with no eval. `npm audit` reports 0 vulnerabilities, and the licences are compatible with AGPL-3.0.

**Defects:**
- SEC-01 (medium): the meta-tag CSP does not cover Web Workers, so code inside the pdf.js or image worker could reach any site. No code does this today, but privacy.html claimed the policy blocks it.
- SEC-02 (medium): four tools (Image to PDF, passport print sheet, signature cleaner, and Compress PDF with image input) fully decoded huge images. One 380 KB PNG raised browser memory by about 2 GB.
- SEC-03 to SEC-05 and SEC-08 (low): Image to PDF trusted the browser-reported type; Windows device names with several dots were not neutralised in ZIP entry names; phone links in resume PDFs were mangled; an already-open home tab kept showing a resume name after "Delete everything".

**Limits of what a static site can do (SEC-07):** GitHub Pages cannot send HTTP security headers such as a header CSP, `X-Frame-Options`, `frame-ancestors` or HSTS preload. So any site can frame ApplyReady (SEC-06, a suggestion). This is recorded as a hosting limitation, not hidden.

## 10. Performance and compatibility

Measured on the live site with Chromium and the Chrome DevTools Protocol.

| Profile | Result |
|---|---|
| Desktop broadband, cold load | 117–235 KB compressed in 10–24 requests per page; FCP about 0.5 s; CLS 0.008 or less; 0 long tasks |
| Desktop with 4x CPU throttling | FCP 0.54–0.75 s; at most 1 long task (81 ms) |
| 360 px, slow 4G (150 ms, 1.6 Mbps) | FCP = LCP 1.2 s (Compress PDF) to 1.8 s (Resume builder); CLS 0 |
| 360 px, slow 4G, 4x CPU | FCP 1.4–2.0 s; at most 2 long tasks, max 129 ms; TBT at most 79 ms |
| First PDF action on slow 4G | 4.8–5.0 s to download the PDF libraries (402 KB plus the pdf.js worker), once; cached afterwards |

| Task | Desktop | Pixel 7 emulation at 4x CPU |
|---|---|---|
| 12 MP photo to passport photo | decode 0.14–0.23 s, process 0.08–0.18 s | 0.9 s, 0.67 s |
| Merge 10 PDFs (30 pages) | 0.12 s | 0.33 s |
| Compress a 20-page 8 MB scan to 1,000 KB | 4.4 s | 9.0 s |
| Batch of 50 photos (6.75 MP) | 2.3 s | 3.9 s |

Memory: the image tools and the batch tool kept heap and object URLs stable over repeated runs; all object URLs were revoked. The exception was PA-01 (HIGH): every PDF opened by a PDF tool started a pdf.js worker that was never shut down. Adding 50 PDFs to Merge left 51 workers and used 1.5 GB of renderer memory, and repeated use reached 2.7 GB. The root cause was that `closeJs` called `doc.destroy()`, which pdf.js 6.5 no longer has, and the error was swallowed.

Offline: visited pages and the image tools work offline. PA-02, PA-03, LIVE-01, SEO-01 and SEO-05 cover the gaps: the whole-site offline copy left out the PDF libraries, and the offline page promised more than the service worker does.

Compatibility: only Chromium could be run (see section 3). Reading the source for Safari and Firefox risks found uses of CSS `:has()` without fallbacks, among others; these are listed as unverified in PA-10. A real-device check on iPhone Safari and on Firefox remains an owner action.

## 11. Accessibility

Target: WCAG 2.2 AA.

**Automated:** axe-core, set to the WCAG 2.0, 2.1 and 2.2 A and AA rules plus best practice, ran on all 67 pages in light and dark themes at 1280 px and 360 px (268 runs), and on 16 tool states such as open dialogs, results and the workspace. The only violations were:
- `scrollable-region-focusable` on 8 guide charts at 360 px (PA-07);
- a target-size note on the 18x18 px "Show password" checkbox. The verifier judged this not a defect: WCAG 2.5.8 is met because its label is part of the target (PA-06).

The project's own browser suite also runs axe on every page in CI.

**Manual:**
- Keyboard walkthroughs passed for search, merge (reorder, the confirm dialog, the password dialog with focus trapped), batch with Cancel, the workspace applicant flow, and resume from create to PDF download.
- In the image resizer, focus dropped to the page body after an image was chosen with the keyboard (PA-05).
- Headings, landmarks, `lang`, the skip link, `prefers-reduced-motion`, 200% zoom, 320 px reflow (400%), 1.4.12 text spacing, landscape phones and colour contrast in both themes all pass.
- Font sizes are in px, so a browser's text-size-only setting has no effect; page zoom works. This is recorded as suggestion PA-08.

**Not done:** testing with real screen readers (NVDA, JAWS, VoiceOver, TalkBack).

## 12. SEO

SEO is in good shape on the live site:
- All 65 sitemap URLs exactly match the indexable pages.
- Titles (25–65 characters) and meta descriptions (128–160 characters) are all unique.
- Canonicals are absolute https and self-referencing.
- Open Graph and Twitter tags are complete, and the 1200x630 og:image loads.
- Every JSON-LD block parses, with no fake ratings or reviews. The FAQ text matches its FAQPage data (149 of 149 items), and the breadcrumbs match their BreadcrumbList data on all 55 pages that have them.
- There are no orphan pages, no broken internal links and no hreflang leftovers. Missing pages return a real 404, with redirects for removed exam pages and moved guides.
- Near-duplicate content is low: at most 0.24 Jaccard similarity between any two pages.

Defects:
- SEO-02 (low): the 404 redirect map did not catch extensionless URLs of moved guides.
- SEO-01 (medium), which is the same issue as LIVE-01: copy on the offline page promised offline access that the site does not give.

Suggestions not acted on as defects: SEO-06 (redirects are JavaScript on a 404 response, which is a GitHub Pages limitation), SEO-08 (no BreadcrumbList on the trust pages).

## 13. Documentation

Documentation was followed literally. The README's `npm ci`, `npm test` and `npm run test:browser` steps all pass, and every generator is idempotent. All 9 step-by-step tutorials were followed on the live site (208 checks pass). All 70 tutorial screenshots (35 desktop, 35 phone) were regenerated from the live site and match the committed images, except for timing-dependent pixels. The guides' measured numbers were reproduced exactly on the live resizer, for example 46.13, 48.68 and 48.07 KB, and 18.49 KB for WebP. LICENSE is the official AGPL-3.0 text.

The repository was searched for leftovers:
- **Ads and analytics:** none.
- **Exam names and "sarkari":** none.
- **Paid, premium, subscribe, upgrade, pricing or trial wording:** none. Every hit is a "no ads" statement or a guard.
- **TODO, FIXME, placeholder or lorem:** none.

Defects:
- SEO-03 (low): the old "ApplyReady.in" branding was still in resume PDF and DOCX metadata, in code headers and in an SEO doc.
- SEO-04 (low): docs/PROGRESS.md said the site was not deployed.
- LIVE-04 (low): the privacy page said "two links lead elsewhere" when there are 46 external links.
- Several pages repeated the offline promise (SEO-01).

Suggestions:
- SEO-07: the sample resume uses the real email.com domain.
- SEO-09: CONTRIBUTING says "no inline style attributes", but generated pages contain 38.

## 14. Suggestions (not defects)

These were raised by auditors as improvements, not as wrong behaviour. They were not counted as defects and most were not changed in this round.

- **LIVE-05** (INFORMATIONAL): Razorpay donation page: wording notes for the owner (page content left unchanged by choice). The page loads (200) and its wording matches the site: 'free, open-source', 'You don't need to pay to use ApplyReady. Everything will remain free, forever.', and the terms say contributions are voluntary, do not unlock features and are not a purchase. Points for the owner: (1) the payee header reads 'Sumit Sengar' with an 'nb' logo while the text is signed '— Team ApplyReady', which may make a visitor wonder whether they reached the right page; (2) a personal phone number is published under 'Contact Us'; (3) the Razorpay template uses 'Payment Details' and a 'Pay ₹ 0.00' button rather than 'contribute'; (4) email and phone are mandatory fields, which is Razorpay's requirement but worth knowing for a privacy-first project; (5) the page sets viewport 'user-scalable=no, maximum-scale=1', which blocks pinch-zoom on phones (Razorpay template); (6) there are no suggested amounts.
- **LIVE-06** (INFORMATIONAL): Guessed exam URL /upsc-photo-size.html shows the generic 'Page not found' instead of the 'page was removed' note. Real removed exam URLs (ssc-, upsc-, rrb-, ibps-, neet-photo-signature-size.html, with or without /hi/) all get the 'This page was removed' note with links to the resizers. /upsc-photo-size.html never existed (git history shows only *-photo-signature-size.html pages), so it gets the generic 404. That page still offers search and the main tools. Likewise /hi/ has the generic text. A visitor arriving from an old bookmark or search result for a portal photo size would get a clearer answer from the 'removed' note.
- **RES-06** (INFORMATIONAL): A long single bullet is moved whole to the next page, leaving about a third of the previous page blank. Bullets are kept together when they fit on a page, so a 21-line bullet started near the bottom of page 1 is moved entirely to page 2. Page 1 ends at y=579 of about 803 usable pt (about 28% blank). This is by design and only shows with unusually long bullets, but it looks like a layout error.
- **RES-08** (INFORMATIONAL): Imported achievement 'text' and publication 'citation' are stored but never printed when a title is also present. The schema keeps achievements {title, text} and publications {title, citation}, and both survive backups. But the editor, PDF, DOCX and TXT show only `title || text` and `title || citation`. A hand-made or third-party JSON with both fields loses the second one from every output without notice. The app's own UI never produces both, so ordinary users are not affected.
- **IMG-10** (INFORMATIONAL): Suggestion: JPEG→PNG conversion writes an unused alpha channel; resizer's 64 MP limit differs from the documented 50 MP. Converting an opaque JPEG to PNG produces an RGBA PNG (e.g. 640x480 = 706,366 B; the EXIF-6 phone photo = 25.3 MB). Writing RGB when the source has no alpha would cut the size by about 25%. Separately, the resizer accepts up to 64 MP (a 60 MP image worked) while the documented per-image cap and the batch tools use 50 MP. This is harmless, but the stated limits are inconsistent.
- **PDF-08** (INFORMATIONAL): PDF to image files carry no DPI information. Pixel sizes match the chosen DPI exactly, but the JPEG/PNG files have no density metadata: identify reports 72x72, units undefined. A 300 DPI export prints or reports as 72 DPI in apps and in portals that read the DPI field.
- **PDF-09** (INFORMATIONAL): Damaged-file wording inconsistent in File checker for truncated PDFs. in/truncated.pdf (cut in half) appears as a 5-page A4 PDF with only a 'Check: end marker missing' note. Every PDF tool refuses it as incomplete, and poppler cannot read its xref.
- **BAT-07** (INFORMATIONAL): Numbering in order skips the numbers of failed rows. With 'Number them in order', numbers come from each row's position, including failed rows. A batch whose 1st and 3rd files failed gives image-002.jpg and image-004.jpg only, so the ZIP has gaps. This may be intended (numbers match list rows), but an operator expecting 001 to N may be confused.
- **BAT-08** (INFORMATIONAL): KB limits use 1024 bytes; outputs like 204,696 B for 'under 200 KB' could fail portals that count 1000. A maximum of 200 KB is applied as 204,800 bytes. Outputs land just under that (for example 204,696 and 204,761 bytes), which is above 200,000. A portal that counts 1 KB as 1000 bytes would reject them. Rows do show the exact byte count, which helps.
- **CAF-05** (INFORMATIONAL): Pasting a picture while the cursor is in the Applicant name field does nothing, with no message. After typing a name, an operator who presses Ctrl+V to paste a screenshot or copied photo gets nothing: no file is added and no message is shown. The paste handler ignores paste events whose target is an INPUT so that text paste keeps working.
- **CAF-06** (INFORMATIONAL): Finish confirmation can say 'not downloaded / task will be stopped' after the ZIP has already downloaded. If Finish is clicked while a ZIP is being prepared, the dialog text is fixed at that moment. The ZIP can then finish and download while the dialog is still open, so the dialog's warning ('1 of 1 result ... has not been downloaded ... 1 running task will be stopped') becomes wrong. No data is lost, but the operator may think the ZIP was cancelled and download it again.
- **NAV-03** (LOW): Privacy and 'Your data' (where you delete data) are absent from the header and phone menu; on a phone they are 3,100–4,650 px down. Privacy is the site's main promise, and deleting your data matters most on shared or cyber cafe computers. Yet neither the desktop header (Tools, Resume builder, Guides) nor the phone menu (Search tools, 6 categories, All tools, Guides) links to Privacy or Your data. Without search, a phone user must scroll 3,119–3,619 px to 'How your data is handled' or 4,147–4,647 px to the footer's 'Your data' link. The footer label 'Your data' also does not suggest that this is where you delete things. Search does find both pages: 'delete my data' gives Your data first.
- **NAV-08** (INFORMATIONAL): Tools listed under two categories inflate menus and the directory (26 entries for 21 tools). Image compressor and Image converter appear under both Image tools and Batch processing. Batch image processor appears under Image tools and Batch. Text to PDF and Extract text from PDF appear under both PDF tools and Document tools. The category counts (1+8+10+3+3+1=26) and the desktop menu's 32 links describe 21 distinct tools, and the phone directory is 5,366 px tall. People scanning the list see the same names twice and may wonder whether they are different tools. 'Batch processing (3)' mostly re-lists single-image tools.
- **NAV-09** (INFORMATIONAL): Polish: home search placeholder truncated on phones; Compress PDF hidden behind '6 more' on the home PDF card; no off switch beside 'Pick up where you left off'. (a) At 360 px the home search placeholder is cut to 'What do you need to do? e.g. compr' (shots/home-phone-fold.png). (b) The home PDF card shows Merge, Split, Organise and Image to PDF, and hides Compress PDF, a top-6 tool, behind '6 more pdf tools'. It is still reachable via the hero and Most used. The card order is registry order, not popularity. (c) On a shared computer the home page shows the previous person's 'Pick up where you left off' tools with no link to clear or turn this off. The control exists only on your-data.html.
- **SEC-06** (INFORMATIONAL): Any website can frame ApplyReady pages (no frame-ancestors / X-Frame-Options). frame-ancestors is ignored in a meta CSP and GitHub Pages sends no X-Frame-Options, so other origins can embed the site. I framed your-data.html (with the 'Delete everything' button) from a local http://127.0.0.1 page. Impact is limited: Chromium partitions third-party storage, so a framed copy does not see the user's real resumes, and deletion needs two clicks. A clickjacking setup would still be possible against browsers without storage partitioning.
- **SEC-09** (INFORMATIONAL): Resizer shows file names with hidden right-to-left characters unmodified. A file named 'invoice‮gpj.exe.jpg' is displayed in the resizer's file info exactly as named, so the visible text order is spoofed. The file checker detects and explains this, and the download name replaces the character with '_' (invoice_gpj.exe_Passport_Photo_350x450.jpg). Other tools could display names through Files.withoutHiddenDirection for consistency.
- **SEC-10** (INFORMATIONAL): File checker does not flag a person's name stored in image EXIF/XMP. For PDFs and DOCX the checker shows a Privacy notice for author names. For photos it flags GPS but not EXIF Artist or XMP dc:creator, which also identify a person. 'Remove metadata' does strip them (verified), so this only affects the warning.
- **SEC-11** (INFORMATIONAL): After 'Delete everything', opening the resume builder recreates an empty database. After deletion, simply opening resume.html recreates IndexedDB 'applyready' (empty meta and resumes stores) and applyready_recent_tools, and the service worker re-registers and re-caches pages. The completion message mentions only pages being cached again. Nothing personal is recreated.
- **PA-08** (INFORMATIONAL): Font sizes are in px, so the browser's text-size setting has no effect. All type tokens are absolute px (--fs-md: 15px, --fs-read: 17px, --fs-xl: 19px). Raising the root font size to 200%, which is what a larger default font size in the browser or Firefox's text-only zoom does, leaves the text unchanged. Browser page zoom works (200% zoom and 320px reflow pass), so this does not fail WCAG 1.4.4. But low-vision users who rely on the browser's font-size setting rather than zoom get no benefit.
- **PA-09** (INFORMATIONAL): Batch Cancel silently ignores a keyboard press within 450 ms of Start. This is intentional. It stops a repeated Enter meant for Start from landing on Cancel, which receives focus. But a deliberate keyboard press on Cancel within 0.45 s is dropped without feedback: with Enter at 150 ms and at 300 ms the batch kept running and finished all 50, while a mouse click cancels at once.
- **SEO-06** (INFORMATIONAL): Moved guides are redirected only by JavaScript on a 404 response, and redirect stubs mix noindex with a cross-page canonical. Old guide URLs (MOVED in js/not-found.js) return HTTP 404 and are redirected client-side, so search engines drop them without passing their signals to the new page. The KB stubs instead combine meta robots noindex,follow, rel=canonical to resize-image-to-kb-limit.html and a 0-second meta refresh. Search engines advise against combining noindex with a canonical that points elsewhere, because the signals conflict. Users are not affected.
- **SEO-07** (INFORMATIONAL): Sample resume data uses the real email.com domain and plausible social handles. 'Try a sample' fills alex.morgan@email.com and linkedin.com/in/alexmorgan. The student sample in js/resume.js:211-215 uses ananya.rao@email.com, +91 98765 43210, linkedin.com/in/ananyarao and github.com/ananyarao. email.com is a real mail provider, and the handles may belong to real people (I could not check this: github.com returns 403 through the sandbox proxy). Users who export the sample unchanged could send mail or links to a real person. The tutorials, by contrast, use the reserved example.com.
- **SEO-08** (INFORMATIONAL): Trust and help pages show breadcrumbs but have no BreadcrumbList structured data. 55 pages have BreadcrumbList JSON-LD that matches their visible breadcrumb, but these 9 pages have a visible Home > Page breadcrumb with no structured data. Nothing is wrong; adding it would only make the pages consistent.
- **SEO-09** (INFORMATIONAL): CONTRIBUTING says 'no inline style attributes' but generated pages contain 38 of them. CONTRIBUTING.md (How the code is organised) says 'no inline style attributes'. Yet 20 pages contain 38 inline styles (style="display: none;" and style="width:0%"), emitted by scripts/lib/image-workspace.js:241,300, scripts/lib/batch-workspace.js:196, scripts/build-pdf-pages.js:48 and scripts/build-tool-pages.js:171. tests/content_tests.js:331 deliberately allows exactly these as 'script-controlled state'. The rule is fine, but the guide does not mention the exception that the code and tests rely on.

## 15. Unverified concerns and rejected findings

- **LIVE-07** (unverified-concern, verifier: not re-tested): Three GitHub library links could not be checked from the test environment. This sandbox's outbound proxy returns 403 ('GitHub access to this repository is not enabled for this session') for any GitHub repository outside the session, so these three links could not be checked. They are well-known public repositories and are very likely fine. This is noted only so the inventory is complete.
- **SEC-07** (documented-limitation, verifier: not re-tested): Security headers that GitHub Pages cannot set are missing. Responses carry no Strict-Transport-Security, X-Content-Type-Options, X-Frame-Options, Permissions-Policy or CSP header, and send access-control-allow-origin: * on every file. HTTP→HTTPS (301) and www→apex (301) redirects work, and referrer policy is set via meta on all 70 pages. Development files are publicly served (tests/fixtures.js 200, package.json 200), which is harmless. node_modules is not served (404). pdf-lib.min.js references a source map that is not shipped.
- **PA-06** (defect, verifier: not-a-defect): The 'Show password' checkbox in the PDF password dialog is 18x18 px (WCAG 2.5.8 target size). axe target-size flags the checkbox: 18x18 px with only 20 px of safe spacing. It fails in both themes, at 1280 and 360 px. Verifier: The axe result reproduces (pa06.js / pa06.out, pa06-dialog-360.png, pa06-dialog-1280.png): with the dialog open for an invented AES-128 PDF, axe flags input[type=checkbox] as 18x18 with 20 px safe spacing, at 1280 and 360 px. However, the checkbox is wrapped in <label class="check"> (js/lib/pdf-ui.js:47). That label measures 143x24 px at both widths, and clicking its text toggles the box (verified: 'label click toggles true'). So the area that activates the control is at least 24 px tall and 143 px wide. axe's target-size rule measures only the input element, which makes this a tool false positive, not a WCAG 2.5.8 failure in practice. The nearest neighbour is the password field, 1 px above. A mis-tap there only focuses the field and is harmless. At most this is an optional polish suggestion (enlarge the box or add 4 px of margin).
- **PA-10** (unverified-concern, verifier: confirmed-different-severity): Untested Safari and Firefox risks: CSS :has without fallbacks; real Safari and Firefox never run. Only Chromium was available, so Safari and Firefox were not run. Source review found JS fallbacks in place: createImageBitmap options in try/catch, a feature test for OffscreenCanvas in workers with a main-thread fallback, a guard for crypto.randomUUID, a memory fallback for IndexedDB, and the pdf.js legacy build with core-js polyfills. CSS :has() is used 11 times with no fallback (css/app.css:443, 591, 692, 847-848, 1041, 1218, 1221, 1261, 1375, 1844). On browsers without :has (Firefox before 121, Safari before 15.4, still found on older Android and iOS devices), problems are likely:
- the guide SVGs with min-width 560px would lose overflow-x:auto and widen the page at 360px
- the resume step bar's extra scroll-padding would be missing, so focused fields could be hidden under the sticky step bar
- the toast lift above the sticky action bars would not apply
In addition, the modal dialogs use the inert property (Safari 15.5+). Without it the page behind a dialog stays exposed to assistive technology, although the JS Tab trap still holds keyboard focus. Verifier: Chromium can only simulate this. pa10.js deletes every CSSOM rule whose selector contains :has( (11 rules) on guides/image-formats-guide.html at 360 px. After that, document scrollWidth becomes 576 px against a 360 px viewport, so the page scrolls sideways (pa10-nohas-guide.png, pa10.out). So the guide-chart part of the concern is real for a browser without :has(). However, such browsers are Firefox before 121 and Safari/iOS before 15.4. Firefox updates itself, every iOS 15 device can install 15.4 or later, and these versions are a negligible share in late 2026. Nothing was reproduced in a real browser, and the scroll-padding, toast and inert items are speculative. Adding a non-:has default (for example overflow-x:auto on .shot itself) is a sensible hardening step, but it is an optional improvement, not a defect that users currently hit, so I rate it info.

## 16. Fixes made in this round and regression results

All work was done on the audit-fix branch `claude/blissful-bardeen-qwl1nu`, kept separate from `main` until it had been reviewed and tested.

**Round 1: fix the 61 verified defects.** Five agents each took one package (resume, image, PDF, batch and cafe, site), each in its own git worktree. Each followed the same steps: reproduce, find the root cause, fix, add a regression test, verify. An independent verifier then re-ran every original reproduction against the fixed code, and anything it rejected went back for repair. Result: 58 fixed, 2 partly fixed (BAT-09, NAV-05), 1 declined with a reason the verifier accepted (LIVE-03). Section 7 gives the resolution of each defect.

**Round 2: review of the merged fixes.** After the five packages were merged, six independent reviewers examined the combined change:
- integration between packages;
- security and privacy;
- image, batch and cafe tools used as a real person would;
- PDF tools;
- resume, search, navigation and offline;
- accuracy of the wording, and accessibility.

A skeptic re-tested every problem the reviewers raised. 32 were confirmed: 7 medium and 25 low. They are new problems, or fixes that did not reach every tool. The most important was that a KB was counted two ways: the same 505,000-byte PDF was "over 500 KB" in Compress PDF and "already under 500 KB" in the applicant workspace. The whole site now uses one rule. A KB is 1,000 bytes and sizes are rounded up, so the same file shows the same size in every tool. A maximum of N KB is met only at N × 1,000 bytes or less, which is under the limit whichever way a portal counts. One fixer resolved 31 of the 32, with one partly fixed (offline CJK text, see section 17). An independent check of those fixes found 10 small follow-ups (PF-1 to PF-10); 9 were repaired and one is the same partly fixed CJK item.

| ID | Severity | Problem found in the merged fixes | Result |
|---|---|---|---|
| INTE-1 | MEDIUM | KB counted two ways: the same file is 'over 500 KB' in Compress PDF and 'already under 500 KB' in the applicant workspace, and the site's copy contradicts itself | fixed, checked independently |
| INTE-2 | MEDIUM | Applicant workspace still accepts fully damaged PDFs and merges them into blank pages with no warning (PDF-03 fixed only in the pdf-ui tools) | fixed, checked independently |
| SECU-1 | MEDIUM | SEC-02 not fully fixed: the 50 MP header check lets images through when it cannot read the size; a 2.2 KB AVIF spikes memory by 1.4 GB before it is refused | fixed, checked independently |
| IMGB-1 | MEDIUM | Workspace 'Compress PDF to 500 KB' and the Compress PDF page now count a KB differently: the same file is 'under 500 KB, kept unchanged' in one and over the limit in the other | fixed, checked independently |
| PDFT-1 | MEDIUM | PDF to text, PDF to image and Compress PDF still do not report damaged pages; PDF to text calls a damaged file a scan | fixed, checked independently |
| RESU-1 | MEDIUM | After a reload or quick return to the builder, the form sits empty for 3 s; typing in that time creates a second resume | fixed, checked independently |
| COPY-1 | MEDIUM | The same 505,000-byte PDF is 'under 500 KB, kept unchanged' in Applicant workspaces but '505.0 KB', over the limit, in Compress PDF | fixed, checked independently |
| INTE-3 | LOW | Workspace still queues images over 50 MP and fails them after the action is pressed (IMG-09 fixed only in the batch tools); the two refusal messages are worded differently | fixed, checked independently |
| INTE-4 | LOW | A truncated JPEG is refused at add time by Image to PDF and Compress PDF, but accepted into the list by Merge PDF and the workspace and fails only after the action is pressed, with a different message | fixed, checked independently |
| INTE-5 | LOW | After 'Save every tool for offline use', PDFs with Chinese, Japanese or Korean text silently lose that text offline, while Your data says every tool is saved | partly |
| SECU-2 | LOW | RES-07 copy of unsaved changes can stay in localStorage while saving is off; it is hidden from Your data and the builder, and the previous person's resume reappears later | fixed, checked independently |
| SECU-3 | LOW | Your data counts a leftover resume copy as a 'setting' and says 0 saved resumes; the privacy row describes it too narrowly | fixed, checked independently |
| SECU-4 | LOW | CAF-01 name removal works on raw substrings, so a short file name garbles the screen-reader announcement | fixed, checked independently |
| IMGB-2 | LOW | BAT-05 only partly fixed: AVIF and GIF inputs still come out larger, still go into the ZIP and are still counted as 'compressed' | fixed, checked independently |
| IMGB-3 | LOW | The 'too small' refusal and enlargement warning (IMG-05) exist only in the resizer: batch, workspace, print sheet, cleaner and Image to PDF turn a 1 × 1 px picture into a 'Done' result without a word | fixed, checked independently |
| IMGB-4 | LOW | Workspace still lists images over 50 MP and fails them only when an action runs, with different wording from every other tool | fixed, checked independently |
| IMGB-5 | LOW | Workspace page promises 'files of different people never share a name in the Downloads folder', which is not true | fixed, checked independently |
| IMGB-6 | LOW | Image to PDF rejection notice runs every reason into one paragraph, leaves the fourth file unnamed, and calls an SVG 'a plain text file' | fixed, checked independently |
| PDFT-2 | LOW | Blank pages written as an empty /Contents array or a zero-length Flate stream are reported as damaged; a one-page blank file is refused | fixed, checked independently |
| PDFT-3 | LOW | Compress PDF now shows sizes in rounded-up 1,000-byte KB/MB; the same file shows a different size in every other tool | fixed, checked independently |
| PDFT-4 | LOW | Watermark says the text was made smaller 'to fit on the page' when even the 4 pt minimum does not fit and the text is cut off | fixed, checked independently |
| RESU-2 | LOW | Your data says 'No saved resumes' and hides Delete all resumes while a resume's text sits in localStorage; it reappears when the builder is opened | fixed, checked independently |
| RESU-3 | LOW | A backup over the limits (or the 'original' file) is refused as 'not an ApplyReady resume backup, or damaged', while the same data in storage opens shortened | fixed |
| RESU-4 | LOW | Keyword match still lists generic advert words as key terms (passionate, motivated, ensuring, assigned, joiners, 15k...) | fixed, checked independently |
| RESU-5 | LOW | 'C/C++' (or 'C++/Qt') in a resume does not count as C++; the RES-09 slash-group matching only works for one- and two-letter terms | fixed, checked independently |
| RESU-7 | LOW | The offline page lists a PDF tool that was opened but never used as kept and working offline, but it cannot process files, and its error only says to check the connection | fixed, checked independently |
| RESU-9 | LOW | Search: 'mark sheet' (the site's own spelling) opens Passport photo print sheet; 'light mode'/'night mode' offer an unrelated PDF guide | fixed, checked independently |
| COPY-2 | LOW | privacy.html still promises 'After a page has loaded, the tools work without a connection'; the PDF tools fail offline after loading | fixed, checked independently |
| COPY-3 | LOW | Workspace page claims single downloads of different people 'never share a name'; numbers restart every session and equal names collide | fixed, checked independently |
| COPY-5 | LOW | New 50 MP refusal message spread to every image tool says a 50.1 MP photo 'is 50 megapixels … more than the 50 MP' | fixed, checked independently |
| COPY-7 | LOW | Privacy says Your data lists everything stored, but the new applyready_resume_unsaved:<id> copy (full resume text) is not listed, and Delete everything reports it as a 'setting' with a mangled id | fixed, checked independently |
| COPY-9 | LOW | PROGRESS.md and the changelog do not describe the merged audit fixes; the changelog's edited line keeps 'icon font … under 10 KB' (fonts are 12.5 KB) | fixed, checked independently |

Follow-ups from the independent check of round 2:

| ID | Severity | Follow-up from the independent check | Result |
|---|---|---|---|
| PF-1 | LOW | New regression from the rule that refuses images whose size cannot be read. A JPEG with stray bytes between segments (for example zero padding after APP0) decodes normally in Chrome; libjpeg only warns about extraneous b… | fixed |
| PF-2 | LOW | RESU-3 is only partly fixed. Backups over the limits now import shortened. But the file the builder offers as 'Download the original' (kind 'damaged-resume-record') is still refused with the generic, misleading message. … | fixed |
| PF-3 | LOW | Two gaps remain for damaged PDFs in PDF to text and PDF to image. First, a partly damaged page (content cut off) gets no warning anywhere in PDF to text: the notice shown on open is hidden by the automatic read, and the … | fixed |
| PF-4 | LOW | The new watermark overflow message advises 'Use a shorter text, or a level angle.' For centred text a level angle never gives more room than 45°; it gives less. So the second suggestion misleads the user. | fixed |
| PF-5 | LOW | The public changelog over-claims. It says 'Truncated or damaged pictures are refused when they are added, with the same message in every tool.' Batch image, Compress image and Convert image still list a truncated JPEG as… | fixed |
| PF-6 | LOW | INTE-5 is only partly fixed, as the fixer declared. After 'Save every tool', a PDF with Chinese, Japanese or Korean text opened offline still loses that text with no word in the tool or its result. Only the Your data mes… | partly |
| PF-7 | LOW | SECU-4 residual. Whole-word replacement still garbles the screen-reader announcement when the file name is a short word or number that also appears in the message. For example, a file named '50' or '1' run against a 50 M… | fixed |
| PF-8 | LOW | The MB conversion is incomplete. The report says file caps went from MiB to MB, but Text to PDF and resume backup imports still cap at 5 × 1024 × 1024 bytes while saying 'up to 5 MB'. A 5,200,000-byte file is accepted al… | fixed |
| PF-9 | LOW | The same file still shows a different size label in the File checker. Its headline and card subtitle always use KB (inspect.sizes().kbText), while every other tool uses Files.formatBytes. Sub-1 KB files also differ. | fixed |
| PF-10 | LOW | The new offline path in Merge PDF shows broken grammar: 'None of the other 1 file could be added either.' The string is old code, but this fix makes it reachable whenever a visitor adds PDFs offline before the library is… | fixed |

**Round 3: final regression.** Run on the merged branch, after the tutorial screenshots had been retaken from the fixed tools. The guides' quoted figures were re-measured, or converted from their exact byte counts to the new KB rule.

| Check | Before fixes (92f7ef0) | After all fixes |
|---|---|---|
| npm test: unit (run_tests) | 646 | 668 |
| regression | 64 | 70 |
| document tools unit | 119 | 138 |
| workspace unit | 56 | 90 |
| content assertions | 10,722 | 10,845 |
| guides and tutorials | 994 | 994 |
| navigation and search | 239 | 300 |
| browser_tests | 2,833 | 2,833 |
| image workflow | 296 | 381 |
| resume flow | 96 | 96 |
| resume library | 144 | 181 |
| UI and axe accessibility | 3,571 | 3,623 |
| robustness | 81 | 109 |
| PDF tools | 222 | 289 |
| batch images | 283 | 335 |
| document tools (browser) | 153 | 156 |
| applicant workspaces | 137 | 154 |
| tutorials followed in the tools | 208 | 209 |
| Chromium smoke | 20 | 20 |

All suites pass, with no test disabled, skipped or weakened. Two test changes deserve a note:
- **Batch suite:** it now waits for the page to repaint before reading labels. This fixes a timing failure seen once under heavy CPU load; the assertions are unchanged.
- **Batch corrupt-file fixture:** it is now a JPEG cut short, because a JPEG whose size cannot be read is now refused when it is added, a stricter behaviour that has its own tests.

The generators' `--check` modes pass, `node --check` passes on all JavaScript, and `npm audit` reports 0 vulnerabilities.

## 17. Outstanding limitations

These are known and stated plainly. None of them is hidden in the product: where a user could be affected, the page or the docs say so.

**Defects not fully fixed**
- **BAT-09 (partly):** a web page cannot detect that the browser blocked a download. The false "downloaded" announcement is gone, and the message now says what to do if no download starts. Detecting the block itself is not possible.
- **NAV-05 (partly):** search has no "ApplyReady does not do this" answer for requests such as unlocking a PDF, removing a password or changing a photo background. Those queries still list loosely related tools.
- **LIVE-03 (declined):** the donation link appears in the footer and in the text of About, Philosophy and Contribute. This is intended and documented in CONTRIBUTING.md, it is one destination URL, and the owner asked for the Razorpay link to stay as it is.
- **Chinese, Japanese and Korean text in PDFs opened offline (INTE-5, PF-6, partly):** pdf.js needs character maps that are not part of the offline copy (1.7 MB). Offline, such text is dropped without a warning. Your data and privacy.html now say this, but the tool itself cannot detect it, because pdf.js reports the missing map only inside its worker.
- **PDF-04 (limit of pdf.js):** pdf.js maps the Hindi vowel sign ि to an empty character. The tool now removes the control character, counts it and warns about Indian scripts, but the vowel sign is not recovered. This should be reported upstream to pdf.js.
- **PDF-03 (scope):** damaged-page detection is structural: content that is missing, or that will not decompress. A page whose content decompresses but has broken drawing commands is not detected.

**Not tested in this audit**
- Real Firefox and real Safari, including iPhone Safari, because only Chromium is available in the audit environment. CSS `:has()` is used without fallbacks in places (PA-10).
- Real phones (emulation only) and real screen readers (NVDA, JAWS, VoiceOver, TalkBack).

**Hosting limits (GitHub Pages)**
- No HTTP security headers can be set: no header CSP, no `frame-ancestors` or `X-Frame-Options`, no HSTS preload (SEC-06, SEC-07). The CSP is a meta tag; workers now inherit it because they are started from `blob:` URLs.
- Old guide URLs are redirected by a script on the 404 page, not by an HTTP redirect (SEO-06).

**Suggestions left for later** are listed in section 14. The most useful are:
- NAV-03: put Privacy and Your data in the header or phone menu.
- PA-08: use rem font sizes, so a browser's text-size setting works.
- IMG-10 and PDF-08: record DPI in WebP files and in PDF-to-image output.

**Owner actions** (unchanged from docs/PROGRESS.md):
- Remove the old AdSense account.
- Test on a real iPhone and on Firefox.
- Review and merge the audit-fix pull request.
