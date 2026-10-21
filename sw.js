/**
 * ApplyReady.in - Service Worker (PWA Offline Support)
 * 100% Client-Side Caching for Offline Resizer, Resume Builder & PDF Tools
 *
 * NOTE: Bump CACHE_NAME on every deploy to ensure clients receive updated assets.
 */

const CACHE_NAME = 'applyready-v16';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/resume.html',
  '/how-to-use.html',
  '/about.html',
  '/privacy.html',
  '/terms.html',
  '/contact.html',
  '/offline.html',
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
  '/guides/how-to-reduce-photo-to-50kb-without-blur.html',
  '/guides/digital-signature-for-online-forms.html',
  '/guides/passport-photo-at-home-guide.html',
  '/guides/compress-pdf-for-upload-portals.html',
  '/guides/combine-documents-into-one-pdf.html',
  '/guides/pixels-cm-inches-dpi-explained.html',
  '/guides/fix-common-photo-upload-errors.html',
  '/guides/phone-camera-tips-for-document-scans.html',
  '/guides/document-checklist-before-online-application.html',
  '/guides/staying-safe-with-document-uploads.html',
  '/guides/resume-bullet-points-that-show-results.html',
  '/guides/tailor-resume-to-a-job-description.html',
  '/guides/resume-length-one-page-or-two.html',
  '/guides/resume-skills-section-guide.html',
  '/guides/application-email-and-cover-letter-for-freshers.html',
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
  '/css/app.css',
  '/css/document.css',
  '/css/vendor/icons.min.css',
  '/css/vendor/cropper.min.css',
  '/css/webfonts/fa-solid-900.woff2',
  '/css/webfonts/fa-regular-400.woff2',
  '/assets/fonts/inter-latin.woff2',
  '/assets/fonts/noto-devanagari.woff2',
  '/js/components.js',
  '/js/site.js',
  '/js/theme.js',
  '/js/presets.js',
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
      .catch(err => {
        console.error('[SW] Precache failed:', err);
      })
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

  const isNavigation = request.mode === 'navigate' || (request.headers.get('accept') && request.headers.get('accept').includes('text/html'));

  if (isNavigation) {
    // HTML / navigation requests: network-first with cache fallback, then offline.html
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response && response.status === 200 && response.type === 'basic') {
            const cloned = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, cloned));
          }
          return response;
        })
        .catch(() => {
          return caches.match(request).then(cached => {
            if (cached) return cached;
            return caches.match('/offline.html');
          });
        })
    );
  } else {
    // Static assets: stale-while-revalidate
    event.respondWith(
      caches.match(request).then(cachedResponse => {
        const fetchPromise = fetch(request).then(networkResponse => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, responseToCache));
          }
          return networkResponse;
        }).catch(() => null);

        return cachedResponse || fetchPromise;
      })
    );
  }
});
