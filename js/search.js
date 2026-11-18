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
  // Only true synonyms belong here: "add" is not "merge" (it pulled "Add page numbers" into every
  // merge search).
  const SYNONYMS = [
    ['photo', 'image', 'picture', 'pic', 'photograph', 'jpg', 'jpeg', 'png', 'img'],
    ['compress', 'reduce', 'shrink', 'smaller', 'decrease', 'minimise', 'minimize', 'optimise', 'optimize', 'kb', 'mb'],
    ['resize', 'size', 'dimension', 'dimensions', 'pixel', 'pixels', 'scale', 'crop'],
    ['merge', 'combine', 'join', 'attach'],
    ['split', 'separate', 'extract', 'cut', 'divide'],
    ['resume', 'cv', 'biodata', 'curriculum'],
    ['signature', 'sign', 'autograph'],
    ['convert', 'change', 'converter', 'transform'],
    ['organise', 'organize', 'reorder', 'arrange', 'rotate', 'sort'],
    ['batch', 'bulk', 'multiple', 'many', 'all', 'mass'],
    ['cafe', 'cyber', 'operator', 'shop', 'centre', 'center'],
    ['text', 'txt', 'words'],
    ['word', 'doc', 'docx']
  ];
  const SYN = new Map();
  SYNONYMS.forEach(group => group.forEach(w => SYN.set(w, group)));
  const STOP = new Set(['a', 'an', 'the', 'my', 'for', 'of', 'in', 'on', 'and', 'or', 'how', 'do', 'i', 'can', 'into', 'online', 'free', 'tool', 'tools', 'with', 'from', 'me', 'please', 'want', 'need', 'to']);
  // File formats. "word to pdf" or "pdf to jpg" asks for one direction, so only an item that names
  // that conversion matches; "pdf to jpg" must not offer Image to PDF, the opposite job.
  const FORMATS = new Set(['pdf', 'jpg', 'jpeg', 'png', 'webp', 'heic', 'gif', 'image', 'images', 'photo', 'photos', 'picture', 'pictures', 'pic', 'img', 'scan', 'scans', 'word', 'doc', 'docx', 'txt', 'text', 'excel', 'xls', 'xlsx', 'ppt', 'pptx', 'powerpoint', 'html', 'zip']);

  const norm = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/(\d+)\s*(kb|mb|px|cm)\b/g, '$1$2').replace(/[^a-z0-9.\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const words = s => norm(s).split(' ').filter(Boolean);

  // One typing mistake: a letter added, missing, changed, or two neighbours swapped ("mrege").
  function editDistanceAtMost1(a, b) {
    if (a === b) return true;
    const la = a.length, lb = b.length;
    if (Math.abs(la - lb) > 1) return false;
    if (la === lb) {
      let i = 0;
      while (i < la && a[i] === b[i]) i++;
      if (a.slice(i + 1) === b.slice(i + 1)) return true; // one letter changed
      return i + 1 < la && a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2); // swapped
    }
    const [s, l] = la < lb ? [a, b] : [b, a];
    let i = 0;
    while (i < s.length && s[i] === l[i]) i++;
    return s.slice(i) === l.slice(i + 1); // one letter added or missing
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

  // Every word the index knows (names, keywords, categories, synonyms), for correcting typos.
  let vocab = null;
  function vocabulary(items) {
    if (vocab && vocab.items === items) return vocab.words;
    const set = new Set(SYN.keys());
    items.forEach(item => { const f = prepare(item); [...f.name, ...f.keyWords, ...f.cat].forEach(w => set.add(w)); });
    vocab = { items, words: set };
    return set;
  }
  // A word nobody uses ("mrege", "resise") is read as the known words one typing mistake away.
  // Words still being typed ("merg") are left alone: they match as prefixes.
  function correct(token, known) {
    if (token.length < 4 || known.has(token) || /\d/.test(token)) return [token];
    for (const w of known) if (w.length > token.length && w.startsWith(token)) return [token];
    const near = [...known].filter(w => w.length >= 4 && editDistanceAtMost1(w, token));
    return near.length ? near : [token];
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
    return best;
  }

  // "word to pdf" -> ['word', 'pdf'] when both sides are file formats; null otherwise.
  function conversion(q) {
    const m = q.match(/(?:^|\s)([a-z]+) to ([a-z]+)(?:\s|$)/);
    return m && FORMATS.has(m[1]) && FORMATS.has(m[2]) && m[1] !== m[2] ? [m[1], m[2]] : null;
  }
  const forms = w => { const base = w.replace(/s$/, ''); return new Set([w, base, ...(SYN.get(w) || []), ...(SYN.get(base) || [])]); };
  function converts(f, from, to) {
    const a = forms(from), b = forms(to);
    return [f.nameText, ...f.keys].some(text => {
      const t = text.split(' ');
      for (let i = 0; i + 2 < t.length; i++) if (t[i + 1] === 'to' && (a.has(t[i]) || a.has(t[i].replace(/s$/, ''))) && (b.has(t[i + 2]) || b.has(t[i + 2].replace(/s$/, '')))) return true;
      return false;
    });
  }

  function score(item, query, tokenSets, convert) {
    const f = prepare(item);
    if (convert && !converts(f, convert[0], convert[1])) return 0;
    let total = 0, matched = 0;
    for (const set of tokenSets) {
      const s = Math.max(...set.map(t => tokenScore(f, t))); // a corrected word may have several readings
      if (s) matched++;
      total += s;
    }
    if (!matched) return 0;
    // A phrase people type often ("passport size photo") is worth more than scattered words.
    if (tokenSets.length > 1) {
      if (f.nameText.includes(query)) total += 12;
      else if (f.keys.some(k => k === query)) total += 10;
      else if (f.keys.some(k => k.includes(query) || (query.includes(k) && k.length >= 4))) total += 6;
    } else if (f.keys.some(k => k === query)) total += 10; // a single word that is a keyword, such as "cv"
    if (matched < tokenSets.length) total *= matched / tokenSets.length * 0.6; // not every word matched
    // The closer the name is to what was typed, the better: "photo" fits "Passport photo resizer"
    // (one of three words) better than "Passport photo print sheet" (one of four).
    const named = f.name.filter(w => tokenSets.some(set => set.some(t => w === t || (SYN.get(t) || []).includes(w)))).length;
    total += 2 * named / Math.max(f.name.length, 1);
    // Tools first, then guides: someone typing "cv" wants the builder before an article about CVs.
    if (item.kind === 'tool') total *= item.directory === false ? 0.75 : 1.3;
    else if (item.kind === 'guide') total *= 0.75;
    return total;
  }

  // Ties go to the tool people use most (the home page "most used" order), then to the name.
  const popularity = item => (item.kind === 'tool' && item.popular ? item.popular : 99);

  function search(query, limit) {
    const index = root.APPLYREADY_TOOL_INDEX;
    if (!index) return [];
    const typed = norm(query);
    if (!typed) return [];
    const tokens = words(typed).filter(w => !STOP.has(w));
    if (!tokens.length) return [];
    const known = vocabulary(index.items);
    const tokenSets = tokens.map(t => correct(t, known));
    // The phrase as it was meant: "mrege pdf" reads as "merge pdf" when the correction is certain.
    const q = words(typed).map(w => { if (STOP.has(w)) return w; const c = correct(w, known); return c.length === 1 ? c[0] : w; }).join(' ');
    const convert = conversion(q);
    const ranked = index.items.map(item => ({ item, s: score(item, q, tokenSets, convert) }))
      .filter(r => r.s >= 2)
      .sort((a, b) => b.s - a.s || popularity(a.item) - popularity(b.item) || a.item.name.localeCompare(b.item.name));
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
      // An option holds plain content, never a link: a listbox option cannot contain another
      // control. Enter or a click opens the result (go below).
      list.innerHTML = items.map((item, i) => `
        <li class="search-result" role="option" id="${id}-opt${i}" aria-selected="false" data-index="${i}">
          <i class="fa-solid fa-${esc(item.icon || 'arrow-right')} search-result__icon" aria-hidden="true"></i>
          <span class="search-result__text"><span class="search-result__name">${esc(item.name)}</span><span class="search-result__desc">${esc(item.summary || '')}</span></span>
          <span class="search-result__kind">${item.kind === 'tool' ? esc(item.categoryName || 'Tool') : item.kind === 'guide' ? 'Guide' : 'Page'}</span>
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
        if (target) { e.preventDefault(); go(target); }
      } else if (e.key === 'Escape') {
        if (opts.inline) { if (input.value) { input.value = ''; render(); } else panel.hidden = true; }
        else if (opts.onClose) { e.preventDefault(); opts.onClose(); }
      }
    });
    // Ctrl or Cmd click and a middle click open the result in a new tab, as a link would.
    function go(item, newTab) {
      if (newTab) window.open(hrefFor(item.path), '_blank', 'noopener');
      else location.href = hrefFor(item.path);
    }
    const optionAt = e => { const li = e.target.closest('[role="option"]'); return li ? items[Number(li.dataset.index)] : null; };
    list.addEventListener('mousemove', e => { const li = e.target.closest('[role="option"]'); if (li) setActive(Number(li.dataset.index)); });
    list.addEventListener('click', e => { const item = optionAt(e); if (item) go(item, e.ctrlKey || e.metaKey || e.shiftKey); });
    list.addEventListener('auxclick', e => { const item = e.button === 1 && optionAt(e); if (item) { e.preventDefault(); go(item, true); } });
    list.addEventListener('mousedown', e => { if (e.button === 1 && optionAt(e)) e.preventDefault(); }); // no autoscroll on middle click
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
    // Keep focus inside: the field, Close and the "browse all tools" link (results are options of the field).
    box.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.preventDefault(); close(); return; }
      if (e.key !== 'Tab') return;
      const focusables = Array.from(box.querySelectorAll('input, button, a[href]'));
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
