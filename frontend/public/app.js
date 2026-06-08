// app.js - Lógica Frontend Offline-First con IndexedDB y JWT Auth

document.addEventListener('DOMContentLoaded', () => {
    const statusDiv = document.getElementById('connection-status');
    const form = document.getElementById('registro-form');
    const syncList = document.getElementById('sync-list');
    
    // UI Elements Auth
    const loginPanel = document.getElementById('login-panel');
    const loginForm = document.getElementById('login-form');
    const userInfoPanel = document.getElementById('user-info-panel');
    const currentRoleSpan = document.getElementById('current-role');
    const logoutBtn = document.getElementById('logout-btn');
    
    const registroPanel = document.getElementById('registro-panel');
    const notarizarPanel = document.getElementById('notarizar-panel');
    const exportarPanel = document.getElementById('exportar-panel');

    function evaluarPantalla() {
        const token = localStorage.getItem('agtech_token');
        const role = localStorage.getItem('agtech_role');

        if (!token) {
            loginPanel.style.display = 'block';
            userInfoPanel.style.display = 'none';
            registroPanel.style.display = 'none';
            notarizarPanel.style.display = 'none';
            exportarPanel.style.display = 'none';
        } else {
            loginPanel.style.display = 'none';
            userInfoPanel.style.display = 'block';
            currentRoleSpan.textContent = role;
            
            registroPanel.style.display = role === 'Productor Agrícola' ? 'block' : 'none';
            notarizarPanel.style.display = role === 'Organismo de Control (SENASA/AFIP)' ? 'block' : 'none';
            exportarPanel.style.display = role === 'Exportador (Puertos)' ? 'block' : 'none';
        }
    }

    evaluarPantalla(); // Inicializar vista

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('login-user').value;
        const password = document.getElementById('login-pass').value;
        try {
            const res = await fetch('http://localhost:3000/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();
            if (data.success) {
                localStorage.setItem('agtech_token', data.token);
                localStorage.setItem('agtech_role', data.rol);
                evaluarPantalla();
                loginForm.reset();
                agregarLog(`<span class="success-text">✅ Sesión iniciada como ${data.rol}</span>`);
            } else {
                alert("Error de login: " + data.error);
            }
        } catch (err) {
            alert("Error de red al intentar loguearse");
        }
    });

    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('agtech_token');
        localStorage.removeItem('agtech_role');
        evaluarPantalla();
        agregarLog(`ℹ️ Sesión cerrada.`);
    });
    
    // IndexedDB Setup
    let db;
    const request = indexedDB.open('AgTechDB', 1);

    request.onupgradeneeded = function(event) {
        db = event.target.result;
        if (!db.objectStoreNames.contains('lotes_pendientes')) {
            db.createObjectStore('lotes_pendientes', { keyPath: 'idLote' });
        }
    };

    request.onsuccess = function(event) {
        db = event.target.result;
        updateOnlineStatus(); // Validar al cargar y tras abrir la DB
    };

    request.onerror = function(event) {
        console.error("Error al abrir IndexedDB", event);
    };

    // Monitoreo de conexión a Internet (Eventos Nativos)
    function updateOnlineStatus() {
        if (navigator.onLine) {
            statusDiv.textContent = 'Estado: Online (Conectado al Backend)';
            statusDiv.className = 'status-bar online';
            sincronizarDatosOffline();
        } else {
            statusDiv.textContent = 'Estado: Offline (Modo Campo - Guardando Localmente)';
            statusDiv.className = 'status-bar offline';
        }
    }

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    // Interceptar envío de formulario
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const fileInput = document.getElementById('documento');
        const file = fileInput.files.length > 0 ? fileInput.files[0] : null;

        const loteData = {
            idLote: document.getElementById('idLote').value,
            renspa: document.getElementById('renspa').value,
            geolocalizacion: "Lat: -34.6037, Lon: -58.3816", // Hardcodeado para simulación
            volumenToneladas: document.getElementById('volumen').value,
            timestamp: new Date().toISOString(),
            documento: file // Guardar el archivo como Blob si existe
        };

        if (navigator.onLine) {
            enviarAlBackend(loteData);
        } else {
            guardarOffline(loteData);
        }
        form.reset();
    });

    // Interceptar envío de formulario Notarizar
    const formNotarizar = document.getElementById('notarizar-form');
    if (formNotarizar) {
        formNotarizar.addEventListener('submit', async (e) => {
            e.preventDefault();
            const idLote = document.getElementById('idLoteNotarizar').value;
            try {
                const res = await fetch('http://localhost:3000/api/lotes/notarizar', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + localStorage.getItem('agtech_token')
                    },
                    body: JSON.stringify({ idLote })
                });
                const result = await res.json();
                if (result.success) {
                    agregarLog(`<span class="success-text">✅ [BFA] Notarización asíncrona iniciada para ${idLote}.</span>`);
                } else {
                    agregarLog(`❌ [ERROR BFA] Lote ${idLote}: ${result.error}`);
                }
            } catch (error) {
                console.error('Error al notarizar:', error);
                agregarLog(`❌ [ERROR BFA] Problema de red al notarizar.`);
            }
            formNotarizar.reset();
        });
    }

    // Interceptar envío de formulario Exportar
    const formExportar = document.getElementById('exportar-form');
    if (formExportar) {
        formExportar.addEventListener('submit', async (e) => {
            e.preventDefault();
            const idLote = document.getElementById('idLoteExportar').value;
            const exportadorAddress = document.getElementById('walletExportador').value;
            
            agregarLog(`⏳ [NFT] Acuñando token en Polygon para lote ${idLote}...`);
            try {
                const res = await fetch('http://localhost:3000/api/lotes/exportar', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + localStorage.getItem('agtech_token')
                    },
                    body: JSON.stringify({ idLote, exportadorAddress })
                });
                const result = await res.json();
                if (result.success) {
                    agregarLog(`<span class="success-text">✅ [NFT] Token Acuñado. TX: ${result.txHash}</span>`);
                    
                    // Mostrar QR link
                    const qrPanel = document.getElementById('qr-result-panel');
                    const qrLink = document.getElementById('qr-link');
                    const qrImage = document.getElementById('qr-image');
                    qrPanel.style.display = 'block';
                    
                    // Asegurar que el link apunte al frontend local verificador con la ruta base correcta
                    // Evitamos usar .html porque el servidor 'serve' hace un 301 redirect que borra los query parameters (?id=...)
                    const basePath = window.location.pathname.replace(/\/index\.html$/, '/').replace(/\/$/, '');
                    const localVerifyUrl = `${window.location.origin}${basePath}/verificador?id=${idLote}&tx=${result.txHash}`;
                    
                    qrLink.href = localVerifyUrl;
                    qrLink.textContent = `Abrir Trazabilidad de ${idLote}`;
                    
                    // Generar la imagen del QR usando la API gratuita de QR Server
                    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(localVerifyUrl)}`;
                    qrImage.src = qrApiUrl;
                    qrImage.style.display = 'block';
                } else {
                    agregarLog(`❌ [ERROR NFT] Lote ${idLote}: ${result.error}`);
                }
            } catch (error) {
                console.error('Error al exportar:', error);
                agregarLog(`❌ [ERROR NFT] Problema al conectar con la red local (Hardhat).`);
            }
            formExportar.reset();
        });
    }

    // IndexedDB Fallback
    function guardarOffline(data) {
        if (!db) return console.error("IndexedDB no está inicializada");
        const transaction = db.transaction(['lotes_pendientes'], 'readwrite');
        const objectStore = transaction.objectStore('lotes_pendientes');
        const request = objectStore.add(data);
        
        request.onsuccess = function() {
            agregarLog(`📦 [OFFLINE] Lote ${data.idLote} guardado en cache local. Esperando red...`);
        };
        request.onerror = function(e) {
            console.error("Error al guardar offline:", e.target.error);
            agregarLog(`❌ [ERROR OFFLINE] No se pudo guardar el lote ${data.idLote}.`);
        };
    }

    // Sincronización en segundo plano al recuperar conexión
    async function sincronizarDatosOffline() {
        if (!db) return;
        const transaction = db.transaction(['lotes_pendientes'], 'readonly');
        const objectStore = transaction.objectStore('lotes_pendientes');
        const request = objectStore.getAll();

        request.onsuccess = async function(event) {
            const pendientes = event.target.result;
            if (pendientes.length === 0) return;

            agregarLog(`🔄 Sincronizando ${pendientes.length} registros offline...`);
            
            for (let i = 0; i < pendientes.length; i++) {
                await enviarAlBackend(pendientes[i], true);
            }
        };
    }

    // Petición al API Rest
    async function enviarAlBackend(data, isSync = false) {
        try {
            const formData = new FormData();
            formData.append('idLote', data.idLote);
            formData.append('renspa', data.renspa);
            formData.append('geolocalizacion', data.geolocalizacion);
            formData.append('volumenToneladas', data.volumenToneladas);
            if (data.documento) {
                formData.append('documento', data.documento);
            }

            const res = await fetch('http://localhost:3000/api/lotes/registrar', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + localStorage.getItem('agtech_token')
                },
                // No configuramos Content-Type, fetch lo infiere como multipart/form-data y agrega el boundary automático
                body: formData
            });
            const result = await res.json();
            
            if (result.success) {
                agregarLog(`<span class="success-text">✅ [ONLINE] Lote ${data.idLote} registrado en Blockchain Privada.</span>`);
                
                if (isSync && db) {
                    // Remover de IndexedDB si fue sincronizado exitosamente
                    const tx = db.transaction(['lotes_pendientes'], 'readwrite');
                    tx.objectStore('lotes_pendientes').delete(data.idLote);
                }
            } else {
                agregarLog(`❌ [ERROR] Lote ${data.idLote}: ${result.error}`);
            }
        } catch (error) {
            console.error('Error de red al enviar:', error);
            if (!isSync) guardarOffline(data);
        }
    }

    function agregarLog(htmlMsg) {
        const li = document.createElement('li');
        li.innerHTML = htmlMsg;
        syncList.prepend(li);
    }
});
