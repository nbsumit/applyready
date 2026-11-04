/* Manual AdSense slots only. The loader in the page head stays async.
   A slot is requested when it nears the viewport, and an unfilled unit collapses.
   Auto ads are not turned on here: no anchors, vignettes or interstitials. */
(function () {
  var preview = /(?:\?|&)adpreview=1(?:&|$)/.test(location.search);
  if (preview) document.documentElement.classList.add('ad-preview');

  var slots = Array.prototype.slice.call(document.querySelectorAll('.ad-slot-container'));
  if (!slots.length) return;

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
    var ins = slot.querySelector('ins.adsbygoogle');
    if (!ins || ins.getAttribute('data-adsbygoogle-status')) return;
    slot.setAttribute('data-ad-armed', '1');
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (err) {
      collapse(slot);
      return;
    }
    watch(slot, ins);
  }

  // push() fills the next unit in document order, so a later slot must not jump the queue.
  function flush() {
    for (var i = 0; i < slots.length; i++) {
      var slot = slots[i];
      if (!slot.querySelector('ins.adsbygoogle')) continue;
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
