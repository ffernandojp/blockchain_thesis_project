const axios = require('axios');
const FormData = require('form-data');
const PDFDocument = require('pdfkit');
const assert = require('assert');
const crypto = require('crypto');

const BASE_URL = 'http://localhost:3000';

function generarPdfCartaPorte(idLote) {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument();
        const buffers = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', reject);

        doc.text('CARTA DE PORTE ELECTRÓNICA');
        doc.text('CÓDIGO DE TRAZABILIDAD DE GRANOS (CTG): 123456789012');
        doc.text(`Identificador de Lote: ${idLote}`);
        doc.text(`Fecha y Hora: ${new Date().toISOString()}`);
        doc.info['Padding'] = 'A'.repeat(50000);
        doc.end();
    });
}

function calcularHashDeterminista(renspa, pdfBuffer) {
    const fileHashHex = crypto.createHash('sha256').update(pdfBuffer).digest('hex');
    const dataToHash = `${renspa}${fileHashHex}`;
    const hashHex = crypto.createHash('sha256').update(dataToHash).digest('hex');
    return '0x' + hashHex.substring(0, 16);
}

async function runTests() {
    console.log('================================================================');
    console.log('🧪 VERIFICACIÓN DEL PATRÓN DE DISEÑO PARA REGISTRO DEL LOTE');
    console.log('   (Caso 1: Mono-establecimiento vs Caso 2: Multi-establecimiento)');
    console.log('================================================================\n');

    // -------------------------------------------------------------
    // 1. CASO 1: Productor Mono-establecimiento (productor1)
    // -------------------------------------------------------------
    console.log('▶ TEST 1: Autenticación Productor Mono-establecimiento (productor1)...');
    const resLogin1 = await axios.post(`${BASE_URL}/api/auth/login`, {
        username: 'productor1',
        password: '123'
    });
    assert.strictEqual(resLogin1.status, 200);
    assert.strictEqual(resLogin1.data.success, true);
    assert.strictEqual(resLogin1.data.rol, 'Productor Agrícola');
    assert.strictEqual(resLogin1.data.cuit, '20-30123456-4');
    assert.strictEqual(resLogin1.data.renspa, '01.002.0.00345/00');
    assert.strictEqual(Array.isArray(resLogin1.data.campos), true);
    assert.strictEqual(resLogin1.data.campos.length, 1);
    assert.strictEqual(resLogin1.data.campos[0].renspa, '01.002.0.00345/00');
    console.log('   ✅ Payload verificado: CUIT 20-30123456-4, 1 establecimiento fijo:', resLogin1.data.campos[0].alias);

    const token1 = resLogin1.data.token;

    console.log('\n▶ TEST 2: Registro exitoso de lote para Mono-establecimiento...');
    const pdfBuf1 = await generarPdfCartaPorte('TEST-MONO-1');
    const expectedHash1 = calcularHashDeterminista('01.002.0.00345/00', pdfBuf1);
    
    const form1 = new FormData();
    form1.append('idLote', expectedHash1);
    form1.append('renspa', '01.002.0.00345/00');
    form1.append('geolocalizacion', 'Lat: -34.6037, Lon: -58.3816');
    form1.append('volumenToneladas', '30');
    form1.append('documento', pdfBuf1, { filename: 'cpe_mono.pdf', contentType: 'application/pdf' });

    const resReg1 = await axios.post(`${BASE_URL}/api/lotes/registrar`, form1, {
        headers: {
            ...form1.getHeaders(),
            'Authorization': `Bearer ${token1}`
        }
    });
    assert.strictEqual(resReg1.status, 201);
    assert.strictEqual(resReg1.data.success, true);
    assert.strictEqual(resReg1.data.data.renspa, '01.002.0.00345/00');
    console.log(`   ✅ Lote registrado con éxito: ${expectedHash1} (RENSPA: ${resReg1.data.data.renspa})`);

    console.log('\n▶ TEST 3: Rechazo RBAC (403) si Mono-establecimiento envía RENSPA no asignado...');
    const pdfBuf1Invalid = await generarPdfCartaPorte('TEST-MONO-INVALID');
    const form1Invalid = new FormData();
    form1Invalid.append('idLote', '0x1111222233334444');
    form1Invalid.append('renspa', '99.999.9.99999/99'); // RENSPA ajeno
    form1Invalid.append('geolocalizacion', 'Lat: -34.6037, Lon: -58.3816');
    form1Invalid.append('volumenToneladas', '30');
    form1Invalid.append('documento', pdfBuf1Invalid, { filename: 'cpe_invalid.pdf', contentType: 'application/pdf' });

    try {
        await axios.post(`${BASE_URL}/api/lotes/registrar`, form1Invalid, {
            headers: {
                ...form1Invalid.getHeaders(),
                'Authorization': `Bearer ${token1}`
            }
        });
        assert.fail('Debió ser rechazado con 403 Forbidden');
    } catch (err) {
        assert.strictEqual(err.response.status, 403);
        assert.ok(err.response.data.error.includes('Acceso denegado'));
        console.log('   ✅ Rechazo RBAC confirmado:', err.response.data.error);
    }

    // -------------------------------------------------------------
    // 2. CASO 2: Productor Multi-establecimiento (productor2)
    // -------------------------------------------------------------
    console.log('\n▶ TEST 4: Autenticación Productor Multi-establecimiento (productor2)...');
    const resLogin2 = await axios.post(`${BASE_URL}/api/auth/login`, {
        username: 'productor2',
        password: '123'
    });
    assert.strictEqual(resLogin2.status, 200);
    assert.strictEqual(resLogin2.data.success, true);
    assert.strictEqual(resLogin2.data.rol, 'Productor Agrícola');
    assert.strictEqual(resLogin2.data.cuit, '20-40987654-2');
    assert.strictEqual(Array.isArray(resLogin2.data.campos), true);
    assert.strictEqual(resLogin2.data.campos.length, 2);
    assert.strictEqual(resLogin2.data.campos[0].renspa, '01.002.0.00034/00');
    assert.strictEqual(resLogin2.data.campos[1].renspa, '01.002.0.00034/01');
    console.log('   ✅ Payload verificado: CUIT 20-40987654-2 con 2 campos habilitados:');
    resLogin2.data.campos.forEach(c => console.log(`      - [${c.alias}] RENSPA: ${c.renspa}`));

    const token2 = resLogin2.data.token;

    console.log('\n▶ TEST 5: Registro exitoso seleccionando Campo A (01.002.0.00034/00)...');
    const pdfBuf2A = await generarPdfCartaPorte('TEST-MULTI-CAMPO-A');
    const expectedHash2A = calcularHashDeterminista('01.002.0.00034/00', pdfBuf2A);
    const form2A = new FormData();
    form2A.append('idLote', expectedHash2A);
    form2A.append('renspa', '01.002.0.00034/00');
    form2A.append('geolocalizacion', 'Lat: -34.5800, Lon: -60.4600');
    form2A.append('volumenToneladas', '45');
    form2A.append('documento', pdfBuf2A, { filename: 'cpe_campo_a.pdf', contentType: 'application/pdf' });

    const resReg2A = await axios.post(`${BASE_URL}/api/lotes/registrar`, form2A, {
        headers: {
            ...form2A.getHeaders(),
            'Authorization': `Bearer ${token2}`
        }
    });
    assert.strictEqual(resReg2A.status, 201);
    assert.strictEqual(resReg2A.data.data.renspa, '01.002.0.00034/00');
    console.log(`   ✅ Lote registrado con éxito para Campo A: ${expectedHash2A}`);

    console.log('\n▶ TEST 6: Registro exitoso seleccionando Campo B (01.002.0.00034/01)...');
    const pdfBuf2B = await generarPdfCartaPorte('TEST-MULTI-CAMPO-B');
    const expectedHash2B = calcularHashDeterminista('01.002.0.00034/01', pdfBuf2B);
    const form2B = new FormData();
    form2B.append('idLote', expectedHash2B);
    form2B.append('renspa', '01.002.0.00034/01');
    form2B.append('geolocalizacion', 'Lat: -33.8900, Lon: -60.5700');
    form2B.append('volumenToneladas', '55');
    form2B.append('documento', pdfBuf2B, { filename: 'cpe_campo_b.pdf', contentType: 'application/pdf' });

    const resReg2B = await axios.post(`${BASE_URL}/api/lotes/registrar`, form2B, {
        headers: {
            ...form2B.getHeaders(),
            'Authorization': `Bearer ${token2}`
        }
    });
    assert.strictEqual(resReg2B.status, 201);
    assert.strictEqual(resReg2B.data.data.renspa, '01.002.0.00034/01');
    console.log(`   ✅ Lote registrado con éxito para Campo B: ${expectedHash2B}`);

    console.log('\n▶ TEST 7: Rechazo RBAC (403) si Multi-establecimiento envía un RENSPA no asignado a su CUIT...');
    const pdfBuf2Inv = await generarPdfCartaPorte('TEST-MULTI-UNAUTH');
    const form2Inv = new FormData();
    form2Inv.append('idLote', '0x9999888877776666');
    form2Inv.append('renspa', '02.003.0.00789/00'); // RENSPA que no le pertenece a productor2
    form2Inv.append('geolocalizacion', 'Lat: -34.0000, Lon: -60.0000');
    form2Inv.append('volumenToneladas', '40');
    form2Inv.append('documento', pdfBuf2Inv, { filename: 'cpe_unauth.pdf', contentType: 'application/pdf' });

    try {
        await axios.post(`${BASE_URL}/api/lotes/registrar`, form2Inv, {
            headers: {
                ...form2Inv.getHeaders(),
                'Authorization': `Bearer ${token2}`
            }
        });
        assert.fail('Debió ser rechazado con 403 Forbidden');
    } catch (err) {
        assert.strictEqual(err.response.status, 403);
        assert.ok(err.response.data.error.includes('Acceso denegado'));
        console.log('   ✅ Rechazo RBAC confirmado:', err.response.data.error);
    }

    console.log('\n▶ TEST 8: Consulta de Mis Lotes para productor2 (abarca ambos campos habilitados)...');
    const resMisLotes = await axios.get(`${BASE_URL}/api/lotes/mis-lotes`, {
        headers: { 'Authorization': `Bearer ${token2}` }
    });
    assert.strictEqual(resMisLotes.status, 200);
    const lotes = resMisLotes.data.data;
    const tieneCampoA = lotes.some(l => l.renspa === '01.002.0.00034/00');
    const tieneCampoB = lotes.some(l => l.renspa === '01.002.0.00034/01');
    assert.strictEqual(tieneCampoA, true);
    assert.strictEqual(tieneCampoB, true);
    console.log(`   ✅ Retornó ${lotes.length} lotes asociados a los campos del CUIT de productor2.`);

    console.log('\n================================================================');
    console.log('🎉 TODAS LAS PRUEBAS DEL PATRÓN DE DISEÑO PASARON EXITOSAMENTE!');
    console.log('================================================================');
}

runTests().catch(err => {
    console.error('❌ Error en las pruebas:', err);
    process.exit(1);
});
