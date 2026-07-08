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
        mainContainer.innerHTML += `
            <div class="card error-card">
                <div class="error-icon">⚠️</div>
                <div class="error-text">${msg}</div>
            </div>`;
    }

    function renderTimeline(lote, txHashQuery) {
        loader.style.display = 'none';
        content.style.display = 'block';
        loteTitle.textContent = `${lote.id}`;

        const qrImage = document.getElementById('qr-image');
        if (qrImage) {
            const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(window.location.href)}`;
            qrImage.src = qrApiUrl;
        }

        let html = '';

        // Paso 1: Origen y Cosecha (Productor)
        html += `
            <div class="timeline-item">
                <div class="content">
                    <div class="badges-container">
                        <span class="badge ipfs">1. Registro Primario</span>
                    </div>
                    <h3>Productor Origen</h3>
                    <div class="data-grid">
                        <div class="data-row">
                            <span class="data-label">RENSPA</span>
                            <span class="data-value">${lote.renspa}</span>
                        </div>
                        <div class="data-row">
                            <span class="data-label">Volumen Declarado</span>
                            <span class="data-value">${lote.volumenToneladas} TN</span>
                        </div>
                        <div class="data-row">
                            <span class="data-label">Geolocalización</span>
                            <span class="data-value">${lote.geolocalizacion}</span>
                        </div>
                    </div>
                    ${lote.ipfsCID ? `
                    <div class="hash-container">
                        <span class="hash-label">Carta de Porte (IPFS)</span>
                        <a href="http://127.0.0.1:8080/ipfs/${lote.ipfsCID}" target="_blank" class="hash">${lote.ipfsCID}</a>
                    </div>` : ''}
                </div>
            </div>
        `;

        // Paso Transporte
        const transTx = lote.historialTransacciones.find(t => t.accion === 'CAMBIO_ESTADO: EN_TRANSITO');
        if (transTx) {
            html += `
                <div class="timeline-item">
                    <div class="content">
                        <div class="badges-container">
                            <span class="badge" style="background: #fef08a; color: #854d0e;">Transporte Seguro</span>
                        </div>
                        <h3>Logística y Transporte</h3>
                        <p style="font-size: 0.9rem; margin-bottom: 12px;">Carga movilizada con Carta de Porte Electrónica (CPE).</p>
                        <div class="data-grid">
                            <div class="data-row">
                                <span class="data-label">Estado</span>
                                <span class="data-value">En Tránsito</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        // Paso Acopio
        const acopioTx = lote.historialTransacciones.find(t => t.accion === 'CAMBIO_ESTADO: ACONDICIONADO');
        if (acopioTx) {
            // Extraer pesaje y calidad de los detalles
            let detallesText = acopioTx.detalles || 'Acondicionamiento completado.';
            html += `
                <div class="timeline-item">
                    <div class="content">
                        <div class="badges-container">
                            <span class="badge" style="background: #d9f99d; color: #3f6212;">Acopio y Acondicionamiento</span>
                        </div>
                        <h3>Planta Receptora</h3>
                        <p style="font-size: 0.9rem; margin-bottom: 12px;">El lote ha sido pesado, secado y acondicionado.</p>
                        <div class="data-grid">
                            <div class="data-row">
                                <span class="data-label">Parámetros Registrados</span>
                                <span class="data-value">${detallesText}</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        // Paso Notarización BFA (Estado/ARCA/SENASA)
        if (lote.bfaHash) {
            html += `
                <div class="timeline-item">
                    <div class="content">
                        <div class="badges-container">
                            <span class="badge bfa">2. Notarización Estatal</span>
                        </div>
                        <h3>SENASA / ARCA</h3>
                        <p style="font-size: 0.9rem; margin-bottom: 12px;">Los datos han sido sellados en la Blockchain Federal Argentina.</p>
                        <div class="hash-container">
                            <span class="hash-label">BFA Hash (SHA-256)</span>
                            <span class="hash">${lote.bfaHash}</span>
                        </div>
                    </div>
                </div>
            `;
        }

        // Paso 3: Exportación (NFT Hardhat/Polygon)
        const exportTx = lote.historialTransacciones.find(t => t.accion === 'CAMBIO_ESTADO: EXPORTADO');
        if (exportTx || txHashQuery) {
            let txHash = txHashQuery || (exportTx && exportTx.detalles.match(/TX:\\s*(0x[a-fA-F0-9]+)/) ? exportTx.detalles.match(/TX:\\s*(0x[a-fA-F0-9]+)/)[1] : 'Pendiente');

            html += `
                <div class="timeline-item">
                    <div class="content">
                        <div class="badges-container">
                            <span class="badge polygon">3. Certificado NFT</span>
                        </div>
                        <h3>Exportador en Puerto</h3>
                        <p style="font-size: 0.9rem; margin-bottom: 12px;">El cierre logístico ha sido minteado como un NFT inmutable.</p>
                        <div class="hash-container">
                            <span class="hash-label">Transaction Hash</span>
                            <span class="hash">${txHash}</span>
                        </div>
                    </div>
                </div>
            `;
        }

        timeline.innerHTML = html;
    }
});
