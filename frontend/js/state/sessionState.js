/**
 * Sesión activa, o null.
 *
 *   solicitante: {tipo:'user', dni, nombre, cargo, area}
 *   logística:   {tipo:'admin', usuario, rol:'admin'|'seguimiento', token, nombre, area}
 *
 * `rol` es el permiso real, verificado en el servidor en cada llamada; ocultar
 * botones aquí es solo para no confundir a quien no puede usarlos, no la
 * medida de seguridad (esa vive en backend/usuarios/middleware.js).
 *
 * Único módulo autorizado a reasignar `sesion`; el resto la importa solo lectura.
 */
export let sesion = null;

export function setSesion(v) {
  sesion = v;
}
