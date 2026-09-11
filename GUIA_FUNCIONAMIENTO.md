# Guía de Funcionamiento del Sistema de Trazabilidad de Maíz

Esta guía detalla el funcionamiento paso a paso de cada uno de los archivos del proyecto, permitiendo comprender la arquitectura de la solución, sus flujos de datos y la integración de tecnologías (blockchain permisionada, almacenamiento descentralizado, blockchain pública y lógica offline-first).

---

## 🏗️ Arquitectura General del Sistema

El sistema implementa una **Arquitectura Blockchain Híbrida** diseñada para la cadena de suministro agroindustrial. Se divide de la siguiente manera:

```mermaid
graph TD
    A[Productor / Campo] -->|1. Registra Lote + PDF Carta de Porte| B(PWA Frontend Offline-First)
    B -->|Offline| C[(IndexedDB Cache)]
    B -->|Online| D[Backend REST API Express]
    D -->|2. Sube PDF| E[Nodo IPFS Kubo Local]
    E -->|Devuelve CID| D
    D -->|3. Registra Estado Inicial| F[Mock Ledger Fabric]
    D -->|4. Notarización| G[Simulación BFA]
    D -->|5. Acuña NFT Exportación| H[Red Pública Hardhat EVM]
```

1. **Capa Transaccional Privada (Hyperledger Fabric Mock)**: Registra el ciclo logístico completo del grano de forma confidencial mediante un consorcio de actores autorizados.
2. **Almacenamiento Descentralizado (IPFS)**: Aloja documentos regulatorios (Carta de Porte Electrónica) sin sobrecargar la blockchain.
3. **Capa Notarial Pública (Simulación BFA)**: Sella criptográficamente el estado del lote en la Blockchain Federal Argentina.
4. **Capa de Tokenización de Exportación (Hardhat/Ethereum)**: Emite un NFT (ERC-721) que representa la propiedad y trazabilidad inmutable del lote para el mercado internacional.
5. **Acceso Sin Conexión (Offline-First)**: Emplea Service Workers e IndexedDB en dispositivos móviles para permitir que los productores registren la cosecha directamente en el lote agrícola, sin señal de red.

---

## 🗂️ Estructura del Proyecto y Detalle de Archivos

### 1. Capa de Middleware y Orquestación (Backend)

El backend actúa como el orquestador o "puente" entre la interfaz de usuario, la base de datos privada, IPFS y la blockchain pública.

#### 📄 [backend/server.js](file:///home/fernandop/Documents/blockchain_thesis_project/backend/server.js)
Es el servidor principal del sistema escrito en **Node.js** con **Express**. Sus funciones principales son:
* **Autenticación (JWT)**: Contiene una base de usuarios predefinidos con roles específicos (Productor, Transportista, Acopiador, SENASA, Exportador). Al autenticar, emite un JSON Web Token (JWT) con el rol del usuario para restringir accesos mediante el middleware `verificarRol`.
* **Oráculo de Documentos**: En el endpoint de registro, recibe el archivo PDF de la Carta de Porte y utiliza `pdf-parse` para validar que contenga las leyendas `"CARTA DE PORTE ELECTRÓNICA"` y `"CTG"`. Si no las tiene, rechaza el registro (actúa como oráculo validador).
* **Integración con IPFS**: Envía el buffer del PDF validado al servicio de IPFS y recibe un identificador de contenido (CID) único e inmutable.
* **Integración con la Blockchain Pública (EVM/Hardhat)**: En el endpoint de exportación, utiliza la biblioteca `ethers` para conectarse al nodo local de Hardhat. Firma transacciones usando la cuenta por defecto del nodo para interactuar con el contrato inteligente y acuñar (mint) un certificado de exportación en forma de NFT (ERC-721).
* **Máquina de Estados de los Lotes**: Expone los endpoints para que cada actor modifique el estado logístico del lote según las reglas de negocio de la cadena:
  * **Productor**: Registra cosecha (`COSECHADO`).
  * **Transportista**: Inicia el transporte (`EN_TRANSITO`).
  * **Acopiador**: Registra pesaje final y acondiciona (`ACONDICIONADO`).
  * **SENASA**: Notariza en BFA (genera hash SHA-256) o bloquea por alertas fitosanitarias (`BLOQUEADO`).
  * **Exportador**: Emite el NFT y finaliza el proceso (`EXPORTADO`).

#### 📄 [backend/services/ipfsService.js](file:///home/fernandop/Documents/blockchain_thesis_project/backend/services/ipfsService.js)
Clase encargada de la comunicación directa con el servicio local de IPFS (Kubo).
* Se conecta a la API HTTP local de Kubo (`http://127.0.0.1:5001/api/v0`).
* Su método `uploadRegulatoryDocument` recibe el archivo temporal en memoria, construye una petición de tipo `multipart/form-data` usando la librería `form-data`, y lo envía mediante `axios` al endpoint `/api/v0/add`.
* Retorna el **CID (Content Identifier)** del archivo almacenado, el cual es inmutable y sirve como prueba matemática de existencia.

---

### 2. Capa Transaccional Privada (Consorcio)

#### 📄 [blockchain-private-mock/fabricMockLedger.js](file:///home/fernandop/Documents/blockchain_thesis_project/blockchain-private-mock/fabricMockLedger.js)
Emulador en memoria del libro mayor (**World State**) y el código de contrato inteligente (**Chaincode**) de Hyperledger Fabric.
* Utiliza una estructura `Map` de JavaScript para simular la base de datos de estado.
* Emplea un patrón de diseño **Singleton** para persistir la información durante la ejecución del proceso del backend.
* Define la estructura de datos del objeto `LoteMaiz` con campos críticos como `id`, `renspa`, `geolocalizacion`, `volumenToneladas`, `estado`, `ipfsCID`, `bfaHash` y el historial cronológico de transacciones.
* Implementa las funciones transaccionales:
  * `registrarCosechaPrimaria`: Crea y valida que el lote no exista previamente en el World State.
  * `procesarAcopioYMezcla`: Simula la mezcla de varios lotes origen en silos (Balance de Masa), acumulando volumen y vinculando los lotes precursores sin mutación destructiva (preservación inmutable: actualiza su estado a `MEZCLADO_ACONDICIONADO`).
  * `obtenerTrazabilidadCompleta`: Algoritmo de backtracking recursivo inverso (Sección 6.2.5 de la tesina) que resuelve el árbol genealógico de mezclas y calcula on-the-fly el porcentaje exacto de participación de cada cosecha primaria precursor (% Participación = [Volumen Origen / Volumen Total Mezcla] * 100).
  * `actualizarEstadoLogistico`: Modifica el estado del lote y añade una firma (actor, fecha y detalles de la acción) al arreglo `historialTransacciones`, garantizando la inmutabilidad lógica del historial de eventos.

---

### 3. Capa de Tokenización Pública (Blockchain Pública)

#### 📄 [blockchain-public/contracts/TrazabilidadMaizNFT.sol](file:///home/fernandop/Documents/blockchain_thesis_project/blockchain-public/contracts/TrazabilidadMaizNFT.sol)
Contrato Inteligente escrito en **Solidity** (^0.8.24).
* Hereda de `ERC721URIStorage` de OpenZeppelin para emitir tokens no fungibles (NFT) con almacenamiento de metadatos externo, y de `Ownable` para restringir privilegios de acuñación.
* El constructor inicializa el token con el nombre *"Maiz Trazabilidad Argentina"* y el símbolo *"MAIZ"*.
* Define la función `emitirCertificadoExportacion(address exportador, string memory uri)`:
  * Solo puede ser invocada por el dueño del contrato (la cuenta que usa el backend).
  * Autoincrementa el identificador único del token (`_nextTokenId`).
  * Acuña de forma segura el NFT para el exportador (`_safeMint`).
  * Vincula el token con la URI (`_setTokenURI`) que contiene el JSON con la metadata del lote (volumen, RENSPA, geolocalización, hashes).
  * Emite el evento `LoteExportado` a la red pública.

#### 📄 [blockchain-public/scripts/deploy.js](file:///home/fernandop/Documents/blockchain_thesis_project/blockchain-public/scripts/deploy.js)
Script de automatización en JS para el despliegue del contrato.
* Utiliza el entorno de ejecución de **Hardhat** (`hre`).
* Obtiene la fábrica del contrato inteligente `TrazabilidadMaizNFT`, realiza el despliegue a la red y espera la confirmación en los bloques (`waitForDeployment`).
* Imprime en la consola la dirección hexadecimal resultante (`contract address`) para que sea configurada en el backend.

#### 📄 [blockchain-public/hardhat.config.js](file:///home/fernandop/Documents/blockchain_thesis_project/blockchain-public/hardhat.config.js)
Archivo de configuración del entorno de pruebas local de Ethereum.
* Configura la versión del compilador de Solidity (0.8.24) y la versión de la EVM compatible (Cancun).
* Define la red local que corre por defecto en el puerto `8545`.

---

### 4. Interfaz de Usuario e Integración Offline-First (Frontend)

El frontend está implementado bajo el concepto de **Aplicación Web Progresiva (PWA)**, permitiendo su instalación en dispositivos móviles y su funcionamiento autónomo sin acceso a Internet.

#### 📄 [frontend/public/index.html](file:///home/fernandop/Documents/blockchain_thesis_project/frontend/public/index.html)
Es el punto de entrada visual para los agentes logísticos autorizados.
* Contiene una estructura modular basada en divs (`panels`) que se muestran u ocultan dinámicamente según el rol detectado en la autenticación.
* Cuenta con secciones para:
  * Formulario del productor (con geolocalización automática por GPS y subida de archivos).
  * Panel logístico del transportista (con mapa integrado).
  * Panel del acopiador (para pesajes y calidad).
  * Consola de fiscalización de SENASA (con filtros de búsqueda e inicio de notarización/bloqueo).
  * Panel de exportación (para asociar direcciones de billeteras criptográficas).
* Muestra un indicador visual de conexión a Internet (`online` u `offline`) y una bitácora de eventos criptográficos en vivo en la parte inferior.

#### 📄 [frontend/public/app.js](file:///home/fernandop/Documents/blockchain_thesis_project/frontend/public/app.js)
Contiene toda la lógica operativa de la interfaz y la integración offline-first.
* **Control de Vista (RBAC)**: En la función `evaluarPantalla`, lee el rol almacenado en el almacenamiento local (`localStorage`) tras el inicio de sesión y despliega el formulario exacto correspondiente al rol.
* **Generación de ID del Lote**: Implementa una previsualización dinámica. Cuando el productor ingresa su RENSPA y sube un archivo, utiliza la Web Crypto API (`crypto.subtle.digest`) para generar un hash SHA-256 de los metadatos y el nombre del archivo. Los primeros 16 caracteres de este hash (con el prefijo `0x`) se utilizan como el identificador único del lote antes de enviarlo.
* **Persistencia Local (IndexedDB)**:
  * Si la conexión a Internet está activa, envía la transacción de registro directamente al backend REST.
  * Si el navegador se encuentra desconectado (o la variable `forceOffline` está activada), invoca el método `guardarOffline`. Esta función abre la base de datos local `AgTechDB`, accede al almacén de objetos `lotes_pendientes` y guarda el payload completo (incluyendo el archivo binario PDF).
* **Integración del Mapa y GPS**:
  * Utiliza la librería **Leaflet** y tiles de **OpenStreetMap** para renderizar un mapa interactivo.
  * Emplea el método `navigator.geolocation.watchPosition` para actualizar en tiempo real las coordenadas GPS del transportista mientras traslada el lote.
* **Sincronización Automática**:
  * Registra un evento de sincronización en segundo plano con el Service Worker (`sync-lotes`) cuando detecta que la red retorna a estado `online`.
  * Si el navegador no soporta el gestor de sincronización en segundo plano, ejecuta una función de respaldo (`sincronizarDatosOffline`) que recorre recursivamente IndexedDB y envía las transacciones acumuladas en lote al backend.

#### 📄 [frontend/public/sw.js](file:///home/fernandop/Documents/blockchain_thesis_project/frontend/public/sw.js)
El **Service Worker** de la PWA. Corre en un hilo separado del navegador.
* **Caché Estático**: En el evento `install`, descarga y almacena los archivos indispensables de la interfaz (`index.html`, `app.js`, CSS, etc.) en el caché local (`caches.open`).
* **Estrategia de Carga Network-First**: En el evento `fetch`, intercepta las peticiones de recursos. Intenta descargarlos desde el backend y, en caso de fallo por falta de señal, los sirve directamente desde el caché del navegador, logrando que la interfaz cargue de forma instantánea sin Internet. Excluye explícitamente los endpoints de la API (`/api/`) para no cachear datos transaccionales obsoletos.
* **Background Sync**: Escucha el evento `sync`. Al dispararse el tag `'sync-lotes'`:
  * Abre de forma asíncrona la base de datos de IndexedDB `AgTechDB`.
  * Recupera los lotes guardados localmente.
  * Realiza peticiones `POST` al backend para sincronizar los lotes en la blockchain principal.
  * Si la sincronización es exitosa, elimina los registros del almacén local para evitar duplicaciones.

#### 📄 [frontend/public/verificador.html](file:///home/fernandop/Documents/blockchain_thesis_project/frontend/public/verificador.html) y [frontend/public/verificador.js](file:///home/fernandop/Documents/blockchain_thesis_project/frontend/public/verificador.js)
Es el módulo público destinado al consumidor final o inspectores de aduana en puerto.
* **Acceso Público Sin Credenciales**: No requiere inicio de sesión ni token JWT.
* **Lectura de QR**: Al ser invocado mediante una URL con parámetros de consulta (ej. `?id=0x1a2b3c&tx=0x...`), el script lee el identificador del lote.
* **Cabecera Enriquecida**: Muestra el ID del Lote, badge de estado con código de color dinámico, volumen consolidado total, sello de tiempo BFA, código QR interactivo y enlace al contrato en Hardhat/Polygon.
* **Composición de Origen y Trazabilidad de Masa (Balance de Masa en Silos)**:
  * Si el lote proviene de una consolidación/mezcla (`desgloseOrigenes.length > 1`), renderiza un banner destacado de auditoría de silos y una tarjeta individual por cada lote precursor primario.
  * Cada tarjeta expone la **barra visual de progreso porcentual** y texto en negrita (ej. `40.0% de la carga (40.00 TN)`), el **RENSPA** del establecimiento agrícola, la **ubicación geográfica** con enlace directo a OpenStreetMap y el botón interactivo para descargar la **Carta de Porte Electrónica original desde IPFS**.
  * Si el lote es monovarietal directo, renderiza la tarjeta única tradicional con el 100% de participación.
* **Renderizado de la Línea de Tiempo de Trazabilidad**:
  * Realiza una consulta pública al backend `GET /api/lotes/:id`.
  * Si el lote existe, extrae su historial y genera una línea de tiempo estructurada que incluye:
    1. **Registro Primario y Genealogía de Masa**: Desglose de cosechas primarias y balance en silos.
    2. **Logística y Transporte**: Confirmación de tránsito y firma digital del transportista.
    3. **Acopio**: Pesaje comercial final y parámetros de calidad.
    4. **Notarización Estatal**: Firma digital e inmutable de SENASA y hash SHA-256 en BFA.
    5. **Certificado NFT**: Hash de la transacción pública de la blockchain local que demuestra el minteo del NFT.

---

### 5. Archivo de Pruebas de Carga y Simulación

#### 📄 [experiments/stress_test.js](file:///home/fernandop/Documents/blockchain_thesis_project/experiments/stress_test.js)
Script de prueba de estrés volumétrico para verificar el rendimiento del backend y de IPFS.
* **Generación de Carga Virtual**: Genera dinámicamente un documento PDF en memoria de 2MB usando la librería `pdfkit`, añadiendo texto específico para pasar la validación del oráculo y completando el tamaño restante con caracteres de relleno en la sección de metadatos.
* **Simulación Concurrente**: Simula la llegada de 33 camiones de forma paralela (equivalentes a 1000 toneladas de maíz).
* **Mitigación de Errores de Socket**: Implementa un retardo escalonado de 200 milisegundos entre peticiones para prevenir el colapso del socket de red (`EPIPE`).
* **Métricas**: Al finalizar las peticiones concurrentes, calcula e imprime la tasa de éxito (Drop Rate), el tiempo total de procesamiento de la ventana y la latencia promedio por documento enviado.

---

## 🔁 Flujo de Datos Paso a Paso (Ejemplo Operativo)

1. **Autenticación**: El usuario ingresa como `productor1`. El frontend guarda su JWT y activa el panel correspondiente.
2. **Generación del Hash del Lote**: El productor ingresa los datos de cosecha y carga el archivo PDF de la Carta de Porte Electrónica. El frontend calcula localmente el hash SHA-256 y muestra la previsualización del identificador del lote (ej. `0x1a8f9c`).
3. **Registro (Modo Offline)**: Si el productor está en el campo sin señal, el frontend intercepta el envío, guarda los datos del lote y el PDF en IndexedDB local, y le notifica al Service Worker que intente registrar el tag `sync-lotes`.
4. **Sincronización**: Al retornar a la oficina con WiFi, el Service Worker detecta la conexión, procesa la cola de IndexedDB, realiza la petición multipart/form-data al backend, y una vez que el backend responde de forma exitosa, borra el lote de la base de datos del navegador.
5. **Orquestación en el Backend**: El backend recibe el PDF, valida su contenido con el oráculo parser de PDF y lo sube al demonio local de IPFS, obteniendo el CID (ej. `QmXoyp...`).
6. **Escritura en el Mock Ledger**: El backend invoca a `fabricLedger` para insertar el lote en el World State con estado `COSECHADO` y añade el primer registro en el historial.
7. **Actualizaciones de Logística**: El transportista logueado toma el lote y lo pasa a `EN_TRANSITO`. Al llegar al puerto, el acopiador registra el peso de balanza y cambia el estado a `ACONDICIONADO`.
8. **Notarización en BFA**: SENASA busca el lote, valida la Carta de Porte en IPFS, e inicia la notarización. El backend calcula un hash SHA-256 combinando los metadatos inmutables del lote y actualiza el estado agregando el sello de BFA.
9. **Acuñación del NFT de Exportación**: El exportador ingresa la dirección pública de su billetera y solicita la exportación. El backend genera la metadata del NFT en base64, se conecta al contrato inteligente en Hardhat local e invoca `emitirCertificadoExportacion`. Una vez confirmada la transacción en la EVM, cambia el estado a `EXPORTADO` y emite un código QR.
10. **Consulta del Consumidor**: El comprador en el extranjero escanea el código QR del empaque. Este QR lo redirige a la página pública `/verificador?id=0x1a8f9c&tx=0x...`, la cual consulta de forma directa la API del backend sin requerir credenciales y dibuja la línea de tiempo interactiva con los enlaces a IPFS y los hashes de la red Ethereum/Polygon.
