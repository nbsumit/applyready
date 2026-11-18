/* ApplyReady text to PDF: layout and PDF writing for plain text.

   Used by text-to-pdf.html (js/text-to-pdf.js) and tested in Node. The PDF uses the 14 standard PDF
   fonts (Helvetica, Times, Courier), which every PDF reader has, so nothing is embedded and files stay
   small. Those fonts can only show the Windows-1252 ("WinAnsi") character set: English letters,
   Western European accents and common punctuation. findUnsupported() lists every other character
   before export, so nothing is silently replaced by a wrong glyph.

   ApplyReadyTextPdf.normalize(text) -> text with newlines unified and invisible characters removed
   ApplyReadyTextPdf.findUnsupported(text) -> [{ char, code, count, name, replacement }]
   ApplyReadyTextPdf.replaceCommon(text) -> { text, count }
   ApplyReadyTextPdf.wrap(text, widthOf, maxWidth, tabSize) -> lines
   ApplyReadyTextPdf.plan(text, options, PDFLib) -> Promise<{ pageCount, lines, ... }>
   ApplyReadyTextPdf.build(PDFLib, text, options, { onProgress, signal }) -> Promise<{ bytes, pageCount }> */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ApplyReadyTextPdf = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Windows-1252 characters in 0x80-0x9F that the standard fonts can draw.
  const CP1252_EXTRA = new Set('\u20AC\u201A\u0192\u201E\u2026\u2020\u2021\u02C6\u2030\u0160\u2039\u0152\u017D\u2018\u2019\u201C\u201D\u2022\u2013\u2014\u02DC\u2122\u0161\u203A\u0153\u017E\u0178'.split(''));
  const isSupported = ch => {
    const c = ch.codePointAt(0);
    return c === 10 || (c >= 0x20 && c <= 0x7E) || (c >= 0xA0 && c <= 0xFF) || CP1252_EXTRA.has(ch);
  };

  // Common characters outside WinAnsi and a faithful plain replacement.
  const REPLACE = {
    '\u20B9': 'Rs.', '\u2010': '-', '\u2011': '-', '\u2012': '-', '\u2015': '\u2014', '\u2212': '-', '\u2043': '-', '\u2027': '-',
    '\u2032': "'", '\u2033': '"', '\u201B': "'", '\u201F': '"', '\u2002': ' ', '\u2003': ' ', '\u2004': ' ', '\u2005': ' ', '\u2006': ' ',
    '\u2007': ' ', '\u2008': ' ', '\u2009': ' ', '\u200A': ' ', '\u202F': ' ', '\u205F': ' ', '\u3000': ' ',
    '\u25CF': '\u2022', '\u25E6': '\u2022', '\u25AA': '\u2022', '\u25A0': '\u2022', '\u2219': '\u2022', '\u2023': '\u2022', '\u2192': '->', '\u2190': '<-',
    '\u2264': '<=', '\u2265': '>=', '\u2260': '!=', '\u2248': '~', '\uFB01': 'fi', '\uFB02': 'fl', '\uFB00': 'ff', '\uFB03': 'ffi', '\uFB04': 'ffl',
    '\u2713': 'Yes', '\u2714': 'Yes', '\u2717': 'No', '\u2718': 'No'
  };
  const NAMES = {
    '\u20B9': 'Indian rupee sign', '\u2010': 'hyphen', '\u2011': 'non-breaking hyphen', '\u2012': 'figure dash', '\u2015': 'horizontal bar', '\u2212': 'minus sign',
    '\u2032': 'prime', '\u2033': 'double prime', '\u25CF': 'black circle', '\u25E6': 'white bullet', '\u25AA': 'small square', '\u25A0': 'black square',
    '\u2192': 'right arrow', '\u2190': 'left arrow', '\u2264': 'less than or equal', '\u2265': 'greater than or equal', '\u2260': 'not equal',
    '\uFB01': 'fi ligature', '\uFB02': 'fl ligature', '\u2713': 'check mark', '\u2714': 'heavy check mark', '\u2717': 'ballot x', '\u2009': 'thin space', '\u202F': 'narrow no-break space'
  };

  function nameOf(ch) {
    if (NAMES[ch]) return NAMES[ch];
    const c = ch.codePointAt(0);
    if (c >= 0x0900 && c <= 0x097F) return 'Devanagari (Hindi, Marathi, Nepali)';
    if (c >= 0x0980 && c <= 0x09FF) return 'Bengali';
    if (c >= 0x0A00 && c <= 0x0A7F) return 'Gurmukhi (Punjabi)';
    if (c >= 0x0A80 && c <= 0x0AFF) return 'Gujarati';
    if (c >= 0x0B00 && c <= 0x0B7F) return 'Odia';
    if (c >= 0x0B80 && c <= 0x0BFF) return 'Tamil';
    if (c >= 0x0C00 && c <= 0x0C7F) return 'Telugu';
    if (c >= 0x0C80 && c <= 0x0CFF) return 'Kannada';
    if (c >= 0x0D00 && c <= 0x0D7F) return 'Malayalam';
    if (c >= 0x0600 && c <= 0x06FF) return 'Arabic or Urdu';
    if (c >= 0x0400 && c <= 0x04FF) return 'Cyrillic';
    if (c >= 0x0370 && c <= 0x03FF) return 'Greek';
    if ((c >= 0x4E00 && c <= 0x9FFF) || (c >= 0x3040 && c <= 0x30FF) || (c >= 0xAC00 && c <= 0xD7AF)) return 'Chinese, Japanese or Korean';
    if ((c >= 0x1F300 && c <= 0x1FAFF) || (c >= 0x2600 && c <= 0x27BF) || c === 0xFE0F || c === 0x200D) return 'emoji or symbol';
    if (c >= 0x0100 && c <= 0x024F) return 'accented Latin letter';
    return 'symbol';
  }

  /** A plain letter for an accented Latin letter outside WinAnsi (\u0101 -> a, \u015A -> S), or ''. */
  function plainLetter(ch) {
    const c = ch.codePointAt(0);
    if (c < 0x0100 || c > 0x024F) return '';
    const base = ch.normalize('NFD').replace(/[\u0300-\u036F]/g, '');
    return /^[A-Za-z]+$/.test(base) ? base : '';
  }

  /** Unify newlines, drop invisible characters (zero-width, soft hyphen, controls), keep tabs. */
  function normalize(text) {
    return String(text == null ? '' : text)
      .replace(/\r\n?/g, '\n').replace(/[\u2028\u2029]/g, '\n')
      .replace(/[\u200B\u200C\u2060\uFEFF\u00AD]/g, '')
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u0008\u000B-\u001F\u007F-\u009F]/g, '');
  }

  /** Characters the standard fonts cannot draw, in order of first appearance. Tabs are fine. */
  function findUnsupported(text) {
    const found = new Map();
    for (const ch of normalize(text).replace(/\t/g, ' ')) {
      if (isSupported(ch)) continue;
      const e = found.get(ch);
      if (e) e.count++;
      else found.set(ch, { char: ch, code: 'U+' + ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0'), count: 1, name: nameOf(ch), replacement: REPLACE[ch] != null ? REPLACE[ch] : plainLetter(ch) || null });
    }
    return Array.from(found.values());
  }

  /** Replace the characters that have a faithful plain equivalent. */
  function replaceCommon(text) {
    let count = 0;
    let out = '';
    for (const ch of String(text)) {
      if (!isSupported(ch) && ch !== '\t' && ch !== '\r') {
        const r = REPLACE[ch] != null ? REPLACE[ch] : plainLetter(ch);
        if (r) { out += r; count++; continue; }
      }
      out += ch;
    }
    return { text: out, count };
  }

  /** Remove every character the fonts cannot draw (the visitor asks for this explicitly). */
  function removeUnsupported(text) {
    let count = 0, out = '';
    for (const ch of String(text)) { if (isSupported(ch) || ch === '\t' || ch === '\r') out += ch; else count++; }
    return { text: out, count };
  }

  /** Expand tabs to the next multiple of tabSize characters. */
  function expandTabs(line, tabSize) {
    if (line.indexOf('\t') < 0) return line;
    let out = '';
    for (const ch of line) {
      if (ch === '\t') { const n = tabSize - (out.length % tabSize); out += ' '.repeat(n); } else out += ch;
    }
    return out;
  }

  /**
   * Word-wrap text into lines no wider than maxWidth. Blank lines are kept, runs of spaces inside a
   * line are kept, spaces at a break are dropped, and a word longer than a line is broken by characters.
   */
  function wrap(text, widthOf, maxWidth, tabSize) {
    const lines = [];
    const paragraphs = normalize(text).split('\n');
    for (const raw of paragraphs) {
      const para = expandTabs(raw, tabSize || 4);
      if (!para.trim()) { lines.push(''); continue; }
      const tokens = para.match(/ +|[^ ]+/g) || [];
      let line = '', lineW = 0, pending = '', pendingW = 0, hasWord = false;
      for (const tok of tokens) {
        if (tok[0] === ' ') {
          if (!hasWord) {
            // Leading indentation: keep it, but never wider than the line.
            const w = widthOf(tok);
            if (lineW + w <= maxWidth * 0.5) { line += tok; lineW += w; }
          } else { pending = tok; pendingW = widthOf(tok); }
          continue;
        }
        const w = widthOf(tok);
        if (hasWord && lineW + pendingW + w <= maxWidth) { line += pending + tok; lineW += pendingW + w; }
        else if (!hasWord && lineW + w <= maxWidth) { line += tok; lineW += w; hasWord = true; }
        else {
          if (hasWord) { lines.push(line); line = ''; lineW = 0; }
          else if (w <= maxWidth) { line = ''; lineW = 0; } // indentation does not fit with this word: drop it
          if (w <= maxWidth - lineW) { line += tok; lineW += w; }
          else {
            // Break a long word (a URL, a code) by characters.
            for (const ch of tok) {
              const cw = widthOf(ch);
              if (lineW + cw > maxWidth && line.trim()) { lines.push(line); line = ''; lineW = 0; }
              line += ch; lineW += cw;
            }
          }
          hasWord = true;
        }
        pending = ''; pendingW = 0;
      }
      lines.push(line);
    }
    return lines;
  }

  const MM = 72 / 25.4;
  const PAGE = { a4: [595.28, 841.89], letter: [612, 792] };
  const FONTS = {
    helvetica: ['Helvetica', 'HelveticaBold'],
    times: ['TimesRoman', 'TimesRomanBold'],
    courier: ['Courier', 'CourierBold']
  };
  const DEFAULTS = { pageSize: 'a4', font: 'helvetica', fontSize: 11, lineSpacing: 1.15, marginMm: 20, title: '', pageNumbers: true, tabSize: 4 };

  /** Width of a string from a per-character table: exactly what drawText renders (no kerning). */
  function measurer(font, size) {
    const cache = new Map();
    const charW = ch => { let w = cache.get(ch); if (w === undefined) { w = font.widthOfTextAtSize(ch, size); cache.set(ch, w); } return w; };
    return s => { let w = 0; for (const ch of s) w += charW(ch); return w; };
  }

  function geometry(o) {
    const [pw, ph] = PAGE[o.pageSize] || PAGE.a4;
    const margin = Math.max(5, Math.min(60, Number(o.marginMm) || 20)) * MM;
    const size = Math.max(6, Math.min(36, Number(o.fontSize) || 11));
    const lineHeight = size * 1.2 * (Number(o.lineSpacing) || 1.15);
    const titleSize = Math.round(size * 1.45 * 10) / 10;
    return { pw, ph, margin, size, lineHeight, titleSize, titleLineHeight: titleSize * 1.25, maxWidth: pw - 2 * margin, usable: ph - 2 * margin };
  }

  /** Lay the text out with real font metrics: which lines go on which page. */
  function layout(text, options, fonts) {
    const o = Object.assign({}, DEFAULTS, options || {});
    const g = geometry(o);
    const widthOf = measurer(fonts.regular, g.size);
    const lines = wrap(text, widthOf, g.maxWidth, o.tabSize);
    const title = normalize(o.title || '').replace(/[\n\t]+/g, ' ').trim();
    const titleLines = title ? wrap(title, measurer(fonts.bold, g.titleSize), g.maxWidth, 4) : [];
    const titleBlock = titleLines.length ? titleLines.length * g.titleLineHeight + g.lineHeight * 0.6 : 0;
    const perPage = Math.max(1, Math.floor((g.usable - g.size) / g.lineHeight) + 1);
    const perFirst = Math.max(1, Math.floor((g.usable - titleBlock - g.size) / g.lineHeight) + 1);
    // Drop trailing blank lines so an extra Enter at the end does not add a page.
    while (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
    const pages = [];
    let i = 0;
    pages.push([0, Math.min(lines.length, perFirst)]);
    i = pages[0][1];
    while (i < lines.length) { pages.push([i, Math.min(lines.length, i + perPage)]); i += perPage; }
    return { options: o, geometry: g, lines, titleLines, titleBlock, pages, pageCount: pages.length, perPage, perFirst };
  }

  async function loadFonts(doc, PDFLib, name) {
    const pair = FONTS[name] || FONTS.helvetica;
    return { regular: await doc.embedFont(PDFLib.StandardFonts[pair[0]]), bold: await doc.embedFont(PDFLib.StandardFonts[pair[1]]) };
  }

  /** Page count and lines for the live preview (no PDF is written). */
  async function plan(text, options, PDFLib) {
    const doc = await PDFLib.PDFDocument.create();
    const fonts = await loadFonts(doc, PDFLib, (options || {}).font);
    return layout(text, options, fonts);
  }

  const words = text => (normalize(text).match(/\S+/g) || []).length;

  /**
   * Write the PDF. Throws an Error with code 'UNSUPPORTED' when the text (or title) has characters the
   * fonts cannot draw, and 'ABORTED' when the signal is aborted.
   */
  async function build(PDFLib, text, options, hooks) {
    const h = hooks || {};
    const o = Object.assign({}, DEFAULTS, options || {});
    const bad = findUnsupported(text + '\n' + (o.title || ''));
    if (bad.length) { const e = new Error('Some characters cannot be shown with the standard PDF fonts.'); e.code = 'UNSUPPORTED'; e.characters = bad; throw e; }
    const doc = await PDFLib.PDFDocument.create();
    const fonts = await loadFonts(doc, PDFLib, o.font);
    const L = layout(text, o, fonts);
    const g = L.geometry;
    const grey = PDFLib.rgb(0.33, 0.33, 0.33);
    const ink = PDFLib.rgb(0.07, 0.07, 0.07);
    const footSize = Math.max(8, g.size - 2);
    for (let p = 0; p < L.pages.length; p++) {
      if (h.signal && h.signal.aborted) { const e = new Error('Cancelled'); e.code = 'ABORTED'; throw e; }
      const page = doc.addPage([g.pw, g.ph]);
      let y = g.ph - g.margin - g.size * 0.8;
      if (p === 0 && L.titleLines.length) {
        let ty = g.ph - g.margin - g.titleSize * 0.8;
        for (const t of L.titleLines) { page.drawText(t, { x: g.margin, y: ty, size: g.titleSize, font: fonts.bold, color: ink }); ty -= g.titleLineHeight; }
        y -= L.titleBlock;
      }
      const [from, to] = L.pages[p];
      for (let i = from; i < to; i++) {
        const line = L.lines[i];
        if (line && line.trim()) page.drawText(line, { x: g.margin, y, size: g.size, font: fonts.regular, color: ink });
        y -= g.lineHeight;
      }
      if (o.pageNumbers) {
        const label = `Page ${p + 1} of ${L.pages.length}`;
        const w = fonts.regular.widthOfTextAtSize(label, footSize);
        page.drawText(label, { x: (g.pw - w) / 2, y: Math.max(12, g.margin / 2 - footSize / 2), size: footSize, font: fonts.regular, color: grey });
      }
      if (h.onProgress && (p % 10 === 9 || p === L.pages.length - 1)) {
        h.onProgress(p + 1, L.pages.length);
        await new Promise(r => setTimeout(r, 0));
      }
    }
    const title = normalize(o.title || '').replace(/\s+/g, ' ').trim();
    if (title) doc.setTitle(title);
    doc.setCreator('ApplyReady Text to PDF');
    doc.setCreationDate(new Date());
    doc.setModificationDate(new Date());
    const bytes = await doc.save();
    return { bytes, pageCount: L.pages.length, lines: L.lines.length };
  }

  return { normalize, findUnsupported, replaceCommon, removeUnsupported, expandTabs, wrap, layout, plan, build, measurer, isSupported, words, DEFAULTS, PAGE };
});
