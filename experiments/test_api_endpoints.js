const http = require('http');
const assert = require('assert');
const fabricLedger = require('../blockchain-private-mock/fabricMockLedger');

// Reset state
fabricLedger.limpiar();

// Register harvest lots
fabricLedger.registrarCosechaPrimaria('LOTE-API-1', '01.002.0.00111/00', 'Lat: -34.6037, Lon: -58.3816', 40.0, 'cid-api-1');
fabricLedger.registrarCosechaPrimaria('LOTE-API-2', '02.003.0.00222/00', 'Lat: -33.8912, Lon: -60.5421', 60.0, 'cid-api-2');
fabricLedger.procesarAcopioYMezcla('LOTE-MEZCLA-API', ['LOTE-API-1', 'LOTE-API-2']);

// Test obtaining complete traceability
const data = fabricLedger.obtenerTrazabilidadCompleta('LOTE-MEZCLA-API');
assert.strictEqual(data.id, 'LOTE-MEZCLA-API');
assert.strictEqual(data.volumenToneladas, 100);
assert.strictEqual(data.desgloseOrigenes.length, 2);
assert.strictEqual(data.desgloseOrigenes[0].porcentajeAporte, 40);
assert.strictEqual(data.desgloseOrigenes[1].porcentajeAporte, 60);

console.log('✅ Verificación de integración del mock ledger con la estructura API completada con éxito.');
