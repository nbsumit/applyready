/* ApplyReady site search: find a tool or guide by the words people actually type.

   Data: window.APPLYREADY_TOOL_INDEX (js/tool-index.js, generated from scripts/lib/tools.js).
   Matching runs locally and instantly; nothing is sent anywhere, so it also works offline.

   Two ways in:
     ApplyReadySearch.open()                 header button, "/" or Ctrl+K: a dialog
     <div data-search-inline></div>          the home page: an inline search box
   Both are WAI-ARIA comboboxes: arrow keys move through results, Enter opens, Escape closes. */
(function (root) {
  'use strict';

  /* ------------------------------------------------------------ Matching */
  // Words that mean the same thing to someone looking for a tool. Each group is expanded both ways.
  const SYNONYMS = [
    ['photo', 'image', 'picture', 'pic', 'photograph', 'jpg', 'jpeg', 'png', 'img'],
    ['compress', 'reduce', 'shrink', 'smaller', 'decrease', 'minimise', 'minimize', 'optimise', 'optimize', 'kb', 'mb'],
    ['resize', 'size', 'dimension', 'dimensions', 'pixel', 'pixels', 'scale', 'crop'],
    ['merge', 'combine', 'join', 'attach', 'add'],
    ['split', 'separate', 'extract', 'cut', 'divide'],
    ['resume', 'cv', 'biodata', 'curriculum'],
    ['signature', 'sign', 'autograph'],
    ['convert', 'change', 'converter', 'transform'],
    ['organise', 'organize', 'reorder', 'arrange', 'rotate', 'sort'],
    ['batch', 'bulk', 'multiple', 'many', 'all', 'mass'],
    ['cafe', 'cyber', 'operator', 'shop', 'centre', 'center'],
    ['text', 'txt', 'words']
  ];
  const SYN = new Map();
  SYNONYMS.forEach(group => group.forEach(w => SYN.set(w, group)));
  const STOP = new Set(['a', 'an', 'the', 'my', 'for', 'of', 'in', 'on', 'and', 'or', 'how', 'do', 'i', 'can', 'into', 'online', 'free', 'tool', 'tools', 'with', 'from', 'me', 'please', 'want', 'need', 'to']);

  const norm = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/(\d+)\s*(kb|mb|px|cm)\b/g, '$1$2').replace(/[^a-z0-9.\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const words = s => norm(s).split(' ').filter(Boolean);

  function editDistanceAtMost1(a, b) {
    if (a === b) return true;
    const la = a.length, lb = b.length;
    if (Math.abs(la - lb) > 1) return false;
    let i = 0, j = 0, edits = 0;
    while (i < la && j < lb) {
      if (a[i] === b[j]) { i++; j++; continue; }
      if (++edits > 1) return false;
      if (la > lb) i++; else if (lb > la) j++; else { i++; j++; }
    }
    return edits + (la - i) + (lb - j) <= 1;
  }

  // Prepared search fields per item, weighted: name > keywords > category > summary.
  function prepare(item) {
    if (item._f) return item._f;
    item._f = {
      name: words(item.name),
      nameText: norm(item.name),
      keys: (item.keywords || []).map(norm),
      keyWords: [...new Set((item.keywords || []).flatMap(words))],
      cat: words(item.categoryName || ''),
      summary: words(item.summary || '')
    };
    return item._f;
  }

  function tokenScore(f, token) {
    const variants = SYN.get(token) || [token];
    let best = 0;
    for (const v of variants) {
      const exact = v === token ? 1 : 0.7; // a synonym counts, a little less than the word itself
      if (f.name.includes(v)) best = Math.max(best, 10 * exact);
      else if (f.name.some(w => w.startsWith(v) && v.length >= 2)) best = Math.max(best, 7 * exact);
      if (f.keyWords.includes(v)) best = Math.max(best, 6 * exact);
      else if (f.keyWords.some(w => w.startsWith(v) && v.length >= 2)) best = Math.max(best, 4 * exact);
      if (f.cat.includes(v)) best = Math.max(best, 3 * exact);
      if (f.summary.includes(v)) best = Math.max(best, 2 * exact);
    }
    // Typing mistakes: one letter off in a word of four letters or more.
    if (!best && token.length >= 4) {
      if (f.name.some(w => w.length >= 4 && editDistanceAtMost1(w, token))) best = 5;
      else if (f.keyWords.some(w => w.length >= 4 && editDistanceAtMost1(w, token))) best = 3;
    }
    return best;
  }

  function score(item, query, tokens) {
    const f = prepare(item);
    let total = 0, matched = 0;
    for (const t of tokens) { const s = tokenScore(f, t); if (s) matched++; total += s; }
    if (!matched) return 0;
    // A phrase people type often ("passport size photo") is worth more than scattered words.
    if (f.nameText.includes(query)) total += 12;
    else if (f.keys.some(k => k === query)) total += 10;
    else if (f.keys.some(k => k.includes(query) || (query.includes(k) && k.length >= 4))) total += 6;
    if (matched < tokens.length) total *= matched / tokens.length * 0.6; // not every word matched
    // Tools first, then guides: someone typing "cv" wants the builder before an article about CVs.
    if (item.kind === 'tool') total *= item.directory === false ? 0.75 : 1.3;
    else if (item.kind === 'guide') total *= 0.75;
    return total;
  }

  function search(query, limit) {
    const index = root.APPLYREADY_TOOL_INDEX;
    if (!index) return [];
    const q = norm(query);
    if (!q) return [];
    const tokens = words(q).filter(w => !STOP.has(w));
    if (!tokens.length) return [];
    const ranked = index.items.map(item => ({ item, s: score(item, q, tokens) }))
      .filter(r => r.s >= 2)
      .sort((a, b) => b.s - a.s || a.item.name.localeCompare(b.item.name));
    // Drop the long tail: results far weaker than the best match are noise, not alternatives.
    const top = ranked.length ? ranked[0].s : 0;
    return ranked.filter(r => r.s >= top * 0.3).slice(0, limit || 8).map(r => r.item);
  }

  /* --------------------------------------------------- Recently used tools */
  const RECENT_KEY = 'applyready_recent_tools';
  function recentIds() {
    try { const v = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); return Array.isArray(v) ? v.filter(x => typeof x === 'string').slice(0, 6) : []; }
    catch (e) { return []; }
  }
  function itemsById(ids) {
    const index = root.APPLYREADY_TOOL_INDEX;
    if (!index) return [];
    return ids.map(id => index.items.find(i => i.id === id)).filter(Boolean);
  }
  function popular() {
    const index = root.APPLYREADY_TOOL_INDEX;
    if (!index) return [];
    return index.items.filter(i => i.kind === 'tool' && i.popular).sort((a, b) => a.popular - b.popular).slice(0, 6);
  }

  /* --------------------------------------------------------------- Widget */
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const hrefFor = p => '/' + p;
  let uid = 0;

  function createCombobox(host, options) {
    const opts = Object.assign({ inline: false, onClose: null, placeholder: 'Search tools, e.g. “compress photo” or “merge pdf”' }, options);
    const id = 'srch' + (++uid);
    host.innerHTML = `
      <div class="search-box">
        <i class="fa-solid fa-magnifying-glass search-box__icon" aria-hidden="true"></i>
        <input type="search" class="search-box__input" id="${id}-input" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="${id}-list" autocomplete="off" spellcheck="false" enterkeyhint="go" placeholder="${esc(opts.placeholder)}" aria-label="Search tools and guides">
        ${opts.inline ? '' : '<button type="button" class="btn btn-ghost btn-sm search-box__close" data-close>Close</button>'}
      </div>
      <div class="search-results" id="${id}-panel">
        <p class="search-results__label" id="${id}-label"></p>
        <ul class="search-results__list" id="${id}-list" role="listbox" aria-labelledby="${id}-label"></ul>
        <p class="search-results__empty" hidden></p>
      </div>
      <p class="sr-only" aria-live="polite" id="${id}-status"></p>`;
    const input = host.querySelector('input');
    const list = host.querySelector('ul');
    const label = host.querySelector('.search-results__label');
    const empty = host.querySelector('.search-results__empty');
    const status = host.querySelector(`#${id}-status`);
    const panel = host.querySelector('.search-results');
    let items = [];
    let active = -1;

    function render() {
      const q = input.value.trim();
      let heading = '';
      if (q) { items = search(q, 8); heading = items.length ? 'Results' : ''; }
      else {
        const recent = itemsById(recentIds());
        items = recent.length ? recent : popular();
        heading = recent.length ? 'Recently used' : 'Popular tools';
      }
      if (opts.inline && !q) { items = []; heading = ''; }
      label.textContent = heading;
      label.hidden = !heading;
      list.innerHTML = items.map((item, i) => `
        <li role="option" id="${id}-opt${i}" aria-selected="false" data-index="${i}">
          <a class="search-result" href="${esc(hrefFor(item.path))}" tabindex="-1">
            <i class="fa-solid fa-${esc(item.icon || 'arrow-right')} search-result__icon" aria-hidden="true"></i>
            <span class="search-result__text"><span class="search-result__name">${esc(item.name)}</span><span class="search-result__desc">${esc(item.summary || '')}</span></span>
            <span class="search-result__kind">${item.kind === 'tool' ? esc(item.categoryName || 'Tool') : item.kind === 'guide' ? 'Guide' : 'Page'}</span>
          </a>
        </li>`).join('');
      empty.hidden = !(q && !items.length);
      if (q && !items.length) {
        empty.innerHTML = `No tool matches “${esc(q)}”. Try fewer words, or <a href="/tools.html">browse all tools</a>.`;
      }
      const open = items.length > 0 || (q && !items.length);
      panel.hidden = opts.inline && !open;
      input.setAttribute('aria-expanded', String(items.length > 0));
      setActive(items.length && q ? 0 : -1);
      status.textContent = q ? (items.length ? `${items.length} result${items.length === 1 ? '' : 's'}` : 'No results') : '';
    }

    function setActive(i) {
      active = i;
      list.querySelectorAll('[role="option"]').forEach((li, n) => li.setAttribute('aria-selected', String(n === i)));
      if (i >= 0) {
        input.setAttribute('aria-activedescendant', `${id}-opt${i}`);
        const li = list.children[i];
        if (li && li.scrollIntoView) li.scrollIntoView({ block: 'nearest' });
      } else input.removeAttribute('aria-activedescendant');
    }

    input.addEventListener('input', render);
    input.addEventListener('focus', () => { if (!opts.inline || input.value) render(); });
    input.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') { e.preventDefault(); if (items.length) setActive((active + 1) % items.length); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); if (items.length) setActive((active - 1 + items.length) % items.length); }
      else if (e.key === 'Home' && e.ctrlKey) { e.preventDefault(); if (items.length) setActive(0); }
      else if (e.key === 'Enter') {
        const target = items[active >= 0 ? active : 0];
        if (target) { e.preventDefault(); location.href = hrefFor(target.path); }
      } else if (e.key === 'Escape') {
        if (opts.inline) { if (input.value) { input.value = ''; render(); } else panel.hidden = true; }
        else if (opts.onClose) { e.preventDefault(); opts.onClose(); }
      }
    });
    list.addEventListener('mousemove', e => { const li = e.target.closest('[role="option"]'); if (li) setActive(Number(li.dataset.index)); });
    const close = host.querySelector('[data-close]');
    if (close && opts.onClose) close.addEventListener('click', opts.onClose);
    if (opts.inline) {
      panel.hidden = true;
      document.addEventListener('click', e => { if (!host.contains(e.target)) panel.hidden = true; });
    }
    render();
    return { input, render };
  }

  /* --------------------------------------------------------------- Dialog */
  let dialog = null;
  let opener = null;
  function open() {
    if (dialog) return;
    opener = document.activeElement;
    const regions = [document.querySelector('.site-header'), document.getElementById('mainContent'), document.querySelector('.site-footer')].filter(Boolean);
    const backdrop = document.createElement('div');
    backdrop.className = 'dialog-backdrop search-backdrop';
    backdrop.innerHTML = '<div class="dialog search-dialog" role="dialog" aria-modal="true" aria-label="Search tools and guides"></div>';
    const box = backdrop.firstElementChild;
    document.body.appendChild(backdrop);
    regions.forEach(el => { el.inert = true; });
    document.documentElement.classList.add('search-open');
    const close = () => {
      if (!dialog) return;
      regions.forEach(el => { el.inert = false; });
      document.documentElement.classList.remove('search-open');
      backdrop.remove();
      dialog = null;
      if (opener && opener.focus && document.contains(opener)) opener.focus();
    };
    const cb = createCombobox(box, { onClose: close });
    backdrop.addEventListener('mousedown', e => { if (e.target === backdrop) close(); });
    // Keep focus inside: the only focusable things are the field, results links and Close.
    box.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.preventDefault(); close(); return; }
      if (e.key !== 'Tab') return;
      const focusables = Array.from(box.querySelectorAll('input, button'));
      const i = focusables.indexOf(document.activeElement);
      e.preventDefault();
      focusables[(i + (e.shiftKey ? -1 : 1) + focusables.length) % focusables.length].focus();
    });
    dialog = { close };
    cb.input.focus();
  }

  function mountInline() {
    document.querySelectorAll('[data-search-inline]').forEach(host => {
      if (host.dataset.mounted) return;
      host.dataset.mounted = 'true';
      createCombobox(host, { inline: true, placeholder: host.dataset.placeholder || undefined });
    });
  }

  root.ApplyReadySearch = { open, search, recentIds, itemsById, popular, mountInline };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountInline);
  else mountInline();
})(typeof window !== 'undefined' ? window : this);
