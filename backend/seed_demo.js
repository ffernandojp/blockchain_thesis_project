const fabricLedger = require('../blockchain-private-mock/fabricMockLedger');

function seedDemoData() {
    console.log('🌾 Inicializando datos de demostración para trazabilidad de masa...');
    
    // 1. Cosechas Primarias y Recepción/Acondicionamiento en Balanza
    fabricLedger.registrarCosechaPrimaria(
        'LOTE-AGRO-001',
        '01.002.0.00345/00',
        'Lat: -34.6037, Lon: -58.3816',
        40.0,
        'bafybeicarta001agrotech'
    );
    fabricLedger.actualizarEstadoLogistico('LOTE-AGRO-001', 'ACONDICIONADO', 'Acopiador / Cooperativa', 'Pesaje: 40.0TN en balanza.');

    fabricLedger.registrarCosechaPrimaria(
        'LOTE-AGRO-002',
        '02.003.0.00789/00',
        'Lat: -33.8912, Lon: -60.5421',
        60.0,
        'bafybeicarta002agrotech'
    );
    fabricLedger.actualizarEstadoLogistico('LOTE-AGRO-002', 'ACONDICIONADO', 'Acopiador / Cooperativa', 'Pesaje: 60.0TN en balanza.');

    // 2. Consolidación en Silo (40% y 60%)
    const mezcla = fabricLedger.procesarAcopioYMezcla('SILO-BAHIA-100', ['LOTE-AGRO-001', 'LOTE-AGRO-002']);

    // 3. Notarización BFA
    fabricLedger.actualizarEstadoLogistico(
        'SILO-BAHIA-100',
        'ACONDICIONADO',
        'SENASA / ARCA',
        'Sello criptográfico emitido en BFA.',
        '3a8f9c1e7b2d5f4a6b8c0d2e4f6a8b0c2d4e6f8a0b2c4d6e8f0a2b4c6d8e0f1a'
    );

    // 4. Exportación en Puerto
    const exportado = fabricLedger.actualizarEstadoLogistico(
        'SILO-BAHIA-100',
        'EXPORTADO',
        'Exportador (Puertos)',
        'NFT minteado. TX: 0x9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b - Token ID: #1'
    );
    exportado.tokenId = '1';
    exportado.txHash = '0x9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b';

    // 5. Lote Monovarietal directo para pruebas comparativas
    fabricLedger.registrarCosechaPrimaria(
        'LOTE-MONO-85',
        '05.006.0.00555/00',
        'Lat: -35.1234, Lon: -59.4321',
        85.0,
        'bafybeicartamono85tn'
    );
    fabricLedger.actualizarEstadoLogistico('LOTE-MONO-85', 'ACONDICIONADO', 'Acopiador / Cooperativa', 'Pesaje: 85.0TN en balanza.');

    // 5b. Silo Acondicionado adicional para auditoría regulatoria (SENASA / Bloqueo Fitosanitario)
    fabricLedger.registrarCosechaPrimaria(
        'LOTE-SANTA-FE-120',
        '03.004.0.00999/00',
        'Lat: -32.9511, Lon: -60.6663',
        120.0,
        'bafybeicartasantafe120tn'
    );
    fabricLedger.actualizarEstadoLogistico('LOTE-SANTA-FE-120', 'ACONDICIONADO', 'Acopiador / Cooperativa', 'Pesaje y acondicionamiento en Planta Rosario.');

    // 6. Cadena de Custodia Multinivel (3 Niveles de Trazabilidad)
    // Nivel 3 (Raíz): Cosechas Primarias acondicionadas
    fabricLedger.registrarCosechaPrimaria(
        'LOTE-SUR-01',
        '04.005.0.00111/00',
        'Lat: -37.2911, Lon: -59.1332',
        40.0,
        'bafybeicartasur01tn40'
    );
    fabricLedger.actualizarEstadoLogistico('LOTE-SUR-01', 'ACONDICIONADO', 'Acopiador / Cooperativa', 'Pesaje: 40.0TN en balanza Tandil.');

    fabricLedger.registrarCosechaPrimaria(
        'LOTE-SUR-02',
        '04.005.0.00222/00',
        'Lat: -37.3456, Lon: -59.2104',
        60.0,
        'bafybeicartasur02tn60'
    );
    fabricLedger.actualizarEstadoLogistico('LOTE-SUR-02', 'ACONDICIONADO', 'Acopiador / Cooperativa', 'Pesaje: 60.0TN en balanza Tandil.');

    // Nivel 2 (Nodo Intermedio de Acopio): Silo Acopio Tandil
    fabricLedger.procesarAcopioYMezcla('SILO-TANDIL-100', ['LOTE-SUR-01', 'LOTE-SUR-02']);
    fabricLedger.actualizarEstadoLogistico(
        'SILO-TANDIL-100',
        'ACONDICIONADO',
        'Acopiador / Cooperativa',
        'Acondicionamiento y homogeneización en Planta Tandil.'
    );

    // Cosecha adicional directa acondicionada
    fabricLedger.registrarCosechaPrimaria(
        'LOTE-NORTE-03',
        '04.006.0.00333/00',
        'Lat: -33.6789, Lon: -60.1234',
        100.0,
        'bafybeicartanorte03tn100'
    );
    fabricLedger.actualizarEstadoLogistico('LOTE-NORTE-03', 'ACONDICIONADO', 'Acopiador / Cooperativa', 'Pesaje: 100.0TN en balanza Puerto.');

    // Nivel 1 (Exportación / Lote Buque Final 200 TN): Fusión de SILO-TANDIL-100 + LOTE-NORTE-03
    fabricLedger.procesarAcopioYMezcla('LOTE-BUQUE-EXPORT-200', ['SILO-TANDIL-100', 'LOTE-NORTE-03']);

    // Notarización BFA para el lote final
    fabricLedger.actualizarEstadoLogistico(
        'LOTE-BUQUE-EXPORT-200',
        'ACONDICIONADO',
        'SENASA / ARCA',
        'Sello criptográfico emitido en BFA para embarque de exportación.',
        '7f4a2c9e1b3d5f6a8b0c2d4e6f8a0b2c4d6e8f0a2b4c6d8e0f1a3b5c7d9e1f3a'
    );

    // Exportación y NFT Polygon
    const exportadoFinal = fabricLedger.actualizarEstadoLogistico(
        'LOTE-BUQUE-EXPORT-200',
        'EXPORTADO',
        'Exportador (Puertos)',
        'NFT minteado. TX: 0x8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b7c - Token ID: #2'
    );
    exportadoFinal.tokenId = '2';
    exportadoFinal.txHash = '0x8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b7c';

    // 7. Lote en Tránsito para Demostración Interactiva de Recepción en Acopio
    fabricLedger.registrarCosechaPrimaria(
        'CAMION-TRANSITO-01',
        '01.002.0.00345/00',
        'Lat: -34.7891, Lon: -58.5432',
        29.5,
        'bafybeicamion01transito'
    );
    fabricLedger.actualizarEstadoLogistico('CAMION-TRANSITO-01', 'EN_TRANSITO', 'Transportista', 'En viaje hacia Planta de Acopio con CPE.');

    console.log('✅ Lotes sembrados: SILO-BAHIA-100 (100 TN), LOTE-MONO-85 (85 TN), LOTE-BUQUE-EXPORT-200 (3 niveles, 200 TN) y CAMION-TRANSITO-01 (29.5 TN en tránsito).');
}

module.exports = seedDemoData;
