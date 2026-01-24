// Service Worker for Push Notifications and Offline Map Caching

const CACHE_NAME = 'navigator-cache-v1';
const TILE_CACHE_NAME = 'map-tiles-v1';
const ROUTE_CACHE_NAME = 'routes-v1';

// Tile URL patterns to cache
const TILE_PATTERNS = [
  /^https:\/\/[abc]\.basemaps\.cartocdn\.com/,
  /^https:\/\/[abc]\.tile\.openstreetmap\.org/,
  /^https:\/\/server\.arcgisonline\.com/,
  /^https:\/\/[abc]\.tile\.opentopomap\.org/,
  /^https:\/\/stamen-tiles/,
];

// Max tiles to cache
const MAX_TILES = 1000;

self.addEventListener('install', (event) => {
  console.log('Service Worker installed');
  self.skipWaiting();
  
  // Pre-cache essential assets
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        '/favicon.ico',
        '/placeholder.svg',
      ]);
    })
  );
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker activated');
  event.waitUntil(
    Promise.all([
      clients.claim(),
      // Clean old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME && name !== TILE_CACHE_NAME && name !== ROUTE_CACHE_NAME)
            .map((name) => caches.delete(name))
        );
      }),
    ])
  );
});

// Fetch handler with caching strategies
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Check if this is a tile request
  const isTileRequest = TILE_PATTERNS.some((pattern) => pattern.test(event.request.url));
  
  if (isTileRequest) {
    // Cache-first strategy for map tiles
    event.respondWith(
      caches.open(TILE_CACHE_NAME).then(async (cache) => {
        const cachedResponse = await cache.match(event.request);
        if (cachedResponse) {
          return cachedResponse;
        }
        
        try {
          const networkResponse = await fetch(event.request);
          if (networkResponse.ok) {
            // Clone response before caching
            const responseClone = networkResponse.clone();
            
            // Check cache size and clean if needed
            cache.keys().then((keys) => {
              if (keys.length > MAX_TILES) {
                // Delete oldest 100 tiles
                keys.slice(0, 100).forEach((key) => cache.delete(key));
              }
            });
            
            cache.put(event.request, responseClone);
          }
          return networkResponse;
        } catch (error) {
          console.log('Tile fetch failed, returning offline placeholder');
          // Return a transparent placeholder for missing tiles
          return new Response(
            '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect fill="#f0f0f0" width="256" height="256"/><text x="128" y="128" text-anchor="middle" fill="#999" font-size="12">Офлайн</text></svg>',
            { headers: { 'Content-Type': 'image/svg+xml' } }
          );
        }
      })
    );
    return;
  }
  
  // Check if this is a route API request
  if (url.pathname.includes('/functions/v1/google-directions')) {
    // Network-first with cache fallback for routes
    event.respondWith(
      caches.open(ROUTE_CACHE_NAME).then(async (cache) => {
        try {
          const networkResponse = await fetch(event.request.clone());
          if (networkResponse.ok) {
            // Cache successful route responses
            const cacheKey = new Request(event.request.url, { method: 'GET' });
            cache.put(cacheKey, networkResponse.clone());
          }
          return networkResponse;
        } catch (error) {
          // Try cache on network failure
          const cachedResponse = await cache.match(event.request);
          if (cachedResponse) {
            console.log('Returning cached route');
            return cachedResponse;
          }
          
          // Return error response
          return new Response(
            JSON.stringify({ error: 'Нет подключения к интернету. Маршрут недоступен офлайн.' }),
            { 
              status: 503,
              headers: { 'Content-Type': 'application/json' }
            }
          );
        }
      })
    );
    return;
  }
  
  // Default: network-first for other requests
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});

// Handle push notifications
self.addEventListener('push', (event) => {
  console.log('Push notification received', event);

  let data = {
    title: 'CargoConnect',
    body: 'Новое уведомление',
    url: '/',
    tag: 'default'
  };

  if (event.data) {
    try {
      const payload = event.data.json();
      data = { ...data, ...payload };
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: data.tag,
    data: { url: data.url },
    vibrate: [200, 100, 200],
    requireInteraction: false,
    actions: [
      { action: 'open', title: 'Открыть' },
      { action: 'close', title: 'Закрыть' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked', event);
  event.notification.close();

  const url = event.notification.data?.url || '/';

  if (event.action === 'close') {
    return;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Try to focus existing window
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      // Open new window if none exists
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

// Background sync for offline route requests
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-routes') {
    event.waitUntil(
      // Sync cached route requests when back online
      caches.open(ROUTE_CACHE_NAME).then(async (cache) => {
        const keys = await cache.keys();
        console.log('Syncing', keys.length, 'cached routes');
      })
    );
  }
});

// Message handler for cache control
self.addEventListener('message', (event) => {
  if (event.data.action === 'clearTileCache') {
    caches.delete(TILE_CACHE_NAME).then(() => {
      console.log('Tile cache cleared');
      event.ports[0].postMessage({ success: true });
    });
  }
  
  if (event.data.action === 'getCacheStats') {
    Promise.all([
      caches.open(TILE_CACHE_NAME).then((cache) => cache.keys()),
      caches.open(ROUTE_CACHE_NAME).then((cache) => cache.keys()),
    ]).then(([tileKeys, routeKeys]) => {
      event.ports[0].postMessage({
        tiles: tileKeys.length,
        routes: routeKeys.length,
      });
    });
  }
  
  if (event.data.action === 'preCacheTiles') {
    const { tiles } = event.data;
    caches.open(TILE_CACHE_NAME).then(async (cache) => {
      let cached = 0;
      for (const url of tiles) {
        try {
          const response = await fetch(url);
          if (response.ok) {
            await cache.put(url, response);
            cached++;
          }
        } catch (e) {
          console.log('Failed to cache tile:', url);
        }
      }
      event.ports[0].postMessage({ cached, total: tiles.length });
    });
  }
});