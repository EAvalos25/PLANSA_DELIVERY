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

/** Copia local del estado. La leen las vistas; nadie la escribe a mano. */
export let DB = {
  personal: [],
  solicitudes: [],
  autorizaciones: [],
  adjuntos: [],
  destinos: []
};

let revisionActual = null;

export async function cargar() {
  const estado = await obtener('/estado');
  DB = {
    personal: estado.personal,
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
export const verificarClaveLogistica = clave => crear('/auth/logistica', { clave });
export const buscarEnPadron = doc => obtener('/auth/solicitante/' + encodeURIComponent(doc));

// --------------------------------------------------------------- personal
export async function agregarPersona(datos) {
  const p = await crear('/personal', datos);
  DB.personal.push(p);
  DB.autorizaciones
    .filter(a => a.dni === p.dni && a.estado === 'Pendiente')
    .forEach(a => { a.estado = 'Aprobada'; });
  return p;
}

export async function quitarPersona(dni) {
  await borrar('/personal/' + encodeURIComponent(dni));
  DB.personal = DB.personal.filter(p => p.dni !== dni);
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

// ---------------------------------------------------------------- ajustes
export const cambiarClave = (actual, nueva) => reemplazar('/ajustes/clave', { actual, nueva });
