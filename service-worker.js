/* =================================================================== */
/* SERVICE WORKER - LIMPEZA TOTAL E RESTAURAÇÃO (V2 BASE)
/* =================================================================== */
const CACHE_NAME = 'lerunners-cache-V2-RESTAURADA-FINAL'; 

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
    'https://cdn.jsdelivr.net/npm/boxicons@2.1.4/css/boxicons.min.css'
];

// Força a instalação imediata do novo Service Worker
self.addEventListener('install', (event) => {
    self.skipWaiting(); 
    event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(FILES_TO_CACHE)));
});

// Apaga qualquer cache antigo (V3, V4, V5...) que esteja causando erro
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Deletando cache corrompido:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Estratégia de Rede Primeiro para evitar dados velhos
self.addEventListener('fetch', (event) => {
    // Garante que APIs e banco de dados nunca sejam cacheados
    if (event.request.url.includes('firebase') || 
        event.request.url.includes('strava') || 
        event.request.url.includes('vercel')) {
        event.respondWith(fetch(event.request));
        return;
    }

    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request);
        })
    );
});