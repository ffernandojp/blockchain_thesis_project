document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const idLote = urlParams.get('id');
    const txHashQuery = urlParams.get('tx'); // Opcional, puede venir del QR

    const loader = document.getElementById('loader');
    const content = document.getElementById('content');
    const timeline = document.getElementById('timeline');
    const loteTitle = document.getElementById('lote-title');
    const mainContainer = document.getElementById('main-container');

    if (!idLote) {
        mostrarError("Parámetro 'id' requerido. Escanee el código QR correctamente.");
        return;
    }

    try {
        const response = await fetch(`http://localhost:3000/api/lotes/${idLote}`);
        const result = await response.json();

        if (result.success) {
            renderTimeline(result.data, txHashQuery);
        } else {
            mostrarError(result.error || "Lote no encontrado en el Ledger.");
        }
    } catch (error) {
        console.error("Error consultando API:", error);
        mostrarError("Error de conexión con la red blockchain.");
    }

    function mostrarError(msg) {
        loader.style.display = 'none';
        mainContainer.innerHTML += `<div class="error"><h3>⚠️ Error</h3><p>${msg}</p></div>`;
    }

    function renderTimeline(lote, txHashQuery) {
        loader.style.display = 'none';
        content.style.display = 'block';
        loteTitle.textContent = `Lote Verificado: ${lote.id}`;

        let html = '';

        // Paso 1: Origen y Cosecha (Productor)
        html += `
            <div class="timeline-item">
                <div class="content">
                    <span class="badge ipfs">1. Registro de Cosecha Primaria</span>
                    <h3>Productor Origen</h3>
                    <p><strong>RENSPA:</strong> ${lote.renspa}</p>
                    <p><strong>Volumen Declarado:</strong> ${lote.volumenToneladas} TN</p>
                    <p><strong>Geolocalización:</strong> ${lote.geolocalizacion}</p>
                    ${lote.ipfsCID ? `<p><strong>Carta de Porte (IPFS):</strong> <a href="http://127.0.0.1:8080/ipfs/${lote.ipfsCID}" target="_blank" class="hash">${lote.ipfsCID}</a></p>` : ''}
                    <p><small>Estado: COSECHADO</small></p>
                </div>
            </div>
        `;

        // Paso 2: Notarización BFA (Estado/AFIP/SENASA)
        if (lote.bfaHash) {
            html += `
                <div class="timeline-item">
                    <div class="content">
                        <span class="badge bfa">2. Notarización Estatal (BFA)</span>
                        <h3>SENASA / AFIP</h3>
                        <p>Los datos han sido sellados en la Blockchain Federal Argentina.</p>
                        <p><strong>BFA Hash (SHA-256):</strong></p>
                        <p class="hash">${lote.bfaHash}</p>
                        <p><small>Estado: VERIFICADO_BFA</small></p>
                    </div>
                </div>
            `;
        }

        // Paso 3: Exportación (NFT Hardhat/Polygon)
        const exportTx = lote.historialTransacciones.find(t => t.accion === 'CAMBIO_ESTADO: EXPORTADO');
        if (exportTx || txHashQuery) {
            // Extraer TX hash del detalle si existe
            let txHash = txHashQuery || (exportTx && exportTx.detalles.match(/TX:\s*(0x[a-fA-F0-9]+)/) ? exportTx.detalles.match(/TX:\s*(0x[a-fA-F0-9]+)/)[1] : 'Pendiente');
            
            html += `
                <div class="timeline-item">
                    <div class="content">
                        <span class="badge polygon">3. Certificado de Exportación NFT</span>
                        <h3>Exportador en Puerto</h3>
                        <p>El cierre logístico ha sido minteado como un NFT inmutable.</p>
                        <p><strong>Transaction Hash:</strong></p>
                        <p class="hash">${txHash}</p>
                        <p><small>Red: Hardhat / Polygon Local</small></p>
                    </div>
                </div>
            `;
        }

        timeline.innerHTML = html;
    }
});
