'use strict';

// Increment this version to force cache refresh on all clients
const CACHE_VERSION = 'v19';
const CACHE_NAME = `jumix-tech-${CACHE_VERSION}`;

// Core assets — always cache these on install
const CORE_ASSETS = [
  './',
  './manifest.json',
  './icon.svg',
];

// Optional assets — cache if available (icons may not exist yet)
const OPTIONAL_ASSETS = [
  './icon-192.png',
  './icon-512.png',
  './icon-maskable.png',
  './apple-touch-icon.png',
];

// ─── Install ──────────────────────────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);

    // Cache core assets (required)
    await cache.addAll(CORE_ASSETS);

    // Cache optional assets individually — skip on failure
    for (const url of OPTIONAL_ASSETS) {
      try {
        await cache.add(url);
      } catch (_) {
        // Asset doesn't exist yet — that's fine
      }
    }

    // Activate new SW immediately without waiting for old clients to close
    await self.skipWaiting();
  })());
});

// ─── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    // Delete all old caches from previous versions
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames
        .filter(name => (name.startsWith('jumix-tech-') || name.startsWith('too-uchet-')) && name !== CACHE_NAME)
        .map(name => caches.delete(name))
    );
    // Take control of all open tabs immediately
    await self.clients.claim();
  })());
});

// ─── Fetch ────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const req = event.request;

  // Only handle GET requests to same origin
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(req);

    if (cached) {
      // Stale-while-revalidate: return cached immediately, update in background
      event.waitUntil(
        fetch(req).then(res => {
          if (res.ok) cache.put(req, res.clone());
        }).catch(() => {})
      );
      return cached;
    }

    // Not in cache — fetch from network and cache the result
    try {
      const response = await fetch(req);
      if (response.ok) {
        cache.put(req, response.clone());
      }
      return response;
    } catch (_) {
      // Completely offline and not cached — return the app shell
      const fallback = await cache.match('./');
      return fallback || new Response(
        '<!DOCTYPE html><html><body style="background:#0f1117;color:#e2e8f0;font-family:system-ui;text-align:center;padding:60px">' +
        '<h2>Нет соединения</h2><p>Вы офлайн. Проверьте подключение к интернету.</p>' +
        '<button onclick="location.reload()" style="background:#6c63ff;color:#fff;border:none;padding:12px 24px;border-radius:8px;cursor:pointer;font-size:14px">Повторить</button>' +
        '</body></html>',
        { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      );
    }
  })());
});

// ─── Message: force update ─────────────────────────────────────────────────────
self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});
