/**
 * Adaptador de almacenamiento de archivos: IndexedDB del navegador.
 *
 * IndexedDB se usa (y no localStorage) porque guarda Blobs binarios y admite
 * cientos de MB, mientras que localStorage se limita a ~5 MB de texto.
 *
 * ---------------------------------------------------------------------------
 * CONTRATO DEL ADAPTADOR — para migrar a una nube real
 * ---------------------------------------------------------------------------
 * Cualquier adaptador debe exportar estas funciones asíncronas:
 *
 *   guardar(registro)   registro = {id, ticketId, nombre, tipo, tamano,
 *                                   subidoPor, subidoEn, blob}  -> void
 *   listarMetadatos()   -> registro[] SIN el blob (para el índice en memoria)
 *   leer(id)            -> registro con blob, o null
 *   eliminar(id)        -> void
 *
 * Para Firebase Storage / S3 / SharePoint: sube el binario al bucket y guarda
 * la URL resultante en el registro; `leer()` devuelve esa URL en vez del blob.
 * `js/storage/index.js` ya contempla ambos casos al abrir un adjunto.
 * Solo se cambia el import en `js/storage/index.js`; nada más del proyecto.
 * ---------------------------------------------------------------------------
 */

const NOMBRE_DB = 'pn_mensajeria_archivos';
const ALMACEN = 'archivos';
const VERSION = 1;

// Respaldo en memoria si IndexedDB no está disponible (modo privado, iframe
// restringido, Node en las pruebas). Los archivos se pierden al recargar; se
// avisa al usuario desde la capa de arriba.
const memoria = new Map();
let dbPromesa = null;

function hayIndexedDB() {
  return typeof indexedDB !== 'undefined' && indexedDB !== null;
}

// Si la apertura no responde en este plazo se sigue con el respaldo en
// memoria. Sin este límite, un IndexedDB bloqueado (otra pestaña reteniendo
// una versión anterior, políticas del navegador) dejaría la promesa sin
// resolver para siempre y colgaría a quien la espere.
const TIMEOUT_APERTURA = 2500;

function abrirDB() {
  if (!hayIndexedDB()) return Promise.resolve(null);
  if (dbPromesa) return dbPromesa;
  dbPromesa = new Promise(resolve => {
    let resuelto = false;
    const terminar = valor => {
      if (resuelto) return;
      resuelto = true;
      // Si se agotó el tiempo, se descarta la promesa cacheada para que un
      // intento posterior pueda volver a probar con IndexedDB.
      if (valor === null) dbPromesa = null;
      resolve(valor);
    };
    const reloj = setTimeout(() => terminar(null), TIMEOUT_APERTURA);
    const cerrar = valor => { clearTimeout(reloj); terminar(valor); };

    let peticion;
    try { peticion = indexedDB.open(NOMBRE_DB, VERSION); }
    catch (e) { cerrar(null); return; }
    peticion.onupgradeneeded = () => {
      const db = peticion.result;
      if (!db.objectStoreNames.contains(ALMACEN)) {
        const almacen = db.createObjectStore(ALMACEN, { keyPath: 'id' });
        almacen.createIndex('porTicket', 'ticketId', { unique: false });
      }
    };
    peticion.onsuccess = () => cerrar(peticion.result);
    peticion.onerror = () => cerrar(null);
    peticion.onblocked = () => cerrar(null);
  });
  return dbPromesa;
}

function operar(modo, fn) {
  return abrirDB().then(db => {
    if (!db) return null;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(ALMACEN, modo);
      const almacen = tx.objectStore(ALMACEN);
      let resultado;
      try { resultado = fn(almacen); } catch (e) { reject(e); return; }
      tx.oncomplete = () => resolve(resultado && resultado.result !== undefined ? resultado.result : resultado);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  });
}

/** true si los archivos persisten entre recargas; false si solo viven en memoria. */
export function esPersistente() {
  return hayIndexedDB();
}

export async function guardar(registro) {
  if (!hayIndexedDB()) { memoria.set(registro.id, registro); return; }
  await operar('readwrite', almacen => almacen.put(registro));
}

export async function listarMetadatos() {
  if (!hayIndexedDB()) {
    return [...memoria.values()].map(sinBlob);
  }
  const todos = await operar('readonly', almacen => almacen.getAll());
  return (todos || []).map(sinBlob);
}

export async function leer(id) {
  if (!hayIndexedDB()) return memoria.get(id) || null;
  const registro = await operar('readonly', almacen => almacen.get(id));
  return registro || null;
}

export async function eliminar(id) {
  if (!hayIndexedDB()) { memoria.delete(id); return; }
  await operar('readwrite', almacen => almacen.delete(id));
}

function sinBlob(registro) {
  const { blob, ...meta } = registro;
  return meta;
}
