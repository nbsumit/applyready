# UPSC: photo and signature upload specifications, checked against official sources

Checked on 2026-10-24. Every value below comes from a document fetched with `curl` (HTTP 200, real PDF or JS content) and read with `pdftotext -layout`. Local copies are under `research/dl-upsc/`.

## Headline finding

The current UPSC application portal (upsconline.nic.in, the new OTR/URN + CAF system) states **no pixel dimensions for the photograph**. It also has **no "not older than 10 days" rule** and **no "name and date on photo" rule**. Its official photo/signature instructions say "Photograph is NOT to be signed." The 350×350 to 1000×1000 px / 10-day / name-and-date rules seem to come from the **old** portal (upsconline.gov.in). That portal now carries the notice "This portal is only for preview of application forms filled/submitted on or before 25/03/2025." I could not open an old notice to confirm where those rules came from (see section 5).

The CSE 2026 notice and the ESE 2027 notice give no KB or pixel numbers in their main text. Both send candidates to the portal's "Instructions and FAQs > Instruction for filling the form > Photos and Signature". The portal PDFs below are therefore the main sources.

---

## 1. Sources opened (all confirmed loads via curl, HTTP 200)

| # | Document | Notice no. / date | URL |
|---|---|---|---|
| S1 | **Instructions for Uploading the Photo & Signature** (UPSC, 7 pp; PDF CreationDate 2026-02-04). Linked from the portal menu "Instructions for filling the form > Photo & Signature". | not numbered | https://upsconline.nic.in/candidate/resources/bzh30/login/upsc-candidates-portal/dist/assets/instruction-photo-signature-upload-upsc-CCLCIgId.pdf |
| S2 | **Instructions for uploading documents** (UPSC, 4 pp; PDF CreationDate 2025-07-31). Portal menu item "Instructions for uploading documents". | not numbered | https://upsconline.nic.in/candidate/resources/bzh30/login/upsc-candidates-portal/dist/assets/Instructions%20for%20uploading%20documents-new-2-CFBYTKvU.pdf |
| S3 | **Civil Services Examination 2026 notice** (159 pp) | EXAMINATION NOTICE NO 05/2026-CSE, DATE 04.02.2026 | https://www.upsc.gov.in/sites/default/files/Notif-CSP-2026-Engl-060226Rev.pdf |
| S4 | **Engineering Services Examination 2027 notice** (62 pp). This is the newest UPSC notice found. | EXAMINATION NOTICE NO. 02/2027-ENGG., dated 16.09.2026 | https://www.upsc.gov.in/sites/default/files/Notif-ESEP-2027-Engl-160926.pdf |
| S5 | Combined Geo-Scientist Examination 2027 notice | EXAMINATION NOTICE NO. 01/2027-GEOL, dated 02.09.2026 | https://www.upsc.gov.in/sites/default/files/Notif-CGSPE-2027-Engl-020926.pdf |
| S6 | Live CAF portal UI (Angular bundle; on-screen notes and validation config of the Photo & Signature profile) | n/a | https://upsconline.nic.in/caf/main-ZZXCJNKM.js (served from https://upsconline.nic.in/caf/) |
| S7 | Live OTR/URN portal UI chunk (Aadhaar / Photo ID and Matriculation upload notes) | n/a | https://upsconline.nic.in/candidate/resources/bzh30/login/upsc-candidates-portal/dist/assets/KcPage-CDLnNLfK.js |
| S8 | "Aadhaar / Photo ID" profile guide (UPSC, 5 pp; CreationDate 2025-05-28) | n/a | https://upsconline.nic.in/candidate/resources/bzh30/login/upsc-candidates-portal/dist/assets/Aadhaar_Photo%20_ID-BylELrTW.pdf |
| S9 | General Instructions for filling UPSC forms (18 pp; CreationDate 2026-02-04) | n/a | https://upsconline.nic.in/candidate/resources/bzh30/login/upsc-candidates-portal/dist/assets/General-Instruction-for-filling-upsc-forms-YUMg3kcz.pdf |
| S10 | FAQ (18 pp; CreationDate 2026-02-13) | n/a | https://upsconline.nic.in/candidate/resources/bzh30/login/upsc-candidates-portal/dist/assets/Faq-DnrKgqhc.pdf |
| S11 | Photo ID Guidelines (1 page, image only: sample ID cards, no numbers) | n/a | https://upsconline.nic.in/candidate/resources/bzh30/login/upsc-candidates-portal/dist/assets/Photo_ID_Guidelines-BQO6YY6m.pdf |

Note: the portal asset filenames contain build hashes (`-CCLCIgId`, etc.). They may change when UPSC redeploys the portal. Link the portal home (https://upsconline.nic.in) on the site, not these deep links.

---

## 2. Upload items: verified values

### 2.1 Photograph (CAF > "Photo & Signature" profile)

- **Format:** jpg (portal also accepts .jpeg). **Size: 20 KB to 200 KB.** File name: `photo`. **Pixel dimensions: none stated.**
  - S1, p.2: "Upload a photo named photo in jpg format with a file size between 20KB and 200KB."
  - S2, p.1 table, row 8: "Photo | Photo & Signature | jpg | 20KB–200KB | photo"
  - S6 (portal on-screen note): "NOTE 1:- Allowed Photo size: 20 KB to 200 KB, File format: jpg, jpeg". The validation config is `minSizeKB:20,maxSizeKB:200,allowedExtensions:["jpg","jpeg"],exactFileName:"photo"`, with no width/height check for the photo.
- **Face coverage 3/4:**
  - S1, p.2: "the face must cover at least 75% of the area in the photo."
  - S1, p.4 (Dos): "Make sure your face covers 75% i.e. 3/4th area of the photo."
- **Colour, background, pose** (S1, p.4 Dos/Don'ts):
  - "Use a colour photo in jpg format between 20KB and 200KB, saved with the filename 'photo'."
  - "Photo background shall be plain white."
  - "Frontal view of the full face should be visible, head in the centre and both ears should be visible."
  - "Photograph with dark background or in uniform, or with eyes hidden under coloured or dark glasses will not be accepted."
  - "Photograph is NOT to be signed."
- **Black and white photos are rejected by the portal.** S6, on-screen error: "Please upload a coloured photograph. Black & white photographs are not accepted."
- **Recency:** S1, p.2: "Ensure the photo is clear, recent, and shows your full face." No number of days is given.

### 2.2 Live photograph (new; mandatory)

- S1, p.4: "Capture of live photograph shall be mandatory for submission of the application for any examination."
- S1, pp.4–5: "The live photograph captured during the application process shall be matched with the passport-size photograph uploaded by the applicant. If a mismatch is detected between the two photographs, the applicant shall not be allowed to proceed further with the examination application process."
- Options (S1, p.4): "Capture from device: Use the web camera of the current device." / "Capture from mobile: Scan the QR code displayed on the screen".
- S3 (CSE 2026), p.2 and p.17, NOTE 2: "Applicants are required to upload their photograph and also capture their live photograph while filling up the Common Application Form (CAF)." The same text is in S4 (ESE 2027) at p.2 and p.18.

### 2.3 Triple signature

- **Format:** jpg (.jpeg also accepted by the portal). **Size: 20 KB to 100 KB.** File name: `signature`. **Pixels: 350 to 500.**
  - S1, p.5: "File size: 20 KB – 100 KB" and "Image dimensions: 350 - 500 pixels"
  - S2, p.4: "Between 20KB to 100 KB and" / "Between 350 pixels to 500 pixels."
  - S2, p.1 table, row 7: "Signature | Photo & Signature | jpg | 20KB–100KB | signature"
  - S6 (portal on-screen note): "NOTE 3:- The height and width of signature image must be between 350 and 500 pixels". For the scribe signature the portal says: "Image dimensions must be between 350 and 500 pixels in both height and width."
  - Caveat: the portal's validation config for `signature` checks only KB, extension and file name (`minSizeKB:20,maxSizeKB:100`). The pixel range is stated in the instructions but I did not see it enforced in code. Tell users to follow it anyway: S1 p.5 says "Applications with signature files that do not meet the prescribed specifications will be rejected."
- **Method:**
  - S1, p.5: "Candidate should sign their own signature three times vertically (one below the other) on a plain white paper using a black ink." Also: "Ensure there is adequate gap/space between each signature." and "Scan all three signatures in a single image."
  - S1, p.5: "Contain exactly three signatures", "Properly oriented (not rotated or upside down)", "On plain white paper (no lines or colours)".
  - S3 (CSE 2026), p.2 and p.18, NOTE 3: "Applicants are required to sign three times (one below the other) on a plain white paper using a black ink". The same text is in S4 p.2/p.18 and S5.
  - S6: "Upload three identical signatures signed in black ink on white unruled paper in one vertical column."
  - S2, p.4 says "black pen": "Sign on a clean white paper using a black pen."

### 2.4 Photo ID (OTR / Universal Registration, "Aadhaar / Photo ID" step)

- **It is a JPG, not a PDF.** **Size: 20 KB to 200 KB.** File name: `id_card`. It is needed only if the candidate does not proceed with Aadhaar verification.
  - S2, p.1 table, row 3: "Photo ID (Aadhaar / Photo ID) | — | jpg | 20KB–200KB | id_card"
  - S7 (portal on-screen note): "NOTE 1:- Allowed Photo ID Card size : 20 KB to 200 KB, File format: jpg" and "NOTE 2:- File name should be id_card"
  - S8, p.4: "Upload the document as per the selected ID and proceed. Document name should be id_card in jpg format and sized between 20KB-200KB."
- Accepted IDs (S3 p.2, §2.2): "Aadhaar Card/Voter Card (EPIC)/PAN Card/Passport/Driving Licence/Any other Photo ID Card issued by the State/Central Government." The notice adds: "This Photo ID Card will be used for all future reference and the candidate is advised to carry this Photo ID Card while appearing for Examination/Personality Test."
- S3 p.1: "Applicants are strongly advised to use their Aadhaar Card as ID documents for easy, effortless and seamless verification".

### 2.5 Other uploads (all PDF, 50 KB to 300 KB; S2 p.1–2 table)

| Item | File name |
|---|---|
| Name change affidavit / gazette | `name_change` |
| Matriculation / board certificate | `board_certificate` |
| Caste certificate | `caste_certificate` |
| Disability certificate | `disability_certificate` |
| PwBD recommendation | `pw_recommendation` |

Quote: "Name change ... | Identity Profile | pdf | 50KB–300KB | name_change". S2 also lists EPFO-specific items and the scribe photo (jpg 20–200 KB) and scribe signature (jpg 20–100 KB).

S2, p.1: "Upload each document using the exact file name (nomenclature) specified in the table. Document will not be uploaded if any other file name, format or size is used."

### 2.6 Conflict: the ESE 2027 notice appendix still has an older generic KB rule

S4 (ESE 2027, notice 02/2027-ENGG, 16.09.2026), Appendix-IIA, PDF p.51, item 4:

> "a candidate must have his/her photograph and signature duly scanned in the .jpg format in such a manner that each file should not exceed 300 KB each and must not be less than 20 KB in size for the photograph and signature."

This conflicts with the portal (photo max 200 KB, signature max 100 KB). The same notice (p.2, NOTE 4) says "Please follow the Instructions in respect of uploading of Photograph as elaborated in the Instructions to upload documents in the home page of the online application portal". The portal also rejects files outside 20–200 KB and 20–100 KB. **Use the portal limits.** The CSE 2026 notice (S3), Appendix-II (p.155), has no KB figure at all.

### 2.7 NDA/NA and CDS 2026 notices: could not be read

These PDFs returned Akamai HTTP 504 on every curl attempt and HTTP 403 via WebFetch (see section 4). No NDA- or CDS-specific numbers are recorded. All exams now use the same CAF photo/signature (S9 p.13: CAF "Photo & Signature" profile). Treat the portal values above as applying to NDA, CDS, CMS, ESE and CSE, and say on the site that the portal is the authority.

---

## 3. Officially documented steps and portal quirks

1. **Four modules, and the first three are done once.** S3 p.1: "has four cards/modules, three of which namely, Account creation, Universal Registration and Common Application Form are common to all examination applications and can be filled anytime". Also: "The URN has to be registered only once in lifetime."
2. **Photo & Signature is the last CAF profile.** S9 p.13: "You are allowed to fill these profiles/modules in any order of your choice except the last one i.e. Photo and Signature profile."
3. **CAF photo is reused across applications.** S3 p.1 says the CAF is "common to all examination applications". S1 p.4 says the live photo "shall be matched with the passport-size photograph uploaded by the applicant". I found no sentence explicitly about the photo being printed on the admit card.
4. **One-time URN edit.** S3 p.2: "The Commission provides a one-time facility for candidates to update or modify their Universal Registration Number (URN) profile." Changes do not carry over to applications already submitted.
5. **Exact file names are enforced** (`photo`, `signature`, `id_card`, ...). See S2 p.1, quoted in section 2.5.
6. **Face authentication at the venue.** S3 p.4: "all candidates will be required to undergo face authentication at the examination venue mandatorily."
7. **Wrong photo counts as misconduct.** S3 p.19 lists "(e) uploading irrelevant or incorrect photo/signature in the application form in place of actual photo/signature".
8. **No changes after submission.** S3 p.2: "no correction /alteration/modification in any field(s) of the Application Form is allowed after submission."
9. **Upload problems.** S10 FAQ Q.21: "Please check if the signature/ photograph etc. are in accordance with the 'Instructions to Upload Documents' given at the home page. Any deviation from the instructions will not allow the document to be uploaded."
10. **Helpdesk.** S3 p.3 lists "helpline no. 011-24041001 or email ID – upscsoap@nic.in" for the CSE 2026 application window, including issues with "uploading of documents".

---

## 4. Baseline claims checked

| Baseline claim | Status | Official value / note |
|---|---|---|
| Photo 20 KB – 200 KB | **VERIFIED** | S1 p.2, S2 p.1, S6. (The ESE 2027 notice appendix says up to 300 KB; see 2.6. The portal enforces 200 KB.) |
| Photo square, 350×350 px min to 1000×1000 px max | **NOT FOUND IN OFFICIAL SOURCE** | No pixel figure for the photo in S1, S2, S3, S4, S5 or the portal UI (S6). The portal validates only KB, type and file name. Remove the pixel numbers or label them clearly as not an official requirement. "Square" is also not stated. |
| Photo JPG | **VERIFIED** | jpg (portal also accepts .jpeg). S1 p.2, S6. |
| 3/4 face coverage | **VERIFIED** | "face must cover at least 75% of the area in the photo" (S1 p.2). |
| Photo not older than 10 days at start of application | **NOT FOUND IN OFFICIAL SOURCE** | S1 only says "clear, recent". Live photo capture plus a match check now applies (S1 p.4–5). |
| Name and date on the photo | **NOT FOUND IN OFFICIAL SOURCE** | Not mentioned anywhere. S1 p.4 says "Photograph is NOT to be signed." Remove this claim. |
| Signature 20 KB – 100 KB | **VERIFIED** | S1 p.5, S2 p.1/p.4, S6. |
| Signature 350×350 to 500×500 px | **VERIFIED (wording)** | S1: "Image dimensions: 350 - 500 pixels". The portal note says "The height and width of signature image must be between 350 and 500 pixels". So both sides must be 350–500 px. That is equivalent to 350×350 to 500×500, but the image need not be square. |
| Signature JPG | **VERIFIED** | S1 p.5, S6 (also .jpeg). |
| Sign three times, one below the other, white paper, black pen | **VERIFIED** | S3 p.2: "sign three times (one below the other) on a plain white paper using a black ink". S2 p.4 says "black pen". |

New items the site should add: the live photo capture is mandatory and matched against the uploaded photo; the photo must be colour with a plain white background (B&W is rejected by the portal); the Photo ID is a **JPG** of 20–200 KB named `id_card`, not a PDF; certificates are PDF, 50–300 KB; exact file names are required.

---

## 5. URLs that did not load

| URL | Method | Result |
|---|---|---|
| https://www.upsc.gov.in/sites/default/files/Notif-NDA-II-2026-Engl-200526.pdf | curl (several tries over 30+ min) | HTTP 504 (Akamai "An error occurred while processing your request") |
| same | WebFetch | HTTP 403 |
| https://www.upsc.gov.in/sites/default/files/Notif-CDS-II-2026-Engl-200526.pdf | curl, several tries | HTTP 504 |
| https://www.upsc.gov.in/sites/default/files/Notification-CMSE-2026-English-110326.pdf | curl, 3 tries | HTTP 504 |
| https://www.upsc.gov.in/sites/default/files/Notif-NDA-NA-I-2026-Engl-101225.pdf | curl | HTTP 504 |
| https://www.upsc.gov.in/examinations/notifications | curl | HTTP 504 |
| https://www.upsc.gov.in/examinations/Combined%20Defence%20Services%20Examination%20%28I%29%2C%202026 | curl | timeout (60 s) |
| https://www.upsc.gov.in/examinations/Civil%20Services%20%28Preliminary%29%20Examination%2C%202025 (and 2024) | curl | timeout (60 s) |
| https://www.upsc.gov.in/sites/default/files/Notif-CSP-25-engl-220125.pdf (guessed name for the CSE 2025 notice) | curl | HTTP 504. The file name was a guess and is not confirmed to exist. |

Other URLs that loaded:
- https://www.upsc.gov.in/examinations/active-exams (curl, 200)
- the exam pages for CSE 2026, NDA II 2026, CDS II 2026, CMS 2026, ESE 2027 and CGS 2027 (curl, 200). These pages list the notice PDFs above.
- https://upsconline.nic.in/ (curl, 200; redirects to the candidate login SPA)
- https://upsconline.gov.in/ (curl, 200). This is the old portal, and it shows the banner "This portal is only for preview of application forms filled/submitted on or before 25/03/2025".
