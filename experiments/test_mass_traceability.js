/**
 * Test de Verificación: Trazabilidad de Masa y Backtracking Recursivo
 * Conforme a la Sección 6.2.5 de la Tesina: "Cálculo Dinámico de Proporciones en la Búsqueda Recursiva Inversa"
 */

const assert = require('assert');
const fabricLedger = require('../blockchain-private-mock/fabricMockLedger');

console.log('🧪 Iniciando pruebas de Trazabilidad de Masa y Backtracking Recursivo...\n');

// Limpiar estado
fabricLedger.limpiar();

// --- TEST 1: Registro de Cosechas Primarias ---
console.log('Test 1: Registro de cosechas primarias independientes');
const loteA = fabricLedger.registrarCosechaPrimaria(
    'LOTE-AGRO-001',
    '01.002.0.00345/00',
    'Lat: -34.6037, Lon: -58.3816',
    40.0,
    'bafybeicarta001aaa'
);
assert.strictEqual(loteA.id, 'LOTE-AGRO-001');
assert.strictEqual(loteA.volumenToneladas, 40.0);
assert.strictEqual(loteA.estado, 'COSECHADO');

const loteB = fabricLedger.registrarCosechaPrimaria(
    'LOTE-AGRO-002',
    '02.003.0.00789/00',
    'Lat: -33.8912, Lon: -60.5421',
    60.0,
    'bafybeicarta002bbb'
);
assert.strictEqual(loteB.id, 'LOTE-AGRO-002');
assert.strictEqual(loteB.volumenToneladas, 60.0);
assert.strictEqual(loteB.estado, 'COSECHADO');
console.log('✅ Test 1 Superado: Lotes primarios registrados correctamente.\n');

// --- TEST 2: Preservación Inmutable en Fusión/Mezcla de Silos ---
console.log('Test 2: Preservación inmutable y creación de lote hijo consolidado');
// Recepción y pesaje previo obligatorio en balanza (ACONDICIONADO)
fabricLedger.actualizarEstadoLogistico('LOTE-AGRO-001', 'ACONDICIONADO', 'Acopiador', 'Pesaje: 40TN.');
fabricLedger.actualizarEstadoLogistico('LOTE-AGRO-002', 'ACONDICIONADO', 'Acopiador', 'Pesaje: 60TN.');

const loteMezcla100 = fabricLedger.procesarAcopioYMezcla(
    'SILO-BAHIA-100',
    ['LOTE-AGRO-001', 'LOTE-AGRO-002']
);

// Validar que los lotes precursores NO se eliminaron y mantienen sus metadatos
const precursorA = fabricLedger.obtenerLote('LOTE-AGRO-001');
const precursorB = fabricLedger.obtenerLote('LOTE-AGRO-002');

assert(precursorA !== undefined, 'Lote A no debe ser eliminado');
assert(precursorB !== undefined, 'Lote B no debe ser eliminado');
assert.strictEqual(precursorA.estado, 'MEZCLADO_ACONDICIONADO', 'Lote A debe estar en MEZCLADO_ACONDICIONADO');
assert.strictEqual(precursorB.estado, 'MEZCLADO_ACONDICIONADO', 'Lote B debe estar en MEZCLADO_ACONDICIONADO');
assert.strictEqual(precursorA.volumenToneladas, 40.0, 'Volumen de Lote A debe preservarse inmutable');
assert.strictEqual(precursorB.volumenToneladas, 60.0, 'Volumen de Lote B debe preservarse inmutable');
assert.strictEqual(precursorA.renspa, '01.002.0.00345/00');
assert.strictEqual(precursorB.renspa, '02.003.0.00789/00');
assert.strictEqual(precursorA.ipfsCID, 'bafybeicarta001aaa');
assert.strictEqual(precursorB.ipfsCID, 'bafybeicarta002bbb');

// Validar lote hijo
assert.strictEqual(loteMezcla100.id, 'SILO-BAHIA-100');
assert.strictEqual(loteMezcla100.volumenToneladas, 100.0);
assert.strictEqual(loteMezcla100.estado, 'ACONDICIONADO');
assert.deepStrictEqual(loteMezcla100.lotesOrigen, ['LOTE-AGRO-001', 'LOTE-AGRO-002']);
console.log('✅ Test 2 Superado: Preservación inmutable y lote consolidado validados.\n');

// --- TEST 3: Backtracking Recursivo Inverso y Cálculo de Proporciones (Sección 6.2.5) ---
console.log('Test 3: Backtracking recursivo y cálculo dinámico de proporciones');
const traza100 = fabricLedger.obtenerTrazabilidadCompleta('SILO-BAHIA-100');
assert.strictEqual(traza100.id, 'SILO-BAHIA-100');
assert.strictEqual(traza100.volumenToneladas, 100.0);
assert(Array.isArray(traza100.desgloseOrigenes), 'desgloseOrigenes debe ser un arreglo');
assert.strictEqual(traza100.desgloseOrigenes.length, 2, 'Debe contener exactamente 2 orígenes');

const origenA = traza100.desgloseOrigenes.find(o => o.id === 'LOTE-AGRO-001');
const origenB = traza100.desgloseOrigenes.find(o => o.id === 'LOTE-AGRO-002');

assert(origenA !== undefined, 'Origen A debe estar en el desglose');
assert(origenB !== undefined, 'Origen B debe estar en el desglose');

assert.strictEqual(origenA.volumenAportadoTN, 40.0);
assert.strictEqual(origenA.porcentajeAporte, 40.0, 'El aporte de A debe ser exactamente 40.0%');
assert.strictEqual(origenA.renspa, '01.002.0.00345/00');
assert.strictEqual(origenA.ipfsCID, 'bafybeicarta001aaa');
assert.strictEqual(typeof origenA.geolocalizacion, 'object');

assert.strictEqual(origenB.volumenAportadoTN, 60.0);
assert.strictEqual(origenB.porcentajeAporte, 60.0, 'El aporte de B debe ser exactamente 60.0%');
assert.strictEqual(origenB.renspa, '02.003.0.00789/00');
assert.strictEqual(origenB.ipfsCID, 'bafybeicarta002bbb');

assert.strictEqual(origenA.porcentajeAporte + origenB.porcentajeAporte, 100.0, 'La sumatoria porcentual debe ser 100%');
console.log('✅ Test 3 Superado: Proporciones 40% / 60% verificadas exactamente.\n');

// --- TEST 4: Árbol Recursivo Multinivel (Mezcla de Mezclas) ---
console.log('Test 4: Backtracking en mezclas anidadas multinivel (árbol genealógico complejo)');
const loteC = fabricLedger.registrarCosechaPrimaria(
    'LOTE-AGRO-003',
    '03.004.0.00999/00',
    'Lat: -32.5000, Lon: -61.2000',
    100.0,
    'bafybeicarta003ccc'
);
fabricLedger.actualizarEstadoLogistico('LOTE-AGRO-003', 'ACONDICIONADO', 'Acopiador', 'Pesaje: 100TN.');

// Consolidar SILO-BAHIA-100 (100 TN) con LOTE-AGRO-003 (100 TN) -> SILO-EXP-200 (200 TN)
const loteMezcla200 = fabricLedger.procesarAcopioYMezcla(
    'SILO-EXP-200',
    ['SILO-BAHIA-100', 'LOTE-AGRO-003']
);
assert.strictEqual(loteMezcla200.volumenToneladas, 200.0);

const traza200 = fabricLedger.obtenerTrazabilidadCompleta('SILO-EXP-200');
assert.strictEqual(traza200.desgloseOrigenes.length, 3, 'El árbol recursivo debe resolver las 3 cosechas primarias');

const resA = traza200.desgloseOrigenes.find(o => o.id === 'LOTE-AGRO-001');
const resB = traza200.desgloseOrigenes.find(o => o.id === 'LOTE-AGRO-002');
const resC = traza200.desgloseOrigenes.find(o => o.id === 'LOTE-AGRO-003');

// Matemáticamente en un lote total de 200 TN:
// A aportó 40 TN -> 40/200 = 20.0%
// B aportó 60 TN -> 60/200 = 30.0%
// C aportó 100 TN -> 100/200 = 50.0%
assert.strictEqual(resA.volumenAportadoTN, 40.0);
assert.strictEqual(resA.porcentajeAporte, 20.0, 'A debe aportar el 20% del lote consolidado de 200 TN');
assert.strictEqual(resB.volumenAportadoTN, 60.0);
assert.strictEqual(resB.porcentajeAporte, 30.0, 'B debe aportar el 30% del lote consolidado de 200 TN');
assert.strictEqual(resC.volumenAportadoTN, 100.0);
assert.strictEqual(resC.porcentajeAporte, 50.0, 'C debe aportar el 50% del lote consolidado de 200 TN');

const sumPorcentajes = resA.porcentajeAporte + resB.porcentajeAporte + resC.porcentajeAporte;
assert.strictEqual(sumPorcentajes, 100.0, 'La sumatoria total debe ser 100%');
console.log('✅ Test 4 Superado: Backtracking multinivel resolvió correctamente 20% / 30% / 50%.\n');

// --- TEST 5: Lote Monovarietal (Sin Mezcla) ---
console.log('Test 5: Consulta de lote monovarietal directo (sin mezcla)');
const loteMono = fabricLedger.registrarCosechaPrimaria(
    'LOTE-MONO-100',
    '05.006.0.00555/00',
    'Lat: -35.1000, Lon: -59.4000',
    85.5,
    'bafybeicarta004ddd'
);
const trazaMono = fabricLedger.obtenerTrazabilidadCompleta('LOTE-MONO-100');
assert.strictEqual(trazaMono.desgloseOrigenes.length, 1);
assert.strictEqual(trazaMono.desgloseOrigenes[0].id, 'LOTE-MONO-100');
assert.strictEqual(trazaMono.desgloseOrigenes[0].porcentajeAporte, 100.0);
assert.strictEqual(trazaMono.desgloseOrigenes[0].volumenAportadoTN, 85.5);
console.log('✅ Test 5 Superado: Lote monovarietal resuelve 100% de participación directa.\n');

console.log('🎉 TODOS LOS TESTS DE TRAZABILIDAD DE MASA (SECCIÓN 6.2.5) HAN PASADO EXITOSAMENTE.');
