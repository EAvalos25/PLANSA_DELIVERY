/**
 * Sesión activa: {tipo:'user'|'admin', dni, nombre, area, sede} o null.
 * Único módulo autorizado a reasignar `sesion`; el resto la importa solo lectura.
 */
export let sesion = null;

export function setSesion(v) {
  sesion = v;
}
