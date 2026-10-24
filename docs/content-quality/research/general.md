# ApplyReady: verified official sources (general)

Fetched 2026-10-24. Every URL listed as "OK" returned HTTP 200 with real content, and I read the quoted text from the downloaded file. Copies are saved in
`/tmp/claude-0/-home-user-applyready/248aa1bc-20fd-5f45-b3b3-b31b7ab314a1/scratchpad/research/dl-general/`.
Quotes are verbatim. In PDF quotes, line breaks are joined and nothing else is changed. "[sic]" marks a typo in the source.

---

## 1. Passport Seva (MEA): photograph specifications

**OK: https://www.passportindia.gov.in/AppOnlineProject/pdf/ApplicationformInstructionBooklet-V3.0.pdf**
- Fetch: curl (HTTP 200, application/pdf, 21 pages). Read with pdftotext.
- Title (first line of document): "INSTRUCTIONS FOR FILLING OF PASSPORT APPLICATION FORM AND SUPPLEMENTARY FORM"
- Quote (scope): "Photograph is NOT REQUIRED for applications submitted at Passport Seva Kendra (PSK), Post Office Passport Seva Kendra (POPSK)."
- Quote (spec, Table 1 "DOs and DON'Ts concerning Photograph to be submitted at DPC/SPC/CSC"): "Paste your recent passport size photograph (4.5 cm length x 3.5 cm width) in colour in the box meant for affixing the photograph" / "Background of the photograph should be plain white, and the dress should be in dark colour"
- Other verbatim items in the same table: "Frontal view of the full face should be visible in the photograph"; "Expression of the face should be natural (no grinning, frowning or raised eyebrows)"; "Eyes must be open and both edges of face must be clearly visible"; "Head should be in the centre of the frame and both ears should be visible"; "Photograph in computer print will not be accepted"; "Photograph is NOT to be signed"; "Head coverings are not permitted except for religious reasons, but the facial features from bottom of chin to top of forehead and both edges of the face must be clearly visible"; "Photographs cut from group photographs are not acceptable".
- Spec numbers: 4.5 cm length x 3.5 cm width; colour; plain white background.
- Note: this covers printed photos pasted on paper forms at DPC/SPC/CSC. In India the applicant does not upload a photo for PSK/POPSK applications. I found no official upload spec (pixels/KB) on passportindia.gov.in. The 630x810 px "ICAO-compliant" upload figure that search engines show comes from Indian missions abroad (Global Passport Seva), and I did **not** verify it.

**Partial: https://www.passportindia.gov.in/psp**
- curl returned HTTP 200 this time, but the page is an empty React shell (`<title>Passport Seva</title>`, "You need to enable JavaScript to run this app."), so there is nothing to quote. The JS bundle does not contain a photo-spec page or PDF link.

## 2. UIDAI (Aadhaar)

**OK: https://uidai.gov.in/en/updating-data-on-aadhaar**
- Fetch: curl (HTTP 200). Next.js page; I took the text from the server-rendered HTML.
- Title: "Updating Data on Aadhaar - Unique Identification Authority of India | Government of India"
- Quote (biometric data includes the photo): "Biometric Information Iris, Finger Prints and Facial Photograph"
- Quote (online update covers address only): "The online mode offers address update to the Aadhaar number holders where the Aadhaar number holder can directly place the address update request on the myAadhaar portal."
- Quote (upload): "To complete the update process, Aadhaar number holder needs to upload the supporting POA documents"
- Quote (photo and biometrics need a centre visit): "Aadhaar number holders place the demographic/biometric update request with the help of an operator at an Aadhaar Enrolment Centre . In such a case, the documentary evidence is collected by the operator at the time of accepting the request."
- Page metadata: "Published on : 04 May 2026 Last Updated : 17 Sep 2026".
- Note: the page shows "Doc Type: PDF Size: 1.6MB" next to its links. That is the size of the linked list-of-documents PDF, **not** an upload limit. I found no official upload file-size or format limit for myAadhaar.

**OK: https://uidai.gov.in/en/enrolment-and-updates** (title "Enrolment & Updates - Unique Identification Authority of India | Government of India")
- Fetch: curl (HTTP 200). It lists the enrolment/update forms (PDF) and "List of Acceptable Document for Aadhaar Enrolment and Update | English (PDF, 2.08 MB)".
- The site menu labels the photo update "Photo, Biometric Update & more" (described as "Refresh Photo & Biometrics") and links it to https://bookappointment.uidai.gov.in/ (not fetched), which fits with photo updates being done at a centre.

**FAILED / not verified (UIDAI):**
- https://backend.uidai.gov.in/get/files/media/document/2026-06/List_of_Supporting_Document_for_Aadhaar_Enrolment_and_Update.pdf: curl connection reset (4 tries); WebFetch HTTP 503.
- https://uidai.gov.in/images/commdoc/26_JAN_2023_Aadhaar_List_of_documents_English.pdf: HTTP 404 (old site, removed).
- https://uidai.gov.in/en/1045-english-uk/faqs/.../13902-which-are-the-documents-required-for-updation-in-aadhaar-address.html: HTTP 404.
- https://uidai.gov.in/en/documents: connection reset.
- https://uidai.gov.in/get/files/media/document/2026-09/Aadhaar_Enrolment__and__Update__-__English.pdf: HTTP 404.
- https://myaadhaar.uidai.gov.in/: curl connection reset; WebFetch 503.

## 3. PAN: photo and signature scan specifications

**OK: https://tin.tin.proteantech.in/pan/form49Adsc.html**
- Fetch: curl (HTTP 200). The spec text is live page content, not inside an HTML comment (checked).
- Title: "Guidelines for filling PAN New Application". Page heading: "DSC based Online Application for New PAN (Form 93 / Form 94) Guidelines"
- Quote: "PAN applicants should have scanned image of photograph, signatures and supporting documents i.e. Proof of Identity (POI) /Proof of Address (POA) /Proof of Date of Birth (PODB). The photo/signature and supporting documents should be scanned as per following specifications"
- Spec table, verbatim:

| Parameters | Photograph | Signature | Supporting documents |
|---|---|---|---|
| Resolution (in DPI) | 200 DPI | 200 DPI | 200 DPI |
| Type | Color | Color | Black & White |
| File type | JPEG | JPEG | PDF/A or JPEG |
| Size | Max. 20 KB | Max. 10 KB | Max. 300KB/per page |
| Dimension | 3.5X2.5 cms. | 2X4.5 cms | |

- Note: this is the guideline page for the **DSC-based** online route. The page names the forms "Form 93 / Form 94" (the new forms under the Income-tax Rules, 2026), not 49A/49AA.

**OK, but its numbers conflict with the page above: https://cms.proteantech.in/articles/pan-card-documents-scanning-uploading-method**
- Fetch: curl (HTTP 200). Title: "Documents for Scanned PAN Card Application". This is an article on Protean's own content site.
- Quote: "Photograph: Format: JPEG Resolution: 200 DPI Size: Maximum 50 KB Dimensions: 5 cm x 2.5 cm Signature: Format: JPEG Resolution: 200 DPI Size: Maximum 50 KB Dimensions: 2 cm x 4.5 cm Supporting Documents (ID/Address/DOB Proofs): Format: PDF Size: Maximum 300 KB per page"
- WARNING: these figures (50 KB, 5 cm x 2.5 cm) disagree with the official guideline page above (20 KB / 10 KB, 3.5 x 2.5 cm). Cite the tin.tin.proteantech.in guideline page for specs, and do not merge the two sets of figures.

**OK (context): https://onlineservices.proteantech.in/paam/endUserRegisterContact.html**
- Fetch: curl (HTTP 200). Title: "PAN Card Services Online | Apply for PAN Card | Easy PAN Card Application". No photo spec text in the live (uncommented) content. A notice saying scanned applications were "not available" is inside an HTML comment, so I did not treat it as current.

**OK (UTIITSL, no photo spec found): https://www.pan.utiitsl.com/** (title "PAN Card | PAN Card Online | PAN Card Services | PAN Card Apply") and https://www.pan.utiitsl.com/faqs.html: curl 200, but no DPI/KB/dimension text.
- https://www.pan.utiitsl.com/downloadFile?FileName=DocumentsForPAN.pdf (curl 200, PDF): a document list only. First lines: "Form No F93 Document acceptable as Proof of Identity , Proof of Address and Proof of Date of Birth as per Rule 158 of Income Tax Rules, 2026". No scan specs.

**FAILED (PAN):** https://tin.tin.nsdl.com/pan/form49Adsc.html, https://tin.tin.nsdl.com/pan/InstructionDSC.html, https://tin.tin.nsdl.com/pan/correctiondsc.html (curl: proxy CONNECT 502); https://www.onlineservices.nsdl.com/paam/endUserRegisterContact.html (curl 502; WebFetch DNS ENOTFOUND); https://www.utiitsl.com/ (connection reset). The old nsdl.com hosts appear to have moved to *.proteantech.in.

## 4. ICAO Doc 9303 / portrait quality

**OK (catalogue page only): https://store.icao.int/en/machine-readable-travel-documents-part-3-specifications-common-to-all-mrtds-doc-9303-3**
- Fetch: curl (HTTP 200).
- Title: "Machine Readable Travel Documents - Part 3 - Specifications Common to all MRTDs (Doc 9303-3) | ICAO Store"
- Quote: "8th Edition, 2021 USD 88.00 Please note the digital version can be downloaded free of charge: DOC Series (icao.int)"
- SKU "DOC-09303-008-03", Order No. "9303P3".
- I could not load the document text, so this source gives **no** portrait specs (pixel size, face ratio, background). Do not attribute any photo numbers to ICAO from this page.

**FAILED (ICAO):** https://www.icao.int/publications/pages/publication.aspx?docnum=9303 (curl 403, WebFetch 403); https://www.icao.int/publications/Documents/9303_p3_cons_en.pdf (curl 403); https://www.icao.int/Security/FAL/TRIP/PublishingImages/Pages/Publications/ICAO%20TR%20-%20Portrait%20Quality%20v1.0.pdf (curl 403, WebFetch 403).

## 5. Image formats

**OK: https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Image_types**
(The URL in the brief, /docs/Web/Media/Formats/Image_types, redirects here. Link the final URL.)
- Fetch: curl (HTTP 200). Title: "Image file type and format guide - Media | MDN". "This page was last modified on Oct 8, 2026 by MDN contributors."
- Quote (JPEG): "The JPEG (typically pronounced " jay-peg ") image format is currently the most widely used lossy compression format for still images. It's particularly useful for photographs; applying lossy compression to content requiring sharpness, like diagrams or charts, can produce unsatisfactory results."
- Quote (choosing): "JPEG is lossy, so it is often a good fallback format for photographs, while PNG is lossless, making it better for screenshots, diagrams, and line art. PNG is also the fallback for any image needing transparency, as JPEG has no alpha channel."
- Quote (PNG summary row): "PNG is preferred over JPEG for more precise reproduction of source images, or when transparency is needed."
- Quote (WebP): "Lossy WebP images are on average 25–35% smaller than JPEG images of visually similar compression levels."

**OK: https://www.w3.org/TR/png-3/**
- Fetch: curl (HTTP 200). Title: "Portable Network Graphics (PNG) Specification (Third Edition)". Status: "W3C Recommendation 24 June 2025".
- Quote: "This document describes PNG (Portable Network Graphics), an extensible file format for the lossless , portable, well-compressed storage of static and animated raster images. PNG provides a patent-free replacement for GIF and can also replace many common uses of TIFF."

**OK: https://developers.google.com/speed/webp**
- Fetch: curl (HTTP 200). Title: "An image format for the Web | WebP | Google for Developers"
- Quote: "WebP is a modern image format that provides superior lossless and lossy compression for images on the web." / "WebP lossless images are 26% smaller in size compared to PNGs. WebP lossy images are 25-34% smaller than comparable JPEG images at equivalent SSIM quality index."
- Statistics: 26% (lossless vs PNG) and 25-34% (lossy vs JPEG) are Google's own figures. Attribute them to Google if you use them. MDN gives "25–35%" for the same comparison.

**OK (extra): https://developers.google.com/speed/webp/docs/riff_container**
- Fetch: curl (HTTP 200). Title: "WebP Container Specification | Google for Developers"
- Quote: "WebP is an image format that uses either (i) the VP8 key frame encoding to compress image data in a lossy way or (ii) the WebP lossless encoding." / "The WebP file format is based on the RIFF (Resource Interchange File Format) document format."

**OK: https://jpeg.org/jpeg/**
- Fetch: curl (HTTP 200). Title: "JPEG - JPEG 1"
- Quote: "The JPEG 1 standard (ISO/IEC 10918) was created in 1992 (latest version, 1994) as the result of a process that started in 1986." / "Part 1 of JPEG 1 (ISO/IEC 10918-1 | ITU-T Recommendation T.81) specifies the core coding technology and it incorporates many options for encoding photographic images." / "Part 5 specifies the JPEG File Interchange Format (JFIF)."

## 6. PDF format

**OK: https://www.loc.gov/preservation/digital/formats/fdd/fdd000474.shtml** (Library of Congress, Sustainability of Digital Formats)
- Fetch: curl (HTTP 200). Title: "PDF 2.0, ISO 32000-2 (2017, 2020)"
- Quote: "PDF 2.0 is an international standard ( ISO 32000-2:2017 ), published as a successor format to PDF 1.7 ( ISO 32000-1:2008 ). A dated revision for the same format specification was published in December 2020." / "The PDF family of formats are designed for representing electronic documents, intended to enable users to exchange and view documents independent of the environments in which they were created or in which they are viewed or printed."

**OK: https://www.loc.gov/preservation/digital/formats/fdd/fdd000318.shtml**
- Fetch: curl (HTTP 200). Title: "PDF/A Family, PDF for Long-term Preservation"
- Quote: "PDF/A is a family of ISO standards for constrained forms of PDF (see PDF_family ) intended to be suitable for long-term preservation of page-oriented documents for which PDF is already being used in practice." Full name given: "ISO 19005. Document management - Electronic document file format for long-term preservation".
- Useful because the PAN spec above asks for "PDF/A or JPEG".

**OK (extra): https://www.loc.gov/preservation/digital/formats/fdd/fdd000252.shtml**: title "PDF/A-1b, PDF for Long-term Preservation, Use of PDF 1.4, Level B Conformance" (curl 200).

**FAILED (PDF):** https://pdfa.org/resource/iso-32000-pdf/ (curl 403, WebFetch 403); https://www.iso.org/standard/75839.html and https://www.iso.org/standard/38920.html (curl 403 Cloudflare "Just a moment...", WebFetch 403).

## 7. Digital signatures in India

How CCA was fetched: curl first failed TLS verification ("unable to get local issuer certificate"). The server's chain ends at the eMudhra root "emSign Root CA - G1", which the proxy bundle does not include. I did **not** disable verification. I downloaded Mozilla's root store from https://curl.se/ca/cacert.pem (which includes "emSign Root CA - G1"), added it to the proxy bundle, and fetched with full verification (`--cacert`). WebFetch on cca.gov.in returned 503.

**OK: https://cca.gov.in/digital_signature.html**
- Fetch: curl (verified TLS, see above), HTTP 200. Title: "How to get Digital Signature Certificate | CCA"
- Quote: "The Office of Controller of Certifying Authorities (CCA), issues Certificate only to Certifying Authorities(CAs). CAs issue Digital Signature Certificates to end-entities." / "One can approach any one of the Licensed CAs for getting a Digital Signature Certificate."

**OK: https://cca.gov.in/eSign.html**
- Fetch: curl (verified TLS), HTTP 200. Title: "eSign | CCA"
- Quote: "For creating electronic signatures, the signer is required to obtain a Digital Signature Certificate (DSC) from a Certifying Authority (CA) licensed by the Controller of Certifying Authorities (CCA) under the Information Technology (IT) Act, 2000." / "eSign is an online electronic signature service which can be integrated with service delivery applications via an API to facilitate an eSign user to digitally sign a document."

**OK: https://cca.gov.in/digital_sign.html**
- Fetch: curl (verified TLS), HTTP 200. Title: "Digital Signature | CCA"
- Quote: "Is there a "Specimen Digital Signature" like paper signature? No. The Digital signature changes with content of the message." / "As per IT Act, the electronic records need to be authenticated by using Electronic Signature."
- (Useful for explaining that a scanned signature image is not a digital signature.)

**OK: https://cca.gov.in/digital_signature_certificate.html**: title "Digital Signature Certificate | CCA" (curl 200). It covers Class 2 / Class 3 certificates: "The higher assurance Class 3 certificates can be used where ever application requires lower assurance certificate."

**OK: https://www.indiacode.nic.in/bitstream/123456789/13116/1/it_act_2000_updated.pdf** (India Code, Legislative Department)
- Fetch: curl (HTTP 200, application/pdf, 36 pages). Title (first line): "THE INFORMATION TECHNOLOGY ACT, 2000"
- Quote, Section 5: "5. Legal recognition of [electronic signatures].—Where any law provides that information or any other matter shall be authenticated by affixing the signature or any document shall be signed or bear the signature of any person, then, notwithstanding anything contained in such law, such requirement shall be deemed to have been satisfied, if such information or matter is authenticated by means of [electronic signature] affixed in such manner as may be prescribed by the Central Government." (The bracketed words carry footnote 1 in the source, which marks them as substituted by the 2009 amendment.)
- Section 4 (electronic records), for context: "Where any law provides that information or any other matter shall be in writing or in the typewritten or printed form, then, notwithstanding anything contained in such law, such requirement shall be deemed to have been satisfied if such information or matter is– (a) rendered or made available in an electronic form; and (b) accessible so as to be usable for a subsequent reference."

**FAILED (IT Act):** https://www.indiacode.nic.in/handle/123456789/1999 (curl timeout, then HTTP 504; WebFetch 403); https://www.meity.gov.in/content/information-technology-act-2000 (HTTP 200 but an empty Next.js shell, so nothing to quote. Do not cite it.)

## 8. Online safety and DigiLocker

**OK: https://www.csk.gov.in/documents/CERT-In_Safe_Internet-Best_Practices_Booklet.pdf** (Cyber Swachhta Kendra / CERT-In)
- Fetch: curl (HTTP 200, PDF, 12 pages). PDF Title metadata: "CERT-In Safe Internet-Best Practices Book"
- Quote (Tips for E-mail Safety): "Avoid opening links/attachments from unknown sources as they may be malicious ." / "Avoid filling of forms that comes via unsolicited email or clicking on links in emails received from untrusted sources." / "Emails or messages that create a sense of urgency is a warning!"
- Quote (Social Media Best Practices): "Avoid sharing your personal information like address, mobile number, personal mail id and other sensitive identity related information on social media." / "Never click on suspicious links or download any app recieved [sic] through messages until you verify the authenticity of the source."
- Quote (Browser): "Expand shortened URLs and verify them before clicking."

**OK: https://www.csk.gov.in/security-best-practices.html**: title "Cyber Swachhta Kendra: Security Best Practices" (curl 200). It links to the booklet above and to "Avoid Phishing Attacks" (https://www.csk.gov.in/documents/Phishing.pdf).

**OK: https://www.csk.gov.in/faq.html**: title "Cyber Swachhta Kendra: FAQ" (curl 200).
- Quote (how infections happen): "Clicking on links mentioned in phishing/social engineering emails Opening malicious email attachments" (items in a list under "How did my computer get infected in the first place?")

**Partly usable: https://www.csk.gov.in/documents/Phishing.pdf** (curl 200, 2-page PDF). The text layer has no spaces between words, so I cannot reliably quote it word for word. Link it as a resource but do not quote it.

**OK: https://www.cert-in.org.in/s2cMainServlet?pageid=PUBWEL01**: title "CERT-In Home" (curl 200; the root https://www.cert-in.org.in/ is a frameset that loads this page). I found no phishing guidance page to quote here; the CSK booklet above is CERT-In's.

**OK: https://www.digilocker.gov.in/**
- Fetch: curl (HTTP 200). Title: "DigiLocker | Access, Share & Verify Digital Documents"
- Quote: "DigiLocker aims at 'Digital Empowerment' of citizen by providing access to authentic digital documents to citizen's digital document wallet. DigiLocker is a secure cloud based platform for storage, sharing and verification of documents & certificates."
- Statistics shown on the page (live counters; quote with the date if used): "70+ Crore Registered Users 900+ Crore Issued Documents"

**OK: https://cdn.digilocker.gov.in/assets/img/circulars/Letter-to-All-State-Governments-UTs.pdf** (MeitY / Digital India Corporation letter No.NeGD/P&CEO/01/2018, January 22, 2018, with the Gazette notification attached)
- Fetch: curl (HTTP 200, PDF).
- Quote (Gazette text of Rule 9A, Information Technology (Preservation and Retention of Information by Intermediaries Providing Digital Locker Facilities) Amendment Rules, 2017, notified 8 February 2017): "9A. Issuing certificates or documents in Digital Locker System and accepting certificates or documents shared from Digital Locker Account at par with Physical Documents.––(1) Issuers may start issuing and Requesters may start accepting digitally (or electronically) signed certificates or documents shared from subscribers' Digital Locker accounts at par with the physical documents in accordance with the provisions of the Act and rules made thereunder."
- Quote (letter): "Rule 9A was introduced, according to which the documents issued/pushed by various Departments/Organisations in DigiLocker system shall be deemed to be at par with original physical documents." (The letter is a scan. Its OCR text reads "issuedfpushed" and "docu-ments"; I corrected these to "issued/pushed" and "documents". The Gazette Rule 9A text above is a clean text layer.)
- CAUTION: the covering letter cites "G.S.R. 711(E)", but the attached Gazette page reads "G.S.R. 111(E)". Do not state a G.S.R. number. Cite "Rule 9A, notified 8 February 2017" instead.

**OK (same content): https://digilocker.gov.in/assets/img/Circulars/DL%20Circular.pdf** (redirects to https://www.digilocker.gov.in:443/assets/img/Circulars/DL%20Circular.pdf; curl 200, 2-page scanned PDF with OCR typos). It says the same thing about Rule 9A. The letter above is the cleaner source.

**Not citable as a page:** https://www.digilocker.gov.in/web/about/about-digilocker and /web/about/faq return an empty Angular shell (the text exists only in the JS bundle; WebFetch saw only the title). Do not cite them for specific wording.

**FAILED:** https://cybercrime.gov.in/ (curl connection reset; WebFetch 503).

## 9. Resumes: National Career Service

**OK: https://www.ncs.gov.in/** (redirects to https://ncs.gov.in/)
- Fetch: curl (HTTP 200). Title: "NcsNewWebsite" (the page's own title tag; the site is National Career Service, Ministry of Labour & Employment)
- Quote (FAQ on home page): "The National Career Service (NCS) is a one-stop solution offering a wide range of employment and career-related services to the citizens of India, including job search, job matching, career content, counselling, and job fair information. It is an initiative of the Ministry of Labour & Employment, Government of India."
- Quote (fees and fraud, useful for safety): "NCS does not charge any fee at any stage of registration, job application, or interview processing. Jobseekers should not pay fees to employers." / "Please verify information only on the official website, www.ncs.gov.in . You may contact NCS at support.ncs@gov.in or on the toll-free helpline 1514. Cyber fraud can be reported on 1930."
- The page also offers an "AI Resume builder" (menu item; link /cvbuilder). /cvbuilder and /faq return the same SPA shell as the home page.
- Finding: I found **no** official NCS resume-writing guidance (format, length, contents). Do not cite NCS for resume advice, only for the portal itself and its builder tool.

## 10. DPI / print

Skipped, as the brief allowed. The only official DPI figure I found is the PAN scan spec (200 DPI) in item 3.

---

## Failed or unusable URLs (all)

| URL | Result |
|---|---|
| https://www.passportindia.gov.in/psp | 200 but empty JS shell (nothing to quote) |
| https://backend.uidai.gov.in/get/files/media/document/2026-06/List_of_Supporting_Document_for_Aadhaar_Enrolment_and_Update.pdf | curl connection reset x5; WebFetch 503 |
| https://uidai.gov.in/images/commdoc/26_JAN_2023_Aadhaar_List_of_documents_English.pdf | 404 |
| https://uidai.gov.in/en/1045-english-uk/faqs/enrolment-update/myaadhaar-online-update-service/13902-which-are-the-documents-required-for-updation-in-aadhaar-address.html | 404 |
| https://uidai.gov.in/en/documents | connection reset |
| https://uidai.gov.in/get/files/media/document/2026-09/Aadhaar_Enrolment__and__Update__-__English.pdf | 404 |
| https://myaadhaar.uidai.gov.in/ | curl reset; WebFetch 503 |
| https://tin.tin.nsdl.com/pan/form49Adsc.html, /pan/InstructionDSC.html, /pan/correctiondsc.html | proxy CONNECT 502 |
| https://www.onlineservices.nsdl.com/paam/endUserRegisterContact.html | 502; WebFetch DNS failure |
| https://www.utiitsl.com/ | connection reset |
| https://www.icao.int/publications/pages/publication.aspx?docnum=9303 | 403 (curl and WebFetch) |
| https://www.icao.int/publications/Documents/9303_p3_cons_en.pdf | 403 |
| https://www.icao.int/Security/FAL/TRIP/PublishingImages/Pages/Publications/ICAO%20TR%20-%20Portrait%20Quality%20v1.0.pdf | 403 (curl and WebFetch) |
| https://pdfa.org/resource/iso-32000-pdf/ | 403 (curl and WebFetch) |
| https://www.iso.org/standard/75839.html, https://www.iso.org/standard/38920.html | 403 (Cloudflare challenge) |
| https://cca.gov.in/ (default trust store) | TLS chain not trusted by proxy bundle; WebFetch 503. It worked with the Mozilla root store, see item 7 |
| https://www.indiacode.nic.in/handle/123456789/1999 | timeout, then 504; WebFetch 403 |
| https://www.meity.gov.in/content/information-technology-act-2000 | 200 but empty shell |
| https://cybercrime.gov.in/ | curl reset; WebFetch 503 |
| https://www.digilocker.gov.in/web/about/about-digilocker, /web/about/faq | 200 but empty SPA shell |
| https://www.ncs.gov.in/cvbuilder, /faq | 200 but return the home-page shell |
