/* =================================================================== */
/* SERVICE WORKER - RESTAURAÇÃO BASE V2 (CORREÇÃO FINAL)
/* =================================================================== */

// Nomeamos o cache como "RESTORE" para obrigar o navegador a apagar
// as versões "quebradas" anteriores e baixar os arquivos limpos de novo.
const CACHE_NAME = 'lerunners-cache-RESTORE-V2-MASTER'; 

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
    'https://cdn.jsdelivr.net/npm/boxicons@2.1.4/css/boxicons.min.css',
    'https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js',
    'https://www.gstatic.com/firebasejs/8.10.1/firebase-auth.js',
    'https://www.gstatic.com/firebasejs/8.10.1/firebase-database.js',
    'https://upload-widget.cloudinary.com/global/all.js'
];

// 1. Instalação: Força o navegador a aceitar esta versão IMEDIATAMENTE
self.addEventListener('install', (event) => {
    self.skipWaiting(); // O comando mais importante para destravar o celular
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(FILES_TO_CACHE);
        })
    );
});

// 2. Ativação: Apaga qualquer cache que NÃO seja o "RESTORE-V2"
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Apagando cache antigo/quebrado:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// 3. Fetch: Garante que dados (Firebase/Strava) venham sempre da internet
self.addEventListener('fetch', (event) => {
    if (event.request.url.includes('firebaseio.com') || 
        event.request.url.includes('googleapis.com') || 
        event.request.url.includes('cloudinary.com') ||
        event.request.url.includes('strava.com') ||
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