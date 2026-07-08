// app.js - Lógica Frontend Offline-First con IndexedDB y JWT Auth

// Utilidades UI
window.showToast = function (message, type = 'success') {
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
};

window.evaluarPantalla = function () {
    // Obtenemos los paneles dinámicamente para evitar problemas de timing
    const loginPanel = document.getElementById('login-panel');
    const userInfoPanel = document.getElementById('user-info-panel');
    const registroPanel = document.getElementById('registro-panel');
    const transportePanel = document.getElementById('transporte-panel');
    const acopioPanel = document.getElementById('acopio-panel');
    const notarizarPanel = document.getElementById('notarizar-panel');
    const exportarPanel = document.getElementById('exportar-panel');
    const currentRoleSpan = document.getElementById('current-role');

    const urlParams = new URLSearchParams(window.location.search);

    if (urlParams.get('mockLogin') === 'productor') {
        localStorage.setItem('agtech_token', 'mock_token');
        localStorage.setItem('agtech_role', 'Productor Agrícola');
    }

    const token = localStorage.getItem('agtech_token');
    const role = localStorage.getItem('agtech_role');



    if (!token) {
        if (loginPanel) loginPanel.style.display = 'block';
        if (userInfoPanel) userInfoPanel.style.display = 'none';
        if (registroPanel) registroPanel.style.display = 'none';
        if (transportePanel) transportePanel.style.display = 'none';
        if (acopioPanel) acopioPanel.style.display = 'none';
        if (notarizarPanel) notarizarPanel.style.display = 'none';
        if (exportarPanel) exportarPanel.style.display = 'none';
    } else {
        if (loginPanel) loginPanel.style.display = 'none';
        if (userInfoPanel) userInfoPanel.style.display = 'block';
        if (currentRoleSpan) currentRoleSpan.textContent = role;

        if (registroPanel) registroPanel.style.display = role === 'Productor Agrícola' ? 'block' : 'none';
        if (transportePanel) transportePanel.style.display = role === 'Transportista' ? 'block' : 'none';
        if (acopioPanel) acopioPanel.style.display = role === 'Acopiador / Cooperativa' ? 'block' : 'none';
        if (notarizarPanel) notarizarPanel.style.display = role === 'Organismo de Control (SENASA/ARCA)' ? 'block' : 'none';
        if (exportarPanel) exportarPanel.style.display = role === 'Exportador (Puertos)' ? 'block' : 'none';

        if (typeof window.cargarDatosIniciales === 'function') {
            window.cargarDatosIniciales(role);
        }

        if (role === 'Transportista' && typeof window.initTransportMap === 'function') {
            setTimeout(window.initTransportMap, 300); // Dar tiempo a que el panel sea visible
        }
    }
}
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
    const transportePanel = document.getElementById('transporte-panel');
    const acopioPanel = document.getElementById('acopio-panel');
    const notarizarPanel = document.getElementById('notarizar-panel');
    const exportarPanel = document.getElementById('exportar-panel');

    // window.evaluarPantalla movida arriba

    let transportMap = null;
    let transportMarker = null;

    window.initTransportMap = function () {
        if (!document.getElementById('mapa-transporte')) return;

        // Si no existe L (Leaflet), ignorar
        if (typeof L === 'undefined') return;

        if (!transportMap) {
            transportMap = L.map('mapa-transporte').setView([-34.6037, -58.3816], 13);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19,
                attribution: '© OpenStreetMap'
            }).addTo(transportMap);

            transportMarker = L.marker([-34.6037, -58.3816]).addTo(transportMap)
                .bindPopup('Buscando ubicación...')
                .openPopup();

            if (navigator.geolocation) {
                navigator.geolocation.watchPosition((pos) => {
                    const lat = pos.coords.latitude;
                    const lon = pos.coords.longitude;
                    transportMap.setView([lat, lon], 15);
                    transportMarker.setLatLng([lat, lon]).bindPopup('Tu ubicación actual (GPS)').openPopup();

                    const placeholder = document.getElementById('map-placeholder');
                    if (placeholder) placeholder.style.display = 'none';
                }, (err) => {
                    console.log("Error GPS", err);
                    transportMarker.bindPopup('Ubicación simulada (GPS inactivo)').openPopup();
                }, { enableHighAccuracy: true });
            }
        } else {
            transportMap.invalidateSize();
        }
    }

    function setLoadingState(btnElement, isLoading) {
        if (!btnElement) return;
        if (isLoading) {
            btnElement.dataset.originalText = btnElement.innerHTML;
            btnElement.innerHTML = '<span style="display:inline-block; animation: spin 1s linear infinite;">⏳</span> Procesando...';
            btnElement.disabled = true;
            btnElement.style.opacity = '0.7';
        } else {
            btnElement.innerHTML = btnElement.dataset.originalText;
            btnElement.disabled = false;
            btnElement.style.opacity = '1';
        }
    }

    window.cargarDatosIniciales = async function (role) {
        const token = localStorage.getItem('agtech_token');
        if (!token) return;

        const basePath = window.location.pathname.replace(/\/index\.html$/, '').replace(/\/$/, '');

        try {
            if (role === 'Productor Agrícola') {
                const res = await fetch('http://localhost:3000/api/lotes/mis-lotes', { headers: { 'Authorization': 'Bearer ' + token } });
                const json = await res.json();
                const tbody = document.querySelector('#tabla-lotes-productor tbody');
                if (tbody && json.success) {
                    tbody.innerHTML = json.data.map(l => `
                        <tr>
                            <td>${l.id}</td>
                            <td>${l.volumenToneladas} TN</td>
                            <td><span class="badge" style="background:#2d6a4f;color:white;padding:4px 8px;border-radius:4px;">${l.estado}</span></td>
                            <td>
                                <button type="button" class="btn-primary" style="padding: 4px 8px; font-size: 0.8em;" onclick="window.open('${window.location.origin}${basePath}/verificador?id=${l.id}', '_blank')">Ver Traza / QR</button>
                            </td>
                        </tr>
                    `).join('');
                }
            } else if (role === 'Transportista') {
                const res = await fetch('http://localhost:3000/api/lotes/transportes-disponibles', { headers: { 'Authorization': 'Bearer ' + token } });
                const json = await res.json();
                const container = document.getElementById('listaLotesTransporte');
                const hiddenInput = document.getElementById('idLoteTransporte');
                if (container && json.success) {
                    if (json.data.length === 0) {
                        container.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 20px; font-size: 0.9rem;">No hay lotes cosechados disponibles.</p>';
                        hiddenInput.value = '';
                    } else {
                        container.innerHTML = json.data.map(l => `
                            <div class="lot-card" data-id="${l.id}">
                                <div class="lot-card-info">
                                    <h4>Lote: ${l.id}</h4>
                                    <p style="margin-bottom: 2px;">RENSPA Origen: ${l.renspa}</p>
                                    <p>Geoloc: ${l.geolocalizacion}</p>
                                    <p style="margin-top: 6px; font-weight: bold; color: var(--secondary-color); font-size: 0.95rem;">${l.volumenToneladas} TN</p>
                                </div>
                                <div class="lot-card-status">${l.estado}</div>
                            </div>
                        `).join('');

                        const cards = container.querySelectorAll('.lot-card');
                        cards.forEach(card => {
                            card.addEventListener('click', () => {
                                cards.forEach(c => c.classList.remove('selected'));
                                card.classList.add('selected');
                                hiddenInput.value = card.dataset.id;
                            });
                        });
                    }
                }
            } else if (role === 'Acopiador / Cooperativa') {
                const res = await fetch('http://localhost:3000/api/lotes/entrantes', { headers: { 'Authorization': 'Bearer ' + token } });
                const json = await res.json();
                const container = document.getElementById('listaLotesAcopio');
                const hiddenInput = document.getElementById('idLoteAcopio');
                if (container && json.success) {
                    if (json.data.length === 0) {
                        container.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 20px; font-size: 0.9rem;">No hay camiones en tránsito.</p>';
                        hiddenInput.value = '';
                    } else {
                        container.innerHTML = json.data.map(l => `
                            <div class="lot-card" data-id="${l.id}">
                                <div class="lot-card-info">
                                    <h4>Lote: ${l.id}</h4>
                                    <p style="margin-bottom: 2px;">RENSPA: ${l.renspa}</p>
                                    <p>Geoloc: ${l.geolocalizacion}</p>
                                    <p style="margin-top: 6px; font-weight: bold; color: var(--secondary-color); font-size: 0.95rem;">${l.volumenToneladas} TN</p>
                                </div>
                                <div class="lot-card-status">${l.estado}</div>
                            </div>
                        `).join('');

                        const cards = container.querySelectorAll('.lot-card');
                        cards.forEach(card => {
                            card.addEventListener('click', () => {
                                cards.forEach(c => c.classList.remove('selected'));
                                card.classList.add('selected');
                                hiddenInput.value = card.dataset.id;
                            });
                        });
                    }
                }
            }
        } catch (e) {
            console.error("Error cargando datos iniciales", e);
        }
    }

    window.evaluarPantalla(); // Inicializar vista

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
                window.evaluarPantalla();
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
        window.evaluarPantalla();
        agregarLog(`ℹ️ Sesión cerrada.`);
    });

    // IndexedDB Setup
    let db;
    const request = indexedDB.open('AgTechDB', 1);

    request.onupgradeneeded = function (event) {
        db = event.target.result;
        if (!db.objectStoreNames.contains('lotes_pendientes')) {
            db.createObjectStore('lotes_pendientes', { keyPath: 'idLote' });
        }
    };

    request.onsuccess = function (event) {
        db = event.target.result;
        updateOnlineStatus(); // Validar al cargar y tras abrir la DB
    };

    request.onerror = function (event) {
        console.error("Error al abrir IndexedDB", event);
    };

    // Monitoreo de conexión a Internet (Eventos Nativos)
    window.updateOnlineStatus = function updateOnlineStatus(e) {
        let isOnline = navigator.onLine;
        if (localStorage.getItem('forceOffline') === 'true') isOnline = false;
        if (e && e.type === 'offline') isOnline = false;
        if (e && e.type === 'online') isOnline = true;

        if (isOnline) {
            statusDiv.textContent = 'Estado: Online (Conectado al Backend)';
            statusDiv.className = 'status-indicator online';
            showToast('Conexión restaurada. Sincronizando datos...', 'success');

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

    // Preview Dinámico del Hash ID
    let currentLoteTimestamp = new Date().toISOString();
    let cachedGeo = "Lat: -34.6037, Lon: -58.3816";

    const getLocation = () => new Promise((resolve) => {
        if (!navigator.geolocation) {
            resolve("Lat: -34.6037, Lon: -58.3816");
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (pos) => resolve(`Lat: ${pos.coords.latitude.toFixed(4)}, Lon: ${pos.coords.longitude.toFixed(4)}`),
            (err) => resolve("Lat: -34.6037, Lon: -58.3816") // Fallback
        );
    });

    // Obtener geolocalización de inmediato para la preview
    getLocation().then(geo => {
        cachedGeo = geo;
        actualizarHashLotePreview();
    });

    async function actualizarHashLotePreview() {
        const renspa = document.getElementById('renspa').value || '';
        const fileInput = document.getElementById('documento');
        const file = fileInput && fileInput.files.length > 0 ? fileInput.files[0] : null;

        const idLoteInput = document.getElementById('idLote');
        if (!idLoteInput) return;

        if (!renspa) {
            idLoteInput.value = '';
            return;
        }

        // Si hay archivo, calculamos el hash de su contenido. Si no (ej. en Cypress), usamos un string vacío.
        let fileHashHex = '';
        if (file) {
            try {
                const fileBuffer = await file.arrayBuffer();
                const fileHashBuffer = await crypto.subtle.digest('SHA-256', fileBuffer);
                const fileHashArray = Array.from(new Uint8Array(fileHashBuffer));
                fileHashHex = fileHashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            } catch (err) {
                console.error("Error al calcular el hash del archivo:", err);
                fileHashHex = file.name; // Fallback al nombre si falla
            }
        }

        // Generación determinista del ID de lote basado en RENSPA y el hash del archivo
        const dataToHash = `${renspa}${fileHashHex}`;
        const encoder = new TextEncoder();
        const dataBuffer = encoder.encode(dataToHash);
        const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        idLoteInput.value = '0x' + hashHex.substring(0, 16);
    }

    const inputRenspa = document.getElementById('renspa');
    const inputDocumento = document.getElementById('documento');
    if (inputRenspa) inputRenspa.addEventListener('input', actualizarHashLotePreview);
    if (inputDocumento) inputDocumento.addEventListener('change', actualizarHashLotePreview);

    // Interceptar envío de formulario
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btn-registrar');
        setLoadingState(btn, true);

        const fileInput = document.getElementById('documento');
        const file = fileInput.files.length > 0 ? fileInput.files[0] : null;

        const geolocalizacionReal = await getLocation();
        const renspa = document.getElementById('renspa').value;
        const timestamp = currentLoteTimestamp; // Mantenemos el timestamp del preview

        // Asegurarnos de tener el hash de lote previsualizado
        await actualizarHashLotePreview();
        const generatedIdLote = document.getElementById('idLote').value;

        // --- CONTROL DE DUPLICADOS EN EL FRONTEND ---
        // 1. Validar duplicado en la UI (tabla de lotes cargados)
        const celdasId = document.querySelectorAll('#tabla-lotes-productor tbody tr td:first-child');
        for (let celda of celdasId) {
            if (celda.textContent.trim() === generatedIdLote) {
                showToast(`El lote ${generatedIdLote} ya ha sido registrado.`, 'error');
                agregarLog(`<span class="error-text" style="color:#ef4444;">❌ [DUPLICADO] El lote ${generatedIdLote} ya se encuentra registrado.</span>`);
                setLoadingState(btn, false);
                return;
            }
        }

        // 2. Validar duplicado en IndexedDB (lotes locales pendientes de sincronizar)
        if (db) {
            try {
                const tx = db.transaction(['lotes_pendientes'], 'readonly');
                const store = tx.objectStore('lotes_pendientes');
                const request = store.get(generatedIdLote);
                const existeEnDB = await new Promise((resolve) => {
                    request.onsuccess = (ev) => resolve(!!ev.target.result);
                    request.onerror = () => resolve(false);
                });

                if (existeEnDB) {
                    showToast(`El lote ${generatedIdLote} ya está en la cola de envío offline.`, 'error');
                    agregarLog(`<span class="error-text" style="color:#ef4444;">❌ [DUPLICADO] El lote ${generatedIdLote} ya está pendiente de sincronización.</span>`);
                    setLoadingState(btn, false);
                    return;
                }
            } catch (err) {
                console.error("Error al validar duplicado en IndexedDB:", err);
            }
        }
        // ---------------------------------------------

        const loteData = {
            idLote: generatedIdLote,
            renspa: renspa,
            geolocalizacion: geolocalizacionReal,
            volumenToneladas: document.getElementById('volumen').value,
            timestamp: timestamp,
            documento: file // Guardar el archivo como Blob si existe
        };

        let isOnline = navigator.onLine;
        if (localStorage.getItem('forceOffline') === 'true') isOnline = false;

        if (isOnline) {
            await enviarAlBackend(loteData);
        } else {
            guardarOffline(loteData);
        }
        form.reset();
        setLoadingState(btn, false);
        window.cargarDatosIniciales('Productor Agrícola'); // Refrescar lista

        // Actualizar el timestamp para el próximo lote y limpiar preview
        currentLoteTimestamp = new Date().toISOString();
        actualizarHashLotePreview();
    });

    // Interceptar envío de formulario Transporte
    const formTransporte = document.getElementById('transporte-form');
    if (formTransporte) {
        formTransporte.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('btn-transporte');
            setLoadingState(btn, true);

            const idLote = document.getElementById('idLoteTransporte').value;
            try {
                const res = await fetch('http://localhost:3000/api/lotes/transporte', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + localStorage.getItem('agtech_token')
                    },
                    body: JSON.stringify({ idLote })
                });
                const result = await res.json();
                if (result.success) {
                    agregarLog(`<span class="success-text">✅ [TRANSPORTE] Lote ${idLote} actualizado a EN_TRANSITO.</span>`);
                    window.cargarDatosIniciales('Transportista');
                } else {
                    agregarLog(`<span class="error-text" style="color:#ef4444;">❌ [ERROR TRANSPORTE] Lote ${idLote}: ${result.error}</span>`);
                }
            } catch (error) {
                console.error('Error al iniciar transporte:', error);
                agregarLog(`<span class="error-text" style="color:#ef4444;">❌ [ERROR TRANSPORTE] Problema de red.</span>`);
            }
            formTransporte.reset();
            setLoadingState(btn, false);
        });
    }

    // Interceptar envío de formulario Acopio
    const formAcopio = document.getElementById('acopio-form');
    if (formAcopio) {
        formAcopio.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('btn-acopio');
            setLoadingState(btn, true);

            const idLote = document.getElementById('idLoteAcopio').value;
            const pesajeFinal = document.getElementById('pesajeFinal').value;
            const calidad = document.getElementById('calidadComercial').value;
            try {
                const res = await fetch('http://localhost:3000/api/lotes/acopio', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + localStorage.getItem('agtech_token')
                    },
                    body: JSON.stringify({ idLote, pesajeFinal, calidad })
                });
                const result = await res.json();
                if (result.success) {
                    agregarLog(`<span class="success-text">✅ [ACOPIO] Lote ${idLote} actualizado a ACONDICIONADO.</span>`);
                    window.cargarDatosIniciales('Acopiador / Cooperativa');
                } else {
                    agregarLog(`<span class="error-text" style="color:#ef4444;">❌ [ERROR ACOPIO] Lote ${idLote}: ${result.error}</span>`);
                }
            } catch (error) {
                console.error('Error al registrar acopio:', error);
                agregarLog(`<span class="error-text" style="color:#ef4444;">❌ [ERROR ACOPIO] Problema de red.</span>`);
            }
            formAcopio.reset();
            setLoadingState(btn, false);
        });
    }

    // SENASA: Búsqueda y Bloqueo
    const btnBuscarSenasa = document.getElementById('btn-buscar-senasa');
    if (btnBuscarSenasa) {
        btnBuscarSenasa.addEventListener('click', async () => {
            const query = document.getElementById('input-busqueda-senasa').value;
            setLoadingState(btnBuscarSenasa, true);
            try {
                const res = await fetch(`http://localhost:3000/api/lotes/buscar?q=${query}`, {
                    headers: { 'Authorization': 'Bearer ' + localStorage.getItem('agtech_token') }
                });
                const json = await res.json();
                const resultDiv = document.getElementById('resultados-busqueda-senasa');
                const formSenasa = document.getElementById('notarizar-form');

                if (json.success && json.data.length > 0) {
                    const l = json.data[0]; // Seleccionamos el primero
                    resultDiv.innerHTML = `
                        <div style="background: #1b4332; padding: 15px; border-radius: 8px; color: #e5e7eb; margin-top: 15px; word-break: break-all; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                            <p style="margin-bottom: 8px;"><strong style="color: #ffffff;">Lote Encontrado:</strong> ${l.id}</p>
                            <p style="margin-bottom: 8px;"><strong style="color: #ffffff;">Estado Actual:</strong> ${l.estado}</p>
                            ${l.ipfsCID ? `<p style="margin-bottom: 0;"><strong style="color: #ffffff;">IPFS Doc:</strong> <a href="http://127.0.0.1:8080/ipfs/${l.ipfsCID}" target="_blank" style="color:#4ade80; text-decoration: underline; font-weight: bold;">Ver Documento</a></p>` : ''}
                        </div>
                    `;
                    document.getElementById('lote-seleccionado-senasa').textContent = l.id;
                    document.getElementById('idLoteNotarizar').value = l.id;
                    formSenasa.style.display = 'block';
                } else {
                    resultDiv.innerHTML = `<p style="color:#ef4444;">No se encontraron resultados.</p>`;
                    formSenasa.style.display = 'none';
                }
            } catch (e) {
                console.error(e);
            }
            setLoadingState(btnBuscarSenasa, false);
        });
    }

    const btnBloquear = document.getElementById('btn-bloquear');
    if (btnBloquear) {
        btnBloquear.addEventListener('click', async () => {
            const idLote = document.getElementById('idLoteNotarizar').value;
            const motivo = prompt("Ingrese el motivo del bloqueo fitosanitario:");
            if (!motivo) return;

            setLoadingState(btnBloquear, true);
            try {
                const res = await fetch('http://localhost:3000/api/lotes/bloquear', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + localStorage.getItem('agtech_token')
                    },
                    body: JSON.stringify({ idLote, motivo })
                });
                const result = await res.json();
                if (result.success) {
                    agregarLog(`<span class="success-text">🚫 [SENASA] Lote ${idLote} BLOQUEADO.</span>`);
                    document.getElementById('btn-buscar-senasa').click(); // Refrescar
                } else {
                    agregarLog(`<span class="error-text" style="color:#ef4444;">❌ [ERROR SENASA] ${result.error}</span>`);
                }
            } catch (e) {
                console.error(e);
            }
            setLoadingState(btnBloquear, false);
        });
    }

    // Interceptar envío de formulario Notarizar
    const formNotarizar = document.getElementById('notarizar-form');
    if (formNotarizar) {
        formNotarizar.addEventListener('submit', async (e) => {
            e.preventDefault();
            const idLote = document.getElementById('idLoteNotarizar').value;
            const btn = document.getElementById('btn-notarizar');
            setLoadingState(btn, true);
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
                    agregarLog(`<span class="error-text" style="color:#ef4444;">❌ [ERROR BFA] Lote ${idLote}: ${result.error}</span>`);
                }
            } catch (error) {
                console.error('Error al notarizar:', error);
                agregarLog(`<span class="error-text" style="color:#ef4444;">❌ [ERROR BFA] Problema de red al notarizar.</span>`);
            }
            setLoadingState(btn, false);
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

        request.onsuccess = function () {
            agregarLog(`📦 [OFFLINE] Lote ${data.idLote} guardado en cache local. Esperando red...`);
            showToast(`Lote ${data.idLote} guardado localmente (IndexedDB).`, 'warning');

            if ('serviceWorker' in navigator && 'SyncManager' in window) {
                navigator.serviceWorker.ready.then(sw => sw.sync.register('sync-lotes').catch(e => console.warn('Background sync disabled', e)));
            }
        };
        request.onerror = function (e) {
            console.error("Error al guardar offline:", e.target.error);
            agregarLog(`❌ [ERROR OFFLINE] No se pudo guardar el lote ${data.idLote}.`);
            showToast('Error al guardar datos offline', 'error');
        };
    }

    // Sincronización en segundo plano al recuperar conexión
    async function sincronizarDatosOffline() {
        if (!db) return;
        const transaction = db.transaction(['lotes_pendientes'], 'readonly');
        const objectStore = transaction.objectStore('lotes_pendientes');
        const request = objectStore.getAll();

        request.onsuccess = async function (event) {
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
                showToast(`Lote ${data.idLote} sincronizado con éxito.`, 'success');

                if (isSync && db) {
                    // Remover de IndexedDB si fue sincronizado exitosamente
                    const tx = db.transaction(['lotes_pendientes'], 'readwrite');
                    tx.objectStore('lotes_pendientes').delete(data.idLote);
                }
            } else {
                agregarLog(`<span class="error-text" style="color:#ef4444;">❌ [ERROR] Lote ${data.idLote}: ${result.error}</span>`);
                if (!isSync) {
                    showToast(`Error al registrar lote: ${result.error}`, 'error');
                } else if (db && (result.error.includes('ya existe') || result.error.includes('ya está registrado') || result.error.includes('ya fue registrado'))) {
                    // Evitar reintentos infinitos si fue un error permanente de duplicado durante la sincronización
                    const tx = db.transaction(['lotes_pendientes'], 'readwrite');
                    tx.objectStore('lotes_pendientes').delete(data.idLote);
                    agregarLog(`ℹ️ [SINC] Lote ${data.idLote} removido de la cola por ser un registro duplicado.`);
                }
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
