/* Shared UI components — enhances native elements, no libraries.
   Loaded on every page. Keeps keyboard, screen readers, mobile keyboards intact. */
(function () {
  'use strict';

  // Theme toggle (already handled by theme.js + site.js, but ensure consistency)
  function initTheme() {
    const btn = document.getElementById('themeToggle');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const current = document.documentElement.dataset.theme || 'light';
      const next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      try { localStorage.setItem('applyready_theme', next); } catch (e) {}
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.content = next === 'dark' ? '#0f172a' : '#2563eb';
    });
  }

  // Mobile menu
  function initMobileMenu() {
    const toggle = document.getElementById('navMenuToggle');
    const menu = document.getElementById('navMenu');
    if (!toggle || !menu) return;
    function setOpen(open) {
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Close navigation menu' : 'Open navigation menu');
      menu.classList.toggle('is-open', open);
    }
    toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && menu.classList.contains('is-open')) {
        setOpen(false);
        toggle.focus();
      }
    });
    document.addEventListener('click', e => {
      if (!e.target.closest('.nav-container')) setOpen(false);
    });
  }

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
      const list = document.createElement('div');
      list.className = 'custom-select__list';
      list.setAttribute('role', 'listbox');
      list.hidden = true;

      function update() {
        const opt = native.options[native.selectedIndex];
        btn.textContent = opt ? opt.textContent : 'Select';
        list.innerHTML = '';
        Array.from(native.options).forEach((opt, i) => {
          const item = document.createElement('div');
          item.className = 'custom-select__option';
          item.setAttribute('role', 'option');
          item.setAttribute('aria-selected', String(i === native.selectedIndex));
          item.textContent = opt.textContent;
          item.addEventListener('click', () => {
            native.selectedIndex = i;
            native.dispatchEvent(new Event('change', { bubbles: true }));
            update();
            wrap.classList.remove('is-open');
            btn.setAttribute('aria-expanded', 'false');
            list.hidden = true;
            btn.focus();
          });
          list.appendChild(item);
        });
      }
      update();

      btn.addEventListener('click', () => {
        const open = !wrap.classList.contains('is-open');
        wrap.classList.toggle('is-open', open);
        btn.setAttribute('aria-expanded', String(open));
        list.hidden = !open;
        if (open) {
          const selected = list.querySelector('[aria-selected="true"]');
          if (selected) selected.focus();
        }
      });

      // Keyboard
      btn.addEventListener('keydown', e => {
        if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          btn.click();
        }
      });
      list.addEventListener('keydown', e => {
        const items = Array.from(list.children);
        const current = document.activeElement;
        let idx = items.indexOf(current);
        if (e.key === 'ArrowDown') { e.preventDefault(); (items[idx + 1] || items[0]).focus(); }
        if (e.key === 'ArrowUp') { e.preventDefault(); (items[idx - 1] || items[items.length - 1]).focus(); }
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); current.click(); }
        if (e.key === 'Escape') { wrap.classList.remove('is-open'); list.hidden = true; btn.focus(); }
      });

      wrap.appendChild(btn);
      wrap.appendChild(list);
      native.style.position = 'absolute';
      native.style.opacity = '0';
      native.style.pointerEvents = 'none';
      native.style.height = '0';
      native.parentNode.insertBefore(wrap, native);
      wrap.appendChild(native);

      native.addEventListener('change', update);
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

  // Dropzone enhancement
  function initDropzones() {
    document.querySelectorAll('.dropzone').forEach(zone => {
      if (zone.dataset.enhanced) return;
      zone.dataset.enhanced = 'true';
      const input = zone.querySelector('input[type="file"]') || document.createElement('input');
      if (!zone.contains(input)) {
        input.type = 'file';
        input.hidden = true;
        zone.appendChild(input);
      }
      zone.addEventListener('click', () => input.click());
      zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('is-dragover'); });
      zone.addEventListener('dragleave', () => zone.classList.remove('is-dragover'));
      zone.addEventListener('drop', e => {
        e.preventDefault();
        zone.classList.remove('is-dragover');
        if (e.dataTransfer.files.length) {
          input.files = e.dataTransfer.files;
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });
      zone.addEventListener('paste', e => {
        const items = e.clipboardData?.items;
        if (!items) return;
        for (const item of items) {
          if (item.type.startsWith('image/')) {
            const file = item.getAsFile();
            const dt = new DataTransfer();
            dt.items.add(file);
            input.files = dt.files;
            input.dispatchEvent(new Event('change', { bubbles: true }));
            break;
          }
        }
      });
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
    initTheme();
    initMobileMenu();
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
