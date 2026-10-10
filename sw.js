/**
 * ApplyReady.in - Service Worker (PWA Offline Support)
 * 100% Client-Side Caching for Offline Resizer, Resume Builder & PDF Tools
 */

const CACHE_NAME = 'applyready-v3';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/resume.html',
  '/how-to-use.html',
  '/about.html',
  '/privacy.html',
  '/terms.html',
  '/contact.html',
  '/404.html',
  '/guides/',
  '/guides/index.html',
  '/guides/ats-friendly-resume-guide.html',
  '/guides/compression-targets-guide.html',
  '/guides/image-dimensions-vs-file-size.html',
  '/guides/image-formats-guide.html',
  '/guides/aadhaar-pan-passport-photo-specifications.html',
  '/guides/why-was-my-photo-rejected-online-applications.html',
  '/guides/fresher-resume-examples-by-role.html',
  '/guides/resume-summary-examples-indian-freshers.html',
  '/guides/cv-vs-resume-india-job-applications.html',
  '/guides/campus-placement-interview-prep-guide.html',
  '/hi/ssc-photo-signature-size.html',
  '/hi/upsc-photo-signature-size.html',
  '/hi/rrb-photo-signature-size.html',
  '/hi/ibps-photo-signature-size.html',
  '/hi/neet-photo-signature-size.html',
  '/ssc-photo-signature-size.html',
  '/upsc-photo-signature-size.html',
  '/ibps-photo-signature-size.html',
  '/neet-photo-signature-size.html',
  '/rrb-photo-signature-size.html',
  '/resize-image-to-10kb.html',
  '/resize-image-to-20kb.html',
  '/resize-image-to-50kb.html',
  '/resize-image-to-100kb.html',
  '/resize-image-to-200kb.html',
  '/signature-cleaner.html',
  '/image-to-pdf.html',
  '/compress-pdf.html',
  '/passport-photo-print.html',
  '/css/style.css',
  '/css/workspace.css',
  '/css/vendor/icons.min.css',
  '/css/vendor/cropper.min.css',
  '/js/site.js',
  '/js/theme.js',
  '/js/resizer.js',
  '/js/signature-cleaner.js',
  '/js/image-to-pdf.js',
  '/js/compress-pdf.js',
  '/js/passport-photo-print.js',
  '/js/resume.js',
  '/js/templates.js',
  '/js/pdf-engine.js',
  '/js/docx-engine.js',
  '/js/keywords.js',
  '/js/resume-schema.js',
  '/js/vendor/cropper.min.js',
  '/favicon/favicon.ico',
  '/favicon/favicon-32x32.png',
  '/favicon/favicon-16x16.png',
  '/favicon/android-chrome-192x192.png',
  '/favicon/android-chrome-512x512.png',
  '/favicon/apple-touch-icon.png',
  '/favicon/site.webmanifest'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
      .catch(() => {})
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Only handle same-origin requests
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;

      return fetch(request).then(response => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const cloned = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, cloned));
        return response;
      }).catch(() => {
        if (request.headers.get('accept') && request.headers.get('accept').includes('text/html')) {
          return caches.match('/404.html');
        }
      });
    })
  );
});
