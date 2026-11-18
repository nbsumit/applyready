/* Resume builder: the References section and custom sections, in the Write step.

   References: referees (name, title or relationship, organisation, contact) or the single line
   "Available on request". Custom sections: any number (up to 20), each with its own heading and
   either entries (title, subtitle, date, bullet points) or a free text block. Both take part in
   section order and visibility (Style step) and print in the preview, PDF, Word and text files.
   The editor (js/resume.js) calls mount() once and render() whenever the resume changes. */
(function (root) {
  'use strict';
  const SCHEMA = () => root.ApplyReadySchema;
  const MAX_SECTIONS = 20;
  const MAX_REFERENCES = 20;
  let api = null;
  const openSections = new Set();
  const $ = id => document.getElementById(id);
  const notify = (message, error) => { if (root.ApplyReadyUI && root.ApplyReadyUI.notify) root.ApplyReadyUI.notify(message, !!error); };
  const data = () => api.getData();
  const t = value => (typeof value === 'string' ? value.trim() : '');
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

  function iconButton(act, attrs, label, icon, extra, disabled) {
    return `<button type="button" class="btn btn-sm btn-icon ${extra || 'btn-ghost'}" data-act="${act}" ${attrs} title="${label}" aria-label="${label}"${disabled ? ' disabled' : ''}><i aria-hidden="true" class="${icon}"></i></button>`;
  }
  function field(id, label, cls, value, placeholder, optional, attrs) {
    return `<div class="field">
      <label class="field-label" for="${id}">${label}${optional ? ' <span class="optional">(optional)</span>' : ''}</label>
      <input type="text" id="${id}" class="input ${cls}" placeholder="${placeholder}" value="${api.escapeHTML(value)}" ${attrs || ''}>
    </div>`;
  }
  function entryBox(index, count, title, fallback, noun, attrs, body) {
    const label = api.escapeHTML(t(title) || `${fallback} ${index + 1}`);
    return `<div class="dynamic-item entry entry--compact" role="group" aria-label="${noun} ${index + 1}" ${attrs}>
      <div class="entry__head dynamic-item-header">
        <span class="entry__num" aria-hidden="true">${index + 1}</span>
        <strong class="entry__title" data-fallback="${fallback} ${index + 1}">${label}</strong>
        <div class="dynamic-item-actions entry__actions">
          ${iconButton('up', attrs, `Move ${noun.toLowerCase()} ${index + 1} up`, 'fa-solid fa-arrow-up', '', index === 0)}
          ${iconButton('down', attrs, `Move ${noun.toLowerCase()} ${index + 1} down`, 'fa-solid fa-arrow-down', '', index === count - 1)}
          <span class="entry__sep" aria-hidden="true"></span>
          ${iconButton('remove', attrs, `Delete ${noun.toLowerCase()} ${index + 1}`, 'fa-regular fa-trash-can', 'btn-danger-ghost')}
        </div>
      </div>
      <div class="entry__body">${body}</div>
    </div>`;
  }

  /* ------------------------------------------------------------------ References */
  function renderReferences() {
    const d = data();
    const section = $('sec-references');
    if (!section) return;
    section.style.display = d.sectionVisibility.references ? 'block' : 'none';
    const toggle = $('refsOnRequest');
    if (toggle) toggle.checked = d.referencesOnRequest === true;
    const list = $('referencesList');
    const add = $('btnAddReference');
    const note = $('refsOnRequestNote');
    const onRequest = d.referencesOnRequest === true;
    if (note) note.hidden = !onRequest;
    if (list) {
      list.hidden = onRequest;
      const refs = d.references || [];
      list.innerHTML = refs.map((ref, i) => entryBox(i, refs.length, ref.name, 'Referee', 'Referee', `data-ref="${i}"`, `
        <div class="field-row">
          ${field(`ref-name-${ref.id}`, 'Name', 'ref-field', ref.name, 'e.g. Priya Nair', false, 'data-key="name" autocomplete="off"')}
          ${field(`ref-title-${ref.id}`, 'Job title or relationship', 'ref-field', ref.title, 'e.g. Team lead, my manager 2021 to 2023', true, 'data-key="title" autocomplete="off"')}
        </div>
        <div class="field-row">
          ${field(`ref-org-${ref.id}`, 'Organisation', 'ref-field', ref.organization, 'e.g. Example Logistics', true, 'data-key="organization" autocomplete="off"')}
          ${field(`ref-contact-${ref.id}`, 'Email or phone', 'ref-field', ref.contact, 'e.g. priya.nair@example.com', true, 'data-key="contact" autocomplete="off"')}
        </div>`)).join('');
    }
    if (add) { add.hidden = onRequest; add.disabled = (d.references || []).length >= MAX_REFERENCES; }
  }

  function onReferencesInput(e) {
    const box = e.target.closest('[data-ref]');
    const key = e.target.dataset.key;
    const ref = box && data().references[Number(box.dataset.ref)];
    if (!ref || !key || !(key in ref)) return;
    ref[key] = e.target.value;
    if (key === 'name') { const title = box.querySelector('.entry__title'); if (title) title.textContent = t(ref.name) || title.dataset.fallback; }
    api.scheduleRender();
  }

  function onReferencesClick(e) {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const box = btn.closest('[data-ref]');
    const refs = data().references;
    const i = Number(box && box.dataset.ref);
    if (!box || !refs[i]) return;
    api.pushHistory();
    if (btn.dataset.act === 'remove') {
      refs.splice(i, 1);
      structural();
      api.restoreRemoveFocus('referencesList', i, 'btnAddReference');
      return;
    }
    const j = btn.dataset.act === 'up' ? i - 1 : i + 1;
    if (j < 0 || j >= refs.length) return;
    [refs[i], refs[j]] = [refs[j], refs[i]];
    structural();
    focusAction('#referencesList', `[data-ref="${j}"]`, btn.dataset.act);
  }

  function addReference() {
    const d = data();
    if (d.references.length >= MAX_REFERENCES) { notify(`You can list up to ${MAX_REFERENCES} referees.`, true); return; }
    api.pushHistory();
    d.references.push({ id: api.newEntryId('ref'), name: '', title: '', organization: '', contact: '' });
    structural();
    api.focusNewEntry('referencesList');
  }

  /* ------------------------------------------------------------------ Custom sections */
  function customMeta(section) {
    if (section.mode === 'text') { const words = t(section.text) ? t(section.text).split(/\s+/).length : 0; return words ? plural(words, 'word', 'words') : ''; }
    const n = (section.entries || []).filter(e => t(e.title) || t(e.subtitle) || t(e.date) || t(e.bulletsText)).length;
    return n ? plural(n, 'entry', 'entries') : '';
  }

  function renderCustom() {
    const area = $('customSectionsArea');
    if (!area) return;
    const sections = data().customSections || [];
    // Keep each section folded or unfolded as the person left it (the header toggles the class).
    area.querySelectorAll('.custom-section').forEach(el => {
      const id = el.id.slice('sec-custom-'.length);
      if (el.classList.contains('open')) openSections.add(id); else openSections.delete(id);
    });
    area.innerHTML = sections.map((s, si) => {
      const id = s.id;
      const open = openSections.has(id);
      const heading = api.escapeHTML(t(s.title) || 'Custom section');
      const entries = s.entries || [];
      const body = s.mode === 'text'
        ? `<div class="field">
            <label class="field-label" for="cs-text-${id}">Text</label>
            <textarea id="cs-text-${id}" class="textarea cs-text" rows="5" placeholder="Write a short paragraph. Each new line starts a new paragraph.">${api.escapeHTML(s.text)}</textarea>
            <p class="field-hint">Use this for a short statement, interests or anything that is not a list.</p>
          </div>`
        : `<div class="entries" id="cs-list-${id}" data-empty="No entries yet.">${entries.map((entry, ei) => entryBox(ei, entries.length, entry.title, 'Entry', 'Entry', `data-entry="${ei}"`, `
              <div class="field-row">
                ${field(`ce-title-${entry.id}`, 'Title', 'ce-field', entry.title, 'e.g. Data Analysis course', false, 'data-key="title"')}
                ${field(`ce-sub-${entry.id}`, 'Organisation or place', 'ce-field', entry.subtitle, 'e.g. Coursera', true, 'data-key="subtitle"')}
              </div>
              ${field(`ce-date-${entry.id}`, 'Date', 'ce-field', entry.date, 'e.g. 2024', true, 'data-key="date"')}
              <div class="field">
                <label class="field-label" for="ce-bul-${entry.id}">Details <span class="optional">(optional)</span></label>
                <textarea id="ce-bul-${entry.id}" class="textarea ce-field" data-key="bulletsText" rows="3" placeholder="One bullet per line">${api.escapeHTML(entry.bulletsText)}</textarea>
              </div>`)).join('')}</div>
          <button type="button" class="btn btn-block add-entry" data-act="add-entry"><i class="fa-solid fa-plus" aria-hidden="true"></i> Add entry</button>`;
      return `<div class="accordion-section custom-section${open ? ' open' : ''}" id="sec-custom-${id}" data-section="${si}">
        <button type="button" class="accordion-header" aria-expanded="${open}" aria-controls="sec-content-custom-${id}">
          <span>${heading}</span><span class="accordion-meta" data-meta="custom:${id}"></span><i class="fa-solid fa-chevron-down chevron" aria-hidden="true"></i>
        </button>
        <div class="accordion-content" id="sec-content-custom-${id}">
          <div class="field">
            <label class="field-label" for="cs-title-${id}">Section heading</label>
            <input type="text" id="cs-title-${id}" class="input cs-title" maxlength="120" value="${api.escapeHTML(s.title)}" placeholder="e.g. Courses, Volunteer work, Interests" autocomplete="off">
          </div>
          <div class="field">
            <span class="field-label" id="cs-mode-label-${id}">Content</span>
            <div class="segmented" role="group" aria-labelledby="cs-mode-label-${id}">
              <button type="button" data-act="mode" data-mode="entries" aria-pressed="${s.mode !== 'text'}">Entries with bullet points</button>
              <button type="button" data-act="mode" data-mode="text" aria-pressed="${s.mode === 'text'}">Text block</button>
            </div>
          </div>
          ${body}
          <div class="cs-foot">
            <label class="switch switch--inline" for="cs-vis-${id}"><input type="checkbox" id="cs-vis-${id}" role="switch" class="cs-visible"${s.visible !== false ? ' checked' : ''}><span>Show on the resume</span></label>
            <button type="button" class="btn btn-sm btn-danger-ghost" data-act="delete-section"><i class="fa-regular fa-trash-can" aria-hidden="true"></i> Delete section</button>
          </div>
        </div>
      </div>`;
    }).join('');
  }

  const sectionAt = el => { const box = el.closest('[data-section]'); return box ? (data().customSections || [])[Number(box.dataset.section)] : null; };

  function onCustomInput(e) {
    const s = sectionAt(e.target);
    if (!s) return;
    const box = e.target.closest('[data-section]');
    if (e.target.classList.contains('cs-title')) {
      s.title = e.target.value.slice(0, 120);
      const span = box.querySelector('.accordion-header > span');
      if (span) span.textContent = t(s.title) || 'Custom section';
    } else if (e.target.classList.contains('cs-text')) {
      s.text = e.target.value;
    } else if (e.target.classList.contains('ce-field')) {
      const entryBox = e.target.closest('[data-entry]');
      const entry = entryBox && s.entries[Number(entryBox.dataset.entry)];
      const key = e.target.dataset.key;
      if (!entry || !(key in entry)) return;
      entry[key] = e.target.value;
      if (key === 'title') { const title = entryBox.querySelector('.entry__title'); if (title) title.textContent = t(entry.title) || title.dataset.fallback; }
    } else return;
    api.scheduleRender();
  }

  function onCustomChange(e) {
    if (!e.target.classList.contains('cs-visible')) { if (e.target.classList.contains('cs-title')) api.refreshOrder(); return; }
    const s = sectionAt(e.target);
    if (!s) return;
    api.pushHistory();
    s.visible = e.target.checked;
    api.render();
    api.refreshOrder();
  }

  async function onCustomClick(e) {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const s = sectionAt(btn);
    if (!s) return;
    const act = btn.dataset.act;
    if (act === 'delete-section') {
      const name = t(s.title) || 'this custom section';
      const ok = await api.confirm({ title: `Delete “${name}”?`, message: 'The section and everything in it are removed from this resume. You can undo this straight afterwards.', confirmLabel: 'Delete section', danger: true });
      if (!ok) return;
      api.pushHistory();
      const d = data();
      d.customSections = d.customSections.filter(x => x !== s);
      d.design.sectionOrder = SCHEMA().normalizeSectionOrder(d.design.sectionOrder, d);
      openSections.delete(s.id);
      structural();
      const add = $('btnAddOptionalSection');
      if (add) add.focus();
      return;
    }
    if (act === 'mode') {
      if ((btn.dataset.mode === 'text') === (s.mode === 'text')) return;
      api.pushHistory();
      s.mode = btn.dataset.mode === 'text' ? 'text' : 'entries';
      if (s.mode === 'entries' && !s.entries.length) s.entries.push(blankEntry());
      structural();
      const again = document.querySelector(`#sec-custom-${s.id} [data-act="mode"][data-mode="${s.mode}"]`);
      if (again) again.focus();
      return;
    }
    if (act === 'add-entry') {
      if (s.entries.length >= 150) { notify('A section can hold up to 150 entries.', true); return; }
      api.pushHistory();
      s.entries.push(blankEntry());
      structural();
      api.focusNewEntry(`cs-list-${s.id}`);
      return;
    }
    const entryEl = btn.closest('[data-entry]');
    const i = Number(entryEl && entryEl.dataset.entry);
    if (!entryEl || !s.entries[i]) return;
    api.pushHistory();
    if (act === 'remove') {
      s.entries.splice(i, 1);
      structural();
      api.restoreRemoveFocus(`cs-list-${s.id}`, i, `sec-custom-${s.id}`);
      if (!s.entries.length) { const add = document.querySelector(`#sec-custom-${s.id} [data-act="add-entry"]`); if (add) add.focus(); }
      return;
    }
    const j = act === 'up' ? i - 1 : i + 1;
    if (j < 0 || j >= s.entries.length) return;
    [s.entries[i], s.entries[j]] = [s.entries[j], s.entries[i]];
    structural();
    focusAction(`#cs-list-${s.id}`, `[data-entry="${j}"]`, act);
  }

  const blankEntry = () => ({ id: api.newEntryId('ce'), title: '', subtitle: '', date: '', bulletsText: '' });

  function addCustom() {
    const d = data();
    if ((d.customSections || []).length >= MAX_SECTIONS) { notify(`You can add up to ${MAX_SECTIONS} custom sections.`, true); return; }
    api.pushHistory();
    const id = api.newEntryId('cs');
    d.customSections.push({ id, title: '', mode: 'entries', visible: true, text: '', entries: [blankEntry()] });
    d.design.sectionOrder = SCHEMA().normalizeSectionOrder(d.design.sectionOrder, d);
    openSections.add(id);
    structural();
    setTimeout(() => {
      const input = $(`cs-title-${id}`);
      if (!input) return;
      input.focus({ preventScroll: true });
      input.scrollIntoView({ block: 'center', behavior: 'auto' });
    }, 0);
  }

  function addReferencesSection() {
    const d = data();
    api.pushHistory();
    d.sectionVisibility.references = true;
    if (!d.references.length && !d.referencesOnRequest) d.references.push({ id: api.newEntryId('ref'), name: '', title: '', organization: '', contact: '' });
    structural();
    const section = $('sec-references');
    api.openSection('sec-references');
    if (section) section.scrollIntoView({ block: 'center', behavior: 'auto' });
    const first = document.querySelector('#referencesList input, #refsOnRequest');
    if (first) first.focus({ preventScroll: true });
  }

  /* ------------------------------------------------------------------ Shared */
  function structural() {
    render();
    api.render();
    api.refreshOrder();
  }
  // After a move, focus stays in the moved entry (the other arrow once it reaches an end) and its
  // new position is announced.
  function focusAction(listSel, itemSel, act) {
    setTimeout(() => {
      const item = document.querySelector(`${listSel} ${itemSel}`);
      const other = act === 'up' ? 'down' : 'up';
      const btn = item && (item.querySelector(`button[data-act="${act}"]:not(:disabled)`) || item.querySelector(`button[data-act="${other}"]:not(:disabled)`) || item.querySelector('button:not(:disabled)'));
      if (btn) btn.focus();
      if (item && api.announce) {
        const items = Array.from(item.parentElement.children).filter(el => el.classList.contains('dynamic-item'));
        const noun = (item.getAttribute('aria-label') || 'Entry').replace(/\s+\d+$/, '');
        announce(`${noun} moved to position ${items.indexOf(item) + 1} of ${items.length}.`);
      }
    }, 0);
  }
  const announce = message => api.announce(message);

  function render() {
    if (!api) return;
    renderReferences();
    renderCustom();
  }

  function meta() {
    if (!api) return {};
    const d = data();
    const out = { references: d.referencesOnRequest ? 'Available on request' : ((n => (n ? plural(n, 'referee', 'referees') : ''))((d.references || []).filter(r => t(r.name)).length)) };
    (d.customSections || []).forEach(s => { out[`custom:${s.id}`] = customMeta(s); });
    return out;
  }

  function mount(editorApi) {
    api = editorApi;
    const refs = $('sec-references');
    if (refs) {
      refs.addEventListener('input', onReferencesInput);
      refs.addEventListener('click', onReferencesClick);
    }
    const toggle = $('refsOnRequest');
    if (toggle) toggle.addEventListener('change', () => { api.pushHistory(); data().referencesOnRequest = toggle.checked; structural(); toggle.focus(); });
    const addRef = $('btnAddReference');
    if (addRef) addRef.addEventListener('click', addReference);
    const area = $('customSectionsArea');
    if (area) {
      area.addEventListener('input', onCustomInput);
      area.addEventListener('change', onCustomChange);
      area.addEventListener('click', onCustomClick);
    }
  }

  function add(kind) {
    if (!api) return;
    if (kind === 'custom') addCustom();
    else if (kind === 'references') addReferencesSection();
  }

  root.ApplyReadyResumeSections = { mount, render, meta, add };
})(typeof window !== 'undefined' ? window : this);
