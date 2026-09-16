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

// Sistema de Modales Modernos AgTech (Reemplazo de alert() y confirm() del navegador)
window.showCustomAlert = function (options = {}) {
    if (typeof options === 'string') {
        options = { message: options };
    }
    const {
        title = (options.type === 'warning' ? 'Atención' : options.type === 'info' ? 'Información' : 'Error del Sistema'),
        message = '',
        type = 'error',
        buttonText = 'Entendido'
    } = options;

    return new Promise((resolve) => {
        const overlay = document.getElementById('agtech-modal-overlay');
        const card = document.getElementById('agtech-modal-card');
        const iconEl = document.getElementById('agtech-modal-icon');
        const titleEl = document.getElementById('agtech-modal-title');
        const subtitleEl = document.getElementById('agtech-modal-subtitle');
        const bodyEl = document.getElementById('agtech-modal-body');
        const btnCancel = document.getElementById('agtech-modal-btn-cancel');
        const btnConfirm = document.getElementById('agtech-modal-btn-confirm');

        if (!overlay || !card) {
            alert(message);
            return resolve(true);
        }

        card.className = `agtech-modal-card type-${type}`;
        const icons = {
            error: '🚨',
            warning: '⚠️',
            info: 'ℹ️',
            success: '✅'
        };
        if (iconEl) iconEl.textContent = icons[type] || 'ℹ️';
        if (titleEl) titleEl.textContent = title;
        if (subtitleEl) subtitleEl.textContent = type === 'error' ? 'Acción Requerida' : type === 'warning' ? 'Validación Fitosanitaria' : 'Aviso AgTech';
        if (bodyEl) bodyEl.innerHTML = message;

        if (btnCancel) btnCancel.style.display = 'none';
        if (btnConfirm) {
            btnConfirm.textContent = buttonText;
            btnConfirm.className = `agtech-modal-btn ${type === 'error' ? 'agtech-modal-btn-danger' : 'agtech-modal-btn-primary'}`;
        }

        overlay.classList.add('active');
        if (btnConfirm) btnConfirm.focus();

        const cleanup = () => {
            overlay.classList.remove('active');
            if (btnConfirm) btnConfirm.removeEventListener('click', onConfirm);
            document.removeEventListener('keydown', onKeyDown);
            overlay.removeEventListener('click', onOverlayClick);
            resolve(true);
        };

        const onConfirm = () => cleanup();
        const onOverlayClick = (e) => {
            if (e.target === overlay) cleanup();
        };
        const onKeyDown = (e) => {
            if (e.key === 'Escape' || e.key === 'Enter') cleanup();
        };

        if (btnConfirm) btnConfirm.addEventListener('click', onConfirm);
        overlay.addEventListener('click', onOverlayClick);
        document.addEventListener('keydown', onKeyDown);
    });
};

window.showCustomConfirm = function (options = {}) {
    if (typeof options === 'string') {
        options = { message: options };
    }
    const {
        title = '¿Confirmar Operación?',
        message = '',
        type = 'info',
        confirmText = 'Confirmar',
        cancelText = 'Cancelar'
    } = options;

    return new Promise((resolve) => {
        const overlay = document.getElementById('agtech-modal-overlay');
        const card = document.getElementById('agtech-modal-card');
        const iconEl = document.getElementById('agtech-modal-icon');
        const titleEl = document.getElementById('agtech-modal-title');
        const subtitleEl = document.getElementById('agtech-modal-subtitle');
        const bodyEl = document.getElementById('agtech-modal-body');
        const btnCancel = document.getElementById('agtech-modal-btn-cancel');
        const btnConfirm = document.getElementById('agtech-modal-btn-confirm');

        if (!overlay || !card) {
            return resolve(confirm(message));
        }

        card.className = `agtech-modal-card type-${type}`;
        const icons = {
            error: '🚨',
            warning: '⚠️',
            info: '⚓',
            success: '✅'
        };
        if (iconEl) iconEl.textContent = icons[type] || '⚠️';
        if (titleEl) titleEl.textContent = title;
        if (subtitleEl) subtitleEl.textContent = 'Verificación Requerida';
        if (bodyEl) bodyEl.innerHTML = message;

        if (btnCancel) {
            btnCancel.style.display = 'inline-flex';
            btnCancel.textContent = cancelText;
        }
        if (btnConfirm) {
            btnConfirm.textContent = confirmText;
            btnConfirm.className = `agtech-modal-btn ${type === 'error' ? 'agtech-modal-btn-danger' : 'agtech-modal-btn-primary'}`;
        }

        overlay.classList.add('active');
        if (btnConfirm) btnConfirm.focus();

        const cleanup = (confirmed) => {
            overlay.classList.remove('active');
            if (btnConfirm) btnConfirm.removeEventListener('click', onConfirm);
            if (btnCancel) btnCancel.removeEventListener('click', onCancel);
            document.removeEventListener('keydown', onKeyDown);
            overlay.removeEventListener('click', onOverlayClick);
            resolve(confirmed);
        };

        const onConfirm = () => cleanup(true);
        const onCancel = () => cleanup(false);
        const onOverlayClick = (e) => {
            if (e.target === overlay) cleanup(false);
        };
        const onKeyDown = (e) => {
            if (e.key === 'Escape') cleanup(false);
            if (e.key === 'Enter') cleanup(true);
        };

        if (btnConfirm) btnConfirm.addEventListener('click', onConfirm);
        if (btnCancel) btnCancel.addEventListener('click', onCancel);
        overlay.addEventListener('click', onOverlayClick);
        document.addEventListener('keydown', onKeyDown);
    });
};

// Autocompletado de perfiles demo en la pantalla de inicio
window.seleccionarPerfilDemo = function (username, password) {
    const userInp = document.getElementById('login-user');
    const passInp = document.getElementById('login-pass');
    if (userInp && passInp) {
        userInp.value = username;
        passInp.value = password;
        userInp.focus();
        showToast(`Perfil cargado: ${username}`, 'info');
    }
};

// Obtener perfil autenticado actual (deserializado de localStorage o decodificado del JWT)
window.obtenerUsuarioActual = function () {
    const token = localStorage.getItem('agtech_token');
    if (!token) return null;
    try {
        const raw = localStorage.getItem('agtech_user');
        if (raw) return JSON.parse(raw);
    } catch (e) {
        console.warn("Error leyendo agtech_user", e);
    }

    if (token === 'mock_token') {
        return {
            username: 'productor1',
            rol: 'Productor Agrícola',
            cuit: '20-30123456-4',
            renspa: '01.002.0.00345/00',
            campos: [{ renspa: '01.002.0.00345/00', alias: 'Establecimiento San Pedro' }]
        };
    }

    if (token.includes('.')) {
        try {
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
            return JSON.parse(jsonPayload);
        } catch (e) {
            console.warn("Error decodificando JWT", e);
        }
    }
    return null;
};

// Renderizado dinámico del campo RENSPA (Patrón de diseño Mono vs Multi-Establecimiento)
window.renderizarSelectorRenspa = function (user) {
    const contenedor = document.getElementById('contenedor-renspa');
    const ayudaDiv = document.getElementById('renspa-ayuda');
    if (!contenedor) return;

    let campos = [];
    if (user && Array.isArray(user.campos) && user.campos.length > 0) {
        campos = user.campos;
    } else if (user && user.renspa) {
        campos = [{ renspa: user.renspa, alias: 'Establecimiento Principal' }];
    }

    // Caso 1: Productor mono-establecimiento (1 campo)
    // El campo RENSPA Origen se presenta en modo de solo lectura (read-only), completado automáticamente por el frontend
    if (campos.length === 1) {
        const campo = campos[0];
        contenedor.innerHTML = `
            <input type="text" id="renspa" name="renspa" value="${campo.renspa}" readonly class="readonly-field" required title="Establecimiento único fijado por perfil">
        `;
        if (ayudaDiv) {
            ayudaDiv.style.display = 'block';
            ayudaDiv.innerHTML = `<span class="renspa-badge-mono">🔒 Solo lectura: Autocompletado por perfil (${campo.alias || 'Establecimiento Principal'})</span>`;
        }

        const inputEl = document.getElementById('renspa');
        if (inputEl) {
            inputEl.addEventListener('input', () => {
                if (inputEl.readOnly && inputEl.value !== campo.renspa) {
                    inputEl.value = campo.renspa;
                }
                if (typeof window.actualizarHashLotePreviewGlobal === 'function') {
                    window.actualizarHashLotePreviewGlobal();
                }
            });
        }
    }
    // Caso 2: Productor multi-establecimiento (1:N campos)
    // El formulario renderiza un selector desplegable (<select>) precargado con los RENSPA y alias de los campos
    else if (campos.length > 1) {
        const optionsHtml = campos.map((c, index) => `
            <option value="${c.renspa}" ${index === 0 ? 'selected' : ''}>${c.alias} - ${c.renspa}</option>
        `).join('');

        contenedor.innerHTML = `
            <select id="renspa" name="renspa" class="form-select" required>
                ${optionsHtml}
            </select>
        `;
        if (ayudaDiv) {
            ayudaDiv.style.display = 'block';
            ayudaDiv.innerHTML = `<span class="renspa-badge-multi">🌾 Selector Multi-establecimiento: Seleccione campo de origen (${campos.length} habilitados)</span>`;
        }

        const selectEl = document.getElementById('renspa');
        if (selectEl) {
            selectEl.addEventListener('change', () => {
                if (typeof window.actualizarHashLotePreviewGlobal === 'function') {
                    window.actualizarHashLotePreviewGlobal();
                }
            });
            selectEl.addEventListener('input', () => {
                if (typeof window.actualizarHashLotePreviewGlobal === 'function') {
                    window.actualizarHashLotePreviewGlobal();
                }
            });
        }
    }
    // Fallback genérico si no hay sesión o no es productor
    else {
        contenedor.innerHTML = `
            <input type="text" id="renspa" name="renspa" placeholder="Ej: 01.002.0.00034/00" required>
        `;
        if (ayudaDiv) {
            ayudaDiv.style.display = 'none';
            ayudaDiv.innerHTML = '';
        }

        const fallbackInput = document.getElementById('renspa');
        if (fallbackInput) {
            fallbackInput.addEventListener('input', () => {
                if (typeof window.actualizarHashLotePreviewGlobal === 'function') {
                    window.actualizarHashLotePreviewGlobal();
                }
            });
        }
    }

    if (typeof window.actualizarHashLotePreviewGlobal === 'function') {
        window.actualizarHashLotePreviewGlobal();
    }
};

window.evaluarPantalla = function () {
    // Obtenemos los paneles dinámicamente para evitar problemas de timing
    const loginPanel = document.getElementById('login-panel');
    const userInfoPanel = document.getElementById('user-info-panel');
    const currentUserInfo = document.getElementById('current-user-info');
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
        if (currentUserInfo) currentUserInfo.style.display = 'none';
        if (registroPanel) registroPanel.style.display = 'none';
        if (transportePanel) transportePanel.style.display = 'none';
        if (acopioPanel) acopioPanel.style.display = 'none';
        if (notarizarPanel) notarizarPanel.style.display = 'none';
        if (exportarPanel) exportarPanel.style.display = 'none';

        if (typeof window.renderizarSelectorRenspa === 'function') {
            window.renderizarSelectorRenspa(null);
        }
    } else {
        if (loginPanel) loginPanel.style.display = 'none';
        if (userInfoPanel) userInfoPanel.style.display = 'block';
        if (currentRoleSpan) currentRoleSpan.textContent = role;

        const user = window.obtenerUsuarioActual();
        if (currentUserInfo) {
            if (user) {
                currentUserInfo.style.display = 'block';
                currentUserInfo.innerHTML = `
                    <strong>${user.username || ''}</strong><br>
                    ${user.cuit ? `<span style="font-size: 0.75rem; opacity: 0.9;">CUIT: ${user.cuit}</span>` : ''}
                `;
            } else {
                currentUserInfo.style.display = 'none';
            }
        }

        if (registroPanel) registroPanel.style.display = role === 'Productor Agrícola' ? 'block' : 'none';
        if (transportePanel) transportePanel.style.display = role === 'Transportista' ? 'block' : 'none';
        if (acopioPanel) acopioPanel.style.display = role === 'Acopiador / Cooperativa' ? 'block' : 'none';
        if (notarizarPanel) notarizarPanel.style.display = role === 'Organismo de Control (SENASA/ARCA)' ? 'block' : 'none';
        if (exportarPanel) exportarPanel.style.display = role === 'Exportador (Puertos)' ? 'block' : 'none';

        if (role === 'Productor Agrícola' && typeof window.renderizarSelectorRenspa === 'function') {
            window.renderizarSelectorRenspa(user);
        }

        if (typeof window.cargarDatosIniciales === 'function') {
            window.cargarDatosIniciales(role);
        }

        if (role === 'Transportista' && typeof window.initTransportMap === 'function') {
            setTimeout(window.initTransportMap, 300); // Dar tiempo a que el panel sea visible
        }
    }
};
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
                const containerT1 = document.getElementById('listaLotesTransporte');
                const hiddenInput = document.getElementById('idLoteTransporte');
                const containerT2 = document.getElementById('listaLotesTransporteTramo2');

                async function cargarTramo1() {
                    if (!containerT1) return;
                    try {
                        const res = await fetch('http://localhost:3000/api/lotes/transportes-disponibles', { headers: { 'Authorization': 'Bearer ' + token } });
                        const json = await res.json();
                        const lotesT1 = (json && json.success && Array.isArray(json.data)) ? json.data : [];
                        if (lotesT1.length === 0) {
                            containerT1.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 20px; font-size: 0.9rem;">No hay lotes cosechados disponibles en campo.</p>';
                            if (hiddenInput) hiddenInput.value = '';
                        } else {
                            containerT1.innerHTML = lotesT1.map(l => `
                                <div class="lot-card" data-id="${l.id}">
                                    <div class="lot-card-info">
                                        <h4>Lote: ${l.id}</h4>
                                        <p style="margin-bottom: 2px;">RENSPA Origen: ${l.renspa}</p>
                                        <p>Geoloc: ${l.geolocalizacion}</p>
                                        <p style="margin-top: 6px; font-weight: bold; color: var(--secondary-color); font-size: 0.95rem;">${l.volumenToneladas} TN (CPE Primaria)</p>
                                    </div>
                                    <div class="lot-card-status">${l.estado}</div>
                                </div>
                            `).join('');

                            const cards = containerT1.querySelectorAll('.lot-card');
                            cards.forEach(card => {
                                card.addEventListener('click', () => {
                                    cards.forEach(c => c.classList.remove('selected'));
                                    card.classList.add('selected');
                                    if (hiddenInput) hiddenInput.value = card.dataset.id;
                                });
                            });
                        }
                    } catch (e1) {
                        console.error('Error al cargar Tramo 1:', e1);
                        containerT1.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 20px; font-size: 0.9rem;">No hay lotes cosechados disponibles en campo.</p>';
                        if (hiddenInput) hiddenInput.value = '';
                    }
                }

                async function cargarTramo2() {
                    if (!containerT2) return;
                    try {
                        const resPort = await fetch('http://localhost:3000/api/lotes/entrantes-puerto', { headers: { 'Authorization': 'Bearer ' + token } });
                        const jsonPort = await resPort.json();
                        const lotesT2 = (jsonPort && jsonPort.success && Array.isArray(jsonPort.data)) ? jsonPort.data : [];
                        if (lotesT2.length === 0) {
                            containerT2.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 20px; font-size: 0.9rem;">No hay traslados activos hacia terminales portuarias.</p>';
                        } else {
                            containerT2.innerHTML = lotesT2.map(l => {
                                const cpe = l.cpeTraslado || {};
                                return `
                                    <div class="lot-card" style="border-left: 4px solid #0284c7;">
                                        <div class="lot-card-info">
                                            <h4>Lote: ${l.id} &rarr; <span style="color:#38bdf8;">${cpe.destinoPuerto || 'Puerto'}</span></h4>
                                            <p style="margin-bottom: 2px;">CPE Traslado: <strong>${cpe.numeroCPE || 'N/A'}</strong> (CTG: ${cpe.ctg || 'N/A'})</p>
                                            <p>Transportista: ${cpe.transportista || 'N/A'} | Patente: ${cpe.patenteCamion || 'N/A'}</p>
                                            <p style="margin-top: 6px; font-weight: bold; color: var(--secondary-color); font-size: 0.95rem;">${l.volumenToneladas} TN</p>
                                        </div>
                                        <div class="lot-card-status" style="background:#0284c7; color:white;">EN_TRANSITO_PUERTO</div>
                                    </div>
                                `;
                            }).join('');
                        }
                    } catch (e2) {
                        console.error('Error al cargar Tramo 2:', e2);
                        containerT2.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 20px; font-size: 0.9rem;">No hay traslados activos hacia terminales portuarias.</p>';
                    }
                }

                // Configurar pestañas Tramo 1 y Tramo 2
                const tab1 = document.getElementById('tab-tramo1');
                const tab2 = document.getElementById('tab-tramo2');
                const vista1 = document.getElementById('vista-tramo1');
                const vista2 = document.getElementById('vista-tramo2');

                if (tab1 && tab2 && vista1 && vista2) {
                    tab1.onclick = () => {
                        tab1.style.background = '#fca311';
                        tab1.style.color = '#081c15';
                        tab1.style.fontWeight = '700';
                        tab2.style.background = '#374151';
                        tab2.style.color = 'white';
                        tab2.style.fontWeight = 'normal';
                        vista1.style.display = 'block';
                        vista2.style.display = 'none';
                        cargarTramo1();
                    };
                    tab2.onclick = () => {
                        tab2.style.background = '#fca311';
                        tab2.style.color = '#081c15';
                        tab2.style.fontWeight = '700';
                        tab1.style.background = '#374151';
                        tab1.style.color = 'white';
                        tab1.style.fontWeight = 'normal';
                        vista1.style.display = 'none';
                        vista2.style.display = 'block';
                        cargarTramo2();
                    };
                }

                // Cargar ambos tramos de manera inicial
                cargarTramo1();
                cargarTramo2();
            } else if (role === 'Acopiador / Cooperativa') {
                // 3A. Camiones entrantes en viaje por flete corto hacia acopio
                const container = document.getElementById('listaLotesAcopio');
                const hiddenInput = document.getElementById('idLoteAcopio');
                try {
                    const res = await fetch('http://localhost:3000/api/lotes/entrantes', { headers: { 'Authorization': 'Bearer ' + token } });
                    const json = await res.json();
                    if (container) {
                        const lotesAcopio = (json && json.success && Array.isArray(json.data)) ? json.data : [];
                        if (lotesAcopio.length === 0) {
                            container.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 15px; font-size: 0.9rem;">No hay camiones en viaje hacia planta de acopio.</p>';
                            if (hiddenInput) hiddenInput.value = '';
                        } else {
                            container.innerHTML = lotesAcopio.map(l => `
                                <div class="lot-card" data-id="${l.id}">
                                    <div class="lot-card-info">
                                        <h4>Camión: ${l.id}</h4>
                                        <p style="margin-bottom: 2px;">RENSPA Productor: ${l.renspa}</p>
                                        <p>Ubicación: ${l.geolocalizacion}</p>
                                        <p style="margin-top: 6px; font-weight: bold; color: var(--secondary-color); font-size: 0.95rem;">${l.volumenToneladas} TN estimadas en CPE</p>
                                    </div>
                                    <div class="lot-card-status" style="background:#f59e0b; color:#081c15;">${l.estado}</div>
                                </div>
                            `).join('');

                            const cards = container.querySelectorAll('.lot-card');
                            cards.forEach(card => {
                                card.addEventListener('click', () => {
                                    cards.forEach(c => c.classList.remove('selected'));
                                    card.classList.add('selected');
                                    if (hiddenInput) hiddenInput.value = card.dataset.id;
                                    const volInp = document.getElementById('pesajeFinal');
                                    if (volInp) {
                                        const lObj = lotesAcopio.find(x => x.id === card.dataset.id);
                                        if (lObj) volInp.value = lObj.volumenToneladas;
                                    }
                                });
                            });
                        }
                    }
                } catch (e3A) {
                    console.error('Error al cargar 3A:', e3A);
                    if (container) {
                        container.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 15px; font-size: 0.9rem;">No hay camiones en viaje hacia planta de acopio.</p>';
                        if (hiddenInput) hiddenInput.value = '';
                    }
                }

                // 3B. Cargar lotes disponibles para mezcla o acondicionamiento en silos
                const containerMezcla = document.getElementById('listaLotesMezcla');
                const resumenMezcla = document.getElementById('resumen-mezcla');
                const volumenProyectado = document.getElementById('volumenProyectadoMezcla');
                const cantidadLotes = document.getElementById('cantidadLotesMezcla');
                try {
                    const resMezcla = await fetch('http://localhost:3000/api/lotes/para-mezcla', { headers: { 'Authorization': 'Bearer ' + token } });
                    const jsonMezcla = await resMezcla.json();
                    if (containerMezcla) {
                        const lotesMezcla = (jsonMezcla && jsonMezcla.success && Array.isArray(jsonMezcla.data)) ? jsonMezcla.data : [];
                        if (lotesMezcla.length === 0) {
                            containerMezcla.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 15px; font-size: 0.9rem;">No hay partidas recepcionadas en balanza. Descargue camiones ingresantes para habilitar mezcla en silos.</p>';
                            if (resumenMezcla) resumenMezcla.style.display = 'none';
                        } else {
                            containerMezcla.innerHTML = lotesMezcla.map(l => `
                                <div class="lot-card mezcla-card" data-id="${l.id}" data-vol="${l.volumenToneladas}" style="cursor: pointer; display: flex; justify-content: space-between; align-items: center; padding: 10px 14px;">
                                    <div style="display: flex; align-items: center; gap: 12px;">
                                        <input type="checkbox" class="chk-lote-mezcla" value="${l.id}" data-vol="${l.volumenToneladas}" style="transform: scale(1.3); cursor: pointer;">
                                        <div class="lot-card-info">
                                            <h4 style="margin: 0; font-size: 0.95rem;">Lote: ${l.id}</h4>
                                            <p style="margin: 2px 0 0; font-size: 0.8rem; color: var(--text-secondary);">RENSPA: ${l.renspa}</p>
                                            <p style="margin: 2px 0 0; font-weight: bold; color: var(--secondary-color); font-size: 0.9rem;">${l.volumenToneladas} TN</p>
                                        </div>
                                    </div>
                                    <div class="lot-card-status" style="font-size: 0.72rem; background: #059669; color: white; padding: 2px 6px; border-radius: 4px;">${l.estado}</div>
                                </div>
                            `).join('');

                            const checkboxes = containerMezcla.querySelectorAll('.chk-lote-mezcla');
                            const cardsMezcla = containerMezcla.querySelectorAll('.lot-card.mezcla-card');

                            function actualizarResumenMezcla() {
                                let totalVol = 0;
                                let count = 0;
                                checkboxes.forEach(chk => {
                                    if (chk.checked) {
                                        totalVol += parseFloat(chk.dataset.vol || 0);
                                        count++;
                                    }
                                });
                                if (count > 0 && resumenMezcla) {
                                    resumenMezcla.style.display = 'block';
                                    if (volumenProyectado) volumenProyectado.textContent = `${totalVol.toFixed(2)} TN`;
                                    if (cantidadLotes) cantidadLotes.textContent = count;
                                } else if (resumenMezcla) {
                                    resumenMezcla.style.display = 'none';
                                }
                            }

                            cardsMezcla.forEach(card => {
                                card.addEventListener('click', (e) => {
                                    if (e.target.tagName !== 'INPUT') {
                                        const chk = card.querySelector('.chk-lote-mezcla');
                                        chk.checked = !chk.checked;
                                    }
                                    card.classList.toggle('selected', card.querySelector('.chk-lote-mezcla').checked);
                                    actualizarResumenMezcla();
                                });
                            });
                        }
                    }
                } catch (e3B) {
                    console.error('Error al cargar 3B:', e3B);
                    if (containerMezcla) {
                        containerMezcla.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 15px; font-size: 0.9rem;">No hay partidas recepcionadas en balanza. Descargue camiones ingresantes para habilitar mezcla en silos.</p>';
                        if (resumenMezcla) resumenMezcla.style.display = 'none';
                    }
                }

                // 3C. Cargar lotes validados por SENASA para emisión de nueva CPE de traslado
                const containerTraslado = document.getElementById('listaLotesParaTraslado');
                const hiddenInputTraslado = document.getElementById('idLoteTraslado');
                try {
                    const resTraslado = await fetch('http://localhost:3000/api/lotes/para-traslado', { headers: { 'Authorization': 'Bearer ' + token } });
                    const jsonTraslado = await resTraslado.json();
                    if (containerTraslado) {
                        const lotesTraslado = (jsonTraslado && jsonTraslado.success && Array.isArray(jsonTraslado.data)) ? jsonTraslado.data : [];
                        if (lotesTraslado.length === 0) {
                            containerTraslado.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 15px; font-size: 0.9rem;">No hay partidas con certificación oficial de SENASA. Solicite la fiscalización sanitaria para habilitar la emisión de CPE de traslado.</p>';
                            if (hiddenInputTraslado) hiddenInputTraslado.value = '';
                        } else {
                            containerTraslado.innerHTML = lotesTraslado.map(l => `
                                <div class="lot-card traslado-card" data-id="${l.id}" style="cursor: pointer; border-left: 4px solid #10b981;">
                                    <div class="lot-card-info">
                                        <h4>Partida Silo: ${l.id}</h4>
                                        <p style="margin-bottom: 2px;">Volumen: <strong>${l.volumenToneladas} TN</strong> | Sello BFA: <span style="font-family:monospace; color:#86efac;">${(l.bfaHash || '').substring(0, 16)}...</span></p>
                                        <p style="color:#a7f3d0; font-size:0.8rem;">🛡️ Fitosanitariamente Conforme</p>
                                    </div>
                                    <div class="lot-card-status" style="background:#059669; color:white;">${l.estado}</div>
                                </div>
                            `).join('');

                            const cards = containerTraslado.querySelectorAll('.traslado-card');
                            cards.forEach(card => {
                                card.addEventListener('click', () => {
                                    cards.forEach(c => c.classList.remove('selected'));
                                    card.classList.add('selected');
                                    if (hiddenInputTraslado) hiddenInputTraslado.value = card.dataset.id;
                                    const cpeInp = document.getElementById('cpeNumeroTraslado');
                                    if (cpeInp && !cpeInp.value) {
                                        cpeInp.value = `CPE-TL-${card.dataset.id.replace(/[^A-Za-z0-9]/g, '')}-${Date.now().toString().slice(-4)}`;
                                    }
                                });
                            });
                        }
                    }
                } catch (e3C) {
                    console.error('Error al cargar 3C:', e3C);
                    if (containerTraslado) {
                        containerTraslado.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 15px; font-size: 0.9rem;">No hay partidas con certificación oficial de SENASA. Solicite la fiscalización sanitaria para habilitar la emisión de CPE de traslado.</p>';
                        if (hiddenInputTraslado) hiddenInputTraslado.value = '';
                    }
                }
            } else if (role === 'Organismo de Control (SENASA/ARCA)') {
                // Listar partidas activas (ACOPIADO_ACONDICIONADO) disponibles para fiscalización oficial
                const resultDiv = document.getElementById('resultados-busqueda-senasa');
                const formSenasa = document.getElementById('notarizar-form');
                try {
                    const res = await fetch('http://localhost:3000/api/lotes/buscar', { headers: { 'Authorization': 'Bearer ' + token } });
                    const json = await res.json();
                    if (resultDiv) {
                        const lotesSenasa = (json && json.success && Array.isArray(json.data)) ? json.data : [];
                        if (lotesSenasa.length === 0) {
                            resultDiv.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 15px; font-size: 0.9rem;">No hay partidas activas en estado ACOPIADO_ACONDICIONADO pendientes de auditoría.</p>';
                            if (formSenasa) formSenasa.style.display = 'none';
                        } else {
                            resultDiv.innerHTML = `
                                <p style="font-size: 0.85rem; color: #a7f3d0; margin-bottom: 8px; font-weight: 600;">
                                    📋 Partidas en Acopio Disponibles para Fiscalización Sanitaria (${lotesSenasa.length}):
                                </p>
                                <div style="display: flex; flex-direction: column; gap: 8px; max-height: 250px; overflow-y: auto;">
                                    ${lotesSenasa.map(l => {
                                const verifUrl = `${window.location.origin}${basePath}/verificador?id=${l.id}`;
                                const tieneBFA = !!l.bfaHash;
                                return `
                                            <div class="lot-card senasa-lot-card" data-id="${l.id}" style="cursor: pointer; background: #132a13; border: 1px solid #2d6a4f; padding: 10px 14px; border-radius: 6px;">
                                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                                    <div>
                                                        <strong style="color: #ffffff; font-size: 0.95rem;">Lote: ${l.id}</strong>
                                                        <div style="font-size: 0.8rem; color: #9ca3af; margin-top: 2px;">
                                                            RENSPA: ${l.renspa} | Vol: <strong>${l.volumenToneladas} TN</strong>
                                                        </div>
                                                    </div>
                                                    <div style="text-align: right;">
                                                        <span class="badge" style="background:#0284c7; color:white; font-size:0.75rem; padding: 2px 6px; border-radius: 4px;">${l.estado}</span>
                                                        ${tieneBFA ? '<div style="font-size:0.7rem; color:#86efac; margin-top:3px;">🛡️ Sellado BFA</div>' : '<div style="font-size:0.7rem; color:#fde047; margin-top:3px;">⏳ Pendiente Sello BFA</div>'}
                                                    </div>
                                                </div>
                                                <div style="margin-top: 6px; display: flex; justify-content: space-between; align-items: center;">
                                                    <a href="${verifUrl}" target="_blank" onclick="event.stopPropagation();" style="color: #38bdf8; font-size: 0.78rem; text-decoration: underline;">🔍 Ver Traza / QR</a>
                                                    <span style="font-size: 0.75rem; color: #86efac;">👆 Clic para fiscalizar</span>
                                                </div>
                                            </div>
                                        `;
                            }).join('')}
                                </div>
                            `;

                            const cards = resultDiv.querySelectorAll('.senasa-lot-card');
                            cards.forEach(card => {
                                card.addEventListener('click', () => {
                                    cards.forEach(c => c.style.borderColor = '#2d6a4f');
                                    card.style.borderColor = '#38bdf8';
                                    const idSel = card.dataset.id;
                                    document.getElementById('lote-seleccionado-senasa').textContent = idSel;
                                    document.getElementById('idLoteNotarizar').value = idSel;
                                    if (formSenasa) formSenasa.style.display = 'block';
                                });
                            });
                        }
                    }
                } catch (e4) {
                    console.error('Error al cargar SENASA:', e4);
                    if (resultDiv) {
                        resultDiv.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 15px; font-size: 0.9rem;">No hay partidas activas en estado ACOPIADO_ACONDICIONADO pendientes de auditoría.</p>';
                        if (formSenasa) formSenasa.style.display = 'none';
                    }
                }
            } else if (role === 'Exportador (Puertos)') {
                // Auto-completar dirección wallet si está vacía
                const walletInp = document.getElementById('walletExportador');
                if (walletInp && !walletInp.value) {
                    walletInp.value = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
                }

                // 5A. Convoys en tránsito hacia puerto
                const containerConvoys = document.getElementById('listaConvoysEntrantes');
                try {
                    const resConvoys = await fetch('http://localhost:3000/api/lotes/entrantes-puerto', { headers: { 'Authorization': 'Bearer ' + token } });
                    const jsonConvoys = await resConvoys.json();
                    if (containerConvoys) {
                        const convoys = (jsonConvoys && jsonConvoys.success && Array.isArray(jsonConvoys.data)) ? jsonConvoys.data : [];
                        if (convoys.length === 0) {
                            containerConvoys.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 15px; font-size: 0.9rem;">No hay convoys en tránsito hacia la terminal portuaria.</p>';
                        } else {
                            containerConvoys.innerHTML = convoys.map(l => {
                                const cpe = l.cpeTraslado || {};
                                return `
                                    <div class="lot-card" style="border-left: 4px solid #f59e0b; display: flex; justify-content: space-between; align-items: center; padding: 12px 16px;">
                                        <div class="lot-card-info">
                                            <h4>Convoy: ${l.id} &rarr; <span class="badge-puerto ${cpe.destinoPuerto && cpe.destinoPuerto.includes('Quequén') ? 'quequen' : 'bahia'}">${cpe.destinoPuerto || 'Puerto'}</span></h4>
                                            <p style="margin-bottom: 2px;">CPE Traslado: <strong>${cpe.numeroCPE || 'N/A'}</strong> (CTG: ${cpe.ctg || 'N/A'})</p>
                                            <p>Transportista: ${cpe.transportista || 'N/A'} (Patente: ${cpe.patenteCamion || 'N/A'})</p>
                                            <p style="margin-top: 4px; font-weight: bold; color: var(--secondary-color);">${l.volumenToneladas} TN</p>
                                        </div>
                                        <div>
                                            <button type="button" class="btn-primary" style="background:#2a9d8f; font-size:0.85rem; padding: 8px 12px;" onclick="window.confirmarArriboConvoy('${l.id}')">
                                                ✅ Confirmar Arribo y CPE Descarga
                                            </button>
                                        </div>
                                    </div>
                                `;
                            }).join('');
                        }
                    }
                } catch (e5A) {
                    console.error('Error al cargar 5A:', e5A);
                    if (containerConvoys) {
                        containerConvoys.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 15px; font-size: 0.9rem;">No hay convoys en tránsito hacia la terminal portuaria.</p>';
                    }
                }

                // 5B. Listado de Pedidos Habilitados para Embarque (Auditoría concurrente de 3 condiciones)
                const containerPedidos = document.getElementById('listaPedidosHabilitados');
                try {
                    const resHabilitados = await fetch('http://localhost:3000/api/lotes/habilitados-embarque', { headers: { 'Authorization': 'Bearer ' + token } });
                    const jsonHabilitados = await resHabilitados.json();
                    if (containerPedidos) {
                        const pedidos = (jsonHabilitados && jsonHabilitados.success && Array.isArray(jsonHabilitados.data)) ? jsonHabilitados.data : [];
                        if (pedidos.length === 0) {
                            containerPedidos.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 15px; font-size: 0.9rem;">No hay pedidos registrados en la terminal portuaria.</p>';
                        } else {
                            containerPedidos.innerHTML = pedidos.map(l => {
                                const aud = l.auditoriaEmbarque || {};
                                const checks = aud.checks || {};
                                const c1 = checks.cpeDescargaConfirmada && checks.cpeDescargaConfirmada.cumplido;
                                const c2 = checks.selloBfaValido && checks.selloBfaValido.cumplido;
                                const c3 = checks.trazabilidadMasaAcreditada && checks.trazabilidadMasaAcreditada.cumplido;
                                const esHabilitado = aud.habilitado;

                                const cpe = l.cpeTraslado || {};
                                const puertoDestino = cpe.destinoPuerto || (l.arriboPuerto ? l.arriboPuerto.terminal : 'Terminal Portuaria');
                                const verifUrl = `${window.location.origin}${basePath}/verificador?id=${l.id}`;

                                return `
                                    <div class="embarque-card ${esHabilitado ? 'habilitado' : 'incompleto'}">
                                        <div class="embarque-header">
                                            <div>
                                                <strong style="color: #ffffff; font-size: 1.05rem;">Pedido: ${l.id}</strong>
                                                <span class="badge-puerto ${puertoDestino.includes('Quequén') ? 'quequen' : 'bahia'}" style="margin-left: 8px;">${puertoDestino}</span>
                                            </div>
                                            <div>
                                                <span class="badge-habilitado-tag ${esHabilitado ? 'ok' : 'pend'}">
                                                    ${esHabilitado ? '✅ Habilitado para Embarque' : '⏳ Pendiente de Habilitación'}
                                                </span>
                                            </div>
                                        </div>

                                        <div style="font-size: 0.85rem; color: #cbd5e1; margin-bottom: 8px;">
                                            Volumen Total: <strong>${l.volumenToneladas} TN</strong> | Estado Actual: <strong>${l.estado}</strong>
                                        </div>

                                        <!-- Grid de las 3 Condiciones Concurrentes -->
                                        <div class="checks-grid">
                                            <div class="check-item ${c1 ? 'ok' : 'fail'}">
                                                <span>${c1 ? '✔' : '✖'}</span>
                                                <span><strong>1. Arribo y CPE Descarga:</strong> ${c1 ? 'Confirmada definitivamente en terminal' : 'Pendiente (Camión no arribó o no confirmó descarga)'}</span>
                                            </div>
                                            <div class="check-item ${c2 ? 'ok' : 'fail'}">
                                                <span>${c2 ? '✔' : '✖'}</span>
                                                <span><strong>2. Sello Inmutable SENASA/AFIP en BFA:</strong> ${c2 ? `Comprobable (${(checks.selloBfaValido.bfaHash || '').substring(0, 16)}...)` : 'No comprobable / Sin hash BFA'}</span>
                                            </div>
                                            <div class="check-item ${c3 ? 'ok' : 'fail'}">
                                                <span>${c3 ? '✔' : '✖'}</span>
                                                <span><strong>3. Acreditación Estricta de Masa:</strong> ${c3 ? `Auditada (${checks.trazabilidadMasaAcreditada.cantidadOrigenes} productores raíz con RENSPA)` : 'Backtracking incompleto o sin RENSPA'}</span>
                                            </div>
                                        </div>

                                        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px;">
                                            <a href="${verifUrl}" target="_blank" style="color: #38bdf8; font-size: 0.82rem; text-decoration: underline;">🔍 Auditar Árbol de Trazabilidad ↗</a>
                                            ${esHabilitado ? `
                                                <button type="button" class="btn-primary" style="background:#7b1fa2; padding: 6px 14px; font-size: 0.85rem; font-weight:700;" onclick="window.seleccionarParaEmbarque('${l.id}')">
                                                    🚢 Seleccionar para Embarque y Despacho
                                                </button>
                                            ` : `
                                                <span style="font-size: 0.78rem; color: #fca5a5;">Cumpla las 3 condiciones para habilitar embarque</span>
                                            `}
                                        </div>
                                    </div>
                                `;
                            }).join('');
                        }
                    }
                } catch (e5B) {
                    console.error('Error al cargar 5B:', e5B);
                    if (containerPedidos) {
                        containerPedidos.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 15px; font-size: 0.9rem;">No hay pedidos registrados en la terminal portuaria.</p>';
                    }
                }
            }
        } catch (e) {
            console.error("Error cargando datos iniciales", e);
        }
    };

    window.evaluarPantalla(); // Inicializar vista

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('login-user').value.trim();
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
                const userInfo = {
                    username: username,
                    rol: data.rol,
                    cuit: data.cuit,
                    campos: data.campos || [],
                    renspa: data.renspa
                };
                localStorage.setItem('agtech_user', JSON.stringify(userInfo));
                window.evaluarPantalla();
                loginForm.reset();
                agregarLog(`<span class="success-text">✅ Sesión iniciada como ${data.rol} (${data.cuit || username})</span>`);
                showToast(`Sesión iniciada: ${username}`, 'success');
            } else {
                window.showCustomAlert({
                    title: 'Error de Autenticación',
                    message: `No fue posible iniciar sesión: <strong>${data.error || 'Credenciales no válidas'}</strong>.<br><span style="color:#94a3b8; font-size:0.85rem;">Por favor verifique el usuario institucional y la contraseña ingresada.</span>`,
                    type: 'error',
                    buttonText: 'Reintentar'
                });
            }
        } catch (err) {
            console.error('Error de red al intentar loguearse:', err);
            window.showCustomAlert({
                title: 'Error de Red / Conectividad',
                message: 'No se pudo conectar con el servidor backend central (Node.js en puerto 3000).<br><span style="color:#94a3b8; font-size:0.85rem;">Verifique que el servicio esté ejecutándose o revise su conexión a la red local.</span>',
                type: 'error',
                buttonText: 'Cerrar'
            });
        }
    });

    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('agtech_token');
        localStorage.removeItem('agtech_role');
        localStorage.removeItem('agtech_user');
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
        const renspaEl = document.getElementById('renspa');
        const renspa = renspaEl ? renspaEl.value.trim() : '';
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

    // Exponer función de preview de hash para actualizarse cuando cambia el selector o se autocompleta
    window.actualizarHashLotePreviewGlobal = actualizarHashLotePreview;

    const inputRenspa = document.getElementById('renspa');
    const inputDocumento = document.getElementById('documento');
    if (inputRenspa) {
        inputRenspa.addEventListener('input', actualizarHashLotePreview);
        inputRenspa.addEventListener('change', actualizarHashLotePreview);
    }
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

        // Re-renderizar selector o campo readonly de RENSPA según el perfil autenticado tras reset
        const userActual = window.obtenerUsuarioActual();
        if (userActual && typeof window.renderizarSelectorRenspa === 'function') {
            window.renderizarSelectorRenspa(userActual);
        }

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

    // Interceptar envío de formulario Mezcla en Silos (Trazabilidad de Masa)
    const formMezcla = document.getElementById('mezcla-form');
    if (formMezcla) {
        formMezcla.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('btn-mezcla');
            setLoadingState(btn, true);

            const nuevoIdLote = document.getElementById('nuevoIdLoteMezcla').value.trim();
            const checkedBoxes = document.querySelectorAll('#listaLotesMezcla .chk-lote-mezcla:checked');
            const idsLotesOrigen = Array.from(checkedBoxes).map(cb => cb.value);

            if (idsLotesOrigen.length < 2) {
                showToast('Debe seleccionar al menos 2 lotes precursores para la mezcla.', 'warning');
                agregarLog(`<span class="error-text" style="color:#ef4444;">❌ [ERROR MEZCLA] Se requieren al menos 2 lotes para consolidar en silo.</span>`);
                setLoadingState(btn, false);
                return;
            }

            try {
                const res = await fetch('http://localhost:3000/api/lotes/mezclar', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + localStorage.getItem('agtech_token')
                    },
                    body: JSON.stringify({ nuevoIdLote, idsLotesOrigen })
                });
                const result = await res.json();
                if (result.success) {
                    const basePath = window.location.pathname.replace(/\/index\.html$/, '').replace(/\/$/, '');
                    const verifUrl = `${window.location.origin}${basePath}/verificador?id=${nuevoIdLote}`;
                    agregarLog(`<span class="success-text">✅ [MEZCLA EN SILO] Lote consolidado ${nuevoIdLote} (${result.data.volumenToneladas} TN) creado a partir de ${idsLotesOrigen.length} lotes. <a href="${verifUrl}" target="_blank" style="color: #4ade80; text-decoration: underline; font-weight: bold; margin-left: 6px;">[Ver Trazabilidad de Masa ↗]</a></span>`);
                    showToast(`Lote consolidado ${nuevoIdLote} creado con éxito.`, 'success');
                    formMezcla.reset();
                    const resumenMezcla = document.getElementById('resumen-mezcla');
                    if (resumenMezcla) resumenMezcla.style.display = 'none';
                    window.cargarDatosIniciales('Acopiador / Cooperativa');
                } else {
                    agregarLog(`<span class="error-text" style="color:#ef4444;">❌ [ERROR MEZCLA] ${result.error}</span>`);
                    showToast(`Error al mezclar: ${result.error}`, 'error');
                }
            } catch (error) {
                console.error('Error al realizar mezcla en silo:', error);
                agregarLog(`<span class="error-text" style="color:#ef4444;">❌ [ERROR MEZCLA] Problema de conexión.</span>`);
            }
            setLoadingState(btn, false);
        });
    }

    // SENASA: Búsqueda y Bloqueo
    const btnBuscarSenasa = document.getElementById('btn-buscar-senasa');
    if (btnBuscarSenasa) {
        btnBuscarSenasa.addEventListener('click', async () => {
            const query = (document.getElementById('input-busqueda-senasa').value || '').trim();
            setLoadingState(btnBuscarSenasa, true);
            try {
                const res = await fetch(`http://localhost:3000/api/lotes/buscar?q=${encodeURIComponent(query)}`, {
                    headers: { 'Authorization': 'Bearer ' + localStorage.getItem('agtech_token') }
                });
                const json = await res.json();
                const resultDiv = document.getElementById('resultados-busqueda-senasa');
                const formSenasa = document.getElementById('notarizar-form');
                const basePath = window.location.pathname.replace(/\/index\.html$/, '').replace(/\/$/, '');

                if (json.success && json.data.length > 0) {
                    const l = json.data[0]; // Seleccionamos el primero si es búsqueda específica
                    const verifUrl = `${window.location.origin}${basePath}/verificador?id=${l.id}`;
                    resultDiv.innerHTML = `
                        <div style="background: #1b4332; padding: 15px; border-radius: 8px; color: #e5e7eb; margin-top: 15px; word-break: break-all; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                                <span style="font-size:1rem; font-weight:bold; color:#ffffff;">Lote Activo: ${l.id}</span>
                                <span class="badge" style="background:#0284c7; color:white; padding:4px 8px; border-radius:4px; font-size:0.8rem;">${l.estado}</span>
                            </div>
                            <p style="margin-bottom: 6px;"><strong style="color: #ffffff;">RENSPA:</strong> ${l.renspa}</p>
                            <p style="margin-bottom: 6px;"><strong style="color: #ffffff;">Volumen Verificado:</strong> ${l.volumenToneladas} TN</p>
                            ${l.bfaHash ? `<p style="margin-bottom: 6px; font-size:0.8rem; color:#86efac;"><strong>Sello BFA:</strong> ${l.bfaHash.substring(0, 24)}...</p>` : '<p style="margin-bottom: 6px; font-size:0.8rem; color:#fde047;"><strong>Sello BFA:</strong> Pendiente de certificación</p>'}
                            ${l.ipfsCID ? `<p style="margin-bottom: 8px;"><strong style="color: #ffffff;">CPE IPFS:</strong> <a href="http://127.0.0.1:8080/ipfs/${l.ipfsCID}" target="_blank" style="color:#4ade80; text-decoration: underline; font-weight: bold;">Ver Documento</a></p>` : ''}
                            <p style="margin-top: 10px;"><a href="${verifUrl}" target="_blank" style="display: inline-block; background: #0284c7; color: white; padding: 6px 12px; border-radius: 4px; text-decoration: none; font-size: 0.85rem; font-weight: bold;">🔍 Abrir Verificador Público / Desglose de Masa ↗</a></p>
                        </div>
                    `;
                    document.getElementById('lote-seleccionado-senasa').textContent = l.id;
                    document.getElementById('idLoteNotarizar').value = l.id;
                    formSenasa.style.display = 'block';
                } else if (json.success && json.loteConsumido) {
                    const lc = json.loteConsumido;
                    const verifUrl = `${window.location.origin}${basePath}/verificador?id=${lc.id}`;
                    resultDiv.innerHTML = `
                        <div style="background: #451a03; border: 1px solid #b45309; padding: 15px; border-radius: 8px; color: #fef3c7; margin-top: 15px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                            <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
                                <span style="font-size:1.4rem;">⛔</span>
                                <strong style="color: #fde68a; font-size: 1rem;">Lote Consumido en Mezcla Posterior (${lc.estado})</strong>
                            </div>
                            <p style="font-size: 0.88rem; line-height: 1.4; margin-bottom: 8px; color: #fef3c7;">
                                El lote <strong>${lc.id}</strong> (${lc.volumenToneladas} TN) es un nodo intermedio histórico. 
                                Físicamente este grano ya fue volcado e integrado a una partida consolidada posterior.
                            </p>
                            <p style="font-size: 0.85rem; background: rgba(0,0,0,0.25); padding: 8px 10px; border-radius: 6px; border-left: 3px solid #f59e0b; margin-bottom: 10px;">
                                <strong>Regla Fitosanitaria:</strong> Para prevenir fraude documental y doble certificación sanitaria, 
                                <em>no admite emisión de Sello BFA ni bloqueo directo</em>. La certificación debe realizarse sobre la partida consolidada activa.
                            </p>
                            <a href="${verifUrl}" target="_blank" style="display: inline-block; background: #d97706; color: white; padding: 6px 12px; border-radius: 4px; text-decoration: none; font-size: 0.85rem; font-weight: bold;">
                                🔍 Ver Árbol de Trazabilidad y Partida Activa en Verificador Público ↗
                            </a>
                        </div>
                    `;
                    formSenasa.style.display = 'none';
                } else {
                    resultDiv.innerHTML = `<p style="color:#ef4444; padding:10px; background:#450a0a; border-radius:6px; margin-top:10px;">No se encontraron lotes activos en estado ACONDICIONADO.</p>`;
                    formSenasa.style.display = 'none';
                }
            } catch (e) {
                console.error(e);
            }
            setLoadingState(btnBuscarSenasa, false);
        });
    }

    // Modal Bloqueo Fitosanitario (SENASA / ARCA)
    window.abrirModalBloqueo = function () {
        const idLote = (document.getElementById('idLoteNotarizar') ? document.getElementById('idLoteNotarizar').value : '').trim();
        if (!idLote) {
            showToast('Por favor seleccione una partida activa para auditar/bloquear.', 'warning');
            window.showCustomAlert({
                title: 'Partida No Seleccionada',
                message: 'Debe seleccionar primero una partida activa del listado oficial para poder aplicar el <strong>bloqueo fitosanitario preventivo</strong>.',
                type: 'warning',
                buttonText: 'Entendido'
            });
            return;
        }

        const modal = document.getElementById('modal-bloqueo');
        const spanLote = document.getElementById('modal-bloqueo-lote-id');
        const txtMotivo = document.getElementById('modal-bloqueo-motivo');

        if (spanLote) spanLote.textContent = idLote;
        if (txtMotivo) txtMotivo.value = '';
        if (modal) {
            modal.style.display = 'flex';
            setTimeout(() => { if (txtMotivo) txtMotivo.focus(); }, 100);
        }
    };

    window.cerrarModalBloqueo = function () {
        const modal = document.getElementById('modal-bloqueo');
        if (modal) modal.style.display = 'none';
        const txtMotivo = document.getElementById('modal-bloqueo-motivo');
        if (txtMotivo) txtMotivo.value = '';
    };

    window.ejecutarBloqueoSanitario = async function () {
        const idLote = (document.getElementById('idLoteNotarizar') ? document.getElementById('idLoteNotarizar').value : '').trim() ||
            (document.getElementById('modal-bloqueo-lote-id') ? document.getElementById('modal-bloqueo-lote-id').textContent : '').trim();
        const txtMotivo = document.getElementById('modal-bloqueo-motivo');
        const motivo = (txtMotivo ? txtMotivo.value : '').trim();

        if (!idLote) {
            window.showCustomAlert({
                title: 'Identificador No Detectado',
                message: 'No se ha detectado el identificador del lote a bloquear. Vuelva a seleccionar la partida desde la lista.',
                type: 'warning'
            });
            return;
        }
        if (!motivo) {
            window.showCustomAlert({
                title: 'Motivo Requerido',
                message: 'Debe ingresar el <strong>motivo oficial</strong> del bloqueo fitosanitario preventivo para que quede asentado en el registro inmutable.',
                type: 'warning',
                buttonText: 'Ingresar Motivo'
            });
            if (txtMotivo) txtMotivo.focus();
            return;
        }

        const btnConfirmar = document.getElementById('btn-confirmar-modal-bloqueo');
        setLoadingState(btnConfirmar, true);

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
            const feedbackContainer = document.getElementById('senasa-feedback-container');
            const formSenasa = document.getElementById('notarizar-form');
            const basePath = window.location.pathname.replace(/\/index\.html$/, '').replace(/\/$/, '');
            const verifUrl = `${window.location.origin}${basePath}/verificador?id=${encodeURIComponent(idLote)}`;

            if (result.success) {
                window.cerrarModalBloqueo();
                agregarLog(`<span class="success-text">🚫 [SENASA] Lote ${idLote} BLOQUEADO preventivamente. Motivo: ${motivo}</span>`);
                showToast(`Lote ${idLote} bloqueado en ledger.`, 'warning');

                if (feedbackContainer) {
                    const fechaStr = result.timestamp ? new Date(result.timestamp).toLocaleString('es-AR') : new Date().toLocaleString('es-AR');
                    feedbackContainer.innerHTML = `
                        <div class="senasa-verification-card block-verified-card">
                            <div class="verification-card-header">
                                <span class="verification-badge-icon">🚫</span>
                                <div>
                                    <h3 class="verification-title">Alerta Fitosanitaria Activada y Bloqueo Efectuado</h3>
                                    <p class="verification-subtitle">El lote ha sido inmovilizado cautelarmente en el ledger permisionado.</p>
                                </div>
                            </div>
                            <div class="verification-details-grid">
                                <div>
                                    <strong>Lote Bloqueado</strong>
                                    <span style="font-weight: 700; color: #ffffff;">${idLote}</span>
                                </div>
                                <div>
                                    <strong>Nuevo Estado Logístico</strong>
                                    <span><span class="badge" style="background:#dc2626; color:white; padding:3px 8px; border-radius:4px; font-weight:700;">BLOQUEADO</span></span>
                                </div>
                                <div style="grid-column: span 2;">
                                    <strong>Motivo Fitosanitario Oficial</strong>
                                    <span style="font-style: italic; color: #fecaca; margin-top: 2px;">"${motivo}"</span>
                                </div>
                                <div>
                                    <strong>Organismo Regulador</strong>
                                    <span>SENASA / ARCA</span>
                                </div>
                                <div>
                                    <strong>Fecha y Hora</strong>
                                    <span>${fechaStr}</span>
                                </div>
                                <div style="grid-column: span 2; font-size: 0.8rem; background: rgba(0,0,0,0.3); padding: 8px 10px; border-radius: 6px; border-left: 3px solid #f87171; margin-top: 4px;">
                                    ⚠️ <strong>Efecto Inmediato:</strong> La máquina de estados del smart contract impide cualquier transporte, mezcla en silos o despacho a exportación para este volumen.
                                </div>
                            </div>
                            <div class="verification-actions">
                                <a href="${verifUrl}" target="_blank" class="btn-verify-external" style="background:#dc2626;">
                                    🔍 Auditar Estado en Verificador Público ↗
                                </a>
                                <button type="button" class="btn-dismiss-verification" onclick="document.getElementById('senasa-feedback-container').style.display='none';">
                                    ✓ Aceptar y Cerrar
                                </button>
                            </div>
                        </div>
                    `;
                    feedbackContainer.style.display = 'block';
                    feedbackContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }

                if (formSenasa) formSenasa.style.display = 'none';
                // Refrescar listado de partidas activas para que desaparezca el lote bloqueado
                window.cargarDatosIniciales('Organismo de Control (SENASA/ARCA)');
            } else {
                agregarLog(`<span class="error-text" style="color:#ef4444;">❌ [ERROR SENASA] ${result.error}</span>`);
                window.showCustomAlert({
                    title: 'Fallo al Inmovilizar Lote',
                    message: `No fue posible registrar el bloqueo en el ledger: <strong>${result.error}</strong>`,
                    type: 'error'
                });
            }
        } catch (e) {
            console.error(e);
            agregarLog(`<span class="error-text" style="color:#ef4444;">❌ [ERROR SENASA] Problema de red al procesar el bloqueo.</span>`);
        }
        setLoadingState(btnConfirmar, false);
    };

    const btnBloquear = document.getElementById('btn-bloquear');
    if (btnBloquear) {
        btnBloquear.addEventListener('click', (e) => {
            e.preventDefault();
            window.abrirModalBloqueo();
        });
    }

    const txtMotivo = document.getElementById('modal-bloqueo-motivo');
    if (txtMotivo) {
        txtMotivo.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && (e.ctrlKey || !e.shiftKey)) {
                e.preventDefault();
                window.ejecutarBloqueoSanitario();
            }
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            window.cerrarModalBloqueo();
        }
    });

    // Interceptar envío de formulario Emisión de CPE de Traslado (Tramo 2 a Puerto)
    const formCpeTraslado = document.getElementById('cpe-traslado-form');
    if (formCpeTraslado) {
        formCpeTraslado.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('btn-emitir-cpe-traslado');
            setLoadingState(btn, true);

            const idLote = (document.getElementById('idLoteTraslado') ? document.getElementById('idLoteTraslado').value : '').trim();
            const destinoPuerto = document.getElementById('destinoPuertoSelect') ? document.getElementById('destinoPuertoSelect').value : 'Puerto de Bahía Blanca';
            const numeroCPE = (document.getElementById('cpeNumeroTraslado') ? document.getElementById('cpeNumeroTraslado').value : '').trim();
            const transportista = (document.getElementById('transportistaTraslado') ? document.getElementById('transportistaTraslado').value : '').trim();
            const patenteCamion = (document.getElementById('patenteTraslado') ? document.getElementById('patenteTraslado').value : '').trim();

            if (!idLote) {
                showToast('Debe seleccionar una partida validada por SENASA.', 'warning');
                setLoadingState(btn, false);
                return;
            }

            try {
                const res = await fetch('http://localhost:3000/api/lotes/emitir-cpe-traslado', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + localStorage.getItem('agtech_token')
                    },
                    body: JSON.stringify({
                        idLote,
                        destinoPuerto,
                        numeroCPE,
                        transportista,
                        patenteCamion
                    })
                });
                const result = await res.json();
                if (result.success) {
                    agregarLog(`<span class="success-text">🚚 [CPE TRASLADO] Nueva CPE emitida para ${idLote}. Destino: ${destinoPuerto}. Estado: EN_TRANSITO_PUERTO.</span>`);
                    showToast(`CPE de Traslado emitida hacia ${destinoPuerto}.`, 'success');
                    formCpeTraslado.reset();
                    window.cargarDatosIniciales('Acopiador / Cooperativa');
                } else {
                    agregarLog(`<span class="error-text" style="color:#ef4444;">❌ [ERROR CPE TRASLADO] Lote ${idLote}: ${result.error}</span>`);
                    showToast(`Error al emitir CPE: ${result.error}`, 'error');
                }
            } catch (error) {
                console.error('Error al emitir CPE traslado:', error);
                agregarLog(`<span class="error-text" style="color:#ef4444;">❌ [ERROR CPE TRASLADO] Problema de red al emitir CPE.</span>`);
            }
            setLoadingState(btn, false);
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

            const chkPlagas = document.getElementById('chk-plagas');
            const senasaCalidad = document.getElementById('senasa-calidad');
            const senasaInspector = document.getElementById('senasa-inspector');

            if (chkPlagas && !chkPlagas.checked) {
                showToast('No se puede emitir el Certificado con presencia de plagas. Proceda al Bloqueo Fitosanitario.', 'error');
                agregarLog(`<span class="error-text" style="color:#ef4444;">❌ [SENASA RECHAZO] El lote ${idLote} no cuenta con verificación de ausencia de plagas. Certificación denegada.</span>`);
                setLoadingState(btn, false);
                return;
            }

            const datosInspeccion = {
                plagasLibre: true,
                plagasCuarentenarias: 'Ausencia certificada de plagas cuarentenarias',
                calidad: senasaCalidad ? senasaCalidad.value.trim() : 'Grado 2 Homogéneo Conforme',
                calidadTipificada: senasaCalidad ? senasaCalidad.value.trim() : 'Grado 2 Homogéneo Conforme',
                inspector: senasaInspector ? senasaInspector.value.trim() : 'Inspector SENASA / ARCA'
            };

            try {
                const res = await fetch('http://localhost:3000/api/lotes/notarizar', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + localStorage.getItem('agtech_token')
                    },
                    body: JSON.stringify({
                        idLote,
                        inspector: datosInspeccion.inspector,
                        calidadTipificada: datosInspeccion.calidadTipificada,
                        plagasCuarentenarias: datosInspeccion.plagasCuarentenarias,
                        datosInspeccion
                    })
                });
                const result = await res.json();
                const feedbackContainer = document.getElementById('senasa-feedback-container');
                const formSenasa = document.getElementById('notarizar-form');
                const basePath = window.location.pathname.replace(/\/index\.html$/, '').replace(/\/$/, '');
                const verifUrl = `${window.location.origin}${basePath}/verificador?id=${encodeURIComponent(idLote)}`;

                if (result.success) {
                    const bfaHash = result.bfaHash || 'N/A';
                    const fechaStr = result.timestamp ? new Date(result.timestamp).toLocaleString('es-AR') : new Date().toLocaleString('es-AR');

                    agregarLog(`<span class="success-text">✅ [BFA] Certificado SENASA emitido para ${idLote}. Hash: ${bfaHash.substring(0, 20)}...</span>`);

                    if (feedbackContainer) {
                        feedbackContainer.innerHTML = `
                            <div class="senasa-verification-card bfa-verified-card">
                                <div class="verification-card-header">
                                    <span class="verification-badge-icon">🛡️</span>
                                    <div>
                                        <h3 class="verification-title">Certificado Fitosanitario Oficial y Sello BFA Emitidos</h3>
                                        <p class="verification-subtitle">Lote físico acondicionado validado y registrado en la Blockchain Federal Argentina.</p>
                                    </div>
                                </div>
                                <div class="verification-details-grid">
                                    <div>
                                        <strong>Lote Notarizado</strong>
                                        <span style="font-weight: 700; color: #ffffff;">${idLote}</span>
                                    </div>
                                    <div>
                                        <strong>Nuevo Estado</strong>
                                        <span><span class="badge" style="background:#0284c7; color:white; padding:3px 8px; border-radius:4px; font-weight:700;">VALIDADO_SENASA</span></span>
                                    </div>
                                    <div>
                                        <strong>Organismo Notarial</strong>
                                        <span>${result.entidad || 'SENASA / ARCA'}</span>
                                    </div>
                                    <div>
                                        <strong>Fecha y Hora</strong>
                                        <span>${fechaStr}</span>
                                    </div>
                                    <div style="grid-column: span 2; font-size: 0.85rem; background: rgba(0,0,0,0.25); padding: 8px 10px; border-radius: 6px; border-left: 3px solid #38bdf8;">
                                        🌾 <strong>Dictamen Fitosanitario:</strong> Grano acondicionado libre de plagas cuarentenarias. Calidad tipificada: <em>${datosInspeccion.calidad}</em>. Habilitado para emisión de CPE de traslado portuario.
                                    </div>
                                </div>
                                <div class="verification-hash-box">
                                    <span class="hash-label">BFA RECEIPT HASH SHA-256 (EVIDENCIA INMUTABLE):</span>
                                    <span class="hash-code">${bfaHash}</span>
                                </div>
                                <div class="verification-actions">
                                    <a href="${verifUrl}" target="_blank" class="btn-verify-external">
                                        🔍 Auditar en Verificador Público QR ↗
                                    </a>
                                    <button type="button" class="btn-dismiss-verification" onclick="document.getElementById('senasa-feedback-container').style.display='none';">
                                        ✓ Aceptar y Cerrar
                                    </button>
                                </div>
                            </div>
                        `;
                        feedbackContainer.style.display = 'block';
                    }

                    if (formSenasa) formSenasa.style.display = 'none';
                    // Refrescar listado activo para que muestre el badge de sellado BFA
                    window.cargarDatosIniciales('Organismo de Control (SENASA/ARCA)');
                } else {
                    agregarLog(`<span class="error-text" style="color:#ef4444;">❌ [ERROR BFA] Lote ${idLote}: ${result.error}</span>`);
                    window.showCustomAlert({
                        title: 'Error de Notarización BFA',
                        message: `No se pudo emitir el sello criptográfico BFA: <strong>${result.error}</strong>`,
                        type: 'error'
                    });
                }
            } catch (error) {
                console.error('Error al notarizar:', error);
                agregarLog(`<span class="error-text" style="color:#ef4444;">❌ [ERROR BFA] Problema de red al notarizar.</span>`);
            }
            setLoadingState(btn, false);
        });
    }

    // Handlers globales para Terminal Portuaria y Despacho de Exportación
    window.confirmarArriboConvoy = async function (idLote) {
        const confirmado = await window.showCustomConfirm({
            title: 'Confirmar Arribo Portuario',
            message: `¿Desea confirmar el arribo físico del convoy <strong>${idLote}</strong> a la terminal portuaria y validar definitivamente la CPE de descarga?`,
            type: 'info',
            confirmText: 'Confirmar Arribo y CPE',
            cancelText: 'Cancelar'
        });
        if (!confirmado) return;
        try {
            const res = await fetch('http://localhost:3000/api/lotes/arribo-puerto', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + localStorage.getItem('agtech_token')
                },
                body: JSON.stringify({ idLote })
            });
            const result = await res.json();
            if (result.success) {
                agregarLog(`<span class="success-text">⚓ [PUERTO] Convoy ${idLote} arribado. CPE de descarga confirmada. Estado: ARRIBADO_PUERTO.</span>`);
                showToast(`Arribo de lote ${idLote} confirmado en terminal portuaria.`, 'success');
                window.cargarDatosIniciales('Exportador (Puertos)');
            } else {
                agregarLog(`<span class="error-text" style="color:#ef4444;">❌ [ERROR ARRIBO] ${result.error}</span>`);
                showToast(`Error al confirmar arribo: ${result.error}`, 'error');
            }
        } catch (err) {
            console.error('Error al confirmar arribo:', err);
            agregarLog(`<span class="error-text" style="color:#ef4444;">❌ [ERROR ARRIBO] Problema de red.</span>`);
        }
    };

    window.seleccionarParaEmbarque = function (idLote) {
        const inp = document.getElementById('idLoteExportar');
        if (inp) {
            inp.value = idLote;
            inp.focus();
        }
        const formExp = document.getElementById('exportar-form');
        if (formExp) {
            formExp.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        showToast(`Lote ${idLote} seleccionado para cierre logístico de exportación.`, 'info');
    };

    // Interceptar envío de formulario Exportar
    const formExportar = document.getElementById('exportar-form');
    if (formExportar) {
        formExportar.addEventListener('submit', async (e) => {
            e.preventDefault();
            const idLote = (document.getElementById('idLoteExportar').value || '').trim();
            const exportadorAddress = (document.getElementById('walletExportador').value || '').trim() || '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
            const btn = document.getElementById('btn-ejecutar-exportacion') || document.getElementById('btn-exportar');
            setLoadingState(btn, true);

            agregarLog(`⏳ [NFT] Acuñando token en Polygon / Hardhat para lote ${idLote}...`);
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
                    agregarLog(`<span class="success-text">✅ [NFT] Token Acuñado Exitosamente. TX: ${result.txHash}</span>`);
                    showToast(`Cierre logístico finalizado. Token acuñado para ${idLote}`, 'success');

                    // Mostrar QR link
                    const qrPanel = document.getElementById('qr-result-panel');
                    const qrLink = document.getElementById('qr-link');
                    const qrImage = document.getElementById('qr-image');
                    if (qrPanel) qrPanel.style.display = 'block';

                    const basePath = window.location.pathname.replace(/\/index\.html$/, '').replace(/\/$/, '');
                    const localVerifyUrl = `${window.location.origin}${basePath}/verificador?id=${idLote}&tx=${result.txHash}`;

                    if (qrLink) {
                        qrLink.href = localVerifyUrl;
                        qrLink.textContent = `Abrir Trazabilidad de ${idLote}`;
                    }

                    if (qrImage) {
                        const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(localVerifyUrl)}`;
                        qrImage.src = qrApiUrl;
                        qrImage.style.display = 'block';
                    }

                    window.cargarDatosIniciales('Exportador (Puertos)');
                } else {
                    agregarLog(`<span class="error-text" style="color:#ef4444;">❌ [ERROR NFT] Lote ${idLote}: ${result.error}</span>`);
                    showToast(`Error al exportar: ${result.error}`, 'error');
                }
            } catch (error) {
                console.error('Error al exportar:', error);
                agregarLog(`<span class="error-text" style="color:#ef4444;">❌ [ERROR NFT] Problema al conectar con la red local (Hardhat).</span>`);
            }
            setLoadingState(btn, false);
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
