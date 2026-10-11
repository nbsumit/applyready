# AdSense readiness

Status as of 2026-10-11. This file records what the site already satisfies, what only the owner can do, and how to turn ads on after approval.

## What the repository satisfies (checked by `tests/content_tests.js`, `tests/ui_tests.js`)

| Requirement | State |
|---|---|
| Privacy policy naming Google AdSense, advertising cookies and the opt-out links | Present in `privacy.html` |
| About, Contact and Terms pages, with a named author and a contact address | Present |
| Independence statement (no affiliation with any exam body) and a correction route | In `about.html` and `contact.html` |
| `ads.txt` with a DIRECT line for the publisher id | Present and served at `/ads.txt` |
| AdSense loader and `google-adsense-account` meta on every content page | 52 pages |
| No loader on 404 and offline pages (no ads on pages without content) | Confirmed |
| No live ad units and no empty ad boxes before approval | Slots are hidden and the units are commented out |
| Unique title, description and canonical on every page | Tested |
| All internal links resolve; every page is in `sitemap.xml`; every guide is in the offline cache list | Tested |
| Content depth: 25 guides (750 to 1,270 words each, about 24,000 words in total), 5 exam pages and 5 KB pages with a page-specific numbers section, 5 Hindi pages | Tested (guides and landing pages at least 600 words) |
| No horizontal overflow, no accessibility violations (WCAG 2.2 AA) on any page in light and dark | Tested on 53 pages |
| Navigation reaches every guide, tool and policy page from the header or footer | Guides index lists all guides; tools link to related guides |

## What only the owner can do or decide

1. **Read and edit the new guides.** The 15 guides added on 2026-10-11 were drafted for the site. They carry the byline "Sumit Sengar" and a "Last reviewed" line, so they must reflect what the author actually knows and stands behind. Fix anything that does not match your own experience, and add real examples, screenshots or portal-specific details where you have them. Original, experience-based detail is what separates a useful site from a thin one.
2. **Exam figures.** The photo, signature and size figures on each exam page come from the exam notice. Re-check them against the current notice before applying and change the "Last verified" month.
3. **Account facts the code cannot show:** domain age, traffic, and whether the AdSense account already exists. A very new site with little traffic is rejected more often. A rejection is not permanent; the reason shown in the account says what to fix, and you can reapply.
4. **A domain email address** such as `contact@applyready.in` looks more established than an address on another domain. Update `contact.html`, `about.html`, `privacy.html`, `terms.html` if you change it.

## After approval

1. In AdSense, create ad units and note each slot id.
2. Nothing to change in `css/app.css`: `.ad-slot-container` is hidden while it holds no `<ins>` element and shows itself as soon as a live unit is added (`.ad-slot-container:has(ins)`).
3. In each page's slot, replace the commented `<ins class="adsbygoogle" ...>` with a live unit that uses the real `data-ad-slot`.
4. Place ads only on guides, exam pages and KB pages. Do not place ads inside the tool panels, result panels, error or empty states, the 404 page or the offline page.
5. Set up the Google certified consent message under Privacy & messaging for visitors in the EEA, the UK and Switzerland.
6. Keep `tests/content_tests.js` in mind: it asserts that no live ad unit exists, so update that assertion when you go live.
