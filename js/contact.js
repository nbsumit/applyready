/* The contact form has no server: it opens the visitor's email app with the message filled in.
   Nothing is sent from this page. */
(function () {
  const ADDRESS = 'hello@nbsumit.com';
  const form = document.getElementById('contactForm');
  if (!form) return;
  const subjectField = document.getElementById('contactSubject');
  const messageField = document.getElementById('contactMessage');
  const errorNode = document.getElementById('contactMessageError');

  function showError(text) {
    errorNode.textContent = text;
    errorNode.hidden = !text;
    messageField.setAttribute('aria-invalid', text ? 'true' : 'false');
  }

  messageField.addEventListener('input', () => { if (!errorNode.hidden && messageField.value.trim()) showError(''); });

  form.addEventListener('submit', event => {
    event.preventDefault();
    const message = messageField.value.trim();
    if (!message) {
      showError('Write a message before composing the email.');
      messageField.focus();
      return;
    }
    showError('');
    const subject = encodeURIComponent('[ApplyReady] ' + subjectField.value);
    window.location.href = 'mailto:' + ADDRESS + '?subject=' + subject + '&body=' + encodeURIComponent(message);
    const ui = window.ApplyReadyUI;
    if (ui && ui.notify) ui.notify('Your email app should open with the message. If nothing opens, write to ' + ADDRESS + '.');
  });
})();
