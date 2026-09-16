document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const idLote = urlParams.get('id');
    const txHashQuery = urlParams.get('tx'); // Opcional, puede provenir del código QR

    const loader = document.getElementById('loader');
    const content = document.getElementById('content');
    const timeline = document.getElementById('timeline');
    const loteTitle = document.getElementById('lote-title');
    const loteStatusBadge = document.getElementById('lote-status-badge');
    const headerVolumen = document.getElementById('header-volumen');
    const headerBfaTime = document.getElementById('header-bfa-time');
    const headerContractLink = document.getElementById('header-contract-link');
    const mainContainer = document.getElementById('main-container');

    if (!idLote) {
        mostrarError("Parámetro 'id' de lote requerido. Escanee un código QR válido o especifique ?id=...");
        return;
    }

    try {
        const response = await fetch(`http://localhost:3000/api/lotes/${encodeURIComponent(idLote)}`);
        const result = await response.json();

        if (result.success && result.data) {
            renderLoteData(result.data, txHashQuery);
        } else {
            mostrarError(result.error || `Lote '${idLote}' no encontrado en el World State de la red permisionada.`);
        }
    } catch (error) {
        console.error("Error consultando API de trazabilidad:", error);
        mostrarError("Error de conexión con el nodo de la red blockchain (http://localhost:3000). Verifique que el servicio backend esté en ejecución.");
    }

    function mostrarError(msg) {
        if (loader) loader.style.display = 'none';
        if (content) content.style.display = 'none';
        mainContainer.innerHTML += `
            <div class="card error-card">
                <div class="error-icon">⚠️</div>
                <div class="error-text">${msg}</div>
            </div>`;
    }

    function renderLoteData(lote, txHashQuery) {
        if (loader) loader.style.display = 'none';
        if (content) content.style.display = 'block';

        // 1. Cabecera del Contenedor / Lote
        loteTitle.textContent = `${lote.id}`;

        // Badge de Estado con código de color dinámico
        const estado = (lote.estado || 'DESCONOCIDO').toUpperCase();
        let statusClass = 'status-cosechado';
        let statusIcon = '🌱';
        let statusLabel = estado;

        if (estado === 'EXPORTADO') {
            statusClass = 'status-exportado';
            statusIcon = '🚢';
            statusLabel = 'Lote Exportado (Cierre Logístico NFT)';
        } else if (estado === 'ARRIBADO_PUERTO') {
            statusClass = 'status-arribado-puerto';
            statusIcon = '⚓';
            statusLabel = 'Arribado a Puerto (CPE Descarga Confirmada)';
        } else if (estado === 'EN_TRANSITO_PUERTO') {
            statusClass = 'status-transito-puerto';
            statusIcon = '🚛';
            statusLabel = 'En Tránsito hacia Puerto (Flete Largo CPE)';
        } else if (estado === 'VALIDADO_SENASA') {
            statusClass = 'status-validado-senasa';
            statusIcon = '🛡️';
            statusLabel = 'Validado por SENASA (Conforme BFA)';
        } else if (estado === 'ACOPIADO_ACONDICIONADO' || estado === 'ACONDICIONADO') {
            statusClass = 'status-acondicionado';
            statusIcon = '🏭';
            statusLabel = 'Acondicionado en Silo / Planta';
        } else if (estado === 'RECEPCIONADO_ACOPIO') {
            statusClass = 'status-recepcionado';
            statusIcon = '⚖️';
            statusLabel = 'Recepcionado en Balanza de Acopio';
        } else if (estado === 'MEZCLADO_ACONDICIONADO') {
            statusClass = 'status-mezclado';
            statusIcon = '🔄';
            statusLabel = 'Consolidado en Silo (Masa Homogeneizada)';
        } else if (estado === 'EN_TRANSITO_ACOPIO' || estado === 'EN_TRANSITO') {
            statusClass = 'status-en-transito';
            statusIcon = '🚚';
            statusLabel = 'En Tránsito hacia Acopio (Flete Corto CPE)';
        } else if (estado === 'COSECHADO') {
            statusClass = 'status-cosechado';
            statusIcon = '🌱';
            statusLabel = 'Cosechado en Campo (CPE Primaria)';
        } else if (estado === 'BLOQUEADO') {
            statusClass = 'status-bloqueado';
            statusIcon = '⛔';
            statusLabel = 'Bloqueado por SENASA / ARCA';
        }

        if (loteStatusBadge) {
            loteStatusBadge.className = `lote-status-badge ${statusClass}`;
            loteStatusBadge.innerHTML = `<span>${statusIcon}</span> <span>${statusLabel}</span>`;
        }

        // Volumen Consolidado Total
        const volTotal = typeof lote.volumenToneladas === 'number' ? lote.volumenToneladas.toFixed(2) : lote.volumenToneladas;
        if (headerVolumen) {
            headerVolumen.textContent = `${volTotal} TN`;
        }

        // Sello de Tiempo BFA
        let bfaTimeText = 'No Notarizado';
        if (lote.bfaHash) {
            const bfaTx = lote.historialTransacciones && lote.historialTransacciones.find(t => 
                (t.detalles && t.detalles.includes('BFA')) || (t.actor && t.actor.includes('SENASA'))
            );
            if (bfaTx && bfaTx.fecha) {
                const f = new Date(bfaTx.fecha);
                bfaTimeText = `Sellado: ${f.toLocaleDateString()} ${f.toLocaleTimeString()}`;
            } else {
                bfaTimeText = 'Sellado Criptográfico Activo en BFA';
            }
        }
        if (headerBfaTime) {
            headerBfaTime.textContent = bfaTimeText;
        }

        // Contrato Inteligente Hardhat / Polygon
        const contractAddress = lote.contractAddress || "0x5FbDB2315678afecb367f032d93F642f64180aa3";
        const effectiveTxHash = txHashQuery || lote.txHash || null;
        const tokenId = lote.tokenId !== undefined && lote.tokenId !== null ? lote.tokenId : null;

        if (headerContractLink) {
            if (estado === 'EXPORTADO') {
                headerContractLink.innerHTML = `
                    <div style="font-size: 0.85rem; display: flex; flex-direction: column; gap: 4px;">
                        <div><strong>Contrato:</strong> <span class="hash" style="font-size: 0.8rem;">${contractAddress}</span></div>
                        <div><strong>Token ID:</strong> <span class="badge polygon" style="padding: 2px 6px;">#${tokenId !== null ? tokenId : '0'}</span></div>
                        ${effectiveTxHash ? `<div><strong>TX:</strong> <a href="#" onclick="window.mostrarModalTransaccion('${effectiveTxHash}', '${contractAddress}', '${tokenId !== null ? tokenId : 0}'); return false;" class="hash" style="color: var(--bfa-secondary); text-decoration: underline; cursor: pointer;">${effectiveTxHash.substring(0, 22)}...</a></div>` : ''}
                    </div>
                `;
            } else {
                headerContractLink.innerHTML = `<span style="color: var(--text-secondary); font-size: 0.85rem;">Pendiente (Se acuña al alcanzar el estado EXPORTADO en puerto)</span>`;
            }
        }

        // QR Dinámico de Verificación
        const qrImage = document.getElementById('qr-image');
        if (qrImage) {
            const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(window.location.href)}`;
            qrImage.src = qrApiUrl;
        }

        // 2. Renderizado del Árbol Genealógico Interactivo de 3 Niveles (DAG)
        renderGenealogyTree(lote);

        // 3. Renderizado de la Línea de Tiempo Cronológica en 6 Hitos Operativos
        let html = '';

        const origenes = Array.isArray(lote.desgloseOrigenes) && lote.desgloseOrigenes.length > 0
            ? lote.desgloseOrigenes
            : [{
                id: lote.id,
                renspa: lote.renspa || 'No especificado',
                volumenAportadoTN: parseFloat(volTotal),
                porcentajeAporte: 100.0,
                geolocalizacion: lote.geolocalizacion || 'Lat: -34.6037, Lon: -58.3816',
                ipfsCID: lote.ipfsCID,
                fechaCosecha: lote.fechaCosecha || (lote.historialTransacciones && lote.historialTransacciones[0] ? lote.historialTransacciones[0].fecha : new Date().toISOString())
            }];

        const esMezcla = origenes.length > 1;

        // --- HITO 1: COSECHA PRIMARIA Y TRAZABILIDAD DE MASA (TRAMO 1) ---
        html += `
            <div class="timeline-item">
                <div class="content">
                    <div class="badges-container">
                        <span class="badge ipfs">1. Cosecha y Origen Primario</span>
                        ${esMezcla ? '<span class="badge" style="background:#fef08a;color:#713f12;font-weight:700;">Balance de Masa (Silos)</span>' : '<span class="badge" style="background:#dcfce7;color:#166534;">Monovarietal Directo</span>'}
                    </div>
                    <h3>Cosecha Primaria con CPE de Campo (Flete Corto)</h3>
                    <p style="font-size: 0.88rem; color: var(--text-secondary); margin-bottom: 14px;">
                        Resolución algorítmica recursiva hacia atrás (Backtracking inverso). Desglose exacto de aportes primarios:
                    </p>

                    ${esMezcla ? `
                        <div class="commingling-alert-card">
                            <div class="commingling-alert-header">
                                <span class="commingling-icon">🌾</span>
                                <div>
                                    <div class="commingling-title">Lote Consolidado por Fusión en Silos (Trazabilidad de Masa)</div>
                                    <div class="commingling-subtitle">Este lote proviene de la homogeneización reglamentaria de ${origenes.length} cosechas agrícolas independientes en planta de acopio.</div>
                                </div>
                            </div>
                        </div>
                    ` : ''}

                    <div class="origins-list">
        `;

        origenes.forEach((orig) => {
            const porcentaje = typeof orig.porcentajeAporte === 'number' ? orig.porcentajeAporte.toFixed(1) : orig.porcentajeAporte;
            const volAportado = typeof orig.volumenAportadoTN === 'number' ? orig.volumenAportadoTN.toFixed(2) : orig.volumenAportadoTN;
            
            // Procesamiento de Geolocalización
            let lat = -34.6037;
            let lng = -58.3816;
            let geoFormatted = "Lat: -34.6037, Lon: -58.3816";

            if (orig.geolocalizacion) {
                if (typeof orig.geolocalizacion === 'object') {
                    lat = orig.geolocalizacion.lat !== undefined ? orig.geolocalizacion.lat : lat;
                    lng = orig.geolocalizacion.lng !== undefined ? orig.geolocalizacion.lng : (orig.geolocalizacion.lon !== undefined ? orig.geolocalizacion.lon : lng);
                    geoFormatted = orig.geolocalizacion.formatted || `Lat: ${lat}, Lon: ${lng}`;
                } else if (typeof orig.geolocalizacion === 'string') {
                    geoFormatted = orig.geolocalizacion;
                    const match = orig.geolocalizacion.match(/Lat:\s*([-\d.]+),\s*Lo[ng]+:\s*([-\d.]+)/i);
                    if (match) {
                        lat = parseFloat(match[1]);
                        lng = parseFloat(match[2]);
                    }
                }
            }

            const mapUrl = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=13/${lat}/${lng}`;
            const fechaStr = orig.fechaCosecha ? new Date(orig.fechaCosecha).toLocaleString('es-AR') : 'Registrado';

            html += `
                <div class="origin-card ${!esMezcla ? 'monovarietal-card' : ''}">
                    <div class="origin-card-top">
                        <div class="origin-id-renspa">
                            <span class="origin-lot-id">Lote Precursor: ${orig.id}</span>
                            <span class="origin-renspa">Establecimiento RENSPA: <strong>${orig.renspa}</strong></span>
                        </div>
                        <div class="origin-percentage-text">
                            <strong>${porcentaje}% de la carga (${volAportado} TN)</strong>
                        </div>
                    </div>
                    
                    <!-- Barra de Progreso / Porcentaje Visual -->
                    <div class="progress-bar-container">
                        <div class="progress-bar-fill ${!esMezcla ? 'monovarietal' : ''}" style="width: ${porcentaje}%;"></div>
                    </div>
                    
                    <div class="origin-details-grid">
                        <div class="origin-detail-item">
                            <span class="detail-label">📍 Ubicación de Origen</span>
                            <span class="detail-value">
                                <span>${geoFormatted}</span>
                                <a href="${mapUrl}" target="_blank" rel="noopener noreferrer" class="map-link">Ver en Mapa ↗</a>
                            </span>
                        </div>
                        <div class="origin-detail-item">
                            <span class="detail-label">📅 Fecha de Cosecha</span>
                            <span class="detail-value">${fechaStr}</span>
                        </div>
                    </div>

                    ${orig.ipfsCID ? `
                    <div class="ipfs-action-box">
                        <div class="ipfs-cid-text">
                            <span class="ipfs-cid-label">Carta de Porte Electrónica Primaria (CID IPFS):</span>
                            <span class="ipfs-cid-code" title="${orig.ipfsCID}">${orig.ipfsCID}</span>
                        </div>
                        <a href="http://localhost:8080/ipfs/${orig.ipfsCID}" target="_blank" rel="noopener noreferrer" class="btn-ipfs">
                            📄 Ver Carta de Porte Original (IPFS)
                        </a>
                    </div>` : `
                    <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 4px;">
                        Documento regulatorio registrado directamente en World State.
                    </div>`}
                </div>
            `;
        });

        html += `
                    </div>
                </div>
            </div>
        `;

        // --- HITO 2: ACONDICIONAMIENTO Y SILOS EN PLANTA DE ACOPIO ---
        const acopioTx = lote.historialTransacciones && lote.historialTransacciones.find(t => 
            t.accion === 'CAMBIO_ESTADO: ACONDICIONADO' || t.accion === 'ACOPIO_Y_MEZCLA' || t.accion === 'ACONDICIONAMIENTO_GRANO' || t.accion === 'RECEPCION_BALANZA' || (t.accion && (t.accion.includes('RECEPCION') || t.accion.includes('ACOPIO') || t.accion.includes('ACONDICIONAMIENTO')))
        );
        const fasesAcopio = ['RECEPCIONADO_ACOPIO', 'ACOPIADO_ACONDICIONADO', 'ACONDICIONADO', 'VALIDADO_SENASA', 'EN_TRANSITO_PUERTO', 'ARRIBADO_PUERTO', 'EXPORTADO', 'MEZCLADO_ACONDICIONADO'];

        if (acopioTx || fasesAcopio.includes(estado) || esMezcla || lote.acondicionamiento || lote.pesajeBalanza || lote.calidad || lote.calidadParams) {
            const pesajeNeto = lote.pesajeBalanza || volTotal;
            const calidadComercial = lote.calidad || (lote.calidadParams && lote.calidadParams.calidadComercial) || (lote.acondicionamiento && lote.acondicionamiento.tipificacion) || 'Calidad Conforme';
            html += `
                <div class="timeline-item">
                    <div class="content">
                        <div class="badges-container">
                            <span class="badge" style="background: #d9f99d; color: #3f6212;">2. Planta de Acopio y Silos</span>
                            <span class="badge" style="background: #e0f2fe; color: #0369a1;">Balanza Oficial</span>
                        </div>
                        <h3>Recepción en Balanza y Acondicionamiento Fitosanitario</h3>
                        <p style="font-size: 0.9rem; margin-bottom: 12px;">Descarga física, tipificación comercial y tareas obligatorias de acondicionamiento de grano en silo.</p>
                        <div class="data-grid">
                            <div class="data-row">
                                <span class="data-label">Pesaje Balanza Oficial</span>
                                <span class="data-value">${pesajeNeto} TN (Pesaje Neto Verificado)</span>
                            </div>
                            <div class="data-row">
                                <span class="data-label">Calidad Comercial</span>
                                <span class="data-value">${calidadComercial}</span>
                            </div>
                            <div class="data-row" style="grid-column: span 2;">
                                <span class="data-label">Tareas de Acondicionamiento</span>
                                <span class="data-value" style="color: #166534; font-weight: 600;">✓ Secado térmico &bull; ✓ Zarandeo / Limpieza &bull; ✓ Fumigación reglamentaria</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        // --- HITO 3: FISCALIZACIÓN OFICIAL SENASA Y NOTARIZACIÓN BFA ---
        const senasaCert = lote.certificacionSenasa || lote.inspeccionSenasa || {};
        if (lote.bfaHash || lote.inspeccionSenasa || lote.certificacionSenasa || ['VALIDADO_SENASA', 'EN_TRANSITO_PUERTO', 'ARRIBADO_PUERTO', 'EXPORTADO'].includes(estado)) {
            const insp = senasaCert;
            const inspectorNombre = insp.inspector || (lote.historialTransacciones && lote.historialTransacciones.find(t => t.actor && t.actor.includes('SENASA')) ? 'Inspector SENASA / ARCA' : 'Fiscalización SENASA');
            const plagasTexto = insp.plagasCuarentenarias || 'Libre de plagas cuarentenarias / gorgojo vivo';
            html += `
                <div class="timeline-item">
                    <div class="content">
                        <div class="badges-container">
                            <span class="badge bfa">3. Fiscalización SENASA</span>
                            <span class="badge" style="background: #ecfdf5; color: #065f46;">🛡️ Certificado Oficial</span>
                        </div>
                        <h3>Momento de Emisión del Certificado de SENASA (Notarización BFA)</h3>
                        <p style="font-size: 0.9rem; margin-bottom: 12px;">
                            Con el grano ingresado a la planta y sometido a acondicionamiento, el inspector de SENASA valida el lote físico y estampa la conformidad fitosanitaria oficial en la Blockchain Federal Argentina.
                        </p>
                        <div class="data-grid" style="margin-bottom: 10px;">
                            <div class="data-row">
                                <span class="data-label">Condición Cuarentenaria</span>
                                <span class="data-value" style="color: #166534; font-weight: 700;">✓ ${plagasTexto}</span>
                            </div>
                            <div class="data-row">
                                <span class="data-label">Inspector Actuante</span>
                                <span class="data-value">${inspectorNombre}</span>
                            </div>
                        </div>
                        ${lote.bfaHash ? `
                            <div class="hash-container">
                                <span class="hash-label">Sello Notarial BFA SHA-256 (Evidencia Inmutable):</span>
                                <span class="hash">${lote.bfaHash}</span>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        }

        // --- HITO 4: CPE DE TRASLADO Y FLETE LARGO A PUERTO (TRAMO 2) ---
        const cpe = lote.cpeTraslado;
        if (cpe || ['EN_TRANSITO_PUERTO', 'ARRIBADO_PUERTO', 'EXPORTADO'].includes(estado)) {
            const puertoDestino = (cpe && cpe.destinoPuerto) || (lote.arriboPuerto && lote.arriboPuerto.terminal) || 'Puerto de Bahía Blanca';
            const numCpe = (cpe && cpe.numeroCPE) ? cpe.numeroCPE : 'Pendiente de emisión';
            const ctgTexto = (cpe && cpe.ctg) ? ` (CTG: ${cpe.ctg})` : '';
            const transportista = (cpe && cpe.transportista) ? cpe.transportista : 'No asignado';
            const patente = (cpe && cpe.patenteCamion) ? cpe.patenteCamion : 'No asignada';

            html += `
                <div class="timeline-item">
                    <div class="content">
                        <div class="badges-container">
                            <span class="badge" style="background: #fef3c7; color: #92400e;">4. Tramo 2 - Flete Largo</span>
                            <span class="badge" style="background: #e0f2fe; color: #0369a1;">${puertoDestino}</span>
                        </div>
                        <h3>Momento de Transporte hacia la Terminal Portuaria</h3>
                        <p style="font-size: 0.9rem; margin-bottom: 12px;">
                            Traslado autorizado: El lote consolidado cuenta con calidad validada, notarización oficial BFA y emisión de una nueva Carta de Porte Electrónica (CPE) de traslado con destino específico al puerto.
                        </p>
                        <div class="data-grid">
                            <div class="data-row">
                                <span class="data-label">Nueva CPE de Traslado</span>
                                <span class="data-value"><strong>${numCpe}</strong>${ctgTexto}</span>
                            </div>
                            <div class="data-row">
                                <span class="data-label">Destino Portuario Específico</span>
                                <span class="data-value" style="color: #0284c7; font-weight: 700;">${puertoDestino}</span>
                            </div>
                            <div class="data-row">
                                <span class="data-label">Transportista Asignado</span>
                                <span class="data-value">${transportista}</span>
                            </div>
                            <div class="data-row">
                                <span class="data-label">Patente Camión / Convoy</span>
                                <span class="data-value">${patente}</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        // --- HITO 5: RECEPCIÓN PORTUARIA Y HABILITACIÓN PARA EMBARQUE ---
        const arribo = lote.arriboPuerto;
        if (arribo || ['ARRIBADO_PUERTO', 'EXPORTADO'].includes(estado) || lote.auditoriaEmbarque) {
            const aud = lote.auditoriaEmbarque || {};
            const checks = aud.checks || {};
            const c1 = (arribo && arribo.cpeDescargaConfirmada) || estado === 'ARRIBADO_PUERTO' || estado === 'EXPORTADO';
            const c2 = !!lote.bfaHash;
            const c3 = Array.isArray(origenes) && origenes.length > 0 && origenes.every(o => o.renspa);
            const habilitadoEmbarque = c1 && c2 && c3;

            html += `
                <div class="timeline-item">
                    <div class="content">
                        <div class="badges-container">
                            <span class="badge" style="background: #f3e8ff; color: #6b21a8;">5. Terminal Portuaria</span>
                            <span class="badge" style="background: ${habilitadoEmbarque ? '#dcfce7' : '#fee2e2'}; color: ${habilitadoEmbarque ? '#166534' : '#991b1b'}; font-weight: 700;">
                                ${habilitadoEmbarque ? '✓ Habilitado para Embarque' : '⏳ Pendiente de Habilitación'}
                            </span>
                        </div>
                        <h3>Recepción en Puerto y Habilitación para Embarque</h3>
                        <p style="font-size: 0.9rem; margin-bottom: 12px;">
                            En la terminal portuaria, el pedido se habilita para embarque únicamente cumpliendo concurrentemente con las 3 condiciones reglamentarias:
                        </p>
                        
                        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin-bottom: 12px; font-size: 0.85rem; display: flex; flex-direction: column; gap: 8px;">
                            <div style="display:flex; align-items:center; gap:8px;">
                                <span style="font-size:1.1rem;">${c1 ? '✅' : '❌'}</span>
                                <div><strong>Condición 1:</strong> Arribo y confirmación definitiva de la CPE de descarga (${c1 ? 'Confirmada' : 'Pendiente'}).</div>
                            </div>
                            <div style="display:flex; align-items:center; gap:8px;">
                                <span style="font-size:1.1rem;">${c2 ? '✅' : '❌'}</span>
                                <div><strong>Condición 2:</strong> Sellado de tiempo y hash inmutable de SENASA/AFIP comprobable en BFA (${c2 ? 'Comprobable' : 'Sin Sello'}).</div>
                            </div>
                            <div style="display:flex; align-items:center; gap:8px;">
                                <span style="font-size:1.1rem;">${c3 ? '✅' : '❌'}</span>
                                <div><strong>Condición 3:</strong> Acreditación estricta de trazabilidad de masa hacia atrás (${c3 ? `${origenes.length} orígenes con RENSPA auditados` : 'Incompleto'}).</div>
                            </div>
                        </div>

                        ${arribo ? `
                            <div class="data-grid">
                                <div class="data-row">
                                    <span class="data-label">Terminal Portuaria</span>
                                    <span class="data-value">${arribo.terminal || (cpe && cpe.destinoPuerto) || 'Terminal Portuaria'}</span>
                                </div>
                                <div class="data-row">
                                    <span class="data-label">Balanza de Puerto</span>
                                    <span class="data-value">${arribo.balanzaPuertoTN || volTotal} TN</span>
                                </div>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        }

        // --- ALERTA FITOSANITARIA (SI ESTÁ BLOQUEADO) ---
        if (estado === 'BLOQUEADO') {
            const bloqueoTx = lote.historialTransacciones && lote.historialTransacciones.find(t => t.accion === 'CAMBIO_ESTADO: BLOQUEADO');
            const motivoBloqueo = bloqueoTx ? bloqueoTx.detalles : 'Medida cautelar preventiva por organismo de control.';
            html += `
                <div class="timeline-item">
                    <div class="content" style="border-left: 4px solid #dc2626; background: #fef2f2;">
                        <div class="badges-container">
                            <span class="badge" style="background: #dc2626; color: white; font-weight: 700;">⛔ Alerta Fitosanitaria Oficial</span>
                        </div>
                        <h3 style="color: #dc2626;">Lote Inmovilizado Cautelarmente en Ledger</h3>
                        <p style="font-size: 0.9rem; margin-bottom: 12px; color: #7f1d1d;">
                            El organismo de control (SENASA / ARCA) ha suspendido el tránsito y comercialización de este lote.
                        </p>
                        <div class="data-grid">
                            <div class="data-row" style="grid-column: span 2;">
                                <span class="data-label">Motivo Fitosanitario</span>
                                <span class="data-value" style="color: #b91c1c; font-weight: 600;">${motivoBloqueo}</span>
                            </div>
                            ${bloqueoTx && bloqueoTx.fecha ? `
                            <div class="data-row">
                                <span class="data-label">Fecha y Hora de Bloqueo</span>
                                <span class="data-value">${new Date(bloqueoTx.fecha).toLocaleString('es-AR')}</span>
                            </div>` : ''}
                        </div>
                    </div>
                </div>
            `;
        }

        // --- HITO 6: CIERRE LOGÍSTICO Y TOKENIZACIÓN NFT (POLYGON / HARDHAT) ---
        const exportTx = lote.historialTransacciones && lote.historialTransacciones.find(t => t.accion === 'CAMBIO_ESTADO: EXPORTADO');
        if (exportTx || effectiveTxHash || estado === 'EXPORTADO') {
            const displayTx = effectiveTxHash || (exportTx && exportTx.detalles && exportTx.detalles.match(/TX:\s*(0x[a-fA-F0-9]+)/) ? exportTx.detalles.match(/TX:\s*(0x[a-fA-F0-9]+)/)[1] : (lote.txHash || 'Pendiente de emisión'));

            html += `
                <div class="timeline-item">
                    <div class="content">
                        <div class="badges-container">
                            <span class="badge polygon">6. Tokenización ERC-721</span>
                            <span class="badge" style="background: #10b981; color: white;">Cierre Logístico</span>
                        </div>
                        <h3>Despacho de Exportación y Emisión de NFT Inmutable</h3>
                        <p style="font-size: 0.9rem; margin-bottom: 12px;">Tokenización del lote habilitado mediante contrato inteligente ERC-721 en red EVM (Hardhat/Polygon) para comercialización internacional.</p>
                        <div class="data-grid" style="margin-bottom: 8px;">
                            <div class="data-row">
                                <span class="data-label">Contrato NFT</span>
                                <span class="data-value" style="font-family: monospace; font-size: 0.85rem;">${contractAddress}</span>
                            </div>
                            <div class="data-row">
                                <span class="data-label">Token ID</span>
                                <span class="data-value">#${tokenId !== null ? tokenId : '0'}</span>
                            </div>
                        </div>
                        <div class="hash-container">
                            <span class="hash-label">Transaction Hash (Blockchain Pública):</span>
                            <span class="hash">${displayTx}</span>
                        </div>
                    </div>
                </div>
            `;
        }


        timeline.innerHTML = html;
    }

    function renderGenealogyTree(lote) {
        const section = document.getElementById('genealogy-tree-section');
        if (!section) return;

        const arbol = lote.arbolGenealogico || {
            nivel1: {
                id: lote.id,
                volumenTotal: lote.volumenToneladas,
                estado: lote.estado,
                fecha: lote.fechaCosecha,
                lotesOrigen: lote.lotesOrigen || []
            },
            nivel2: [],
            nivel3: lote.desgloseOrigenes || [{
                id: lote.id,
                renspa: lote.renspa || 'No especificado',
                volumenAportadoTN: lote.volumenToneladas,
                porcentajeAporte: 100.0,
                geolocalizacion: lote.geolocalizacion,
                ipfsCID: lote.ipfsCID,
                fechaCosecha: lote.fechaCosecha,
                caminoGenealogico: [lote.id]
            }],
            esConsolidadoMultinivel: false,
            esMezcla: (lote.desgloseOrigenes && lote.desgloseOrigenes.length > 1)
        };

        const nivel1 = arbol.nivel1 || {};
        const nivel2 = Array.isArray(arbol.nivel2) ? arbol.nivel2 : [];
        const nivel3 = Array.isArray(arbol.nivel3) ? arbol.nivel3 : [];
        const esConsolidadoMultinivel = arbol.esConsolidadoMultinivel || nivel2.length > 0;
        const esMezcla = arbol.esMezcla || nivel3.length > 1;

        const volFinalNum = parseFloat(nivel1.volumenTotal !== undefined ? nivel1.volumenTotal : lote.volumenToneladas) || 0;
        const sumaVolumenNivel3 = nivel3.reduce((acc, curr) => acc + (parseFloat(curr.volumenAportadoTN) || 0), 0);
        const masaConservada = Math.abs(sumaVolumenNivel3 - volFinalNum) < 0.01;

        let treeHtml = `
            <div class="genealogy-wrapper">
                <div class="genealogy-header">
                    <div class="genealogy-header-badge">
                        <span>🌳</span> Árbol Genealógico Interactivo (DAG 3 Niveles)
                    </div>
                    <h3 class="genealogy-title">Resolución Algorítmica de Cadena de Custodia</h3>
                    <p class="genealogy-subtitle">
                        Backtracking inverso automatizado. Recorrido completo del grafo acíclico dirigido desde el embarque final hasta cada productor primario.
                    </p>

                    <div class="genealogy-invariants-banner">
                        <div class="invariant-pill ${masaConservada ? 'invariant-ok' : 'invariant-warn'}">
                            <span class="invariant-icon">${masaConservada ? '⚖️' : '⚠️'}</span>
                            <div class="invariant-content">
                                <strong>Conservación de Masa:</strong>
                                <span>Volumen Resultante (${volFinalNum.toFixed(2)} TN) = &sum; Aportes Raíz (${sumaVolumenNivel3.toFixed(2)} TN)</span>
                            </div>
                        </div>
                        <div class="invariant-pill invariant-ok">
                            <span class="invariant-icon">🔒</span>
                            <div class="invariant-content">
                                <strong>No Doble Gasto:</strong>
                                <span>Lotes precursores mutan de inmediato a estado terminal consumido (MEZCLADO_ACONDICIONADO)</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- NIVEL 1: EXPORTACIÓN / LOTE FINAL -->
                <div class="tree-level-container level-1-container">
                    <div class="level-header">
                        <span class="level-tag tag-level-1">🚢 NIVEL 1 · LOTE FINAL / EXPORTACIÓN</span>
                        <span class="level-metric">${volFinalNum.toFixed(2)} TN (100% Carga)</span>
                    </div>
                    <div class="tree-node-card node-level-1">
                        <div class="node-card-main">
                            <div class="node-id-box">
                                <span class="node-icon">📦</span>
                                <div>
                                    <div class="node-id-title">${nivel1.id || lote.id}</div>
                                    <div class="node-sub">Estado: <span class="node-status-badge">${nivel1.estado || lote.estado}</span></div>
                                </div>
                            </div>
                            <div class="node-specs">
                                <div class="spec-item">
                                    <span class="spec-label">Volumen Total</span>
                                    <span class="spec-val"><strong>${volFinalNum.toFixed(2)} TN</strong></span>
                                </div>
                                <div class="spec-item">
                                    <span class="spec-label">Estructura DAG</span>
                                    <span class="spec-val">${esConsolidadoMultinivel ? `${nivel2.length} Silos Intermedios + ${nivel3.length} Cosechas Raíz` : (esMezcla ? `${nivel3.length} Cosechas Fusión Directa` : 'Cosecha Monovarietal Directa')}</span>
                                </div>
                            </div>
                        </div>
                        ${lote.txHash ? `
                        <div class="node-blockchain-proof">
                            <span>🛡️ Certificado ERC-721 en Hardhat/Polygon EVM: Token ID #${lote.tokenId || '1'}</span>
                        </div>` : ''}
                    </div>
                </div>

                <!-- CONECTOR NIVEL 1 -> NIVEL 2 -->
                <div class="dag-connector">
                    <div class="dag-connector-line"></div>
                    <div class="dag-connector-badge">
                        <span>⬇️</span> Homogeneización y Fusión en Nodos de Acopio
                    </div>
                    <div class="dag-connector-line"></div>
                </div>

                <!-- NIVEL 2: NODOS INTERMEDIOS DE ACOPIO -->
                <div class="tree-level-container level-2-container">
                    <div class="level-header">
                        <span class="level-tag tag-level-2">🏭 NIVEL 2 · NODOS INTERMEDIOS DE ACOPIO</span>
                        <span class="level-metric">${nivel2.length > 0 ? `${nivel2.length} Silo(s) Intermedio(s)` : 'Acopio y Pesaje Directo'}</span>
                    </div>

                    <div class="level-nodes-grid">
        `;

        if (nivel2.length > 0) {
            nivel2.forEach(nodoInter => {
                const volInter = typeof nodoInter.volumenToneladas === 'number' ? nodoInter.volumenToneladas.toFixed(2) : nodoInter.volumenToneladas;
                const pctInter = volFinalNum > 0 ? ((nodoInter.volumenToneladas / volFinalNum) * 100).toFixed(1) : '0.0';
                const lotesPrecursores = Array.isArray(nodoInter.lotesOrigen) ? nodoInter.lotesOrigen : [];

                treeHtml += `
                    <div class="tree-node-card node-level-2">
                        <div class="node-card-main">
                            <div class="node-id-box">
                                <span class="node-icon">🏢</span>
                                <div>
                                    <div class="node-id-title">${nodoInter.id}</div>
                                    <div class="node-sub">${nodoInter.planta || 'Planta de Acopio / Silo'}</div>
                                </div>
                            </div>
                            <div class="node-consumed-badge" title="Consumido en el Lote Final: este volumen quedó fijado e inutilizable para otros lotes">
                                🔒 Consumido en Mezcla (${nodoInter.estado})
                            </div>
                        </div>
                        <div class="node-specs">
                            <div class="spec-item">
                                <span class="spec-label">Aporte a Carga Final</span>
                                <span class="spec-val"><strong>${volInter} TN</strong> (${pctInter}%)</span>
                            </div>
                            <div class="spec-item">
                                <span class="spec-label">Lotes Precursores Fusionados</span>
                                <div class="precursor-badges">
                                    ${lotesPrecursores.map(lp => `<span class="precursor-pill">${lp}</span>`).join('')}
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            });
        } else {
            treeHtml += `
                <div class="tree-node-card node-level-2 node-direct-int">
                    <div class="node-card-main">
                        <div class="node-id-box">
                            <span class="node-icon">🏢</span>
                            <div>
                                <div class="node-id-title">${esMezcla ? 'Planta Receptora y Balanza de Acopio' : 'Planta de Acondicionamiento Primario'}</div>
                                <div class="node-sub">${esMezcla ? 'Fusión y homogeneización directa en silo de elevación' : 'Acondicionamiento y pesaje monovarietal directo'}</div>
                            </div>
                        </div>
                        <span class="node-status-badge" style="background:#e0f2fe; color:#0369a1;">Paso Intermedio Directo</span>
                    </div>
                    <div class="node-specs">
                        <div class="spec-item">
                            <span class="spec-label">Operación Realizada</span>
                            <span class="spec-val">${esMezcla ? `Homogeneización directa de ${nivel3.length} cosechas primarias` : 'Acondicionamiento sin mezclas'}</span>
                        </div>
                        <div class="spec-item">
                            <span class="spec-label">Lugar de Recepción</span>
                            <span class="spec-val">Silo de Acopio / Puerto de Embarque</span>
                        </div>
                    </div>
                </div>
            `;
        }

        treeHtml += `
                    </div>
                </div>

                <!-- CONECTOR NIVEL 2 -> NIVEL 3 -->
                <div class="dag-connector">
                    <div class="dag-connector-line"></div>
                    <div class="dag-connector-badge">
                        <span>⬇️</span> Raíz: Cosechas Agrícolas Primarias en Establecimientos Rurales
                    </div>
                    <div class="dag-connector-line"></div>
                </div>

                <!-- NIVEL 3: RAÍZ / PRODUCTORES Y COSECHAS -->
                <div class="tree-level-container level-3-container">
                    <div class="level-header">
                        <span class="level-tag tag-level-3">🌱 NIVEL 3 · RAÍZ: PRODUCTORES Y COSECHAS AGRÍCOLAS</span>
                        <span class="level-metric">${nivel3.length} Establecimiento(s)</span>
                    </div>

                    <div class="level-nodes-grid level-3-grid">
        `;

        nivel3.forEach((prod) => {
            const pctProd = typeof prod.porcentajeAporte === 'number' ? prod.porcentajeAporte.toFixed(1) : prod.porcentajeAporte;
            const volProd = typeof prod.volumenAportadoTN === 'number' ? prod.volumenAportadoTN.toFixed(2) : prod.volumenAportadoTN;
            
            let lat = -34.6037;
            let lng = -58.3816;
            let geoText = "Lat: -34.6037, Lon: -58.3816";

            if (prod.geolocalizacion) {
                if (typeof prod.geolocalizacion === 'object') {
                    lat = prod.geolocalizacion.lat !== undefined ? prod.geolocalizacion.lat : lat;
                    lng = prod.geolocalizacion.lng !== undefined ? prod.geolocalizacion.lng : (prod.geolocalizacion.lon !== undefined ? prod.geolocalizacion.lon : lng);
                    geoText = prod.geolocalizacion.formatted || `Lat: ${lat}, Lon: ${lng}`;
                } else if (typeof prod.geolocalizacion === 'string') {
                    geoText = prod.geolocalizacion;
                    const match = prod.geolocalizacion.match(/Lat:\s*([-\d.]+),\s*Lo[ng]+:\s*([-\d.]+)/i);
                    if (match) {
                        lat = parseFloat(match[1]);
                        lng = parseFloat(match[2]);
                    }
                }
            }

            const mapUrl = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=13/${lat}/${lng}`;
            const fechaStr = prod.fechaCosecha ? new Date(prod.fechaCosecha).toLocaleDateString('es-AR') : 'Registrado';
            const camino = Array.isArray(prod.caminoGenealogico) && prod.caminoGenealogico.length > 0
                ? prod.caminoGenealogico.join(' ➔ ')
                : `${prod.id} ➔ ${nivel1.id || lote.id}`;

            treeHtml += `
                <div class="tree-node-card node-level-3">
                    <div class="node-card-main">
                        <div class="node-id-box">
                            <span class="node-icon">🚜</span>
                            <div>
                                <div class="node-id-title">${prod.id}</div>
                                <div class="node-sub">RENSPA: <strong>${prod.renspa}</strong></div>
                            </div>
                        </div>
                        <div class="node-percentage-pill">
                            <strong>${pctProd}%</strong> (${volProd} TN)
                        </div>
                    </div>

                    <div class="node-bar-container">
                        <div class="node-bar-fill" style="width: ${pctProd}%;"></div>
                    </div>

                    <div class="node-specs">
                        <div class="spec-item">
                            <span class="spec-label">📍 Ubicación Geográfica</span>
                            <span class="spec-val">
                                ${geoText} 
                                <a href="${mapUrl}" target="_blank" rel="noopener noreferrer" class="map-link-inline">Ver Parcela ↗</a>
                            </span>
                        </div>
                        <div class="spec-item">
                            <span class="spec-label">📅 Fecha de Cosecha</span>
                            <span class="spec-val">${fechaStr}</span>
                        </div>
                        <div class="spec-item full-spec">
                            <span class="spec-label">🔗 Linaje en Grafo (Ancestry Path)</span>
                            <span class="spec-val spec-path">${camino}</span>
                        </div>
                    </div>

                    ${prod.ipfsCID ? `
                    <div class="node-ipfs-row">
                        <div class="ipfs-info">
                            <span class="ipfs-mini-label">Carta de Porte Electrónica (CPE en IPFS):</span>
                            <span class="ipfs-mini-hash" title="${prod.ipfsCID}">${prod.ipfsCID}</span>
                        </div>
                        <a href="http://localhost:8080/ipfs/${prod.ipfsCID}" target="_blank" rel="noopener noreferrer" class="btn-ipfs-mini">
                            📄 Ver CPE Original
                        </a>
                    </div>` : ''}
                </div>
            `;
        });

        treeHtml += `
                    </div>
                </div>
            </div>
        `;

        section.innerHTML = treeHtml;
    }
});

// Modal Moderno de Detalles Web3 On-Chain (Reemplazo de alert nativo)
window.mostrarModalTransaccion = function (txHash, contractAddress, tokenId) {
    let modal = document.getElementById('web3-modal-overlay');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'web3-modal-overlay';
        modal.className = 'web3-modal-overlay';
        document.body.appendChild(modal);
    }

    modal.innerHTML = `
        <div class="web3-modal-card">
            <div class="web3-modal-header">
                <div class="web3-modal-icon">⛓️</div>
                <div>
                    <h3 class="web3-modal-title">Transacción Verificada en Blockchain</h3>
                    <p class="web3-modal-subtitle">Red Hardhat / Polygon EVM • Protocolo Notarial BFA</p>
                </div>
            </div>

            <div class="web3-field-group">
                <label class="web3-field-label">Hash de Transacción (TX)</label>
                <div class="web3-field-box">
                    <span>${txHash}</span>
                    <button type="button" class="web3-copy-btn" onclick="window.copiarTexto('${txHash}', this)">Copiar</button>
                </div>
            </div>

            <div class="web3-field-group">
                <label class="web3-field-label">Contrato Inteligente ERC-721</label>
                <div class="web3-field-box">
                    <span>${contractAddress}</span>
                    <button type="button" class="web3-copy-btn" onclick="window.copiarTexto('${contractAddress}', this)">Copiar</button>
                </div>
            </div>

            <div class="web3-field-group">
                <label class="web3-field-label">Token ID Oficial</label>
                <div class="web3-field-box" style="font-weight: 700; color: var(--bfa-primary);">
                    <span>#${tokenId}</span>
                    <span style="background: #e0f2fe; color: #0284c7; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem;">NFT Inmutable</span>
                </div>
            </div>

            <div class="web3-modal-footer">
                <button type="button" class="web3-btn-close" onclick="window.cerrarModalTransaccion()">Cerrar</button>
            </div>
        </div>
    `;

    modal.classList.add('active');

    const handleKey = (e) => {
        if (e.key === 'Escape') window.cerrarModalTransaccion();
    };
    document.addEventListener('keydown', handleKey, { once: true });
    modal.onclick = (e) => {
        if (e.target === modal) window.cerrarModalTransaccion();
    };
};

window.cerrarModalTransaccion = function () {
    const modal = document.getElementById('web3-modal-overlay');
    if (modal) {
        modal.classList.remove('active');
    }
};

window.copiarTexto = function (texto, btn) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(texto).then(() => {
            const orig = btn.textContent;
            btn.textContent = '✓ Copiado';
            btn.style.background = '#dcfce7';
            btn.style.color = '#15803d';
            setTimeout(() => {
                btn.textContent = orig;
                btn.style.background = '';
                btn.style.color = '';
            }, 1800);
        }).catch(err => {
            console.warn('Error al copiar texto:', err);
        });
    }
};
