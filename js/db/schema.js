/**
 * Esquema de la base de datos.
 *
 * Documenta qué colecciones existen, con qué forma, y concentra en un solo
 * lugar las migraciones cuando la estructura cambie: sube VERSION y agrega
 * el caso correspondiente en `migrar()`.
 *
 * @typedef {Object} Persona
 * @property {string} dni      8 dígitos
 * @property {string} nombre
 * @property {string} area
 * @property {string} sede
 *
 * @typedef {Object} Solicitud
 * @property {string} id             correlativo "REQ-001"
 * @property {string} creado         ISO
 * @property {string} dni            DNI del solicitante
 * @property {string} nombre
 * @property {string} area
 * @property {string} sedeUsuario
 * @property {'Recoger'|'Entregar'} tipo
 * @property {string} servicio
 * @property {string} motivo
 * @property {string} origen
 * @property {string} origenDetalle  solo cuando origen === 'Otros'
 * @property {string} destino
 * @property {string} contacto
 * @property {string} telefono
 * @property {string} fechaProg      AAAA-MM-DD
 * @property {string} horaProg       HH:MM
 * @property {?('Motorizado'|'Carro')} vehiculo
 * @property {?number} costo         soles
 * @property {'En espera'|'En tránsito'|'Concluido'} estado
 * @property {?string} tsEspera      ISO
 * @property {?string} tsTransito    ISO
 * @property {?string} tsConcluido   ISO
 * @property {boolean} demo
 *
 * @typedef {Object} Autorizacion
 * @property {string} dni
 * @property {string} solicitado                                ISO
 * @property {'Pendiente'|'Aprobada'|'Rechazada'} estado
 *
 * @typedef {Object} BaseDeDatos
 * @property {number} version
 * @property {string} pin                  clave del área de logística
 * @property {number} correlativo          último número de ticket emitido
 * @property {Persona[]} personal
 * @property {Solicitud[]} solicitudes
 * @property {Autorizacion[]} autorizaciones
 *
 * Los archivos adjuntos (guías de entrega) NO viven aquí: por su peso se
 * guardan aparte, en la capa `js/storage/`, referenciados por `ticketId`.
 */

export const VERSION = 2;

/** Comprueba que lo recuperado del almacenamiento tenga forma de base válida. */
export function esValida(db) {
  return !!db
    && Array.isArray(db.solicitudes)
    && Array.isArray(db.personal);
}

/**
 * Lleva una base antigua a la VERSION actual. Es idempotente: aplicarla dos
 * veces sobre la misma base no cambia nada.
 */
export function migrar(db) {
  if (!Array.isArray(db.autorizaciones)) db.autorizaciones = [];
  if (typeof db.correlativo !== 'number') {
    db.correlativo = db.solicitudes.length;
  }
  if (typeof db.pin !== 'string' || !db.pin) db.pin = 'logistica';
  db.version = VERSION;
  return db;
}
