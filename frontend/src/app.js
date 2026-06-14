// app.js - Lógica Frontend Offline-First

// Utilidades UI
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <span>${type === 'success' ? '✅' : type === 'warning' ? '⚠️' : '❌'}</span>
        <span>${message}</span>
    `;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// Configuración IndexedDB
const DB_NAME = 'agtech-db';
const STORE_NAME = 'pendientes';

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'idLote' });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const statusDiv = document.getElementById('connection-status');
    const form = document.getElementById('registro-form');
    const syncList = document.getElementById('sync-list');

    // Monitoreo de conexión a Internet
    function updateOnlineStatus() {
        if (navigator.onLine) {
            statusDiv.textContent = 'Estado: Online (Conectado al Backend)';
            statusDiv.className = 'status-indicator online';
            showToast('Conexión restaurada. Sincronizando datos...', 'success');
            
            // Intentar Background Sync si está soportado, sino fallback manual
            if ('serviceWorker' in navigator && 'SyncManager' in window) {
                navigator.serviceWorker.ready.then(sw => {
                    return sw.sync.register('sync-lotes');
                }).catch(() => sincronizarDatosOffline());
            } else {
                sincronizarDatosOffline();
            }
        } else {
            statusDiv.textContent = 'Estado: Offline (Modo Campo - Guardando Localmente)';
            statusDiv.className = 'status-indicator offline';
            showToast('Conexión perdida. Operando en modo Offline-First.', 'warning');
        }
    }

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    // Interceptar envío de formulario
    if(form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const renspa = document.getElementById('renspa').value;
            const geolocalizacion = "Lat: -34.6037, Lon: -58.3816"; 
            const timestamp = new Date().toISOString();
            const volumenToneladas = document.getElementById('volumen').value;
            const fileName = "offline_document.pdf"; 

            // Hash SHA-256
            const dataToHash = `${renspa}${geolocalizacion}${timestamp}${fileName}`;
            const encoder = new TextEncoder();
            const dataBuffer = encoder.encode(dataToHash);
            const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            const generatedIdLote = '0x' + hashHex.substring(0, 16);

            const loteData = {
                idLote: generatedIdLote,
                renspa: renspa,
                geolocalizacion: geolocalizacion,
                volumenToneladas: volumenToneladas,
                timestamp: timestamp
            };

            if (navigator.onLine) {
                enviarAlBackend(loteData);
            } else {
                guardarOffline(loteData);
            }
            form.reset();
        });
    }

    // Guardar en IndexedDB
    async function guardarOffline(data) {
        try {
            const db = await openDB();
            const tx = db.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).put(data);
            
            tx.oncomplete = () => {
                showToast(`Lote ${data.idLote} guardado localmente (IndexedDB).`, 'warning');
                agregarLog(`📦 [OFFLINE] Lote ${data.idLote} guardado en IndexedDB. Esperando red...`);
                
                // Registrar background sync si estamos offline
                if ('serviceWorker' in navigator && 'SyncManager' in window) {
                    navigator.serviceWorker.ready.then(sw => sw.sync.register('sync-lotes'));
                }
            };
        } catch (err) {
            console.error('Error guardando en IndexedDB', err);
            showToast('Error al guardar datos offline', 'error');
        }
    }

    // Sincronización manual / Fallback
    window.sincronizarDatosOffline = async function() {
        try {
            const db = await openDB();
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const request = store.getAll();
            
            request.onsuccess = async () => {
                const pendientes = request.result;
                if (pendientes.length === 0) return;

                agregarLog(`🔄 Sincronizando ${pendientes.length} registros desde IndexedDB...`);
                
                for (let lote of pendientes) {
                    await enviarAlBackend(lote, true);
                    // Borrar de IndexedDB tras éxito
                    const deleteTx = db.transaction(STORE_NAME, 'readwrite');
                    deleteTx.objectStore(STORE_NAME).delete(lote.idLote);
                }
            };
        } catch (err) {
            console.error('Error leyendo IndexedDB para sincronizar', err);
        }
    }

    // Petición al API Rest
    async function enviarAlBackend(data, isSync = false) {
        try {
            // Simulamos el endpoint del backend para el mock object
            const res = await fetch('http://localhost:3000/api/lotes/registrar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer test_token' },
                body: JSON.stringify(data)
            });
            const result = await res.json();
            
            if (res.ok && result.success !== false) {
                agregarLog(`<span class="success-text">✅ [ONLINE] Lote ${data.idLote} registrado en Blockchain.</span>`);
                showToast(`Lote ${data.idLote} sincronizado con éxito.`, 'success');
            } else {
                agregarLog(`❌ [ERROR] Lote ${data.idLote}: ${result.error || 'Fallo de API'}`);
                if (!isSync) showToast(`Error al registrar lote: ${result.error}`, 'error');
            }
        } catch (error) {
            console.error('Error de red al enviar:', error);
            if (!isSync) guardarOffline(data);
        }
    }

    function agregarLog(htmlMsg) {
        if(!syncList) return;
        const li = document.createElement('li');
        li.innerHTML = htmlMsg;
        syncList.prepend(li);
    }
});
