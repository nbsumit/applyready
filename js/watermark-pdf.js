/* Watermark PDF: the interface. The text is checked against what the standard PDF font can write
   before anything is drawn. The preview is page 1 made by the same function as the download
   (ApplyReadyPdf.addWatermark). Nothing leaves the browser. */
(function () {
  'use strict';
  const doc = document;
  const app = doc.getElementById('wmApp');
  if (!app) return;
  const K = window.ApplyReadyPdf, UI = window.ApplyReadyPdfUI, Files = window.ApplyReadyFiles, Kit = window.ApplyReadyFileKit;
  const $ = id => doc.getElementById(id);
  const els = {
    text: $('wmText'), textError: $('wmTextError'), quick: $('wmQuick'),
    layout: $('wmLayout'), size: $('wmSize'), angle: $('wmAngle'), color: $('wmColor'), opacity: $('wmOpacity'), opacityVal: $('wmOpacityVal'),
    previewBox: $('wmPreviewBox'), preview: $('wmPreview'), caption: $('wmPreviewCaption'),
    run: $('wmRun'), summary: $('wmSummary'),
    result: $('wmResult'), resultText: $('wmResultText'), download: $('wmDownload'),
    statPages: $('wmStatPages'), statText: $('wmStatText'), statSize: $('wmStatSize')
  };
  const urls = UI.urls();
  let previewUrl = null, previewTicket = 0, previewTimer = null, output = null;

  const tool = UI.singleTool(app, {
    needs: { lib: true, js: true },
    onOpen() { dropOutput(); update(); schedulePreview(0); },
    onClear() { dropOutput(); clearPreview(); update(); },
    onStale: dropOutput
  });
  const runner = UI.runner($('wmProgress'), { error: tool.error, button: els.run, busyLabel: 'Adding the watermark…' });

  function dropOutput() { if (output) { urls.revoke(output); output = null; } els.result.classList.add('hidden'); }
  function clearPreview() { previewTicket++; if (previewUrl) URL.revokeObjectURL(previewUrl); previewUrl = null; els.preview.removeAttribute('src'); els.previewBox.classList.add('hidden'); }

  const text = () => els.text.value.replace(/\s+/g, ' ').trim();

  /** Plain words for characters the standard font cannot write. */
  function textProblem() {
    const t = text();
    if (!t) return 'Type the watermark text, or pick one of the common ones below.';
    const bad = K.winAnsiProblems(t);
    if (bad.length) {
      const shown = bad.slice(0, 6).map(c => `"${c}"`).join(', ');
      return `${shown} cannot be written with the standard PDF font. Use letters A to Z (accents such as é are fine), digits and common punctuation.`;
    }
    return '';
  }

  function options() {
    return { text: text(), layout: els.layout.value, size: Number(els.size.value), angle: Number(els.angle.value), color: els.color.value, opacity: Number(els.opacity.value) / 100 };
  }

  function update() {
    const problem = textProblem();
    els.textError.textContent = problem;
    els.textError.hidden = !problem;
    if (problem) { els.text.setAttribute('aria-invalid', 'true'); els.text.setAttribute('aria-describedby', 'wmTextError wmTextHint'); }
    else { els.text.removeAttribute('aria-invalid'); els.text.setAttribute('aria-describedby', 'wmTextHint'); }
    els.quick.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', String(c.dataset.text === text())));
    els.opacityVal.textContent = `${els.opacity.value}%`;
    const state = tool.state;
    els.run.disabled = !state || !!problem;
    els.summary.classList.toggle('is-invalid', !!(state && problem));
    els.summary.textContent = !state ? '' : problem ? 'Fix the watermark text.' : `Stamps "${text()}" on ${UI.plural(state.pageCount, 'page')}.`;
    return !problem;
  }

  function changed() { tool.hideResult(); if (update()) schedulePreview(); }

  function schedulePreview(delay) {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(renderPreview, delay === undefined ? 250 : delay);
  }

  async function renderPreview() {
    const state = tool.state;
    if (!state || textProblem() || !state.jsDoc) return;
    const ticket = ++previewTicket;
    const o = options();
    let js = null;
    try {
      const one = await K.extract(state.libDoc, [0]);
      await K.addWatermark(one, o);
      const bytes = await K.save(one);
      if (ticket !== previewTicket) return;
      js = await K.openJs(bytes);
      const t = await K.thumbnail(js, 0, { width: 440 });
      if (ticket !== previewTicket) { URL.revokeObjectURL(t.url); return; }
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      previewUrl = t.url;
      els.preview.src = t.url;
      els.preview.width = t.width; els.preview.height = t.height;
      els.preview.alt = `Page 1 with the watermark "${o.text}"`;
      els.caption.textContent = `Preview of page 1 with "${o.text}".`;
      els.previewBox.classList.remove('hidden');
    } catch (e) {
      if (ticket === previewTicket) els.previewBox.classList.add('hidden');
    } finally { K.closeJs(js); }
  }

  els.quick.addEventListener('click', e => {
    const c = e.target.closest('.chip');
    if (!c) return;
    els.text.value = c.dataset.text;
    changed();
  });
  els.text.addEventListener('input', changed);
  [els.layout, els.size, els.angle, els.color].forEach(el => el.addEventListener('change', changed));
  els.opacity.addEventListener('input', changed);

  els.run.addEventListener('click', () => {
    const state = tool.state;
    if (!state || !update()) return;
    const o = options();
    runner.run(async (signal, progress) => {
      progress(0.05, 'Opening a fresh copy…');
      const fresh = await K.openLib(state.bytes, { password: state.encrypted ? state.password : undefined, name: state.file.name });
      await K.addWatermark(fresh, o, (d, n) => progress(0.1 + d / n * 0.6, `Stamping page ${d} of ${n}…`), signal);
      progress(0.75, 'Saving…');
      const bytes = await K.save(fresh);
      progress(0.9, 'Checking the new file…');
      await K.verify(bytes, { pages: state.pageCount });
      K.throwIfAborted(signal);
      dropOutput();
      output = urls.make(UI.pdfBlob(bytes));
      UI.setDownload(els.download, output, `${UI.stem(state.file.name)}-watermarked.pdf`);
      els.statPages.textContent = String(state.pageCount);
      els.statText.textContent = o.text;
      els.statSize.textContent = Files.formatBytes(bytes.length);
      els.resultText.textContent = `"${o.text}" on ${UI.plural(state.pageCount, 'page')}. The file was checked after saving.`;
      tool.showResult(els.download);
      Kit.announce(`Watermark added to ${UI.plural(state.pageCount, 'page')}.`);
      els.download.focus({ preventScroll: true });
      return true;
    });
  });

  Kit.guardUnload(() => runner.busy);
  update();
})();
