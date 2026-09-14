/* Latest Properties — service worker
   Network-first with offline fallback. Static assets are versioned via
   ?v= in index.html, so network-first always serves the fresh build. */

const CACHE = 'lp-static-v1';
const SHELL = [
    'index.html',
    'css/styles.css',
    'js/config.js',
    'js/app.js',
    'manifest.webmanifest',
    'icons/icon-192.png',
    'icons/icon-512.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const request = event.request;
    if (request.method !== 'GET') return;
    const url = new URL(request.url);
    if (url.origin !== location.origin) return;

    event.respondWith(
        fetch(request)
            .then((response) => {
                if (response && response.ok) {
                    const clone = response.clone();
                    caches.open(CACHE).then((cache) => cache.put(request, clone));
                }
                return response;
            })
            .catch(() =>
                caches.match(request, { ignoreSearch: true }).then((hit) => {
                    if (hit) return hit;
                    if (request.mode === 'navigate') return caches.match('index.html');
                    return Response.error();
                })
            )
    );
});