import * as repo from '../db/repos/eventosSeguridad.js';

/**
 * Punto único para dejar un evento de auditoría. Envuelve `eventosSeguridad`
 * para no repetir en cada ruta cómo sacar el usuario y la IP de `req`.
 *
 * `detalle` es para contexto legible ("rol insuficiente: seguimiento pidió
 * /api/payback"), nunca para datos sensibles: nada de claves, hashes ni
 * tokens completos.
 */
export function log(tipo, req, detalle = '') {
  repo.registrar(tipo, {
    usuario: req?.usuario?.usuario || '',
    ip: req?.ip || req?.socket?.remoteAddress || '',
    detalle
  });
}

export const eventosRecientes = repo.recientes;
