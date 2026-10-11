/* Shared UI components. Enhances native elements, no libraries.
   Loaded on every page. Keeps keyboard, screen readers, mobile keyboards intact. */
(function () {
  'use strict';

  // Tools dropdown menu
  function initToolsMenu() {
    document.querySelectorAll('.tools-menu').forEach(menu => {
      const btn = menu.querySelector('button');
      if (!btn) return;
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const open = menu.classList.toggle('is-open');
        btn.setAttribute('aria-expanded', String(open));
      });
      document.addEventListener('click', () => {
        menu.classList.remove('is-open');
        btn.setAttribute('aria-expanded', 'false');
      });
      document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
          menu.classList.remove('is-open');
          btn.setAttribute('aria-expanded', 'false');
        }
      });
    });
  }

  // Accordion
  function initAccordions() {
    document.querySelectorAll('.accordion').forEach(acc => {
      acc.querySelectorAll('.accordion__button').forEach(btn => {
        btn.addEventListener('click', () => {
          const item = btn.closest('.accordion__item');
          const open = item.classList.toggle('is-open');
          btn.setAttribute('aria-expanded', String(open));
          const panel = item.querySelector('.accordion__panel');
          if (panel) panel.hidden = !open;
        });
      });
    });
  }

  function enhanceSelect(native) {
    if (!native || native.dataset.enhanced) return;
    if (native.multiple || native.size > 1) return;
    if (native.closest('.sr-only')) return;
    native.dataset.enhanced = 'true';
    const wrap = document.createElement('div');
    wrap.className = 'custom-select';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'custom-select__button';
    btn.setAttribute('aria-haspopup', 'listbox');
    btn.setAttribute('aria-expanded', 'false');
    const listId = 'listbox-' + (native.id || Math.random().toString(36).slice(2, 8));
    btn.setAttribute('aria-controls', listId);
    const valueEl = document.createElement('span');
    valueEl.className = 'custom-select__value';
    btn.appendChild(valueEl);
    const label = native.id && document.querySelector('label[for="' + CSS.escape(native.id) + '"]');
    if (label) {
      if (!label.id) label.id = native.id + '-label';
      btn.setAttribute('aria-labelledby', label.id);
    } else if (native.getAttribute('aria-label')) {
      btn.setAttribute('aria-label', native.getAttribute('aria-label'));
    }
    const list = document.createElement('div');
    list.className = 'custom-select__list';
    list.id = listId;
    list.setAttribute('role', 'listbox');
    list.tabIndex = -1;
    list.hidden = true;
    if (label && label.id) list.setAttribute('aria-labelledby', label.id);
    let activeIndex = native.selectedIndex > -1 ? native.selectedIndex : 0;
    let typeBuffer = '';
    let typeTimer = null;

    function options() { return Array.from(list.querySelectorAll('[role="option"]')); }

    function setActive(idx, focus) {
      const items = options();
      if (!items.length) return;
      idx = Math.max(0, Math.min(idx, items.length - 1));
      activeIndex = idx;
      items.forEach((item, i) => {
        item.setAttribute('aria-selected', String(i === native.selectedIndex));
        item.classList.toggle('is-active', i === idx);
        item.tabIndex = i === idx ? 0 : -1;
      });
      list.setAttribute('aria-activedescendant', items[idx].id);
      if (focus) items[idx].focus();
    }

    function rebuild() {
      const opt = native.options[native.selectedIndex];
      valueEl.textContent = opt ? opt.textContent : 'Select';
      btn.disabled = native.disabled;
      const invalid = native.classList.contains('is-invalid') || native.getAttribute('aria-invalid') === 'true';
      wrap.classList.toggle('is-invalid', invalid);
      if (invalid) btn.setAttribute('aria-invalid', 'true');
      else btn.removeAttribute('aria-invalid');
      list.innerHTML = '';
      Array.from(native.options).forEach((opt, i) => {
        const item = document.createElement('div');
        item.className = 'custom-select__option';
        item.setAttribute('role', 'option');
        item.id = listId + '-opt-' + i;
        item.setAttribute('aria-selected', String(i === native.selectedIndex));
        item.tabIndex = i === activeIndex ? 0 : -1;
        if (opt.disabled) item.setAttribute('aria-disabled', 'true');
        item.textContent = opt.textContent;
        item.addEventListener('click', () => { if (!opt.disabled) choose(i); });
        list.appendChild(item);
      });
      setActive(native.selectedIndex > -1 ? native.selectedIndex : 0, false);
    }

    function place() {
      const rect = btn.getBoundingClientRect();
      const width = Math.max(rect.width, 180);
      list.style.width = width + 'px';
      list.hidden = false;
      const listHeight = Math.min(list.scrollHeight, 240);
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUp = spaceBelow < listHeight + 12 && rect.top > spaceBelow;
      const top = openUp ? Math.max(8, rect.top - listHeight - 4) : rect.bottom + 4;
      let left = rect.left;
      if (left + width > window.innerWidth - 8) left = Math.max(8, window.innerWidth - width - 8);
      list.style.left = left + 'px';
      list.style.top = top + 'px';
    }

    function onReflow() { if (!list.hidden) place(); }

    function choose(i) {
      native.selectedIndex = i;
      native.dispatchEvent(new Event('change', { bubbles: true }));
      rebuild();
      close();
      btn.focus();
    }

    function open() {
      wrap.classList.add('is-open');
      btn.setAttribute('aria-expanded', 'true');
      list.hidden = false;
      place();
      setActive(native.selectedIndex > -1 ? native.selectedIndex : 0, true);
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
      if (key === 'ArrowDown') { e.preventDefault(); if (list.hidden) open(); else setActive(activeIndex + 1, true); }
      else if (key === 'ArrowUp') { e.preventDefault(); if (list.hidden) open(); else setActive(activeIndex - 1, true); }
      else if (key === 'Home') { e.preventDefault(); if (list.hidden) open(); else setActive(0, true); }
      else if (key === 'End') { e.preventDefault(); if (list.hidden) open(); else setActive(items.length - 1, true); }
      else if (key === 'Enter' || key === ' ') { e.preventDefault(); if (list.hidden) open(); else if (!native.options[activeIndex].disabled) choose(activeIndex); }
      else if (key === 'Escape') { if (!list.hidden) { e.preventDefault(); e.stopPropagation(); close(); btn.focus(); } }
      else if (key === 'Tab') { close(); }
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
    document.addEventListener('click', e => { if (!wrap.contains(e.target) && !list.contains(e.target)) close(); });

    wrap.appendChild(btn);
    document.body.appendChild(list);
    if (native.required) btn.setAttribute('aria-required', 'true');
    native.classList.add('ux-native-select');
    native.tabIndex = -1;
    native.setAttribute('aria-hidden', 'true');
    native.parentNode.insertBefore(wrap, native);
    wrap.appendChild(native);
    native.addEventListener('change', rebuild);
    const optObserver = new MutationObserver(rebuild);
    optObserver.observe(native, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled', 'label', 'class', 'aria-invalid'] });
    rebuild();
  }

  function initCustomSelects(root) {
    (root || document).querySelectorAll('select').forEach(enhanceSelect);
  }

  function initRanges(root) {
    (root || document).querySelectorAll('input[type="range"]').forEach(range => {
      if (range.dataset.enhanced) return;
      range.dataset.enhanced = 'true';
      let wrap = range.parentElement;
      if (!wrap || !wrap.classList.contains('range-wrap')) {
        wrap = document.createElement('div');
        wrap.className = 'range-wrap';
        range.parentNode.insertBefore(wrap, range);
        wrap.appendChild(range);
      }
      const bubble = document.createElement('div');
      bubble.className = 'range-bubble';
      wrap.appendChild(bubble);
      function update() {
        const min = Number(range.min || 0);
        const max = Number(range.max || 100);
        const pct = max === min ? 0 : (Number(range.value) - min) / (max - min);
        bubble.textContent = range.value + (range.dataset.suffix || '');
        bubble.style.left = (pct * 100) + '%';
      }
      range.addEventListener('input', update);
      update();
    });
  }

  function initSteps() {
    const steps = document.querySelector('.steps');
    const fileBox = document.getElementById('fileInfoBox');
    const result = document.getElementById('resultArea');
    if (!steps || !fileBox) return;
    const items = steps.querySelectorAll('.steps__item');
    function sync() {
      const hasFile = !fileBox.classList.contains('hidden');
      const hasResult = result && !result.classList.contains('hidden');
      const active = hasResult ? 2 : hasFile ? 1 : 0;
      items.forEach((el, i) => {
        el.classList.toggle('is-active', i === active);
        el.classList.toggle('is-done', i < active);
      });
    }
    const obs = new MutationObserver(sync);
    obs.observe(fileBox, { attributes: true, attributeFilter: ['class'] });
    if (result) obs.observe(result, { attributes: true, attributeFilter: ['class'] });
    sync();
  }

  // Dropzone visual only. Never assign files (tool pages own drop/paste handlers).
  // Double assignment was adding the same file twice.
  function initDropzones() {
    document.querySelectorAll('.dropzone').forEach(zone => {
      if (zone.dataset.uiVisual) return;
      zone.dataset.uiVisual = 'true';
      zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('is-dragover'); }, true);
      zone.addEventListener('dragleave', () => zone.classList.remove('is-dragover'), true);
      zone.addEventListener('drop', () => zone.classList.remove('is-dragover'), true);
    });
  }

  // Toast helper
  window.showToast = function (message, duration = 3000) {
    let container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.setAttribute('role', 'status');
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), duration);
  };

  // Language switcher
  function initLang() {
    document.querySelectorAll('[data-lang-switch]').forEach(el => {
      el.addEventListener('click', e => {
        // Already linked; just ensure it works
      });
    });
  }

  // Init all

  function initCurrentNav() {
    const here = location.pathname.replace(/\/index\.html$/, '/');
    const norm = here.length > 1 ? here.replace(/\/$/, '') : here;
    document.querySelectorAll('a.nav-link[href], .tools-menu a[href], .footer-link[href]').forEach(a => {
      const href = a.getAttribute('href');
      if (!href || href.charAt(0) === '#') return;
      let path;
      try { path = new URL(href, location.href).pathname; } catch (e) { return; }
      path = path.replace(/\/index\.html$/, '/');
      if (path.length > 1) path = path.replace(/\/$/, '');
      if (path === norm) a.setAttribute('aria-current', 'page');
    });
  }

  function init() {
    initToolsMenu();
    initCurrentNav();
    initAccordions();
    initCustomSelects(document);
    initRanges(document);
    initDropzones();
    initSteps();
    initLang();
    const watch = new MutationObserver(mutations => {
      mutations.forEach(m => {
        m.addedNodes.forEach(node => {
          if (node.nodeType !== 1) return;
          if (node.matches && node.matches('select')) enhanceSelect(node);
          if (node.querySelectorAll) initCustomSelects(node);
          if (node.matches && node.matches('input[type="range"]')) initRanges(node.parentElement || document);
          else if (node.querySelectorAll) initRanges(node);
        });
      });
    });
    watch.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose for tests
  window.ApplyReadyUI = { init, showToast };
})();
