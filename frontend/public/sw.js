// sw.js - Service Worker
// Maneja el caché de los estáticos para permitir la carga offline.

const CACHE_NAME = 'agtech-v7';
const ASSETS = [
    './',
    './app.js',
    './verificador.js',
    './css/portal.css',
    './css/verificador.css'
];

// Instalación: Guardar archivos iniciales
self.addEventListener('install', event => {
    self.skipWaiting(); // Fuerza a que el SW se active inmediatamente
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            console.log('[Service Worker] Cacheando assets');
            return cache.addAll(ASSETS);
        })
    );
});

// Fetch: Estrategia Network-First (Intenta red, si falla usa caché)
self.addEventListener('fetch', event => {
    // Si la request es de nuestro backend Node (API), no cacheamos
    if (event.request.url.includes('/api/')) {
        return;
    }

    event.respondWith(
        fetch(event.request).then(networkResponse => {
            // Guardar copia fresca en caché para cuando estemos offline
            return caches.open(CACHE_NAME).then(cache => {
                cache.put(event.request, networkResponse.clone());
                return networkResponse;
            });
        }).catch(() => {
            // Si no hay red, servir desde caché
            console.log('[Service Worker] Offline: Sirviendo desde caché', event.request.url);
            return caches.match(event.request);
        })
    );
});

// Activación: Limpieza de caches antiguos
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => Promise.all(
            keys.map(key => {
                if (key !== CACHE_NAME) {
                    console.log('[Service Worker] Eliminando caché antiguo', key);
                    return caches.delete(key);
                }
            })
        )).then(() => self.clients.claim()) // Tomar control de todos los clientes de inmediato
    );
});
