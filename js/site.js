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
    // The page carries a light and a dark theme-color; an explicit choice overrides both.
    doc.querySelectorAll('meta[name="theme-color"]').forEach(meta => { meta.content = theme === 'dark' ? '#1a1a19' : '#ffffff'; });
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

  /* ----------------------------------------------------- On-screen keyboard */
  // Sticky bars (the resume Edit/Preview bar, a tool's action bar) step aside only while the on-screen
  // keyboard is actually open, so they never cover the field being typed in.
  // Two ways a keyboard shows: the visual viewport shrinks inside the page (most browsers), or the
  // page itself shrinks (in-app browsers, interactive-widget=resizes-content). The second is seen
  // as the window becoming much shorter than its full height at the same width, on a touch screen.
  if (window.visualViewport) {
    const vv = window.visualViewport;
    const touch = window.matchMedia('(pointer: coarse)');
    let fullHeight = window.innerHeight, fullWidth = window.innerWidth;
    const sync = () => {
      if (window.innerWidth !== fullWidth) { fullWidth = window.innerWidth; fullHeight = window.innerHeight; }
      const field = doc.activeElement && /^(INPUT|TEXTAREA)$/.test(doc.activeElement.tagName) && !/^(checkbox|radio|range|color|file|button|submit|reset|image)$/.test(doc.activeElement.type);
      if (!field) fullHeight = Math.max(fullHeight, window.innerHeight);
      const keyboard = window.innerHeight - vv.height > 150 || (touch.matches && fullHeight - window.innerHeight > 150);
      doc.body.classList.toggle('is-typing', !!field && keyboard);
    };
    window.addEventListener('resize', sync);
    vv.addEventListener('resize', sync);
    vv.addEventListener('scroll', sync);
    doc.addEventListener('focusin', () => setTimeout(sync, 150));
    doc.addEventListener('focusout', () => setTimeout(sync, 150));
  }

  /* ----------------------------------------------------- Guide screenshots */
  // A screenshot can be a <picture> with a phone capture for narrow windows. "Open full size" opens the
  // picture actually shown, so a phone opens the phone capture, not the wide desktop one. The phone
  // capture is not part of the offline copy: if it cannot load (offline, never seen), fall back to the
  // desktop picture, which is.
  doc.querySelectorAll('.shot picture > img').forEach(img => {
    const link = img.closest('.shot__full');
    const point = () => { if (link && img.currentSrc) link.href = img.currentSrc; };
    const fallback = () => {
      const sources = img.parentElement.querySelectorAll('source');
      if (!sources.length) return;
      sources.forEach(s => s.remove());
      if (link) link.href = img.getAttribute('src');
    };
    img.addEventListener('load', point);
    img.addEventListener('error', fallback);
    // It may have finished, or failed, before this script ran.
    if (img.complete && img.currentSrc) { if (img.naturalWidth) point(); else fallback(); }
  });

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
  // Two live regions exist from page load, one polite and one assertive, so screen readers are
  // already listening when the first message arrives (a region created and filled in the same tick
  // is often not announced). The visible toast is a separate element.
  let notifyTimer;
  const liveRegions = {};
  function liveRegion(kind) {
    if (liveRegions[kind]) return liveRegions[kind];
    const node = doc.createElement('div');
    node.className = 'sr-only';
    node.setAttribute('aria-live', kind);
    node.setAttribute('aria-atomic', 'true');
    doc.body.appendChild(node);
    liveRegions[kind] = node;
    return node;
  }
  liveRegion('polite'); liveRegion('assertive');
  function notify(message, error = false) {
    let node = doc.getElementById('taskNotification');
    if (!node) {
      node = doc.createElement('div');
      node.id = 'taskNotification'; node.className = 'task-notification';
      node.setAttribute('aria-hidden', 'true');
      doc.body.appendChild(node);
    }
    clearTimeout(notifyTimer);
    node.textContent = message;
    node.classList.toggle('is-error', error);
    node.classList.add('is-visible');
    const region = liveRegion(error ? 'assertive' : 'polite');
    region.textContent = '';
    setTimeout(() => { region.textContent = message; }, 50);
    notifyTimer = setTimeout(() => node.classList.remove('is-visible'), error ? 9000 : 4500);
  }

  // How much of the top and bottom of the screen sticky bars cover beside `el`: the site header and
  // the tool's action bar (sticky on phones). A bar counts whether or not it is stuck right now,
  // because scrolling can make it stick.
  function coveredEdges(el) {
    const box = el.getBoundingClientRect();
    const ws = el.closest && el.closest('.ws');
    const bars = [header].concat(ws ? Array.from(ws.querySelectorAll('.ws-action')) : []);
    let top = 0, bottom = 0;
    bars.forEach(bar => {
      if (!bar) return;
      const cs = getComputedStyle(bar);
      if (cs.display === 'none' || cs.visibility === 'hidden' || !/^(sticky|fixed)$/.test(cs.position)) return;
      const r = bar.getBoundingClientRect();
      if (!r.height || r.right <= box.left || r.left >= box.right) return;
      if (cs.top === 'auto' && cs.bottom !== 'auto') bottom = Math.max(bottom, r.height + (parseFloat(cs.bottom) || 0));
      else top = Math.max(top, r.height + (parseFloat(cs.top) || 0));
    });
    return { top, bottom };
  }

  /**
   * Bring a finished result into view, clear of the sticky header and action bar. `target` is the
   * control that will get focus (usually Download): it must end up fully visible, which matters
   * most on phones. Nothing moves when the result's top and the target are already in the clear
   * band, unless opts.align asks for the result to start at the top of it.
   */
  function reveal(el, target, opts) {
    if (!el || typeof el.getBoundingClientRect !== 'function') return;
    // Measured in the next frame: showing a result changes the workspace state (js/components.js),
    // which hides and shows other parts above it, so measuring now would aim at the old layout.
    const run = () => revealNow(el, target, opts || {});
    if (window.requestAnimationFrame) requestAnimationFrame(run); else setTimeout(run, 0);
  }
  function revealNow(el, target, o) {
    if (!el.isConnected) return;
    const gap = 12;
    const edges = coveredEdges(el);
    // At least the page's own scroll padding (header plus a gap), so a result lands where links to it do.
    const pad = parseFloat(getComputedStyle(root).scrollPaddingTop) || 0;
    const lo = Math.max(edges.top + gap, pad), hi = window.innerHeight - edges.bottom - gap;
    const r = el.getBoundingClientRect();
    const t = target && typeof target.getBoundingClientRect === 'function' && target.getClientRects().length ? target.getBoundingClientRect() : null;
    const headVisible = r.top >= edges.top && r.top < lo + (hi - lo) * 0.6;
    let delta = o.align || !headVisible ? r.top - lo : 0;
    if (t) {
      if (t.bottom - delta > hi) delta = t.bottom - hi;   // the target wins over the heading
      if (t.top - delta < lo) delta = t.top - lo;
    }
    if (Math.abs(delta) < 2) return;
    window.scrollBy({ top: delta, behavior: reduceMotion() ? 'auto' : 'smooth' });
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

  /* ----------------------------------------------------------- Search */
  // The index and search code load on first use, so pages that never search pay nothing for it.
  const scriptBase = (() => { const s = doc.querySelector('script[src*="js/site.js"]'); return s ? s.getAttribute('src').replace(/js\/site\.js.*$/, '') : '/'; })();
  function loadScript(file) {
    return new Promise((resolve, reject) => {
      if (doc.querySelector(`script[data-lazy="${file}"]`)) { resolve(); return; }
      const el = doc.createElement('script');
      el.src = scriptBase + file;
      el.dataset.lazy = file;
      el.onload = resolve; el.onerror = reject;
      doc.head.appendChild(el);
    });
  }
  async function openSearch() {
    try {
      if (!window.APPLYREADY_TOOL_INDEX) await loadScript('js/tool-index.js');
      if (!window.ApplyReadySearch) await loadScript('js/search.js');
      window.ApplyReadySearch.open();
    } catch (e) {
      location.href = scriptBase + 'tools.html';
    }
  }
  const searchButton = doc.getElementById('searchOpen');
  if (searchButton) searchButton.addEventListener('click', () => { if (header && header.dataset.open === 'true') setNav(false); openSearch(); });
  doc.addEventListener('keydown', e => {
    const target = e.target;
    const typing = target && (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable);
    if ((e.key === '/' && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) || ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K'))) {
      if (doc.querySelector('.dialog-backdrop')) return;
      e.preventDefault();
      openSearch();
    }
  });

  /* ------------------------------------------------- Recently used tools */
  // Only the tool's id is kept (for example "merge-pdf"), never a file name or anything typed.
  // "Your data" can clear the list or switch it off.
  (function rememberTool() {
    const meta = doc.querySelector('meta[name="applyready-tool"]');
    if (!meta) return;
    try {
      if (localStorage.getItem('applyready_recent_off') === '1') return;
      const id = meta.content;
      const list = JSON.parse(localStorage.getItem('applyready_recent_tools') || '[]').filter(x => typeof x === 'string' && x !== id);
      list.unshift(id);
      localStorage.setItem('applyready_recent_tools', JSON.stringify(list.slice(0, 6)));
    } catch (e) { /* storage may be unavailable; recents are optional */ }
  })();

  window.ApplyReadyUI = Object.assign(window.ApplyReadyUI || {}, { notify, reveal, confirm: confirmDialog, openSearch });

  /* ----------------------------------------------- Offline support (PWA) */
  // The service worker keeps the pages this browser opens (sw.js). A page loaded before it was in
  // control tells it which of the site's files it used, and the service worker copies them from the
  // browser's HTTP cache, so this page works offline without anything being downloaded twice.
  if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
    window.addEventListener('load', () => {
      const controlled = !!navigator.serviceWorker.controller;
      navigator.serviceWorker.register('/sw.js').then(() => {
        if (controlled) return null;
        return navigator.serviceWorker.ready.then(reg => {
          const loaded = [location.href].concat(performance.getEntriesByType ? performance.getEntriesByType('resource').map(e => e.name) : []);
          const urls = loaded.filter(u => { try { return new URL(u).origin === location.origin; } catch (e) { return false; } });
          if (reg.active) reg.active.postMessage({ type: 'cache-page', urls: urls.slice(0, 300) });
        });
      }).catch(() => {});
    });
  }
})();
