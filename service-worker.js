/* =================================================================== */
/* SERVICE WORKER V13.0 - LIMPEZA TOTAL DE CACHE
/* =================================================================== */
const CACHE_NAME = 'lerunners-cache-v13.0-FINAL'; 

const FILES_TO_CACHE = [
    './', './index.html', './app.html', './css/styles.css',
    './js/config.js', './js/app.js', './js/panels.js', './manifest.json',
    'https://cdn.jsdelivr.net/npm/boxicons@2.1.4/css/boxicons.min.css'
];

self.addEventListener('install', (e) => {
    self.skipWaiting(); 
    e.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(FILES_TO_CACHE)));
});

self.addEventListener('activate', (e) => {
    e.waitUntil(caches.keys().then((names) => {
        return Promise.all(names.map((name) => {
            if (name !== CACHE_NAME) return caches.delete(name);
        }));
    }).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
    if (e.request.url.includes('firebase') || e.request.url.includes('strava') || e.request.url.includes('vercel')) {
        e.respondWith(fetch(e.request));
        return;
    }
    e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request)));
});