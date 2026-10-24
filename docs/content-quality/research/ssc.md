# SSC (Staff Selection Commission): verified upload specifications

Research date: 24 Oct 2026. Every value below comes from an official SSC PDF that was downloaded from ssc.gov.in with `curl` (HTTP 200, `application/pdf`) and read with `pdftotext -layout`. I checked page numbers against the "Page X of Y" footer printed in each PDF. Where a PDF prints only a bare page number, I give that printed number. I viewed the image-only annexure pages of the GD 2026 notice (Annexure-II/III screenshots) by rendering them with `pdftoppm`.

All notice PDFs are served from this base:
`https://ssc.gov.in/api/attachment/uploads/masterData/NoticeBoards/<file name>`

I found them through SSC's own notice-board API, which the ssc.gov.in front-end uses:
- `https://ssc.gov.in/api/general-website/portal/notice-boards?page=1&limit=100&contentType=notice-boards&key=createdAt&order=DESC&isAttachment=true&language=english&attributes=id,headline,examId,contentType,redirectUrl,startDate,endDate,language,createdAt` (curl, 200)
- `https://ssc.gov.in/api/general-website/portal/getBykey?...&contentType=notice-boards&queryKey=examId,examYear&queryValue=<examId>,2026` (curl, 200). I used this one to reach the CHSL 2026, JE 2026 and CPO 2026 notices.

## Documents read (all confirmed loads, via curl)

| # | Document | File no. | Upload date | URL |
|---|---|---|---|---|
| A | Notice: Combined Graduate Level Examination, 2026 (132 pp) | F. No. HQ-C11018/1/2026-C-1 | 21-05-2026 | https://ssc.gov.in/api/attachment/uploads/masterData/NoticeBoards/Notice_of_adv_cgl_2026.pdf |
| B | Notice: Combined Graduate Level Examination, 2025 (113 pp) | F. No. HQ-C11018/1/2025-C-1 | 09-06-2025 | https://ssc.gov.in/api/attachment/uploads/masterData/NoticeBoards/CGLE_2025%20Notice_Approved%20final_09062025.pdf |
| C | Notice: Combined Higher Secondary (10+2) Level Examination, 2026 (88 pp) | F. No. HQ-C1102/5/2026-C-1 | 07-09-2026 | https://ssc.gov.in/api/attachment/uploads/masterData/NoticeBoards/Notice_of_adv_chsle_2026.pdf |
| D | Notice: Combined Higher Secondary (10+2) Level Examination, 2025 (89 pp) | F. No. HQ-C1102/9/2025-C-1 | 23-06-2025 | https://ssc.gov.in/api/attachment/uploads/masterData/NoticeBoards/Notice_of_adv_chsl_2025.pdf |
| E | Notice: Multi-Tasking (Non-Technical) Staff and Havaldar (CBIC & CBN) Examination, 2025 (87 pp) | F.No.- E/15/2025-C-2 | 26-06-2025 | https://ssc.gov.in/api/attachment/uploads/masterData/NoticeBoards/Notice_of_adv_mts_2025.pdf |
| F | Notice: Constable (GD) in CAPFs and SSF, and Rifleman (GD) in Assam Rifles Examination, 2026 (74 pp) | F. No. HQ-C-3007/10/2025-C-3 | 01.12.2025 | https://ssc.gov.in/api/attachment/uploads/masterData/NoticeBoards/Notice_of_CTGD_2026.pdf |
| G | Advertisement No. Phase-XIV/2026/Selection Posts | File No. HQ-RHQS015/1/2026/C-4 | 13 Apr 2026 | https://ssc.gov.in/api/attachment/uploads/masterData/NoticeBoards/Notice_of_RHQ_2026_phase_xiv.pdf |
| H | Notice: Stenographer Grade 'C' & 'D' Examination, 2026 | F. No.: E/13/2026-C-2 | 24 Apr 2026 | https://ssc.gov.in/api/attachment/uploads/masterData/NoticeBoards/Notice_of_adv_steno_2026.pdf |
| I | Notice: Junior Engineer Examination, 2026 (97 pp) | F. No. HQ-C-3019/1/2026-C-3 | 02.09.2026 | https://ssc.gov.in/api/attachment/uploads/masterData/NoticeBoards/Notice_of_adv_je_2026.pdf |
| J | Notice: Sub-Inspector in Delhi Police and CAPFs Examination, 2026 (69 pp) | (file no. not in the extracted text) | 10.09.2026 | https://ssc.gov.in/api/attachment/uploads/masterData/NoticeBoards/Notice_of_adv_capf_2026.pdf |
| K | Notice "Regarding OTR and Application Module" | F. No. HQ-PPII010/1/2024-PP_II-Part(1) | 01.04.2024 | https://ssc.gov.in/api/attachment/uploads/masterData/NoticeBoards/Notice%20reg.%20OTR_010424.pdf |
| L | Notice "Application through mySSC Mobile App" | F. No. HQ-IT018/4/2024-IT (E-10517) | 02.06.2025 | https://ssc.gov.in/api/attachment/uploads/masterData/NoticeBoards/notice_app_02062025_02_06_2025.pdf |
| M | "Advisory to Candidates with respect to Photo and signatures" (4 pp) | — | 15-08-2024 | https://ssc.gov.in/api/attachment/uploads/masterData/NoticeBoards/instructions_photo_signature_15_08_2024.pdf |
| N | Notice on Aadhaar-enabled OTR | F. No. HQ-IT018/4/2024-IT (E-10517) | 09/05/2025 (posted 14-05-2025) | https://ssc.gov.in/api/attachment/uploads/masterData/NoticeBoards/Notice_14052025_1.pdf |

No MTS 2026 notice had been published as of 24 Oct 2026. MTS 2026 appears only as an `ssc-calendar` entry, and the `getBykey` lookup for exam ids `gh67ytxj8tmts26` and `wzeujzxj8ts5z9n` with year 2026 returned no notices. MTS 2025 (E) is therefore the latest MTS notice.

---

## 1. Upload items and verified specs

### 1a. Photograph: captured live, not uploaded as a file. No KB size or cm/px dimensions are published.

Since 2024 every current SSC notice says the photo is **captured live by the application module** through a webcam, a mobile device or the mySSC app. The candidate does not upload a scanned or pre-existing photo. **None of the 14 documents states a KB range, a cm size or a pixel size for the photograph.** I searched every extracted text for "50 KB", "3.5 cm", "4.5 cm", "pixel" and "MB" and found no match.

| Notice | Verbatim quote | Page |
|---|---|---|
| A CGL 2026 §9.4 | "For applying, the candidate is not required to have a pre-existing photograph of himself/ herself. The application module has been designed to capture a photograph of the candidate filling up the application form." | p.18 of 132 |
| A CGL 2026 Annexure-IV | "In the online Application Form, candidates are required to capture their live photo through webcam/mobile device and upload." | p.71 of 132 |
| B CGL 2025 §9.4 | "For applying, the candidate is not required to have a pre-existing photograph of himself/ herself. The application module has been designed to capture a photograph of the candidate filling up the application form." | p.13 of 113 |
| C CHSL 2026 §9.4 | Same wording as A §9.4. | p.11 of 88 |
| D CHSL 2025 §9.4 | Same wording as A §9.4. | p.12 of 89 |
| E MTS 2025 §10.4 | "...follow the following instructions while capturing live photographs" | p.13 of 87 |
| F GD 2026 §8.4 | "The Online Application Module has been so designed to capture a real-time photograph of the candidate while filling up the Online Application Form." | p.9 of 74 |
| G Selection Post XIV §11.7 | "The application module has been so designed to capture real-time photograph of the candidate while filling up the application form." | printed p.13 |
| H Steno 2026 §9.6 | Same wording as A §9.4. | printed p.13 |
| I JE 2026 §10.4 | "The Online Application Module has been so designed to capture a real-time photograph of the candidate while filling up the Online Application Form." | p.15 of 97 |
| J CPO 2026 §8.4 | "...the application module has been so designed to capture a real-time photograph of the candidate while filling up the Online Application Form." | p.10 of 69 |

**Photo-capture rules** (the same five points appear in every notice; this wording is from A §9.4, p.18):
- "(i) Find a place with good light and plain background."
- "(ii) Ensure the camera is at eye level before taking the photo."
- "(iii) Position himself directly in front of the camera and look straight ahead."
- "(iv) Ensure that his face is fully inside the prescribed area delineated by the camera and that it is neither too close nor too far."
- "(v) Candidates should not wear a cap, mask or glasses/spectacles while capturing the photo."
- MTS 2025 §10.4 (p.13) adds: "Candidate should not wear a cap, mask, glasses/spectacles or earphones/ headphones while capturing the photo".
- GD 2026 Annexure-II item 20(g) (p.48 of 74) adds: "Do not wear earphones or any device while capturing Photos."
- Pre-existing photos are banned. A §9.5 (p.18): "In no case should the candidate capture the photographs of his/her pre-existing photograph. All such applications where the photographs of his/her pre-existing photograph is captured will be rejected."
- Reasons SSC gives for rejecting photos (M p.3; repeated as GD 2026 Annexure-III (3/4), p.59 of 74): "(i) Photo without plain background. (ii) Candidates wearing caps (iii) Candidates taking photos without shirts. (iv) Photo not sufficiently bright. (v) Photo is blurred".

### 1b. Signature: scanned JPEG/JPG, 10–20 KB, "about 6.0 cm (width) x 2.0 cm (height)"

The main body of **every** notice says 10–20 KB, JPEG/JPG, about **6.0 cm × 2.0 cm**. Some notices also have an Annexure (the step-by-step online application instructions) that says **4.0 cm × 2.0 cm** instead. This contradiction sits inside SSC's own documents. Both versions are listed below.

| Notice | Verbatim quote (main body) | Page |
|---|---|---|
| A CGL 2026 §9.6 | "Candidates are required to upload the scanned signature in JPEG/JPG format (10 to 20 KB). Image dimension of the signature should be about 6.0 cm (width) x 2.0 cm (height)." | p.18 of 132 |
| B CGL 2025 §9.6 | same as A | p.14 of 113 |
| C CHSL 2026 §9.6 | same as A | p.12 of 88 |
| D CHSL 2025 §9.6 | same as A | p.12 of 89 |
| E MTS 2025 §10.6 | same as A | p.13 of 87 |
| F GD 2026 §8.7 | "Candidates are required to upload the scanned signature in JPEG format (10 to 20 KB). The image dimension of the signature should be about 6.0 cm (width) x 2.0 cm (height)." | p.10 of 74 |
| G Selection Post XIV §11.10 | "Candidates are required to upload their signature duly scanned in JPEG/JPG format (10 to 20 KB). The image dimension of signature should be about 6.0 cm (Width) x 2.0 cm (Height)." | printed p.14 |
| H Steno 2026 §9.9 | same as A | printed p.14 |
| I JE 2026 §10.6 | same as F | p.15 of 97 |
| J CPO 2026 §8.6 | same as F | p.11 of 69 |

**Annexures that say 4.0 cm × 2.0 cm (conflicting):**

| Notice | Verbatim quote | Page |
|---|---|---|
| A CGL 2026 Annexure-IV 1(b) | "The scanned signature in JPEG/JPG format (10 to 20 KB). The image dimension of signature should be about 4.0 cm (Width) x 2.0 cm (Height)." | p.71 of 132 |
| B CGL 2025 Annexure-IV 1(b) | same wording, 4.0 cm × 2.0 cm | p.57 of 113 |
| C CHSL 2026 Annexure-IV 1(b) | "Scanned signature in JPEG format (10 to 20 KB). Image dimension of the signature should be about 4.0 cm (width) x 2.0 cm (height)." | p.53 of 88 |
| D CHSL 2025 Annexure 1(b) | same as C, 4.0 cm × 2.0 cm | p.53 of 89 |
| G Selection Post XIV Annexure-V 1(b) | same as A annexure, 4.0 cm × 2.0 cm | printed p.51 |
| J CPO 2026, Important Instructions | "...image dimension of the signature should be about 4.0 cm (width) x 2.0 cm (height)." | p.32 of 69 |

The annexures of **E MTS 2025 (p.56), F GD 2026 (p.45, p.48), H Steno 2026 (printed p.49), I JE 2026 (p.65) and J CPO 2026 (p.47) say 6.0 cm × 2.0 cm**, which matches their main bodies. Because both the main body of every notice and the most recent screenshot of the portal say 6.0 × 2.0, 6.0 × 2.0 is the better-supported value.

**Extra signature details from the official documents:**
- GD 2026 Annexure-II item 21 (p.48 of 74): "a. Allowed image size: 10KB to 20KB in JPEG/JPG Format. b. Image Dimension: About 6.0 cm (width) X 2.0 cm (height) at a resolution of 300 DPI." This is the only place SSC gives a DPI figure. The same text appears in the screenshot of the "Upload Photograph & Signature" portal page (Annexure-II, p.56 of 74). SSC does not publish a pixel size anywhere. A pixel figure can only be worked out from "6.0 cm at 300 DPI", and SSC does not state that calculation.
- "Signature should be horizontally aligned." (GD 2026 Annexure-II item 21(d), p.48)
- Miniature signatures (M p.1; GD 2026 Annexure-III (1/4), p.57 of 74): "The major reasons for rejection of signatures are 'miniature' signatures. Candidates are advised to cut the box and then sign within the box such that signature occupies at least 80% of the box."
- Thumb impression (A Annexure-IV, p.71): "For the PwD(VH) candidates, the thumb impression is also allowed."

### 1c. Other uploads named in the notices

- **Disability certificate (PwBD/PwD), at the application stage.** A §9.7 (p.19): "PwBD and PwD candidates willing to avail the benefit of reservation or scribe or both are required to upload Certificate of Disability as per Annexure-I, Annexure-IA and Annexure-XII to XIII whichever is applicable, at the time of filling online application form." **The notices give no file format or KB limit for this upload.**
- **OTR documents for candidates without Aadhaar authentication.** G Selection Post XIV (printed p.40–41): "If you don't have Aadhaar Number you are required to upload the following documents:- (i) For Proof of Name ... (ii) For Proof of Date of Birth ... (iii) For Proof of Address ... (iv) Photograph. (v) For Proof of Gender". **No format or size is given.**
- **Selection Posts, after the CBE.** G §19.9: shortlisted candidates "will be required to upload self-attested copies of all the supporting documents in respect of Educational Qualification (EQ), Experience, Category, Age, Age-relaxation, etc." **No format or size is given.**

---

## 2. Upload steps and portal quirks documented by SSC

1. **New portal, new OTR.** A §9.2 (p.17–18): candidates who "have not generated their One-Time Registration (OTR) on the new website (https://ssc.gov.in) will be required to do so as the earlier OTR generated on the old website (https://ssc.nic.in) will not be functional for the new website."
2. **Live photo replaced uploaded photo from 2024.** K (01.04.2024): "This is a change from the earlier dispensation wherein the candidates were required to upload a photograph already captured. In the new application module, live photographs of the candidates will be captured for which either a webcam on computer/ laptop or an android device can be used."
3. **QR code / mobile app as a fallback for the photo.** A Annexure-IV (p.71): "Candidates who are unable to capture their live photo through web cam/mobile device are advised to use QR code provided at Sl. No. 2 of Upload Documents page for downloading the app from play store for capturing their live photo through mobile device."
4. **Whole application can be filed in the mySSC app.** L (02.06.2025): "Starting from June 2025, the entire application process can now be completed seamlessly within the app itself." Also: "The Mobile app works only on Android phones with version 11 or higher." Candidates "must also install the Aadhaar Face RD app on their phone to complete face authentication".
5. **Two ways to apply.** F §8.2 (p.9): "The Online Application Form must be submitted only in online mode, either at the website of SSC (HQ) (https://ssc.gov.in) or through the 'mySSC' mobile application (which can be downloaded from the Google Play Store)."
6. **Aadhaar-enabled OTR from 2 June 2025.** N: "the One Time Registration (OTR) will be Aadhaar-enabled for 2025 examination cycle and onwards i.e. from 02nd June 2025."
7. **Aadhaar authentication waives photo and signature rejection.** A §9.3 (p.18): "The application(s) of the Candidates who opt for Aadhaar Authentication will not be rejected on the ground that photograph and/or signature uploaded by the candidate are not as per prescribed standards."
8. **Appearance on exam day must match the captured photo.** A §9.5 (p.18): "The appearance of a candidate in the examination should be as per the photograph in the application form."
9. **Check before submitting.** A §9.11 (p.19): "They should also check that photograph and signature are meeting all the above requirements."
10. **Face-authentication step on the portal.** The GD 2026 Annexure-II screenshot (p.56 of 74) shows the order "1. Face Authentication Status", then "2. Capture Your Photograph" with a "Capture Live Photo" button, then "3. Upload Your Signature" with an "Upload Signature" button.
11. **Photo age rule.** No "photo not older than X" rule exists in any of the notices. It would not apply anyway, because the photo is captured live.

---

## 3. The site's current claims

| Claim on the site | Verdict | Correct value and source |
|---|---|---|
| Photo 20 KB – 50 KB | **NOT FOUND IN OFFICIAL SOURCE** (and outdated in practice) | The current notices (A–J) set no photo KB range because the photo is captured live (A §9.4 p.18; K). |
| Photo 3.5 × 4.5 cm (~350 × 450 px) | **NOT FOUND IN OFFICIAL SOURCE** | No photo dimensions appear in any current notice. |
| Photo JPEG | **NOT FOUND IN OFFICIAL SOURCE** | No photo file format is specified, because the photo is captured live. |
| Light/white background | **Partly verified, needs rewording** | The source says "Find a place with good light and plain background" (A §9.4 p.18). It says "plain", not "white". "Photo without plain background" is listed as a rejection reason (M p.3). |
| Frontal face | **VERIFIED** | "...photograph captured is clear, without cap or spectacles, and with a full frontal view" (A §9.5 p.18). |
| No caps or dark glasses | **VERIFIED, but stricter than stated** | "should not wear a cap, mask or glasses/spectacles" (A §9.4 p.18). This covers **all** glasses, not only dark ones, plus masks. MTS 2025 and GD 2026 also ban earphones and headphones. |
| Signature 10 KB – 20 KB | **VERIFIED** | "JPEG/JPG format (10 to 20 KB)" (A §9.6 p.18, and every other notice). |
| Signature 4.0 × 2.0 cm | **WRONG in the main rule** | The main body of every notice says "about 6.0 cm (width) x 2.0 cm (height)" (A §9.6 p.18; F §8.7 p.10; I §10.6 p.15). Only some annexures (A p.71, B p.57, C p.53, D p.53, G printed p.51, J p.32) say 4.0 × 2.0, which contradicts their own main body. |
| Signature ~400 × 200 px | **NOT FOUND IN OFFICIAL SOURCE** | SSC gives no pixel size. The only extra detail is "at a resolution of 300 DPI" (F Annexure-II p.48). |
| Signature JPEG | **VERIFIED** | "JPEG/JPG format" (A §9.6); "JPEG format" (F §8.7). |
| Live photo via webcam/app on the new portal | **VERIFIED** | K (01.04.2024); A Annexure-IV p.71; L (02.06.2025). |

---

## 4. URLs that did not load

- `https://ssc.nic.in/` (the old SSC website). curl failed with "Recv failure: Connection reset by peer" (proxy reported ws_closed_mid_exchange). WebFetch returned HTTP 503 Service Unavailable. Because of this I could not check the old site's legacy photo spec (the likely origin of "20–50 KB, 3.5 × 4.5 cm").
- `https://ssc.gov.in/api/general-website/portal/notice-boards?page=1&limit=50&contentType=notice-boards` returned HTTP 203 "Invalid attributes in request" (an `attributes` parameter is required). The same request with `limit=600` returned "Invalid 'limit' parameter" (the maximum is 100). Both worked once the parameters were corrected.
- `https://ssc.gov.in/api/general-website/portal/getBykey?id=dd7znmp89av4jzgqnu2o2` returned HTTP 500. It works when queried by `queryKey=examId,examYear`, as described at the top.
