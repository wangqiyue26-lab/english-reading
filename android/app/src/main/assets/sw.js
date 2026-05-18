/* Service Worker - Offline Caching for English Reading App */
const CACHE = 'enreading-v3';
const ASSETS = [
  './',
  'index.html',
  'css/style.css',
  'js/supabase.js',
  'js/auth.js',
  'js/auth-ui.js',
  'js/sync.js',
  'js/settings.js',
  'js/tts.js',
  'js/dictionary.js',
  'js/translator.js',
  'js/data.js',
  'js/reader.js',
  'js/app.js',
  'manifest.json'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS).catch(err => {
      // Continue even if some assets fail (e.g. data.js is huge)
      console.warn('SW: partial cache install', err);
    }))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE).map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  // Only cache GET requests from our origin
  if (e.request.method !== 'GET') return;
  
  // For API calls (dictionary, translation), use network-first
  if (e.request.url.includes('api.dictionaryapi.dev') || 
      e.request.url.includes('api.mymemory.translated.net') ||
      e.request.url.includes('fonts.cdnfonts.com')) {
    e.respondWith(networkFirst(e.request));
    return;
  }

  // For local assets, use cache-first
  e.respondWith(cacheFirst(e.request));
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    const cache = await caches.open(CACHE);
    cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || new Response('Offline', { status: 503 });
  }
}
