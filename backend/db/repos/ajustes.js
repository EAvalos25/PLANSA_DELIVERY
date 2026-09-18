import { db } from '../conexion.js';

/**
 * Ajustes clave/valor: la clave de logística, la versión del esquema y el
 * testigo de revisión.
 *
 * El testigo existe para que el navegador sepa si algo cambió sin descargarse
 * el estado completo. Cada escritura lo mueve; el sondeo pide solo ese valor
 * (unos bytes) y únicamente recarga todo cuando de verdad cambió.
 */

export function leer(clave, porDefecto = null) {
  const f = db().prepare('SELECT valor FROM ajustes WHERE clave = ?').get(clave);
  return f ? f.valor : porDefecto;
}

export function escribir(clave, valor) {
  db().prepare(
    'INSERT INTO ajustes (clave, valor) VALUES (?, ?) ' +
    'ON CONFLICT (clave) DO UPDATE SET valor = excluded.valor'
  ).run(clave, String(valor));
}

/** Marca que algo cambió. La llaman todos los repositorios que escriben. */
export function tocar() {
  const nueva = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  escribir('revision', nueva);
  return nueva;
}

export const revision = () => leer('revision', '0');
