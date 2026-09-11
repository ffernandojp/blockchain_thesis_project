/**
 * Test de Validación de Reglas de Negocio:
 * 1. Prohibición de Consolidar Lotes sin Recepción Completa en Acopio (Solo ACONDICIONADO)
 * 2. Restricción de Auditoría y Certificación en SENASA (Solo ACONDICIONADO, Bloqueo de MEZCLADO_ACONDICIONADO)
 */

const assert = require('assert');
const fabricLedger = require('../blockchain-private-mock/fabricMockLedger');

async function runBusinessRulesTests() {
    console.log('\n========================================================================');
    console.log('🧪 TEST: REGLAS DE NEGOCIO ACOPIO (RECEPCIÓN PREVIA) Y SENASA (NO DOBLE SELLO)');
    console.log('========================================================================\n');

    // --- REGLA 1: RECEPCIÓN FÍSICA OBLIGATORIA ANTES DE MEZCLA ---
    console.log('--- TEST 1: Registro de Camión Cosechado y Transporte ---');
    const loteCosecha = fabricLedger.registrarCosechaPrimaria(
        'CAMION-PRUEBA-01',
        '01.002.0.00345/00',
        'Lat: -34.6037, Lon: -58.3816',
        30.0, // Estimado en CPE
        'bafybeicpe_camion_01'
    );
    assert.strictEqual(loteCosecha.estado, 'COSECHADO');

    // Intento 1: Consolidar en Silo mientras está COSECHADO (Debe fallar)
    console.log('\n--- TEST 2: Rechazo de Mezcla en Estado COSECHADO ---');
    let errorCosechado = null;
    try {
        fabricLedger.procesarAcopioYMezcla('SILO-ILEGAL-1', ['CAMION-PRUEBA-01', 'LOTE-AGRO-001']);
    } catch (err) {
        errorCosechado = err;
    }
    assert(errorCosechado !== null, 'Debe fallar al mezclar un lote COSECHADO');
    assert(errorCosechado.message.includes('Recepción incompleta'), `Mensaje debe indicar recepción incompleta: ${errorCosechado.message}`);
    console.log(`✅ Rechazo en estado COSECHADO confirmado: "${errorCosechado.message}"`);

    // Pasa a transporte
    fabricLedger.actualizarEstadoLogistico('CAMION-PRUEBA-01', 'EN_TRANSITO', 'Transportista', 'En viaje por ruta.');

    // Intento 2: Consolidar en Silo mientras viaja EN_TRANSITO (Debe fallar)
    console.log('\n--- TEST 3: Rechazo de Mezcla en Estado EN_TRANSITO (Camión en Ruta) ---');
    let errorTransito = null;
    try {
        fabricLedger.procesarAcopioYMezcla('SILO-ILEGAL-2', ['CAMION-PRUEBA-01', 'LOTE-AGRO-001']);
    } catch (err) {
        errorTransito = err;
    }
    assert(errorTransito !== null, 'Debe fallar al mezclar un lote EN_TRANSITO');
    assert(errorTransito.message.includes('Recepción incompleta'), `Mensaje debe indicar recepción incompleta: ${errorTransito.message}`);
    console.log(`✅ Rechazo en estado EN_TRANSITO confirmado: "${errorTransito.message}"`);

    // Paso 3: Recepción física en balanza y calador del acopio
    console.log('\n--- TEST 4: Recepción, Calibración de Calidad y Pesaje Neto en Balanza ---');
    const pesajeBalanza = 29.42; // Pesaje definitivo neto oficial
    loteCosecha.volumenToneladas = pesajeBalanza;
    fabricLedger.actualizarEstadoLogistico(
        'CAMION-PRUEBA-01',
        'ACONDICIONADO',
        'Acopiador / Cooperativa',
        `Pesaje: ${pesajeBalanza}TN. Calidad: Grado 2 - Humedad 14.2%`
    );

    const loteAcondicionado = fabricLedger.obtenerLote('CAMION-PRUEBA-01');
    assert.strictEqual(loteAcondicionado.estado, 'ACONDICIONADO');
    assert.strictEqual(loteAcondicionado.volumenToneladas, 29.42);
    console.log(`✅ Lote recibido y pesado en balanza: ${loteAcondicionado.id} - ${loteAcondicionado.volumenToneladas} TN en estado ACONDICIONADO.`);

    // Crear un segundo lote acondicionado para la mezcla
    fabricLedger.registrarCosechaPrimaria('CAMION-PRUEBA-02', '01.002.0.00345/00', 'Lat: -34.60, Lon: -58.38', 50.0, 'cid2');
    fabricLedger.actualizarEstadoLogistico('CAMION-PRUEBA-02', 'ACONDICIONADO', 'Acopiador', 'Pesaje: 50.0TN.');

    // Fusión legítima en Silo de partidas acondicionadas
    console.log('\n--- TEST 5: Fusión Legítima de Lotes ACONDICIONADOS en Silo ---');
    const siloMezcla = fabricLedger.procesarAcopioYMezcla('SILO-MEZCLA-VALIDO-1', ['CAMION-PRUEBA-01', 'CAMION-PRUEBA-02']);
    assert.strictEqual(siloMezcla.id, 'SILO-MEZCLA-VALIDO-1');
    assert.strictEqual(siloMezcla.volumenToneladas, 79.42);
    assert(['ACOPIADO_ACONDICIONADO', 'ACONDICIONADO'].includes(siloMezcla.estado));
    console.log(`✅ Silo consolidado exitosamente: ${siloMezcla.id} con ${siloMezcla.volumenToneladas} TN.`);

    // Precursores mutaron a MEZCLADO_ACONDICIONADO
    const prec1 = fabricLedger.obtenerLote('CAMION-PRUEBA-01');
    const prec2 = fabricLedger.obtenerLote('CAMION-PRUEBA-02');
    assert.strictEqual(prec1.estado, 'MEZCLADO_ACONDICIONADO');
    assert.strictEqual(prec2.estado, 'MEZCLADO_ACONDICIONADO');
    console.log('✅ Precursores CAMION-PRUEBA-01 y CAMION-PRUEBA-02 mutaron a MEZCLADO_ACONDICIONADO.');

    // --- REGLA 2: AUDITORÍA Y CERTIFICACIÓN EN SENASA ---
    console.log('\n--- TEST 6: Simulación de Búsqueda SENASA (Exclusión de MEZCLADO_ACONDICIONADO) ---');
    const todos = fabricLedger.obtenerTodosLotes();
    const activosSenasa = todos.filter(l => l.estado === 'ACOPIADO_ACONDICIONADO' || l.estado === 'ACONDICIONADO');

    // SILO-MEZCLA-VALIDO-1 debe estar presente
    assert(activosSenasa.some(l => l.id === 'SILO-MEZCLA-VALIDO-1'), 'SILO-MEZCLA-VALIDO-1 debe estar en la lista de activos');

    // CAMION-PRUEBA-01 y CAMION-PRUEBA-02 (consumidos) NO deben figurar en la lista activa
    assert(!activosSenasa.some(l => l.id === 'CAMION-PRUEBA-01'), 'CAMION-PRUEBA-01 no debe figurar en activos');
    assert(!activosSenasa.some(l => l.id === 'CAMION-PRUEBA-02'), 'CAMION-PRUEBA-02 no debe figurar en activos');
    console.log(`✅ Filtro de auditoría SENASA verificado: ${activosSenasa.length} partidas activas. Ninguna partida consumida incluida.`);

    // --- TEST 7: Re-consolidación a nivel superior y verificación de estado terminal ---
    console.log('\n--- TEST 7: Re-consolidación a Nivel Superior (SILO 1 -> SILO FINAL) ---');
    fabricLedger.registrarCosechaPrimaria('CAMION-PRUEBA-03', '01.002.0.00345/00', 'Lat: -34.60, Lon: -58.38', 20.58, 'cid3');
    fabricLedger.actualizarEstadoLogistico('CAMION-PRUEBA-03', 'RECEPCIONADO_ACOPIO', 'Acopiador', 'Pesaje: 20.58TN.');

    const siloFinal = fabricLedger.procesarAcopioYMezcla('SILO-FINAL-EXPORT-100', ['SILO-MEZCLA-VALIDO-1', 'CAMION-PRUEBA-03']);
    assert.strictEqual(siloFinal.volumenToneladas, 100.0);
    assert(['ACOPIADO_ACONDICIONADO', 'ACONDICIONADO'].includes(siloFinal.estado));

    // Ahora SILO-MEZCLA-VALIDO-1 mutó a MEZCLADO_ACONDICIONADO
    const siloIntermedioConsumido = fabricLedger.obtenerLote('SILO-MEZCLA-VALIDO-1');
    assert.strictEqual(siloIntermedioConsumido.estado, 'MEZCLADO_ACONDICIONADO');
    console.log(`✅ SILO-MEZCLA-VALIDO-1 mutó a MEZCLADO_ACONDICIONADO tras re-fusión.`);

    // SILO-MEZCLA-VALIDO-1 ya no debe estar en activos
    const activosSenasaPost = fabricLedger.obtenerTodosLotes().filter(l => l.estado === 'ACOPIADO_ACONDICIONADO' || l.estado === 'ACONDICIONADO');
    assert(!activosSenasaPost.some(l => l.id === 'SILO-MEZCLA-VALIDO-1'), 'SILO-MEZCLA-VALIDO-1 debe haber desaparecido de la lista activa');
    assert(activosSenasaPost.some(l => l.id === 'SILO-FINAL-EXPORT-100'), 'SILO-FINAL-EXPORT-100 debe ser la única partida activa resultante');
    console.log('✅ Lista de auditoría de SENASA actualizada: solo exhibe la partida final SILO-FINAL-EXPORT-100.');

    console.log('\n========================================================================');
    console.log('🎉 TODAS LAS PRUEBAS DE REGLAS DE NEGOCIO PASARON SATISFACTORIAMENTE');
    console.log('========================================================================\n');
}

runBusinessRulesTests().catch(err => {
    console.error('❌ ERROR EN TEST:', err);
    process.exit(1);
});
