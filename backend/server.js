const express = require('express');
const cors = require('cors');
const multer = require('multer');
const crypto = require('crypto');
const { ethers } = require('ethers');

const fabricLedger = require('../blockchain-private-mock/fabricMockLedger');
const ipfsService = require('./services/ipfsService');
const jwt = require('jsonwebtoken');
const pdf = require('pdf-parse');

/**
 * @typedef {Object} LoteMaiz
 * @property {string} id - ID único del lote.
 * @property {string} renspa - RENSPA del origen.
 * @property {string} geolocalizacion - Coordenadas de origen o acopio.
 * @property {number} volumenToneladas - Peso en toneladas.
 * @property {string} estado - Estado actual (COSECHADO, EN_TRANSITO, ACONDICIONADO, BLOQUEADO, etc).
 * @property {string|null} ipfsCID - CID del documento en IPFS.
 * @property {string|null} bfaHash - Hash notarial en BFA.
 * @property {Array} historialTransacciones - Trazabilidad de estados.
 */

/**
 * @typedef {Object} UsuarioSistema
 * @property {string} username - Nombre de usuario.
 * @property {string} password - Contraseña (simulada).
 * @property {string} rol - Rol dentro del sistema.
 * @property {string} [renspa] - RENSPA asociado (solo Productor).
 */

const JWT_SECRET = 'tesina_secreto_123';

/** @type {UsuarioSistema[]} */
const USUARIOS = [
  { username: 'productor1', password: '123', rol: 'Productor Agrícola', renspa: '01.002.0.00345/00' },
  { username: 'acopio_coop', password: '123', rol: 'Acopiador / Cooperativa' },
  { username: 'transporte_log', password: '123', rol: 'Transportista' },
  { username: 'senasa_fiscal', password: '123', rol: 'Organismo de Control (SENASA/ARCA)' },
  { username: 'exportador_bb', password: '123', rol: 'Exportador (Puertos)' }
];

// Configuraciones Hardhat local
const HARDHAT_RPC = "http://127.0.0.1:8545";
// IMPORTANTE: Modifica esta dirección con el address generado al correr "npx hardhat run scripts/deploy.js"
const NFT_CONTRACT_ADDRESS = process.env.NFT_ADDRESS || "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const NFT_ABI = [
  "function emitirCertificadoExportacion(address exportador, string memory uri) public returns (uint256)"
];

const app = express();
app.use(cors());
app.use(express.json());

// Multer en memoria para recibir archivos antes de pasar a IPFS
const upload = multer({ storage: multer.memoryStorage() });

// Middleware de verificación de Rol
function verificarRol(rolesPermitidos) {
  return (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Token no provisto o formato inválido' });
    }
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      if (!rolesPermitidos.includes(decoded.rol)) {
        return res.status(403).json({ success: false, error: 'Acceso denegado para este rol' });
      }
      req.user = decoded;
      next();
    } catch (error) {
      return res.status(401).json({ success: false, error: 'Token inválido o expirado' });
    }
  };
}

/**
 * POST /api/auth/login
 * Autenticación ligera simulada
 */
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  const user = USUARIOS.find(u => u.username === username && u.password === password);
  if (!user) {
    return res.status(401).json({ success: false, error: 'Credenciales inválidas' });
  }
  const tokenPayload = {
    username: user.username,
    rol: user.rol,
    renspa: user.renspa
  };
  const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '8h' });
  res.json({ success: true, token, rol: user.rol });
});

/**
 * 1. POST /api/lotes/registrar (Productor)
 * Sube Carta de Porte a IPFS y registra en ledger privado.
 */
app.post('/api/lotes/registrar', verificarRol(['Productor Agrícola']), upload.single('documento'), async (req, res) => {
  try {
    const { idLote, geolocalizacion, volumenToneladas } = req.body;
    const renspa = req.body.renspa || req.user.renspa;

    if (!req.file) {
      return res.status(400).json({ success: false, error: 'El archivo PDF de Carta de Porte es obligatorio' });
    }

    const pdfData = await pdf(req.file.buffer);
    const text = pdfData.text.toUpperCase();
    if (!text.includes('CARTA DE PORTE ELECTRÓNICA') || !(text.includes('CTG') || text.includes('CÓDIGO DE TRAZABILIDAD DE GRANOS'))) {
      return res.status(400).json({ success: false, error: 'Oráculo: El documento no es una Carta de Porte válida' });
    }

    let ipfsCID = await ipfsService.uploadRegulatoryDocument(req.file.buffer, req.file.originalname);

    const nuevoLote = fabricLedger.registrarCosechaPrimaria(
      idLote, renspa, geolocalizacion, volumenToneladas, ipfsCID
    );
    nuevoLote.owner = req.user.username;

    res.status(201).json({ success: true, data: nuevoLote, cid: ipfsCID });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});



/**
 * Endpoints Listados (RBAC)
 */

app.get('/api/lotes/mis-lotes', verificarRol(['Productor Agrícola']), (req, res) => {
  try {
    const lotes = fabricLedger.obtenerTodosLotes().filter(l => l.owner === req.user.username || l.renspa === req.user.renspa);
    res.json({ success: true, data: lotes });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/lotes/entrantes', verificarRol(['Acopiador / Cooperativa']), (req, res) => {
  try {
    const lotes = fabricLedger.obtenerLotesPorEstado('EN_TRANSITO');
    res.json({ success: true, data: lotes });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/lotes/transportes-disponibles', verificarRol(['Transportista']), (req, res) => {
  try {
    const lotes = fabricLedger.obtenerLotesPorEstado('COSECHADO');
    res.json({ success: true, data: lotes });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/lotes/buscar', verificarRol(['Organismo de Control (SENASA/ARCA)']), (req, res) => {
  try {
    const query = req.query.q || '';
    if (!query) {
      return res.json({ success: true, data: fabricLedger.obtenerTodosLotes() });
    }
    const match = fabricLedger.obtenerTodosLotes().filter(l =>
      l.id.includes(query) || (l.renspa && l.renspa.includes(query))
    );
    res.json({ success: true, data: match });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 2. POST /api/lotes/transporte (Transportista)
 * Actualiza estado a "En Tránsito".
 */
app.post('/api/lotes/transporte', verificarRol(['Transportista']), async (req, res) => {
  try {
    const { idLote } = req.body;
    const lote = fabricLedger.obtenerLote(idLote);

    if (!lote) return res.status(404).json({ success: false, error: "Lote no encontrado" });
    if (lote.estado !== 'COSECHADO') return res.status(400).json({ success: false, error: "El lote debe estar cosechado para iniciar transporte." });

    const loteActualizado = fabricLedger.actualizarEstadoLogistico(idLote, 'EN_TRANSITO', req.user.rol, 'Carga recibida y en camino.');
    res.json({ success: true, data: loteActualizado });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 3. POST /api/lotes/acopio (Acopiador / Cooperativa)
 * Acondicionamiento y pesaje.
 */
app.post('/api/lotes/acopio', verificarRol(['Acopiador / Cooperativa']), async (req, res) => {
  try {
    const { idLote, pesajeFinal, calidad } = req.body;
    const lote = fabricLedger.obtenerLote(idLote);

    if (!lote) return res.status(404).json({ success: false, error: "Lote no encontrado" });
    if (lote.estado !== 'EN_TRANSITO') return res.status(400).json({ success: false, error: "El lote no está en tránsito." });

    const loteActualizado = fabricLedger.actualizarEstadoLogistico(idLote, 'ACONDICIONADO', req.user.rol, `Pesaje: ${pesajeFinal}TN. Calidad: ${calidad}`);
    res.json({ success: true, data: loteActualizado });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 4. POST /api/lotes/notarizar (SENASA/ARCA)
 * Simula sellado en Blockchain Federal Argentina (BFA).
 */
app.post('/api/lotes/notarizar', verificarRol(['Organismo de Control (SENASA/ARCA)']), async (req, res) => {
  try {
    const { idLote } = req.body;
    const lote = fabricLedger.obtenerLote(idLote);

    if (!lote) return res.status(404).json({ success: false, error: "Lote no encontrado" });

    // Calculamos un Hash SHA-256 de los datos críticos como simulación de Notarización
    const hashData = `${lote.id}-${lote.renspa}-${lote.volumenToneladas}-${lote.ipfsCID}`;
    const bfaHash = crypto.createHash('sha256').update(hashData).digest('hex');

    // Simular latencia de BFA y actualización asíncrona
    setTimeout(() => {
      fabricLedger.actualizarEstadoLogistico(idLote, lote.estado, req.user.rol, 'Sello criptográfico emitido en BFA.', bfaHash);
    }, 2000);

    res.json({ success: true, message: 'Notarización BFA iniciada asíncronamente.' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 5. POST /api/lotes/bloquear (Regulador)
 * Emitir Alerta Fitosanitaria y bloquear lote.
 */
app.post('/api/lotes/bloquear', verificarRol(['Organismo de Control (SENASA/ARCA)']), async (req, res) => {
  try {
    const { idLote, motivo } = req.body;
    const lote = fabricLedger.obtenerLote(idLote);
    if (!lote) return res.status(404).json({ success: false, error: "Lote no encontrado" });

    const loteActualizado = fabricLedger.actualizarEstadoLogistico(idLote, 'BLOQUEADO', req.user.rol, `ALERTA FITOSANITARIA: ${motivo}`);
    res.json({ success: true, data: loteActualizado });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 6. POST /api/lotes/exportar (Exportador / Puerto)
 * Emite un NFT de exportación en Polygon conectando con el smart contract.
 */
app.post('/api/lotes/exportar', verificarRol(['Exportador (Puertos)']), async (req, res) => {
  try {
    const { idLote, exportadorAddress } = req.body;
    const lote = fabricLedger.obtenerLote(idLote);

    if (!lote) return res.status(404).json({ success: false, error: "Lote no encontrado" });

    // Máquina de estados estricta (Oráculo Federado)
    if (lote.estado !== 'ACONDICIONADO') {
      return res.status(400).json({ success: false, error: "Oráculo: El lote debe ser procesado y pesado por el Acopiador (estado ACONDICIONADO) antes de exportar." });
    }

    if (!lote.bfaHash) {
      return res.status(400).json({ success: false, error: "Oráculo: El lote requiere notarización del ente regulador (SENASA/BFA) antes de exportar." });
    }

    // 1. Crear metadata del NFT
    const tokenMetadata = {
      name: `Lote Maíz Exportación #${idLote}`,
      description: `Trazabilidad completa de masa. BFA Hash: ${lote.bfaHash || 'N/A'}`,
      attributes: [
        { trait_type: 'Volumen (TN)', value: lote.volumenToneladas },
        { trait_type: 'RENSPA Origen', value: lote.renspa }
      ]
    };

    // Convertimos a base64 para el URI de la blockchain
    const metadataBase64 = Buffer.from(JSON.stringify(tokenMetadata)).toString('base64');
    const tokenURI = `data:application/json;base64,${metadataBase64}`;

    // 2. Conectar a Hardhat Local y Acuñar NFT
    const provider = new ethers.JsonRpcProvider(HARDHAT_RPC);
    const signer = await provider.getSigner(0); // Cuenta default Hardhat
    const contract = new ethers.Contract(NFT_CONTRACT_ADDRESS, NFT_ABI, signer);

    const tx = await contract.emitirCertificadoExportacion(exportadorAddress, tokenURI);
    await tx.wait();

    // Actualizar ledger privado final
    const loteFinal = fabricLedger.actualizarEstadoLogistico(
      idLote,
      'EXPORTADO',
      'Exportador',
      `NFT minteado. TX: ${tx.hash}`
    );

    // Generar link de verificación simulado
    const qrString = `http://verifbfa.com/verificar?id=${idLote}&tx=${tx.hash}`;

    res.json({ success: true, qr: qrString, txHash: tx.hash, data: loteFinal });
  } catch (error) {
    console.error("Error detallado al exportar:", error);
    res.status(500).json({ success: false, error: `Fallo al exportar: ${error.reason || error.message}` });
  }
});
/**
 * GET /api/lotes/:id (Consulta Pública - Verificador QR)
 * Devuelve la traza completa del lote.
 */
app.get('/api/lotes/:id', (req, res) => {
  try {
    const { id } = req.params;
    const lote = fabricLedger.obtenerLote(id);

    if (!lote) return res.status(404).json({ success: false, error: "Lote no encontrado" });

    res.json({ success: true, data: lote });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🚀 Backend AgTech Node.js corriendo en http://localhost:${PORT}`);
});
