import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

/**
 * Hash de claves con scrypt: viene incorporado en Node, así que no hace falta
 * bcrypt ni ninguna dependencia nativa que compilar (la misma razón por la
 * que conexion.js usa node:sqlite en vez de better-sqlite3).
 *
 * Se guarda "sal:hash" en una sola columna, ambos en hexadecimal, para no
 * necesitar una columna aparte para la sal.
 */
const LONGITUD_HASH = 64;

export function hashClave(clave) {
  const sal = randomBytes(16);
  const hash = scryptSync(String(clave), sal, LONGITUD_HASH);
  return sal.toString('hex') + ':' + hash.toString('hex');
}

export function verificarHash(clave, guardado) {
  const [salHex, hashHex] = String(guardado || '').split(':');
  if (!salHex || !hashHex) return false;
  const sal = Buffer.from(salHex, 'hex');
  const esperado = Buffer.from(hashHex, 'hex');
  const calculado = scryptSync(String(clave || ''), sal, LONGITUD_HASH);
  // Mismo tamaño siempre (LONGITUD_HASH), pero timingSafeEqual exige
  // comprobarlo: con un hash guardado corrupto, comparar tamaños distintos
  // lanzaría en vez de simplemente decir que no coincide.
  return calculado.length === esperado.length && timingSafeEqual(calculado, esperado);
}

/**
 * Clave temporal para dictar por teléfono o anexo: sin 0/O ni 1/I/l, que se
 * confunden al dictarlos o al leerlos en una fuente chica.
 */
const ALFABETO_TEMPORAL = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function generarClaveTemporal(longitud = 8) {
  let clave = '';
  for (const byte of randomBytes(longitud)) clave += ALFABETO_TEMPORAL[byte % ALFABETO_TEMPORAL.length];
  return clave;
}
