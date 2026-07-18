/* ═══════════════════════════════════
   TOURI — Service Worker
   Cache-first for static, progressive for audio
═══════════════════════════════════ */

const CACHE_NAME = 'touri-v3';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/tours.html',
  '/tour-detail.html',
  '/tour-player.html',
  '/tour-map.html',
  '/tour-end.html',
  '/style.css',
  '/i18n.js',
  '/gps.js',
  '/audio.js',
  '/tour-data.js',
  '/manifest.json',
  '/data/vitoria.json',
];

// Install — precache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate — clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch — cache-first for static, network-first for data/audio
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Skip external requests (CDN, APIs, etc.)
  if (url.origin !== location.origin) return;

  // Audio files — cache on demand (network-first)
  if (url.pathname.includes('/assets/audio/')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Static assets — cache-first
  event.respondWith(
    caches.match(event.request)
      .then(cached => cached || fetch(event.request).then(response => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      }))
      .catch(() => {
        // Fallback for navigation requests
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
      })
  );
});

// Listen for messages (e.g., precache audio for upcoming stops)
self.addEventListener('message', (event) => {
  if (event.data.type === 'PRECACHE_AUDIO') {
    const urls = event.data.urls || [];
    caches.open(CACHE_NAME).then(cache => {
      urls.forEach(url => {
        cache.match(url).then(existing => {
          if (!existing) {
            fetch(url).then(resp => {
              if (resp.ok) cache.put(url, resp);
            }).catch(() => {});
          }
        });
      });
    });
  }
});
