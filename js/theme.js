/* Apply before paint, including when browser storage is unavailable. */
(function () {
  var preference;
  try { preference = localStorage.getItem('applyready_theme'); } catch (e) {}
  var theme = preference === 'light' || preference === 'dark' ? preference
    : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', theme);
})();
