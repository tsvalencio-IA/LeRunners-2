/* =================================================================== */
/* SERVICE WORKER V7.0 - FORÇAR ATUALIZAÇÃO IMEDIATA
/* =================================================================== */
const CACHE_NAME = 'lerunners-cache-v7.0-FINAL-FIX'; 

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

// Instalação: Pula espera e assume controle
self.addEventListener('install', (event) => {
    self.skipWaiting(); 
    event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(FILES_TO_CACHE)));
});

// Ativação: Deleta tudo que for velho
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Limpando cache antigo:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch: Prioriza a rede para não travar
self.addEventListener('fetch', (event) => {
    // Ignora APIs
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
