import { db, aCamel } from '../conexion.js';
import { normalizarDoc, DOC_VALIDO } from '#shared/documento.js';
import { tocar } from './ajustes.js';

/**
 * Pedidos de acceso de quien intentó entrar sin figurar en el padrón.
 *
 * Es la única vía por la que alguien de fuera deja rastro en el sistema, así
 * que se guarda el documento tal como quedó normalizado y nada más: no se
 * pregunta nombre ni correo a alguien sin verificar.
 */

const error = (msg, status = 400) => Object.assign(new Error(msg), { status });

export function listar() {
  return db().prepare('SELECT * FROM autorizaciones ORDER BY solicitado DESC').all().map(aCamel);
}

export const pendientes = () =>
  listar().filter(a => a.estado === 'Pendiente');

export function pedir(doc) {
  const dni = normalizarDoc(doc);
  if (!DOC_VALIDO.test(dni)) throw error('Documento inválido.');

  const yaHay = db().prepare(
    "SELECT 1 FROM autorizaciones WHERE dni = ? AND estado = 'Pendiente'"
  ).get(dni);
  if (yaHay) return { dni, repetido: true };

  db().prepare(
    "INSERT INTO autorizaciones (dni, solicitado, estado) VALUES (?, ?, 'Pendiente')"
  ).run(dni, new Date().toISOString());
  tocar();
  return { dni, repetido: false };
}

export function resolver(doc, estado) {
  if (!['Aprobada', 'Rechazada'].includes(estado)) throw error('Estado inválido.');
  const dni = normalizarDoc(doc);
  const r = db().prepare(
    "UPDATE autorizaciones SET estado = ? WHERE dni = ? AND estado = 'Pendiente'"
  ).run(estado, dni);
  if (!r.changes) throw error('No hay un pedido pendiente para el documento ' + dni + '.', 404);
  tocar();
  return { dni, estado };
}
