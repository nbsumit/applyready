/* Shared interface components: custom select, range fill, tool workspace states.
   Native elements stay in the DOM and keep their value, validity and events. */
(function () {
  'use strict';
  const doc = document;

  /* ---------------------------------------------------------------- Select */
  const selectValue = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
  const selectIndex = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'selectedIndex');
  let selectSeq = 0;

  function enhanceSelect(native) {
    if (!native || native.dataset.enhanced) return;
    if (native.multiple || native.size > 1) return;
    if (native.closest('.sr-only')) return;
    native.dataset.enhanced = 'true';
    const uid = (native.id || 'select' + (++selectSeq)) + '-list';

    const wrap = doc.createElement('div');
    wrap.className = 'select';
    const btn = doc.createElement('button');
    btn.type = 'button';
    btn.className = 'select-btn';
    btn.setAttribute('aria-haspopup', 'listbox');
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', uid);
    const valueEl = doc.createElement('span');
    valueEl.className = 'select-value';
    btn.appendChild(valueEl);

    const label = native.id && doc.querySelector('label[for="' + CSS.escape(native.id) + '"]');
    if (label) {
      if (!label.id) label.id = native.id + '-label';
      btn.setAttribute('aria-labelledby', label.id + ' ' + (btn.id = native.id + '-button'));
      label.addEventListener('click', e => { e.preventDefault(); btn.focus(); });
    } else if (native.getAttribute('aria-label')) {
      btn.setAttribute('aria-label', native.getAttribute('aria-label'));
    }

    const list = doc.createElement('div');
    list.className = 'select-list';
    list.id = uid;
    list.setAttribute('role', 'listbox');
    list.tabIndex = -1;
    list.hidden = true;
    if (label && label.id) list.setAttribute('aria-labelledby', label.id);
    else if (native.getAttribute('aria-label')) list.setAttribute('aria-label', native.getAttribute('aria-label'));

    let activeIndex = Math.max(0, native.selectedIndex);
    let typeBuffer = '';
    let typeTimer = null;
    const options = () => Array.from(list.querySelectorAll('[role="option"]'));

    function setActive(idx, focus, step) {
      const items = options();
      if (!items.length) return;
      idx = Math.max(0, Math.min(idx, items.length - 1));
      const dir = step || 1;
      let guard = items.length;
      while (items[idx].getAttribute('aria-disabled') === 'true' && guard-- > 0) {
        const next = idx + dir;
        if (next < 0 || next >= items.length) { idx = Math.max(0, Math.min(activeIndex, items.length - 1)); break; }
        idx = next;
      }
      activeIndex = idx;
      items.forEach((item, i) => {
        item.setAttribute('aria-selected', String(i === native.selectedIndex));
        item.classList.toggle('is-active', i === idx);
        item.tabIndex = i === idx ? 0 : -1;
      });
      if (focus) items[idx].focus();
    }

    function rebuild() {
      const opt = native.options[native.selectedIndex];
      valueEl.textContent = opt ? opt.textContent : 'Select';
      valueEl.classList.toggle('is-placeholder', !!opt && opt.disabled && opt.value === '');
      btn.disabled = native.disabled;
      const invalid = native.classList.contains('is-invalid') || native.getAttribute('aria-invalid') === 'true';
      wrap.classList.toggle('is-invalid', invalid);
      if (invalid) btn.setAttribute('aria-invalid', 'true'); else btn.removeAttribute('aria-invalid');
      list.textContent = '';
      Array.from(native.options).forEach((o, i) => {
        const item = doc.createElement('div');
        item.className = 'select-opt';
        item.setAttribute('role', 'option');
        item.id = uid + '-' + i;
        item.setAttribute('aria-selected', String(i === native.selectedIndex));
        item.tabIndex = i === activeIndex ? 0 : -1;
        if (o.disabled) item.setAttribute('aria-disabled', 'true');
        item.textContent = o.textContent;
        item.addEventListener('click', () => { if (!o.disabled) choose(i); });
        list.appendChild(item);
      });
      activeIndex = Math.max(0, native.selectedIndex);
      setActive(activeIndex, false);
    }

    function place() {
      const rect = btn.getBoundingClientRect();
      const width = Math.min(Math.max(rect.width, 200), window.innerWidth - 16);
      list.style.width = width + 'px';
      list.style.maxHeight = '';
      list.hidden = false;
      const gap = 4, margin = 8;
      const spaceBelow = window.innerHeight - rect.bottom - gap - margin;
      const spaceAbove = rect.top - gap - margin;
      const natural = list.scrollHeight + 2;
      const openUp = natural > spaceBelow && spaceAbove > spaceBelow;
      const room = Math.max(120, openUp ? spaceAbove : spaceBelow);
      const height = Math.min(natural, room, 340);
      list.style.maxHeight = height + 'px';
      const top = openUp ? rect.top - gap - height : rect.bottom + gap;
      let left = rect.left;
      if (left + width > window.innerWidth - margin) left = Math.max(margin, window.innerWidth - width - margin);
      list.style.left = left + 'px';
      list.style.top = Math.max(margin, top) + 'px';
    }
    function onReflow() {
      if (list.hidden) return;
      const r = btn.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight) { close(); return; }
      place();
    }
    function choose(i) {
      selectIndex.set.call(native, i);
      native.dispatchEvent(new Event('change', { bubbles: true }));
      rebuild();
      close();
      btn.focus();
    }
    function open() {
      wrap.classList.add('is-open');
      btn.setAttribute('aria-expanded', 'true');
      place();
      setActive(Math.max(0, native.selectedIndex), true);
      window.addEventListener('scroll', onReflow, true);
      window.addEventListener('resize', onReflow);
    }
    function close() {
      wrap.classList.remove('is-open');
      btn.setAttribute('aria-expanded', 'false');
      list.hidden = true;
      window.removeEventListener('scroll', onReflow, true);
      window.removeEventListener('resize', onReflow);
    }

    btn.addEventListener('click', e => {
      e.stopPropagation();
      if (btn.disabled) return;
      if (list.hidden) open(); else close();
    });
    function onKey(e) {
      const items = options();
      if (!items.length) return;
      const key = e.key;
      if (key === 'ArrowDown') { e.preventDefault(); if (list.hidden) open(); else setActive(activeIndex + 1, true, 1); }
      else if (key === 'ArrowUp') { e.preventDefault(); if (list.hidden) open(); else setActive(activeIndex - 1, true, -1); }
      else if (key === 'Home') { e.preventDefault(); if (list.hidden) open(); setActive(0, true, 1); }
      else if (key === 'End') { e.preventDefault(); if (list.hidden) open(); setActive(items.length - 1, true, -1); }
      else if (key === 'Enter' || key === ' ') { e.preventDefault(); if (list.hidden) open(); else if (!native.options[activeIndex].disabled) choose(activeIndex); }
      else if (key === 'Escape') { if (!list.hidden) { e.preventDefault(); e.stopPropagation(); close(); btn.focus(); } }
      else if (key === 'Tab') { if (!list.hidden) { close(); btn.focus(); } }
      else if (key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        typeBuffer += key.toLowerCase();
        clearTimeout(typeTimer);
        typeTimer = setTimeout(() => { typeBuffer = ''; }, 600);
        const match = items.findIndex(it => it.textContent.trim().toLowerCase().startsWith(typeBuffer));
        if (match >= 0) { if (list.hidden) open(); setActive(match, true); }
      }
    }
    btn.addEventListener('keydown', onKey);
    list.addEventListener('keydown', onKey);
    doc.addEventListener('click', e => { if (!wrap.contains(e.target) && !list.contains(e.target)) close(); });

    wrap.appendChild(btn);
    doc.body.appendChild(list);
    if (native.required) btn.setAttribute('aria-required', 'true');
    native.tabIndex = -1;
    native.setAttribute('aria-hidden', 'true');
    native.parentNode.insertBefore(wrap, native);
    wrap.appendChild(native);
    native.addEventListener('change', rebuild);
    // Script that sets .value or .selectedIndex must update what the person sees.
    Object.defineProperty(native, 'value', { configurable: true, get() { return selectValue.get.call(this); }, set(v) { selectValue.set.call(this, v); rebuild(); } });
    Object.defineProperty(native, 'selectedIndex', { configurable: true, get() { return selectIndex.get.call(this); }, set(v) { selectIndex.set.call(this, v); rebuild(); } });
    new MutationObserver(rebuild).observe(native, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled', 'label', 'class', 'aria-invalid'] });
    rebuild();
  }

  /* ----------------------------------------------------------------- Range */
  const rangeValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
  function enhanceRange(range) {
    if (range.dataset.enhanced) return;
    range.dataset.enhanced = 'true';
    const paint = () => {
      const min = Number(range.min || 0), max = Number(range.max || 100);
      range.style.setProperty('--pct', (max === min ? 0 : ((Number(range.value) - min) / (max - min)) * 100) + '%');
    };
    range.addEventListener('input', paint);
    Object.defineProperty(range, 'value', { configurable: true, get() { return rangeValue.get.call(this); }, set(v) { rangeValue.set.call(this, v); paint(); } });
    paint();
  }

  // Segmented controls driven by an .active class (tool scripts) also tell assistive technology which side is on.
  function syncPressed(group) {
    if (group.dataset.pressedSync) return;
    group.dataset.pressedSync = 'true';
    const buttons = Array.from(group.querySelectorAll('button[aria-pressed]'));
    const sync = () => buttons.forEach(b => b.setAttribute('aria-pressed', String(b.classList.contains('active'))));
    if (!buttons.some(b => b.classList.contains('active'))) return;
    const observer = new MutationObserver(sync);
    buttons.forEach(b => observer.observe(b, { attributes: true, attributeFilter: ['class'] }));
  }

  function enhance(root) {
    (root || doc).querySelectorAll('.segmented').forEach(syncPressed);
    (root || doc).querySelectorAll('select').forEach(enhanceSelect);
    (root || doc).querySelectorAll('input[type="range"]').forEach(enhanceRange);
  }

  /* ------------------------------------------------------- Tool workspace */
  // A workspace moves through three states: empty (add a file), ready (adjust), done (download).
  // The tool script only shows and hides its own elements; this reads them and sets data-state.
  function initWorkspace(ws) {
    const find = sel => (sel ? ws.querySelector(sel) : null);
    const fileEl = find(ws.dataset.wsFile);
    const resultEl = find(ws.dataset.wsResult);
    const busyEl = find(ws.dataset.wsBusy);
    const steps = Array.from(ws.querySelectorAll('.steps [data-step]'));
    const shown = el => !!el && !el.hidden && !el.classList.contains('hidden');
    function sync() {
      const state = shown(resultEl) ? 'done' : shown(fileEl) ? 'ready' : 'empty';
      ws.dataset.state = state;
      ws.dataset.busy = shown(busyEl) ? 'true' : 'false';
      const current = { empty: 0, ready: 1, done: 2 }[state];
      steps.forEach((step, i) => {
        step.classList.toggle('is-done', i < current);
        step.classList.toggle('is-current', i === current);
        if (i === current) step.setAttribute('aria-current', 'step'); else step.removeAttribute('aria-current');
      });
    }
    const observer = new MutationObserver(sync);
    [fileEl, resultEl, busyEl].forEach(el => { if (el) observer.observe(el, { attributes: true, attributeFilter: ['class', 'hidden'] }); });
    ws.querySelectorAll('[data-ws-toggle]').forEach(button => {
      button.addEventListener('click', () => {
        const open = ws.dataset.settings !== 'open';
        ws.dataset.settings = open ? 'open' : 'closed';
        button.setAttribute('aria-expanded', String(open));
      });
    });
    sync();
  }

  function init() {
    enhance(doc);
    doc.querySelectorAll('.ws').forEach(initWorkspace);
    new MutationObserver(mutations => {
      mutations.forEach(m => m.addedNodes.forEach(node => {
        if (node.nodeType !== 1) return;
        if (node.matches && node.matches('select')) enhanceSelect(node);
        if (node.matches && node.matches('input[type="range"]')) enhanceRange(node);
        if (node.querySelectorAll) enhance(node);
      }));
    }).observe(doc.body, { childList: true, subtree: true });
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init); else init();
  window.ApplyReadyUI = Object.assign(window.ApplyReadyUI || {}, { init, enhance });
})();
