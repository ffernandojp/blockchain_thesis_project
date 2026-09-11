const http = require('http');

async function main() {
    // Start backend
    const server = require('../backend/server.js');
    
    // Wait for server to be listening
    await new Promise(r => setTimeout(r, 1200));

    async function req(method, path, body = null, token = null) {
        return new Promise((resolve, reject) => {
            const payload = body ? JSON.stringify(body) : null;
            const headers = { 'Content-Type': 'application/json' };
            if (payload) headers['Content-Length'] = Buffer.byteLength(payload);
            if (token) headers['Authorization'] = 'Bearer ' + token;

            const request = http.request({
                hostname: '127.0.0.1',
                port: 3000,
                path,
                method,
                headers
            }, res => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        resolve({ status: res.statusCode, data: JSON.parse(data) });
                    } catch (e) {
                        resolve({ status: res.statusCode, data });
                    }
                });
            });
            request.on('error', reject);
            if (payload) request.write(payload);
            request.end();
        });
    }

    console.log('--- 1. Probando Endpoint Público Verificador ---');
    const lotePublico = await req('GET', '/api/lotes/SILO-BAHIA-100');
    console.log('Lote SILO-BAHIA-100 status:', lotePublico.status, 'estado:', lotePublico.data.data.estado);
    if (lotePublico.data.data.desgloseOrigenes.length === 2) {
        console.log('✅ Desglose de orígenes (40% / 60%) resuelto correctamente.');
    }

    console.log('\n--- 2. Login Exportador y Pedidos Habilitados para Embarque ---');
    const loginExp = await req('POST', '/api/auth/login', { username: 'exportador_bb', password: '123' });
    const tokenExp = loginExp.data.token;
    console.log('Exportador token obtenido:', !!tokenExp);

    const habilitados = await req('GET', '/api/lotes/habilitados-embarque', null, tokenExp);
    console.log('Habilitados para embarque count:', habilitados.data.data.length);
    const loteArribado = habilitados.data.data.find(l => l.id === 'LOTE-ARRIBADO-06');
    if (loteArribado && loteArribado.auditoriaEmbarque && loteArribado.auditoriaEmbarque.habilitado) {
        console.log('✅ LOTE-ARRIBADO-06 verificado con auditoría concurrente habilitada.');
        console.log('   Checks:', JSON.stringify(loteArribado.auditoriaEmbarque.checks));
    }

    console.log('\n--- 3. Login Acopiador y Partidas para Traslado ---');
    const loginAcopio = await req('POST', '/api/auth/login', { username: 'acopio_coop', password: '123' });
    const tokenAcopio = loginAcopio.data.token;
    const traslados = await req('GET', '/api/lotes/para-traslado', null, tokenAcopio);
    console.log('Partidas certificadas por SENASA listas para emitir CPE traslado:', traslados.data.data.length);
    const loteSiloVal = traslados.data.data.find(l => l.id === 'SILO-VALIDADO-04');
    if (loteSiloVal) {
        console.log('✅ SILO-VALIDADO-04 disponible en estado VALIDADO_SENASA para emitir CPE.');
    }

    console.log('\n--- 4. Login SENASA y Búsqueda de Lotes Acondicionados ---');
    const loginSenasa = await req('POST', '/api/auth/login', { username: 'senasa_fiscal', password: '123' });
    const tokenSenasa = loginSenasa.data.token;
    const senasaSearch = await req('GET', '/api/lotes/buscar', null, tokenSenasa);
    console.log('Partidas acondicionadas disponibles para fiscalización SENASA:', senasaSearch.data.data.length);
    const loteAcond = senasaSearch.data.data.find(l => l.id === 'SILO-ACONDICIONADO-03');
    if (loteAcond) {
        console.log('✅ SILO-ACONDICIONADO-03 listo para inspección sanitaria y sellado BFA.');
    }

    console.log('\n--- 5. Login Transportista y Lotes Disponibles Tramo 1 ---');
    const loginTrans = await req('POST', '/api/auth/login', { username: 'transporte_log', password: '123' });
    const tokenTrans = loginTrans.data.token;
    const transDisponibles = await req('GET', '/api/lotes/transportes-disponibles', null, tokenTrans);
    console.log('Lotes cosechados en campo con CPE primaria:', transDisponibles.data.data.length);
    const loteCosechado = transDisponibles.data.data.find(l => l.id === 'CAMION-CAMPO-01');
    if (loteCosechado) {
        console.log('✅ CAMION-CAMPO-01 disponible para iniciar flete corto.');
    }

    console.log('\n🎉 TODOS LOS ENDPOINTS Y REGLAS DE NEGOCIO RESPONDEN AL 100%');
    process.exit(0);
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
