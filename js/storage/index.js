import * as adaptador from './adapters/indexedDbAdapter.js';

/**
 * Capa de archivos adjuntos: la guía o documento de entrega de cada viaje.
 *
 * Mantiene un índice de metadatos en memoria (sin los binarios) para que las
 * vistas puedan pintarse de forma síncrona, igual que el resto de la app. Los
 * binarios solo se leen cuando alguien abre o descarga un adjunto.
 *
 * Para mover los archivos a una nube real, ver el contrato documentado en
 * `adapters/indexedDbAdapter.js`.
 */

export const TIPOS_ACEPTADOS = 'image/*,application/pdf';
export const TAMANO_MAXIMO = 15 * 1024 * 1024; // 15 MB por archivo

/** ticketId -> metadatos[] (sin blob), ordenados del más nuevo al más viejo. */
let indice = new Map();

/** Carga el índice de metadatos. Debe llamarse una vez al arrancar la app. */
export async function inicializar() {
  await refrescarIndice();
}

/** Vuelve a leer los metadatos del almacenamiento (p. ej. tras cambios en otra pestaña). */
export async function refrescarIndice() {
  let metadatos = [];
  try { metadatos = await adaptador.listarMetadatos(); }
  catch (e) { metadatos = []; }
  const nuevo = new Map();
  metadatos
    .sort((a, b) => String(b.subidoEn).localeCompare(String(a.subidoEn)))
    .forEach(m => {
      if (!nuevo.has(m.ticketId)) nuevo.set(m.ticketId, []);
      nuevo.get(m.ticketId).push(m);
    });
  indice = nuevo;
}

/** Adjuntos de un ticket, leídos del índice en memoria (síncrono). */
export function adjuntosDe(ticketId) {
  return indice.get(ticketId) || [];
}

/** true si los archivos sobreviven a una recarga del navegador. */
export function esPersistente() {
  return adaptador.esPersistente();
}

/**
 * Guarda un archivo como adjunto de un ticket.
 * Lanza Error con mensaje legible si el archivo no es admisible.
 */
export async function subir(ticketId, archivo, subidoPor) {
  if (!archivo) throw new Error('No se seleccionó ningún archivo.');
  if (archivo.size > TAMANO_MAXIMO) {
    throw new Error('El archivo pesa ' + tamanoLegible(archivo.size)
      + '. El máximo permitido es ' + tamanoLegible(TAMANO_MAXIMO) + '.');
  }
  const esImagen = String(archivo.type).startsWith('image/');
  const esPdf = archivo.type === 'application/pdf';
  if (!esImagen && !esPdf) {
    throw new Error('Solo se admiten imágenes o archivos PDF.');
  }
  const registro = {
    id: nuevoId(),
    ticketId,
    nombre: archivo.name,
    tipo: archivo.type,
    tamano: archivo.size,
    subidoPor: subidoPor || 'Logística',
    subidoEn: new Date().toISOString(),
    blob: archivo
  };
  await adaptador.guardar(registro);
  await refrescarIndice();
  return registro.id;
}

/** Elimina un adjunto por id. */
export async function eliminar(id) {
  await adaptador.eliminar(id);
  await refrescarIndice();
}

/**
 * Devuelve una URL utilizable para ver o descargar el adjunto.
 * Con el adaptador local se crea un object URL a partir del blob; con un
 * adaptador de nube, el registro ya trae su propia `url` y se usa esa.
 */
export async function urlDe(id) {
  const registro = await adaptador.leer(id);
  if (!registro) return null;
  if (registro.url) return { url: registro.url, temporal: false, registro };
  if (!registro.blob) return null;
  return { url: URL.createObjectURL(registro.blob), temporal: true, registro };
}

export function tamanoLegible(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(0) + ' KB';
  return (n / (1024 * 1024)).toFixed(1) + ' MB';
}

function nuevoId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'adj-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}
