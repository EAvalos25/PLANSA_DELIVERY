import { obtener, crear, modificar, reemplazar, borrar } from './cliente.js';

/**
 * Estado de la aplicación en el navegador.
 *
 * Sustituye a la antigua capa de localStorage: ahora la verdad vive en SQLite,
 * en el servidor. Aquí solo se guarda una COPIA para poder pintar la pantalla
 * de forma síncrona, que es como está escrito todo el render.
 *
 * El trato es simple:
 *   - `cargar()` trae el estado completo una vez, al arrancar.
 *   - Cada escritura va al servidor y, si el servidor la acepta, se actualiza
 *     la copia local. Nunca al revés: la pantalla no inventa datos que el
 *     servidor no haya confirmado.
 *   - `sincronizar()` pregunta por el testigo de revisión (unos bytes) y solo
 *     recarga todo cuando de verdad cambió algo en otra pestaña o en otra PC.
 */

/**
 * Copia local del estado. La leen las vistas; nadie la escribe a mano.
 *
 * El padrón NO está aquí, a propósito: son datos personales de 212 personas y
 * la pantalla nunca necesita más de una ficha a la vez. Se piden al servidor
 * cuando hacen falta (`buscarPersonal`, `buscarEnPadron`) y de él solo se
 * guarda el total, que es lo único que se muestra.
 */
export let DB = {
  totalPersonal: 0,
  solicitudes: [],
  autorizaciones: [],
  adjuntos: [],
  destinos: []
};

let revisionActual = null;

export async function cargar() {
  const estado = await obtener('/estado');
  DB = {
    totalPersonal: estado.totalPersonal,
    solicitudes: estado.solicitudes,
    autorizaciones: estado.autorizaciones,
    adjuntos: estado.adjuntos,
    destinos: estado.destinos
  };
  revisionActual = estado.revision;
  return DB;
}

/**
 * Revisa si alguien más cambió algo. Con el histórico cargado el estado pesa
 * cientos de KB, así que primero se pregunta el testigo y solo se recarga
 * cuando cambió: sin eso, sondear cada pocos segundos sería descargarlo todo
 * una y otra vez.
 */
export async function sincronizar(onCambio) {
  try {
    const { revision } = await obtener('/revision');
    if (revision === revisionActual) return false;
    await cargar();
    if (onCambio) onCambio();
    return true;
  } catch (e) {
    // Sin conexión no se rompe la pantalla: se reintenta en el próximo sondeo.
    return false;
  }
}

// ------------------------------------------------------------------- auth
export const ingresarLogistica = (usuario, clave) => crear('/auth/ingresar', { usuario, clave });
export const salirLogistica = () => crear('/auth/salir');
export const cambiarMiClave = (actual, nueva) => reemplazar('/auth/clave', { actual, nueva });
export const buscarEnPadron = doc => obtener('/auth/solicitante/' + encodeURIComponent(doc));

// --------------------------------------------------------------- personal
export async function agregarPersona(datos) {
  const p = await crear('/personal', datos);
  DB.totalPersonal++;
  DB.autorizaciones
    .filter(a => a.dni === p.dni && a.estado === 'Pendiente')
    .forEach(a => { a.estado = 'Aprobada'; });
  return p;
}

export async function quitarPersona(dni) {
  await borrar('/personal/' + encodeURIComponent(dni));
  DB.totalPersonal--;
}

export const buscarPersonal = q => obtener('/personal?q=' + encodeURIComponent(q));

// ------------------------------------------------------------ solicitudes
export async function crearSolicitud(datos) {
  const s = await crear('/solicitudes', datos);
  DB.solicitudes.push(s);
  return s;
}

export async function actualizarSolicitud(id, cambios) {
  const s = await modificar('/solicitudes/' + encodeURIComponent(id), cambios);
  reemplazarSolicitud(s);
  return s;
}

export async function avanzarSolicitud(id) {
  const s = await crear('/solicitudes/' + encodeURIComponent(id) + '/avanzar');
  reemplazarSolicitud(s);
  return s;
}

function reemplazarSolicitud(s) {
  const i = DB.solicitudes.findIndex(x => x.id === s.id);
  if (i >= 0) DB.solicitudes[i] = s; else DB.solicitudes.push(s);
}

/**
 * Reporte de viajes en Excel. Es un binario, no JSON, así que no pasa por
 * `crear`/`obtener`: se pide la respuesta cruda para leer el archivo y el
 * nombre que el servidor le puso en Content-Disposition.
 */
export async function exportarExcel(desde, hasta) {
  const qs = [];
  if (desde) qs.push('desde=' + encodeURIComponent(desde));
  if (hasta) qs.push('hasta=' + encodeURIComponent(hasta));
  const res = await obtener('/solicitudes/exportar' + (qs.length ? '?' + qs.join('&') : ''), { crudo: true });
  if (!res.ok) {
    let mensaje = 'Error ' + res.status + ' al exportar.';
    try { const d = await res.json(); if (d && d.error) mensaje = d.error; } catch (e) { /* sin cuerpo JSON */ }
    throw Object.assign(new Error(mensaje), { status: res.status });
  }
  const nombre = /filename="([^"]+)"/.exec(res.headers.get('content-disposition') || '');
  return { blob: await res.blob(), nombre: nombre ? nombre[1] : 'viajes.xlsx' };
}

// --------------------------------------------------------- autorizaciones
export async function pedirAutorizacion(dni) {
  const r = await crear('/autorizaciones', { dni });
  if (!r.repetido) {
    DB.autorizaciones.unshift({ dni: r.dni, solicitado: new Date().toISOString(), estado: 'Pendiente' });
  }
  return r;
}

export async function resolverAutorizacion(dni, estado) {
  await modificar('/autorizaciones/' + encodeURIComponent(dni), { estado });
  DB.autorizaciones
    .filter(a => a.dni === dni && a.estado === 'Pendiente')
    .forEach(a => { a.estado = estado; });
}

// ---------------------------------------------------------------- usuarios
// Cuentas de logística (admin/seguimiento). No confundir con `personal`
// (padrón), que es quién puede PEDIR un servicio.
export const listarUsuarios = () => obtener('/usuarios');
export const crearUsuarioLogistica = (usuario, rol) => crear('/usuarios', { usuario, rol });
export const restablecerClaveUsuario = id => crear('/usuarios/' + id + '/restablecer');
export const cambiarEstadoUsuario = (id, activo) => modificar('/usuarios/' + id, { activo });
