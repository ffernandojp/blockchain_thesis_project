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

// Background Sync
self.addEventListener('sync', event => {
    if (event.tag === 'sync-lotes') {
        console.log('[Service Worker] Background Sync disparado!');
        event.waitUntil(sincronizarLotesIndexedDB());
    }
});

async function sincronizarLotesIndexedDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('AgTechDB', 1);
        
        request.onsuccess = (e) => {
            const db = e.target.result;
            if(!db.objectStoreNames.contains('lotes_pendientes')) return resolve();
            
            const tx = db.transaction('lotes_pendientes', 'readonly');
            const store = tx.objectStore('lotes_pendientes');
            const getAllReq = store.getAll();
            
            getAllReq.onsuccess = async () => {
                const pendientes = getAllReq.result;
                if (!pendientes || pendientes.length === 0) return resolve();
                
                for (let lote of pendientes) {
                    try {
                        const res = await fetch('http://localhost:3000/api/lotes/registrar', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer test_token' },
                            body: JSON.stringify(lote)
                        });
                        
                        if (res.ok) {
                            const delTx = db.transaction('lotes_pendientes', 'readwrite');
                            delTx.objectStore('lotes_pendientes').delete(lote.idLote);
                        } else if (res.status === 400) {
                            // Si la petición es inválida o duplicada, se elimina de IndexedDB para evitar reintentos infinitos
                            const delTx = db.transaction('lotes_pendientes', 'readwrite');
                            delTx.objectStore('lotes_pendientes').delete(lote.idLote);
                        }
                    } catch (err) {
                        console.error('[SW] Error enviando lote', err);
                        return reject(err); // Reintentará luego
                    }
                }
                resolve();
            };
        };
        request.onerror = () => reject(request.error);
    });
}
