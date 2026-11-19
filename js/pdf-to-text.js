/* Extract text from PDF: the interface. Text is read page by page with pdf.js and joined into
   lines by position (ApplyReadyPdf.joinTextItems). Pages with no text are named: they are
   pictures, and ApplyReady does not do OCR. Nothing leaves the browser. */
(function () {
  'use strict';
  const doc = document;
  const app = doc.getElementById('textApp');
  if (!app) return;
  const K = window.ApplyReadyPdf, UI = window.ApplyReadyPdfUI, Files = window.ApplyReadyFiles, Kit = window.ApplyReadyFileKit;
  const $ = id => doc.getElementById(id);
  const els = {
    ranges: $('textRanges'), rangesError: $('textRangesError'), markers: $('textMarkers'),
    run: $('textRun'), summary: $('textSummary'),
    result: $('textResult'), resultTitle: $('textResultTitle'), resultText: $('textResultText'),
    out: $('textOut'), copy: $('textCopy'), download: $('textDownload'), empty: $('textEmpty'), emptyBody: $('textEmptyBody'),
    statPages: $('textStatPages'), statWith: $('textStatWithText'), statChars: $('textStatChars')
  };
  const urls = UI.urls();
  let current = null;

  const tool = UI.singleTool(app, {
    needs: { lib: false, js: true },
    maxPages: K.LIMITS.textPages,
    tooManyPages: n => `This PDF has ${K.grouped(n)} pages. Text can be read from up to ${K.grouped(K.LIMITS.textPages)} pages at a time. ${K.splitFirst(n, 'read each part')}`,
    onOpen() { els.ranges.value = ''; setError(''); clear(); update(); setTimeout(start, 0); },
    onClear() { clear(); els.ranges.value = ''; setError(''); update(); },
    onStale: () => {}
  });
  const runner = UI.runner($('textProgress'), { error: tool.error, button: els.run, busyLabel: 'Reading…' });

  function clear() { urls.revokeAll(); current = null; els.out.value = ''; els.result.classList.add('hidden'); }

  function setError(message) {
    els.rangesError.textContent = message || '';
    els.rangesError.hidden = !message;
    if (message) { els.ranges.setAttribute('aria-invalid', 'true'); els.ranges.setAttribute('aria-describedby', 'textRangesError textRangesHint'); }
    else { els.ranges.removeAttribute('aria-invalid'); els.ranges.setAttribute('aria-describedby', 'textRangesHint'); }
  }

  function pages(showErrors) {
    const state = tool.state;
    if (!state) return null;
    const text = els.ranges.value.trim();
    if (!text) { setError(''); return Array.from({ length: state.pageCount }, (_, i) => i); }
    const parsed = K.parseRanges(text, state.pageCount);
    if (!parsed.ok) { if (showErrors) setError(parsed.error); return null; }
    setError('');
    return Array.from(new Set(parsed.pages)).sort((a, b) => a - b);
  }

  function update(showErrors) {
    const list = pages(showErrors);
    els.run.disabled = !tool.state || !list;
    els.summary.textContent = !tool.state ? '' : list ? `Reads ${UI.plural(list.length, 'page')}.` : 'Fix the page list first.';
  }
  els.ranges.addEventListener('input', () => update());
  els.ranges.addEventListener('blur', () => update(true));
  els.markers.addEventListener('change', () => { if (current) show(current); });

  function compose(res) {
    const withMarkers = els.markers.checked;
    return res.pages.map(p => {
      if (!withMarkers) return p.text;
      const body = p.text || (p.failed ? '[This page could not be read. The PDF may be damaged here.]' : '[No text on this page. It is probably a scanned picture; ApplyReady does not read text from pictures.]');
      return `Page ${p.index + 1}\n\n${body}`;
    }).filter(s => s !== '').join(withMarkers ? '\n\n\n' : '\n\n');
  }

  function show(res) {
    const text = compose(res);
    els.out.value = text;
    urls.revokeAll();
    const url = urls.make(new Blob([text.replace(/\n/g, '\r\n')], { type: 'text/plain;charset=utf-8' }));
    els.download.href = url;
    els.download.setAttribute('download', `${UI.stem(tool.state.file.name)}.txt`);
    const empty = res.pages.filter(p => !p.text && !p.failed);
    const failed = res.pages.filter(p => p.failed);
    const withText = res.pages.length - empty.length - failed.length;
    let damage = '';
    els.statPages.textContent = String(res.pages.length);
    els.statWith.textContent = String(withText);
    els.statChars.textContent = res.pages.reduce((s, p) => s + p.text.length, 0).toLocaleString('en-IN');
    if (!withText) {
      els.resultTitle.textContent = empty.length ? 'No text found' : 'The text could not be read';
      els.resultText.textContent = empty.length
        ? 'None of these pages contains text. They are probably scans or photos, which are pictures of text.'
        : 'These pages could not be read. The PDF may be damaged; open it on your device to check it.';
    } else {
      els.resultTitle.textContent = 'Text extracted';
      // pdf.js reads Indian scripts glyph by glyph, in the order they are drawn: vowel signs (such as
      // ि), nasal marks (ं) and joined letters (क्ष), which fonts draw as shapes of their own, can come
      // out missing or in the wrong place.
      const indic = /[\u0900-\u0DFF]/.test(text);
      const dropped = res.dropped ? ` ${res.dropped === 1 ? 'One character' : `${res.dropped.toLocaleString('en-IN')} characters`} could not be read and ${res.dropped === 1 ? 'was' : 'were'} left out.` : '';
      const check = indic ? ' The text includes Hindi or another Indian script: vowel signs, nasal marks and joined letters often come out missing or out of place when text is read from a PDF, so check those words before you use them.' : '';
      // Pages read from a damaged file (openPdf's check) may have lost text: say which, as every
      // other PDF tool does in its result. Pages with no text at all are named below instead.
      damage = UI.damageNote(tool.state, res.pages.filter(p => p.text).map(p => p.index));
      els.resultText.textContent = `Text from ${UI.plural(withText, 'page')} is below. Check columns and tables before you paste.${dropped}${check}${damage ? ` ${damage}` : ''}`;
    }
    els.result.querySelector('.verdict > .fa-solid').className = withText && !damage ? 'fa-solid fa-check' : 'fa-solid fa-triangle-exclamation';
    els.result.classList.toggle('is-warning', !withText || !!damage);
    els.empty.classList.toggle('hidden', !empty.length && !failed.length);
    const notes = [];
    if (empty.length) notes.push(`${empty.length === 1 ? 'Page' : 'Pages'} ${K.formatRanges(empty.map(p => p.index))} ${empty.length === 1 ? 'has' : 'have'} no text: probably a scanned picture. ApplyReady does not read text from pictures (OCR). Use the original document, or type that text yourself.`);
    if (failed.length) notes.push(`${failed.length === 1 ? 'Page' : 'Pages'} ${K.formatRanges(failed.map(p => p.index))} could not be read; the PDF may be damaged there.`);
    els.emptyBody.textContent = notes.join(' ');
    els.copy.disabled = !text.trim() || !withText;
    els.download.classList.toggle('hidden', !withText);
  }

  async function start() {
    const list = pages(true);
    const state = tool.state;
    if (!state || !list) return;
    clear();
    const res = await runner.run(async (signal, progress) => {
      const out = [];
      const info = { dropped: 0 };
      for (let k = 0; k < list.length; k++) {
        K.throwIfAborted(signal);
        if (k % 5 === 0) progress(k / list.length, `Reading page ${list[k] + 1} (${k + 1} of ${list.length})…`);
        // A damaged page should not cost the text of every other page: note it and carry on.
        let text = '', failed = false;
        try { text = await K.pageText(state.jsDoc, list[k], info); }
        catch (e) { failed = true; }
        // A page whose content is damaged (openPdf's check) is not a scan: say it could not be read.
        if (!text && ((state.unreadable || []).includes(list[k]) || (state.incomplete || []).includes(list[k]))) failed = true;
        out.push({ index: list[k], text, failed });
        if (k % 10 === 9) await K.tick();
      }
      return { pages: out, dropped: info.dropped };
    });
    if (!res || tool.state !== state) return;
    current = res;
    show(res);
    tool.showResult();
    const withText = res.pages.filter(p => p.text).length;
    Kit.announce(withText ? `Text from ${UI.plural(withText, 'page')} is ready.` : 'No text found. The pages are probably scanned pictures.');
  }
  els.run.addEventListener('click', start);

  els.copy.addEventListener('click', async () => {
    const text = els.out.value;
    let done = false;
    try { if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); done = true; } } catch (e) { done = false; }
    if (!done) {
      els.out.focus();
      els.out.select();
      try { done = doc.execCommand('copy'); } catch (e) { done = false; }
    }
    const message = done ? 'Text copied. Paste it where you need it.' : 'The browser did not allow copying. The text is selected: press Ctrl+C (or long-press and Copy) to copy it.';
    if (window.ApplyReadyUI && window.ApplyReadyUI.notify) window.ApplyReadyUI.notify(message, !done);
    Kit.announce(message);
  });

  Kit.guardUnload(() => runner.busy);
})();
