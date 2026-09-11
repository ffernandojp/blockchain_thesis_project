/**
 * Test de Aceptación y Validación Rigurosa:
 * Consolidación Multinivel, Consumo de Estados (No Doble Gasto),
 * Invariante de Conservación de Masa y Árbol Genealógico de 3 Niveles.
 * 
 * Basado en las Especificaciones de la Tesina (Sección 6.2.5).
 */

const assert = require('assert');
const fabricLedger = require('../blockchain-private-mock/fabricMockLedger');

async function runMultilevelConsolidationTests() {
    console.log('\n========================================================================');
    console.log('🧪 TEST: CONSOLIDACIÓN MULTINIVEL, NO DOBLE GASTO Y ÁRBOL GENEALÓGICO');
    console.log('========================================================================\n');

    // 1. Crear cosechas primarias
    console.log('--- PASO 1: Registrar Cosechas Primarias (Nivel 3) ---');
    const loteA = fabricLedger.registrarCosechaPrimaria(
        'TEST-LOTE-A',
        '10.001.0.00111/00',
        'Lat: -34.1234, Lon: -58.4321',
        40.0,
        'bafybeicpe_test_lote_a'
    );
    const loteB = fabricLedger.registrarCosechaPrimaria(
        'TEST-LOTE-B',
        '10.002.0.00222/00',
        'Lat: -34.5678, Lon: -58.8765',
        60.0,
        'bafybeicpe_test_lote_b'
    );
    const loteC = fabricLedger.registrarCosechaPrimaria(
        'TEST-LOTE-C',
        '10.003.0.00333/00',
        'Lat: -33.9999, Lon: -60.1111',
        100.0,
        'bafybeicpe_test_lote_c'
    );

    assert.strictEqual(loteA.volumenToneladas, 40.0);
    assert.strictEqual(loteB.volumenToneladas, 60.0);
    assert.strictEqual(loteC.volumenToneladas, 100.0);
    console.log('✅ Cosechas primarias creadas: A (40 TN), B (60 TN), C (100 TN).');

    // 1.b Test de Regla de Negocio: Rechazo de Mezcla sin Recepción Completa (COSECHADO / EN_TRANSITO)
    console.log('\n--- PASO 1b: Rechazo de Mezcla sin Recepción Completa ---');
    let errorRecepcionPrevia = null;
    try {
        fabricLedger.procesarAcopioYMezcla('SILO-PREMATURO', ['TEST-LOTE-A', 'TEST-LOTE-B']);
    } catch (err) {
        errorRecepcionPrevia = err;
    }
    assert(errorRecepcionPrevia !== null, 'Debe fallar si los lotes precursores no están acondicionados');
    assert(errorRecepcionPrevia.message.includes('Recepción incompleta'), `Mensaje debe indicar recepción incompleta: ${errorRecepcionPrevia.message}`);
    console.log(`✅ Rechazo de lote sin acondicionar confirmado: "${errorRecepcionPrevia.message}"`);

    // Acondicionamiento reglamentario en balanza y calador
    fabricLedger.actualizarEstadoLogistico('TEST-LOTE-A', 'ACONDICIONADO', 'Acopiador', 'Pesaje: 40TN.');
    fabricLedger.actualizarEstadoLogistico('TEST-LOTE-B', 'ACONDICIONADO', 'Acopiador', 'Pesaje: 60TN.');

    // 2. Consolidación de Nivel Intermedio (Lote A + Lote B -> Silo Intermedio)
    console.log('\n--- PASO 2: Consolidación Intermedia (Lote A + B -> SILO-INTERMEDIO-1) ---');
    const siloIntermedio = fabricLedger.procesarAcopioYMezcla('SILO-INTERMEDIO-1', ['TEST-LOTE-A', 'TEST-LOTE-B']);

    assert.strictEqual(siloIntermedio.id, 'SILO-INTERMEDIO-1');
    assert.strictEqual(siloIntermedio.volumenToneladas, 100.0);
    assert.strictEqual(siloIntermedio.estado, 'ACONDICIONADO');
    console.log(`✅ Consolidación intermedia exitosa: ${siloIntermedio.id} con ${siloIntermedio.volumenToneladas} TN.`);

    // 3. Verificación de Mutación de Estados Terminales en Precursores
    console.log('\n--- PASO 3: Verificación de Mutación de Precursores a Estado Terminal ---');
    const loteAPostMezcla = fabricLedger.obtenerLote('TEST-LOTE-A');
    const loteBPostMezcla = fabricLedger.obtenerLote('TEST-LOTE-B');

    assert.strictEqual(loteAPostMezcla.estado, 'MEZCLADO_ACONDICIONADO', 'Lote A debe estar en MEZCLADO_ACONDICIONADO');
    assert.strictEqual(loteBPostMezcla.estado, 'MEZCLADO_ACONDICIONADO', 'Lote B debe estar en MEZCLADO_ACONDICIONADO');
    console.log('✅ Precursores A y B mutaron atómicamente a MEZCLADO_ACONDICIONADO.');

    // 4. Intento de Doble Gasto (Re-usar Lote A)
    console.log('\n--- PASO 4: Test de Regla de Seguridad (No Doble Gasto sobre Lote A) ---');
    let errorDobleGastoLoteA = null;
    try {
        fabricLedger.procesarAcopioYMezcla('SILO-ILEGAL-FRAUDE', ['TEST-LOTE-A', 'TEST-LOTE-C']);
    } catch (err) {
        errorDobleGastoLoteA = err;
    }

    assert(errorDobleGastoLoteA !== null, 'Debe arrojar error al intentar reutilizar lote en estado terminal');
    assert(errorDobleGastoLoteA.message.includes('Consumo de Estados (No Doble Gasto)') || errorDobleGastoLoteA.message.includes('MEZCLADO_ACONDICIONADO'),
        `Mensaje de error debe indicar violación de no doble gasto. Mensaje obtenido: ${errorDobleGastoLoteA.message}`);
    console.log(`✅ Intento de Doble Gasto bloqueado correctamente con mensaje: "${errorDobleGastoLoteA.message}"`);

    // Acondicionar Lote C para permitir su consolidación superior
    fabricLedger.actualizarEstadoLogistico('TEST-LOTE-C', 'ACONDICIONADO', 'Acopiador', 'Pesaje: 100TN.');

    // 5. Consolidación de Nivel Superior (Silo Intermedio + Lote C -> Silo Buque Final)
    console.log('\n--- PASO 5: Consolidación Multinivel (SILO-INTERMEDIO-1 + Lote C -> LOTE-BUQUE-FINAL) ---');
    const loteBuqueFinal = fabricLedger.procesarAcopioYMezcla('LOTE-BUQUE-FINAL', ['SILO-INTERMEDIO-1', 'TEST-LOTE-C']);

    assert.strictEqual(loteBuqueFinal.id, 'LOTE-BUQUE-FINAL');
    // Invariante de conservación de masa: 100 TN (Silo Intermedio) + 100 TN (Lote C) = 200 TN
    assert.strictEqual(loteBuqueFinal.volumenToneladas, 200.0, 'Invariante de masa: Volumen debe ser exactamente 200 TN');
    console.log(`✅ Consolidación multinivel exitosa: ${loteBuqueFinal.id} con volumen ${loteBuqueFinal.volumenToneladas} TN.`);

    // 6. Verificación de Mutación de Silo Intermedio a Estado Terminal
    console.log('\n--- PASO 6: Verificación de Mutación de Silo Intermedio a Estado Terminal ---');
    const siloIntermedioPost = fabricLedger.obtenerLote('SILO-INTERMEDIO-1');
    assert.strictEqual(siloIntermedioPost.estado, 'MEZCLADO_ACONDICIONADO', 'Silo intermedio debe mutar a MEZCLADO_ACONDICIONADO tras fusionarse');
    console.log(`✅ SILO-INTERMEDIO-1 mutó a estado terminal: ${siloIntermedioPost.estado}`);

    // 7. Intento de Doble Gasto sobre Silo Intermedio
    console.log('\n--- PASO 7: Test de No Doble Gasto sobre Silo Intermedio Ya Consolidado ---');
    let errorDobleGastoSilo = null;
    try {
        fabricLedger.procesarAcopioYMezcla('SILO-OTRO-BUQUE-FRAUDE', ['SILO-INTERMEDIO-1']);
    } catch (err) {
        errorDobleGastoSilo = err;
    }

    assert(errorDobleGastoSilo !== null, 'Debe fallar al intentar reutilizar un silo intermedio ya consumido');
    assert(errorDobleGastoSilo.message.includes('Consumo de Estados (No Doble Gasto)'),
        `Debe arrojar violación de no doble gasto. Mensaje: ${errorDobleGastoSilo.message}`);
    console.log(`✅ Reutilización de SILO-INTERMEDIO-1 bloqueada: "${errorDobleGastoSilo.message}"`);

    // 8. Backtracking y Árbol Genealógico de 3 Niveles
    console.log('\n--- PASO 8: Backtracking Recursivo y Verificación del Árbol de 3 Niveles ---');
    const traza = fabricLedger.obtenerTrazabilidadCompleta('LOTE-BUQUE-FINAL');
    assert(traza !== null, 'La traza no debe ser nula');
    assert(traza.arbolGenealogico !== undefined, 'Debe contener el objeto arbolGenealogico');

    const arbol = traza.arbolGenealogico;
    console.log(`Es Consolidado Multinivel: ${arbol.esConsolidadoMultinivel}`);

    // Nivel 1: Lote Buque Final (200 TN)
    assert.strictEqual(arbol.nivel1.id, 'LOTE-BUQUE-FINAL');
    assert.strictEqual(arbol.nivel1.volumenTotal, 200.0);
    console.log(`✅ Nivel 1 (Exportación): ${arbol.nivel1.id} - ${arbol.nivel1.volumenTotal} TN`);

    // Nivel 2: Nodos Intermedios de Acopio (SILO-INTERMEDIO-1)
    assert(Array.isArray(arbol.nivel2), 'Nivel 2 debe ser un arreglo de nodos intermedios');
    assert.strictEqual(arbol.nivel2.length, 1, 'Debe haber exactamente 1 silo intermedio');
    assert.strictEqual(arbol.nivel2[0].id, 'SILO-INTERMEDIO-1');
    assert.strictEqual(arbol.nivel2[0].volumenToneladas, 100.0);
    console.log(`✅ Nivel 2 (Nodos Intermedios): Silo ${arbol.nivel2[0].id} - ${arbol.nivel2[0].volumenToneladas} TN`);

    // Nivel 3: Raíz / Cosechas Primarias (Lote A, Lote B, Lote C)
    assert(Array.isArray(arbol.nivel3), 'Nivel 3 debe ser un arreglo con las hojas primarias');
    assert.strictEqual(arbol.nivel3.length, 3, 'Debe contener las 3 cosechas primarias originales');

    const leafA = arbol.nivel3.find(h => h.id === 'TEST-LOTE-A');
    const leafB = arbol.nivel3.find(h => h.id === 'TEST-LOTE-B');
    const leafC = arbol.nivel3.find(h => h.id === 'TEST-LOTE-C');

    assert(leafA, 'Lote A debe estar en el Nivel 3');
    assert(leafB, 'Lote B debe estar en el Nivel 3');
    assert(leafC, 'Lote C debe estar en el Nivel 3');

    // Comprobación de Proporciones Matemáticas:
    // Lote A aportó 40 TN a Silo Intermedio (100 TN). Fracción = 40/100 = 0.4.
    // Silo Intermedio aportó 100 TN a Buque Final (200 TN). Fracción = 100/200 = 0.5.
    // Fracción total Lote A en Buque Final = 0.4 * 0.5 = 0.20 (20.0%, 40 TN).
    assert.strictEqual(leafA.volumenAportadoTN, 40.0);
    assert.strictEqual(leafA.porcentajeAporte, 20.0);

    // Lote B aportó 60 TN a Silo Intermedio (100 TN). Fracción = 60/100 = 0.6.
    // Fracción total Lote B en Buque Final = 0.6 * 0.5 = 0.30 (30.0%, 60 TN).
    assert.strictEqual(leafB.volumenAportadoTN, 60.0);
    assert.strictEqual(leafB.porcentajeAporte, 30.0);

    // Lote C aportó 100 TN directo a Buque Final (200 TN). Fracción = 100/200 = 0.50 (50.0%, 100 TN).
    assert.strictEqual(leafC.volumenAportadoTN, 100.0);
    assert.strictEqual(leafC.porcentajeAporte, 50.0);

    // Suma de porcentajes debe ser exactamente 100%
    const sumaPorcentajes = leafA.porcentajeAporte + leafB.porcentajeAporte + leafC.porcentajeAporte;
    assert.strictEqual(sumaPorcentajes, 100.0, 'La suma de aportes ponderados debe ser 100%');

    // Suma de volumen debe ser exactamente 200 TN
    const sumaVolumenes = leafA.volumenAportadoTN + leafB.volumenAportadoTN + leafC.volumenAportadoTN;
    assert.strictEqual(sumaVolumenes, 200.0, 'La suma de volúmenes de las hojas primarias debe ser igual al volumen del lote final');

    console.log(`✅ Nivel 3 (Raíz):`);
    console.log(`   - Lote A: ${leafA.volumenAportadoTN} TN (${leafA.porcentajeAporte}%) - RENSPA: ${leafA.renspa} - Camino: ${leafA.caminoGenealogico.join(' -> ')}`);
    console.log(`   - Lote B: ${leafB.volumenAportadoTN} TN (${leafB.porcentajeAporte}%) - RENSPA: ${leafB.renspa} - Camino: ${leafB.caminoGenealogico.join(' -> ')}`);
    console.log(`   - Lote C: ${leafC.volumenAportadoTN} TN (${leafC.porcentajeAporte}%) - RENSPA: ${leafC.renspa} - Camino: ${leafC.caminoGenealogico.join(' -> ')}`);
    console.log(`   - Invariante de Masa: Suma TN = ${sumaVolumenes} TN == Volumen Buque (${arbol.nivel1.volumenTotal} TN).`);
    console.log(`   - Invariante Porcentual: Suma % = ${sumaPorcentajes}%.`);

    console.log('\n========================================================================');
    console.log('🎉 TODOS LOS TESTS DE CONSOLIDACIÓN MULTINIVEL PASARON SATISFACTORIAMENTE');
    console.log('========================================================================\n');
}

runMultilevelConsolidationTests().catch(err => {
    console.error('❌ ERROR EN TEST:', err);
    process.exit(1);
});
