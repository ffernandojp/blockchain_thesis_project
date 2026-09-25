/**
 * Test de Verificación Exhaustiva:
 * Clarificación Operativa y Flujo Funcional del Negocio Agroindustrial
 * 
 * 1. Momento de emisión del Certificado de SENASA:
 *    Se emite una vez que el grano ingresa a acopio y es acondicionado en silo.
 * 2. Momento de transporte hacia terminal portuaria:
 *    Solo autorizado con calidad validada, BFA registrado y nueva CPE de traslado (Bahía Blanca o Quequén).
 * 3. Listado de pedidos habilitados en la planta de exportación:
 *    Habilitado para Embarque únicamente con las 3 condiciones concurrentes:
 *    a) Arribo y confirmación definitiva CPE descarga.
 *    b) Sellado de tiempo y hash BFA.
 *    c) Acreditación estricta de trazabilidad de masa hacia atrás (backtracking y RENSPA).
 * 4. Flujo funcional completo en 8 estados.
 */

const assert = require('assert');
const fabricLedger = require('../blockchain-private-mock/fabricMockLedger');

async function testFlujoAgroindustrial() {
    console.log('\n========================================================================');
    console.log('🌾 TEST: FLUJO FUNCIONAL Y REGLAS DE NEGOCIO AGROINDUSTRIAL');
    console.log('========================================================================\n');

    // -------------------------------------------------------------------------
    // TRAMO 1: CAMPO -> ACOPIO
    // -------------------------------------------------------------------------
    console.log('--- 1. Tramo 1 (Campo -> Acopio): Cosecha Primaria y Flete Corto ---');
    
    // Productor genera CPE Primaria
    const lote1 = fabricLedger.registrarCosechaPrimaria(
        'TEST-LOTE-AGRO-A',
        '01.002.0.00345/00',
        'Lat: -34.6037, Lon: -58.3816',
        30.0,
        'bafybeicpeprimaria01'
    );
    assert.strictEqual(lote1.estado, 'COSECHADO');
    console.log(`✅ Lote creado en estado COSECHADO con CPE Primaria (30 TN).`);

    // Transportista inicia flete corto
    fabricLedger.actualizarEstadoLogistico('TEST-LOTE-AGRO-A', 'EN_TRANSITO_ACOPIO', 'Transportista', 'Flete corto hacia acopio.');
    const loteEnTransito = fabricLedger.obtenerLote('TEST-LOTE-AGRO-A');
    assert.strictEqual(loteEnTransito.estado, 'EN_TRANSITO_ACOPIO');
    console.log(`✅ Lote en estado EN_TRANSITO_ACOPIO (Flete corto en viaje).`);

    // Intento inválido: Mezclar o certificar un camión en ruta
    let errMezclaEnViaje = null;
    try {
        fabricLedger.procesarAcopioYMezcla('SILO-PREMATURO', ['TEST-LOTE-AGRO-A']);
    } catch (e) {
        errMezclaEnViaje = e;
    }
    assert(errMezclaEnViaje !== null, 'Debe impedir mezclar un camión que aún viaja en flete corto');
    console.log(`✅ Regla confirmada: Mezcla rechazada mientras viaja en flete corto: "${errMezclaEnViaje.message}"`);

    // Arribo al Acopio: Confirmación física y pesaje en balanza
    const loteRecepcionado = fabricLedger.actualizarEstadoLogistico(
        'TEST-LOTE-AGRO-A',
        'RECEPCIONADO_ACOPIO',
        'Acopiador / Cooperativa',
        'Pesaje neto en balanza: 29.80 TN. Descarga confirmada.'
    );
    loteRecepcionado.volumenToneladas = 29.80;
    assert.strictEqual(loteRecepcionado.estado, 'RECEPCIONADO_ACOPIO');
    console.log(`✅ Lote en estado RECEPCIONADO_ACOPIO: descarga y balanza completadas (29.80 TN).`);

    // Creamos un segundo lote recepcionado para mezcla
    const lote2 = fabricLedger.registrarCosechaPrimaria('TEST-LOTE-AGRO-B', '02.003.0.00789/00', 'Lat: -33.89, Lon: -60.54', 50.20, 'cpe_b');
    fabricLedger.actualizarEstadoLogistico('TEST-LOTE-AGRO-B', 'RECEPCIONADO_ACOPIO', 'Acopiador', 'Pesaje: 50.20 TN.');

    // -------------------------------------------------------------------------
    // ACONDICIONAMIENTO Y FISCALIZACIÓN EN ACOPIO
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Acondicionamiento y Mezcla en Silos (Balance de Masa) ---');
    
    // Fusión de granos en silo: pasa a ACOPIADO_ACONDICIONADO
    const silo = fabricLedger.procesarAcopioYMezcla('SILO-PRUEBA-80TN', ['TEST-LOTE-AGRO-A', 'TEST-LOTE-AGRO-B']);
    assert.strictEqual(silo.estado, 'ACOPIADO_ACONDICIONADO');
    assert.strictEqual(silo.volumenToneladas, 80.0);
    console.log(`✅ Silo consolidado en estado ACOPIADO_ACONDICIONADO: 80.00 TN.`);

    // Precursores mutaron a MEZCLADO_ACONDICIONADO (Consumo de estados)
    assert.strictEqual(fabricLedger.obtenerLote('TEST-LOTE-AGRO-A').estado, 'MEZCLADO_ACONDICIONADO');
    assert.strictEqual(fabricLedger.obtenerLote('TEST-LOTE-AGRO-B').estado, 'MEZCLADO_ACONDICIONADO');
    console.log(`✅ Invariante no doble gasto: Precursores mutaron a MEZCLADO_ACONDICIONADO.`);

    // Regla de Negocio: Traslado a puerto rechazado sin SENASA ni BFA
    console.log('\n--- 3. Verificación de Restricciones para Traslado a Puerto ---');
    let errTrasladoSinSenasa = null;
    try {
        fabricLedger.emitirCpeTraslado('SILO-PRUEBA-80TN', { destinoPuerto: 'Puerto de Bahía Blanca' });
    } catch (e) {
        errTrasladoSinSenasa = e;
    }
    assert(errTrasladoSinSenasa !== null, 'Debe rechazar el traslado si no está certificado por SENASA con BFA');
    console.log(`✅ Regla confirmada: Traslado a puerto rechazado sin SENASA: "${errTrasladoSinSenasa.message}"`);

    // Fiscalización Fitosanitaria SENASA y Sello BFA
    console.log('\n--- 4. Fiscalización SENASA / AFIP y Sello BFA ---');
    const hashBFA = 'a1b2c3d4e5f60718293a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e';
    const siloValidado = fabricLedger.notarizarSenasa(
        'SILO-PRUEBA-80TN',
        {
            inspector: 'Inspector Oficial SENASA',
            plagasCuarentenarias: 'Libre de gorgojo y plagas cuarentenarias',
            calidadTipificada: 'Grado 2 Homogéneo Conforme'
        },
        'Organismo de Control (SENASA/ARCA)',
        hashBFA
    );
    assert.strictEqual(siloValidado.estado, 'VALIDADO_SENASA');
    assert.strictEqual(siloValidado.bfaHash, hashBFA);
    console.log(`✅ Silo validado por SENASA: Estado VALIDADO_SENASA, Sello BFA estampado.`);

    // -------------------------------------------------------------------------
    // TRAMO 2: ACOPIO -> PUERTO DE EXPORTACIÓN
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Tramo 2: Emisión CPE de Traslado (Flete Largo hacia Puerto) ---');
    
    // Intento con destino no portuario (debe fallar)
    let errDestinoInvalido = null;
    try {
        fabricLedger.emitirCpeTraslado('SILO-PRUEBA-80TN', { destinoPuerto: 'Planta Avícola Pilar' });
    } catch (e) {
        errDestinoInvalido = e;
    }
    assert(errDestinoInvalido !== null, 'Debe rechazar si el destino no es Bahía Blanca o Quequén');
    console.log(`✅ Regla confirmada: Destino no portuario rechazado: "${errDestinoInvalido.message}"`);

    // Emisión autorizada hacia Puerto de Bahía Blanca
    const loteEnFleteLargo = fabricLedger.emitirCpeTraslado('SILO-PRUEBA-80TN', {
        destinoPuerto: 'Puerto de Bahía Blanca',
        numeroCPE: 'CPE-TL-80TN-BB',
        ctg: 'CTG-55667788',
        transportista: 'Transportes Bahía S.A.'
    });
    assert.strictEqual(loteEnFleteLargo.estado, 'EN_TRANSITO_PUERTO');
    assert.strictEqual(loteEnFleteLargo.cpeTraslado.destinoPuerto, 'Puerto de Bahía Blanca');
    console.log(`✅ CPE de Traslado emitida con éxito hacia ${loteEnFleteLargo.cpeTraslado.destinoPuerto}. Estado: EN_TRANSITO_PUERTO.`);

    // -------------------------------------------------------------------------
    // RECEPCIÓN PORTUARIA Y LISTADO HABILITADO PARA EMBARQUE
    // -------------------------------------------------------------------------
    console.log('\n--- 6. Recepción Portuaria y Habilitación para Embarque ---');

    // Antes de arribar: Evaluar si está habilitado para embarque (Debe ser FALSO porque no arribó aún)
    const checkAntesArribo = fabricLedger.verificarHabilitadoParaEmbarque('SILO-PRUEBA-80TN');
    assert.strictEqual(checkAntesArribo.habilitado, false);
    assert.strictEqual(checkAntesArribo.checks.cpeDescargaConfirmada.cumplido, false);
    console.log(`✅ Condición 1 protegida: No habilitado antes del arribo a terminal.`);

    // Arribo del convoy y confirmación de la CPE de descarga
    const loteArribado = fabricLedger.confirmarArriboPuerto('SILO-PRUEBA-80TN', {
        terminal: 'Puerto de Bahía Blanca - Terminal Muelle 5',
        balanzaPuertoTN: 80.0,
        inspectorAduana: 'Aduana ARCA Bahía Blanca'
    });
    assert.strictEqual(loteArribado.estado, 'ARRIBADO_PUERTO');
    console.log(`✅ Convoy arribado y confirmado: Estado ARRIBADO_PUERTO.`);

    // Evaluación de las 3 CONDICIONES CONCURRENTES para estar Habilitado para Embarque
    const checkFinal = fabricLedger.verificarHabilitadoParaEmbarque('SILO-PRUEBA-80TN');
    console.log('Evaluación de condiciones concurrentes:');
    console.log(`- CPE Descarga Confirmada: ${checkFinal.checks.cpeDescargaConfirmada.cumplido}`);
    console.log(`- Sello BFA Válido: ${checkFinal.checks.selloBfaValido.cumplido}`);
    console.log(`- Trazabilidad de Masa Acreditada: ${checkFinal.checks.trazabilidadMasaAcreditada.cumplido} (${checkFinal.checks.trazabilidadMasaAcreditada.cantidadOrigenes} productores raíz)`);
    
    assert.strictEqual(checkFinal.checks.cpeDescargaConfirmada.cumplido, true);
    assert.strictEqual(checkFinal.checks.selloBfaValido.cumplido, true);
    assert.strictEqual(checkFinal.checks.trazabilidadMasaAcreditada.cumplido, true);
    assert.strictEqual(checkFinal.habilitado, true);
    console.log(`🎉 LOTE HABILITADO PARA EMBARQUE: Cumple concurrentemente con las 3 condiciones.`);

    // Cierre Logístico: Acuñación y EXPORTADO
    fabricLedger.actualizarEstadoLogistico('SILO-PRUEBA-80TN', 'EXPORTADO', 'Exportador (Puertos)', 'Cierre logístico.');
    assert.strictEqual(fabricLedger.obtenerLote('SILO-PRUEBA-80TN').estado, 'EXPORTADO');
    console.log(`✅ Cierre logístico completado: Estado EXPORTADO.`);

    console.log('\n========================================================================');
    console.log('🎉 TODOS LOS TESTS DEL FLUJO AGROINDUSTRIAL PASARON SATISFACTORIAMENTE');
    console.log('========================================================================\n');
}

testFlujoAgroindustrial().catch(err => {
    console.error('❌ ERROR EN TEST:', err);
    process.exit(1);
});
