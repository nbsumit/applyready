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

  function escapeXml(unsafe) {
    if (!unsafe) return '';
    return String(unsafe)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Generate complete editable DOCX file from resume model
   */
  function generateResumeDOCX(resumeData, options = {}) {
    const zip = new SimpleZip();
    const pageSize = (options.pageSize || (resumeData.design && resumeData.design.pageSize) || 'a4').toLowerCase();
    const isLetter = pageSize === 'letter';

    const templateId = options.template || (resumeData.design && resumeData.design.templateId) || resumeData.template || 'classic-professional';
    const density = options.density || (resumeData.design && resumeData.design.density) || (templateId === 'compact-professional' ? 'compact' : 'standard');
    const isCompact = density === 'compact';

    // A4: 11906 x 16838 dxa (210mm x 297mm)
    // Letter: 12240 x 15840 dxa (8.5in x 11in)
    const pageW = isLetter ? 12240 : 11906;
    const pageH = isLetter ? 15840 : 16838;
    const marginDxa = isCompact ? 720 : 1080; // 0.5 in for compact, 0.75 in for standard

    let fontFamily = options.fontFamily || (resumeData.design && resumeData.design.fontFamily);
    if (!fontFamily) {
      fontFamily = (templateId === 'classic-professional' || templateId === 'experienced-professional' || templateId === 'academic-cv')
        ? 'serif'
        : 'sans';
    }
    const fontName = fontFamily === 'serif' ? 'Times New Roman' : 'Arial';

    // Header alignment
    const headerAlign = (templateId === 'classic-professional' || templateId === 'experienced-professional' || templateId === 'academic-cv')
      ? 'center'
      : 'left';

    // Heading border in styles
    let headingBorderXml = '<w:bottom w:val="single" w:sz="6" w:space="2" w:color="CBD5E1"/>';
    if (templateId === 'modern-minimal') {
      headingBorderXml = '<w:bottom w:val="none"/>';
    } else if (templateId === 'experienced-professional') {
      headingBorderXml = '<w:bottom w:val="double" w:sz="12" w:space="3" w:color="0F172A"/>';
    } else if (templateId === 'classic-professional') {
      headingBorderXml = '<w:bottom w:val="single" w:sz="8" w:space="2" w:color="0F172A"/>';
    } else if (templateId === 'career-transition') {
      headingBorderXml = '<w:bottom w:val="single" w:sz="6" w:space="2" w:color="047857"/>';
    }

    // Font size in half-points (dxa)
    const fontSizeOpt = options.fontSize || (resumeData.design && resumeData.design.fontSize) || 'standard';
    let baseSzVal = 22;
    if (fontSizeOpt === 'comfortable') baseSzVal = 24;
    else if (fontSizeOpt === 'compact') baseSzVal = 20;


    // Track Hyperlinks for document.xml.rels
    const relationships = [];
    let relIdCounter = 1;
    function registerHyperlink(targetUrl) {
      if (!targetUrl) return null;
      let safeUrl = targetUrl.trim();
      if (/[\u0000-\u001f]/.test(safeUrl) || (/^[a-z][a-z0-9+.-]*:/i.test(safeUrl) && !/^(https?:|mailto:|tel:)/i.test(safeUrl))) return null;
      if (!/^https?:\/\//i.test(safeUrl) && ! /^(mailto:|tel:)/i.test(safeUrl)) {
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

    // 1. [Content_Types].xml
    const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;
    zip.addFile('[Content_Types].xml', contentTypesXml);

    // 2. _rels/.rels
    const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;
    zip.addFile('_rels/.rels', relsXml);

    // 3. word/styles.xml
    const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="${fontName}" w:hAnsi="${fontName}" w:cs="${fontName}"/>
        <w:sz w:val="${baseSzVal}"/>
        <w:color w:val="1F2937"/>
        <w:lang w:val="en-US"/>
      </w:rPr>
    </w:rPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:pPr>
      <w:spacing w:after="${isCompact ? '40' : '80'}" w:line="${isCompact ? '220' : '240'}" w:lineRule="auto"/>
    </w:pPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:pPr>
      <w:keepNext/>
      <w:spacing w:before="${isCompact ? '160' : '240'}" w:after="${isCompact ? '40' : '80'}"/>
      <w:pBdr>
        ${headingBorderXml}
      </w:pBdr>
    </w:pPr>
    <w:rPr>
      <w:b/>
      <w:caps/>
      <w:sz w:val="${baseSzVal + 3}"/>
      <w:color w:val="0F172A"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="ListBullet">
    <w:name w:val="List Bullet"/>
    <w:basedOn w:val="Normal"/>
    <w:pPr>
      <w:spacing w:after="${isCompact ? '20' : '40'}" w:line="${isCompact ? '210' : '230'}" w:lineRule="auto"/>
      <w:ind w:left="360" w:hanging="240"/>
    </w:pPr>
  </w:style>
</w:styles>`;
    zip.addFile('word/styles.xml', stylesXml);

    // 4. Construct word/document.xml content
    const p = resumeData.personal || {};
    const bodyXml = [];

    // Header: Full Name
    const fullName = (p.fullName || 'RESUME').trim();
    bodyXml.push(`
      <w:p>
        <w:pPr>
          <w:jc w:val="${headerAlign}"/>
          <w:spacing w:before="0" w:after="40"/>
        </w:pPr>
        <w:r>
          <w:rPr>
            <w:b/>
            <w:sz w:val="32"/>
            <w:color w:val="0F172A"/>
          </w:rPr>
          <w:t>${escapeXml(fullName)}</w:t>
        </w:r>
      </w:p>`);

    // Target Title / Headline
    if (p.targetTitle && p.targetTitle.trim()) {
      bodyXml.push(`
        <w:p>
          <w:pPr>
            <w:jc w:val="${headerAlign}"/>
            <w:spacing w:before="0" w:after="80"/>
          </w:pPr>
          <w:r>
            <w:rPr>
              <w:sz w:val="20"/>
              <w:color w:val="475569"/>
            </w:rPr>
            <w:t>${escapeXml(p.targetTitle.trim())}</w:t>
          </w:r>
        </w:p>`);
    }

    // Contact Information Line
    const contactParts = [];
    if (p.email && p.email.trim()) {
      const email = p.email.trim();
      const rId = registerHyperlink('mailto:' + email);
      contactParts.push({ text: email, rId });
    }
    if (p.phone && p.phone.trim()) {
      contactParts.push({ text: p.phone.trim() });
    }
    if (p.location && p.location.trim()) {
      contactParts.push({ text: p.location.trim() });
    }
    if (p.linkedin && p.linkedin.trim()) {
      const link = p.linkedin.trim();
      const rId = registerHyperlink(link);
      contactParts.push({ text: link.replace(/^https?:\/\//, ''), rId });
    }
    if (p.github && p.github.trim()) {
      const link = p.github.trim();
      const rId = registerHyperlink(link);
      contactParts.push({ text: link.replace(/^https?:\/\//, ''), rId });
    }
    if (p.website && p.website.trim()) {
      const link = p.website.trim();
      const rId = registerHyperlink(link);
      contactParts.push({ text: link.replace(/^https?:\/\//, ''), rId });
    }

    if (contactParts.length > 0) {
      let contactRuns = '';
      for (let i = 0; i < contactParts.length; i++) {
        if (i > 0) {
          contactRuns += `
            <w:r>
              <w:rPr><w:sz w:val="${Math.max(18, baseSzVal - 2)}"/><w:color w:val="94A3B8"/></w:rPr>
              <w:t xml:space="preserve">  •  </w:t>
            </w:r>`;
        }
        const item = contactParts[i];
        if (item.rId) {
          contactRuns += `
            <w:hyperlink r:id="${item.rId}" w:history="1">
              <w:r>
                <w:rPr><w:sz w:val="${Math.max(18, baseSzVal - 2)}"/><w:color w:val="2563EB"/><w:u w:val="none"/></w:rPr>
                <w:t>${escapeXml(item.text)}</w:t>
              </w:r>
            </w:hyperlink>`;
        } else {
          contactRuns += `
            <w:r>
              <w:rPr><w:sz w:val="${Math.max(18, baseSzVal - 2)}"/><w:color w:val="334155"/></w:rPr>
              <w:t>${escapeXml(item.text)}</w:t>
            </w:r>`;
        }
      }

      bodyXml.push(`
        <w:p>
          <w:pPr>
            <w:jc w:val="${headerAlign}"/>
            <w:spacing w:before="0" w:after="160"/>
          </w:pPr>
          ${contactRuns}
        </w:p>`);
    }

    // Helper: Add Section Header
    function addSectionHeader(title) {
      bodyXml.push(`
        <w:p>
          <w:pPr>
            <w:pStyle w:val="Heading1"/>
            <w:spacing w:before="240" w:after="80"/>
          </w:pPr>
          <w:r>
            <w:rPr><w:b/><w:caps/><w:sz w:val="22"/><w:color w:val="0F172A"/></w:rPr>
            <w:t>${escapeXml(title)}</w:t>
          </w:r>
        </w:p>`);
    }

    // Section Visibility & Order
    const vis = resumeData.sectionVisibility || {
      summary: true,
      experience: true,
      education: true,
      projects: true,
      skills: true,
      certifications: true,
      achievements: true,
      volunteering: true,
      languages: true,
      academic: true
    };

    const sectionOrder = (resumeData.design && Array.isArray(resumeData.design.sectionOrder))
      ? [...new Set([...resumeData.design.sectionOrder, 'summary', 'experience', 'education', 'projects', 'skills', 'certifications', 'achievements', 'volunteering', 'languages', 'academic'])]
      : ['summary', 'experience', 'education', 'projects', 'skills', 'certifications', 'achievements', 'volunteering', 'languages', 'academic'];

    // Render sections by defined order
    for (const secKey of sectionOrder) {
      if (vis[secKey] === false) continue;

      if (secKey === 'summary' && resumeData.summary && resumeData.summary.trim()) {
        addSectionHeader(resumeData.summaryTitle || 'Professional Summary');
        bodyXml.push(`
          <w:p>
            <w:pPr><w:spacing w:after="120"/><w:jc w:val="both"/></w:pPr>
            <w:r>
              <w:rPr><w:sz w:val="${baseSzVal}"/><w:color w:val="334155"/></w:rPr>
              <w:t>${escapeXml(resumeData.summary.trim())}</w:t>
            </w:r>
          </w:p>`);
      }

      if (secKey === 'experience' && Array.isArray(resumeData.experience) && resumeData.experience.length > 0) {
        addSectionHeader(resumeData.experienceTitle || 'Work Experience');
        for (const exp of resumeData.experience) {
          const role = (exp.role || '').trim();
          const comp = (exp.company || '').trim();
          const dur = (exp.duration || '').trim();
          const loc = (exp.location || '').trim();
          if (!role && !comp) continue;

          // Role and Duration line
          bodyXml.push(`
            <w:p>
              <w:pPr>
                <w:keepNext/>
                <w:spacing w:before="120" w:after="30"/>
              </w:pPr>
              <w:r>
                <w:rPr><w:b/><w:sz w:val="20"/><w:color w:val="0F172A"/></w:rPr>
                <w:t>${escapeXml(role)}</w:t>
              </w:r>
              ${comp ? `
              <w:r>
                <w:rPr><w:sz w:val="20"/><w:color w:val="475569"/></w:rPr>
                <w:t xml:space="preserve">  |  ${escapeXml(comp)}</w:t>
              </w:r>` : ''}
              ${dur ? `
              <w:r>
                <w:rPr><w:i/><w:sz w:val="${Math.max(18, baseSzVal - 2)}"/><w:color w:val="64748B"/></w:rPr>
                <w:t xml:space="preserve">  (${escapeXml(dur)}${loc ? ', ' + escapeXml(loc) : ''})</w:t>
              </w:r>` : ''}
            </w:p>`);

          // Bullets
          if (exp.bulletsText && exp.bulletsText.trim()) {
            const lines = exp.bulletsText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
            for (const line of lines) {
              const cleaned = line.trim().replace(/^[-*•]\s*/, '');
              if (!cleaned) continue;
              bodyXml.push(`
                <w:p>
                  <w:pPr><w:pStyle w:val="ListBullet"/></w:pPr>
                  <w:r>
                    <w:rPr><w:sz w:val="${baseSzVal}"/><w:color w:val="334155"/></w:rPr>
                    <w:t xml:space="preserve">•  ${escapeXml(cleaned)}</w:t>
                  </w:r>
                </w:p>`);
            }
          }
        }
      }

      if (secKey === 'education' && Array.isArray(resumeData.education) && resumeData.education.length > 0) {
        addSectionHeader(resumeData.educationTitle || 'Education');
        for (const edu of resumeData.education) {
          const deg = (edu.degree || '').trim();
          const inst = (edu.institution || '').trim();
          const dur = (edu.duration || '').trim();
          const loc = (edu.location || '').trim();
          const score = (edu.score || '').trim();
          if (!deg && !inst) continue;

          bodyXml.push(`
            <w:p>
              <w:pPr><w:keepNext/><w:spacing w:before="100" w:after="20"/></w:pPr>
              <w:r>
                <w:rPr><w:b/><w:sz w:val="20"/><w:color w:val="0F172A"/></w:rPr>
                <w:t>${escapeXml(deg)}</w:t>
              </w:r>
              ${inst ? `
              <w:r>
                <w:rPr><w:sz w:val="20"/><w:color w:val="475569"/></w:rPr>
                <w:t xml:space="preserve">  |  ${escapeXml(inst)}</w:t>
              </w:r>` : ''}
              ${dur ? `
              <w:r>
                <w:rPr><w:i/><w:sz w:val="${Math.max(18, baseSzVal - 2)}"/><w:color w:val="64748B"/></w:rPr>
                <w:t xml:space="preserve">  (${escapeXml(dur)}${loc ? ', ' + escapeXml(loc) : ''})</w:t>
              </w:r>` : ''}
            </w:p>`);

          if (score) {
            bodyXml.push(`
              <w:p>
                <w:pPr><w:pStyle w:val="ListBullet"/></w:pPr>
                <w:r>
                  <w:rPr><w:sz w:val="${Math.max(18, baseSzVal - 2)}"/><w:color w:val="64748B"/></w:rPr>
                  <w:t xml:space="preserve">•  ${escapeXml(score)}</w:t>
                </w:r>
              </w:p>`);
          }
        }
      }

      if (secKey === 'projects' && Array.isArray(resumeData.projects) && resumeData.projects.length > 0) {
        addSectionHeader(resumeData.projectsTitle || 'Key Projects');
        for (const proj of resumeData.projects) {
          const name = (proj.name || '').trim();
          const tech = (proj.tech || '').trim();
          const link = (proj.link || '').trim();
          if (!name) continue;

          let linkRId = null;
          if (link) {
            linkRId = registerHyperlink(link);
          }

          bodyXml.push(`
            <w:p>
              <w:pPr><w:keepNext/><w:spacing w:before="120" w:after="30"/></w:pPr>
              <w:r>
                <w:rPr><w:b/><w:sz w:val="20"/><w:color w:val="0F172A"/></w:rPr>
                <w:t>${escapeXml(name)}</w:t>
              </w:r>
              ${tech ? `
              <w:r>
                <w:rPr><w:i/><w:sz w:val="${Math.max(18, baseSzVal - 2)}"/><w:color w:val="64748B"/></w:rPr>
                <w:t xml:space="preserve">  [${escapeXml(tech)}]</w:t>
              </w:r>` : ''}
              ${linkRId ? `
              <w:hyperlink r:id="${linkRId}" w:history="1">
                <w:r>
                  <w:rPr><w:sz w:val="17"/><w:color w:val="2563EB"/></w:rPr>
                  <w:t xml:space="preserve">  (${escapeXml(link)})</w:t>
                </w:r>
              </w:hyperlink>` : ''}
            </w:p>`);

          if (proj.bulletsText && proj.bulletsText.trim()) {
            const lines = proj.bulletsText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
            for (const line of lines) {
              const cleaned = line.trim().replace(/^[-*•]\s*/, '');
              if (!cleaned) continue;
              bodyXml.push(`
                <w:p>
                  <w:pPr><w:pStyle w:val="ListBullet"/></w:pPr>
                  <w:r>
                    <w:rPr><w:sz w:val="${baseSzVal}"/><w:color w:val="334155"/></w:rPr>
                    <w:t xml:space="preserve">•  ${escapeXml(cleaned)}</w:t>
                  </w:r>
                </w:p>`);
            }
          }
        }
      }

      if (secKey === 'skills' && resumeData.skills) {
        const s = resumeData.skills;
        const skillEntries = [];
        if (s.languages && s.languages.trim()) skillEntries.push({ label: 'Core Competencies', text: s.languages.trim() });
        if (s.frameworks && s.frameworks.trim()) skillEntries.push({ label: 'Tools & Platforms', text: s.frameworks.trim() });
        if (s.tools && s.tools.trim()) skillEntries.push({ label: 'Technical & Data Skills', text: s.tools.trim() });
        if (s.other && s.other.trim()) skillEntries.push({ label: 'Professional Skills', text: s.other.trim() });

        if (skillEntries.length > 0) {
          addSectionHeader(resumeData.skillsTitle || 'Skills & Competencies');
          for (const item of skillEntries) {
            bodyXml.push(`
              <w:p>
                <w:pPr><w:spacing w:after="40"/></w:pPr>
                <w:r>
                  <w:rPr><w:b/><w:sz w:val="${baseSzVal}"/><w:color w:val="0F172A"/></w:rPr>
                  <w:t xml:space="preserve">${escapeXml(item.label)}:  </w:t>
                </w:r>
                <w:r>
                  <w:rPr><w:sz w:val="${baseSzVal}"/><w:color w:val="334155"/></w:rPr>
                  <w:t>${escapeXml(item.text)}</w:t>
                </w:r>
              </w:p>`);
          }
        }
      }

      // Certifications
      if (secKey === 'certifications' && Array.isArray(resumeData.certifications) && resumeData.certifications.length > 0) {
        addSectionHeader('Certifications & Credentials');
        for (const cert of resumeData.certifications) {
          const title = (cert.name || cert.title || '').trim();
          const issuer = (cert.issuer || '').trim();
          const year = (cert.year || cert.date || '').trim();
          if (!title) continue;
          bodyXml.push(`
            <w:p>
              <w:pPr><w:pStyle w:val="ListBullet"/></w:pPr>
              <w:r>
                <w:rPr><w:b/><w:sz w:val="${baseSzVal}"/><w:color w:val="0F172A"/></w:rPr>
                <w:t xml:space="preserve">•  ${escapeXml(title)}</w:t>
              </w:r>
              ${issuer ? `
              <w:r>
                <w:rPr><w:sz w:val="${baseSzVal}"/><w:color w:val="475569"/></w:rPr>
                <w:t xml:space="preserve"> — ${escapeXml(issuer)}</w:t>
              </w:r>` : ''}
              ${year ? `
              <w:r>
                <w:rPr><w:i/><w:sz w:val="${Math.max(18, baseSzVal - 2)}"/><w:color w:val="64748B"/></w:rPr>
                <w:t xml:space="preserve"> (${escapeXml(year)})</w:t>
              </w:r>` : ''}
            </w:p>`);
        }
      }

      // Achievements / Awards
      if (secKey === 'achievements' && Array.isArray(resumeData.achievements) && resumeData.achievements.length > 0) {
        addSectionHeader('Honors & Achievements');
        for (const ach of resumeData.achievements) {
          const text = (typeof ach === 'string' ? ach : (ach.title || ach.text || '')).trim();
          if (!text) continue;
          bodyXml.push(`
            <w:p>
              <w:pPr><w:pStyle w:val="ListBullet"/></w:pPr>
              <w:r>
                <w:rPr><w:sz w:val="${baseSzVal}"/><w:color w:val="334155"/></w:rPr>
                <w:t xml:space="preserve">•  ${escapeXml(text)}</w:t>
              </w:r>
            </w:p>`);
        }
      }

      // Volunteering
      if (secKey === 'volunteering' && Array.isArray(resumeData.volunteering) && resumeData.volunteering.length > 0) {
        addSectionHeader('Community & Leadership');
        for (const vol of resumeData.volunteering) {
          const role = (vol.role || '').trim();
          const org = (vol.organization || vol.org || '').trim();
          const dur = (vol.duration || '').trim();
          if (!role && !org) continue;
          bodyXml.push(`
            <w:p>
              <w:pPr><w:pStyle w:val="ListBullet"/></w:pPr>
              <w:r>
                <w:rPr><w:b/><w:sz w:val="${baseSzVal}"/><w:color w:val="0F172A"/></w:rPr>
                <w:t xml:space="preserve">•  ${escapeXml(role)}</w:t>
              </w:r>
              ${org ? `
              <w:r>
                <w:rPr><w:sz w:val="${baseSzVal}"/><w:color w:val="475569"/></w:rPr>
                <w:t xml:space="preserve">, ${escapeXml(org)}</w:t>
              </w:r>` : ''}
              ${dur ? `
              <w:r>
                <w:rPr><w:i/><w:sz w:val="${Math.max(18, baseSzVal - 2)}"/><w:color w:val="64748B"/></w:rPr>
                <w:t xml:space="preserve"> (${escapeXml(dur)})</w:t>
              </w:r>` : ''}
            </w:p>`);
        }
      }

      // Languages
      if (secKey === 'languages' && Array.isArray(resumeData.languages) && resumeData.languages.length > 0) {
        addSectionHeader('Languages');
        const langStr = resumeData.languages.map(l => typeof l === 'string' ? l : [l.name, l.proficiency].filter(Boolean).join(' — ')).filter(Boolean).join(', ');
        if (langStr) {
          bodyXml.push(`
            <w:p>
              <w:pPr><w:spacing w:after="80"/></w:pPr>
              <w:r>
                <w:rPr><w:sz w:val="${baseSzVal}"/><w:color w:val="334155"/></w:rPr>
                <w:t>${escapeXml(langStr)}</w:t>
              </w:r>
            </w:p>`);
        }
      }

      // Academic Sections (Publications, Teaching, Presentations, Grants)
      if (secKey === 'academic' && resumeData.academic) {
        const acad = resumeData.academic;
        if (Array.isArray(acad.publications) && acad.publications.length > 0) {
          addSectionHeader('Peer-Reviewed Publications');
          for (const pub of acad.publications) {
            const title = (pub.title || pub.citation || '').trim();
            if (!title) continue;
            bodyXml.push(`
              <w:p>
                <w:pPr><w:pStyle w:val="ListBullet"/></w:pPr>
                <w:r>
                  <w:rPr><w:sz w:val="${baseSzVal}"/><w:color w:val="334155"/></w:rPr>
                  <w:t xml:space="preserve">•  ${escapeXml(title)}</w:t>
                </w:r>
              </w:p>`);
          }
        }

        if (Array.isArray(acad.teaching) && acad.teaching.length > 0) {
          addSectionHeader('Teaching Experience');
          for (const t of acad.teaching) {
            const role = (t.role || t.course || '').trim();
            const inst = (t.institution || '').trim();
            const term = (t.term || '').trim();
            if (!role) continue;
            bodyXml.push(`
              <w:p>
                <w:pPr><w:pStyle w:val="ListBullet"/></w:pPr>
                <w:r>
                  <w:rPr><w:b/><w:sz w:val="${baseSzVal}"/><w:color w:val="0F172A"/></w:rPr>
                  <w:t xml:space="preserve">•  ${escapeXml(role)}</w:t>
                </w:r>
                ${inst ? `
                <w:r>
                  <w:rPr><w:sz w:val="${baseSzVal}"/><w:color w:val="475569"/></w:rPr>
                  <w:t xml:space="preserve"> — ${escapeXml(inst)}</w:t>
                </w:r>` : ''}
                ${term ? `
                <w:r>
                  <w:rPr><w:i/><w:sz w:val="${Math.max(18, baseSzVal - 2)}"/><w:color w:val="64748B"/></w:rPr>
                  <w:t xml:space="preserve"> (${escapeXml(term)})</w:t>
                </w:r>` : ''}
              </w:p>`);
          }
        }

        if (Array.isArray(acad.presentations) && acad.presentations.length > 0) {
          addSectionHeader('Conference Presentations');
          for (const pr of acad.presentations) {
            const text = (typeof pr === 'string' ? pr : (pr.title || pr.event || '')).trim();
            if (!text) continue;
            bodyXml.push(`
              <w:p>
                <w:pPr><w:pStyle w:val="ListBullet"/></w:pPr>
                <w:r>
                  <w:rPr><w:sz w:val="${baseSzVal}"/><w:color w:val="334155"/></w:rPr>
                  <w:t xml:space="preserve">•  ${escapeXml(text)}</w:t>
                </w:r>
              </w:p>`);
          }
        }
        if (Array.isArray(acad.grants) && acad.grants.length) {
          addSectionHeader('Research Grants');
          for (const grant of acad.grants) {
            const text = typeof grant === 'string' ? grant : [grant.title || grant.name, grant.funder, grant.year].filter(Boolean).join(' — ');
            if (text) bodyXml.push(`<w:p><w:pPr><w:pStyle w:val="ListBullet"/></w:pPr><w:r><w:t>${escapeXml(text)}</w:t></w:r></w:p>`);
          }
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
    ${bodyXml.join('\n')}
    ${sectPrXml}
  </w:body>
</w:document>`;
    zip.addFile('word/document.xml', documentXml);

    // 5. word/_rels/document.xml.rels (Include styles and external hyperlinks)
    const relItemsXml = [
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>',
      ...relationships.map(rel => `<Relationship Id="${rel.id}" Type="${rel.type}" Target="${rel.target}" TargetMode="${rel.targetMode}"/>`)
    ].join('\n  ');

    const docRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${relItemsXml}
</Relationships>`;
    zip.addFile('word/_rels/document.xml.rels', docRelsXml);

    return zip;
  }

  return {
    SimpleZip,
    generateResumeDOCX,
    escapeXml
  };
});
