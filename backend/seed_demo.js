const fabricLedger = require('../blockchain-private-mock/fabricMockLedger');

function seedDemoData() {
    console.log('🌾 Inicializando datos de demostración para flujo funcional agroindustrial...');

    // =========================================================================
    // 1. LOTE EXPORTADO HISTÓRICO: SILO-BAHIA-100 (100 TN - 40% y 60%)
    // =========================================================================
    // Tramo 1 (Campo -> Acopio): Cosecha primaria y CPE flete corto
    fabricLedger.registrarCosechaPrimaria(
        'LOTE-AGRO-001',
        '01.002.0.00345/00',
        'Lat: -34.6037, Lon: -58.3816',
        40.0,
        'bafybeicarta001agrotech'
    );
    fabricLedger.actualizarEstadoLogistico('LOTE-AGRO-001', 'EN_TRANSITO_ACOPIO', 'Transportista', 'Tramo 1 (Campo -> Acopio): En viaje por flete corto.');
    fabricLedger.actualizarEstadoLogistico('LOTE-AGRO-001', 'RECEPCIONADO_ACOPIO', 'Acopiador / Cooperativa', 'Pesaje: 40.0TN en balanza oficial de acopio.');

    fabricLedger.registrarCosechaPrimaria(
        'LOTE-AGRO-002',
        '02.003.0.00789/00',
        'Lat: -33.8912, Lon: -60.5421',
        60.0,
        'bafybeicarta002agrotech'
    );
    fabricLedger.actualizarEstadoLogistico('LOTE-AGRO-002', 'EN_TRANSITO_ACOPIO', 'Transportista', 'Tramo 1 (Campo -> Acopio): En viaje por flete corto.');
    fabricLedger.actualizarEstadoLogistico('LOTE-AGRO-002', 'RECEPCIONADO_ACOPIO', 'Acopiador / Cooperativa', 'Pesaje: 60.0TN en balanza oficial de acopio.');

    // Acondicionamiento y Mezcla en Silo (ACOPIADO_ACONDICIONADO)
    fabricLedger.procesarAcopioYMezcla('SILO-BAHIA-100', ['LOTE-AGRO-001', 'LOTE-AGRO-002']);

    // Fiscalización Fitosanitaria SENASA y Sello BFA (VALIDADO_SENASA)
    fabricLedger.notarizarSenasa(
        'SILO-BAHIA-100',
        { inspector: 'Dr. Rossi (SENASA)', plagasCuarentenarias: 'Ausencia certificada de plagas', calidadTipificada: 'Grado 2 Homogéneo' },
        'Organismo de Control (SENASA/ARCA)',
        '3a8f9c1e7b2d5f4a6b8c0d2e4f6a8b0c2d4e6f8a0b2c4d6e8f0a2b4c6d8e0f1a'
    );

    // Tramo 2 (Acopio -> Puerto): Emisión CPE de Traslado Flete Largo hacia Puerto de Bahía Blanca
    fabricLedger.emitirCpeTraslado('SILO-BAHIA-100', {
        destinoPuerto: 'Puerto de Bahía Blanca',
        numeroCPE: 'CPE-TL-BAHIA-100',
        ctg: 'CTG-99887766',
        transportista: 'Logística Portuaria Sur S.A.',
        patenteCamion: 'AC 789 JJ'
    });

    // Recepción Portuaria: Arribo y confirmación CPE descarga
    fabricLedger.confirmarArriboPuerto('SILO-BAHIA-100', {
        terminal: 'Puerto de Bahía Blanca - Muelle 3',
        balanzaPuertoTN: 100.0,
        inspectorAduana: 'Aduana ARCA / Terminal BB'
    });

    // Cierre Logístico de Exportación (NFT ERC-721 en Hardhat)
    const exportado = fabricLedger.actualizarEstadoLogistico(
        'SILO-BAHIA-100',
        'EXPORTADO',
        'Exportador (Puertos)',
        'NFT minteado. TX: 0x9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b - Token ID: #1'
    );
    exportado.tokenId = '1';
    exportado.txHash = '0x9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b';

    // =========================================================================
    // 2. LOTE MULTINIVEL COMPLETO EXPORTADO: LOTE-BUQUE-EXPORT-200 (200 TN)
    // =========================================================================
    fabricLedger.registrarCosechaPrimaria('LOTE-SUR-01', '04.005.0.00111/00', 'Lat: -37.2911, Lon: -59.1332', 40.0, 'bafybeicartasur01tn40');
    fabricLedger.actualizarEstadoLogistico('LOTE-SUR-01', 'RECEPCIONADO_ACOPIO', 'Acopiador', 'Pesaje: 40.0TN.');

    fabricLedger.registrarCosechaPrimaria('LOTE-SUR-02', '04.005.0.00222/00', 'Lat: -37.3456, Lon: -59.2104', 60.0, 'bafybeicartasur02tn60');
    fabricLedger.actualizarEstadoLogistico('LOTE-SUR-02', 'RECEPCIONADO_ACOPIO', 'Acopiador', 'Pesaje: 60.0TN.');

    fabricLedger.procesarAcopioYMezcla('SILO-TANDIL-100', ['LOTE-SUR-01', 'LOTE-SUR-02']);

    fabricLedger.registrarCosechaPrimaria('LOTE-NORTE-03', '04.006.0.00333/00', 'Lat: -33.6789, Lon: -60.1234', 100.0, 'bafybeicartanorte03tn100');
    fabricLedger.actualizarEstadoLogistico('LOTE-NORTE-03', 'RECEPCIONADO_ACOPIO', 'Acopiador', 'Pesaje: 100.0TN.');

    fabricLedger.procesarAcopioYMezcla('LOTE-BUQUE-EXPORT-200', ['SILO-TANDIL-100', 'LOTE-NORTE-03']);

    fabricLedger.notarizarSenasa(
        'LOTE-BUQUE-EXPORT-200',
        { inspector: 'Ing. Valenzuela (SENASA)', plagasCuarentenarias: 'Libre de insectos vivos', calidadTipificada: 'Grado 1 Exportación' },
        'Organismo de Control (SENASA/ARCA)',
        '7f4a2c9e1b3d5f6a8b0c2d4e6f8a0b2c4d6e8f0a2b4c6d8e0f1a3b5c7d9e1f3a'
    );

    fabricLedger.emitirCpeTraslado('LOTE-BUQUE-EXPORT-200', {
        destinoPuerto: 'Puerto de Quequén',
        numeroCPE: 'CPE-TL-QUEQUEN-200',
        ctg: 'CTG-88776655',
        transportista: 'Convoy Ferroviario Quequén S.A.'
    });

    fabricLedger.confirmarArriboPuerto('LOTE-BUQUE-EXPORT-200', {
        terminal: 'Puerto de Quequén - Terminal Elevadora',
        balanzaPuertoTN: 200.0,
        inspectorAduana: 'Aduana Quequén'
    });

    const exportadoFinal = fabricLedger.actualizarEstadoLogistico(
        'LOTE-BUQUE-EXPORT-200',
        'EXPORTADO',
        'Exportador (Puertos)',
        'NFT minteado. TX: 0x8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b7c - Token ID: #2'
    );
    exportadoFinal.tokenId = '2';
    exportadoFinal.txHash = '0x8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b7c';

    // =========================================================================
    // 3. LOTES ACTIVOS EN CADA ETAPA DEL FLUJO FUNCIONAL PARA DEMOSTRACIÓN VIVA:
    // =========================================================================

    // Etapa 1: COSECHADO (Productor con CPE Primaria generada, flete corto pendiente)
    const cosecha1 = fabricLedger.registrarCosechaPrimaria(
        'CAMION-CAMPO-01',
        '01.002.0.00345/00',
        'Lat: -34.6037, Lon: -58.3816',
        30.0,
        'bafybeicampoprimario30tn'
    );
    cosecha1.owner = 'productor1';

    // Etapa 2: EN_TRANSITO_ACOPIO (Transportista traslada carga de campo hacia acopio)
    fabricLedger.registrarCosechaPrimaria(
        'CAMION-TRANSITO-01',
        '01.002.0.00345/00',
        'Lat: -34.7891, Lon: -58.5432',
        29.5,
        'bafybeicamion01transito'
    );
    fabricLedger.actualizarEstadoLogistico('CAMION-TRANSITO-01', 'EN_TRANSITO_ACOPIO', 'Transportista', 'Tramo 1 (Campo -> Acopio): En viaje hacia Planta de Acopio con CPE Primaria.');

    // Etapa 3: RECEPCIONADO_ACOPIO (Acopio descargó y pesó en balanza, listo para acondicionar/mezclar)
    fabricLedger.registrarCosechaPrimaria(
        'CAMION-BALANZA-02',
        '01.002.0.00034/00',
        'Lat: -34.4512, Lon: -60.1234',
        32.0,
        'bafybeibalanza02descargado'
    );
    fabricLedger.actualizarEstadoLogistico('CAMION-BALANZA-02', 'EN_TRANSITO_ACOPIO', 'Transportista', 'En viaje.');
    fabricLedger.actualizarEstadoLogistico('CAMION-BALANZA-02', 'RECEPCIONADO_ACOPIO', 'Acopiador / Cooperativa', 'Recepción y pesaje neto definitivo: 31.85 TN en balanza acopio.');

    // Etapa 4: ACOPIADO_ACONDICIONADO (Granos mezclados/acondicionados en silo, listos para SENASA)
    fabricLedger.registrarCosechaPrimaria('LOTE-PRE-A', '01.002.0.00034/00', 'Lat: -34.45, Lon: -60.12', 45.0, 'cid_pre_a');
    fabricLedger.actualizarEstadoLogistico('LOTE-PRE-A', 'RECEPCIONADO_ACOPIO', 'Acopiador', 'Pesaje: 45 TN.');
    fabricLedger.registrarCosechaPrimaria('LOTE-PRE-B', '01.002.0.00034/01', 'Lat: -34.50, Lon: -60.20', 35.0, 'cid_pre_b');
    fabricLedger.actualizarEstadoLogistico('LOTE-PRE-B', 'RECEPCIONADO_ACOPIO', 'Acopiador', 'Pesaje: 35 TN.');

    fabricLedger.procesarAcopioYMezcla('SILO-ACONDICIONADO-03', ['LOTE-PRE-A', 'LOTE-PRE-B']);
    // Estado: ACOPIADO_ACONDICIONADO (Listo para SENASA)

    // Etapa 5: VALIDADO_SENASA (SENASA certificó parámetros y selló BFA, listo para CPE de Traslado)
    fabricLedger.registrarCosechaPrimaria('LOTE-PRE-C', '02.003.0.00789/00', 'Lat: -33.89, Lon: -60.54', 50.0, 'cid_pre_c');
    fabricLedger.actualizarEstadoLogistico('LOTE-PRE-C', 'RECEPCIONADO_ACOPIO', 'Acopiador', 'Pesaje: 50 TN.');
    fabricLedger.registrarCosechaPrimaria('LOTE-PRE-D', '02.003.0.00789/00', 'Lat: -33.92, Lon: -60.50', 50.0, 'cid_pre_d');
    fabricLedger.actualizarEstadoLogistico('LOTE-PRE-D', 'RECEPCIONADO_ACOPIO', 'Acopiador', 'Pesaje: 50 TN.');

    fabricLedger.procesarAcopioYMezcla('SILO-VALIDADO-04', ['LOTE-PRE-C', 'LOTE-PRE-D']);
    fabricLedger.notarizarSenasa(
        'SILO-VALIDADO-04',
        { inspector: 'Dr. Méndez (SENASA)', plagasCuarentenarias: 'Conforme - Libre de plagas', calidadTipificada: 'Grado 2 Oficial' },
        'Organismo de Control (SENASA/ARCA)',
        '4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e'
    );
    // Estado: VALIDADO_SENASA (Listo para emitir CPE de Traslado hacia Bahía Blanca o Quequén)

    // Etapa 6: EN_TRANSITO_PUERTO (CPE de Traslado emitida con destino específico, camión en ruta a puerto)
    fabricLedger.registrarCosechaPrimaria('LOTE-PRE-E', '05.006.0.00555/00', 'Lat: -35.12, Lon: -59.43', 70.0, 'cid_pre_e');
    fabricLedger.actualizarEstadoLogistico('LOTE-PRE-E', 'RECEPCIONADO_ACOPIO', 'Acopiador', 'Pesaje: 70 TN.');
    fabricLedger.acondicionarLote('LOTE-PRE-E', { calidadComercial: 'Grado 2' });
    fabricLedger.notarizarSenasa(
        'LOTE-PRE-E',
        { inspector: 'Lic. Gómez (SENASA)', plagasCuarentenarias: 'Ausencia certificada', calidadTipificada: 'Grado 2' },
        'Organismo de Control (SENASA/ARCA)',
        '5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f'
    );
    fabricLedger.emitirCpeTraslado('LOTE-PRE-E', {
        destinoPuerto: 'Puerto de Bahía Blanca',
        numeroCPE: 'CPE-TL-70TN-BB',
        ctg: 'CTG-44332211',
        transportista: 'Expreso Pampeano S.R.L.'
    });
    // Renombrar visualmente o guardar referencia
    fabricLedger.worldState.set('CONVOY-PUERTO-05', {
        ...fabricLedger.worldState.get('LOTE-PRE-E'),
        id: 'CONVOY-PUERTO-05'
    });

    // Etapa 7: ARRIBADO_PUERTO (Arribo confirmado, las 3 condiciones de HABILITADO PARA EMBARQUE cumplidas)
    fabricLedger.registrarCosechaPrimaria('LOTE-PRE-F', '04.005.0.00111/00', 'Lat: -37.29, Lon: -59.13', 80.0, 'cid_pre_f');
    fabricLedger.actualizarEstadoLogistico('LOTE-PRE-F', 'RECEPCIONADO_ACOPIO', 'Acopiador', 'Pesaje: 80 TN.');
    fabricLedger.acondicionarLote('LOTE-PRE-F', { calidadComercial: 'Grado 1' });
    fabricLedger.notarizarSenasa(
        'LOTE-PRE-F',
        { inspector: 'Dr. Rossi (SENASA)', plagasCuarentenarias: 'Libre de plagas', calidadTipificada: 'Grado 1' },
        'Organismo de Control (SENASA/ARCA)',
        '6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a'
    );
    fabricLedger.emitirCpeTraslado('LOTE-PRE-F', {
        destinoPuerto: 'Puerto de Quequén',
        numeroCPE: 'CPE-TL-80TN-QQ',
        ctg: 'CTG-11223344',
        transportista: 'Transportes del Sudeste'
    });
    fabricLedger.confirmarArriboPuerto('LOTE-PRE-F', {
        terminal: 'Puerto de Quequén',
        balanzaPuertoTN: 80.0,
        inspectorAduana: 'Aduana ARCA Quequén'
    });
    fabricLedger.worldState.set('LOTE-ARRIBADO-06', {
        ...fabricLedger.worldState.get('LOTE-PRE-F'),
        id: 'LOTE-ARRIBADO-06'
    });

    console.log('✅ Lotes sembrados con éxito para cada etapa operativa del negocio agroindustrial.');
}

module.exports = seedDemoData;
