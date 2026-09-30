'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { resumeFixture } = require('./fixtures');
const { generateResumePDF } = require('../js/pdf-engine');
const { TEMPLATES } = require('../js/templates');

// Extract the real PDF glyph bounds: strings in source are insufficient to detect clipping.
function checkLongDocuments(output) {
  let documents = 0;
  for (const template of Object.keys(TEMPLATES)) for (const pageSize of ['a4', 'letter']) for (const fontFamily of ['serif', 'sans']) {
    const data = resumeFixture();
    data.template = template;
    Object.assign(data.design, { pageSize, fontFamily, fontSize: 'comfortable' });
    data.personal.fullName = 'Jordan A Very Long Professional Full Name With Many Components Lee';
    data.personal.targetTitle = 'Senior Director of Cross-Functional Operations and Reporting in International Programme Management';
    data.personal.website = 'https://example.com/portfolio/' + 'long-readable-link-'.repeat(16);
    data.experience = Array.from({length:12}, (_,i) => ({
      id:'exp-'+i, role:`ROLE_${i} Senior Operations and Strategic Business Transformation Programme Analyst`,
      company:'An Organization With an Unusually Long Official Business Name for International Projects',
      duration:'January 2019 – September 2026, permanent full-time appointment',
      location:'Bengaluru, Karnataka, India, with remote cross-border collaboration',
      bulletsText:Array(5).fill('Delivered measurable improvements to operational reporting, stakeholder coordination, and budgeting across 18 regional teams, reducing annual processing time by 25% while maintaining clear documentation and training.').join('\n')
    }));
    Object.assign(data.projects[0], {
      name:'Long Project Title ' + 'portfolio'.repeat(14),
      tech:'Operations, Analytics, Project Coordination, Reporting, Budgeting and International Stakeholder Communication '.repeat(3),
      link:'https://example.com/' + 'project-'.repeat(40)
    });
    const doc = generateResumePDF(data);
    const file = path.join(output,`long-${template}-${pageSize}-${fontFamily}.pdf`);
    fs.writeFileSync(file,Buffer.from(doc.build(),'latin1'));
    const text = execFileSync('pdftotext',[file,'-'],{encoding:'utf8'});
    assert(text.includes('ROLE_11') && text.includes('GRANT_MARKER'), 'Long exports retain the final role and optional sections');
    assert(doc.getPageCount() > 2, 'Long resumes paginate');
    const bbox = execFileSync('pdftotext',['-bbox',file,'-'],{encoding:'utf8'});
    for (const page of bbox.matchAll(/<page width="([\d.]+)" height="([\d.]+)">([\s\S]*?)<\/page>/g)) {
      for (const word of page[3].matchAll(/<word xMin="([\d.-]+)" yMin="([\d.-]+)" xMax="([\d.-]+)" yMax="([\d.-]+)"/g)) {
        assert(+word[1] >= 25 && +word[3] <= +page[1]-20 && +word[2] >= 10 && +word[4] <= +page[2]-20, `${template}/${pageSize}/${fontFamily}: text outside paper bounds ${word[0]}`);
      }
    }
    documents++;
  }
  return documents;
}
module.exports = { checkLongDocuments };
