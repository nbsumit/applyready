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
  ['non-text bullet', d => d.experience[0].bulletsText = {}], ['wrong academic list', d => d.academic.publications = 'wrong'], ['wrong publications list', d => d.publications = 'wrong'],
  ['non-boolean references switch', d => d.referencesOnRequest = 'yes'], ['too many custom sections', d => d.customSections = Array(21).fill({ title: 'x' })],
  ['array instead of personal object', d => d.personal = []], ['oversized entry count', d => d.experience = Array(151).fill({role:'Analyst'})]
]) check(`Reject ${name} before it reaches the editor`, () => { const data = resumeFixture(); mutate(data); assert.equal(schema.validate(backup(data)),false); });
check('Future incompatible schema versions are rejected', () => assert.equal(schema.validate({version:99,data:resumeFixture()}),false));
check('Legacy string entries and missing IDs are safely migrated without losing content', () => {
  const d=resumeFixture(); assert(d.achievements[0].title==='AWARD_MARKER'); assert(d.publications[0].title==='PUBLICATION_MARKER');
  assert.equal(d.academic.grants[0].title,'GRANT_MARKER'); assert(d.experience[0].id);
});
check('Unsafe and duplicated entry IDs cannot create HTML attributes or duplicate DOM IDs', () => {
  const d=resumeFixture(); d.experience=[{id:'x" onclick="alert(1)',role:'A'}, {id:'same',role:'B'}, {id:'same',role:'C'}];
  const migrated=schema.migrate(d); const ids=migrated.experience.map(x=>x.id);
  assert.equal(new Set(ids).size,3); ids.forEach(id=>assert.match(id,/^[A-Za-z0-9_-]+$/));
});
check('Partial recommended orders retain every optional section exactly once', () => {
  const order=schema.normalizeSectionOrder(['skills','skills','experience']);
  assert.equal(order.length,12); assert.equal(order[0],'skills'); assert(order.includes('academic') && order.includes('publications') && order.includes('references'));
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
  const sample = require('node:vm').runInNewContext('(' + source.match(/const SAMPLE_DATA = ([\s\S]*?);(?:\r?\n)+\s*\/\/ Blank/)[1] + ')');
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
check('No two templates render the same resume identically', () => {
  // Same content, same section order; each template with its own font and spacing.
  const seen = new Map();
  for (const [id, t] of Object.entries(TEMPLATES)) {
    const d = resumeFixture(); d.template = id; d.design.templateId = id;
    d.design.fontFamily = t.fontFamily; d.design.density = t.density || 'standard';
    d.design.sectionOrder = schema.sections.slice();
    const doc = pdf.generateResumePDF(d);
    const signature = JSON.stringify(doc.pages.map(p => p.elements.map(e => [e.type, Math.round(e.x || e.x1 || 0), Math.round(e.y || e.y1 || 0), e.text || '', (e.color || []).join(','), e.fontStyle || '', e.fontSize || e.lineWidth || 0])));
    assert(!seen.has(signature), `${id} renders exactly like ${seen.get(signature)}`);
    seen.set(signature, id);
  }
});
check('Template descriptions make no guarantee about applicant tracking systems', () => {
  for (const [id, t] of Object.entries(TEMPLATES)) assert(!/ATS|applicant tracking|guarantee|Workday|Taleo|Lever|ISO 32000|maximum compatibility/i.test(`${t.name} ${t.description} ${t.badge} ${t.category}`), id);
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
const keywords = require('../js/keywords');
check('Job-description matching finds real terms, ignores filler, and matches word forms', () => {
  const job = 'We are looking for a Senior Data Analyst with strong SQL and Python skills. Experience with Power BI and stakeholder management required. Build dashboards in Power BI and automate reporting with Python. C++ or C# a plus. EHR (Epic) exposure.';
  const terms = keywords.extractKeywords(job);
  for (const term of ['SQL', 'Power BI', 'Python', 'C++', 'C#', 'Epic', 'dashboards']) assert(terms.includes(term), `missing ${term}`);
  for (const filler of ['looking', 'strong', 'skills', 'experience', 'required', 'build', 'plus']) assert(!terms.map(t => t.toLowerCase()).includes(filler), `filler ${filler}`);
  const result = keywords.matchKeywords(job, 'Automated weekly reports in SQL; built a Tableau dashboard for stakeholders.');
  for (const term of ['SQL', 'automate', 'reporting', 'dashboards', 'stakeholder']) assert(result.found.includes(term), `should match ${term}`);
  for (const term of ['Power BI', 'Python', 'C++']) assert(result.missing.includes(term), `should miss ${term}`);
  assert.equal(result.found.length + result.missing.length, result.keywords.length);
  assert.deepEqual(keywords.matchKeywords('', 'anything').keywords, []);
});
check('Links written as host:port keep their link; unsafe schemes are still refused', () => {
  assert.equal(pdf.sanitizeUrl('www.example.com:8080/work'), 'https://www.example.com:8080/work');
  assert.equal(pdf.sanitizeUrl('localhost:3000'), 'https://localhost:3000/');
  for (const bad of ['javascript:alert(1)', 'JavaScript:alert(1)', 'data:text/html,x', 'vbscript:x', 'file:///etc/passwd']) assert.equal(pdf.sanitizeUrl(bad), '', bad);
  const d = resumeFixture();
  d.personal.website = 'www.example.com:8080/work';
  const rels = new TextDecoder().decode(docx.generateResumeDOCX(d).files.find(f => f.name === 'word/_rels/document.xml.rels').data);
  assert(rels.includes('Target="https://www.example.com:8080/work"'), 'Word file links the host:port website');
});
check('Icon classes in scripts are written whole, so the icon subset includes every icon a page can show', () => {
  // scripts/build-icons.py finds icons by their "fa-name" class in the source. A class built from a
  // fragment ("fa-" + name) is invisible to it, which once left the Organise PDF Restore button blank.
  const fs = require('node:fs'), path = require('node:path');
  const root = path.join(__dirname, '..');
  const css = fs.readFileSync(path.join(root, 'css/vendor/icons.min.css'), 'utf8');
  const has = name => new RegExp(`\\.fa-${name}:before`).test(css);
  // These take icon names from the tool registry, which is checked below.
  const registryDriven = new Set(['search.js', 'your-data.js', 'home.js']);
  const dirs = ['js', 'js/lib', 'js/workers'];
  for (const dir of dirs) {
    for (const file of fs.readdirSync(path.join(root, dir)).filter(f => f.endsWith('.js'))) {
      if (registryDriven.has(file) && dir === 'js') continue;
      const src = fs.readFileSync(path.join(root, dir, file), 'utf8');
      assert(!/fa-\$\{/.test(src), `${dir}/${file} builds an icon class from a fragment; write the whole class name`);
    }
  }
  const { TOOLS, CATEGORIES } = require('../scripts/lib/tools.js');
  for (const t of TOOLS.concat(CATEGORIES)) if (t.icon) assert(has(t.icon), `registry icon fa-${t.icon} (${t.id}) is in the icon subset`);
  assert(has('trash-can-arrow-up') && has('trash-can'), 'both Organise PDF delete and restore icons are in the subset');
});
check('Scrolling from script respects reduced motion (the CSS rule cannot stop a smooth scroll asked for in script)', () => {
  const fs = require('node:fs'), path = require('node:path');
  const root = path.join(__dirname, '..');
  for (const dir of ['js', 'js/lib']) {
    for (const file of fs.readdirSync(path.join(root, dir)).filter(f => f.endsWith('.js'))) {
      const src = fs.readFileSync(path.join(root, dir, file), 'utf8');
      assert(!/behavior:\s*['"]smooth['"]/.test(src), `${dir}/${file} asks for a smooth scroll without checking prefers-reduced-motion`);
    }
  }
});
// A long history: seven roles of five two-line bullets, then projects of two bullets each.
function longResume(template) {
  const long = n => `Additional result number ${n}: coordinated a cross-team reporting change that cut turnaround and kept the work on schedule across several teams and quarters while keeping costs flat`;
  const d = schema.migrate({ template, design: { templateId: template, density: TEMPLATES[template].density || 'standard', fontFamily: TEMPLATES[template].fontFamily }, personal: { fullName: 'Long Case' },
    experience: Array.from({ length: 7 }, (_, r) => ({ role: `Role ${r + 1}`, company: 'Company', duration: '2019 - 2020', bulletsText: [1, 2, 3, 4, 5].map(long).join('\n') })),
    projects: Array.from({ length: 4 }, (_, p) => ({ name: `Project ${p + 1}`, tech: 'Python, Pandas, Power BI, Tableau, SQL Server, Airflow', link: 'github.com/someone/project-' + p, bulletsText: `First bullet of project ${p + 1}\nHandled 3,000 bookings in project ${p + 1}` })),
    education: [{ degree: 'B.Tech', institution: 'College', duration: '2015 - 2019' }] });
  d.design.sectionOrder = schema.normalizeSectionOrder(['experience', 'projects', 'education'], d);
  return d;
}
check('Page breaks never split a bullet or leave a last bullet alone at the top of a page', () => {
  for (const template of Object.keys(TEMPLATES)) {
    const doc = pdf.generateResumePDF(longResume(template));
    assert(doc.getPageCount() > 1, `${template}: the long case spans pages`);
    doc.pages.slice(1).forEach((page, i) => {
      const texts = page.elements.filter(e => e.type === 'text');
      const first = texts[0];
      // A page starts with a heading, a bullet sign, or an entry title, never with the middle of a bullet.
      assert(first.text === '•' || first.fontStyle === 'bold', `${template} page ${i + 2} starts inside a bullet: "${first.text}"`);
      if (first.text === '•') {
        // ...and a bullet at the top of a page is never the last of its list: another bullet follows it.
        const bulletYs = texts.filter(e => e.text === '•').map(e => e.y);
        const after = texts.find(e => e.y > first.y && e.x < first.x + 4);
        assert(bulletYs.length > 1 && after && after.text === '•', `${template} page ${i + 2} starts with a lone last bullet`);
      }
    });
  }
});
// Moves every later page break by a few points at a time: `shift` short education entries come first.
// `lines` lines of summary move them by a different step, so together they reach every position.
function shiftedResume(template, density, shift, extra, lines) {
  const d = schema.migrate(Object.assign({ template, design: { templateId: template, density }, personal: { fullName: 'Break Case' },
    summary: Array.from({ length: lines || 0 }, () => 'Summary line').join('\n'),
    sectionVisibility: { summary: true, education: true, experience: true },
    education: Array.from({ length: shift }, (_, i) => ({ degree: `Course ${i + 1}`, institution: 'Institute' })),
    experience: Array.from({ length: 6 }, (_, r) => ({ role: `Role ${r + 1}`, company: 'Company', duration: '2019 - 2020', bulletsText: [1, 2, 3, 4].map(n =>
      `Result ${n}: coordinated a cross-team reporting change that cut turnaround and kept the work on schedule across several quarters for the regional team`).join('\n') })) }, extra || {}));
  d.design.sectionOrder = schema.normalizeSectionOrder(['summary', 'education', 'experience', 'references'], d);
  d.sectionVisibility.references = true;
  return d;
}
check('A bullet is never split across pages, in either density (RES-03)', () => {
  for (const template of ['compact-professional', 'classic-professional', 'software-engineer']) {
    for (const density of ['compact', 'standard']) {
      for (let shift = 0; shift <= 24; shift++) for (let lines = 0; lines <= 12; lines++) {
        const doc = pdf.generateResumePDF(shiftedResume(template, density, shift, null, lines));
        doc.pages.forEach((page, p) => {
          const texts = page.elements.filter(e => e.type === 'text');
          const bulletYs = texts.filter(e => e.text === '•').map(e => e.y);
          const bulletX = texts.filter(e => e.text.startsWith('Result ')).map(e => e.x)[0];
          // Every line drawn at the bullet text position is either a bullet's first line (a • on the
          // same line) or follows a line of the same bullet on the same page.
          const top = texts.filter(e => Math.abs(e.x - bulletX) < 0.5 && !e.text.startsWith('Result ')).sort((a, b) => a.y - b.y)[0];
          if (!top) return;
          const above = texts.some(e => e.y < top.y - 0.5 && Math.abs(e.x - bulletX) < 0.5);
          assert(above || bulletYs.some(y => Math.abs(y - top.y) < 0.5), `${template} ${density} shift ${shift}+${lines}: page ${p + 1} starts with the rest of a bullet ("${top.text.slice(0, 30)}")`);
        });
      }
    }
  }
});
check('A referee\'s name, details and contact stay on one page (RES-02)', () => {
  const references = Array.from({ length: 5 }, (_, i) => ({ name: `Referee ${i + 1}`, title: 'Head of Operations, my manager 2019 - 2024', organization: 'Northwind Traders', contact: `referee${i + 1}@example.com · +91 98765 4321${i}` }));
  for (const template of ['compact-professional', 'classic-professional', 'executive-impact']) {
    for (const density of ['compact', 'standard']) {
      for (let shift = 0; shift <= 30; shift++) {
        const doc = pdf.generateResumePDF(shiftedResume(template, density, shift, { references }));
        const pageOf = text => doc.pages.findIndex(page => page.elements.some(e => e.type === 'text' && e.text.includes(text)));
        references.forEach((ref, i) => {
          const name = pageOf(ref.name);
          assert(name >= 0, `${template}: ${ref.name} is printed`);
          assert(pageOf('Northwind') >= 0 && pageOf(`referee${i + 1}@`) === name, `${template} ${density} shift ${shift}: the contact of ${ref.name} is on another page than the name`);
        });
        const heading = doc.pages.findIndex(page => page.elements.some(e => e.type === 'text' && /^references$/i.test(e.text.trim())));
        assert.equal(heading, pageOf('Referee 1'), `${template} ${density} shift ${shift}: the References heading stays with the first referee`);
      }
    }
  }
});
check('Project tools start without a separator when they sit on their own line', () => {
  for (const template of Object.keys(TEMPLATES)) {
    const d = schema.migrate(require('../js/resume').SAMPLE_DATA);
    d.template = template; d.design.templateId = template;
    const texts = pdf.generateResumePDF(d).pages.flatMap(p => p.elements.filter(e => e.type === 'text'));
    const tools = texts.find(e => e.text.includes('Jira, Smartsheet'));
    const name = texts.find(e => e.text.includes('Enterprise Supply Chain'));
    if (Math.abs(tools.y - name.y) < 1) assert(tools.text.startsWith('|'), `${template}: tools on the name line follow a separator`);
    else assert(!tools.text.trim().startsWith('|'), `${template}: tools on their own line start with "${tools.text.slice(0, 3)}"`);
  }
});
check('Dates sit in one place per section, with the same spacing either way', () => {
  const d = schema.migrate({ template: 'classic-professional', personal: { fullName: 'Date Case' }, education: [
    { degree: 'B.Tech in Computer Science and Engineering', institution: 'RV College of Engineering', duration: '2022 - 2026', location: 'Bengaluru', score: 'CGPA 8.9 / 10' },
    { degree: 'Class XII (PCM), CBSE', institution: 'Kendriya Vidyalaya', duration: '2022', location: 'Bengaluru', score: '94.2%' }] });
  const texts = pdf.generateResumePDF(d).pages[0].elements.filter(e => e.type === 'text');
  const metas = texts.filter(e => /Bengaluru/.test(e.text));
  assert.equal(metas.length, 2);
  assert(metas.every(e => Math.abs(e.x - metas[0].x) < 0.5), 'both entries place their details the same way');
  assert(metas.every(e => e.text.includes('  •  ')), 'details keep their spaced separators');
  assert(texts.some(e => e.text === 'Class XII (PCM), CBSE  —  Kendriya Vidyalaya'), 'a title that fits keeps its spaced dash');
});
check('Characters the PDF fonts cannot write are named', () => {
  assert.deepEqual(pdf.unsupportedCharacters('Closed ₹12 lakh → done 😀, café – “ok” €5'), ['₹', '→', '😀']);
  assert.deepEqual(pdf.unsupportedCharacters('Plain​ text'), []);
});
check('The review names the character and the field that keep the PDF from downloading', () => {
  const { generateReviewReport } = require('../js/resume');
  const d = schema.migrate({ personal: { fullName: 'Asha Verma', email: 'asha@example.com', phone: '+91 98765 43210' },
    experience: [{ id: 'exp-a', role: 'Analyst', company: 'Firm', duration: '2024', bulletsText: 'Did a thing' }, { id: 'exp-b', role: 'Sales Associate', company: 'Shop', duration: '2023', bulletsText: 'Closed deals worth ₹12 lakh in three months' }] });
  const item = generateReviewReport(d, null).find(x => x.targetField === 'exp-bul-exp-b');
  assert(item, 'a finding points at the bullet field that holds ₹');
  assert(item.message.includes('“₹”'), item.message);
  assert.equal(item.where, 'Work experience, role 2');
  assert.deepEqual(item.replace, ['₹']);
  d.sectionVisibility.experience = false;
  assert(!generateReviewReport(d, 1).some(x => /built-in fonts/.test(x.message)), 'a hidden section does not print, so it is not reported');
});
check('An Indian-script name is named as a script, and only replaceable characters are offered a replacement', () => {
  const { generateReviewReport, unsupportedDownloadMessage } = require('../js/resume');
  const d = schema.migrate({ personal: { fullName: 'प्रिया शर्मा', email: 'priya@example.com' },
    experience: [{ id: 'exp-a', role: 'Analyst', company: 'Firm', duration: '2024', bulletsText: 'Closed deals worth ₹12 lakh' }] });
  const item = generateReviewReport(d, null).find(x => /built-in fonts/.test(x.message));
  assert(item.message.startsWith('Devanagari text and “₹” cannot'), item.message);
  for (const mark of ['्', 'ि', '“प”']) assert(!item.message.includes(mark), `no lone "${mark}" in: ${item.message}`);
  assert.deepEqual(item.replace, ['₹']);
  const odd = [{ chars: pdf.unsupportedCharacters('प्रिया शर्मा'), where: 'Contact details, name' }, { chars: ['₹'], where: 'Work experience, role 1' }];
  const toast = unsupportedDownloadMessage(odd);
  assert(toast.startsWith('Devanagari text in Contact details, name (and 1 more place) cannot go into this PDF'), toast);
  assert(toast.endsWith('The Review step shows where the rest is and can replace ₹ with Rs.'), toast);
  assert(!/replace it\b/.test(toast), toast);
  assert(unsupportedDownloadMessage([{ chars: ['😀'], where: 'Professional summary' }]).startsWith('Emoji in Professional summary'));
  assert(unsupportedDownloadMessage([{ chars: ['😀'], where: 'Professional summary' }]).endsWith('The Review step shows where.'));
  assert(unsupportedDownloadMessage([{ chars: ['₹', '✓'], where: 'Skills, row 1' }]).endsWith('can replace ₹ with Rs. and remove ✓.'));
});
check('Job keywords split a title line, skip degree words and match British and American spellings', () => {
  const keywords = require('../js/keywords');
  const job = 'Business Analyst - Graduate Programme\nYou will gather requirements from senior stakeholders and own data visualization in Power BI. A degree in any field is required. Organise workshops.';
  const result = keywords.matchKeywords(job, 'Business Analyst | B.Tech. Visualising sales data in Power BI; organised workshops for stakeholders.');
  assert(result.found.includes('Business Analyst'), 'the role in the title line is found on its own');
  assert(!result.keywords.some(term => /graduate programme/i.test(term) && /analyst/i.test(term)), 'the title line is not one long term');
  for (const filler of ['degree', 'field', 'senior', 'gather']) assert(!result.keywords.includes(filler), filler);
  for (const term of ['visualization', 'organise']) assert(result.found.some(found => found.toLowerCase() === term), `${term} matches the other spelling`);
});
(async () => {
  const { ensureMinKB } = require('../js/resizer');
  // A tiny JFIF JPEG header: SOI, APP0 (16 bytes), then the rest of an image.
  const app0 = [0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00];
  const jpeg = new Blob([new Uint8Array([0xFF, 0xD8, ...app0, 0xFF, 0xDB, 0x00, 0x04, 0x00, 0x00, 0xFF, 0xD9])], { type: 'image/jpeg' });
  const padded = await ensureMinKB(jpeg, 20, 30);
  const bytes = new Uint8Array(await padded.arrayBuffer());
  assert(padded.size >= 20 * 1024 && padded.size <= 30 * 1024, `padded size ${padded.size}`);
  assert.deepEqual([...bytes.subarray(0, 4)], [0xFF, 0xD8, 0xFF, 0xE0], 'APP0 stays straight after SOI');
  assert.equal(String.fromCharCode(...bytes.subarray(6, 10)), 'JFIF');
  assert.deepEqual([...bytes.subarray(20, 22)], [0xFF, 0xFE], 'padding is a comment segment after APP0');
  assert.deepEqual([...bytes.subarray(-2)], [0xFF, 0xD9], 'image still ends with EOI');
  checks++; console.log('✓ Padding a JPEG up to a minimum KB keeps the JFIF header first');
  console.log(`\n${checks} behavior regression checks passed.`);
})().catch(e => { console.error(e); process.exit(1); });
