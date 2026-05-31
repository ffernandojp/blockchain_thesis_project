// sw.js - Service Worker
// Maneja el caché de los estáticos para permitir la carga offline.

const CACHE_NAME = 'agtech-v1';
const ASSETS = [
    './',
    './index.html',
    './app.js'
];

// Instalación: Guardar archivos iniciales
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            console.log('[Service Worker] Cacheando assets');
            return cache.addAll(ASSETS);
        })
    );
});

// Fetch: Retornar caché si estamos offline
self.addEventListener('fetch', event => {
    // Si la request es de nuestro backend Node (API), no cacheamos
    if (event.request.url.includes('/api/')) {
        return;
    }

    event.respondWith(
        caches.match(event.request).then(cachedResponse => {
            // Devuelve del cache, o en su defecto hace fetch
            return cachedResponse || fetch(event.request).catch(() => {
                console.log('[Service Worker] No hay red y recurso no cacheado:', event.request.url);
            });
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
        ))
    );
});
