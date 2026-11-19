/* The offline page (offline.html): the service worker shows it for a page this browser never kept,
   while there is no connection. It offers only the pages that are kept on this device, so each
   button opens a working page instead of this one again.

   What is kept is read from Cache Storage: sw.js keeps each file in the cache "applyready-files"
   under its path and a content hash, so a page is found with ignoreSearch. The buttons are shown
   only when their page is kept, and every other kept page (a tool, a KB preset page, a guide) is
   listed below them, named by its heading. A PDF tool is kept as a page, but works on files only
   once its PDF library is kept too (the vendor cache, filled the first time a PDF tool is used online
   or by "Save every tool"): until then it is marked as needing a connection the first time.
   Opened directly while online, every link works and all are shown. If Cache Storage cannot be read, the links are left as they are. Nothing is stored or
   sent. */
(function () {
  'use strict';
  const actions = document.getElementById('offlineActions');
  if (!actions) return;
  const status = document.getElementById('offlineStatus');
  const savedBox = document.getElementById('offlineSavedBox');
  const savedList = document.getElementById('offlineSaved');
  const FILES_CACHE = 'applyready-files'; // CACHE_NAME in sw.js

  // Shown in place of a page that was not kept (the address is still that page's), or opened
  // directly without a connection.
  const fallback = location.pathname !== '/offline.html';
  if (!fallback && navigator.onLine !== false) return;
  if (!('caches' in window) || typeof caches.match !== 'function' || typeof caches.open !== 'function') return;

  const pathOf = a => { try { const u = new URL(a.getAttribute('href'), location.href); return u.origin === location.origin ? u.pathname : null; } catch (e) { return null; } };
  const kept = p => caches.match(p, { ignoreSearch: true }).then(r => !!r, () => null);
  // A page, not a file: /merge-pdf.html, /guides/, or an address without an extension.
  const isPage = p => p.endsWith('/') || p.endsWith('.html') || !/\.[a-z0-9]+$/i.test(p.slice(p.lastIndexOf('/') + 1));
  const NOT_LISTED = new Set(['/offline.html', '/404.html', location.pathname]);

  // A kept page's name, its main heading, and whether it is a PDF tool (it loads js/lib/pdf-kit.js),
  // read from the cached copy as text (nothing in it runs or loads).
  async function readPage(response) {
    if (!/text\/html/i.test(response.headers.get('content-type') || 'text/html')) return null;
    const html = await response.text();
    const pdf = /<script[^>]+src="[^"]*js\/lib\/pdf-kit\.js/i.test(html);
    const m = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || html.match(/<title>([\s\S]*?)<\/title>/i);
    if (!m) return { name: null, pdf };
    const t = document.createElement('template');
    t.innerHTML = m[1];
    const text = t.content.textContent.replace(/\s+/g, ' ').replace(/\s*\|\s*ApplyReady\s*$/, '').trim();
    return { name: text || null, pdf };
  }
  // The PDF tools' libraries (VENDOR_ASSETS in sw.js) are kept in their own cache once used.
  const pdfLibraryKept = () => Promise.all(['/js/vendor/pdf-lib.min.js', '/js/vendor/pdfjs/pdf.min.mjs'].map(p => caches.match(p, { ignoreSearch: true })))
    .then(r => r.every(Boolean), () => true);

  // Every page kept on this device, as [path, request] in the order the cache holds them.
  async function keptPages() {
    const cache = await caches.open(FILES_CACHE);
    const pages = new Map();
    for (const request of await cache.keys()) {
      let url;
      try { url = new URL(request.url); } catch (e) { continue; }
      if (url.origin !== location.origin || !isPage(url.pathname)) continue;
      const p = url.pathname.endsWith('/index.html') ? url.pathname.slice(0, -'index.html'.length) : url.pathname;
      if (!pages.has(p)) pages.set(p, request);
    }
    return { cache, pages };
  }

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

    // Every other kept page, so a visitor who opened, say, Merge PDF, a KB preset page or a guide
    // finds it here. Pages in the site index (footer) keep its short names and order; the others
    // (preset pages, guides) follow, named by their heading.
    let list = [];
    const libraryKept = await pdfLibraryKept();
    try {
      const { cache, pages } = await keptPages();
      const shown = new Set(buttons.map(pathOf));
      const footerName = new Map();
      document.querySelectorAll('.site-footer__list a[href]').forEach(a => { const p = pathOf(a); if (p && !footerName.has(p)) footerName.set(p, a.textContent.trim()); });
      const footerOrder = [...footerName.keys()];
      const candidates = [...pages.keys()].filter(p => !NOT_LISTED.has(p) && !shown.has(p));
      const named = await Promise.all(candidates.map(async p => {
        let page = null;
        try { const r = await cache.match(pages.get(p)); page = r ? await readPage(r) : null; } catch (e) { page = null; }
        const name = footerName.get(p) || (page && page.name);
        return name ? { path: p, name, needsLibrary: !libraryKept && !!(page && page.pdf) } : null;
      }));
      const rank = e => (footerName.has(e.path) ? footerOrder.indexOf(e.path) : e.path.startsWith('/guides/') ? 2000 : 1000);
      list = named.filter(Boolean).sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
    } catch (e) { list = []; }

    if (savedList && savedBox && list.length) {
      savedList.replaceChildren(...list.map(e => {
        const li = document.createElement('li');
        const link = document.createElement('a');
        link.href = e.path;
        link.textContent = e.name;
        li.append(link);
        if (e.needsLibrary) li.append(document.createTextNode(': opens, but needs a connection the first time it works on a file'));
        return li;
      }));
      // With no button above it, the list is not "other" pages.
      const title = document.getElementById('offlineSavedTitle');
      if (title && !first) title.textContent = 'Pages kept on this device';
      savedBox.hidden = false;
    }
    if (status) {
      const waiting = list.filter(e => e.needsLibrary).length;
      status.textContent = first || list.length
        ? `These pages are kept on this device and open without a connection.${waiting ? ` ${waiting === 1 ? 'The PDF tool marked below opens, but cannot work on files' : 'The PDF tools marked below open, but cannot work on files'} until the PDF library is kept on this device: use a PDF tool once while online, or save every tool on Your data.` : ''}`
        : 'No other ApplyReady page is kept on this device yet, so there is nothing to open until you are back online.';
      status.hidden = false;
    }
  })();
})();
