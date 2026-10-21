/* Shared shell behaviour: theme, navigation, notifications, confirmation dialog.
   Loaded on every page. No libraries. Keyboard, touch and screen readers are first-class. */
(function () {
  'use strict';
  const doc = document;
  const root = doc.documentElement;
  const reduceMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------------------------------------------------------- Theme */
  const themeButton = doc.getElementById('themeToggle');
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  let explicitTheme = false;
  try { explicitTheme = ['light', 'dark'].includes(localStorage.getItem('applyready_theme')); } catch (e) {}
  function setTheme(theme) {
    root.dataset.theme = theme;
    if (themeButton) {
      const next = theme === 'dark' ? 'light' : 'dark';
      themeButton.setAttribute('aria-label', `Switch to ${next} theme`);
      themeButton.title = `Switch to ${next} theme`;
    }
    const color = doc.querySelector('meta[name="theme-color"]');
    if (color) color.content = theme === 'dark' ? '#171c23' : '#ffffff';
  }
  setTheme(root.dataset.theme || 'light');
  if (themeButton) themeButton.addEventListener('click', () => {
    const theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
    explicitTheme = true;
    try { localStorage.setItem('applyready_theme', theme); } catch (e) {}
    setTheme(theme);
  });
  const onScheme = e => { if (!explicitTheme) setTheme(e.matches ? 'dark' : 'light'); };
  if (media.addEventListener) media.addEventListener('change', onScheme);
  else if (media.addListener) media.addListener(onScheme);

  /* ----------------------------------------------------- Reference tables */
  // On phones a wide table becomes one block per row, each value under its column name, instead of a
  // strip that scrolls sideways. The CSS only stacks tables marked here, so without script they scroll.
  doc.querySelectorAll('.table-wrap > table').forEach(table => {
    const heads = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent.trim());
    if (!heads.length || table.querySelector('[colspan], [rowspan]')) return;
    table.querySelectorAll('tbody tr').forEach(tr => {
      Array.from(tr.children).forEach((cell, i) => { if (heads[i]) cell.dataset.label = heads[i]; });
    });
    table.parentElement.dataset.stack = 'true';
  });

  /* ----------------------------------------------------------- Navigation */
  const header = doc.getElementById('siteHeader');
  const navToggle = doc.getElementById('navMenuToggle');
  const nav = doc.getElementById('siteNav');
  const toolsButton = doc.getElementById('toolsMenuButton');
  const toolsMenu = doc.getElementById('toolsMenu');
  const MOBILE = '(max-width: 639px)';
  const isMobile = () => window.matchMedia(MOBILE).matches;
  const pageRegions = () => [doc.getElementById('mainContent'), doc.querySelector('.site-footer')].filter(Boolean);

  function setToolsMenu(open, focusButton) {
    if (!toolsButton || !toolsMenu) return;
    toolsMenu.hidden = !open;
    toolsButton.setAttribute('aria-expanded', String(open));
    if (!open && focusButton) toolsButton.focus();
  }
  function setNav(open) {
    if (!header || !navToggle) return;
    header.dataset.open = String(open);
    navToggle.setAttribute('aria-expanded', String(open));
    navToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    root.classList.toggle('nav-open', open);
    pageRegions().forEach(el => { el.inert = open; });
  }

  if (toolsButton && toolsMenu) {
    toolsButton.addEventListener('click', e => { e.stopPropagation(); setToolsMenu(toolsMenu.hidden); });
    toolsButton.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setToolsMenu(true); const first = toolsMenu.querySelector('a'); if (first) first.focus(); }
    });
    toolsMenu.addEventListener('keydown', e => {
      const links = Array.from(toolsMenu.querySelectorAll('a'));
      const i = links.indexOf(doc.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); links[(i + 1) % links.length].focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); links[(i - 1 + links.length) % links.length].focus(); }
      else if (e.key === 'Home') { e.preventDefault(); links[0].focus(); }
      else if (e.key === 'End') { e.preventDefault(); links[links.length - 1].focus(); }
    });
    doc.addEventListener('click', e => { if (!toolsMenu.hidden && !toolsMenu.contains(e.target)) setToolsMenu(false); });
    doc.addEventListener('focusin', e => { if (!toolsMenu.hidden && !toolsMenu.contains(e.target) && e.target !== toolsButton) setToolsMenu(false); });
    doc.addEventListener('keydown', e => {
      if (e.key !== 'Escape' || toolsMenu.hidden) return;
      const inside = toolsMenu.contains(doc.activeElement) || doc.activeElement === toolsButton;
      setToolsMenu(false, inside);
    });
  }
  if (navToggle && nav) {
    navToggle.addEventListener('click', () => setNav(header.dataset.open !== 'true'));
    doc.addEventListener('keydown', e => { if (e.key === 'Escape' && header.dataset.open === 'true') { setNav(false); navToggle.focus(); } });
    nav.addEventListener('click', e => { if (e.target.closest('a')) setNav(false); });
    window.addEventListener('resize', () => { if (!isMobile() && header.dataset.open === 'true') setNav(false); });
  }

  // Mark the current page in the header and footer (also marked in the HTML for no-JS).
  (function markCurrent() {
    const clean = p => { p = p.replace(/\/index\.html$/, '/'); return p.length > 1 ? p.replace(/\/$/, '') : p; };
    const here = clean(location.pathname);
    doc.querySelectorAll('.site-nav a[href], .menu__list a[href], .site-footer__list a[href]').forEach(a => {
      try { if (clean(new URL(a.getAttribute('href'), location.href).pathname) === here) a.setAttribute('aria-current', 'page'); } catch (e) {}
    });
  })();

  /* Arrow keys move between tabs of any tab list (Tab key still works normally). */
  doc.querySelectorAll('[role="tablist"]').forEach(list => {
    const tabs = () => Array.from(list.querySelectorAll('[role="tab"]')).filter(t => !t.hidden && t.offsetParent !== null);
    function sync() { list.querySelectorAll('[role="tab"]').forEach(t => { t.tabIndex = t.getAttribute('aria-selected') === 'true' ? 0 : -1; }); }
    list.addEventListener('click', () => queueMicrotask(sync));
    list.addEventListener('keydown', e => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
      const all = tabs(); let i = all.indexOf(doc.activeElement);
      if (i < 0) return;
      e.preventDefault();
      i = e.key === 'Home' ? 0 : e.key === 'End' ? all.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + all.length) % all.length;
      all[i].click(); all[i].focus(); sync();
    });
    sync();
  });

  /* ---------------------------------------------------------- Notifications */
  let notifyTimer;
  function notify(message, error = false) {
    let node = doc.getElementById('taskNotification');
    if (!node) {
      node = doc.createElement('div');
      node.id = 'taskNotification'; node.className = 'task-notification';
      node.setAttribute('role', 'status'); node.setAttribute('aria-live', 'polite');
      doc.body.appendChild(node);
    }
    clearTimeout(notifyTimer);
    node.textContent = message;
    node.classList.toggle('is-error', error);
    node.setAttribute('role', error ? 'alert' : 'status');
    node.classList.add('is-visible');
    notifyTimer = setTimeout(() => node.classList.remove('is-visible'), error ? 9000 : 4500);
  }

  // Bring a result into view when it is below the fold (phones). No-op when already visible.
  function reveal(el) {
    if (!el || typeof el.getBoundingClientRect !== 'function') return;
    const r = el.getBoundingClientRect();
    if (r.top >= 0 && r.top < window.innerHeight * 0.6) return;
    el.scrollIntoView({ block: 'start', behavior: reduceMotion() ? 'auto' : 'smooth' });
  }

  /* ----------------------------------------------------- Confirm dialog */
  // Replaces window.confirm. Resolves true when confirmed, false when cancelled.
  function confirmDialog(options) {
    const o = Object.assign({ title: 'Are you sure?', message: '', confirmLabel: 'Continue', cancelLabel: 'Cancel', danger: false }, typeof options === 'string' ? { message: options } : options);
    return new Promise(resolve => {
      const opener = doc.activeElement;
      const uid = 'dlg' + Math.random().toString(36).slice(2, 8);
      const backdrop = doc.createElement('div');
      backdrop.className = 'dialog-backdrop';
      backdrop.innerHTML = `
        <div class="dialog dialog--confirm" role="alertdialog" aria-modal="true" aria-labelledby="${uid}-t" aria-describedby="${uid}-d">
          <div class="dialog__head"><h2 class="dialog__title" id="${uid}-t"></h2></div>
          <div class="dialog__body" id="${uid}-d"></div>
          <div class="dialog__foot">
            <button type="button" class="btn" data-act="cancel"></button>
            <button type="button" class="btn ${o.danger ? 'btn-danger-solid' : 'btn-primary'}" data-act="ok"></button>
          </div>
        </div>`;
      backdrop.querySelector('.dialog__title').textContent = o.title;
      backdrop.querySelector('.dialog__body').textContent = o.message;
      backdrop.querySelector('[data-act="cancel"]').textContent = o.cancelLabel;
      backdrop.querySelector('[data-act="ok"]').textContent = o.confirmLabel;
      const regions = [doc.querySelector('.site-header'), ...pageRegions()].filter(Boolean);
      const previous = regions.map(el => el.inert);
      regions.forEach(el => { el.inert = true; });
      doc.body.appendChild(backdrop);
      const ok = backdrop.querySelector('[data-act="ok"]');
      const cancel = backdrop.querySelector('[data-act="cancel"]');
      (o.danger ? cancel : ok).focus();
      function done(result) {
        doc.removeEventListener('keydown', onKey, true);
        backdrop.remove();
        regions.forEach((el, i) => { el.inert = previous[i]; });
        if (opener && typeof opener.focus === 'function' && doc.contains(opener)) opener.focus();
        resolve(result);
      }
      function onKey(e) {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); done(false); }
        else if (e.key === 'Tab') {
          const items = [cancel, ok];
          const i = items.indexOf(doc.activeElement);
          e.preventDefault();
          items[(i + (e.shiftKey ? -1 : 1) + items.length) % items.length].focus();
        }
      }
      doc.addEventListener('keydown', onKey, true);
      backdrop.addEventListener('mousedown', e => { if (e.target === backdrop) done(false); });
      ok.addEventListener('click', () => done(true));
      cancel.addEventListener('click', () => done(false));
    });
  }

  window.ApplyReadyUI = Object.assign(window.ApplyReadyUI || {}, { notify, reveal, confirm: confirmDialog });

  /* ----------------------------------------------- Offline support (PWA) */
  if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
    window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => {}); });
  }
})();
