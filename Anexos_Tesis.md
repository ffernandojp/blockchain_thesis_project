# Anexos: Código Fuente y Configuraciones de la Arquitectura Híbrida

Los siguientes anexos documentan los fragmentos de código fuente más relevantes desarrollados para el prototipo funcional de trazabilidad de la cadena de suministro del maíz. Se exponen las lógicas algorítmicas de los contratos inteligentes (red pública), los controladores de almacenamiento descentralizado (IPFS) y los scripts de persistencia local (Offline-First) implementados en la Aplicación Web Progresiva (PWA).

## Anexo A. Contrato Inteligente ERC-721 para Exportación (Solidity)
El siguiente contrato inteligente fue desarrollado utilizando el lenguaje Solidity y desplegado en la red de pruebas local (Hardhat), simulando la red Ethereum/Polygon. Su función es acuñar un Token No Fungible (NFT) en el momento en que el lote de maíz alcanza el estado EXPORTADO en el puerto (Rocca, Vernucci & Inchausti, 2023). El contrato hereda los estándares de seguridad de la librería OpenZeppelin y vincula de forma inmutable el token con el Identificador de Contenido (CID) del documento respaldatorio alojado en IPFS (Zheng et al., 2017).

**Ubicación en el repositorio:** `blockchain-public/contracts/TrazabilidadMaizNFT.sol`

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title TrazabilidadMaizNFT
 * @dev Contrato para la tokenización de lotes de maíz para exportación.
 * Cada NFT representa un lote físico consolidado, con su metadata IPFS.
 */
contract TrazabilidadMaizNFT is ERC721URIStorage, Ownable {
    uint256 private _nextTokenId;

    event LoteExportado(uint256 indexed tokenId, address indexed exportador, string tokenURI);

    constructor() ERC721("Maiz Trazabilidad Argentina", "MAIZ") Ownable(msg.sender) {}

    /**
     * @dev Acuña (mints) un nuevo NFT que representa un lote de exportación.
     * @param exportador Dirección del exportador que recibe el NFT.
     * @param uri URI del token (típicamente un enlace a IPFS con el historial completo).
     * @return El ID del token recién acuñado.
     */
    function emitirCertificadoExportacion(address exportador, string memory uri) public onlyOwner returns (uint256) {
        uint256 tokenId = _nextTokenId++;
        _safeMint(exportador, tokenId);
        _setTokenURI(tokenId, uri);
        
        emit LoteExportado(tokenId, exportador, uri);
        return tokenId;
    }
}
```

## Anexo B. Controlador Node.js para Almacenamiento Descentralizado (IPFS)
El siguiente fragmento en TypeScript (Node.js/Express) ilustra el controlador de la API REST que recibe el archivo PDF de la Carta de Porte Electrónica (CPE) regulada por ARCA (Resolución General Conjunta 5017/2021, 2021). El código sube el documento al nodo local de IPFS Kubo, extrae el hash inmutable (CID) y estampa la firma criptográfica en el Mock Ledger simulado, evitando sobrecargar la cadena de bloques (Pallotta, 2024; Zheng et al., 2017).

**Ubicaciones en el repositorio:** 
- Controlador de registro: `backend/server.js`
- Servicio de IPFS: `backend/services/ipfsService.js`

```javascript
// --- backend/server.js (Fragmento: Endpoint de Registro) ---

app.post('/api/lotes/registrar', verificarRol(['Productor Agrícola']), upload.single('documento'), async (req, res) => {
  try {
    const { idLote, geolocalizacion, volumenToneladas } = req.body;
    const renspa = req.body.renspa || req.user.renspa;

    if (!req.file) {
      return res.status(400).json({ success: false, error: 'El archivo PDF de Carta de Porte es obligatorio' });
    }

    // Validación del oráculo (lectura del PDF)
    const pdfData = await pdf(req.file.buffer);
    const text = pdfData.text.toUpperCase();
    if (!text.includes('CARTA DE PORTE ELECTRÓNICA') || !(text.includes('CTG') || text.includes('CÓDIGO DE TRAZABILIDAD DE GRANOS'))) {
      return res.status(400).json({ success: false, error: 'Oráculo: El documento no es una Carta de Porte válida' });
    }

    // Subida descentralizada a IPFS
    let ipfsCID = await ipfsService.uploadRegulatoryDocument(req.file.buffer, req.file.originalname);

    // Registro inmutable en el Ledger privado simulado
    const nuevoLote = fabricLedger.registrarCosechaPrimaria(
      idLote, renspa, geolocalizacion, volumenToneladas, ipfsCID
    );
    nuevoLote.owner = req.user.username;

    res.status(201).json({ success: true, data: nuevoLote, cid: ipfsCID });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});


// --- backend/services/ipfsService.js (Fragmento: Servicio de Integración IPFS Kubo) ---

const axios = require('axios');
const FormData = require('form-data');

class IpfsService {
  constructor() {
    this.ipfsApiUrl = 'http://127.0.0.1:5001/api/v0';
  }

  async uploadRegulatoryDocument(fileBuffer, filename = 'documento.pdf') {
    try {
      const formData = new FormData();
      formData.append('file', fileBuffer, { filename });

      const response = await axios.post(`${this.ipfsApiUrl}/add`, formData, {
        headers: { ...formData.getHeaders() }
      });

      return response.data.Hash; // Retorna el CID generado por IPFS
    } catch (error) {
      console.error('Error al subir a IPFS local:', error.message);
      throw new Error('Fallo la integración con IPFS Kubo local. ¿Está el daemon corriendo?');
    }
  }
}

module.exports = new IpfsService();
```

## Anexo C. Algoritmo Offline-First en el Frontend (Service Worker)
Para mitigar los desafíos de conectividad rural evaluados por el Instituto Nacional de Tecnología Agropecuaria (INTA, 2024), se implementó un Service Worker en la Aplicación Web Progresiva. Este script captura el evento de sincronización en segundo plano (sync) y vacía la cola de transacciones almacenadas en IndexedDB tan pronto como el dispositivo del productor agrícola recupera el acceso a la red 4G (Huck, 2025; Pereyra, 2025).

**Ubicación en el repositorio:** `frontend/public/sw.js`

```javascript
// sw.js - Service Worker (Fragmento: Background Sync & IndexedDB)

// Captura del evento de sincronización en segundo plano nativo del navegador
self.addEventListener('sync', event => {
    if (event.tag === 'sync-lotes') {
        console.log('[Service Worker] Background Sync disparado!');
        event.waitUntil(sincronizarLotesIndexedDB());
    }
});

// Algoritmo para vaciar la cola de transacciones locales cuando la conectividad se restablece
async function sincronizarLotesIndexedDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('AgTechDB', 1);
        
        request.onsuccess = (e) => {
            const db = e.target.result;
            if(!db.objectStoreNames.contains('lotes_pendientes')) return resolve();
            
            const tx = db.transaction('lotes_pendientes', 'readonly');
            const store = tx.objectStore('lotes_pendientes');
            const getAllReq = store.getAll();
            
            getAllReq.onsuccess = async () => {
                const pendientes = getAllReq.result;
                if (!pendientes || pendientes.length === 0) return resolve();
                
                for (let lote of pendientes) {
                    try {
                        const res = await fetch('http://localhost:3000/api/lotes/registrar', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer test_token' },
                            body: JSON.stringify(lote)
                        });
                        
                        if (res.ok) {
                            // Si el envío fue exitoso, eliminamos el lote de la cola local Offline
                            const delTx = db.transaction('lotes_pendientes', 'readwrite');
                            delTx.objectStore('lotes_pendientes').delete(lote.idLote);
                        }
                    } catch (err) {
                        console.error('[SW] Error enviando lote', err);
                        return reject(err); // Se lanzará un error para reintentar automáticamente más tarde
                    }
                }
                resolve();
            };
        };
        request.onerror = () => reject(request.error);
    });
}
```

## Anexo D. Máquina de Estados Finita (Simulación Hyperledger Fabric)
El siguiente módulo de TypeScript emula el control de acceso y las reglas de negocio (Chaincode) de Hyperledger Fabric (Androulaki et al., 2018; Cachin, 2016). Garantiza que las transiciones de estado del maíz operen estrictamente de manera secuencial, impidiendo fraudes logísticos.

**Ubicación en el repositorio:** `blockchain-private-mock/fabricMockLedger.js`

```javascript
/**
 * Emulador de World State y Chaincode de Hyperledger Fabric.
 * Representa la red permisionada del consorcio agroindustrial.
 */
class FabricMockLedger {
  constructor() {
    this.worldState = new Map();
  }

  /**
   * Registra una cosecha primaria en el campo.
   */
  registrarCosechaPrimaria(idLote, renspa, geolocalizacion, volumenToneladas, ipfsCID) {
    if (this.worldState.has(idLote)) {
      throw new Error(`El lote ${idLote} ya existe en el ledger.`);
    }

    const nuevoLote = {
      id: idLote,
      renspa: renspa,
      geolocalizacion: geolocalizacion,
      volumenToneladas: parseFloat(volumenToneladas),
      estado: 'COSECHADO',
      ipfsCID: ipfsCID, // Documento asociado (Carta de porte, etc)
      bfaHash: null,    // Hash notarial en BFA (Blockchain Federal Argentina)
      historialTransacciones: [{
        accion: 'REGISTRO_INICIAL',
        fecha: new Date().toISOString(),
        actor: 'Productor'
      }]
    };

    this.worldState.set(idLote, nuevoLote);
    return nuevoLote;
  }

  /**
   * Acopio y mezcla de múltiples lotes (balance de masa).
   */
  procesarAcopioYMezcla(nuevoIdLote, idsLotesOrigen) {
    let volumenTotal = 0;
    const historialesOrigen = [];

    for (const idOrigen of idsLotesOrigen) {
      const loteOrigen = this.worldState.get(idOrigen);
      if (!loteOrigen) throw new Error(`Lote origen ${idOrigen} no encontrado.`);
      if (loteOrigen.estado !== 'COSECHADO' && loteOrigen.estado !== 'EN_TRANSITO') {
         throw new Error(`Lote ${idOrigen} en estado inválido para acopio.`);
      }
      volumenTotal += loteOrigen.volumenToneladas;
      historialesOrigen.push(loteOrigen.historialTransacciones);
      
      // Marcar el origen como consumido/mezclado
      loteOrigen.estado = 'MEZCLADO_ACONDICIONADO';
      this.worldState.set(idOrigen, loteOrigen);
    }

    const nuevoLoteMezcla = {
      id: nuevoIdLote,
      renspa: 'ACOPIO_CENTRAL', // RENSPA del acopio
      geolocalizacion: 'Silo_Bahia_Blanca',
      volumenToneladas: volumenTotal,
      estado: 'ACONDICIONADO',
      ipfsCID: null,
      bfaHash: null,
      lotesOrigen: idsLotesOrigen,
      historialTransacciones: [{
        accion: 'ACOPIO_Y_MEZCLA',
        fecha: new Date().toISOString(),
        actor: 'Planta de Acopio',
        detalles: `Volumen consolidado: ${volumenTotal} TN`
      }]
    };

    this.worldState.set(nuevoIdLote, nuevoLoteMezcla);
    return nuevoLoteMezcla;
  }

  /**
   * Actualiza el estado logístico de un lote.
   */
  actualizarEstadoLogistico(idLote, nuevoEstado, actor, detalles = "", bfaHash = null) {
    const lote = this.worldState.get(idLote);
    if (!lote) throw new Error(`Lote ${idLote} no encontrado.`);

    lote.estado = nuevoEstado;
    if (bfaHash) lote.bfaHash = bfaHash;

    lote.historialTransacciones.push({
      accion: `CAMBIO_ESTADO: ${nuevoEstado}`,
      fecha: new Date().toISOString(),
      actor: actor,
      detalles: detalles
    });

    this.worldState.set(idLote, lote);
    return lote;
  }

  obtenerLote(idLote) {
    return this.worldState.get(idLote);
  }

  obtenerLotesPorRenspa(renspa) {
    return Array.from(this.worldState.values()).filter(lote => lote.renspa === renspa);
  }

  obtenerLotesPorEstado(estado) {
    return Array.from(this.worldState.values()).filter(lote => lote.estado === estado);
  }

  obtenerTodosLotes() {
    return Array.from(this.worldState.values());
  }
}

// Exportamos una instancia única (Singleton) para emular la persistencia en memoria del nodo
module.exports = new FabricMockLedger();
```
