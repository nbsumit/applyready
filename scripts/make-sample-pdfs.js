#!/usr/bin/env node
/* Sample PDFs for the step-by-step tutorials, made with the vendored pdf-lib so the guide
   screenshots can be reproduced. Every page says it is a sample; no real document or person is
   shown. Run after scripts/make-sample-images.py (the scan uses its document photos):

     node scripts/make-sample-pdfs.js

   Output, in img/samples/guide/ (not part of the offline cache):
     sample-cover-letter.pdf        1 page of real text
     sample-marksheet.pdf           2 pages of real text (front and back of a mark sheet)
     sample-certificate-locked.pdf  1 page, opens with the password "sample"
     sample-scan.pdf                3 A4 pages, each a phone photo of a printed page */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const P = require('../js/vendor/pdf-lib.min.js');

const root = path.resolve(__dirname, '..');
const out = path.join(root, 'img', 'samples', 'guide');
const A4 = [595.28, 841.89];
const FIXED = new Date('2026-11-18T00:00:00Z');

async function textPdf(pages, opts = {}) {
  const d = await P.PDFDocument.create();
  d.setTitle(opts.title || 'Sample');
  d.setAuthor('ApplyReady sample');
  d.setProducer('ApplyReady sample generator');
  d.setCreator('scripts/make-sample-pdfs.js');
  d.setCreationDate(FIXED);
  d.setModificationDate(FIXED);
  const regular = await d.embedFont(P.StandardFonts.Helvetica);
  const bold = await d.embedFont(P.StandardFonts.HelveticaBold);
  for (const page of pages) {
    const p = d.addPage(A4);
    let y = A4[1] - 80;
    p.drawText('SAMPLE DOCUMENT FOR APPLYREADY GUIDES', { x: 60, y: A4[1] - 40, size: 8, font: regular, color: P.rgb(0.45, 0.45, 0.45) });
    p.drawText(page.heading, { x: 60, y, size: 20, font: bold });
    y -= 36;
    for (const line of page.lines) {
      if (line) p.drawText(line, { x: 60, y, size: 11, font: regular });
      y -= 18;
    }
  }
  if (opts.password) await d.encrypt({ userPassword: opts.password, ownerPassword: opts.password + '-owner', permissions: {} });
  return Buffer.from(await d.save({ useObjectStreams: false }));
}

async function scanPdf(images) {
  const d = await P.PDFDocument.create();
  d.setTitle('Sample scan');
  d.setProducer('ApplyReady sample generator');
  d.setCreationDate(FIXED);
  d.setModificationDate(FIXED);
  for (const file of images) {
    const img = await d.embedJpg(fs.readFileSync(path.join(out, file)));
    const p = d.addPage(A4);
    p.drawImage(img, { x: 0, y: 0, width: A4[0], height: A4[1] });
  }
  return Buffer.from(await d.save({ useObjectStreams: false }));
}

(async () => {
  fs.mkdirSync(out, { recursive: true });
  for (const f of ['document-page-1.jpg', 'document-page-2.jpg']) {
    if (!fs.existsSync(path.join(out, f))) throw new Error(`missing ${f}: run python3 scripts/make-sample-images.py first`);
  }
  const files = {
    'sample-cover-letter.pdf': await textPdf([{ heading: 'Cover letter (sample)', lines: [
      'Sample Applicant', 'sample.applicant@example.com', '',
      'Dear Hiring Manager,', '',
      'I am applying for the Junior Data Analyst role advertised on your careers page.',
      'This letter is a sample made for the ApplyReady guides. It holds no real details.', '',
      'Yours sincerely,', 'Sample Applicant'] }], { title: 'Sample cover letter' }),
    'sample-marksheet.pdf': await textPdf([
      { heading: 'Statement of marks (sample), page 1', lines: ['Name: Sample Applicant', 'Programme: B.Sc. Statistics (sample)', '', 'Semester 1    Mathematics I    78', 'Semester 1    Statistics I     82', 'Semester 2    Mathematics II   74', 'Semester 2    Statistics II    85'] },
      { heading: 'Statement of marks (sample), page 2', lines: ['Semester 3    Probability      80', 'Semester 4    Data Analysis    88', '', 'This is a sample made for the ApplyReady guides.'] }
    ], { title: 'Sample mark sheet' }),
    'sample-certificate-locked.pdf': await textPdf([{ heading: 'Certificate (sample)', lines: ['This sample file is protected with the password: sample', '', 'It shows how ApplyReady opens a password-protected PDF.'] }], { title: 'Sample protected certificate', password: 'sample' }),
    'sample-scan.pdf': await scanPdf(['document-page-1.jpg', 'document-page-2.jpg', 'document-page-1.jpg'])
  };
  for (const [name, buf] of Object.entries(files)) {
    fs.writeFileSync(path.join(out, name), buf);
    console.log(`${name} ${buf.length} bytes`);
  }
})().catch(e => { console.error(e); process.exit(1); });
