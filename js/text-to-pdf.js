/* Text to PDF (text-to-pdf.html): type, paste or open plain text and download a PDF.

   Interface only: layout, character checks and PDF writing live in js/lib/text-pdf.js (pdf-lib with
   the standard fonts). The text stays in this page; nothing is stored or sent. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const app = $('textPdfApp');
  const Files = window.ApplyReadyFiles, Kit = window.ApplyReadyFileKit, TP = window.ApplyReadyTextPdf, PDFLib = window.PDFLib;
  if (!app || !Files || !Kit || !TP) return;
  const ui = () => window.ApplyReadyUI || {};
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const group = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const MAX_CHARS = 5000000;
  const MAX_FILE = 5 * 1024 * 1024;
  const els = {};
  ['ttpBar', 'ttpBarText', 'ttpClear', 'ttpError', 'ttpChars', 'ttpCharsTitle', 'ttpCharsList', 'ttpCharsHelp', 'ttpReplace', 'ttpPrint', 'ttpRemove',
    'ttpUndoBox', 'ttpUndoText', 'ttpUndo', 'ttpResult', 'ttpResultTitle', 'ttpResultOk', 'ttpDownload', 'ttpEdit', 'ttpResPages', 'ttpResSize', 'ttpResPaper', 'ttpResFont',
    'ttpText', 'ttpCount', 'ttpTextError', 'ttpProgress', 'ttpProgressBar', 'ttpProgressText', 'ttpCancel', 'ttpPaper', 'ttpMargin', 'ttpNumbers', 'ttpFont', 'ttpSize',
    'ttpSpacing', 'ttpTitle', 'ttpCreate', 'ttpSummary'].forEach(id => { els[id.replace(/^ttp/, '').replace(/^./, c => c.toLowerCase())] = $(id); });

  const FONT_NAME = { helvetica: 'Helvetica', times: 'Times', courier: 'Courier' };
  const PAPER_NAME = { a4: 'A4 (210 \u00D7 297 mm)', letter: 'US Letter (8.5 \u00D7 11 in)' };
  let paper = 'a4';
  let fileName = '';
  let result = null;     // { blob, name, pages }
  let downloaded = true;  // nothing to lose yet
  let undoText = null;
  let unsupported = [];
  let busy = null;        // AbortController while a PDF is being made

  function showError(message) {
    els.error.querySelector('.notice__body').textContent = message || '';
    els.error.hidden = !message;
  }
  function fieldError(message) {
    els.textError.textContent = message || '';
    els.textError.hidden = !message;
    els.text.setAttribute('aria-invalid', String(!!message));
  }

  function options() {
    return {
      pageSize: paper, font: els.font.value, fontSize: Number(els.size.value) || 11, lineSpacing: Number(els.spacing.value) || 1.15,
      marginMm: Number(els.margin.value) || 20, title: els.title.value, pageNumbers: els.numbers.checked
    };
  }

  /* ---------------------------------------------------------------- live count and character check */
  const fontCache = new Map();
  async function fontsFor(name) {
    if (!fontCache.has(name)) {
      fontCache.set(name, (async () => {
        const doc = await PDFLib.PDFDocument.create();
        const pair = { helvetica: ['Helvetica', 'HelveticaBold'], times: ['TimesRoman', 'TimesRomanBold'], courier: ['Courier', 'CourierBold'] }[name] || ['Helvetica', 'HelveticaBold'];
        return { regular: await doc.embedFont(PDFLib.StandardFonts[pair[0]]), bold: await doc.embedFont(PDFLib.StandardFonts[pair[1]]) };
      })());
    }
    return fontCache.get(name);
  }

  let planToken = 0;
  let lastPlan = null;
  async function refresh() {
    const token = ++planToken;
    const text = els.text.value;
    const words = TP.words(text);
    const has = text.trim().length > 0;
    els.bar.hidden = !has;
    els.count.textContent = has ? `${group(words)} word${words === 1 ? '' : 's'} \u00B7 ${group(text.length)} characters` : '';
    if (text.length > MAX_CHARS) {
      els.summary.textContent = '';
      fieldError(`This text has ${group(text.length)} characters. The limit is ${group(MAX_CHARS)}, to keep your browser responsive. Split it into smaller parts.`);
      return;
    }
    if (els.textError.textContent && has) fieldError('');
    unsupported = TP.findUnsupported(text + '\n' + els.title.value);
    renderChars();
    if (!PDFLib) { els.summary.textContent = 'The PDF writer did not load. Reload the page to try again.'; return; }
    els.summary.textContent = has ? 'Counting pages\u2026' : 'Type or paste text to see the page count.';
    if (!has) { lastPlan = null; els.barText.textContent = ''; return; }
    try {
      const fonts = await fontsFor(els.font.value);
      if (token !== planToken) return;
      const plan = TP.layout(TP.removeUnsupported(text).text, options(), fonts);
      lastPlan = plan;
      const pages = plan.pageCount;
      const summary = `${group(pages)} page${pages === 1 ? '' : 's'} on ${paper === 'a4' ? 'A4' : 'US Letter'}, ${group(words)} word${words === 1 ? '' : 's'}`;
      els.summary.textContent = summary;
      els.barText.textContent = (fileName ? fileName + ' \u00B7 ' : '') + summary;
    } catch (e) {
      els.summary.textContent = 'The page count could not be worked out.';
    }
  }
  let timer = null;
  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(refresh, els.text.value.length > 200000 ? 700 : 200);
  }

  function renderChars() {
    if (!unsupported.length) { els.chars.hidden = true; return; }
    const total = unsupported.reduce((n, c) => n + c.count, 0);
    const replaceable = unsupported.filter(c => c.replacement);
    const rest = unsupported.filter(c => !c.replacement);
    els.charsTitle.textContent = `${group(total)} character${total === 1 ? '' : 's'} cannot be shown in the PDF fonts`;
    // Characters with a replacement are listed one by one; the rest are grouped by script (a Hindi
    // sentence is one line, not twenty).
    const lines = [];
    const groups = new Map();
    unsupported.forEach(c => {
      if (c.replacement) { lines.push({ single: c }); return; }
      let g = groups.get(c.name);
      if (!g) { g = { name: c.name, chars: [], count: 0 }; groups.set(c.name, g); lines.push({ group: g }); }
      g.chars.push(c); g.count += c.count;
    });
    const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
    const shown = lines.slice(0, 12);
    els.charsList.innerHTML = shown.map(l => {
      if (l.single) {
        const c = l.single;
        const glyph = /^\s$/.test(c.char) ? '\u2423' : c.char;
        return `<li><span class="ttp-char" aria-hidden="true">${esc(glyph)}</span><span>${esc(cap(c.name))} <span class="ttp-chars__meta">(${esc(c.code)}, ${c.count} time${c.count === 1 ? '' : 's'})</span> becomes <strong>${esc(c.replacement.trim() ? c.replacement : 'a space')}</strong></span></li>`;
      }
      const g = l.group;
      const sample = g.chars.slice(0, 8).map(c => c.char).join(' ');
      const codes = g.chars.length === 1 ? g.chars[0].code : `${g.chars.length} different characters`;
      return `<li><span class="ttp-char" aria-hidden="true">${esc(sample)}</span><span>${esc(cap(g.name))} <span class="ttp-chars__meta">(${esc(codes)}, ${g.count} in total)</span></span></li>`;
    }).join('') + (lines.length > shown.length ? `<li>and ${lines.length - shown.length} more kinds of character</li>` : '');
    const help = [];
    help.push('The standard PDF fonts cover English and Western European letters and common punctuation, but not Indian scripts, emoji or the rupee sign.');
    if (rest.length) help.push('For text in Hindi or another script, use Print or save as PDF: your browser then uses your device\u2019s fonts.');
    els.charsHelp.textContent = help.join(' ');
    const nRep = replaceable.reduce((n, c) => n + c.count, 0);
    els.replace.hidden = !nRep;
    els.replace.innerHTML = `<i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i> Replace ${group(nRep)} with plain characters`;
    const nRest = rest.reduce((n, c) => n + c.count, 0);
    els.remove.hidden = !nRest;
    els.remove.innerHTML = `<i class="fa-solid fa-eraser" aria-hidden="true"></i> Remove the other ${group(nRest)}`;
    els.chars.hidden = false;
  }

  function setText(value, note) {
    undoText = els.text.value;
    els.text.value = value;
    els.undoText.textContent = note;
    els.undoBox.hidden = false;
    textChanged();
    refresh();
  }
  els.replace.addEventListener('click', () => {
    const titleRep = TP.replaceCommon(els.title.value);
    els.title.value = titleRep.text;
    const rep = TP.replaceCommon(els.text.value);
    setText(rep.text, `Replaced ${group(rep.count + titleRep.count)} character${rep.count + titleRep.count === 1 ? '' : 's'}.`);
    Kit.announce(els.undoText.textContent);
    els.text.focus();
  });
  els.remove.addEventListener('click', async () => {
    const n = unsupported.filter(c => !c.replacement).reduce((s, c) => s + c.count, 0);
    if (ui().confirm) {
      const okay = await ui().confirm({ title: 'Remove these characters?', message: `${group(n)} character${n === 1 ? '' : 's'} will be deleted from your text, including any words written in other scripts. You can undo this straight after.`, confirmLabel: 'Remove them', danger: true });
      if (!okay) return;
    }
    const rep = TP.replaceCommon(els.text.value);
    const rem = TP.removeUnsupported(rep.text);
    els.title.value = TP.removeUnsupported(TP.replaceCommon(els.title.value).text).text;
    setText(rem.text, `Replaced ${group(rep.count)} and removed ${group(rem.count)} character${rem.count === 1 ? '' : 's'}.`);
    Kit.announce(els.undoText.textContent);
    els.text.focus();
  });
  els.undo.addEventListener('click', () => {
    if (undoText == null) return;
    els.text.value = undoText;
    undoText = null;
    els.undoBox.hidden = true;
    textChanged();
    refresh();
    Kit.announce('Change undone.');
    els.text.focus();
  });

  /* ---------------------------------------------------------------- print alternative */
  let printNode = null;
  els.print.addEventListener('click', () => {
    if (!printNode) {
      printNode = document.createElement('div');
      printNode.className = 'ttp-print';
      printNode.setAttribute('aria-hidden', 'true');
      document.body.appendChild(printNode);
    }
    const o = options();
    printNode.className = `ttp-print ttp-print--${o.font === 'times' ? 'serif' : o.font === 'courier' ? 'mono' : 'sans'}`;
    printNode.style.fontSize = o.fontSize + 'pt';
    printNode.textContent = '';
    if (o.title.trim()) { const t = document.createElement('p'); t.className = 'ttp-print__title'; t.textContent = o.title.trim(); printNode.appendChild(t); }
    const body = document.createElement('div');
    body.textContent = TP.normalize(els.text.value);
    printNode.appendChild(body);
    document.body.classList.add('ttp-printing');
    const done = () => { document.body.classList.remove('ttp-printing'); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    window.print();
    setTimeout(done, 1000);
  });

  /* ---------------------------------------------------------------- input */
  function textChanged() {
    if (result) hideResult();
    downloaded = !els.text.value.trim();
    fieldError(els.text.value.length > MAX_CHARS ? els.textError.textContent : '');
  }
  els.text.addEventListener('input', () => { els.undoBox.hidden = true; undoText = null; textChanged(); schedule(); });
  els.title.addEventListener('input', () => { if (result) hideResult(); schedule(); });
  [els.font, els.size, els.spacing, els.margin, els.numbers].forEach(el => el.addEventListener('change', () => { if (result) hideResult(); refresh(); }));
  els.paper.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
    paper = b.dataset.value;
    els.paper.querySelectorAll('button').forEach(x => { x.classList.toggle('active', x === b); x.setAttribute('aria-pressed', String(x === b)); });
    if (result) hideResult();
    refresh();
  }));
  els.clear.addEventListener('click', async () => {
    if (els.text.value.trim() && ui().confirm) {
      const okay = await ui().confirm({ title: 'Clear the text?', message: 'The text is removed from this page. It is not saved anywhere, so it cannot be brought back.', confirmLabel: 'Clear text', danger: true });
      if (!okay) return;
    }
    els.text.value = '';
    fileName = '';
    els.undoBox.hidden = true;
    textChanged();
    refresh();
    els.text.focus();
    Kit.announce('Text cleared.');
  });

  async function openFile(file) {
    showError('');
    if (!file) return;
    if (file.size === 0) { showError(`${file.name} is empty (0 bytes).`); return; }
    if (file.size > MAX_FILE) { showError(`${file.name} is ${Files.formatBytes(file.size)}. Text files up to 5 MB can be opened here.`); return; }
    const head = new Uint8Array(await file.slice(0, 4096).arrayBuffer());
    const info = Files.sniff(head);
    if (info.kind !== 'text') {
      showError(info.kind === 'unknown' ? `${file.name} is not a plain text file. Open a .txt file, or copy the text and paste it into the box.` : `${file.name} is a ${info.label}, not plain text. Copy its text and paste it into the box instead.`);
      return;
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    let text, note = '';
    if (info.encoding) text = new TextDecoder(info.encoding).decode(bytes);
    else {
      try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
      catch (e) { text = new TextDecoder('windows-1252').decode(bytes); note = 'This file was not saved as UTF-8, so it was read as Windows Western text. Check that accented letters look right.'; }
    }
    text = text.replace(/^\uFEFF/, '');
    if (els.text.value.trim() && ui().confirm) {
      const okay = await ui().confirm({ title: 'Replace the current text?', message: `The text in the box will be replaced by the contents of ${file.name}.`, confirmLabel: 'Replace text' });
      if (!okay) return;
    }
    els.text.value = text;
    fileName = file.name;
    els.undoBox.hidden = true;
    textChanged();
    await refresh();
    if (note) showError(note);
    Kit.announce(`Opened ${file.name}.`);
    els.text.focus();
    els.text.setSelectionRange(0, 0);
    els.text.scrollTop = 0;
  }
  Kit.dropzone($('ttpDrop'), { validate: false, multiple: false, onFiles: files => openFile(files[0]), onReject: m => showError(m.join(' ')) });

  /* ---------------------------------------------------------------- create */
  function hideResult() {
    els.result.hidden = true;
    result = null;
  }
  async function create() {
    showError('');
    const text = els.text.value;
    if (!text.trim()) { fieldError('Type or paste some text, or open a text file.'); els.text.focus(); return; }
    if (text.length > MAX_CHARS) { els.text.focus(); return; }
    if (!PDFLib) { showError('The PDF writer did not load. Check your connection and reload the page.'); return; }
    unsupported = TP.findUnsupported(text + '\n' + els.title.value);
    if (unsupported.length) {
      renderChars();
      showError('Some characters cannot be shown in the PDF fonts. Replace or remove them, or use Print or save as PDF, before creating the PDF.');
      els.chars.scrollIntoView({ block: 'nearest' });
      (els.replace.hidden ? els.print : els.replace).focus();
      return;
    }
    busy = new AbortController();
    Kit.setButtonBusy(els.create, true, 'Making the PDF\u2026');
    els.progress.hidden = false;
    els.progressBar.style.width = '0%';
    els.progressText.textContent = 'Making the PDF\u2026';
    try {
      const o = options();
      const out = await TP.build(PDFLib, text, o, {
        signal: busy.signal,
        onProgress: (done, total) => {
          const pct = Math.round(done / total * 100);
          els.progressBar.style.width = pct + '%';
          els.progressBar.parentElement.setAttribute('aria-valuenow', String(pct));
          els.progressText.textContent = `Page ${group(done)} of ${group(total)}\u2026`;
        }
      });
      // Verify: open the finished file again and count its pages.
      els.progressText.textContent = 'Checking the finished PDF\u2026';
      const check = await PDFLib.PDFDocument.load(out.bytes);
      const pages = check.getPageCount();
      if (pages !== out.pageCount) throw new Error(`The finished PDF has ${pages} pages instead of ${out.pageCount}, so it is not offered. Try again.`);
      const blob = new Blob([out.bytes], { type: 'application/pdf' });
      const base = o.title.trim() || (fileName ? Files.stem(fileName) : 'text');
      result = { blob, name: Files.withExtension(base.slice(0, 80), 'pdf'), pages };
      downloaded = false;
      els.resPages.textContent = `${group(pages)} (checked by opening the finished file)`;
      els.resSize.innerHTML = `${esc(Files.formatBytes(blob.size))}<span class="bytes">${group(blob.size)} bytes</span>`;
      els.resPaper.textContent = PAPER_NAME[o.pageSize] + `, ${o.marginMm} mm margins`;
      els.resFont.textContent = `${FONT_NAME[o.font]} ${o.fontSize} pt, line spacing ${els.spacing.options[els.spacing.selectedIndex].text.toLowerCase()}`;
      els.resultOk.textContent = `${group(pages)} page${pages === 1 ? '' : 's'}, ${Files.formatBytes(blob.size)}, searchable text.`;
      els.result.hidden = false;
      els.resultTitle.focus();
      Kit.announce(`Your PDF is ready: ${pages} page${pages === 1 ? '' : 's'}.`);
    } catch (e) {
      if (e && e.code === 'ABORTED') { Kit.announce('Cancelled. No PDF was made.'); }
      else showError((e && e.message) || 'The PDF could not be made.');
    } finally {
      busy = null;
      els.progress.hidden = true;
      Kit.setButtonBusy(els.create, false);
    }
  }
  els.create.addEventListener('click', create);
  els.cancel.addEventListener('click', () => { if (busy) busy.abort(); });
  els.download.addEventListener('click', () => {
    if (!result) return;
    Files.download(result.blob, result.name);
    downloaded = true;
    Kit.announce(`Downloading ${result.name}.`);
  });
  els.edit.addEventListener('click', () => { hideResult(); els.text.focus(); });
  Kit.guardUnload(() => !!els.text.value.trim() && !downloaded);

  refresh();
})();
