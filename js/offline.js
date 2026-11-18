/* The offline page (offline.html): the service worker shows it for a page this browser never kept,
   while there is no connection. It offers only the pages that are kept on this device, so each
   button opens a working page instead of this one again.

   What is kept is read from Cache Storage (sw.js keeps each file under its path and a content hash,
   so a page is found with ignoreSearch). Opened directly while online, every link works and all are
   shown. If Cache Storage cannot be read, the links are left as they are. Nothing is stored or sent. */
(function () {
  'use strict';
  const actions = document.getElementById('offlineActions');
  if (!actions) return;
  const status = document.getElementById('offlineStatus');
  const savedBox = document.getElementById('offlineSavedBox');
  const savedList = document.getElementById('offlineSaved');

  // Shown in place of a page that was not kept (the address is still that page's), or opened
  // directly without a connection.
  const fallback = location.pathname !== '/offline.html';
  if (!fallback && navigator.onLine !== false) return;
  if (!('caches' in window) || typeof caches.match !== 'function') return;

  const pathOf = a => { try { const u = new URL(a.getAttribute('href'), location.href); return u.origin === location.origin ? u.pathname : null; } catch (e) { return null; } };
  const kept = p => caches.match(p, { ignoreSearch: true }).then(r => !!r, () => null);

  (async function () {
    const buttons = Array.from(actions.querySelectorAll('a[href]'));
    const results = await Promise.all(buttons.map(a => { const p = pathOf(a); return p ? kept(p) : Promise.resolve(null); }));
    if (results.some(r => r === null)) return; // the cache could not be read: leave every link
    buttons.forEach((a, i) => { a.hidden = !results[i]; });
    // The first page that opens is the main action.
    buttons.forEach(a => a.classList.remove('btn-primary'));
    const first = buttons.find(a => !a.hidden);
    if (first) first.classList.add('btn-primary');
    actions.hidden = !first;

    // Other tools and pages from the site index (footer) that are kept, so a visitor who opened, say,
    // Merge PDF and Compress PDF finds them here.
    const shown = new Set(buttons.map(pathOf));
    const seen = new Set();
    const others = Array.from(document.querySelectorAll('.site-footer__list a[href]')).filter(a => {
      const p = pathOf(a);
      if (!p || p === '/offline.html' || shown.has(p) || seen.has(p)) return false;
      seen.add(p);
      return true;
    });
    const otherKept = await Promise.all(others.map(a => kept(pathOf(a))));
    const list = others.filter((a, i) => otherKept[i]);
    if (savedList && savedBox && list.length) {
      savedList.replaceChildren(...list.map(a => {
        const li = document.createElement('li');
        const link = document.createElement('a');
        link.href = a.getAttribute('href');
        link.textContent = a.textContent.trim();
        li.append(link);
        return li;
      }));
      savedBox.hidden = false;
    }
    if (status) {
      status.textContent = first || list.length
        ? 'These pages are kept on this device and open without a connection.'
        : 'No other ApplyReady page is kept on this device yet, so there is nothing to open until you are back online.';
      status.hidden = false;
    }
  })();
})();
