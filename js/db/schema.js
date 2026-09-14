/**
 * Esquema de la base de datos.
 *
 * Documenta qué colecciones existen, con qué forma, y concentra en un solo
 * lugar las migraciones cuando la estructura cambie: sube VERSION y agrega
 * el caso correspondiente en `migrar()`.
 *
 * @typedef {Object} Persona
 * @property {string} dni      8 dígitos (9 si es carné de extranjería)
 * @property {string} nombre
 * @property {string} cargo
 * @property {string} area
 *
 * @typedef {Object} Solicitud
 * @property {string} id             correlativo "REQ-001"
 * @property {string} creado         ISO
 * @property {string} dni            DNI del solicitante ('' si no está en el padrón)
 * @property {string} nombre
 * @property {string} cargo
 * @property {string} area
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
 * @property {'app'|'historico'} fuente   registrada en la app / cargada de la planilla 2026
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

import { pad } from '../utils/format.js';
import { padronInicial, normalizarDoc } from './padron.js';
import { historico2026 } from './historico.js';

export const VERSION = 5;

/** Clave con la que entra el área de logística mientras no se cambie. */
export const PIN_POR_DEFECTO = 'logistica';

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
  if (typeof db.pin !== 'string' || !db.pin) db.pin = PIN_POR_DEFECTO;

  // v3: entra el padrón real de RR.HH. y reemplaza al de demostración. Las
  // altas que logística haya agregado a mano se conservan.
  if (!(db.version >= 3)) {
    const oficial = padronInicial();
    const oficiales = new Set(oficial.map(p => p.dni));
    const agregados = db.personal.filter(p => p.origen === 'manual' && !oficiales.has(p.dni));
    db.personal = oficial.concat(agregados);
  }

  // v4: el padrón deja de llevar sede; la sede de salida se elige en cada
  // solicitud, no se hereda de la persona.
  if (!(db.version >= 4)) db.personal.forEach(p => { delete p.sede; });

  // v5: salen las solicitudes de demostración y entra el histórico real de
  // 2026. Lo que se registró desde la aplicación se conserva y se renumera
  // detrás del histórico, porque los correlativos antiguos chocan con él.
  if (!(db.version >= 5)) {
    const propias = db.solicitudes.filter(s => s.demo === false || s.fuente === 'app');
    const hist = historico2026();
    propias.forEach((s, i) => { s.id = 'REQ-' + pad(hist.length + i + 1); });
    db.solicitudes = hist.concat(propias);
    db.correlativo = db.solicitudes.length;
  }
  db.solicitudes.forEach(s => {
    if (!s.fuente) s.fuente = 'app';
    delete s.demo;
    delete s.sedeUsuario;
  });

  // Los documentos guardados con 7 dígitos (cero inicial recortado en origen)
  // se completan a 8 para que el ingreso por DNI los encuentre.
  db.personal.forEach(p => { p.dni = normalizarDoc(p.dni); });
  db.autorizaciones.forEach(a => { a.dni = normalizarDoc(a.dni); });

  db.version = VERSION;
  return db;
}
