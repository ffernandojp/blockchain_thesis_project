const express = require('express');
const cors = require('cors');
const multer = require('multer');
const crypto = require('crypto');
const { ethers } = require('ethers');

const fabricLedger = require('../blockchain-private-mock/fabricMockLedger');
const ipfsService = require('./services/ipfsService');

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

/**
 * 1. POST /api/lotes/registrar (Productor)
 * Sube Carta de Porte a IPFS y registra en ledger privado.
 */
app.post('/api/lotes/registrar', upload.single('documento'), async (req, res) => {
  try {
    const { idLote, renspa, geolocalizacion, volumenToneladas } = req.body;
    
    let ipfsCID = null;
    if (req.file) {
      ipfsCID = await ipfsService.uploadRegulatoryDocument(req.file.buffer, req.file.originalname);
    }

    const nuevoLote = fabricLedger.registrarCosechaPrimaria(
      idLote, renspa, geolocalizacion, volumenToneladas, ipfsCID
    );

    res.status(201).json({ success: true, data: nuevoLote, cid: ipfsCID });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * 2. POST /api/lotes/notarizar (SENASA/AFIP)
 * Simula sellado en Blockchain Federal Argentina (BFA).
 */
app.post('/api/lotes/notarizar', async (req, res) => {
  try {
    const { idLote } = req.body;
    const lote = fabricLedger.obtenerLote(idLote);
    
    if (!lote) return res.status(404).json({ success: false, error: "Lote no encontrado" });

    // Calculamos un Hash SHA-256 de los datos críticos como simulación de Notarización
    const hashData = `${lote.id}-${lote.renspa}-${lote.volumenToneladas}-${lote.ipfsCID}`;
    const bfaHash = crypto.createHash('sha256').update(hashData).digest('hex');

    const loteActualizado = fabricLedger.actualizarEstadoLogistico(
      idLote, 
      'VERIFICADO_BFA', 
      'SENASA/AFIP', 
      'Sellado criptográfico en BFA exitoso', 
      bfaHash
    );

    res.json({ success: true, data: loteActualizado });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 3. POST /api/lotes/exportar (Exportador)
 * Acuña el NFT en la blockchain pública local (Hardhat) y genera QR info.
 */
app.post('/api/lotes/exportar', async (req, res) => {
  try {
    const { idLote, exportadorAddress } = req.body;
    const lote = fabricLedger.obtenerLote(idLote);

    if (!lote) return res.status(404).json({ success: false, error: "Lote no encontrado" });

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
    console.error(error);
    res.status(500).json({ success: false, error: "Error en blockchain local. Asegurese de que Hardhat Node esté corriendo." });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🚀 Backend AgTech Node.js corriendo en http://localhost:${PORT}`);
});
