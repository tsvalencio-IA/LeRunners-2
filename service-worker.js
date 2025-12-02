/* =================================================================== */
/* SERVICE WORKER - FORÇAR ATUALIZAÇÃO IMEDIATA (V-FINAL)
/* =================================================================== */

const CACHE_NAME = 'lerunners-cache-v-FINAL-FORCE-UPDATE'; 

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

// Instalação: Força o novo SW a assumir o controle imediatamente
self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(FILES_TO_CACHE))
    );
});

// Ativação: Deleta impiedosamente qualquer cache antigo
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Limpando cache antigo e forçando atualização:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch: Prioriza a rede para arquivos vitais, cache apenas para assets
self.addEventListener('fetch', (event) => {
    // Nunca cacheia APIs, Firebase ou o próprio SW/HTML para evitar travamento
    if (event.request.url.includes('firebaseio.com') || 
        event.request.url.includes('googleapis.com') || 
        event.request.url.includes('cloudinary.com') ||
        event.request.url.includes('vercel.app')) {
        event.respondWith(fetch(event.request));
        return;
    }

    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request);
        })
    );
});
