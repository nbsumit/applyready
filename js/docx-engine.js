/**
 * ApplyReady.in - Pure Client-Side OOXML DOCX Generator
 * Generates true, editable Microsoft Word (.docx) files client-side
 * with zero external dependencies. Compatible with browsers and Node.js.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ApplyReadyDOCX = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // CRC-32 table generator and calculation
  let crcTable = null;
  function makeCrcTable() {
    let c;
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) {
        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      }
      table[n] = c;
    }
    return table;
  }

  function crc32(uint8Array) {
    if (!crcTable) crcTable = makeCrcTable();
    let c = 0 ^ (-1);
    for (let i = 0; i < uint8Array.length; i++) {
      c = (c >>> 8) ^ crcTable[(c ^ uint8Array[i]) & 0xFF];
    }
    return (c ^ (-1)) >>> 0;
  }

  /**
   * Minimal, robust pure JS ZIP builder (Store / uncompressed method 0)
   * 100% compliant with PKZIP APPNOTE and ISO/IEC 29500-2 (Open Packaging Conventions).
   */
  class SimpleZip {
    constructor() {
      this.files = [];
    }

    addFile(filename, content) {
      let data;
      if (typeof content === 'string') {
        if (typeof TextEncoder !== 'undefined') {
          data = new TextEncoder().encode(content);
        } else {
          data = Buffer.from(content, 'utf8');
        }
      } else if (content instanceof Uint8Array) {
        data = content;
      } else if (typeof Buffer !== 'undefined' && Buffer.isBuffer(content)) {
        data = new Uint8Array(content);
      } else {
        throw new Error('Unsupported content type for zip file');
      }

      const filenameBytes = typeof TextEncoder !== 'undefined'
        ? new TextEncoder().encode(filename)
        : Buffer.from(filename, 'utf8');

      this.files.push({
        name: filename,
        filenameBytes,
        data,
        crc: crc32(data),
        size: data.length
      });
    }

    build() {
      // Calculate total size
      let localHeadersSize = 0;
      let centralDirSize = 0;

      for (const file of this.files) {
        // Local header: 30 bytes + filename + data
        localHeadersSize += 30 + file.filenameBytes.length + file.size;
        // Central dir: 46 bytes + filename
        centralDirSize += 46 + file.filenameBytes.length;
      }

      const eocdSize = 22;
      const totalSize = localHeadersSize + centralDirSize + eocdSize;
      const out = new Uint8Array(totalSize);
      const view = new DataView(out.buffer);

      let offset = 0;
      const fileOffsets = [];

      // Write Local File Headers & Data
      for (const file of this.files) {
        fileOffsets.push(offset);

        // Signature: 0x04034b50
        view.setUint32(offset, 0x04034b50, true);
        view.setUint16(offset + 4, 20, true); // Version needed (2.0)
        view.setUint16(offset + 6, 0x0800, true); // General purpose flag: UTF-8 filename (bit 11)
        view.setUint16(offset + 8, 0, true); // Compression: 0 (Store)
        view.setUint16(offset + 10, 0x4821, true); // Time (10:01:02)
        view.setUint16(offset + 12, 0x5462, true); // Date (2022-03-02)
        view.setUint32(offset + 14, file.crc, true);
        view.setUint32(offset + 18, file.size, true); // Compressed size
        view.setUint32(offset + 22, file.size, true); // Uncompressed size
        view.setUint16(offset + 26, file.filenameBytes.length, true);
        view.setUint16(offset + 28, 0, true); // Extra length

        offset += 30;
        out.set(file.filenameBytes, offset);
        offset += file.filenameBytes.length;

        out.set(file.data, offset);
        offset += file.size;
      }

      // Write Central Directory Headers
      const centralDirOffset = offset;
      for (let i = 0; i < this.files.length; i++) {
        const file = this.files[i];
        const localOffset = fileOffsets[i];

        // Signature: 0x02014b50
        view.setUint32(offset, 0x02014b50, true);
        view.setUint16(offset + 4, 20, true); // Version made by
        view.setUint16(offset + 6, 20, true); // Version needed
        view.setUint16(offset + 8, 0x0800, true); // General purpose: UTF-8
        view.setUint16(offset + 10, 0, true); // Compression: 0
        view.setUint16(offset + 12, 0x4821, true); // Time
        view.setUint16(offset + 14, 0x5462, true); // Date
        view.setUint32(offset + 16, file.crc, true);
        view.setUint32(offset + 20, file.size, true);
        view.setUint32(offset + 24, file.size, true);
        view.setUint16(offset + 28, file.filenameBytes.length, true);
        view.setUint16(offset + 30, 0, true); // Extra field len
        view.setUint16(offset + 32, 0, true); // Comment len
        view.setUint16(offset + 34, 0, true); // Disk number
        view.setUint16(offset + 36, 0, true); // Internal attr
        view.setUint32(offset + 38, 0, true); // External attr
        view.setUint32(offset + 42, localOffset, true); // Offset of local header

        offset += 46;
        out.set(file.filenameBytes, offset);
        offset += file.filenameBytes.length;
      }

      // Write End of Central Directory Record (EOCD)
      // Signature: 0x06054b50
      view.setUint32(offset, 0x06054b50, true);
      view.setUint16(offset + 4, 0, true); // Disk number
      view.setUint16(offset + 6, 0, true); // Disk with central dir
      view.setUint16(offset + 8, this.files.length, true); // Entries on disk
      view.setUint16(offset + 10, this.files.length, true); // Total entries
      view.setUint32(offset + 12, centralDirSize, true); // Central dir size
      view.setUint32(offset + 16, centralDirOffset, true); // Offset of central dir
      view.setUint16(offset + 20, 0, true); // Comment len

      return out;
    }

    toBlob(mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const bytes = this.build();
      return new Blob([bytes], { type: mimeType });
    }

    toBuffer() {
      const bytes = this.build();
      return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    }
  }

  // XML 1.0 forbids most C0 control characters (form feeds and vertical tabs
  // are common when text is pasted from PDFs); Word refuses such a file.
  function escapeXml(unsafe) {
    if (!unsafe) return '';
    return String(unsafe)
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '')
      .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  function templatesApi() {
    if (typeof ApplyReadyTemplates !== 'undefined') return ApplyReadyTemplates;
    if (typeof require === 'function') { try { return require('./templates.js'); } catch (e) { /* standalone use */ } }
    return null;
  }
  function pdfApi() {
    if (typeof ApplyReadyPDF !== 'undefined') return ApplyReadyPDF;
    if (typeof require === 'function') { try { return require('./pdf-engine.js'); } catch (e) { /* standalone use */ } }
    return null;
  }

  const clean = value => (typeof value === 'string' ? value.trim() : '');
  const SECTIONS = ['summary', 'experience', 'education', 'projects', 'skills', 'certifications', 'achievements', 'volunteering', 'languages', 'academic'];
  const FALLBACK_LABELS = { summary: 'Professional Summary', experience: 'Work Experience', education: 'Education', projects: 'Key Projects', skills: 'Skills & Competencies', certifications: 'Certifications & Credentials', achievements: 'Honors & Achievements', volunteering: 'Community & Leadership', languages: 'Languages', publications: 'Peer-Reviewed Publications', teaching: 'Teaching Experience', presentations: 'Conference Presentations', grants: 'Research Grants' };

  /**
   * Generate complete editable DOCX file from resume model
   */
  function generateResumeDOCX(resumeData, options = {}) {
    const zip = new SimpleZip();
    const api = templatesApi();
    const pdf = pdfApi();
    const pageSize = (options.pageSize || (resumeData.design && resumeData.design.pageSize) || 'a4').toLowerCase();
    const isLetter = pageSize === 'letter';

    const templateId = api ? api.resolveTemplateId(resumeData, options) : (options.template || resumeData.template || 'classic-professional');
    const tmpl = api ? api.getTemplate(templateId) : {};
    const style = api ? api.getTemplateStyle(templateId) : { headerAlign: 'left', nameCase: 'upper', headingHex: '0F172A', linkHex: '2563EB', metaHex: '64748B', datePlacement: 'right', headingRule: 'line', headerRule: 'single', headerRuleHex: '1A1A1A', contactSeparator: '•', docxRule: { val: 'single', sz: 6, color: 'CBD5E1' } };
    const label = key => api ? api.getSectionLabel(templateId, key) : FALLBACK_LABELS[key];
    const title = key => api ? api.getSectionTitle(resumeData, templateId, key) : (clean(resumeData[key + 'Title']) || FALLBACK_LABELS[key]);
    const skillLabels = api ? api.getSkillLabels(templateId) : { languages: 'Core Competencies', frameworks: 'Tools & Platforms', tools: 'Technical & Data Skills', other: 'Professional Skills' };
    const bulletLines = pdf ? pdf.bulletLines : text => String(text || '').split(/\r?\n|\r/).map(l => l.trim().replace(/^[-*•]\s*/, '')).filter(Boolean);
    const optionalEntries = pdf ? pdf.optionalEntries : () => [];

    const density = options.density || (resumeData.design && resumeData.design.density) || tmpl.density || 'standard';
    const isCompact = density === 'compact';

    // A4: 11906 x 16838 dxa (210mm x 297mm)
    // Letter: 12240 x 15840 dxa (8.5in x 11in)
    const pageW = isLetter ? 12240 : 11906;
    const pageH = isLetter ? 15840 : 16838;
    const marginDxa = isCompact ? 720 : 1080; // 0.5 in for compact, 0.75 in for standard
    const textWidth = pageW - 2 * marginDxa;

    let fontFamily = options.fontFamily || (resumeData.design && resumeData.design.fontFamily) || tmpl.fontFamily;
    if (!fontFamily) fontFamily = style.headerAlign === 'center' ? 'serif' : 'sans';
    const fontName = fontFamily === 'serif' ? 'Times New Roman' : 'Arial';
    const headerAlign = style.headerAlign === 'center' ? 'center' : 'left';
    const datesInline = style.datePlacement !== 'below';

    const rule = style.headingRule === 'none' ? null : style.docxRule;
    const headingBorderXml = rule ? `<w:bottom w:val="${rule.val}" w:sz="${rule.sz}" w:space="2" w:color="${rule.color}"/>` : '<w:bottom w:val="none" w:sz="0" w:space="0" w:color="auto"/>';

    // Font size in half-points
    const fontSizeOpt = options.fontSize || (resumeData.design && resumeData.design.fontSize) || 'standard';
    let baseSzVal = 22;
    if (fontSizeOpt === 'comfortable') baseSzVal = 24;
    else if (fontSizeOpt === 'compact') baseSzVal = 20;
    const metaSz = Math.max(18, baseSzVal - 2);

    // Track Hyperlinks for document.xml.rels
    const relationships = [];
    let relIdCounter = 3; // rId1 styles, rId2 numbering, rId3 settings
    function registerHyperlink(targetUrl) {
      if (!targetUrl) return null;
      let safeUrl = targetUrl.trim();
      if (/[\u0000-\u001f\s]/.test(safeUrl) || (/^[a-z][a-z0-9+.-]*:/i.test(safeUrl) && !/^(https?:|mailto:|tel:)/i.test(safeUrl))) return null;
      if (!/^https?:\/\//i.test(safeUrl) && !/^(mailto:|tel:)/i.test(safeUrl)) {
        safeUrl = 'https://' + safeUrl;
      }
      const rId = 'rId' + (++relIdCounter);
      relationships.push({
        id: rId,
        type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink',
        target: escapeXml(safeUrl),
        targetMode: 'External'
      });
      return rId;
    }

    const p = resumeData.personal || {};
    const fullName = clean(p.fullName) || 'Resume';
    const now = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

    // 1. [Content_Types].xml
    zip.addFile('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
  <Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`);

    // 2. _rels/.rels
    zip.addFile('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`);

    // 3. Document properties (title and author are shown by Word and many ATS)
    zip.addFile('docProps/core.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>${escapeXml(clean(p.fullName) ? fullName + ' - Resume' : 'Resume')}</dc:title>
  <dc:subject>${escapeXml(clean(p.targetTitle))}</dc:subject>
  <dc:creator>${escapeXml(clean(p.fullName))}</dc:creator>
  <cp:lastModifiedBy>${escapeXml(clean(p.fullName))}</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified>
</cp:coreProperties>`);
    zip.addFile('docProps/app.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>ApplyReady.in Resume Builder</Application>
</Properties>`);

    // 4. word/styles.xml
    const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="${fontName}" w:hAnsi="${fontName}" w:eastAsia="${fontName}" w:cs="${fontName}"/>
        <w:sz w:val="${baseSzVal}"/>
        <w:szCs w:val="${baseSzVal}"/>
        <w:color w:val="1F2937"/>
        <w:lang w:val="en-US"/>
      </w:rPr>
    </w:rPrDefault>
    <w:pPrDefault>
      <w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr>
    </w:pPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:qFormat/>
    <w:pPr>
      <w:spacing w:after="${isCompact ? '40' : '80'}" w:line="${isCompact ? '220' : '240'}" w:lineRule="auto"/>
    </w:pPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Title">
    <w:name w:val="Title"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:qFormat/>
    <w:pPr><w:jc w:val="${headerAlign}"/><w:spacing w:before="0" w:after="40"/></w:pPr>
    <w:rPr><w:b/>${style.nameCase === 'upper' ? '<w:caps/>' : ''}<w:sz w:val="${style.nameSize ? style.nameSize * 2 : 32}"/><w:color w:val="0F172A"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:qFormat/>
    <w:pPr>
      <w:keepNext/>
      <w:spacing w:before="${isCompact ? '160' : '240'}" w:after="${isCompact ? '40' : '80'}"/>
      <w:pBdr>
        ${headingBorderXml}
      </w:pBdr>
      <w:outlineLvl w:val="0"/>
    </w:pPr>
    <w:rPr>
      <w:b/>
      ${style.headingCase === 'asis' ? '' : '<w:caps/>'}
      <w:sz w:val="${baseSzVal + 1}"/>
      <w:color w:val="${style.headingHex}"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="ListBullet">
    <w:name w:val="List Bullet"/>
    <w:basedOn w:val="Normal"/>
    <w:pPr>
      <w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>
      <w:spacing w:after="${isCompact ? '20' : '40'}" w:line="${isCompact ? '210' : '230'}" w:lineRule="auto"/>
      <w:ind w:left="360" w:hanging="240"/>
    </w:pPr>
  </w:style>
  <w:style w:type="character" w:styleId="Hyperlink">
    <w:name w:val="Hyperlink"/>
    <w:rPr><w:color w:val="${style.linkHex === '000000' ? '000000' : '1D4ED8'}"/></w:rPr>
  </w:style>
</w:styles>`;
    zip.addFile('word/styles.xml', stylesXml);

    // 5. Real Word bullet list so bullets stay editable and parse as list items.
    zip.addFile('word/numbering.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:abstractNum w:abstractNumId="0">
    <w:multiLevelType w:val="singleLevel"/>
    <w:lvl w:ilvl="0">
      <w:start w:val="1"/>
      <w:numFmt w:val="bullet"/>
      <w:lvlText w:val="•"/>
      <w:lvlJc w:val="left"/>
      <w:pPr><w:ind w:left="360" w:hanging="240"/></w:pPr>
      <w:rPr><w:rFonts w:ascii="${fontName}" w:hAnsi="${fontName}"/></w:rPr>
    </w:lvl>
  </w:abstractNum>
  <w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
</w:numbering>`);
    zip.addFile('word/settings.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:defaultTabStop w:val="720"/>
  <w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat>
</w:settings>`);

    // 6. Construct word/document.xml content
    const bodyXml = [];
    const run = (text, props = '') => text ? `<w:r>${props ? `<w:rPr>${props}</w:rPr>` : ''}<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>` : '';
    const linkRun = (text, rId, props = '') => rId
      ? `<w:hyperlink r:id="${rId}" w:history="1"><w:r><w:rPr><w:rStyle w:val="Hyperlink"/>${props}</w:rPr><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:hyperlink>`
      : run(text, props);
    const bodyProps = `<w:sz w:val="${baseSzVal}"/><w:color w:val="334155"/>`;
    const metaProps = `<w:i/><w:sz w:val="${metaSz}"/><w:color w:val="${style.metaHex}"/>`;
    const strongProps = `<w:b/><w:sz w:val="${baseSzVal}"/><w:color w:val="0F172A"/>`;

    // Header: Full Name
    bodyXml.push(`<w:p><w:pPr><w:pStyle w:val="Title"/></w:pPr>${run(fullName)}</w:p>`);

    // Target Title / Headline
    if (clean(p.targetTitle)) {
      bodyXml.push(`<w:p><w:pPr><w:jc w:val="${headerAlign}"/><w:spacing w:before="0" w:after="80"/></w:pPr>${run(clean(p.targetTitle), `<w:i/><w:sz w:val="${baseSzVal}"/><w:color w:val="475569"/>`)}</w:p>`);
    }

    // Contact Information Line
    const contactParts = [];
    if (clean(p.phone)) contactParts.push({ text: clean(p.phone) });
    if (clean(p.email)) contactParts.push({ text: clean(p.email), rId: registerHyperlink('mailto:' + clean(p.email)) });
    if (clean(p.location)) contactParts.push({ text: clean(p.location) });
    for (const key of ['linkedin', 'github', 'website']) {
      const link = clean(p[key]);
      if (link) contactParts.push({ text: link.replace(/^https?:\/\//i, '').replace(/\/$/, ''), rId: registerHyperlink(link) });
    }

    if (contactParts.length > 0) {
      const contactProps = `<w:sz w:val="${metaSz}"/>`;
      const contactRuns = contactParts.map((item, i) => (i ? run(`  ${style.contactSeparator}  `, `<w:sz w:val="${metaSz}"/><w:color w:val="94A3B8"/>`) : '')
        + (item.rId ? linkRun(item.text, item.rId, contactProps) : run(item.text, `${contactProps}<w:color w:val="334155"/>`))).join('');
      const headerBorder = style.headerRule === 'none' ? ''
        : `<w:pBdr><w:bottom w:val="${style.headerRule === 'double' ? 'double' : 'single'}" w:sz="${style.headerRule === 'double' ? 6 : Math.round((style.headerRuleWidth || 1.2) * 8)}" w:space="6" w:color="${style.headerRuleHex}"/></w:pBdr>`;
      bodyXml.push(`<w:p><w:pPr>${headerBorder}<w:jc w:val="${headerAlign}"/><w:spacing w:before="0" w:after="${style.headerRule === 'none' ? 120 : 160}"/></w:pPr>${contactRuns}</w:p>`);
    }

    // Helper: Add Section Header
    function addSectionHeader(text) {
      bodyXml.push(`<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr>${run(text)}</w:p>`);
    }
    function addBullet(text, props = bodyProps) {
      bodyXml.push(`<w:p><w:pPr><w:pStyle w:val="ListBullet"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr>${run(text, props)}</w:p>`);
    }
    // Entry heading with dates on a right tab stop, or on their own line.
    function addEntryHeading(titleRuns, meta, before) {
      if (datesInline && meta) {
        bodyXml.push(`<w:p><w:pPr><w:keepNext/><w:tabs><w:tab w:val="right" w:pos="${textWidth}"/></w:tabs><w:spacing w:before="${before}" w:after="30"/></w:pPr>${titleRuns}<w:r><w:tab/></w:r>${run(meta, metaProps)}</w:p>`);
        return;
      }
      bodyXml.push(`<w:p><w:pPr><w:keepNext/><w:spacing w:before="${before}" w:after="${meta ? 0 : 30}"/></w:pPr>${titleRuns}</w:p>`);
      if (meta) bodyXml.push(`<w:p><w:pPr><w:keepNext/><w:spacing w:before="0" w:after="30"/></w:pPr>${run(meta, metaProps)}</w:p>`);
    }

    // Section Visibility & Order
    const vis = resumeData.sectionVisibility || options.sectionVisibility || {};
    const savedOrder = (resumeData.design && Array.isArray(resumeData.design.sectionOrder)) ? resumeData.design.sectionOrder : (options.sectionOrder || []);
    const sectionOrder = [...new Set([...savedOrder.filter(key => SECTIONS.includes(key)), ...SECTIONS])];

    for (const secKey of sectionOrder) {
      if (vis[secKey] === false) continue;

      if (secKey === 'summary' && clean(resumeData.summary)) {
        addSectionHeader(title('summary'));
        clean(resumeData.summary).split(/\r?\n+/).map(clean).filter(Boolean).forEach(paragraph => {
          bodyXml.push(`<w:p><w:pPr><w:spacing w:after="120"/></w:pPr>${run(paragraph, bodyProps)}</w:p>`);
        });
      }

      if (secKey === 'experience') {
        const entries = (resumeData.experience || []).filter(exp => exp && (clean(exp.role) || clean(exp.company) || bulletLines(exp.bulletsText).length));
        if (entries.length) {
          addSectionHeader(title('experience'));
          for (const exp of entries) {
            const role = clean(exp.role), comp = clean(exp.company);
            const meta = [clean(exp.duration), clean(exp.location)].filter(Boolean).join(', ');
            if (role || comp || meta) addEntryHeading(run(role, strongProps) + (comp ? run((role ? '  |  ' : '') + comp, `<w:sz w:val="${baseSzVal}"/><w:color w:val="475569"/>`) : ''), meta, 120);
            bulletLines(exp.bulletsText).forEach(line => addBullet(line));
          }
        }
      }

      if (secKey === 'education') {
        const entries = (resumeData.education || []).filter(edu => edu && (clean(edu.degree) || clean(edu.institution)));
        if (entries.length) {
          addSectionHeader(title('education'));
          for (const edu of entries) {
            const deg = clean(edu.degree), inst = clean(edu.institution);
            const meta = [clean(edu.duration), clean(edu.location)].filter(Boolean).join(', ');
            addEntryHeading(run(deg, strongProps) + (inst ? run((deg ? '  |  ' : '') + inst, `<w:sz w:val="${baseSzVal}"/><w:color w:val="475569"/>`) : ''), meta, 100);
            if (clean(edu.score)) bodyXml.push(`<w:p><w:pPr><w:spacing w:after="40"/></w:pPr>${run(clean(edu.score), `<w:sz w:val="${metaSz}"/><w:color w:val="475569"/>`)}</w:p>`);
          }
        }
      }

      if (secKey === 'projects') {
        const entries = (resumeData.projects || []).filter(proj => proj && (clean(proj.name) || clean(proj.tech) || bulletLines(proj.bulletsText).length));
        if (entries.length) {
          addSectionHeader(title('projects'));
          for (const proj of entries) {
            const name = clean(proj.name) || 'Project';
            const tech = clean(proj.tech);
            const link = clean(proj.link);
            const linkRId = link ? registerHyperlink(link) : null;
            const titleRuns = run(name, strongProps) + (tech ? run('  |  ' + tech, metaProps) : '');
            if (datesInline && link) {
              bodyXml.push(`<w:p><w:pPr><w:keepNext/><w:tabs><w:tab w:val="right" w:pos="${textWidth}"/></w:tabs><w:spacing w:before="120" w:after="30"/></w:pPr>${titleRuns}<w:r><w:tab/></w:r>${linkRun(link, linkRId, `<w:sz w:val="${metaSz}"/>`)}</w:p>`);
            } else {
              bodyXml.push(`<w:p><w:pPr><w:keepNext/><w:spacing w:before="120" w:after="${link ? 0 : 30}"/></w:pPr>${titleRuns}</w:p>`);
              if (link) bodyXml.push(`<w:p><w:pPr><w:keepNext/><w:spacing w:before="0" w:after="30"/></w:pPr>${linkRun(link, linkRId, `<w:sz w:val="${metaSz}"/>`)}</w:p>`);
            }
            bulletLines(proj.bulletsText).forEach(line => addBullet(line));
          }
        }
      }

      if (secKey === 'skills' && resumeData.skills) {
        const s = resumeData.skills;
        const entries = Array.isArray(s.categories)
          ? s.categories.filter(c => c && clean(c.name) && clean(c.items)).map(c => ({ label: clean(c.name), text: clean(c.items) }))
          : ['languages', 'frameworks', 'tools', 'other'].filter(key => clean(s[key])).map(key => ({ label: skillLabels[key], text: clean(s[key]) }));
        if (entries.length > 0) {
          addSectionHeader(title('skills'));
          for (const item of entries) {
            bodyXml.push(`<w:p><w:pPr><w:spacing w:after="40"/></w:pPr>${run(item.label + ': ', strongProps)}${run(item.text, bodyProps)}</w:p>`);
          }
        }
      }

      if (['certifications', 'achievements', 'volunteering'].includes(secKey)) {
        const texts = optionalEntries(resumeData, secKey);
        if (texts.length) {
          addSectionHeader(label(secKey));
          texts.forEach(text => addBullet(text));
        }
      }

      if (secKey === 'languages') {
        const langs = optionalEntries(resumeData, 'languages');
        if (langs.length) {
          addSectionHeader(label('languages'));
          bodyXml.push(`<w:p><w:pPr><w:spacing w:after="80"/></w:pPr>${run(langs.join(', '), bodyProps)}</w:p>`);
        }
      }

      if (secKey === 'academic') {
        for (const key of ['publications', 'teaching', 'presentations', 'grants']) {
          const texts = optionalEntries(resumeData, key);
          if (!texts.length) continue;
          addSectionHeader(label(key));
          texts.forEach(text => addBullet(text));
        }
      }
    }

    // Page layout / section properties (margins & paper size)
    const sectPrXml = `
      <w:sectPr>
        <w:pgSz w:w="${pageW}" w:h="${pageH}"/>
        <w:pgMar w:top="${marginDxa}" w:right="${marginDxa}" w:bottom="${marginDxa}" w:left="${marginDxa}" w:header="720" w:footer="720" w:gutter="0"/>
      </w:sectPr>`;

    const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    ${bodyXml.join('\n    ')}
    ${sectPrXml}
  </w:body>
</w:document>`;
    zip.addFile('word/document.xml', documentXml);

    // 7. word/_rels/document.xml.rels (styles, numbering, settings and external hyperlinks)
    const relItemsXml = [
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>',
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>',
      '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>',
      ...relationships.map(rel => `<Relationship Id="${rel.id}" Type="${rel.type}" Target="${rel.target}" TargetMode="${rel.targetMode}"/>`)
    ].join('\n  ');

    zip.addFile('word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${relItemsXml}
</Relationships>`);

    return zip;
  }

  return {
    SimpleZip,
    generateResumeDOCX,
    escapeXml
  };
});
