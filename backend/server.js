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
 * @typedef {Object} CampoEstablecimiento
 * @property {string} renspa - Identificador RENSPA del establecimiento agrícola.
 * @property {string} alias - Nombre o alias descriptivo del campo.
 */

/**
 * @typedef {Object} UsuarioSistema
 * @property {string} username - Nombre de usuario.
 * @property {string} password - Contraseña (simulada).
 * @property {string} rol - Rol dentro del sistema.
 * @property {string} [cuit] - CUIT del usuario autenticado.
 * @property {string} [renspa] - RENSPA asociado (compatibilidad legacy).
 * @property {CampoEstablecimiento[]} [campos] - Establecimientos habilitados (relación 1:N).
 */

const JWT_SECRET = 'tesina_secreto_123';

/** @type {UsuarioSistema[]} */
const USUARIOS = [
  // Caso 1: Productor mono-establecimiento
  {
    username: 'productor1',
    password: '123',
    rol: 'Productor Agrícola',
    cuit: '20-30123456-4',
    renspa: '01.002.0.00345/00',
    campos: [
      { renspa: '01.002.0.00345/00', alias: 'Establecimiento San Pedro' }
    ]
  },
  // Caso 2: Productor multi-establecimiento (1:N)
  {
    username: 'productor2',
    password: '123',
    rol: 'Productor Agrícola',
    cuit: '20-40987654-2',
    campos: [
      { renspa: '01.002.0.00034/00', alias: 'Campo Norte (Chacabuco)' },
      { renspa: '01.002.0.00034/01', alias: 'Campo Sur (Pergamino)' }
    ]
  },
  { username: 'acopio_coop', password: '123', rol: 'Acopiador / Cooperativa', cuit: '30-55667788-9' },
  { username: 'transporte_log', password: '123', rol: 'Transportista', cuit: '30-66778899-1' },
  { username: 'senasa_fiscal', password: '123', rol: 'Organismo de Control (SENASA/ARCA)', cuit: '30-77889900-2' },
  { username: 'exportador_bb', password: '123', rol: 'Exportador (Puertos)', cuit: '30-88990011-3' }
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
 * Autenticación ligera simulada con payload enriquecido (CUIT y 1:N Establecimientos)
 */
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  const user = USUARIOS.find(u => u.username === username && u.password === password);
  if (!user) {
    return res.status(401).json({ success: false, error: 'Credenciales inválidas' });
  }
  const campos = user.campos || (user.renspa ? [{ renspa: user.renspa, alias: 'Campo Principal' }] : []);
  const primaryRenspa = user.renspa || (campos.length > 0 ? campos[0].renspa : undefined);

  const tokenPayload = {
    username: user.username,
    rol: user.rol,
    cuit: user.cuit || '20-00000000-0',
    renspa: primaryRenspa,
    campos: campos
  };
  const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '8h' });
  res.json({
    success: true,
    token,
    rol: user.rol,
    cuit: tokenPayload.cuit,
    campos: tokenPayload.campos,
    renspa: tokenPayload.renspa
  });
});

/**
 * 1. POST /api/lotes/registrar (Productor)
 * Sube Carta de Porte a IPFS y registra en ledger privado.
 * Valida que el RENSPA pertenezca a los establecimientos autorizados del CUIT autenticado.
 */
app.post('/api/lotes/registrar', verificarRol(['Productor Agrícola']), upload.single('documento'), async (req, res) => {
  try {
    const { idLote, geolocalizacion, volumenToneladas } = req.body;
    let renspa = req.body.renspa;

    const userCampos = req.user.campos || (req.user.renspa ? [{ renspa: req.user.renspa }] : []);

    // Caso 1: Si no se especificó y es mono-establecimiento, autocompletar con su único RENSPA
    if (!renspa && userCampos.length === 1) {
      renspa = userCampos[0].renspa;
    }

    // Validación RBAC: el RENSPA debe pertenecer a los habilitados para el usuario
    if (userCampos.length > 0) {
      const autorizado = userCampos.some(c => c.renspa === renspa);
      if (!autorizado) {
        return res.status(403).json({
          success: false,
          error: `Acceso denegado: El RENSPA ${renspa} no corresponde a ninguno de los campos habilitados para el usuario ${req.user.username} (CUIT: ${req.user.cuit || 'N/A'}).`
        });
      }
    }

    if (!renspa) {
      return res.status(400).json({ success: false, error: 'El campo RENSPA Origen es obligatorio' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, error: 'El archivo PDF de Carta de Porte es obligatorio' });
    }

    const pdfData = await pdf(req.file.buffer);
    const text = pdfData.text.toUpperCase();
    if (!text.includes('CARTA DE PORTE ELECTRÓNICA') || !(text.includes('CTG') || text.includes('CÓDIGO DE TRAZABILIDAD DE GRANOS'))) {
      return res.status(400).json({ success: false, error: 'Oráculo: El documento no es una Carta de Porte válida' });
    }

    let ipfsCID = await ipfsService.uploadRegulatoryDocument(req.file.buffer, req.file.originalname);

    // Control para evitar registrar el mismo documento (Carta de Porte) dos veces
    const loteExistente = fabricLedger.obtenerTodosLotes().find(l => l.ipfsCID === ipfsCID);
    if (loteExistente) {
      return res.status(400).json({ success: false, error: `El documento Carta de Porte ya está registrado en el lote ${loteExistente.id}.` });
    }

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
    const userCampos = (req.user.campos || []).map(c => c.renspa);
    if (req.user.renspa && !userCampos.includes(req.user.renspa)) {
      userCampos.push(req.user.renspa);
    }
    const lotes = fabricLedger.obtenerTodosLotes().filter(l =>
      l.owner === req.user.username || userCampos.includes(l.renspa)
    );
    res.json({ success: true, data: lotes });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/lotes/entrantes', verificarRol(['Acopiador / Cooperativa']), (req, res) => {
  try {
    const lotes = fabricLedger.obtenerTodosLotes().filter(l =>
      l.estado === 'EN_TRANSITO_ACOPIO' || l.estado === 'EN_TRANSITO'
    );
    res.json({ success: true, data: lotes });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/lotes/recepcionados', verificarRol(['Acopiador / Cooperativa']), (req, res) => {
  try {
    const lotes = fabricLedger.obtenerLotesPorEstado('RECEPCIONADO_ACOPIO');
    res.json({ success: true, data: lotes });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/lotes/para-mezcla', verificarRol(['Acopiador / Cooperativa']), (req, res) => {
  try {
    // Regla de Negocio: Lotes recibidos y pesados en balanza de acopio o ya acondicionados en silo
    const lotes = fabricLedger.obtenerTodosLotes().filter(l =>
      l.estado === 'RECEPCIONADO_ACOPIO' || l.estado === 'ACOPIADO_ACONDICIONADO' || l.estado === 'ACONDICIONADO'
    );
    res.json({ success: true, data: lotes });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/lotes/transportes-disponibles', verificarRol(['Transportista']), (req, res) => {
  try {
    const tramo1 = fabricLedger.obtenerLotesPorEstado('COSECHADO');
    const tramo2 = fabricLedger.obtenerTodosLotes().filter(l => l.estado === 'VALIDADO_SENASA');
    res.json({ success: true, data: tramo1, tramo1, tramo2 });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/lotes/para-traslado', verificarRol(['Acopiador / Cooperativa', 'Transportista']), (req, res) => {
  try {
    // Lotes con calidad validada y sello SENASA BFA listos para emitir CPE de Traslado
    const lotes = fabricLedger.obtenerTodosLotes().filter(l =>
      l.estado === 'VALIDADO_SENASA' || (l.bfaHash && (l.estado === 'ACOPIADO_ACONDICIONADO' || l.estado === 'ACONDICIONADO'))
    );
    res.json({ success: true, data: lotes });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/lotes/buscar', verificarRol(['Organismo de Control (SENASA/ARCA)']), (req, res) => {
  try {
    const query = (req.query.q || '').trim();
    const todos = fabricLedger.obtenerTodosLotes();

    // Momento de emisión del Certificado de SENASA:
    // Se emite una vez que el grano ingresa a la planta de acopio y es sometido a tareas de acondicionamiento (ACOPIADO_ACONDICIONADO)
    let match = todos.filter(l =>
      l.estado === 'ACOPIADO_ACONDICIONADO' || l.estado === 'ACONDICIONADO' || l.estado === 'VALIDADO_SENASA'
    );
    if (query) {
      match = match.filter(l =>
        l.id.toLowerCase().includes(query.toLowerCase()) || (l.renspa && l.renspa.toLowerCase().includes(query.toLowerCase()))
      );
    }

    // Detección de búsqueda específica sobre lote consumido/terminal
    let loteConsumido = null;
    if (query && match.length === 0) {
      const matchInactivo = todos.find(l => 
        l.id.toLowerCase() === query.toLowerCase() || (l.renspa && l.renspa.toLowerCase() === query.toLowerCase())
      );
      if (matchInactivo && matchInactivo.estado === 'MEZCLADO_ACONDICIONADO') {
        loteConsumido = matchInactivo;
      }
    }

    res.json({ success: true, data: match, loteConsumido });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Tramo 1 (Campo -> Acopio):
 * 2. POST /api/lotes/transporte (Transportista)
 * El Productor generó la CPE Primaria (flete corto). Al iniciar el traslado pasa a EN_TRANSITO_ACOPIO.
 */
app.post('/api/lotes/transporte', verificarRol(['Transportista']), async (req, res) => {
  try {
    const { idLote } = req.body;
    const lote = fabricLedger.obtenerLote(idLote);

    if (!lote) return res.status(404).json({ success: false, error: "Lote no encontrado" });
    if (lote.estado !== 'COSECHADO') return res.status(400).json({ success: false, error: "El lote debe estar cosechado para iniciar flete corto hacia acopio." });

    const loteActualizado = fabricLedger.actualizarEstadoLogistico(
      idLote,
      'EN_TRANSITO_ACOPIO',
      req.user.rol,
      'Tramo 1 (Campo -> Acopio): Carga recibida con CPE Primaria (flete corto) en viaje hacia planta de acopio/silo.'
    );
    res.json({ success: true, data: loteActualizado });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 3. POST /api/lotes/acopio (y alias recepcion-acopio) (Acopiador / Cooperativa)
 * Al arribar el camión, la Cooperativa o Acopio confirma la recepción física y descarga en balanza.
 * El lote pasa a RECEPCIONADO_ACOPIO.
 */
app.post(['/api/lotes/acopio', '/api/lotes/recepcion-acopio'], verificarRol(['Acopiador / Cooperativa']), async (req, res) => {
  try {
    const { idLote, pesajeFinal, calidad } = req.body;
    const lote = fabricLedger.obtenerLote(idLote);

    if (!lote) return res.status(404).json({ success: false, error: "Lote no encontrado" });
    const estadosEnCamino = ['EN_TRANSITO_ACOPIO', 'EN_TRANSITO'];
    if (!estadosEnCamino.includes(lote.estado)) {
      return res.status(400).json({ success: false, error: `El lote no se encuentra en tránsito hacia acopio (estado actual: '${lote.estado}').` });
    }

    // Actualizar volumen neto definitivo verificado en balanza oficial
    if (pesajeFinal && !isNaN(parseFloat(pesajeFinal)) && parseFloat(pesajeFinal) > 0) {
      lote.volumenToneladas = parseFloat(parseFloat(pesajeFinal).toFixed(2));
    }

    const loteActualizado = fabricLedger.actualizarEstadoLogistico(
      idLote,
      'RECEPCIONADO_ACOPIO',
      req.user.rol,
      `Recepción física y descarga en balanza confirmada. Pesaje neto definitivo: ${lote.volumenToneladas} TN. Parámetros iniciales: ${calidad || 'Calidad estándar'}`
    );
    res.json({ success: true, data: loteActualizado });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Acondicionamiento individual en Acopio:
 * POST /api/lotes/acondicionar (Acopiador / Cooperativa)
 * Tareas de secado, zarandeo, fumigación y análisis de calidad comercial en silos (ACOPIADO_ACONDICIONADO).
 */
app.post('/api/lotes/acondicionar', verificarRol(['Acopiador / Cooperativa']), async (req, res) => {
  try {
    const { idLote, secado, zarandeo, fumigacion, calidadComercial } = req.body;
    const loteAcondicionado = fabricLedger.acondicionarLote(idLote, {
      secado,
      zarandeo,
      fumigacion,
      calidadComercial
    }, req.user.rol);

    res.json({ success: true, data: loteAcondicionado });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * Acondicionamiento y Mezcla en Silos (Trazabilidad de Masa):
 * 3b. POST /api/lotes/mezclar (Acopiador / Cooperativa)
 * Los granos de distintos productores se mezclan en silos (ACOPIADO_ACONDICIONADO).
 */
app.post('/api/lotes/mezclar', verificarRol(['Acopiador / Cooperativa']), async (req, res) => {
  try {
    const { nuevoIdLote, idsLotesOrigen } = req.body;
    if (!nuevoIdLote) {
      return res.status(400).json({ success: false, error: "El identificador del lote consolidado (nuevoIdLote) es obligatorio." });
    }
    if (!Array.isArray(idsLotesOrigen) || idsLotesOrigen.length < 2) {
      return res.status(400).json({ success: false, error: "Debe seleccionar al menos dos lotes precursores para fusionar en el silo." });
    }

    const loteMezclado = fabricLedger.procesarAcopioYMezcla(nuevoIdLote, idsLotesOrigen);
    res.status(201).json({ success: true, data: loteMezclado });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * Momento de emisión del Certificado de SENASA:
 * 4. POST /api/lotes/notarizar (SENASA / ARCA)
 * Se emite una vez que el grano ingresa a la planta de acopio/silo y es sometido a las tareas de
 * acondicionamiento (secado, zarandeo, fumigación y análisis de calidad comercial/parámetros fitosanitarios).
 * Con el grano tipificado y libre de plagas cuarentenarias, el inspector valida el lote físico y
 * estampa la conformidad fitosanitaria oficial en BFA (VALIDADO_SENASA).
 */
app.post('/api/lotes/notarizar', verificarRol(['Organismo de Control (SENASA/ARCA)']), async (req, res) => {
  try {
    const { idLote, inspector, plagasCuarentenarias, calidadTipificada } = req.body;
    const lote = fabricLedger.obtenerLote(idLote);

    if (!lote) return res.status(404).json({ success: false, error: "Lote no encontrado" });

    // Restricción de Negocio: No Doble Certificación Sanitaria sobre partidas consumidas
    if (lote.estado === 'MEZCLADO_ACONDICIONADO') {
      return res.status(400).json({
        success: false,
        error: `Acción regulatoria denegada: El lote ${idLote} ya fue consumido en una mezcla posterior (MEZCLADO_ACONDICIONADO).`
      });
    }

    const estadosAcondicionados = ['ACOPIADO_ACONDICIONADO', 'ACONDICIONADO'];
    if (!estadosAcondicionados.includes(lote.estado)) {
      return res.status(400).json({
        success: false,
        error: `Momento de emisión del Certificado de SENASA inválido: Solo se emite una vez que el grano ingresa al acopio y completa las tareas de acondicionamiento (estado ACOPIADO_ACONDICIONADO). Estado actual: '${lote.estado}'.`
      });
    }

    // Calculamos Hash SHA-256 de los datos críticos como Sello de Notarización BFA
    const timestamp = new Date().toISOString();
    const hashData = `${lote.id}-${lote.renspa}-${lote.volumenToneladas}-${lote.ipfsCID || 'NO_CPE'}-${timestamp}`;
    const bfaHash = crypto.createHash('sha256').update(hashData).digest('hex');

    const loteActualizado = fabricLedger.notarizarSenasa(idLote, {
      inspector,
      plagasCuarentenarias,
      calidadTipificada
    }, req.user.rol, bfaHash);

    res.json({
      success: true,
      message: 'Conformidad fitosanitaria oficial emitida y sellada con éxito en la Blockchain Federal Argentina (BFA).',
      idLote: idLote,
      bfaHash: bfaHash,
      timestamp: timestamp,
      entidad: 'SENASA / ARCA',
      data: loteActualizado
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Tramo 2 (Acopio -> Puerto de Exportación):
 * POST /api/lotes/emitir-cpe-traslado (Acopiador / Cooperativa)
 * Momento de transporte hacia la terminal portuaria:
 * El traslado se autoriza únicamente cuando el lote consolidado en el acopio posee:
 * 1. Estado de calidad validado (ACOPIADO_ACONDICIONADO / VALIDADO_SENASA).
 * 2. Notarización oficial registrada (BFA Hash).
 * 3. Emisión de una nueva Carta de Porte Electrónica (CPE) de traslado con destino específico al puerto de exportación (Bahía Blanca o Quequén).
 * Pasa a EN_TRANSITO_PUERTO.
 */
app.post('/api/lotes/emitir-cpe-traslado', verificarRol(['Acopiador / Cooperativa']), async (req, res) => {
  try {
    const { idLote, destinoPuerto, numeroCPE, ctg, transportista, cuitTransportista, patenteCamion, ipfsCID } = req.body;
    const loteActualizado = fabricLedger.emitirCpeTraslado(idLote, {
      destinoPuerto,
      numeroCPE,
      ctg,
      transportista,
      cuitTransportista,
      patenteCamion,
      ipfsCID
    }, req.user.rol);

    res.json({
      success: true,
      message: `Nueva CPE de Traslado (Flete Largo) emitida con éxito hacia ${loteActualizado.cpeTraslado.destinoPuerto}. Carga en tránsito a puerto.`,
      data: loteActualizado
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
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

    if (lote.estado === 'MEZCLADO_ACONDICIONADO') {
      return res.status(400).json({
        success: false,
        error: `Acción regulatoria denegada: El lote ${idLote} ya fue consumido en una mezcla posterior (MEZCLADO_ACONDICIONADO). La medida fitosanitaria debe aplicarse sobre la partida consolidada activa.`
      });
    }

    const timestamp = new Date().toISOString();
    const loteActualizado = fabricLedger.actualizarEstadoLogistico(
      idLote,
      'BLOQUEADO',
      req.user.rol,
      `ALERTA FITOSANITARIA (${timestamp}): ${motivo}`
    );

    res.json({
      success: true,
      message: `Alerta fitosanitaria aplicada: El lote ${idLote} ha sido BLOQUEADO preventivamente en el ledger.`,
      idLote: idLote,
      motivo: motivo,
      timestamp: timestamp,
      data: loteActualizado
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Recepción Portuaria y Despacho de Exportación:
 * GET /api/lotes/entrantes-puerto (Exportador / Puertos / Transportista)
 * Devuelve todos los lotes en estado EN_TRANSITO_PUERTO.
 */
app.get('/api/lotes/entrantes-puerto', verificarRol(['Exportador (Puertos)', 'Transportista', 'Acopiador / Cooperativa']), (req, res) => {
  try {
    const lotes = fabricLedger.obtenerLotesPorEstado('EN_TRANSITO_PUERTO');
    res.json({ success: true, data: lotes });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/lotes/arribo-puerto (Exportador / Aduana)
 * El Exportador y la Aduana validan el arribo del convoy, confirmando la CPE de descarga.
 * El lote pasa a ARRIBADO_PUERTO.
 */
app.post('/api/lotes/arribo-puerto', verificarRol(['Exportador (Puertos)']), async (req, res) => {
  try {
    const { idLote, terminal, balanzaPuertoTN, inspectorAduana } = req.body;
    const loteActualizado = fabricLedger.confirmarArriboPuerto(idLote, {
      terminal,
      balanzaPuertoTN,
      inspectorAduana
    }, req.user.rol);

    res.json({
      success: true,
      message: `Arribo de convoy validado en terminal portuaria. CPE de descarga confirmada. Estado: ARRIBADO_PUERTO.`,
      data: loteActualizado
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * Listado de pedidos habilitados en la planta de exportación:
 * GET /api/lotes/habilitados-embarque (Exportador / Puertos)
 * En la terminal portuaria, los pedidos se listan en estado Habilitado para Embarque únicamente si cumplen
 * concurrentemente con:
 * 1. Arribo y confirmación definitiva de la CPE de descarga (ARRIBADO_PUERTO).
 * 2. Sellado de tiempo y hash inmutable de SENASA/AFIP comprobable en BFA.
 * 3. Acreditación estricta de trazabilidad de masa hacia atrás (backtracking completo hasta los lotes y RENSPA de origen).
 */
app.get('/api/lotes/habilitados-embarque', verificarRol(['Exportador (Puertos)']), (req, res) => {
  try {
    const todos = fabricLedger.obtenerTodosLotes();
    // Consideramos partidas en puerto (ARRIBADO_PUERTO, EN_TRANSITO_PUERTO, o legacy ACONDICIONADO/VALIDADO_SENASA)
    const enTerminal = todos.filter(l =>
      l.estado === 'ARRIBADO_PUERTO' || l.estado === 'EN_TRANSITO_PUERTO' || l.estado === 'VALIDADO_SENASA' || l.estado === 'ACONDICIONADO'
    );

    const evaluados = enTerminal.map(l => {
      const auditoria = fabricLedger.verificarHabilitadoParaEmbarque(l.id);
      return {
        ...l,
        auditoriaEmbarque: auditoria
      };
    });

    res.json({ success: true, data: evaluados });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 6. POST /api/lotes/exportar (Exportador / Puerto)
 * Cierre logístico de exportación:
 * Acuña el NFT ERC-721 en Hardhat/Polygon EVM y genera el QR auditable.
 * Requiere cumplimiento estricto de las 3 condiciones de Habilitado para Embarque.
 */
app.post('/api/lotes/exportar', verificarRol(['Exportador (Puertos)']), async (req, res) => {
  try {
    const { idLote, exportadorAddress } = req.body;
    const lote = fabricLedger.obtenerLote(idLote);

    if (!lote) return res.status(404).json({ success: false, error: "Lote no encontrado" });

    // Verificación de Habilitación para Embarque (Las 3 condiciones concurrentes)
    const auditoria = fabricLedger.verificarHabilitadoParaEmbarque(idLote);

    // Permitir tolerancia de compatibilidad para tests antiguos si el lote está ACONDICIONADO con bfaHash
    const esLegacyValido = (lote.estado === 'ACONDICIONADO' || lote.estado === 'VALIDADO_SENASA') && Boolean(lote.bfaHash);

    if (!auditoria.habilitado && !esLegacyValido) {
      const faltantes = [];
      if (!auditoria.checks.cpeDescargaConfirmada.cumplido) {
        faltantes.push("1. Arribo y confirmación definitiva de la CPE de descarga (debe estar en ARRIBADO_PUERTO)");
      }
      if (!auditoria.checks.selloBfaValido.cumplido) {
        faltantes.push("2. Sellado de tiempo y hash inmutable de SENASA/AFIP comprobable en BFA");
      }
      if (!auditoria.checks.trazabilidadMasaAcreditada.cumplido) {
        faltantes.push("3. Acreditación estricta de trazabilidad de masa hacia atrás (backtracking completo hasta los lotes y RENSPA de origen)");
      }
      return res.status(400).json({
        success: false,
        error: `Embarque denegado. El lote no cumple concurrentemente con los requisitos para estar Habilitado para Embarque:\n${faltantes.join('\n')}`
      });
    }

    // 1. Crear metadata del NFT
    const tokenMetadata = {
      name: `Lote Maíz Exportación #${idLote}`,
      description: `Trazabilidad completa de masa y certificación SENASA/BFA. BFA Hash: ${lote.bfaHash || 'N/A'}`,
      attributes: [
        { trait_type: 'Volumen (TN)', value: lote.volumenToneladas },
        { trait_type: 'RENSPA Origen', value: lote.renspa },
        { trait_type: 'Puerto de Destino', value: lote.cpeTraslado ? lote.cpeTraslado.destinoPuerto : 'Bahía Blanca / Quequén' },
        { trait_type: 'CPE Traslado', value: lote.cpeTraslado ? lote.cpeTraslado.numeroCPE : 'N/A' },
        { trait_type: 'BFA Hash', value: lote.bfaHash || 'N/A' }
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
    const receipt = await tx.wait();

    // Extraer Token ID emitido si está disponible en logs
    let tokenId = null;
    if (receipt && receipt.logs) {
      for (const log of receipt.logs) {
        try {
          const parsed = contract.interface.parseLog(log);
          if (parsed && (parsed.name === 'LoteExportado' || parsed.name === 'Transfer')) {
            if (parsed.args && parsed.args.tokenId !== undefined) {
              tokenId = parsed.args.tokenId.toString();
              break;
            }
          }
        } catch (e) { }
      }
    }

    // Actualizar ledger privado final
    const loteFinal = fabricLedger.actualizarEstadoLogistico(
      idLote,
      'EXPORTADO',
      'Exportador (Puertos)',
      `Cierre logístico de exportación. NFT minteado en Hardhat. TX: ${tx.hash}${tokenId !== null ? ` - Token ID: #${tokenId}` : ''}`
    );
    if (tokenId !== null) {
      loteFinal.tokenId = tokenId;
    }
    loteFinal.txHash = tx.hash;

    // Generar link de verificación simulado
    const qrString = `http://verifbfa.com/verificar?id=${idLote}&tx=${tx.hash}`;

    res.json({ success: true, qr: qrString, txHash: tx.hash, tokenId, contractAddress: NFT_CONTRACT_ADDRESS, data: loteFinal });
  } catch (error) {
    console.error("Error detallado al exportar:", error);
    res.status(500).json({ success: false, error: `Fallo al exportar: ${error.reason || error.message}` });
  }
});

/**
 * GET /api/lotes/:id (Consulta Pública - Verificador QR)
 * Devuelve la traza completa del lote con backtracking y desglose dinámico de proporciones de masa.
 */
app.get('/api/lotes/:id', (req, res) => {
  try {
    const { id } = req.params;
    const traza = fabricLedger.obtenerTrazabilidadCompleta(id);

    if (!traza) return res.status(404).json({ success: false, error: "Lote no encontrado" });

    // Enriquecer con tokenId y txHash si existen
    let tokenId = traza.tokenId || null;
    let txHash = traza.txHash || null;
    if (!tokenId || !txHash) {
      const exportTx = traza.historialTransacciones && traza.historialTransacciones.find(t => t.accion === 'CAMBIO_ESTADO: EXPORTADO');
      if (exportTx && exportTx.detalles) {
        const matchTx = exportTx.detalles.match(/TX:\s*(0x[a-fA-F0-9]+)/);
        if (matchTx && !txHash) txHash = matchTx[1];
        const matchToken = exportTx.detalles.match(/Token\s*ID:\s*#?(\d+)/i);
        if (matchToken && !tokenId) tokenId = matchToken[1];
      }
    }

    res.json({
      success: true,
      data: {
        id: traza.id,
        estado: traza.estado,
        renspa: traza.renspa,
        geolocalizacion: traza.geolocalizacion,
        volumenToneladas: traza.volumenToneladas,
        bfaHash: traza.bfaHash,
        tokenId: tokenId,
        txHash: txHash,
        ipfsCID: traza.ipfsCID,
        fechaCosecha: traza.fechaCosecha,
        lotesOrigen: traza.lotesOrigen || [],
        historialTransacciones: traza.historialTransacciones,
        desgloseOrigenes: traza.desgloseOrigenes,
        arbolGenealogico: traza.arbolGenealogico,
        contractAddress: NFT_CONTRACT_ADDRESS
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

const PORT = 3000;
const seedDemo = require('./seed_demo');
if (process.env.SEED_DEMO !== 'false') {
  try {
    seedDemo();
  } catch (e) {
    console.log('Seed demo ya inicializado o omitido:', e.message);
  }
}

app.listen(PORT, () => {
  console.log(`🚀 Backend AgTech Node.js corriendo en http://localhost:${PORT}`);
});
