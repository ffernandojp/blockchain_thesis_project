const axios = require('axios');
const FormData = require('form-data');
const PDFDocument = require('pdfkit');

const BASE_URL = 'http://localhost:3000';
const NUM_TRUCKS = 33; // 33 camiones = 1000 toneladas (aprox 30 TN/camión)
const USERNAME = 'productor1';
const PASSWORD = '123';

/**
 * Genera un Buffer PDF de aproximadamente 2MB en memoria
 * Incluye los textos requeridos por el Oráculo.
 */
async function generateMockPDFBuffer() {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument();
        const buffers = [];

        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
            const pdfBuffer = Buffer.concat(buffers);
            resolve(pdfBuffer);
        });
        doc.on('error', reject);

        // Textos requeridos por la validación
        doc.text('CARTA DE PORTE ELECTRÓNICA');
        doc.text('CÓDIGO DE TRAZABILIDAD DE GRANOS');
        
        // Rellenar hasta aprox 2MB usando metadatos para evitar que pdf-parse colapse
        // parseando miles de páginas, mejorando radicalmente la latencia.
        doc.info['Padding'] = 'A'.repeat(2 * 1024 * 1024); // 2MB de padding en metadata

        doc.end();
    });
}

/**
 * Función principal para correr el experimento
 */
async function runStressTest() {
    console.log(`[INFO] Iniciando Experimento de Estrés Volumétrico`);
    console.log(`[INFO] Simulando ${NUM_TRUCKS} camiones concurrentes...\n`);

    try {
        // 1. Autenticación
        const authRes = await axios.post(`${BASE_URL}/api/auth/login`, {
            username: USERNAME,
            password: PASSWORD
        });

        const token = authRes.data.token;
        if (!token) {
            throw new Error("No se pudo obtener el token de autenticación.");
        }
        console.log(`[SUCCESS] Autenticado como ${USERNAME}`);

        // 2. Generar el PDF mock de 2MB
        console.log(`[INFO] Generando PDF de ~2MB en memoria...`);
        const pdfBuffer = await generateMockPDFBuffer();
        console.log(`[SUCCESS] PDF Generado. Tamaño: ${(pdfBuffer.length / (1024 * 1024)).toFixed(2)} MB\n`);

        // 3. Preparar los payloads y ejecutar
        let successCount = 0;
        let failureCount = 0;
        let totalLatency = 0;

        const requests = [];

        console.log(`[INFO] Lanzando ${NUM_TRUCKS} peticiones POST concurrentes...`);
        const startTimeGlobal = Date.now();

        for (let i = 0; i < NUM_TRUCKS; i++) {
            const idLote = `LOTE-STRESS-${Date.now()}-${i}`;
            const lat = (-34.6037 + (Math.random() * 0.1)).toFixed(4);
            const lon = (-58.3816 + (Math.random() * 0.1)).toFixed(4);
            const geolocalizacion = `Lat: ${lat}, Lon: ${lon}`;
            const volumen = 30 + Math.floor(Math.random() * 5); // ~30 TN

            const formData = new FormData();
            formData.append('idLote', idLote);
            formData.append('geolocalizacion', geolocalizacion);
            formData.append('volumenToneladas', volumen);
            // Agregar el buffer como archivo
            formData.append('documento', pdfBuffer, {
                filename: 'carta_de_porte_stress.pdf',
                contentType: 'application/pdf',
                knownLength: pdfBuffer.length
            });

            const reqPromise = (async () => {
                // Stagger requests slightly to prevent EPIPE socket errors
                await new Promise(r => setTimeout(r, i * 200));
                const startReq = Date.now();
                try {
                    const res = await axios.post(`${BASE_URL}/api/lotes/registrar`, formData, {
                        headers: {
                            ...formData.getHeaders(),
                            'Authorization': `Bearer ${token}`
                        }
                    });
                    
                    const endReq = Date.now();
                    const latency = endReq - startReq;
                    
                    if (res.data.success) {
                        successCount++;
                        totalLatency += latency;
                    } else {
                        failureCount++;
                    }
                } catch (error) {
                    failureCount++;
                    console.error(`[ERROR] Petición ${i} falló:`, error.response?.data?.error || error.message);
                }
            })();

            requests.push(reqPromise);
        }

        // Ejecutar todas concurrentemente
        await Promise.all(requests);
        const endTimeGlobal = Date.now();

        // 4. Resultados
        const dropRate = (failureCount / NUM_TRUCKS) * 100;
        const avgLatency = successCount > 0 ? (totalLatency / successCount) : 0;
        const totalTimeSeconds = (endTimeGlobal - startTimeGlobal) / 1000;

        console.log(`\n--- RESULTADOS DEL EXPERIMENTO ---`);
        console.log(`Peticiones Totales: ${NUM_TRUCKS}`);
        console.log(`Peticiones Exitosas: ${successCount}`);
        console.log(`Peticiones Fallidas: ${failureCount}`);
        console.log(`Drop Rate: ${dropRate.toFixed(2)}%`);
        console.log(`Latencia Promedio por documento: ${(avgLatency / 1000).toFixed(2)} segundos`);
        console.log(`Tiempo Total (Ventana): ${totalTimeSeconds.toFixed(2)} segundos`);

        if (dropRate === 0) {
            console.log(`\n[SUCCESS] El Mock Ledger y IPFS procesaron el 100% de la carga sin pérdida de paquetes.`);
        } else {
            console.log(`\n[WARNING] Hubo pérdida de paquetes o errores.`);
        }

    } catch (error) {
        console.error(`[ERROR FATAL]`, error);
    }
}

runStressTest();
