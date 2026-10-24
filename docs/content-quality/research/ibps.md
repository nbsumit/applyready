# IBPS upload specifications: verification from official sources

Research date: 2026-10-24. Every value below comes from official IBPS PDFs hosted on www.ibps.in. I downloaded each one and read it with `pdftotext -layout`. No news or coaching sites were used.

## How the official site was reached (TLS note)

- A plain `curl https://www.ibps.in/` fails with "unable to get local issuer certificate". `openssl s_client` shows that the server sends only the leaf certificate (`CN=*.ibps.in`, issuer `GlobalSign GCC R46 OV TLS CA 2025`) and leaves out the intermediate.
- **Fix used, with TLS verification still on:** I took the intermediate from the AIA URL in the leaf certificate (`https://secure.globalsign.com/cacert/gsgccr46ovtlsca2025.crt`). It is issued by `GlobalSign Root R46`, and `openssl verify` against the system trust store returns OK. The full chain `leaf -> intermediate -> GlobalSign Root R46` also verifies OK. I appended the intermediate to a copy of `/root/.ccr/ca-bundle.crt` and used `curl --cacert <bundle>`. I did not use `-k` or any other option that turns verification off.
- Bundle: `/tmp/claude-0/-home-user-applyready/248aa1bc-20fd-5f45-b3b3-b31b7ab314a1/scratchpad/research/certs/bundle2.pem`
- Downloads: `/tmp/claude-0/-home-user-applyready/248aa1bc-20fd-5f45-b3b3-b31b7ab314a1/scratchpad/research/dl-ibps/`
- WebFetch was not needed.

## Documents read (all "confirmed loads" via curl with the completed CA chain; HTTP 200, real PDF content)

| Short name | Title (from PDF) | Signed / date | Annexure pages (PDF page no.) | URL |
|---|---|---|---|---|
| **PO-XVI** (latest PO) | "NOTIFICATION CRP PO/MT-XVI ... RECRUITMENT OF PROBATIONARY OFFICERS/MANAGEMENT TRAINEES IN PARTICIPATING BANKS (Vacancies of 2027-28)" | "Mumbai DIRECTOR Date: 01.07.2026"; registration 01-07-2026 to 21-07-2026 | Annexure III, PDF pp. 39-43 (printed 36-40); 54 pp. | https://www.ibps.in/wp-content/uploads/Detailed-Notification_CRP-PO-XVI_Final_V1_30.06.2026.pdf |
| **CSA-XVI** (latest Clerk) | "NOTIFICATION CRP CSA-XVI ... CUSTOMER SERVICE ASSOCIATES (CSA) IN PARTICIPATING PUBLIC SECTOR BANKS (Vacancies of 2027-28)" | "Date: 01.08.2026"; registration 01.8.2026 to 21.08.2026 | **Annexure IV**, PDF pp. 55-58 (printed 52-55); 74 pp. | https://www.ibps.in/wp-content/uploads/Notification_CRP_CSA_XVI-Final.pdf |
| **RRB-XV** (latest RRB) | "CRP RRBs XV ... Officers (Scale-I, II & III) and Office Assistants (Multipurpose) in Regional Rural Banks" (Revised) | "Date: 01.09.2026"; registration 01.09.2026 to 21.09.2026 | Annexure III, PDF pp. 58-60 (printed 56-58); 76 pp. | https://www.ibps.in/wp-content/uploads/CRP-RRBs-XV-notification_Revised.pdf |
| **SPL-XVI** (latest SO) | "Detailed Notification CRP SPL-XVI" | "Date: 01.07.2026"; registration 01.07.2026 to 21.07.2026 | Annexure III, PDF pp. 44-46; 59 pp. | https://www.ibps.in/wp-content/uploads/Detailed-Notification-CRP-SPL-XVI_Final_V1_30.06.2026.pdf |
| PO-XV (previous) | CRP PO/MT-XV | "Date: 01.07.2025" | PDF pp. 38-41 | https://www.ibps.in/wp-content/uploads/Detailed-Notification_CRP-PO-XV_10.7.25.pdf |
| CSA-XV (previous) | CRP CSA-XV | "Date: 01.08.2025" | PDF pp. 55-57 | https://www.ibps.in/wp-content/uploads/DetailedNotification_CRP_CSA_XV_Final_for_Website_12.9.2025.pdf |
| RRB-XIV (previous) | CRP RRBs-XIV | "Date: 01.09.2025" | PDF pp. 53-55 | https://www.ibps.in/wp-content/uploads/CRP-RRBs-XIV_Final_AD-27.09.25.pdf |

The landing pages that link to these PDFs (curl, 200):
- https://www.ibps.in/index.php/management-trainees-xvi/
- https://www.ibps.in/index.php/clerical-cadre-xvi/
- https://www.ibps.in/index.php/rural-bank-xv/
- https://www.ibps.in/index.php/specialist-officers-xvi/
- https://www.ibps.in/index.php/crp-updates

I also read these 1-page corrigenda and notices. None of them mention photo, signature, thumb, declaration, KB or pixel, so none of them change the upload specs:
- Corrigendum-CRP-CSA_XVI_29.09.2026.pdf
- Corrigendum-CRP-RRBs-XV.pdf
- Corrigendum-CRP-RRBs-XV-1.pdf
- Corrigendum-CRP-RRBs-XV_25.09.2026.pdf
- Corrigendum-CRP-PO_MT-XVI_Vacancy_Update1.pdf
- PO_MT_Notice.pdf

All are under https://www.ibps.in/wp-content/uploads/.

**Consistency:** the photo, signature, thumb and declaration numbers are **identical in all 7 notifications** (PO-XV/XVI, CSA-XV/XVI, RRB-XIV/XV, SPL-XVI). The quotes below are from PO-XVI unless marked otherwise.

---

## 1. Per upload item

### Photograph
- **Verified values:**
  - 200 x 230 pixels (preferred)
  - 20 KB to 50 KB
  - "(4.5cm × 3.5cm)"
  - JPG/JPEG (from the general scanning rule)
  - Recent colour passport-style photo on a light, preferably white, background
- **Quotes** (PO-XVI, PDF p. 39):
  - "Photograph Image: (4.5cm × 3.5cm)"
  - "Dimensions 200 x 230 pixels (preferred)."
  - "Size of file should be between 20kb–50 kb."
  - "Ensure that the size of the scanned image is not more than 50kb. If the size of the file is more than 50 kb, then adjust the settings of the scanner such as the DPI resolution, no. of colours etc."
  - "Photograph must be a recent passport style colour picture."
  - "taken against a light-coloured, preferably white, background."
  - "Caps, hats and dark glasses are not acceptable. Religious headwear is allowed but it must not cover your face."
- **File type:** there is no "File type" line under the photo itself. The format comes from the general rule (PO-XVI, PDF p. 42): "The image file should be JPG or JPEG format. An example file name is: image01.jpg or image01.jpeg."
- Main body (PO-XVI clause (21)): "A recent, recognizable photograph (4.5cm × 3.5cm) should be uploaded by the candidate".

### Signature
- **Verified values:**
  - 140 x 60 pixels (preferred)
  - 10 KB to 20 KB
  - Black ink pen on white paper
  - Not in capital letters
  - JPG/JPEG (from the general rule)
- **Quotes** (PO-XVI, PDF p. 40):
  - "The applicant has to sign on white paper with Black Ink pen."
  - "Dimensions 140 x 60 pixels (preferred)."
  - "Size of file should be between 10kb – 20kb."
  - "Ensure that the size of the scanned image is not more than 20kb."
  - "Signature (NOT IN CAPITAL LETTERS) uploaded should be of appropriate size and clearly visible."
- PDF p. 42: "Signature / Hand written declaration in CAPITAL LETTERS shall NOT be accepted."
- "If the Applicant's signature on the attendance sheet or Call letter, signed at the time of the examination, does not match the signature uploaded, the applicant will be disqualified."
- No file-type line under signature itself; the general JPG/JPEG rule applies.

### Left thumb impression
- **Verified values:**
  - jpg / jpeg
  - 240 x 240 pixels in 200 DPI, i.e. 3 cm x 3 cm (Width x Height)
  - 20 KB to 50 KB
  - Black or blue ink on white paper
- **Quotes** (PO-XVI, PDF p. 40):
  - "The applicant has to put his left thumb impression on a white paper with black or blue ink."
  - "File type: jpg / jpeg"
  - "Dimensions: 240 x 240 pixels in 200 DPI (Preferred for required quality) i.e. 3 cm * 3 cm (Width * Height)."
  - "File Size: 20 KB – 50 KB."
- **Fallback rule** (quote): "If a candidate does not have left thumb, he/ she may use his/ her right thumb. If both thumbs are missing, the impression of one of the fingers of the left hand starting from the forefinger should be taken ... If no fingers are available, the impression of left toe may be taken." The candidate must then "specify in the uploaded document the name of finger and the specification of left/ right hand or toe."

### Hand-written declaration
- **Verified values:**
  - jpg / jpeg
  - 800 x 400 pixels in 200 DPI, i.e. 10 cm x 5 cm (Width x Height)
  - 50 KB to 100 KB
  - English only, black ink, white paper, the candidate's own handwriting, not in capital letters
- **Quotes** (PO-XVI, PDF p. 41):
  - "The applicant has to write the declaration in English clearly on a white paper with black ink."
  - "File type: jpg / jpeg"
  - "Dimensions: 800 x 400 pixels in 200 DPI (Preferred for required quality) i.e. 10 cm * 5 cm (Width * Height)"
  - "File Size: 50 KB – 100 KB"
  - "The hand written declaration has to be in the candidate's hand writing and in English only. The text should NOT BE IN CAPITAL LETTERS. If it is written by anybody else and uploaded or in any other language, the application will be considered as invalid."
- **Exception** (quote): "(In the case of candidates who cannot write, may get that text of declaration typed and put their left hand thumb impression (if not able to sign also) below the typed declaration and upload the document as per specifications)."
- **Exact declaration text, PO-XVI / CSA-XVI / SPL-XVI** (PO-XVI PDF p. 41; CSA-XVI PDF p. 57):
  > "I, __________ (Name of the candidate), hereby declare that all the information submitted by me in the application form is correct, true and valid. I will present the supporting documents as and when required."
- **RRB-XV differs by one word** (PDF p. 59): "...correct, true and valid. I will **submit** the supporting documents as and when required." RRB-XIV used "present".
- Wording difference: CSA-XVI and RRB-XV say "write the declaration in English only clearly on a white paper with black ink." PO-XVI says "in English clearly".

### Extra item the site may be missing: SSC / 10th certificate (and category certificates)
All current notices also require an SSC/10th certificate as a PDF (PO-XVI PDF p. 41; CSA-XVI p. 57; RRB-XV p. 59):
- "Document must be in PDF format."
- "Page size of the document to be A4."
- "Size of the file should not be exceeding 500 KB."

The same rules apply to the clause-specific certificate: PO "Clause J (ix)", CSA "Clause K (ix)", RRB "Certificate / UDID card as mentioned in Clause J (ix)" and "Clause J (x)".

---

## 2. Officially documented upload steps and quirks

**System blocks progress until specs are met** (Annexure intro):
> "Please note that until photographs and signature are as per the specifications provided, the system will not allow the candidate to move forward to the next stage of application."

**Live photo capture during the application** ("Photograph Capture", PO-XVI PDF p. 39; same in CSA-XVI and RRB-XV):
- "In addition to the above photograph, candidates will also be required to capture and upload their live photograph either by using webcam or mobile phone."
- "On selecting "Capture Photo" option, candidates' webcam will be activated allowing them to click their picture, which will get auto uploaded in the application form."
- "On selecting "Click here to Scan" option, candidates can use their mobile phone to scan the QR code, which will redirect to a website..."
- RRB-XV leaves out the word "live" ("capture and upload their photograph either by using webcam or their mobile phone"). Its main body still says "live photograph".

**Do's and Don'ts of Photo Capture** (PO-XVI PDF p. 40):
- Do's: "Ensure the photo is captured against a light coloured, preferably white background and there is adequate light."; "Look straight at the webcam/ camera."; "Photograph should be of passport size".
- Don'ts: "Small size photograph not to be clicked/ uploaded."; "Coloured glasses or sunglasses/ Cap should not be worn."; "Shadow on face/ not facing the camera/ distorted face/ face covered with mask / blurred image."; "Photo not to be taken in dark/ improper background."

**Photo and biometrics at later stages / exam** ("Biometric Verification", PO-XVI):
- "At different stages of the selection process: Photograph and Biometric data (Right thumb impression or otherwise) may be captured/ verified. The photo captured will be matched with the photo uploaded/ captured by the candidate in the application. Candidate must NOT change his/her appearance from the photo uploaded/ captured in the application."
- The same clause appears in CSA-XVI and RRB-XV.

**Scanning rules** ("Scanning the documents", PO-XVI PDF p. 42; identical in all notices):
- "Set the scanner resolution to a minimum of 200 dpi (dots per inch)."
- "Set Colour to True Colour."
- "File Size as specified above."
- "Crop the image in the scanner to the edge of the photograph/signature/ left thumb impression / hand written declaration, then use the upload editor to crop the image to the final size (as specified above)."
- "The image file should be JPG or JPEG format."
- "Scanned documents in any format can be saved in .jpg / .jpeg format by using 'Save As' option in the File menu. Size can be adjusted by using crop and then resize option."

**Upload procedure** (PO-XVI PDF p. 42):
- Separate links for each document.
- "If the file size and format are not as prescribed, an error message will be displayed."
- "Preview of the uploaded image will help to see the quality of the image. In case of unclear / smudged, the same may be re-uploaded."
- "Your Online Application will not be registered unless you upload your Photograph, signature, left thumb impression, hand written declaration, SSC/ SSLC/ 10th standard or equivalent certificate..."

**Notes** (PO-XVI PDF p. 43):
- "In case the face in the photograph/ signature/ ... is unclear / smudged the candidate's application may be rejected."
- "If photo in place of photo and signature in place of signature is not uploaded properly, candidate will not be allowed to appear for the exam."
- "The signature, left thumb impression and the hand written declaration should be of the applicant and not of any other person."

**Annexure title and number differ by notice:**
- PO-XVI: "ANNEXURE III: Guidelines for Scanning and Upload Of Documents"
- SPL-XVI: "ANNEXURE III: Guidelines for Scanning and Upload Of Documents"
- RRB-XV: "Annexure III: Guidelines for Scanning and Upload of Documents"
- CSA-XVI: "ANNEXURE IV: Guidelines for scanning and Upload of Documents"

---

## 3. Claims on the site: verdicts

| Claim | Verdict | Notes |
|---|---|---|
| Photo 20 KB – 50 KB | **VERIFIED** | "Size of file should be between 20kb–50 kb" |
| Photo 200 × 230 px | **VERIFIED** | IBPS calls it "(preferred)" |
| Photo 4.5 × 3.5 cm | **VERIFIED** | Exactly as written: "(4.5cm × 3.5cm)". IBPS gives no width/height order for it. |
| Photo JPG | **VERIFIED** | Via the general rule "JPG or JPEG format". There is no photo-specific file-type line. |
| Signature 10 KB – 20 KB | **VERIFIED** | |
| Signature 140 × 60 px | **VERIFIED** | "(preferred)" |
| Signature JPG | **VERIFIED** | Via the general JPG/JPEG rule |
| Signature black ink on white paper | **VERIFIED** | "sign on white paper with Black Ink pen" |
| Signature in CAPITAL letters not accepted | **VERIFIED** | |
| Thumb 20 KB – 50 KB | **VERIFIED** | |
| Thumb 240 × 240 px (3 × 3 cm) | **VERIFIED** | Add "in 200 DPI". The cm is "(Width * Height)". |
| Thumb JPG | **VERIFIED** | "File type: jpg / jpeg" |
| Thumb blue or black ink on white paper | **VERIFIED** | Official order is "black or blue ink" |
| Declaration 50 KB – 100 KB | **VERIFIED** | |
| Declaration 800 × 400 px (10 × 5 cm) | **VERIFIED** | Add "in 200 DPI"; "(Width * Height)" |
| Declaration JPG | **VERIFIED** | "File type: jpg / jpeg" |
| Declaration in English, own handwriting, black ink, not in capitals | **VERIFIED** | |
| Declaration text | **VERIFIED** (text given above) | RRB-XV says "submit" instead of "present" |
| Live photo capture during application | **VERIFIED** | Webcam ("Capture Photo") or mobile QR ("Click here to Scan") |
| Photo/biometric capture at the exam | **VERIFIED, with nuance** | IBPS says "At different stages of the selection process" a photograph and biometric (right thumb) "may be captured/ verified". It does not literally say "at the exam". |
| Scanning at a minimum of 200 DPI, True Colour | **VERIFIED** | |
| Missing from the site (if absent) | **ADD** | SSC/10th certificate upload: PDF, A4, up to 500 KB, in all current notices (PO-XVI, CSA-XVI, RRB-XV, SPL-XVI) |

None of the claims were found to be WRONG.

---

## 4. URLs that failed to load

- `https://www.ibps.in/` (and every ibps.in URL) with **default curl**: "SSL certificate problem: unable to get local issuer certificate". The server does not send the intermediate certificate. This was resolved as described at the top, with verification on.
- Some loads failed intermittently with "curl: (35) OpenSSL/3.0.13: error:0A0000F4:SSL routines::unexpected message". All of them succeeded on retry:
  - https://www.ibps.in/index.php/management-trainees/
  - https://www.ibps.in/index.php/regional-rural-bank/
  - https://www.ibps.in/index.php/specialist-officers/
  - DetailedNotification_CRP_CSA_XV_Final_for_Website_12.9.2025.pdf (3 failures before success)
  - CRP-RRBs-XV-notification_Revised.pdf (1 failure)
- No URL stayed unreachable.
