/**
 * Emulador de World State y Chaincode de Hyperledger Fabric.
 * Representa la red permisionada del consorcio agroindustrial.
 * 
 * Implementa el cálculo dinámico de proporciones en búsqueda recursiva inversa (backtracking)
 * para auditoría de mezclas en silos (commingling / balance de masa).
 */

function normalizarGeolocalizacion(geo) {
  if (!geo) {
    return { lat: -34.6037, lng: -58.3816, formatted: "Lat: -34.6037, Lon: -58.3816" };
  }
  if (typeof geo === 'object' && geo.lat !== undefined && (geo.lng !== undefined || geo.lon !== undefined)) {
    const lat = parseFloat(geo.lat);
    const lng = parseFloat(geo.lng !== undefined ? geo.lng : geo.lon);
    return {
      lat: isNaN(lat) ? -34.6037 : lat,
      lng: isNaN(lng) ? -58.3816 : lng,
      formatted: `Lat: ${lat.toFixed(4)}, Lon: ${lng.toFixed(4)}`
    };
  }
  if (typeof geo === 'string') {
    const match = geo.match(/Lat:\s*([-\d.]+),\s*Lo[ng]+:\s*([-\d.]+)/i);
    if (match) {
      const lat = parseFloat(match[1]);
      const lng = parseFloat(match[2]);
      return { lat, lng, formatted: geo };
    }
    const parts = geo.split(',');
    if (parts.length === 2 && !isNaN(parseFloat(parts[0])) && !isNaN(parseFloat(parts[1]))) {
      const lat = parseFloat(parts[0].trim());
      const lng = parseFloat(parts[1].trim());
      return { lat, lng, formatted: `Lat: ${lat.toFixed(4)}, Lon: ${lng.toFixed(4)}` };
    }
    return { lat: -34.6037, lng: -58.3816, formatted: geo };
  }
  return { lat: -34.6037, lng: -58.3816, formatted: String(geo) };
}

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

    // Control para no ingresar el mismo documento (lote) dos veces
    if (ipfsCID) {
      const loteExistente = Array.from(this.worldState.values()).find(lote => lote.ipfsCID === ipfsCID);
      if (loteExistente) {
        throw new Error(`El documento de este lote (Carta de Porte) ya fue registrado previamente (Lote ID: ${loteExistente.id}).`);
      }
    }

    const fechaRegistro = new Date().toISOString();
    const nuevoLote = {
      id: idLote,
      renspa: renspa,
      geolocalizacion: geolocalizacion,
      volumenToneladas: parseFloat(volumenToneladas),
      estado: 'COSECHADO',
      ipfsCID: ipfsCID, // Documento asociado (Carta de porte, etc)
      bfaHash: null,    // Hash notarial en BFA (Blockchain Federal Argentina)
      fechaCosecha: fechaRegistro,
      lotesOrigen: [],
      historialTransacciones: [{
        accion: 'REGISTRO_INICIAL',
        fecha: fechaRegistro,
        actor: 'Productor'
      }]
    };

    this.worldState.set(idLote, nuevoLote);
    return nuevoLote;
  }

  /**
   * Acopio y mezcla de múltiples lotes (balance de masa en silos).
   * Preserva inmutablemente los lotes precursores actualizando su estado a 'MEZCLADO_ACONDICIONADO'.
   */
  procesarAcopioYMezcla(nuevoIdLote, idsLotesOrigen) {
    if (this.worldState.has(nuevoIdLote)) {
      throw new Error(`El lote consolidado ${nuevoIdLote} ya existe en el ledger.`);
    }

    if (!Array.isArray(idsLotesOrigen) || idsLotesOrigen.length === 0) {
      throw new Error("Debe proporcionar al menos un lote de origen para el acopio y mezcla.");
    }

    let volumenTotal = 0;
    const ahora = new Date().toISOString();

    for (const idOrigen of idsLotesOrigen) {
      const loteOrigen = this.worldState.get(idOrigen);
      if (!loteOrigen) {
        throw new Error(`Lote origen ${idOrigen} no encontrado.`);
      }

      // Regla de Negocio e Invariante de Estados: Consumo de Estados (No Doble Gasto)
      // Un lote precursor no puede haber sido consumido previamente en otra fusión ni estar bloqueado/exportado
      if (loteOrigen.estado === 'MEZCLADO_ACONDICIONADO' || loteOrigen.estado === 'CONSOLIDADO_PUERTO') {
        throw new Error(`Consumo de Estados (No Doble Gasto): El lote ${idOrigen} ya fue consumido en una mezcla previa (${loteOrigen.estado}) y no puede volver a utilizarse.`);
      }

      if (loteOrigen.estado === 'BLOQUEADO') {
        throw new Error(`El lote ${idOrigen} se encuentra BLOQUEADO fitosanitariamente y no puede ser consolidado.`);
      }

      if (loteOrigen.estado === 'EXPORTADO') {
        throw new Error(`El lote ${idOrigen} ya fue EXPORTADO y no puede ser consolidado.`);
      }

      // Regla Operativa y Física: Recepción Completa Obligatoria
      // Para ingresar a una mezcla en silo, el camión debe haber completado obligatoriamente la recepción en balanza y calador.
      // Si está en viaje (EN_TRANSITO, EN_TRANSITO_ACOPIO) o recién cosechado (COSECHADO), se rechaza la consolidación de masa.
      if (loteOrigen.estado === 'EN_TRANSITO' || loteOrigen.estado === 'EN_TRANSITO_ACOPIO' || loteOrigen.estado === 'COSECHADO') {
        throw new Error(`Recepción incompleta: El lote ${idOrigen} se encuentra en estado '${loteOrigen.estado}'. Para ingresar a una mezcla en silo, el camión debe completar obligatoriamente la recepción en balanza y calador (estado RECEPCIONADO_ACOPIO o ACONDICIONADO).`);
      }

      const estadosAdmitidos = ['RECEPCIONADO_ACOPIO', 'ACONDICIONADO', 'ACOPIADO_ACONDICIONADO'];
      if (!estadosAdmitidos.includes(loteOrigen.estado)) {
        throw new Error(`Lote ${idOrigen} en estado '${loteOrigen.estado}', inválido para acopio y mezcla. Solo se admiten partidas en estado RECEPCIONADO_ACOPIO o ACONDICIONADO.`);
      }

      volumenTotal += loteOrigen.volumenToneladas;

      // Mutación Inmediata a Estado Terminal de Consumo (No Doble Gasto)
      loteOrigen.estado = 'MEZCLADO_ACONDICIONADO';
      loteOrigen.historialTransacciones.push({
        accion: 'CONSOLIDACION_MEZCLA',
        fecha: ahora,
        actor: 'Planta de Acopio / Silo',
        detalles: `Consolidado e integrado en lote de silo ${nuevoIdLote} (${loteOrigen.volumenToneladas} TN aportadas)`
      });

      this.worldState.set(idOrigen, loteOrigen);
    }

    // Conservación de Masa: Volumen(Lote_Resultante) = sum(Volumen(Lote_Origen_i))
    const volumenConsolidado = parseFloat(volumenTotal.toFixed(2));

    const nuevoLoteMezcla = {
      id: nuevoIdLote,
      renspa: 'ACOPIO_CENTRAL', // RENSPA general del acopio / silo
      geolocalizacion: 'Silo_Bahia_Blanca',
      volumenToneladas: volumenConsolidado,
      estado: 'ACOPIADO_ACONDICIONADO', // Homogeneizado y acondicionado en silo, disponible para fiscalización SENASA
      calidadParams: {
        secado: 'Conforme (<14.0% humedad)',
        zarandeo: 'Completado (Zaranda oficial)',
        fumigacion: 'Aplicada (Fosfuro de aluminio)',
        calidadComercial: 'Grado 2 Homogéneo'
      },
      ipfsCID: null,
      bfaHash: null,
      fechaCosecha: ahora,
      lotesOrigen: [...idsLotesOrigen],
      historialTransacciones: [{
        accion: 'ACOPIO_Y_MEZCLA',
        fecha: ahora,
        actor: 'Planta de Acopio',
        detalles: `Volumen consolidado: ${volumenConsolidado} TN a partir de ${idsLotesOrigen.length} lotes precursores: ${idsLotesOrigen.join(', ')}. Tareas de secado, zarandeo y homogeneización completadas.`
      }]
    };

    this.worldState.set(nuevoIdLote, nuevoLoteMezcla);
    return nuevoLoteMezcla;
  }

  /**
   * Backtracking Recursivo Inverso.
   * Resuelve hacia atrás el grafo acíclico dirigido (DAG) de procedencia:
   * - Nivel 1 (Exportación / Lote Final): Volumen total embarcado y precintado.
   * - Nivel 2 (Nodos Intermedios de Acopio): Plantas y silos donde se efectuó acondicionamiento y mezclas intermedias.
   * - Nivel 3 (Raíz / Origen Primario): RENSPA de productores originales, coordenadas, proporciones (% y TN) y CPE en IPFS.
   */
  obtenerTrazabilidadCompleta(loteId) {
    const lote = this.worldState.get(loteId);
    if (!lote) {
      return null;
    }

    const self = this;
    const nodosIntermediosMap = new Map();

    // Función recursiva para resolver el árbol n-ario de mezclas
    function resolverGenealogia(idActual, fraccionEnPadre = 1.0, camino = [], visitados = new Set()) {
      if (visitados.has(idActual)) {
        throw new Error(`Referencia circular detectada en el lote ${idActual}`);
      }
      visitados.add(idActual);

      const actual = self.worldState.get(idActual);
      if (!actual) {
        throw new Error(`Lote precursor ${idActual} no encontrado en el World State.`);
      }

      const nuevoCamino = [...camino, idActual];

      // Si el lote tiene lotesOrigen con elementos, es un lote consolidado/mezclado
      if (Array.isArray(actual.lotesOrigen) && actual.lotesOrigen.length > 0) {
        // Si no es la raíz examinada, es un nodo intermedio de acopio (Nivel 2)
        if (idActual !== loteId && !nodosIntermediosMap.has(idActual)) {
          nodosIntermediosMap.set(idActual, {
            id: actual.id,
            volumenToneladas: actual.volumenToneladas,
            estado: actual.estado,
            planta: actual.geolocalizacion || 'Planta de Acopio / Silo',
            fecha: actual.fechaCosecha,
            lotesOrigen: actual.lotesOrigen,
            detalles: `Consolidación intermedia en ${actual.geolocalizacion || 'Silo'}`
          });
        }

        let hojas = [];
        const volActual = actual.volumenToneladas;

        for (const idPadre of actual.lotesOrigen) {
          const padre = self.worldState.get(idPadre);
          if (!padre) {
            throw new Error(`Lote padre precursor ${idPadre} no encontrado en el World State.`);
          }

          // Proporción que representa este lote padre dentro del lote actual
          const proporcionEnActual = volActual > 0 ? (padre.volumenToneladas / volActual) : 0;
          // Fracción efectiva acumulada en la mezcla raíz
          const fraccionEfectiva = fraccionEnPadre * proporcionEnActual;

          const hojasPadre = resolverGenealogia(idPadre, fraccionEfectiva, nuevoCamino, new Set(visitados));
          hojas = hojas.concat(hojasPadre);
        }
        return hojas;
      } else {
        // Cosecha primaria / lote hoja monovarietal (Nivel 3)
        return [{
          lote: actual,
          fraccionEfectiva: fraccionEnPadre,
          camino: nuevoCamino
        }];
      }
    }

    // Construcción de árbol jerárquico anidado para visualización directa del DAG
    function construirNodoJerarquico(idActual, nivel = 1, visitados = new Set()) {
      if (visitados.has(idActual)) return null;
      visitados.add(idActual);

      const actual = self.worldState.get(idActual);
      if (!actual) return null;

      const esConsolidado = Array.isArray(actual.lotesOrigen) && actual.lotesOrigen.length > 0;
      const nodo = {
        id: actual.id,
        nivel: nivel,
        tipo: !esConsolidado ? 'COSECHA_PRIMARIA' : (nivel === 1 ? 'LOTE_FINAL' : 'CONSOLIDADO_INTERMEDIO'),
        estado: actual.estado,
        volumenToneladas: actual.volumenToneladas,
        renspa: actual.renspa,
        ipfsCID: actual.ipfsCID,
        geolocalizacion: normalizarGeolocalizacion(actual.geolocalizacion),
        hijos: []
      };

      if (esConsolidado) {
        for (const idHijo of actual.lotesOrigen) {
          const hijoConstruido = construirNodoJerarquico(idHijo, nivel + 1, new Set(visitados));
          if (hijoConstruido) nodo.hijos.push(hijoConstruido);
        }
      }

      return nodo;
    }

    const volumenTotalMezcla = lote.volumenToneladas;
    let desgloseOrigenes = [];

    if (Array.isArray(lote.lotesOrigen) && lote.lotesOrigen.length > 0) {
      const hojas = resolverGenealogia(lote.id, 1.0, []);

      desgloseOrigenes = hojas.map(item => {
        const hoja = item.lote;
        const volumenAportado = parseFloat((item.fraccionEfectiva * volumenTotalMezcla).toFixed(2));
        const porcentajeAporte = volumenTotalMezcla > 0 
          ? parseFloat(((volumenAportado / volumenTotalMezcla) * 100).toFixed(2))
          : 0.0;

        const fechaCosecha = hoja.fechaCosecha || 
          (hoja.historialTransacciones && hoja.historialTransacciones[0] ? hoja.historialTransacciones[0].fecha : lote.fechaCosecha);

        return {
          id: hoja.id,
          renspa: hoja.renspa,
          volumenAportadoTN: volumenAportado,
          porcentajeAporte: porcentajeAporte,
          geolocalizacion: normalizarGeolocalizacion(hoja.geolocalizacion),
          ipfsCID: hoja.ipfsCID,
          fechaCosecha: fechaCosecha,
          caminoGenealogico: item.camino
        };
      });
    } else {
      // Lote monovarietal directo (sin mezclas, 100% de aporte)
      const fechaCosecha = lote.fechaCosecha || 
        (lote.historialTransacciones && lote.historialTransacciones[0] ? lote.historialTransacciones[0].fecha : new Date().toISOString());

      desgloseOrigenes = [{
        id: lote.id,
        renspa: lote.renspa,
        volumenAportadoTN: lote.volumenToneladas,
        porcentajeAporte: 100.0,
        geolocalizacion: normalizarGeolocalizacion(lote.geolocalizacion),
        ipfsCID: lote.ipfsCID,
        fechaCosecha: fechaCosecha,
        caminoGenealogico: [lote.id]
      }];
    }

    const nodosIntermedios = Array.from(nodosIntermediosMap.values());

    const arbolGenealogico = {
      nivel1: {
        id: lote.id,
        volumenTotal: lote.volumenToneladas,
        estado: lote.estado,
        fecha: lote.fechaCosecha,
        lotesOrigen: lote.lotesOrigen || []
      },
      nivel2: nodosIntermedios,
      nivel3: desgloseOrigenes,
      esConsolidadoMultinivel: nodosIntermedios.length > 0,
      esMezcla: desgloseOrigenes.length > 1,
      jerarquia: construirNodoJerarquico(lote.id, 1)
    };

    return {
      ...lote,
      desgloseOrigenes,
      arbolGenealogico
    };
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

  /**
   * Registra el acondicionamiento (secado, zarandeo, fumigación, calidad) de una partida en acopio.
   */
  acondicionarLote(idLote, calidadParams = {}, actor = 'Acopiador / Cooperativa') {
    const lote = this.worldState.get(idLote);
    if (!lote) throw new Error(`Lote ${idLote} no encontrado.`);

    const estadosValidos = ['RECEPCIONADO_ACOPIO', 'ACONDICIONADO'];
    if (!estadosValidos.includes(lote.estado)) {
      throw new Error(`Estado inválido: El lote ${idLote} está en estado '${lote.estado}'. Debe estar en 'RECEPCIONADO_ACOPIO' para registrar acondicionamiento en silo.`);
    }

    const ahora = new Date().toISOString();
    lote.estado = 'ACOPIADO_ACONDICIONADO';
    lote.calidadParams = {
      secado: calidadParams.secado || 'Conforme (<14.0% humedad)',
      zarandeo: calidadParams.zarandeo || 'Completado (Zaranda oficial)',
      fumigacion: calidadParams.fumigacion || 'Aplicada (Fosfuro de aluminio)',
      calidadComercial: calidadParams.calidadComercial || 'Grado 2 Oficial',
      fechaAcondicionamiento: ahora
    };

    lote.historialTransacciones.push({
      accion: 'ACONDICIONAMIENTO_SILO',
      fecha: ahora,
      actor: actor,
      detalles: `Acondicionamiento completado: Secado, zarandeo, fumigación y tipificación comercial (${lote.calidadParams.calidadComercial}).`
    });

    this.worldState.set(idLote, lote);
    return lote;
  }

  /**
   * Momento de emisión del Certificado de SENASA:
   * Se emite una vez que el grano ingresa a acopio/silo y es sometido a tareas de acondicionamiento.
   * Valida lote físico, ausencia de plagas cuarentenarias y estampa el sello oficial BFA.
   */
  notarizarSenasa(idLote, datosInspeccion = {}, actor = 'Organismo de Control (SENASA/ARCA)', bfaHash = null) {
    const lote = this.worldState.get(idLote);
    if (!lote) throw new Error(`Lote ${idLote} no encontrado.`);

    if (lote.estado === 'MEZCLADO_ACONDICIONADO') {
      throw new Error(`Acción regulatoria denegada: El lote ${idLote} ya fue consumido en una mezcla posterior (MEZCLADO_ACONDICIONADO).`);
    }

    if (lote.estado !== 'ACOPIADO_ACONDICIONADO' && lote.estado !== 'ACONDICIONADO') {
      throw new Error(`Momento de emisión del Certificado de SENASA inválido: El lote ${idLote} se encuentra en estado '${lote.estado}'. Solo se emite una vez que el grano ingresa al acopio y es sometido a tareas de acondicionamiento (ACOPIADO_ACONDICIONADO).`);
    }

    const ahora = new Date().toISOString();
    lote.estado = 'VALIDADO_SENASA';
    if (bfaHash) lote.bfaHash = bfaHash;

    lote.certificacionSenasa = {
      inspector: datosInspeccion.inspector || 'Inspector SENASA / ARCA',
      plagasCuarentenarias: datosInspeccion.plagasCuarentenarias || 'Ausencia de plagas cuarentenarias certificada',
      calidadTipificada: datosInspeccion.calidadTipificada || 'Grado 2 Homogéneo Conforme',
      conformidadFitosanitaria: true,
      bfaHash: bfaHash,
      fechaCertificacion: ahora
    };
    lote.inspeccionSenasa = lote.certificacionSenasa;

    lote.historialTransacciones.push({
      accion: 'FISCALIZACION_SENASA_BFA',
      fecha: ahora,
      actor: actor,
      detalles: `Conformidad fitosanitaria oficial estampada en BFA. Libre de plagas cuarentenarias. Hash BFA: ${bfaHash}`
    });

    this.worldState.set(idLote, lote);
    return lote;
  }

  /**
   * Momento de transporte hacia la terminal portuaria:
   * El traslado se autoriza únicamente cuando el lote posee:
   * 1. Estado de calidad validado (ACOPIADO_ACONDICIONADO o VALIDADO_SENASA)
   * 2. Notarización oficial registrada (BFA Hash)
   * 3. Emisión de una nueva Carta de Porte Electrónica (CPE) de traslado con destino específico al puerto (Bahía Blanca o Quequén).
   */
  emitirCpeTraslado(idLote, datosCpe = {}, actor = 'Acopiador / Cooperativa') {
    const lote = this.worldState.get(idLote);
    if (!lote) throw new Error(`Lote ${idLote} no encontrado.`);

    // 1. Estado de calidad validado y certificación SENASA
    if (lote.estado !== 'VALIDADO_SENASA' && !(lote.bfaHash && (lote.estado === 'ACOPIADO_ACONDICIONADO' || lote.estado === 'ACONDICIONADO'))) {
      throw new Error(`Autorización denegada para traslado a puerto: El lote ${idLote} requiere estado de calidad validado y fiscalización fitosanitaria oficial de SENASA.`);
    }

    // 2. Notarización oficial registrada (BFA Hash)
    if (!lote.bfaHash) {
      throw new Error(`Autorización denegada para traslado a puerto: El lote ${idLote} requiere notarización oficial registrada en BFA.`);
    }

    // 3. Destino específico al puerto de exportación (Bahía Blanca o Quequén)
    const destino = datosCpe.destinoPuerto || 'Puerto de Bahía Blanca';
    const destinosValidos = ['Puerto de Bahía Blanca', 'Puerto de Quequén', 'Bahía Blanca', 'Quequén'];
    const esDestinoValido = destinosValidos.some(d => destino.toLowerCase().includes(d.toLowerCase()));
    if (!esDestinoValido) {
      throw new Error(`Destino no autorizado: El traslado debe tener destino específico al puerto de exportación (Bahía Blanca o Quequén). Recibido: '${destino}'`);
    }

    const ahora = new Date().toISOString();
    lote.estado = 'EN_TRANSITO_PUERTO';
    lote.cpeTraslado = {
      tipo: 'CPE_TRASLADO_FLETE_LARGO',
      numeroCPE: datosCpe.numeroCPE || `CPE-TL-${Date.now().toString().slice(-6)}`,
      ctg: datosCpe.ctg || `CTG-${Date.now().toString().slice(-8)}`,
      destinoPuerto: destino.includes('Quequén') ? 'Puerto de Quequén' : 'Puerto de Bahía Blanca',
      transportista: datosCpe.transportista || 'Transporte Logístico Portuario',
      cuitTransportista: datosCpe.cuitTransportista || '30-66778899-1',
      patenteCamion: datosCpe.patenteCamion || 'AF 456 GH',
      ipfsCID: datosCpe.ipfsCID || null,
      fechaEmision: ahora
    };

    lote.historialTransacciones.push({
      accion: 'EMISION_CPE_TRASLADO_PUERTO',
      fecha: ahora,
      actor: actor,
      detalles: `Nueva Carta de Porte Electrónica (CPE) de traslado emitida con destino a ${lote.cpeTraslado.destinoPuerto}. En tránsito hacia terminal portuaria.`
    });

    this.worldState.set(idLote, lote);
    return lote;
  }

  /**
   * Recepción Portuaria:
   * El Exportador y la Aduana validan el arribo del convoy y confirman la CPE de descarga.
   */
  confirmarArriboPuerto(idLote, datosDescarga = {}, actor = 'Exportador (Puertos)') {
    const lote = this.worldState.get(idLote);
    if (!lote) throw new Error(`Lote ${idLote} no encontrado.`);

    if (lote.estado !== 'EN_TRANSITO_PUERTO') {
      throw new Error(`Arribo portuario inválido: El lote ${idLote} se encuentra en estado '${lote.estado}'. Debe estar en 'EN_TRANSITO_PUERTO'.`);
    }

    const ahora = new Date().toISOString();
    lote.estado = 'ARRIBADO_PUERTO';
    lote.arriboPuerto = {
      fechaArribo: ahora,
      cpeDescargaConfirmada: true,
      terminal: datosDescarga.terminal || (lote.cpeTraslado ? lote.cpeTraslado.destinoPuerto : 'Terminal Portuaria Bahía Blanca'),
      balanzaPuertoTN: datosDescarga.balanzaPuertoTN ? parseFloat(datosDescarga.balanzaPuertoTN) : lote.volumenToneladas,
      inspectorAduana: datosDescarga.inspectorAduana || 'Aduana / ARCA / Terminal Portuaria'
    };

    lote.historialTransacciones.push({
      accion: 'ARRIBO_CONFIRMACION_CPE_PUERTO',
      fecha: ahora,
      actor: actor,
      detalles: `Arribo de convoy validado en terminal portuaria. Confirmación definitiva de la CPE de descarga efectuada.`
    });

    this.worldState.set(idLote, lote);
    return lote;
  }

  /**
   * Listado de pedidos habilitados en la planta de exportación:
   * En la terminal portuaria, los pedidos se listan en estado Habilitado para Embarque únicamente si cumplen concurrentemente con:
   * 1. Arribo y confirmación definitiva de la CPE de descarga.
   * 2. Sellado de tiempo y hash inmutable de SENASA/AFIP comprobable en BFA.
   * 3. Acreditación estricta de trazabilidad de masa hacia atrás (backtracking completo hasta los lotes y RENSPA de origen).
   */
  verificarHabilitadoParaEmbarque(idLote) {
    const lote = this.worldState.get(idLote);
    if (!lote) return { habilitado: false, error: `Lote ${idLote} no encontrado` };

    // 1. Arribo y confirmación definitiva de la CPE de descarga
    const cpeDescargaConfirmada = (lote.estado === 'ARRIBADO_PUERTO') || 
                                  (lote.arriboPuerto && lote.arriboPuerto.cpeDescargaConfirmada === true);

    // 2. Sellado de tiempo y hash inmutable de SENASA/AFIP comprobable en BFA
    const selloBfaValido = !!lote.bfaHash && lote.bfaHash.length >= 32;

    // 3. Acreditación estricta de trazabilidad de masa hacia atrás (backtracking completo hasta los lotes y RENSPA de origen)
    const trazaCompleta = this.obtenerTrazabilidadCompleta(idLote);
    const origenes = trazaCompleta && Array.isArray(trazaCompleta.desgloseOrigenes) ? trazaCompleta.desgloseOrigenes : [];
    const trazabilidadMasaAcreditada = origenes.length > 0 && origenes.every(orig => 
      orig.renspa && orig.renspa !== 'No especificado' && orig.volumenAportadoTN > 0
    );

    const habilitado = Boolean(cpeDescargaConfirmada && selloBfaValido && trazabilidadMasaAcreditada);

    return {
      id: idLote,
      habilitado,
      estado: lote.estado,
      checks: {
        cpeDescargaConfirmada: {
          cumplido: Boolean(cpeDescargaConfirmada),
          descripcion: 'Arribo y confirmación definitiva de la CPE de descarga en terminal portuaria'
        },
        selloBfaValido: {
          cumplido: Boolean(selloBfaValido),
          bfaHash: lote.bfaHash || null,
          descripcion: 'Sellado de tiempo y hash inmutable de SENASA/AFIP comprobable en BFA'
        },
        trazabilidadMasaAcreditada: {
          cumplido: Boolean(trazabilidadMasaAcreditada),
          cantidadOrigenes: origenes.length,
          origenes: origenes.map(o => ({ id: o.id, renspa: o.renspa, tn: o.volumenAportadoTN })),
          descripcion: 'Acreditación estricta de trazabilidad de masa hacia atrás (backtracking y RENSPA)'
        }
      },
      cpeTraslado: lote.cpeTraslado || null,
      arriboPuerto: lote.arriboPuerto || null,
      volumenToneladas: lote.volumenToneladas
    };
  }

  obtenerTodosLotes() {
    return Array.from(this.worldState.values());
  }

  limpiar() {
    this.worldState.clear();
  }
}

// Exportamos una instancia única (Singleton) para emular la persistencia en memoria del nodo
module.exports = new FabricMockLedger();
