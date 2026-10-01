/**
 * ApplyReady.in - Vector Text PDF Engine
 * Pure client-side PDF 1.4 Generator with true selectable/searchable text,
 * clickable hyperlinks, deliberate pagination, A4 & US Letter support,
 * and support for all 8 ATS-friendly resume templates.
 * Zero external dependencies. Compatible with browsers and Node.js.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ApplyReadyPDF = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // Standard Paper Dimensions in points (72 points per inch)
  const A4_WIDTH = 595.28;
  const A4_HEIGHT = 841.89;
  const LETTER_WIDTH = 612.00;
  const LETTER_HEIGHT = 792.00;

  // Standard PDF font advances, indexed by WinAnsi byte minus 32.
  // Normal, bold and italic have distinct widths; pagination must match the drawn font.
  const FONT_WIDTHS = {
    "Helvetica": [
      278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,
      1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,
      333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584,350,
      556,350,222,556,333,1000,556,556,333,1000,667,333,1000,350,611,350,350,222,222,333,333,350,556,1000,333,1000,500,333,944,350,500,667,
      278,333,556,556,556,556,260,556,333,737,370,556,584,333,737,333,400,584,333,333,333,556,537,278,333,333,365,556,834,834,834,611,
      667,667,667,667,667,667,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,
      556,556,556,556,556,556,889,500,556,556,556,556,278,278,278,278,556,556,556,556,556,556,556,584,611,556,556,556,556,500,556,500
    ],
    "Helvetica-Bold": [
      278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,
      975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,
      333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584,350,
      556,350,278,556,500,1000,556,556,333,1000,667,333,1000,350,611,350,350,278,278,500,500,350,556,1000,333,1000,556,333,944,350,500,667,
      278,333,556,556,556,556,280,556,333,737,370,556,584,333,737,333,400,584,333,333,333,611,556,278,333,333,365,556,834,834,834,611,
      722,722,722,722,722,722,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,
      556,556,556,556,556,556,889,556,556,556,556,556,278,278,278,278,611,611,611,611,611,611,611,584,611,611,611,611,611,556,611,556
    ],
    "Helvetica-Oblique": [
      278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,
      1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,
      333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584,350,
      556,350,222,556,333,1000,556,556,333,1000,667,333,1000,350,611,350,350,222,222,333,333,350,556,1000,333,1000,500,333,944,350,500,667,
      278,333,556,556,556,556,260,556,333,737,370,556,584,333,737,333,400,584,333,333,333,556,537,278,333,333,365,556,834,834,834,611,
      667,667,667,667,667,667,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,
      556,556,556,556,556,556,889,500,556,556,556,556,278,278,278,278,556,556,556,556,556,556,556,584,611,556,556,556,556,500,556,500
    ],
    "Times-Roman": [
      250,333,408,500,500,833,778,180,333,333,500,564,250,333,250,278,500,500,500,500,500,500,500,500,500,500,278,278,564,564,564,444,
      921,722,667,667,722,611,556,722,722,333,389,722,611,889,722,722,556,722,667,556,611,722,722,944,722,722,611,333,278,333,469,500,
      333,444,500,444,500,444,333,500,500,278,278,500,278,778,500,500,500,500,333,389,278,500,500,722,500,500,444,480,200,480,541,350,
      500,350,333,500,444,1000,500,500,333,1000,556,333,889,350,611,350,350,333,333,444,444,350,500,1000,333,980,389,333,722,350,444,722,
      250,333,500,500,500,500,200,500,333,760,276,500,564,333,760,333,400,564,300,300,333,500,453,250,333,300,310,500,750,750,750,444,
      722,722,722,722,722,722,889,667,611,611,611,611,333,333,333,333,722,722,722,722,722,722,722,564,722,722,722,722,722,722,556,500,
      444,444,444,444,444,444,667,444,444,444,444,444,278,278,278,278,500,500,500,500,500,500,500,564,500,500,500,500,500,500,500,500
    ],
    "Times-Bold": [
      250,333,555,500,500,1000,833,278,333,333,500,570,250,333,250,278,500,500,500,500,500,500,500,500,500,500,333,333,570,570,570,500,
      930,722,667,722,722,667,611,778,778,389,500,778,667,944,722,778,611,778,722,556,667,722,722,1000,722,722,667,333,278,333,581,500,
      333,500,556,444,556,444,333,500,556,278,333,556,278,833,556,500,556,556,444,389,333,556,500,722,500,500,444,394,220,394,520,350,
      500,350,333,500,500,1000,500,500,333,1000,556,333,1000,350,667,350,350,333,333,500,500,350,500,1000,333,1000,389,333,722,350,444,722,
      250,333,500,500,500,500,220,500,333,747,300,500,570,333,747,333,400,570,300,300,333,556,540,250,333,300,330,500,750,750,750,500,
      722,722,722,722,722,722,1000,722,667,667,667,667,389,389,389,389,722,722,778,778,778,778,778,570,778,722,722,722,722,722,611,556,
      500,500,500,500,500,500,722,444,444,444,444,444,278,278,278,278,500,556,500,500,500,500,500,570,500,556,556,556,556,500,556,500
    ],
    "Times-Italic": [
      250,333,420,500,500,833,778,214,333,333,500,675,250,333,250,278,500,500,500,500,500,500,500,500,500,500,333,333,675,675,675,500,
      920,611,611,667,722,611,611,722,722,333,444,667,556,833,667,722,611,722,611,500,556,722,611,833,611,556,556,389,278,389,422,500,
      333,500,500,444,500,444,278,500,500,278,278,444,278,722,500,500,500,500,389,389,278,500,444,667,444,444,389,400,275,400,541,350,
      500,350,333,500,556,889,500,500,333,1000,500,333,944,350,556,350,350,333,333,556,556,350,500,889,333,980,389,333,667,350,389,556,
      250,389,500,500,500,500,275,500,333,760,276,500,675,333,760,333,400,675,300,300,333,500,523,250,333,300,310,500,750,750,750,500,
      611,611,611,611,611,611,889,667,611,611,611,611,333,333,333,333,722,667,722,722,722,722,722,675,722,722,722,722,722,556,611,500,
      500,500,500,500,500,500,667,444,444,444,444,444,278,278,278,278,500,500,500,500,500,500,500,675,500,500,500,500,500,444,500,444
    ],
  };

  function measureTextWidth(text, fontSize, fontKey, style = 'normal') {
    if (!text) return 0;
    const sans = /Helvetica|sans/i.test(fontKey || '');
    const variant = style === 'bold' ? (sans ? 'Helvetica-Bold' : 'Times-Bold') : style === 'italic' ? (sans ? 'Helvetica-Oblique' : 'Times-Italic') : (sans ? 'Helvetica' : 'Times-Roman');
    const widths = FONT_WIDTHS[variant];
    let units = 0;
    for (const char of String(text)) {
      let code = char.codePointAt(0);
      if (WINANSI_SPECIAL[code]) code = parseInt(WINANSI_SPECIAL[code].slice(1), 8);
      if (/\s/.test(char)) code = 32;
      units += widths[code - 32] || 500;
    }
    return units * fontSize / 1000;
  }

  /**
   * Break a word that exceeds maxWidth into sub-chunks that fit within maxWidth
   */
  function breakLongWord(word, fontSize, maxWidth, fontKey, style = 'normal') {
    if (!word) return [];
    const chunks = [];
    let currentChunk = '';
    for (let i = 0; i < word.length; i++) {
      const testChunk = currentChunk + word[i];
      if (measureTextWidth(testChunk, fontSize, fontKey, style) <= maxWidth) {
        currentChunk = testChunk;
      } else {
        if (currentChunk) chunks.push(currentChunk);
        currentChunk = word[i];
      }
    }
    if (currentChunk) chunks.push(currentChunk);
    return chunks.length > 0 ? chunks : [word];
  }

  /**
   * Split string into lines that fit within maxWidth points, handling long unbroken tokens safely
   */
  function splitTextToLines(text, fontSize, maxWidth, fontKey, style = 'normal') {
    if (!text) return [];
    const paragraphs = String(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    const resultLines = [];

    for (let p = 0; p < paragraphs.length; p++) {
      const paragraph = paragraphs[p].trim();
      if (!paragraph) {
        continue;
      }
      const words = paragraph.split(/\s+/);
      let currentLine = '';

      for (let w = 0; w < words.length; w++) {
        const word = words[w];
        const wordWidth = measureTextWidth(word, fontSize, fontKey, style);

        if (wordWidth > maxWidth) {
          // If currentLine is non-empty, flush it
          if (currentLine) {
            resultLines.push(currentLine);
            currentLine = '';
          }
          const wordChunks = breakLongWord(word, fontSize, maxWidth, fontKey, style);
          for (let c = 0; c < wordChunks.length - 1; c++) {
            resultLines.push(wordChunks[c]);
          }
          currentLine = wordChunks[wordChunks.length - 1];
          continue;
        }

        if (!currentLine) {
          currentLine = word;
        } else {
          const testLine = currentLine + ' ' + word;
          const width = measureTextWidth(testLine, fontSize, fontKey, style);
          if (width <= maxWidth) {
            currentLine = testLine;
          } else {
            resultLines.push(currentLine);
            currentLine = word;
          }
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

  /**
   * Escape text for PDF literal strings with true WinAnsi encoding and Unicode preservation
   */
  function escapePdfText(text) {
    if (text === null || text === undefined) return '';
    let str = String(text);

    let result = '';
    for (let i = 0; i < str.length; i++) {
      const char = str[i];
      const code = char.charCodeAt(0);

      if (char === '\\') {
        result += '\\\\';
      } else if (char === '(') {
        result += '\\(';
      } else if (char === ')') {
        result += '\\)';
      } else if (code >= 32 && code <= 126) {
        result += char;
      } else if (WINANSI_SPECIAL[code]) {
        result += WINANSI_SPECIAL[code];
      } else if (code >= 160 && code <= 255) {
        result += '\\' + code.toString(8).padStart(3, '0');
      } else if (/\s/.test(char)) {
        result += ' ';
      } else {
        const error = new Error('This text requires a Unicode font. Use Browser Print or Word to preserve it.');
        error.code = 'UNSUPPORTED_PDF_TEXT';
        throw error;
      }
    }
    return result;
  }

  function sanitizeUrl(raw) {
    if (!raw || /[\u0000-\u001f]/.test(String(raw))) return '';
    const clean = String(raw).trim();
    try {
      const url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(clean) ? clean : 'https://' + clean);
      return ['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol) ? url.href : '';
    } catch (e) { return ''; }
  }

  /**
   * Low-Level Vector PDF Document Builder
   */
  class VectorPDFDocument {
    constructor(options = {}) {
      this.fontFamily = options.fontFamily === 'sans' ? 'sans' : 'serif';
      const isLetter = (options.pageSize || '').toLowerCase() === 'letter';
      this.pageWidth = options.pageWidth || (isLetter ? LETTER_WIDTH : A4_WIDTH);
      this.pageHeight = options.pageHeight || (isLetter ? LETTER_HEIGHT : A4_HEIGHT);
      this.pages = [];
      this.currentPage = null;
      this.objects = [];
      this.addPage();
    }

    addPage() {
      const page = {
        width: this.pageWidth,
        height: this.pageHeight,
        commands: [],
        elements: [],
        annotations: []
      };
      this.pages.push(page);
      this.currentPage = page;
      return page;
    }

    getPageCount() {
      return this.pages.length;
    }

    toPdfY(topY) {
      return this.pageHeight - topY;
    }

    drawText(text, x, topY, options = {}) {
      if (!text) return;
      const fontSize = options.fontSize || 10;
      const fontStyle = options.fontStyle || 'normal';
      const color = options.color || [0, 0, 0];
      const fontKey = this.getFontResource(fontStyle);

      const pdfY = this.toPdfY(topY);
      const escaped = escapePdfText(text);

      const r = (color[0] || 0).toFixed(3);
      const g = (color[1] || 0).toFixed(3);
      const b = (color[2] || 0).toFixed(3);

      const cmd = `BT /${fontKey} ${fontSize} Tf ${r} ${g} ${b} rg 1 0 0 1 ${x.toFixed(2)} ${pdfY.toFixed(2)} Tm (${escaped}) Tj ET\n`;
      this.currentPage.commands.push(cmd);
      this.currentPage.elements.push({ type: 'text', text, x, y: topY, fontSize, fontStyle, color, width: measureTextWidth(text, fontSize, this.fontFamily === 'sans' ? 'Helvetica' : 'Times', fontStyle) });
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
      this.currentPage.elements.push({ type: 'line', x1, y1: topY1, x2, y2: topY2, lineWidth, color });
    }

    addLink(x, topY, width, height, url) {
      const safe = sanitizeUrl(url);
      if (!safe) return;
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

    build() {
      const objects = [];
      const offsets = [];

      function addObject(content) {
        const id = objects.length + 1;
        objects.push({ id, content });
        return id;
      }

      // 1. Catalog Object (id 1)
      const catalogId = addObject('<< /Type /Catalog /Pages 2 0 R >>');

      // 2. Pages Root Placeholder (id 2)
      const pagesRootId = addObject('');

      // Standard Font Objects
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

        const streamData = page.commands.join('');
        const streamObjId = addObject(
          `<< /Length ${streamData.length} >>\nstream\n${streamData}endstream`
        );

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
      pdfOutput += `xref\n0 ${objects.length + 1}\n`;
      pdfOutput += '0000000000 65535 f \n';

      for (let i = 0; i < offsets.length; i++) {
        pdfOutput += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
      }

      pdfOutput += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
      return pdfOutput;
    }

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
   * Supports all 8 ATS templates, A4 and Letter page sizes,
   * customizable section ordering, visibility, and density.
   */
  function generateResumePDF(resumeData, options = {}) {
    const pageSize = (options.pageSize || (resumeData.design && resumeData.design.pageSize) || 'a4').toLowerCase();
    const isLetter = pageSize === 'letter';
    const pageWidth = isLetter ? LETTER_WIDTH : A4_WIDTH;
    const pageHeight = isLetter ? LETTER_HEIGHT : A4_HEIGHT;

    const templateId = options.template || resumeData.template || 'classic-professional';

    // Determine font family
    let fontFamily = options.fontFamily || (resumeData.design && resumeData.design.fontFamily);
    if (!fontFamily) {
      fontFamily = (templateId === 'classic-professional' || templateId === 'experienced-professional' || templateId === 'academic-cv')
        ? 'serif'
        : 'sans';
    }
    const fontKey = fontFamily === 'sans' ? 'Helvetica' : 'Times';

    const density = options.density || (resumeData.design && resumeData.design.density) || (templateId === 'compact-professional' ? 'compact' : 'standard');
    const isCompact = density === 'compact';

    // Base font size configuration
    const fontSizeOpt = options.fontSize || (resumeData.design && resumeData.design.fontSize) || 'standard';
    let baseFontSize = 11;
    if (fontSizeOpt === 'comfortable') {
      baseFontSize = 12;
    } else if (fontSizeOpt === 'compact') {
      baseFontSize = 10;

    }

    const doc = new VectorPDFDocument({
      fontFamily,
      pageWidth,
      pageHeight,
      pageSize
    });

    const marginLeft = isCompact ? 32 : 38;
    const marginRight = isCompact ? 32 : 38;
    const marginTop = isCompact ? 30 : 36;
    const marginBottom = isCompact ? 30 : 36;
    const contentWidth = pageWidth - marginLeft - marginRight;
    const pageBottom = pageHeight - marginBottom;

    let currentY = marginTop;

    function ensureSpace(neededHeight) {
      if (currentY + neededHeight > pageBottom) {
        doc.addPage();
        currentY = marginTop;
        return true;
      }
      return false;
    }

    function drawWrapped(text, fontSize, style = 'normal', color = [0.15, 0.15, 0.15], align = 'left', url = '') {
      const lines = splitTextToLines(text, fontSize, contentWidth - 8, fontKey, style);
      for (const line of lines) {
        ensureSpace(fontSize + 4);
        const width = measureTextWidth(line, fontSize, fontKey, style);
        const x = align === 'center' ? marginLeft + Math.max(0, (contentWidth - width) / 2) : marginLeft;
        doc.drawText(line, x, currentY + fontSize, { fontSize, fontStyle: style, color });
        if (url) doc.addLink(x, currentY, width, fontSize + 2, url);
        currentY += fontSize + 4;
      }
    }
    function drawBullet(text, fontSize) {
      const lines = splitTextToLines(text, fontSize, contentWidth - 16, fontKey);
      lines.forEach((line, index) => {
        ensureSpace(fontSize + 4);
        if (index === 0) doc.drawText('•', marginLeft + 2, currentY + fontSize, { fontSize });
        doc.drawText(line, marginLeft + 12, currentY + fontSize, { fontSize });
        currentY += fontSize + 4;
      });
    }

    // Determine header alignment
    const headerAlign = (templateId === 'classic-professional' || templateId === 'experienced-professional' || templateId === 'academic-cv')
      ? 'center'
      : 'left';

    // 1. Header: Full Name
    const rawFullName = (resumeData.personal && resumeData.personal.fullName ? resumeData.personal.fullName : 'FULL NAME').trim();
    const fullName = rawFullName.toUpperCase();
    const nameFontSize = isCompact ? 16 : 18;
    drawWrapped(fullName, nameFontSize, 'bold', [0, 0, 0], headerAlign);
    currentY += 2;
    const targetTitle = (resumeData.personal && resumeData.personal.targetTitle ? resumeData.personal.targetTitle : '').trim();
    if (targetTitle) {
      drawWrapped(targetTitle, baseFontSize, 'italic', [0.2, 0.25, 0.32], headerAlign);
      currentY += 1;
    }

    // Contact Information Line
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
      const separator = '  •  ';
      const separatorWidth = measureTextWidth(separator, contactFontSize, fontKey);
      const rows = [];
      let row = [], rowWidth = 0;
      for (const item of contactParts) {
        for (const text of splitTextToLines(item.text, contactFontSize, contentWidth - 8, fontKey)) {
          const width = measureTextWidth(text, contactFontSize, fontKey);
          const needed = width + (row.length ? separatorWidth : 0);
          if (row.length && rowWidth + needed > contentWidth - 8) { rows.push({ items: row, width: rowWidth }); row = []; rowWidth = 0; }
          rowWidth += width + (row.length ? separatorWidth : 0);
          row.push({ ...item, text, width });
        }
      }
      if (row.length) rows.push({ items: row, width: rowWidth });
      for (const row of rows) {
        ensureSpace(contactFontSize + 4);
        let x = headerAlign === 'center' ? marginLeft + (contentWidth - row.width) / 2 : marginLeft;
        row.items.forEach((item, i) => {
          if (i) { doc.drawText(separator, x, currentY + contactFontSize, { fontSize: contactFontSize, color: [0.4, 0.45, 0.5] }); x += separatorWidth; }
          doc.drawText(item.text, x, currentY + contactFontSize, { fontSize: contactFontSize, color: item.url ? [0.05, 0.35, 0.75] : [0.15, 0.18, 0.22] });
          if (item.url) doc.addLink(x, currentY, item.width, contactFontSize + 2, item.url);
          x += item.width;
        });
        currentY += contactFontSize + 4;
      }
      currentY += 4;
    }

    // Top Header Divider
    if (templateId === 'experienced-professional') {
      doc.drawLine(marginLeft, currentY, pageWidth - marginRight, currentY, { lineWidth: 1.2, color: [0.1, 0.1, 0.1] });
      doc.drawLine(marginLeft, currentY + 2.5, pageWidth - marginRight, currentY + 2.5, { lineWidth: 0.5, color: [0.1, 0.1, 0.1] });
      currentY += 8;
    } else {
      doc.drawLine(marginLeft, currentY, pageWidth - marginRight, currentY, { lineWidth: 1.2, color: [0.1, 0.1, 0.1] });
      currentY += (isCompact ? 7 : 10);
    }

    /**
     * Render Section Header
     */
    function renderSectionHeader(title) {
      const headingFontSize = baseFontSize + 0.5;
      const headingLines = splitTextToLines(title.toUpperCase(), headingFontSize, contentWidth - 8, fontKey, 'bold');
      // Reserve the actual heading plus two body lines, not a fixed 65pt block.
      // Short final sections can then use the available space on this page.
      ensureSpace(headingLines.length * (headingFontSize + (isCompact ? 2 : 3)) + (isCompact ? 5 : 8) + 2 * (baseFontSize + 4));
      for (const line of headingLines) {
        ensureSpace(headingFontSize + 4);
        doc.drawText(line, marginLeft, currentY + headingFontSize, {
          fontSize: headingFontSize,
          fontStyle: 'bold',
          color: [0, 0, 0]
        });
        currentY += headingFontSize + (isCompact ? 2 : 3);
      }

      if (templateId !== 'modern-minimal') {
        doc.drawLine(marginLeft, currentY, pageWidth - marginRight, currentY, {
          lineWidth: 0.6,
          color: [0.65, 0.7, 0.75]
        });
      }
      currentY += (isCompact ? 5 : 8);
    }

    // Section Visibility & Order Setup
    const vis = resumeData.sectionVisibility || options.sectionVisibility || {
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
      : (options.sectionOrder || ['summary', 'experience', 'education', 'projects', 'skills', 'certifications', 'achievements', 'volunteering', 'languages', 'academic']);

    // --- SECTION RENDERERS ---

    function renderSummary() {
      const summary = (resumeData.summary || '').trim();
      if (!summary) return;

      renderSectionHeader(resumeData.summaryTitle || 'Professional Summary');
      const bodyFontSize = baseFontSize;
      const summaryLines = splitTextToLines(summary, bodyFontSize, contentWidth, fontKey);

      for (let l = 0; l < summaryLines.length; l++) {
        ensureSpace(bodyFontSize + 3.5);
        doc.drawText(summaryLines[l], marginLeft, currentY + bodyFontSize, {
          fontSize: bodyFontSize,
          fontStyle: 'normal',
          color: [0.1, 0.1, 0.1]
        });
        currentY += bodyFontSize + (isCompact ? 2.5 : 3.5);
      }
      currentY += (isCompact ? 4 : 6);
    }

    function renderExperience() {
      const experience = resumeData.experience || [];
      if (!Array.isArray(experience) || experience.length === 0) return;

      let hasExp = false;
      for (const exp of experience) {
        if (exp.role || exp.company || exp.bulletsText) {
          hasExp = true;
          break;
        }
      }
      if (!hasExp) return;

      renderSectionHeader(resumeData.experienceTitle || 'Work Experience');

      for (let i = 0; i < experience.length; i++) {
        const exp = experience[i];
        if (!exp.role && !exp.company && !exp.bulletsText) continue;

        ensureSpace(isCompact ? 20 : 28);

        const roleCompany = [exp.role, exp.company].filter(Boolean).join('  |  ');
        const roleFontSize = baseFontSize;
        const dateLoc = [exp.duration, exp.location].filter(Boolean).join('  •  ');
        const dateWidth = dateLoc ? measureTextWidth(dateLoc, isCompact ? 8.5 : 9, fontKey, 'italic') : 0;
        const roleWidth = measureTextWidth(roleCompany, roleFontSize, fontKey, 'bold');
        const maxLeftWidth = dateWidth > 0 ? contentWidth - dateWidth - 12 : contentWidth;

        if (roleWidth <= maxLeftWidth) {
          doc.drawText(roleCompany, marginLeft, currentY + roleFontSize, {
            fontSize: roleFontSize,
            fontStyle: 'bold',
            color: [0.05, 0.05, 0.05]
          });
          if (dateLoc) {
            const dateX = pageWidth - marginRight - dateWidth;
            doc.drawText(dateLoc, dateX, currentY + (isCompact ? 8.5 : 9), {
              fontSize: isCompact ? 8.5 : 9,
              fontStyle: 'italic',
              color: [0.35, 0.4, 0.45]
            });
          }
          currentY += roleFontSize + (isCompact ? 3 : 4);
        } else {
          const roleLines = splitTextToLines(roleCompany, roleFontSize, contentWidth - 8, fontKey, 'bold');
          for (let rl = 0; rl < roleLines.length; rl++) {
            if (rl > 0) ensureSpace(roleFontSize + 2);
            doc.drawText(roleLines[rl], marginLeft, currentY + roleFontSize, {
              fontSize: roleFontSize,
              fontStyle: 'bold',
              color: [0.05, 0.05, 0.05]
            });
            currentY += roleFontSize + 2;
          }
          if (dateLoc) {
            ensureSpace(12);
            drawWrapped(dateLoc, 9, 'italic', [0.35, 0.4, 0.45]);
          } else {
            currentY += 2;
          }
        }

        // Bullets
        if (exp.bulletsText && exp.bulletsText.trim()) {
          const rawBullets = exp.bulletsText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
          const bulletIndent = isCompact ? 10 : 12;
          const bulletTextWidth = contentWidth - bulletIndent;
          const bulletFontSize = baseFontSize;

          for (let b = 0; b < rawBullets.length; b++) {
            const bulletText = rawBullets[b].trim().replace(/^[-*•]\s*/, '');
            if (!bulletText) continue;

            const bulletLines = splitTextToLines(bulletText, bulletFontSize, bulletTextWidth, fontKey);
            for (let bl = 0; bl < bulletLines.length; bl++) {
              ensureSpace(baseFontSize + 4);
              if (bl === 0) {
                doc.drawText('•', marginLeft + 2, currentY + bulletFontSize, { fontSize: bulletFontSize, fontStyle: 'bold', color: [0.3, 0.3, 0.3] });
              }
              doc.drawText(bulletLines[bl], marginLeft + bulletIndent, currentY + bulletFontSize, {
                fontSize: bulletFontSize,
                fontStyle: 'normal',
                color: [0.15, 0.15, 0.15]
              });
              currentY += baseFontSize + (isCompact ? 3 : 4);
            }
          }
        }
        currentY += (isCompact ? 3 : 4);
      }
      currentY += (isCompact ? 2 : 4);
    }

    function renderEducation() {
      const education = resumeData.education || [];
      if (!Array.isArray(education) || education.length === 0) return;

      let hasEdu = false;
      for (const edu of education) {
        if (edu.degree || edu.institution) {
          hasEdu = true;
          break;
        }
      }
      if (!hasEdu) return;

      renderSectionHeader(resumeData.educationTitle || 'Education');

      for (let i = 0; i < education.length; i++) {
        const edu = education[i];
        if (!edu.degree && !edu.institution) continue;

        ensureSpace(isCompact ? 18 : 24);

        const degreeInst = [edu.degree, edu.institution].filter(Boolean).join('  —  ');
        const degFontSize = baseFontSize;
        const metaParts = [edu.duration, edu.location, edu.score].filter(Boolean).join('  •  ');
        const metaWidth = metaParts ? measureTextWidth(metaParts, isCompact ? 8.5 : 9, fontKey, 'italic') : 0;
        const degWidth = measureTextWidth(degreeInst, degFontSize, fontKey, 'bold');
        const maxDegWidth = metaWidth > 0 ? contentWidth - metaWidth - 12 : contentWidth;

        if (degWidth <= maxDegWidth) {
          doc.drawText(degreeInst, marginLeft, currentY + degFontSize, {
            fontSize: degFontSize,
            fontStyle: 'bold',
            color: [0.05, 0.05, 0.05]
          });
          if (metaParts) {
            const metaX = pageWidth - marginRight - metaWidth;
            doc.drawText(metaParts, metaX, currentY + (isCompact ? 8.5 : 9), {
              fontSize: isCompact ? 8.5 : 9,
              fontStyle: 'italic',
              color: [0.35, 0.4, 0.45]
            });
          }
          currentY += degFontSize + (isCompact ? 4 : 6);
        } else {
          const degLines = splitTextToLines(degreeInst, degFontSize, contentWidth - 8, fontKey, 'bold');
          for (let dl = 0; dl < degLines.length; dl++) {
            if (dl > 0) ensureSpace(degFontSize + 2);
            doc.drawText(degLines[dl], marginLeft, currentY + degFontSize, {
              fontSize: degFontSize,
              fontStyle: 'bold',
              color: [0.05, 0.05, 0.05]
            });
            currentY += degFontSize + 2;
          }
          if (metaParts) {
            ensureSpace(12);
            drawWrapped(metaParts, 9, 'italic', [0.35, 0.4, 0.45]);
          } else {
            currentY += 2;
          }
        }
        currentY += (isCompact ? 2 : 4);
      }
      currentY += (isCompact ? 2 : 4);
    }

    function renderProjects() {
      const projects = resumeData.projects || [];
      if (!Array.isArray(projects) || projects.length === 0) return;

      let hasProj = false;
      for (const proj of projects) {
        if (proj.name || proj.tech || proj.bulletsText) {
          hasProj = true;
          break;
        }
      }
      if (!hasProj) return;

      renderSectionHeader(resumeData.projectsTitle || 'Key Projects');

      for (let i = 0; i < projects.length; i++) {
        const proj = projects[i];
        if (!proj.name && !proj.tech && !proj.bulletsText) continue;

        ensureSpace(isCompact ? 20 : 28);

        const projName = proj.name || 'Project';
        const projFontSize = baseFontSize;
        const techText = (proj.tech || '').trim();
        const linkText = (proj.link || '').trim();
        const techFontSize = isCompact ? 8.5 : 9;
        const linkFontSize = 8.5;
        const nameWidth = measureTextWidth(projName, projFontSize, fontKey, 'bold');
        const techWidth = techText ? measureTextWidth('|  ' + techText, techFontSize, fontKey, 'italic') + 6 : 0;
        const linkWidth = measureTextWidth(linkText, linkFontSize, fontKey);
        const inlineWidth = nameWidth + techWidth + (linkText ? linkWidth + 12 : 0);
        if (inlineWidth <= contentWidth - 8) {
          doc.drawText(projName, marginLeft, currentY + projFontSize, { fontSize: projFontSize, fontStyle: 'bold', color: [0.05, 0.05, 0.05] });
          if (techText) doc.drawText('|  ' + techText, marginLeft + nameWidth + 6, currentY + techFontSize, { fontSize: techFontSize, fontStyle: 'italic', color: [0.35, 0.4, 0.45] });
          if (linkText) {
            const linkX = pageWidth - marginRight - linkWidth;
            doc.drawText(linkText, linkX, currentY + linkFontSize, { fontSize: linkFontSize, color: [0.05, 0.35, 0.75] });
            doc.addLink(linkX, currentY, linkWidth, linkFontSize + 2, linkText);
          }
          currentY += projFontSize + (isCompact ? 3 : 4);
        } else {
          drawWrapped(projName, projFontSize, 'bold', [0.05, 0.05, 0.05]);
          if (techText) drawWrapped(techText, techFontSize, 'italic', [0.35, 0.4, 0.45]);
          if (linkText) drawWrapped(linkText, linkFontSize, 'normal', [0.05, 0.35, 0.75], 'left', linkText);
        }

        // Bullets
        if (proj.bulletsText && proj.bulletsText.trim()) {
          const rawBullets = proj.bulletsText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
          const bulletIndent = isCompact ? 10 : 12;
          const bulletTextWidth = contentWidth - bulletIndent;
          const bulletFontSize = baseFontSize;

          for (let b = 0; b < rawBullets.length; b++) {
            const bulletText = rawBullets[b].trim().replace(/^[-*•]\s*/, '');
            if (!bulletText) continue;

            const bulletLines = splitTextToLines(bulletText, bulletFontSize, bulletTextWidth, fontKey);
            for (let bl = 0; bl < bulletLines.length; bl++) {
              ensureSpace(baseFontSize + 4);
              if (bl === 0) {
                doc.drawText('•', marginLeft + 2, currentY + bulletFontSize, { fontSize: bulletFontSize, fontStyle: 'bold', color: [0.3, 0.3, 0.3] });
              }
              doc.drawText(bulletLines[bl], marginLeft + bulletIndent, currentY + bulletFontSize, {
                fontSize: bulletFontSize,
                fontStyle: 'normal',
                color: [0.15, 0.15, 0.15]
              });
              currentY += baseFontSize + (isCompact ? 3 : 4);
            }
          }
        }
        currentY += (isCompact ? 3 : 4);
      }
      currentY += (isCompact ? 2 : 4);
    }

    function renderSkills() {
      const skills = resumeData.skills || {};
      const skillEntries = [];
      if (typeof skills === 'object') {
        if (Array.isArray(skills.categories)) {
          for (const cat of skills.categories) {
            if (cat.name && cat.items) skillEntries.push({ label: cat.name, text: cat.items });
          }
        } else {
          if (skills.languages && skills.languages.trim()) skillEntries.push({ label: 'Core Competencies', text: skills.languages.trim() });
          if (skills.frameworks && skills.frameworks.trim()) skillEntries.push({ label: 'Tools & Platforms', text: skills.frameworks.trim() });
          if (skills.tools && skills.tools.trim()) skillEntries.push({ label: 'Technical & Data Skills', text: skills.tools.trim() });
          if (skills.other && skills.other.trim()) skillEntries.push({ label: 'Professional Skills', text: skills.other.trim() });
        }
      }

      if (skillEntries.length === 0) return;

      renderSectionHeader(resumeData.skillsTitle || 'Skills & Competencies');

      const skillFontSize = baseFontSize;
      for (let i = 0; i < skillEntries.length; i++) {
        const item = skillEntries[i];
        ensureSpace(isCompact ? 12 : 14);

        const labelText = item.label + ':  ';
        const labelWidth = measureTextWidth(labelText, skillFontSize, fontKey, 'bold');

        if (labelWidth > contentWidth * 0.45) {
          drawWrapped(labelText, skillFontSize, 'bold');
          drawWrapped(item.text, skillFontSize);
          continue;
        }
        doc.drawText(labelText, marginLeft, currentY + skillFontSize, {
          fontSize: skillFontSize,
          fontStyle: 'bold',
          color: [0.1, 0.1, 0.1]
        });

        const remainingWidth = contentWidth - labelWidth - 8;
        const skillLines = splitTextToLines(item.text, skillFontSize, remainingWidth, fontKey);

        for (let sl = 0; sl < skillLines.length; sl++) {
          if (sl > 0) {
            currentY += baseFontSize + (isCompact ? 3 : 4);
            ensureSpace(baseFontSize + 4);
          }
          const lineX = marginLeft + labelWidth;
          doc.drawText(skillLines[sl], lineX, currentY + skillFontSize, {
            fontSize: skillFontSize,
            fontStyle: 'normal',
            color: [0.2, 0.2, 0.2]
          });
        }
        currentY += skillFontSize + (isCompact ? 3.5 : 4.5);
      }
    }

    function renderCertifications() {
      const certs = (resumeData.certifications || []).filter(c => c.name || c.title);
      if (!certs.length) return;
      renderSectionHeader('Certifications & Credentials');
      certs.forEach(c => drawBullet([c.name || c.title, c.issuer, c.year || c.date].filter(Boolean).join(' — '), baseFontSize));
    }
    function renderAchievements() {
      const texts = (resumeData.achievements || []).map(a => typeof a === 'string' ? a : a.title || a.text || '').filter(Boolean);
      if (!texts.length) return;
      renderSectionHeader('Honors & Achievements');
      texts.forEach(text => drawBullet(text, baseFontSize));
    }
    function renderVolunteering() {
      const texts = (resumeData.volunteering || []).map(v => [v.role, v.organization || v.org, v.duration].filter(Boolean).join(' — ')).filter(Boolean);
      if (!texts.length) return;
      renderSectionHeader('Community & Leadership');
      texts.forEach(text => drawBullet(text, baseFontSize));
    }
    function renderLanguages() {
      const texts = (resumeData.languages || []).map(l => typeof l === 'string' ? l : [l.name, l.proficiency].filter(Boolean).join(' — ')).filter(Boolean);
      if (!texts.length) return;
      renderSectionHeader('Languages');
      drawWrapped(texts.join('  •  '), baseFontSize);
    }
    function renderAcademic() {
      const acad = resumeData.academic || {};
      for (const [key, title] of [['publications', 'Peer-Reviewed Publications'], ['teaching', 'Teaching Experience'], ['presentations', 'Conference Presentations'], ['grants', 'Research Grants']]) {
        const texts = (acad[key] || []).map(item => typeof item === 'string' ? item : key === 'teaching'
          ? [item.role || item.course, item.institution, item.term].filter(Boolean).join(' — ')
          : key === 'grants' ? [item.title || item.name, item.funder, item.year].filter(Boolean).join(' — ') : item.title || item.citation || item.event || '').filter(Boolean);
        if (!texts.length) continue;
        renderSectionHeader(title);
        texts.forEach(text => drawBullet(text, baseFontSize));
      }
    }

    // Render sections in configured order
    for (const secKey of sectionOrder) {
      if (vis[secKey] === false) continue;
      if (secKey === 'summary') renderSummary();
      else if (secKey === 'experience') renderExperience();
      else if (secKey === 'education') renderEducation();
      else if (secKey === 'projects') renderProjects();
      else if (secKey === 'skills') renderSkills();
      else if (secKey === 'certifications') renderCertifications();
      else if (secKey === 'achievements') renderAchievements();
      else if (secKey === 'volunteering') renderVolunteering();
      else if (secKey === 'languages') renderLanguages();
      else if (secKey === 'academic') renderAcademic();
    }

    return doc;
  }

  /**
   * Plain-Text Resume Generator
   * Formats the resume cleanly for ATS text parsing and easy clipboard reuse.
   */
  function generateResumeText(resumeData, options = {}) {
    const lines = [];
    const p = resumeData.personal || {};

    const fullName = (p.fullName || 'RESUME').trim().toUpperCase();
    lines.push('='.repeat(72));
    lines.push(fullName);
    if (p.targetTitle && p.targetTitle.trim()) {
      lines.push(p.targetTitle.trim());
    }

    const contact = [p.email, p.phone, p.location, p.linkedin, p.github, p.website].filter(Boolean).map(s => s.trim()).filter(Boolean);
    if (contact.length > 0) {
      lines.push(contact.join(' | '));
    }
    lines.push('='.repeat(72));
    lines.push('');

    const vis = resumeData.sectionVisibility || {
      summary: true, experience: true, education: true, projects: true, skills: true,
      certifications: true, achievements: true, volunteering: true, languages: true, academic: true
    };

    const sectionOrder = (resumeData.design && Array.isArray(resumeData.design.sectionOrder))
      ? [...new Set([...resumeData.design.sectionOrder, 'summary', 'experience', 'education', 'projects', 'skills', 'certifications', 'achievements', 'volunteering', 'languages', 'academic'])]
      : ['summary', 'experience', 'education', 'projects', 'skills', 'certifications', 'achievements', 'volunteering', 'languages', 'academic'];

    function addHeader(title) {
      lines.push('');
      lines.push(title.toUpperCase());
      lines.push('-'.repeat(title.length));
    }

    for (const secKey of sectionOrder) {
      if (vis[secKey] === false) continue;

      if (secKey === 'summary' && resumeData.summary && resumeData.summary.trim()) {
        addHeader(resumeData.summaryTitle || 'Professional Summary');
        lines.push(resumeData.summary.trim());
      }

      if (secKey === 'experience' && Array.isArray(resumeData.experience) && resumeData.experience.length > 0) {
        addHeader(resumeData.experienceTitle || 'Work Experience');
        for (const exp of resumeData.experience) {
          const roleComp = [exp.role, exp.company].filter(Boolean).join(' | ');
          const dateLoc = [exp.duration, exp.location].filter(Boolean).join(' | ');
          if (roleComp) lines.push(roleComp);
          if (dateLoc) lines.push(dateLoc);
          if (exp.bulletsText && exp.bulletsText.trim()) {
            const rawBullets = exp.bulletsText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
            for (const b of rawBullets) {
              const cleaned = b.trim().replace(/^[-*•]\s*/, '');
              if (cleaned) lines.push(`* ${cleaned}`);
            }
          }
          lines.push('');
        }
      }

      if (secKey === 'education' && Array.isArray(resumeData.education) && resumeData.education.length > 0) {
        addHeader(resumeData.educationTitle || 'Education');
        for (const edu of resumeData.education) {
          const degInst = [edu.degree, edu.institution].filter(Boolean).join(' | ');
          const meta = [edu.duration, edu.location, edu.score].filter(Boolean).join(' | ');
          if (degInst) lines.push(degInst);
          if (meta) lines.push(meta);
          lines.push('');
        }
      }

      if (secKey === 'projects' && Array.isArray(resumeData.projects) && resumeData.projects.length > 0) {
        addHeader(resumeData.projectsTitle || 'Key Projects');
        for (const proj of resumeData.projects) {
          const header = [proj.name, proj.tech ? `[${proj.tech}]` : '', proj.link ? `(${proj.link})` : ''].filter(Boolean).join(' ');
          if (header) lines.push(header);
          if (proj.bulletsText && proj.bulletsText.trim()) {
            const rawBullets = proj.bulletsText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
            for (const b of rawBullets) {
              const cleaned = b.trim().replace(/^[-*•]\s*/, '');
              if (cleaned) lines.push(`* ${cleaned}`);
            }
          }
          lines.push('');
        }
      }

      if (secKey === 'skills' && resumeData.skills) {
        const s = resumeData.skills;
        const entries = [];
        if (s.languages && s.languages.trim()) entries.push(`Core Competencies: ${s.languages.trim()}`);
        if (s.frameworks && s.frameworks.trim()) entries.push(`Tools & Platforms: ${s.frameworks.trim()}`);
        if (s.tools && s.tools.trim()) entries.push(`Technical & Data Skills: ${s.tools.trim()}`);
        if (s.other && s.other.trim()) entries.push(`Professional Skills: ${s.other.trim()}`);

        if (entries.length > 0) {
          addHeader(resumeData.skillsTitle || 'Skills & Competencies');
          for (const ent of entries) lines.push(ent);
        }
      }

      if (secKey === 'certifications' && Array.isArray(resumeData.certifications) && resumeData.certifications.length > 0) {
        addHeader('Certifications & Credentials');
        for (const c of resumeData.certifications) {
          const line = `${c.name || c.title || ''}${c.issuer ? ' - ' + c.issuer : ''}${c.year ? ' (' + c.year + ')' : ''}`;
          if (line.trim()) lines.push(`* ${line.trim()}`);
        }
      }

      if (secKey === 'achievements' && Array.isArray(resumeData.achievements) && resumeData.achievements.length > 0) {
        addHeader('Honors & Achievements');
        for (const a of resumeData.achievements) {
          const text = typeof a === 'string' ? a : (a.title || a.text || '');
          if (text.trim()) lines.push(`* ${text.trim()}`);
        }
      }

      if (secKey === 'volunteering' && Array.isArray(resumeData.volunteering) && resumeData.volunteering.length > 0) {
        addHeader('Community & Leadership');
        for (const v of resumeData.volunteering) {
          const line = `${v.role || ''}${v.organization ? ', ' + v.organization : ''}${v.duration ? ' (' + v.duration + ')' : ''}`;
          if (line.trim()) lines.push(`* ${line.trim()}`);
        }
      }

      if (secKey === 'languages' && Array.isArray(resumeData.languages) && resumeData.languages.length > 0) {
        addHeader('Languages');
        const langStr = resumeData.languages.map(l => typeof l === 'string' ? l : [l.name, l.proficiency].filter(Boolean).join(' — ')).filter(Boolean).join(', ');
        if (langStr) lines.push(langStr);
      }

      if (secKey === 'academic' && resumeData.academic) {
        const acad = resumeData.academic;
        if (Array.isArray(acad.publications) && acad.publications.length > 0) {
          addHeader('Peer-Reviewed Publications');
          for (const pub of acad.publications) {
            const line = pub.title || pub.citation || '';
            if (line.trim()) lines.push(`* ${line.trim()}`);
          }
        }
        if (Array.isArray(acad.teaching) && acad.teaching.length > 0) {
          addHeader('Teaching Experience');
          for (const t of acad.teaching) {
            const line = `${t.role || t.course || ''}${t.institution ? ' — ' + t.institution : ''}${t.term ? ' (' + t.term + ')' : ''}`;
            if (line.trim()) lines.push(`* ${line.trim()}`);
          }
        }
        if (Array.isArray(acad.presentations) && acad.presentations.length > 0) {
          addHeader('Conference Presentations');
          for (const pr of acad.presentations) {
            const line = typeof pr === 'string' ? pr : (pr.title || pr.event || '');
            if (line.trim()) lines.push(`* ${line.trim()}`);
          }
        }
        if (Array.isArray(acad.grants) && acad.grants.length) {
          addHeader('Research Grants');
          for (const grant of acad.grants) {
            const text = typeof grant === 'string' ? grant : [grant.title || grant.name, grant.funder, grant.year].filter(Boolean).join(' — ');
            if (text) lines.push(`* ${text}`);
          }
        }
      }
    }

    return lines.join('\n');
  }

  return {
    VectorPDFDocument,
    generateResumePDF,
    generateResumeText,
    measureTextWidth,
    splitTextToLines,
    escapePdfText,
    sanitizeUrl,
    A4_WIDTH,
    A4_HEIGHT,
    LETTER_WIDTH,
    LETTER_HEIGHT
  };
});
