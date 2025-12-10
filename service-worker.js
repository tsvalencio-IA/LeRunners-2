/* =================================================================== */
/* SERVICE WORKER - V5.0 (FORCE UPDATE - LEAK FIX)
/* =================================================================== */

const CACHE_NAME = 'lerunners-cache-v5.0-KEY-FIX'; // Versão alterada para obrigar reload

const FILES_TO_CACHE = [
    './',
    './index.html',
    './app.html',
    './css/styles.css',
    './js/config.js',
    './js/app.js',
    './js/panels.js',
    './manifest.json',
    './img/logo-192.png',
    './img/logo-512.png',
    '[https://cdn.jsdelivr.net/npm/boxicons@2.1.4/css/boxicons.min.css](https://cdn.jsdelivr.net/npm/boxicons@2.1.4/css/boxicons.min.css)', 
    '[https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js](https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js)',
    '[https://www.gstatic.com/firebasejs/8.10.1/firebase-auth.js](https://www.gstatic.com/firebasejs/8.10.1/firebase-auth.js)',
    '[https://www.gstatic.com/firebasejs/8.10.1/firebase-database.js](https://www.gstatic.com/firebasejs/8.10.1/firebase-database.js)',
    '[https://upload-widget.cloudinary.com/global/all.js](https://upload-widget.cloudinary.com/global/all.js)'
];

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(FILES_TO_CACHE))
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    // Ignora APIs para não cachear erros
    if (event.request.url.includes('firebaseio.com') || 
        event.request.url.includes('googleapis.com') || 
        event.request.url.includes('cloudinary.com') ||
        event.request.url.includes('vercel.app')) {
        event.respondWith(fetch(event.request));
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then((response) => response || fetch(event.request))
    );
});
