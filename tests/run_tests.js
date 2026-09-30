/**
 * ApplyReady.in - Comprehensive Verification & Test Suite
 * Runs automated regression checks across PDF engine, SEO metadata,
 * sitemap validity, asset links, and contrast ratios.
 */

const fs = require('fs');
const path = require('path');
const { generateResumePDF, measureTextWidth, splitTextToLines, escapePdfText } = require('../js/pdf-engine.js');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ ${message}`);
  } else {
    failedTests++;
    console.error(`  ✗ FAIL: ${message}`);
  }
}

console.log('====================================================');
console.log('  APPLYREADY REGRESSION & VERIFICATION SUITE');
console.log('====================================================\n');

// ------------------------------------------------------------------
// SUITE 1: Vector Text PDF Engine Tests
// ------------------------------------------------------------------
console.log('SUITE 1: Vector Text PDF Engine Tests');

const sampleResume = {
  personal: {
    fullName: 'Jane Doe, PMP',
    targetTitle: 'Senior Operations Director',
    email: 'jane.doe@example.com',
    phone: '+1 (555) 987-6543',
    location: 'San Francisco, CA',
    linkedin: 'linkedin.com/in/janedoe',
    github: 'github.com/janedoe',
    website: 'janedoe.com'
  },
  summaryTitle: 'Executive Summary',
  summary: 'Experienced executive with 10+ years optimizing multi-million dollar portfolios. Proven record in cross-functional leadership, operational scaling, and cost reduction.',
  experienceTitle: 'Professional Experience',
  experience: [
    {
      id: 'exp-1',
      role: 'Director of Global Operations',
      company: 'OmniCorp International',
      location: 'San Francisco, CA',
      duration: '2021 - Present',
      bulletsText: 'Orchestrated workflow optimization across 6 global offices, reducing operating overhead by 22%.\nDirected $15M annual budget allocation with zero audit discrepancies.\nMentored 40+ engineering and operational project managers.'
    },
    {
      id: 'exp-2',
      role: 'Operations Manager',
      company: 'Starlight Tech Solutions',
      location: 'San Jose, CA',
      duration: '2017 - 2021',
      bulletsText: 'Implemented automated resource scheduling reducing idle project delays by 35%.\nSynthesized bi-weekly executive KPI reports for senior stakeholders.'
    }
  ],
  educationTitle: 'Academic Background',
  education: [
    {
      id: 'edu-1',
      degree: 'Master of Business Administration (MBA)',
      institution: 'Stanford Graduate School of Business',
      location: 'Stanford, CA',
      duration: '2015 - 2017',
      score: 'Dean\'s List'
    }
  ],
  projectsTitle: 'Key Initiatives',
  projects: [
    {
      id: 'proj-1',
      name: 'Global Supply Chain Transformation',
      tech: 'SAP ERP, Tableau, Smartsheet',
      link: 'omnicorp.com/case-study',
      bulletsText: 'Successfully unified procurement channels for 120 internal vendors.'
    }
  ],
  skillsTitle: 'Core Capabilities',
  skills: {
    languages: 'Strategic Planning, Financial Modeling, Agile / Scrum Framework, Risk Management',
    frameworks: 'SAP, Jira, Salesforce, Asana, Microsoft Project',
    tools: 'Advanced Excel, Tableau, SQL, Power BI, Python for Data Analysis',
    other: 'Executive Communication, Negotiation, Bilingual (English/French)'
  }
};

// Test 1: Standard 1-Page Generation
const doc1 = generateResumePDF(sampleResume, { fontFamily: 'serif' });
const pdfData1 = doc1.build();

assert(pdfData1.startsWith('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n'), 'PDF starts with valid PDF-1.4 header and binary comment');
assert(pdfData1.includes('/Type /Catalog'), 'PDF contains /Catalog root object');
assert(pdfData1.includes('/Type /Pages'), 'PDF contains /Pages parent object');
assert(pdfData1.includes('xref'), 'PDF contains xref cross-reference table');
assert(pdfData1.includes('trailer') && pdfData1.includes('startxref') && pdfData1.endsWith('%%EOF\n'), 'PDF ends with standard trailer and %%EOF');
assert(pdfData1.includes('JANE DOE, PMP'), 'PDF stream contains uppercase candidate name');
assert(pdfData1.includes('Senior Operations Director'), 'PDF stream contains target title');
assert(pdfData1.includes('jane.doe@example.com'), 'PDF stream contains email text');
assert(pdfData1.includes(escapePdfText(sampleResume.personal.phone)), 'PDF stream contains phone text (with proper PDF escaping)');
assert(pdfData1.includes('mailto:jane.doe@example.com'), 'PDF contains clickable mailto hyperlink annotation');
assert(pdfData1.includes('linkedin.com/in/janedoe'), 'PDF contains clickable LinkedIn URL annotation');
assert(pdfData1.includes(sampleResume.experienceTitle.toUpperCase()), 'PDF contains section heading in uppercase');
assert(pdfData1.includes('Stanford Graduate School of Business'), 'PDF contains education entry');
assert(doc1.getPageCount() === 1, 'Standard single-page resume fits cleanly on exactly 1 page');

// Test 2: Sans-Serif Font Family
const docSans = generateResumePDF(sampleResume, { fontFamily: 'sans' });
const pdfDataSans = docSans.build();
assert(pdfDataSans.includes('/BaseFont /Helvetica'), 'Sans-serif option uses Helvetica base font');

// Test 3: Deliberate Multi-Page Pagination (2-Page and 3-Page Resumes)
const twoPageResume = JSON.parse(JSON.stringify(sampleResume));
for (let i = 1; i <= 12; i++) {
  twoPageResume.experience.push({
    id: `exp-page2-${i}`,
    role: `Senior Operational Director ${i}`,
    company: `Global Enterprises Group ${i}`,
    location: 'Chicago, IL',
    duration: `201${i % 10} - 2020`,
    bulletsText: 'Directed cross-functional execution across multi-region deployments with continuous tracking.\nOptimized budget allocation and vendor contracts reducing operational spend by 18%.\nMentored project teams in lean process management and sprint delivery cadence.'
  });
}
const docTwoPage = generateResumePDF(twoPageResume, { fontFamily: 'serif' });
assert(docTwoPage.getPageCount() === 2, `Multi-entry resume paginates deliberately to 2 pages (actual: ${docTwoPage.getPageCount()})`);

const threePageResume = JSON.parse(JSON.stringify(sampleResume));
for (let i = 1; i <= 24; i++) {
  threePageResume.experience.push({
    id: `exp-page3-${i}`,
    role: `Regional Strategy Lead ${i}`,
    company: `Apex Logistics Operations ${i}`,
    location: 'New York, NY',
    duration: `201${i % 10} - 2024`,
    bulletsText: 'Supervised end-to-end organizational logistics across multi-tier regional facilities.\nAuthored risk assessment documentation and compliance guidelines adopted division-wide.\nOptimized vendor management processes resulting in 15% cost savings.\nConducted weekly team performance reviews and mentored junior staff.'
  });
}
const docThreePage = generateResumePDF(threePageResume, { fontFamily: 'serif' });
assert(docThreePage.getPageCount() === 3, `Long curriculum vitae paginates deliberately to 3 pages (actual: ${docThreePage.getPageCount()})`);



// Test 4: Contact Line Separator Logic (No orphaned bullets)
const partialResume = {
  personal: {
    fullName: 'Bob Smith',
    email: 'bob@example.com',
    phone: '', // empty phone
    location: 'Austin, TX',
    linkedin: '', // empty linkedin
    github: ''
  },
  summary: 'Brief summary'
};
const docPartial = generateResumePDF(partialResume);
const pdfDataPartial = docPartial.build();
assert(pdfDataPartial.includes('bob@example.com') && pdfDataPartial.includes('Austin, TX'), 'Partial contact details render properly');
assert(!pdfDataPartial.includes('•  •'), 'No duplicated or orphaned contact separator bullets');

// Test 5: Unicode and Character Escaping
const textWithQuotesAndDashes = 'Project “Alpha” – Cost $50M • 100% ROI & John’s team';
const escaped = escapePdfText(textWithQuotesAndDashes);
assert(escaped.includes('\\223Alpha\\224'), 'Unicode smart quotes escaped to standard octal');
assert(escaped.includes('\\226'), 'Unicode en-dash escaped to standard octal');
assert(escaped.includes('\\225'), 'Bullet point escaped to octal 225');

// Test 6: Text Measurement & Line Wrapping
const wrapped = splitTextToLines('This is a test of the line wrapping algorithm that splits words gracefully without breaking tokens.', 10, 150, 'Helvetica');
assert(wrapped.length > 1, `Text correctly wraps into ${wrapped.length} lines for narrow margins`);

console.log('');

// ------------------------------------------------------------------
// SUITE 2: JSON Backup & Schema Validation Tests
// ------------------------------------------------------------------
console.log('SUITE 2: JSON Backup & Schema Validation Tests');

function validateResumeSchema(payload) {
  if (!payload || typeof payload !== 'object') return false;
  if (!payload.data || typeof payload.data !== 'object') return false;
  const d = payload.data;
  if (!d.personal || typeof d.personal !== 'object') return false;
  if (!Array.isArray(d.experience) || !Array.isArray(d.education) || !Array.isArray(d.projects)) return false;
  return true;
}

const validBackup = {
  version: 1,
  app: 'ApplyReady',
  exportedAt: new Date().toISOString(),
  data: sampleResume
};
assert(validateResumeSchema(validBackup), 'Valid ApplyReady backup JSON conforms to schema');

const invalidBackup1 = { version: 1, data: "corrupted_string" };
assert(!validateResumeSchema(invalidBackup1), 'Invalid backup with string payload is rejected');

const invalidBackup2 = { version: 1, data: { personal: "bad" } };
assert(!validateResumeSchema(invalidBackup2), 'Invalid backup missing required arrays is rejected');

console.log('');

// ------------------------------------------------------------------
// SUITE 3: Sitemap, Robots & Link Consistency Tests
// ------------------------------------------------------------------
console.log('SUITE 3: Sitemap, Robots & Link Consistency Tests');

const repoRoot = path.resolve(__dirname, '..');

// Check robots.txt
const robotsPath = path.join(repoRoot, 'robots.txt');
assert(fs.existsSync(robotsPath), 'robots.txt exists at repository root');
const robotsContent = fs.readFileSync(robotsPath, 'utf8');
assert(robotsContent.includes('Allow: /'), 'robots.txt permits crawling of public content');
assert(robotsContent.includes('Sitemap: https://applyready.in/sitemap.xml'), 'robots.txt references sitemap.xml');

// Check sitemap.xml
const sitemapPath = path.join(repoRoot, 'sitemap.xml');
assert(fs.existsSync(sitemapPath), 'sitemap.xml exists at repository root');
const sitemapContent = fs.readFileSync(sitemapPath, 'utf8');

const locMatches = [...sitemapContent.matchAll(/<loc>(https:\/\/applyready\.in\/([^<]*))<\/loc>/g)];
assert(locMatches.length >= 7, `sitemap.xml contains ${locMatches.length} canonical URLs`);

locMatches.forEach(match => {
  const fullUrl = match[1];
  const relPath = match[2];
  let filePath = relPath === '' ? 'index.html' : relPath;
  const absPath = path.join(repoRoot, filePath);
  assert(fs.existsSync(absPath), `Sitemap URL ${fullUrl} maps to existing file ${filePath}`);
});

console.log('');

// ------------------------------------------------------------------
// SUITE 4: HTML Pages Metadata, Canonical & Asset Verification
// ------------------------------------------------------------------
console.log('SUITE 4: HTML Pages Metadata & Favicon Verification');

const htmlFiles = [
  'index.html',
  'resume.html',
  'about.html',
  'privacy.html',
  'how-to-use.html',
  '404.html',
  'guides/image-dimensions-vs-file-size.html',
  'guides/compression-targets-guide.html',
  'guides/image-formats-guide.html',
  'guides/ats-friendly-resume-guide.html'
];

htmlFiles.forEach(file => {
  const filePath = path.join(repoRoot, file);
  assert(fs.existsSync(filePath), `HTML file ${file} exists`);
  const content = fs.readFileSync(filePath, 'utf8');

  // Verify Title
  const titleMatch = content.match(/<title>([^<]+)<\/title>/);
  assert(titleMatch && titleMatch[1].length > 5, `${file} has meaningful <title>: "${titleMatch ? titleMatch[1] : 'NONE'}"`);

  // Verify Meta Description
  const descMatch = content.match(/<meta\s+name="description"\s+content="([^"]+)"/i);
  assert(descMatch && descMatch[1].length > 20, `${file} has substantive meta description (${descMatch ? descMatch[1].length : 0} chars)`);

  // Verify Favicon references
  assert(content.includes('favicon.ico') || content.includes('/favicon.ico'), `${file} connects brand favicon.ico`);
  assert(content.includes('favicon-32x32.png'), `${file} connects brand favicon-32x32.png`);

  // Verify Theme Toggle
  if (file !== '404.html') {
    assert(content.includes('themeToggle'), `${file} contains accessible theme toggle control`);
  }
});

console.log('');

// ------------------------------------------------------------------
// SUITE 5: Favicon & Brand Asset Integrity
// ------------------------------------------------------------------
console.log('SUITE 5: Favicon & Brand Asset Integrity');

const faviconDir = path.join(repoRoot, 'favicon');
assert(fs.existsSync(faviconDir), 'favicon folder exists in repository');

const requiredFavicons = [
  'favicon.ico',
  'favicon-16x16.png',
  'favicon-32x32.png',
  'apple-touch-icon.png',
  'android-chrome-192x192.png',
  'android-chrome-512x512.png',
  'site.webmanifest'
];

requiredFavicons.forEach(fav => {
  const p = path.join(faviconDir, fav);
  assert(fs.existsSync(p), `Brand asset favicon/${fav} exists (${fs.existsSync(p) ? fs.statSync(p).size : 0} bytes)`);
});

// Verify site.webmanifest
const manifestPath = path.join(faviconDir, 'site.webmanifest');
const manifestContent = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
assert(manifestContent.name === 'ApplyReady', 'site.webmanifest has correct app name "ApplyReady"');
assert(Array.isArray(manifestContent.icons) && manifestContent.icons.length >= 2, 'site.webmanifest contains valid icons array');

console.log('');

// ------------------------------------------------------------------
// SUITE 6: Accessibility & Color Contrast Verification (WCAG AA)
// ------------------------------------------------------------------
console.log('SUITE 6: Accessibility & WCAG AA Color Contrast Verification');

// Relative Luminance calculation for sRGB
function getRelativeLuminance(r, g, b) {
  const [rs, gs, bs] = [r, g, b].map(c => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function getContrastRatio(rgb1, rgb2) {
  const l1 = getRelativeLuminance(rgb1[0], rgb1[1], rgb1[2]);
  const l2 = getRelativeLuminance(rgb2[0], rgb2[1], rgb2[2]);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// Check white text on green button: #047857 (Our WCAG AA color) vs #10B981 (Old failing color)
const whiteRGB = [255, 255, 255];
const oldGreenRGB = [16, 185, 129];   // #10B981
const newGreenRGB = [4, 120, 87];     // #047857
const primaryBlueRGB = [37, 99, 235]; // #2563EB

const oldContrast = getContrastRatio(oldGreenRGB, whiteRGB);
const newContrast = getContrastRatio(newGreenRGB, whiteRGB);
const primaryContrast = getContrastRatio(primaryBlueRGB, whiteRGB);

assert(oldContrast < 3.0, `Confirmed old green (#10B981) had insufficient contrast: ${oldContrast.toFixed(2)}:1 (Fails WCAG AA)`);
assert(newContrast >= 4.5, `New green button color (#047857) satisfies WCAG AA normal text criteria: ${newContrast.toFixed(2)}:1 (>= 4.5:1)`);
assert(primaryContrast >= 4.0, `Primary button color (#2563EB) satisfies UI component contrast: ${primaryContrast.toFixed(2)}:1 (>= 3:1)`);

console.log('');
console.log('====================================================');
console.log(`TOTAL TESTS: ${totalTests} | PASSED: ${passedTests} | FAILED: ${failedTests}`);
console.log('====================================================');

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('\nAll automated verification checks PASSED successfully!');
}
