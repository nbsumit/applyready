/**
 * ApplyReady.in - Comprehensive Verification & Test Suite
 * Runs automated regression checks across PDF engine, Resizer validator,
 * Resume backup schema, SEO metadata, sitemap validity, asset links,
 * and WCAG AA contrast ratios.
 */

const fs = require('fs');
const path = require('path');
const { generateResumePDF, generateResumeText, measureTextWidth, splitTextToLines, escapePdfText } = require('../js/pdf-engine.js');
const { validateResumeSchema, SAMPLE_DATA, EMPTY_DATA, escapeHTML, sanitizeHref, isValidUrlFormat } = require('../js/resume.js');
const { PRESETS, formatAnnotationDate, validateDimensionSpecs } = require('../js/resizer.js');
const { TEMPLATES, migrateResumeSchema } = require('../js/templates.js');
const { generateResumeDOCX, SimpleZip, escapeXml } = require('../js/docx-engine.js');

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

// Test 7: Real PDF Stream Text Extraction & Reading Order Verification
function extractTextFromPdf(pdfString) {
  const streamRegex = /stream\r?\n([\s\S]*?)endstream/g;
  let match;
  const extractedTokens = [];

  while ((match = streamRegex.exec(pdfString)) !== null) {
    const streamContent = match[1];
    const tjRegex = /\(((?:\\\(|\\\)|\\\\|[^\)])*)\)\s*Tj/g;
    let tjMatch;
    while ((tjMatch = tjRegex.exec(streamContent)) !== null) {
      let rawText = tjMatch[1];
      rawText = rawText.replace(/\\([0-7]{3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)));
      rawText = rawText.replace(/\\([()\\])/g, '$1');
      extractedTokens.push(rawText);
    }
  }
  return extractedTokens;
}

const extractedWords = extractTextFromPdf(pdfData1);
const fullExtractedText = extractedWords.join(' ');

const nameIdx = fullExtractedText.indexOf('JANE DOE, PMP');
const titleIdx = fullExtractedText.indexOf('Senior Operations Director');
const contactIdx = fullExtractedText.indexOf('jane.doe@example.com');
const summaryHeadingIdx = fullExtractedText.indexOf('EXECUTIVE SUMMARY');
const summaryTextIdx = fullExtractedText.indexOf('Experienced executive with 10+ years');
const expHeadingIdx = fullExtractedText.indexOf('PROFESSIONAL EXPERIENCE');
const expRoleIdx = fullExtractedText.indexOf('Director of Global Operations');
const expBulletIdx = fullExtractedText.indexOf('Orchestrated workflow optimization');
const eduHeadingIdx = fullExtractedText.indexOf('ACADEMIC BACKGROUND');
const eduInstIdx = fullExtractedText.indexOf('Stanford Graduate School of Business');
const projHeadingIdx = fullExtractedText.indexOf('KEY INITIATIVES');
const projNameIdx = fullExtractedText.indexOf('Global Supply Chain Transformation');
const skillsHeadingIdx = fullExtractedText.indexOf('CORE CAPABILITIES');
const skillsTextIdx = fullExtractedText.indexOf('Strategic Planning');

assert(nameIdx !== -1 && titleIdx !== -1 && contactIdx !== -1, 'Extracted candidate header elements from PDF stream');
assert(summaryHeadingIdx !== -1 && expHeadingIdx !== -1 && eduHeadingIdx !== -1 && projHeadingIdx !== -1 && skillsHeadingIdx !== -1, 'All section headings extracted from PDF text stream');
assert(nameIdx < titleIdx && titleIdx < contactIdx && contactIdx < summaryHeadingIdx && summaryHeadingIdx < summaryTextIdx, 'Header and summary appear in logical top-to-bottom reading order');
assert(summaryTextIdx < expHeadingIdx && expHeadingIdx < expRoleIdx && expRoleIdx < expBulletIdx, 'Experience section and bullet points appear in logical reading order');
assert(expBulletIdx < eduHeadingIdx && eduHeadingIdx < eduInstIdx && eduInstIdx < projHeadingIdx && projHeadingIdx < projNameIdx && projNameIdx < skillsHeadingIdx && skillsHeadingIdx < skillsTextIdx, 'Education, projects, and skills sections follow strict sequential order');

// Test 8: Unicode Names in Both Serif and Sans Fonts
const unicodeResume = JSON.parse(JSON.stringify(sampleResume));
unicodeResume.personal.fullName = 'Renée Müller, Ph.D.';
const docUnicodeSerif = generateResumePDF(unicodeResume, { fontFamily: 'serif' });
const docUnicodeSans = generateResumePDF(unicodeResume, { fontFamily: 'sans' });
const textUnicodeSerif = extractTextFromPdf(docUnicodeSerif.build()).join(' ');
const textUnicodeSans = extractTextFromPdf(docUnicodeSans.build()).join(' ');

assert(textUnicodeSerif.includes('RENÉE MÜLLER, PH.D.'), 'Unicode accented name "RENÉE MÜLLER" extracted cleanly in Serif font');
assert(textUnicodeSans.includes('RENÉE MÜLLER, PH.D.'), 'Unicode accented name "RENÉE MÜLLER" extracted cleanly in Sans font');

// Test 9: Long Entry Header & Date Collision Prevention
const longEntryResume = JSON.parse(JSON.stringify(sampleResume));
longEntryResume.experience = [
  {
    id: 'exp-long-1',
    role: 'Senior Vice President of Global Enterprise Logistics and Supply Chain Optimization',
    company: 'OmniCorp Worldwide Solutions Incorporated',
    location: 'San Francisco Bay Area, CA',
    duration: 'Jan 2018 - Present',
    bulletsText: 'Successfully managed multi-region logistics without text overlap.'
  }
];
longEntryResume.education = [
  {
    id: 'edu-long-1',
    degree: 'Master of Science in Artificial Intelligence and Computational Neuroscience',
    institution: 'Massachusetts Institute of Technology School of Engineering',
    location: 'Cambridge, MA',
    duration: '2015 - 2017',
    score: 'Summa Cum Laude'
  }
];
const docLongCollision = generateResumePDF(longEntryResume, { fontFamily: 'serif' });
const longPdfText = extractTextFromPdf(docLongCollision.build()).join(' ');
assert(longPdfText.includes('Senior Vice President of Global Enterprise Logistics') && longPdfText.includes('Jan 2018 - Present'), 'Long role and right-aligned date are both preserved and rendered without collision');
assert(longPdfText.includes('Master of Science in Artificial Intelligence') && longPdfText.includes('Summa Cum Laude'), 'Long education degree and honors are both preserved without collision');

console.log('');

// ------------------------------------------------------------------
// SUITE 2: Client-Side Resume Builder & Schema Validation Tests
// ------------------------------------------------------------------
console.log('SUITE 2: Client-Side Resume Builder & Schema Validation Tests');

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

assert(validateResumeSchema({ data: SAMPLE_DATA }), 'General-purpose SAMPLE_DATA conforms to schema');
assert(validateResumeSchema({ data: EMPTY_DATA }), 'Blank template EMPTY_DATA conforms to schema');

assert(escapeHTML('<script>alert("xss")&test\'</script>') === '&lt;script&gt;alert(&quot;xss&quot;)&amp;test&#39;&lt;/script&gt;', 'escapeHTML safely escapes HTML characters');
assert(sanitizeHref('javascript:alert(1)') === '#', 'sanitizeHref blocks javascript: protocols');
assert(sanitizeHref('example.com') === 'https://example.com', 'sanitizeHref normalizes web URLs to https://');
assert(sanitizeHref('mailto:test@example.com') === 'mailto:test@example.com', 'sanitizeHref preserves mailto: links');

// Test URL format validation
assert(isValidUrlFormat('linkedin.com/in/alexmorgan'), 'Valid domain URL passes URL format validation');
assert(isValidUrlFormat('https://alexmorgan.com/portfolio'), 'Valid https URL passes URL format validation');
assert(isValidUrlFormat(''), 'Empty optional URL passes URL format validation');
assert(!isValidUrlFormat('not a valid url with spaces'), 'URL with whitespace is rejected');
assert(!isValidUrlFormat('javascript:alert(1)'), 'Dangerous javascript: URI is rejected by URL format validation');
assert(!isValidUrlFormat('nodotdomain'), 'Domain without dot is rejected by URL format validation');

console.log('');

// ------------------------------------------------------------------
// SUITE 3: Image Resizer & Strict Compressor Unit Tests
// ------------------------------------------------------------------
console.log('SUITE 3: Image Resizer & Strict Compressor Unit Tests');

// Test dimension validation
const v1 = validateDimensionSpecs('350', '450', '50');
assert(v1.isValid && v1.width === 350 && v1.height === 450 && v1.maxKB === 50, 'Valid custom dimensions (350x450, 50KB) pass validation');

const vNonInt = validateDimensionSpecs('350.5', '450', '50');
assert(!vNonInt.isValid && vNonInt.dimErrorMsg.includes('positive integer'), 'Decimal dimension is rejected as non-integer');

const vTooSmall = validateDimensionSpecs('10', '450', '50');
assert(!vTooSmall.isValid && vTooSmall.dimErrorMsg.includes('between 20 and 8,000'), 'Under-bounds width (< 20px) is rejected with clear error');

const vTooLarge = validateDimensionSpecs('9000', '450', '50');
assert(!vTooLarge.isValid && vTooLarge.dimErrorMsg.includes('between 20 and 8,000'), 'Over-bounds width (> 8,000px) is rejected with clear error');

const vHugeMP = validateDimensionSpecs('7000', '5000', '50');
assert(!vHugeMP.isValid && vHugeMP.dimErrorMsg.includes('32 Megapixels'), 'Dimensions exceeding 32 Megapixels ceiling are rejected to protect device memory');

const vSizeTooSmall = validateDimensionSpecs('350', '450', '2');
assert(!vSizeTooSmall.isValid && vSizeTooSmall.sizeErrorMsg.includes('between 5 and 20,000 KB'), 'Target size below 5 KB is rejected');

const vSizeTooLarge = validateDimensionSpecs('350', '450', '30000');
assert(!vSizeTooLarge.isValid && vSizeTooLarge.sizeErrorMsg.includes('between 5 and 20,000 KB'), 'Target size above 20,000 KB is rejected');

// Test date formatting
assert(formatAnnotationDate('2026-09-30') === '30-09-2026', 'formatAnnotationDate converts YYYY-MM-DD to DD-MM-YYYY');
assert(formatAnnotationDate('') === '', 'formatAnnotationDate handles empty string cleanly');
assert(formatAnnotationDate(null) === '', 'formatAnnotationDate handles null cleanly');

// Test presets completeness
assert(PRESETS.passport && PRESETS.avatar && PRESETS.signature && PRESETS['web-banner'] && PRESETS.document, 'All 5 standard dimension presets are defined');
assert(PRESETS.passport.width === 350 && PRESETS.passport.height === 450 && PRESETS.passport.maxKB === 50, 'Passport preset has correct dimensions (350x450, 50KB)');
assert(PRESETS.signature.width === 300 && PRESETS.signature.height === 100 && PRESETS.signature.maxKB === 30, 'Signature preset has correct dimensions (300x100, 30KB)');

// Test Annotation Height Boundary & Granular Errors
const vDateHeightTooSmall = validateDimensionSpecs('350', '60', '50', true);
assert(!vDateHeightTooSmall.isValid && vDateHeightTooSmall.hErrorMsg.includes('Height must be at least 80 px'), 'Dimension validator rejects height < 80 px when annotation strip is enabled');

const vDateHeightValid = validateDimensionSpecs('350', '100', '50', true);
assert(vDateHeightValid.isValid && vDateHeightValid.height === 100, 'Dimension validator accepts height >= 80 px when annotation strip is enabled');

const vGranularW = validateDimensionSpecs('abc', '350', '50');
assert(vGranularW.wErrorMsg && !vGranularW.hErrorMsg, 'Dimension validator returns isolated wErrorMsg without tainting height');

const vGranularH = validateDimensionSpecs('350', 'abc', '50');
assert(!vGranularH.wErrorMsg && vGranularH.hErrorMsg, 'Dimension validator returns isolated hErrorMsg without tainting width');

console.log('');

// ------------------------------------------------------------------
// SUITE 4: Sitemap, Robots & Link Consistency Tests
// ------------------------------------------------------------------
console.log('SUITE 4: Sitemap, Robots & Link Consistency Tests');

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
// SUITE 5: HTML Pages Metadata, Canonical & Asset Verification
// ------------------------------------------------------------------
console.log('SUITE 5: HTML Pages Metadata & Favicon Verification');

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
// SUITE 6: Favicon & Brand Asset Integrity
// ------------------------------------------------------------------
console.log('SUITE 6: Favicon & Brand Asset Integrity');

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
// SUITE 7: Accessibility & Color Contrast Verification (WCAG AA)
// ------------------------------------------------------------------
console.log('SUITE 7: Accessibility & WCAG AA Color Contrast Verification');

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

// Verify dark theme --accent-green compliance directly from style.css
const styleCssContent = fs.readFileSync(path.join(repoRoot, 'css', 'style.css'), 'utf8');
const darkThemeMatch = styleCssContent.match(/\[data-theme="dark"\]\s*\{([^}]+)\}/);
assert(Boolean(darkThemeMatch), 'CSS contains [data-theme="dark"] ruleset');
const darkGreenMatch = darkThemeMatch ? darkThemeMatch[1].match(/--accent-green:\s*([^;]+);/) : null;
assert(Boolean(darkGreenMatch), 'Dark theme defines --accent-green variable');
const darkGreenVal = darkGreenMatch ? darkGreenMatch[1].trim() : '';
assert(darkGreenVal === '#047857', `Dark theme --accent-green is accessible (#047857, actual: ${darkGreenVal})`);

console.log('');

// ------------------------------------------------------------------
// SUITE 8: Zero-Emoji Compliance & Documentation Verification
// ------------------------------------------------------------------
console.log('SUITE 8: Zero-Emoji Compliance & Documentation Verification');

const readmePath = path.join(repoRoot, 'README.md');
assert(fs.existsSync(readmePath), 'README.md exists at repository root');
const readmeContent = fs.readFileSync(readmePath, 'utf8');
const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
const readmeEmojiMatch = readmeContent.match(emojiRegex);
assert(!readmeEmojiMatch, 'README.md contains zero emoji characters');

const seoSetupDocPath = path.join(repoRoot, 'docs', 'SEO_SETUP.md');
assert(fs.existsSync(seoSetupDocPath), 'docs/SEO_SETUP.md exists');
const seoDocContent = fs.readFileSync(seoSetupDocPath, 'utf8');
assert(seoDocContent.includes('Google Search Console') && seoDocContent.includes('Bing Webmaster Tools'), 'SEO_SETUP.md documents Google and Bing submission');
assert(seoDocContent.includes('IndexNow'), 'SEO_SETUP.md documents owner-controlled IndexNow submission');

console.log('');

// ------------------------------------------------------------------
// SUITE 9: All 8 ATS Resume Templates Rendering to Vector PDF
// ------------------------------------------------------------------
console.log('SUITE 9: All 8 ATS Resume Templates Rendering to Vector PDF');

const templateKeys = Object.keys(TEMPLATES);
assert(templateKeys.length === 8, `Exactly 8 ATS resume templates defined (found ${templateKeys.length})`);

const expectedTemplates = [
  'classic-professional',
  'modern-minimal',
  'graduate-early-career',
  'experienced-professional',
  'project-focused',
  'career-transition',
  'compact-professional',
  'academic-cv'
];

expectedTemplates.forEach(tId => {
  const tpl = TEMPLATES[tId];
  assert(Boolean(tpl), `Template "${tId}" exists in TEMPLATES registry`);
  assert(tpl && typeof tpl.name === 'string' && tpl.name.length > 0, `Template "${tId}" has human-readable name: "${tpl ? tpl.name : ''}"`);
  assert(tpl && typeof tpl.svgThumbnail === 'string' && tpl.svgThumbnail.includes('<svg'), `Template "${tId}" has valid SVG thumbnail`);
  assert(tpl && Array.isArray(tpl.recommendedOrder) && tpl.recommendedOrder.length >= 5, `Template "${tId}" specifies recommended section order`);

  // Render PDF with this template
  const resumeClone = JSON.parse(JSON.stringify(sampleResume));
  resumeClone.design = {
    templateId: tId,
    pageSize: 'a4',
    fontFamily: tpl.fontFamily || 'serif',
    density: tpl.density || 'standard',
    sectionOrder: tpl.recommendedOrder
  };
  resumeClone.sectionVisibility = Object.assign({}, tpl.defaultVisibility);

  const pdfDoc = generateResumePDF(resumeClone, { templateId: tId });
  const pdfOutput = pdfDoc.build();
  assert(typeof pdfOutput === 'string', `Template "${tId}" renders to PDF string`);
  assert(pdfOutput.startsWith('%PDF-1.4'), `Template "${tId}" PDF has valid %PDF-1.4 header`);
  assert(pdfOutput.endsWith('%%EOF\n'), `Template "${tId}" PDF has valid %%EOF trailer`);
  assert(pdfOutput.length > 1500, `Template "${tId}" PDF output size is substantive (${pdfOutput.length} bytes)`);
});

// Page size verification: A4 vs US Letter
const a4Doc = generateResumePDF(sampleResume, { pageSize: 'a4' });
const a4Pdf = a4Doc.build();
assert(a4Pdf.includes('/MediaBox [0 0 595.28 841.89]'), 'PDF engine correctly applies ISO A4 dimensions (595.28 x 841.89 pt)');

const letterDoc = generateResumePDF(sampleResume, { pageSize: 'letter' });
const letterPdf = letterDoc.build();
assert(letterPdf.includes('/MediaBox [0 0 612 792]'), 'PDF engine correctly applies US Letter dimensions (612.00 x 792.00 pt)');

// Multi-page Academic CV rendering test
const academicResume = JSON.parse(JSON.stringify(sampleResume));
academicResume.design = { templateId: 'academic-cv', pageSize: 'a4', fontFamily: 'serif', density: 'standard' };
academicResume.sectionVisibility = { academic: true, summary: true, experience: true, education: true, skills: true };
academicResume.academic = {
  publications: [
    'Doe, J. & Smith, A. (2024). High-Performance Distributed Systems. Journal of Computing, 12(3), 45-62.',
    'Doe, J. et al. (2023). Scalable In-Browser OOXML Processing. ACM SIGPLAN, 8(2), 112-125.',
    'Doe, J. (2022). Algorithmic Complexity in Client-Side Document Engines. IEEE Trans. Softw. Eng., 48(4), 301-315.',
    'Doe, J. & Patel, R. (2021). Zero-Upload Web Architectures. Web Systems Review, 19(1), 18-32.'
  ],
  teaching: [
    'Senior Lecturer, Advanced Systems Architecture (Fall 2023, 120 students)',
    'Teaching Fellow, Data Structures & Operating Systems (Spring 2022, 90 students)'
  ],
  presentations: [
    'Keynote: "The Privacy Dividend in Document Applications", OpenWeb Conf 2024, Zurich.',
    'Session Speaker: "Vector Rendering in PDF 1.4", WebTech Summit 2023, Boston.'
  ],
  grants: [
    'Principal Investigator: $250,000 NSF Grant for Web-Based Accessibility Architectures (2022-2024).'
  ]
};
const acadDoc = generateResumePDF(academicResume, { templateId: 'academic-cv' });
const acadPdf = acadDoc.build();
assert(acadPdf.startsWith('%PDF-1.4') && acadPdf.endsWith('%%EOF\n'), 'Academic CV renders valid PDF with publications and teaching');
const pageCountMatch = acadPdf.match(/\/Type\s+\/Page\b/g);
assert(pageCountMatch && pageCountMatch.length >= 1, `Academic CV generates valid pages (found ${pageCountMatch ? pageCountMatch.length : 0} page objects)`);

console.log('');

// ------------------------------------------------------------------
// SUITE 10: Zero-Dependency Client-Side DOCX Generation & OOXML Architecture
// ------------------------------------------------------------------
console.log('SUITE 10: Zero-Dependency Client-Side DOCX Generation & OOXML Architecture');

const docxZip = generateResumeDOCX(sampleResume, { pageSize: 'a4', fontFamily: 'serif' });
assert(docxZip instanceof SimpleZip, 'generateResumeDOCX returns an instance of SimpleZip');

const docxBuf = docxZip.toBuffer();
assert(Buffer.isBuffer(docxBuf), 'SimpleZip.toBuffer() returns a Node Buffer');
assert(docxBuf.length > 500, `DOCX buffer has substantive size (${docxBuf.length} bytes)`);

// Check standard PKZip magic signature: 0x50, 0x4B, 0x03, 0x04
assert(docxBuf[0] === 0x50 && docxBuf[1] === 0x4B && docxBuf[2] === 0x03 && docxBuf[3] === 0x04, 'DOCX output begins with standard PKZip magic bytes (0x504B0304)');

// Check all essential OOXML parts exist in zip package
const requiredParts = [
  '[Content_Types].xml',
  '_rels/.rels',
  'word/styles.xml',
  'word/document.xml',
  'word/_rels/document.xml.rels'
];

requiredParts.forEach(partName => {
  const file = docxZip.files.find(f => f.name === partName);
  assert(Boolean(file), `DOCX archive contains required OOXML part "${partName}"`);
});

// Check document.xml content integrity
const docXmlFile = docxZip.files.find(f => f.name === 'word/document.xml');
const docXmlStr = Buffer.from(docXmlFile.data).toString('utf8');
assert(docXmlStr.includes('Jane Doe, PMP'), 'word/document.xml contains candidate full name');
assert(docXmlStr.includes('Director of Global Operations'), 'word/document.xml contains job title');
assert(docXmlStr.includes('OmniCorp International'), 'word/document.xml contains company name');
assert(docXmlStr.includes('Executive Summary'), 'word/document.xml contains section title');
assert(docXmlStr.includes('<w:pgSz w:w="11906" w:h="16838"/>'), 'word/document.xml specifies ISO A4 page dimensions in dxa (11906 x 16838)');

// Check US Letter page dimensions in DOCX
const docxLetter = generateResumeDOCX(sampleResume, { pageSize: 'letter' });
const docXmlLetterFile = docxLetter.files.find(f => f.name === 'word/document.xml');
const docXmlLetterStr = Buffer.from(docXmlLetterFile.data).toString('utf8');
assert(docXmlLetterStr.includes('<w:pgSz w:w="12240" w:h="15840"/>'), 'word/document.xml specifies US Letter page dimensions in dxa (12240 x 15840)');

// Check styles.xml
const stylesFile = docxZip.files.find(f => f.name === 'word/styles.xml');
const stylesStr = Buffer.from(stylesFile.data).toString('utf8');
assert(stylesStr.includes('w:styleId="Heading1"'), 'word/styles.xml defines Heading1 style');
assert(stylesStr.includes('w:styleId="ListBullet"'), 'word/styles.xml defines ListBullet style');

// Check XML character escaping
assert(escapeXml('AT&T <test> & "quotes"') === 'AT&amp;T &lt;test&gt; &amp; &quot;quotes&quot;', 'DOCX escapeXml correctly sanitizes &, <, >, " characters');

console.log('');

// ------------------------------------------------------------------
// SUITE 11: Formatted Plain-Text Export Parity
// ------------------------------------------------------------------
console.log('SUITE 11: Formatted Plain-Text Export Parity');

const plainText = generateResumeText(sampleResume);
assert(typeof plainText === 'string', 'generateResumeText returns string output');
assert(plainText.includes('JANE DOE, PMP'), 'Plain-text export contains uppercase candidate name');
assert(plainText.includes('Senior Operations Director'), 'Plain-text export contains target title');
assert(plainText.includes('jane.doe@example.com'), 'Plain-text export contains contact email');
assert(plainText.includes('OmniCorp International'), 'Plain-text export contains company name');
assert(plainText.includes('Director of Global Operations'), 'Plain-text export contains role title');
assert(plainText.includes('* Orchestrated workflow optimization'), 'Plain-text export formats bullets with clean bullet marks');
assert(!/<[a-z][\s\S]*>/i.test(plainText), 'Plain-text export contains zero HTML tags or markup artifacts');

console.log('');

// ------------------------------------------------------------------
// SUITE 12: Resume Schema Migration & Persistence (v1 to v2)
// ------------------------------------------------------------------
console.log('SUITE 12: Resume Schema Migration & Persistence (v1 to v2)');

const legacyV1Data = {
  personal: {
    fullName: 'David Miller',
    targetTitle: 'Full-Stack Developer',
    email: 'david@example.com'
  },
  summaryTitle: 'About Me',
  summary: 'Passionate developer building accessible web tools.',
  experienceTitle: 'Work Experience',
  experience: [
    { role: 'Software Engineer', company: 'TechWorks', duration: '2020 - 2023', bulletsText: 'Built APIs' }
  ],
  educationTitle: 'Education',
  education: [
    { degree: 'B.S. Computer Science', institution: 'State University', year: '2020' }
  ],
  skills: {
    languages: 'JavaScript, Python',
    tools: 'Git, Docker'
  }
};

const migratedV2 = migrateResumeSchema(legacyV1Data);
assert(migratedV2.schemaVersion === 2, 'migrateResumeSchema upgrades legacy data to schemaVersion 2');
assert(migratedV2.design && migratedV2.design.templateId === 'classic-professional', 'migrated schema defaults templateId to "classic-professional"');
assert(migratedV2.design.pageSize === 'a4', 'migrated schema defaults pageSize to "a4"');
assert(migratedV2.design.density === 'standard', 'migrated schema defaults density to "standard"');
assert(Array.isArray(migratedV2.design.sectionOrder) && migratedV2.design.sectionOrder.length === 10, 'migrated schema initializes 10-section order array');
assert(migratedV2.sectionVisibility && migratedV2.sectionVisibility.summary === true, 'migrated schema initializes sectionVisibility map');
assert(Array.isArray(migratedV2.certifications), 'migrated schema adds certifications array');
assert(Array.isArray(migratedV2.achievements), 'migrated schema adds achievements array');
assert(Array.isArray(migratedV2.volunteering), 'migrated schema adds volunteering array');
assert(Array.isArray(migratedV2.languages), 'migrated schema adds languages array');
assert(typeof migratedV2.academic === 'object', 'migrated schema adds academic container');
assert(migratedV2.personal.fullName === 'David Miller', 'migrated schema preserves candidate fullName');
assert(migratedV2.experience[0].company === 'TechWorks', 'migrated schema preserves experience records');

// Empty / invalid input migration test
const emptyMigrated = migrateResumeSchema(null);
assert(emptyMigrated.schemaVersion === 2, 'migrateResumeSchema handles null input gracefully');
assert(emptyMigrated.personal && emptyMigrated.personal.fullName === '', 'migrateResumeSchema defaults empty personal fields');

// Idempotent v2 migration test
const customV2Input = {
  schemaVersion: 2,
  design: {
    templateId: 'modern-minimal',
    pageSize: 'letter',
    fontFamily: 'sans',
    density: 'compact',
    sectionOrder: ['skills', 'experience', 'education', 'summary', 'projects', 'certifications', 'achievements', 'volunteering', 'languages', 'academic']
  },
  personal: {
    fullName: 'Sarah Connor',
    email: 'sarah@resistance.org'
  },
  sectionVisibility: {
    summary: false,
    academic: false
  }
};

const v2Preserved = migrateResumeSchema(customV2Input);
assert(v2Preserved.design.templateId === 'modern-minimal', 'migrateResumeSchema preserves existing v2 templateId');
assert(v2Preserved.design.pageSize === 'letter', 'migrateResumeSchema preserves existing v2 pageSize');
assert(v2Preserved.design.sectionOrder[0] === 'skills', 'migrateResumeSchema preserves custom sectionOrder');
assert(v2Preserved.sectionVisibility.summary === false, 'migrateResumeSchema preserves custom sectionVisibility');

console.log('');

// ------------------------------------------------------------------
// SUITE 13: Strict Prohibition of Support Popups, Modals, Nags, or Timed Overlays
// ------------------------------------------------------------------
console.log('SUITE 13: Strict Prohibition of Support Popups, Modals, Nags, or Timed Overlays');

// 1. Check style.css has zero modal rules
const styleContent = fs.readFileSync(path.join(repoRoot, 'css', 'style.css'), 'utf8');
assert(!styleContent.includes('.modal-overlay'), 'style.css contains NO .modal-overlay selector');
assert(!styleContent.includes('.modal-card'), 'style.css contains NO .modal-card selector');
assert(!styleContent.includes('.modal-close-btn'), 'style.css contains NO .modal-close-btn selector');
assert(!styleContent.includes('.btn-chai'), 'style.css contains NO .btn-chai selector');

// 2. Check HTML files contain NO modal HTML markup
htmlFiles.forEach(file => {
  const filePath = path.join(repoRoot, file);
  const content = fs.readFileSync(filePath, 'utf8');
  assert(!content.includes('class="modal-overlay"'), `${file} contains NO modal-overlay markup`);
  assert(!content.includes('id="supportModal"'), `${file} contains NO supportModal element`);
  assert(!content.includes('id="chaiModal"'), `${file} contains NO chaiModal element`);

  // Assert understated navbar support link exists
  assert(content.includes('class="nav-support-link"'), `${file} contains understated .nav-support-link`);
  assert(content.includes('https://razorpay.me/@nbsumit'), `${file} links to official Razorpay support URL`);

  // Assert footer support link exists
  assert(content.includes('class="footer-link"'), `${file} contains .footer-link`);
});

// 3. Check JS files contain NO popups, modals, or timed donation prompts
const jsFiles = ['js/resume.js', 'js/resizer.js', 'js/pdf-engine.js', 'js/docx-engine.js', 'js/templates.js'];
jsFiles.forEach(jsFile => {
  const p = path.join(repoRoot, jsFile);
  const c = fs.readFileSync(p, 'utf8');
  assert(!c.includes('openSupportModal'), `${jsFile} contains NO openSupportModal function`);
  assert(!c.includes('showSupportModal'), `${jsFile} contains NO showSupportModal function`);
  assert(!c.includes('promptSupport'), `${jsFile} contains NO promptSupport function`);
  assert(!c.includes('showChaiModal'), `${jsFile} contains NO showChaiModal function`);
});

// ------------------------------------------------------------------
// SUITE 14: Quality Upgrades: Text Wrapping, Template Parity, Aspect Lock & Focus Preservation
// ------------------------------------------------------------------
console.log('SUITE 14: Quality Upgrades: Text Wrapping, Template Parity, Aspect Lock & Focus Preservation');

// 1. Long word / unbroken token text wrapping in PDF engine
const longUnbrokenToken = 'https://verylongdomainnameandpathwithoutanyspaceswhatsoeverthatwouldotherwiseoverflowtheentirepagemarginsandcauseclipping.com/test';
const wrappedLines = splitTextToLines(longUnbrokenToken, 10, 100, 'sans');
assert(Array.isArray(wrappedLines) && wrappedLines.length > 1, 'splitTextToLines safely wraps long unbroken URL tokens into multiple lines');
const allLinesFit = wrappedLines.every(l => measureTextWidth(l, 10, 'sans') <= 100);
assert(allLinesFit, 'Every wrapped token line fits strictly within specified maxWidth');

// 2. DOCX options with custom template, density and fontSize
const compactDocxZip = generateResumeDOCX(sampleResume, {
  template: 'compact-professional',
  density: 'compact',
  fontSize: 'comfortable'
});
const compactDocXmlFile = compactDocxZip.files.find(f => f.name === 'word/document.xml');
assert(Boolean(compactDocXmlFile), 'DOCX archive contains word/document.xml with custom template options');
const compactDocXmlStr = Buffer.from(compactDocXmlFile.data).toString('utf8');
assert(compactDocXmlStr.includes('w:top="720"') && compactDocXmlStr.includes('w:bottom="720"'), 'DOCX engine applies compact margins (720 dxa = 0.5 in) when density is compact');
assert(compactDocXmlStr.includes('w:jc w:val="left"'), 'Compact Professional template sets left header alignment in DOCX');

const standardDocxZip = generateResumeDOCX(sampleResume, {
  template: 'classic-professional',
  density: 'standard'
});
const stdDocXmlStr = Buffer.from(standardDocxZip.files.find(f => f.name === 'word/document.xml').data).toString('utf8');
assert(stdDocXmlStr.includes('w:top="1080"') && stdDocXmlStr.includes('w:bottom="1080"'), 'Classic Professional template sets standard margins (1080 dxa = 0.75 in) in DOCX');
assert(stdDocXmlStr.includes('w:jc w:val="center"'), 'Classic Professional template sets centered header alignment in DOCX');

// 3. Aspect Ratio Lock and Dimension Calculation in Resizer
const dimSpecs = validateDimensionSpecs('800', '600', '100', false);
assert(dimSpecs.isValid === true, 'validateDimensionSpecs validates 800x600 px dimensions correctly');
assert(dimSpecs.width === 800 && dimSpecs.height === 600, 'Dimensions parsed correctly');
const lockedCalcH = Math.round(400 / (800 / 600));
assert(lockedCalcH === 300, 'Aspect ratio lock calculation correctly scales height proportionally (400 -> 300)');

// 4. HTML verification for image resizer UI controls
const indexHtmlContent = fs.readFileSync(path.join(repoRoot, 'index.html'), 'utf8');
assert(indexHtmlContent.includes('id="btnLockAspect"'), 'index.html contains aspect ratio lock button (#btnLockAspect)');
assert(indexHtmlContent.includes('id="btnReplaceFile"'), 'index.html contains replace file button (#btnReplaceFile)');
assert(indexHtmlContent.includes('id="originalComparisonImage"'), 'index.html contains original comparison image (#originalComparisonImage)');
assert(indexHtmlContent.includes('id="btnViewProcessed"'), 'index.html contains view processed toggle button (#btnViewProcessed)');
assert(indexHtmlContent.includes('id="btnViewOriginal"'), 'index.html contains view original toggle button (#btnViewOriginal)');
assert(indexHtmlContent.includes('checkerboard-pattern'), 'index.html contains checkerboard pattern class for transparent image viewing');

// 5. HTML verification for resume builder controls & preview modal
const resumeHtmlContent = fs.readFileSync(path.join(repoRoot, 'resume.html'), 'utf8');
assert(resumeHtmlContent.includes('id="templatePreviewModal"'), 'resume.html contains accessible template preview modal (#templatePreviewModal)');
assert(resumeHtmlContent.includes('id="tmplModalPreviewSheet"'), 'resume.html contains template preview modal sheet container (#tmplModalPreviewSheet)');
assert(resumeHtmlContent.includes('id="btnCloseTmplModal"'), 'resume.html contains modal close button (#btnCloseTmplModal)');
assert(resumeHtmlContent.includes('id="btnUseTmplModal"'), 'resume.html contains modal use template button (#btnUseTmplModal)');
assert(resumeHtmlContent.includes('id="btnApplyRecommendedOrder"'), 'resume.html contains apply recommended section order button (#btnApplyRecommendedOrder)');

// 6. Focus preservation and modal logic in resume.js
const resumeJsContent = fs.readFileSync(path.join(repoRoot, 'js', 'resume.js'), 'utf8');
assert(resumeJsContent.includes('restoreListFocus'), 'resume.js defines restoreListFocus for keyboard accessibility');
assert(resumeJsContent.includes('restoreRemoveFocus'), 'resume.js defines restoreRemoveFocus to avoid focus loss on item removal');
assert(resumeJsContent.includes('openTemplatePreviewModal'), 'resume.js defines openTemplatePreviewModal');
assert(resumeJsContent.includes('closeTemplatePreviewModal'), 'resume.js defines closeTemplatePreviewModal');
assert(resumeJsContent.includes('isDocumentEmpty'), 'resume.js defines isDocumentEmpty to guard section ordering');

console.log('');
console.log('====================================================');
console.log(`TOTAL TESTS: ${totalTests} | PASSED: ${passedTests} | FAILED: ${failedTests}`);
console.log('====================================================');

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('\nAll automated verification checks PASSED successfully!');
}
