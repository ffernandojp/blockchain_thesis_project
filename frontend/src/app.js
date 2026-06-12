// app.js - Lógica Frontend Offline-First

document.addEventListener('DOMContentLoaded', () => {
    const statusDiv = document.getElementById('connection-status');
    const form = document.getElementById('registro-form');
    const syncList = document.getElementById('sync-list');

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
    updateOnlineStatus(); // Validar al cargar

    // Interceptar envío de formulario
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const renspa = document.getElementById('renspa').value;
        const geolocalizacion = "Lat: -34.6037, Lon: -58.3816"; // Hardcodeado para simulación
        const timestamp = new Date().toISOString();
        const volumenToneladas = document.getElementById('volumen').value;
        const fileName = "offline_document.pdf"; // Fallback para el ID si no hay archivo

        // Enfoque Criptográfico: Determinista por Hash (SHA-256)
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

    // IndexedDB / LocalStorage Fallback
    function guardarOffline(data) {
        let pendientes = JSON.parse(localStorage.getItem('lotes_pendientes') || '[]');
        pendientes.push(data);
        localStorage.setItem('lotes_pendientes', JSON.stringify(pendientes));
        
        agregarLog(`📦 [OFFLINE] Lote ${data.idLote} guardado en cache local. Esperando red...`);
    }

    // Sincronización en segundo plano al recuperar conexión
    async function sincronizarDatosOffline() {
        let pendientes = JSON.parse(localStorage.getItem('lotes_pendientes') || '[]');
        if (pendientes.length === 0) return;

        agregarLog(`🔄 Sincronizando ${pendientes.length} registros offline...`);
        
        for (let i = 0; i < pendientes.length; i++) {
            await enviarAlBackend(pendientes[i], true);
        }
        
        localStorage.removeItem('lotes_pendientes');
    }

    // Petición al API Rest
    async function enviarAlBackend(data, isSync = false) {
        try {
            const res = await fetch('http://localhost:3000/api/lotes/registrar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await res.json();
            
            if (result.success) {
                agregarLog(`<span class="success-text">✅ [ONLINE] Lote ${data.idLote} registrado en Blockchain Privada.</span>`);
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
