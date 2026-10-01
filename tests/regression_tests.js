'use strict';
const assert = require('node:assert/strict');
const schema = require('../js/resume-schema');
const pdf = require('../js/pdf-engine');
const docx = require('../js/docx-engine');
const { TEMPLATES } = require('../js/templates');
const { resumeFixture } = require('./fixtures');
const { scaleLockedDimension, validateDimensionSpecs } = require('../js/resizer');
let checks = 0;
const check = (name, fn) => { fn(); checks++; console.log(`✓ ${name}`); };
const backup = data => ({ version: 2, app: 'ApplyReady', data });
check('Locked portrait and landscape dimensions preserve their actual proportions', () => {
  assert.equal(scaleLockedDimension('700', 350 / 450, 'width'), 900);
  assert.equal(scaleLockedDimension('900', 350 / 450, 'height'), 700);
  assert.equal(scaleLockedDimension('600', 3, 'width'), 200);
});
check('Locked dimensions expose unsafe sizes instead of silently distorting the image', () => {
  const height = scaleLockedDimension('8000', 1 / 2, 'width');
  assert.equal(height, 16000);
  assert.equal(validateDimensionSpecs('8000', height, '50').isValid, false);
  for (const value of ['', 'abc', '20.5', '-10', 'Infinity']) assert.equal(scaleLockedDimension(value, 1, 'width'), null);
});
check('Valid current backup and legacy version 1 remain supported', () => {
  assert(schema.validate(backup(resumeFixture())));
  assert(schema.validate({version:1,data:resumeFixture()}));
});
for (const [name, mutate] of [
  ['non-text name', d => d.personal.fullName = []], ['null entry', d => d.experience = [null]],
  ['non-text bullet', d => d.experience[0].bulletsText = {}], ['wrong academic list', d => d.academic.publications = 'wrong'],
  ['array instead of personal object', d => d.personal = []], ['oversized entry count', d => d.experience = Array(151).fill({role:'Analyst'})]
]) check(`Reject ${name} before it reaches the editor`, () => { const data = resumeFixture(); mutate(data); assert.equal(schema.validate(backup(data)),false); });
check('Future incompatible schema versions are rejected', () => assert.equal(schema.validate({version:99,data:resumeFixture()}),false));
check('Legacy string entries and missing IDs are safely migrated without losing content', () => {
  const d=resumeFixture(); assert(d.achievements[0].title==='AWARD_MARKER'); assert(d.academic.publications[0].title==='PUBLICATION_MARKER');
  assert.equal(d.academic.grants[0].title,'GRANT_MARKER'); assert(d.experience[0].id);
});
check('Unsafe and duplicated entry IDs cannot create HTML attributes or duplicate DOM IDs', () => {
  const d=resumeFixture(); d.experience=[{id:'x" onclick="alert(1)',role:'A'}, {id:'same',role:'B'}, {id:'same',role:'C'}];
  const migrated=schema.migrate(d); const ids=migrated.experience.map(x=>x.id);
  assert.equal(new Set(ids).size,3); ids.forEach(id=>assert.match(id,/^[A-Za-z0-9_-]+$/));
});
check('Partial recommended orders retain every optional section exactly once', () => {
  const order=schema.normalizeSectionOrder(['skills','skills','experience']);
  assert.equal(order.length,10); assert.equal(order[0],'skills'); assert(order.includes('academic'));
});
check('Selected font sizes change actual PDF and Word body text', () => {
  const d=resumeFixture();
  assert(pdf.generateResumePDF(d).build().includes(' 11 Tf '));
  d.design.fontSize='comfortable'; assert(pdf.generateResumePDF(d).build().includes(' 12 Tf '));
  const zip=docx.generateResumeDOCX(d); const xml=new TextDecoder().decode(zip.files.find(f=>f.name==='word/document.xml').data);
  assert(xml.includes('w:sz w:val="24"'));
});
check('Unsupported PDF characters are never silently dropped or transliterated', () => {
  const d=resumeFixture(); d.personal.fullName='सुमित';
  assert.throws(()=>pdf.generateResumePDF(d),e=>e.code==='UNSUPPORTED_PDF_TEXT');
  assert(pdf.generateResumeText(d).includes('सुमित'));
  const zip=docx.generateResumeDOCX(d); assert(new TextDecoder().decode(zip.files.find(f=>f.name==='word/document.xml').data).includes('सुमित'));
});
check('PDF wrapping uses the actual bold and italic font advances', () => {
  for (const font of ['Helvetica', 'Times']) {
    const text = 'Organization with unusually long professional names';
    assert.notEqual(pdf.measureTextWidth(text, 12, font, 'bold'), pdf.measureTextWidth(text, 12, font));
    for (const style of ['normal', 'bold', 'italic']) {
      const lines = pdf.splitTextToLines(text, 12, 150, font, style);
      assert(lines.length > 1);
      assert(lines.every(line => pdf.measureTextWidth(line, 12, font, style) <= 150));
    }
  }
});
check('Unsafe link protocols are excluded from PDF and Word exports', () => {
  assert.equal(pdf.sanitizeUrl('javascript:alert(1)'),''); assert.equal(pdf.sanitizeUrl('file:///etc/passwd'),'');
  const d=resumeFixture(); d.projects[0].link='javascript:alert(1)';
  const zip=docx.generateResumeDOCX(d); const rels=zip.files.find(f=>f.name==='word/_rels/document.xml.rels');
  assert(!new TextDecoder().decode(rels.data).includes('javascript:'));
});
for(const template of Object.keys(TEMPLATES)) check(`All exports retain every visible section for ${template}`, () => {
  const d=resumeFixture(); d.template=template; d.design.sectionOrder=TEMPLATES[template].recommendedOrder;
  const pdfText=pdf.generateResumePDF(d).build(), plain=pdf.generateResumeText(d);
  const zip=docx.generateResumeDOCX(d); const word=new TextDecoder().decode(zip.files.find(f=>f.name==='word/document.xml').data);
  for(const marker of ['CERTIFICATE_MARKER','AWARD_MARKER','VOLUNTEER_MARKER','LANGUAGE_MARKER','PUBLICATION_MARKER','TEACHING_MARKER','PRESENTATION_MARKER','GRANT_MARKER']) {
    assert(pdfText.includes(marker), `${template}: PDF lost ${marker}`); assert(plain.includes(marker), `Text lost ${marker}`); assert(word.includes(marker), `Word lost ${marker}`);
  }
  d.sectionVisibility.volunteering=false; assert(!pdf.generateResumePDF(d).build().includes('VOLUNTEER_MARKER')); assert(!pdf.generateResumeText(d).includes('VOLUNTEER_MARKER'));
});
check('No missing language proficiency is invented as Fluent',()=>{
  const d=resumeFixture();d.languages=[{name:'English'}];
  assert(!pdf.generateResumeText(d).includes('Fluent')); assert(!pdf.generateResumePDF(d).build().includes('Fluent'));
});
check('Default sample uses the available first page without losing its final section', () => {
  const source = require('node:fs').readFileSync(require('node:path').join(__dirname, '../js/resume.js'), 'utf8');
  const sample = require('node:vm').runInNewContext('(' + source.match(/const SAMPLE_DATA = ([\s\S]*?);\n\n  \/\/ Blank/)[1] + ')');
  const document = pdf.generateResumePDF(schema.migrate(sample));
  assert.equal(document.getPageCount(), 1);
  const lines = document.pages[0].elements.filter(item => item.type === 'text');
  assert(lines.some(item => item.text.includes('Operational Excellence Award')));
  assert(lines.at(-1).y > document.pageHeight - 90);
  assert(lines.every(item => item.y <= document.pageHeight - 36));
});
check('Long skills wrap safely inside every physical page', () => {
  const data = resumeFixture();
  data.skills = { categories: [{ name: 'Skills', items: 'Operational planning and delivery, '.repeat(600) }] };
  for (const pageSize of ['a4', 'letter']) {
    data.design.pageSize = pageSize;
    const doc = pdf.generateResumePDF(data);
    assert(doc.getPageCount() > 2);
    for (const page of doc.pages) for (const item of page.elements) {
      if (item.type === 'text') assert(item.y <= page.height - 36, 'Skills extend into the bottom margin');
    }
  }
});
const templatesApi = require('../js/templates');
const wordXml = (zip, name = 'word/document.xml') => new TextDecoder().decode(zip.files.find(f => f.name === name).data);
check('Every template is allowed by the backup schema and survives migration', () => {
  for (const id of Object.keys(TEMPLATES)) {
    const d = resumeFixture(); d.template = id; d.design.templateId = id;
    assert(schema.validate(backup(d)), `${id} rejected`);
    assert.equal(schema.migrate(d).template, id);
  }
});
check('Template catalogue entries are complete and their thumbnails describe them', () => {
  for (const [id, t] of Object.entries(TEMPLATES)) {
    assert(t.name && t.description && t.group && t.svgThumbnail.includes('<svg'), id);
    assert(['serif', 'sans'].includes(t.fontFamily), id);
    assert(t.recommendedOrder.every(key => schema.sections.includes(key)), id);
    assert(templatesApi.TEMPLATE_GROUPS.some(g => g.id === t.group), id);
  }
});
check('ATS Plain draws no lines and keeps dates on their own line', () => {
  const d = resumeFixture(); d.template = 'ats-strict';
  const doc = pdf.generateResumePDF(d);
  assert(doc.pages.every(page => page.elements.every(el => el.type !== 'line')));
  const els = doc.pages[0].elements.filter(el => el.type === 'text');
  const role = els.find(el => el.text.startsWith('Analyst'));
  const date = els.find(el => el.text.includes('2022 – Present') && el.y > role.y);
  assert(date && date.x === role.x, 'Dates are not on their own line');
  const zip = docx.generateResumeDOCX(d);
  assert(!wordXml(zip).includes('w:val="right"'), 'Word still right-aligns dates');
});
check('Template wording reaches PDF, Word and text exports', () => {
  const d = resumeFixture(); d.template = 'campus-fresher';
  for (const output of [pdf.generateResumePDF(d).build(), pdf.generateResumeText(d), wordXml(docx.generateResumeDOCX(d))]) {
    assert(/POSITIONS OF RESPONSIBILITY|Positions of Responsibility/.test(output), 'Volunteer label missing');
  }
  d.template = 'executive-impact';
  assert(pdf.generateResumeText(d).includes('SELECTED ACHIEVEMENTS'));
  assert(pdf.generateResumeText(d).includes('CORE COMPETENCIES'));
});
check('Custom section headings and skill labels override template wording', () => {
  const d = resumeFixture(); d.template = 'software-engineer';
  d.experienceTitle = 'Internships'; d.skillLabels = { languages: 'Programming', frameworks: '  ' };
  const text = pdf.generateResumeText(d);
  assert(text.includes('INTERNSHIPS') && !text.includes('WORK EXPERIENCE'));
  assert(text.includes('Programming: Analysis, Operations'));
  assert(text.includes('Frameworks & Libraries: Spreadsheets'), 'Blank custom label must fall back to template');
  assert(wordXml(docx.generateResumeDOCX(d)).includes('Programming: '));
  const restored = schema.migrate(JSON.parse(JSON.stringify(backup(d))));
  assert.equal(restored.skillLabels.languages, 'Programming');
  assert(schema.validate(backup(d)));
  d.skillLabels = { languages: 7 }; assert.equal(schema.validate(backup(d)), false);
});
check('Untouched default headings follow the template, edited ones do not', () => {
  const d = resumeFixture(); d.skillsTitle = 'Skills & Competencies';
  assert.equal(templatesApi.getSectionTitle(d, 'executive-impact', 'skills'), 'Core Competencies');
  assert.equal(templatesApi.getSectionTitle(d, 'classic-professional', 'skills'), 'Skills & Competencies');
  d.skillsTitle = 'Toolkit';
  assert.equal(templatesApi.getSectionTitle(d, 'executive-impact', 'skills'), 'Toolkit');
});
check('Word files drop XML-illegal characters and stay well-formed', () => {
  const d = resumeFixture(); d.summary = 'Pasted\fsummary\u000bwith\u0001controls & <tags>';
  const xml = wordXml(docx.generateResumeDOCX(d));
  assert(!/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(xml));
  assert(xml.includes('Pastedsummarywithcontrols &amp; &lt;tags&gt;'));
});
check('Word files carry real bullet lists, document properties and right-aligned dates', () => {
  const d = resumeFixture(); const zip = docx.generateResumeDOCX(d);
  const names = zip.files.map(f => f.name);
  for (const part of ['word/numbering.xml', 'word/settings.xml', 'docProps/core.xml', 'docProps/app.xml']) assert(names.includes(part), part);
  assert(wordXml(zip, '[Content_Types].xml').includes('/word/numbering.xml'));
  assert(wordXml(zip, 'word/_rels/document.xml.rels').includes('numbering.xml'));
  assert(wordXml(zip, 'docProps/core.xml').includes('<dc:title>Jordan Lee - Resume</dc:title>'));
  const xml = wordXml(zip);
  assert(xml.includes('<w:numId w:val="1"/>') && !xml.includes('•  Improved'));
  assert(xml.includes('<w:tab w:val="right"'));
  const ids = [...wordXml(zip, 'word/_rels/document.xml.rels').matchAll(/Id="(rId\d+)"/g)].map(m => m[1]);
  assert.equal(new Set(ids).size, ids.length, 'Duplicate relationship IDs');
});
check('PDF document information names the candidate', () => {
  const raw = pdf.generateResumePDF(resumeFixture()).build();
  const hex = s => [...s].map(c => c.charCodeAt(0).toString(16).padStart(4, '0').toUpperCase()).join('');
  assert(raw.includes(`/Title <FEFF${hex('Jordan Lee - Resume')}>`));
  assert(raw.includes(`/Author <FEFF${hex('Jordan Lee')}>`));
  assert(/trailer\n<< \/Size \d+ \/Root 1 0 R \/Info \d+ 0 R >>/.test(raw));
});
check('Exports skip empty entries instead of printing bare headings', () => {
  const d = resumeFixture();
  d.experience = [{ id: 'e', role: '', company: '', bulletsText: '' }];
  d.certifications = [{ id: 'c', name: '', issuer: 'Orphan Issuer' }];
  d.achievements = [{ id: 'a', title: '   ' }];
  const text = pdf.generateResumeText(d);
  assert(!text.includes('WORK EXPERIENCE') && !text.includes('CERTIFICATIONS') && !text.includes('HONORS'));
  const word = wordXml(docx.generateResumeDOCX(d));
  assert(!word.includes('Work Experience') && !word.includes('Orphan Issuer'));
});
check('Bullet-only experience entries are kept in every format', () => {
  const d = resumeFixture(); d.experience = [{ id: 'b', bulletsText: 'BULLET_ONLY_MARKER' }];
  assert(pdf.generateResumePDF(d).build().includes('BULLET_ONLY_MARKER'));
  assert(pdf.generateResumeText(d).includes('* BULLET_ONLY_MARKER'));
  assert(wordXml(docx.generateResumeDOCX(d)).includes('BULLET_ONLY_MARKER'));
});
check('Invisible pasted characters do not force the browser-print fallback', () => {
  const d = resumeFixture();
  d.personal.fullName = 'Rene\u0301 Lee\u200b';
  d.summary = 'Copied\u0001 from\u000c a PDF\ufeff with\u2028line separators';
  const doc = pdf.generateResumePDF(d);
  const text = doc.pages.flatMap(page => page.elements).filter(el => el.type === 'text').map(el => el.text).join(' ');
  assert(text.includes('RENÉ LEE'));
  assert(text.includes('Copied from a PDF with line separators'));
  assert(pdf.generateResumeText(d).includes('RENÉ LEE'));
  d.personal.fullName = 'Zoë 李';
  assert.throws(() => pdf.generateResumePDF(d), e => e.code === 'UNSUPPORTED_PDF_TEXT', 'Visible non-Latin text must still use browser print');
});
console.log(`\n${checks} behavior regression checks passed.`);
