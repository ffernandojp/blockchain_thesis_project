# Sistema de Trazabilidad de Maíz con Blockchain Permisionada y Códigos QR

Prototipo completo de Arquitectura Blockchain Híbrida orientada a la cadena de suministro agroindustrial (AgTech). El sistema integra trazabilidad local, registro documental descentralizado y tokenización de lotes de exportación. 

**Características Principales:**
- 🌾 **Mock Blockchain Permisionada**: Simulación de estado mundial (World State) estilo Hyperledger Fabric en memoria Node.js.
- 🗂️ **Almacenamiento Descentralizado**: Integración con un nodo IPFS Kubo Local para guardar documentación (Cartas de Porte).
- ⛓️ **Blockchain Pública**: Contratos Inteligentes ERC-721 en red local (Hardhat) para emitir el certificado final de exportación.
- 📶 **Offline-First**: Frontend con Service Workers e IndexedDB para tolerar la falta de conectividad en el campo.

---

## 🚀 Guía de Ejecución Local y Secuencial

Debe tener instalado **Node.js** e **IPFS Kubo** en su computadora antes de comenzar.

### 1. Inicializar el Proyecto e Instalar Dependencias
Abre su terminal en la raíz del proyecto (`/blockchain_thesis_project`) y ejecute:
```bash
npm init -y
npm install express cors multer axios form-data ethers hardhat @nomicfoundation/hardhat-toolbox @openzeppelin/contracts
```

### 2. Iniciar IPFS (Almacenamiento Descentralizado)
Abre una **NUEVA pestaña** en la terminal y arranca el demonio de IPFS:
```bash
ipfs init # Sólo ejecuta esto si es la primera vez que usas IPFS en tu PC
ipfs daemon
```
o si da error
```bash
~/.local/bin/ipfs init
~/.local/bin/ipfs daemon
```
*(El nodo IPFS quedará escuchando en http://127.0.0.1:5001)*

### 3. Levantar la Red Blockchain Pública (Hardhat)
Abre otra **NUEVA pestaña** en la terminal, navega a la carpeta pública y enciende el nodo de validación local:
```bash
cd blockchain-public
npx hardhat node
```
*(La red JSON-RPC quedará corriendo en http://127.0.0.1:8545)*

### 4. Desplegar el Smart Contract de Exportación (NFT)
En otra **NUEVA pestaña**, navega a la carpeta pública y despliega el contrato:
```bash
cd blockchain-public
npx hardhat run scripts/deploy.js --network localhost
```
⚠️ **MUY IMPORTANTE**: La consola te devolverá una dirección (address) del contrato. Copia esa dirección y actualiza la variable `NFT_CONTRACT_ADDRESS` en el archivo `/backend/server.js`.

### 5. Iniciar el Orquestador Backend
Desde la terminal, dirígete al backend y ejecuta el servidor de Node.js:
```bash
cd backend
node server.js
```

### 6. Abrir la Aplicación Frontend
Para evitar problemas de CORS y permitir la correcta instalación del Service Worker, sirve los archivos estáticos utilizando un servidor local. Puedes usar `npx serve`:
```bash
cd frontend/public
npx serve -l 8080 .
```
- Ingresa desde tu navegador a `http://localhost:8080/index.html`.
- Apaga tu WiFi para probar el registro en caché local (Modo Offline).
- Reactiva el WiFi y el sistema sincronizará automáticamente los datos con la blockchain mockeada.

---
*Desarrollado para arquitectura Blockchain offline-first y 100% en entorno de ejecución local.*
