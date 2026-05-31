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
}

// Exportamos una instancia única (Singleton) para emular la persistencia en memoria del nodo
module.exports = new FabricMockLedger();
