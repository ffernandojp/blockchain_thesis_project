const axios = require('axios');
const FormData = require('form-data');

/**
 * Servicio para interactuar con IPFS Kubo local a través de su API HTTP.
 * No utiliza dependencias de terceros en la nube, 100% offline-first y local.
 */
class IpfsService {
  constructor() {
    // Puerto por defecto de la API de Kubo local
    this.ipfsApiUrl = 'http://127.0.0.1:5001/api/v0';
  }

  /**
   * Sube un documento a la red local IPFS.
   * @param {Buffer} fileBuffer Buffer del archivo.
   * @param {String} filename Nombre del archivo.
   * @returns {String} CID (Content Identifier) de IPFS.
   */
  async uploadRegulatoryDocument(fileBuffer, filename = 'documento.pdf') {
    try {
      const formData = new FormData();
      formData.append('file', fileBuffer, { filename });

      const response = await axios.post(`${this.ipfsApiUrl}/add`, formData, {
        headers: {
          ...formData.getHeaders()
        }
      });

      // Retornamos el CID del archivo guardado
      return response.data.Hash;
    } catch (error) {
      console.error('Error al subir a IPFS local:', error.message);
      throw new Error('Fallo la integración con IPFS Kubo local. ¿Está el daemon corriendo?');
    }
  }
}

module.exports = new IpfsService();
