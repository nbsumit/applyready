# NEET (UG) upload specifications: verification against official NTA documents

Researched 2026-10-24. Every value below comes from a PDF that was downloaded and read (pdftotext -layout; screenshot pages rendered and checked by eye).

## Sources (all downloaded with curl, HTTP 200, real PDF content)

| ID | Document | URL | Notes |
|---|---|---|---|
| **B26** | "INFORMATION BULLETIN NEET (UG)-2026" (124 PDF pages, PDF CreationDate 08 Feb 2026, ModDate 23 Feb 2026) | https://cdnbbsr.s3waas.gov.in/s37bc1ec1d9c3426357e69acd5bf320061/uploads/2026/02/202602231394640855.pdf | **Latest bulletin.** Linked as "Information Bulletin for NEET(UG)-2026" from https://neet.nta.nic.in/ and https://neet.nta.nic.in/information-bulletin/ (both pages loaded with curl). No 2027 bulletin was listed as of 2026-10-24. |
| **B25** | "INFORMATION BULLETIN NEET (UG)-2025" (157 pages) | https://cdnbbsr.s3waas.gov.in/s37bc1ec1d9c3426357e69acd5bf320061/uploads/2025/02/2025020754.pdf | Previous year. Used only for comparison and to explain where the site's old values came from. |
| **CN26** | Public Notice, 11 March 2026, "Correction in Particulars for the National Eligibility-cum-Entrance Test [(NEET (UG)] 2026 – Reg." + Annexure-I | https://cdnbbsr.s3waas.gov.in/s37bc1ec1d9c3426357e69acd5bf320061/uploads/2026/03/20260311404208011.pdf | Scanned PDF. Page 2 was rendered and read visually. |
| PN26 | Public Notice, 08 February 2026, "Inviting online Application Form for ... NEET (UG) 2026" | https://cdnbbsr.s3waas.gov.in/s37bc1ec1d9c3426357e69acd5bf320061/uploads/2026/02/20260208399987696.pdf | Scanned. Says only that candidates must upload a "recent passport photograph, address proof, scanned signature, etc." It gives **no sizes**. |

The cdnbbsr.s3waas.gov.in host is the government S3WaaS CDN behind neet.nta.nic.in. All of these PDFs are linked directly from neet.nta.nic.in pages.

Page numbers below are the **printed page numbers** at the foot of each bulletin page.

---

## 1. Upload items: verified values (NEET (UG) 2026 bulletin)

### 1a. Passport-size photograph: JPG/JPEG, 10 kb to 200 kb
- B26 p.16, Ch.3 §2 Step 2(d)(i): "The recent passport size photograph should be either in colour or black & white with 80% face (without mask) visible including ears against white background. 80% area of the image should be candidate's face. Photograph should be in JPG/JPEG format (clearly legible) between 10 kb to 200 kb."
- B26 p.106 (Step 15, demo upload screen, read from the rendered image): "Passport Size Photograph (with 80% face without mask)", Format JPG/JPEG, Min Size (KB) 10, Max Size (KB) 200.
- Date rule, B26 p.14 Step 2(b): "recent Passport size Photograph (taken after 01 January 2026)". B26 p.19 Note (c) says: "latest (taken on/after 01 January 2026) photograph".
- Physical photos, B26 p.10 item 28: "Candidates are advised to take 6-8 Passport size coloured photographs with white background." The photos are used for the online form, the exam, and counselling/admission.
- No dimensions (cm or pixels) appear anywhere in B26 or B25.

### 1b. Postcard-size photograph (4"x6"): NOT an upload in 2026
- In B26 the list of upload specifications (p.16, items i–xvi) has **no postcard item**. The demo upload screen (p.106) lists 7 documents and none of them is a postcard photo.
- Exam day, B26 p.46: "One Post Card Size (4"X6") color photograph with white background should be pasted on the Proforma downloaded with the Admit Card." B26 p.47 repeats this. The postcard photo goes on the **Proforma**, not on the admit card. The admit card carries the **passport-size** photo: "Admit Card along with passport size photograph affixed on it" (p.46).
- Keep copies, B26 p.17: "keep 6 to 8 passport size and 4 to 6 Post Card size (4"X6") colour photographs with white background."
- Leftover text in B26: Appendix-X p.109 says to retain "4-6 postcard size Photographs which were scanned and uploaded on the Online Application." This looks carried over from 2025, because no 2026 upload slot exists for it.
- For comparison, 2025 did have an upload. B25 p.4 (iv): "The size of the scanned postcard size photograph should be between 10 kb to 200 kb (clearly legible)."

### 1c. Signature: JPG/JPEG, 10 kb to 100 kb
- B26 p.16, Step 2(d)(ii): "Signature file should be in JPG/JPEG format between 10 kb to 100 kb"
- B26 p.106 demo upload screen: Signature, JPG/JPEG, Min 10, Max 100.
- B26 p.17 only says "Candidate's Signature: to be uploaded in JPG/ JPEG format". It gives no further instructions; the 2025 text about running handwriting and black ink was dropped.
- Scribe signature, B26 p.16 (xii): "between 10 kb to 100 kb".
- Earlier figures, for comparison: B25 p.4 (vi) and p.45 give "10 kb to 50 kb". B25 p.51 contradicts that with "File size must be between 4 kb to 30 kb." It also says "full signature in running handwriting [not in the capital letter] on white paper with a Black Ink pen".

### 1d. Left- and right-hand fingers and thumb impressions: JPG/JPEG, 10 kb to 200 kb (B26 also contains a conflicting 50–300 kb line)
- B26 p.16, Step 2(d)(iii): "Left and Right Hands Fingers and Thumb impressions in JPG/JPEG format between 10 kb to 200 kb"
- B26 p.106 demo upload screen: "Left and Right hands Fingers and Thumb impressions", JPG/JPEG, Min 10, Max 200. It is **one upload slot**.
- **Conflict inside B26:** p.17 says "The candidate should put Left and Right hand Fingers and Thumb impressions. • File size must be between 50 kb to 300 kb." Two places in B26 (the p.16 spec list and the p.106 portal screenshot) say 10–200 kb. Recommended wording: "10–200 kb per the specification list and portal screen; one paragraph of the bulletin says 50–300 kb, so check the limit shown on the portal."
- B25 gives 10–200 kb throughout (p.4, p.45, p.51).
- "On white paper": **not stated** for finger/thumb impressions in either B26 or B25.

### 1e. Certificates and documents (B26 p.16)
| Item | Format | Size |
|---|---|---|
| Category certificate (if applicable), (iv) | PDF | 50–300 kb |
| Class X or equivalent certificate, (v) | PDF | 50–300 kb |
| Class X or equivalent marksheet, (vi) | PDF | 50–300 kb |
| CGPA conversion/equivalence certificate, (vii) | PDF | 50–300 kb |
| Identity proof (non-Aadhaar/DigiLocker verification), (viii) | JPG/JPEG | 10–200 kb |
| PwD/PwBD/UDID certificate, (ix) | PDF | 50–300 kb |
| Address proof (present and permanent), (x) | PDF | 50–300 kb |
| NRI/OCI/Foreigner certificate/documentary proof (citizenship), (xi) | PDF | 50–300 kb |
| Scribe signature (xii) | (not stated) | 10–100 kb |
| Scribe qualification certificate (xiii), own-scribe undertaking (xiv), certificate of physical limitation (xvi) | (not stated) | 50–300 kb |
| "scanned Identity Proof" (xv) | (not stated) | 50–300 kb |

B26 contradicts itself on identity proof: (viii) says JPG 10–200 kb and (xv) says 50–300 kb. The portal screenshot (p.106) shows Identity Proof as JPG/JPEG 10–200. Quote from (iv): "Scanned copy of Category Certificate (if applicable) should be in pdf format between 50 kb to 300 kb."

---

## 2. Upload steps and quirks documented in official sources

1. **Three-step process** (B26 p.13–18): Step 1 Register; Step 2 Complete the Application Form (personal details, medium, cities, education, "uploading the images and documents"); Step 3 Fee Payment.
2. **Portal screen order** (B26 Appendix screenshots, p.99–107; left menu on p.106): "1. Register Contact Details, 2. Register Personal Detail, 3. Disability Details, 4. Register Identity Details, 5. Register APAAR ID, 6. Register Exam & Center Details, 7. Register Qualification Details, 8. Register Additional Details, 9. Register Emergency Contact Detail, **10. Capture Live Photograph, 11. Upload Documents**, 12. Final Submit". The bulletin's own step numbering puts "Step 14: Capture of Live Photograph by Candidate" on p.105 and "Step 15: Uploading of necessary documents by the Candidate" on p.106. Fee payment comes after these, as Step 18 on p.107.
3. **Live photograph (new in 2026)**, B26 p.16–17 (xvii–xviii): "The candidate will have to upload his/her live photograph at the time of filling of the application form." It needs "a light-colored background with proper lighting, and 80% face visibility (including ears, without a mask)". The live photo is "matched with the photograph as per Aadhaar database". If it does not match, or the candidate verified identity without Aadhaar, the candidate must upload an attested certificate with photo (Annexure-VI). Per p.9 item 16, the live photograph becomes non-editable once the fee is paid.
4. **Photo date**: "taken after 01 January 2026" (p.14) and "taken on/after 01 January 2026" (p.19). In 2025 the rule was "on/after 01 January 2025" (B25 p.5).
5. **Colour or B&W allowed (2026)**: "either in colour or black & white ... against white background" (p.16). The physical prints must still be "coloured photographs with white background" (p.10) and "colour photographs with white background" (p.17).
6. **Name and date on photo**: this is **not in B26**. It appears only in B25 p.50: "The photographs must not be older than 03 months preferably indicating clearly the name of the candidate along with the date of taking the photograph." It was "preferably", not mandatory, and the 2026 bulletin removed it.
7. **Other photo rules**, B26 p.17: "Spectacles are allowed only if being used regularly." "Polaroid and Computer-generated photos are not acceptable." "The photographs need not be attested." The same passport photo is used for the form and the Attendance Sheet: "Same Passport size is to be used for uploading with Online Application Form and for pasting on Attendance Sheet".
8. **Thumb quirk**: the bulletin covers "Left and Right hand Fingers and Thumb impressions" as a single upload. B26 has no separate "left-hand thumb only" instruction. On exam day: "The candidates are also required to put the Thumb impression in the space provided on the Attendance Sheet" (B26 p.48).
9. **No correction for images**, B26 p.16: "Upload the correct photograph, signature, Left and Right Hands Fingers and Thumb impressions as the facility for correction will not be given". However, **CN26 Annexure-I** (11 Mar 2026; correction window 12–14 March 2026) allowed candidates to "change/add" item 2(v) "Signature". The photograph was not listed as correctable.
10. **Exam day**: bring the admit card with the passport photo affixed, one passport photo for the Attendance Sheet, and one 4"x6" colour photo with white background pasted on the Proforma (B26 p.46–47).

---

## 3. Site claims: verdicts against the latest bulletin (NEET (UG) 2026)

| Claim on site | Verdict |
|---|---|
| Passport photo 10 KB – 200 KB | **VERIFIED** (B26 p.16, p.106) |
| ~3.5 × 4.5 cm | **NOT FOUND IN OFFICIAL SOURCE.** Neither B26 nor B25 gives any dimension in cm or pixels. Remove it. |
| White background | **VERIFIED** (p.16). The 2026 upload may be colour **or** black & white (p.16); the physical prints must be colour. |
| 80% face coverage showing ears | **VERIFIED** (p.16: "80% face (without mask) visible including ears"; "80% area of the image should be candidate's face") |
| Name and date of photo at the bottom ("preferably") | **WRONG for 2026 / NOT FOUND in B26.** It was in B25 p.50 only, as "preferably indicating clearly the name of the candidate along with the date of taking the photograph", and it does not say "at the bottom". Drop it, or label it as a 2025-only optional item. |
| Postcard photo 4×6 in, 10–200 KB, uploaded in the application | **WRONG for 2026.** There is no postcard upload in B26 (p.16 list and p.106 portal screen). The 10–200 kb postcard upload was 2025 only (B25 p.4). |
| Postcard print pasted on the admit card on exam day | **WRONG (detail).** B26 p.46–47 says it is pasted "on the Proforma downloaded with the Admit Card". The passport-size photo is the one affixed on the admit card. |
| Signature "check bulletin (typically 10–50 KB, previously 4–30 KB)" | **WRONG / outdated.** The 2026 bulletin states **10 kb to 100 kb**, JPG/JPEG (B26 p.16 (ii), quoted verbatim in §1c; the p.106 portal screen also shows 10/100). 10–50 and 4–30 were the conflicting 2025 figures (B25 p.4 and p.51). The owner's rule "check the official bulletin (typically 10–50 KB)" does not match the 2026 bulletin; the precise 2026 figure is 10–100 kb. |
| Fingers and thumb impressions 10–200 KB | **VERIFIED** (B26 p.16 and p.106), with a caveat: B26 p.17 also says "50 kb to 300 kb". |
| Fingers and thumb impressions on white paper | **NOT FOUND IN OFFICIAL SOURCE.** Not in B26 or B25. Only the 2025 signature text mentions white paper. |
| Category / PwBD / citizenship certificate sizes | Specified in B26 p.16 as **PDF, 50–300 kb** (category; PwD/PwBD/UDID; NRI/OCI/Foreigner citizenship proof). See the table in §1e. |
| Photo taken on/after a date | **VERIFIED**: on/after 01 January 2026 (B26 p.14, p.19) |
| Step order | **VERIFIED as documented**: Live photo capture (portal step 10) comes before Upload Documents (step 11), then Final Submit, then fee payment (B26 p.105–107) |

---

## 4. URLs that failed to load

- https://exams.nta.ac.in/NEET/: curl gave HTTP 000 (no connection); WebFetch gave HTTP 503 Service Unavailable.
- https://nta.ac.in/: curl gave HTTP 000; WebFetch gave HTTP 503 Service Unavailable.

Loaded successfully with curl (HTTP 200): https://neet.nta.nic.in/, https://neet.nta.nic.in/public-notices/, https://neet.nta.nic.in/information-bulletin/, https://neet.nta.nic.in/document-category/neetug-2025-public-notices/, and the 4 PDFs listed in Sources.

Local copies (untrusted downloads): /tmp/claude-0/-home-user-applyready/248aa1bc-20fd-5f45-b3b3-b31b7ab314a1/scratchpad/research/dl-neet/ (B26 sha256 2b688f32…4925). Rendered page images: /tmp/claude-0/-home-user-applyready/248aa1bc-20fd-5f45-b3b3-b31b7ab314a1/scratchpad/research/render-neet/
