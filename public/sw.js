const CACHE_NAME = 'ideacrm-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/icon-512.png'
];

// External CDN resources to pre-cache for faster subsequent loads
const CDN_ASSETS = [
  'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:ital,wght@0,100..700;1,100..700&display=swap',
  'https://cdn.tailwindcss.com'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Cache static assets
      await cache.addAll(STATIC_ASSETS);
      // Cache CDN assets (best-effort, don't fail install if CDN is down)
      for (const url of CDN_ASSETS) {
        try {
          await cache.add(url);
        } catch (e) {
          console.warn('SW: Failed to pre-cache CDN asset:', url);
        }
      }
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Never cache API requests — always go to network
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/api')) {
    return;
  }

  // For navigation requests (HTML pages): Stale-While-Revalidate
  // Show cached version instantly, fetch fresh in background
  if (request.mode === 'navigate') {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cachedResponse = await cache.match('/');
        const fetchPromise = fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            cache.put('/', networkResponse.clone());
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        }).catch(() => null);

        // Return cached immediately if available, otherwise wait for network
        if (cachedResponse) {
          // Background update
          fetchPromise;
          return cachedResponse;
        }
        return fetchPromise || caches.match('/');
      })
    );
    return;
  }

  // For CDN/font resources: Cache-First (these change very rarely)
  if (url.hostname !== location.hostname) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;

        try {
          const response = await fetch(request);
          if (response.status === 200) {
            cache.put(request, response.clone());
          }
          return response;
        } catch (e) {
          // Last resort fallback for fonts/CDN
          return new Response('', { status: 503 });
        }
      })
    );
    return;
  }

  // For app JS/CSS bundles: Stale-While-Revalidate
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request);

      const fetchPromise = fetch(request).then((response) => {
        if (response && response.status === 200) {
          cache.put(request, response.clone());
        }
        return response;
      }).catch(() => null);

      // Return cached immediately if available
      if (cached) {
        fetchPromise; // update in background
        return cached;
      }

      // No cache, wait for network; fallback to index
      const networkResponse = await fetchPromise;
      return networkResponse || caches.match('/');
    })
  );
});
