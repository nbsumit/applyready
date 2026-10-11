/* Shared UI components — enhances native elements, no libraries.
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

  // Custom select (accessible listbox, falls back gracefully)
  // Accessible custom select (listbox pattern)
  function initCustomSelects() {
    document.querySelectorAll('select.custom-select-source').forEach(native => {
      if (native.dataset.enhanced) return;
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
      // Link label
      const label = native.id && document.querySelector('label[for="' + native.id + '"]');
      if (label) {
        if (!label.id) label.id = native.id + '-label';
        btn.setAttribute('aria-labelledby', label.id);
      }
      const list = document.createElement('div');
      list.className = 'custom-select__list';
      list.id = listId;
      list.setAttribute('role', 'listbox');
      list.setAttribute('tabindex', '-1');
      list.hidden = true;
      let activeIndex = native.selectedIndex || 0;
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
          item.setAttribute('tabindex', i === idx ? '0' : '-1');
        });
        list.setAttribute('aria-activedescendant', items[idx].id);
        if (focus) items[idx].focus();
      }

      function rebuild() {
        const opt = native.options[native.selectedIndex];
        btn.textContent = opt ? opt.textContent : 'Select';
        list.innerHTML = '';
        Array.from(native.options).forEach((opt, i) => {
          const item = document.createElement('div');
          item.className = 'custom-select__option';
          item.setAttribute('role', 'option');
          item.id = listId + '-opt-' + i;
          item.setAttribute('aria-selected', String(i === native.selectedIndex));
          item.setAttribute('tabindex', i === (native.selectedIndex || 0) ? '0' : '-1');
          item.textContent = opt.textContent;
          item.addEventListener('click', () => choose(i));
          list.appendChild(item);
        });
        setActive(native.selectedIndex || 0, false);
      }

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
        setActive(native.selectedIndex || 0, true);
      }
      function close() {
        wrap.classList.remove('is-open');
        btn.setAttribute('aria-expanded', 'false');
        list.hidden = true;
      }

      btn.addEventListener('click', e => {
        e.stopPropagation();
        if (list.hidden) open(); else close();
      });

      function onKey(e, fromList) {
        const items = options();
        if (!items.length) return;
        const key = e.key;
        if (key === 'ArrowDown') { e.preventDefault(); if (list.hidden) open(); else setActive(activeIndex + 1, true); }
        else if (key === 'ArrowUp') { e.preventDefault(); if (list.hidden) open(); else setActive(activeIndex - 1, true); }
        else if (key === 'Home') { e.preventDefault(); if (list.hidden) open(); else setActive(0, true); }
        else if (key === 'End') { e.preventDefault(); if (list.hidden) open(); else setActive(items.length - 1, true); }
        else if (key === 'Enter' || key === ' ') { e.preventDefault(); if (list.hidden) open(); else choose(activeIndex); }
        else if (key === 'Escape') { e.preventDefault(); close(); btn.focus(); }
        else if (key.length === 1 && !e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          typeBuffer += key.toLowerCase();
          clearTimeout(typeTimer);
          typeTimer = setTimeout(() => { typeBuffer = ''; }, 500);
          const match = items.findIndex(it => it.textContent.trim().toLowerCase().startsWith(typeBuffer));
          if (match >= 0) { if (list.hidden) open(); setActive(match, true); }
        }
      }
      btn.addEventListener('keydown', e => onKey(e, false));
      list.addEventListener('keydown', e => onKey(e, true));
      document.addEventListener('click', e => { if (!wrap.contains(e.target)) close(); });

      wrap.appendChild(btn);
      wrap.appendChild(list);
      native.style.position = 'absolute';
      native.style.width = '1px';
      native.style.height = '1px';
      native.style.opacity = '0';
      native.style.pointerEvents = 'none';
      native.setAttribute('tabindex', '-1');
      native.setAttribute('aria-hidden', 'true');
      native.parentNode.insertBefore(wrap, native);
      wrap.appendChild(native);
      native.addEventListener('change', rebuild);
      rebuild();
    });
  }

  // Range value bubble
  function initRanges() {
    document.querySelectorAll('input[type="range"]').forEach(range => {
      if (range.dataset.enhanced) return;
      range.dataset.enhanced = 'true';
      const wrap = range.parentElement || document.createElement('div');
      if (!range.parentElement) {
        range.replaceWith(wrap);
        wrap.appendChild(range);
      }
      wrap.classList.add('range-wrap');
      const bubble = document.createElement('div');
      bubble.className = 'range-bubble';
      wrap.appendChild(bubble);
      function update() {
        const pct = (range.value - range.min) / (range.max - range.min);
        bubble.textContent = range.value + (range.dataset.suffix || '');
        bubble.style.left = `calc(${pct * 100}% )`;
      }
      range.addEventListener('input', update);
      update();
    });
  }

  // Dropzone visual only — never assign files (tool pages own drop/paste handlers).
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
  function init() {
    initToolsMenu();
    initAccordions();
    initCustomSelects();
    initRanges();
    initDropzones();
    initLang();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose for tests
  window.ApplyReadyUI = { init, showToast };
})();
