document.getElementById('contactForm')?.addEventListener('submit', function (event) {
  event.preventDefault();
  const subject = encodeURIComponent('[ApplyReady] ' + document.getElementById('contactSubject').value);
  const message = encodeURIComponent(document.getElementById('contactMessage').value);
  window.location.href = 'mailto:hello@nbsumit.com?subject=' + subject + '&body=' + message;
});
