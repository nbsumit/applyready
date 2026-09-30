/* Shared navigation, theme controls, and unobtrusive task feedback. */
(function () {
  'use strict';
  const toggle = document.getElementById('themeToggle');
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  let explicitTheme = false;
  try { explicitTheme = ['light', 'dark'].includes(localStorage.getItem('applyready_theme')); } catch (e) {}
  function setTheme(theme) {
    document.documentElement.dataset.theme = theme;
    if (toggle) {
      toggle.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`);
      toggle.title = toggle.getAttribute('aria-label');
      toggle.innerHTML = `<i class="fa-solid fa-${theme === 'dark' ? 'sun' : 'moon'}" aria-hidden="true"></i>`;
    }
    const color = document.querySelector('meta[name="theme-color"]');
    if (color) color.content = theme === 'dark' ? '#0d1423' : '#f6f8fc';
  }
  setTheme(document.documentElement.dataset.theme || 'light');
  if (toggle) toggle.addEventListener('click', () => {
    const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    explicitTheme = true;
    try { localStorage.setItem('applyready_theme', theme); } catch (e) {}
    setTheme(theme);
  });
  media.addEventListener('change', e => { if (!explicitTheme) setTheme(e.matches ? 'dark' : 'light'); });

  const menuButton = document.getElementById('navMenuToggle');
  const menu = document.getElementById('navMenu');
  function closeMenu() {
    if (!menuButton || !menu) return;
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.setAttribute('aria-label', 'Open navigation menu');
    menu.classList.remove('is-open');
  }
  if (menuButton && menu) {
    menuButton.addEventListener('click', () => {
      const expanded = menuButton.getAttribute('aria-expanded') !== 'true';
      menuButton.setAttribute('aria-expanded', String(expanded));
      menuButton.setAttribute('aria-label', expanded ? 'Close navigation menu' : 'Open navigation menu');
      menu.classList.toggle('is-open', expanded);
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && menu.classList.contains('is-open')) { closeMenu(); menuButton.focus(); }
    });
    document.addEventListener('click', e => { if (!e.target.closest('.nav-container')) closeMenu(); });
    window.addEventListener('resize', () => { if (window.innerWidth > 760) closeMenu(); });
  }

  // Arrow keys supplement normal tab navigation in both workspace tab lists.
  document.querySelectorAll('[role="tablist"]').forEach(list => {
    const tabs = Array.from(list.querySelectorAll('[role="tab"]'));
    function sync() { tabs.forEach(tab => { tab.tabIndex = tab.getAttribute('aria-selected') === 'true' ? 0 : -1; }); }
    tabs.forEach(tab => tab.addEventListener('click', () => queueMicrotask(sync)));
    list.addEventListener('keydown', e => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
      let i = tabs.indexOf(document.activeElement);
      if (i < 0) return;
      e.preventDefault();
      i = e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1
        : (i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
      tabs[i].click(); tabs[i].focus(); sync();
    });
    sync();
  });

  let notificationTimer;
  window.ApplyReadyUI = {
    notify(message, error = false) {
      let node = document.getElementById('taskNotification');
      if (!node) {
        node = document.createElement('div');
        node.id = 'taskNotification'; node.className = 'task-notification';
        node.setAttribute('role', 'status'); node.setAttribute('aria-live', 'polite');
        document.body.appendChild(node);
      }
      clearTimeout(notificationTimer);
      node.textContent = message; node.classList.toggle('is-error', error);
      node.classList.add('is-visible');
      notificationTimer = setTimeout(() => node.classList.remove('is-visible'), error ? 9000 : 4500);
    }
  };
})();
