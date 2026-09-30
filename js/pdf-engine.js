/**
 * ApplyReady.in - Vector Text PDF Engine
 * Pure client-side PDF 1.4 Generator with true selectable/searchable text,
 * clickable hyperlinks, deliberate pagination, and zero external dependencies.
 * Compatible with browsers and Node.js.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ApplyReadyPDF = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // Standard A4 dimensions in points (72 points per inch)
  const A4_WIDTH = 595.28;
  const A4_HEIGHT = 841.89;

  // Approximate character width ratios relative to font size (1000 units per em)
  // Standard Helvetica & Times metrics
  const HELVETICA_METRICS = {
    avg: 550,
    widths: {
      ' ': 278, '!': 278, '"': 355, '#': 556, '$': 556, '%': 889, '&': 667, "'": 191,
      '(': 333, ')': 333, '*': 389, '+': 584, ',': 278, '-': 333, '.': 278, '/': 278,
      '0': 556, '1': 556, '2': 556, '3': 556, '4': 556, '5': 556, '6': 556, '7': 556,
      '8': 556, '9': 556, ':': 278, ';': 278, '<': 584, '=': 584, '>': 584, '?': 556,
      '@': 1015, 'A': 667, 'B': 667, 'C': 722, 'D': 722, 'E': 667, 'F': 611, 'G': 778,
      'H': 722, 'I': 278, 'J': 500, 'K': 667, 'L': 556, 'M': 833, 'N': 722, 'O': 778,
      'P': 667, 'Q': 778, 'R': 722, 'S': 667, 'T': 611, 'U': 722, 'V': 667, 'W': 944,
      'X': 667, 'Y': 667, 'Z': 611, '[': 278, '\\': 278, ']': 278, '^': 469, '_': 556,
      '`': 333, 'a': 556, 'b': 556, 'c': 500, 'd': 556, 'e': 556, 'f': 278, 'g': 556,
      'h': 556, 'i': 222, 'j': 222, 'k': 500, 'l': 222, 'm': 833, 'n': 556, 'o': 556,
      'p': 556, 'q': 556, 'r': 333, 's': 500, 't': 278, 'u': 556, 'v': 500, 'w': 722,
      'x': 500, 'y': 500, 'z': 500, '{': 334, '|': 260, '}': 334, '~': 584
    }
  };

  const TIMES_METRICS = {
    avg: 500,
    widths: {
      ' ': 250, '!': 333, '"': 408, '#': 500, '$': 500, '%': 833, '&': 778, "'": 180,
      '(': 333, ')': 333, '*': 500, '+': 564, ',': 250, '-': 333, '.': 250, '/': 278,
      '0': 500, '1': 500, '2': 500, '3': 500, '4': 500, '5': 500, '6': 500, '7': 500,
      '8': 500, '9': 500, ':': 278, ';': 278, '<': 564, '=': 564, '>': 564, '?': 444,
      '@': 921, 'A': 722, 'B': 667, 'C': 667, 'D': 722, 'E': 611, 'F': 556, 'G': 722,
      'H': 722, 'I': 333, 'J': 389, 'K': 722, 'L': 611, 'M': 889, 'N': 722, 'O': 722,
      'P': 556, 'Q': 722, 'R': 667, 'S': 556, 'T': 611, 'U': 722, 'V': 722, 'W': 944,
      'X': 722, 'Y': 722, 'Z': 611, '[': 333, '\\': 278, ']': 333, '^': 469, '_': 500,
      '`': 333, 'a': 444, 'b': 500, 'c': 444, 'd': 500, 'e': 444, 'f': 278, 'g': 500,
      'h': 500, 'i': 278, 'j': 278, 'k': 500, 'l': 278, 'm': 778, 'n': 500, 'o': 500,
      'p': 500, 'q': 500, 'r': 333, 's': 389, 't': 278, 'u': 500, 'v': 500, 'w': 722,
      'x': 500, 'y': 500, 'z': 444, '{': 480, '|': 200, '}': 480, '~': 541
    }
  };

  /**
   * Measure text width in points
   */
  function measureTextWidth(text, fontSize, fontKey) {
    if (!text) return 0;
    const metrics = (fontKey && fontKey.includes('Helvetica')) ? HELVETICA_METRICS : TIMES_METRICS;
    let totalUnits = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const w = metrics.widths[char] || metrics.avg;
      totalUnits += w;
    }
    return (totalUnits / 1000) * fontSize;
  }

  /**
   * Split string into lines that fit within maxWidth points
   */
  function splitTextToLines(text, fontSize, maxWidth, fontKey) {
    if (!text) return [];
    const paragraphs = String(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    const resultLines = [];

    for (let p = 0; p < paragraphs.length; p++) {
      const paragraph = paragraphs[p].trim();
      if (!paragraph) {
        continue;
      }
      const words = paragraph.split(/\s+/);
      let currentLine = words[0];

      for (let w = 1; w < words.length; w++) {
        const testLine = currentLine + ' ' + words[w];
        const width = measureTextWidth(testLine, fontSize, fontKey);
        if (width <= maxWidth) {
          currentLine = testLine;
        } else {
          resultLines.push(currentLine);
          currentLine = words[w];
        }
      }
      if (currentLine) {
        resultLines.push(currentLine);
      }
    }
    return resultLines;
  }

  // WinAnsi standard encoding overrides (128..159)
  const WINANSI_SPECIAL = {
    8364: '\\200', // €
    8218: '\\202', // ‚
    402:  '\\203', // ƒ
    8222: '\\204', // „
    8230: '\\205', // …
    8224: '\\206', // †
    8225: '\\207', // ‡
    710:  '\\210', // ˆ
    8240: '\\211', // ‰
    352:  '\\212', // Š
    8249: '\\213', // ‹
    338:  '\\214', // Œ
    381:  '\\216', // Ž
    8216: '\\221', // ‘
    8217: '\\222', // ’
    8220: '\\223', // “
    8221: '\\224', // ”
    8226: '\\225', // •
    8211: '\\226', // –
    8212: '\\227', // —
    732:  '\\230', // ˜
    8482: '\\231', // ™
    353:  '\\232', // š
    8250: '\\233', // ›
    339:  '\\234', // œ
    382:  '\\236', // ž
    376:  '\\237'  // Ÿ
  };

  // Specific Latin character transliterations not decomposed by standard NFKD
  const LATIN_TRANSLITERATION = {
    'Ł': 'L', 'ł': 'l', 'Đ': 'D', 'đ': 'd', 'Ħ': 'H', 'ħ': 'h',
    'ı': 'i', 'İ': 'I', 'ĸ': 'k', 'ŉ': 'n', 'Ŋ': 'N', 'ŋ': 'n',
    'Ŧ': 'T', 'ŧ': 't', 'ß': 'ss', 'Ø': '\\330', 'ø': '\\370',
    'Æ': '\\306', 'æ': '\\346'
  };

  /**
   * Escape text for PDF literal strings with true WinAnsi encoding and Unicode preservation
   */
  function escapePdfText(text) {
    if (text === null || text === undefined) return '';
    const str = String(text);
    let out = '';

    function appendCode(code, ch) {
      if (ch === '\\') return '\\\\';
      if (ch === '(') return '\\(';
      if (ch === ')') return '\\)';
      if (WINANSI_SPECIAL[code]) return WINANSI_SPECIAL[code];
      if (code >= 32 && code <= 126) return ch;
      if (code >= 160 && code <= 255) return '\\' + code.toString(8).padStart(3, '0');
      return null;
    }

    for (let i = 0; i < str.length; i++) {
      const ch = str[i];
      const code = str.charCodeAt(i);

      const direct = appendCode(code, ch);
      if (direct !== null) {
        out += direct;
        continue;
      }

      // Check special transliteration table
      if (LATIN_TRANSLITERATION[ch]) {
        out += LATIN_TRANSLITERATION[ch];
        continue;
      }

      // Decompose Unicode accents (e.g. č -> c, ř -> r, ň -> n)
      const decomposed = ch.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
      if (decomposed && decomposed !== ch) {
        for (let j = 0; j < decomposed.length; j++) {
          const dCh = decomposed[j];
          const dCode = dCh.charCodeAt(0);
          const dDirect = appendCode(dCode, dCh);
          out += dDirect !== null ? dDirect : dCh;
        }
      } else {
        // Safe printable fallback
        out += (code >= 32 && code <= 126) ? ch : ' ';
      }
    }
    return out;
  }

  /**
   * Clean and normalize URLs for PDF links
   */
  function sanitizeUrl(raw) {
    if (!raw) return '';
    let url = String(raw).trim();
    if (url.toLowerCase().startsWith('javascript:') || url.toLowerCase().startsWith('data:')) {
      return '';
    }
    if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('mailto:') && !url.startsWith('tel:')) {
      url = 'https://' + url;
    }
    return url;
  }

  /**
   * Low-Level Vector PDF Document Builder
   */
  class VectorPDFDocument {
    constructor(options = {}) {
      this.fontFamily = options.fontFamily === 'sans' ? 'sans' : 'serif';
      this.pages = [];
      this.currentPage = null;
      this.objects = [];
      this.addPage();
    }

    addPage() {
      const page = {
        width: A4_WIDTH,
        height: A4_HEIGHT,
        commands: [],
        annotations: []
      };
      this.pages.push(page);
      this.currentPage = page;
      return page;
    }

    getPageCount() {
      return this.pages.length;
    }

    // PDF coordinates have origin at bottom-left
    toPdfY(topY) {
      return A4_HEIGHT - topY;
    }

    drawText(text, x, topY, options = {}) {
      if (!text) return;
      const fontSize = options.fontSize || 10;
      const fontStyle = options.fontStyle || 'normal'; // 'normal', 'bold', 'italic'
      const color = options.color || [0, 0, 0]; // RGB 0..1
      const fontKey = this.getFontResource(fontStyle);

      const pdfY = this.toPdfY(topY);
      const escaped = escapePdfText(text);

      const r = (color[0] || 0).toFixed(3);
      const g = (color[1] || 0).toFixed(3);
      const b = (color[2] || 0).toFixed(3);

      const cmd = `BT /${fontKey} ${fontSize} Tf ${r} ${g} ${b} rg 1 0 0 1 ${x.toFixed(2)} ${pdfY.toFixed(2)} Tm (${escaped}) Tj ET\n`;
      this.currentPage.commands.push(cmd);
    }

    drawLine(x1, topY1, x2, topY2, options = {}) {
      const lineWidth = options.lineWidth || 0.75;
      const color = options.color || [0, 0, 0];
      const y1 = this.toPdfY(topY1);
      const y2 = this.toPdfY(topY2);

      const r = (color[0] || 0).toFixed(3);
      const g = (color[1] || 0).toFixed(3);
      const b = (color[2] || 0).toFixed(3);

      const cmd = `q ${lineWidth.toFixed(2)} w ${r} ${g} ${b} RG ${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S Q\n`;
      this.currentPage.commands.push(cmd);
    }

    addLink(x, topY, width, height, url) {
      const safe = sanitizeUrl(url);
      if (!safe) return;
      // In PDF, Rect is [llx, lly, urx, ury]
      const llx = x;
      const lly = this.toPdfY(topY + height);
      const urx = x + width;
      const ury = this.toPdfY(topY);

      this.currentPage.annotations.push({
        rect: [llx, lly, urx, ury],
        url: safe
      });
    }

    getFontResource(style) {
      const isSans = this.fontFamily === 'sans';
      if (isSans) {
        if (style === 'bold') return 'F2';
        if (style === 'italic') return 'F3';
        return 'F1';
      } else {
        if (style === 'bold') return 'F5';
        if (style === 'italic') return 'F6';
        return 'F4';
      }
    }

    /**
     * Assemble all PDF structures into binary string
     */
    build() {
      const objects = [];
      const offsets = [];

      function addObject(content) {
        const id = objects.length + 1;
        objects.push({ id, content });
        return id;
      }

      // 1. Catalog
      const catalogId = addObject('<< /Type /Catalog /Pages 2 0 R >>');

      // 2. Pages Root Placeholder (we'll fill after page objects are created)
      const pagesRootId = addObject(''); // will replace content

      // Standard Font Objects
      // F1: Helvetica, F2: Helvetica-Bold, F3: Helvetica-Oblique
      // F4: Times-Roman, F5: Times-Bold, F6: Times-Italic
      const f1 = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
      const f2 = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
      const f3 = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>');
      const f4 = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman /Encoding /WinAnsiEncoding >>');
      const f5 = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Times-Bold /Encoding /WinAnsiEncoding >>');
      const f6 = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Times-Italic /Encoding /WinAnsiEncoding >>');

      const fontDict = `/Font << /F1 ${f1} 0 R /F2 ${f2} 0 R /F3 ${f3} 0 R /F4 ${f4} 0 R /F5 ${f5} 0 R /F6 ${f6} 0 R >>`;

      const pageObjectIds = [];

      for (let p = 0; p < this.pages.length; p++) {
        const page = this.pages[p];

        // Content stream object
        const streamData = page.commands.join('');
        const streamObjId = addObject(
          `<< /Length ${streamData.length} >>\nstream\n${streamData}endstream`
        );

        // Annotations
        const annotIds = [];
        for (let a = 0; a < page.annotations.length; a++) {
          const ann = page.annotations[a];
          const [llx, lly, urx, ury] = ann.rect;
          const escapedUrl = ann.url.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
          const annId = addObject(
            `<< /Type /Annot /Subtype /Link /Rect [${llx.toFixed(2)} ${lly.toFixed(2)} ${urx.toFixed(2)} ${ury.toFixed(2)}] /Border [0 0 0] /A << /S /URI /URI (${escapedUrl}) >> >>`
          );
          annotIds.push(`${annId} 0 R`);
        }

        const annotStr = annotIds.length > 0 ? `/Annots [ ${annotIds.join(' ')} ]` : '';

        // Page object
        const pageId = addObject(
          `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${page.width} ${page.height}] /Resources << ${fontDict} >> /Contents ${streamObjId} 0 R ${annotStr} >>`
        );
        pageObjectIds.push(`${pageId} 0 R`);
      }

      // Update Pages Root Object (id 2)
      objects[1].content = `<< /Type /Pages /Kids [ ${pageObjectIds.join(' ')} ] /Count ${pageObjectIds.length} >>`;

      // Construct final output with xref table
      let pdfOutput = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';

      for (let i = 0; i < objects.length; i++) {
        offsets.push(pdfOutput.length);
        const obj = objects[i];
        pdfOutput += `${obj.id} 0 obj\n${obj.content}\nendobj\n`;
      }

      const xrefOffset = pdfOutput.length;
      pdfOutput += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;

      for (let i = 0; i < offsets.length; i++) {
        const offStr = String(offsets[i]).padStart(10, '0');
        pdfOutput += `${offStr} 00000 n \n`;
      }

      pdfOutput += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

      return pdfOutput;
    }

    /**
     * Get PDF as Blob (for browsers)
     */
    toBlob() {
      const raw = this.build();
      const buffer = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) {
        buffer[i] = raw.charCodeAt(i) & 0xff;
      }
      return new Blob([buffer], { type: 'application/pdf' });
    }
  }

  /**
   * Resume Layout & Pagination Engine
   * Takes structured resume data and renders it neatly onto standard A4 pages
   */
  function generateResumePDF(resumeData, options = {}) {
    const fontFamily = options.fontFamily === 'sans' ? 'sans' : 'serif';
    const fontKey = fontFamily === 'sans' ? 'Helvetica' : 'Times';
    const doc = new VectorPDFDocument({ fontFamily });

    const marginLeft = 38;
    const marginRight = 38;
    const marginTop = 36;
    const marginBottom = 36;
    const contentWidth = A4_WIDTH - marginLeft - marginRight;
    const pageBottom = A4_HEIGHT - marginBottom;

    let currentY = marginTop;

    function ensureSpace(neededHeight) {
      if (currentY + neededHeight > pageBottom) {
        doc.addPage();
        currentY = marginTop;
        return true;
      }
      return false;
    }

    // 1. Header: Full Name
    const fullName = (resumeData.personal && resumeData.personal.fullName ? resumeData.personal.fullName : 'FULL NAME').trim().toUpperCase();
    const nameFontSize = 18;
    const nameWidth = measureTextWidth(fullName, nameFontSize, fontKey);
    const nameX = Math.max(marginLeft, marginLeft + (contentWidth - nameWidth) / 2);
    doc.drawText(fullName, nameX, currentY + nameFontSize, { fontSize: nameFontSize, fontStyle: 'bold', color: [0, 0, 0] });
    currentY += nameFontSize + 6;

    // Target Role / Professional Headline
    const targetTitle = (resumeData.personal && resumeData.personal.targetTitle ? resumeData.personal.targetTitle : '').trim();
    if (targetTitle) {
      const titleFontSize = 10.5;
      const titleWidth = measureTextWidth(targetTitle, titleFontSize, fontKey);
      const titleX = Math.max(marginLeft, marginLeft + (contentWidth - titleWidth) / 2);
      doc.drawText(targetTitle, titleX, currentY + titleFontSize, { fontSize: titleFontSize, fontStyle: 'italic', color: [0.2, 0.25, 0.32] });
      currentY += titleFontSize + 5;
    }

    // Contact Information Line with separated bullets
    const personal = resumeData.personal || {};
    const contactParts = [];
    if (personal.phone && personal.phone.trim()) contactParts.push({ text: personal.phone.trim(), type: 'phone', url: 'tel:' + personal.phone.trim().replace(/\s+/g, '') });
    if (personal.email && personal.email.trim()) contactParts.push({ text: personal.email.trim(), type: 'email', url: 'mailto:' + personal.email.trim() });
    if (personal.location && personal.location.trim()) contactParts.push({ text: personal.location.trim(), type: 'text' });
    if (personal.linkedin && personal.linkedin.trim()) contactParts.push({ text: personal.linkedin.trim(), type: 'link', url: personal.linkedin.trim() });
    if (personal.github && personal.github.trim()) contactParts.push({ text: personal.github.trim(), type: 'link', url: personal.github.trim() });
    if (personal.website && personal.website.trim()) contactParts.push({ text: personal.website.trim(), type: 'link', url: personal.website.trim() });

    if (contactParts.length > 0) {
      const contactFontSize = 9;
      const bulletSep = '  •  ';
      const bulletWidth = measureTextWidth(bulletSep, contactFontSize, fontKey);

      // Measure total line width to center
      let totalLineWidth = 0;
      for (let i = 0; i < contactParts.length; i++) {
        totalLineWidth += measureTextWidth(contactParts[i].text, contactFontSize, fontKey);
        if (i < contactParts.length - 1) totalLineWidth += bulletWidth;
      }

      let startX = Math.max(marginLeft, marginLeft + (contentWidth - totalLineWidth) / 2);
      // If it overflows one line, wrap gracefully
      for (let i = 0; i < contactParts.length; i++) {
        const item = contactParts[i];
        const itemWidth = measureTextWidth(item.text, contactFontSize, fontKey);

        if (startX + itemWidth > A4_WIDTH - marginRight && i > 0) {
          currentY += contactFontSize + 3;
          startX = marginLeft;
        }

        doc.drawText(item.text, startX, currentY + contactFontSize, {
          fontSize: contactFontSize,
          fontStyle: 'normal',
          color: item.url ? [0.05, 0.35, 0.75] : [0.15, 0.18, 0.22]
        });

        if (item.url) {
          doc.addLink(startX, currentY, itemWidth, contactFontSize + 2, item.url);
        }

        startX += itemWidth;

        if (i < contactParts.length - 1) {
          doc.drawText(bulletSep, startX, currentY + contactFontSize, {
            fontSize: contactFontSize,
            fontStyle: 'normal',
            color: [0.4, 0.45, 0.5]
          });
          startX += bulletWidth;
        }
      }
      currentY += contactFontSize + 8;
    }

    // Top Header Divider Line
    doc.drawLine(marginLeft, currentY, A4_WIDTH - marginRight, currentY, { lineWidth: 1.2, color: [0.1, 0.1, 0.1] });
    currentY += 10;

    /**
     * Helper to render a Section Heading with underline
     */
    function renderSectionHeader(title) {
      // Prevent orphan headers: require header + space for first entry header and line of content (65pt)
      ensureSpace(65);
      const headingFontSize = 10.5;
      doc.drawText(title.toUpperCase(), marginLeft, currentY + headingFontSize, {
        fontSize: headingFontSize,
        fontStyle: 'bold',
        color: [0, 0, 0]
      });
      currentY += headingFontSize + 3;
      doc.drawLine(marginLeft, currentY, A4_WIDTH - marginRight, currentY, {
        lineWidth: 0.6,
        color: [0.65, 0.7, 0.75]
      });
      currentY += 8;
    }

    // 2. Professional Summary
    const summary = (resumeData.summary || '').trim();
    if (summary) {
      renderSectionHeader(resumeData.summaryTitle || 'Professional Summary');
      const bodyFontSize = 9.5;
      const summaryLines = splitTextToLines(summary, bodyFontSize, contentWidth, fontKey);

      for (let l = 0; l < summaryLines.length; l++) {
        ensureSpace(bodyFontSize + 4);
        doc.drawText(summaryLines[l], marginLeft, currentY + bodyFontSize, {
          fontSize: bodyFontSize,
          fontStyle: 'normal',
          color: [0.1, 0.1, 0.1]
        });
        currentY += bodyFontSize + 3.5;
      }
      currentY += 6;
    }

    // 3. Work Experience
    const experience = resumeData.experience || [];
    if (Array.isArray(experience) && experience.length > 0) {
      let hasExp = false;
      for (const exp of experience) {
        if (exp.role || exp.company || exp.bulletsText) {
          hasExp = true;
          break;
        }
      }

      if (hasExp) {
        renderSectionHeader(resumeData.experienceTitle || 'Work Experience');

        for (let i = 0; i < experience.length; i++) {
          const exp = experience[i];
          if (!exp.role && !exp.company && !exp.bulletsText) continue;

          ensureSpace(28);

          // Role and Company (Left aligned)
          const roleCompany = [exp.role, exp.company].filter(Boolean).join('  |  ');
          const roleFontSize = 9.5;
          const dateLoc = [exp.duration, exp.location].filter(Boolean).join('  •  ');
          const dateWidth = dateLoc ? measureTextWidth(dateLoc, 9, fontKey) : 0;
          const roleWidth = measureTextWidth(roleCompany, roleFontSize, fontKey);
          const maxLeftWidth = dateWidth > 0 ? contentWidth - dateWidth - 12 : contentWidth;

          if (roleWidth <= maxLeftWidth) {
            // Fits cleanly on the same line
            doc.drawText(roleCompany, marginLeft, currentY + roleFontSize, {
              fontSize: roleFontSize,
              fontStyle: 'bold',
              color: [0.05, 0.05, 0.05]
            });
            if (dateLoc) {
              const dateX = A4_WIDTH - marginRight - dateWidth;
              doc.drawText(dateLoc, dateX, currentY + 9, {
                fontSize: 9,
                fontStyle: 'italic',
                color: [0.35, 0.4, 0.45]
              });
            }
            currentY += roleFontSize + 4;
          } else {
            // Text would collide with date: wrap gracefully without overlapping
            const roleLines = splitTextToLines(roleCompany, roleFontSize, contentWidth, fontKey);
            for (let rl = 0; rl < roleLines.length; rl++) {
              if (rl > 0) ensureSpace(roleFontSize + 3);
              doc.drawText(roleLines[rl], marginLeft, currentY + roleFontSize, {
                fontSize: roleFontSize,
                fontStyle: 'bold',
                color: [0.05, 0.05, 0.05]
              });
              currentY += roleFontSize + 2;
            }
            if (dateLoc) {
              ensureSpace(12);
              doc.drawText(dateLoc, marginLeft, currentY + 9, {
                fontSize: 9,
                fontStyle: 'italic',
                color: [0.35, 0.4, 0.45]
              });
              currentY += 9 + 4;
            } else {
              currentY += 2;
            }
          }

          // Bullets
          if (exp.bulletsText && exp.bulletsText.trim()) {
            const rawBullets = exp.bulletsText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
            const bulletIndent = 12;
            const bulletTextWidth = contentWidth - bulletIndent;

            for (let b = 0; b < rawBullets.length; b++) {
              const bulletText = rawBullets[b].trim().replace(/^[-*•]\s*/, '');
              if (!bulletText) continue;

              const bulletLines = splitTextToLines(bulletText, 9, bulletTextWidth, fontKey);
              for (let bl = 0; bl < bulletLines.length; bl++) {
                ensureSpace(13);
                if (bl === 0) {
                  // Bullet symbol
                  doc.drawText('•', marginLeft + 2, currentY + 9, { fontSize: 9, fontStyle: 'bold', color: [0.3, 0.3, 0.3] });
                }
                doc.drawText(bulletLines[bl], marginLeft + bulletIndent, currentY + 9, {
                  fontSize: 9,
                  fontStyle: 'normal',
                  color: [0.15, 0.15, 0.15]
                });
                currentY += 12.5;
              }
            }
          }
          currentY += 4;
        }
        currentY += 4;
      }
    }

    // 4. Education
    const education = resumeData.education || [];
    if (Array.isArray(education) && education.length > 0) {
      let hasEdu = false;
      for (const edu of education) {
        if (edu.degree || edu.institution) {
          hasEdu = true;
          break;
        }
      }

      if (hasEdu) {
        renderSectionHeader(resumeData.educationTitle || 'Education');

        for (let i = 0; i < education.length; i++) {
          const edu = education[i];
          if (!edu.degree && !edu.institution) continue;

          ensureSpace(24);

          // Degree & Institution
          const degreeInst = [edu.degree, edu.institution].filter(Boolean).join('  —  ');
          const degFontSize = 9.5;
          const metaParts = [edu.duration, edu.location, edu.score].filter(Boolean).join('  •  ');
          const metaWidth = metaParts ? measureTextWidth(metaParts, 9, fontKey) : 0;
          const degWidth = measureTextWidth(degreeInst, degFontSize, fontKey);
          const maxDegWidth = metaWidth > 0 ? contentWidth - metaWidth - 12 : contentWidth;

          if (degWidth <= maxDegWidth) {
            doc.drawText(degreeInst, marginLeft, currentY + degFontSize, {
              fontSize: degFontSize,
              fontStyle: 'bold',
              color: [0.05, 0.05, 0.05]
            });
            if (metaParts) {
              const metaX = A4_WIDTH - marginRight - metaWidth;
              doc.drawText(metaParts, metaX, currentY + 9, {
                fontSize: 9,
                fontStyle: 'italic',
                color: [0.35, 0.4, 0.45]
              });
            }
            currentY += degFontSize + 6;
          } else {
            const degLines = splitTextToLines(degreeInst, degFontSize, contentWidth, fontKey);
            for (let dl = 0; dl < degLines.length; dl++) {
              if (dl > 0) ensureSpace(degFontSize + 3);
              doc.drawText(degLines[dl], marginLeft, currentY + degFontSize, {
                fontSize: degFontSize,
                fontStyle: 'bold',
                color: [0.05, 0.05, 0.05]
              });
              currentY += degFontSize + 2;
            }
            if (metaParts) {
              ensureSpace(12);
              doc.drawText(metaParts, marginLeft, currentY + 9, {
                fontSize: 9,
                fontStyle: 'italic',
                color: [0.35, 0.4, 0.45]
              });
              currentY += 9 + 4;
            } else {
              currentY += 2;
            }
          }
          currentY += 4;
        }
        currentY += 4;
      }
    }

    // 5. Key Projects
    const projects = resumeData.projects || [];
    if (Array.isArray(projects) && projects.length > 0) {
      let hasProj = false;
      for (const proj of projects) {
        if (proj.name || proj.tech || proj.bulletsText) {
          hasProj = true;
          break;
        }
      }

      if (hasProj) {
        renderSectionHeader(resumeData.projectsTitle || 'Key Projects');

        for (let i = 0; i < projects.length; i++) {
          const proj = projects[i];
          if (!proj.name && !proj.tech && !proj.bulletsText) continue;

          ensureSpace(28);

          // Project Name & Tech
          const projName = proj.name || 'Project';
          const projFontSize = 9.5;
          const techText = (proj.tech && proj.tech.trim()) ? `|  ${proj.tech.trim()}` : '';
          const nameTech = techText ? `${projName}  ${techText}` : projName;
          const linkText = (proj.link && proj.link.trim()) ? proj.link.trim() : '';
          const linkWidth = linkText ? measureTextWidth(linkText, 8.5, fontKey) : 0;
          const nameTechWidth = measureTextWidth(nameTech, projFontSize, fontKey);
          const maxProjLeftWidth = linkWidth > 0 ? contentWidth - linkWidth - 12 : contentWidth;

          if (nameTechWidth <= maxProjLeftWidth && linkText) {
            // Fits cleanly with right-aligned link
            doc.drawText(projName, marginLeft, currentY + projFontSize, {
              fontSize: projFontSize,
              fontStyle: 'bold',
              color: [0.05, 0.05, 0.05]
            });
            if (techText) {
              const techStartX = marginLeft + measureTextWidth(projName, projFontSize, fontKey) + 6;
              doc.drawText(techText, techStartX, currentY + 9, {
                fontSize: 9,
                fontStyle: 'italic',
                color: [0.35, 0.4, 0.45]
              });
            }
            const linkX = A4_WIDTH - marginRight - linkWidth;
            doc.drawText(linkText, linkX, currentY + 8.5, {
              fontSize: 8.5,
              fontStyle: 'normal',
              color: [0.05, 0.35, 0.75]
            });
            doc.addLink(linkX, currentY, linkWidth, 10, linkText);
            currentY += projFontSize + 4;
          } else {
            // Draw name and tech, wrap link below if present
            doc.drawText(projName, marginLeft, currentY + projFontSize, {
              fontSize: projFontSize,
              fontStyle: 'bold',
              color: [0.05, 0.05, 0.05]
            });
            const afterNameX = marginLeft + measureTextWidth(projName, projFontSize, fontKey) + 6;
            if (techText) {
              const availableTechWidth = contentWidth - (afterNameX - marginLeft);
              if (measureTextWidth(techText, 9, fontKey) <= availableTechWidth) {
                doc.drawText(techText, afterNameX, currentY + 9, {
                  fontSize: 9,
                  fontStyle: 'italic',
                  color: [0.35, 0.4, 0.45]
                });
                currentY += projFontSize + 3;
              } else {
                currentY += projFontSize + 2;
                doc.drawText(techText, marginLeft + 10, currentY + 9, {
                  fontSize: 9,
                  fontStyle: 'italic',
                  color: [0.35, 0.4, 0.45]
                });
                currentY += 9 + 3;
              }
            } else {
              currentY += projFontSize + 3;
            }

            if (linkText) {
              ensureSpace(12);
              doc.drawText(linkText, marginLeft + 10, currentY + 8.5, {
                fontSize: 8.5,
                fontStyle: 'normal',
                color: [0.05, 0.35, 0.75]
              });
              doc.addLink(marginLeft + 10, currentY, linkWidth, 10, linkText);
              currentY += 8.5 + 4;
            }
          }

          // Bullets
          if (proj.bulletsText && proj.bulletsText.trim()) {
            const rawBullets = proj.bulletsText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
            const bulletIndent = 12;
            const bulletTextWidth = contentWidth - bulletIndent;

            for (let b = 0; b < rawBullets.length; b++) {
              const bulletText = rawBullets[b].trim().replace(/^[-*•]\s*/, '');
              if (!bulletText) continue;

              const bulletLines = splitTextToLines(bulletText, 9, bulletTextWidth, fontKey);
              for (let bl = 0; bl < bulletLines.length; bl++) {
                ensureSpace(13);
                if (bl === 0) {
                  doc.drawText('•', marginLeft + 2, currentY + 9, { fontSize: 9, fontStyle: 'bold', color: [0.3, 0.3, 0.3] });
                }
                doc.drawText(bulletLines[bl], marginLeft + bulletIndent, currentY + 9, {
                  fontSize: 9,
                  fontStyle: 'normal',
                  color: [0.15, 0.15, 0.15]
                });
                currentY += 12.5;
              }
            }
          }
          currentY += 4;
        }
        currentY += 4;
      }
    }

    // 6. Skills
    const skills = resumeData.skills || {};
    const skillEntries = [];
    if (typeof skills === 'object') {
      if (Array.isArray(skills.categories)) {
        for (const cat of skills.categories) {
          if (cat.name && cat.items) skillEntries.push({ label: cat.name, text: cat.items });
        }
      } else {
        // Standard categories
        if (skills.languages && skills.languages.trim()) skillEntries.push({ label: 'Technical Skills / Languages', text: skills.languages.trim() });
        if (skills.frameworks && skills.frameworks.trim()) skillEntries.push({ label: 'Frameworks & Libraries', text: skills.frameworks.trim() });
        if (skills.tools && skills.tools.trim()) skillEntries.push({ label: 'Tools & Platforms', text: skills.tools.trim() });
        if (skills.other && skills.other.trim()) skillEntries.push({ label: 'Core Competencies', text: skills.other.trim() });
      }
    }

    if (skillEntries.length > 0) {
      renderSectionHeader(resumeData.skillsTitle || 'Skills & Competencies');

      const skillFontSize = 9;
      for (let i = 0; i < skillEntries.length; i++) {
        const item = skillEntries[i];
        ensureSpace(14);

        const labelText = item.label + ':  ';
        const labelWidth = measureTextWidth(labelText, skillFontSize, fontKey);

        doc.drawText(labelText, marginLeft, currentY + skillFontSize, {
          fontSize: skillFontSize,
          fontStyle: 'bold',
          color: [0.1, 0.1, 0.1]
        });

        const remainingWidth = contentWidth - labelWidth;
        const skillLines = splitTextToLines(item.text, skillFontSize, remainingWidth, fontKey);

        for (let sl = 0; sl < skillLines.length; sl++) {
          if (sl > 0) {
            ensureSpace(13);
            currentY += 12.5;
          }
          const lineX = sl === 0 ? marginLeft + labelWidth : marginLeft + labelWidth;
          doc.drawText(skillLines[sl], lineX, currentY + skillFontSize, {
            fontSize: skillFontSize,
            fontStyle: 'normal',
            color: [0.2, 0.2, 0.2]
          });
        }
        currentY += skillFontSize + 4.5;
      }
    }

    return doc;
  }

  return {
    VectorPDFDocument,
    generateResumePDF,
    measureTextWidth,
    splitTextToLines,
    escapePdfText,
    sanitizeUrl
  };
});
