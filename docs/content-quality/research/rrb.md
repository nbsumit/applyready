# RRB (Railway Recruitment Boards): photo/signature upload spec verification

Research date: 2026-10-24. Downloads: /tmp/claude-0/-home-user-applyready/248aa1bc-20fd-5f45-b3b3-b31b7ab314a1/scratchpad/research/dl-rrb/

## BOTTOM LINE

**I could not open any official RRB CEN document from this sandbox.** Every RRB host was unreachable by both curl and WebFetch, and so were the new consolidated RRB portal (rrb.indianrailways.gov.in) and every zonal railway subdomain. See section 4 for the full list.

Under the owner's rule, **no RRB pixel, KB, dimension or date value can be marked VERIFIED from this run.** Every baseline claim below is therefore marked **NOT FOUND IN OFFICIAL SOURCE (unverifiable from sandbox)**.

Search-engine snippets (not official, not opened) suggest that **the baseline may be wrong or out of date** for recent CENs. See the "Risk flags" section. Someone must open the CEN annexure from an Indian network before the RRB page states any numbers.

---

## 1. Upload items: verified values

| Item | Verified value | Quote | Document / CEN | Page | URL (confirmed loads?) |
|---|---|---|---|---|---|
| Photo: KB range | NONE | n/a | n/a | n/a | No CEN PDF loaded |
| Photo: pixels / mm | NONE | n/a | n/a | n/a | No CEN PDF loaded |
| Photo: format / background | NONE | n/a | n/a | n/a | No CEN PDF loaded |
| Photo: recency ("not older than X") | NONE | n/a | n/a | n/a | No CEN PDF loaded |
| Photo: no cap / goggles | NONE | n/a | n/a | n/a | No CEN PDF loaded |
| Signature: KB range | NONE | n/a | n/a | n/a | No CEN PDF loaded |
| Signature: pixels (incl. 140 x 60 min) | NONE | n/a | n/a | n/a | No CEN PDF loaded |
| Signature: ink / paper | NONE | n/a | n/a | n/a | No CEN PDF loaded |
| SC/ST free-travel certificate upload | NONE | n/a | n/a | n/a | No CEN PDF loaded |
| Live photo capture at exam centre | NONE (see related PIB item below) | n/a | n/a | n/a | n/a |

### The only official, loaded document with any related content (identity verification only, no upload specs)
- **PIB press release, Ministry of Railways, Release ID 2143531, "Posted On: 09 JUL 2025 8:33PM by PIB Delhi"**
  - URL: https://www.pib.gov.in/PressReleasePage.aspx?PRID=2143531 (redirects to `...&reg=48&lang=2`). **Loaded with curl (HTTP 200, real content).**
  - Quote: "E-KYC based Aadhar authentication has been used to authenticate identity of candidates for the first time in such large-scale exams achieving more than 95% success."
  - Quote: "Jammers are now being deployed 100 % across all exam centers of RRBs"
  - Use: the site may say, citing PIB, that RRBs use Aadhaar e-KYC authentication of candidates. The release says **nothing** about photo or signature sizes, live photo capture or face matching.

## 2. Officially documented upload steps and quirks

None could be read in an official document.

The one fact confirmed from an official page is a site migration. **https://www.rrbranchi.gov.in/** (loaded with curl, HTTP 200) shows "Redirecting to RRB Ranchi ... You will be redirected to the new Railway Recruitment Board, Ranchi website" and links to `https://rrb.indianrailways.gov.in/ranchi/`. So at least one RRB has moved to a consolidated portal under rrb.indianrailways.gov.in. Old `rrbxxx.gov.in/...pdf` links may be dead: two Ranchi PDF links found by search returned HTTP 404 (section 4). Any links the site has to old regional RRB PDFs should be re-checked.

## 3. Baseline claims

| Baseline claim | Status |
|---|---|
| Photo 30 KB to 70 KB | NOT FOUND IN OFFICIAL SOURCE (unverifiable). **Risk:** a snippet suggests 50 to 100 KB for CEN 08/2024 (see flags) |
| Photo 240 x 320 px | NOT FOUND IN OFFICIAL SOURCE (unverifiable) |
| Photo portrait 35 x 45 mm | NOT FOUND IN OFFICIAL SOURCE (unverifiable) |
| Photo JPG | NOT FOUND IN OFFICIAL SOURCE (unverifiable) |
| Photo white background | NOT FOUND IN OFFICIAL SOURCE (unverifiable). Snippets agree on "plain white background" |
| Signature 30 KB to 49 KB | NOT FOUND IN OFFICIAL SOURCE (unverifiable). A snippet says 30 to 49 KB for CEN 09/2025 |
| Signature 300 x 120 px | NOT FOUND IN OFFICIAL SOURCE (unverifiable) |
| Signature minimum 140 x 60 px | NOT FOUND IN OFFICIAL SOURCE (unverifiable). A snippet says 140 x 60 minimum for CEN 09/2025 |
| Signature JPG | NOT FOUND IN OFFICIAL SOURCE (unverifiable) |
| Black/blue ink on white paper | NOT FOUND IN OFFICIAL SOURCE (unverifiable). **Risk:** a snippet says rejection for "non-black ink" (CEN 09/2025), so "blue" may be wrong |
| Live photo at exam centre; recency; no cap/goggles; SC/ST free-travel certificate | NOT FOUND IN OFFICIAL SOURCE (unverifiable) |

### Risk flags (search-engine snippets only, NOT verified, do NOT publish)
These came from WebSearch result summaries of unofficial copies (Scribd, coaching and resizer sites) or of official PDFs I could not open. They are leads to check, not facts.
1. **CEN 08/2024 (Level 1):** a snippet of a Scribd copy reads "Recent, clear colour passport size photograph (against a plain white background) of the candidate in JPEG image (size 50 to 100 KB)". It also mentions no dark glasses or cap. This **conflicts with the baseline photo 30 to 70 KB.**
2. **CEN 05/2024 (NTPC) Corrigendum-1** (official URL from search, not opened: `https://rrbbhopal.gov.in/2024/Corrigendum- 1 of CEN 05-2024.pdf`): the snippet mentions photo "20 KB to 50 KB" and signature "10 KB to 40 KB" in one place, and "30 KB to 70 KB" elsewhere. The values may differ by context, such as the SC/ST certificate or another document.
3. **CEN 04/2024 (Paramedical)** (official URL from search, not opened: `https://rrbsecunderabad.gov.in/wp-content/uploads/2024/08/Detailed-CEN-04-2024-Paramedical-English.pdf`): the snippet says photo JPEG 30 to 70 KB on a plain white background. It also says the signature must be in running handwriting, not block capitals, and that candidates bring a printed copy of the same photo.
4. **CEN 09/2025 (Level 1, latest):** snippets of third-party copies say the signature is 30 to 49 KB, minimum 140 x 60 px, in a 35 mm x 20 mm box. They also say rejection for a non-white background, non-black ink, or block capitals. Some sources say **the photo is captured live in the online form, not uploaded.** If so, a "photo upload 30 to 70 KB" claim is out of date for the newest CENs.
5. Search also surfaced 2024 official re-upload notices for wrong photos and signatures: ALP CEN 01/2024 (window 27.05.2024 to 31.05.2024), Technician CEN 02/2024 (03.06.2024 to 07.06.2024) and RPF (15.06.2024 to 17.06.2024). These show that non-standard photos lead to rejection. None was opened.

**Recommendation:** until someone on an Indian network opens the detailed CEN annexure ("Instructions for filling online application") for CEN 08/2024, 07/2025 or 09/2025 and records quotes, the RRB page should not present 30 to 70 KB, 240 x 320, 300 x 120 or "blue ink" as official. At most, it should say that values vary by CEN and that candidates should check the detailed CEN on their RRB website. Candidate official URLs to open:
- https://www.rrbcdg.gov.in/uploads/2025/09-LVL1/092025-CEN.pdf (CEN 09/2025)
- https://www.rrbcdg.gov.in/2024-08-level1.php (CEN 08/2024 page)
- https://rrbbhopal.gov.in/CEN 08 2024.pdf
- https://rrbbhopal.gov.in/2024/Corrigendum- 1 of CEN 05-2024.pdf
- https://rrbsecunderabad.gov.in/wp-content/uploads/2024/08/Detailed-CEN-04-2024-Paramedical-English.pdf
- https://rrb.indianrailways.gov.in/<rrb-name>/ (new portal)

## 4. URLs that failed to load (all official)

| URL | curl | WebFetch |
|---|---|---|
| https://www.rrbcdg.gov.in/ (and rrbcdg.gov.in) | connection reset (tunnel closed) | 503 |
| https://www.rrbcdg.gov.in/uploads/2025/09-LVL1/092025-CEN.pdf | n/a (host reset) | 503 |
| https://www.rrbcdg.gov.in/2024-08-level1.php | n/a (host reset) | 503 |
| https://www.rrbchennai.gov.in/ | reset | 503 |
| https://www.rrbchennai.gov.in/downloads/Indicative-notice-08-2024-Eng-and-Hindi.pdf | n/a | 503 |
| https://rrbapply.gov.in/ | CONNECT 502 | DNS ENOTFOUND |
| https://www.rrbapply.gov.in/ | HTTP 404 from CloudFront/S3. The body is only an empty Angular shell; every JS bundle also returns the same 404 page, so there is no usable content | 404 |
| https://rrb.indianrailways.gov.in/ (and /ranchi/, /chandigarh/, /chennai/) | reset | 503 |
| https://rrbsecunderabad.gov.in/ and its CEN 04/2024 PDF, ALP re-upload notice, CEN 08/2024 category page | reset | 503 |
| https://rrbguwahati.gov.in/ and its CEN 02/2024 photo notice PDF | reset | 503 |
| https://rrbbhopal.gov.in/ (and www) and its CEN 05/2024 Corrigendum PDF | CONNECT 502 | DNS EAI_AGAIN |
| https://rrbmuzaffarpur.gov.in/Portal/NoticeBoard.aspx | reset | 503 |
| https://www.rrbbbs.gov.in/cen.php?prmt=... | reset | 503 |
| rrbmumbai, rrbahmedabad, rrbajmer, rrbbnc, rrbgkp, rrbjammu.nic.in, rrbkolkata, rrbmalda, rrbsiliguri, rrbthiruvananthapuram, rrbpatna (home pages) | reset or CONNECT 502 | not tried |
| https://rrbald.gov.in/, https://rrbbilaspur.gov.in/ | TLS failure: "certificate has expired" (verification not disabled) | not tried |
| https://rrbranchi.gov.in/upload/files/pdf/04_14_24pm142384bf87cab8ba2918a287b376265c.pdf and .../05_56_23pmc9dee150c965569d7ba768d19f6abb53.pdf | HTTP 404 (files removed) | not tried |
| ir, wr, er, ner, nfr, ecr, ecor, scr, ser, secr, swr, ncr, nwr, wcr, kr, mr, rdso, rrcb `.indianrailways.gov.in` | reset or 502 | not tried |
| https://web.archive.org/ | reset | "unable to fetch" |

### Official URLs that loaded but had no RRB upload specs
- https://indianrailways.gov.in/ (curl 200). Its site-wide PDF search (`/pdf/searchfromPdf?descriptionInput=`) found no CEN.
- https://rb.indianrailways.gov.in/ (Railway Board, curl 200). The CMS PDF search for "Centralised/Centralized Employment Notice", "CEN", "RRB", "photograph", "signature", "Assistant Loco Pilot", "live photograph", "e-KYC" and "free travel" returned only deputation vacancy circulars, manuals and Acts. No RRB CEN is mirrored there.
- https://www.rrbranchi.gov.in/ (curl 200): a redirect notice to rrb.indianrailways.gov.in/ranchi/ (section 2).
- https://www.pib.gov.in/PressReleasePage.aspx?PRID=2143531 (curl 200): Aadhaar e-KYC only (section 1).
