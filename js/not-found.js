/* The 404 page: sends old addresses of pages that moved to their new page, explains pages that
   were removed and where their content went, and offers the pages whose words match a mistyped
   address. GitHub Pages serves 404.html for every missing path, so this one map covers them all.
   Runs after js/search.js (both deferred), so window.ApplyReadySearch already exists. */
(function () {
  'use strict';
  const path = decodeURIComponent(location.pathname).replace(/^\/+/, '').toLowerCase();

  // Pages whose content now lives at another address: go straight there, as a redirect stub would.
  const MOVED = {
    'guides/compression-targets-guide.html': 'guides/how-to-reduce-photo-to-50kb-without-blur.html',
    'guides/image-dimensions-vs-file-size.html': 'guides/pixels-cm-inches-dpi-explained.html',
    'guides/why-was-my-photo-rejected-online-applications.html': 'guides/fix-common-photo-upload-errors.html'
  };

  // Pages that were removed: say so plainly and point to what replaces them.
  const REMOVED = [
    {
      // Photo and signature sizes for particular recruitment portals (English and Hindi pages).
      match: /^(hi\/)?[a-z]+-photo-signature-size\.html$/,
      title: 'This page was removed',
      text: 'ApplyReady no longer lists photo and signature sizes for particular recruitment portals, because they change with every notice. Check the size in the official notice, then set it in the passport photo resizer or the signature resizer.',
      links: [['/passport-photo-resizer.html', 'Open the passport photo resizer', 'fa-id-badge'], ['/signature-resizer.html', 'Open the signature resizer', 'fa-signature']]
    },
    {
      match: /^guides\/aadhaar-pan-passport-photo-specifications\.html$/,
      title: 'This guide was removed',
      text: 'ApplyReady no longer lists photo sizes for identity documents. How to take a clean passport-style photo is covered in the guide below, and the passport photo resizer sets any size a form asks for.',
      links: [['/guides/passport-photo-at-home-guide.html', 'Read the passport photo guide', 'fa-book-open'], ['/passport-photo-resizer.html', 'Open the passport photo resizer', 'fa-id-badge']]
    },
    {
      match: /^guides\/(application-email-and-cover-letter-for-freshers|campus-placement-interview-prep-guide)\.html$/,
      title: 'This guide was removed',
      text: 'It is no longer part of ApplyReady. The guides page lists every current guide.',
      links: [['/guides/', 'Browse the guides', 'fa-book-open']]
    },
    {
      match: /^(editorial-policy\.html|author\/)/,
      title: 'This page was removed',
      text: 'Who makes ApplyReady, how it works and how to report a mistake are now on the About page.',
      links: [['/about.html', 'Read about ApplyReady', 'fa-circle-info']]
    }
  ];

  const movedTo = MOVED[path] || MOVED[path.replace(/\.html$/, '')];
  if (movedTo) { location.replace('/' + movedTo); return; }

  const title = document.getElementById('notFoundTitle');
  const text = document.getElementById('notFoundText');
  const box = document.getElementById('notFoundMoved');
  if (!title || !text || !box) return;

  // Put links in the page flow, above the search box and the general buttons, so nothing covers them.
  function showLinks(links) {
    box.replaceChildren(...links.map(([href, label, icon], i) => {
      const a = document.createElement('a');
      a.href = href;
      a.className = i === 0 ? 'btn btn-primary btn-lg' : 'btn btn-lg';
      const ic = document.createElement('i');
      ic.className = `fa-solid ${icon}`;
      ic.setAttribute('aria-hidden', 'true');
      a.append(ic, ' ' + label);
      return a;
    }));
    box.hidden = false;
    // The general buttons stay below; the first of them is no longer the main action.
    const primary = box.parentElement.querySelector('.actions:not(#notFoundMoved) .btn-primary');
    if (primary) primary.classList.remove('btn-primary');
  }

  const removed = REMOVED.find(r => r.match.test(path));
  if (removed) {
    title.textContent = removed.title;
    text.textContent = removed.text;
    showLinks(removed.links);
    return;
  }

  // A mistyped or old address often still names the task ("merge-pdfs.html"). Offer the pages that
  // match every word of it as plain links. A loose match (one letter off, or only some of the words)
  // is not offered: a wrong guess sends people somewhere unrelated, and the search box is there.
  const STOP = new Set(['a', 'an', 'the', 'my', 'for', 'of', 'in', 'on', 'and', 'or', 'how', 'to', 'do', 'i', 'me', 'us', 'with', 'from', 'into', 'online', 'free', 'tool', 'tools', 'page', 'pages', 'index', 'html', 'htm', 'www', 'new', 'old']);
  const tokens = (path.split('/').pop() || '').replace(/\.html?$/, '').split(/[^a-z0-9]+/).filter(t => t && !STOP.has(t));
  const search = window.ApplyReadySearch;
  if (!tokens.length || tokens.join('').length < 2 || !search) return;
  const wordsOf = item => [item.name, item.path.replace(/\.html$/, ''), ...(item.keywords || [])].join(' ').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  // "pdfs" matches "pdf", "merg" matches "merge"; short fragments and typos do not count.
  const covers = (words, t) => words.some(w => w === t || (t.length >= 4 && w.startsWith(t)) || (w.length >= 3 && t.startsWith(w) && t.length - w.length <= 2));
  const matches = search.search(tokens.join(' '), 8).filter(item => { const w = wordsOf(item); return tokens.every(t => covers(w, t)); }).slice(0, 3);
  if (!matches.length) return;
  text.textContent = `This address does not lead anywhere, but its words match the ${matches.length === 1 ? 'page' : 'pages'} below. You can also search for what you need, or start from one of the general pages.`;
  showLinks(matches.map(item => ['/' + item.path, item.name, 'fa-' + (item.icon || 'arrow-right')]));
})();
