/* Loads the AdSense script only on pages that have slots, and only after the page
   has loaded: on the first interaction, or later from requestIdleCallback.
   Slots without a real unit stay hidden in CSS. An unfilled unit collapses. */
(function () {
  var CLIENT = 'ca-pub-2713609207324356';
  var preview = /(?:\?|&)adpreview=1(?:&|$)/.test(location.search);
  if (preview) document.documentElement.classList.add('ad-preview');

  var slots = Array.prototype.slice.call(document.querySelectorAll('.ad-slot-container'));
  if (!slots.length) return;

  var loaded = false;
  function inject() {
    if (loaded || document.querySelector('script[src*="adsbygoogle.js"]')) { loaded = true; return; }
    loaded = true;
    var script = document.createElement('script');
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + CLIENT;
    document.head.appendChild(script);
  }

  function schedule() {
    var start = function () { inject(); };
    ['pointerdown', 'keydown', 'scroll'].forEach(function (type) {
      window.addEventListener(type, start, { once: true, passive: true });
    });
    var ric = window.requestIdleCallback || function (fn) { setTimeout(fn, 12000); };
    ric(function () { setTimeout(start, 12000); }, { timeout: 15000 });
  }
  if (document.readyState === 'complete') schedule();
  else window.addEventListener('load', schedule);

  function collapse(slot) {
    slot.classList.add('is-collapsed');
    slot.setAttribute('hidden', '');
  }

  function watch(slot, ins) {
    var n = 0;
    var timer = setInterval(function () {
      n += 1;
      var status = ins.getAttribute('data-ad-status');
      if (status === 'filled' || ins.querySelector('iframe')) { clearInterval(timer); return; }
      if (status === 'unfilled' || n >= 16) { clearInterval(timer); collapse(slot); }
    }, 250);
  }

  function arm(slot) {
    if (slot.getAttribute('data-ad-armed') === '1') return;
    var ins = slot.querySelector('ins.adsbygoogle[data-ad-slot]');
    if (!ins || ins.getAttribute('data-adsbygoogle-status')) return;
    slot.setAttribute('data-ad-armed', '1');
    inject();
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (err) {
      collapse(slot);
      return;
    }
    watch(slot, ins);
  }

  function flush() {
    for (var i = 0; i < slots.length; i++) {
      var slot = slots[i];
      if (!slot.querySelector('ins.adsbygoogle[data-ad-slot]')) continue;
      if (slot.getAttribute('data-ad-armed') === '1') continue;
      if (slot.getAttribute('data-ad-seen') !== '1') return;
      arm(slot);
    }
  }

  if (!('IntersectionObserver' in window)) {
    slots.forEach(function (slot) { slot.setAttribute('data-ad-seen', '1'); });
    flush();
    return;
  }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      io.unobserve(entry.target);
      entry.target.setAttribute('data-ad-seen', '1');
      flush();
    });
  }, { rootMargin: '400px 0px' });
  slots.forEach(function (slot) { io.observe(slot); });
})();
