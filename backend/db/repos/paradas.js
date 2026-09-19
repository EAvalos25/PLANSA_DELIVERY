import { db, aCamel } from '../conexion.js';

/**
 * Paradas adicionales de una solicitud con dos o más rutas en la misma
 * programación. El primer destino vive en `solicitudes.destino`; esta tabla
 * solo guarda las que se agregan de más, en el orden en que se visitan.
 */

const error = (msg, status = 400) => Object.assign(new Error(msg), { status });

export function deTicket(ticketId) {
  return db().prepare('SELECT * FROM paradas WHERE ticket_id = ? ORDER BY orden').all(ticketId).map(aCamel);
}

/**
 * Todas las paradas de una vez, agrupadas por ticket. Se usa al listar el
 * histórico completo: una sola consulta y se reparte en memoria, en vez de
 * una consulta por cada una de los miles de tickets.
 */
export function todasAgrupadas() {
  const filas = db().prepare('SELECT * FROM paradas ORDER BY ticket_id, orden').all().map(aCamel);
  const porTicket = new Map();
  for (const p of filas) {
    if (!porTicket.has(p.ticketId)) porTicket.set(p.ticketId, []);
    porTicket.get(p.ticketId).push(p);
  }
  return porTicket;
}

// Un servicio con veinte paradas ya es un caso raro; cien es un abuso (cada
// una es un INSERT, y sin tope el array solo está acotado por el 1 MB del
// body). Los largos de texto siguen la misma regla que el destino principal.
const MAX_PARADAS = 20;

/** Solo se llama al crear el ticket: las paradas no se editan después. */
export function guardar(ticketId, lista) {
  if (!Array.isArray(lista) || !lista.length) return;
  if (lista.length > MAX_PARADAS) throw error('No se admiten más de ' + MAX_PARADAS + ' paradas adicionales.');

  const insertar = db().prepare(
    'INSERT INTO paradas (ticket_id, orden, destino, contacto, telefono) VALUES (?, ?, ?, ?, ?)'
  );
  lista.forEach((p, i) => {
    const destino = String(p?.destino || '').trim();
    const contacto = String(p?.contacto || '').trim();
    const telefono = String(p?.telefono || '').trim();
    if (destino.length < 6) throw error('Cada parada adicional necesita una dirección de destino de al menos 6 caracteres.');
    if (destino.length > 300) throw error('El destino de la parada ' + (i + 1) + ' es demasiado largo.');
    if (contacto.length > 150) throw error('El contacto de la parada ' + (i + 1) + ' es demasiado largo.');
    if (telefono.length > 20) throw error('El teléfono de la parada ' + (i + 1) + ' es demasiado largo.');
    insertar.run(ticketId, i + 1, destino, contacto, telefono);
  });
}
